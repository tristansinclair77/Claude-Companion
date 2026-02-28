# RPG Adventure — Companion Response System

Last updated: 2026-02-27
Status: Design / Pre-Implementation

---

## Overview

The Companion Response System ensures every RPG event has a personalized, in-character
dialogue response from the companion — without calling Claude on every single event.

The system works on a generate-once, reuse-forever basis:

1. An RPG event fires with a `scenario_key` (e.g., `chest_found_legendary`)
2. Database is queried: "How many responses do we have for this key?"
3. If `pool_size >= tier_target` → pick one at random, done
4. If `pool_size = 0` → trigger a Claude generation call
5. Claude returns a JSON array of `tier_target` responses in the companion's voice
6. All responses are stored in the `rpg_responses` table
7. One is picked and used immediately
8. Every future trigger of this scenario key pulls from the local pool — zero cost

This means the first-ever trigger of each scenario is the only "expensive" one.
After that, responses are instant and free.

### Tiered Response Counts

Not all events need the same number of responses. High-frequency events need deep pools
to avoid repetition; rare milestone events can have shallower pools.

| Tier | Pool Size | Usage |
|------|-----------|-------|
| HIGH | 40        | Events that fire multiple times per session (combat, basic loot) |
| MED  | 20        | Events that fire once or a few times per run (zone entry, level-up) |
| LOW  | 10        | Rare events, milestones, first-time triggers, companion specials |

**Total responses across all scenario keys: ~2,640**
(29 HIGH × 40) + (52 MED × 20) + (44 LOW × 10) = 1,160 + 1,040 + 440

---

## SQLite Schema

```sql
CREATE TABLE rpg_responses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_key    TEXT NOT NULL,        -- e.g., 'chest_found_legendary'
  dialogue        TEXT NOT NULL,        -- companion's spoken line
  emotion         TEXT DEFAULT 'neutral', -- emotion ID to display
  thoughts        TEXT,                 -- internal companion thought (shown in thought bubble)
  use_count       INTEGER DEFAULT 0,
  last_used_at    TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_rpg_responses_key ON rpg_responses (scenario_key);

-- Track which scenario keys have been fully generated
CREATE TABLE rpg_response_generation_log (
  scenario_key    TEXT PRIMARY KEY,
  tier            TEXT NOT NULL,        -- 'high', 'med', 'low'
  target_count    INTEGER NOT NULL,     -- tier target (40 / 20 / 10)
  generated_at    TEXT,
  response_count  INTEGER
);
```

---

## Claude Generation Prompt Template

```
You are [CHARACTER_NAME], a [brief personality summary from character.json].
Your communication style: [from character.json rules]

Generate exactly [TIER_TARGET] distinct responses for the following RPG event:
EVENT: [scenario description]
CONTEXT: [any relevant game state, e.g., "the player just found their first legendary item"]

Requirements:
- All responses must sound like [CHARACTER_NAME] — their vocabulary, tone, and personality
- Vary the mood: some enthusiastic, some understated, some dramatic, some casual, some humorous
- Vary the length: some very short (one sentence), some medium (two to three sentences)
- Reference the game situation naturally — don't break immersion
- Avoid repeating phrases between responses
- Include references to the companion's relationship with the player where natural

Return ONLY a valid JSON array with this exact format:
[
  { "dialogue": "...", "emotion": "...", "thoughts": "..." },
  ...
]

Valid emotion values: neutral, happy, soft_smile, laughing, confident, smug, surprised,
shocked, confused, thinking, concerned, sad, angry, determined, embarrassed, exhausted,
pout, crying, lustful_desire

The "thoughts" field is the companion's private thought (1–2 sentences, can differ from dialogue).
The "thoughts" field may be null if not applicable.
```

Character data is pulled from `character.json` and `characters/[char]/rules.json` at generation time.
This means different character packs generate completely different response pools — the system
is character-agnostic by design.

---

## Complete Scenario Key List

Each key is tagged: **[H]** = HIGH (40 responses), **[M]** = MED (20 responses), **[L]** = LOW (10 responses).

---

### COMBAT — Battle Events

| Scenario Key | Description | Tier |
|-------------|-------------|------|
| `battle_start_minion` | Encounter begins vs Minion-tier enemy | [H] |
| `battle_start_soldier` | Encounter begins vs Soldier-tier enemy | [H] |
| `battle_start_elite` | Encounter begins vs Elite-tier enemy | [H] |
| `battle_start_champion` | Encounter begins vs Champion-tier enemy | [H] |
| `battle_start_boss` | Boss encounter begins | [H] |
| `battle_win` | Standard enemy defeated | [H] |
| `battle_win_boss` | Boss defeated | [H] |
| `battle_win_shiny` | Shiny enemy defeated | [H] |
| `battle_win_streak_3` | Third consecutive kill without taking damage | [H] |
| `battle_win_streak_5` | Fifth consecutive kill without taking damage | [H] |
| `battle_win_perfect` | Enemy defeated without player taking any damage | [H] |
| `battle_lose` | Player is defeated (HP reaches 0) | [H] |
| `battle_flee_success` | Player successfully flees | [H] |
| `battle_flee_fail` | Player's flee attempt fails | [H] |
| `battle_crit_player` | Player lands a critical hit | [H] |
| `battle_crit_enemy` | Enemy lands a critical hit on player | [H] |
| `battle_companion_assist` | Companion assist fires | [H] |
| `battle_companion_assist_kill` | Companion assist delivers the killing blow | [H] |
| `battle_companion_triple` | Companion assist fires on consecutive turns (CHA 50+) | [H] |
| `battle_near_death` | Player HP drops below 20% | [H] |
| `battle_iron_will_trigger` | Iron Will passive saves the player from death | [H] |
| `battle_status_bleed_applied` | Bleed status applied to enemy | [H] |
| `battle_status_stun_applied` | Enemy stunned | [H] |
| `battle_enemy_special_fires` | Enemy uses a special ability | [H] |
| `battle_first_hit_of_run` | Very first attack of a new run | [H] |

---

### LOOT — Item Events

| Scenario Key | Description | Tier |
|-------------|-------------|------|
| `loot_common` | Common item drops | [H] |
| `loot_uncommon` | Uncommon item drops | [H] |
| `loot_rare` | Rare item drops | [M] |
| `loot_epic` | Epic item drops | [M] |
| `loot_legendary` | Legendary item drops | [M] |
| `loot_set_piece_first` | First-ever set piece found (any set) | [M] |
| `loot_set_piece_completing_2pc` | Set piece that activates 2pc bonus | [M] |
| `loot_set_piece_completing_4pc` | Set piece that activates 4pc bonus | [M] |
| `loot_set_piece_completing_6pc` | Set piece that completes full set | [M] |
| `loot_shiny_drop` | Drop from a shiny enemy | [M] |
| `chest_found_common` | Treasure chest opens with common loot | [M] |
| `chest_found_uncommon` | Treasure chest opens with uncommon loot | [M] |
| `chest_found_rare` | Treasure chest opens with rare loot | [M] |
| `chest_found_epic` | Treasure chest opens with epic loot | [M] |
| `chest_found_legendary` | Treasure chest opens with legendary loot | [M] |
| `gold_found_small` | Small gold pickup (< 100g) | [M] |
| `gold_found_medium` | Medium gold pickup (100–500g) | [M] |
| `gold_found_large` | Large gold pickup (500g+) | [M] |
| `inventory_full` | Player inventory is at max capacity | [M] |
| `item_sold` | Player sells an item at a merchant | [M] |
| `item_equipped_upgrade` | New item equipped that is better than current | [M] |
| `item_identified` | Unidentified item is identified | [M] |

---

### EXPLORATION — Zone & Floor Events

| Scenario Key | Description | Tier |
|-------------|-------------|------|
| `zone_enter_tier1` | Entering a Tier 1 zone | [M] |
| `zone_enter_tier2` | Entering a Tier 2 zone | [M] |
| `zone_enter_tier3` | Entering a Tier 3 zone | [M] |
| `zone_enter_tier4` | Entering a Tier 4 zone | [M] |
| `zone_enter_tier5` | Entering a Tier 5 zone | [M] |
| `zone_enter_tier6` | Entering a Tier 6 zone | [M] |
| `zone_enter_tier7` | Entering a Tier 7 zone | [M] |
| `zone_enter_tier8` | Entering a Tier 8 zone | [M] |
| `zone_enter_tier9` | Entering a Tier 9 zone | [M] |
| `zone_enter_tier10` | Entering a Tier 10 zone | [M] |
| `zone_clear` | Zone fully cleared (boss defeated) | [M] |
| `zone_first_clear` | Very first time this zone is cleared | [M] |
| `floor_advance` | Moving to the next floor | [H] |
| `floor_boss_imminent` | One floor before the boss | [M] |
| `floor_complete_no_damage` | Floor cleared without taking any damage | [M] |
| `room_rest` | Rest room entered | [M] |
| `room_treasure` | Treasure room entered | [M] |
| `room_merchant` | Merchant room entered | [M] |
| `room_trap_triggered` | Trap fires | [M] |
| `room_trap_dodged` | Trap is successfully avoided | [M] |
| `room_empty` | Empty room — nothing happens | [H] |
| `room_secret_found` | Secret room discovered | [M] |
| `run_start` | Adventure run begins | [M] |
| `run_extract_success` | Player extracts from run with loot | [M] |
| `run_complete_boss` | Run completes by defeating the boss | [M] |
| `run_failed_death` | Run ends in player death | [M] |
| `shiny_enemy_appear` | Shiny enemy variant encountered | [M] |

---

### PROGRESSION — Character Growth

| Scenario Key | Description | Tier |
|-------------|-------------|------|
| `level_up_1_10` | Leveling up in the 1–10 range | [M] |
| `level_up_11_25` | Leveling up in the 11–25 range | [M] |
| `level_up_26_50` | Leveling up in the 26–50 range | [M] |
| `level_up_51_75` | Leveling up in the 51–75 range | [M] |
| `level_up_76_100` | Leveling up in the 76–100 range | [M] |
| `level_up_101_150` | Leveling up in the 101–150 range | [M] |
| `level_up_151_200` | Leveling up in the 151–200 range (near cap) | [M] |
| `level_milestone_50` | Reaching level 50 exactly | [L] |
| `level_milestone_100` | Reaching level 100 exactly | [L] |
| `level_milestone_200` | Reaching level cap 200 | [L] |
| `stat_point_str` | STR stat point allocated | [L] |
| `stat_point_int` | INT stat point allocated | [L] |
| `stat_point_agi` | AGI stat point allocated | [L] |
| `stat_point_vit` | VIT stat point allocated | [L] |
| `stat_point_lck` | LCK stat point allocated | [L] |
| `stat_point_cha` | CHA stat point allocated | [L] |
| `prestige_1` | First prestige achieved | [L] |
| `prestige_2` | Second prestige achieved | [L] |
| `prestige_3_plus` | Third or higher prestige | [L] |
| `first_legendary` | Very first legendary drop ever | [L] |
| `first_rare` | Very first rare drop ever | [L] |
| `first_epic` | Very first epic drop ever | [L] |
| `first_boss_kill` | Very first boss defeated | [L] |
| `first_shiny_kill` | Very first shiny enemy killed | [L] |
| `achievement_unlocked` | Achievement triggered | [L] |

---

### COMPANION — Bond & Relationship Events

| Scenario Key | Description | Tier |
|-------------|-------------|------|
| `bond_level_increase` | CHA/bond milestone reached | [L] |
| `bond_level_max` | Maximum bond level reached | [L] |
| `companion_assist_miss` | Companion assist attempted but missed | [L] |
| `companion_tanks_hit` | Companion intercepts a hit for the player | [L] |
| `companion_low_bond_warning` | Bond warning (future mechanic, if applicable) | [L] |
| `zone_suggestion_offer` | Companion suggests a zone | [L] |
| `zone_suggestion_accepted` | Player accepts companion's zone suggestion | [L] |
| `zone_suggestion_declined` | Player declines companion's zone suggestion | [L] |
| `companion_comments_shiny` | Companion reacts to seeing a shiny enemy | [L] |
| `companion_comments_legendary` | Companion reacts to a legendary drop | [L] |
| `companion_comments_boss_death` | Companion reacts to boss being killed | [L] |
| `companion_debrief_success` | End-of-run debrief after success | [L] |
| `companion_debrief_death` | End-of-run debrief after player death | [L] |
| `companion_debrief_extract` | End-of-run debrief after extraction | [L] |
| `daily_bonus_activated` | Daily first-run bonus fires | [L] |
| `long_absence_return` | Player returns after not playing for 3+ days | [L] |

---

### SPECIAL — Unique Events

| Scenario Key | Description | Tier |
|-------------|-------------|------|
| `set_bonus_2pc` | 2-piece set bonus activates for first time this run | [L] |
| `set_bonus_4pc` | 4-piece set bonus activates | [L] |
| `set_bonus_6pc` | Full set bonus activates | [L] |
| `chaos_orb_fires` | Chaos Orb trinket triggers a random effect | [L] |
| `void_rune_banish` | Void Rune banishes an enemy instantly | [L] |
| `run_streak_3` | Third consecutive successful run | [L] |
| `run_streak_7` | Seventh consecutive successful run | [L] |
| `new_zone_tier_unlocked` | New zone tier becomes available | [L] |
| `challenge_zone_enter` | Player enters a challenge zone | [L] |
| `challenge_zone_clear` | Player clears a challenge zone | [L] |

---

## Total Scenario Keys: 125

- HIGH (40 responses): 29 keys — 1,160 responses
- MED  (20 responses): 52 keys — 1,040 responses
- LOW  (10 responses): 44 keys —   440 responses
- **Total stored responses: ~2,640**

All stored locally. Claude is only called when a pool is empty (first trigger)
or when the player manually requests a pool refresh.

---

## Key Design Notes

### Character-Agnostic
The prompt template pulls character name, personality, and tone from the installed character pack.
A user with a different character gets entirely different response pools — dark, stoic, comedic,
formal, whatever the character is. The scenario keys are universal; the responses are character-specific.

### Response Rotation
To avoid showing the same response twice in a row, track `last_used_at` and `use_count`.
When selecting, filter out the 5 most-recently-used responses before picking.
If fewer than 5 responses exist in the pool, no filter is applied.

### Wipe-to-Regenerate Policy

When a pool feels stale after many hours of play, the player can manually refresh it.
Refreshing **wipes the existing pool entirely** and generates a fresh set from scratch.

There is **no automatic expiry** — pools do not auto-refresh on any timer.
Regeneration is always explicit and user-triggered.

Manual refresh flow:
1. Player triggers "Refresh responses" for a scenario category (or a specific key)
2. All rows for that `scenario_key` are deleted from `rpg_responses`
3. `rpg_response_generation_log` entry is cleared
4. Next trigger of the scenario key generates a fresh full pool at tier count
5. `rpg_response_generation_log` is updated

Why wipe instead of append: Incremental additions create inconsistency — older responses may
reference items, zones, or events that no longer exist after system updates. A clean wipe
guarantees all responses in a pool are coherent and current.

### Force-Claude Keys

Some scenario keys bypass the local pool entirely and always get a fresh Claude call.
These are high-value moments that feel better as real-time reactions to the exact game state.
The stored pool for these keys acts as a fallback only (if the Claude call fails).

```
force_claude: true
  companion_comments_legendary
  companion_comments_boss_death
  companion_debrief_success
  companion_debrief_death
  first_legendary
  prestige_1
  level_milestone_100
  level_milestone_200
```

All other keys use the local pool by default.

### Error Handling
If a Claude generation call fails (network/API error):
- Fall back to a hardcoded generic response for the scenario category
- Mark the scenario key as `needs_generation` in the log
- Retry automatically on next trigger of that key

### Seed Data
A set of 5 hardcoded fallback responses per scenario category ships with the app.
These cover the player immediately on first install before any Claude calls have been made.
Categories: `battle_win`, `loot_drop`, `zone_enter`, `level_up`, `companion_generic`
