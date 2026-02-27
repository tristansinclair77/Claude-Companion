const { EMOTION_MAP, RESPONSE_MARKERS } = require('./constants');

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
    return { dialogue: '', thoughts: '', emotion: 'neutral', memories: [], memoryUpdates: [], selfFacts: [] };
  }

  const text = raw.trim();

  // Extract [DIALOGUE]
  const dialogueMatch = text.match(/\[DIALOGUE\]([\s\S]*?)(?=\[THOUGHTS\]|\([a-z_]+\)|$)/i);
  const dialogue = dialogueMatch ? dialogueMatch[1].trim() : '';

  // Extract [THOUGHTS]
  const thoughtsMatch = text.match(/\[THOUGHTS\]([\s\S]*?)(?=\([a-z_]+\)|\[MEMORY\]|$)/i);
  const thoughts = thoughtsMatch ? thoughtsMatch[1].trim() : '';

  // Extract emotion (emotion_id) — must match one of our 19 emotions
  const emotionMatch = text.match(/\(([a-z_]+)\)/);
  let emotion = 'neutral';
  if (emotionMatch) {
    const candidate = emotionMatch[1].toLowerCase().trim();
    if (EMOTION_MAP[candidate]) {
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

  // Fallback: if no [DIALOGUE] marker, treat entire (non-thoughts, non-emotion, non-memory) text as dialogue
  const finalDialogue = dialogue || extractFallbackDialogue(text);

  return {
    dialogue: finalDialogue,
    thoughts,
    emotion,
    memories,
    memoryUpdates,
    selfFacts,
  };
}

/**
 * If response has no [DIALOGUE] marker, try to extract useful text.
 */
function extractFallbackDialogue(text) {
  // Strip [THOUGHTS], (emotion), [MEMORY], [SELF] parts
  let cleaned = text
    .replace(/\[THOUGHTS\][\s\S]*?(?=\([a-z_]+\)|\[MEMORY\]|\[SELF\]|$)/gi, '')
    .replace(/\([a-z_]+\)/g, '')
    .replace(/\[MEMORY(?:_UPDATE)?\][^\n]*/gi, '')
    .replace(/\[SELF\][^\n]*/gi, '')
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
    .trim();
}

module.exports = { parseResponse, stripMemoryTags };
