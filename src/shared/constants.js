// All 19 companion emotion states
const EMOTIONS = [
  { id: 'neutral',        emoji: '😐', color: '#888888', file: 'neutral.png',        label: 'Neutral' },
  { id: 'happy',          emoji: '😊', color: '#ffdd00', file: 'happy.png',          label: 'Happy' },
  { id: 'soft_smile',     emoji: '🙂', color: '#ffcc44', file: 'soft_smile.png',     label: 'Soft Smile' },
  { id: 'laughing',       emoji: '😄', color: '#ff9900', file: 'laughing.png',       label: 'Laughing' },
  { id: 'confident',      emoji: '😎', color: '#00ccff', file: 'confident.png',      label: 'Confident' },
  { id: 'smug',           emoji: '😏', color: '#aa44ff', file: 'smug.png',           label: 'Smug' },
  { id: 'surprised',      emoji: '😮', color: '#ffaa00', file: 'surprised.png',      label: 'Surprised' },
  { id: 'shocked',        emoji: '😱', color: '#ff4444', file: 'shocked.png',        label: 'Shocked' },
  { id: 'confused',       emoji: '😕', color: '#aa8800', file: 'confused.png',       label: 'Confused' },
  { id: 'thinking',       emoji: '🤔', color: '#4488ff', file: 'thinking.png',       label: 'Thinking' },
  { id: 'concerned',      emoji: '😟', color: '#ff8844', file: 'concerned.png',      label: 'Concerned' },
  { id: 'sad',            emoji: '😢', color: '#4488bb', file: 'sad.png',            label: 'Sad' },
  { id: 'angry',          emoji: '😠', color: '#ff2222', file: 'angry.png',          label: 'Angry' },
  { id: 'determined',     emoji: '💪', color: '#ff6600', file: 'determined.png',     label: 'Determined' },
  { id: 'embarrassed',    emoji: '😳', color: '#ff88aa', file: 'embarrassed.png',    label: 'Embarrassed' },
  { id: 'exhausted',      emoji: '😴', color: '#666688', file: 'exhausted.png',      label: 'Exhausted' },
  { id: 'pout',           emoji: '😤', color: '#dd6600', file: 'pout.png',           label: 'Pout' },
  { id: 'crying',         emoji: '😭', color: '#6688cc', file: 'crying.png',         label: 'Crying' },
  { id: 'lustful_desire', emoji: '😍', color: '#ff44aa', file: 'lustful_desire.png', label: 'Lustful Desire' },
];

const EMOTION_MAP = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]));

// Local brain confidence threshold — above this, use local response instead of Claude.
// Score = jaccard × confidence × recencyBonus × emotionBonus.
// Default confidence is 0.5, same-day recency bonus is 1.2 → max score ~0.66 for perfect match.
// Threshold of 0.25 means a good Jaccard overlap (≥0.5) on a fresh response will match locally.
const CONFIDENCE_THRESHOLD = 0.25;

// Rolling conversation window size before summarization kicks in
const CONVERSATION_WINDOW_SIZE = 20;
const SUMMARIZE_CHUNK_SIZE = 10;

// Source types
const SOURCES = {
  FILLER: 'filler',
  LOCAL: 'local',
  CLAUDE: 'claude',
};

// Response format markers Claude uses
const RESPONSE_MARKERS = {
  DIALOGUE: '[DIALOGUE]',
  THOUGHTS: '[THOUGHTS]',
  MEMORY: '[MEMORY]',
};

module.exports = {
  EMOTIONS,
  EMOTION_MAP,
  CONFIDENCE_THRESHOLD,
  CONVERSATION_WINDOW_SIZE,
  SUMMARIZE_CHUNK_SIZE,
  SOURCES,
  RESPONSE_MARKERS,
};
