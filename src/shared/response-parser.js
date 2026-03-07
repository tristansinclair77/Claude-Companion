const { EMOTION_MAP, COMBINED_EMOTION_MAP, RESPONSE_MARKERS } = require('./constants');

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
 * @returns {{ dialogue: string, thoughts: string, emotion: string, memories: Array }}
 */
function parseResponse(raw) {
  if (!raw || typeof raw !== 'string') {
    return { dialogue: '', thoughts: '', emotion: 'neutral', memories: [], memoryUpdates: [], selfFacts: [], sensation: 0, sensationLingers: false, trackUpdates: [] };
  }

  const text = raw.trim();

  // Extract [DIALOGUE] — structural tags only count as section separators when they START a new line.
  // A tag like "[THOUGHTS]" written mid-sentence in dialogue is treated as literal text, not a split point.
  // [THREAD] omitted from lookahead deliberately (Aria may mention it in prose).
  const dialogueMatch = text.match(/\[DIALOGUE\]([\s\S]*?)(?=\n[ \t]*(?:\[THOUGHTS\]|\[SENSATION\]|\[TRACK\]|\[MEMORY\]|\[SELF\])|\([a-z_]+\)|$)/i);
  // Strip any residual inline structural markers so they don't appear verbatim in the UI.
  const dialogue = dialogueMatch
    ? dialogueMatch[1].trim()
        .replace(/\[(?:THOUGHTS|DIALOGUE|MEMORY(?:_UPDATE)?|SELF|SENSATION|TRACK|THREAD|KNOWLEDGE|FEATURE_REQUEST)\]/gi, '')
        .replace(/\\n/g, ' ')  // strip literal \n text Claude occasionally outputs
        .trim()
    : '';

  // Extract [THOUGHTS] — only match when the tag starts a line; mid-sentence mentions are ignored.
  const thoughtsMatch = text.match(/(?:^|\n)[ \t]*\[THOUGHTS\]([\s\S]*?)(?=\n[ \t]*(?:\[SENSATION\]|\[TRACK\]|\[MEMORY\]|\[SELF\])|\([a-z_]+\)|$)/i);
  const thoughts = thoughtsMatch ? thoughtsMatch[1].trim() : '';

  // Extract emotion (emotion_id) — must match one of our 19 emotions
  const emotionMatch = text.match(/\(([a-z_]+)\)/);
  let emotion = 'neutral';
  if (emotionMatch) {
    const candidate = emotionMatch[1].toLowerCase().trim();
    if (EMOTION_MAP[candidate] || COMBINED_EMOTION_MAP[candidate]) {
      emotion = candidate;
    }
  }

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

  // Fallback: if no [DIALOGUE] marker, treat entire (non-thoughts, non-emotion, non-memory) text as dialogue
  const finalDialogue = dialogue || extractFallbackDialogue(text);

  return {
    dialogue: finalDialogue,
    thoughts,
    emotion,
    memories,
    memoryUpdates,
    selfFacts,
    knowledge,
    sensation,
    sensationLingers,
    trackUpdates,
    threads,
    featureRequests,
  };
}

/**
 * If response has no [DIALOGUE] marker, try to extract useful text.
 */
function extractFallbackDialogue(text) {
  // Strip [THOUGHTS], (emotion), [MEMORY], [SELF], [THREAD], [KNOWLEDGE], [FEATURE_REQUEST] parts
  let cleaned = text
    .replace(/\[THOUGHTS\][\s\S]*?(?=\([a-z_]+\)|\[MEMORY\]|\[SELF\]|\[THREAD\]|\[KNOWLEDGE\]|$)/gi, '')
    .replace(/\([a-z_]+\)/g, '')
    .replace(/\[MEMORY(?:_UPDATE)?\][^\n]*/gi, '')
    .replace(/\[SELF\][^\n]*/gi, '')
    .replace(/\[SENSATION\][^\n]*/gi, '')
    .replace(/\[TRACK\][^\n]*/gi, '')
    .replace(/\[THREAD\][^\n]*/gi, '')
    .replace(/\[KNOWLEDGE\][^\n]*/gi, '')
    .replace(/\[FEATURE_REQUEST\][^\n]*/gi, '')
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
    .trim();
}

module.exports = { parseResponse, stripMemoryTags };
