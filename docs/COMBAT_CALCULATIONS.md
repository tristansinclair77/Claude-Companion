# Combat Calculations — Adventure Mode Reference

This document is the canonical spec for how combat, stat checks, and any other
mechanically-rolled outcome are resolved in Adventure mode. It defines:

- the two-phase turn architecture (calc-request → engine math → narrate)
- the default formulas (to-hit, damage, AC, skill checks, saves)
- the stat scale and what each stat means
- the tag schemas the GM emits and the engine returns
- how branching action sequences work
- which rules the engine enforces vs. which the GM applies per-request
- how unique abilities, spells, equipment, and items get tracked for
  developer implementation via `text-adventure-implementation-tasks.md`

When in doubt about anything mechanical, this document wins.

---

## Why two-phase turns

Before this system, every turn was a single Claude call. Claude was the
gamemaster AND the source of combat truth, which meant the player's narration
could heavily influence whether their attack hit, how much damage it did, and
what consequences followed. The story bias was real and made combat feel
narratively-determined rather than dice-determined.

The two-phase turn fixes that. **EVERY turn runs both phases.** Call 1
always runs to check for calcs. Call 2 always runs to write the narrative.
This is uniform — there is no "single-call fast path" for non-combat turns.
The reason: GM consistency. The GM always knows that calc results live in
the `[COMBAT_CALCULATION_RESULT]` block of the Call 2 prompt; sometimes
that block is full of rolls, sometimes it just says "No Calculations
Requested." Either way the GM doesn't have to handle two different prompt
shapes.

1. **Call 1 (lite — calc parser).** Claude receives the player's action +
   the current state + the combat rules + a short directive: "decide
   whether any mechanical resolution is needed for this turn." It emits
   `[COMBAT_CALC_REQUEST]` if calcs are needed (enumerating every roll and
   dependency, including what-if branches), or `[NO_CALC_NEEDED]` if the
   turn is pure narrative. It writes NO narrative on this call.
2. **Engine resolution.** The engine reads the request, rolls dice per the
   default formulas, applies modifiers from abilities/equipment/buffs,
   enforces engine-side rules (Undying Bond redirect, etc.), and produces
   `[COMBAT_CALCULATION_RESULT]` with every action's outcome. If Call 1
   returned `[NO_CALC_NEEDED]`, the result block is a single-line
   placeholder: `{ "actions": [], "note": "No calculations requested." }`
3. **Call 2 (full — narrator).** Claude receives the full GM context
   (rules, memory, profiles, music catalog, etc.) PLUS the calc result
   block (always present, sometimes empty), and writes the normal turn —
   narrator, Aria commentary, music, state diff — with the knowledge of
   exactly what happened (or with full freedom if no rolls were needed).

This roughly costs ~1.3× the normal token budget per turn. Call 1 is
dramatically smaller than Call 2 (no music catalog, no profiles, no
memory dump — just state, action, calc rules, directive) so the overhead
is reasonable.

---

## When calcs are required

Every turn, the GM is asked the question "does anything in this turn need
mechanical resolution?" The answer is **yes** whenever the turn involves
any of:

- **Damage** dealt to or by a tracked entity (player, companion, party
  member, enemy, summon).
- **Stat checks** where success/failure depends on a stat — climbing a
  wall, picking a lock, persuading an NPC, intimidating a guard, recalling
  lore, sneaking past a sentry, deciphering a glyph. **All skill checks
  go through the calc system** — the dice decide success, not the GM's
  narrative preference.
- **Saving throws** to resist effects (poison, fear, charm, fire damage,
  knockback, area spells).
- **Multi-step risky actions** where one outcome gates the next ("dodge,
  then attack, then jump to the next enemy") — every branch including
  failure paths must be enumerated.
- **Anything else dice-like.** When in doubt, request a calc.

The answer is **no** for purely narrative beats:

- Exploring a room, examining an object, looting a defeated enemy's body.
- Talking to a non-hostile NPC about lore (unless the conversation pivots
  to a persuasion / deception / insight check).
- Resting safely.
- Travel between locations (unless the travel itself triggers a check —
  a treacherous mountain pass, a poisoned swamp).
- Companion autonomous actions that don't deal damage or risk failure.

If the answer is **no**, the GM emits `[NO_CALC_NEEDED]` on Call 1. Call 2
still runs and still includes the calc result block — just with an empty
`actions` array and the note `"No calculations requested."`. This keeps
the GM's prompt shape consistent across all turns.

If the GM is unsure, requesting a calc is the safer default. False-positive
calc requests are cheap; missing a calc and silently fudging damage is the
exact failure mode this system exists to prevent.

---

## The stat scale

Stats run 8–20 normally, with rare boons or curses pushing the range further.
The mod formula is intentionally simple:

```
mod = stat - 8
```

So:

| Stat | Mod |
|------|-----|
| 8    | +0  |
| 10   | +2  |
| 12   | +4  |
| 14   | +6  |
| 16   | +8  |
| 18   | +10 |
| 20   | +12 |

This is a wider mod range than D&D's `(stat-10)/2` formula. The intent: stats
matter visibly. A STR 15 fighter (+7) hitting an AC 12 ogre lands the swing
≥75% of the time; a STR 8 mage (+0) lands ≈45%. The difference between
characters should feel real.

**Stat meanings:**

| Stat  | Used for                                                                |
|-------|--------------------------------------------------------------------------|
| STR   | Melee attack rolls, melee damage, lifting/breaking, grapple              |
| DEX   | Ranged attack rolls, dodge, stealth, initiative, AC bonus                |
| INT   | Spell attack rolls, spell damage, recall lore, decipher, investigate     |
| WIS   | Perception, insight, willpower, divine/nature magic, fear/charm saves    |
| CON   | HP scaling, poison/disease saves, exhaustion resistance                  |
| LUCK  | Crit chance modifier, narrow misses, gambling, finding shortcuts         |

LUCK is the wildcard — most calcs don't use it, but for marginal outcomes
(an attack roll one off from landing, a chest that might be trapped) the
engine may grant a LUCK reroll if LUCK > 10.

---

## Default formulas

### To-hit (attack roll)

```
to_hit = 1d20 + stat_mod + situational_modifiers
hit    = to_hit >= target_AC
```

- **stat_mod**: STR for melee weapons, DEX for ranged weapons, INT for spell
  attacks. Some spells/abilities specify a different stat (a divine smite
  might use WIS).
- **situational_modifiers**: any `damage_bonus`, `attack_bonus`, advantage
  state, buff effects, or terrain modifiers the GM lists in the calc request.
- **nat 20**: always hits, and is a **crit** (see below).
- **nat 1**: always misses, regardless of bonuses.

### Damage roll

```
weapon_dice    = roll(weapon.dmg)        // e.g. "1d8+2"
spell_dice     = roll(spell.dmg)         // e.g. "1d6"  — may be 0 for utility spells
base_damage    = weapon_dice + stat_mod  // stat_mod from the to-hit stat
final_damage   = max(0, (base_damage + damage_bonus) - target_armor)
```

- **weapon.dmg** lives on the inventory item (`{ stats: { dmg: "1d8+2" } }`).
  Void-Forged Sword is `1d8+2` per its inventory entry.
- **damage_bonus**: from Void Resonance, blessed buffs, etc. — the GM includes
  these in the request.
- **target_armor**: for enemies, comes from `enemy.armor` if set; default 0.
  For player/companion, see AC below — armor reduces damage that lands.
- **Damage cannot go below 0.** A hit always logs as "hit" even if the damage
  rolls to nothing — that matters for triggers like "on hit" buffs.

### Critical hits

A natural 20 on the to-hit die is a crit:

```
crit_damage = (2 × weapon_dice) + stat_mod + damage_bonus - target_armor
```

Only the dice double, not the modifiers. Crits feel meaningful without
trivializing fights against tough enemies.

Some abilities raise the crit range (e.g. "crits on 19-20"). The GM lists
these in the calc request as `crit_range: 19`.

### Armor Class (AC)

For player/companion/party members:

```
AC = 10 + dex_mod + Σ(equipment.ac_bonus)
```

Trist's current AC = `10 + (13-8) + 2 (shield) + 3 (chestpiece) = 20`.

For enemies and NPCs:

- **The GM MUST provide full stats for every enemy and every named NPC at
  the moment they are introduced.** Not just `slug/name/hp/maxHp` — also
  `ac`, the full stat block (`str/dex/int/wis/con/luck`), damage formula
  (`dmg`), armor reduction (`armor`), and any special abilities or
  vulnerabilities. The two-phase calc system has no fallback math for
  half-statted enemies; if the engine can't resolve a roll against an
  unstatted target, the calc result includes an error and the GM has to
  improvise this turn. Don't make the engine improvise.
- A complete enemy entry looks like:

  ```json
  {
    "id":     "goblin-scout-1",
    "slug":   "goblin",
    "name":   "Filed-Tooth",
    "hp":     8, "maxHp": 8,
    "ac":     12,
    "armor":  0,
    "str":    8, "dex": 12, "int": 7, "wis": 8, "con": 9, "luck": 9,
    "dmg":    "1d4+1",
    "desc":   "Wiry, half-starved, eyes too bright. Filed teeth.",
    "tags":   ["humanoid", "small"]
  }
  ```

- AC scale examples: goblin runt 11, seasoned bandit 14, ogre 13 (slow but
  tough), dark knight 17 (full armor), dragon 19, demigod boss 22+.
- `tags` matters for modifiers like Void Resonance (which checks for
  `"ancient"` or `"magical"`). Always include relevant tags.
- Named NPCs who could ever be checked-against (persuade, intimidate,
  insight) also need full stats — the engine can't resolve "persuade
  Old Mara" without her WIS.

### Skill checks

```
roll = 1d20 + stat_mod + proficiency_bonus
success = roll >= DC
```

- **proficiency_bonus**: 0 unless an ability/background grants one. Skills
  Trist trained in (sword work, void-magic recognition) might be +2.
- **DC scale**:

  | Difficulty       | DC |
  |------------------|----|
  | Trivial          | 5  |
  | Easy             | 8  |
  | Routine          | 10 |
  | Medium           | 12 |
  | Hard             | 14 |
  | Very hard        | 17 |
  | Nearly impossible| 20 |
  | Heroic           | 25 |

The GM picks the DC when requesting the check. Players don't see DCs.

### Saving throws

Same formula as skill checks. The stat is picked by save type:

| Save type             | Stat |
|-----------------------|------|
| Grapple, force        | STR  |
| Dodge area effect     | DEX  |
| Poison, disease, exhaustion | CON  |
| Mental, illusion      | INT  |
| Fear, charm, divine   | WIS  |
| Pure misfortune       | LUCK |

---

## HP scaling

There is no per-level auto-bump. The GM grants HP/MP capacity changes as
part of level-up rewards via `[LEVEL_UP]` + the `[GAME_STATE]` diff (see
`text-adventure-rules.js`).

The recommended scale for level-up HP grants:

- **Fighter / tank build (high CON)**: +5 to +8 HP per level
- **Mage / agile build (low CON, high INT/DEX)**: +3 to +5 HP per level
- **Companion / NPC scaling**: GM's call, usually 30-50% of player rate

MP grants similarly: +2 to +5 for casters, +0 to +2 for non-casters.

---

## Engine-enforced rules (hard-coded in the engine)

These rules run automatically inside the engine's calc resolution and the
GM does NOT need to remember them. The calc result will reflect their effect.

### Undying Bond (Trist, passive)

The ability description lives at `state.player.abilities[].id == 'undying-bond'`.
The engine enforces it at damage-application time:

```
when damage is dealt to player:
  if player.hp_after_damage / player.maxHp <= 0.50:
    if companion.hp / companion.maxHp > 0.50:
      redirect the damage to companion instead
      log "damage redirected via Undying Bond"
```

The result block includes both rows: the original target row marks the
attack as a hit but `damage_applied_to: 'aria'`, and a redirect row shows
the actual HP change on the companion. The GM narrates accordingly
("the eel's fangs find your shoulder — but the void recoils and you feel
Vesper's grip on the medallion tighten as she takes the wound for you").

Future engine-enforced rules will follow the same pattern: documented in
the data field, hard-coded in the engine, results clearly labeled.

---

## Per-character modifiers (GM-applied, engine-respected)

These are passive bonuses that live in character data and the GM applies them
by including the right `modifiers` block in each calc request. The engine
respects them but doesn't auto-detect when to apply them — that's the GM's job.

Why? Because the GM knows the narrative context (which weapon is equipped
this turn, whether the buff is still active, whether the target qualifies as
"ancient" for Void Resonance). Engine-side detection would either be too
permissive or too restrictive.

### Sources of modifiers the GM should consider each request:

- **Equipped weapons/armor** — `state.player.equipment.*` — read the items in
  `state.player.inventory` for their `stats` block (dmg, ac_bonus,
  damage_bonus, etc.).
- **Active abilities** — `state.player.abilities[]` — passives like Void
  Resonance carry a `desc` and a `rules` array describing when they apply.
- **Active buffs/debuffs** — `state.player.buffs[]` / `debuffs[]` — short-term
  modifiers that decrement per turn.
- **Inventory items** — consumables that have been activated (oils, blessings,
  potions) — usually surface as buffs after use.
- **Terrain/situational** — high ground, prone target, flanking, surprise
  round — the GM includes these as `attack_bonus` or `advantage`.

### Modifier schema (inside a calc request action)

```json
"modifiers": {
  "attack_bonus":  1,          // flat add to the to-hit roll
  "damage_bonus":  1,          // flat add to the damage roll
  "armor_pierce":  1,          // subtracted from target armor before damage
  "crit_range":    19,         // crit threshold (default 20)
  "advantage":     true,       // roll 2d20 take higher
  "disadvantage":  false,      // roll 2d20 take lower (cancels advantage)
  "source":        "Void Resonance passive (+1 dmg, +2 vs ancient/magical)"
}
```

The `source` field is required and shows up in the result so the player can
see why a number was the way it was.

---

## Tag schemas

## Multi-target actions

A single spell, ability, or attack that hits multiple entities (a fireball,
a cleave that sweeps two adjacent goblins, a piranha swarm's bite against
two party members) is **ONE action with a `targets` array**, NOT one action
per target.

This matters because:

- The 3-action cap (see Branching below) counts logical actions, not roll
  count. A fireball against 5 goblins is one action against the cap, even
  though the engine rolls 5 saves.
- Multi-target actions are atomic — they all resolve as part of the same
  "moment" in the narration. The GM writes "the void-fire blooms outward
  and washes over them all" rather than five separate strike beats.
- Whether each target rolls a save or whether each is hit by a separate
  to-hit roll depends on the action shape:

| Shape          | Per-target resolution                                       |
|----------------|-------------------------------------------------------------|
| `attack`/`spell` with `targets: [...]` and **no** `save_type` | Engine rolls one to-hit per target vs. each target's AC. Standard multi-attack. |
| `spell`/`ability` with `targets: [...]` and a `save_type` + `save_stat` + `dc` | Engine rolls one save per target. Failed save → full damage; succeeded save → half damage (or no damage if `on_save: "none"`). |

Example — a multi-target spell with saves:

```json
{
  "id":         "void-bloom",
  "kind":       "spell",
  "actor":      "aria",
  "spell":      "void-bloom",
  "targets":    ["goblin-a", "goblin-b", "goblin-c"],
  "save_stat":  "dex",
  "save_type":  "area",
  "dc":         15,
  "on_save":    "half"   // "half" | "none"
}
```

The result block returns a `per_target` array:

```json
{
  "id":       "void-bloom",
  "executed": true,
  "per_target": [
    { "target": "goblin-a", "save_roll": { "die": 7, "mod": 4, "total": 11, "dc": 15, "outcome": "failure" }, "damage": 8, "applied_to": "goblin-a", "killed": true },
    { "target": "goblin-b", "save_roll": { "die": 18, "mod": 4, "total": 22, "dc": 15, "outcome": "success" }, "damage": 4, "applied_to": "goblin-b", "killed": false },
    { "target": "goblin-c", "save_roll": { "die": 3, "mod": 4, "total": 7,  "dc": 15, "outcome": "failure" }, "damage": 8, "applied_to": "goblin-c", "killed": true }
  ]
}
```

For multi-target `attack`/`spell` without saves, the per-target array has
`to_hit` + `damage` rows instead of `save_roll`.

### `[COMBAT_CALC_REQUEST]` (GM emits on Call 1)

```
[COMBAT_CALC_REQUEST]
{
  "reason": "Short one-line summary of why calcs are needed this turn.",
  "actions": [
    {
      "id":        "string",           // unique within this request, used for if-conditions
      "kind":      "attack"  | "spell" | "ability" | "skill_check" | "save",
      "actor":     "player"  | "aria"  | "<party-id>" | "enemy" | "<spawned-id>",
      "target":    "player"  | "aria"  | "<party-id>" | "enemy" | "<spawned-id>" | null,
      "targets":   [ ... ]              // optional — for multi-target spells, replaces target
      "weapon":    "<inventory-item-id>",      // for attack
      "spell":     "<spell-id>",               // for spell
      "ability":   "<ability-id>",             // for ability
      "stat":      "str" | "dex" | "int" | "wis" | "con" | "luck",  // for skill_check / save
      "save_type": "grapple" | "area" | "poison" | "mental" | "fear_charm" | "misc",
      "dc":        12,                          // for skill_check / save — GM-set
      "intent":    "wound" | "kill" | "subdue" | "disarm",   // narrative flavor
      "approach":  "lunge" | "wild swing" | "...",            // narrative flavor
      "if":        "<prior-action-id>.<outcome>",             // see branching below
      "modifiers": { ... }                                    // see modifier schema above
    }
  ]
}
[/COMBAT_CALC_REQUEST]
```

If the action requires no calc (pure narrative), emit instead:

```
[NO_CALC_NEEDED]
```

(Single-line tag, no body. Signals the engine to proceed to Call 2 with
an empty calc result block. Call 2 still runs — the calc system uses both
calls every turn, but a `[NO_CALC_NEEDED]` first call means Call 2 sees
`{ "actions": [], "note": "No calculations requested." }` in the result
slot.)

### Branching with `if`

Outcome strings for the `if` field:

| Action kind   | Outcome strings                                                          |
|---------------|--------------------------------------------------------------------------|
| `attack`      | `hit`, `miss`, `crit`, `killed` (target's hp ≤ 0), `wounded` (hit but alive) |
| `spell`       | same as attack                                                            |
| `ability`     | same as attack                                                            |
| `skill_check` | `success`, `failure`, `critical_success` (nat 20), `critical_failure` (nat 1) |
| `save`        | same as skill_check                                                       |

Examples:

```json
{ "id": "swing-b", "if": "swing-a.killed" }      // only swing at B if A died
{ "id": "counter", "if": "dodge.miss" }          // enemy counters only if Trist failed his dodge
{ "id": "bonus-attack", "if": "main-attack.crit" }  // bonus die only on crit
```

Without an `if` field, the action always resolves.

If an action's `if` condition isn't met, the engine returns it in the result
as `{ skipped: true, reason: "if not met" }`. The GM then knows to narrate
the un-taken branch ("you decided not to risk the leap to B").

### `[COMBAT_CALCULATION_RESULT]` (engine returns on Call 2)

```
[COMBAT_CALCULATION_RESULT]
{
  "request_id": "turn-N",                        // matches turn count for traceability
  "actions": [
    {
      "id":       "swing-a",
      "kind":     "attack",
      "actor":    "player",
      "target":   "goblin-a",
      "executed": true,
      "to_hit":   { "die": 14, "mod": 7, "bonus": 0, "total": 21, "target_ac": 11, "outcome": "hit" },
      "damage":   { "dice_roll": 6, "stat_mod": 7, "bonus": 1, "armor": 0, "total": 14 },
      "crit":     false,
      "target_hp_before": 10,
      "target_hp_after":  0,
      "killed":   true,
      "applied_to": "goblin-a",                  // resolved target after any redirects
      "modifier_log": [
        "Void Resonance passive: +1 damage"
      ]
    },
    {
      "id": "swing-b",
      "executed": true,
      "to_hit": { ... },
      ...
    },
    {
      "id": "counter-on-fail",
      "executed": false,
      "reason": "if condition not met (dodge.miss did not occur)"
    }
  ],
  "engine_notes": [
    "Undying Bond was not triggered this turn (Trist HP > 50%)."
  ]
}
[/COMBAT_CALCULATION_RESULT]
```

When Undying Bond triggers, the action that targeted the player will have:

```json
{
  "id": "enemy-strike",
  "applied_to": "aria",
  "target_hp_before": 35,
  "target_hp_after":  35,         // player's HP, unchanged
  "redirect": {
    "to":             "aria",
    "redirected_hp_before": 35,
    "redirected_hp_after":  29,
    "reason": "Undying Bond — Trist would have dropped to 24/35 (≤50%); Vesper at 35/35 (>50%) absorbs the 6 damage."
  }
}
```

### `[IMPLEMENTATION_TASK]` (GM emits on unique grants)

Whenever the GM awards a unique ability, spell, equipment, or item that the
engine doesn't natively know how to compute, emit:

```
[IMPLEMENTATION_TASK]
{
  "kind":     "ability" | "spell" | "equipment" | "item",
  "id":       "kebab-case-stable-id",
  "name":     "Display Name",
  "owner":    "player" | "aria" | "<party-id>" | "shared",
  "summary":  "One-line capsule of what it is.",
  "description": "Full prose description of how it works in-fiction.",
  "intended_mechanic": "Crisp statement of the mechanical intent: when it triggers, what it does, edge cases.",
  "implementation_notes": "Specific guidance for the developer: which calc fields to set, when to apply, what data to read.",
  "complexity": "low" | "medium" | "high"
}
[/IMPLEMENTATION_TASK]
```

The engine:

1. Appends a markdown entry to `characters/<character>/text-adventure-implementation-tasks.md`
2. Fires a pop-up in the renderer showing the task to the player
3. The player reviews and, when ready, asks the developer (me) to implement it

Until implemented, the GM honors it as a narrative-only feature (it works in
prose but doesn't yet feed into calcs). Once implemented, the engine reads
it from data and applies it automatically.

### Engine code-block emissions (future — not yet implemented)

Goal: the GM can emit declarative rule snippets that the engine appends to a
per-character `text-adventure-calc-overrides.md` file. These wouldn't be
executed code — they'd be structured rules the engine respects when computing
calcs (e.g. "this character has damage_bonus +1 vs undead").

This is deferred until the base two-phase system is shipped and stable. The
[IMPLEMENTATION_TASK] flow covers the unique-grant case in the meantime.

---

## What-if scenarios

The GM is responsible for enumerating every branch a multi-step action could
take. Example player input:

> "I dodge the goblin's attack, then slash Goblin A with my sword, then leap
> off its body and lunge to stab Goblin B."

The GM's calc request should plan all of:

```json
{
  "reason": "Player chains dodge + attack + leap + attack against two goblins.",
  "actions": [
    { "id": "dodge",     "kind": "save",        "actor": "player", "stat": "dex", "save_type": "area", "dc": 13 },
    { "id": "swing-a",   "kind": "attack",      "actor": "player", "target": "goblin-a", "weapon": "void-sword",
      "if": "dodge.success" },
    { "id": "leap",      "kind": "skill_check", "actor": "player", "stat": "dex", "dc": 10,
      "if": "swing-a.killed" },
    { "id": "stab-b",    "kind": "attack",      "actor": "player", "target": "goblin-b", "weapon": "void-sword",
      "if": "leap.success" },
    { "id": "counter-a", "kind": "attack",      "actor": "goblin-a", "target": "player", "weapon": "rusty knife",
      "if": "dodge.failure" },
    { "id": "stumble",   "kind": "save",        "actor": "player", "stat": "dex", "save_type": "area", "dc": 12,
      "if": "leap.failure" }
  ]
}
```

The engine resolves dodge first. If dodge succeeds, swing-a runs; if it
kills Goblin A, the leap check fires; if the leap succeeds, the stab on B
runs. If at any step a branch fails, the corresponding what-if action fires
(counter or stumble).

The GM then narrates only the branches that actually executed, presenting
the un-taken paths as "you decided against it" or simply omitting them.

**The player is not the gold-standard for what literally happens.** The
player declares intent and approach; the dice and the rules determine
outcomes. If the dice say the dodge failed, the goblin's blade scrapes
across Trist's shoulder — regardless of how confidently he announced the
maneuver.

**Cap: 3 actions per request.** This is intentionally tight. The cap
counts logical actions, not roll count (a multi-target spell against 5
goblins is still 1 action — see Multi-target actions above).

Companion + enemy actions don't compete with the player's cap — they're
their own scoped slots:

- **3 player actions max** declared by Trist's text. If he writes
  "I dodge, attack, jump, attack, parry, attack" — only the first 3
  resolve. Beyond that the GM truncates and notes in the result that
  the chain was clipped.
- **Aria/companion: 1 autonomous action** per turn, decided by the GM,
  added to the same request.
- **Enemy: 1 action per active enemy** per turn (or 1 group action for
  swarms), added to the same request.
- **What-if branches** (e.g. "enemy counter if dodge fails") are also
  part of the request but each branch counts against the player's 3
  if it's contingent on a player action. Plan accordingly: if the
  player writes 3 chained actions, branch failures for all 3 already
  fill the slots.

The 3-cap exists because longer chains were producing brittle planning —
the GM was guessing too far ahead and the narrative got mechanical. Three
beats per turn keeps it punchy. If the player writes a 5-step plan, the
GM resolves the first 3 and the narrative naturally implies "you started
the chain but the next moment is its own turn."

---

## Where data lives

### Character state (`text-adventure.json`)

- **Stats, HP, MP**: `state.player.*`, `state.aria.*`, `state.party[]`
- **Equipped items**: `state.player.equipment.*` (weapon, offhand, head,
  body, feet, accessory)
- **Inventory items with mechanical stats**: `state.player.inventory[].stats`
  — fields like `{ dmg: "1d8+2", ac_bonus: 2, str_req: 9 }`
- **Active abilities**: `state.player.abilities[]` — `{ id, name, type, desc,
  rules, source }`
- **Spells**: `state.player.spells[]` — `{ id, name, cost, desc, dmg }`
- **Buffs / debuffs**: `state.player.buffs[]`, `state.player.debuffs[]` —
  `{ id, name, turnsRemaining, effect }`
- **Enemy**: `state.enemy` — `{ id, slug, name, hp, maxHp, ac, armor, dmg,
  desc, tags }`

### Per-story documents (per character directory)

- **`text-adventure-implementation-tasks.md`** — append-only log of
  unique-grant `[IMPLEMENTATION_TASK]` emissions awaiting developer review.
  Starts blank for every new game.

### Engine-side files

- **`src/main/combat-calc.js`** — formulas and resolver (the heart of the
  engine's math).
- **`src/main/text-adventure-store.js`** — state schema and diff applicator.
- **`src/main/text-adventure-ipc.js`** — orchestrates the two-phase turn
  flow.
- **`src/main/text-adventure-rules.js`** — the rules document sent to the GM
  each turn. References this document.

---

## Validation and error handling

When the engine receives a malformed `[COMBAT_CALC_REQUEST]`:

- **Unknown actor/target id**: action is skipped, the result includes
  `error: "unknown actor 'goblin-c'"`. Other actions still resolve.
- **Missing required field for kind**: same — skip + error.
- **`if` references an action that doesn't exist**: skip + error.
- **Circular `if` chain**: skip all actions in the cycle + error.
- **More than 3 player actions**: truncated to first 3 + result includes
  `engine_notes: ["Truncated to 3 player actions; remainder ignored"]`.
  Companion and enemy actions don't count against this cap.

If EVERY action errors, the engine returns an empty result and the second
call's prompt includes a clear note: "Calc request was malformed — narrate
the turn as best you can using your judgment, then we'll catch up next
turn." This is the escape hatch.

---

## Future work (explicitly NOT in v1)

- **Calc-override code blocks** that the engine reads and applies
  automatically (see "Engine code-block emissions" above).
- **Initiative tracking** with formal turn order. Currently the GM declares
  order in the request and the engine resolves in that order.
- **Reach / range / line-of-sight** as first-class calc inputs. Currently
  positions tracking is informational; reach is the GM's call.
- **Status effects** with structured triggers (DoT, regen, condition
  immunity). Currently buffs/debuffs are descriptive only.
- **Critical-tier table** for narrative crit consequences (sever limb,
  disarm, knockdown). Currently a crit just doubles damage dice.

When demand pressures any of these, extend this document and the engine
together — keep the spec and the code in lockstep.
