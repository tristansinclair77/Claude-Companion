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

    // Schema migration: add messages_json column to conversation_sessions if not yet present
    try { this.db.exec('ALTER TABLE conversation_sessions ADD COLUMN messages_json TEXT'); } catch {}

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

    try {
      return this.db.prepare(`
        SELECT lr.*, rank
        FROM learned_responses_fts fts
        JOIN learned_responses lr ON lr.id = fts.rowid
        WHERE learned_responses_fts MATCH ?
          AND lr.confidence >= 0.3
        ORDER BY confidence DESC, use_count DESC
        LIMIT ?
      `).all(escapeFTS(pattern), limit);
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
      'SELECT role, content, emotion FROM conversation_messages ORDER BY id DESC LIMIT ?'
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
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'this', 'that', 'these', 'those', 'to', 'of', 'in', 'on', 'at', 'by', 'for',
  'with', 'about', 'into', 'through', 'from', 'up', 'if', 'or', 'but', 'and', 'so',
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

module.exports = KnowledgeDB;
module.exports.normalizeText = normalizeText;
