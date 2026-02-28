'use strict';

// ── RPG Narrator — Phase 4 ────────────────────────────────────────────────────
// Companion response system: retrieves from local pool or generates via Claude.
// Local-first: Claude is only called when a pool is empty (first trigger) or
// for force-Claude keys that always get a fresh real-time reaction.

const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { spawn, execSync } = require('child_process');

// ── State (injected via init()) ───────────────────────────────────────────────

let _db  = null;  // RpgDB instance
let _dir = null;  // character directory path (e.g. characters/default)

// ── Tier targets ──────────────────────────────────────────────────────────────

const TIER_TARGET = { high: 40, med: 20, low: 10 };

// ── Force-Claude keys (always real-time, skip pool, pool = fallback only) ────

const FORCE_CLAUDE_KEYS = new Set([
  'companion_comments_legendary',
  'companion_comments_boss_death',
  'companion_debrief_success',
  'companion_debrief_death',
  'first_legendary',
  'prestige_1',
  'level_milestone_100',
  'level_milestone_200',
]);

// ── Scenario key → tier (all 125 keys) ───────────────────────────────────────

const SCENARIO_TIER = {
  // COMBAT — HIGH (25 keys)
  battle_start_minion:           'high',
  battle_start_soldier:          'high',
  battle_start_elite:            'high',
  battle_start_champion:         'high',
  battle_start_boss:             'high',
  battle_win:                    'high',
  battle_win_boss:               'high',
  battle_win_shiny:              'high',
  battle_win_streak_3:           'high',
  battle_win_streak_5:           'high',
  battle_win_perfect:            'high',
  battle_lose:                   'high',
  battle_flee_success:           'high',
  battle_flee_fail:              'high',
  battle_crit_player:            'high',
  battle_crit_enemy:             'high',
  battle_companion_assist:       'high',
  battle_companion_assist_kill:  'high',
  battle_companion_triple:       'high',
  battle_near_death:             'high',
  battle_iron_will_trigger:      'high',
  battle_status_bleed_applied:   'high',
  battle_status_stun_applied:    'high',
  battle_enemy_special_fires:    'high',
  battle_first_hit_of_run:       'high',
  // LOOT — HIGH (2 keys)
  loot_common:                   'high',
  loot_uncommon:                 'high',
  // EXPLORATION — HIGH (2 keys)
  floor_advance:                 'high',
  room_empty:                    'high',
  // LOOT — MED (20 keys)
  loot_rare:                     'med',
  loot_epic:                     'med',
  loot_legendary:                'med',
  loot_set_piece_first:          'med',
  loot_set_piece_completing_2pc: 'med',
  loot_set_piece_completing_4pc: 'med',
  loot_set_piece_completing_6pc: 'med',
  loot_shiny_drop:               'med',
  chest_found_common:            'med',
  chest_found_uncommon:          'med',
  chest_found_rare:              'med',
  chest_found_epic:              'med',
  chest_found_legendary:         'med',
  gold_found_small:              'med',
  gold_found_medium:             'med',
  gold_found_large:              'med',
  inventory_full:                'med',
  item_sold:                     'med',
  item_equipped_upgrade:         'med',
  item_identified:               'med',
  // EXPLORATION — MED (25 keys)
  zone_enter_tier1:              'med',
  zone_enter_tier2:              'med',
  zone_enter_tier3:              'med',
  zone_enter_tier4:              'med',
  zone_enter_tier5:              'med',
  zone_enter_tier6:              'med',
  zone_enter_tier7:              'med',
  zone_enter_tier8:              'med',
  zone_enter_tier9:              'med',
  zone_enter_tier10:             'med',
  zone_clear:                    'med',
  zone_first_clear:              'med',
  floor_boss_imminent:           'med',
  floor_complete_no_damage:      'med',
  room_rest:                     'med',
  room_treasure:                 'med',
  room_merchant:                 'med',
  room_trap_triggered:           'med',
  room_trap_dodged:              'med',
  room_secret_found:             'med',
  run_start:                     'med',
  run_extract_success:           'med',
  run_complete_boss:             'med',
  run_failed_death:              'med',
  shiny_enemy_appear:            'med',
  // PROGRESSION — MED (7 keys)
  level_up_1_10:                 'med',
  level_up_11_25:                'med',
  level_up_26_50:                'med',
  level_up_51_75:                'med',
  level_up_76_100:               'med',
  level_up_101_150:              'med',
  level_up_151_200:              'med',
  // PROGRESSION — LOW (18 keys)
  level_milestone_50:            'low',
  level_milestone_100:           'low',
  level_milestone_200:           'low',
  stat_point_str:                'low',
  stat_point_int:                'low',
  stat_point_agi:                'low',
  stat_point_vit:                'low',
  stat_point_lck:                'low',
  stat_point_cha:                'low',
  prestige_1:                    'low',
  prestige_2:                    'low',
  prestige_3_plus:               'low',
  first_legendary:               'low',
  first_rare:                    'low',
  first_epic:                    'low',
  first_boss_kill:               'low',
  first_shiny_kill:              'low',
  achievement_unlocked:          'low',
  // COMPANION — LOW (16 keys)
  bond_level_increase:           'low',
  bond_level_max:                'low',
  companion_assist_miss:         'low',
  companion_tanks_hit:           'low',
  companion_low_bond_warning:    'low',
  zone_suggestion_offer:         'low',
  zone_suggestion_accepted:      'low',
  zone_suggestion_declined:      'low',
  companion_comments_shiny:      'low',
  companion_comments_legendary:  'low',
  companion_comments_boss_death: 'low',
  companion_debrief_success:     'low',
  companion_debrief_death:       'low',
  companion_debrief_extract:     'low',
  daily_bonus_activated:         'low',
  long_absence_return:           'low',
  // SPECIAL — LOW (10 keys)
  set_bonus_2pc:                 'low',
  set_bonus_4pc:                 'low',
  set_bonus_6pc:                 'low',
  chaos_orb_fires:               'low',
  void_rune_banish:              'low',
  run_streak_3:                  'low',
  run_streak_7:                  'low',
  new_zone_tier_unlocked:        'low',
  challenge_zone_enter:          'low',
  challenge_zone_clear:          'low',
};

// ── Scenario descriptions (used in Claude generation prompts) ─────────────────

const SCENARIO_DESC = {
  battle_start_minion:           'A weak minion-tier enemy approaches to start combat',
  battle_start_soldier:          'A soldier-tier enemy engages for battle',
  battle_start_elite:            'A powerful elite enemy steps forward to fight',
  battle_start_champion:         'A fearsome champion-tier enemy challenges the player',
  battle_start_boss:             'The dungeon boss has appeared for the climactic fight',
  battle_win:                    'The player defeated a standard enemy',
  battle_win_boss:               'The player defeated the dungeon boss',
  battle_win_shiny:              'The player defeated a rare shiny/golden enemy variant',
  battle_win_streak_3:           'Third consecutive kill without taking any damage — a growing streak',
  battle_win_streak_5:           'Fifth consecutive kill without damage — an impressive streak',
  battle_win_perfect:            'Enemy defeated without the player taking any damage at all',
  battle_lose:                   'The player\'s HP reached zero — they have been defeated in battle',
  battle_flee_success:           'The player successfully fled from battle',
  battle_flee_fail:              'The player tried to flee but failed — the enemy cut off escape',
  battle_crit_player:            'The player just landed a critical hit dealing massive damage',
  battle_crit_enemy:             'The enemy landed a critical hit on the player',
  battle_companion_assist:       'The companion fired an assist attack to help the player',
  battle_companion_assist_kill:  'The companion\'s assist attack delivered the killing blow',
  battle_companion_triple:       'The companion assists on consecutive turns due to high CHA bond',
  battle_near_death:             'The player\'s HP fell below 20% — critical danger',
  battle_iron_will_trigger:      'Iron Will passive triggered — the player survived a lethal blow with 1 HP',
  battle_status_bleed_applied:   'Bleed status effect applied to an enemy',
  battle_status_stun_applied:    'An enemy was stunned and loses their next action',
  battle_enemy_special_fires:    'The enemy activated a powerful special ability',
  battle_first_hit_of_run:       'The very first attack strike of this adventure run',
  loot_common:                   'A common quality item dropped from combat',
  loot_uncommon:                 'An uncommon quality item was found',
  loot_rare:                     'A rare quality item dropped — noticeably better than average',
  loot_epic:                     'An epic quality item was found — a powerful upgrade',
  loot_legendary:                'A legendary item dropped — extremely rare and powerful',
  loot_set_piece_first:          'The player found their very first armor set piece ever',
  loot_set_piece_completing_2pc: 'This set piece completes the 2-piece set bonus — first activation',
  loot_set_piece_completing_4pc: 'The 4-piece set bonus was just unlocked — a major power spike',
  loot_set_piece_completing_6pc: 'The full 6-piece set is complete — maximum set power achieved',
  loot_shiny_drop:               'The shiny enemy dropped its special enhanced loot',
  chest_found_common:            'A treasure chest opened to reveal common loot inside',
  chest_found_uncommon:          'A treasure chest contained uncommon quality items',
  chest_found_rare:              'A treasure chest held rare quality gear',
  chest_found_epic:              'A treasure chest revealed epic quality loot',
  chest_found_legendary:         'A treasure chest contained a legendary item',
  gold_found_small:              'A small gold pickup was found (less than 100 gold)',
  gold_found_medium:             'A medium gold haul was discovered (100 to 500 gold)',
  gold_found_large:              'A large gold cache was found (500 or more gold)',
  inventory_full:                'The player\'s inventory is completely full — cannot carry more',
  item_sold:                     'The player sold an item at the merchant',
  item_equipped_upgrade:         'The player equipped a new item better than their previous gear',
  item_identified:               'An unidentified item was identified and its properties revealed',
  zone_enter_tier1:              'Entering a Tier 1 zone — beginner territory, gentle fields and simple dungeons',
  zone_enter_tier2:              'Entering a Tier 2 zone — early adventure with modest challenge',
  zone_enter_tier3:              'Entering a Tier 3 zone — mid-early difficulty, enemies are tougher',
  zone_enter_tier4:              'Entering a Tier 4 zone — solid midpoint challenge for seasoned fighters',
  zone_enter_tier5:              'Entering a Tier 5 zone — halfway through the danger scale',
  zone_enter_tier6:              'Entering a Tier 6 zone — high difficulty, veterans only',
  zone_enter_tier7:              'Entering a Tier 7 zone — very dangerous and demanding territory',
  zone_enter_tier8:              'Entering a Tier 8 zone — near the peak of mortal danger',
  zone_enter_tier9:              'Entering a Tier 9 zone — legendary difficulty, perilous lands',
  zone_enter_tier10:             'Entering a Tier 10 zone — absolute peak danger, god-tier enemies await',
  zone_clear:                    'The zone was fully cleared by defeating its boss',
  zone_first_clear:              'This zone was cleared for the very first time ever',
  floor_advance:                 'Moving to the next floor deeper into the dungeon',
  floor_boss_imminent:           'Only one more floor until the dungeon boss — tension rising',
  floor_complete_no_damage:      'The entire floor was cleared without taking any damage',
  room_rest:                     'A rest room was found where the player can recover HP',
  room_treasure:                 'A treasure room was discovered',
  room_merchant:                 'A traveling merchant appeared in the dungeon',
  room_trap_triggered:           'The player walked into a trap and took damage',
  room_trap_dodged:              'The player successfully dodged a dangerous trap',
  room_empty:                    'The room is empty — nothing of note here',
  room_secret_found:             'A hidden secret room was discovered',
  run_start:                     'A new adventure run is beginning',
  run_extract_success:           'The player chose to extract from the run, keeping all gathered loot',
  run_complete_boss:             'The player defeated the final boss and completed the run triumphantly',
  run_failed_death:              'The run ended in the player\'s death — loot bags are lost',
  shiny_enemy_appear:            'A rare shiny golden variant of an enemy has appeared',
  level_up_1_10:                 'The player leveled up while in the 1 to 10 level range',
  level_up_11_25:                'The player leveled up in the 11 to 25 range — getting stronger',
  level_up_26_50:                'The player leveled up in the 26 to 50 range — a capable adventurer',
  level_up_51_75:                'The player leveled up in the 51 to 75 range — veteran fighter',
  level_up_76_100:               'The player leveled up in the 76 to 100 range — approaching mastery',
  level_up_101_150:              'The player leveled up in the 101 to 150 range — legendary tier adventurer',
  level_up_151_200:              'The player leveled up in the 151 to 200 range — nearing the absolute level cap',
  level_milestone_50:            'The player reached exactly level 50 — a major milestone',
  level_milestone_100:           'The player reached level 100 exactly — halfway to the cap, an impressive achievement',
  level_milestone_200:           'The player reached level 200 — the absolute level cap, pinnacle of power',
  stat_point_str:                'The player allocated a stat point into Strength (STR)',
  stat_point_int:                'The player allocated a stat point into Intelligence (INT)',
  stat_point_agi:                'The player allocated a stat point into Agility (AGI)',
  stat_point_vit:                'The player allocated a stat point into Vitality (VIT)',
  stat_point_lck:                'The player allocated a stat point into Luck (LCK)',
  stat_point_cha:                'The player allocated a stat point into Charisma (CHA) — deepening the companion bond',
  prestige_1:                    'The player prestiged for the first time — reset to level 1 while keeping all gear and gold',
  prestige_2:                    'The player achieved their second prestige',
  prestige_3_plus:               'The player prestiged three or more times — a master of the endless cycle',
  first_legendary:               'The player found their very first legendary item ever',
  first_rare:                    'The player found their first-ever rare quality item',
  first_epic:                    'The player found their first-ever epic quality item',
  first_boss_kill:               'The player defeated their very first dungeon boss',
  first_shiny_kill:              'The player killed their first-ever shiny enemy variant',
  achievement_unlocked:          'The player just unlocked an achievement',
  bond_level_increase:           'The companion bond level increased — growing closer',
  bond_level_max:                'Maximum bond level reached — the deepest possible connection',
  companion_assist_miss:         'The companion attempted to assist but the attack missed',
  companion_tanks_hit:           'The companion intercepted a hit that would have struck the player',
  companion_low_bond_warning:    'A gentle warning that the companion bond level is low',
  zone_suggestion_offer:         'The companion is offering to suggest a good zone to adventure in',
  zone_suggestion_accepted:      'The player accepted the companion\'s zone suggestion',
  zone_suggestion_declined:      'The player declined the companion\'s zone suggestion',
  companion_comments_shiny:      'The companion reacts to spotting a rare shiny enemy variant',
  companion_comments_legendary:  'The companion reacts to a legendary item dropping — incredibly rare',
  companion_comments_boss_death: 'The companion reacts to the boss being defeated',
  companion_debrief_success:     'End-of-run debrief after the player successfully completed the run',
  companion_debrief_death:       'End-of-run debrief after the player was killed and lost their loot',
  companion_debrief_extract:     'End-of-run debrief after the player chose to extract safely with loot',
  daily_bonus_activated:         'The daily first-run bonus activated — first run of the day gets extra XP and gold',
  long_absence_return:           'The player has returned after not playing for 3 or more days',
  set_bonus_2pc:                 'A 2-piece armor set bonus activated for the first time this run',
  set_bonus_4pc:                 'The 4-piece armor set bonus activated',
  set_bonus_6pc:                 'The full 6-piece set bonus activated — maximum set power',
  chaos_orb_fires:               'The Chaos Orb trinket triggered a random magical effect',
  void_rune_banish:              'The Void Rune item instantly banished an enemy from existence',
  run_streak_3:                  'Third consecutive successful run — a winning streak',
  run_streak_7:                  'Seventh consecutive successful run — an extraordinary achievement',
  new_zone_tier_unlocked:        'A new zone tier became available as the player grew stronger',
  challenge_zone_enter:          'The player is entering a special challenge zone with harder rules',
  challenge_zone_clear:          'The player cleared a challenge zone — harder than normal, very impressive',
};

// ── Hardcoded fallback responses (5 per category, used when Claude unavailable) ─

const FALLBACKS = {
  battle: [
    { dialogue: 'Stay sharp.', emotion: 'determined', thoughts: null },
    { dialogue: 'We can handle this.', emotion: 'confident', thoughts: null },
    { dialogue: "Together we'll get through this.", emotion: 'soft_smile', thoughts: null },
    { dialogue: 'Eyes forward!', emotion: 'determined', thoughts: null },
    { dialogue: 'Keep pushing.', emotion: 'neutral', thoughts: null },
  ],
  loot: [
    { dialogue: 'Oh, nice find!', emotion: 'happy', thoughts: null },
    { dialogue: 'Something useful, at least.', emotion: 'neutral', thoughts: null },
    { dialogue: 'Worth keeping.', emotion: 'soft_smile', thoughts: null },
    { dialogue: 'Grab it, it looks good.', emotion: 'confident', thoughts: null },
    { dialogue: 'Could come in handy.', emotion: 'thinking', thoughts: null },
  ],
  zone: [
    { dialogue: "Let's see what awaits us.", emotion: 'confident', thoughts: null },
    { dialogue: 'Stay close to me in here.', emotion: 'soft_smile', thoughts: null },
    { dialogue: 'This place feels dangerous.', emotion: 'concerned', thoughts: null },
    { dialogue: 'Ready when you are.', emotion: 'neutral', thoughts: null },
    { dialogue: 'Another adventure begins.', emotion: 'happy', thoughts: null },
  ],
  level: [
    { dialogue: "You're getting stronger!", emotion: 'happy', thoughts: null },
    { dialogue: 'Look at you grow.', emotion: 'soft_smile', thoughts: null },
    { dialogue: 'Each level brings us closer.', emotion: 'confident', thoughts: null },
    { dialogue: 'Progress.', emotion: 'neutral', thoughts: null },
    { dialogue: 'Your hard work is paying off.', emotion: 'happy', thoughts: null },
  ],
  companion: [
    { dialogue: "I'm here with you.", emotion: 'soft_smile', thoughts: null },
    { dialogue: "We'll figure this out.", emotion: 'confident', thoughts: null },
    { dialogue: "Whatever happens, I've got your back.", emotion: 'determined', thoughts: null },
    { dialogue: 'Trust me on this.', emotion: 'confident', thoughts: null },
    { dialogue: "You're not alone in this.", emotion: 'happy', thoughts: null },
  ],
};

// ── Valid emotion IDs ──────────────────────────────────────────────────────────

const VALID_EMOTIONS = new Set([
  'neutral', 'happy', 'soft_smile', 'laughing', 'confident', 'smug', 'surprised',
  'shocked', 'confused', 'thinking', 'concerned', 'sad', 'angry', 'determined',
  'embarrassed', 'exhausted', 'pout', 'crying', 'lustful_desire',
]);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize narrator with DB and character directory.
 * Must be called before getResponse/generateResponsePool.
 */
function init(db, charDir) {
  _db  = db;
  _dir = charDir;
  console.log('[RPGNarrator] Initialized. Character dir:', charDir);
}

/**
 * Get a companion response for a scenario key.
 * Force-Claude keys always trigger a fresh real-time call.
 * All others: check pool, generate if empty, pick from pool.
 *
 * @param {string} scenarioKey
 * @param {object} [gameState] - Optional context: { zone, level, item, enemy, kills, floor, result, xp, gold }
 * @returns {Promise<{ dialogue: string, emotion: string, thoughts: string|null }>}
 */
async function getResponse(scenarioKey, gameState = {}) {
  if (!_db) {
    console.warn('[RPGNarrator] Not initialized — returning fallback');
    return _getFallback(scenarioKey);
  }

  // Force-Claude keys: always real-time, pool is fallback only
  if (FORCE_CLAUDE_KEYS.has(scenarioKey)) {
    try {
      return await _generateSingleResponse(scenarioKey, gameState);
    } catch (err) {
      console.warn('[RPGNarrator] Force-Claude failed, using pool/fallback:', err.message);
      // Fall through to pool
    }
  }

  // Pool check — generate if empty
  const count = _db.getResponseCount(scenarioKey);
  if (count === 0) {
    try {
      await generateResponsePool(scenarioKey, gameState);
    } catch (err) {
      console.warn('[RPGNarrator] Pool generation failed, using fallback:', err.message);
      return _getFallback(scenarioKey);
    }
  }

  // Pick from pool (avoid 5 most-recently-used)
  const picked = _db.pickResponse(scenarioKey, 5);
  if (!picked) return _getFallback(scenarioKey);
  return { dialogue: picked.dialogue, emotion: picked.emotion, thoughts: picked.thoughts };
}

/**
 * Generate a full response pool for a scenario key via Claude.
 * Stores all responses in the DB and logs the generation.
 *
 * @param {string} scenarioKey
 * @param {object} [gameState]
 * @returns {Promise<Array<{ dialogue, emotion, thoughts }>>}
 */
async function generateResponsePool(scenarioKey, gameState = {}) {
  const charData = _loadCharacter();
  const tier     = SCENARIO_TIER[scenarioKey] || 'low';
  const count    = TIER_TARGET[tier];
  const desc     = SCENARIO_DESC[scenarioKey] || scenarioKey;

  const { systemPrompt, userPrompt } = _buildBatchPrompt(charData, scenarioKey, desc, count);
  const responses = await _callClaude(systemPrompt, userPrompt, count);

  _db.addResponses(scenarioKey, responses);
  _db.setGenerationLog(scenarioKey, tier, count, responses.length);
  console.log(`[RPGNarrator] Generated ${responses.length}/${count} responses for key: ${scenarioKey}`);
  return responses;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _loadCharacter() {
  try {
    const charJson  = JSON.parse(fs.readFileSync(path.join(_dir, 'character.json'), 'utf-8'));
    const rulesJson = JSON.parse(fs.readFileSync(path.join(_dir, 'rules.json'), 'utf-8'));
    return { charJson, rulesJson };
  } catch (err) {
    console.warn('[RPGNarrator] Could not load character files:', err.message);
    return { charJson: { name: 'Companion' }, rulesJson: { rules: [] } };
  }
}

function _buildBatchPrompt({ charJson, rulesJson }, scenarioKey, desc, count) {
  const name        = charJson.name || 'Companion';
  const personality = charJson.personality_summary || charJson.personality || charJson.description || '';
  const speechStyle = charJson.speech_style || '';
  const rulesArr    = Array.isArray(rulesJson.rules) ? rulesJson.rules : [];
  const rulesText   = rulesArr.length ? '\nCharacter rules:\n' + rulesArr.map(r => `- ${r}`).join('\n') : '';

  const systemPrompt =
    `You generate companion dialogue for a classic fantasy RPG game.\n` +
    `The companion's name is ${name}.\n` +
    `Personality: ${personality}\n` +
    `Speech style: ${speechStyle}` +
    rulesText + '\n\n' +
    `Generate exactly ${count} distinct responses for the RPG event described.\n` +
    `Return ONLY a valid JSON array with no other text, no markdown fences, no preamble.\n` +
    `Each entry must have this exact format:\n` +
    `{ "dialogue": "...", "emotion": "...", "thoughts": "..." }\n\n` +
    `Valid emotions: neutral, happy, soft_smile, laughing, confident, smug, surprised, shocked, ` +
    `confused, thinking, concerned, sad, angry, determined, embarrassed, exhausted, pout, crying, lustful_desire\n\n` +
    `Requirements:\n` +
    `- All ${count} responses must sound like ${name} — their vocabulary, tone, and personality\n` +
    `- Vary the mood: some enthusiastic, some understated, some dramatic, some casual, some humorous\n` +
    `- Vary the length: some very short (one sentence), some medium (two to three sentences)\n` +
    `- Reference the game situation naturally — stay in character\n` +
    `- Avoid repeating phrases across responses\n` +
    `- The "thoughts" field is ${name}'s private thought (1-2 sentences). May be null if not needed.`;

  const userPrompt =
    `RPG EVENT: ${desc}\n` +
    `Generate exactly ${count} companion responses as a JSON array.`;

  return { systemPrompt, userPrompt };
}

async function _generateSingleResponse(scenarioKey, gameState) {
  const { charJson, rulesJson } = _loadCharacter();
  const name        = charJson.name || 'Companion';
  const personality = charJson.personality_summary || charJson.personality || charJson.description || '';
  const speechStyle = charJson.speech_style || '';
  const desc        = SCENARIO_DESC[scenarioKey] || scenarioKey;

  // Build game context lines
  const ctxLines = [];
  if (gameState.zone)   ctxLines.push(`Zone: ${gameState.zone}`);
  if (gameState.level)  ctxLines.push(`Player level: ${gameState.level}`);
  if (gameState.item)   ctxLines.push(`Item: ${gameState.item}`);
  if (gameState.enemy)  ctxLines.push(`Enemy: ${gameState.enemy}`);
  if (gameState.kills)  ctxLines.push(`Kills this run: ${gameState.kills}`);
  if (gameState.floor)  ctxLines.push(`Current floor: ${gameState.floor}`);
  if (gameState.result) ctxLines.push(`Run result: ${gameState.result}`);
  if (gameState.xp)     ctxLines.push(`XP gained: ${gameState.xp}`);
  if (gameState.gold)   ctxLines.push(`Gold earned: ${gameState.gold}`);
  const ctx = ctxLines.length ? '\nGame context:\n' + ctxLines.join('\n') : '';

  const systemPrompt =
    `You generate a single companion dialogue line for a classic fantasy RPG game.\n` +
    `The companion is ${name}. Personality: ${personality}. Speech style: ${speechStyle}\n\n` +
    `Return ONLY a valid JSON object with no other text:\n` +
    `{ "dialogue": "...", "emotion": "...", "thoughts": "..." }\n\n` +
    `Valid emotions: neutral, happy, soft_smile, laughing, confident, smug, surprised, shocked, ` +
    `confused, thinking, concerned, sad, angry, determined, embarrassed, exhausted, pout, crying, lustful_desire\n` +
    `The "thoughts" field may be null.`;

  const userPrompt = `RPG EVENT: ${desc}${ctx}\nGenerate one in-character response as a JSON object.`;

  const results = await _callClaude(systemPrompt, userPrompt, 1);
  if (results.length === 0) throw new Error('No valid response from Claude');
  return results[0];
}

/**
 * Spawn Claude CLI and return parsed array of { dialogue, emotion, thoughts } objects.
 */
async function _callClaude(systemPrompt, userPrompt, expectedCount) {
  const sysTmpPath = path.join(os.tmpdir(), `rpg_sys_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(sysTmpPath, systemPrompt, 'utf-8');

  const { cmd, prefix, shell } = _resolveClaudeSpawn();
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  delete cleanEnv.ELECTRON_NO_ASAR;
  delete cleanEnv.ELECTRON_RESOURCES_PATH;
  delete cleanEnv.VSCODE_PID;
  delete cleanEnv.VSCODE_IPC_HOOK;
  delete cleanEnv.VSCODE_HANDLES_UNCAUGHT_ERRORS;
  delete cleanEnv.VSCODE_NLS_CONFIG;

  const args = [
    ...prefix,
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', 'claude-haiku-4-5-20251001',
    '--system-prompt-file', sysTmpPath,
    '--dangerously-skip-permissions',
  ];

  const _cleanup = () => { try { fs.unlinkSync(sysTmpPath); } catch {} };

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      env:   cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(shell ? { shell: true } : {}),
    });

    proc.stdin.on('error', () => {});

    const msg = JSON.stringify({
      type:    'user',
      message: { role: 'user', content: [{ type: 'text', text: userPrompt }] },
    }) + '\n';
    proc.stdin.write(msg, () => proc.stdin.end());

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c.toString(); });
    proc.stderr.on('data', (c) => { stderr += c.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      _cleanup();
      reject(new Error('RPGNarrator: Claude timed out after 90s'));
    }, 90000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      _cleanup();

      if (code !== 0 && !stdout) {
        reject(new Error(`RPGNarrator: Claude exited code ${code}: ${stderr.slice(0, 300)}`));
        return;
      }

      try {
        const raw       = _extractRawText(stdout);
        const responses = _parseJsonResponses(raw, expectedCount);
        resolve(responses);
      } catch (err) {
        reject(new Error(`RPGNarrator: JSON parse failed — ${err.message}\nRaw: ${stdout.slice(0, 200)}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      _cleanup();
      reject(new Error(`RPGNarrator: spawn failed — ${err.message}`));
    });
  });
}

function _resolveClaudeSpawn() {
  if (process.platform === 'win32') {
    try {
      const cmdPath = execSync('where claude.cmd', { shell: true })
        .toString().trim().split(/\r?\n/)[0].trim();
      const scriptPath = path.join(
        path.dirname(cmdPath),
        'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'
      );
      if (fs.existsSync(scriptPath)) {
        return { cmd: 'node', prefix: [scriptPath], shell: false };
      }
    } catch {}
    return { cmd: 'claude.cmd', prefix: [], shell: true };
  }
  return { cmd: 'claude', prefix: [], shell: false };
}

function _extractRawText(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.result)  return obj.result;
      if (obj.content) return obj.content;
    } catch {}
  }
  return stdout.trim();
}

function _parseJsonResponses(raw, expectedCount) {
  // Strip markdown code fences if present
  const clean = raw.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // Try to extract JSON array or object from surrounding text
    const arrMatch = clean.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      parsed = JSON.parse(arrMatch[0]);
    } else {
      const objMatch = clean.match(/\{[\s\S]*\}/);
      if (objMatch) parsed = JSON.parse(objMatch[0]);
      else throw new Error('No JSON found in Claude response');
    }
  }

  // Normalize: single object → wrap in array
  if (!Array.isArray(parsed)) parsed = [parsed];

  return parsed
    .filter(r => r && typeof r.dialogue === 'string' && r.dialogue.trim())
    .slice(0, Math.max(expectedCount * 2, 10)) // generous cap to handle extras
    .map(r => ({
      dialogue: r.dialogue.trim(),
      emotion:  VALID_EMOTIONS.has(r.emotion) ? r.emotion : 'neutral',
      thoughts: (r.thoughts && r.thoughts.trim()) ? r.thoughts.trim() : null,
    }));
}

function _getFallback(scenarioKey) {
  let cat = 'companion';
  if (scenarioKey.startsWith('battle_'))                                                        cat = 'battle';
  else if (scenarioKey.startsWith('loot_') || scenarioKey.startsWith('chest_') ||
           scenarioKey.startsWith('gold_') || scenarioKey.startsWith('item_'))                  cat = 'loot';
  else if (scenarioKey.startsWith('zone_') || scenarioKey.startsWith('room_') ||
           scenarioKey.startsWith('floor_') || scenarioKey.startsWith('run_') ||
           scenarioKey.startsWith('shiny_'))                                                    cat = 'zone';
  else if (scenarioKey.startsWith('level_') || scenarioKey.startsWith('stat_') ||
           scenarioKey.startsWith('prestige_') || scenarioKey.startsWith('first_') ||
           scenarioKey.startsWith('achievement_'))                                              cat = 'level';

  const pool = FALLBACKS[cat] || FALLBACKS.companion;
  return { ...pool[Math.floor(Math.random() * pool.length)] };
}

module.exports = { init, getResponse, generateResponsePool };
