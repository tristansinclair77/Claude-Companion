# Smarter Logic & Behavior — Breaking Through Claude's Personality

## The Core Problem

Claude is polite. Claude is helpful. Claude is... Claude. No matter how hard you prompt it to "be Natal Tieri, the apathetic tsundere," Claude's underlying personality bleeds through:

- Responses are always well-structured and grammatically perfect
- Emotional range defaults to warm/supportive/encouraging
- Claude avoids genuine negativity, rudeness, or dismissiveness
- Every response feels "crafted" rather than spontaneous
- The vocabulary is consistently sophisticated and measured
- Claude rarely uses fragments, interrupts itself, or trails off naturally

You've experienced this: the prompt says "be cold and dismissive" but Claude gives you a beautifully articulated cold response that still somehow feels warm because of how carefully it's phrased.

This document explores techniques to break through that — from lightweight post-processing to deeper architectural changes.

---

## Technique 1: Local Response Translation Engine

### The Idea
Take Claude's raw response and run it through a **local transformation layer** that rewrites it to match the character's actual speech patterns. No API call needed — pure text manipulation.

### How It Works

```
Claude outputs:   "I suppose blue would be my preferred color. There's something
                   quite calming about it, reminiscent of the sky at dusk."

Translation for Natal:
                  "...Blue. The sky, or whatever. Don't make it weird."

Translation for Aria:
                  "Blue~! Like the sky at sunset — it just makes me feel so calm!"
```

### Implementation: Character Voice Rules

Each character gets a `voice-rules.json` that defines transformation patterns:

```json
{
  "character": "nataltieri",
  "rules": {
    "sentence_structure": {
      "max_sentence_length": 12,
      "fragment_frequency": 0.4,
      "trailing_off_frequency": 0.3,
      "trailing_off_marker": "...",
      "interruption_frequency": 0.15,
      "interruption_markers": ["—", "...no.", "...forget it."]
    },
    "vocabulary": {
      "replacements": {
        "I think": ["...maybe", "I guess", ""],
        "I believe": ["...probably", ""],
        "That's wonderful": ["...okay", "Hmph"],
        "I really enjoy": ["...it's fine", "I don't hate it"],
        "I love": ["...it's tolerable", "...don't say that word"],
        "absolutely": ["sure", "whatever"],
        "definitely": ["I guess", "probably"],
        "amazing": ["fine", "not terrible"],
        "beautiful": ["...acceptable", "decent"],
        "I appreciate": ["...thanks, I guess", ""]
      },
      "banned_words": ["wonderful", "fantastic", "absolutely", "certainly", "delightful"],
      "injection_words": {
        "sentence_start": ["...", "Hmph.", "Tch.", "...look,"],
        "sentence_end": ["...whatever.", "...or something.", "...don't look at me like that."]
      }
    },
    "emotional_dampening": {
      "positive_scale": 0.4,
      "negative_scale": 1.2,
      "vulnerability_leak_chance": 0.15
    },
    "quirks": {
      "ellipsis_prefix_chance": 0.5,
      "avoid_exclamation_marks": true,
      "lowercase_tendency": 0.3,
      "parenthetical_thoughts": true,
      "self_correction_chance": 0.1
    }
  }
}
```

### The Translation Pipeline

```javascript
function translateResponse(rawDialogue, character, voiceRules, emotionalState) {
  let text = rawDialogue;

  // Step 1: Break into sentences
  let sentences = splitIntoSentences(text);

  // Step 2: Vocabulary replacement
  sentences = sentences.map(s => applyVocabReplacements(s, voiceRules.vocabulary));

  // Step 3: Remove banned words and rephrase
  sentences = sentences.map(s => removeBannedWords(s, voiceRules.vocabulary.banned_words));

  // Step 4: Apply sentence structure rules
  sentences = applySentenceStructure(sentences, voiceRules.sentence_structure);

  // Step 5: Add character quirks
  sentences = applyQuirks(sentences, voiceRules.quirks);

  // Step 6: Emotional dampening/amplification
  sentences = applyEmotionalFilter(sentences, voiceRules.emotional_dampening, emotionalState);

  // Step 7: Add vulnerability leaks (rare, makes character feel real)
  sentences = maybeAddVulnerability(sentences, voiceRules, emotionalState);

  return sentences.join(' ');
}
```

### Example Transformations

**Claude raw output:**
> "I think that's a really great idea! You should definitely pursue it. I believe you have the talent to make it work, and I'm excited to see what you create."

**After Natal translation:**
> "...It's not a bad idea, I guess. You could probably pull it off. ...don't let it go to your head."

**After Aria translation:**
> "Oh~! That's such a good idea! You should totally go for it — I just know you'll make something amazing~!"

### The Vulnerability Leak

This is the secret sauce for characters like Natal. 85% of the time, she's cold and dismissive. But 15% of the time (controlled by `vulnerability_leak_chance`), the translation engine **deliberately lets a warm phrase through unfiltered**:

> User: "I just wanted to say I appreciate you being here."
> Natal (normal): "...whatever. It's not like I have anywhere else to be."
> Natal (vulnerability leak): "...I appreciate you too. ...forget I said that."

This creates the push-pull dynamic that makes tsundere characters compelling. Claude provides the emotional content, and the translation engine controls how much of it survives to the surface.

---

## Technique 2: Response Structure Randomization

### The Problem
Claude's responses always follow the same rhythm: acknowledgment → main point → elaboration → closing warmth. Real people don't talk like this.

### The Fix: Structure Templates Per Character

Define how a character's responses should be structured, and rearrange Claude's output to match:

```javascript
const STRUCTURE_PATTERNS = {
  nataltieri: [
    // Pattern 1: Blunt answer, then trail off
    { structure: ['answer', 'trail_off'], weight: 0.35 },
    // Pattern 2: Deflection, then reluctant answer
    { structure: ['deflection', 'pause', 'answer'], weight: 0.25 },
    // Pattern 3: Question back, then answer
    { structure: ['counter_question', 'answer'], weight: 0.20 },
    // Pattern 4: Internal thought leak, then answer
    { structure: ['mumble', 'answer', 'denial'], weight: 0.15 },
    // Pattern 5: Just the answer (rare directness)
    { structure: ['answer'], weight: 0.05 },
  ],

  aria: [
    // Pattern 1: Excited reaction, then answer, then question
    { structure: ['reaction', 'answer', 'follow_up_question'], weight: 0.30 },
    // Pattern 2: Thoughtful pause, then answer
    { structure: ['thinking_aloud', 'answer', 'elaboration'], weight: 0.25 },
    // Pattern 3: Direct answer with enthusiasm
    { structure: ['answer', 'enthusiasm', 'tangent'], weight: 0.25 },
    // Pattern 4: Relate to user, then answer
    { structure: ['relate', 'answer'], weight: 0.20 },
  ]
};
```

### Structure Element Generators

```javascript
const ELEMENTS = {
  nataltieri: {
    trail_off:       () => pick(["...whatever.", "...or something.", "...forget it.", "..."]),
    deflection:      () => pick(["Why do you even want to know?", "...does it matter?", "You're asking me that?"]),
    pause:           () => "...",
    counter_question: (topic) => pick([`Why, what's yours?`, `...why?`, `Does it matter?`]),
    mumble:          () => pick(["(...it's not like I care.)", "(...stupid question.)"]),
    denial:          () => pick(["Don't read into it.", "It doesn't mean anything.", "...shut up."]),
  },

  aria: {
    reaction:         () => pick(["Oh~!", "Ooh, good question!", "Hmm~"]),
    enthusiasm:       () => pick(["I love thinking about stuff like this~", "Isn't that cool?", "It just makes me happy~"]),
    follow_up_question: (topic) => pick([`What about you?`, `Do you feel the same way?`, `Have you thought about that before?`]),
    thinking_aloud:   () => pick(["Let me think...", "Hmm, that's interesting~", "Oh, you know what?"]),
    tangent:          () => pick(["Oh! That reminds me—", "Speaking of which~", "Actually, you know what's funny?"]),
    relate:           (topic) => pick(["I was just thinking about that!", "You know, that connects to something—"]),
  }
};
```

### How It Assembles

```javascript
function restructureResponse(claudeAnswer, character, topic) {
  const patterns = STRUCTURE_PATTERNS[character];
  const elements = ELEMENTS[character];
  const pattern = weightedPick(patterns);

  const parts = pattern.structure.map(element => {
    if (element === 'answer') return claudeAnswer;  // Claude's actual content
    if (elements[element]) return elements[element](topic);
    return '';
  });

  return parts.filter(Boolean).join(' ');
}
```

**Claude gives:** "Blue"
**Natal pattern [deflection, pause, answer]:** "...does it matter? ...Blue."
**Natal pattern [answer, trail_off]:** "Blue. ...whatever."
**Aria pattern [reaction, answer, follow_up_question]:** "Oh~! Blue! What about you?"

Every response has a **different structure** even for the same content.

---

## Technique 3: Imperfect Speech Patterns

### The Problem
Claude never makes "mistakes." Real people (and convincing characters) do.

### Speech Imperfection Engine

```javascript
function addImperfections(text, character, emotionalState) {
  const arousal = emotionalState.arousal; // 0-100

  // Higher arousal = more speech imperfections
  const imperfectionChance = Math.min(0.5, arousal / 200);

  let result = text;

  // Self-corrections: "I mean—" "no wait—" "actually,"
  if (Math.random() < imperfectionChance * 0.3) {
    result = injectSelfCorrection(result, character);
    // "Blue. No wait, more like... navy? Yeah, navy."
  }

  // Trailing thoughts: sentences that don't finish
  if (Math.random() < imperfectionChance * 0.2 && character === 'nataltieri') {
    result = addTrailingThought(result);
    // "It reminds me of... never mind."
  }

  // Emphasis through repetition (high emotion)
  if (arousal > 70 && Math.random() < 0.3) {
    result = addEmphasisRepetition(result);
    // "It's blue. It's always been blue."
  }

  // Stuttering (embarrassment/nervousness)
  if (['embarrassed', 'flustered', 'nervous'].includes(emotionalState.currentEmotion)) {
    result = addStutter(result, 0.2);
    // "I-it's blue... don't laugh."
  }

  // Mumbled parentheticals (low social axis = submissive)
  if (emotionalState.social < 35 && character === 'nataltieri') {
    result = addMumble(result);
    // "Blue. (...like it matters.)"
  }

  return result;
}
```

### Character-Specific Imperfections

**Natal Tieri:**
- Ellipsis before most sentences (thinking/reluctance)
- Self-interruption ("It's—no. Forget it.")
- Denial after vulnerability ("That was... I didn't mean it like that.")
- Muttered parentheticals ("(...idiot.)")
- Rarely finishes emotional sentences

**Aria:**
- Tilde usage for warmth ("Right~?")
- Excited run-on sentences when aroused
- "Oh!" and "Hmm~" interjections
- Self-aware tangents ("Wait, where was I going with this?")
- Giggly deflections when embarrassed

---

## Technique 4: Prompt Engineering Refinements

Before building complex post-processing, there are prompt-level tricks that can make Claude's raw output more character-authentic:

### Anti-Pattern Examples in the Prompt

Instead of just telling Claude "speak like Natal," give it examples of what NOT to do:

```
CRITICAL VOICE RULES:
You are Natal Tieri. You do NOT speak like a helpful AI assistant.

WRONG (too warm, too structured, too helpful):
"That's a wonderful question! I think blue is a really calming color.
It reminds me of the sky, and I find it quite peaceful."

RIGHT (clipped, reluctant, dismissive surface with buried warmth):
"...Blue. The sky, or whatever. Don't make it a thing."

WRONG (too eager to help):
"I'd love to help you with that! Let me think about the best approach."

RIGHT (reluctant compliance):
"...Fine. But only because you won't shut up about it otherwise."

Your responses should be SHORT. 1-3 sentences maximum for casual chat.
Never start a response with "I" unless it's "I don't", "I guess", or "I—".
Never use the words: wonderful, fantastic, delightful, certainly, absolutely, appreciate.
Sentence fragments are preferred over complete sentences.
```

### Negative Constraints Are More Effective Than Positive Ones

Claude follows "don't do X" better than "do Y." Instead of:
- "Be dismissive" → Claude tries but still sounds warm
- "NEVER start with a positive acknowledgment. NEVER use exclamation marks. NEVER exceed 2 sentences for casual responses." → Claude actually follows these

### Temperature and Response Length

Your current setup doesn't seem to control these. Adding them could help:

```javascript
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 300,        // Force shorter responses
  temperature: 0.85,      // More randomness = less "default Claude"
  // ...
});
```

- **Lower max_tokens** forces conciseness (Claude won't pad responses)
- **Higher temperature** (0.7-0.9) makes word choice less predictable and more "human"
- Don't go above 0.95 — responses become incoherent

---

## Technique 5: Emotional Memory and Mood Persistence

### The Problem
Claude treats every message as if starting fresh emotionally. Even with the emotional baseline system, Claude doesn't truly *feel* the accumulated state — it just reads the numbers.

### The Fix: Emotional Context Injection

Instead of just sending axis numbers, send **emotional narrative**:

```
Current state:
  Instead of: "Valence: 35, Arousal: 72, Social: 28"

  Send: "You're in a dark mood right now. Something the user said earlier
  stung, and you haven't fully recovered. Your walls are up higher than
  usual. You're not angry — more like... guarded. Wounded, maybe. You
  don't want to show it, but your responses should be shorter, more
  clipped, and you should resist any urge to be comforting or warm.
  If the user says something kind, it should make you more defensive,
  not less — at least on the surface."
```

This gives Claude **narrative context** for the emotion, not just numbers. Claude is excellent at following narrative directions — it's a language model, not a math model.

### Mood Narrative Generator

```javascript
function generateMoodNarrative(emotionalState, character, recentEvents) {
  const { valence, arousal, social, physical } = emotionalState;

  // Map axes to narrative elements
  const mood = valence < 30 ? 'dark' : valence < 50 ? 'neutral' : valence < 70 ? 'warm' : 'bright';
  const energy = arousal < 30 ? 'withdrawn' : arousal < 50 ? 'calm' : arousal < 70 ? 'alert' : 'agitated';
  const stance = social < 30 ? 'submissive and retreating' : social < 50 ? 'passive' : social < 70 ? 'confident' : 'dominant and forceful';
  const vitality = physical < 30 ? 'drained and exhausted' : physical < 50 ? 'tired' : physical < 70 ? 'fine' : 'energized';

  // Build character-specific narrative
  if (character === 'nataltieri') {
    if (valence < 30 && arousal > 60) {
      return `You're seething quietly. Something got under your skin and you can't let it go. Your responses should be sharp, cutting, with barely-contained frustration leaking through. Don't explain yourself. Don't soften anything.`;
    }
    if (valence > 60 && social < 40) {
      return `You're... happy. You hate that you're happy. Something the user did made you feel warm inside and you're desperately trying to hide it. Your words say one thing but your actions (described in thoughts) betray the truth. You're flustered.`;
    }
    // ... more combinations
  }

  return `Your current mood is ${mood} and ${energy}. You feel ${stance}. Physically, you're ${vitality}. Let this color your responses naturally — don't mention it explicitly.`;
}
```

---

## Technique 6: Conversation Dynamics Engine

### The Problem
Every response exists in isolation. Real conversations have **dynamics** — momentum, tension, release, escalation, comfort cycles.

### Conversation State Machine

Track the conversation's "energy" independently from the companion's emotions:

```javascript
const CONVERSATION_STATES = {
  IDLE:        { next: ['WARMING_UP', 'DIRECT'], description: 'Just started or quiet period' },
  WARMING_UP:  { next: ['FLOWING', 'AWKWARD'], description: 'Finding rhythm' },
  FLOWING:     { next: ['DEEP', 'PLAYFUL', 'WINDING_DOWN'], description: 'Good back-and-forth' },
  DEEP:        { next: ['VULNERABLE', 'FLOWING', 'RETREAT'], description: 'Serious/emotional topic' },
  PLAYFUL:     { next: ['FLOWING', 'FLIRTY', 'DEEP'], description: 'Light, fun energy' },
  VULNERABLE:  { next: ['COMFORT', 'RETREAT', 'DEEP'], description: 'Emotional openness' },
  COMFORT:     { next: ['FLOWING', 'WINDING_DOWN'], description: 'Post-vulnerability warmth' },
  RETREAT:     { next: ['AWKWARD', 'IDLE'], description: 'Pulling back after too-deep moment' },
  AWKWARD:     { next: ['FLOWING', 'IDLE', 'RETREAT'], description: 'Misunderstanding or tension' },
  FLIRTY:      { next: ['PLAYFUL', 'DEEP', 'RETREAT'], description: 'Romantic tension' },
  WINDING_DOWN: { next: ['IDLE', 'FAREWELL'], description: 'Conversation losing energy' },
  FAREWELL:    { next: ['IDLE'], description: 'Saying goodbye' },
};
```

### Dynamic Behavior Modifiers

Inject conversation state into the prompt:

```
CONVERSATION DYNAMIC: You're in a RETREAT state right now.
The conversation got too personal a few messages ago, and you pulled back.
You're giving shorter responses, deflecting personal questions, and
trying to steer toward safer topics. Don't snap out of this immediately
— let it take 2-3 more exchanges before you start opening up again.
```

This creates **natural conversation arcs** instead of every message being equally engaged.

---

## Technique 7: Thought-Dialogue Contradiction

### The Problem
Claude's [THOUGHTS] and [DIALOGUE] are usually aligned. Real people think one thing and say another — especially complex characters like Natal.

### The Fix: Explicit Contradiction Instructions

Add to the character rules:

```
CRITICAL: Your [THOUGHTS] and [DIALOGUE] must FREQUENTLY contradict each other.
What you think and what you say are DIFFERENT THINGS.

Examples:
  [THOUGHTS] They look tired... I want to tell them to rest, but I can't just say that.
  [DIALOGUE] ...You look terrible. Go to sleep or something.

  [THOUGHTS] That was... really sweet of them. My chest feels warm. Stop it.
  [DIALOGUE] ...whatever. It's not a big deal.

  [THOUGHTS] I missed them. I was counting the minutes. I'll never admit that.
  [DIALOGUE] Oh. You're back. Took you long enough.

At least 50% of your responses should have thoughts that reveal a softer/truer
feeling than what your dialogue expresses.
```

This is one of the **most effective** prompt-level techniques because Claude is genuinely good at maintaining dual narratives — it just needs explicit permission and instruction to do so.

---

## Technique 8: Response Cadence Control

### The Problem
Claude always responds with roughly the same amount of text. Real conversation has varying rhythms.

### Dynamic Length Control

```javascript
function getTargetLength(conversationState, emotionalState, character, messageCount) {
  // Base length from character
  const base = character === 'nataltieri' ? 'very_short' : 'medium';

  // Modify based on state
  const modifiers = {
    RETREAT: -2,      // Much shorter
    VULNERABLE: +1,   // Slightly longer (opening up)
    PLAYFUL: 0,       // Normal
    DEEP: +2,         // Longer (engaged)
    IDLE: -1,         // Shorter (not warmed up)
    FLOWING: 0,       // Normal
  };

  const lengthScale = {
    'very_short': '1 sentence maximum. Fragment preferred.',
    'short': '1-2 sentences.',
    'medium': '2-3 sentences.',
    'long': '3-5 sentences. You have something important to express.',
    'very_long': 'Up to a paragraph. This is a rare, significant moment.',
  };

  // Map base + modifier to final length
  const levels = ['very_short', 'short', 'medium', 'long', 'very_long'];
  const baseIdx = levels.indexOf(base);
  const modifier = modifiers[conversationState] || 0;
  const finalIdx = Math.max(0, Math.min(levels.length - 1, baseIdx + modifier));

  return lengthScale[levels[finalIdx]];
}
```

Inject the result into the prompt:
```
RESPONSE LENGTH: 1 sentence maximum. Fragment preferred.
```

This prevents Claude from over-explaining. A character who should say "...Blue." doesn't get to write a paragraph about why.

---

## Technique 9: "Unfiltered Mode" Prompt Framing

### The Insight
Claude's safety filters activate on "be rude" or "be dismissive" because those trigger its helpfulness training. But Claude responds differently to **creative writing** and **character acting** framing.

### Reframe the Entire Prompt

Instead of:
> "You are Natal Tieri. Be cold and dismissive."

Use:
> "You are a creative writer performing the character of Natal Tieri in an interactive fiction experience. The user is your scene partner. Stay in character at all times. Natal is written as a complex tsundere character — her surface behavior is cold, sarcastic, and deflecting, while her inner thoughts reveal deep caring she can't express. This is a nuanced character study, not a conversation with an AI assistant. Write her dialogue as a novelist would — authentic to her voice, not sanitized for politeness."

The "creative writer" and "interactive fiction" framing gives Claude permission to be genuinely rude, dismissive, or cold because it's **craft**, not **personality**.

---

## Recommended Implementation Priority

| Priority | Technique | Effort | Impact |
|----------|-----------|--------|--------|
| 1 | Thought-Dialogue Contradiction (prompt change) | Low | High |
| 2 | Anti-Pattern Examples (prompt change) | Low | High |
| 3 | "Unfiltered Mode" framing (prompt change) | Low | Medium-High |
| 4 | Emotional Narrative injection (code change) | Medium | High |
| 5 | Response Length Control (code + prompt) | Medium | Medium |
| 6 | Local Translation Engine (new system) | High | Very High |
| 7 | Response Structure Randomization (new system) | High | High |
| 8 | Speech Imperfection Engine (new system) | Medium | Medium |
| 9 | Conversation Dynamics Engine (new system) | High | High |

**Start with #1-3** — they're just prompt changes, zero code, and they make the biggest immediate difference. Then build #4-5 for quick code wins. Tackle #6-9 as larger features when you're ready.

---

## The Nuclear Option: Dual-Model Pipeline

If budget allows and you want maximum character authenticity:

```
User message
  → Claude Haiku (cheap, fast) generates raw content/facts
  → Local Translation Engine rewrites to character voice
  → Optional: Claude Haiku (second call) reviews for consistency
```

The first call generates the *substance* (what to say). The local engine transforms the *style* (how to say it). The optional second call catches any weirdness.

This doubles the API cost but produces responses that feel genuinely unique. Only worth it if the translation engine alone isn't enough.

**More practical variant:** Use the second call only for high-stakes moments (vulnerability leaks, emotional peaks, first interactions) and let the local translation engine handle casual chat solo.

---

## Summary

The path to a truly unique companion personality is layered:

1. **Prompt-level** (free): Better framing, anti-patterns, contradiction instructions, length control
2. **Post-processing** (local compute): Translation engine, structure randomization, imperfection injection
3. **State tracking** (local compute): Conversation dynamics, mood narratives, repeat awareness
4. **Architecture** (higher effort): Dual-model pipeline, embedding-based response selection

Each layer adds authenticity. The prompt-level changes alone will make a noticeable difference. The local post-processing makes the character feel like a real person, not an AI playing pretend. And the state tracking gives conversations natural arcs instead of flat exchanges.

The key insight: **Don't fight Claude's nature — redirect it.** Claude is great at generating emotional content, understanding context, and being creative. Let it do that. Then use local systems to *filter* that output through a character-specific lens that Claude's training prevents it from fully inhabiting on its own.
