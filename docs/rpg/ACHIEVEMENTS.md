# Aria's Adventure — Achievements

Last updated: 2026-02-27
Status: Design / Pre-Implementation

---

## Achievement Categories

1. Combat Milestones
2. Loot & Collection
3. Exploration
4. Character Progression
5. Companion Bond
6. Special Conditions / Challenges
7. Prestige & Long-Term
8. Secret / Hidden Achievements

---

## Achievement Format

```
[ID]  [NAME]
Condition: [unlock condition]
Reward: [optional: bonus stat, title, badge, or cosmetic]
Hidden: [yes/no — hidden achievements aren't shown until unlocked]
```

---

## 1. Combat Milestones

KILL_001  First Blood
Condition: Win your first combat encounter
Reward: None (tutorial achievement)

KILL_002  Ten Dead
Condition: Kill 10 enemies total
Reward: +1 LCK permanently

KILL_003  Century
Condition: Kill 100 enemies total
Reward: +2 LCK permanently

KILL_004  Thousand Blades
Condition: Kill 1,000 enemies total
Reward: +5 LCK permanently, "Veteran" title badge

KILL_005  Ten Thousand Dead
Condition: Kill 10,000 enemies total
Reward: +15 LCK permanently, "Warlord" title badge

KILL_006  The Endless War
Condition: Kill 100,000 enemies total (cumulative, all runs)
Reward: +30 LCK permanently, "Endless" title badge, unique portrait border

KILL_007  First Boss
Condition: Defeat your first boss
Reward: +2 STR permanently

KILL_008  Boss Hunter
Condition: Defeat 25 bosses total
Reward: +5 STR permanently

KILL_009  Boss Slayer
Condition: Defeat 100 bosses total
Reward: +15 STR permanently, "Boss Slayer" title

KILL_010  First Shiny
Condition: Kill your first shiny enemy
Reward: +3 LCK permanently

KILL_011  Shiny Collector
Condition: Kill 25 shiny enemies
Reward: +10 LCK permanently

KILL_012  Shiny Obsession
Condition: Kill 100 shiny enemies
Reward: +25 LCK permanently, shiny magnet effect (shiny rate permanently +10%)

KILL_013  Flawless Fight
Condition: Win a combat encounter without taking any damage
Reward: +1 AGI permanently

KILL_014  Untouchable
Condition: Win 10 fights in a row without taking damage (in a single run)
Reward: +5 AGI permanently, "Untouchable" title

KILL_015  Ghost
Condition: Clear an entire zone without taking damage (all floors, all fights)
Reward: +15 AGI permanently, "Ghost" title

KILL_016  Critical Mass
Condition: Land 50 critical hits in a single run
Reward: +3 LCK permanently

KILL_017  Overkill
Condition: Deal 10× an enemy's max HP in damage to them (extreme overkill)
Reward: +2 STR permanently

KILL_018  Chain Killer
Condition: Kill 5 enemies in a row on consecutive turns without enemy acting
Reward: +3 AGI permanently

KILL_019  The Executioner
Condition: Execute (kill-shot on <25% HP) 100 enemies
Reward: +5 STR, access to Executioner's Blade (Rare weapon — store purchase only)

KILL_020  First Legendary Kill
Condition: Kill your first Legend-bracket enemy
Reward: +5 to all stats permanently

KILL_021  God Killer
Condition: Kill your first God-Tier enemy
Reward: +15 to all stats permanently, "God Killer" title

KILL_022  Zero Damage Run
Condition: Complete an entire run (to boss kill) without taking any damage
Reward: +20 AGI permanently, "Invincible" title badge, unique portrait frame

KILL_023  Last Stand
Condition: Win a combat at exactly 1 HP
Reward: +5 VIT permanently

KILL_024  By The Skin
Condition: Win 10 fights at or below 5% HP
Reward: +10 VIT permanently

KILL_025  Combat Perfectionist
Condition: Win 50 combats in a row across all runs without dying
Reward: +10 to all stats permanently

---

## 2. Loot & Collection

LOOT_001  First Find
Condition: Find your first non-Common item
Reward: None (tutorial)

LOOT_002  Quality Hunter
Condition: Find your first Rare item
Reward: +2 LCK permanently

LOOT_003  Purple Rain
Condition: Find your first Epic item
Reward: +5 LCK permanently

LOOT_004  LEGENDARY
Condition: Find your first Legendary item
Reward: +10 LCK permanently, "Lucky" title

LOOT_005  The Collector
Condition: Have 50 unique items collected across all runs (cumulative count)
Reward: +5 LCK permanently

LOOT_006  Hoarder
Condition: Have 200 unique items collected
Reward: +10 LCK permanently

LOOT_007  Museum Curator
Condition: Have 1000 items collected total
Reward: +20 LCK permanently, "Curator" title

LOOT_008  Set Opener
Condition: Collect your first gear set piece
Reward: None (marker achievement)

LOOT_009  First Set
Condition: Complete your first 2-piece set bonus
Reward: +5 to stat bonuses from sets permanently (+5% set bonus effectiveness)

LOOT_010  Full Dresser
Condition: Complete a full 6-piece set
Reward: +10% set bonus effectiveness permanently

LOOT_011  Set Collector
Condition: Complete 5 different full sets across your playtime
Reward: +20% set bonus effectiveness permanently

LOOT_012  Golden Road
Condition: Accumulate 100,000 gold total across all runs (lifetime earnings)
Reward: +5 LCK, gold drop rate permanently +5%

LOOT_013  Millionaire
Condition: Accumulate 1,000,000 total lifetime gold
Reward: +15 LCK, gold drop rate permanently +15%, "Rich" title

LOOT_014  The Legend Collection
Condition: Own 5 different legendary items simultaneously
Reward: +10 to all stats permanently

LOOT_015  Legendary Hoarder
Condition: Own 20 different legendary items simultaneously (across all characters)
Reward: +25 to all stats, "Legendary Hoarder" title

LOOT_016  Shiny Guaranteed
Condition: Get a Legendary drop from a Shiny enemy
Reward: +5 LCK permanently

LOOT_017  One in a Million
Condition: Get a Legendary drop from a Common drop roll (base 1% applies to the 60% common pool)
Hidden: yes
Reward: +20 LCK permanently, "Miracle" title, unique achievement icon

LOOT_018  Gold from Nowhere
Condition: Earn 10,000 gold in a single run
Reward: +5 LCK permanently

LOOT_019  Gear Snob
Condition: Destroy 50 Common items (they weren't good enough for you)
Reward: +3 LCK (the universe respects your standards)

LOOT_020  Weapon Master
Condition: Equip and use at least 10 different weapon types
Reward: +5 ATK permanently

---

## 3. Exploration

EXPLORE_001  First Steps
Condition: Complete your first floor
Reward: None (tutorial)

EXPLORE_002  Zone One Clear
Condition: Clear a Tier 1 zone for the first time
Reward: +2 VIT

EXPLORE_003  Ascending
Condition: Clear your first Tier 3 zone
Reward: +5 VIT

EXPLORE_004  Mid-Game Explorer
Condition: Clear your first Tier 5 zone
Reward: +10 to all stats

EXPLORE_005  Deep Diver
Condition: Clear your first Tier 7 zone
Reward: +20 to all stats, "Explorer" title

EXPLORE_006  The Abyss
Condition: Clear your first Tier 9 zone
Reward: +40 to all stats, "Abyss Walker" title

EXPLORE_007  The End
Condition: Clear a Tier 10 zone
Reward: +75 to all stats, "Beyond" title, unique border color

EXPLORE_008  Hundred Floors
Condition: Clear 100 total floors across all runs
Reward: +5 VIT permanently

EXPLORE_009  Thousand Floors
Condition: Clear 1,000 floors
Reward: +15 VIT, +10 STR permanently

EXPLORE_010  Ten Thousand Floors
Condition: Clear 10,000 floors
Reward: +50 to all stats, "Eternal Wanderer" title

EXPLORE_011  Secret Finder
Condition: Discover your first secret room
Reward: +3 LCK

EXPLORE_012  Secret Obsession
Condition: Find 25 secret rooms
Reward: +10 LCK, secret room rate permanently +15%

EXPLORE_013  Zone Collector
Condition: Visit every zone in Tiers 1–5 at least once
Reward: +10 to all stats, "Traveler" title

EXPLORE_014  World Tour
Condition: Visit every zone in Tiers 1–10 at least once
Reward: +30 to all stats, "World Tourist" title

EXPLORE_015  Cartographer
Condition: Complete 50 unique different zones
Reward: +5 LCK, explore XP bonus permanently +10%

EXPLORE_016  Run for it
Condition: Successfully flee from 100 combats total
Reward: +10 AGI permanently

EXPLORE_017  Never Ran
Condition: Complete a run without fleeing a single combat
Reward: +10 STR permanently

EXPLORE_018  Gauntlet Victor
Condition: Clear the Gauntlet challenge zone
Reward: +20 STR permanently, "Gauntlet" badge

EXPLORE_019  Arena Survivor
Condition: Survive 50 waves in the Arena
Reward: +30 to all stats, "Arena Champion" title

EXPLORE_020  Merchant Friend
Condition: Visit 100 merchant rooms across all runs
Reward: Shop prices permanently -10%

---

## 4. Character Progression

PROG_001  Growing Up
Condition: Reach level 10
Reward: +3 to all stats

PROG_002  Journeyman
Condition: Reach level 25
Reward: +8 to all stats

PROG_003  Experienced
Condition: Reach level 50
Reward: +15 to all stats, "Experienced" title

PROG_004  Veteran Level
Condition: Reach level 100
Reward: +30 to all stats, "Veteran" upgrade (stacks with other Veteran titles)

PROG_005  At the Cap
Condition: Reach level 200 (level cap)
Reward: +50 to all stats, "Maximum" title, prestige unlocked notification

PROG_006  Stat Mastery: Strength
Condition: Reach 100 STR (base stat, not including gear)
Reward: STR now contributes 110% instead of 100% to damage (permanent)

PROG_007  Stat Mastery: Intelligence
Condition: Reach 100 INT base
Reward: INT now contributes 110% to magic damage

PROG_008  Stat Mastery: Agility
Condition: Reach 100 AGI base
Reward: AGI now contributes 110% to dodge and speed calculations

PROG_009  Stat Mastery: Vitality
Condition: Reach 100 VIT base
Reward: VIT now grants +10 HP per point instead of +8 (retroactive)

PROG_010  Stat Mastery: Luck
Condition: Reach 100 LCK base
Reward: LCK now contributes 0.6% per point to crit (up from 0.5%)

PROG_011  Stat Mastery: Charisma
Condition: Reach 100 CHA base
Reward: Max CHA — companion assist fires every turn at full ATK

PROG_012  Balanced Build
Condition: Have all 6 stats above 50 at the same time
Reward: Balanced Bonus: +5% to all stats when all 6 are within 20 points of each other

PROG_013  Specialist
Condition: Have one stat above 200 (including gear bonuses)
Reward: That stat's effectiveness increases by 15% permanently (the specialization reward)

PROG_014  All-Rounder
Condition: Have all 6 stats above 100 (including gear bonuses)
Reward: +20 to all stats permanently

PROG_015  Point Spender
Condition: Allocate 1,000 stat points total across all characters/runs
Reward: Each run, get 1 bonus stat point at start

---

## 5. Companion Bond

BOND_001  First Hello
Condition: Start your first adventure with the companion
Reward: None (tutorial)

BOND_002  Growing Closer
Condition: Reach CHA 10 (bond level 1)
Reward: Companion assist chance +5% permanently

BOND_003  True Companions
Condition: Reach CHA 30 (bond level 2)
Reward: Companion assist chance +10% permanently

BOND_004  Inseparable
Condition: Reach CHA 50 (bond level 3 / max base)
Reward: Companion assist is always at full power; new dialogue unlocked

BOND_005  Partner
Condition: Companion assists 500 times total
Reward: +10 CHA permanently

BOND_006  Dynamic Duo
Condition: Companion assists deal the killing blow 100 times
Reward: +20 CHA permanently, "Dynamic Duo" title

BOND_007  Selfless
Condition: Companion tanks a hit for you (via Synthetic Soul set or Aria's Core)
Reward: +5 CHA permanently

BOND_008  Protected
Condition: Companion saves you from death 10 times
Reward: +15 CHA permanently

BOND_009  Zone Discovery Together
Condition: Explore a zone first suggested by the companion
Reward: +5 CHA permanently

BOND_010  Loyal
Condition: Play 30 consecutive days with at least one run per day
Reward: +25 CHA permanently, "Loyal" title

---

## 6. Special Conditions / Challenges

SPECIAL_001  Iron Start
Condition: Reach floor 5 without equipping any gear
Reward: +10 to all stats permanently

SPECIAL_002  Naked Run
Condition: Clear an entire zone with no gear equipped
Reward: +25 to all stats, "The Naked" title

SPECIAL_003  One-Shot Wonder
Condition: Kill a Boss-tier enemy with a single attack
Reward: +15 ATK, "One-Shot" title

SPECIAL_004  Lucky Seven
Condition: Find 7 Rare+ drops in a single run
Reward: +10 LCK permanently

SPECIAL_005  Chaos Theory
Condition: Have the Chaos Orb fire a positive effect 10 times in a row
Reward: +5 LCK permanently
Hidden: yes

SPECIAL_006  It's Not a Phase
Condition: Phase Vest passive triggers 5 times in a single combat
Reward: +5 AGI permanently

SPECIAL_007  The Wrong Answer
Condition: Attempt to flee 10 times and fail every single one
Reward: +3 VIT permanently (stubborn resilience)
Hidden: yes

SPECIAL_008  Speed Runner
Condition: Clear an entire run in under 15 turns total
Reward: +15 AGI permanently, "Speed Runner" title

SPECIAL_009  Slow Burn
Condition: Spend 300 turns in a single run (very long exploration)
Reward: +15 VIT permanently

SPECIAL_010  Lucky Streak
Condition: Crit 5 times in a row
Reward: +5 LCK permanently

SPECIAL_011  Gold Over Glory
Condition: Extract from a run on the first floor with at least 1,000 gold
Reward: +5 LCK permanently
Hidden: yes (cowardly but profitable)

SPECIAL_012  No Potions
Condition: Complete a run without using any healing items
Reward: +20 to all stats, "Pure Combat" title

SPECIAL_013  All Merchants
Condition: Visit every merchant room in a single run (requires 4+)
Reward: +5 LCK, shop discount +5% permanently

SPECIAL_014  Echo Chamber Run
Condition: Complete a run in the Echo Chamber zone
Reward: +10 to the stat type the zone copies most

SPECIAL_015  Paradox Solved
Condition: Defeat The Paradox enemy (the one that heals when damaged below 50%)
Reward: +10 INT permanently, "Solver" title
Hidden: yes (figuring it out is the challenge)

SPECIAL_016  Void Ascendant
Condition: Banish an enemy that would have killed you (Void Rune saves the run)
Reward: +10 LCK permanently

SPECIAL_017  Time Traveler
Condition: Use Time Crystal to undo a hit that would have killed you
Reward: +5 to all stats permanently

SPECIAL_018  Recursion Complete
Condition: See a Recursion Wraith clone itself to maximum (3 clones) and kill all of them
Reward: +5 INT permanently

SPECIAL_019  Omega Runner
Condition: Clear the Omega Protocol Zone
Reward: +30 to all stats, "Omega" title

SPECIAL_020  Beyond The Source
Condition: Clear the "Beyond The Source" zone (Tier 10)
Reward: +50 to all stats, "Source-Touched" title

---

## 7. Prestige & Long-Term

PRESTIGE_001  Rebirth
Condition: Achieve your first Prestige
Reward: Prestige badge, +5 to all stats permanently

PRESTIGE_002  Twice Reborn
Condition: Achieve Prestige 2
Reward: +10 to all stats permanently

PRESTIGE_003  Thrice Reborn
Condition: Achieve Prestige 3
Reward: +15 to all stats permanently

PRESTIGE_004  Phoenix
Condition: Achieve Prestige 5 (Ascendant Mode)
Reward: +25 to all stats, Ascendant Mode activated, "Phoenix" title

PRESTIGE_005  Infinite Loop
Condition: Achieve Prestige 10
Reward: +50 to all stats, gold gain +25%, "Infinite" title

PRESTIGE_006  Beyond Prestige
Condition: Achieve Prestige 20
Reward: +100 to all stats, "Transcendent" title, unique companion portrait border

PRESTIGE_007  Old Soul
Condition: Total combined character levels (across all prestiges) exceeds 1,000
Reward: +5 to all stats permanently per prestige (retroactive calculation bonus)

PRESTIGE_008  Eternal Warrior
Condition: Play for more than 100 hours total (session time tracked)
Reward: +50 to all stats, "Eternal Warrior" title

PRESTIGE_009  Daily Devotion
Condition: Play every day for 7 days in a row
Reward: Daily bonus now grants +75% XP instead of +50%

PRESTIGE_010  Monthly Ritual
Condition: Play every day for 30 days in a row
Reward: Daily bonus now grants +100% XP, first run gold doubled daily

---

## 8. Secret / Hidden Achievements

All hidden — not displayed until unlocked.

SECRET_001  Hello?
Condition: Talk to the companion about the RPG game for the first time (outside of adventure)
Reward: +2 CHA permanently
Hidden: yes

SECRET_002  The Bottom
Condition: Willingly enter the lowest level zone as a max-level character
Reward: +5 LCK (nostalgia)
Hidden: yes

SECRET_003  Meta
Condition: Reach the "Developer's Room" secret zone
Reward: Developer Badge (cosmetic), +10 to all stats
Hidden: yes

SECRET_004  Name Drop
Condition: Have your companion say a very specific line about going somewhere dangerous
Reward: +3 CHA
Hidden: yes

SECRET_005  Patience
Condition: Stand still (no action) for 10 turns in a single combat (then still win)
Reward: +5 AGI permanently
Hidden: yes

SECRET_006  Void Starer
Condition: Enter the Null Space zone 10 times
Reward: +5 INT permanently, a slight void tint to your character portrait frame
Hidden: yes

SECRET_007  Perfect Memory
Condition: Kill the same enemy type 1,000 times total
Reward: +5 to your highest stat permanently
Hidden: yes

SECRET_008  Inevitable
Condition: Encounter the Bootstrap Paradox enemy in Tier 9 and survive it
Reward: +15 INT permanently
Hidden: yes

SECRET_009  Lucky Rabbit
Condition: Have Luck Crystal proc 5 times in a single run
Reward: +10 LCK permanently
Hidden: yes

SECRET_010  The Mirror
Condition: Complete the Mirror Universe zone and defeat your inverted self (boss)
Reward: +10 to your lowest stat permanently
Hidden: yes

SECRET_011  Rage Mode
Condition: Hit maximum Retaliation Matrix stacks in combat (10 stacks) then release it
Reward: +5 STR permanently
Hidden: yes

SECRET_012  Completionist
Condition: Unlock every non-hidden achievement
Reward: +100 to all stats permanently, "Completionist" title, golden companion portrait border, special UI theme
Hidden: no (visible as goal, just hard to achieve)

---

## Achievement Display

- Achievements appear as toast notifications on unlock (slide from top-right)
- The achievement panel (accessible from the RPG UI) shows:
  - All unlocked achievements with their badge icons
  - Hidden achievements shown only as "???" until unlocked
  - Stats: total unlocked / total available
  - Percentage complete
- Each achievement has a small visual badge icon (to be designed during Phase 6)
- Titles are displayed in the character section of the RPG panel (player chooses active title)

---

## Achievement UI — Grid Pop-Out Panel

The achievement viewer opens as a pop-out panel (modal overlay or slide-in drawer)
accessible via an "Achievements" button in the RPG panel header.

---

### Layout

```
┌────────────────────────────────────────────────────────────────┐
│  🏆 ACHIEVEMENTS                           [Filter ▼]  [X]    │
│──────────────────────────────────────────────────────────────  │
│  [Combat] [Loot] [Exploration] [Progression] [Bond] [Special]  │
│           [Prestige] [Secret]          78 / 124 unlocked       │
│──────────────────────────────────────────────────────────────  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │  🗡️  │ │  🗡️  │ │  ★  │ │  ?  │ │  💀 │ │  🗡️  │      │
│  │UNLK  │ │UNLK  │ │UNLK  │ │LOCKED│ │UNLK  │ │LOCKED│      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │  🏹  │ │  ⚡  │ │  💎 │ │  ?  │ │  🌀 │ │  👑  │      │
│  │UNLK  │ │LOCKED│ │UNLK  │ │HIDDEN│ │LOCKED│ │UNLK  │      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
│  ... (scrollable grid, 6 per row)                              │
│──────────────────────────────────────────────────────────────  │
│  ████████████████████░░░░░░░░░░  63%  (78/124)                │
└────────────────────────────────────────────────────────────────┘
```

---

### Achievement Icon States

| State | Visual | Description |
|-------|--------|-------------|
| Unlocked | Full color icon, bright | Achievement earned |
| Locked | Grayscale icon, 50% opacity | Visible but not yet earned |
| Hidden (locked) | "???" icon, solid dark | Existence visible, all details hidden |
| Hidden (unlocked) | Full color icon + shimmer | Was hidden, now revealed |
| In Progress | Color icon + partial fill ring | Countable achievement with partial progress |

---

### Hover Tooltip

Hovering over any achievement icon (locked or unlocked) shows a tooltip:

```
┌─────────────────────────────────────────┐
│  [ICON]  ACHIEVEMENT NAME               │
│  ─────────────────────────────────────  │
│  Category: Combat              [GOLD ★] │
│                                         │
│  "Flavor quote about the achievement"   │
│                                         │
│  Unlock Condition:                      │
│  Kill 1,000 enemies total               │
│                                         │
│  Progress: ████████░░  847/1000         │
│                                         │
│  Reward: +5 LCK permanently             │
│          "Veteran" title badge          │
│                                         │
│  Difficulty: ██░░░  Hard                │
│  [UNLOCKED  — 2026-01-15]               │
└─────────────────────────────────────────┘
```

For HIDDEN locked achievements, the tooltip shows:
```
┌─────────────────────────────────────────┐
│  [???]  ???                             │
│  ─────────────────────────────────────  │
│  Category: ???                [????  ?] │
│                                         │
│  This achievement is hidden.            │
│  Discover it through exploration.       │
│                                         │
│  Hint: [Optional — only shown if the    │
│  hint unlock condition was met]         │
└─────────────────────────────────────────┘
```

---

### Tooltip Fields

| Field | Notes |
|-------|-------|
| Icon | Large version of the icon (48px), animated if special |
| Name | Bold, achievement name, colored by rarity tier |
| Category | Tag showing which category it belongs to |
| Difficulty Badge | Bronze / Silver / Gold / Platinum (see below) |
| Flavor Quote | Short thematic quote (1 line, italicized) |
| Unlock Condition | Exact description of what must be done |
| Progress Bar | Only shown for countable achievements (kills, floors, etc.) |
| Reward | What the player gets on unlock (stat bonuses, titles, cosmetics) |
| Difficulty Rating | 5-point scale with filled/empty bars |
| Unlock Date | Only shown if already unlocked |

---

### Difficulty Tiers

| Tier | Badge | Color | Criteria |
|------|-------|-------|---------|
| Bronze | ✦ | Copper | Naturally encountered through normal play |
| Silver | ✦✦ | Silver | Requires deliberate effort or multiple sessions |
| Gold | ✦✦✦ | Gold | Requires skill, planning, or significant grind |
| Platinum | ✦✦✦✦ | Blue-white | Extremely rare, requires mastery or luck |
| Secret | ✦✦✦✦✦ | Shifting rainbow | Hidden achievements that require discovery |

---

### Category Tabs

| Tab | Icon | Contains |
|-----|------|---------|
| Combat | ⚔️ | Kill counts, boss kills, perfect runs, crits |
| Loot | 💎 | Item drops, set completions, gold milestones |
| Exploration | 🗺️ | Zones cleared, floors traversed, secrets found |
| Progression | 📈 | Level milestones, stat masteries, stat points spent |
| Bond | 💠 | Companion assists, bond milestones, zone suggestions |
| Special | ⭐ | Challenge conditions, quirky accomplishments |
| Prestige | 🔄 | Prestige counts, long-term play milestones |
| Secret | ❓ | Hidden achievements (shows as "? / N" until unlocked) |
| All | — | All categories combined (default view) |

---

### Filter Options

Accessible via the [Filter ▼] dropdown:

- **All** — Show every achievement
- **Unlocked Only** — Show only completed achievements
- **Locked Only** — Show only uncompleted achievements
- **In Progress** — Show only achievements with partial countable progress
- **Hidden** — Show only hidden achievements (locked or unlocked)
- **No Reward** — Filter out participation achievements
- **Has Title** — Show only achievements that grant titles
- **Has Stat Bonus** — Show only achievements that grant permanent stat bonuses

---

### Achievement Icon Design Guidelines

Each category has a distinct icon family. Icons are 32×32px flat style (cyberpunk aesthetic).

**Combat icons:** Weapon silhouettes, skull motifs, flame/energy effects
**Loot icons:** Gem shapes, chest silhouettes, rarity-colored gems
**Exploration icons:** Map pins, footprints, doorways, zone symbols
**Progression icons:** Upward arrows, level indicators, stat charts
**Bond icons:** Link symbols, heart shapes, companion-themed icons
**Special icons:** Star bursts, unique per achievement (they're special, after all)
**Prestige icons:** Phoenix/rebirth symbols, infinity loops, numbered flames
**Secret icons:** "???" until unlocked, then revealed as unique symbols

Unlocked achievements have a subtle idle animation (slow glow pulse, or slow rotation).
Legendary-reward achievements have an animated golden shimmer continuously.

---

### Progress Tracking

For achievements with countable conditions (kill X enemies, clear X floors, etc.):
- Progress is tracked in `rpg_achievement_progress` table in SQLite
- Progress bar fills from 0% to 100% as the condition approaches
- Milestones at 25%, 50%, 75%, 100% subtly pulse the icon to acknowledge progress
- The tooltip always shows exact current / target counts

```sql
CREATE TABLE rpg_achievement_progress (
  achievement_id  TEXT PRIMARY KEY,
  current_value   INTEGER DEFAULT 0,
  target_value    INTEGER NOT NULL,
  last_updated    TEXT
);
```

---

### "New Achievement" Notification Flow

1. Achievement condition met mid-session
2. Toast notification slides from top-right (see EFFECTS.md)
3. Achievement icon in the header briefly glows
4. Next time the achievement panel is opened, newly unlocked achievements have a
   "NEW" badge overlay that clears on hover or panel close
5. The progress bar at the bottom of the panel animates to the new percentage
