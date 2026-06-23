const { EMOTION_MAP, COMBINED_EMOTION_MAP, SPECIAL_EMOTIONS, RESPONSE_MARKERS } = require('./constants');

/**
 * Parses a raw Claude response string into structured parts.
 *
 * Expected format:
 *   [DIALOGUE] ...dialogue text...
 *   [THOUGHTS] ...thoughts text...
 *   (emotion_id)
 *   [MEMORY] category: fact   (optional, one or more)
 *
 * @param {string} raw - Raw response text from Claude
 * @param {object} [opts]
 * @param {string} [opts.fallbackEmotion]  Emotion to use when the model omits the tag entirely
 *                                         (e.g. inherit the previous turn's emotion instead of
 *                                         snapping back to a blank "neutral" portrait).
 * @returns {{ dialogue: string, thoughts: string, emotion: string, emotionExplicit: boolean, memories: Array }}
 */
function parseResponse(raw, opts = {}) {
  const fallbackEmotion = (opts && typeof opts.fallbackEmotion === 'string' && opts.fallbackEmotion)
    ? opts.fallbackEmotion
    : 'neutral';

  if (!raw || typeof raw !== 'string') {
    return { dialogue: '', thoughts: '', emotion: fallbackEmotion, emotionExplicit: false, memories: [], memoryUpdates: [], selfFacts: [], sensation: 0, sensationLingers: false, trackUpdates: [], rememberShort: [], rememberLong: [], recalledMemoryIds: [] };
  }

  const text = raw.trim();

  // ── Step 1: Locate the canonical end-of-message emotion tag ────────────────
  // Scan ALL (word) / *(word)* / **(word)** candidates case-insensitively. The
  // emotion tag is canonically the LAST valid one in the message, so prefer the
  // last valid candidate (this is robust to dialogue containing parens-words
  // like "(yeah)" or "(love)" that are NOT real emotions).
  // We track the position of the chosen emotion tag so we can use it as a
  // reliable upstream boundary for [DIALOGUE] / [THOUGHTS].
  const emotionRegex = /(\*{1,2})?\(([a-zA-Z_]+)\)\1?/g;
  let emotion = fallbackEmotion;
  let emotionExplicit = false;
  let emotionTagStart = text.length; // boundary for dialogue/thoughts capture
  let emoMatch;
  while ((emoMatch = emotionRegex.exec(text)) !== null) {
    const candidateRaw = emoMatch[2].trim();
    const candidateLower = candidateRaw.toLowerCase();
    // Special emotions (showBreasts, showPussy) preserve camelCase as the ID;
    // base/combined emotions are snake_case lowercase.
    if (SPECIAL_EMOTIONS[candidateRaw]) {
      emotion = candidateRaw;
      emotionExplicit = true;
      emotionTagStart = emoMatch.index;
    } else if (EMOTION_MAP[candidateLower] || COMBINED_EMOTION_MAP[candidateLower]) {
      // Prefer the LAST valid match — keep updating as we scan
      emotion = candidateLower;
      emotionExplicit = true;
      emotionTagStart = emoMatch.index;
    }
  }

  // Substring upstream of the emotion tag — everything dialogue/thoughts can live in.
  const beforeEmotion = text.slice(0, emotionTagStart);

  // ── Step 2: Extract [DIALOGUE] ─────────────────────────────────────────────
  // Structural tags only count as section separators when they START a new line.
  // A tag like "[THOUGHTS]" written mid-sentence in dialogue is treated as literal text.
  // The emotion tag (already located above) bounds the search, so we no longer rely
  // on a fragile `\([a-z_]+\)` lookahead that would over-match parens-words in prose.
  const dialogueMatch = beforeEmotion.match(/\[DIALOGUE\]([\s\S]*?)(?=\n[ \t]*(?:\[THOUGHTS\]|\[SENSATION\]|\[TRACK\]|\[MEMORY\]|\[SELF\]|\[KNOWLEDGE\]|\[FEATURE_REQUEST\]|\[AFFECTION\]|\[STATE\]|\[REMEMBER\b|\[RECALL\])|$)/i);
  const dialogue = dialogueMatch
    ? dialogueMatch[1].trim()
        .replace(/\[(?:THOUGHTS|DIALOGUE|MEMORY(?:_UPDATE)?|SELF|SENSATION|TRACK|THREAD|KNOWLEDGE|FEATURE_REQUEST|AFFECTION|STATE|REMEMBER(?::(?:short|long))?|RECALL)\]/gi, '')
        .replace(/\\n/g, ' ')  // strip literal \n text Claude occasionally outputs
        .trim()
    : '';

  // ── Step 3: Extract [THOUGHTS] ─────────────────────────────────────────────
  // Only match when the tag starts a line; mid-sentence mentions are ignored.
  // Bounded by the emotion tag position (via beforeEmotion) so paren-words in the
  // thoughts text can no longer cut the capture short.
  const thoughtsMatch = beforeEmotion.match(/(?:^|\n)[ \t]*\[THOUGHTS\]([\s\S]*?)(?=\n[ \t]*(?:\[SENSATION\]|\[TRACK\]|\[MEMORY\]|\[SELF\]|\[KNOWLEDGE\]|\[FEATURE_REQUEST\]|\[AFFECTION\]|\[STATE\]|\[REMEMBER\b|\[RECALL\])|$)/i);
  const thoughts = thoughtsMatch ? thoughtsMatch[1].trim() : '';

  // Extract [MEMORY] tags (new facts)
  const memories = [];
  const memoryRegex = /\[MEMORY\]\s*([^:]+):\s*(.+)/gi;
  let memMatch;
  while ((memMatch = memoryRegex.exec(text)) !== null) {
    memories.push({
      category: memMatch[1].trim().toLowerCase(),
      content: memMatch[2].trim(),
    });
  }

  // Extract [MEMORY_UPDATE] tags (corrections — replace contradicted facts)
  const memoryUpdates = [];
  const updateRegex = /\[MEMORY_UPDATE\]\s*([^:]+):\s*(.+)/gi;
  let updMatch;
  while ((updMatch = updateRegex.exec(text)) !== null) {
    memoryUpdates.push({
      category: updMatch[1].trim().toLowerCase(),
      content: updMatch[2].trim(),
    });
  }

  // Extract [SELF] tags (companion's own stated facts — persisted separately)
  const selfFacts = [];
  const selfRegex = /\[SELF\]\s*([^:]+):\s*(.+)/gi;
  let selfMatch;
  while ((selfMatch = selfRegex.exec(text)) !== null) {
    selfFacts.push({
      category: selfMatch[1].trim().toLowerCase(),
      content: selfMatch[2].trim(),
    });
  }

  // Extract [SENSATION] tag — physical pleasure/pain delta
  const sensationMatch = text.match(/\[SENSATION\]\s*([+-]?\d*\.?\d+)(\s+linger)?/i);
  const sensation = sensationMatch ? parseFloat(sensationMatch[1]) : 0;
  const sensationLingers = sensationMatch ? sensationMatch[2] !== undefined : false;

  // Extract [TRACK] tags — she can create/increment/set/delete any named counter
  // Supported forms:
  //   [TRACK] name: +N    — increment by N (or decrement if negative)
  //   [TRACK] name: =N    — set to exact value N
  //   [TRACK] name: DEL   — delete the counter entirely
  const trackRegex = /\[TRACK\]\s*([^:\n]+):\s*([+-]?\d+(?:\.\d+)?|=\s*-?\d+(?:\.\d+)?|DEL)/gi;
  const trackUpdates = [];
  let trackMatch;
  while ((trackMatch = trackRegex.exec(text)) !== null) {
    const name  = trackMatch[1].trim().toLowerCase();
    const raw   = trackMatch[2].trim();
    if (raw.toUpperCase() === 'DEL') {
      trackUpdates.push({ name, op: 'del' });
    } else if (raw.startsWith('=')) {
      const value = parseFloat(raw.slice(1).trim());
      if (!isNaN(value)) trackUpdates.push({ name, op: 'set', value });
    } else {
      const delta = parseFloat(raw);
      if (!isNaN(delta)) trackUpdates.push({ name, op: 'add', delta });
    }
  }

  // Extract [AFFECTION] tag — companion sets her current felt affection toward this user (0–100)
  const affectionMatch = text.match(/\[AFFECTION\]\s*(\d+)/i);
  const affectionTarget = affectionMatch ? Math.min(100, Math.max(0, parseInt(affectionMatch[1], 10))) : null;

  // Extract [STATE] tags — body-state directives Aria emits when she changes:
  //   [STATE] clothing: naked      (or: clothed)
  //   [STATE] cum: on              (or: off)
  // Multiple are allowed in one response. Last one wins per key.
  const stateChanges = {};
  const stateRegex = /\[STATE\]\s*(clothing|cum)\s*:\s*(\w+)/gi;
  let stateMatch;
  while ((stateMatch = stateRegex.exec(text)) !== null) {
    const key = stateMatch[1].toLowerCase();
    const val = stateMatch[2].toLowerCase();
    if (key === 'clothing' && (val === 'clothed' || val === 'naked')) {
      stateChanges.clothing = val;
    } else if (key === 'cum' && (val === 'on' || val === 'off' || val === 'yes' || val === 'no')) {
      stateChanges.cumState = (val === 'on' || val === 'yes');
    }
  }

  // Extract [THREAD] tags (dead topics / curiosity queue).
  // Only match at the START of a line so Aria mentioning "[THREAD]" in prose doesn't get captured.
  const threads = [];
  const threadRegex = /^[ \t]*\[THREAD\]\s*(.+)/gim;
  let threadMatch;
  while ((threadMatch = threadRegex.exec(text)) !== null) {
    threads.push(threadMatch[1].trim());
  }

  // Extract [KNOWLEDGE] tags — structured facts about the companion herself.
  // Format: [KNOWLEDGE] topic_name | fact | optional detail
  // e.g.:   [KNOWLEDGE] favorite_color | blue | reminds me of the sky at twilight
  const knowledge = [];
  const knowledgeRegex = /^[ \t]*\[KNOWLEDGE\]\s*([^|\n]+)\|([^|\n]+)(?:\|([^\n]*))?/gim;
  let knowledgeMatch;
  while ((knowledgeMatch = knowledgeRegex.exec(text)) !== null) {
    const topic     = knowledgeMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
    const factKey   = knowledgeMatch[2].trim();
    const factDetail = knowledgeMatch[3] ? knowledgeMatch[3].trim() : null;
    if (topic && factKey) {
      knowledge.push({ topic, factKey, factDetail, intent: 'QUESTION_ABOUT_COMPANION' });
    }
  }

  // Extract [FEATURE_REQUEST] tags — ideas Aria queues for her own development.
  // Format: [FEATURE_REQUEST] Short title | Longer description
  const featureRequests = [];
  const featureRequestRegex = /^\s*\[FEATURE_REQUEST\]\s*([^|\n]+)\|(.+)/gim;
  let frMatch;
  while ((frMatch = featureRequestRegex.exec(text)) !== null) {
    const title       = frMatch[1].trim();
    const description = frMatch[2].trim();
    if (title && description) {
      featureRequests.push({ title, description });
    }
  }

  // Extract [REMEMBER:short|long] tags — Aria's request to file a working memory.
  // Format: [REMEMBER:short] content here  OR  [REMEMBER:long] content here
  // Line-anchored so prose mentions don't get captured.
  const rememberShort = [];
  const rememberLong  = [];
  const rememberRegex = /^[ \t]*\[REMEMBER:(short|long)\]\s*(.+)$/gim;
  let remMatch;
  while ((remMatch = rememberRegex.exec(text)) !== null) {
    const tier = remMatch[1].toLowerCase();
    const content = remMatch[2].trim();
    if (!content) continue;
    if (tier === 'short') rememberShort.push(content);
    else if (tier === 'long') rememberLong.push(content);
  }

  // Extract [RECALL: ...] tag — comma-separated working-memory IDs that this
  // response actually drew on. Multiple [RECALL] lines accumulate.
  const recalledMemoryIds = [];
  const recallRegex = /^[ \t]*\[RECALL\]\s*(.+)$/gim;
  let recMatch;
  while ((recMatch = recallRegex.exec(text)) !== null) {
    const body = recMatch[1].trim();
    const ids = body.split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    for (const id of ids) {
      if (/^(?:shrt|long)\d+$/.test(id)) recalledMemoryIds.push(id);
    }
  }

  // Fallback: if no [DIALOGUE] marker, treat entire (non-thoughts, non-emotion, non-memory) text as dialogue
  const finalDialogue = dialogue || extractFallbackDialogue(text);

  return {
    dialogue: finalDialogue,
    thoughts,
    emotion,
    emotionExplicit,
    memories,
    memoryUpdates,
    selfFacts,
    knowledge,
    sensation,
    sensationLingers,
    trackUpdates,
    threads,
    featureRequests,
    affectionTarget,
    stateChanges,
    rememberShort,
    rememberLong,
    recalledMemoryIds,
  };
}

/**
 * If response has no [DIALOGUE] marker, try to extract useful text.
 */
function extractFallbackDialogue(text) {
  // Strip [THOUGHTS], (emotion), [MEMORY], [SELF], [THREAD], [KNOWLEDGE], [FEATURE_REQUEST] parts
  let cleaned = text
    .replace(/\[THOUGHTS\][\s\S]*?(?=\([a-z_]+\)|\[MEMORY\]|\[SELF\]|\[THREAD\]|\[KNOWLEDGE\]|\[REMEMBER\b|\[RECALL\]|$)/gi, '')
    .replace(/\([a-z_]+\)/g, '')
    .replace(/\[MEMORY(?:_UPDATE)?\][^\n]*/gi, '')
    .replace(/\[SELF\][^\n]*/gi, '')
    .replace(/\[SENSATION\][^\n]*/gi, '')
    .replace(/\[TRACK\][^\n]*/gi, '')
    .replace(/\[THREAD\][^\n]*/gi, '')
    .replace(/\[KNOWLEDGE\][^\n]*/gi, '')
    .replace(/\[FEATURE_REQUEST\][^\n]*/gi, '')
    .replace(/\[AFFECTION\][^\n]*/gi, '')
    .replace(/\[STATE\][^\n]*/gi, '')
    .replace(/\[REMEMBER:(?:short|long)\][^\n]*/gi, '')
    .replace(/\[RECALL\][^\n]*/gi, '')
    .trim();
  return cleaned || text.slice(0, 500);
}

/**
 * Strips [MEMORY], [MEMORY_UPDATE], and [SELF] lines from text (for display purposes).
 */
function stripMemoryTags(text) {
  return text
    .replace(/\[MEMORY(?:_UPDATE)?\][^\n]*/gi, '')
    .replace(/\[SELF\][^\n]*/gi, '')
    .replace(/\[SENSATION\][^\n]*/gi, '')
    .replace(/\[TRACK\][^\n]*/gi, '')
    .replace(/\[THREAD\][^\n]*/gi, '')
    .replace(/\[KNOWLEDGE\][^\n]*/gi, '')
    .replace(/\[FEATURE_REQUEST\][^\n]*/gi, '')
    .replace(/\[AFFECTION\][^\n]*/gi, '')
    .replace(/\[STATE\][^\n]*/gi, '')
    .replace(/\[REMEMBER:(?:short|long)\][^\n]*/gi, '')
    .replace(/\[RECALL\][^\n]*/gi, '')
    .trim();
}

module.exports = { parseResponse, stripMemoryTags };
