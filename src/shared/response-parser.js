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

  // Extract [DIALOGUE] — stop at structural tags. [THREAD] deliberately excluded: Aria may
  // mention "[THREAD]" literally in explanatory prose. The emotion tag already stops dialogue.
  const dialogueMatch = text.match(/\[DIALOGUE\]([\s\S]*?)(?=\[THOUGHTS\]|\[SENSATION\]|\[TRACK\]|\[MEMORY\]|\[SELF\]|\([a-z_]+\)|$)/i);
  const dialogue = dialogueMatch ? dialogueMatch[1].trim() : '';

  // Extract [THOUGHTS] — same: [THREAD] omitted from lookahead for the same reason.
  const thoughtsMatch = text.match(/\[THOUGHTS\]([\s\S]*?)(?=\[SENSATION\]|\[TRACK\]|\[MEMORY\]|\[SELF\]|\([a-z_]+\)|$)/i);
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

  // Fallback: if no [DIALOGUE] marker, treat entire (non-thoughts, non-emotion, non-memory) text as dialogue
  const finalDialogue = dialogue || extractFallbackDialogue(text);

  return {
    dialogue: finalDialogue,
    thoughts,
    emotion,
    memories,
    memoryUpdates,
    selfFacts,
    sensation,
    sensationLingers,
    trackUpdates,
    threads,
  };
}

/**
 * If response has no [DIALOGUE] marker, try to extract useful text.
 */
function extractFallbackDialogue(text) {
  // Strip [THOUGHTS], (emotion), [MEMORY], [SELF], [THREAD] parts
  let cleaned = text
    .replace(/\[THOUGHTS\][\s\S]*?(?=\([a-z_]+\)|\[MEMORY\]|\[SELF\]|\[THREAD\]|$)/gi, '')
    .replace(/\([a-z_]+\)/g, '')
    .replace(/\[MEMORY(?:_UPDATE)?\][^\n]*/gi, '')
    .replace(/\[SELF\][^\n]*/gi, '')
    .replace(/\[SENSATION\][^\n]*/gi, '')
    .replace(/\[TRACK\][^\n]*/gi, '')
    .replace(/\[THREAD\][^\n]*/gi, '')
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
    .trim();
}

module.exports = { parseResponse, stripMemoryTags };
