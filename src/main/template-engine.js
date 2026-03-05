'use strict';

const path = require('path');
const fs   = require('fs');

/**
 * TemplateEngine — generates fresh, character-voiced responses from stored knowledge entries.
 *
 * Templates are stored in characters/{name}/templates.json.
 * Each template belongs to an intent category and a topic key (supports wildcards like "favorite_*").
 * Variable substitution fills {fact}, {detail}, {context}, {topic}, {times_asked}, {name}.
 *
 * Repeat-awareness: templates with tone "repeat_N" are only eligible when times_asked >= N.
 * Recently-used tracking: the last _maxRecent template IDs are not re-used (per session).
 */
class TemplateEngine {
  /**
   * @param {string} characterDir - Path to the character directory (e.g. characters/default/)
   */
  constructor(characterDir) {
    this._templates = {};
    this._recentlyUsed = []; // last _maxRecent used template IDs this session
    this._maxRecent = 6;
    if (characterDir) this._load(characterDir);
  }

  _load(characterDir) {
    const templatePath = path.join(characterDir, 'templates.json');
    if (!fs.existsSync(templatePath)) {
      this._templates = {};
      return;
    }
    try {
      this._templates = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
      console.log('[TemplateEngine] Loaded templates from:', templatePath);
    } catch (err) {
      console.error('[TemplateEngine] Failed to load templates:', err.message);
      this._templates = {};
    }
  }

  /**
   * Try to generate a response from a stored knowledge entry + templates.
   *
   * @param {object} opts
   * @param {string}      opts.intent         - e.g. 'QUESTION_ABOUT_COMPANION'
   * @param {string|null} opts.topic          - e.g. 'favorite_color' or null (for CONTINUATION)
   * @param {object|null} opts.knowledge      - companion_knowledge row or null
   * @param {object}      opts.character      - character.json object
   * @param {object|null} opts.emotionalState - { valence, arousal, social, physical } or null
   * @returns {{ dialogue, thoughts, emotion, templateId } | null}
   */
  generate({ intent, topic, knowledge, character, emotionalState = null }) {
    const intentTemplates = this._templates[intent];
    if (!intentTemplates) return null;

    const eligible = this._findEligibleTemplates(intentTemplates, topic, knowledge);
    if (!eligible.length) return null;

    const template = this._weightedRandom(eligible);
    if (!template) return null;

    // Build variable substitution map
    // {detail} is capped to the first short phrase — templates expect a brief elaboration,
    // not Claude's full stored explanation. This prevents verbose multi-clause paragraphs
    // from being dumped into short conversational template slots.
    const vars = {
      fact:        knowledge ? (knowledge.fact_key    || '')  : '',
      detail:      knowledge ? _truncateDetail(knowledge.fact_detail || '') : '',
      context:     knowledge ? (knowledge.fact_context || '') : '',
      topic:       knowledge ? (knowledge.topic || '').replace(/_/g, ' ') : (topic || '').replace(/_/g, ' '),
      times_asked: knowledge ? String(knowledge.times_asked || 1) : '1',
      name:        character ? (character.name || '') : '',
    };

    const dialogue = this._fill(template.template, vars);
    if (!dialogue) return null;

    // Track recently used
    this._recentlyUsed.push(template.id);
    if (this._recentlyUsed.length > this._maxRecent) this._recentlyUsed.shift();

    const thoughts = this._generateThoughts(intent, topic, knowledge, template.tone, character);
    const emotion  = this._inferEmotion(template.tone, emotionalState);

    return { dialogue, thoughts, emotion, templateId: template.id };
  }

  /**
   * Returns true if we have any templates registered for this intent.
   */
  hasTemplatesFor(intent) {
    return !!this._templates[intent];
  }

  /**
   * Reload templates from disk (e.g. after a character switch).
   */
  reload(characterDir) {
    this._load(characterDir);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _findEligibleTemplates(intentTemplates, topic, knowledge) {
    const timesAsked = knowledge ? (knowledge.times_asked || 1) : 1;
    let candidates = [];

    // 1. Exact topic match
    if (topic && intentTemplates[topic]) {
      candidates.push(...intentTemplates[topic]);
    }

    // 2. Wildcard topic matches: "favorite_*" matches "favorite_color", "favorite_food", etc.
    for (const [key, temps] of Object.entries(intentTemplates)) {
      if (key === topic) continue; // already added above
      if (key === '*') {
        // '*' is the generic fallback — added last
        continue;
      }
      if (key.endsWith('_*') && topic) {
        const prefix = key.slice(0, -1); // "favorite_*" → "favorite_"
        if (topic.startsWith(prefix)) {
          candidates.push(...temps);
        }
      }
    }

    // 3. Generic '*' fallback if no specific match found
    if (candidates.length === 0 && intentTemplates['*']) {
      candidates.push(...intentTemplates['*']);
    } else if (intentTemplates['*']) {
      // Also include '*' templates as low-weight alternatives
      candidates.push(...intentTemplates['*'].map(t => ({ ...t, weight: (t.weight || 1.0) * 0.4 })));
    }

    // 4. Filter by recently-used (don't repeat same template immediately)
    candidates = candidates.filter(t => !this._recentlyUsed.includes(t.id));

    // If filtering left nothing, relax the recently-used constraint
    if (candidates.length === 0) {
      candidates = [];
      if (topic && intentTemplates[topic])  candidates.push(...intentTemplates[topic]);
      if (intentTemplates['*'])             candidates.push(...intentTemplates['*']);
    }

    // 5. Apply repeat-awareness rules
    // Templates with tone "repeat_N" require times_asked >= N
    // Regular templates are suppressed in favour of repeat templates when times_asked >= 2
    const repeatTemplates  = candidates.filter(t => t.tone && t.tone.startsWith('repeat_') && timesAsked >= parseInt(t.tone.split('_')[1], 10));
    const regularTemplates = candidates.filter(t => !t.tone || !t.tone.startsWith('repeat_'));

    if (timesAsked >= 2 && repeatTemplates.length > 0) {
      // Heavily weight repeat templates but keep regulars as a minority option
      const weighted = [
        ...repeatTemplates,
        ...regularTemplates.map(t => ({ ...t, weight: (t.weight || 1.0) * 0.3 })),
      ];
      return weighted;
    }

    return regularTemplates.length > 0 ? regularTemplates : candidates;
  }

  _weightedRandom(templates) {
    if (!templates.length) return null;
    const total = templates.reduce((sum, t) => sum + (t.weight || 1.0), 0);
    let r = Math.random() * total;
    for (const t of templates) {
      r -= (t.weight || 1.0);
      if (r <= 0) return t;
    }
    return templates[templates.length - 1];
  }

  _fill(template, vars) {
    if (!template) return null;
    let result = template;

    for (const [key, val] of Object.entries(vars)) {
      if (val === null || val === undefined || val === '') {
        // Remove just the placeholder — surrounding sentences may still work
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), '');
      } else {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
      }
    }

    // Clean up artifacts from empty substitutions
    result = result
      .replace(/\s{2,}/g, ' ')             // double spaces
      .replace(/^\s*[.,!?~\-—]\s+/g, '')   // orphaned leading punctuation
      .replace(/\s+([.,!?~])/g, '$1')      // space before punctuation
      .replace(/([.,!?~])\s*([.,!?~])/g, '$1') // doubled punctuation
      .trim();

    return result || null;
  }

  _generateThoughts(intent, topic, knowledge, tone, character) {
    // Static intents — no knowledge needed
    const staticThoughts = {
      GREETING:            ["They're back.", "Starting a new conversation.", "Let's see what's on their mind today."],
      CONTINUATION:        ["They want more.", "Where was I...", "Okay, they're still with me."],
      EMOTIONAL_EXPRESSION:["They're sharing how they feel. I should be present.", "This is important to them.", "I want to understand this."],
      CASUAL_CHAT:         ["Just chatting. That's nice.", "No particular agenda — just being here.", "This is comfortable."],
    };

    if (!knowledge) {
      const pool = staticThoughts[intent] || ["...hmm."];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    const topicReadable = (knowledge.topic || '').replace(/_/g, ' ');
    const times = knowledge.times_asked || 1;

    if (times === 1) {
      return `They asked about my ${topicReadable}. I know this — ${knowledge.fact_key}.`;
    } else if (times === 2) {
      return `They're asking about my ${topicReadable} again. Still ${knowledge.fact_key}. Do they forget, or do they just like hearing it?`;
    } else {
      return `Third time on ${topicReadable}. Either it really matters to them, or they're testing me. Either way — still ${knowledge.fact_key}.`;
    }
  }

  _inferEmotion(tone, emotionalState) {
    const toneMap = {
      'warm':       'soft_smile',
      'playful':    'happy',
      'thoughtful': 'thinking',
      'curious':    'thinking',
      'gentle':     'soft_smile',
      'sarcastic':  'smug',
      'deadpan':    'neutral',
      'excited':    'happy',
      'shy':        'embarrassed',
      'fond':       'soft_smile',
      'teasing':    'smug',
    };

    const baseTone = (tone && tone.startsWith('repeat_')) ? 'playful' : tone;
    let emotion = toneMap[baseTone] || 'neutral';

    // Soften positive emotions if companion is in a low-valence state
    if (emotionalState && emotionalState.valence < 20) {
      if (emotion === 'happy')    emotion = 'soft_smile';
      if (emotion === 'smug')     emotion = 'neutral';
    }

    return emotion;
  }
}

/**
 * Truncates a knowledge detail string to a short, template-friendly phrase.
 * Templates expect a brief elaboration (e.g. "reminds me of the sky at twilight"),
 * not the full paragraph Claude may have stored. Takes the first clause/sentence
 * up to maxLen characters, stripping trailing commas and dangling connectors.
 *
 * @param {string} detail
 * @param {number} [maxLen=70]
 * @returns {string}
 */
function _truncateDetail(detail, maxLen = 70) {
  if (!detail) return '';
  // Trim leading/trailing whitespace and strip embedded newlines
  let d = detail.replace(/\s*\n\s*/g, ' ').trim();

  // Stop at first hard sentence boundary (. ! ? ;) within reasonable length
  const boundaryMatch = d.match(/^(.{10,}?)[.!?;]/);
  if (boundaryMatch && boundaryMatch[1].length <= maxLen) {
    return boundaryMatch[1].trim();
  }

  // No short boundary found — cap at maxLen on a word boundary
  if (d.length > maxLen) {
    const cut = d.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    d = lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
    // Strip trailing connectors/punctuation that look orphaned
    d = d.replace(/[,\s—\-]+$/, '').trim();
  }

  return d;
}

module.exports = TemplateEngine;
