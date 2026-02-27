# RPG Design — Suggested Fixes

Last updated: 2026-02-27
Status: Design / Pre-Implementation

Each fix references its corresponding problem in PROBLEMS.md.

---

## Critical Fixes

---

### Fix C1 — Adopt SCALING.md as the Canonical DEF Formula

**Adopt SCALING.md as the single source of truth. Update MASTER_DESIGN.md to match:**

```
effectiveDEF = floor(VIT / 2) + gear.totalDEFBonus + gear.totalVITBonus × 0.2
```

The VIT-to-DEF contribution is intentional and creates meaningful build diversity — VIT gear has dual value (HP and defense). The discrepancy is a documentation error, not a design error. Add a note in MASTER_DESIGN.md:

> *VIT bonuses from gear contribute 20% of their value to effectiveDEF. This is intentional: VIT gear is more efficient than DEF-specific gear, making it a meaningful trade-off choice.*

**Document to update:** MASTER_DESIGN.md Section 5 (combat formulas).

---

### Fix C2 — Define Prestige Legendary Scaling in SCALING.md

**Add a dedicated section to SCALING.md:**

> **Legendary Prestige Scaling**
> - All legendaries: base stats gain +5% per prestige level (multiplicative with the base, additive stacks).
>   - Example: a legendary with +100 STR at prestige 3 provides +115 STR.
> - Legendaries tagged `[PRESTIGE-SCALING]` in LEGENDARIES.md additionally enhance their Unique Effect at prestige milestones 3, 7, and 15.
> - Enhancement tiers are defined per-item in LEGENDARIES.md using a `Prestige Tiers:` field.

**Add `[PRESTIGE-SCALING]` tags and `Prestige Tiers:` entries to applicable legendaries in LEGENDARIES.md** (Heartless Chassis, Memory Palace, The Architect's Chassis, Zero Loop, and any others that reference prestige in their text).

**Documents to update:** SCALING.md (new section), LEGENDARIES.md (tags + prestige tier entries per applicable item).

---

### Fix C3 — Create a Canonical CHA Table in MASTER_DESIGN.md

**Replace all scattered CHA descriptions with a single table in MASTER_DESIGN.md:**

| CHA Range | Effect |
|-----------|--------|
| 0–9 | No companion assists |
| 10–24 | `CHA × 2%` chance of assist per player turn |
| 25–49 | Guaranteed 1 assist at the start of each fight |
| 50 | Guaranteed 1 assist per player turn (at 50% ATK) |
| 75+ (gear-boosted only) | Assist fires twice per player turn |

**Additionally:**
- Remove the "CHA 50 unlocks 3× attack combo" line from MASTER_DESIGN.md — this conflicts with the table and should not exist.
- Fix ACHIEVEMENTS.md BOND_011 to read: "Reach CHA 75 (gear-boosted) — companion assist fires twice per turn."
- All GEAR_SETS.md and LEGENDARIES.md entries that modify assist behavior must specify whether they modify `baseMult` or fire additional instances (see Fix M7).

**Documents to update:** MASTER_DESIGN.md (table, remove combo line), ACHIEVEMENTS.md (BOND_011), any sets/legendaries that reference CHA assist behavior.

---

### Fix C4 — Correct the Zone/Character Level Formula in SCALING.md

**The formula multiplier is wrong. Replace with:**

```js
function recommendedCharLevel(zoneLevel) {
  return Math.floor(zoneLevel * 0.5);
}
// Zone 10  → recommended char level 5
// Zone 200 → recommended char level 100
// Zone 400 → recommended char level 200
```

This aligns with ZONES.md's Tier 10 requiring Character Level 161+, and makes endgame zones reachable by max-level characters.

**Also add a companion display table to MASTER_DESIGN.md:**

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

**After all adjustments, normalize so weights always sum to 100. Add this final step:**

```js
function rarityWeights(zoneLevel, lck) {
  // ... existing adjustment logic ...

  // Renormalize
  const total = weights.common + weights.uncommon + weights.rare + weights.epic + weights.legendary;
  for (const key in weights) {
    weights[key] = (weights[key] / total) * 100;
  }
  return weights;
}
```

**Add a note in SCALING.md:**
> *Any future modification to rarityWeights() must preserve the renormalization step. Weights that do not sum to 100 produce invalid probability distributions.*

**Document to update:** SCALING.md (rarityWeights function definition).

---

### Fix C6 — Define a Global Stat Cap

**Add to both MASTER_DESIGN.md and SCALING.md:**

> **Global Stat Cap: 999 per stat**
> No single stat (STR, INT, AGI, VIT, LCK, CHA) may exceed 999 from any source combined (base allocation + gear + achievement bonuses). Gear stats are already capped per-slot by zone-level ranges. The 999 cap applies to the final summed value after all sources.
>
> Achievement rewards that would push a stat beyond 999 are silently clamped — the achievement still unlocks and its other rewards (titles, etc.) are granted normally.
>
> The 999 cap is visible to the player in the stat screen (e.g., stat displays as "999 (MAX)" when capped).

**Documents to update:** MASTER_DESIGN.md (stats section), SCALING.md (add cap to relevant formulas).

---

## Major Fixes

---

### Fix M1 — Make Companion Zones Dynamically Character-Driven

**Do not remove companion-themed zones — they are good content. Instead, document them as conditional:**

Add to MASTER_DESIGN.md:

> **Character-Specific Zones**
> Zones flagged `[COMPANION-ZONE]` in ZONES.md are only available if the installed character pack includes a `questline.json` file. If no questline is present, these zones are replaced by generic equivalents from the same tier.
>
> All flavor text, enemy dialogue, and zone descriptions for companion zones are pulled from `questline.json` at runtime — nothing is hardcoded. The zone mechanics themselves are static; only the narrative layer changes per character.

**Add `[COMPANION-ZONE]` tags to applicable zones in ZONES.md.** Add a brief `questline.json` schema definition to MASTER_DESIGN.md.

**Documents to update:** MASTER_DESIGN.md (conditional zone system), ZONES.md (flag companion zones).

---

### Fix M2 — Define What SPECIAL% Budget Converts To

**Add a section to ENEMIES.md:**

> **SPECIAL Budget Conversion**
> The SPECIAL percentage in each archetype's budget does not translate to a combat stat. Instead, it grants ability slots:
>
> | SPECIAL Budget | Ability Slots |
> |----------------|---------------|
> | 0.05 (5%) | 1 ability slot |
> | 0.15 (15%) | 2 ability slots |
> | 0.25 (25%) | 3 ability slots |
>
> Ability slots are filled from the enemy's archetype ability pool (defined per archetype in ENEMIES.md). Non-boss enemies with 1 slot get a minor passive. Non-boss enemies with 2+ slots are treated as mini-elites.
>
> Summoner archetype's 0.25 SPECIAL specifically enables the Summon ability (spawn 1 minion per turn; minion has 10% of parent's HP and ATK). This is the only archetype where SPECIAL dictates the core combat loop.

**Documents to update:** ENEMIES.md (new SPECIAL Budget Conversion section).

---

### Fix M3 — Add Universal Boss Ability Rules to ENEMIES.md

**Add a "Boss Ability Rules" section to ENEMIES.md immediately before the ability list:**

> **Boss Ability Universal Rules**
>
> - **Trigger frequency:** All abilities trigger once per fight unless the ability description explicitly states "per turn" or "repeating."
> - **Duration:** All stat debuffs (Curse, Sap, etc.) last until end of fight unless "X turns" is specified in the ability description.
> - **Stacking:** Maximum 2 abilities may be active on a boss simultaneously. If a third would trigger, it replaces the oldest active ability.
> - **Priority:** Player survival effects (Iron Will, Last Stand, death prevention from gear) always resolve before boss execute/kill effects. If both trigger on the same hit, the player survives at 1 HP and the boss execute does not fire.
> - **Cooldowns:** After an ability triggers, it cannot trigger again for 3 turns (applies even to once-per-fight abilities that have a cooldown clause).
> - **Boss phases:** Some abilities list "Enrage at 50% HP." Enrage triggers once when the threshold is crossed. It does not trigger again if HP somehow rises back above 50%.

**Documents to update:** ENEMIES.md (new section before ability list).

---

### Fix M4 — Add a Set Power Budget to GEAR_SETS.md + Fix Broken Sets

**Add a power budget guide to the top of GEAR_SETS.md:**

> **Set Bonus Power Budget**
>
> | Bonus Tier | Design Rule |
> |------------|-------------|
> | 2-Piece | Minor passive: stat boost, small proc, or quality-of-life effect |
> | 4-Piece | Major passive: strong combat proc, significant build enabler, or meaningful scaling |
> | 6-Piece | Signature effect: build-defining, unique mechanic — but must include a meaningful trade-off |
>
> **Hard rules for 6-piece bonuses:**
> - Cannot grant literal invincibility or permanent immunity
> - Cannot remove or override the global stat cap (999)
> - Cannot disable the game's core scaling formulas
> - Must have a trade-off (cooldown, condition, cost, or limitation)

**Fix the two explicitly broken sets:**

*Zeroth Protocol 6-piece — change from:*
> "You cannot die while all 6 pieces are equipped. HP minimum is 1."

*To:*
> "Once per floor, when you would be reduced to 0 HP, instead survive at 1 HP and gain 60% damage reduction for 3 turns. After triggering, this effect cannot activate again until you exit and re-enter a zone."

*Recursive Throne 6-piece — change from:*
> "No stat caps. All scaling is infinite."

*To:*
> "Each floor cleared this run grants +2% to all stats (max 100 stacks, resets on run end). At max stacks, all attacks deal bonus true damage equal to 10% of enemy max HP."

**Documents to update:** GEAR_SETS.md (power budget section, Zeroth Protocol entry, Recursive Throne entry).

---

### Fix M5 — Specify All Legendary Acquisition Conditions Explicitly

**Add a `Condition:` field to every conditional legendary. Standardize the definition of "max CHA":**

Add to MASTER_DESIGN.md:
> *"Max CHA" in legendary and achievement conditions always refers to base CHA (stat points allocated by the player), not gear-boosted CHA. Base max CHA = 50 (reached at level 100 if all points go to CHA).*

**Apply to specific legendaries in LEGENDARIES.md:**
- **[Character]'s Core:** `Condition: Base CHA must be at 50 (maximum). Drops from T8–T10 zone bosses only (not standard mob drops).`
- **Ring of Everything:** Add `Tier: T7–T10` restriction matching all other legendaries.
- **Any other conditional legendaries:** Audit each and add explicit `Condition:` fields.

**Documents to update:** MASTER_DESIGN.md (define "max CHA"), LEGENDARIES.md (Condition fields).

---

### Fix M6 — Add Shiny Spawn Soft Cap and Shiny Fatigue

**Add to SCALING.md:**

> **Shiny Spawn Soft Cap**
> Regardless of LCK value, shiny enemy spawn chance is capped at 1/100 (1%). No amount of LCK can push the rate above this.
>
> **Shiny Fatigue**
> After 3 shiny enemies in a single run, the spawn rate for the remainder of that run drops to the base rate of 1/512 regardless of LCK. This resets on run start.
>
> *Design intent: Shiny encounters should feel special. Soft capping prevents LCK-stacking from converting endgame into an exclusively shiny-farming loop.*

**Documents to update:** SCALING.md (shiny spawn section).

---

### Fix M7 — Define One Canonical Companion Assist Formula

**Establish a base × modifier system in MASTER_DESIGN.md. One formula, extended by gear:**

```
companionAssistDamage = floor(effectiveATK × baseMult × scalingMult)
```

> - `baseMult` default = **0.5**
> - `scalingMult` default = **1.0**
>
> **Modifiers (applied in this order):**
> - [Character]'s Core legendary: sets `baseMult` to **1.0** (not additive — replaces default)
> - Synthetic Soul 4-piece set: sets `scalingMult` to **2.5** (multiplicative on top of baseMult)
>
> **Resulting values:**
> - Default: `ATK × 0.5 × 1.0` = **50% ATK**
> - [Character]'s Core only: `ATK × 1.0 × 1.0` = **100% ATK**
> - Synthetic Soul only: `ATK × 0.5 × 2.5` = **125% ATK**
> - Both: `ATK × 1.0 × 2.5` = **250% ATK**

**Update GEAR_SETS.md and LEGENDARIES.md** to reference this system using `baseMult` and `scalingMult` language instead of standalone percentage claims.

**Documents to update:** MASTER_DESIGN.md (canonical formula), GEAR_SETS.md (Synthetic Soul 4pc), LEGENDARIES.md ([Character]'s Core).

---

### Fix M8 — Add a VIT/HP Soft Cap Formula

**Replace the linear HP formula in MASTER_DESIGN.md with a soft-capped version:**

```
maxHP = 40 + min(VIT, 300) × 8 + max(0, VIT − 300) × 2
```

> Past 300 VIT, each additional point contributes only 2 HP instead of 8. This prevents HP from reaching visually unintelligible values at endgame while still meaningfully rewarding VIT investment beyond the threshold.
>
> | VIT | HP |
> |-----|----|
> | 50 | 440 |
> | 100 | 840 |
> | 200 | 1,640 |
> | 300 | 2,440 |
> | 500 | 2,840 |
> | 999 | 3,838 |

**Add the same formula to SCALING.md** in the player stat section.

**Documents to update:** MASTER_DESIGN.md (HP formula), SCALING.md (player stat section).

---

## Minor Fixes

---

### Fix m1 — Define Response Refresh Rules in RESPONSES.md

Add to RESPONSES.md:

> **Refresh Rules**
> - The 90-day refresh clock is per character, not global.
> - On refresh: old responses are kept in the pool (not deleted). New responses from Claude are added alongside them.
> - If a player is inactive for longer than 90 days, the next session triggers a refresh for any key that has passed its threshold.
> - A scenario key's response count is soft-capped at 200 (oldest entries are pruned beyond this to prevent unbounded DB growth).

---

### Fix m2 — Define Merchant Base Prices in SCALING.md

Add to SCALING.md:

```js
function merchantPrice(item, zoneLevel) {
  const rarityMult = { common: 1, uncommon: 2.5, rare: 6, epic: 15, legendary: 50 };
  return Math.floor(item.totalStatValue × zoneLevel × rarityMult[item.rarity] × 0.1);
}
```

> Merchant sell price (player selling to merchant) = 25% of buy price.

---

### Fix m3 — Define Trap Damage in SCALING.md

Add to SCALING.md:

```js
function trapDamage(zoneLevel) {
  return Math.floor(zoneLevel × 1.5);
}
```

> Trap damage is true damage (bypasses DEF). Traps trigger once per room entry. AGI of 50+ grants a 30% chance to avoid traps entirely.

---

### Fix m4 — Consolidate Rest Room Rules in MASTER_DESIGN.md

**Establish MASTER_DESIGN.md as the single source of truth for room behavior.** ZONES.md entries should only note deviations (e.g., "Rest rooms heal double" or "No rest rooms"), not re-define the base.

Add to MASTER_DESIGN.md Room Types section:
> *Base rest room healing: 25% of max HP. Zone-specific modifiers in ZONES.md override this value for their respective zones.*

---

### Fix m5 — Define Secret Room Normal Behavior in MASTER_DESIGN.md

Add to MASTER_DESIGN.md:

> **Secret Rooms**
> - Spawn chance: 3% per non-boss floor (independent roll per floor).
> - Contents: 2–4 items at one rarity tier above the zone's current average drop rate. No enemies. No traps.
> - Secret rooms are not shown on any map or floor preview — they are discovered by entering a room that looks identical to a standard empty room.
> - The Architect's Keystone legendary guarantees a secret room spawn once per run (in addition to the normal random chance).

---

### Fix m6 — Define Flee Priority in MASTER_DESIGN.md

Add to the flee section in MASTER_DESIGN.md:

> **Flee Resolution Order**
> 1. Player flee is resolved first.
> 2. If the player succeeds: combat ends, no loot, no XP, no kill credit.
> 3. If the player fails: enemy flee is then resolved (if the enemy had a flee trigger that turn).
> 4. If both would flee: player resolves first (same result as player success).
> 5. An enemy that flees does not count as a kill and drops no loot.

---

### Fix m7 — Standardize Scenario Key Naming in MASTER_DESIGN.md

**Adopt RESPONSES.md's underscore format as the standard.** Update all scenario key references in MASTER_DESIGN.md to use `snake_case` (e.g., `zone_suggestion_offer`, `battle_win`, `legendary_drop`) rather than the colon-separated IPC-style format.

Add a note to MASTER_DESIGN.md:
> *Scenario keys use `snake_case` throughout. IPC event names (e.g., `rpg:take-action`) are separate from scenario keys and use their own namespace.*

---

### Fix m8 — Add Prestige Cap to MASTER_DESIGN.md and SCALING.md

Add to both documents:

> **Prestige Cap: 20**
> The prestige system is designed for up to 20 prestiges. The "+5 to all stats per prestige" bonus continues to apply past 20, but the game is balanced and tested only through prestige 20. Players who go beyond do so in acknowledged uncharted territory.
>
> Prestige 20 is noted as the intended "true endgame" milestone. Achievements reference up to prestige 10; a secret achievement unlocks at prestige 20.

---

### Fix m9 — Rename "Aria's Core" to "[Character]'s Core"

In LEGENDARIES.md, rename the item:

> **[CHARACTER]'S CORE**
> *(The item name is generated at runtime from the installed character pack's `character.json` name field, e.g., "Aria's Core" for the default character. The item, stats, and lore are identical across all character packs; only the name changes.)*

Add a note in MASTER_DESIGN.md under the legendary system:
> *Character-named legendaries (those using `[CHARACTER]` in their name) substitute the installed character's name at display time. The item's internal ID remains `character_core` in the database regardless of character pack.*

---

### Fix m10 — Add Respec Token Item

Add to MASTER_DESIGN.md (items/consumables section):

> **Respec Token** — Consumable Item
> Allows the player to reset all allocated stat points. Stat points are returned in full and can be reallocated freely.
> - Drop source: Rare purchase from merchants only (not a combat drop)
> - Price: High (approximately equivalent to 10 zone-appropriate gear pieces)
> - Limit: 1 can be held at a time
> - Survives prestige: No (consumed on use; not a legendary)

Add the corresponding IPC handler to the IPC surface in MASTER_DESIGN.md: `rpg:use-respec-token`.

---

## Implementation Fixes

---

### Fix I1 — Downgrade Effects to Achievable Implementations

Update EFFECTS.md with pragmatic implementation notes for each complex effect:

> - **Lightning animations:** Use a pre-drawn SVG path with a CSS stroke-dashoffset animation. Not dynamic generation.
> - **Particle systems:** Cap at 12 particles max per event. Use a pre-allocated DOM element pool (create on startup, reuse). No runtime `createElement`.
> - **Screen noise:** Use a pre-baked `<canvas>` noise texture generated once on startup, overlaid at low opacity with a CSS `filter: url(#noise)` SVG filter.
> - **Rotating gradient borders:** Use `background: conic-gradient(...)` with CSS `animation: rotate`. Supported in Electron's Chromium version.
> - **General rule:** All effects must run in < 16ms per frame (60fps budget). Any effect that cannot meet this budget should degrade gracefully (reduce particles, skip animation, show static fallback).

---

### Fix I2 — Add Index to rpg_responses Table

Update the schema in RESPONSES.md:

```sql
CREATE TABLE rpg_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_key TEXT NOT NULL,
  dialogue TEXT NOT NULL,
  used_count INTEGER DEFAULT 0,
  last_used INTEGER DEFAULT 0
);

-- Add this index:
CREATE INDEX idx_rpg_responses_scenario ON rpg_responses(scenario_key, used_count);
```

---

### Fix I3 — Define Batch IPC Operations in MASTER_DESIGN.md

Add batch IPC events to the IPC surface table:

| Event | Payload | Returns |
|-------|---------|---------|
| `rpg:level-up-bundle` | `{ characterId }` | `{ newLevel, statPointsGained, xpToNext, triggeredScenarioKey, unlockedAchievements[] }` |
| `rpg:run-end-bundle` | `{ characterId, runResult }` | `{ xpAwarded, goldAwarded, lootDrops[], achievementsUnlocked[], levelUps[] }` |
| `rpg:prestige-bundle` | `{ characterId }` | `{ newPrestigeLevel, keptLegendaries[], statReset, prestigeStatBonus }` |

> *Batch events reduce IPC round-trips for multi-step state transitions. Individual events (`rpg:take-action`, `rpg:allocate-stat`, etc.) remain for single-step interactions.*

---

### Fix I4 — Define Companion Emotion State Machine in MASTER_DESIGN.md

Add a state machine specification:

> **Companion Emotion State Machine**
>
> | Trigger | Emotion | Duration |
> |---------|---------|----------|
> | Combat start | `determined` | Until combat ends |
> | Player kills enemy | `happy` | 3 seconds, then previous |
> | Player takes heavy damage (>30% HP in one hit) | `concerned` | 5 seconds |
> | Boss fight detected | `determined` | Until boss dies or player dies |
> | Boss killed | `laughing` | 5 seconds, then `happy` for 5s, then `neutral` |
> | Player HP < 20% | `concerned` | Until HP > 20% |
> | Player HP = 1 | `shocked` | Until HP changes |
> | Player dies | `crying` | 8 seconds, then `neutral` |
> | Legendary drop | `surprised` → `happy` | 3s each, then `neutral` |
> | Leveling up | `happy` | 4 seconds, then `neutral` |
> | Idle > 30 seconds | `neutral` | Until next trigger |
> | Companion assist fires | `smug` | 2 seconds, then previous |
>
> **Priority order (highest overrides lowest):** `crying` > `shocked` > `concerned` > `laughing` > `surprised` > `determined` > `happy` > `smug` > `neutral`
>
> *Transitions are instant (no blend). After a timed emotion expires, return to the highest-priority active state (not necessarily neutral).*

---

## Scope Recommendations

These are optional. Implement as much as desired, but the smaller scopes are significantly more achievable.

---

### Scope Cut S1 — Reduce Zones to 6 Per Tier (~70 Total)

| Option | Zones | Unique Mechanics | Estimated Scope |
|--------|-------|-----------------|-----------------|
| Current | 170+ | 170+ | Very large |
| **Recommended** | **70** | **35 (shared across zones in a tier)** | **Medium** |
| Minimum viable | 30 | 15 | Small |

> Each tier gets 6 named zones. Within a tier, 3–4 mechanics are defined; each zone uses 1–2 of them. Zones feel distinct through enemy themes and names, not unique mechanics per zone.

---

### Scope Cut S2 — Reduce Gear Sets to 20–25 Total

| Option | Sets | Items | Estimated Scope |
|--------|------|-------|-----------------|
| Current | 50+ | ~300 | Very large |
| **Recommended** | **22** | **~130** | **Medium** |
| Minimum viable | 10 | ~60 | Small |

> 10 Rare sets, 10 Epic sets, 2 Legendary-tier sets (T9–T10 only). Each set is deeply balanced rather than broadly present.

---

### Scope Cut S3 — Tier Scenario Response Counts

Replace the uniform 60 responses per key with tiered counts:

| Frequency | Key Count | Responses | Total Lines |
|-----------|-----------|-----------|-------------|
| Very high (battle_win, zone_enter) | 10 | 100 | 1,000 |
| High (loot_found, level_up) | 20 | 60 | 1,200 |
| Medium (rare_drop, boss_encounter) | 20 | 30 | 600 |
| Low (legendary_drop, prestige) | 10 | 20 | 200 |

> **Total: ~3,000 lines** (vs. current ~7,800). 60% reduction with minimal perceived impact.

---

### Scope Cut S4 — Reduce Achievements to 50–60

| Category | Current | Recommended |
|----------|---------|-------------|
| Combat | 25 | 10 |
| Loot | 20 | 8 |
| Exploration | 20 | 8 |
| Progression | 15 | 8 |
| Bond | 10 | 6 |
| Special | 20 | 8 |
| Prestige | 10 | 6 |
| Secret | 12 | 6 |
| **Total** | **132** | **60** |

> Focus on milestone achievements (first clear of each tier, first legendary, first prestige) and challenge achievements (no-damage boss, speed run, stat mastery). Cut filler count achievements.

---

### Scope Cut S5 — Define a Soft Cap for Infinite Scaling

Add to SCALING.md:

> **Tested Scaling Range**
> The game's balance is designed and tested for:
> - Zone levels 1–400 (Tier 1–10 + post-game)
> - Character levels 1–200
> - Prestige levels 0–20
>
> Beyond these ranges, the game continues to function via the scaling formulas but is not balanced. Players entering this territory are explicitly in "beyond endgame" mode. A visible indicator ("BEYOND ENDGAME") activates past prestige 20 or zone level 400 to set expectations.

---

*See PROBLEMS.md for the full problem descriptions each fix addresses.*
