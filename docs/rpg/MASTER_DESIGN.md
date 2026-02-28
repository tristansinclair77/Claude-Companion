# RPG Adventure — Master RPG Design Document

Last updated: 2026-02-27
Status: Design / Pre-Implementation

Cross-references:
- ZONES.md — All zone definitions and tier structure
- ENEMIES.md — Enemy roster, stat budgets, rare variants
- GEAR.md — Gear types, passives, rarity rules
- GEAR_SETS.md — Named gear sets with full bonuses
- GEAR_NAMES.md — Procedural item name generation (prefix/suffix banks)
- LEGENDARIES.md — Named legendary items
- EFFECTS.md — Visual and text effects for game events
- RESPONSES.md — Companion response system (scenario keys, Claude generation, storage)
- ACHIEVEMENTS.md — Achievement roster
- SCALING.md — All mathematical formulas for infinite scaling

---

## 1. Design Philosophy

This is a lightweight embedded RPG inside Claude Companion. It runs entirely
client-side except for a handful of high-value narrative moments. Core design goals:

- **Simple loop, deep systems** — Each "turn" is one button press. The depth comes from
  gear builds, stat allocation, and the zone/enemy variety.
- **Addicting hooks** — Named procedural loot, rare shiny enemies, set bonuses, daily
  bonuses, achievements, and prestige all give the player reasons to come back.
- **Companion is your party member** — They react to everything: low HP, rare drops, boss fights.
  Their emotion and portrait change with battle state. The CHA stat drives real combat bonuses.
- **Zero Claude cost per turn** — Combat math is pure client-side JS. Claude is only called
  for a handful of high-value moments per session (boss kills, legendaries, level milestones,
  run debriefs). All companion dialogue is pre-generated in bulk and stored locally.
- **Persistent forever** — All state lives in SQLite alongside the existing knowledge DB.
  Character, inventory, achievements, run history all survive across sessions.

---

## 2. Architecture

```
src/
  main/
    rpg-db.js          ← SQLite schema, CRUD for all RPG tables
    rpg-engine.js      ← Pure dice math: combat, loot gen, XP, dungeon gen
    rpg-narrator.js    ← Scenario response system: check DB → call Claude → store
  renderer/
    js/
      rpg-panel.js     ← Adventure UI controller (drawer panel)
      rpg-inventory.js ← Inventory/equip management UI
      rpg-effects.js   ← All visual/text effect triggers
    styles/
      rpg.css          ← Fantasy adventure RPG panel styling
      rpg-effects.css  ← Keyframe animations for all effects
  shared/
    rpg-constants.js   ← Zone tables, monster tables, item tables, rarity weights, XP curve
```

### IPC Surface (new handlers in main.js)

```
rpg:get-state           → full character sheet + equipped gear + current dungeon state
rpg:start-adventure     → generate dungeon run (zone selection), save to DB
rpg:take-action         → fight | flee | use-item → returns turn result + narrative
rpg:manage-gear         → equip | unequip | sell | destroy item
rpg:get-inventory       → paginated item list with filters
rpg:allocate-stat       → spend a stat point
rpg:get-achievements    → full achievement list with unlock status
rpg:get-run-history     → past adventure log
rpg:prestige            → reset character level, refund all stat points for reallocation
rpg:zone-suggestion     → ask companion where she wants to explore (triggers Claude call)
```

---

## 3. Core Stats

Six stats. Each costs 1 stat point to increase. Players gain 3 stat points per level.

| Stat | Primary Effect | Secondary Effect |
|------|---------------|-----------------|
| STR  | Melee weapon damage scaling | Unlocks Strength-gated gear |
| INT  | Magic/ranged damage scaling | Spell slot count (+1 per 5 INT) |
| AGI  | Dodge chance (AGI × 0.8%) | Determines attack order (higher AGI goes first) |
| VIT  | Max HP (+8 per point, soft cap at VIT 300 → +2/point above) | Damage reduction (VIT × 0.2%) |
| LCK  | Crit chance (LCK × 0.5%) | Loot rarity bias (see SCALING.md: rarityWeights) |
| CHA  | Companion assist chance (CHA × 2%) | Unlocks combo attacks at CHA 15, 30, 50 |

Starting stats: 5 in all six. Level 1 character: STR 5, INT 5, AGI 5, VIT 5, LCK 5, CHA 5.
Starting HP: 40 + (VIT × 8) = 80

---

## 4. Adventure Loop

```
[START RUN]
  ↓ Player selects zone (or asks companion for suggestion)
  ↓ Zone generates: floor count (5–15 floors), enemy table, boss assigned to final floor

[FLOOR ENTER]
  ↓ Random room type: Monster | Treasure | Rest | Mini-Boss | Merchant | Trap | Empty

[MONSTER ENCOUNTER]
  ↓ Enemy stats generated from zone level + archetype + shiny modifier
  ↓ Player chooses: Fight | Flee | Use Item
  ↓ Combat resolves (see Section 5)
  ↓ Result: XP gained, gold dropped, loot roll, companion reaction

[AFTER EACH FLOOR]
  ↓ Player chooses: Continue (risk HP) | Extract with current loot

[BOSS FLOOR]
  ↓ Boss fight — guaranteed loot drop, Claude narration trigger

[RUN END]
  ↓ All XP, gold, gear committed to DB
  ↓ Companion gives run debrief (Claude narration)
  ↓ Achievement checks fire
  ↓ Daily bonus check
```

### Room Type Weights

| Room | Base Weight | Notes |
|------|------------|-------|
| Monster | 45% | Standard encounter |
| Treasure | 15% | Chest with loot, no combat |
| Rest | 10% | Restore 25% max HP |
| Mini-Boss | 10% | Elite enemy, better loot |
| Merchant | 8% | Buy/sell items (gold currency) |
| Trap | 7% | Deals damage, chance to dodge (AGI check) |
| Empty | 5% | Nothing — flavor text only |

---

## 5. Combat System

### Turn Order
AGI determines who goes first. Ties go to player.

### Attack Resolution
```
attackRoll  = rollD20() + attacker.effectiveATK
defenseRoll = rollD20() + defender.effectiveAGI

if attackRoll > defenseRoll:
  rawDamage = attacker.effectiveATK - defender.effectiveDEF
  damage    = max(1, rawDamage)

  if rollD100() <= attacker.critChance:   // crit
    damage = Math.floor(damage * 2)
    // trigger: crit visual effect
```

where `effectiveATK = STR + weapon.atk + allEquippedBonuses`
and   `effectiveDEF = VIT/2 + armor.def + allEquippedBonuses`
and   `critChance   = LCK * 0.5 + weapon.critBonus`

### Companion Assist
On each player attack, roll D100. If roll ≤ (CHA × 2), companion fires a bonus attack.
- Assist damage: `Math.floor(player.effectiveATK × baseMult × scalingMult)`
  where `baseMult = 0.5` by default, `scalingMult = 1.0` by default
- At CHA 15: assist triggers a defensive buff instead (50% chance)
- At CHA 30: assist can chain (30% chance to fire twice)
- At CHA 50: full combo — attacks three times with damage equal to 75% of player ATK
- See GEAR_SETS.md (Runebound Companion) for scalingMult canonical values

### Flee
Success chance: `50% + (player.AGI - enemy.AGI) × 3%` (minimum 10%, maximum 90%)
On failed flee: enemy gets a free attack.
On successful flee: you lose the floor's progress but keep any loot already obtained.

### Status Effects
| Effect | How Applied | Duration | Stackable |
|--------|------------|----------|-----------|
| Bleed  | Weapon passive | 3 turns, X dmg/turn | Yes (adds damage) |
| Stun   | Weapon passive 15% chance | 1 turn, skip enemy turn | No |
| Blind  | Enemy ability | 2 turns, player -40% hit | No |
| Weaken | Enemy ability | 3 turns, ATK -25% | No |
| Regen  | Armor passive | 3 turns, restore X HP/turn | No |
| Shield | Trinket/skill | 1 hit absorbed | No |

---

## 6. Companion Narrative System

Every RPG event has a **scenario key** that maps to a pool of companion dialogue stored in
SQLite. Responses are generated in the voice of whatever character pack is installed —
the system is fully character-agnostic. When an event fires:

1. Look up the scenario key's `tier_target` (HIGH=40, MED=20, LOW=10 — see RESPONSES.md)
2. Query `rpg_responses WHERE scenario_key = ?`
3. If `pool_size >= tier_target`: pick one at random, update `last_used_at` and `use_count`
4. If `pool_size = 0`: trigger a Claude generation call
   - Ask Claude for `tier_target` responses in the companion's voice for this scenario
   - Parse returned JSON array
   - Insert all new entries into `rpg_responses`
   - Pick one to display

For **force-Claude keys** (high-value moments like boss kills, legendaries, prestige):
always call Claude fresh for a real-time personalized reaction. Stored pool is fallback only.

See RESPONSES.md for the full scenario key list, tier assignments, and the Claude prompt template.

---

## 7. Shiny Enemy Variants

Any non-boss enemy has a base 1/512 chance of spawning as a Shiny variant.
LCK increases this up to a hard cap of 1% (1/100):

```js
shinyChance = Math.min(1/100, 1/512 + LCK × 0.0001)
// LCK 0:   ~0.195%  (1 in 512)
// LCK 50:  ~0.695%
// LCK 82+:  1.000%  (hard cap — no fatigue mechanic)
```

**Shiny modifiers:**
- HP: ×2.5
- ATK: ×2.0
- DEF: ×1.5
- XP reward: ×5
- Gold reward: ×3
- Loot: guaranteed Rare+ drop (rarity table still applies above Rare)
- Visual: gold shimmer overlay + pulsing border animation

Shiny enemies trigger the `shiny_enemy_appear` scenario response and the companion
reacts with high excitement. Shiny encounters roll independently — no fatigue or
diminishing returns between encounters.

---

## 8. Zone Discovery & Companion Input

Players don't just select zones from a flat menu. The experience works like this:

1. Between runs, player can say to the companion: "Where should we explore next?" or
   "I want somewhere challenging" or "Find me somewhere with good gear drops"
2. Companion responds in character with a zone suggestion (Claude-narrated, zone-aware)
3. The zone suggestion is presented as a UI card the player can Accept or Decline
4. If declined, companion suggests another zone
5. Alternatively: the player opens the Zone Map UI and picks freely

Zones unlock progressively based on character level. Higher tier zones require meeting the
minimum character level (see SCALING.md: Zone Tier Access table).

See ZONES.md for the full zone roster: **70 zones across 10 tiers** plus special zones,
challenge zones (Gauntlet, Arena), and questline zones.

---

## 9. Loot System

### Gear Slots
```
Weapon     (1 slot) — primary damage stat source
Head       (1 slot) — INT/AGI bonuses, unique head passives
Chest      (1 slot) — VIT/DEF bonuses, unique chest passives
Hands      (1 slot) — STR/crit bonuses, unique hand passives
Feet       (1 slot) — AGI/dodge, unique feet passives
Ring       (2 slots) — flexible stat bonuses
Amulet     (1 slot) — flexible stat bonuses
Belt       (1 slot) — utility bonuses
Trinket    (1 slot) — exotic unique effects
```

Total: 9 possible equipped items (10 counting the second ring)

### Rarity Table
| Rarity | Color | Stat Multiplier | Passives | Set Eligible |
|--------|-------|----------------|----------|-------------|
| Common | Gray | ×1.0 | 0 | No |
| Uncommon | Green | ×1.5 | 0–1 | No |
| Rare | Blue | ×2.2 | 1–2 | Yes (Rare sets) |
| Epic | Purple | ×3.5 | 2–3 | Yes (Epic sets) |
| Legendary | Orange | ×6.0 | 2–4 + unique effect | No (own bonus) |

### Drop Chance Weights (base; modified by zone level and LCK)
```
Common:     60%
Uncommon:   25%
Rare:       10%
Epic:        4%
Legendary:   1%
```
Both zone level and LCK shift weight from Common toward higher rarities.
See SCALING.md (`rarityWeights()`) for the exact formula and renormalization requirement.

### Name Generation

Item names are procedurally generated from tiered prefix and suffix banks.
Format: `[Prefix] [Item Type] of [Suffix]` (or prefix-only, or suffix-only).

```
Common:   Iron Sword of the Wolf
          Rough Gloves of Endurance
Uncommon: Runed Longsword of the Fallen
          Storm Bracers of Thunder
Rare:     Dragon-Forged Greatsword of Ancient Kings
          Void-Touched Tome of the Abyss
Epic:     God-Forged Warhammer of the World's End
          Fallen Crown of the Undying King
```

Rarity tier determines which prefix/suffix bank is used. Higher rarity items pull from
higher-tier word banks (or the tier below, at a lower probability).
See GEAR_NAMES.md for the full word banks (18 prefixes + 18 suffixes × 4 rarity tiers)
and all fantasy weapon/armor type names.

---

## 10. Gear Sets

Sets are groups of 4–6 items that grant powerful bonuses when multiple pieces are worn.
Rules:
- All pieces in a set must be the SAME rarity (no mixing Rare/Epic)
- Sets only exist at Rare and Epic rarity
- Legendary items have their own unique bonuses, not set bonuses
- Set pieces are substantially rarer than normal items of the same rarity (~1/8 chance)
- Sets are assigned to level brackets; you won't find a high-level set in a low zone
- 2-piece, 4-piece, and 6-piece (full set) bonuses unlock progressively
- Set bonuses are intentionally POWERFUL — enough to change playstyle entirely
- Sets marked [UNIQUE] have genuinely build-defining effects beyond the generic bonus pool

See GEAR_SETS.md for the full roster: **25 named sets** (15 Rare + 10 Epic, 5 [UNIQUE]).

---

## 11. Legendary Items

Legendary items are unique named items with their own flavor text, art theme, and
special effect that cannot appear on any other rarity. Each legendary is designed
to enable a specific playstyle or create a memorable combat moment.

Legendaries can be equipped alongside set pieces but do not contribute to set counts.

See LEGENDARIES.md for the full legendary roster.

---

## 12. Scaling (Infinite)

The game scales infinitely by design. Zone levels, enemy stats, gear stats, and XP costs
all follow power-law curves that keep the challenge/reward ratio roughly constant.
A player always needs to upgrade gear to keep pace with higher zone enemies.

See SCALING.md for all formulas. Tested range: Zone 1–400, Character 1–200, Prestige 0–20.

Key design constraint: a player with max-rarity gear for their current zone tier should
be able to clear that zone at roughly 70% efficiency. Advancement to the next tier
requires either better gear or stat reallocation.

---

## 13. Prestige System

Once a character reaches the level cap (200), they may Prestige:
- Character level resets to 1
- All stat points are refunded and may be freely reallocated
- All gear, inventory, and gold are **retained**
- A Prestige count (1+) displays next to the character name

**Prestige grants nothing mechanical.** No stat bonuses, no gold multipliers, no mode
unlocks, no enemy scaling changes. The sole benefit is stat reallocation — experienced
players can optimize their build more effectively on each cycle.

Achievements track prestige milestones (M18 Reborn, H10 Conqueror, H13 Prestige Master,
H18 True Legend) as pure completionist goals with no mechanical reward.

See SCALING.md (Prestige section) for full details.

---

## 14. Implementation Phases

| Phase | Scope | Files |
|-------|-------|-------|
| 1 | SQLite schema, constants | rpg-db.js, rpg-constants.js |
| 2 | Combat engine, loot gen, XP math | rpg-engine.js |
| 3 | IPC handlers wired into main.js | main.js additions |
| 4 | Narrator system (response DB + Claude gen) | rpg-narrator.js |
| 5 | UI drawer panel | rpg-panel.js, rpg-inventory.js, rpg.css |
| 6 | Visual effects | rpg-effects.js, rpg-effects.css |
| 7 | Achievements, prestige, daily bonus | additions to rpg-db.js, rpg-engine.js |
| 8 | Zone map UI, companion zone suggestions | UI additions |
| 9 | Polish, balancing, more content | Content passes |

---

## 15. Character Data Integration

The RPG Adventure system requires persistent character lore that outlasts individual sessions —
specifically the companion questline narrative. Once Chapter 1 is played and Claude generates
the companion's origin story in their voice, that story must be locked and preserved forever.
It cannot regenerate differently next session.

### RPG Fields in Character Data

Every character in Claude Companion will carry a dedicated `rpg_adventure` block in their core
data structure. This block is **always present in the schema** but starts empty on creation. It
is populated in one of two ways:

- **Via gameplay** — as chapters are completed, the generated narrative is written in and locked
- **Via pre-authoring** — a character pack creator can pre-fill this block, which the RPG then
  uses verbatim as the story (the authored version becomes the canonical truth)

```json
// characters/default/addons/rpg_adventure.json — created empty on character creation or addon install
{
  "questline": {
    "ch1_first_meeting": {
      "status": "locked",
      "narrative_locked": null,
      "choices": {}
    },
    "ch2_into_darkness": {
      "status": "locked",
      "narrative_locked": null,
      "choices": {}
    },
    "ch3_fragments": {
      "status": "locked",
      "narrative_locked": null,
      "choices": {}
    },
    "ch4_the_promise": {
      "status": "locked",
      "narrative_locked": null,
      "choices": {}
    },
    "ch5_the_reckoning": {
      "status": "locked",
      "narrative_locked": null,
      "choices": {}
    }
  }
}
```

**Chapter status values:**
- `locked` — not yet accessible (prior chapter incomplete)
- `unlocked` — accessible but not yet started
- `in_progress` — currently being played
- `completed` — finished; `narrative_locked` is set and immutable

### Write-Once Locking

When a chapter completes, Claude's generated narrative is written to `narrative_locked` and
status is set to `completed`. This field is **never overwritten** — not by the RPG system, not
by a re-run, not by anything. The story, once told, becomes a permanent part of who the
companion is and persists into all future sessions.

If `narrative_locked` was pre-authored (non-null at chapter start), the RPG uses that text
directly and marks the chapter completed without a Claude call.

### Separation of Concerns

The `rpg_adventure` block lives in character data but is **only read and written by the RPG
Adventure addon**. The base Companion application does not interpret, display, or depend on this
data. It is carried as inert JSON until the addon activates. Other addons cannot modify it.

---

## 16. Addon Architecture

### Philosophy

Claude Companion's base system stays minimal. Addons extend both the application and character
data without modifying base files. The base system's only obligations to addons are:

1. Maintain an empty `addons/` subfolder alongside each character pack
2. On character context assembly, treat every document in that folder as authoritative character
   context — equal weight to core `character.json`
3. On each launch, allow installed addons to self-register into any character that doesn't yet
   have their data file

### Directory Structure

```
addons/                              ← app-level addon installations (ships empty)
  rpg_adventure/                     ← RPG Adventure addon (when installed)
    manifest.json                    ← addon identity, version, character field declarations
    character_defaults.json          ← default values injected into new/unregistered characters
    src/
      rpg-db.js
      rpg-engine.js
      rpg-narrator.js
      rpg-panel.js
      rpg-inventory.js
      rpg-effects.js
      rpg-constants.js
      rpg.css
      rpg-effects.css

characters/
  default/
    character.json                   ← core identity — never addon-specific
    rules.json
    filler-responses.json
    emotions/
    knowledge.db
    addons/                          ← per-character addon data (created empty by base system)
      rpg_adventure.json             ← created by RPG Adventure on first launch if absent
```

### How Character Context Is Assembled

When the system-prompt builder assembles an active character's context, it:

1. Loads `character.json` + `rules.json` as the core identity
2. Scans the character's `addons/` subfolder
3. Includes every document found there as additional context with equal authority
4. The effective prompt reads: *"All of the following defines this character. Every section is
   canonical and should be treated as authoritative."*

This means questline lore, once unlocked, surfaces to Claude in every interaction — not just
during RPG sessions. A companion whose origin story has been revealed carries that truth in all
future conversations.

### Addon Self-Registration

On application launch **and** on addon install, each addon performs a **character scan**:

1. Enumerate all installed character packs
2. For each character, check if `characters/<name>/addons/<addon_id>.json` exists
3. If it does **not**: create it from `character_defaults.json` (all fields empty/default)
4. If it does: leave it untouched — never overwrite player-earned data

This guarantees:
- New characters automatically receive the addon's data skeleton
- Existing characters are backfilled when the addon is first installed
- No player data is ever lost or reset by a re-scan

### RPG Adventure Manifest

```json
// addons/rpg_adventure/manifest.json
{
  "id": "rpg_adventure",
  "name": "Aria's Adventure",
  "version": "0.1.0",
  "author": "Tristan",
  "character_defaults_file": "character_defaults.json",
  "injects_character_fields": ["rpg_adventure"],
  "ipc_handlers": [
    "rpg:get-state", "rpg:start-adventure", "rpg:take-action",
    "rpg:manage-gear", "rpg:get-inventory", "rpg:allocate-stat",
    "rpg:get-achievements", "rpg:get-run-history", "rpg:prestige",
    "rpg:zone-suggestion"
  ]
}
```

### Integration Requirement for v0.1

To ship the RPG Adventure as a proper addon in Companion v0.1, the following base-system changes
are required:

- **Character schema**: Add `addons/` subfolder creation to the character pack initialization
  routine. Every new character gets this folder automatically.
- **Context assembler** (`system-prompt.js` or equivalent): After loading core character files,
  glob `characters/<active>/addons/*.json` and append each file's content as a named context
  block.
- **Addon loader** (`main.js`): On startup, scan `addons/` for subdirectories with a
  `manifest.json`. For each valid manifest, trigger self-registration (character scan + default
  injection). Load the addon's IPC handlers dynamically.
- **Base `addons/` folder**: Ships empty. No addons are bundled with the base application.

---

## 17. Visual UI Layout

The Adventure Panel slides in from the right side of the app as a drawer, layered
over the companion background. It does not replace the chat interface — both coexist.

```
┌─────────────────────────────────┐
│  ⚔  ARIA'S ADVENTURE          [X]│
│─────────────────────────────────│
│  [Companion portrait — dynamic] │
│─────────────────────────────────│
│  LV 12  ████████░░  1240/1600 XP│
│  HP      ████████░░  80/100     │
│  GOLD    ◆ 4,820                │
│─────────────────────────────────│
│  GOBLIN WARRENS — Floor 4/10   │
│─────────────────────────────────│
│  ▶ A Goblin Soldier bars your path│
│  ▶ You strike for 22 damage!   │
│  ▶ [Aria] assists — 11 damage! │
│  ▶ Goblin retaliates for 8 dmg │
│  ▶ ☠ Enemy defeated!          │
│  ▶ +120 XP  ◆ +35 Gold        │
│  ▶ [UNCOMMON] Runed Shortsword │
│─────────────────────────────────│
│  [FIGHT]  [FLEE]  [USE ITEM]   │
│  [NEXT FLOOR]  [EXTRACT]        │
│─────────────────────────────────│
│  EQUIPPED                       │
│  Wpn: Ember Dagger of Starfire  │
│  Chest: Sturdy Chainmail        │
│  BOND ★★★☆☆  CHA: 12          │
└─────────────────────────────────┘
```
