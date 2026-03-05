// Brain Router — routes every user message to Filler, Local, or Claude.
// Phase 1 implementation: keyword-based filler + SQLite FTS5 + Jaccard similarity.
// Phase 2 will add neural ranking (Response Ranker micro-model).

const path = require('path');
const fs   = require('fs');
const { CONFIDENCE_THRESHOLD, SOURCES } = require('../shared/constants');
const { normalizeText } = require('./knowledge-db');
const { sendToClaude } = require('./claude-bridge');
const { ConversationDynamics } = require('./conversation-dynamics');
const logger = require('./debug-logger');
const { classifyIntent, extractEmotionalTopic, INTENTS, CONFIDENCE } = require('./intent-classifier');
const TemplateEngine = require('./template-engine');

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
   * @param {string} [opts.characterDir] - Path to character directory (for templates.json)
   */
  constructor({ db, fillerResponses, character, characterRules, sessionManager, characterDir }) {
    this.db = db;
    this.fillerResponses = fillerResponses;
    this.character = character;
    this.characterRules = characterRules;
    this.sessionManager = sessionManager;
    this.characterDir = characterDir || null;
    this._conversationDynamics = new ConversationDynamics(character.name);

    // Build filler trigger map: "trigger string" → [{dialogue, thoughts, emotion}]
    this._fillerMap = buildFillerMap(fillerResponses);

    // Load learned visual triggers from DB
    this._visualTriggers = new Set(VISUAL_INTENT_EXPLICIT);
    this._loadVisualTriggers();

    // Track last response for feedback monitoring
    this._lastResponse = null;

    // ── Knowledge Brain components ──────────────────────────────────────────
    // Synonym expansion map: word → Set(all synonyms in the same group)
    this._synonymExpansionMap = buildSynonymExpansionMap();

    // Template engine: generates varied responses from stored knowledge entries
    this.templateEngine = characterDir ? new TemplateEngine(characterDir) : null;
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
  async route(userMessage, { userEmotion = 'neutral', attachments = [], onStreamChunk = null, fastMode = false, sensation = 0, addonContexts = [], trackers = {}, activeThreads = [] } = {}) {
    const normalized = normalizeText(userMessage);
    const lower = userMessage.toLowerCase().trim();

    logger.log('user_message', {
      message: userMessage,
      emotion: userEmotion,
      attachmentTypes: attachments.map((a) => a.type),
      normalizedPattern: normalized,
    });

    // ── Tier 1: Filler check ────────────────────────────────────────────────
    const filler = this._checkFiller(lower);
    if (filler) {
      logger.log('route_filler', { trigger: lower, dialogue: filler.dialogue, emotion: filler.emotion });
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

    // ── Tier 2: Knowledge Brain (intent + template) ─────────────────────────
    if (!attachments.length) {
      const { intent, confidence } = classifyIntent(userMessage);

      logger.log('intent_classified', { intent, confidence, message: userMessage.slice(0, 80) });

      if (confidence !== CONFIDENCE.LOW && intent !== INTENTS.UNKNOWN) {
        const knowledgeResult = this._checkKnowledgeBrain(userMessage, normalized, intent);
        if (knowledgeResult) {
          logger.log('route_knowledge_hit', { intent, dialogue: knowledgeResult.dialogue, emotion: knowledgeResult.emotion });
          this._lastResponse = { source: SOURCES.LOCAL, id: null, knowledgeBrain: true };
          return { ...knowledgeResult, source: SOURCES.LOCAL };
        }
      }
    }

    // ── Tier 3: Learned-response match (synonym-aware Jaccard) ──────────────
    if (!attachments.length) {
      const localResult = this._checkLocalBrain(normalized, userEmotion);
      if (localResult) {
        logger.log('route_local_hit', { dialogue: localResult.dialogue, emotion: localResult.emotion, id: localResult.id });
        this.db.recordUsage(localResult.id, 0, 'neutral');
        this._lastResponse = { source: SOURCES.LOCAL, id: localResult.id };
        return { ...localResult, source: SOURCES.LOCAL };
      }
    }

    // ── Tier 4: Claude ──────────────────────────────────────────────────────
    const context = this.sessionManager.getContextForPrompt();

    // Retrieve past Q&A on related topics to boost response quality (RAG)
    const relatedContext = normalized
      ? this.db.searchRelatedContext(normalized, 4)
      : [];

    let claudeResult;
    const _rawState = this.db.getEmotionalState ? this.db.getEmotionalState() : null;
    const emotionalState = _rawState ? { ..._rawState, sensation } : null;

    try {
      // Update conversation state from user message FIRST, then get directive so
      // Claude's prompt reflects the current turn's emotional tone (not the previous one).
      // Companion emotion is unknown yet — pass null; it will be supplied post-response.
      this._conversationDynamics.update(userMessage, null, emotionalState);
      const conversationDynamic = this._conversationDynamics.getDirective();
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
        emotionalState,
        onStreamChunk,
        fastMode,
        addonContexts,
        trackers,
        activeThreads,
        characterDir: this.characterDir,
        conversationDynamic,
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

      // Capture structured knowledge entries from [KNOWLEDGE] tags
      for (const k of claudeResult.knowledge || []) {
        try {
          const topicWords = buildTopicWords(k.topic, this._synonymExpansionMap);
          this.db.upsertKnowledge({
            intent:           k.intent || 'QUESTION_ABOUT_COMPANION',
            topic:            k.topic,
            topicWords,
            factKey:          k.factKey,
            factDetail:       k.factDetail || null,
            factContext:      null,
            originalResponse: claudeResult.dialogue,
          });
          logger.log('knowledge_captured', { topic: k.topic, fact: k.factKey });
        } catch (err) {
          console.error('[LocalBrain] Knowledge capture error:', err.message);
        }
      }

      logger.log('memory_ops', {
        newMemories: (claudeResult.memories || []).map((m) => ({ category: m.category, content: m.content })),
        memoryUpdates: (claudeResult.memoryUpdates || []).map((m) => ({ category: m.category, content: m.content })),
        selfFacts: (claudeResult.selfFacts || []).map((m) => ({ category: m.category, content: m.content })),
      });
    } catch (err) {
      console.error('[LocalBrain] DB insert error:', err.message);
      logger.log('error', { context: 'memory_ops', message: err.message });
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

  /**
   * New primary local path: intent classification → knowledge lookup → template generation.
   * Only called when intent confidence is medium or high and intent is not UNKNOWN.
   */
  _checkKnowledgeBrain(userMessage, normalized, intent) {
    if (!this.templateEngine) return null;

    // Intents that require a stored knowledge fact before templating
    const KNOWLEDGE_REQUIRED = new Set([
      INTENTS.QUESTION_ABOUT_COMPANION,
      INTENTS.FACTUAL_RECALL,
    ]);

    // Intents that can use templates without a stored knowledge fact
    const TEMPLATE_ONLY = new Set([
      INTENTS.CONTINUATION,
      INTENTS.GREETING,
      INTENTS.CASUAL_CHAT,
    ]);

    // Intents that need a topic derived from the message (not from stored knowledge)
    const MESSAGE_TOPIC = new Set([
      INTENTS.EMOTIONAL_EXPRESSION,
      INTENTS.OPINION_REQUEST,
    ]);

    let knowledge = null;
    let topic     = null;

    if (KNOWLEDGE_REQUIRED.has(intent)) {
      // Expand query words with synonyms before searching
      const rawWords  = new Set(normalized.split(' ').filter(Boolean));
      const expanded  = expandWithSynonyms(rawWords, this._synonymExpansionMap);
      // All companion self-knowledge is stored under QUESTION_ABOUT_COMPANION regardless
      // of how it was asked — FACTUAL_RECALL ("do you remember your fav color?") should
      // still find entries stored as QUESTION_ABOUT_COMPANION.
      const searchIntent = INTENTS.QUESTION_ABOUT_COMPANION;
      knowledge = this.db.findKnowledge(searchIntent, expanded);
      if (!knowledge) {
        logger.log('knowledge_miss', { intent, normalized: normalized.slice(0, 60) });
        return null; // no fact stored yet — go to Claude
      }
      topic = knowledge.topic;

    } else if (MESSAGE_TOPIC.has(intent)) {
      // Derive topic from the message itself (e.g. "sad", "happy")
      if (intent === INTENTS.EMOTIONAL_EXPRESSION) {
        topic = extractEmotionalTopic(userMessage);
      }
      // No knowledge entry needed for these intents

    } else if (TEMPLATE_ONLY.has(intent)) {
      // Pure template — no knowledge or topic extraction needed
      topic = null;

    } else {
      return null; // unhandled intent
    }

    // Check we actually have templates for this intent before trying
    if (!this.templateEngine.hasTemplatesFor(intent)) return null;

    const emotionalState = this.db.getEmotionalState ? this.db.getEmotionalState() : null;
    const result = this.templateEngine.generate({
      intent,
      topic,
      knowledge,
      character:     this.character,
      emotionalState,
    });

    if (!result) {
      logger.log('template_miss', { intent, topic });
      return null;
    }

    // Increment times_asked counter on the knowledge entry
    if (knowledge) {
      this.db.bumpKnowledgeAsked(knowledge.id);
    }

    return result;
  }

  /**
   * Fallback local path: FTS5 candidate retrieval + synonym-aware Jaccard scoring.
   * Still useful for remembered Q&A that doesn't yet have a knowledge entry.
   */
  _checkLocalBrain(normalized, userEmotion) {
    if (!normalized) return null;

    const candidates = this.db.searchResponses(normalized, 20);
    if (!candidates.length) return null;

    const queryWords = new Set(normalized.split(' ').filter(Boolean));
    // Expand query words with synonyms for better matching
    const expandedQuery = expandWithSynonyms(queryWords, this._synonymExpansionMap);

    let best = null;
    let bestScore = 0;

    for (const c of candidates) {
      const storedWords = new Set((c.input_pattern || '').split(' ').filter(Boolean));
      // Synonym-aware: expand stored words too
      const expandedStored = expandWithSynonyms(storedWords, this._synonymExpansionMap);

      const similarity = synonymAwareJaccard(queryWords, expandedQuery, storedWords, expandedStored);

      const recencyBonus = c.last_used_at ? getRecencyBonus(c.last_used_at) : 1.0;
      const emotionBonus = c.input_emotion === userEmotion ? 1.1 : 1.0;
      const score = similarity * c.confidence * recencyBonus * emotionBonus;

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (bestScore >= CONFIDENCE_THRESHOLD) {
      return {
        dialogue: best.response_dialogue,
        thoughts: best.response_thoughts,
        emotion:  best.response_emotion || 'neutral',
        id:       best.id,
      };
    }

    logger.log('route_local_miss', {
      bestScore:      Math.round(bestScore * 1000) / 1000,
      threshold:      CONFIDENCE_THRESHOLD,
      candidateCount: candidates.length,
    });
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

// ── Synonym helpers ───────────────────────────────────────────────────────────

/**
 * Loads synonyms.json and builds a Map<word, Set<synonyms>> for fast expansion.
 */
function buildSynonymExpansionMap() {
  const synonymsPath = path.join(__dirname, '../data/synonyms.json');
  let groups = {};
  try {
    if (fs.existsSync(synonymsPath)) {
      groups = JSON.parse(fs.readFileSync(synonymsPath, 'utf8'));
    }
  } catch (err) {
    console.error('[LocalBrain] Failed to load synonyms.json:', err.message);
  }

  const map = new Map(); // word → Set(all words in the same synonym group)
  for (const [, groupWords] of Object.entries(groups)) {
    const groupSet = new Set(groupWords);
    for (const word of groupWords) {
      if (!map.has(word)) map.set(word, new Set());
      for (const syn of groupSet) map.get(word).add(syn);
    }
  }
  return map;
}

/**
 * Expands a set of words by adding all known synonyms.
 * @param {Set<string>} wordSet
 * @param {Map}         expansionMap  - from buildSynonymExpansionMap()
 * @returns {Set<string>}
 */
function expandWithSynonyms(wordSet, expansionMap) {
  if (!expansionMap || !expansionMap.size) return wordSet;
  const expanded = new Set(wordSet);
  for (const word of wordSet) {
    const synonyms = expansionMap.get(word);
    if (synonyms) for (const syn of synonyms) expanded.add(syn);
  }
  return expanded;
}

/**
 * Synonym-aware Jaccard similarity.
 * Counts how many original query words appear in the synonym-expanded stored set,
 * and vice versa (partial credit). Denominator is the union of the original sets
 * to avoid inflating the score through expansion alone.
 *
 * @param {Set} queryWords      - original query words
 * @param {Set} expandedQuery   - query words + synonyms
 * @param {Set} storedWords     - original stored words
 * @param {Set} expandedStored  - stored words + synonyms
 * @returns {number} [0, 1]
 */
function synonymAwareJaccard(queryWords, expandedQuery, storedWords, expandedStored) {
  if (!queryWords.size || !storedWords.size) return 0;

  let matches = 0;
  // Query words found in expanded stored set
  for (const word of queryWords) {
    if (expandedStored.has(word)) matches++;
  }
  // Stored words found in expanded query set (partial credit — avoids double-counting)
  for (const word of storedWords) {
    if (!queryWords.has(word) && expandedQuery.has(word)) matches += 0.5;
  }

  const union = new Set([...queryWords, ...storedWords]).size;
  return Math.min(1.0, union > 0 ? matches / union : 0);
}

/**
 * Builds a space-separated string of topic words by expanding the topic name with synonyms.
 * e.g. "favorite_color" → "favorite color colour hue shade prefer like best enjoy fav"
 *
 * @param {string} topic         - snake_case topic name
 * @param {Map}    expansionMap  - from buildSynonymExpansionMap()
 * @returns {string}
 */
function buildTopicWords(topic, expansionMap) {
  if (!topic) return '';
  const parts = topic.split('_').filter(Boolean);
  const words = new Set(parts);
  // Add the full topic itself as a single term
  words.add(topic);
  // Expand each part with synonyms
  if (expansionMap) {
    for (const part of parts) {
      const synonyms = expansionMap.get(part);
      if (synonyms) for (const syn of synonyms) words.add(syn);
    }
  }
  return Array.from(words).join(' ');
}

// ── Filler & misc helpers ─────────────────────────────────────────────────────

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
