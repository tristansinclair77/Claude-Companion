// All 38 companion emotion states
const EMOTIONS = [
  // ── Core / Original ────────────────────────────────────────────────────────
  { id: 'neutral',               emoji: '😐', color: '#888888', file: 'neutral.png',               label: 'Neutral' },
  { id: 'happy',                 emoji: '😊', color: '#ffdd00', file: 'happy.png',                 label: 'Happy' },
  { id: 'soft_smile',            emoji: '🙂', color: '#ffcc44', file: 'soft_smile.png',            label: 'Soft Smile' },
  { id: 'laughing',              emoji: '😄', color: '#ff9900', file: 'laughing.png',              label: 'Laughing' },
  { id: 'confident',             emoji: '😎', color: '#00ccff', file: 'confident.png',             label: 'Confident' },
  { id: 'smug',                  emoji: '😏', color: '#aa44ff', file: 'smug.png',                  label: 'Smug' },
  { id: 'surprised',             emoji: '😮', color: '#ffaa00', file: 'surprised.png',             label: 'Surprised' },
  { id: 'shocked',               emoji: '😱', color: '#ff4444', file: 'shocked.png',               label: 'Shocked' },
  { id: 'confused',              emoji: '😕', color: '#aa8800', file: 'confused.png',              label: 'Confused' },
  { id: 'thinking',              emoji: '🤔', color: '#4488ff', file: 'thinking.png',              label: 'Thinking' },
  { id: 'concerned',             emoji: '😟', color: '#ff8844', file: 'concerned.png',             label: 'Concerned' },
  { id: 'sad',                   emoji: '😢', color: '#4488bb', file: 'sad.png',                   label: 'Sad' },
  { id: 'angry',                 emoji: '😠', color: '#ff2222', file: 'angry.png',                 label: 'Angry' },
  { id: 'determined',            emoji: '💪', color: '#ff6600', file: 'determined.png',            label: 'Determined' },
  { id: 'embarrassed',           emoji: '😳', color: '#ff88aa', file: 'embarrassed.png',           label: 'Embarrassed' },
  { id: 'exhausted',             emoji: '😴', color: '#666688', file: 'exhausted.png',             label: 'Exhausted' },
  { id: 'pout',                  emoji: '😤', color: '#dd6600', file: 'pout.png',                  label: 'Pout' },
  { id: 'crying',                emoji: '😭', color: '#6688cc', file: 'crying.png',                label: 'Crying' },
  { id: 'lustful_desire',        emoji: '😍', color: '#ff44aa', file: 'lustful_desire.png',        label: 'Lustful Desire' },
  // ── Extended ───────────────────────────────────────────────────────────────
  { id: 'excited',               emoji: '🤩', color: '#ffaa00', file: 'excited.png',               label: 'Excited' },
  { id: 'loving',                emoji: '💗', color: '#ff6688', file: 'loving.png',                label: 'Loving' },
  { id: 'nervous',               emoji: '😬', color: '#aaaa44', file: 'nervous.png',               label: 'Nervous' },
  { id: 'longing',               emoji: '🥺', color: '#8899cc', file: 'longing.png',               label: 'Longing' },
  { id: 'curious',               emoji: '🧐', color: '#44aaff', file: 'curious.png',               label: 'Curious' },
  { id: 'disappointed',          emoji: '😞', color: '#888899', file: 'disappointed.png',          label: 'Disappointed' },
  { id: 'relieved',              emoji: '😅', color: '#66cc88', file: 'relieved.png',              label: 'Relieved' },
  { id: 'playful',               emoji: '😜', color: '#ffcc00', file: 'playful.png',               label: 'Playful' },
  { id: 'proud',                 emoji: '🫡', color: '#ffaa44', file: 'proud.png',                 label: 'Proud' },
  { id: 'apologetic',            emoji: '🙏', color: '#aaaaaa', file: 'apologetic.png',            label: 'Apologetic' },
  { id: 'content',               emoji: '😌', color: '#88cc88', file: 'content.png',               label: 'Content' },
  { id: 'flirty',                emoji: '😘', color: '#ff66aa', file: 'flirty.png',                label: 'Flirty' },
  { id: 'flustered',             emoji: '😖', color: '#ff8899', file: 'flustered.png',             label: 'Flustered' },
  { id: 'in_awe',                emoji: '😲', color: '#88aaff', file: 'in_awe.png',                label: 'In Awe' },
  { id: 'in_pleasure',           emoji: '🥰', color: '#ff88cc', file: 'in_pleasure.png',           label: 'In Pleasure' },
  { id: 'sleepy',                emoji: '💤', color: '#8888aa', file: 'sleepy.png',                label: 'Sleepy' },
  { id: 'sickly',                emoji: '🤒', color: '#88aa44', file: 'sickly.png',                label: 'Sickly' },
  { id: 'wheezing_laughter',     emoji: '🤣', color: '#ff8800', file: 'wheezing_laughter.png',     label: 'Wheezing Laughter' },
  { id: 'frantic_desperation',   emoji: '😰', color: '#ff4400', file: 'frantic_desperation.png',   label: 'Frantic Desperation' },
];

const EMOTION_MAP = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]));

// ── Combined / Blended emotion states ─────────────────────────────────────────
// Used when two distinct emotional states are genuinely present simultaneously.
// Images live in characters/default/emotions/combined/<id>.png
// Colors are the averaged hex of the two constituent emotion colors.
const COMBINED_EMOTIONS = [
  // ── Tier 1 — Very common, high value ──────────────────────────────────────
  { id: 'happy_confused',              tier: 1, a: 'happy',              b: 'confused',             emoji: '😊😕', color: '#d4b200', label: 'Happy & Confused'           },
  { id: 'nervous_excited',             tier: 1, a: 'nervous',            b: 'excited',              emoji: '😬🤩', color: '#d4aa22', label: 'Nervous & Excited'          },
  { id: 'sad_angry',                   tier: 1, a: 'sad',                b: 'angry',                emoji: '😢😠', color: '#a1556e', label: 'Sad & Angry'                },
  { id: 'concerned_thinking',          tier: 1, a: 'concerned',          b: 'thinking',             emoji: '😟🤔', color: '#a188a1', label: 'Concerned & Thinking'       },
  { id: 'embarrassed_laughing',        tier: 1, a: 'embarrassed',        b: 'laughing',             emoji: '😳😄', color: '#ff9055', label: 'Embarrassed & Laughing'     },
  { id: 'loving_sad',                  tier: 1, a: 'loving',             b: 'sad',                  emoji: '💗😢', color: '#a177a1', label: 'Loving & Sad'               },
  { id: 'confident_smug',              tier: 1, a: 'confident',          b: 'smug',                 emoji: '😎😏', color: '#5588ff', label: 'Confident & Smug'           },
  { id: 'exhausted_sad',               tier: 1, a: 'exhausted',          b: 'sad',                  emoji: '😴😢', color: '#5577a1', label: 'Exhausted & Sad'            },
  { id: 'flustered_nervous',           tier: 1, a: 'flustered',          b: 'nervous',              emoji: '😖😬', color: '#d4996e', label: 'Flustered & Nervous'        },
  { id: 'curious_confused',            tier: 1, a: 'curious',            b: 'confused',             emoji: '🧐😕', color: '#77997f', label: 'Curious & Confused'         },
  // ── Tier 2 — Situationally important ─────────────────────────────────────
  { id: 'sickly_sad',                  tier: 2, a: 'sickly',             b: 'sad',                  emoji: '🤒😢', color: '#66997f', label: 'Sickly & Sad'               },
  { id: 'sickly_exhausted',            tier: 2, a: 'sickly',             b: 'exhausted',            emoji: '🤒😴', color: '#778866', label: 'Sickly & Exhausted'         },
  { id: 'relieved_exhausted',          tier: 2, a: 'relieved',           b: 'exhausted',            emoji: '😅😴', color: '#669988', label: 'Relieved & Exhausted'       },
  { id: 'proud_loving',                tier: 2, a: 'proud',              b: 'loving',               emoji: '🫡💗', color: '#ff8866', label: 'Proud & Loving'             },
  { id: 'playful_confident',           tier: 2, a: 'playful',            b: 'confident',            emoji: '😜😎', color: '#7fcc7f', label: 'Playful & Confident'        },
  { id: 'shocked_confused',            tier: 2, a: 'shocked',            b: 'confused',             emoji: '😱😕', color: '#d46622', label: 'Shocked & Confused'         },
  { id: 'longing_sad',                 tier: 2, a: 'longing',            b: 'sad',                  emoji: '🥺😢', color: '#6690c3', label: 'Longing & Sad'              },
  { id: 'content_loving',              tier: 2, a: 'content',            b: 'loving',               emoji: '😌💗', color: '#c39988', label: 'Content & Loving'           },
  { id: 'embarrassed_apologetic',      tier: 2, a: 'embarrassed',        b: 'apologetic',           emoji: '😳🙏', color: '#d499aa', label: 'Embarrassed & Apologetic'   },
  { id: 'frantic_desperation_crying',  tier: 2, a: 'frantic_desperation', b: 'crying',             emoji: '😰😭', color: '#b26666', label: 'Frantic & Crying'           },
  // ── Tier 3 — Niche but expressive ────────────────────────────────────────
  { id: 'laughing_crying',             tier: 3, a: 'laughing',           b: 'crying',               emoji: '😄😭', color: '#b29066', label: 'Laughing & Crying'          },
  { id: 'smug_angry',                  tier: 3, a: 'smug',               b: 'angry',                emoji: '😏😠', color: '#d43390', label: 'Smug & Angry'               },
  { id: 'thinking_concerned',          tier: 3, a: 'thinking',           b: 'concerned',            emoji: '🤔😟', color: '#a188a1', label: 'Thinking & Concerned'       },
  { id: 'excited_nervous',             tier: 3, a: 'excited',            b: 'nervous',              emoji: '🤩😬', color: '#d4aa22', label: 'Excited & Nervous'          },
  { id: 'in_pleasure_embarrassed',     tier: 3, a: 'in_pleasure',        b: 'embarrassed',          emoji: '🥰😳', color: '#ff88bb', label: 'In Pleasure & Embarrassed'  },
  { id: 'flirty_nervous',              tier: 3, a: 'flirty',             b: 'nervous',              emoji: '😘😬', color: '#d48877', label: 'Flirty & Nervous'           },
  { id: 'wheezing_laughter_exhausted', tier: 3, a: 'wheezing_laughter',  b: 'exhausted',            emoji: '🤣😴', color: '#b27744', label: 'Wheezing & Exhausted'       },
];

const COMBINED_EMOTION_MAP = Object.fromEntries(COMBINED_EMOTIONS.map((e) => [e.id, e]));

// ── Emotional Axis Profiles ────────────────────────────────────────────────────
// Maps each emotion to a position on 4 axes (0-100 scale).
// V = Valence    (0=negative, 100=positive)
// A = Arousal    (0=calm,     100=activated)
// S = Social     (0=submissive, 100=dominant)
// P = Physical   (0=sick/tired, 100=healthy/alert)
// The axes track Aria's persistent emotional baseline across all sessions.
const EMOTION_AXES = {
  neutral:              { V: 50, A: 40, S: 50, P: 70 },
  happy:                { V: 80, A: 65, S: 55, P: 75 },
  soft_smile:           { V: 72, A: 45, S: 55, P: 72 },
  laughing:             { V: 85, A: 80, S: 58, P: 80 },
  confident:            { V: 70, A: 65, S: 75, P: 80 },
  smug:                 { V: 65, A: 55, S: 80, P: 75 },
  surprised:            { V: 55, A: 75, S: 48, P: 65 },
  shocked:              { V: 40, A: 85, S: 35, P: 60 },
  confused:             { V: 45, A: 45, S: 40, P: 65 },
  thinking:             { V: 52, A: 50, S: 50, P: 70 },
  concerned:            { V: 35, A: 55, S: 45, P: 65 },
  sad:                  { V: 20, A: 25, S: 30, P: 55 },
  angry:                { V: 15, A: 85, S: 70, P: 65 },
  determined:           { V: 65, A: 80, S: 75, P: 80 },
  embarrassed:          { V: 35, A: 60, S: 25, P: 60 },
  exhausted:            { V: 35, A: 10, S: 35, P: 20 },
  pout:                 { V: 25, A: 60, S: 40, P: 65 },
  crying:               { V: 10, A: 50, S: 20, P: 45 },
  lustful_desire:       { V: 78, A: 82, S: 58, P: 78 },
  excited:              { V: 85, A: 90, S: 60, P: 85 },
  loving:               { V: 88, A: 60, S: 55, P: 78 },
  nervous:              { V: 35, A: 70, S: 30, P: 60 },
  longing:              { V: 40, A: 35, S: 30, P: 65 },
  curious:              { V: 65, A: 60, S: 55, P: 75 },
  disappointed:         { V: 20, A: 30, S: 35, P: 55 },
  relieved:             { V: 68, A: 35, S: 50, P: 68 },
  playful:              { V: 78, A: 70, S: 65, P: 80 },
  proud:                { V: 75, A: 65, S: 80, P: 78 },
  apologetic:           { V: 35, A: 40, S: 20, P: 60 },
  content:              { V: 75, A: 30, S: 52, P: 72 },
  flirty:               { V: 78, A: 65, S: 65, P: 75 },
  flustered:            { V: 45, A: 65, S: 25, P: 62 },
  in_awe:               { V: 72, A: 70, S: 42, P: 72 },
  in_pleasure:          { V: 92, A: 95, S: 60, P: 85 },
  sleepy:               { V: 50, A: 10, S: 45, P: 30 },
  sickly:               { V: 30, A: 20, S: 30, P: 15 },
  wheezing_laughter:    { V: 80, A: 85, S: 50, P: 70 },
  frantic_desperation:  { V: 15, A: 92, S: 22, P: 50 },
};

// Sensation system — pleasure/pain accumulator
// Per-message decay toward 0 (lingering sensations fade over subsequent turns).
const SENSATION_DECAY = 0.88;
const SENSATION_MAX   = 1.0;

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
  COMBINED_EMOTIONS,
  COMBINED_EMOTION_MAP,
  EMOTION_AXES,
  CONFIDENCE_THRESHOLD,
  CONVERSATION_WINDOW_SIZE,
  SUMMARIZE_CHUNK_SIZE,
  SOURCES,
  RESPONSE_MARKERS,
  SENSATION_DECAY,
  SENSATION_MAX,
};
