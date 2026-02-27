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

---

## Critical Problems

---

### C1 — DEF Calculation Mismatch
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

### C2 — Prestige Legendary Scaling Undefined
**Documents:** LEGENDARIES.md, MASTER_DESIGN.md, SCALING.md

`LEGENDARIES.md` states: "Some legendaries grow stronger with prestige." Individual legendary items reference prestige count directly (e.g., Heartless Chassis multiplies ATK by prestige count + 1). However, `SCALING.md` contains no formula for how legendary stat bonuses or unique effects compound after prestige. No rules exist for which legendaries scale, how much they scale, or at what prestige milestones changes occur. Implementation would be pure guesswork.

---

### C3 — CHA Stat Has Three Conflicting Descriptions
**Documents:** MASTER_DESIGN.md, ACHIEVEMENTS.md, GEAR_SETS.md

Three different documents describe high-CHA behavior differently:
- `MASTER_DESIGN.md` (line ~86): "CHA × 2% assist chance per turn"
- `MASTER_DESIGN.md` (line ~164): "CHA 50 unlocks 3× attack combo"
- `ACHIEVEMENTS.md` BOND_011: "Max CHA — companion assist fires every turn at full ATK"

These cannot all be simultaneously true. If CHA 50 already unlocks a guaranteed combo, the percentage formula is obsolete. If max CHA fires every turn at full ATK, the 3× combo description is redundant. The companion combat loop is undefined at high CHA values.

---

### C4 — Zone Level vs Character Level Formula Is Backwards
**Documents:** SCALING.md, ZONES.md

`SCALING.md` defines:
```js
function recommendedCharLevel(zoneLevel) {
  return Math.floor(zoneLevel * 1.8);
}
```

By this formula: Zone Level 400 → recommended character level 720.

`ZONES.md` Tier 10 assigns: Zone Level 321–400, Character Level requirement 161+.

These are completely incompatible. The formula would make Tier 10 zones require a character level nearly 4× higher than the zone itself specifies. Endgame zones would be mathematically unplayable.

---

### C5 — Loot Rarity Weights Don't Sum to 100% at High Zone Levels
**Documents:** SCALING.md

The `rarityWeights()` function adjusts weights based on zone level and LCK, but never renormalizes the result. At Zone Level 200 + LCK 100:

- zoneShift = 20, lckShift = 10, combined = 30
- common: 60 − 30 = 30
- uncommon: 25 (unchanged)
- rare: 10 + 27 = 37
- epic: 4 + 2.7 = 6.7
- legendary: 1 + 0.3 = 1.3
- **Total: ~108.7** (not 100)

Loot table probabilities are mathematically invalid at any zone level above ~50. Every loot roll at endgame produces incorrect results.

---

### C6 — Achievement Stat Bonuses Have No Cap
**Documents:** ACHIEVEMENTS.md, SCALING.md, MASTER_DESIGN.md

Multiple achievements award permanent stat bonuses:
- KILL_006: +30 LCK permanently
- LOOT_007: +20 LCK permanently
- EXPLORE_010: +50 to all stats
- PRESTIGE_006: +100 to all stats
- Completionist (SPECIAL): +100 to all stats

No maximum stat cap is defined anywhere in any document. A completionist player with high prestige would have stats in the thousands, breaking every formula in `SCALING.md` which assumes stats scale polynomially with zone level. Achievement bonuses are additive and completely unbounded.

---

## Major Problems

---

### M1 — Character-Agnostic Claim Contradicted by Zone Design
**Documents:** MASTER_DESIGN.md, ZONES.md

`MASTER_DESIGN.md` states the RPG system is "character-agnostic." However, entire zones in `ZONES.md` are built around the companion's subjective inner experience (e.g., The Reflection Realm — "inside the companion's subconscious"). These zones cannot exist without a specific companion personality, lore, and questline. A player running a different character pack would encounter zones with broken flavor, undefined dialogue, and missing content. The architectural claim and the zone design directly contradict each other.

---

### M2 — SPECIAL% Stat Budget Has No Implementation
**Documents:** ENEMIES.md, SCALING.md

`ENEMIES.md` defines 10 enemy archetypes, each allocating a percentage of the stat budget to `SPECIAL` (ranging from 5% for most archetypes to 25% for Summoner). `SCALING.md`'s `allocateStats()` function only distributes HP, ATK, DEF, and AGI. The SPECIAL budget is never converted into anything. 5–25% of every enemy's stat budget is silently discarded.

---

### M3 — Boss Special Abilities Lack Core Rules
**Documents:** ENEMIES.md, MASTER_DESIGN.md

`ENEMIES.md` lists 20 boss special abilities but defines none of the following:
- Whether abilities have cooldowns or can trigger repeatedly
- Whether stat debuffs (e.g., Curse: reduces highest stat by 30%) are permanent for the fight or fade
- Whether two active abilities can stack (e.g., Time Slow + Enrage simultaneously)
- Priority resolution when a boss Execute ability and a player survival ability (Iron Will) trigger on the same hit

Boss combat behavior is unpredictable and unimplementable without this ruleset.

---

### M4 — Gear Set Bonuses Have No Power Budget
**Documents:** GEAR_SETS.md

Set bonuses range from minor procs ("3× damage on dodge") to literal immortality ("HP minimum is 1 while all 6 pieces are equipped" — Zeroth Protocol) to explicit formula-breaking ("No stat caps. All scaling is infinite." — Recursive Throne). No power budget or balance guidelines exist. 1–2 sets completely dominate all viable builds, reducing meaningful choice to near zero.

---

### M5 — Legendary Acquisition Conditions Are Vague
**Documents:** LEGENDARIES.md

`LEGENDARIES.md` states "some legendaries can only drop if specific conditions are met" but does not specify those conditions for most items. Aria's Core says it "drops if companion bond is at max CHA" but doesn't define whether that means base CHA, gear-boosted CHA, or total CHA. The Ring of Everything has no tier restriction despite every other legendary having one. Without explicit conditions, these items are effectively unobtainable or unimplementable.

---

### M6 — Shiny Enemy Feedback Loop Breaks Loot Economy
**Documents:** MASTER_DESIGN.md, SCALING.md

Shiny enemies are 2–3× harder but reward 3–5× XP/gold and guarantee Rare+ drops. `SCALING.md` shows shiny spawn rate reaches ~1 in 84 encounters at LCK 100, and the loop compounds: more shinies → better Rare drops → higher gear stats → higher LCK → even more shinies. There is no soft cap, no diminishing return, and no shiny fatigue mechanic. At high LCK, endgame reduces entirely to shiny farming.

---

### M7 — Companion Assist Damage Has Three Different Formulas
**Documents:** MASTER_DESIGN.md, GEAR_SETS.md, LEGENDARIES.md

Three documents give three different formulas for companion assist damage:
1. `MASTER_DESIGN.md`: `floor(player.effectiveATK × 0.5 + CHA × 0.5)`
2. `GEAR_SETS.md` Synthetic Soul 4pc: "Companion's assists deal 250% of your ATK"
3. `LEGENDARIES.md` Aria's Core: "Companion assists deal full player ATK (not 50%)"

These are not multiplicative modifications to a shared base — they are three distinct formulas that cannot be reconciled without choosing one as canonical. Companion damage at any given point in the game is undefined.

---

### M8 — No HP Soft Cap for High-VIT Builds
**Documents:** MASTER_DESIGN.md, SCALING.md

`MASTER_DESIGN.md` defines: `maxHP = 40 + (VIT × 8)`. At endgame, gear can provide 500+ VIT (within `SCALING.md`'s defined stat ranges), producing HP values of 4,000+. No formula governs when HP/damage ratios stop being proportional. Combat numbers become astronomical and visually unintelligible. No HP ceiling is defined anywhere.

---

## Minor Problems

---

### m1 — Response Refresh Rules Undefined
**Documents:** RESPONSES.md

States that scenario response pools "refresh after 90 days" but defines no rules for: whether the clock is per-character or global, whether old responses are deleted or kept, and what happens if a player is inactive for more than 90 days before a refresh completes.

---

### m2 — Merchant Prices Never Defined
**Documents:** ZONES.md, GEAR_SETS.md, MASTER_DESIGN.md

`ZONES.md` mentions merchant encounters. `GEAR_SETS.md` includes a set bonus that reduces "shop prices by 10%." No base merchant price formula exists in any document. The shop feature cannot be implemented without one.

---

### m3 — Trap Damage Formula Missing
**Documents:** MASTER_DESIGN.md, ZONES.md

`MASTER_DESIGN.md` lists Trap as a valid room type. `ZONES.md` references traps in multiple zones. No damage formula exists: not a fixed amount, not zone-scaled, not stat-based. Traps are referenced but cannot be implemented.

---

### m4 — Rest Room Healing Has No Single Source of Truth
**Documents:** MASTER_DESIGN.md, ZONES.md

The base rest room healing amount (25% max HP) is defined in `MASTER_DESIGN.md`. `ZONES.md` then modifies it in multiple zone definitions (e.g., "double HP restore," "no rest rooms"). Implementations must aggregate rules from two documents with no clear precedence order.

---

### m5 — Secret Room Normal Behavior Undefined
**Documents:** ZONES.md, LEGENDARIES.md

The Architect's Keystone legendary creates a secret room with "guaranteed Epic+ loot and no enemies." This implies secret rooms normally exist — but no document defines how they spawn naturally, what they contain, or how common they are outside of the keystone interaction.

---

### m6 — Flee Mechanics Are Ambiguous
**Documents:** MASTER_DESIGN.md, ZONES.md

`MASTER_DESIGN.md` defines player flee: `50% + (player.AGI − enemy.AGI) × 3%`. `ZONES.md` (The Flophouse District) states enemies "sometimes flee rather than fight (5% per turn)." Neither document defines: whether both parties can attempt to flee on the same turn, who resolves first, or whether an enemy that flees counts as a kill.

---

### m7 — Scenario Key Naming Convention Is Inconsistent
**Documents:** MASTER_DESIGN.md, RESPONSES.md

`MASTER_DESIGN.md` uses colon-separated IPC-style keys (e.g., `rpg:zone-suggestion`). `RESPONSES.md` uses underscore-separated keys (e.g., `zone_suggestion_offer`, `zone_suggestion_accepted`, `zone_suggestion_declined`). Both conventions exist across documents with no standard established.

---

### m8 — Prestige Level Cap Undefined
**Documents:** MASTER_DESIGN.md, SCALING.md, ACHIEVEMENTS.md

No document defines a maximum prestige level. `SCALING.md` grants +5 to all stats per prestige. `ACHIEVEMENTS.md` implies prestige 10 is achievable. With no cap, prestige stat bonuses are unbounded and compound with the uncapped achievement bonuses in C6.

---

### m9 — "Aria's Core" Is Hardcoded in a Character-Agnostic System
**Documents:** LEGENDARIES.md

The legendary item "Aria's Core" is named after a specific character in a system explicitly designed to be character-agnostic. Players using a different character pack would find a legendary item referencing a character they have never installed.

---

### m10 — No Stat Respec Mechanic Defined
**Documents:** MASTER_DESIGN.md, SCALING.md

Stat point allocation is permanent with no respec option defined anywhere. A player who misallocates points across many levels or prestige runs has no recovery path. This is a UX gap that will generate significant player frustration.

---

## Implementation Concerns

---

### I1 — Visual Effects Complexity Is Underestimated
**Documents:** EFFECTS.md

`EFFECTS.md` claims all effects are achievable with "CSS/Canvas/DOM without external libraries." In reality, the described effects require:
- Lightning bolt animations → SVG or Canvas (not pure CSS)
- 30-particle systems animating independently → JavaScript particle pooling with `requestAnimationFrame`
- Screen noise filters → Pre-baked SVG filters or WebGL shaders
- Rotating gradient borders → Canvas or CSS `@property` (limited browser support in Electron)

The implementation effort is significantly higher than the document implies.

---

### I2 — Response Table Has No Performance Index
**Documents:** RESPONSES.md

The `rpg_responses` SQLite table uses sequential lookups by `scenario_key`. As the table grows (130 keys × 60+ responses = 7,800+ rows), unindexed queries will degrade. No index is defined in the schema.

---

### I3 — Level-Up Requires Multiple Separate IPC Calls
**Documents:** MASTER_DESIGN.md

The IPC surface lists individual operations (`rpg:take-action`, `rpg:allocate-stat`, etc.). A single level-up event requires: awarding XP, checking level threshold, allocating stat points, triggering a scenario response, and updating the UI — at minimum 5 separate round-trips. Under rapid progression (prestige runs), this creates significant IPC chatter with no batch operation defined.

---

### I4 — Companion Emotion Transitions Have No State Machine
**Documents:** MASTER_DESIGN.md, EFFECTS.md, ZONES.md

Emotion transition triggers are scattered across 4 documents with no unified state machine. Rules for decay back to neutral, emotion locking during combat, and priority resolution (what happens when two triggers fire simultaneously) are undefined. UI logic will need to reverse-engineer behavior from scattered hints.

---

### I5 — Stat Allocation Has No Respec Path
**Documents:** MASTER_DESIGN.md

Covered also as m10. From an implementation standpoint: no respec means no `undo` or `reset` IPC handler needs to be built, but a Respec Token item would require one. The decision needs to be made before implementation of the stat system begins.

---

## Scope Concerns

---

### S1 — 170+ Zones with Unique Mechanics Each
**Documents:** ZONES.md

Each of the 170+ zones defines a unique gameplay mechanic (e.g., "enemies can modify zone rules," "all attacks are reflected once," "traps are everywhere"). Implementing, testing, and balancing 170 unique mechanics is disproportionate complexity for an embedded minigame. Most zones will feel structurally identical in practice despite unique flavor text.

---

### S2 — 50+ Gear Sets Requiring 500+ Individual Items
**Documents:** GEAR_SETS.md

50+ sets at 4–6 pieces each equals approximately 250–300 unique set pieces. Each requires name generation, balance tuning, and drop table integration on top of the base gear system. Diminishing gameplay returns begin well before 50 sets.

---

### S3 — 130 Scenario Keys × 60 Responses = 7,800+ Dialogue Lines
**Documents:** RESPONSES.md

At 60 responses per key, the companion response system requires approximately 7,800 unique dialogue lines to be generated via Claude and reviewed for quality. Not all scenario keys justify 60 responses — high-frequency events need more variety than rare events. The current uniform count inflates the generation workload significantly.

---

### S4 — 132 Achievements
**Documents:** ACHIEVEMENTS.md

At 132 achievements, the majority become invisible filler that players never notice. Each requires an unlock condition, reward, icon, flavor text, and toast notification. The system provides diminishing engagement returns past approximately 40–50 well-designed achievements.

---

### S5 — Infinite Scaling Is Untestable as Designed
**Documents:** SCALING.md

"Infinite scaling" requires validation at zone levels 200, 500, 1000+ and prestige counts 10, 20, 50+. Without automated combat simulation tooling, balancing the power curves is guesswork. No soft cap or testing boundary is defined, meaning the system could be completely unbalanced at any level above what was manually tested.

---

*See SUGGESTED_FIXES.md for recommended resolutions to each item above.*
