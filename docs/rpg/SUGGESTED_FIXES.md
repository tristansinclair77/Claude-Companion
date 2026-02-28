# RPG Design — Suggested Fixes

Last updated: 2026-02-27
Status: Updated per user design decisions. Items marked [USER DECISION] reflect explicit choices.

Each fix references its corresponding problem in PROBLEMS.md.

---

## Critical Fixes

---

### Fix C1 — Adopt SCALING.md as the Canonical DEF Formula

**Adopt SCALING.md as the single source of truth. Update MASTER_DESIGN.md to match:**

```
effectiveDEF = floor(VIT / 2) + gear.totalDEFBonus + gear.totalVITBonus × 0.2
```

The VIT-to-DEF contribution is intentional and creates meaningful build diversity.

Add note to MASTER_DESIGN.md:
> *VIT bonuses from gear contribute 20% of their value to effectiveDEF. VIT gear is more efficient than DEF-specific gear, making it a meaningful trade-off.*

**Document to update:** MASTER_DESIGN.md Section 5.

---

### Fix C2 — Legendaries Do NOT Scale with Prestige

**[USER DECISION]** Prestige legendary scaling is removed entirely.

> Legendary items have **fixed** stats and **fixed** unique effects forever. They do not change with prestige count. They survive prestige (kept through reset). That is the only prestige interaction.

- Remove any prestige-scaling language from LEGENDARIES.md
- Rewrite any legendary effects that referenced prestige count to be static
- No `[PRESTIGE-SCALING]` tags or `Prestige Tiers:` fields anywhere

**Document to update:** LEGENDARIES.md (remove all prestige references from item entries).

---

### Fix C3 — Create a Canonical CHA Table in MASTER_DESIGN.md

**Replace all scattered CHA descriptions with a single table:**

| CHA Range | Effect |
|-----------|--------|
| 0–9 | No companion assists |
| 10–24 | `CHA × 2%` chance of assist per player turn |
| 25–49 | Guaranteed 1 assist at the start of each fight |
| 50 | Guaranteed 1 assist per player turn (at 50% ATK) |
| 75+ (gear-boosted only) | Assist fires twice per player turn |

- Remove the "CHA 50 unlocks 3× attack combo" line from MASTER_DESIGN.md
- Update ACHIEVEMENTS.md: "Reach CHA 75 (gear-boosted) — companion assist fires twice per turn"
- All GEAR_SETS.md and LEGENDARIES.md entries modifying assist behavior must specify `baseMult` or `scalingMult` (see Fix M7)

**Documents to update:** MASTER_DESIGN.md, ACHIEVEMENTS.md, relevant gear/legendary entries.

---

### Fix C4 — Correct the Zone/Character Level Formula

**Replace the broken formula in SCALING.md:**

```js
function recommendedCharLevel(zoneLevel) {
  return Math.floor(zoneLevel * 0.5);
}
// Zone 10  → recommended char level 5
// Zone 200 → recommended char level 100
// Zone 400 → recommended char level 200
```

**Add a reference table to MASTER_DESIGN.md:**

| Tier | Zone Level | Recommended Char Level |
|------|-----------|------------------------|
| T1 | 1–10 | 1–5 |
| T2 | 11–25 | 5–12 |
| T3 | 26–50 | 13–25 |
| T4 | 51–80 | 25–40 |
| T5 | 81–120 | 40–60 |
| T6 | 121–160 | 60–80 |
| T7 | 161–200 | 80–100 |
| T8 | 201–250 | 100–125 |
| T9 | 251–320 | 125–160 |
| T10 | 321–400 | 160–200 |

**Documents to update:** SCALING.md (formula), MASTER_DESIGN.md (reference table).

---

### Fix C5 — Add Renormalization to rarityWeights()

**After all adjustments, normalize so weights always sum to 100:**

```js
function rarityWeights(zoneLevel, lck) {
  // ... existing adjustment logic ...

  // Renormalize — MANDATORY, never remove this step
  const total = weights.common + weights.uncommon + weights.rare + weights.epic + weights.legendary;
  for (const key in weights) {
    weights[key] = (weights[key] / total) * 100;
  }
  return weights;
}
```

Add note to SCALING.md:
> *Any future modification to rarityWeights() must preserve the renormalization step.*

**Document to update:** SCALING.md.

---

### Fix C6 — Remove Achievement Stat Bonuses Entirely

**[USER DECISION]** Achievement stat bonuses are removed. No global stat cap is needed.

> Achievements grant **zero** mechanical rewards. No stats, no gold, no items, no bonuses.
> Achievements are purely completionist — they are locked/unlocked states only.

- Remove all `Reward:` fields from every achievement in ACHIEVEMENTS.md
- Remove all "+X to stat permanently" language

**Document to update:** ACHIEVEMENTS.md (remove all reward fields).

---

## Major Fixes

---

### Fix M1 — Make Companion Zones Conditionally Character-Driven

Zones flagged `[COMPANION-ZONE]` are only available if the character pack includes `questline.json`. If absent, replaced by a generic zone of the same tier. Flavor text is pulled from `questline.json` at runtime — mechanics are static.

**Documents to update:** MASTER_DESIGN.md, ZONES.md (flag companion zones).

---

### Fix M2 — Define What SPECIAL% Budget Converts To

SPECIAL budget converts to ability slots, not a combat stat:

| SPECIAL Budget | Ability Slots |
|----------------|---------------|
| 0.05 (5%) | 1 slot — minor passive |
| 0.15 (15%) | 2 slots — mini-elite behavior |
| 0.25 (25%) | 3 slots — Summoner core ability |

**Document to update:** ENEMIES.md (new SPECIAL Budget Conversion section).

---

### Fix M3 — Add Universal Boss Ability Rules

Add to ENEMIES.md before the ability list:

> - **Trigger:** Once per fight unless "per turn" is specified
> - **Duration:** Stat debuffs last until fight end unless "X turns" stated
> - **Stacking:** Max 2 active abilities; third replaces oldest
> - **Priority:** Player survival effects resolve before boss execute effects (player survives at 1 HP)
> - **Cooldown:** 3 turns after any ability fires before it can fire again
> - **Enrage:** Triggers once at HP threshold; does not re-trigger if HP rises above threshold

**Document to update:** ENEMIES.md.

---

### Fix M4 — Set Power Budget + Fix Broken Sets

**[USER DECISION]** Most set bonuses use a generic pool. A handful are tagged `[UNIQUE]`.

**Generic bonus pool includes:** stat boosts, lifesteal, multi-hit chance, crit chance, dodge bonus, armor penetration, HP regen, gold find, XP bonus, companion assist frequency.

**Hard rules for 6-piece bonuses:**
- No literal invincibility or permanent immunity
- No formula-breaking effects
- Must include a meaningful trade-off

**Fix Zeroth Protocol 6-piece:**
> "Once per floor, when you would reach 0 HP, survive at 1 HP and gain 60% damage reduction for 3 turns. Cannot activate again until you exit and re-enter a zone."

**Fix Recursive Throne 6-piece:**
> "Each floor cleared this run grants +2% to all stats (max 100 stacks, resets on run end). At max stacks, all attacks deal bonus true damage equal to 10% of enemy max HP."

**Document to update:** GEAR_SETS.md.

---

### Fix M5 — Specify Legendary Acquisition Conditions

Add to MASTER_DESIGN.md:
> *"Max CHA" always means base CHA (stat points allocated), not gear-boosted. Base max CHA = 50.*

For each conditional legendary in LEGENDARIES.md, add an explicit `Condition:` field.

**Documents to update:** MASTER_DESIGN.md, LEGENDARIES.md.

---

### Fix M6 — Shiny Spawn Hard Cap

**[USER DECISION — simplified]** Hard cap only. No shiny fatigue mechanic.

```js
shinyChance = min(1/100, 1/512 + lck * 0.0001)
// Maximum 1% regardless of LCK
```

**Document to update:** SCALING.md.

---

### Fix M7 — One Canonical Companion Assist Formula

```
companionAssistDamage = floor(effectiveATK × baseMult × scalingMult)

baseMult default:    0.5
scalingMult default: 1.0

[Character]'s Core: sets baseMult = 1.0 (replaces default)
Synthetic Soul 4pc:  sets scalingMult = 2.5

Results: Default=50% ATK, Core only=100%, Soul only=125%, Both=250%
```

**Documents to update:** MASTER_DESIGN.md, GEAR_SETS.md, LEGENDARIES.md.

---

### Fix M8 — VIT/HP Soft Cap

```
maxHP = 40 + min(VIT, 300) × 8 + max(0, VIT − 300) × 2
```

Past 300 VIT: each point gives only 2 HP instead of 8. Max HP at 999 VIT = 3,838.

**Documents to update:** MASTER_DESIGN.md, SCALING.md.

---

## Minor Fixes

---

### Fix m1 — Response Pools: Wipe-to-Regenerate

**[USER DECISION]** No 90-day refresh. No auto-expiry.

> Pools are generated once and stored permanently. To get fresh responses: wipe the table for that scenario key. The next trigger auto-regenerates. Soft cap: 200 responses per key.

**Document to update:** RESPONSES.md.

---

### Fix m2 — Merchant Prices

```js
function merchantPrice(item, zoneLevel) {
  const rarityMult = { common: 1, uncommon: 2.5, rare: 6, epic: 15, legendary: 50 };
  return Math.floor(item.totalStatValue * zoneLevel * rarityMult[item.rarity] * 0.1);
}
// Sell price = 25% of buy price
```

**Document to update:** SCALING.md.

---

### Fix m3 — Trap Damage

```js
function trapDamage(zoneLevel) {
  return Math.floor(zoneLevel * 1.5);
}
// True damage. AGI 50+ grants 30% dodge chance.
```

**Document to update:** SCALING.md.

---

### Fix m4 — Rest Room: MASTER_DESIGN.md as Source of Truth

Base healing: 25% max HP. ZONES.md notes deviations only.

**Document to update:** MASTER_DESIGN.md.

---

### Fix m5 — Secret Room Behavior

> Spawn: 3% per non-boss floor. Contents: 2–4 items at one rarity above zone average. No enemies. No traps. Looks like an empty room.

**Document to update:** MASTER_DESIGN.md.

---

### Fix m6 — Flee Priority

> 1. Player flee resolves first.
> 2. Success: combat ends, no loot, no XP, no kill credit.
> 3. Failure: enemy flee resolves.
> 4. Enemy flee: no kill credit, no loot.

**Document to update:** MASTER_DESIGN.md.

---

### Fix m7 — Standardize Scenario Key Naming

`snake_case` throughout. IPC event names (`rpg:take-action`) are a separate namespace.

**Document to update:** MASTER_DESIGN.md.

---

### Fix m8 — Prestige: Counter Only, No Cap, No Rewards

**[USER DECISION]**

> Prestige resets: level, gear, gold, stat allocations.
> Prestige keeps: legendary items, prestige count, achievements.
> Prestige grants: stat point reallocation (all points returned).
> Prestige rewards: nothing.
> Prestige cap: none (it's just a counter).

Remove prestige bonus formulas (`prestigeStartingBonuses()`) from SCALING.md.

**Documents to update:** MASTER_DESIGN.md, SCALING.md.

---

### Fix m9 — Character-Named Legendaries Use Runtime Name

Item named after a specific character → use `[CHARACTER]` placeholder internally.
Display name generated from `character.json` name field at runtime.
Internal DB ID never changes.

**Documents to update:** LEGENDARIES.md, MASTER_DESIGN.md.

---

### Fix m10 — Stat Respec via Prestige

**[USER DECISION]** No Respec Token item. Prestige is the respec mechanism.

> On prestige: all allocated stat points return to pool. Player reallocates freely before next run.

**Document to update:** MASTER_DESIGN.md (remove Respec Token; add prestige respec note).

---

## Implementation Fixes

---

### Fix I1 — Visual Effects: Deferred to Final Phase

**[USER DECISION]** No effects until the game is otherwise complete.

> All visual effects are Phase 9 (final). Implement one at a time, with manual review each time.
> If an effect is too complex: replace with a simpler alternative or skip it.
> Do not build an effects framework until Phase 8 is done.

---

### Fix I2 — Add Index to rpg_responses Table

```sql
CREATE INDEX idx_rpg_responses_scenario ON rpg_responses(scenario_key, use_count);
```

**Document to update:** RESPONSES.md (schema section).

---

### Fix I3 — Local-First Architecture

**[USER DECISION]** The IPC call volume concern is largely resolved because game logic is local.

> All combat math, loot generation, XP, stat checks, and zone logic run locally in the addon.
> Claude API calls: only for response pool generation (once per key) and force-Claude moments.
> Batch IPC handlers (`rpg:level-up-bundle`, `rpg:run-end-bundle`) reduce round-trips for multi-step events.

---

### Fix I4 — Companion Emotion State Machine

Define in MASTER_DESIGN.md:

| Trigger | Emotion | Duration |
|---------|---------|----------|
| Combat start | `determined` | Until combat ends |
| Player kills enemy | `happy` | 3s, then previous |
| Player takes >30% HP in one hit | `concerned` | 5s |
| Boss fight | `determined` | Until boss dies or player dies |
| Boss killed | `laughing` → `happy` → `neutral` | 5s / 5s |
| Player HP < 20% | `concerned` | Until HP > 20% |
| Player HP = 1 | `shocked` | Until HP changes |
| Player dies | `crying` | 8s, then `neutral` |
| Legendary drop | `surprised` → `happy` | 3s each |
| Level up | `happy` | 4s |
| Idle > 30s | `neutral` | Until next trigger |
| Companion assist | `smug` | 2s, then previous |

**Priority (highest wins):** `crying` > `shocked` > `concerned` > `laughing` > `surprised` > `determined` > `happy` > `smug` > `neutral`

---

## Scope Decisions

---

### Scope S1 — Zone Mechanics: Shared Pool Document

**[USER DECISION]**

> Create `UNIQUE_ZONE_MECHANICS.md` with ~20–30 named mechanics.
> Zones optionally reference one mechanic by ID.
> Many zones have no mechanic. That is fine.
> Mechanics are reused across zones within the same tier.

---

### Scope S2 — Gear Sets: ~25 Total, Fantasy Theme

> Target: ~25 sets (15 Rare, 10 Epic).
> Generic bonus pool + ~5 sets with `[UNIQUE]` tagged effects.
> All set and piece names use fantasy adventure language.

---

### Scope S3 — Response Counts: Tiered + Wipe-to-Regenerate

**[USER DECISION]**

| Frequency Tier | Keys | Responses per Key | Total |
|---------------|------|-------------------|-------|
| Very high | 10 | 80 | 800 |
| High | 20 | 50 | 1,000 |
| Medium | 20 | 30 | 600 |
| Low | 10 | 20 | 200 |
| Force-Claude (real-time) | 9 | — | — |

**Total stored: ~2,600 lines.** Generated once. Wipe to refresh. No auto-expiry.

---

### Scope S4 — Achievements: 3 Brackets, ~60, No Rewards

**[USER DECISION]**

| Bracket | Count |
|---------|-------|
| Easy | ~20 |
| Mid | ~20 |
| Hard | ~20 |

Count-based achievements use escalating thresholds: 100 → 500 → 1,000 → 5,000 → 10,000 → 25,000 → 50,000 → 100,000.
No rewards on any achievement.

---

### Scope S5 — Define Tested Scaling Range

Add to SCALING.md:

> **Tested Range:** Zone 1–400, Character 1–200, Prestige 0–20.
> Beyond this range: formulas still function but balance is not guaranteed.
> A "BEYOND ENDGAME" indicator activates past prestige 20 or zone 400.

---

*See PROBLEMS.md for full problem descriptions.*
*See docs/rpg/CLAUDE.md for canonical rules that supersede any fix listed here.*
