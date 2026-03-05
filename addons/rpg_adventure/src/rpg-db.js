'use strict';

const path   = require('path');
const fs     = require('fs');
const Database = require('better-sqlite3');

const SCHEMA_VERSION = 2;

/**
 * RpgDB — SQLite database for the RPG addon.
 * Stored at: characters/<active>/rpg.db
 */
class RpgDB {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  open() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
    } catch (err) {
      // WAL/SHM files from a crashed session can cause disk I/O errors.
      // Delete them and retry with a fresh open.
      console.warn('[RpgDB] Open failed, attempting WAL recovery:', err.message);
      for (const suffix of ['-shm', '-wal']) {
        const f = this.dbPath + suffix;
        if (fs.existsSync(f)) { try { fs.unlinkSync(f); } catch (_) {} }
      }
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      console.log('[RpgDB] Recovered from WAL error.');
    }

    this._migrate();
    console.log('[RpgDB] Opened:', this.dbPath);
    return this;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ── Migration ────────────────────────────────────────────────────────────

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rpg_meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    const row = this.db
      .prepare(`SELECT value FROM rpg_meta WHERE key = 'schema_version'`)
      .get();
    const current = row ? parseInt(row.value, 10) : 0;

    if (current < 1) {
      this._applyV1();
    }
    if (current < 2) {
      this._applyV2();
    }
    this.db
      .prepare(`INSERT OR REPLACE INTO rpg_meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')`)
      .run();
  }

  _applyV1() {
    this.db.exec(`
      -- ── Character stats and progression ─────────────────────────────────
      CREATE TABLE IF NOT EXISTS rpg_character (
        id              INTEGER PRIMARY KEY CHECK (id = 1),
        level           INTEGER NOT NULL DEFAULT 1,
        xp              INTEGER NOT NULL DEFAULT 0,
        stat_points     INTEGER NOT NULL DEFAULT 0,
        str             INTEGER NOT NULL DEFAULT 5,
        int             INTEGER NOT NULL DEFAULT 5,
        agi             INTEGER NOT NULL DEFAULT 5,
        vit             INTEGER NOT NULL DEFAULT 5,
        lck             INTEGER NOT NULL DEFAULT 5,
        cha             INTEGER NOT NULL DEFAULT 5,
        gold            INTEGER NOT NULL DEFAULT 0,
        prestige_count  INTEGER NOT NULL DEFAULT 0,
        hp_current      INTEGER NOT NULL DEFAULT 80,
        total_kills     INTEGER NOT NULL DEFAULT 0,
        total_runs      INTEGER NOT NULL DEFAULT 0,
        run_streak      INTEGER NOT NULL DEFAULT 0,
        daily_streak    INTEGER NOT NULL DEFAULT 0,
        last_play_date  TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );

      -- ── All items in bag (equipped or not) ───────────────────────────────
      CREATE TABLE IF NOT EXISTS rpg_inventory (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id         TEXT NOT NULL,
        name            TEXT NOT NULL,
        slot            TEXT NOT NULL,
        rarity          TEXT NOT NULL,
        zone_level      INTEGER NOT NULL DEFAULT 1,
        stats           TEXT NOT NULL DEFAULT '{}',
        passives        TEXT NOT NULL DEFAULT '[]',
        set_id          TEXT,
        legendary_id    TEXT,
        is_equipped     INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT DEFAULT (datetime('now'))
      );

      -- ── Current equipment — one row per slot, always 9 rows ──────────────
      CREATE TABLE IF NOT EXISTS rpg_equipped (
        slot            TEXT PRIMARY KEY,
        inventory_id    INTEGER REFERENCES rpg_inventory(id) ON DELETE SET NULL
      );

      -- ── Achievement tracking ──────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS rpg_achievements (
        achievement_id  TEXT PRIMARY KEY,
        unlocked        INTEGER NOT NULL DEFAULT 0,
        progress        INTEGER NOT NULL DEFAULT 0,
        unlocked_at     TEXT
      );

      -- ── Past run summaries ────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS rpg_run_history (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_id         TEXT NOT NULL,
        zone_name       TEXT NOT NULL,
        zone_level      INTEGER NOT NULL,
        result          TEXT NOT NULL,
        floors_cleared  INTEGER NOT NULL DEFAULT 0,
        kills           INTEGER NOT NULL DEFAULT 0,
        gold_earned     INTEGER NOT NULL DEFAULT 0,
        loot_ids        TEXT NOT NULL DEFAULT '[]',
        character_level INTEGER NOT NULL DEFAULT 1,
        prestige_count  INTEGER NOT NULL DEFAULT 0,
        duration_ms     INTEGER,
        created_at      TEXT DEFAULT (datetime('now'))
      );

      -- ── Companion response pool ───────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS rpg_responses (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        scenario_key    TEXT NOT NULL,
        dialogue        TEXT NOT NULL,
        emotion         TEXT NOT NULL DEFAULT 'neutral',
        thoughts        TEXT,
        use_count       INTEGER NOT NULL DEFAULT 0,
        last_used_at    TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_rpg_responses_scenario
        ON rpg_responses (scenario_key, use_count);

      -- ── Response generation tracking ──────────────────────────────────────
      CREATE TABLE IF NOT EXISTS rpg_response_generation_log (
        scenario_key    TEXT PRIMARY KEY,
        tier            TEXT NOT NULL,
        target_count    INTEGER NOT NULL,
        generated_at    TEXT,
        response_count  INTEGER NOT NULL DEFAULT 0
      );

      -- ── Initialize equipped slots (9 rows, all empty) ─────────────────────
      INSERT OR IGNORE INTO rpg_equipped (slot, inventory_id) VALUES
        ('weapon',  NULL),
        ('head',    NULL),
        ('chest',   NULL),
        ('hands',   NULL),
        ('feet',    NULL),
        ('belt',    NULL),
        ('ring',    NULL),
        ('amulet',  NULL),
        ('trinket', NULL);

      -- ── Initialize character row (singleton, id = 1) ──────────────────────
      INSERT OR IGNORE INTO rpg_character (id) VALUES (1);
    `);

    console.log('[RpgDB] Schema v1 applied.');
  }

  _applyV2() {
    // Add legs slot to rpg_equipped (was missing from v1 initialization).
    this.db.exec(`
      INSERT OR IGNORE INTO rpg_equipped (slot, inventory_id) VALUES ('legs', NULL);
    `);

    // Add is_sacrifice column to rpg_inventory (tracks sacrifice-variant armor items).
    // SQLite requires ALTER TABLE per column; ignore if already exists (idempotent guard via try).
    try {
      this.db.exec(`
        ALTER TABLE rpg_inventory ADD COLUMN is_sacrifice INTEGER NOT NULL DEFAULT 0;
      `);
    } catch (e) {
      // Column already exists — safe to ignore.
    }

    console.log('[RpgDB] Schema v2 applied.');
  }

  // ── Character ────────────────────────────────────────────────────────────

  getCharacter() {
    return this.db.prepare('SELECT * FROM rpg_character WHERE id = 1').get();
  }

  updateCharacter(fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const sets = keys.map((k) => `${k} = @${k}`).join(', ');
    this.db.prepare(`UPDATE rpg_character SET ${sets} WHERE id = 1`).run(fields);
  }

  // ── Inventory ─────────────────────────────────────────────────────────────

  getInventory() {
    return this.db
      .prepare('SELECT * FROM rpg_inventory ORDER BY created_at DESC')
      .all();
  }

  getItem(id) {
    return this.db.prepare('SELECT * FROM rpg_inventory WHERE id = ?').get(id);
  }

  addItem(item) {
    const info = this.db
      .prepare(`
        INSERT INTO rpg_inventory
          (item_id, name, slot, rarity, zone_level, stats, passives, set_id, legendary_id, is_sacrifice)
        VALUES
          (@item_id, @name, @slot, @rarity, @zone_level, @stats, @passives, @set_id, @legendary_id, @is_sacrifice)
      `)
      .run({ ...item, is_sacrifice: item.is_sacrifice ? 1 : 0 });
    return info.lastInsertRowid;
  }

  removeItem(inventoryId) {
    // Clear from equipped first
    this.db
      .prepare('UPDATE rpg_equipped SET inventory_id = NULL WHERE inventory_id = ?')
      .run(inventoryId);
    this.db.prepare('DELETE FROM rpg_inventory WHERE id = ?').run(inventoryId);
  }

  // ── Equipment ─────────────────────────────────────────────────────────────

  getEquipped() {
    return this.db
      .prepare(`
        SELECT e.slot, i.*
        FROM rpg_equipped e
        LEFT JOIN rpg_inventory i ON i.id = e.inventory_id
      `)
      .all();
  }

  equipItem(slot, inventoryId) {
    // Unequip whatever was there
    const old = this.db
      .prepare('SELECT inventory_id FROM rpg_equipped WHERE slot = ?')
      .get(slot);
    if (old?.inventory_id) {
      this.db
        .prepare('UPDATE rpg_inventory SET is_equipped = 0 WHERE id = ?')
        .run(old.inventory_id);
    }
    this.db
      .prepare('UPDATE rpg_equipped SET inventory_id = ? WHERE slot = ?')
      .run(inventoryId, slot);
    if (inventoryId !== null) {
      this.db
        .prepare('UPDATE rpg_inventory SET is_equipped = 1 WHERE id = ?')
        .run(inventoryId);
    }
  }

  unequipSlot(slot) {
    this.equipItem(slot, null);
  }

  // ── Responses ─────────────────────────────────────────────────────────────

  getResponses(scenarioKey) {
    return this.db
      .prepare(
        'SELECT * FROM rpg_responses WHERE scenario_key = ? ORDER BY use_count ASC, RANDOM()'
      )
      .all(scenarioKey);
  }

  getResponseCount(scenarioKey) {
    return this.db
      .prepare('SELECT COUNT(*) as count FROM rpg_responses WHERE scenario_key = ?')
      .get(scenarioKey).count;
  }

  /** Pick one response, avoiding the N most-used entries. */
  pickResponse(scenarioKey, avoidN = 5) {
    const all = this.getResponses(scenarioKey); // sorted use_count ASC (least-used first)
    if (all.length === 0) return null;
    // Take from the least-used end; exclude the last N (most-used) if pool is large enough
    const pool =
      all.length > avoidN
        ? all.slice(0, all.length - avoidN)
        : all;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    this.markResponseUsed(picked.id);
    return picked;
  }

  addResponses(scenarioKey, responses) {
    const insert = this.db.prepare(`
      INSERT INTO rpg_responses (scenario_key, dialogue, emotion, thoughts)
      VALUES (@scenario_key, @dialogue, @emotion, @thoughts)
    `);
    const insertMany = this.db.transaction((rows) => {
      for (const r of rows) insert.run({ scenario_key: scenarioKey, ...r });
    });
    insertMany(responses);
  }

  wipeResponses(scenarioKey) {
    this.db.prepare('DELETE FROM rpg_responses WHERE scenario_key = ?').run(scenarioKey);
    this.db
      .prepare('DELETE FROM rpg_response_generation_log WHERE scenario_key = ?')
      .run(scenarioKey);
  }

  markResponseUsed(id) {
    this.db
      .prepare(
        `UPDATE rpg_responses SET use_count = use_count + 1, last_used_at = datetime('now') WHERE id = ?`
      )
      .run(id);
  }

  getGenerationLog(scenarioKey) {
    return this.db
      .prepare('SELECT * FROM rpg_response_generation_log WHERE scenario_key = ?')
      .get(scenarioKey);
  }

  setGenerationLog(scenarioKey, tier, targetCount, responseCount) {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO rpg_response_generation_log
          (scenario_key, tier, target_count, generated_at, response_count)
        VALUES (?, ?, ?, datetime('now'), ?)
      `)
      .run(scenarioKey, tier, targetCount, responseCount);
  }

  // ── Achievements ──────────────────────────────────────────────────────────

  getAchievement(id) {
    return this.db
      .prepare('SELECT * FROM rpg_achievements WHERE achievement_id = ?')
      .get(id);
  }

  getAllAchievements() {
    return this.db.prepare('SELECT * FROM rpg_achievements').all();
  }

  unlockAchievement(id) {
    this.db
      .prepare(`
        INSERT INTO rpg_achievements (achievement_id, unlocked, unlocked_at)
        VALUES (?, 1, datetime('now'))
        ON CONFLICT(achievement_id)
        DO UPDATE SET unlocked = 1, unlocked_at = datetime('now')
      `)
      .run(id);
  }

  updateAchievementProgress(id, progress) {
    this.db
      .prepare(`
        INSERT INTO rpg_achievements (achievement_id, progress) VALUES (?, ?)
        ON CONFLICT(achievement_id) DO UPDATE SET progress = excluded.progress
      `)
      .run(id, progress);
  }

  // ── Run History ───────────────────────────────────────────────────────────

  addRunHistory(run) {
    this.db
      .prepare(`
        INSERT INTO rpg_run_history
          (zone_id, zone_name, zone_level, result, floors_cleared, kills,
           gold_earned, loot_ids, character_level, prestige_count, duration_ms)
        VALUES
          (@zone_id, @zone_name, @zone_level, @result, @floors_cleared, @kills,
           @gold_earned, @loot_ids, @character_level, @prestige_count, @duration_ms)
      `)
      .run(run);
  }

  getRunHistory(limit = 20) {
    return this.db
      .prepare('SELECT * FROM rpg_run_history ORDER BY created_at DESC LIMIT ?')
      .all(limit);
  }

  /** Return array of zone_ids that have at least one successful run. */
  getClearedZoneIds() {
    return this.db
      .prepare("SELECT DISTINCT zone_id FROM rpg_run_history WHERE result = 'success'")
      .all()
      .map(r => r.zone_id);
  }
}

module.exports = RpgDB;
