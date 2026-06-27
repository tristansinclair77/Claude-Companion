// Adventure-mode combat calculation engine.
//
// This module is the source of mechanical truth. It consumes a
// [COMBAT_CALC_REQUEST] block (parsed JSON) from the GM, resolves every
// action via the formulas defined in docs/COMBAT_CALCULATIONS.md, and
// returns a [COMBAT_CALCULATION_RESULT] block (a structured object).
//
// Side effects: this module MUTATES `state` as actions resolve. After
// resolveCalcRequest() returns, HP/MP changes for every actor/target
// involved in the calc are already applied. The GM's subsequent
// [GAME_STATE] diff should NOT re-apply HP changes for entities the
// calc result already mentions — see the rules doc for how the GM is
// told to handle this.
//
// Engine-enforced rules (hard-coded, not GM-applied):
//   - Undying Bond: while Trist HP-after-damage ≤ 50% AND companion
//     HP > 50%, damage redirects to companion.
//
// When/if more engine-enforced rules are added, document them here AND
// in docs/COMBAT_CALCULATIONS.md.

'use strict';

const STAT_KEYS = ['str', 'dex', 'int', 'wis', 'con', 'luck'];
const PLAYER_ACTION_CAP = 3;

// ── Dice + math helpers ──────────────────────────────────────────────────────

function rollD20() {
  return 1 + Math.floor(Math.random() * 20);
}

// Roll a dice expression like "1d8+2", "2d6", "1d4-1". Returns the total.
// Supports a sumOfDice-out param for crit doubling.
function rollDice(expr, out = {}) {
  if (typeof expr !== 'string' || !expr.trim()) { out.diceOnly = 0; return 0; }
  const m = expr.trim().match(/^(\d+)d(\d+)\s*([+-]\s*\d+)?$/i);
  if (!m) {
    const n = parseInt(expr, 10);
    if (!Number.isNaN(n)) { out.diceOnly = n; return n; }
    out.diceOnly = 0;
    return 0;
  }
  const count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const flat  = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
  let dice = 0;
  for (let i = 0; i < count; i++) dice += 1 + Math.floor(Math.random() * sides);
  out.diceOnly = dice;
  return dice + flat;
}

function statMod(stat) {
  if (typeof stat !== 'number') return 0;
  return stat - 8;
}

// Find an entity in state by id. Returns { entity, kind } where kind is
// 'player' | 'aria' | 'party' | 'enemy' | 'summon' | 'bestiary' | null.
// Lookup order: state.enemy → state.party → state.summons → state.bestiary.
function findEntity(state, id) {
  if (!id || !state) return { entity: null, kind: null };
  const lid = String(id).toLowerCase();
  if (lid === 'player'  && state.player) return { entity: state.player, kind: 'player' };
  if (lid === 'aria'    && state.aria)   return { entity: state.aria,   kind: 'aria'   };
  if (lid === 'enemy'   && state.enemy)  return { entity: state.enemy,  kind: 'enemy'  };
  if (state.enemy && state.enemy.id && String(state.enemy.id).toLowerCase() === lid) {
    return { entity: state.enemy, kind: 'enemy' };
  }
  for (const m of (state.party || [])) {
    if (m && String(m.id || m.name).toLowerCase() === lid) return { entity: m, kind: 'party' };
  }
  for (const s of (state.summons || [])) {
    if (s && String(s.id || s.name).toLowerCase() === lid) return { entity: s, kind: 'summon' };
  }
  for (const b of (state.bestiary || [])) {
    if (b && String(b.id || b.name).toLowerCase() === lid) return { entity: b, kind: 'bestiary' };
  }
  return { entity: null, kind: null };
}

// ── Status-effect aggregation ──────────────────────────────────────────────
//
// Walks an entity's status_effects[] and produces an aggregated modifier
// object the resolvers consult per-action: skip_turn, disadvantage_on,
// advantage_on, ac_mod, stat_mod, incoming_damage_mod.
function aggregateStatusEffects(entity) {
  const agg = {
    skip_turn:         false,
    disadvantage_on:   new Set(),
    advantage_on:      new Set(),
    ac_mod:            0,
    stat_mod:          { str: 0, dex: 0, int: 0, wis: 0, con: 0, luck: 0 },
    incoming_damage_mod: 1,
    sources:           [],
  };
  if (!entity || !Array.isArray(entity.status_effects)) return agg;
  for (const se of entity.status_effects) {
    if (!se || !se.effects) continue;
    const fx = se.effects;
    if (fx.skip_turn === true) { agg.skip_turn = true; agg.sources.push(`${se.name || se.id}: skip_turn`); }
    if (Array.isArray(fx.disadvantage_on)) for (const k of fx.disadvantage_on) agg.disadvantage_on.add(String(k).toLowerCase());
    if (Array.isArray(fx.advantage_on))    for (const k of fx.advantage_on)    agg.advantage_on.add(String(k).toLowerCase());
    if (typeof fx.ac_mod === 'number') agg.ac_mod += fx.ac_mod;
    if (fx.stat_mod && typeof fx.stat_mod === 'object') {
      for (const k of STAT_KEYS) {
        if (typeof fx.stat_mod[k] === 'number') agg.stat_mod[k] += fx.stat_mod[k];
      }
    }
    if (typeof fx.incoming_damage_mod === 'number') agg.incoming_damage_mod *= fx.incoming_damage_mod;
    if (Object.keys(fx).length > 0 && (se.name || se.id)) agg.sources.push(se.name || se.id);
  }
  return agg;
}

// Resolve the effective stat value after status_effects stat_mods.
function effectiveStat(entity, statKey) {
  if (!entity) return 8;
  const base = entity[statKey] || 8;
  const agg = aggregateStatusEffects(entity);
  return base + (agg.stat_mod[statKey] || 0);
}

// Default AC for an entity when not explicitly set on it. Status-effect
// ac_mod (e.g. blessed, prone, vulnerable) is added on top whether the base
// is explicit or computed.
function computeAC(entity, kind) {
  if (!entity) return 12;
  const seAgg = aggregateStatusEffects(entity);
  let base;
  if (typeof entity.ac === 'number') {
    base = entity.ac;
  } else if (kind === 'player' || kind === 'aria' || kind === 'party') {
    const dexm = statMod(effectiveStat(entity, 'dex'));
    let armorBonus = 0;
    const eq = entity.equipment || {};
    for (const slot of Object.values(eq)) {
      if (!slot) continue;
      const item = (entity.inventory || []).find((it) => it && it.id === slot.id);
      const ab = item && item.stats && typeof item.stats.ac_bonus === 'number' ? item.stats.ac_bonus : 0;
      armorBonus += ab;
    }
    base = 10 + dexm + armorBonus;
  } else if (kind === 'enemy' || kind === 'summon' || kind === 'bestiary') {
    const level = (entity.level || 1);
    base = 12 + Math.ceil(level / 3);
  } else {
    base = 12;
  }
  return base + seAgg.ac_mod;
}

function armorReduction(entity) {
  if (!entity) return 0;
  return typeof entity.armor === 'number' ? entity.armor : 0;
}

// Pick the stat used for to-hit / casting based on action kind + weapon/spell.
function pickToHitStat(action, actorEntity) {
  if (action.stat && STAT_KEYS.includes(String(action.stat).toLowerCase())) {
    return String(action.stat).toLowerCase();
  }
  if (action.kind === 'spell' || action.kind === 'ability')   return 'int';
  if (action.kind === 'attack') {
    // ranged tag on the weapon → DEX, else STR
    const wepId = action.weapon;
    if (wepId && actorEntity && Array.isArray(actorEntity.inventory)) {
      const item = actorEntity.inventory.find((it) => it && it.id === wepId);
      if (item && (item.type === 'ranged' || (item.tags || []).includes('ranged'))) return 'dex';
    }
    return 'str';
  }
  return 'str';
}

// Look up the damage expression for an action (weapon dmg, spell dmg, or
// explicit dmg field on the action itself).
function pickDamageExpr(action, actorEntity) {
  if (action.dmg) return String(action.dmg);
  if (action.kind === 'attack' && action.weapon && actorEntity) {
    const item = (actorEntity.inventory || []).find((it) => it && it.id === action.weapon);
    if (item && item.stats && item.stats.dmg) return String(item.stats.dmg);
  }
  if ((action.kind === 'spell' || action.kind === 'ability') && actorEntity) {
    const list = action.kind === 'spell' ? (actorEntity.spells || []) : (actorEntity.abilities || []);
    const ref = list.find((x) => x && (x.id === action.spell || x.id === action.ability));
    if (ref && ref.dmg) return String(ref.dmg);
  }
  return null;
}

// ── Engine-enforced rule: Undying Bond ───────────────────────────────────────
//
// Read the ability data from state.player.abilities; if the canonical
// undying-bond ability is present and conditions are met, redirect.

function isUndyingBondActive(state) {
  if (!state || !state.player) return false;
  const abilities = state.player.abilities || [];
  return abilities.some((a) => a && a.id === 'undying-bond');
}

function tryUndyingBondRedirect(state, targetKind, targetEntity, incomingDamage) {
  if (targetKind !== 'player' || incomingDamage <= 0) return null;
  if (!isUndyingBondActive(state)) return null;
  const p = state.player;
  const v = state.aria;
  if (!p || !v) return null;
  const hpAfterIfNotRedirected = Math.max(0, (p.hp || 0) - incomingDamage);
  const pHalf = p.maxHp ? (p.maxHp / 2) : 0;
  const vHalf = v.maxHp ? (v.maxHp / 2) : 0;
  const wouldDropBelowHalf = hpAfterIfNotRedirected <= pHalf;
  const companionAboveHalf = (v.hp || 0) > vHalf;
  if (!wouldDropBelowHalf || !companionAboveHalf) return null;
  return {
    triggered: true,
    redirected_from: 'player',
    redirected_to:   'aria',
    redirected_amount: incomingDamage,
    reason: `Undying Bond — Trist would drop to ${hpAfterIfNotRedirected}/${p.maxHp} (≤ ${Math.floor(pHalf)}); Vesper at ${v.hp}/${v.maxHp} (> ${Math.floor(vHalf)}) absorbs the ${incomingDamage} damage.`,
  };
}

// Apply HP damage to an entity, honoring Undying Bond. Mutates state.
// Returns { applied_to, target_hp_before, target_hp_after, redirect? }.
function applyDamage(state, targetKind, targetEntity, damage, _action) {
  if (!targetEntity || damage <= 0) {
    return {
      applied_to: targetEntity ? (targetEntity.id || targetEntity.name || 'target') : null,
      target_hp_before: targetEntity ? targetEntity.hp : null,
      target_hp_after:  targetEntity ? targetEntity.hp : null,
    };
  }
  const redirect = tryUndyingBondRedirect(state, targetKind, targetEntity, damage);
  if (redirect) {
    const v = state.aria;
    const before = v.hp;
    v.hp = Math.max(0, before - damage);
    return {
      applied_to: 'aria',
      target_hp_before: state.player.hp,    // player's HP — unchanged
      target_hp_after:  state.player.hp,
      redirect: {
        ...redirect,
        redirected_hp_before: before,
        redirected_hp_after:  v.hp,
      },
    };
  }
  const before = targetEntity.hp || 0;
  targetEntity.hp = Math.max(0, before - damage);
  return {
    applied_to: targetEntity.id || targetEntity.name || (targetKind === 'player' ? 'player' : targetKind === 'aria' ? 'aria' : 'target'),
    target_hp_before: before,
    target_hp_after:  targetEntity.hp,
  };
}

// ── Modifier extraction ──────────────────────────────────────────────────────

function readMods(action) {
  const m = (action && action.modifiers) || {};
  return {
    attack_bonus:  typeof m.attack_bonus  === 'number' ? m.attack_bonus  : 0,
    damage_bonus:  typeof m.damage_bonus  === 'number' ? m.damage_bonus  : 0,
    armor_pierce:  typeof m.armor_pierce  === 'number' ? m.armor_pierce  : 0,
    crit_range:    typeof m.crit_range    === 'number' ? m.crit_range    : 20,
    advantage:     m.advantage    === true,
    disadvantage:  m.disadvantage === true,
    source:        m.source || null,
  };
}

function rollToHit(mods) {
  if (mods.advantage && !mods.disadvantage) {
    const a = rollD20(), b = rollD20();
    return { die: Math.max(a, b), rolls: [a, b], advantage: true };
  }
  if (mods.disadvantage && !mods.advantage) {
    const a = rollD20(), b = rollD20();
    return { die: Math.min(a, b), rolls: [a, b], disadvantage: true };
  }
  const d = rollD20();
  return { die: d };
}

// ── Action resolvers ─────────────────────────────────────────────────────────

function resolveAttackOrSpellAgainstSingle(state, action, targetId) {
  const { entity: actor }  = findEntity(state, action.actor);
  const { entity: target, kind: targetKind } = findEntity(state, targetId);
  if (!actor)  return { id: action.id, executed: false, error: `unknown actor "${action.actor}"` };
  if (!target) return { id: action.id, executed: false, error: `unknown target "${targetId}"` };

  // Status-effect aggregation for actor + target.
  const actorAgg  = aggregateStatusEffects(actor);
  const targetAgg = aggregateStatusEffects(target);

  // Skip turn if actor is stunned/paralyzed/bound/etc.
  if (actorAgg.skip_turn) {
    return {
      id: action.id, kind: action.kind, actor: action.actor, target: targetId,
      executed: false,
      reason: `actor is incapacitated by status effects (${actorAgg.sources.join(', ')})`,
    };
  }

  const mods = readMods(action);
  // Merge in status-effect advantage/disadvantage. Per spec: advantage and
  // disadvantage cancel; if both present we roll straight.
  const actorAdv  = mods.advantage    || actorAgg.advantage_on.has('attack')   || actorAgg.advantage_on.has('any');
  const actorDis  = mods.disadvantage || actorAgg.disadvantage_on.has('attack') || actorAgg.disadvantage_on.has('any');
  // Target disadvantage_on/advantage_on inverts: if target has disadvantage on
  // "be_attacked", attacker gets advantage.
  const targetAdv = targetAgg.advantage_on.has('be_attacked');
  const targetDis = targetAgg.disadvantage_on.has('be_attacked');
  const finalAdv = (actorAdv || targetDis) && !(actorDis || targetAdv);
  const finalDis = (actorDis || targetAdv) && !(actorAdv || targetDis);
  const effectiveRollMods = { ...mods, advantage: finalAdv, disadvantage: finalDis };

  const statKey = pickToHitStat(action, actor);
  const mod = statMod(effectiveStat(actor, statKey));
  const ac = computeAC(target, targetKind);
  const roll = rollToHit(effectiveRollMods);
  const total = roll.die + mod + mods.attack_bonus;
  const isCrit  = roll.die >= mods.crit_range;
  const isNat1  = roll.die === 1;
  const hit = !isNat1 && (isCrit || total >= ac);

  const out = {
    to_hit: {
      die: roll.die,
      rolls: roll.rolls,
      advantage:    !!roll.advantage,
      disadvantage: !!roll.disadvantage,
      mod, bonus: mods.attack_bonus, total,
      target_ac: ac,
      outcome: isCrit ? 'crit' : (hit ? 'hit' : 'miss'),
    },
    crit: isCrit,
  };

  if (!hit) {
    out.target_hp_before = target.hp;
    out.target_hp_after  = target.hp;
    out.applied_to = target.id || target.name || targetId;
    out.killed = false;
    out.modifier_log = mods.source ? [mods.source] : [];
    return out;
  }

  const dmgExpr = pickDamageExpr(action, actor);
  const diceCarrier = {};
  const dmgRoll = dmgExpr ? rollDice(dmgExpr, diceCarrier) : 0;
  let damage = dmgRoll + mod + mods.damage_bonus;
  if (isCrit && diceCarrier.diceOnly !== undefined) {
    // Crit doubles dice (not modifiers): add another roll of the dice portion.
    const extraCarrier = {};
    const extraDmgRoll = dmgExpr ? rollDice(dmgExpr, extraCarrier) : 0;
    const extraDice = extraCarrier.diceOnly || 0;
    damage += extraDice;
    out.crit_dice_extra = extraDice;
  }
  const armor = Math.max(0, armorReduction(target) - mods.armor_pierce);
  const preMod = Math.max(0, damage - armor);
  // Apply target's incoming_damage_mod (vulnerable / resistant from status).
  const incomingMod = targetAgg.incoming_damage_mod || 1;
  const finalDamage = Math.max(0, Math.round(preMod * incomingMod));

  out.damage = {
    expr:        dmgExpr,
    dice_roll:   dmgRoll,
    dice_only:   diceCarrier.diceOnly || 0,
    stat_mod:    mod,
    bonus:       mods.damage_bonus,
    target_armor: armorReduction(target),
    armor_pierced: Math.min(armorReduction(target), mods.armor_pierce),
    pre_status_mod: preMod,
    incoming_mod: incomingMod,
    total:       finalDamage,
  };
  const applied = applyDamage(state, targetKind, target, finalDamage, action);
  out.applied_to        = applied.applied_to;
  out.target_hp_before  = applied.target_hp_before;
  out.target_hp_after   = applied.target_hp_after;
  if (applied.redirect) out.redirect = applied.redirect;
  out.killed = (out.target_hp_after === 0) && finalDamage > 0;
  out.modifier_log = mods.source ? [mods.source] : [];
  if (mods.armor_pierce > 0) out.modifier_log.push(`Armor pierce: -${mods.armor_pierce} from target armor`);
  return out;
}

function resolveAttackOrSpell(state, action) {
  // Spend MP for spells (whether they hit or miss — magic was cast).
  if (action.kind === 'spell' && action.actor) {
    const { entity: actor } = findEntity(state, action.actor);
    if (actor && action.spell) {
      const spell = (actor.spells || []).find((s) => s && s.id === action.spell);
      if (spell && typeof spell.cost === 'number') {
        actor.mp = Math.max(0, (actor.mp || 0) - spell.cost);
      }
    }
  }

  const targets = Array.isArray(action.targets) && action.targets.length > 0
    ? action.targets
    : (action.target ? [action.target] : []);
  if (targets.length === 0) {
    return { id: action.id, kind: action.kind, actor: action.actor, executed: false, error: 'no target(s) specified' };
  }

  // If save_type / save_stat / dc are set, treat as a save-driven multi-target.
  if (action.save_type && action.save_stat && typeof action.dc === 'number') {
    return resolveSaveDrivenMultiTarget(state, action, targets);
  }

  // Otherwise, attack/spell to-hit per target.
  if (targets.length === 1) {
    const r = resolveAttackOrSpellAgainstSingle(state, action, targets[0]);
    return { id: action.id, kind: action.kind, actor: action.actor, target: targets[0], executed: true, ...r };
  }
  const per = targets.map((t) => ({
    target: t,
    ...resolveAttackOrSpellAgainstSingle(state, action, t),
  }));
  return { id: action.id, kind: action.kind, actor: action.actor, executed: true, per_target: per };
}

function resolveSaveDrivenMultiTarget(state, action, targets) {
  const mods = readMods(action);
  const { entity: actor } = findEntity(state, action.actor);
  const dmgExpr = pickDamageExpr(action, actor);
  const onSave = action.on_save === 'none' ? 'none' : 'half';
  const per = targets.map((tid) => {
    const { entity: target, kind: targetKind } = findEntity(state, tid);
    if (!target) return { target: tid, executed: false, error: `unknown target "${tid}"` };
    const targetAgg = aggregateStatusEffects(target);
    const saveStat = String(action.save_stat).toLowerCase();
    const sm = statMod(effectiveStat(target, saveStat));
    const die = rollD20();
    const total = die + sm;
    const saveOutcome = (die === 1) ? 'failure'
                      : (die === 20) ? 'success'
                      : (total >= action.dc) ? 'success' : 'failure';

    const diceCarrier = {};
    let baseDmg = dmgExpr ? rollDice(dmgExpr, diceCarrier) : 0;
    if (actor) baseDmg += statMod(effectiveStat(actor, 'int'));  // spell INT bonus
    baseDmg += mods.damage_bonus;
    const armor = Math.max(0, armorReduction(target) - mods.armor_pierce);
    let preMod = Math.max(0, baseDmg - armor);
    if (saveOutcome === 'success') preMod = onSave === 'none' ? 0 : Math.floor(preMod / 2);
    const incomingMod = targetAgg.incoming_damage_mod || 1;
    let dmg = Math.max(0, Math.round(preMod * incomingMod));

    const applied = applyDamage(state, targetKind, target, dmg, action);
    return {
      target: tid,
      executed: true,
      save_roll: { die, mod: sm, total, dc: action.dc, stat: saveStat, outcome: saveOutcome },
      damage:    { expr: dmgExpr, total: dmg, on_save: onSave },
      applied_to: applied.applied_to,
      target_hp_before: applied.target_hp_before,
      target_hp_after:  applied.target_hp_after,
      redirect: applied.redirect || undefined,
      killed: applied.target_hp_after === 0 && dmg > 0,
    };
  });
  return {
    id: action.id, kind: action.kind, actor: action.actor,
    executed: true, save_type: action.save_type, save_stat: action.save_stat, dc: action.dc, on_save: onSave,
    per_target: per,
    modifier_log: mods.source ? [mods.source] : [],
  };
}

function resolveSkillCheck(state, action) {
  const { entity: actor } = findEntity(state, action.actor);
  if (!actor) return { id: action.id, executed: false, error: `unknown actor "${action.actor}"` };
  const actorAgg = aggregateStatusEffects(actor);
  if (actorAgg.skip_turn) {
    return {
      id: action.id, kind: action.kind, actor: action.actor, executed: false,
      reason: `actor is incapacitated by status effects (${actorAgg.sources.join(', ')})`,
    };
  }
  const statKey = String(action.stat || 'dex').toLowerCase();
  const mod = statMod(effectiveStat(actor, statKey));
  const mods = readMods(action);
  const checkKind = action.kind === 'save' ? 'save' : 'skill_check';
  const adv = mods.advantage    || actorAgg.advantage_on.has(checkKind)    || actorAgg.advantage_on.has('any');
  const dis = mods.disadvantage || actorAgg.disadvantage_on.has(checkKind) || actorAgg.disadvantage_on.has('any');
  const finalAdv = adv && !dis;
  const finalDis = dis && !adv;
  const rollResult = rollToHit({ ...mods, advantage: finalAdv, disadvantage: finalDis });
  const die = rollResult.die;
  const total = die + mod;
  const dc = typeof action.dc === 'number' ? action.dc : 12;
  let outcome;
  if (die === 20) outcome = 'critical_success';
  else if (die === 1) outcome = 'critical_failure';
  else outcome = total >= dc ? 'success' : 'failure';
  return {
    id: action.id, kind: action.kind, actor: action.actor, executed: true,
    skill_roll: { die, mod, total, dc, stat: statKey, outcome,
                  advantage: !!rollResult.advantage, disadvantage: !!rollResult.disadvantage,
                  rolls: rollResult.rolls },
  };
}

function resolveSave(state, action) {
  // Same shape as a skill check; just labeled differently.
  const r = resolveSkillCheck(state, action);
  if (r.skill_roll) { r.save_roll = r.skill_roll; delete r.skill_roll; }
  return r;
}

// ── Branching / if-condition evaluation ──────────────────────────────────────

// Outcome tags an action can carry. Maps actionResult → set of strings the `if`
// field can match. e.g. ifConditionMet('swing-a.killed', [...prior results...]).
function outcomeTags(r) {
  const tags = new Set();
  if (!r || !r.executed) { tags.add('skipped'); return tags; }
  // Attack/spell/ability
  if (r.to_hit) {
    if (r.to_hit.outcome === 'hit')  tags.add('hit');
    if (r.to_hit.outcome === 'crit') { tags.add('hit'); tags.add('crit'); }
    if (r.to_hit.outcome === 'miss') tags.add('miss');
  }
  if (typeof r.killed === 'boolean') {
    if (r.killed) { tags.add('killed'); }
    else if (tags.has('hit')) tags.add('wounded');
  }
  // Multi-target — combine: any-hit / all-killed convenience tags
  if (Array.isArray(r.per_target)) {
    const anyHit    = r.per_target.some((t) => t.to_hit && (t.to_hit.outcome === 'hit' || t.to_hit.outcome === 'crit'));
    const anyKill   = r.per_target.some((t) => t.killed);
    const allKilled = r.per_target.length > 0 && r.per_target.every((t) => t.killed);
    if (anyHit)    tags.add('hit');
    if (anyKill)   tags.add('killed');
    if (allKilled) tags.add('all_killed');
  }
  // Skill check
  if (r.skill_roll) {
    if (r.skill_roll.outcome === 'success')           tags.add('success');
    if (r.skill_roll.outcome === 'failure')           tags.add('failure');
    if (r.skill_roll.outcome === 'critical_success') { tags.add('success'); tags.add('critical_success'); }
    if (r.skill_roll.outcome === 'critical_failure') { tags.add('failure'); tags.add('critical_failure'); }
  }
  // Save
  if (r.save_roll && !r.skill_roll) {
    if (r.save_roll.outcome === 'success')           tags.add('success');
    if (r.save_roll.outcome === 'failure')           tags.add('failure');
    if (r.save_roll.outcome === 'critical_success') { tags.add('success'); tags.add('critical_success'); }
    if (r.save_roll.outcome === 'critical_failure') { tags.add('failure'); tags.add('critical_failure'); }
  }
  return tags;
}

function ifConditionMet(ifExpr, priorResults) {
  if (typeof ifExpr !== 'string' || !ifExpr.trim()) return true;
  const parts = ifExpr.trim().split('.');
  if (parts.length !== 2) return false;
  const [refId, outcomeName] = parts;
  const prior = priorResults.find((r) => r && r.id === refId);
  if (!prior) return false;
  return outcomeTags(prior).has(outcomeName.toLowerCase());
}

// ── Cap enforcement ──────────────────────────────────────────────────────────

function enforcePlayerCap(actions) {
  const out = [];
  const truncated = [];
  let playerCount = 0;
  for (const a of actions) {
    if (a && String(a.actor || '').toLowerCase() === 'player') {
      if (playerCount >= PLAYER_ACTION_CAP) { truncated.push(a); continue; }
      playerCount += 1;
    }
    out.push(a);
  }
  return { kept: out, truncated };
}

// ── Top-level resolver ──────────────────────────────────────────────────────

function resolveCalcRequest(state, request) {
  const notes = [];
  if (!request || !Array.isArray(request.actions)) {
    return { actions: [], note: 'No calculations requested.', engine_notes: notes };
  }
  if (request.actions.length === 0) {
    return { actions: [], note: 'No calculations requested.', engine_notes: notes };
  }

  const { kept, truncated } = enforcePlayerCap(request.actions);
  if (truncated.length > 0) {
    notes.push(`Truncated to ${PLAYER_ACTION_CAP} player actions; ${truncated.length} ignored: ${truncated.map((a) => a && a.id).filter(Boolean).join(', ')}`);
  }

  const results = [];
  for (const action of kept) {
    if (!action || !action.id) {
      results.push({ id: '(unnamed)', executed: false, error: 'action missing id' });
      continue;
    }
    if (action.if) {
      const met = ifConditionMet(action.if, results);
      if (!met) {
        results.push({ id: action.id, kind: action.kind, actor: action.actor, executed: false, reason: `if condition not met (${action.if})` });
        continue;
      }
    }
    let r;
    try {
      switch (action.kind) {
        case 'attack':
        case 'spell':
        case 'ability':
          r = resolveAttackOrSpell(state, action);
          break;
        case 'skill_check':
          r = resolveSkillCheck(state, action);
          break;
        case 'save':
          r = resolveSave(state, action);
          break;
        default:
          r = { id: action.id, executed: false, error: `unknown kind "${action.kind}"` };
      }
    } catch (e) {
      r = { id: action.id, executed: false, error: 'resolver threw: ' + (e && e.message ? e.message : String(e)) };
    }
    results.push(r);
  }

  // Engine notes: capture Undying Bond status for the GM.
  if (isUndyingBondActive(state)) {
    const triggered = results.some((r) => r && r.redirect);
    if (triggered) {
      notes.push('Undying Bond redirected at least one damage row this turn (see redirect: in result entries).');
    }
  }

  return { actions: results, engine_notes: notes };
}

// ── Pretty formatter for the GM prompt ──────────────────────────────────────
//
// The result object is what the engine works with. The GM sees a formatted
// string of the result (it's easier for the model to parse than a deeply
// nested JSON dump). This is the canonical formatter.

function formatResultForPrompt(result) {
  if (!result) return 'No calculation result.';
  const lines = [];
  lines.push('=== COMBAT CALCULATION RESULT ===');
  if (typeof result.note === 'string' && result.actions.length === 0) {
    lines.push(result.note);
    lines.push('=== END COMBAT CALCULATION RESULT ===');
    return lines.join('\n');
  }
  for (const r of result.actions) {
    lines.push('');
    if (!r.executed) {
      const why = r.reason || r.error || 'unknown';
      lines.push(`[${r.id}] SKIPPED — ${why}`);
      continue;
    }
    lines.push(`[${r.id}] ${r.kind || ''}  actor=${r.actor || '?'}`);
    if (r.per_target) {
      for (const pt of r.per_target) {
        lines.push(`  → ${pt.target}: ${formatTargetRow(pt)}`);
      }
    } else {
      lines.push(`  → ${r.target || ''}: ${formatTargetRow(r)}`);
    }
    if (r.modifier_log && r.modifier_log.length) {
      for (const m of r.modifier_log) lines.push(`  ◦ ${m}`);
    }
  }
  if (Array.isArray(result.engine_notes) && result.engine_notes.length) {
    lines.push('');
    lines.push('Engine notes:');
    for (const n of result.engine_notes) lines.push(`  - ${n}`);
  }
  lines.push('=== END COMBAT CALCULATION RESULT ===');
  return lines.join('\n');
}

function formatTargetRow(r) {
  const parts = [];
  if (r.to_hit) {
    const adv = r.to_hit.advantage ? ' [adv]' : r.to_hit.disadvantage ? ' [disadv]' : '';
    parts.push(`to-hit ${r.to_hit.die}${adv}+${r.to_hit.mod}+${r.to_hit.bonus}=${r.to_hit.total} vs AC ${r.to_hit.target_ac} → ${r.to_hit.outcome}${r.crit ? ' (CRIT)' : ''}`);
  }
  if (r.save_roll) {
    parts.push(`save(${r.save_roll.stat || ''}) ${r.save_roll.die}+${r.save_roll.mod}=${r.save_roll.total} vs DC ${r.save_roll.dc} → ${r.save_roll.outcome}`);
  }
  if (r.skill_roll) {
    parts.push(`check(${r.skill_roll.stat}) ${r.skill_roll.die}+${r.skill_roll.mod}=${r.skill_roll.total} vs DC ${r.skill_roll.dc} → ${r.skill_roll.outcome}`);
  }
  if (r.damage) {
    if (r.damage.total !== undefined) {
      parts.push(`damage ${r.damage.total}${r.damage.expr ? ` (${r.damage.expr})` : ''}${r.damage.target_armor ? ` -${r.damage.target_armor} armor` : ''}`);
    }
  }
  if (typeof r.target_hp_before === 'number' && typeof r.target_hp_after === 'number') {
    parts.push(`HP ${r.target_hp_before}→${r.target_hp_after}`);
  }
  if (r.redirect) {
    parts.push(`REDIRECT(${r.redirect.redirected_from}→${r.redirect.redirected_to}): ${r.redirect.redirected_hp_before}→${r.redirect.redirected_hp_after} (${r.redirect.reason})`);
  }
  if (r.killed) parts.push('KILLED');
  return parts.join(' • ');
}

module.exports = {
  PLAYER_ACTION_CAP,
  rollD20,
  rollDice,
  statMod,
  computeAC,
  findEntity,
  resolveCalcRequest,
  formatResultForPrompt,
  // Exposed for tests
  __test: {
    ifConditionMet,
    outcomeTags,
    tryUndyingBondRedirect,
    enforcePlayerCap,
  },
};
