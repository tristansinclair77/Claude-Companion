'use strict';

// ── RPG Achievements — Phase 6 ────────────────────────────────────────────────
// Achievement engine: metadata, condition checking, progress tracking.
// Metadata is embedded here; unlock state and progress live in SQLite.

const { ZONES } = require('./rpg-constants');

// ── Achievement Metadata ───────────────────────────────────────────────────────
// id → { name, bracket, icon, desc, hidden, target }
// target: 1 for one-time events; N for count-based (progress bar shown)
const ACHIEVEMENT_META = {
  // ── EASY ─────────────────────────────────────────────────────────────────
  first_blood:       { name:'First Blood',        bracket:'easy', icon:'⚔',  desc:'Win your first combat encounter.',                            hidden:false, target:1 },
  into_the_dungeon:  { name:'Into the Dungeon',   bracket:'easy', icon:'🏰', desc:'Complete your first floor.',                                  hidden:false, target:1 },
  the_first_zone:    { name:'The First Zone',     bracket:'easy', icon:'🗺', desc:'Clear a Tier 1 zone for the first time.',                     hidden:false, target:1 },
  something_better:  { name:'Something Better',   bracket:'easy', icon:'🎁', desc:'Find your first non-Common item.',                            hidden:false, target:1 },
  worthy_blade:      { name:'A Worthy Blade',     bracket:'easy', icon:'🗡', desc:'Find your first Rare item.',                                  hidden:false, target:1 },
  boss_slain:        { name:'Boss Slain',         bracket:'easy', icon:'💀', desc:'Defeat your first boss.',                                     hidden:false, target:1 },
  good_omen:         { name:'A Good Omen',        bracket:'easy', icon:'✦', desc:'Encounter your first shiny enemy.',                           hidden:false, target:1 },
  growing_up:        { name:'Growing Up',         bracket:'easy', icon:'⬆', desc:'Reach character level 10.',                                   hidden:false, target:1 },
  adventure_begins:  { name:'Adventure Begins',   bracket:'easy', icon:'🌅', desc:'Take the companion into their first zone run.',               hidden:false, target:1 },
  companions_aid:    { name:"Companion's Aid",    bracket:'easy', icon:'♦', desc:'Receive your first companion assist during combat.',           hidden:false, target:1 },
  hidden_treasure:   { name:'Hidden Treasure',    bracket:'easy', icon:'🔑', desc:'Discover your first secret room.',                            hidden:false, target:1 },
  the_merchant:      { name:'The Merchant',       bracket:'easy', icon:'💰', desc:'Visit your first merchant room inside a zone run.',           hidden:false, target:1 },
  set_piece:         { name:'Set Piece',          bracket:'easy', icon:'🛡', desc:'Collect your first gear set piece.',                          hidden:false, target:1 },
  close_call:        { name:'Close Call',         bracket:'easy', icon:'❤', desc:'Win a combat encounter at 5% HP or below.',                  hidden:false, target:1 },
  goblin_slayer:     { name:'Goblin Slayer',      bracket:'easy', icon:'👺', desc:'Kill 100 Goblinoid enemies (lifetime total).',               hidden:false, target:100 },
  bone_collector:    { name:'Bone Collector',     bracket:'easy', icon:'💀', desc:'Kill 100 Undead enemies (lifetime total).',                  hidden:false, target:100 },
  living_dangerously:{ name:'Living Dangerously', bracket:'easy', icon:'🏃', desc:'Successfully flee from 10 combats (lifetime total).',        hidden:false, target:10  },
  flawless_victory:  { name:'Flawless Victory',   bracket:'easy', icon:'⭐', desc:'Win a combat encounter without taking any damage.',           hidden:false, target:1 },
  into_the_depths:   { name:'Into the Depths',    bracket:'easy', icon:'🌋', desc:'Clear a Tier 3 zone for the first time.',                    hidden:false, target:1 },
  first_set_bonus:   { name:'First Set Bonus',    bracket:'easy', icon:'✨', desc:'Have a 2-piece gear set bonus active simultaneously.',       hidden:false, target:1 },

  // ── MID ──────────────────────────────────────────────────────────────────
  five_hundred_fallen: { name:'Five Hundred Fallen', bracket:'mid', icon:'💀', desc:'Kill 500 enemies (lifetime total).',               hidden:false, target:500 },
  boss_hunter:         { name:'Boss Hunter',          bracket:'mid', icon:'🎯', desc:'Defeat 25 bosses (lifetime total).',               hidden:false, target:25  },
  purple_rain:         { name:'Purple Rain',          bracket:'mid', icon:'💜', desc:'Find your first Epic item.',                       hidden:false, target:1   },
  legendary_drop:      { name:'Legendary Drop',       bracket:'mid', icon:'🌟', desc:'Find your first Legendary item.',                  hidden:false, target:1   },
  full_set:            { name:'Full Set',             bracket:'mid', icon:'🏆', desc:'Have all pieces of a gear set equipped with all bonuses active.',  hidden:false, target:1 },
  shiny_hunter:        { name:'Shiny Hunter',         bracket:'mid', icon:'✦', desc:'Kill 25 shiny enemies (lifetime total).',          hidden:false, target:25  },
  forgotten_lands:     { name:'Forgotten Lands',      bracket:'mid', icon:'🗺', desc:'Clear a Tier 5 zone for the first time.',          hidden:false, target:1   },
  thousand_floors:     { name:'Thousand Floors',      bracket:'mid', icon:'📜', desc:'Clear 1,000 floors total (lifetime).',             hidden:false, target:1000 },
  companion_partner:   { name:'Companion Partner',    bracket:'mid', icon:'♦', desc:'Companion assist delivers the killing blow 100 times (lifetime).',  hidden:false, target:100 },
  zone_collector:      { name:'Zone Collector',       bracket:'mid', icon:'🗺', desc:'Visit every zone in Tiers 1–5 at least once.',    hidden:false, target:1   },
  no_retreat:          { name:'No Retreat',           bracket:'mid', icon:'🛡', desc:'Complete a full run without fleeing any combat.',  hidden:false, target:1   },
  gold_hoard:          { name:'Gold Hoard',           bracket:'mid', icon:'💰', desc:'Accumulate 100,000 gold total (lifetime earnings).',hidden:false, target:100000 },
  perfect_run:         { name:'Perfect Run',          bracket:'mid', icon:'⭐', desc:'Win 10 consecutive combats without taking damage in a single run.', hidden:false, target:1 },
  five_thousand_enemies: { name:'Five Thousand Enemies', bracket:'mid', icon:'💀', desc:'Kill 5,000 enemies (lifetime total).',         hidden:false, target:5000 },
  set_collector:       { name:'Set Collector',        bracket:'mid', icon:'🏆', desc:'Complete 3 different full gear sets across your history.', hidden:false, target:3 },
  bonded:              { name:'Bonded',               bracket:'mid', icon:'💖', desc:'Reach base CHA 50 (allocated stat points only).', hidden:false, target:1   },
  ancient_domain:      { name:'Ancient Domain',       bracket:'mid', icon:'🌋', desc:'Clear a Tier 7 zone for the first time.',          hidden:false, target:1   },
  reborn:              { name:'Reborn',               bracket:'mid', icon:'🔄', desc:'Achieve your first Prestige.',                     hidden:false, target:1   },
  deathless:           { name:'Deathless',            bracket:'mid', icon:'🛡', desc:'Complete an entire zone run without the player dying.', hidden:false, target:1 },
  legendary_hoard:     { name:'Legendary Hoard',      bracket:'mid', icon:'🌟', desc:'Own 5 different Legendary items simultaneously.',  hidden:false, target:1   },

  // ── HARD ─────────────────────────────────────────────────────────────────
  ten_thousand_dead:    { name:'Ten Thousand Dead',    bracket:'hard', icon:'💀', desc:'Kill 10,000 enemies (lifetime total).',            hidden:false, target:10000  },
  boss_slayer:          { name:'Boss Slayer',          bracket:'hard', icon:'🎯', desc:'Defeat 100 bosses (lifetime total).',              hidden:false, target:100   },
  shiny_obsession:      { name:'Shiny Obsession',      bracket:'hard', icon:'✦', desc:'Kill 100 shiny enemies (lifetime total).',         hidden:false, target:100   },
  edge_of_world:        { name:'Edge of the World',    bracket:'hard', icon:'🌋', desc:'Clear a Tier 9 zone for the first time.',          hidden:false, target:1     },
  the_final_frontier:   { name:'The Final Frontier',   bracket:'hard', icon:'🌟', desc:'Clear a Tier 10 zone for the first time.',         hidden:false, target:1     },
  ten_thousand_floors:  { name:'Ten Thousand Floors',  bracket:'hard', icon:'📜', desc:'Clear 10,000 floors total (lifetime).',            hidden:false, target:10000 },
  world_tour:           { name:'World Tour',           bracket:'hard', icon:'🗺', desc:'Visit every zone in Tiers 1–10 at least once.',   hidden:false, target:1     },
  naked_run:            { name:'Naked Run',            bracket:'hard', icon:'🤺', desc:'Complete a full run with no gear equipped at any point.', hidden:false, target:1 },
  zero_damage_run:      { name:'Zero Damage Run',      bracket:'hard', icon:'💎', desc:'Complete an entire run without taking any damage.', hidden:false, target:1   },
  conqueror:            { name:'Conqueror',            bracket:'hard', icon:'👑', desc:'Achieve Prestige 5.',                              hidden:false, target:1     },
  million_in_gold:      { name:'Million in Gold',      bracket:'hard', icon:'💰', desc:'Accumulate 1,000,000 gold total (lifetime earnings).', hidden:false, target:1000000 },
  eternal_companion:    { name:'Eternal Companion',    bracket:'hard', icon:'♦', desc:'Companion assists fire 1,000 times (lifetime).',   hidden:false, target:1000  },
  prestige_master:      { name:'Prestige Master',      bracket:'hard', icon:'👑', desc:'Achieve Prestige 10.',                             hidden:false, target:1     },
  gauntlet_victor:      { name:'Gauntlet Victor',      bracket:'hard', icon:'⚔', desc:'Clear the Gauntlet challenge zone.',               hidden:false, target:1     },
  arena_champion:       { name:'Arena Champion',       bracket:'hard', icon:'🏟', desc:'Survive 50 waves in the Arena challenge zone.',    hidden:false, target:1     },
  legendary_collector:  { name:'Legendary Collector',  bracket:'hard', icon:'🌟', desc:'Own 20 different Legendary items (tracked lifetime).', hidden:false, target:20 },
  hundred_thousand_dead:{ name:'Hundred Thousand Dead',bracket:'hard', icon:'💀', desc:'Kill 100,000 enemies (lifetime total).',           hidden:false, target:100000 },
  true_legend:          { name:'True Legend',          bracket:'hard', icon:'👑', desc:'Achieve Prestige 20.',                             hidden:false, target:1     },
  second_wind:          { name:'Second Wind',          bracket:'hard', icon:'💨', desc:'Win 3 combats in a row at 1 HP in a single run.',  hidden:true,  target:1     },
  completionist:        { name:'Completionist',        bracket:'hard', icon:'🏆', desc:'Unlock all other achievements.',                   hidden:false, target:1     },
};

const ALL_IDS = Object.keys(ACHIEVEMENT_META);
const TOTAL   = ALL_IDS.length; // 60

// Zone IDs in tiers 1-5 and 1-10 (computed once at load)
const ZONE_IDS_T1_5 = ZONES.filter(z => z.tier >= 1 && z.tier <= 5).map(z => z.id);
const ZONE_IDS_ALL  = ZONES.map(z => z.id);

// ── Module state ──────────────────────────────────────────────────────────────

let _db = null;

// In-run tracker — reset each run start
let _rt = null;

function init(db) {
  _db = db;
}

function resetRun(opts = {}) {
  _rt = {
    tookAnyDamage:           false,
    fled:                    false,
    consecutivePerfectKills: 0,
    maxPerfectKillsInRow:    0,
    companionKillingBlows:   0,
    startedWithNoGear:       opts.startedWithNoGear || false,
    // H19: Second Wind — win 3 fights after surviving at exactly 1HP in same run
    lastHpWas1:              false,
    winsAfter1Hp:            0,
    // E09: Adventure Begins — is this the first ever run?
    isFirstRun:              opts.isFirstRun || false,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Process a batch of events emitted by the engine.
 * Called after every take-action or advance-floor.
 * @returns {Array<{id,name,bracket}>} newly unlocked achievements
 */
function processEvents(events, runState, char) {
  if (!_db || !events || !_rt) return [];
  const unlocked = [];

  for (const ev of events) {
    _handleEvent(ev, runState, char, unlocked);
  }

  return unlocked;
}

/**
 * Called at end of run (after DB commit).
 * @param {string} result - 'success' | 'extract' | 'death'
 * @param {object} runState - final run state (activeRun before null)
 * @param {object} char - fresh char row from DB (post-commit)
 */
function onRunEnd(result, runState, char, committedLootIds = []) {
  if (!_db || !_rt) return [];
  const unlocked = [];
  const zone     = runState.zone;
  const tier     = zone ? zone.tier : 0;
  const floors   = (runState.floors || []).filter(f => f.completed).length;
  const isDeath  = result === 'death';
  const isSuccess = result === 'success';

  // ── E09 Adventure Begins ──────────────────────────────────────────────────
  if (_rt.isFirstRun) {
    _tryUnlock('adventure_begins', unlocked);
  }

  // ── E03 The First Zone (tier 1 success) ───────────────────────────────────
  if (isSuccess && tier === 1) _tryUnlock('the_first_zone', unlocked);

  // ── E19 Into the Depths (tier 3) ──────────────────────────────────────────
  if (isSuccess && tier >= 3) _tryUnlock('into_the_depths', unlocked);

  // ── M07 Forgotten Lands (tier 5) ─────────────────────────────────────────
  if (isSuccess && tier >= 5) _tryUnlock('forgotten_lands', unlocked);

  // ── M17 Ancient Domain (tier 7) ──────────────────────────────────────────
  if (isSuccess && tier >= 7) _tryUnlock('ancient_domain', unlocked);

  // ── H04 Edge of the World (tier 9) ───────────────────────────────────────
  if (isSuccess && tier >= 9) _tryUnlock('edge_of_world', unlocked);

  // ── H05 The Final Frontier (tier 10) ─────────────────────────────────────
  if (isSuccess && tier === 10) _tryUnlock('the_final_frontier', unlocked);

  // ── H14 Gauntlet Victor ───────────────────────────────────────────────────
  if (isSuccess && zone && zone.id === 'gauntlet') _tryUnlock('gauntlet_victor', unlocked);

  // ── H15 Arena Champion ────────────────────────────────────────────────────
  // Arena is a special "survive N waves" challenge — flag comes from runState
  if (zone && zone.id === 'arena' && (runState.wavesCleared || 0) >= 50) {
    _tryUnlock('arena_champion', unlocked);
  }

  // ── M11 No Retreat (success, never fled) ─────────────────────────────────
  if ((isSuccess || result === 'extract') && !_rt.fled) {
    _tryUnlock('no_retreat', unlocked);
  }

  // ── M19 Deathless (success, player never died) ───────────────────────────
  if (isSuccess && !isDeath) _tryUnlock('deathless', unlocked);

  // ── H08 Naked Run (success, started with no gear, never bought any) ───────
  if (isSuccess && _rt.startedWithNoGear && !_rt.gainedGearDuringRun) {
    _tryUnlock('naked_run', unlocked);
  }

  // ── H09 Zero Damage Run (success, took zero damage all run) ──────────────
  if (isSuccess && !_rt.tookAnyDamage) _tryUnlock('zero_damage_run', unlocked);

  // ── M13 Perfect Run (10 consecutive perfect kills in this run) ───────────
  if (_rt.maxPerfectKillsInRow >= 10) _tryUnlock('perfect_run', unlocked);

  // ── H19 Second Wind (3 wins in a row after 1 HP) ─────────────────────────
  if (_rt.winsAfter1Hp >= 3) _tryUnlock('second_wind', unlocked);

  // ── M08 / H06 Floor milestones ────────────────────────────────────────────
  if (floors > 0) {
    const prev = _getProgress('thousand_floors');
    const next = prev + floors;
    _setProgress('thousand_floors', next);
    _setProgress('ten_thousand_floors', next);
    if (next >= 1000)  _tryUnlock('thousand_floors', unlocked);
    if (next >= 10000) _tryUnlock('ten_thousand_floors', unlocked);
  }

  // ── M12 / H11 Gold milestones ────────────────────────────────────────────
  // Sum lifetime gold from run_history (post-commit)
  try {
    const row = _db.db
      .prepare('SELECT COALESCE(SUM(gold_earned),0) AS total FROM rpg_run_history')
      .get();
    const lifetime = row ? row.total : 0;
    _setProgress('gold_hoard',    lifetime);
    _setProgress('million_in_gold', lifetime);
    if (lifetime >= 100000)   _tryUnlock('gold_hoard', unlocked);
    if (lifetime >= 1000000)  _tryUnlock('million_in_gold', unlocked);
  } catch (_) { /* ignore */ }

  // ── M10 Zone Collector (all tier 1-5 zones visited at least once) ─────────
  try {
    const rows = _db.db
      .prepare('SELECT DISTINCT zone_id FROM rpg_run_history')
      .all();
    const visited = new Set(rows.map(r => r.zone_id));
    if (ZONE_IDS_T1_5.every(id => visited.has(id))) {
      _tryUnlock('zone_collector', unlocked);
    }
    // ── H07 World Tour ─────────────────────────────────────────────────────
    if (ZONE_IDS_ALL.every(id => visited.has(id))) {
      _tryUnlock('world_tour', unlocked);
    }
  } catch (_) { /* ignore */ }

  // ── M20 Legendary Hoard (own 5 legendaries simultaneously) ───────────────
  try {
    const row = _db.db
      .prepare("SELECT COUNT(*) AS cnt FROM rpg_inventory WHERE rarity='legendary'")
      .get();
    if (row && row.cnt >= 5) _tryUnlock('legendary_hoard', unlocked);
  } catch (_) { /* ignore */ }

  // ── H16 Legendary Collector (20 different legendaries lifetime) ───────────
  // We track via progress (increment each time a new legendary is committed)
  if (committedLootIds.length > 0) {
    try {
      const placeholders = committedLootIds.map(() => '?').join(',');
      const rows = _db.db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM rpg_inventory WHERE id IN (${placeholders}) AND rarity='legendary'`
        )
        .get(committedLootIds);
      if (rows && rows.cnt > 0) {
        const prev = _getProgress('legendary_collector');
        const next = prev + rows.cnt;
        _setProgress('legendary_collector', next);
        if (next >= 20) _tryUnlock('legendary_collector', unlocked);
      }
    } catch (_) { /* ignore */ }
  }

  // ── H20 Completionist ────────────────────────────────────────────────────
  _checkCompletionist(unlocked);

  return unlocked;
}

/**
 * Called after equip-item IPC.
 * @param {Array} equippedRows - rows from rpgDb.getEquipped()
 */
function onEquip(equippedRows, char) {
  if (!_db) return [];
  const unlocked = [];

  const equipped = equippedRows.filter(r => r.inventory_id && r.set_id);
  if (equipped.length === 0) return [];

  // Count set pieces per set_id
  const setCounts = {};
  for (const r of equipped) {
    if (r.set_id) setCounts[r.set_id] = (setCounts[r.set_id] || 0) + 1;
  }

  // ── E20 First Set Bonus (2+ pieces from same set) ─────────────────────
  if (Object.values(setCounts).some(n => n >= 2)) {
    _tryUnlock('first_set_bonus', unlocked);
  }

  // ── M05 Full Set (all pieces of any single set) ───────────────────────
  // Check if all inventory items of a set are equipped simultaneously.
  // We approximate: if a set has N possible slots and all N are equipped.
  // Use gear_sets data if available; otherwise treat 4+ pieces as "full".
  if (Object.values(setCounts).some(n => n >= 4)) {
    _tryUnlock('full_set', unlocked);
  }

  // ── M15 Set Collector (3 distinct full-set completions, tracked via progress) ──
  // Increment when full_set unlocks for a new set
  // (We track this event in _rt so it doesn't double-count within a run)
  // Simple approximation: progress counts how many times full_set was first achieved
  // Left as a future refinement — set_collector not tracked per-set here

  _checkCompletionist(unlocked);
  return unlocked;
}

/**
 * Called after prestige IPC (with the new prestige_count).
 */
function onPrestige(newPrestigeCount) {
  if (!_db) return [];
  const unlocked = [];

  // ── M18 Reborn (first prestige) ──────────────────────────────────────────
  _tryUnlock('reborn', unlocked);

  // ── H10 Conqueror (prestige 5) ────────────────────────────────────────────
  if (newPrestigeCount >= 5)  _tryUnlock('conqueror', unlocked);

  // ── H13 Prestige Master (prestige 10) ────────────────────────────────────
  if (newPrestigeCount >= 10) _tryUnlock('prestige_master', unlocked);

  // ── H18 True Legend (prestige 20) ────────────────────────────────────────
  if (newPrestigeCount >= 20) _tryUnlock('true_legend', unlocked);

  _checkCompletionist(unlocked);
  return unlocked;
}

/**
 * Called after allocate-stat IPC.
 * @param {object} char - freshly read character row
 */
function onStatAllocate(char) {
  if (!_db) return [];
  const unlocked = [];

  // ── M16 Bonded (base CHA 50) ─────────────────────────────────────────────
  if (char.cha >= 50) _tryUnlock('bonded', unlocked);

  _checkCompletionist(unlocked);
  return unlocked;
}

/**
 * Return all 60 achievements merged with DB state.
 * progress is returned as 0–100 percentage for the UI progress bar.
 */
function getAll() {
  if (!_db) return _defaultAll();
  const rows   = _db.getAllAchievements();
  const rowMap = {};
  for (const r of rows) rowMap[r.achievement_id] = r;

  return ALL_IDS.map(id => {
    const meta = ACHIEVEMENT_META[id];
    const row  = rowMap[id] || { achievement_id: id, unlocked: 0, progress: 0, unlocked_at: null };
    const raw  = row.progress || 0;
    const pct  = meta.target > 1 && raw > 0
      ? Math.min(100, Math.floor(raw / meta.target * 100))
      : 0;
    return {
      achievement_id: id,
      name:           meta.name,
      bracket:        meta.bracket,
      icon:           meta.icon,
      desc:           meta.desc,
      hidden:         meta.hidden,
      target:         meta.target,
      unlocked:       row.unlocked,
      progress:       pct,      // percentage for UI
      progressRaw:    raw,
      unlocked_at:    row.unlocked_at,
    };
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _handleEvent(ev, runState, char, unlocked) {
  const type = ev && ev.type;
  if (!type) return;

  // ── Enemy died ─────────────────────────────────────────────────────────────
  if (type === 'enemy_died') {
    const enemy     = ev.enemy || {};
    const isShiny   = enemy.isShiny;
    const isBoss    = enemy.isBoss;
    const archetype = (enemy.archetype || '').toLowerCase();

    // E01 First Blood (any kill)
    _tryUnlock('first_blood', unlocked);

    // E02 Into the Dungeon (any floor cleared — combat floors clear on kill)
    _tryUnlock('into_the_dungeon', unlocked);

    // E06 Boss Slain / M02 Boss Hunter / H02 Boss Slayer
    if (isBoss) {
      _tryUnlock('boss_slain', unlocked);
      const bossKills = _incProgress('boss_hunter', 1);
      _setProgress('boss_slayer', bossKills);
      if (bossKills >= 25)  _tryUnlock('boss_hunter', unlocked);
      if (bossKills >= 100) _tryUnlock('boss_slayer', unlocked);
    }

    // E07 Good Omen / M06 Shiny Hunter / H03 Shiny Obsession
    if (isShiny) {
      _tryUnlock('good_omen', unlocked);
      const shinyKills = _incProgress('shiny_hunter', 1);
      _setProgress('shiny_obsession', shinyKills);
      if (shinyKills >= 25)  _tryUnlock('shiny_hunter', unlocked);
      if (shinyKills >= 100) _tryUnlock('shiny_obsession', unlocked);
    }

    // E15 Goblin Slayer
    if (archetype === 'goblinoid') {
      const gKills = _incProgress('goblin_slayer', 1);
      if (gKills >= 100) _tryUnlock('goblin_slayer', unlocked);
    }

    // E16 Bone Collector
    if (archetype === 'undead') {
      const uKills = _incProgress('bone_collector', 1);
      if (uKills >= 100) _tryUnlock('bone_collector', unlocked);
    }

    // Kill milestones — total_kills updated pre-call; add run kills for current run
    const totalKills = (char.total_kills || 0) + (runState.kills || 0);
    _setProgress('five_hundred_fallen',   totalKills);
    _setProgress('five_thousand_enemies', totalKills);
    _setProgress('ten_thousand_dead',     totalKills);
    _setProgress('hundred_thousand_dead', totalKills);
    if (totalKills >= 500)    _tryUnlock('five_hundred_fallen', unlocked);
    if (totalKills >= 5000)   _tryUnlock('five_thousand_enemies', unlocked);
    if (totalKills >= 10000)  _tryUnlock('ten_thousand_dead', unlocked);
    if (totalKills >= 100000) _tryUnlock('hundred_thousand_dead', unlocked);

    // E08 Growing Up — also handled by level_up event; covered here for existing chars
    if ((char.level || 1) >= 10) _tryUnlock('growing_up', unlocked);

    // E14 Close Call: if hp was at or below 5% when we killed the enemy
    if (_rt._closeCallHp && runState.playerHp > 0) {
      _tryUnlock('close_call', unlocked);
      _rt._closeCallHp = false;
    }

    // H19 Second Wind: win a fight when hp was exactly 1 last damage event
    if (_rt.lastHpWas1) {
      _rt.winsAfter1Hp++;
      _rt.lastHpWas1 = false;
    }

    return;
  }

  // ── Perfect kill (no damage taken on floor) ──────────────────────────────
  if (type === 'perfect_kill') {
    _tryUnlock('flawless_victory', unlocked);
    _rt.consecutivePerfectKills++;
    if (_rt.consecutivePerfectKills > _rt.maxPerfectKillsInRow) {
      _rt.maxPerfectKillsInRow = _rt.consecutivePerfectKills;
    }
    return;
  }

  // ── Enemy attack (player took damage) ────────────────────────────────────
  if (type === 'enemy_attack') {
    if (ev.hit && (ev.damage || 0) > 0) {
      _rt.tookAnyDamage = true;
      _rt.consecutivePerfectKills = 0;
      // Flag for Close Call + Second Wind — checked on enemy_died
      if (runState && runState.playerMaxHp) {
        const hpPct = (runState.playerHp || 0) / runState.playerMaxHp;
        if (hpPct <= 0.05 && runState.playerHp > 0) _rt._closeCallHp = true;
        if (runState.playerHp === 1) _rt.lastHpWas1 = true;
      }
    }
    return;
  }

  // ── Loot drop ────────────────────────────────────────────────────────────
  if (type === 'loot_drop') {
    const rarity = (ev.rarity || '').toLowerCase();
    const item   = ev.loot && ev.loot.item;
    const setId  = item && item.set_id;

    if (rarity !== 'common')                                        _tryUnlock('something_better', unlocked);
    if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') _tryUnlock('worthy_blade', unlocked);
    if (setId)                                                      _tryUnlock('set_piece', unlocked);
    if (rarity === 'epic' || rarity === 'legendary')                _tryUnlock('purple_rain', unlocked);
    if (rarity === 'legendary')                                     _tryUnlock('legendary_drop', unlocked);
    return;
  }

  // ── Level up ─────────────────────────────────────────────────────────────
  if (type === 'level_up') {
    if ((ev.newLevel || 0) >= 10) _tryUnlock('growing_up', unlocked);
    return;
  }

  // ── Companion assist ──────────────────────────────────────────────────────
  if (type === 'companion_assist') {
    _tryUnlock('companions_aid', unlocked);
    const assists = _incProgress('eternal_companion', 1);
    if (assists >= 1000) _tryUnlock('eternal_companion', unlocked);
    if (ev.isKillingBlow) {
      const kbTotal = _incProgress('companion_partner', 1);
      if (kbTotal >= 100) _tryUnlock('companion_partner', unlocked);
    }
    return;
  }

  // ── Flee success ──────────────────────────────────────────────────────────
  if (type === 'fled_success') {
    _rt.fled = true;
    const flees = _incProgress('living_dangerously', 1);
    if (flees >= 10) _tryUnlock('living_dangerously', unlocked);
    return;
  }

  // ── Room entered ─────────────────────────────────────────────────────────
  if (type === 'room_entered') {
    const rt = ev.roomType;
    // E02 Into the Dungeon for non-combat rooms (they complete immediately)
    if (rt === 'rest' || rt === 'treasure' || rt === 'secret' || rt === 'trap' || rt === 'empty') {
      _tryUnlock('into_the_dungeon', unlocked);
    }
    if (rt === 'secret')   _tryUnlock('hidden_treasure', unlocked);
    if (rt === 'merchant') _tryUnlock('the_merchant', unlocked);
    return;
  }

  // ── Shiny appeared ────────────────────────────────────────────────────────
  if (type === 'shiny_appeared') {
    _tryUnlock('good_omen', unlocked);
    return;
  }

  // ── Merchant bought (gainedGearDuringRun for H08 Naked Run) ──────────────
  if (type === 'item_purchased') {
    if (_rt) _rt.gainedGearDuringRun = true;
    return;
  }
}

function _tryUnlock(id, unlocked) {
  if (!ACHIEVEMENT_META[id]) return;
  if (_isUnlocked(id)) return;
  _db.unlockAchievement(id);
  unlocked.push({ id, name: ACHIEVEMENT_META[id].name, bracket: ACHIEVEMENT_META[id].bracket });
}

function _isUnlocked(id) {
  const row = _db.getAchievement(id);
  return row && row.unlocked === 1;
}

/** Increment progress by amount, return new total. */
function _incProgress(id, amount) {
  const cur  = _getProgress(id);
  const next = cur + amount;
  _db.updateAchievementProgress(id, next);
  return next;
}

/** Overwrite progress only if new value is higher. */
function _setProgress(id, value) {
  const cur = _getProgress(id);
  if (value > cur) _db.updateAchievementProgress(id, value);
}

function _getProgress(id) {
  const row = _db.getAchievement(id);
  return row ? (row.progress || 0) : 0;
}

function _checkCompletionist(unlocked) {
  // Don't count 'completionist' itself
  const others = ALL_IDS.filter(id => id !== 'completionist');
  const allDone = others.every(id => _isUnlocked(id));
  if (allDone) _tryUnlock('completionist', unlocked);
}

function _defaultAll() {
  return ALL_IDS.map(id => {
    const meta = ACHIEVEMENT_META[id];
    return {
      achievement_id: id,
      name:     meta.name,
      bracket:  meta.bracket,
      icon:     meta.icon,
      desc:     meta.desc,
      hidden:   meta.hidden,
      target:   meta.target,
      unlocked: 0,
      progress: 0,
      progressRaw: 0,
      unlocked_at: null,
    };
  });
}

module.exports = { init, resetRun, processEvents, onRunEnd, onEquip, onPrestige, onStatAllocate, getAll };
