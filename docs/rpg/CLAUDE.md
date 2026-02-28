# RPG Adventure — Internal Design Rules & Goals

This document is the **canonical authority** for all RPG design decisions.
All other documents in `docs/rpg/` must conform to the rules here.
When documents conflict, this file wins.

Last updated: 2026-02-27

---

## THE GAME

**Type**: Turn-based fantasy adventure RPG minigame embedded in Claude Companion.
**Format**: Dungeon-crawl runs. Combat → loot → level up → stronger zones → prestige.
**Name**: Set per character pack (e.g., "Aria's Adventure" for default character).

---

## THEME: CLASSIC FANTASY ADVENTURE

**We are making a fantasy RPG.** Full stop.

### What belongs here:
- **Zones**: Forest, Jungle, Swamp, Mountain, Desert, Cave, Dungeon, Beach, Ruins, Castle, Volcano, Tundra, etc.
- **Enemies**: Goblins, Trolls, Orcs, Skeletons, Zombies, Harpies, Minotaurs, Dragons, Slimes, Werewolves, Vampires, Wizards, Dark Knights, etc.
- **Gear**: Swords, Axes, Bows, Staffs, Plate Armor, Robes, Shields, Amulets, Rings, Cloaks, Boots, Helmets, etc.
- **Gear names**: Ancient, Cursed, Enchanted, Runed, Blessed, Void-touched, Dragon-forged, etc.
- **Bosses**: Zone guardians, ancient beasts, corrupted champions, demon lords, elemental lords, undead kings, etc.
- **Story**: An adventurer and their companion exploring a classic fantasy world full of danger and treasure.

### What does NOT belong here:
- Cyberpunk, sci-fi, digital, tech references
- "Hacker", "AI", "neural", "quantum", "server", "encrypted", "digital", "code", "firewall", etc.
- Anything that sounds like a computer science term used as a game mechanic

**If it sounds like a sci-fi or tech game element, replace it with a fantasy equivalent or cut it.**

---

## LOCKED DESIGN DECISIONS

These decisions are **final**. They represent the user's explicit design choices.

### 1. Prestige = Counter + Reset (No Rewards)

Prestige resets: level, stats, gold, gear (except legendaries).
Prestige **grants nothing**. It is a counter showing how many times the player has reset.
Prestige count is visible and is a point of pride for completionists.

**Stats are fully reallocatable on prestige reset.** This is the only way to respec.

### 2. Achievements = Completionist Only (No Rewards)

Achievements grant **zero** mechanical rewards. No stats, no gold, no items, no bonuses.
They are purely cosmetic (displayed in achievement screen, titles optional).

**Three brackets:**
- **Easy**: First-time events, simple grinds naturally part of gameplay.
  Example: "First kill", "Reach level 10", "Kill 100 Forest enemies"
- **Mid**: Require sustained effort and attention over multiple sessions.
  Example: "Kill 5,000 Goblins", "Clear 10 zones", "Collect 3 full gear sets"
- **Hard**: Long-term grinds or genuinely challenging feats.
  Example: "Kill 100,000 enemies", "Prestige 10 times", "Complete a run without taking damage"

**Count-based achievements use escalating tiers**: 100 → 500 → 1,000 → 5,000 → 10,000 → 25,000 → 50,000 → 100,000.

### 3. No Legendary Prestige Scaling

Legendary items have **fixed** stats and unique effects. They do not grow stronger with prestige count. They **survive** prestige (the player keeps them). That's the only prestige interaction.

### 4. Visual Effects: Last Phase, One at a Time

No visual effects are implemented until the game is otherwise complete (Phase 8 done).
Each effect is reviewed individually and implemented one at a time.
If an effect is too complex, replace with a simpler alternative. Never block game completion on an effect.

### 5. Local-First Architecture

The game runs **entirely locally**. No network calls during gameplay.
Claude API is called **only for**:
1. Initial generation of companion response pools per scenario key (once per key, stored forever)
2. High-value narrative moments (boss kills, legendary drops, first prestige, major milestones)

Combat math, loot generation, XP calculation, zone progression — all pure JavaScript.

### 6. Response Pools: Generate Once, Wipe to Regenerate

Companion responses are generated the first time a scenario key is triggered.
All generated responses are stored in SQLite permanently.
**There is no auto-refresh** (no 90-day timer, no expiry).
If the user wants fresh responses: wipe the table → next trigger regenerates automatically.

### 7. Stat Respec via Prestige Only

The only way to reallocate stat points is to prestige.
On prestige: all allocated stat points are returned to the pool, ready to spend again.
No mid-run respec. No Respec Token item.

### 8. Zone Mechanics: Shared Pool

Unique zone mechanics live in `UNIQUE_ZONE_MECHANICS.md` as a shared pool.
Zones can optionally draw one mechanic from this pool.
**Not every zone needs a mechanic.** Plenty of zones are vanilla (no special rule).
Mechanics are reused across zones in the same tier — they are not 1:1 unique per zone.

### 9. Gear Set Bonuses: Generic Pool + A Few Unique

Most set bonuses use **generic-but-useful effects** drawn from a defined pool:
stat boosts, lifesteal, multi-hit, dodge enhancement, crit chance, etc.
A small number of sets (~5) have genuinely unique, build-defining effects.
This keeps implementation tractable while still making sets feel meaningful.

---

## CORE DESIGN GOALS

1. **Fun first** — Every mechanic must feel satisfying. If it's tedious or confusing, simplify it.
2. **Simple math** — All formulas must be understandable without a spreadsheet.
3. **Gear-gated progression** — Advancing zones requires better gear, not just more levels.
4. **Character-agnostic** — The game works with any installed companion character pack.
5. **Infinite but tested** — Formulas scale infinitely; game is balanced through prestige 20 / zone 400.
6. **Companion is present** — The companion reacts to every meaningful event. It should feel like an adventure you share.

---

## STRUCTURAL ELEMENTS (Must Remain)

These are core to the game regardless of theme:

- **6 Stats**: STR, INT, AGI, VIT, LCK, CHA
  - STR: physical ATK power
  - INT: magical ATK power, loot identification
  - AGI: hit chance, dodge chance, flee chance, attack order
  - VIT: max HP, defense (VIT contributes 20% of VIT bonus gear to DEF)
  - LCK: crit chance, loot rarity, shiny spawn rate
  - CHA: companion assist chance/frequency (bond stat)
- **Turn-based combat** with hit / crit / dodge math
- **5 Loot rarities**: Common, Uncommon, Rare, Epic, Legendary
- **9 Gear slots**: Weapon, Helm, Chest, Gloves, Boots, Belt, Ring, Amulet, Trinket
- **Gear sets** at Rare and Epic rarity with 2pc/4pc/6pc bonuses
- **Named legendary items** (~80–100) with unique effects, survive prestige
- **Zone tiers** with level ranges (non-linear — zones have varying useful level spans)
- **Shiny enemy variants** (rare, harder, better loot, companion reacts)
- **Boss** at the end of each zone run
- **Prestige system** (counter + reset, stats reallocated)
- **Companion assist mechanic** (CHA-driven, canonical formula)
- **Achievement system** (Easy/Mid/Hard brackets, zero rewards)
- **Local response pool system** for companion dialogue (generate-once)

---

## CANONICAL FORMULAS

### Companion Assist Damage
```
damage = floor(effectiveATK × baseMult × scalingMult)

baseMult default: 0.5
scalingMult default: 1.0

[Character]'s Core legendary: sets baseMult to 1.0 (replaces, not adds)
Synthetic Soul 4pc: sets scalingMult to 2.5

Results:
- Default: 50% ATK
- Core only: 100% ATK
- Soul only: 125% ATK
- Both: 250% ATK
```

### DEF Formula (Canonical — SCALING.md wins)
```
effectiveDEF = floor(VIT / 2) + gear.totalDEFBonus + gear.totalVITBonus × 0.2
```

### Player Max HP
```
maxHP = 40 + min(VIT, 300) × 8 + max(0, VIT - 300) × 2
(soft cap at VIT 300: diminishing returns above this)
```

### CHA Companion Assist Thresholds
| CHA Range | Effect |
|-----------|--------|
| 0–9 | No assists |
| 10–24 | CHA × 2% chance per player turn |
| 25–49 | Guaranteed 1 assist at start of each fight |
| 50 | Guaranteed 1 assist per player turn (50% ATK) |
| 75+ (gear-boosted) | Assist fires twice per player turn |

### Loot Rarity Weights
Must always be renormalized to sum to 100 after any adjustments.
```js
const total = w.common + w.uncommon + w.rare + w.epic + w.legendary;
for (const key in w) w[key] = (w[key] / total) * 100;
```

### Shiny Spawn (Hard Cap)
```
shinyChance = min(1/100, 1/512 + lck × 0.0001)
// max 1% regardless of LCK — shinies must remain special
```

---

## DOCUMENT AUTHORITY ORDER

1. `docs/rpg/CLAUDE.md` ← **You are here. This file wins.**
2. `docs/rpg/MASTER_DESIGN.md`
3. `docs/rpg/SCALING.md`
4. All other design documents

---

*This file must be updated when a design decision is changed or added.*
*It is read by Claude Code at the start of every implementation session.*
