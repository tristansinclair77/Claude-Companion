# RPG Adventure — Achievements

Last updated: 2026-02-27
Status: Phase 0 — Design Complete

---

## Rules

- **Three brackets**: Easy (~20), Mid (~20), Hard (~20) — ~60 total
- **Zero rewards**: Achievements grant nothing mechanical. No stats, no gold, no items, no bonuses.
- **Completionist only**: Achievements are locked/unlocked states. Displayed in an achievement screen.
- **Count-based tiers**: Escalating thresholds — 100 → 500 → 1,000 → 5,000 → 10,000 → 25,000 → 50,000 → 100,000
- **Hidden achievements**: Not shown until unlocked. Marked [HIDDEN] in this document.
- **All names and descriptions use classic fantasy language** — no tech/sci-fi references.

---

## Achievement Format

```
[ID]  [NAME]                    [HIDDEN]?
Condition: [exact unlock condition]
```

No `Reward:` field. Achievements grant nothing.

---

## EASY BRACKET — ~20 Achievements

First-time events and grinds naturally part of early gameplay.
Most players unlock all Easy achievements within their first few sessions.

---

E01  First Blood
Condition: Win your first combat encounter.

E02  Into the Dungeon
Condition: Complete your first floor.

E03  The First Zone
Condition: Clear a Tier 1 zone (defeat the boss) for the first time.

E04  Something Better
Condition: Find your first non-Common item.

E05  A Worthy Blade
Condition: Find your first Rare item.

E06  Boss Slain
Condition: Defeat your first boss.

E07  A Good Omen
Condition: Encounter your first shiny enemy (survive the encounter or kill it).

E08  Growing Up
Condition: Reach character level 10.

E09  Adventure Begins
Condition: Take the companion into their first zone run.

E10  Companion's Aid
Condition: Receive your first companion assist during combat.

E11  Hidden Treasure
Condition: Discover your first secret room.

E12  The Merchant
Condition: Visit your first merchant room inside a zone run.

E13  Set Piece
Condition: Collect your first gear set piece.

E14  Close Call
Condition: Win a combat encounter at 5% HP or below.

E15  Goblin Slayer
Condition: Kill 100 Goblinoid enemies (lifetime total, all runs).

E16  Bone Collector
Condition: Kill 100 Undead enemies (lifetime total, all runs).

E17  Living Dangerously
Condition: Successfully flee from 10 combats (lifetime total).

E18  Flawless Victory
Condition: Win a combat encounter without taking any damage.

E19  Into the Depths
Condition: Clear a Tier 3 zone (defeat the boss) for the first time.

E20  First Set Bonus
Condition: Have a 2-piece gear set bonus active at the same time (equip 2 pieces from
           the same set simultaneously).

---

## MID BRACKET — ~20 Achievements

Sustained effort and attention over multiple sessions.
These require deliberately pushing toward a goal.

---

M01  Five Hundred Fallen
Condition: Kill 500 enemies (lifetime total, all runs).

M02  Boss Hunter
Condition: Defeat 25 bosses (lifetime total, all runs).

M03  Purple Rain
Condition: Find your first Epic item.

M04  Legendary Drop
Condition: Find your first Legendary item.

M05  Full Set
Condition: Have all pieces of a gear set equipped simultaneously with all bonuses active.

M06  Shiny Hunter
Condition: Kill 25 shiny enemies (lifetime total).

M07  Forgotten Lands
Condition: Clear a Tier 5 zone (defeat the boss) for the first time.

M08  Thousand Floors
Condition: Clear 1,000 floors total (lifetime, all runs).

M09  Companion Partner
Condition: Companion assist delivers the killing blow 100 times (lifetime, all runs).

M10  Zone Collector
Condition: Visit every zone in Tiers 1–5 at least once.

M11  No Retreat
Condition: Complete a full zone run (entry to boss kill) without fleeing any combat.

M12  Gold Hoard
Condition: Accumulate 100,000 gold total (lifetime earnings, all runs combined).

M13  Perfect Run
Condition: Win 10 consecutive combats without taking any damage in a single run.

M14  Five Thousand Enemies
Condition: Kill 5,000 enemies (lifetime total).

M15  Set Collector
Condition: Complete 3 different full gear sets at any point across your history
           (does not need to be simultaneously; tracked by set completion events).

M16  Bonded
Condition: Reach base CHA 50 (allocated stat points, not including gear bonuses).

M17  Ancient Domain
Condition: Clear a Tier 7 zone (defeat the boss) for the first time.

M18  Reborn
Condition: Achieve your first Prestige (reset and continue).

M19  Deathless
Condition: Complete an entire zone run (entry to boss kill) without dying once.

M20  Legendary Hoard
Condition: Own 5 different Legendary items simultaneously.

---

## HARD BRACKET — ~20 Achievements

Long-term grinds and genuinely challenging feats.
Most players will not unlock all Hard achievements in a single playthrough.

---

H01  Ten Thousand Dead
Condition: Kill 10,000 enemies (lifetime total).

H02  Boss Slayer
Condition: Defeat 100 bosses (lifetime total).

H03  Shiny Obsession
Condition: Kill 100 shiny enemies (lifetime total).

H04  Edge of the World
Condition: Clear a Tier 9 zone (defeat the boss) for the first time.

H05  The Final Frontier
Condition: Clear a Tier 10 zone (defeat the boss) for the first time.

H06  Ten Thousand Floors
Condition: Clear 10,000 floors total (lifetime).

H07  World Tour
Condition: Visit every zone in Tiers 1–10 at least once.

H08  Naked Run
Condition: Complete a full zone run (entry to boss kill) with no gear equipped at any point.

H09  Zero Damage Run
Condition: Complete an entire zone run (entry to boss kill) without taking any damage.

H10  Conqueror
Condition: Achieve Prestige 5.

H11  Million in Gold
Condition: Accumulate 1,000,000 gold total (lifetime earnings, all runs combined).

H12  Eternal Companion
Condition: Companion assists fire 1,000 times (lifetime total, all runs).

H13  Prestige Master
Condition: Achieve Prestige 10.

H14  Gauntlet Victor
Condition: Clear the Gauntlet challenge zone (all floors, boss defeated).

H15  Arena Champion
Condition: Survive 50 waves in the Arena challenge zone.

H16  Legendary Collector
Condition: Own 20 different Legendary items (tracked lifetime — items kept through prestige count).

H17  Hundred Thousand Dead
Condition: Kill 100,000 enemies (lifetime total).

H18  True Legend
Condition: Achieve Prestige 20.

H19  Second Wind                [HIDDEN]
Condition: Win 3 separate combats in a row after surviving at exactly 1 HP — all within
           a single run.

H20  Completionist
Condition: Unlock all other achievements (all 59 — Easy, Mid, and Hard brackets).
           This achievement is visible as a goal from the start. Hidden achievements
           still count toward the total once unlocked.

---

## Achievement Display

- Achievements appear as toast notifications on unlock (slide from top-right corner of the RPG panel)
- The achievement panel (accessible from the RPG UI) shows:
  - All unlocked achievements with their badge icons
  - Hidden achievements shown only as "???" until unlocked
  - Stats: total unlocked / total available
  - Percentage complete
- Each achievement has a small visual badge icon (designed during Phase 6, visual effects phase)
- No titles are granted by achievements (removed per design decision)

---

## Achievement Panel — Grid Layout

The achievement viewer opens as a pop-out panel accessible via an "Achievements" button
in the RPG panel header.

```
┌────────────────────────────────────────────────────────────────┐
│  ACHIEVEMENTS                              [Filter ▼]  [X]    │
│──────────────────────────────────────────────────────────────  │
│  [Easy] [Mid] [Hard] [All]                 38 / 60 unlocked    │
│──────────────────────────────────────────────────────────────  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │  ⚔   │ │  ⚔  │ │  ★  │ │  ?  │ │  💀  │ │  ⚔  │      │
│  │UNLKD │ │UNLKD │ │UNLKD │ │LOCKD │ │UNLKD │ │LOCKD │      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
│  ... (scrollable grid, 6 per row)                              │
│──────────────────────────────────────────────────────────────  │
│  ███████████████████░░░░░░░░░░  63%  (38/60)                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Achievement Icon States

| State | Visual | Description |
|-------|--------|-------------|
| Unlocked | Full color icon, bright | Achievement earned |
| Locked | Grayscale icon, 50% opacity | Visible but not yet earned |
| Hidden (locked) | "???" icon, solid dark | Existence visible, all details hidden |
| Hidden (unlocked) | Full color icon + shimmer | Was hidden, now revealed |
| In Progress | Color icon + partial fill ring | Countable achievement with partial progress |

---

## Hover Tooltip

Hovering over any achievement icon (locked or unlocked) shows a tooltip:

```
┌─────────────────────────────────────────┐
│  [ICON]  ACHIEVEMENT NAME               │
│  ─────────────────────────────────────  │
│  Bracket: Mid                  [SILVER] │
│                                         │
│  "Short flavor quote about the feat"    │
│                                         │
│  Unlock Condition:                      │
│  Kill 5,000 enemies (lifetime total)    │
│                                         │
│  Progress: █████████░  4,320 / 5,000   │
│                                         │
│  [UNLOCKED — 2026-03-12]               │
└─────────────────────────────────────────┘
```

For HIDDEN locked achievements:
```
┌─────────────────────────────────────────┐
│  [???]  ???                             │
│  ─────────────────────────────────────  │
│  Bracket: ???                   [????] │
│                                         │
│  This achievement is hidden.            │
│  Discover it through exploration.       │
└─────────────────────────────────────────┘
```

---

## Tooltip Fields

| Field | Notes |
|-------|-------|
| Icon | Large version of the icon (48px) |
| Name | Bold, achievement name |
| Bracket | Easy / Mid / Hard |
| Difficulty Badge | Bronze (Easy) / Silver (Mid) / Gold (Hard) |
| Flavor Quote | Short thematic quote (1 line, italicized) |
| Unlock Condition | Exact description of what must be done |
| Progress Bar | Only shown for countable achievements (kills, floors, etc.) |
| Unlock Date | Only shown if already unlocked |

No `Reward:` field — achievements grant nothing.

---

## Filter Options

| Filter | Description |
|--------|-------------|
| All | Show every achievement |
| Easy | Easy bracket only |
| Mid | Mid bracket only |
| Hard | Hard bracket only |
| Unlocked Only | Completed achievements only |
| Locked Only | Not-yet-completed achievements only |
| In Progress | Achievements with partial countable progress |
| Hidden | Hidden achievements (locked or unlocked) |

---

## Progress Tracking

For achievements with countable conditions (kill X enemies, clear X floors, etc.):
- Progress tracked in `rpg_achievement_progress` SQLite table
- Progress bar fills 0% → 100% as condition approaches
- Milestones at 25%, 50%, 75% subtly pulse the icon

```sql
CREATE TABLE rpg_achievement_progress (
  achievement_id  TEXT PRIMARY KEY,
  current_value   INTEGER DEFAULT 0,
  target_value    INTEGER NOT NULL,
  last_updated    TEXT
);
```

---

## Unlock Notification Flow

1. Achievement condition met mid-session
2. Toast notification slides from top-right of RPG panel
3. Achievement icon in the panel header briefly glows
4. Next time achievement panel is opened, newly unlocked achievements have a "NEW" badge
   overlay that clears on hover or panel close
5. Progress bar at the bottom of the panel animates to new percentage

---

*See docs/rpg/CLAUDE.md for locked decisions — achievements grant zero mechanical rewards.*
*See docs/rpg/MASTER_DESIGN.md for the achievement display section.*
