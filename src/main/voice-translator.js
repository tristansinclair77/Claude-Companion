'use strict';

/**
 * voice-translator.js
 *
 * Local post-processing pipeline that transforms Claude's raw dialogue output
 * into authentic character voice. Runs entirely on local compute — no API calls.
 *
 * Pipeline order:
 *   1. Split into sentences
 *   2. Vocabulary replacement
 *   3. Remove / replace banned words
 *   4. Apply sentence structure rules (truncate, fragment)
 *   5. Add character quirks (ellipsis prefix, tilde, parentheticals)
 *   6. Emotional dampening / amplification
 *   7. Vulnerability leak (rare warmth bleed-through for tsundere characters)
 *   8. Speech imperfections (self-corrections, stutters, mumbles)
 */

const fs   = require('fs');
const path = require('path');

// ─── Rule loading ─────────────────────────────────────────────────────────────

const _cache = {};

/**
 * Loads voice-rules.json from a character directory.
 * Returns null if not found (disables translation silently).
 * @param {string} characterDir  Absolute path to the character's folder
 * @returns {object|null}
 */
function loadVoiceRules(characterDir) {
  if (_cache[characterDir] !== undefined) return _cache[characterDir];
  const filePath = path.join(characterDir, 'voice-rules.json');
  if (!fs.existsSync(filePath)) {
    _cache[characterDir] = null;
    return null;
  }
  try {
    _cache[characterDir] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.warn('[voice-translator] Failed to parse voice-rules.json:', e.message);
    _cache[characterDir] = null;
  }
  return _cache[characterDir];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function pick(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function chance(probability) {
  return Math.random() < probability;
}

/**
 * Splits text into sentences while preserving trailing punctuation.
 * Handles ellipsis, em-dash, and tilde reasonably well.
 */
function splitSentences(text) {
  // Split on sentence-ending punctuation followed by whitespace.
  // Exclude ellipsis (three dots) — "..." should not split.
  // Strategy: replace "..." with a placeholder, split, then restore.
  const ELLIPSIS_PLACEHOLDER = '\x00ELLIPSIS\x00';
  let t = text.replace(/\.\.\./g, ELLIPSIS_PLACEHOLDER);

  // Split after . ! ? ~ when followed by one or more spaces
  const raw = t.split(/(?<=[.!?~])\s+/);

  // Also split on em-dash sentence breaks
  const result = [];
  for (const chunk of raw) {
    const parts = chunk.split(/(?<=—)\s+/);
    result.push(...parts);
  }

  return result
    .map(s => s.replace(new RegExp(ELLIPSIS_PLACEHOLDER, 'g'), '...').trim())
    .filter(Boolean);
}

function joinSentences(sentences) {
  return sentences.join(' ').replace(/\s{2,}/g, ' ').trim();
}

// ─── Step 2: Vocabulary replacement ──────────────────────────────────────────

function applyVocabReplacements(sentence, vocabulary) {
  if (!vocabulary || !vocabulary.replacements) return sentence;
  let s = sentence;
  for (const [find, replacements] of Object.entries(vocabulary.replacements)) {
    if (!Array.isArray(replacements) || replacements.length === 0) continue;
    const replacement = pick(replacements);
    // Case-insensitive whole-phrase replacement
    const regex = new RegExp(escapeRegex(find), 'gi');
    s = s.replace(regex, replacement);
  }
  return s;
}

// ─── Step 3: Banned word removal ─────────────────────────────────────────────

function removeBannedWords(sentence, bannedWords) {
  if (!bannedWords || bannedWords.length === 0) return sentence;
  let s = sentence;
  for (const word of bannedWords) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    // Replace with empty string, then clean up double spaces
    s = s.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
  }
  return s;
}

// ─── Step 4: Sentence structure ───────────────────────────────────────────────

function applyStructureRules(sentences, rules) {
  if (!rules) return sentences;

  return sentences.map(s => {
    // Trailing-off: end the sentence with ... or — instead of finishing it
    if (rules.trailing_off_frequency && chance(rules.trailing_off_frequency)) {
      // Remove existing terminal punctuation and add the trailing marker
      s = s.replace(/[.!?]+$/, '') + (rules.trailing_off_marker || '...');
    }

    // Fragment: drop the last phrase (comma-split heuristic)
    if (rules.fragment_frequency && chance(rules.fragment_frequency)) {
      const commaIdx = s.lastIndexOf(',');
      if (commaIdx > s.length / 2) {
        s = s.slice(0, commaIdx).trim();
      }
    }

    // Max sentence length (word count truncation)
    if (rules.max_sentence_length) {
      const words = s.split(/\s+/);
      if (words.length > rules.max_sentence_length) {
        s = words.slice(0, rules.max_sentence_length).join(' ').replace(/[,]$/, '') + '...';
      }
    }

    return s;
  });
}

// ─── Step 5: Character quirks ─────────────────────────────────────────────────

function applyQuirks(sentences, quirks, vocabulary) {
  if (!quirks) return sentences;

  return sentences.map((s, i) => {
    // Ellipsis prefix (Natal: start most sentences with "...")
    if (quirks.ellipsis_prefix_chance && chance(quirks.ellipsis_prefix_chance)) {
      if (!s.startsWith('...') && !s.startsWith('(')) {
        s = '...' + s;
      }
    }

    // Avoid exclamation marks
    if (quirks.avoid_exclamation_marks) {
      s = s.replace(/!/g, '.');
    }

    // Lowercase tendency (randomly lowercase first letter)
    if (quirks.lowercase_tendency && chance(quirks.lowercase_tendency)) {
      s = s.charAt(0).toLowerCase() + s.slice(1);
    }

    // Tilde warmth (Aria: append ~ to some sentences)
    if (quirks.tilde_warmth_chance && chance(quirks.tilde_warmth_chance)) {
      if (!s.endsWith('~') && !s.endsWith('...')) {
        s = s.replace(/[.!?]$/, '') + '~';
      }
    }

    // Parenthetical mumble (Natal: add "(…it's not like I care.)" style asides)
    if (
      quirks.parenthetical_thoughts &&
      quirks.parenthetical_chance &&
      quirks.parenthetical_phrases &&
      quirks.parenthetical_phrases.length > 0 &&
      chance(quirks.parenthetical_chance) &&
      i === sentences.length - 1  // Only at the end
    ) {
      s = s + ' ' + pick(quirks.parenthetical_phrases);
    }

    return s.trim();
  });
}

// ─── Step 6: Emotional dampening / amplification ──────────────────────────────

function applyEmotionalFilter(sentences, dampening, emotionalState) {
  if (!dampening || !emotionalState) return sentences;

  // For now: if positive valence + positive scale < 0.5, suppress exclamation endings
  if (dampening.positive_scale && dampening.positive_scale < 0.5) {
    return sentences.map(s => s.replace(/!+/g, '.'));
  }

  return sentences;
}

// ─── Step 7: Vulnerability leak ───────────────────────────────────────────────

function maybeAddVulnerabilityLeak(sentences, dampening) {
  if (
    !dampening ||
    !dampening.vulnerability_leak_chance ||
    !dampening.vulnerability_phrases ||
    dampening.vulnerability_phrases.length === 0
  ) {
    return sentences;
  }

  if (chance(dampening.vulnerability_leak_chance)) {
    // Replace the last sentence with a vulnerability leak
    const leak = pick(dampening.vulnerability_phrases);
    return [...sentences.slice(0, -1), leak];
  }

  return sentences;
}

// ─── Step 8: Speech imperfections ────────────────────────────────────────────

function addImperfections(text, quirks, emotionalState) {
  if (!quirks || !emotionalState) return text;

  const currentEmotion = (emotionalState.currentEmotion || '').toLowerCase();
  let result = text;

  // Self-correction injection
  if (quirks.self_correction_chance && quirks.self_correction_phrases && quirks.self_correction_phrases.length > 0) {
    if (chance(quirks.self_correction_chance)) {
      // Inject after the first sentence
      const firstPeriod = result.search(/[.!?~]/);
      if (firstPeriod !== -1) {
        result =
          result.slice(0, firstPeriod + 1) +
          ' ' + pick(quirks.self_correction_phrases) +
          result.slice(firstPeriod + 1);
      }
    }
  }

  // Stutter on embarrassment / nervousness
  if (['embarrassed', 'flustered', 'nervous'].includes(currentEmotion)) {
    // Find the first "I" word and stutter it
    result = result.replace(/\bI\b(?!')/g, (match, offset) => {
      // Only stutter the first occurrence
      if (offset < 20 && chance(0.35)) return 'I-I';
      return match;
    });
  }

  return result;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Runs the full voice translation pipeline on a parsed dialogue string.
 *
 * @param {string} rawDialogue    The [DIALOGUE] text from Claude's response
 * @param {object} voiceRules     Loaded voice-rules.json object (or null)
 * @param {object} emotionalState Current emotional state {valence, arousal, social, physical, currentEmotion}
 * @returns {string}              Transformed dialogue
 */
function processDialogue(rawDialogue, voiceRules, emotionalState) {
  if (!voiceRules || !rawDialogue) return rawDialogue;

  const { vocabulary, sentence_structure, emotional_dampening, quirks } = voiceRules;

  // Step 1: Split
  let sentences = splitSentences(rawDialogue);
  if (sentences.length === 0) return rawDialogue;

  // Step 2: Vocab replacement
  sentences = sentences.map(s => applyVocabReplacements(s, vocabulary));

  // Step 3: Remove banned words
  sentences = sentences.map(s => removeBannedWords(s, vocabulary && vocabulary.banned_words));

  // Step 4: Structure rules
  sentences = applyStructureRules(sentences, sentence_structure);

  // Step 5: Quirks
  sentences = applyQuirks(sentences, quirks, vocabulary);

  // Step 6: Emotional filter
  sentences = applyEmotionalFilter(sentences, emotional_dampening, emotionalState);

  // Step 7: Vulnerability leak
  sentences = maybeAddVulnerabilityLeak(sentences, emotional_dampening);

  // Step 8: Join and add imperfections
  let result = joinSentences(sentences);
  result = addImperfections(result, quirks, emotionalState || {});

  return result;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { loadVoiceRules, processDialogue };
