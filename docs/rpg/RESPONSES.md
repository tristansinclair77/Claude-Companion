# Aria's Adventure — Companion Response System

Last updated: 2026-02-27
Status: Design / Pre-Implementation

---

## Overview

The Companion Response System ensures every RPG event has a personalized, in-character
dialogue response from the companion — without calling Claude on every single event.

The system works on a generate-once, reuse-forever basis:

1. An RPG event fires with a `scenario_key` (e.g., `chest_found_legendary`)
2. Database is queried: "How many responses do we have for this key?"
3. If ≥ 50 responses exist → pick one at random, done
4. If < 50 responses → trigger a Claude generation call
5. Claude returns a JSON array of 60 responses in the companion's voice
6. All responses are stored in the `rpg_responses` table
7. One is picked and used immediately
8. Every future trigger of this scenario key pulls from the local pool — zero cost

This means the first-ever trigger of each scenario is the only "expensive" one.
After that, responses are instant and free.

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
  generated_at    TEXT,
  response_count  INTEGER
);
```

---

## Claude Generation Prompt Template

```
You are [CHARACTER_NAME], a [brief personality summary from character.json].
Your communication style: [from character.json rules]

Generate exactly 60 distinct responses for the following RPG event:
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

### COMBAT — Battle Events

| Scenario Key | Description |
|-------------|-------------|
| `battle_start_minion` | Encounter begins vs Minion-tier enemy |
| `battle_start_soldier` | Encounter begins vs Soldier-tier enemy |
| `battle_start_elite` | Encounter begins vs Elite-tier enemy |
| `battle_start_champion` | Encounter begins vs Champion-tier enemy |
| `battle_start_boss` | Boss encounter begins |
| `battle_win` | Standard enemy defeated |
| `battle_win_boss` | Boss defeated |
| `battle_win_shiny` | Shiny enemy defeated |
| `battle_win_streak_3` | Third consecutive kill without taking damage |
| `battle_win_streak_5` | Fifth consecutive kill without taking damage |
| `battle_win_perfect` | Enemy defeated without player taking any damage |
| `battle_lose` | Player is defeated (HP reaches 0) |
| `battle_flee_success` | Player successfully flees |
| `battle_flee_fail` | Player's flee attempt fails |
| `battle_crit_player` | Player lands a critical hit |
| `battle_crit_enemy` | Enemy lands a critical hit on player |
| `battle_companion_assist` | Companion assist fires |
| `battle_companion_assist_kill` | Companion assist delivers the killing blow |
| `battle_companion_triple` | Companion triple-assist fires (CHA 50+) |
| `battle_near_death` | Player HP drops below 20% |
| `battle_iron_will_trigger` | Iron Will passive saves the player from death |
| `battle_status_bleed_applied` | Bleed status applied to enemy |
| `battle_status_stun_applied` | Enemy stunned |
| `battle_enemy_special_fires` | Enemy uses a special ability |
| `battle_first_hit_of_run` | Very first attack of a new run |
| `battle_void_banish` | Void Rune banishes an enemy |

---

### LOOT — Item Events

| Scenario Key | Description |
|-------------|-------------|
| `loot_common` | Common item drops |
| `loot_uncommon` | Uncommon item drops |
| `loot_rare` | Rare item drops |
| `loot_epic` | Epic item drops |
| `loot_legendary` | Legendary item drops |
| `loot_set_piece_first` | First-ever set piece found (for any set) |
| `loot_set_piece_completing_2pc` | Set piece that activates 2pc bonus |
| `loot_set_piece_completing_4pc` | Set piece that activates 4pc bonus |
| `loot_set_piece_completing_6pc` | Set piece that completes full set |
| `loot_shiny_drop` | Drop from a shiny enemy |
| `chest_found_common` | Treasure chest opens with common loot |
| `chest_found_uncommon` | Treasure chest opens with uncommon loot |
| `chest_found_rare` | Treasure chest opens with rare loot |
| `chest_found_epic` | Treasure chest opens with epic loot |
| `chest_found_legendary` | Treasure chest opens with legendary loot |
| `gold_found_small` | Small gold pickup (< 100g) |
| `gold_found_medium` | Medium gold pickup (100–500g) |
| `gold_found_large` | Large gold pickup (500g+) |
| `inventory_full` | Player inventory is at max capacity |
| `item_sold` | Player sells an item at a merchant |
| `item_equipped_upgrade` | New item equipped that is better than current |
| `item_identified` | Unidentified item is identified |

---

### EXPLORATION — Zone & Floor Events

| Scenario Key | Description |
|-------------|-------------|
| `zone_enter_tier1` | Entering a Tier 1 zone |
| `zone_enter_tier2` | Entering a Tier 2 zone |
| `zone_enter_tier3` | Entering a Tier 3 zone |
| `zone_enter_tier4` | Entering a Tier 4 zone |
| `zone_enter_tier5` | Entering a Tier 5 zone |
| `zone_enter_tier6` | Entering a Tier 6 zone |
| `zone_enter_tier7` | Entering a Tier 7 zone |
| `zone_enter_tier8` | Entering a Tier 8 zone |
| `zone_enter_tier9` | Entering a Tier 9 zone |
| `zone_enter_tier10` | Entering a Tier 10 zone |
| `zone_clear` | Zone fully cleared (boss defeated) |
| `zone_first_clear` | Very first time this zone is cleared |
| `floor_advance` | Moving to the next floor |
| `floor_boss_imminent` | One floor before the boss |
| `floor_complete_no_damage` | Floor cleared without taking any damage |
| `room_rest` | Rest room entered |
| `room_treasure` | Treasure room entered |
| `room_merchant` | Merchant room entered |
| `room_trap_triggered` | Trap fires |
| `room_trap_dodged` | Trap is successfully avoided |
| `room_empty` | Empty room — nothing happens |
| `room_secret_found` | Secret room discovered |
| `run_start` | Adventure run begins |
| `run_extract_success` | Player extracts from run with loot |
| `run_complete_boss` | Run completes by defeating the boss |
| `run_failed_death` | Run ends in player death |
| `shiny_enemy_appear` | Shiny enemy variant encountered |

---

### PROGRESSION — Character Growth

| Scenario Key | Description |
|-------------|-------------|
| `level_up_1_10` | Leveling up in the 1–10 range |
| `level_up_11_25` | Leveling up in the 11–25 range |
| `level_up_26_50` | Leveling up in the 26–50 range |
| `level_up_51_75` | Leveling up in the 51–75 range |
| `level_up_76_100` | Leveling up in the 76–100 range |
| `level_up_101_150` | Leveling up in the 101–150 range |
| `level_up_151_200` | Leveling up in the 151–200 range (near cap) |
| `level_milestone_50` | Reaching level 50 exactly |
| `level_milestone_100` | Reaching level 100 exactly |
| `level_milestone_200` | Reaching level cap 200 |
| `stat_point_str` | STR stat point allocated |
| `stat_point_int` | INT stat point allocated |
| `stat_point_agi` | AGI stat point allocated |
| `stat_point_vit` | VIT stat point allocated |
| `stat_point_lck` | LCK stat point allocated |
| `stat_point_cha` | CHA stat point allocated |
| `prestige_1` | First prestige achieved |
| `prestige_2` | Second prestige achieved |
| `prestige_3_plus` | Third or higher prestige |
| `prestige_5_ascendant` | Prestige 5 — Ascendant Mode unlock |
| `first_legendary` | Very first legendary drop ever |
| `first_rare` | Very first rare drop ever |
| `first_epic` | Very first epic drop ever |
| `first_boss_kill` | Very first boss defeated |
| `first_shiny_kill` | Very first shiny enemy killed |
| `achievement_unlocked` | Achievement triggered |

---

### COMPANION — Bond & Relationship Events

| Scenario Key | Description |
|-------------|-------------|
| `bond_level_increase` | CHA/bond milestone reached |
| `bond_level_max` | Maximum bond level reached |
| `companion_assist_miss` | Companion assist attempted but missed |
| `companion_tanks_hit` | Companion takes a hit for the player |
| `companion_low_bond_warning` | If bond level drops (future mechanic, if applicable) |
| `zone_suggestion_offer` | Companion suggests a zone |
| `zone_suggestion_accepted` | Player accepts companion's zone suggestion |
| `zone_suggestion_declined` | Player declines companion's zone suggestion |
| `companion_comments_shiny` | Companion reacts to seeing a shiny enemy |
| `companion_comments_legendary` | Companion reacts to a legendary drop (high-value moment) |
| `companion_comments_boss_death` | Companion reacts to boss being killed (high-value moment) |
| `companion_debrief_success` | End-of-run debrief after success |
| `companion_debrief_death` | End-of-run debrief after player death |
| `companion_debrief_extract` | End-of-run debrief after extraction |
| `daily_bonus_activated` | Daily first-run bonus fires |
| `long_absence_return` | Player returns after not playing for 3+ days |

---

### SPECIAL — Unique Events

| Scenario Key | Description |
|-------------|-------------|
| `set_bonus_2pc` | 2-piece set bonus activates for first time this run |
| `set_bonus_4pc` | 4-piece set bonus activates |
| `set_bonus_6pc` | Full set bonus activates |
| `chaos_orb_fires` | Chaos orb trinket triggers |
| `time_crystal_rewinds` | Time Crystal undoes a hit |
| `void_rune_banish` | Void Rune banishes an enemy instantly |
| `quantum_dice_result_amazing` | Quantum Dice roll result is very favorable |
| `quantum_dice_result_terrible` | Quantum Dice roll result is very bad |
| `run_streak_3` | Third consecutive successful run |
| `run_streak_7` | Seventh consecutive successful run |
| `new_zone_tier_unlocked` | New zone tier becomes available |
| `challenge_zone_enter` | Player enters a challenge zone |
| `challenge_zone_clear` | Player clears a challenge zone |

---

## Total Scenario Keys: ~130

At 60 responses per key, that's 7,800 total responses generated over time.
All stored locally. Calls only happen once per key, ever.

---

## Key Design Notes

### Character-Agnostic
The prompt template pulls character name, personality, and tone from the installed character pack.
A user with a different character gets entirely different response pools — dark, stoic, comedic,
formal, whatever the character is. The scenario keys are universal; the responses are character-specific.

### Response Rotation
To avoid showing the same response twice in a row, track `last_used_at` and `use_count`.
When selecting, filter out the most-recently-used 5 responses before picking.
If fewer than 5 responses exist, no filter is applied.

### Regeneration
After 90 days, a scenario key's responses can be "refreshed" — a new Claude call adds 20 more
responses to the pool (to prevent feeling stale after hundreds of hours of play).
This is optional and user-triggered (not automatic).

### High-Value Moments
Some scenario keys (boss kills, legendaries, milestones) bypass the local pool entirely and always
get a fresh Claude call. These are marked with `force_claude: true` in the scenario definitions.
Even though they have stored responses, these moments feel better as real-time reactions.

Force-Claude scenarios:
- `companion_comments_legendary`
- `companion_comments_boss_death`
- `companion_debrief_success`
- `companion_debrief_death`
- `first_legendary`
- `prestige_1`
- `prestige_5_ascendant`
- `level_milestone_100`
- `level_milestone_200`

All others use local pool by default.

### Error Handling
If a Claude generation call fails (network/API error):
- Fall back to a hardcoded generic response for the scenario category
- Mark the scenario key as "needs_generation" in the log
- Retry on next trigger

### Seed Data
A set of 5 hardcoded fallback responses per scenario category (not per key) ships with the app.
These cover the player immediately on first install before any Claude calls have been made.
Categories: battle_win, loot_drop, zone_enter, level_up, companion_generic
