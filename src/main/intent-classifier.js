'use strict';

// Intent categories — what kind of message is the user sending?
const INTENTS = {
  QUESTION_ABOUT_COMPANION: 'QUESTION_ABOUT_COMPANION', // "What's your favorite color?"
  QUESTION_ABOUT_USER:       'QUESTION_ABOUT_USER',      // "What do you know about me?"
  GREETING:                  'GREETING',                 // "Hey!", "Good morning"
  EMOTIONAL_EXPRESSION:      'EMOTIONAL_EXPRESSION',     // "I'm feeling sad today"
  CASUAL_CHAT:               'CASUAL_CHAT',              // "So what's up?"
  OPINION_REQUEST:           'OPINION_REQUEST',          // "What do you think about X?"
  FACTUAL_RECALL:            'FACTUAL_RECALL',           // "Do you remember my birthday?"
  COMMAND:                   'COMMAND',                  // "Tell me a joke"
  CONTINUATION:              'CONTINUATION',             // "And?", "Go on"
  UNKNOWN:                   'UNKNOWN',
};

const CONFIDENCE = {
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
};

/**
 * Classifies the intent of a user message.
 * Returns { intent, confidence }.
 * LOW confidence → caller should skip local brain and go to Claude.
 *
 * @param {string} message - Raw user message
 * @returns {{ intent: string, confidence: string }}
 */
function classifyIntent(message) {
  if (!message || typeof message !== 'string') {
    return { intent: INTENTS.UNKNOWN, confidence: CONFIDENCE.LOW };
  }

  const lower = message.toLowerCase().trim();
  const len = lower.length;

  // ── CONTINUATION — very short affirmations or explicit "keep going" signals ──
  if (len < 20) {
    if (/^(and|go on|then what|what else|continue|keep going|tell me more|yeah|yes|okay|so|\?|really|wow|oh|interesting|hm+|mm+|wait|and then|then|so then)\?*[~!]*$/.test(lower)) {
      return { intent: INTENTS.CONTINUATION, confidence: CONFIDENCE.HIGH };
    }
    if (/^(cool|nice|neat|got it|i see|makes sense|right|sure|fair enough|agreed)\?*[~!]*$/.test(lower)) {
      return { intent: INTENTS.CONTINUATION, confidence: CONFIDENCE.MEDIUM };
    }
  }

  // ── GREETING — short opening messages ──
  if (len < 40 && /^(hi|hey|hello|good morning|good evening|good afternoon|good night|howdy|sup|what's up|yo|hiya|greetings|morning|evening|afternoon|night)\b/.test(lower)) {
    return { intent: INTENTS.GREETING, confidence: CONFIDENCE.HIGH };
  }

  // ── FACTUAL_RECALL — user asking companion to recall something about themselves ──
  if (/\b(remember|recall|forget|did you know|have i told you|do you know)\b/.test(lower) && /\b(my|me|i|about me)\b/.test(lower)) {
    return { intent: INTENTS.FACTUAL_RECALL, confidence: CONFIDENCE.HIGH };
  }

  // ── QUESTION_ABOUT_USER — rare, asking what the companion knows about them ──
  if (/\b(what do you (know|remember|think you know) about me|what have you (learned|noticed|picked up) about me)\b/.test(lower)) {
    return { intent: INTENTS.QUESTION_ABOUT_USER, confidence: CONFIDENCE.HIGH };
  }

  // ── EMOTIONAL_EXPRESSION — user sharing how they currently feel ──
  const EMOTION_WORDS = /\b(happy|sad|angry|tired|excited|lonely|anxious|bored|great|awful|depressed|stressed|nervous|okay|fine|bad|good|scared|frustrated|overwhelmed|lost|confused|miserable|exhausted|amazing|terrible|wonderful|drained|upset|down|hopeful|hopeless|grateful|numb|empty)\b/;
  if (/\b(i'm|i am|i feel|i've been|feeling|been feeling|i've felt|i just feel)\b/.test(lower) && EMOTION_WORDS.test(lower)) {
    return { intent: INTENTS.EMOTIONAL_EXPRESSION, confidence: CONFIDENCE.HIGH };
  }
  // Also catch "feeling [emotion] today/lately/right now"
  if (/feeling\s+\w+\s*(today|lately|right now|recently|a bit|really|so|kind of)\b/.test(lower)) {
    return { intent: INTENTS.EMOTIONAL_EXPRESSION, confidence: CONFIDENCE.MEDIUM };
  }

  // ── OPINION_REQUEST — asking companion's take on something external ──
  if (/\b(what do you think( about| of)?|what('s| is) your (opinion|take|view|thoughts?)( on)?|how do you feel about|your thoughts on|what do you make of|do you think)\b/.test(lower)) {
    // Only if it's NOT about the companion itself (avoid overlap with QUESTION_ABOUT_COMPANION)
    if (!/\b(you|your|yourself)\b/.test(lower.replace(/what do you think|how do you feel about/g, ''))) {
      return { intent: INTENTS.OPINION_REQUEST, confidence: CONFIDENCE.HIGH };
    }
  }

  // ── META-QUESTION guard — user is asking the companion to react/opine about an *action*,
  //    not to answer an embedded question. These must be caught before QUESTION_ABOUT_COMPANION
  //    because they often contain "you/your/favorite" in a subordinate clause.
  //    Examples: "Is it weird that I ask you X?", "Do you mind if I ask about Y?",
  //              "Am I being strange for asking about Z?", "Is it okay that I wonder about X?"
  if (/\b(is it (weird|strange|odd|bad|okay|ok|fine|normal|wrong|creepy|annoying|silly|dumb)|do you mind if|does it bother you|am i (weird|strange|bad|wrong|being) (for|to|if)|is that (weird|okay|strange|normal|fine|bad)|it('s| is) weird that i)\b/.test(lower)) {
    return { intent: INTENTS.OPINION_REQUEST, confidence: CONFIDENCE.HIGH };
  }

  // ── COMPANION-EVALUATES-USER guard — companion is being asked to assess or react to
  //    *the user*, not report a stored self-fact. Subject of these questions is the user,
  //    not the companion. They all contain "you" and slip into QUESTION_ABOUT_COMPANION.
  //    Examples: "Do you think I'm weird?", "Are you tired of me?", "Can you tell I'm nervous?",
  //              "Does it annoy you when I ask the same thing?", "Did you expect me to say that?"
  if (
    /\b(do you think|would you say|can you tell|does it seem( like)?|does it look( like)?) (i'm|i am|i've|i have|i was|i('m| am) being)\b/.test(lower) ||
    /\b(are you|do you get|do you ever) (tired|bored|sick|annoyed|fed up|frustrated) (of|with) (me|this|us)\b/.test(lower) ||
    /\b(does it|did it|do i) (annoy|bother|surprise|tire|frustrate|concern|worry|amuse|bug|upset) you\b/.test(lower) ||
    /\bdid you expect (me|us|that|this)\b/.test(lower)
  ) {
    return { intent: INTENTS.OPINION_REQUEST, confidence: CONFIDENCE.HIGH };
  }

  // ── HYPOTHETICAL / PERMISSION / CONVERSATION-META guard — asking about a hypothetical
  //    reaction, requesting permission, or commenting on the conversation pattern itself.
  //    Examples: "What would you do if I told you X?", "How would you feel if I left?",
  //              "Can I ask you something personal?", "Have you noticed I keep asking about X?",
  //              "Why do you think I keep bringing this up?"
  if (
    /\b(what would you (do|say|think)|how would you feel|would you (be okay|mind|care|still (like|want|talk))) if (i|we)\b/.test(lower) ||
    /\b(can|may|could) i (ask you|tell you|share something|say something|talk to you about)\b/.test(lower) ||
    /\b(have you noticed|did you notice) (i |we |that i|how i|that we)\b/.test(lower) ||
    /\b(why do you think|do you know why) i\b/.test(lower)
  ) {
    return { intent: INTENTS.OPINION_REQUEST, confidence: CONFIDENCE.HIGH };
  }

  // ── QUESTION_ABOUT_COMPANION — question directed at the companion herself ──
  // Must contain a question word + "you/your"
  if (
    /\b(what|which|how|do|does|are|is|can|would|will|have|did|were|was)\b/.test(lower) &&
    /\b(you|your|yours|yourself)\b/.test(lower)
  ) {
    // Self-correction guard: "your X, wait MY X" or "your X, actually MY X" — the user
    // mid-sentence flipped the subject from the companion to themselves. Treat as ambiguous.
    if (/\b(wait|actually|no|i mean|correction)\b.*\bm(y|ine)\b/.test(lower) ||
        /\bm(y|ine)\b.*\b(wait|actually|no|i mean)\b.*\b(your?|yours)\b/.test(lower)) {
      return { intent: INTENTS.UNKNOWN, confidence: CONFIDENCE.LOW };
    }

    // Higher confidence if it ends with "?" or has a clear preference/self keyword
    const hasPreferenceWord = /\b(favorite|favourite|prefer|like|love|hate|feel|think|believe|want|dream|wish|opinion|view|enjoy|dislike|fear|scared|afraid|do you)\b/.test(lower);
    const confidence = (lower.endsWith('?') || hasPreferenceWord) ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM;
    return { intent: INTENTS.QUESTION_ABOUT_COMPANION, confidence };
  }

  // ── COMMAND — imperative requests ──
  if (/^(tell me|give me|show me|explain|describe|write|sing|say|list|help me|can you|could you|would you|please)\b/.test(lower)) {
    return { intent: INTENTS.COMMAND, confidence: CONFIDENCE.MEDIUM };
  }

  // ── CASUAL_CHAT — vague open-ended openers ──
  if (len < 60 && /^(so|well|anyway|you know|speaking of|by the way|hey so|i was thinking|random(ly)?|guess what|fun fact)\b/.test(lower)) {
    return { intent: INTENTS.CASUAL_CHAT, confidence: CONFIDENCE.MEDIUM };
  }

  // ── Weak fallback: ends with "?" and mentions "you" ──
  if (lower.endsWith('?') && len < 80 && /\byou\b/.test(lower)) {
    return { intent: INTENTS.QUESTION_ABOUT_COMPANION, confidence: CONFIDENCE.MEDIUM };
  }

  return { intent: INTENTS.UNKNOWN, confidence: CONFIDENCE.LOW };
}

/**
 * Extracts the dominant emotional topic from a user message.
 * Used when intent == EMOTIONAL_EXPRESSION to pick the right template bucket.
 *
 * @param {string} message
 * @returns {string|null} e.g. 'sad', 'happy', 'tired', 'anxious', or null
 */
function extractEmotionalTopic(message) {
  const lower = message.toLowerCase();

  if (/\b(happy|glad|joyful|excited|amazing|wonderful|great|fantastic|thrilled|elated)\b/.test(lower)) return 'happy';
  if (/\b(sad|unhappy|down|depressed|miserable|heartbroken|upset|crying|cry|tearful|grief)\b/.test(lower)) return 'sad';
  if (/\b(tired|exhausted|drained|sleepy|fatigued|worn out|lethargic|weary)\b/.test(lower)) return 'tired';
  if (/\b(anxious|nervous|worried|scared|afraid|stressed|overwhelmed|fearful|uneasy|anxiousness)\b/.test(lower)) return 'anxious';
  if (/\b(angry|mad|furious|frustrated|irritated|annoyed|rage|furious)\b/.test(lower)) return 'angry';
  if (/\b(lonely|alone|isolated|disconnected|empty|numb)\b/.test(lower)) return 'lonely';
  if (/\b(bored|boring|nothing to do|restless)\b/.test(lower)) return 'bored';
  if (/\b(confused|lost|unsure|uncertain|overwhelmed)\b/.test(lower)) return 'confused';
  if (/\b(grateful|thankful|blessed|appreciative)\b/.test(lower)) return 'happy'; // map to happy

  return null;
}

module.exports = { classifyIntent, extractEmotionalTopic, INTENTS, CONFIDENCE };
