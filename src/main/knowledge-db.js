// SQLite knowledge database for learned responses.
// Uses better-sqlite3 for synchronous, fast DB access.

const path = require('path');
const Database = require('better-sqlite3');

class KnowledgeDB {
  /**
   * @param {string} dbPath - Path to the .db file
   */
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  open() {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._initSchema();
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learned_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input_text TEXT,
        input_pattern TEXT,
        input_vector BLOB,
        response_vector BLOB,
        response_dialogue TEXT,
        response_thoughts TEXT,
        response_emotion TEXT,
        input_emotion TEXT DEFAULT 'neutral',
        input_intent TEXT DEFAULT 'unknown',
        confidence REAL DEFAULT 0.5,
        use_count INTEGER DEFAULT 0,
        positive_feedback_count INTEGER DEFAULT 0,
        negative_feedback_count INTEGER DEFAULT 0,
        source TEXT DEFAULT 'claude',
        is_core_knowledge INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS learned_responses_fts
        USING fts5(input_pattern, content=learned_responses, content_rowid=id);

      CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS permanent_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        content TEXT,
        source TEXT DEFAULT 'auto_detected',
        confidence REAL DEFAULT 0.8,
        first_mentioned TEXT DEFAULT (datetime('now')),
        last_confirmed TEXT DEFAULT (datetime('now')),
        times_referenced INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS visual_triggers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phrase TEXT UNIQUE,
        confidence REAL DEFAULT 0.3,
        trigger_count INTEGER DEFAULT 1,
        false_positive_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        last_triggered_at TEXT
      );

      CREATE TABLE IF NOT EXISTS conversation_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT,
        ended_at TEXT,
        message_count INTEGER DEFAULT 0,
        summary TEXT,
        key_topics TEXT,
        emotional_arc TEXT
      );

      CREATE TABLE IF NOT EXISTS master_summary (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        summary TEXT DEFAULT '',
        last_updated TEXT DEFAULT (datetime('now')),
        session_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        role TEXT,
        content TEXT,
        emotion TEXT DEFAULT 'neutral',
        timestamp TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES conversation_sessions(id)
      );

      CREATE TABLE IF NOT EXISTS conversation_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now')),
        used INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS training_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_name TEXT,
        training_examples INTEGER,
        loss REAL,
        accuracy REAL,
        trained_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS emotion_lexicon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_or_phrase TEXT,
        emotion TEXT,
        confidence REAL DEFAULT 0.5,
        source TEXT DEFAULT 'seed',
        times_confirmed INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS emotional_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        valence  REAL DEFAULT 50,
        arousal  REAL DEFAULT 40,
        social   REAL DEFAULT 50,
        physical REAL DEFAULT 70,
        last_updated TEXT DEFAULT (datetime('now'))
      );

      -- Ensure master_summary row exists
      INSERT OR IGNORE INTO master_summary (id, summary) VALUES (1, '');
      -- Ensure emotional_state row exists (default neutral-positive baseline)
      INSERT OR IGNORE INTO emotional_state (id) VALUES (1);
    `);

    // Migrate: add affection column if it doesn't exist yet (older DBs)
    try {
      this.db.exec('ALTER TABLE emotional_state ADD COLUMN affection REAL DEFAULT 75');
    } catch { /* column already exists */ }

    this.db.exec(`
    `);

    // ── companion_knowledge — structured facts about the companion herself ──
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS companion_knowledge (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        intent       TEXT    NOT NULL,
        topic        TEXT    NOT NULL,
        topic_words  TEXT    NOT NULL,
        fact_key     TEXT    NOT NULL,
        fact_detail  TEXT,
        fact_context TEXT,
        original_response TEXT,
        times_asked  INTEGER DEFAULT 1,
        confidence   REAL    DEFAULT 0.9,
        last_asked_at TEXT   DEFAULT (datetime('now')),
        created_at   TEXT    DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_ck_intent ON companion_knowledge(intent);
      CREATE INDEX IF NOT EXISTS idx_ck_topic  ON companion_knowledge(topic);

      -- topic_response_pool — varied pre-generated responses for known self-knowledge topics.
      -- Once 100+ entries exist for a topic, that topic is answered locally with random variety.
      CREATE TABLE IF NOT EXISTS topic_response_pool (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        topic      TEXT    NOT NULL,
        dialogue   TEXT    NOT NULL,
        thoughts   TEXT    DEFAULT '',
        emotion    TEXT    DEFAULT 'neutral',
        created_at TEXT    DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_pool_topic ON topic_response_pool(topic);
    `);

    // Schema migration: add messages_json column to conversation_sessions if not yet present
    try { this.db.exec('ALTER TABLE conversation_sessions ADD COLUMN messages_json TEXT'); } catch {}

    // Schema v2 migration: rebuild FTS index after stop-word list was narrowed.
    // This only runs once, flagged by 'schema_version' in user_profile.
    this._runMigrations();

    // Seed emotion lexicon if empty
    const count = this.db.prepare('SELECT COUNT(*) as n FROM emotion_lexicon').get();
    if (count.n === 0) {
      this._seedEmotionLexicon();
    }
  }

  _seedEmotionLexicon() {
    const seeds = [
      ['great', 'happy'], ['awesome', 'happy'], ['love', 'happy'], ['amazing', 'happy'],
      ['wonderful', 'happy'], ['yay', 'happy'], ['excited', 'happy'],
      ['sad', 'sad'], ['unfortunately', 'sad'], ['miss', 'sad'], ['disappointed', 'sad'],
      ['angry', 'angry'], ['frustrated', 'angry'], ['annoyed', 'angry'], ['hate', 'angry'],
      ['broken', 'angry'], ['stupid', 'angry'],
      ['confused', 'confused'], ["don't understand", 'confused'],
      ['tired', 'exhausted'], ['exhausted', 'exhausted'], ['drained', 'exhausted'],
    ];
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO emotion_lexicon (word_or_phrase, emotion) VALUES (?, ?)'
    );
    const insertMany = this.db.transaction((rows) => { for (const r of rows) stmt.run(...r); });
    insertMany(seeds);
  }

  _runMigrations() {
    const row = this.db.prepare("SELECT value FROM user_profile WHERE key = 'schema_version'").get();
    const version = row ? parseInt(row.value, 10) : 1;

    if (version < 2) {
      // Rebuild input_pattern for all learned_responses using the improved normalizeText()
      // (stop-word list was narrowed — we keep question words and pronouns now)
      try {
        const rows = this.db.prepare('SELECT id, input_text FROM learned_responses').all();
        if (rows.length > 0) {
          const updateStmt = this.db.prepare('UPDATE learned_responses SET input_pattern = ? WHERE id = ?');
          const migration = this.db.transaction((rs) => {
            for (const r of rs) updateStmt.run(normalizeText(r.input_text || ''), r.id);
          });
          migration(rows);

          // Rebuild FTS index from the updated patterns
          this.db.exec("INSERT INTO learned_responses_fts(learned_responses_fts) VALUES('delete-all')");
          this.db.exec(`
            INSERT INTO learned_responses_fts (rowid, input_pattern)
            SELECT id, input_pattern FROM learned_responses
          `);
          console.log('[KnowledgeDB] v2 migration: rebuilt FTS index for', rows.length, 'entries');
        }
      } catch (err) {
        console.error('[KnowledgeDB] v2 migration failed:', err.message);
      }

      this.db.prepare("INSERT OR REPLACE INTO user_profile (key, value, updated_at) VALUES ('schema_version', '2', datetime('now'))").run();
    }
  }

  // ── Companion Knowledge ──────────────────────────────────────────────────────

  /**
   * Inserts or updates a companion knowledge entry.
   * If an entry for this topic already exists, increments times_asked and optionally updates the fact.
   */
  upsertKnowledge({ intent, topic, topicWords, factKey, factDetail, factContext, originalResponse }) {
    const existing = this.db.prepare('SELECT * FROM companion_knowledge WHERE topic = ?').get(topic);

    if (existing) {
      // Update times_asked and last_asked_at; update fact if it changed
      const factChanged = existing.fact_key !== factKey;
      this.db.prepare(`
        UPDATE companion_knowledge
        SET times_asked   = times_asked + 1,
            last_asked_at = datetime('now'),
            fact_key      = ?,
            fact_detail   = ?,
            fact_context  = ?,
            original_response = ?
        WHERE id = ?
      `).run(factKey, factDetail || existing.fact_detail, factContext || existing.fact_context, originalResponse || existing.original_response, existing.id);

      if (factChanged) {
        console.log(`[KnowledgeDB] Knowledge updated: topic=${topic} old="${existing.fact_key}" new="${factKey}"`);
      }
      return existing.id;
    }

    const info = this.db.prepare(`
      INSERT INTO companion_knowledge (intent, topic, topic_words, fact_key, fact_detail, fact_context, original_response)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(intent, topic, topicWords || '', factKey, factDetail || null, factContext || null, originalResponse || null);
    return info.lastInsertRowid;
  }

  /**
   * Increments times_asked for a knowledge entry (called when local brain answers from it).
   */
  bumpKnowledgeAsked(id) {
    this.db.prepare(`
      UPDATE companion_knowledge
      SET times_asked = times_asked + 1, last_asked_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /**
   * Searches companion_knowledge for the best match given an intent and query word set.
   * Uses synonym expansion to broaden matching.
   *
   * @param {string}    intent         - e.g. 'QUESTION_ABOUT_COMPANION'
   * @param {Set}       queryWordSet   - normalized query words (already synonym-expanded by caller)
   * @param {number}    [threshold=0.12] - minimum fraction of topic_words that must match
   * @returns {object|null} - best matching row or null
   */
  findKnowledge(intent, queryWordSet, rawQueryWords = null, threshold = 0.12) {
    if (!queryWordSet || !queryWordSet.size) return null;

    const entries = this.db.prepare(
      'SELECT * FROM companion_knowledge WHERE intent = ? ORDER BY times_asked DESC'
    ).all(intent);
    if (!entries.length) return null;

    let best = null;
    let bestScore = 0;

    for (const entry of entries) {
      const topicWords = new Set((entry.topic_words || '').split(' ').filter(Boolean));
      if (!topicWords.size) continue;

      let matches = 0;
      for (const word of queryWordSet) {
        if (topicWords.has(word)) matches++;
      }
      const score = matches / topicWords.size;

      // Require at least one *specific* (non-generic-qualifier) query word to appear
      // in the topic_words. Without this, "favorite ice cream" matches "favorite_color"
      // because the "favorite/prefer/like/enjoy" synonym cluster is shared by all
      // "favorite X" entries and inflates the score to 0.6+ even for wrong topics.
      if (!_hasSpecificTopicMatch(queryWordSet, topicWords)) continue;

      // Guard against compound-noun false positives (e.g. "favorite COLOR ice cream"
      // should NOT match the favorite_color topic). If the raw (unexpanded) query has
      // multiple specific words and more of them fall OUTSIDE the topic than inside,
      // the match is likely about a different subject — skip it.
      if (rawQueryWords && rawQueryWords.size) {
        const specificRaw = [...rawQueryWords].filter(w => !GENERIC_QUALIFIERS.has(w));
        if (specificRaw.length > 1) {
          const matchedRaw   = specificRaw.filter(w => topicWords.has(w)).length;
          const unmatchedRaw = specificRaw.length - matchedRaw;
          if (unmatchedRaw > matchedRaw) continue;
        }
      }

      if (score > bestScore && score >= threshold) {
        bestScore = score;
        best = entry;
      }
    }

    return best;
  }

  // ── Topic Response Pool ────────────────────────────────────────────────────

  /** How many responses are in the pool for this topic. */
  getPoolSize(topic) {
    return this.db.prepare('SELECT COUNT(*) as n FROM topic_response_pool WHERE topic = ?').get(topic)?.n || 0;
  }

  /** Returns one random pool entry for this topic, or null if empty. */
  getRandomPoolResponse(topic) {
    return this.db.prepare(
      'SELECT * FROM topic_response_pool WHERE topic = ? ORDER BY RANDOM() LIMIT 1'
    ).get(topic) || null;
  }

  /** Bulk-inserts an array of {dialogue, thoughts, emotion} into the pool for a topic. */
  insertPoolResponses(topic, responses) {
    const stmt = this.db.prepare(
      'INSERT INTO topic_response_pool (topic, dialogue, thoughts, emotion) VALUES (?, ?, ?, ?)'
    );
    const tx = this.db.transaction((rs) => {
      for (const r of rs) {
        stmt.run(topic, r.dialogue || '', r.thoughts || '', r.emotion || 'neutral');
      }
    });
    tx(responses);
  }

  /**
   * Returns all companion_knowledge entries for debugging / the knowledge browser.
   */
  getAllKnowledge() {
    return this.db.prepare('SELECT * FROM companion_knowledge ORDER BY topic').all();
  }

  // ── Learned Responses ──────────────────────────────────────────────────────

  /**
   * Stores a Claude response in the learned_responses table.
   */
  insertResponse({ inputText, inputPattern, responseDialogue, responseThoughts, responseEmotion, inputEmotion, source }) {
    const stmt = this.db.prepare(`
      INSERT INTO learned_responses
        (input_text, input_pattern, response_dialogue, response_thoughts, response_emotion, input_emotion, source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      inputText || '',
      inputPattern || normalizeText(inputText),
      responseDialogue || '',
      responseThoughts || '',
      responseEmotion || 'neutral',
      inputEmotion || 'neutral',
      source || 'claude'
    );
    // Update FTS index
    this.db.prepare(
      "INSERT INTO learned_responses_fts (rowid, input_pattern) VALUES (?, ?)"
    ).run(info.lastInsertRowid, normalizeText(inputText));
    return info.lastInsertRowid;
  }

  /**
   * Searches for matching responses using FTS5 + ranking.
   * Returns top N candidates sorted by confidence × use_count.
   */
  searchResponses(query, limit = 20) {
    const pattern = normalizeText(query);
    if (!pattern) return [];

    // FTS5 defaults to AND (all terms must match). Use OR so partial-overlap entries
    // (e.g. "what your favorite ice cream" matching "remind me your favorite ice cream flavor")
    // are returned as candidates — the Jaccard scorer will rank them properly.
    const ftsQuery = escapeFTS(pattern).split(/\s+/).filter(Boolean).join(' OR ');

    try {
      return this.db.prepare(`
        SELECT lr.*, rank
        FROM learned_responses_fts fts
        JOIN learned_responses lr ON lr.id = fts.rowid
        WHERE learned_responses_fts MATCH ?
          AND lr.confidence >= 0.3
        ORDER BY confidence DESC, use_count DESC
        LIMIT ?
      `).all(ftsQuery, limit);
    } catch {
      // FTS query can fail with special chars — fall back to LIKE
      return this.db.prepare(`
        SELECT * FROM learned_responses
        WHERE input_pattern LIKE ?
          AND confidence >= 0.3
        ORDER BY confidence DESC, use_count DESC
        LIMIT ?
      `).all(`%${pattern.slice(0, 50)}%`, limit);
    }
  }

  /**
   * Updates confidence and use_count for a response.
   */
  recordUsage(id, confidenceDelta = 0, feedbackType = 'neutral') {
    const { confidence, use_count, positive_feedback_count, negative_feedback_count } =
      this.db.prepare('SELECT * FROM learned_responses WHERE id = ?').get(id) || {};

    if (!confidence) return;

    const newConf = Math.max(0, Math.min(1, confidence + confidenceDelta));
    const posCount = positive_feedback_count + (feedbackType === 'positive' ? 1 : 0);
    const negCount = negative_feedback_count + (feedbackType === 'negative' ? 1 : 0);

    this.db.prepare(`
      UPDATE learned_responses
      SET confidence = ?, use_count = ?, positive_feedback_count = ?,
          negative_feedback_count = ?, last_used_at = datetime('now')
      WHERE id = ?
    `).run(newConf, (use_count || 0) + 1, posCount, negCount, id);
  }

  // ── Permanent Memories ────────────────────────────────────────────────────

  getAllMemories() {
    return this.db.prepare("SELECT * FROM permanent_memories WHERE is_active = 1 ORDER BY category").all();
  }

  insertMemory({ category, content, source }) {
    // Check for existing identical memory in same category
    const existing = this.db.prepare(
      "SELECT id FROM permanent_memories WHERE category = ? AND content = ? AND is_active = 1"
    ).get(category, content);

    if (existing) {
      this.db.prepare(
        "UPDATE permanent_memories SET times_referenced = times_referenced + 1, last_confirmed = datetime('now') WHERE id = ?"
      ).run(existing.id);
      return existing.id;
    }

    const info = this.db.prepare(
      "INSERT INTO permanent_memories (category, content, source) VALUES (?, ?, ?)"
    ).run(category, content, source || 'auto_detected');
    return info.lastInsertRowid;
  }

  /**
   * Replaces contradicted memories. Deactivates existing memories in the same
   * category that share significant keyword overlap with the new content, then
   * inserts the new fact.
   */
  replaceMemory({ category, content, source }) {
    const candidates = this.db.prepare(
      "SELECT id, content FROM permanent_memories WHERE category = ? AND is_active = 1"
    ).all(category);

    const newWords = new Set(normalizeText(content).split(' ').filter(Boolean));

    for (const c of candidates) {
      const oldWords = new Set(normalizeText(c.content).split(' ').filter(Boolean));
      // Deactivate if keyword overlap is significant (same topic)
      const intersection = [...newWords].filter(w => oldWords.has(w)).length;
      const union = new Set([...newWords, ...oldWords]).size;
      const jaccard = union > 0 ? intersection / union : 0;
      if (jaccard >= 0.25) {
        this.db.prepare(
          "UPDATE permanent_memories SET is_active = 0 WHERE id = ?"
        ).run(c.id);
      }
    }

    // Insert the new/corrected fact
    return this.insertMemory({ category, content, source: source || 'auto_updated' });
  }

  // ── Master Summary ────────────────────────────────────────────────────────

  getMasterSummary() {
    const row = this.db.prepare('SELECT * FROM master_summary WHERE id = 1').get();
    return row ? row.summary : '';
  }

  setMasterSummary(summary) {
    this.db.prepare(
      "UPDATE master_summary SET summary = ?, last_updated = datetime('now') WHERE id = 1"
    ).run(summary);
  }

  incrementSessionCount() {
    this.db.prepare(
      "UPDATE master_summary SET session_count = session_count + 1 WHERE id = 1"
    ).run();
  }

  getMasterSummarySessionCount() {
    return (this.db.prepare('SELECT session_count FROM master_summary WHERE id = 1').get() || {}).session_count || 0;
  }

  // ── Visual Triggers ───────────────────────────────────────────────────────

  getVisualTriggers(minConfidence = 0.3) {
    return this.db.prepare(
      "SELECT * FROM visual_triggers WHERE confidence >= ? ORDER BY confidence DESC"
    ).all(minConfidence);
  }

  upsertVisualTrigger(phrase) {
    const existing = this.db.prepare('SELECT * FROM visual_triggers WHERE phrase = ?').get(phrase);
    if (existing) {
      const newConf = Math.min(1.0, existing.confidence + 0.1);
      this.db.prepare(
        "UPDATE visual_triggers SET trigger_count = trigger_count + 1, confidence = ?, last_triggered_at = datetime('now') WHERE phrase = ?"
      ).run(newConf, phrase);
    } else {
      this.db.prepare(
        "INSERT INTO visual_triggers (phrase, confidence) VALUES (?, 0.3)"
      ).run(phrase);
    }
  }

  penalizeVisualTrigger(phrase) {
    this.db.prepare(
      "UPDATE visual_triggers SET false_positive_count = false_positive_count + 1, confidence = MAX(0, confidence - 0.15) WHERE phrase = ?"
    ).run(phrase);
  }

  // ── Conversation Messages ─────────────────────────────────────────────────

  insertMessage({ role, content, emotion }) {
    this.db.prepare(
      'INSERT INTO conversation_messages (session_id, role, content, emotion) VALUES (NULL, ?, ?, ?)'
    ).run(role, content, emotion || 'neutral');
  }

  getRecentMessages(n = 30) {
    return this.db.prepare(
      `SELECT role, content, emotion,
              CAST(strftime('%s', timestamp) AS INTEGER) * 1000 AS timestamp
       FROM conversation_messages ORDER BY id DESC LIMIT ?`
    ).all(n).reverse();
  }

  /**
   * Searches learned_responses for past Q&A relevant to the current message.
   * Used to inject recalled context into the Claude prompt (RAG).
   * @param {string} normalizedQuery - Normalized user message (stop-words stripped)
   * @param {number} limit
   * @returns {Array<{input_text, response_dialogue, response_emotion}>}
   */
  searchRelatedContext(normalizedQuery, limit = 4) {
    if (!normalizedQuery) return [];
    try {
      return this.db.prepare(`
        SELECT lr.input_text, lr.response_dialogue, lr.response_emotion
        FROM learned_responses_fts fts
        JOIN learned_responses lr ON lr.id = fts.rowid
        WHERE learned_responses_fts MATCH ?
          AND lr.confidence >= 0.3
        ORDER BY lr.use_count DESC, lr.confidence DESC
        LIMIT ?
      `).all(escapeFTS(normalizedQuery), limit);
    } catch {
      return [];
    }
  }

  // ── User Profile ──────────────────────────────────────────────────────────

  getProfileValue(key) {
    const row = this.db.prepare('SELECT value FROM user_profile WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  }

  setProfileValue(key, value) {
    this.db.prepare(
      "INSERT OR REPLACE INTO user_profile (key, value, updated_at) VALUES (?, ?, datetime('now'))"
    ).run(key, JSON.stringify(value));
  }

  getAllProfile() {
    const rows = this.db.prepare('SELECT key, value FROM user_profile').all();
    const out = {};
    for (const r of rows) out[r.key] = JSON.parse(r.value);
    return out;
  }

  // ── Emotional State (persistent axis values) ──────────────────────────────

  getEmotionalState() {
    const row = this.db.prepare('SELECT valence, arousal, social, physical FROM emotional_state WHERE id = 1').get();
    return row || { valence: 50, arousal: 40, social: 50, physical: 70 };
  }

  setEmotionalState({ valence, arousal, social, physical }) {
    this.db.prepare(
      "UPDATE emotional_state SET valence = ?, arousal = ?, social = ?, physical = ?, last_updated = datetime('now') WHERE id = 1"
    ).run(
      Math.max(0, Math.min(100, valence)),
      Math.max(0, Math.min(100, arousal)),
      Math.max(0, Math.min(100, social)),
      Math.max(0, Math.min(100, physical))
    );
  }

  // ── Affection meter (companion-set, ±40 cap per message) ─────────────────

  getAffection() {
    try {
      const row = this.db.prepare('SELECT affection FROM emotional_state WHERE id = 1').get();
      return (row && row.affection != null) ? row.affection : 75;
    } catch {
      return 75;
    }
  }

  setAffection(value) {
    const v = Math.max(0, Math.min(100, value));
    try {
      this.db.prepare("UPDATE emotional_state SET affection = ? WHERE id = 1").run(v);
    } catch {
      // Column may not exist on older DBs — run migration then retry
      this._migrateAffectionColumn();
      this.db.prepare("UPDATE emotional_state SET affection = ? WHERE id = 1").run(v);
    }
  }

  _migrateAffectionColumn() {
    try {
      this.db.exec('ALTER TABLE emotional_state ADD COLUMN affection REAL DEFAULT 75');
    } catch { /* already exists */ }
  }

  // ── Saved Conversations ───────────────────────────────────────────────────

  insertConversationSession({ startedAt, endedAt, messageCount, summary, messagesJson }) {
    const info = this.db.prepare(`
      INSERT INTO conversation_sessions (started_at, ended_at, message_count, summary, messages_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(startedAt || null, endedAt || null, messageCount || 0, summary || '', messagesJson || '[]');
    return info.lastInsertRowid;
  }

  getAllConversationSessions() {
    return this.db.prepare(
      'SELECT id, started_at, ended_at, message_count, summary FROM conversation_sessions ORDER BY id DESC'
    ).all();
  }

  getConversationSessionById(id) {
    return this.db.prepare('SELECT * FROM conversation_sessions WHERE id = ?').get(id);
  }

  // ── Conversation Threads (dead topics / curiosity pool) ───────────────────

  /**
   * Stores a dead topic thread. Silently skips exact duplicates within 24 hours.
   */
  insertThread(content) {
    if (!content) return null;
    const existing = this.db.prepare(
      "SELECT id FROM conversation_threads WHERE content = ? AND timestamp > datetime('now', '-1 day')"
    ).get(content);
    if (existing) return existing.id;
    const info = this.db.prepare(
      'INSERT INTO conversation_threads (content) VALUES (?)'
    ).run(content);
    return info.lastInsertRowid;
  }

  /**
   * Returns unused threads from the last 24 hours, newest first.
   */
  getActiveThreads(limit = 6) {
    return this.db.prepare(
      "SELECT id, content FROM conversation_threads WHERE used = 0 AND timestamp > datetime('now', '-1 day') ORDER BY timestamp DESC LIMIT ?"
    ).all(limit);
  }

  /**
   * Marks a thread as used (prevents it being surfaced again by the lull timer).
   */
  markThreadUsed(id) {
    this.db.prepare('UPDATE conversation_threads SET used = 1 WHERE id = ?').run(id);
  }

  /**
   * Deletes threads older than 24 hours.
   */
  pruneOldThreads() {
    this.db.prepare("DELETE FROM conversation_threads WHERE timestamp <= datetime('now', '-1 day')").run();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Structural-only stop words — intentionally keeps question words and pronouns
// so that "What's your favorite color?" normalises to "what your favorite color"
// instead of just "favorite color". This is critical for intent-based matching.
//
// KEPT (not stripped): you, your, i, me, my, what, how, why, when, where, who,
//                      which, do, does, did, can, will
// STRIPPED: purely grammatical glue words that add no semantic signal.
const STOP_WORDS = new Set([
  'a', 'an', 'the',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'need', 'dare', 'ought',
  'it', 'its', 'he', 'she', 'they', 'him', 'her', 'them', 'his', 'hers', 'their',
  'we', 'our', 'us',
  'this', 'that', 'these', 'those',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'into', 'through', 'from', 'up',
  'if', 'or', 'but', 'and', 'so', 'then', 'than', 'as', 'also', 'just', 'very', 'too',
  'well', 'only', 'still', 'now',
]);

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .join(' ')
    .trim();
}

function escapeFTS(query) {
  // FTS5 special chars: " * ^ ( )
  return query.replace(/["*()\^]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Words that appear in virtually every "favorite X" topic's synonym-expanded topic_words.
// A knowledge match is only valid if at least one query word NOT in this set also matches
// the topic_words — i.e. the *subject* of the question actually overlaps the stored topic.
const GENERIC_QUALIFIERS = new Set([
  'favorite', 'favourite', 'prefer', 'like', 'love', 'hate', 'feel', 'think',
  'believe', 'want', 'dream', 'wish', 'opinion', 'view', 'enjoy', 'dislike',
  'fear', 'fav', 'best', 'top', 'choice', 'pick',
  'what', 'your', 'you', 'do', 'does', 'is', 'are', 'how',
]);

/**
 * Returns true if at least one word in queryWordSet is both:
 *   (a) NOT a generic qualifier (preference word / question word), and
 *   (b) present in topicWords.
 * Prevents topic cross-contamination caused by synonym expansion of "favorite" etc.
 */
function _hasSpecificTopicMatch(queryWordSet, topicWords) {
  for (const word of queryWordSet) {
    if (!GENERIC_QUALIFIERS.has(word) && topicWords.has(word)) return true;
  }
  return false;
}

module.exports = KnowledgeDB;
module.exports.normalizeText = normalizeText;
