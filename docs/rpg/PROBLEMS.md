# RPG Design — Known Problems

Last updated: 2026-02-27
Status: Design / Pre-Implementation

---

## Severity Legend

- **CRITICAL** — Breaks the game or is impossible to implement as written
- **MAJOR** — Significant design problem that will cause bugs or balance collapse
- **MINOR** — Small inconsistency or missing definition
- **IMPL** — Implementation concern (technically risky or underestimated)
- **SCOPE** — Feature bloat / disproportionate complexity

Status markers: `[OPEN]` `[FIXED]` `[PARTIAL]`

---

## Critical Problems

---

### C1 — DEF Calculation Mismatch `[OPEN]`
**Documents:** SCALING.md vs MASTER_DESIGN.md

`SCALING.md` defines:
```
effectiveDEF = floor(VIT / 2) + gear.totalDEFBonus + gear.totalVITBonus × 0.2
```

`MASTER_DESIGN.md` Section 5 states:
```
effectiveDEF = VIT/2 + armor.def + allEquippedBonuses
```

The `gear.totalVITBonus × 0.2` component exists in one doc and not the other. At endgame gear levels (1000+ stat values), this discrepancy causes DEF to explode unpredictably. There is no canonical formula.

---

### C2 — Prestige Legendary Scaling Undefined `[FIXED]`
**Documents:** LEGENDARIES.md, MASTER_DESIGN.md, SCALING.md

**Resolution:** Individual legendaries that previously scaled off prestige count have been rewritten. Heartless Chassis now has a fixed ATK tripling effect on Iron Will trigger (no prestige dependency). The Eternal Circuit now grants +2 all stats per completed run (not per prestige). No legendary unique effect references `prestige count` as a variable. The "Prestige and Legendaries" section in LEGENDARIES.md clarifies all gear is retained on prestige; legendaries that grow stronger do so through runs cleared and zones explored, not prestige level.

---

### C3 — CHA Stat Has Three Conflicting Descriptions `[OPEN]`
**Documents:** MASTER_DESIGN.md, ACHIEVEMENTS.md, GEAR_SETS.md

Three different documents describe high-CHA behavior differently:
- `MASTER_DESIGN.md` (line ~86): "CHA × 2% assist chance per turn"
- `MASTER_DESIGN.md` (line ~164): "CHA 50 unlocks 3× attack combo"
- `ACHIEVEMENTS.md` BOND_011: "Max CHA — companion assist fires every turn at full ATK"

These cannot all be simultaneously true. If CHA 50 already unlocks a guaranteed combo, the percentage formula is obsolete. If max CHA fires every turn at full ATK, the 3× combo description is redundant. The companion combat loop is undefined at high CHA values.

---

### C4 — Zone Level vs Character Level Formula Is Backwards `[FIXED]`
**Documents:** SCALING.md, ZONES.md

**Resolution:** SCALING.md now defines: `minCharLevel(zone) = floor(zone_level_min × 0.5)`. This yields a reference table (T1 zone 1–40 → char 1, T2 → char 20, ... T10 zone 361–400 → char 180) that is compatible with the character level cap of 200. The old `recommendedCharLevel(zoneLevel × 1.8)` function has been removed entirely.

---

### C5 — Loot Rarity Weights Don't Sum to 100% at High Zone Levels `[FIXED]`
**Documents:** SCALING.md

**Resolution:** SCALING.md now includes an explicit renormalization step in `rarityWeights()`:
```js
const total = w.common + w.uncommon + w.rare + w.epic + w.legendary;
// Divide each weight by total before using as probability
```
This ensures the distribution always sums to 1.0 regardless of zone level or LCK modifier.

---

### C6 — Achievement Stat Bonuses Have No Cap `[FIXED]`
**Documents:** ACHIEVEMENTS.md, SCALING.md, MASTER_DESIGN.md

**Resolution:** All 60 achievements in the rewritten ACHIEVEMENTS.md grant zero mechanical rewards. No achievement awards permanent stat bonuses. Achievements are purely cosmetic/tracking milestones. The unbounded stat accumulation problem is eliminated at the source.

---

## Major Problems

---

### M1 — Character-Agnostic Claim Contradicted by Zone Design `[OPEN]`
**Documents:** MASTER_DESIGN.md, ZONES.md

`MASTER_DESIGN.md` states the RPG system is "character-agnostic." However, entire zones in `ZONES.md` are built around the companion's subjective inner experience (e.g., The Reflection Realm — "inside the companion's subconscious"). These zones cannot exist without a specific companion personality, lore, and questline. A player running a different character pack would encounter zones with broken flavor, undefined dialogue, and missing content. The architectural claim and the zone design directly contradict each other.

---

### M2 — SPECIAL% Stat Budget Has No Implementation `[OPEN]`
**Documents:** ENEMIES.md, SCALING.md

`ENEMIES.md` defines 10 enemy archetypes, each allocating a percentage of the stat budget to `SPECIAL` (ranging from 5% for most archetypes to 25% for Summoner). `SCALING.md`'s `allocateStats()` function only distributes HP, ATK, DEF, and AGI. The SPECIAL budget is never converted into anything. 5–25% of every enemy's stat budget is silently discarded.

---

### M3 — Boss Special Abilities Lack Core Rules `[OPEN]`
**Documents:** ENEMIES.md, MASTER_DESIGN.md

`ENEMIES.md` lists 20 boss special abilities but defines none of the following:
- Whether abilities have cooldowns or can trigger repeatedly
- Whether stat debuffs (e.g., Curse: reduces highest stat by 30%) are permanent for the fight or fade
- Whether two active abilities can stack (e.g., Time Slow + Enrage simultaneously)
- Priority resolution when a boss Execute ability and a player survival ability (Iron Will) trigger on the same hit

Boss combat behavior is unpredictable and unimplementable without this ruleset.

---

### M4 — Gear Set Bonuses Have No Power Budget `[FIXED]`
**Documents:** GEAR_SETS.md

**Resolution:** GEAR_SETS.md has been rewritten. The "Zeroth Protocol" (HP minimum 1) and "Recursive Throne" (infinite scaling) sets that completely broke power budgets have been removed. 25 sets remain (15 Rare + 10 Epic, 5 [UNIQUE]). [UNIQUE] tag indicates sets with dominant power budgets (e.g., Last Stand) so implementors know they require special handling. All other sets have been reviewed for reasonable power envelopes.

---

### M5 — Legendary Acquisition Conditions Are Vague `[OPEN]`
**Documents:** LEGENDARIES.md

`LEGENDARIES.md` states "some legendaries can only drop if specific conditions are met" but does not specify those conditions for most items. Aria's Core says it "drops if companion bond is at max CHA" but doesn't define whether that means base CHA, gear-boosted CHA, or total CHA. The Ring of Everything has no tier restriction despite every other legendary having one. Without explicit conditions, these items are effectively unobtainable or unimplementable.

---

### M6 — Shiny Enemy Feedback Loop Breaks Loot Economy `[FIXED]`
**Documents:** MASTER_DESIGN.md, SCALING.md

**Resolution:** SCALING.md now defines a hard cap on shiny spawn chance:
```js
shinyChance = Math.min(1/100, 1/512 + lck × 0.0001)
```
Maximum shiny rate is 1% (at LCK ~82), regardless of further LCK gains. No fatigue mechanic needed — the hard cap prevents runaway shiny farming loops.

---

### M7 — Companion Assist Damage Has Three Different Formulas `[FIXED]`
**Documents:** MASTER_DESIGN.md, GEAR_SETS.md, LEGENDARIES.md

**Resolution:** CLAUDE.md (docs/rpg/CLAUDE.md) establishes the canonical companion assist formula:
```
floor(effectiveATK × baseMult × scalingMult)
```
- `baseMult` = 0.5 base, overridden to 1.0 by Aria's Core
- `scalingMult` = 1.0 base, set to 2.5 by Runebound Companion 4pc bonus
- All three prior conflicting formulas were expressions of this unified formula missing the other parameters. GEAR_SETS.md (Runebound Companion, formerly "Synthetic Soul") now references `scalingMult = 2.5`. LEGENDARIES.md (Aria's Core) now references `baseMult = 1.0`.

---

### M8 — No HP Soft Cap for High-VIT Builds `[FIXED]`
**Documents:** MASTER_DESIGN.md, SCALING.md

**Resolution:** SCALING.md now defines a VIT soft cap for HP:
```js
maxHP = 40 + Math.min(vit, 300) × 8 + Math.max(0, vit - 300) × 2
```
Beyond VIT 300, each additional VIT contributes only +2 HP instead of +8. This caps practical endgame HP at ~2,840 (VIT 300 = 2,440 HP; further gains slow dramatically).

---

## Minor Problems

---

### m1 — Response Refresh Rules Undefined `[FIXED]`
**Documents:** RESPONSES.md

**Resolution:** RESPONSES.md now defines wipe-to-regenerate policy: a pool is regenerated only when it reaches 0 entries. No auto-expiry timer. No incremental additions. The generation threshold is `pool_size = 0` (was "< 50"). Schema now includes `tier TEXT` and `target_count INTEGER` per key for the tiered system (~2,640 total responses vs old 7,800).

---

### m2 — Merchant Prices Never Defined `[FIXED]`
**Documents:** ZONES.md, GEAR_SETS.md, MASTER_DESIGN.md

**Resolution:** SCALING.md now defines merchant price formulas:
- Buy: `floor(zoneLevel × rarity_base × (1.5 − haggle))` where rarity_base is 1/2/4/8/20 for Common through Legendary
- Sell: 40% of base buy value
- LCK reduces markup by up to 25% (haggle factor)

---

### m3 — Trap Damage Formula Missing `[FIXED]`
**Documents:** MASTER_DESIGN.md, ZONES.md

**Resolution:** SCALING.md now defines: `trapDamage = max(1, floor(zoneLevel × 3) − floor(DEF × 0.5))`

---

### m4 — Rest Room Healing Has No Single Source of Truth `[OPEN]`
**Documents:** MASTER_DESIGN.md, ZONES.md

The base rest room healing amount (25% max HP) is defined in `MASTER_DESIGN.md`. `ZONES.md` then modifies it in multiple zone definitions (e.g., "double HP restore," "no rest rooms"). Implementations must aggregate rules from two documents with no clear precedence order.

---

### m5 — Secret Room Normal Behavior Undefined `[OPEN]`
**Documents:** ZONES.md, LEGENDARIES.md

The Architect's Keystone legendary creates a secret room with "guaranteed Epic+ loot and no enemies." This implies secret rooms normally exist — but no document defines how they spawn naturally, what they contain, or how common they are outside of the keystone interaction.

---

### m6 — Flee Mechanics Are Ambiguous `[OPEN]`
**Documents:** MASTER_DESIGN.md, ZONES.md

`MASTER_DESIGN.md` defines player flee: `50% + (player.AGI − enemy.AGI) × 3%`. `ZONES.md` (The Flophouse District) states enemies "sometimes flee rather than fight (5% per turn)." Neither document defines: whether both parties can attempt to flee on the same turn, who resolves first, or whether an enemy that flees counts as a kill.

---

### m7 — Scenario Key Naming Convention Is Inconsistent `[OPEN]`
**Documents:** MASTER_DESIGN.md, RESPONSES.md

`MASTER_DESIGN.md` uses colon-separated IPC-style keys (e.g., `rpg:zone-suggestion`). `RESPONSES.md` uses underscore-separated keys (e.g., `zone_suggestion_offer`, `zone_suggestion_accepted`, `zone_suggestion_declined`). Both conventions exist across documents with no standard established.

---

### m8 — Prestige Level Cap Undefined `[FIXED]`
**Documents:** MASTER_DESIGN.md, SCALING.md, ACHIEVEMENTS.md

**Resolution:** Prestige is now a counter only with no mechanical bonuses (no +5 all stats per prestige). SCALING.md (Scope S5 / Tested Range) defines the practical range as prestige 0–20. Beyond prestige 20 is "BEYOND ENDGAME" — supported but untested. Achievements that referenced prestige 10+ have been rewritten as count-based milestones.

---

### m9 — "Aria's Core" Is Hardcoded in a Character-Agnostic System `[OPEN]`
**Documents:** LEGENDARIES.md

The legendary item "Aria's Core" is named after a specific character in a system explicitly designed to be character-agnostic. Players using a different character pack would find a legendary item referencing a character they have never installed.

---

### m10 — No Stat Respec Mechanic Defined `[FIXED]`
**Documents:** MASTER_DESIGN.md, SCALING.md

**Resolution:** Prestige now grants a full stat reallocation — all stat points are refunded at prestige, allowing the player to reallocate their entire stat budget. This is the only respec mechanism. No mid-run respec is defined.

---

## Implementation Concerns

---

### I1 — Visual Effects Complexity Is Underestimated `[OPEN]`
**Documents:** EFFECTS.md

`EFFECTS.md` claims all effects are achievable with "CSS/Canvas/DOM without external libraries." In reality, the described effects require:
- Lightning bolt animations → SVG or Canvas (not pure CSS)
- 30-particle systems animating independently → JavaScript particle pooling with `requestAnimationFrame`
- Screen noise filters → Pre-baked SVG filters or WebGL shaders
- Rotating gradient borders → Canvas or CSS `@property` (limited browser support in Electron)

The implementation effort is significantly higher than the document implies.

---

### I2 — Response Table Has No Performance Index `[OPEN]`
**Documents:** RESPONSES.md

The `rpg_responses` SQLite table uses sequential lookups by `scenario_key`. With ~2,640 rows (down from 7,800), performance is less critical but the issue remains: no index is defined in the schema.

---

### I3 — Level-Up Requires Multiple Separate IPC Calls `[OPEN]`
**Documents:** MASTER_DESIGN.md

The IPC surface lists individual operations (`rpg:take-action`, `rpg:allocate-stat`, etc.). A single level-up event requires: awarding XP, checking level threshold, allocating stat points, triggering a scenario response, and updating the UI — at minimum 5 separate round-trips. Under rapid progression (prestige runs), this creates significant IPC chatter with no batch operation defined.

---

### I4 — Companion Emotion Transitions Have No State Machine `[OPEN]`
**Documents:** MASTER_DESIGN.md, EFFECTS.md, ZONES.md

Emotion transition triggers are scattered across 4 documents with no unified state machine. Rules for decay back to neutral, emotion locking during combat, and priority resolution (what happens when two triggers fire simultaneously) are undefined. UI logic will need to reverse-engineer behavior from scattered hints.

---

### I5 — Stat Allocation Has No Respec Path `[FIXED]`
**Documents:** MASTER_DESIGN.md

**Resolution:** See m10. Prestige now grants full stat reallocation. No Respec Token item is needed.

---

## Scope Concerns

---

### S1 — 170+ Zones with Unique Mechanics Each `[PARTIAL]`
**Documents:** ZONES.md

**Partial Resolution:** ZONES.md has been rewritten to define 70 zones across 10 tiers (plus special/challenge/questline zones), down from 170+. Additionally, `UNIQUE_ZONE_MECHANICS.md` defines 31 named zone mechanics with implementation notes and full IDs — these are shared mechanic templates that multiple zones reference, rather than 70 unique implementations. This substantially reduces implementation scope while maintaining design variety.

**Still Open:** The 31 named mechanics still represent significant per-mechanic implementation work. "Partially fixed" because the zone count and mechanic count are now reasonable, not because implementation effort is eliminated.

---

### S2 — 50+ Gear Sets Requiring 500+ Individual Items `[FIXED]`
**Documents:** GEAR_SETS.md

**Resolution:** GEAR_SETS.md now defines 25 named sets (15 Rare + 10 Epic, 5 [UNIQUE]), down from 50+. At 4–6 pieces each, this yields ~100–150 set pieces — a manageable scope for a minigame addon.

---

### S3 — 130 Scenario Keys × 60 Responses = 7,800+ Dialogue Lines `[FIXED]`
**Documents:** RESPONSES.md

**Resolution:** RESPONSES.md now uses a tiered system:
- HIGH (40 responses): 29 keys → 1,160 responses
- MED (20 responses): 52 keys → 1,040 responses
- LOW (10 responses): 44 keys → 440 responses
- **Total: ~2,640** (down from 7,800)

---

### S4 — 132 Achievements `[FIXED]`
**Documents:** ACHIEVEMENTS.md

**Resolution:** ACHIEVEMENTS.md has been rewritten with exactly 60 achievements (20 Easy / 20 Mid / 20 Hard). All grant zero mechanical rewards (cosmetic/tracking only). This is well within the 40–50 well-designed achievement target.

---

### S5 — Infinite Scaling Is Untestable as Designed `[PARTIAL]`
**Documents:** SCALING.md

**Partial Resolution:** SCALING.md now defines a Tested Range (Scope S5):
- Zone: 1–400 (tested), 401+ (BEYOND ENDGAME — supported, untested)
- Character: 1–200 (tested), 201+ (BEYOND ENDGAME)
- Prestige: 0–20 (tested), 21+ (BEYOND ENDGAME)

**Still Open:** Automated combat simulation tooling to validate the range has not been designed. Manual testing of the full 1–400 zone range remains a significant effort.

---

*See SUGGESTED_FIXES.md for implementation strategies.*
