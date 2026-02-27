// Brain Router — routes every user message to Filler, Local, or Claude.
// Phase 1 implementation: keyword-based filler + SQLite FTS5 + Jaccard similarity.
// Phase 2 will add neural ranking (Response Ranker micro-model).

const path = require('path');
const { CONFIDENCE_THRESHOLD, SOURCES } = require('../shared/constants');
const { normalizeText } = require('./knowledge-db');
const { sendToClaude } = require('./claude-bridge');

const VISUAL_INTENT_EXPLICIT = new Set([
  'look at this', 'see this', 'check this out', 'what do you think of this',
  'what am i looking at', 'see my screen', 'take a look', 'can you see',
  "what's on my screen", 'look here', 'show you something', 'look at my screen',
]);

class LocalBrain {
  /**
   * @param {object} opts
   * @param {KnowledgeDB} opts.db
   * @param {object} opts.fillerResponses - Parsed filler-responses.json
   * @param {object} opts.character
   * @param {object} opts.characterRules
   * @param {SessionManager} opts.sessionManager
   */
  constructor({ db, fillerResponses, character, characterRules, sessionManager }) {
    this.db = db;
    this.fillerResponses = fillerResponses;
    this.character = character;
    this.characterRules = characterRules;
    this.sessionManager = sessionManager;

    // Build filler trigger map: "trigger string" → [{dialogue, thoughts, emotion}]
    this._fillerMap = buildFillerMap(fillerResponses);

    // Load learned visual triggers from DB
    this._visualTriggers = new Set(VISUAL_INTENT_EXPLICIT);
    this._loadVisualTriggers();

    // Track last response for feedback monitoring
    this._lastResponse = null;
  }

  _loadVisualTriggers() {
    try {
      const learned = this.db.getVisualTriggers(0.6); // Only use high-confidence learned triggers
      for (const t of learned) {
        this._visualTriggers.add(t.phrase.toLowerCase());
      }
    } catch (err) {
      console.error('[LocalBrain] Error loading visual triggers:', err.message);
    }
  }

  /**
   * Main entry point. Routes a user message and returns a response + source.
   *
   * @param {string} userMessage
   * @param {object} opts
   * @param {string} [opts.userEmotion]
   * @param {Array}  [opts.attachments]
   * @returns {Promise<{dialogue, thoughts, emotion, source, id: number|null}>}
   */
  async route(userMessage, { userEmotion = 'neutral', attachments = [] } = {}) {
    const normalized = normalizeText(userMessage);
    const lower = userMessage.toLowerCase().trim();

    // ── Tier 1: Filler check ────────────────────────────────────────────────
    const filler = this._checkFiller(lower);
    if (filler) {
      this._lastResponse = { source: SOURCES.FILLER, id: null };
      return { ...filler, source: SOURCES.FILLER, id: null };
    }

    // ── Visual trigger check ────────────────────────────────────────────────
    const needsScreen = this._checkVisualTrigger(lower);
    if (needsScreen && attachments.findIndex((a) => a.type === 'screenshot') === -1) {
      // Signal the UI to auto-capture (we mark the message with a flag)
      // The actual capture happens in the renderer before calling this
      // We record the trigger phrase for learning
      this._learnVisualTrigger(userMessage);
    }

    // ── Tier 2: Knowledge DB match ──────────────────────────────────────────
    if (!attachments.length) { // Skip local brain if attachments need Claude analysis
      const localResult = this._checkLocalBrain(normalized, userEmotion);
      if (localResult) {
        this.db.recordUsage(localResult.id, 0, 'neutral');
        this._lastResponse = { source: SOURCES.LOCAL, id: localResult.id };
        return { ...localResult, source: SOURCES.LOCAL };
      }
    }

    // ── Tier 3: Claude ──────────────────────────────────────────────────────
    const context = this.sessionManager.getContextForPrompt();

    // Retrieve past Q&A on related topics to boost response quality (RAG)
    const relatedContext = normalized
      ? this.db.searchRelatedContext(normalized, 4)
      : [];

    let claudeResult;

    try {
      claudeResult = await sendToClaude({
        userMessage,
        character: this.character,
        characterRules: this.characterRules,
        masterSummary: context.masterSummary,
        permanentMemories: context.permanentMemories,
        userProfile: context.userProfile,
        conversationWindow: context.conversationWindow,
        detectedEmotion: userEmotion,
        attachments,
        relatedContext,
      });
    } catch (err) {
      throw err;
    }

    // Store the Claude response in knowledge DB for future local matching
    try {
      const insertedId = this.db.insertResponse({
        inputText: userMessage,
        inputPattern: normalized,
        responseDialogue: claudeResult.dialogue,
        responseThoughts: claudeResult.thoughts,
        responseEmotion: claudeResult.emotion,
        inputEmotion: userEmotion,
        source: 'claude',
      });
      this._lastResponse = { source: SOURCES.CLAUDE, id: insertedId };

      // Store new memories
      for (const mem of claudeResult.memories || []) {
        this.db.insertMemory({ category: mem.category, content: mem.content, source: 'auto_detected' });
        this.sessionManager.addMemory(mem.category, mem.content);
      }

      // Handle memory updates (contradictions — replace old facts with new ones)
      for (const mem of claudeResult.memoryUpdates || []) {
        this.db.replaceMemory({ category: mem.category, content: mem.content });
        // Sync in-memory list: remove stale entries in this category, add new one
        this.sessionManager.permanentMemories = this.sessionManager.permanentMemories
          .filter((m) => m.category !== mem.category ||
            !_keywordOverlap(m.content, mem.content));
        this.sessionManager.addMemory(mem.category, mem.content, 'auto_updated');
      }

      // Store companion's own stated facts (keeps Aria self-consistent across sessions)
      for (const fact of claudeResult.selfFacts || []) {
        this.db.insertMemory({ category: fact.category, content: fact.content, source: 'companion_self' });
        this.sessionManager.addMemory(fact.category, fact.content, 'companion_self');
      }
    } catch (err) {
      console.error('[LocalBrain] DB insert error:', err.message);
    }

    return { ...claudeResult, source: SOURCES.CLAUDE, id: null };
  }

  /**
   * Called by chat-controller after a response is displayed.
   * nextMessage is the user's NEXT message — used for feedback detection.
   */
  applyFeedback(nextMessage) {
    if (!this._lastResponse || !this._lastResponse.id) return;

    const { id } = this._lastResponse;
    const lower = (nextMessage || '').toLowerCase();

    const POSITIVE_SIGNALS = ['ok', 'okay', 'thanks', 'thank', 'got it', 'nice', 'cool', 'great', 'perfect', 'exactly', 'yes', 'yep'];
    const NEGATIVE_SIGNALS = ['no', 'wrong', 'not what', 'that\'s not', 'incorrect', 'nope', 'wait', 'actually'];

    const isPositive = POSITIVE_SIGNALS.some((s) => lower.includes(s));
    const isNegative = NEGATIVE_SIGNALS.some((s) => lower.includes(s));

    if (isPositive) {
      this.db.recordUsage(id, +0.05, 'positive');
    } else if (isNegative) {
      this.db.recordUsage(id, -0.10, 'negative');
    }
  }

  _checkFiller(lower) {
    // Exact match on the full message
    if (this._fillerMap.has(lower)) {
      return randomFrom(this._fillerMap.get(lower));
    }

    // Single-word or short phrase match
    const tokens = lower.split(/\s+/);
    if (tokens.length <= 3) {
      for (const token of tokens) {
        if (this._fillerMap.has(token)) {
          return randomFrom(this._fillerMap.get(token));
        }
      }
    }
    return null;
  }

  _checkLocalBrain(normalized, userEmotion) {
    if (!normalized) return null;

    const candidates = this.db.searchResponses(normalized, 20);
    if (!candidates.length) return null;

    // Score candidates with Jaccard similarity
    const queryWords = new Set(normalized.split(' ').filter(Boolean));
    let best = null;
    let bestScore = 0;

    for (const c of candidates) {
      const storedWords = new Set((c.input_pattern || '').split(' ').filter(Boolean));
      const jaccard = jaccardSimilarity(queryWords, storedWords);

      // Compute final score: Jaccard × confidence × recency bonus
      const recencyBonus = c.last_used_at ? getRecencyBonus(c.last_used_at) : 1.0;
      const emotionBonus = c.input_emotion === userEmotion ? 1.1 : 1.0;
      const score = jaccard * c.confidence * recencyBonus * emotionBonus;

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (bestScore >= CONFIDENCE_THRESHOLD) {
      return {
        dialogue: best.response_dialogue,
        thoughts: best.response_thoughts,
        emotion: best.response_emotion || 'neutral',
        id: best.id,
      };
    }
    return null;
  }

  _checkVisualTrigger(lower) {
    for (const trigger of this._visualTriggers) {
      if (lower.includes(trigger)) return true;
    }
    return false;
  }

  hasVisualTrigger(userMessage) {
    return this._checkVisualTrigger(userMessage.toLowerCase().trim());
  }

  _learnVisualTrigger(userMessage) {
    // Extract meaningful n-grams from the message and store as potential triggers
    const words = userMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    for (let n = 2; n <= Math.min(4, words.length); n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const phrase = words.slice(i, i + n).join(' ');
        if (!VISUAL_INTENT_EXPLICIT.has(phrase)) {
          try { this.db.upsertVisualTrigger(phrase); } catch {}
        }
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFillerMap(fillerResponses) {
  const map = new Map();
  if (!fillerResponses) return map;

  for (const category of Object.values(fillerResponses)) {
    for (const trigger of (category.triggers || [])) {
      const key = trigger.toLowerCase().trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(...(category.responses || []));
    }
  }
  return map;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jaccardSimilarity(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

function getRecencyBonus(lastUsedAt) {
  const daysSince = (Date.now() - new Date(lastUsedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 1) return 1.2;
  if (daysSince < 7) return 1.1;
  if (daysSince < 30) return 1.0;
  return 0.9;
}

function _keywordOverlap(a, b) {
  const wa = new Set(normalizeText(a).split(' ').filter(Boolean));
  const wb = new Set(normalizeText(b).split(' ').filter(Boolean));
  const intersection = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 && intersection / union >= 0.25;
}

module.exports = LocalBrain;
