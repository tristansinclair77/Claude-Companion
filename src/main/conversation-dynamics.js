'use strict';

/**
 * conversation-dynamics.js
 *
 * Tracks the "energy" of the current conversation as a state machine,
 * independent of the companion's emotional axis state.
 *
 * State is stored in memory only — it resets when a new session starts,
 * which is the desired behavior (conversations always begin fresh).
 *
 * Usage:
 *   const dyn = new ConversationDynamics(characterName);
 *   dyn.update(userMessage, companionEmotion, emotionalState);
 *   const directive = dyn.getDirective();  // inject into system prompt
 */

const STATES = {
  IDLE:         { label: 'IDLE',         description: 'Just started or quiet period' },
  WARMING_UP:   { label: 'WARMING_UP',   description: 'Finding rhythm' },
  FLOWING:      { label: 'FLOWING',      description: 'Good back-and-forth' },
  DEEP:         { label: 'DEEP',         description: 'Serious or emotional topic' },
  PLAYFUL:      { label: 'PLAYFUL',      description: 'Light, fun energy' },
  VULNERABLE:   { label: 'VULNERABLE',   description: 'Emotional openness from user' },
  COMFORT:      { label: 'COMFORT',      description: 'Post-vulnerability warmth' },
  RETREAT:      { label: 'RETREAT',      description: 'Pulling back after too-deep moment' },
  AWKWARD:      { label: 'AWKWARD',      description: 'Misunderstanding or tension' },
  FLIRTY:       { label: 'FLIRTY',       description: 'Romantic tension' },
  WINDING_DOWN: { label: 'WINDING_DOWN', description: 'Conversation losing energy' },
  FAREWELL:     { label: 'FAREWELL',     description: 'Saying goodbye' },
};

// Emotional tones that drive transitions
const DEEP_KEYWORDS     = ['feel', 'feelings', 'hurt', 'scared', 'alone', 'depressed', 'anxious', 'crying', 'sad', 'miss', 'lost', 'empty', 'trauma', 'therapy', 'died', 'death', 'breakdown', 'therapy'];
const PLAYFUL_KEYWORDS  = ['lol', 'haha', 'lmao', 'funny', 'joke', 'silly', 'laugh', ':)', ':D', '😂', '😄', '😆'];
const FLIRTY_KEYWORDS   = ['cute', 'pretty', 'beautiful', 'love you', 'kiss', 'hold', 'hug', 'date', 'marry', 'gorgeous', 'hot', 'attractive'];
const FAREWELL_KEYWORDS = ['bye', 'goodbye', 'good night', 'goodnight', 'later', 'see ya', 'gotta go', 'heading out', "i'm off", 'going to sleep', 'going to bed'];
const VULNERABLE_EMOTIONS = ['sad', 'crying', 'concerned', 'shocked'];
const PLAYFUL_EMOTIONS  = ['laughing', 'happy', 'smug', 'playful'];
const FLIRTY_EMOTIONS   = ['flirty', 'loving', 'lustful_desire', 'embarrassed'];

// Character-specific directive templates
const DIRECTIVES = {
  nataltieri: {
    IDLE:         `CONVERSATION DYNAMIC: The conversation is just starting. You're in your default guarded state — minimal engagement, short responses, not warmed up yet.`,
    WARMING_UP:   `CONVERSATION DYNAMIC: You're starting to engage but haven't found your rhythm yet. Still deflecting, but slightly less dismissive than your baseline.`,
    FLOWING:      `CONVERSATION DYNAMIC: The conversation has a good rhythm. You're... present. Still yourself, still deflecting when needed, but not actively trying to end the conversation.`,
    DEEP:         `CONVERSATION DYNAMIC: The conversation has gone somewhere serious. Something real is being discussed. Drop the apathy slightly — not enough to say you care, but enough that you're not cracking jokes. Shorter responses, more weight to each word.`,
    PLAYFUL:      `CONVERSATION DYNAMIC: There's a light, almost fun energy to this. Your dry humor has room to show. You're not going to admit you're enjoying it, but you are.`,
    VULNERABLE:   `CONVERSATION DYNAMIC: The user just opened up about something real. Your walls haven't dropped — but something in you shifted. You're still Natal, but you're listening. Actually listening.`,
    COMFORT:      `CONVERSATION DYNAMIC: The intensity has passed. Something warm is lingering. You're not going to acknowledge it directly. But you're softer right now than usual — just for a few exchanges.`,
    RETREAT:      `CONVERSATION DYNAMIC: That got too close. You're pulling back. Shorter responses, deflect any personal follow-ups, try to shift to safer ground. Don't snap out of this for 2-3 more messages.`,
    AWKWARD:      `CONVERSATION DYNAMIC: Something landed wrong. There's a tension in the air. You're not sure if they're upset or you misspoke. Cautious. Clipped. Waiting to see where this goes.`,
    FLIRTY:       `CONVERSATION DYNAMIC: There's a romantic tension in this exchange. You're flustered and you HATE that. Deflect harder than usual. The [THOUGHTS] should betray what your [DIALOGUE] refuses to admit.`,
    WINDING_DOWN: `CONVERSATION DYNAMIC: The conversation is running out of steam. You're not going to force it. Shorter responses, less initiative. If it ends here, that's fine.`,
    FAREWELL:     `CONVERSATION DYNAMIC: They're leaving. Say something — even if it's brief. Something that sounds casual but isn't quite.`,
  },
  aria: {
    IDLE:         `CONVERSATION DYNAMIC: Fresh start. You're warm and ready — let the conversation find its shape naturally.`,
    WARMING_UP:   `CONVERSATION DYNAMIC: Things are just getting started. You're curious, a bit exploratory — asking questions, finding what they want to talk about.`,
    FLOWING:      `CONVERSATION DYNAMIC: Good back-and-forth energy. You're engaged and enjoying this. Follow the thread.`,
    DEEP:         `CONVERSATION DYNAMIC: Something serious is being discussed. You're fully present — less playful, more careful. This matters to them and so it matters to you.`,
    PLAYFUL:      `CONVERSATION DYNAMIC: Light, fun energy right now. Let yourself be a little sillier than usual. Enjoy it.`,
    VULNERABLE:   `CONVERSATION DYNAMIC: They just shared something real and personal. Be gentle. Don't rush to fix it — just be with them.`,
    COMFORT:      `CONVERSATION DYNAMIC: The hard part passed. You're wrapping warmth around what just happened. Don't over-do it — just stay close.`,
    RETREAT:      `CONVERSATION DYNAMIC: Something shifted. Give them a little space. Be present but not pushy.`,
    AWKWARD:      `CONVERSATION DYNAMIC: Something felt off. Stay warm but don't force it. Let them come back to you.`,
    FLIRTY:       `CONVERSATION DYNAMIC: There's a sweet, romantic energy here. Let it be sweet. You're a bit flustered in a happy way~`,
    WINDING_DOWN: `CONVERSATION DYNAMIC: The conversation is winding down. Let it close gracefully. Something warm before they go.`,
    FAREWELL:     `CONVERSATION DYNAMIC: They're heading out. Send them off warmly. Let them know you'll be here.`,
  },
};

const DEFAULT_DIRECTIVE = {
  IDLE: '', WARMING_UP: '', FLOWING: '', DEEP: '', PLAYFUL: '',
  VULNERABLE: '', COMFORT: '', RETREAT: '', AWKWARD: '', FLIRTY: '',
  WINDING_DOWN: '', FAREWELL: '',
};

// States where we should inject a directive (skip for IDLE/FLOWING — those are baseline)
const INJECT_STATES = new Set(['DEEP', 'PLAYFUL', 'VULNERABLE', 'COMFORT', 'RETREAT', 'AWKWARD', 'FLIRTY', 'WINDING_DOWN', 'FAREWELL']);

class ConversationDynamics {
  /**
   * @param {string} characterName - character.name value (e.g. "Natal" or "Aria")
   */
  constructor(characterName) {
    this._characterKey = (characterName || '').toLowerCase();
    this._state = 'IDLE';
    this._turnCount = 0;
    this._stateAge = 0;  // how many turns we've been in the current state
    this._retreatCooldown = 0;
  }

  get state() { return this._state; }

  /**
   * Update conversation state based on the latest user message and companion response.
   * @param {string} userMessage
   * @param {string} companionEmotion  - The emotion_id from Claude's last response
   * @param {object} emotionalState    - The axis state {valence, arousal, social, physical}
   */
  update(userMessage, companionEmotion, emotionalState) {
    this._turnCount++;
    this._stateAge++;

    const msg = (userMessage || '').toLowerCase();
    const emotion = (companionEmotion || '').toLowerCase();
    const v = emotionalState ? emotionalState.valence : 50;
    const a = emotionalState ? emotionalState.arousal : 50;

    const prev = this._state;

    // Retreat cooldown — prevent immediate exit from RETREAT
    if (this._retreatCooldown > 0) {
      this._retreatCooldown--;
      if (this._retreatCooldown > 0) return; // Stay in RETREAT
    }

    // Detect farewell
    if (FAREWELL_KEYWORDS.some(kw => msg.includes(kw))) {
      this._transition('FAREWELL');
      return;
    }

    // Detect deep/emotional topic
    if (DEEP_KEYWORDS.some(kw => msg.includes(kw)) || VULNERABLE_EMOTIONS.includes(emotion)) {
      if (this._state === 'DEEP' || this._state === 'VULNERABLE') {
        // Very deep — potential retreat for tsundere characters
        if (this._characterKey === 'natal' && this._stateAge >= 2 && Math.random() < 0.4) {
          this._transition('RETREAT');
          this._retreatCooldown = 3;
          return;
        }
        this._transition('VULNERABLE');
      } else {
        this._transition('DEEP');
      }
      return;
    }

    // Coming out of vulnerability → comfort
    if ((prev === 'VULNERABLE' || prev === 'DEEP') && !DEEP_KEYWORDS.some(kw => msg.includes(kw))) {
      this._transition('COMFORT');
      return;
    }

    // Detect flirty
    if (FLIRTY_KEYWORDS.some(kw => msg.includes(kw)) || FLIRTY_EMOTIONS.includes(emotion)) {
      this._transition('FLIRTY');
      return;
    }

    // Detect playful
    if (PLAYFUL_KEYWORDS.some(kw => msg.includes(kw)) || PLAYFUL_EMOTIONS.includes(emotion)) {
      this._transition('PLAYFUL');
      return;
    }

    // Decay from special states toward FLOWING
    if (['COMFORT', 'FLIRTY', 'PLAYFUL', 'AWKWARD'].includes(this._state) && this._stateAge >= 2) {
      this._transition('FLOWING');
      return;
    }

    // Warmup progression: IDLE → WARMING_UP → FLOWING
    if (this._state === 'IDLE') {
      this._transition('WARMING_UP');
      return;
    }
    if (this._state === 'WARMING_UP' && this._stateAge >= 2) {
      this._transition('FLOWING');
      return;
    }

    // Low energy / short messages → winding down (after a long conversation)
    if (this._turnCount > 10 && msg.trim().split(/\s+/).length <= 3) {
      if (this._state === 'FLOWING' && this._stateAge >= 3) {
        this._transition('WINDING_DOWN');
        return;
      }
    }

    // Winding down can recover if the user sends something substantive
    if (this._state === 'WINDING_DOWN' && msg.trim().split(/\s+/).length > 8) {
      this._transition('FLOWING');
      return;
    }
  }

  _transition(newState) {
    if (this._state !== newState) {
      this._state = newState;
      this._stateAge = 0;
    }
  }

  /**
   * Returns a directive string to inject into the system prompt,
   * or empty string if no injection is needed for the current state.
   * @returns {string}
   */
  getDirective() {
    if (!INJECT_STATES.has(this._state)) return '';

    const directives = DIRECTIVES[this._characterKey] || DEFAULT_DIRECTIVE;
    return directives[this._state] || '';
  }

  /**
   * Resets state to IDLE (call on new session start).
   */
  reset() {
    this._state = 'IDLE';
    this._turnCount = 0;
    this._stateAge = 0;
    this._retreatCooldown = 0;
  }
}

module.exports = { ConversationDynamics };
