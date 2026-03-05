# Smarter Logic & Behavior — Implementation Checklist

Based on `03-Smarter-Logic-And-Behavior.md`. Items ordered by priority (highest ROI first).

---

## Phase 1 — Prompt-Level Changes (Zero Code, High Impact)

- [ ] **Step 1** — Add Thought-Dialogue Contradiction rules to `characters/nataltieri/rules.json`
  - Explicit instruction that THOUGHTS and DIALOGUE must frequently contradict
  - At least 50% of responses should have thoughts that reveal softer/truer feelings
  - Include concrete WRONG/RIGHT example pairs in the rules text

- [ ] **Step 2** — Add Anti-Pattern voice examples to `characters/nataltieri/rules.json`
  - Add banned words list (wonderful, fantastic, delightful, certainly, absolutely, appreciate)
  - Add WRONG/RIGHT example pairs showing Claude's default voice vs. Natal's actual voice
  - Add constraint: never start response with "I" unless it's "I don't", "I guess", or "I—"
  - Add constraint: sentence fragments preferred over complete sentences

- [ ] **Step 3** — Add "creative writer / interactive fiction" framing to `system-prompt.js`
  - Add `character_framing` field support to character.json
  - Inject framing text before CHARACTER DEFINITION when present
  - Write framing text for Natal in `characters/nataltieri/character.json`
  - Write framing text for Aria in `characters/default/character.json`

- [ ] **Step 4** — Add per-character Response Length Control to `system-prompt.js`
  - Add `default_response_length` field to character.json (e.g. `"very_short"`, `"medium"`)
  - Inject a `RESPONSE LENGTH:` block into the system prompt based on character setting
  - Natal default: `"very_short"` → "1 sentence maximum. Fragment preferred."
  - Aria default: `"medium"` → "2–3 sentences."

---

## Phase 2 — Code Changes: Emotional Narrative (Medium Effort, High Impact)

- [ ] **Step 5** — Replace raw axis numbers with mood narrative in `system-prompt.js`
  - Write `generateMoodNarrative(emotionalState, characterName)` function
  - Map axis value combinations to descriptive narrative paragraphs (per character)
  - Natal: cover key combinations (seething, flustered/happy, wounded/guarded, etc.)
  - Aria: cover key combinations (bright/energized, withdrawn, anxious, etc.)
  - Replace the raw `Valence: X/100 — Y` block with the generated narrative text
  - Keep the raw numbers as a secondary line for reference

---

## Phase 3 — Local Post-Processing Pipeline (Higher Effort, Very High Impact)

- [ ] **Step 6** — Create `characters/nataltieri/voice-rules.json`
  - Vocabulary replacements (warmth → deflection mappings)
  - Banned words list
  - Injection words (sentence-start / sentence-end quirks)
  - Sentence structure settings (max length, fragment frequency, trailing-off frequency)
  - Emotional dampening settings (positive scale, negative scale, vulnerability leak chance)
  - Quirks (ellipsis prefix chance, avoid exclamation marks, lowercase tendency)

- [ ] **Step 7** — Create `characters/default/voice-rules.json` (Aria)
  - Tilde injection settings
  - Enthusiasm amplification settings
  - Interjection words ("Oh~!", "Hmm~", etc.)
  - Sentence structure settings (slightly longer, run-on friendly)

- [ ] **Step 8** — Create `src/main/voice-translator.js`
  - `loadVoiceRules(characterDir)` — reads voice-rules.json if present
  - `translateDialogue(rawDialogue, voiceRules, emotionalState)` — main pipeline:
    - Step A: Split into sentences
    - Step B: Vocabulary replacement
    - Step C: Remove/replace banned words
    - Step D: Apply sentence structure rules (truncate, fragment)
    - Step E: Add character quirks (ellipsis prefix, tilde, etc.)
    - Step F: Emotional dampening/amplification
    - Step G: Vulnerability leak (random chance to let warmth through)
  - `addImperfections(text, voiceRules, emotionalState)` — speech imperfection engine:
    - Self-corrections ("I mean—", "no wait—")
    - Trailing thoughts for Natal ("It reminds me of... never mind.")
    - Stuttering on embarrassment/nervousness ("I-it's...")
    - Mumbled parentheticals for Natal ("(...idiot.)")
  - Export: `processResponse(parsedResponse, voiceRules, emotionalState)`

- [ ] **Step 9** — Wire voice-translator into the response pipeline
  - In `src/shared/response-parser.js` or `src/main/claude-bridge.js`:
    - After parsing DIALOGUE from Claude's raw output
    - Load voice rules for the active character
    - Run `processResponse()` on the parsed dialogue
    - Return translated dialogue (THOUGHTS and emotion unchanged)

---

## Phase 4 — Conversation Dynamics Engine (High Effort, High Impact)

- [ ] **Step 10** — Create conversation state machine in `src/main/conversation-dynamics.js`
  - Define CONVERSATION_STATES (IDLE, WARMING_UP, FLOWING, DEEP, PLAYFUL, etc.)
  - `updateConversationState(currentState, message, emotionalState)` — transitions
  - `getConversationDirective(state, character)` — returns prompt injection string
  - Persist conversation state in session (resets on new session)

- [ ] **Step 11** — Wire conversation dynamics into `system-prompt.js`
  - Accept `conversationState` param in `buildSystemPrompt()`
  - Inject `CONVERSATION DYNAMIC:` block when state is not IDLE/FLOWING
  - Include state description and behavioral guidance

---

## Notes

- All Phase 1 changes are safe to ship immediately — they're prompt text only
- Phase 2 is a single function addition to system-prompt.js
- Phase 3 is self-contained — voice-translator.js doesn't touch existing logic until Step 9
- Phase 4 is the most complex; skip if Phases 1–3 already give satisfactory results
- Test with Natal after each phase — she's the harder character to get right
