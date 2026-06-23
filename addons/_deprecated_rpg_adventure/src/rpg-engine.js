'use strict';

// ── RPG Engine — Phase 2 ──────────────────────────────────────────────────────
// Pure computation: combat math, loot generation, run state machine.
// No DB access, no IPC. Called by rpg-ipc.js.

const {
  BRACKETS,
  ARCHETYPE_DISTRIBUTIONS,
  ARMOR_SLOTS,
  ROOM_WEIGHTS,
  BOSS_ABILITIES,
  RARITY_MULT,
  RARITY_STAT_COUNT,
  RARITY_BASE_VALUE,
  SLOT_STAT_POOLS,
  SLOT_BIAS_WEIGHTS,
  SLOT_BUDGET_MODIFIERS,
  WEAPON_ARCHETYPES,
  TIER_MULTIPLIERS,
  BASE_ACCURACY,
  BASE_DODGE,
  NAME_BANKS,
  BOSS_NAME_PARTS,
  ENEMY_NAME_DATA,
  ZONES,
} = require('./rpg-constants');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Scaling Formulas
// ─────────────────────────────────────────────────────────────────────────────

// ── Stat Soft Cap ─────────────────────────────────────────────────────────────
// Piecewise diminishing returns on primary stats.
// 0–300 = full return, 300–450 = 50% marginal, 450+ = 15% marginal.
function softCapStat(stat) {
  if (stat <= 300) return stat;
  if (stat <= 450) return 300 + (stat - 300) * 0.5;
  return 375 + (stat - 450) * 0.15;
}

function xpRequired(level) {
  return Math.floor(50 * Math.pow(level, 1.5));
}

function xpReward(zoneLevel, bracketMult, isShiny = false, isBoss = false) {
  const base     = Math.floor(zoneLevel * bracketMult * 10);
  const shinyMod = isShiny ? 5 : 1;
  const bossMod  = isBoss  ? 10 : 1;
  return base * shinyMod * bossMod;
}

function enemyStatBudget(zoneLevel, bracketBaseBudget) {
  return Math.floor(bracketBaseBudget * Math.pow(zoneLevel, 1.3));
}

function bossBudget(zoneLevel, bracketBaseBudget) {
  return enemyStatBudget(zoneLevel, bracketBaseBudget) * 3;
}

function allocateStats(budget, archetype) {
  const pct = ARCHETYPE_DISTRIBUTIONS[archetype] || ARCHETYPE_DISTRIBUTIONS.balanced;
  return {
    hp:      Math.max(1, Math.floor(budget * pct.hp)),
    atk:     Math.max(1, Math.floor(budget * pct.atk)),
    def:     Math.max(0, Math.floor(budget * pct.def)),
    agi:     Math.max(0, Math.floor(budget * pct.agi)),
    special: Math.max(0, Math.floor(budget * pct.special)),
  };
}

function applyShinyModifiers(stats) {
  return {
    hp:  Math.floor(stats.hp  * 2.5),
    atk: Math.floor(stats.atk * 2.0),
    def: Math.floor(stats.def * 1.5),
    agi: stats.agi,
  };
}

// ── HP Formula ────────────────────────────────────────────────────────────────
// VIT uses soft cap. Level provides a small growth multiplier.
function maxHP(vit, level = 1) {
  const effVIT = softCapStat(vit);
  return Math.floor(40 + effVIT * 8 * (1 + (level || 1) * 0.01));
}

// ── Weapon Damage Formula ─────────────────────────────────────────────────────
// Looks up the weapon archetype weights and applies soft-capped stats.
// Returns raw weapon damage before DEF/ARM reduction.
function calcPlayerDamage(char, gear) {
  const archetypeId = gear.weaponArchetype || 'longsword';
  const archetype   = WEAPON_ARCHETYPES[archetypeId] || WEAPON_ARCHETYPES.longsword;
  const weaponDmg   = gear.weaponDamage || 0;

  // Apply weapon archetype stat weights to soft-capped primary stats
  const effSTR = softCapStat((char.str || 0) + (gear.totalSTRBonus || 0));
  const effAGI = softCapStat((char.agi || 0) + (gear.totalAGIBonus || 0));
  const effINT = softCapStat((char.int || 0) + (gear.totalINTBonus || 0));

  const statBonus = (archetype.str * effSTR) + (archetype.agi * effAGI) + (archetype.int * effINT);

  // Level provides a flat weapon damage floor so fresh characters can deal damage
  const levelFloor = Math.floor((char.level || 1) * 1.5);

  return Math.floor(levelFloor + weaponDmg * (1 + statBonus / 100));
}

// ── DEF + ARM Resolution ──────────────────────────────────────────────────────
// DEF = integer percent reduction (1 = 1% damage reduction, stored as whole number).
// ARM = flat damage reduction (whole number).
function applyDefenses(rawDamage, defPct, armFlat) {
  const afterDEF = rawDamage * (1 - (defPct || 0) / 100);
  return Math.max(1, Math.floor(afterDEF) - Math.floor(armFlat || 0));
}

// Legacy: used for enemies that still use the simplified flat-DEF model.
function playerEffectiveDEF(stats, gear) {
  return (gear.totalDEFPct || 0);   // DEF% only — VIT no longer contributes
}

// ── Hit Resolution ────────────────────────────────────────────────────────────
// Returns hit chance [0, 1] using Accuracy and Dodge secondary stats.
function hitChance(attackerAccuracyStat, defenderDodgeStat) {
  const finalAcc  = Math.min(1.00, BASE_ACCURACY + (attackerAccuracyStat || 0) * 0.001);
  const finalDodge = BASE_DODGE + 0.48 * ((defenderDodgeStat || 0) / ((defenderDodgeStat || 0) + 200));
  return Math.max(0.05, finalAcc * (1 - finalDodge));
}

// ── Crit Chance (Pierce) ──────────────────────────────────────────────────────
function critChance(pierceStat) {
  return (pierceStat || 0) / ((pierceStat || 0) + 400);
}

// ── Crit Damage Multiplier (Impact) ──────────────────────────────────────────
function critMultiplier(impactStat) {
  return 1.5 + ((impactStat || 0) / 500);
}

// ── Damage Roll (with variance) ───────────────────────────────────────────────
// rawDamage: output of calcPlayerDamage or enemy atk
// defPct: 0.0–1.0 percentage reduction from DEF
// armFlat: flat reduction from ARM
// isCrit: boolean
// impactStat: used for crit multiplier
function calcDamage(rawDamage, defPct, armFlat, isCrit = false, impactStat = 0) {
  const variance = 1 + (Math.random() * 0.20 - 0.10);  // ±10%
  const varied   = Math.floor(rawDamage * variance);
  const reduced  = applyDefenses(varied, defPct, armFlat);
  return isCrit ? Math.floor(reduced * critMultiplier(impactStat)) : reduced;
}

// ── Luck-Based Rarity Weights ─────────────────────────────────────────────────
// Luck is now a secondary stat from gear. Higher Luck shifts rarity table upward.
function rarityWeights(zoneLevel, luck) {
  const luckMult  = 1 + (luck || 0) * 0.003;
  const zoneShift = Math.floor(zoneLevel / 10);

  let w = { common: 89.8, uncommon: 8, rare: 2, epic: 0.15, legendary: 0.05 };
  // Zone-based shift
  w.common    -= zoneShift * 1.0;
  w.rare      += zoneShift * 0.7;
  w.epic      += zoneShift * 0.04;
  w.legendary += zoneShift * 0.005;
  w.common    = Math.max(10, w.common);
  w.legendary = Math.min(2, w.legendary);
  // Luck multiplier boosts non-common tiers
  w.uncommon  *= luckMult;
  w.rare      *= luckMult;
  w.epic      *= luckMult;
  w.legendary  = Math.min(4, w.legendary * luckMult);
  return w;
}

// ── Companion Assist ──────────────────────────────────────────────────────────
// effCHA comes from gear (uses primary stat soft cap since it's gear-sourced).
function companionAssistChance(effCHA) {
  return effCHA / (effCHA + 150);
}

function companionAssistDamage(weaponDamage, effCHA) {
  return Math.floor(weaponDamage * 0.5 * (1 + effCHA / 200));
}

function goldDrop(zoneLevel, bracketMult, isShiny = false, isBoss = false) {
  const base    = Math.floor(zoneLevel * 2.5 + Math.random() * zoneLevel * 5);
  const bracket = Math.floor(base * bracketMult);
  const shiny   = isShiny ? 3 : 1;
  const boss    = isBoss  ? 10 : 1;
  return Math.max(1, bracket * shiny * boss);
}

function shinyChance(luck) {
  const base      = 1 / 512;
  const luckBonus = (luck || 0) * 0.0001;
  return Math.min(1 / 100, base + luckBonus);
}

function trapDamage(zoneLevel, armFlat) {
  const base = Math.floor(zoneLevel * 3);
  return Math.max(1, base - Math.floor(armFlat || 0));
}

function merchantBuyPrice(zoneLevel, rarity, luck = 0) {
  const base   = Math.floor(zoneLevel * (RARITY_BASE_VALUE[rarity] || 5));
  const haggle = Math.min(0.25, Math.floor((luck || 0) / 20) * 0.05);
  return Math.floor(base * (1.5 - haggle));
}

function merchantSellPrice(zoneLevel, rarity) {
  return Math.floor(zoneLevel * (RARITY_BASE_VALUE[rarity] || 5) * 0.4);
}

// Flee chance based on Speed secondary stat differential
function fleeChance(playerSpeed, enemySpeed) {
  return Math.max(0.10, Math.min(0.90, 0.50 + ((playerSpeed || 0) - (enemySpeed || 0)) * 0.02));
}

function dailyBonus(streakDays) {
  return {
    xpBonus:   0.5 + Math.min(1.5, streakDays * 0.1),
    goldBonus: 1.0 + Math.min(2.0, streakDays * 0.1),
  };
}

// ── Zone Power Score ──────────────────────────────────────────────────────────
// Used to determine reward multiplier and show Easy/Balanced/Dangerous indicators.
function calcPlayerPower(char, gear) {
  const rawDmg     = calcPlayerDamage(char, gear);
  const effVIT     = softCapStat((char.vit || 0) + (gear.totalVITBonus || 0));
  const playerHP   = maxHP((char.vit || 0), char.level || 1);
  const offScore   = rawDmg;
  const defScore   = playerHP * (1 + effVIT / 200);
  return Math.sqrt(offScore * defScore);
}

function calcZonePower(tier, zoneDifficulty = 1.0) {
  const mult = TIER_MULTIPLIERS[Math.max(0, Math.min(9, (tier || 1) - 1))];
  return mult * zoneDifficulty;
}

// ── Reward Floor + Harder-Kill Bonus ─────────────────────────────────────────
// RewardRatio < 0.5 of player power = zero rewards.
// Up to 1.5× bonus for zones above player power.
function rewardMultiplier(playerPower, zonePower) {
  if (playerPower <= 0) return 1.0;
  const ratio = zonePower / playerPower;
  if (ratio < 0.5) return 0;
  return Math.min(1.5, Math.max(0.5, ratio));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Gear Loot Generator
// ─────────────────────────────────────────────────────────────────────────────

function gearStatRange(zoneLevel, rarity) {
  const mult = RARITY_MULT[rarity] || 1.0;
  const base = zoneLevel * 0.8;
  const min  = Math.max(1, Math.floor(base * mult * 0.5));
  const max  = Math.max(min + 1, Math.floor(base * mult * 1.2));
  return { min, max };
}

// Roll a value uniformly between lo and hi (inclusive)
function _randBetween(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Pick stats from a pool weighted by bias, without replacement.
// Returns array of stat keys.
function _pickBiasedStats(pool, biasMap, count) {
  if (!pool || pool.length === 0) return [];
  const available = [...pool];
  const picked    = [];
  const n         = Math.min(count, available.length);

  for (let i = 0; i < n; i++) {
    const weights = available.map(s => biasMap[s] || 1.0);
    const total   = weights.reduce((a, b) => a + b, 0);
    let   roll    = Math.random() * total;
    let   chosen  = available[available.length - 1];
    for (let j = 0; j < available.length; j++) {
      roll -= weights[j];
      if (roll <= 0) { chosen = available[j]; break; }
    }
    picked.push(chosen);
    available.splice(available.indexOf(chosen), 1);
  }
  return picked;
}

// Distribute a budget across picked stats, applying bias weight to share size.
function _distributeByBias(pickedStats, biasMap, budget) {
  const stats  = {};
  const weights = pickedStats.map(s => biasMap[s] || 1.0);
  const total   = weights.reduce((a, b) => a + b, 0);
  let   remaining = budget;

  for (let i = 0; i < pickedStats.length; i++) {
    const share = (i < pickedStats.length - 1)
      ? Math.floor(budget * weights[i] / total)
      : remaining;
    stats[pickedStats[i]] = Math.max(1, share);
    remaining -= share;
  }
  return stats;
}

function pickRarity(zoneLevel, lck) {
  const w     = rarityWeights(zoneLevel, lck);
  const total = w.common + w.uncommon + w.rare + w.epic + w.legendary;
  let   roll  = Math.random() * total;
  if ((roll -= w.common)    <= 0) return 'common';
  if ((roll -= w.uncommon)  <= 0) return 'uncommon';
  if ((roll -= w.rare)      <= 0) return 'rare';
  if ((roll -= w.epic)      <= 0) return 'epic';
  return 'legendary';
}

function isSetPiece(charLevel, setLevelRange, itemRarity, setRarity) {
  if (itemRarity !== setRarity) return false;
  const [min, max] = setLevelRange;
  if (charLevel < min - 20 || charLevel > max + 20) return false;
  return Math.random() < (1 / 8);
}

function _pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a procedural item name from the name banks. */
function generateItemName(rarity, slot) {
  const prefixPool = _buildPrefixPool(rarity);
  const suffixPool = _buildSuffixPool(rarity);
  const typePool   = NAME_BANKS.itemTypes[slot] || ['Item'];
  const itemType   = _pickFrom(typePool);

  // Suffix entries in the pool include their own "of " prefix — strip it since
  // the template adds "of" itself, preventing "Sword of of the Wolf" doubling.
  const suffix = _pickFrom(suffixPool).replace(/^of\s+/i, '');

  const roll = Math.random();
  if (roll < 0.60) {
    // Full: [Prefix] [Type] of [Suffix]
    return `${_pickFrom(prefixPool)} ${itemType} of ${suffix}`;
  } else if (roll < 0.85) {
    // Prefix only
    return `${_pickFrom(prefixPool)} ${itemType}`;
  } else {
    // Suffix only
    return `${itemType} of ${suffix}`;
  }
}

function _buildPrefixPool(rarity) {
  const b = NAME_BANKS.prefixes;
  switch (rarity) {
    case 'common':    return b.common;
    case 'uncommon':  return [...b.common, ...b.uncommon, ...b.uncommon, ...b.uncommon]; // 70% uncommon
    case 'rare':      return [...b.uncommon, ...b.rare, ...b.rare, ...b.rare];           // 75% rare
    case 'epic':      return [...b.rare, ...b.epic, ...b.epic, ...b.epic, ...b.epic];    // 80% epic
    case 'legendary': return b.epic; // epic prefixes (legendaries have fixed names in practice)
    default:          return b.common;
  }
}

function _buildSuffixPool(rarity) {
  const b = NAME_BANKS.suffixes;
  switch (rarity) {
    case 'common':    return b.common;
    case 'uncommon':  return [...b.common, ...b.uncommon, ...b.uncommon, ...b.uncommon];
    case 'rare':      return [...b.uncommon, ...b.rare, ...b.rare, ...b.rare];
    case 'epic':      return [...b.rare, ...b.epic, ...b.epic, ...b.epic, ...b.epic];
    case 'legendary': return b.epic;
    default:          return b.common;
  }
}

/**
 * Generate a full gear item object using the new slot identity system.
 * @param {number} zoneLevel
 * @param {string} rarity   — 'common'|'uncommon'|'rare'|'epic'|'legendary'
 * @param {string} slot     — gear slot string
 * @param {number} tier     — zone tier (1–10) for budget scaling
 * @returns {object} item ready for rpg-db addItem()
 */
function generateGearItem(zoneLevel, rarity, slot, tier = 1) {
  const name = generateItemName(rarity, slot);

  const slotPool     = SLOT_STAT_POOLS[slot]       || { primary: null, secondary: null };
  const slotBias     = SLOT_BIAS_WEIGHTS[slot]      || {};
  const slotMod      = SLOT_BUDGET_MODIFIERS[slot]  || 1.0;
  const rarityMult   = RARITY_MULT[rarity]          || 1.0;
  const statCounts   = RARITY_STAT_COUNT[rarity]    || { min: 1, max: 2 };
  const tierMult     = TIER_MULTIPLIERS[Math.max(0, Math.min(9, tier - 1))];

  // Base budget: scales with tier and slot
  const BASE_BUDGET      = 10;
  const primaryBudget    = Math.floor(BASE_BUDGET * tierMult * slotMod * rarityMult);
  const rawSecondaryBudg = Math.floor(primaryBudget * (0.50 + Math.random() * 0.17));

  // ── Sacrifice Variant (common armor only, 15% chance) ──
  let isSacrifice        = false;
  let sacrificeRatio     = 0;
  let effectivePrimBudg  = primaryBudget;
  let effectiveSecBudg   = rawSecondaryBudg;

  if (rarity === 'common' && ARMOR_SLOTS.includes(slot) && Math.random() < 0.15) {
    isSacrifice    = true;
    sacrificeRatio = 0.20 + Math.random() * 0.20;   // 20–40%
    effectivePrimBudg = Math.floor(primaryBudget    * (1 - sacrificeRatio));
    effectiveSecBudg  = Math.floor(rawSecondaryBudg * (1 - sacrificeRatio));
  }

  const stats = {};

  // ── Weapon Core ────────────────────────────────────────
  if (slot === 'weapon') {
    // Pick weapon archetype
    const archetypeKeys  = Object.keys(WEAPON_ARCHETYPES);
    const archetype      = _pickFrom(archetypeKeys);
    stats.weapon_damage    = Math.max(1, effectivePrimBudg);
    stats.weapon_archetype = archetype;
  }

  // ── Primary Stats (STR/AGI/INT/VIT) ────────────────────
  if (slotPool.primary && slotPool.primary.length > 0 && slot !== 'weapon') {
    const count      = _randBetween(statCounts.min, statCounts.max);
    const pickedPrim = _pickBiasedStats(slotPool.primary, {}, count);
    // Distribute primary budget equally (primary has no bias on distribution)
    const perStat    = Math.max(1, Math.floor(effectivePrimBudg / pickedPrim.length));
    for (const s of pickedPrim) stats[s] = perStat;
  }

  // ── Trinket: one random boost from primary or secondary ─
  if (slot === 'trinket') {
    const allPossible = [...(slotPool.primary || []), ...(slotPool.secondary || [])];
    const chosen      = _pickFrom(allPossible);
    stats[chosen]     = Math.max(1, Math.floor(effectivePrimBudg * 0.6));
  }

  // ── Secondary Stats ─────────────────────────────────────
  if (slotPool.secondary && slotPool.secondary.length > 0 && slot !== 'trinket') {
    const secCount   = _randBetween(1, Math.min(3, slotPool.secondary.length));
    const pickedSec  = _pickBiasedStats(slotPool.secondary, slotBias, secCount);
    const secStats   = _distributeByBias(pickedSec, slotBias, effectiveSecBudg);
    for (const [k, v] of Object.entries(secStats)) stats[k] = Math.max(1, v);
  }

  // ── Tertiary: Defense% + Armor (armor slots, always present) ──
  // def_pct stored as whole integer percent (1 = 1% damage reduction).
  // e.g. Tier 1 = ~1%, Tier 5 = ~8%, Tier 10 = ~64% per piece
  if (ARMOR_SLOTS.includes(slot)) {
    const baseDEF = Math.max(1, Math.round(tierMult * 0.8));
    const baseARM = Math.floor(tierMult * 2.5);

    if (isSacrifice) {
      const mult      = 1.15 + Math.random() * 0.25;
      stats.def_pct   = Math.max(1, Math.round(baseDEF * mult));
      stats.arm_flat  = Math.floor(baseARM * mult);
    } else {
      const mult      = 0.80 + Math.random() * 0.20;
      stats.def_pct   = Math.max(1, Math.round(baseDEF * mult));
      stats.arm_flat  = Math.floor(baseARM * mult);
    }
  }

  return {
    item_id:      `gen_${slot}_${rarity}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    name,
    slot,
    rarity,
    zone_level:   zoneLevel,
    is_sacrifice: isSacrifice,
    stats:        JSON.stringify(stats),
    passives:     JSON.stringify([]),
    set_id:       null,
    legendary_id: null,
  };
}

/**
 * Roll a loot drop event.
 * Returns { type: 'item', item } | { type: 'gold', amount } | { type: 'none' }
 * @param {number} luck  — total Luck secondary stat from gear (not LCK primary)
 * @param {number} tier  — zone tier for gear budget scaling
 */
function rollLootDrop(zoneLevel, luck, bracketId, charLevel, isBoss = false, isShiny = false, tier = 1) {
  const bracket = BRACKETS[bracketId] || BRACKETS.minion;

  // Drop chance: bosses always drop, shiny guaranteed Rare+, normal has ~85% chance
  const dropChance = isBoss ? 1.0 : isShiny ? 1.0 : 0.85;
  if (Math.random() > dropChance) return { type: 'none' };

  // Determine if this is an item or gold drop (~75% item, 25% gold for normal)
  const itemChance = isBoss ? 1.0 : 0.75;
  if (Math.random() > itemChance) {
    const amount = goldDrop(zoneLevel, bracket.goldMult, isShiny, isBoss);
    return { type: 'gold', amount };
  }

  // Roll rarity — shiny is at least Rare
  let rarity = pickRarity(zoneLevel, luck);
  if (isShiny && ['common', 'uncommon'].includes(rarity)) rarity = 'rare';

  // Pick random slot from full 10-slot list (now includes legs)
  const slots = ['weapon', 'head', 'chest', 'legs', 'hands', 'feet', 'belt', 'ring', 'amulet', 'trinket'];
  const slot  = _pickFrom(slots);

  const item = generateGearItem(zoneLevel, rarity, slot, tier);
  return { type: 'item', item, rarity };
}

/** Sum all stat bonuses from equipped item rows (from rpg-db getEquipped). */
function computeGearTotals(equippedRows) {
  const totals = {
    // Primary stats from gear
    totalSTRBonus: 0, totalAGIBonus: 0, totalINTBonus: 0, totalVITBonus: 0,
    // Companion stat
    totalCHABonus: 0,
    // Secondary stats (all gear-derived)
    totalPierce: 0, totalImpact: 0, totalDodge: 0,
    totalAccuracy: 0, totalSpeed: 0, totalLuck: 0,
    // Tertiary stats (armor pieces only)
    totalDEFPct: 0,    // 0.0–1.0 percentage damage reduction
    totalARMFlat: 0,   // flat damage reduction
    // Weapon core
    weaponDamage: 0,
    weaponArchetype: 'longsword',  // default if no weapon equipped
    // Passives
    passives: [],
  };

  for (const row of equippedRows) {
    if (!row || !row.stats) continue;

    try {
      const s = typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats;
      // Primary
      totals.totalSTRBonus += s.str || 0;
      totals.totalAGIBonus += s.agi || 0;
      totals.totalINTBonus += s.int || 0;
      totals.totalVITBonus += s.vit || 0;
      totals.totalCHABonus += s.cha || 0;
      // Secondary
      totals.totalPierce   += s.pierce   || 0;
      totals.totalImpact   += s.impact   || 0;
      totals.totalDodge    += s.dodge    || 0;
      totals.totalAccuracy += s.accuracy || 0;
      totals.totalSpeed    += s.speed    || 0;
      totals.totalLuck     += s.luck     || 0;
      // Tertiary — def_pct stored as integer % (new) or legacy fraction (<1)
      const rawDef = s.def_pct || 0;
      totals.totalDEFPct  += rawDef < 1 ? Math.max(1, Math.round(rawDef * 100)) : rawDef;
      totals.totalARMFlat += s.arm_flat || 0;
      // Weapon
      if (row.slot === 'weapon') {
        totals.weaponDamage    = s.weapon_damage || 0;
        totals.weaponArchetype = s.weapon_archetype || 'longsword';
      }
      // Legacy ATK field (old items still in DB)
      if (s.atk && row.slot === 'weapon') totals.weaponDamage += s.atk;
    } catch {}

    if (row.passives) {
      try {
        const p = typeof row.passives === 'string' ? JSON.parse(row.passives) : row.passives;
        if (Array.isArray(p)) totals.passives.push(...p);
      } catch {}
    }
  }

  // Cap DEF% at 85 (integer %) to prevent effective immunity
  totals.totalDEFPct = Math.min(85, totals.totalDEFPct);
  return totals;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Entity Generation (Enemy + Boss)
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a runtime enemy name for zone-themed encounters. */
function _generateEnemyName(zone, archetype) {
  const tier     = zone.tier || 1;
  const prefixes = ENEMY_NAME_DATA.tierPrefixes[tier] || ENEMY_NAME_DATA.tierPrefixes[1];
  const words    = ENEMY_NAME_DATA.archetypeWords;
  const prefix   = _pickFrom(prefixes);
  const word     = _pickFrom(words);
  // ~30% chance of suffix
  if (Math.random() < 0.30) {
    return `${prefix} ${word}, ${_pickFrom(ENEMY_NAME_DATA.suffixes)}`;
  }
  return `${prefix} ${word}`;
}

/** Pick a bracket ID appropriate for this zone's tier. */
function _bracketForTier(tier, isMini = false) {
  const tierBracketMap = {
    1:  'minion',
    2:  'scout',
    3:  'soldier',
    4:  'elite',
    5:  isMini ? 'champion' : 'elite',
    6:  'champion',
    7:  'legend',
    8:  'legend',
    9:  'apex',
    10: 'god_tier',
  };
  return tierBracketMap[tier] || 'minion';
}

/**
 * Generate a standard or mini-boss enemy for a zone.
 * @param {object} zone         - Zone data object
 * @param {number} zoneLevel    - Specific zone level for this run
 * @param {string} [bracketId]  - Override bracket (optional)
 * @param {boolean} isShiny     - Whether this is a shiny variant
 * @param {boolean} isMini      - Mini-boss (uses 2× budget of next bracket up)
 * @returns {object} Enemy state object
 */
function generateEnemy(zone, zoneLevel, bracketId, isShiny = false, isMini = false) {
  const tier    = zone.tier || 1;
  const bId     = bracketId || _bracketForTier(tier, isMini);
  const bracket = BRACKETS[bId] || BRACKETS.minion;

  const budget  = isMini
    ? enemyStatBudget(zoneLevel, bracket.baseBudget) * 2
    : enemyStatBudget(zoneLevel, bracket.baseBudget);

  // Pick archetype: random, but weighted toward zone theme if possible
  const archetypes = Object.keys(ARCHETYPE_DISTRIBUTIONS);
  const archetype  = _pickFrom(archetypes);
  const baseStats  = allocateStats(budget, archetype);

  const stats = isShiny ? applyShinyModifiers(baseStats) : baseStats;

  // Number of special ability slots based on special% budget
  const specialSlots = baseStats.special < budget * 0.08 ? 0 :
                       baseStats.special < budget * 0.18 ? 1 : 2;

  const name = isShiny ? `✦ ${_generateEnemyName(zone, archetype)}` : _generateEnemyName(zone, archetype);

  // Derive secondary combat stats from agi budget.
  // accuracy → enemy hit rate (0.001 per point above 70% base), dodge → evasion, speed → turn order.
  const eAgi      = stats.agi || 0;
  const eAccuracy = eAgi;
  const eDodge    = Math.floor(eAgi * 0.50);
  const eSpeed    = Math.floor(eAgi * 0.50);

  return {
    id:          `${zone.id}_${bId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name,
    archetype,
    bracketId:   bId,
    isShiny,
    isBoss:      false,
    isMini,
    hp:          stats.hp,
    maxHp:       stats.hp,
    atk:         stats.atk,
    def:         stats.def,
    agi:         eAgi,
    accuracy:    eAccuracy,
    dodge:       eDodge,
    speed:       eSpeed,
    xpMult:      bracket.xpMult * (isShiny ? 5 : 1),
    goldMult:    bracket.goldMult * (isShiny ? 3 : 1),
    specialSlots,
    abilities:   [],
    statusEffects: [],
    abilityState: {
      usedAbilities:   {},
      cooldowns:       {},
      activeAbilities: [],
      bloodRageATKBonus: 0,
      consecHitsSameType: 0,
      lastHitType: null,
      overloadWindingUp: false,
    },
  };
}

/**
 * Generate a boss for the zone's final floor.
 * @param {object} zone
 * @param {number} zoneLevel
 * @param {number} bossCount   - Total bosses killed this run (every 3rd = random generated)
 */
function generateBoss(zone, zoneLevel, bossCount = 0) {
  const tier    = zone.tier || 1;
  // Boss uses the same bracket as regular enemies in this zone, scaled by bossBudget (3×)
  const bId     = _bracketForTier(tier);
  const bracket = BRACKETS[bId] || BRACKETS.minion;

  const budget    = bossBudget(zoneLevel, bracket.baseBudget);
  const archetype = _pickFrom(Object.keys(ARCHETYPE_DISTRIBUTIONS));
  const stats     = allocateStats(budget, archetype);

  // Pick 1–2 boss abilities
  const shuffledAbilities = [...BOSS_ABILITIES].sort(() => Math.random() - 0.5);
  const abilityCount      = 1 + Math.floor(Math.random() * 2); // 1 or 2
  const abilities         = shuffledAbilities.slice(0, abilityCount);

  // Every 3rd boss gets a randomly generated name
  const isRandomBoss = bossCount > 0 && bossCount % 3 === 0;
  let name;
  if (isRandomBoss) {
    const hon   = _pickFrom(BOSS_NAME_PARTS.honorifics);
    const bname = _pickFrom(BOSS_NAME_PARTS.names);
    const title = _pickFrom(BOSS_NAME_PARTS.titles);
    name = `${hon} ${bname}, ${title}`;
  } else {
    // Named zone boss: [Zone Name] Boss
    const word = _pickFrom(ENEMY_NAME_DATA.archetypeWords);
    const pfx  = _pickFrom(ENEMY_NAME_DATA.tierPrefixes[Math.min(10, tier)] || ['Ancient']);
    name = `${pfx} ${word}`;
  }

  // Derive secondary combat stats from agi budget (same model as regular enemies).
  const bAgi      = stats.agi || 0;
  const bAccuracy = bAgi;
  const bDodge    = Math.floor(bAgi * 0.50);
  const bSpeed    = Math.floor(bAgi * 0.50);

  return {
    id:           `boss_${zone.id}_${Date.now()}`,
    name,
    archetype,
    bracketId:    bId,
    isShiny:      false,
    isBoss:       true,
    isMini:       false,
    hp:           stats.hp,
    maxHp:        stats.hp,
    atk:          stats.atk,
    def:          stats.def,
    agi:          bAgi,
    accuracy:     bAccuracy,
    dodge:        bDodge,
    speed:        bSpeed,
    xpMult:       bracket.xpMult * 10,
    goldMult:     bracket.goldMult * 10,
    abilities,
    statusEffects: [],
    abilityState: {
      usedAbilities:          {},
      cooldowns:              {},
      activeAbilities:        [],
      bloodRageATKBonus:      0,
      enrageTriggered:        false,
      shieldOfAgesTriggered:  false,
      finalTransformTriggered: false,
      regenPerTurn:           Math.floor(stats.hp * 0.05),
      consecHitsOnPlayer:     0,
      overloadWindingUp:      false,
      divineSmiteTimer:       0,
      petrifyTracker:         { count: 0, active: false, turnsLeft: 0 },
      ancientWardTimer:       0,
      lifeStealPercent:       0.10,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Run Management + Room Resolution
// ─────────────────────────────────────────────────────────────────────────────

function _rollRoomType() {
  const w     = ROOM_WEIGHTS;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let   roll  = Math.random() * total;
  for (const [type, weight] of Object.entries(w)) {
    if ((roll -= weight) <= 0) return type;
  }
  return 'monster';
}

/**
 * Initialize a new run.
 * @param {object} char         — Character row from DB
 * @param {object} zone         — Zone data object
 * @param {object} equippedRows — Equipped items from DB
 * @param {object|null} bonusData — { xpBonus, goldBonus } or null
 */
function startRun(char, zone, equippedRows, bonusData = null) {
  const gearTotals  = computeGearTotals(equippedRows);
  const playerMaxHp = maxHP(char.vit, char.level || 1);
  const startingHp  = Math.min(char.hp_current || playerMaxHp, playerMaxHp);

  // Pick a zone level within the zone's range
  const zoneLevel = zone.zoneLevelMin + Math.floor(
    Math.random() * (zone.zoneLevelMax - zone.zoneLevelMin + 1)
  );

  // Generate floors (5–15 floors, last is always boss)
  const floorCount = 5 + Math.floor(Math.random() * 11);
  const floors     = [];

  for (let i = 0; i < floorCount - 1; i++) {
    floors.push({
      floorNum:   i + 1,
      roomType:   _rollRoomType(),
      isBossFloor: false,
      enemy:      null,
      loot:       null,
      merchant:   null,
      trap:       null,
      rest:       null,
      completed:  false,
    });
  }
  floors.push({
    floorNum:    floorCount,
    roomType:    'boss',
    isBossFloor: true,
    enemy:       null,
    loot:        null,
    merchant:    null,
    trap:        null,
    rest:        null,
    completed:   false,
  });

  // Resolve the first floor immediately
  const runState = {
    zoneId:       zone.id,
    zone,
    zoneLevel,
    charSnapshot: {
      level: char.level, xp: char.xp, str: char.str, int: char.int,
      agi: char.agi, vit: char.vit, lck: char.lck, cha: char.cha,
      gold: char.gold, prestige_count: char.prestige_count, kills: char.total_kills || 0,
    },
    gearTotals,
    playerHp:     startingHp,
    playerMaxHp,
    playerStatusEffects: [],
    ironWillUsed:  false,
    combatTurn:    0,
    consecutiveKillsNoDamage: 0,
    tookDamageThisFloor:      false,
    isFirstFight:  true,
    floors,
    currentFloorIdx: 0,
    phase:        'floor_start',
    lootBag:      [],
    goldBag:      0,
    xpBag:        0,
    kills:        0,
    bossKillCount: 0,
    result:       null,
    startedAt:    Date.now(),
    dailyBonus:   bonusData,
  };

  const { events } = resolveFloorRoom(runState);
  return { runState, events };
}

/**
 * Resolve the current floor's room — auto-handles non-combat rooms.
 * Sets runState.phase appropriately.
 * Returns { events } array describing what happened.
 */
function resolveFloorRoom(runState) {
  const floor   = runState.floors[runState.currentFloorIdx];
  const events  = [];
  const char    = runState.charSnapshot;
  const gear    = runState.gearTotals;
  const effDEF  = playerEffectiveDEF(char, gear);

  switch (floor.roomType) {
    case 'monster':
    case 'mini_boss': {
      const isMini  = floor.roomType === 'mini_boss';
      const isShiny = Math.random() < shinyChance(gear.totalLuck || 0);
      floor.enemy   = generateEnemy(runState.zone, runState.zoneLevel, null, isShiny, isMini);
      runState.combatTurn = 0;
      runState.tookDamageThisFloor = false;
      runState.phase = 'combat';

      const scenario = `battle_start_${isMini ? 'elite' : _bracketScenario(floor.enemy.bracketId)}`;
      events.push({ type: 'room_entered', roomType: floor.roomType, enemy: floor.enemy, scenario });
      if (isShiny) events.push({ type: 'shiny_appeared', enemy: floor.enemy, scenario: 'shiny_enemy_appear' });
      if (runState.isFirstFight) events.push({ type: 'first_hit_of_run', scenario: 'battle_first_hit_of_run' });
      break;
    }

    case 'boss': {
      const isShiny = false; // bosses are never shiny
      floor.enemy   = generateBoss(runState.zone, runState.zoneLevel, runState.bossKillCount);
      runState.combatTurn = 0;
      runState.tookDamageThisFloor = false;
      runState.phase = 'combat';
      events.push({ type: 'room_entered', roomType: 'boss', enemy: floor.enemy, scenario: 'battle_start_boss' });
      break;
    }

    case 'rest': {
      const healAmt = Math.floor(runState.playerMaxHp * 0.25);
      runState.playerHp = Math.min(runState.playerMaxHp, runState.playerHp + healAmt);
      floor.rest = { healAmount: healAmt };
      floor.completed = true;
      runState.phase = 'floor_complete';
      events.push({ type: 'room_entered', roomType: 'rest', healAmount: healAmt, scenario: 'room_rest' });
      break;
    }

    case 'treasure': {
      const loot = rollLootDrop(runState.zoneLevel, gear.totalLuck || 0,
                                _bracketForTier(runState.zone.tier), char.level, false, false, runState.zone.tier);
      floor.loot = { drops: [loot] };
      _applyLoot(runState, [loot], events);
      floor.completed = true;
      runState.phase = 'floor_complete';
      events.push({ type: 'room_entered', roomType: 'treasure', loot, scenario: _chestScenario(loot) });
      break;
    }

    case 'secret': {
      // 2–4 items, one rarity above zone average
      const drops = [];
      const count      = 2 + Math.floor(Math.random() * 3);
      const boostedLuck = (gear.totalLuck || 0) + 100; // shift rarity up in secret rooms
      for (let i = 0; i < count; i++) {
        drops.push(rollLootDrop(runState.zoneLevel, boostedLuck,
                                _bracketForTier(runState.zone.tier), char.level, false, false, runState.zone.tier));
      }
      floor.loot = { drops };
      _applyLoot(runState, drops, events);
      floor.completed = true;
      runState.phase = 'floor_complete';
      events.push({ type: 'room_entered', roomType: 'secret', drops, scenario: 'room_secret_found' });
      break;
    }

    case 'trap': {
      // Trap dodge uses the player's Dodge secondary stat
      const finalDodge = BASE_DODGE + 0.48 * ((gear.totalDodge || 0) / ((gear.totalDodge || 0) + 200));
      const dodged     = Math.random() < finalDodge;
      let   dmg        = 0;
      if (!dodged) {
        dmg = trapDamage(runState.zoneLevel, gear.totalARMFlat || 0);
        runState.playerHp = Math.max(1, runState.playerHp - dmg);
      }
      floor.trap = { damage: dmg, dodged };
      floor.completed = true;
      runState.phase = 'floor_complete';
      const scenario = dodged ? 'room_trap_dodged' : 'room_trap_triggered';
      events.push({ type: 'room_entered', roomType: 'trap', dodged, damage: dmg, scenario });
      break;
    }

    case 'merchant': {
      // Generate 3 items for sale
      const items = [];
      for (let i = 0; i < 3; i++) {
        const rarity = pickRarity(runState.zoneLevel, gear.totalLuck || 0);
        const slots  = ['weapon', 'head', 'chest', 'legs', 'hands', 'feet', 'belt', 'ring', 'amulet', 'trinket'];
        const slot   = _pickFrom(slots);
        const item   = generateGearItem(runState.zoneLevel, rarity, slot, runState.zone.tier);
        item.buyPrice = merchantBuyPrice(runState.zoneLevel, rarity, gear.totalLuck || 0);
        items.push(item);
      }
      floor.merchant = { items };
      runState.phase = 'merchant';
      events.push({ type: 'room_entered', roomType: 'merchant', items, scenario: 'room_merchant' });
      break;
    }

    default: { // 'empty' — replaced with random mini-events
      _resolveEmptyFloor(runState, floor, char, gear, events);
      break;
    }
  }

  return { events };
}

// ── Empty-floor random mini-events ───────────────────────────────────────────
const EMPTY_EVENTS = [
  'gold_find', 'dying_enemy', 'healing_spring',
  'scavenge',  'inscription', 'abandoned_cache',
];

function _resolveEmptyFloor(runState, floor, char, gear, events) {
  const zl     = runState.zoneLevel;
  const effLCK = char.lck + (gear.totalLCKBonus || 0);
  const pick   = EMPTY_EVENTS[Math.floor(Math.random() * EMPTY_EVENTS.length)];

  switch (pick) {
    case 'gold_find': {
      const gold = Math.floor(zl * 3 + Math.random() * zl * 4);
      runState.goldBag += gold;
      events.push({ type: 'empty_gold_find', gold });
      break;
    }
    case 'dying_enemy': {
      const xp   = Math.floor(zl * 6 + Math.random() * zl * 8);
      const gold = Math.floor(zl + Math.random() * zl * 2);
      runState.xpBag   += xp;
      runState.goldBag += gold;
      runState.kills++;
      events.push({ type: 'empty_dying_enemy', xp, gold });
      break;
    }
    case 'healing_spring': {
      const heal = Math.floor(runState.playerMaxHp * (0.08 + Math.random() * 0.07));
      runState.playerHp = Math.min(runState.playerMaxHp, runState.playerHp + heal);
      events.push({ type: 'empty_healing_spring', healAmount: heal });
      break;
    }
    case 'scavenge': {
      const loot = rollLootDrop(Math.max(1, zl - 2), gear.totalLuck || 0,
                                _bracketForTier(runState.zone.tier), char.level, false, false, runState.zone.tier);
      _applyLoot(runState, [loot], events);
      events.push({ type: 'empty_scavenge', loot });
      break;
    }
    case 'inscription': {
      const xp = Math.floor(zl * 4 + Math.random() * zl * 5);
      runState.xpBag += xp;
      events.push({ type: 'empty_inscription', xp });
      break;
    }
    case 'abandoned_cache': {
      const gold = Math.floor(zl * 5 + Math.random() * zl * 8);
      const xp   = Math.floor(zl * 3 + Math.random() * zl * 3);
      runState.goldBag += gold;
      runState.xpBag   += xp;
      events.push({ type: 'empty_abandoned_cache', gold, xp });
      break;
    }
  }

  floor.completed  = true;
  runState.phase   = 'floor_complete';
}

function _chestScenario(loot) {
  if (!loot || loot.type !== 'item') return 'chest_found_common';
  return `chest_found_${loot.rarity || 'common'}`;
}

function _bracketScenario(bracketId) {
  const map = {
    minion: 'minion', scout: 'minion', soldier: 'soldier',
    elite: 'elite', champion: 'champion', legend: 'champion',
    apex: 'champion', god_tier: 'champion',
  };
  return map[bracketId] || 'minion';
}

function _applyLoot(runState, drops, events) {
  for (const drop of drops) {
    if (drop.type === 'item') {
      runState.lootBag.push(drop.item);
      events.push({ type: 'loot_drop', loot: drop, rarity: drop.rarity,
                    scenario: `loot_${drop.rarity}` });
    } else if (drop.type === 'gold') {
      runState.goldBag += drop.amount;
      const scenario = drop.amount < 100 ? 'gold_found_small' :
                       drop.amount < 500 ? 'gold_found_medium' : 'gold_found_large';
      events.push({ type: 'gold_drop', amount: drop.amount, scenario });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Combat System
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process one combat turn.
 * @param {object} runState
 * @param {'fight'|'flee'} action
 * @returns {{ runState, events, levelUps }}
 *   levelUps = array of { newLevel, statPointsGained } for the IPC layer to commit
 */
function runCombatTurn(runState, action) {
  const events   = [];
  const levelUps = [];
  const floor    = runState.floors[runState.currentFloorIdx];
  const enemy    = floor.enemy;
  const char     = runState.charSnapshot;
  const gear     = runState.gearTotals;

  const effCHA      = softCapStat(gear.totalCHABonus || 0);
  const weaponDmg   = calcPlayerDamage(char, gear);
  const defPct      = gear.totalDEFPct  || 0;
  const armFlat     = gear.totalARMFlat || 0;
  const pierceStat  = gear.totalPierce  || 0;
  const impactStat  = gear.totalImpact  || 0;
  const dodgeStat   = gear.totalDodge   || 0;
  const accStat     = gear.totalAccuracy || 0;
  const speedStat   = gear.totalSpeed   || 0;

  // ── Flee ──────────────────────────────────────────────────────────────────
  if (action === 'flee') {
    const chance = fleeChance(speedStat, enemy.speed || 0);
    if (Math.random() < chance) {
      floor.completed = true;
      runState.phase = 'floor_complete';
      runState.consecutiveKillsNoDamage = 0;
      events.push({ type: 'fled_success', scenario: 'battle_flee_success' });
    } else {
      // Enemy gets a free attack on failed flee
      const freeAtk = _resolveEnemyAttack(runState, enemy, char, defPct, armFlat, dodgeStat, events, true);
      if (runState.playerHp <= 0) {
        _handlePlayerDeath(runState, floor, enemy, events, levelUps);
      } else {
        events.push({ type: 'fled_failed', enemyDamage: freeAtk, scenario: 'battle_flee_fail' });
      }
    }
    return { runState, events, levelUps };
  }

  // ── Fight ─────────────────────────────────────────────────────────────────
  runState.combatTurn++;

  // 1. Status effect ticks (both sides)
  _processStatusTicks(runState, enemy, events);
  if (enemy.hp <= 0) {
    _handleEnemyDeath(runState, floor, enemy, char, gear, events, levelUps);
    return { runState, events, levelUps };
  }
  if (runState.playerHp <= 0) {
    _handlePlayerDeath(runState, floor, enemy, events, levelUps);
    return { runState, events, levelUps };
  }

  // 2. Blood Rage tick (boss)
  if (enemy.isBoss && enemy.abilityState.bloodRageATKBonus > 0) {
    // Applied passively each turn the boss survives
    enemy.atk = (enemy.atk || 0) + (runState.combatTurn > 1 ? 5 : 0);
  }

  // 3. Determine turn order via Speed + randomness
  const playerTurnScore = speedStat + Math.floor(Math.random() * 21);
  const enemyTurnScore  = (enemy.speed || 0) + Math.floor(Math.random() * 21);
  const playerFirst     = playerTurnScore >= enemyTurnScore;

  // Check Ancient Ward (player can only act every other turn) — boss-only
  const ancientWardActive = enemy.isBoss && enemy.abilityState.ancientWardTimer > 0 &&
                            runState.combatTurn % 2 === 0;
  if (enemy.isBoss && enemy.abilityState.ancientWardTimer > 0) {
    enemy.abilityState.ancientWardTimer--;
  }

  // Check Petrify stun on player — boss-only
  const playerStunned = enemy.isBoss &&
                        enemy.abilityState.petrifyTracker.active &&
                        enemy.abilityState.petrifyTracker.turnsLeft > 0;
  if (playerStunned) enemy.abilityState.petrifyTracker.turnsLeft--;
  if (enemy.isBoss && enemy.abilityState.petrifyTracker.turnsLeft === 0) {
    enemy.abilityState.petrifyTracker.active = false;
  }

  const playerCanAct = !ancientWardActive && !playerStunned;

  if (playerFirst) {
    if (playerCanAct) {
      _resolvePlayerAttack(runState, enemy, char, gear, weaponDmg, defPct, armFlat, accStat, pierceStat, impactStat, events);
      if (enemy.hp <= 0) {
        _handleEnemyDeath(runState, floor, enemy, char, gear, events, levelUps);
        return { runState, events, levelUps };
      }
      _checkCHAAssist(runState, enemy, weaponDmg, effCHA, events, levelUps, char, gear, floor);
      if (enemy.hp <= 0) {
        _handleEnemyDeath(runState, floor, enemy, char, gear, events, levelUps);
        return { runState, events, levelUps };
      }
    }
    _resolveEnemyAttack(runState, enemy, char, defPct, armFlat, dodgeStat, events, false);
    if (runState.playerHp <= 0) {
      _handlePlayerDeath(runState, floor, enemy, events, levelUps);
      return { runState, events, levelUps };
    }
  } else {
    _resolveEnemyAttack(runState, enemy, char, defPct, armFlat, dodgeStat, events, false);
    if (runState.playerHp <= 0) {
      _handlePlayerDeath(runState, floor, enemy, events, levelUps);
      return { runState, events, levelUps };
    }
    if (playerCanAct) {
      _resolvePlayerAttack(runState, enemy, char, gear, weaponDmg, defPct, armFlat, accStat, pierceStat, impactStat, events);
      if (enemy.hp <= 0) {
        _handleEnemyDeath(runState, floor, enemy, char, gear, events, levelUps);
        return { runState, events, levelUps };
      }
      _checkCHAAssist(runState, enemy, weaponDmg, effCHA, events, levelUps, char, gear, floor);
      if (enemy.hp <= 0) {
        _handleEnemyDeath(runState, floor, enemy, char, gear, events, levelUps);
        return { runState, events, levelUps };
      }
    }
  }

  // 4. Boss abilities (after all attacks)
  if (enemy.isBoss) {
    _checkBossAbilities(runState, enemy, char, events);
    if (runState.playerHp <= 0) {
      _handlePlayerDeath(runState, floor, enemy, events, levelUps);
      return { runState, events, levelUps };
    }
  }

  // 5. Near-death check
  const hpPercent = runState.playerHp / runState.playerMaxHp;
  if (hpPercent < 0.20 && hpPercent > 0) {
    events.push({ type: 'near_death', hpPercent, scenario: 'battle_near_death' });
  }

  return { runState, events, levelUps };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _resolvePlayerAttack(runState, enemy, char, gear, weaponDmg, defPct, armFlat, accStat, pierceStat, impactStat, events) {
  // Apply weaken status if any
  const weakenFactor = _getStatusFactor(runState.playerStatusEffects, 'weaken', 'atkReduction');
  const finalDmg     = Math.floor(weaponDmg * (1 - weakenFactor));

  // Hit check: player accuracy vs enemy dodge
  const hit = Math.random() < hitChance(accStat, enemy.dodge || 0);
  if (!hit) {
    events.push({ type: 'player_attack', hit: false });
    return;
  }

  // Crit check uses Pierce stat
  const isCrit = Math.random() < critChance(pierceStat);

  // Damage: apply enemy's flat DEF (enemies keep simplified def model internally)
  // Player damage goes through enemy's def as a flat reduction (enemy has no DEF%)
  const dmg = calcDamage(finalDmg, 0, enemy.def || 0, isCrit, impactStat);

  // Thorned Hide: reflect 25% back to player
  if (_hasActiveAbility(enemy, 'thorned_hide')) {
    const reflected = Math.floor(dmg * 0.25);
    runState.playerHp = Math.max(0, runState.playerHp - reflected);
  }

  enemy.hp = Math.max(0, enemy.hp - dmg);

  // Ancient Resilience: track consecutive hit type for DEF buff
  if (enemy.isBoss && enemy.abilities.some(a => a.id === 'ancient_resilience')) {
    const curType = isCrit ? 'crit' : 'normal';
    if (enemy.abilityState.lastHitType === curType) {
      enemy.abilityState.consecHitsSameType++;
      if (enemy.abilityState.consecHitsSameType >= 2) {
        enemy.def = Math.floor((enemy.def || 0) * 1.10);
        enemy.abilityState.consecHitsSameType = 0;
      }
    } else {
      enemy.abilityState.consecHitsSameType = 0;
    }
    enemy.abilityState.lastHitType = curType;
  }

  events.push({ type: 'player_attack', hit: true, damage: dmg, isCrit });
  if (isCrit) events.push({ type: 'crit_player', damage: dmg, scenario: 'battle_crit_player' });

  // Petrify tracking
  if (enemy.isBoss && enemy.abilities.some(a => a.id === 'petrify')) {
    enemy.abilityState.consecHitsOnPlayer++;
    if (enemy.abilityState.consecHitsOnPlayer >= 3 && !enemy.abilityState.petrifyTracker.active) {
      enemy.abilityState.petrifyTracker.active    = true;
      enemy.abilityState.petrifyTracker.turnsLeft = 2;
      enemy.abilityState.consecHitsOnPlayer = 0;
      events.push({ type: 'player_stunned', turns: 2 });
    }
  }
}

function _resolveEnemyAttack(runState, enemy, char, defPct, armFlat, playerDodgeStat, events, isFreeAttack) {
  // Stun check
  const stunned = enemy.statusEffects.some(s => s.type === 'stun' && s.duration > 0);
  if (stunned) {
    events.push({ type: 'enemy_stunned' });
    return 0;
  }

  // Overload: wind up turn = no attack, then 3× next turn
  if (enemy.abilityState.overloadWindingUp) {
    enemy.abilityState.overloadWindingUp = false;
    const overloadDmg = calcDamage(enemy.atk || 0, defPct, armFlat, false, 0) * 3;
    runState.playerHp = Math.max(0, runState.playerHp - Math.floor(overloadDmg));
    events.push({ type: 'enemy_attack', hit: true, damage: Math.floor(overloadDmg), isOverload: true });
    runState.tookDamageThisFloor = true;
    return Math.floor(overloadDmg);
  }

  // Hit check: enemy accuracy vs player dodge
  const hit = Math.random() < hitChance(enemy.accuracy || 0, playerDodgeStat);
  if (!hit) {
    events.push({ type: 'enemy_attack', hit: false });
    return 0;
  }

  // Check Barrier status effect
  const barrierIdx = runState.playerStatusEffects.findIndex(s => s.type === 'barrier');
  if (barrierIdx >= 0) {
    events.push({ type: 'barrier_blocked' });
    runState.playerStatusEffects.splice(barrierIdx, 1);
    return 0;
  }

  let dmg = calcDamage(enemy.atk || 0, defPct, armFlat, false, 0);

  // Life Drain (boss) — steal 10% of player current HP (true damage, ignores armor)
  if (enemy.isBoss && _hasActiveAbility(enemy, 'life_drain')) {
    const stolen = Math.floor(runState.playerHp * 0.10);
    dmg          = stolen;
    enemy.hp     = Math.min(enemy.maxHp, enemy.hp + stolen);
  }

  // Check Iron Will (survive killing blow — once per run)
  if (runState.playerHp - dmg <= 0 && !runState.ironWillUsed &&
      runState.gearTotals.passives.includes('iron_will')) {
    runState.playerHp   = 1;
    runState.ironWillUsed = true;
    events.push({ type: 'enemy_attack', hit: true, damage: dmg });
    events.push({ type: 'iron_will_trigger', scenario: 'battle_iron_will_trigger' });
    return dmg;
  }

  runState.playerHp = Math.max(0, runState.playerHp - dmg);
  runState.tookDamageThisFloor = true;
  events.push({ type: 'enemy_attack', hit: true, damage: dmg });

  // Check big hit scenario (>30% max HP)
  if (dmg > runState.playerMaxHp * 0.30) {
    events.push({ type: 'big_hit_taken', damage: dmg });
  }

  return dmg;
}

function _checkCHAAssist(runState, enemy, weaponDmg, effCHA, events, levelUps, char, gear, floor) {
  // Formula-based CHA assist (gear-only stat, uses softCap)
  const softCHA = softCapStat(effCHA);
  const chance  = companionAssistChance(softCHA);
  const fires   = Math.random() < chance;
  if (!fires) return;

  const dmg           = companionAssistDamage(weaponDmg, softCHA);
  enemy.hp            = Math.max(0, enemy.hp - dmg);
  const isKillingBlow = enemy.hp <= 0;
  const scenario      = isKillingBlow ? 'battle_companion_assist_kill' : 'battle_companion_assist';
  events.push({ type: 'companion_assist', damage: dmg, isKillingBlow, scenario });
}

function _checkBossAbilities(runState, enemy, char, events) {
  for (const ability of enemy.abilities) {
    // Check cooldown
    if ((enemy.abilityState.cooldowns[ability.id] || 0) > 0) {
      enemy.abilityState.cooldowns[ability.id]--;
      continue;
    }

    // Max 2 active abilities
    if (enemy.abilityState.activeAbilities.length >= 2) continue;

    const hpPct = enemy.hp / enemy.maxHp;
    let   fired = false;

    switch (ability.id) {
      case 'enrage':
        if (hpPct <= 0.50 && !enemy.abilityState.enrageTriggered) {
          enemy.atk *= 2;
          enemy.abilityState.enrageTriggered = true;
          fired = true;
        }
        break;

      case 'shield_of_ages':
        if (hpPct <= 0.75 && !enemy.abilityState.shieldOfAgesTriggered) {
          _addPlayerStatus(runState, { type: 'enemy_immune', duration: 2 });
          enemy.abilityState.shieldOfAgesTriggered = true;
          fired = true;
        }
        break;

      case 'regeneration':
        // Per-turn: always fires (no once-per-fight restriction)
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.abilityState.regenPerTurn);
        // Don't mark as fired — keep activating every turn
        break;

      case 'curse_of_weakness':
        if (!enemy.abilityState.usedAbilities[ability.id]) {
          _addPlayerStatus(runState, { type: 'weaken', atkReduction: 0.30, duration: 5 });
          enemy.abilityState.usedAbilities[ability.id] = true;
          fired = true;
        }
        break;

      case 'cleave':
        if (!enemy.abilityState.usedAbilities[ability.id]) {
          // True damage: bypasses all DEF
          const cleaveDmg = Math.max(1, enemy.atk);
          runState.playerHp = Math.max(0, runState.playerHp - cleaveDmg);
          runState.tookDamageThisFloor = true;
          enemy.abilityState.usedAbilities[ability.id] = true;
          fired = true;
          events.push({ type: 'boss_ability', ability, trueDamage: cleaveDmg });
        }
        break;

      case 'blood_rage':
        // +5 ATK per turn it survives — handled in main loop per turn, not here
        break;

      case 'ancient_ward':
        if (!enemy.abilityState.usedAbilities[ability.id]) {
          enemy.abilityState.ancientWardTimer = 3;
          enemy.abilityState.usedAbilities[ability.id] = true;
          fired = true;
        }
        break;

      case 'divine_smite':
        enemy.abilityState.divineSmiteTimer = (enemy.abilityState.divineSmiteTimer || 0) + 1;
        if (enemy.abilityState.divineSmiteTimer >= 5) {
          const smiteDmg = Math.floor(enemy.maxHp * 0.20);
          runState.playerHp = Math.max(0, runState.playerHp - smiteDmg);
          runState.tookDamageThisFloor = true;
          enemy.abilityState.divineSmiteTimer = 0;
          fired = true;
          events.push({ type: 'boss_ability', ability, trueDamage: smiteDmg });
        }
        break;

      case 'execute':
        if (runState.playerHp / runState.playerMaxHp < 0.20) {
          if (Math.random() < 0.25) {
            runState.playerHp = 1; // Player survives at 1 HP minimum
            fired = true;
            events.push({ type: 'boss_ability', ability, survivedAt1HP: true });
          }
        }
        break;

      case 'overload':
        if (!enemy.abilityState.overloadWindingUp &&
            !enemy.abilityState.usedAbilities[ability.id]) {
          enemy.abilityState.overloadWindingUp = true;
          enemy.abilityState.usedAbilities[ability.id] = true;
          fired = true;
          events.push({ type: 'boss_ability', ability, windingUp: true });
        }
        break;

      case 'earth_binding':
        if (!enemy.abilityState.usedAbilities[ability.id]) {
          _addPlayerStatus(runState, { type: 'earth_bound', duration: 999 });
          enemy.abilityState.usedAbilities[ability.id] = true;
          fired = true;
        }
        break;

      case 'final_transformation':
        if (hpPct <= 0.25 && !enemy.abilityState.finalTransformTriggered) {
          enemy.hp  = enemy.maxHp;
          enemy.def = 0;
          enemy.abilityState.finalTransformTriggered = true;
          fired = true;
          events.push({ type: 'boss_ability', ability, hpRestored: true });
        }
        break;

      case 'summon_minions':
        // Represents 2 phantom minions attacking the player (simplified: deal chip damage)
        if (!enemy.abilityState.usedAbilities[ability.id]) {
          const minionDmg = Math.floor(enemy.atk * 0.15 * 2);
          runState.playerHp = Math.max(0, runState.playerHp - minionDmg);
          runState.tookDamageThisFloor = true;
          enemy.abilityState.usedAbilities[ability.id] = true;
          fired = true;
          events.push({ type: 'boss_ability', ability, minionDamage: minionDmg });
        }
        break;

      case 'death_rattle':
        // Fires on enemy death — handled in _handleEnemyDeath
        break;

      case 'soul_brand':
        // Reduces one equipped item's bonus stats by 50% (simplified: just notify)
        if (!enemy.abilityState.usedAbilities[ability.id]) {
          enemy.abilityState.usedAbilities[ability.id] = true;
          fired = true;
          events.push({ type: 'boss_ability', ability });
        }
        break;
    }

    if (fired) {
      enemy.abilityState.cooldowns[ability.id] = 3;
      if (!enemy.abilityState.activeAbilities.includes(ability.id)) {
        enemy.abilityState.activeAbilities.push(ability.id);
        if (enemy.abilityState.activeAbilities.length > 2) {
          enemy.abilityState.activeAbilities.shift();
        }
      }
      if (!events.some(e => e.type === 'boss_ability' && e.ability === ability)) {
        events.push({ type: 'boss_ability', ability, scenario: 'battle_enemy_special_fires' });
      }
    }
  }
}

function _processStatusTicks(runState, enemy, events) {
  // Player status effects
  const playerEffects = runState.playerStatusEffects;
  for (let i = playerEffects.length - 1; i >= 0; i--) {
    const fx = playerEffects[i];
    if (fx.type === 'poison' || fx.type === 'bleed') {
      const dmg = fx.damage || 0;
      runState.playerHp = Math.max(0, runState.playerHp - dmg);
      events.push({ type: 'status_tick', entity: 'player', effect: fx.type, damage: dmg });
    } else if (fx.type === 'regen') {
      const heal = fx.healAmount || 0;
      runState.playerHp = Math.min(runState.playerMaxHp, runState.playerHp + heal);
      events.push({ type: 'status_tick', entity: 'player', effect: 'regen', heal });
    }
    fx.duration--;
    if (fx.duration <= 0) playerEffects.splice(i, 1);
  }

  // Enemy status effects
  const enemyEffects = enemy.statusEffects;
  for (let i = enemyEffects.length - 1; i >= 0; i--) {
    const fx = enemyEffects[i];
    if (fx.type === 'poison' || fx.type === 'bleed') {
      const dmg = fx.damage || 0;
      enemy.hp  = Math.max(0, enemy.hp - dmg);
      events.push({ type: 'status_tick', entity: 'enemy', effect: fx.type, damage: dmg });
    }
    if (fx.type !== 'stun') fx.duration--;
    else fx.duration--;
    if (fx.duration <= 0) enemyEffects.splice(i, 1);
  }
}

function _addPlayerStatus(runState, effect) {
  // Don't stack if already present (except stacking damage effects)
  if (effect.type === 'poison' || effect.type === 'bleed') {
    runState.playerStatusEffects.push(effect);
  } else {
    const existing = runState.playerStatusEffects.findIndex(s => s.type === effect.type);
    if (existing >= 0) runState.playerStatusEffects[existing] = effect;
    else runState.playerStatusEffects.push(effect);
  }
}

function _getStatusFactor(effects, type, field) {
  const fx = effects.find(s => s.type === type);
  return fx ? (fx[field] || 0) : 0;
}

function _hasActiveAbility(enemy, abilityId) {
  return enemy.abilityState.activeAbilities.includes(abilityId);
}

function _handleEnemyDeath(runState, floor, enemy, char, gear, events, levelUps) {
  const isBoss   = enemy.isBoss;
  const isShiny  = enemy.isShiny;

  // Death Rattle: trigger one random ability on death
  if (isBoss && enemy.abilities.some(a => a.id === 'death_rattle') &&
      !enemy.abilityState.usedAbilities['death_rattle']) {
    enemy.abilityState.usedAbilities['death_rattle'] = true;
    const otherAbilities = enemy.abilities.filter(a => a.id !== 'death_rattle');
    if (otherAbilities.length > 0) {
      const rattleAbility = _pickFrom(otherAbilities);
      const rattleDmg = Math.floor(enemy.atk * 0.5);
      runState.playerHp = Math.max(1, runState.playerHp - rattleDmg); // survive at 1HP
      events.push({ type: 'boss_ability', ability: rattleAbility, isDeathRattle: true, damage: rattleDmg });
    }
  }

  // Compute rewards with zone-power floor and harder-kill bonus
  const zonePwr    = calcZonePower(runState.zone.tier || 1, 1.0);
  const playerPwr  = calcPlayerPower(char, gear);
  const rwdMult    = rewardMultiplier(playerPwr, zonePwr);

  // Zero rewards if player far outgears the zone
  const xpGained   = rwdMult > 0
    ? xpReward(runState.zoneLevel, enemy.xpMult || 1, isShiny, isBoss)
    : 0;
  const lootDrop   = rollLootDrop(runState.zoneLevel,
                                   gear.totalLuck || 0,
                                   enemy.bracketId || 'minion',
                                   char.level, isBoss, isShiny);

  // Apply daily bonus and harder-zone multiplier
  let xpFinal = Math.floor(xpGained * rwdMult);
  let goldFinal = 0;
  if (runState.dailyBonus) {
    xpFinal = Math.floor(xpFinal * (1 + runState.dailyBonus.xpBonus));
  }

  runState.xpBag  += xpFinal;
  runState.kills  += 1;
  runState.consecutiveKillsNoDamage = runState.tookDamageThisFloor
    ? 0
    : runState.consecutiveKillsNoDamage + 1;

  // Gold from enemy — also scaled by reward multiplier
  const rawGold = rwdMult > 0
    ? goldDrop(runState.zoneLevel, BRACKETS[enemy.bracketId]?.goldMult || 1, isShiny, isBoss)
    : 0;
  goldFinal = Math.floor(rawGold * rwdMult);
  if (runState.dailyBonus) {
    goldFinal = Math.floor(goldFinal * runState.dailyBonus.goldBonus);
  }
  // Apply Luck gold bonus
  const luckGoldMult = 1 + (gear.totalLuck || 0) * 0.002;
  goldFinal = Math.floor(goldFinal * luckGoldMult);
  runState.goldBag += goldFinal;

  if (isBoss) runState.bossKillCount++;

  // Apply loot drop
  _applyLoot(runState, [lootDrop], events);

  // Determine scenario key
  const winScenario = isShiny  ? 'battle_win_shiny' :
                      isBoss   ? 'battle_win_boss' :
                      'battle_win';

  // Find the killing blow — last hit event before this death
  const killingBlow = (() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev.type === 'companion_assist' && ev.damage) {
        return { damage: ev.damage, isCrit: false, source: 'companion' };
      }
      if (ev.type === 'player_attack' && ev.hit && ev.damage) {
        return { damage: ev.damage, isCrit: ev.isCrit || false, source: 'player' };
      }
    }
    return null;
  })();

  events.push({
    type: 'enemy_died',
    enemy: { name: enemy.name, isShiny, isBoss, archetype: enemy.archetype },
    xpGained: xpFinal,
    goldGained: goldFinal,
    killingBlow,
    scenario: winScenario,
  });

  // Kill streak
  if (runState.consecutiveKillsNoDamage === 3) {
    events.push({ type: 'kill_streak', count: 3, scenario: 'battle_win_streak_3' });
  } else if (runState.consecutiveKillsNoDamage === 5) {
    events.push({ type: 'kill_streak', count: 5, scenario: 'battle_win_streak_5' });
  }
  if (!runState.tookDamageThisFloor) {
    events.push({ type: 'perfect_kill', scenario: 'battle_win_perfect' });
  }

  runState.isFirstFight = false;

  // Level-up computation (XP not yet committed to DB — engine just reports)
  // Correctly subtract XP cost per level as we advance.
  let   xpPool      = char.xp + runState.xpBag;
  let   currentLevel = char.level;
  while (currentLevel < 200) {
    const needed = xpRequired(currentLevel);
    if (xpPool < needed) break;
    xpPool -= needed;
    currentLevel++;
    const statPts = 3;
    levelUps.push({ newLevel: currentLevel, statPointsGained: statPts });
    const scenKey = currentLevel === 50  ? 'level_milestone_50'  :
                    currentLevel === 100 ? 'level_milestone_100' :
                    currentLevel === 200 ? 'level_milestone_200' :
                    currentLevel <= 10  ? 'level_up_1_10'   :
                    currentLevel <= 25  ? 'level_up_11_25'  :
                    currentLevel <= 50  ? 'level_up_26_50'  :
                    currentLevel <= 75  ? 'level_up_51_75'  :
                    currentLevel <= 100 ? 'level_up_76_100' :
                    currentLevel <= 150 ? 'level_up_101_150': 'level_up_151_200';
    events.push({ type: 'level_up', newLevel: currentLevel, statPointsGained: statPts, scenario: scenKey });
  }

  // Floor done
  floor.completed  = true;
  runState.phase   = 'floor_complete';

  // If this was the boss floor, the run is complete
  if (floor.isBossFloor) {
    runState.result  = 'success';
    runState.phase   = 'run_complete';
    events.push({ type: 'run_complete', result: 'success', scenario: 'run_complete_boss' });
  }
}

function _handlePlayerDeath(runState, floor, enemy, events, levelUps) {
  runState.playerHp = 0;
  runState.result   = 'death';
  runState.phase    = 'run_complete';
  floor.completed   = true;
  events.push({ type: 'player_died', scenario: 'battle_lose' });
  events.push({ type: 'run_complete', result: 'death', scenario: 'run_failed_death' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Scaling formulas
  softCapStat,
  xpRequired,
  xpReward,
  enemyStatBudget,
  bossBudget,
  allocateStats,
  applyShinyModifiers,
  maxHP,
  calcPlayerDamage,
  applyDefenses,
  playerEffectiveDEF,
  hitChance,
  critChance,
  critMultiplier,
  calcDamage,
  companionAssistChance,
  companionAssistDamage,
  goldDrop,
  shinyChance,
  rarityWeights,
  trapDamage,
  merchantBuyPrice,
  merchantSellPrice,
  fleeChance,
  dailyBonus,
  calcPlayerPower,
  calcZonePower,
  rewardMultiplier,
  // Gear
  gearStatRange,
  pickRarity,
  isSetPiece,
  generateItemName,
  generateGearItem,
  rollLootDrop,
  computeGearTotals,
  // Entities
  generateEnemy,
  generateBoss,
  // Run
  startRun,
  resolveFloorRoom,
  // Combat
  runCombatTurn,
};
