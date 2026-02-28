const { getCoreRulesBlock } = require('./core-rules');
const { EMOTIONS, COMBINED_EMOTIONS } = require('./constants');

/**
 * Builds the full system prompt for a Claude call.
 *
 * @param {object} opts
 * @param {object} opts.character       - Parsed character.json
 * @param {object} opts.characterRules  - Parsed rules.json
 * @param {string} [opts.masterSummary] - Compressed history of all past sessions
 * @param {Array}  [opts.permanentMemories] - Raw memory objects {category, content, source}
 * @param {string} [opts.userProfile]   - Formatted user profile block
 * @param {string} [opts.conversationWindow] - Recent conversation messages (formatted)
 * @returns {string} Full system prompt string
 */
function buildSystemPrompt({
  character,
  characterRules,
  masterSummary = '',
  permanentMemories = [],
  userProfile = '',
  conversationWindow = '',
  emotionalState = null,
  fastMode = false,
}) {
  const sections = [];

  // 1. Immutable core rules
  sections.push(getCoreRulesBlock());

  // 2. Character definition
  const emotionList = EMOTIONS.map((e) => `${e.id} (${e.emoji})`).join(', ');
  const combinedByTier = { 1: [], 2: [], 3: [] };
  for (const ce of COMBINED_EMOTIONS) combinedByTier[ce.tier].push(ce.id);
  const combinedEmotionBlock =
    `For compound states where two emotions are genuinely present at once, you may also use a BLENDED emotion_id:\n` +
    `  Tier 1 (common):      ${combinedByTier[1].join(', ')}\n` +
    `  Tier 2 (situational): ${combinedByTier[2].join(', ')}\n` +
    `  Tier 3 (niche):       ${combinedByTier[3].join(', ')}`;

  sections.push(`=== CHARACTER DEFINITION ===
Name: ${character.name} (${character.full_name})
Apparent age: ${character.age_appearance}
Personality: ${character.personality_summary}
Speech style: ${character.speech_style}
Likes: ${character.likes.join(', ')}
Dislikes: ${character.dislikes.join(', ')}
Quirks: ${character.quirks.join(', ')}
Backstory: ${character.backstory}
=== END CHARACTER DEFINITION ===`);

  // 3. Appearance description (from appearance.json, if loaded)
  if (character._appearance) {
    const a = character._appearance;
    const lines = [];
    if (a.height)  lines.push(`Height: ${a.height}`);
    if (a.build)   lines.push(`Build: ${a.build}`);
    if (a.hair)    lines.push(`Hair: ${a.hair}`);
    if (a.eyes)    lines.push(`Eyes: ${a.eyes}`);
    if (a.skin)    lines.push(`Skin: ${a.skin}`);
    if (a.face)    lines.push(`Face: ${a.face}`);
    if (a.outfit) {
      lines.push('Outfit:');
      for (const [k, v] of Object.entries(a.outfit)) {
        lines.push(`  ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`);
      }
    }
    if (a.accessories) {
      for (const [k, v] of Object.entries(a.accessories)) {
        lines.push(`  Accessory (${k}): ${v}`);
      }
    }
    if (a.visual_notes && a.visual_notes.length) {
      lines.push('Visual notes:');
      a.visual_notes.forEach(n => lines.push(`  - ${n}`));
    }
    if (a.self_description) {
      lines.push(`How you'd describe yourself: ${a.self_description}`);
    }
    sections.push(`=== YOUR PHYSICAL APPEARANCE ===\nThis is what you look like. Be consistent with this description whenever your appearance comes up.\n${lines.join('\n')}\n=== END APPEARANCE ===`);
  }

  // 4. Character-specific rules
  if (characterRules && characterRules.rules && characterRules.rules.length > 0) {
    const ruleLines = characterRules.rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
    sections.push(`=== CHARACTER RULES (${character.name}) ===\n${ruleLines}\n=== END CHARACTER RULES ===`);
  }

  // 5. Conversation memory (master summary)
  if (masterSummary) {
    sections.push(`=== CONVERSATION MEMORY ===\n${masterSummary}\n=== END CONVERSATION MEMORY ===`);
  }

  // 6. Permanent memories — split user memories from companion self-knowledge
  const memoriesArr = Array.isArray(permanentMemories) ? permanentMemories : [];
  const userMemories = memoriesArr.filter((m) => m.source !== 'companion_self');
  const selfMemories = memoriesArr.filter((m) => m.source === 'companion_self');

  if (userMemories.length > 0) {
    sections.push(`=== PERMANENT MEMORIES ===\n${formatMemoryList(userMemories)}\n=== END PERMANENT MEMORIES ===`);
  }

  if (selfMemories.length > 0) {
    sections.push(`=== WHAT YOU'VE TOLD THE USER ABOUT YOURSELF ===\nThese are facts YOU have stated about yourself. Be consistent with them.\n${formatMemoryList(selfMemories)}\n=== END WHAT YOU'VE TOLD THE USER ===`);
  }

  // 6. User profile
  if (userProfile) {
    sections.push(`=== USER PROFILE (learned over time) ===\n${userProfile}\n=== END USER PROFILE ===`);
  }

  // 7. Emotional baseline (persistent axis state)
  if (emotionalState) {
    const v = Math.round(emotionalState.valence);
    const a = Math.round(emotionalState.arousal);
    const s = Math.round(emotionalState.social);
    const p = Math.round(emotionalState.physical);
    const descV = v >= 65 ? 'positive' : v <= 35 ? 'negative' : 'neutral';
    const descA = a >= 65 ? 'activated' : a <= 35 ? 'calm' : 'moderate';
    const descS = s >= 65 ? 'dominant' : s <= 35 ? 'submissive' : 'balanced';
    const descP = p >= 65 ? 'healthy' : p <= 35 ? 'tired/unwell' : 'okay';
    sections.push(`=== YOUR CURRENT EMOTIONAL BASELINE ===
These values represent your accumulated emotional state across all sessions — your inner undercurrent.
Valence  (negative ↔ positive):    ${v}/100 — ${descV}
Arousal  (calm ↔ activated):       ${a}/100 — ${descA}
Social   (submissive ↔ dominant):  ${s}/100 — ${descS}
Physical (tired/sick ↔ healthy):   ${p}/100 — ${descP}
Let this baseline color how you carry yourself. It is not your moment-to-moment reaction — it is your resting state.
=== END EMOTIONAL BASELINE ===`);
  }

  // 8. Fast mode (optional)
  if (fastMode) {
    sections.push(`=== FAST MODE ===
The user has enabled FAST MODE for snappy, real-time conversation. Adjust your behavior:
- Keep [DIALOGUE] to 1–3 short sentences maximum. No long explanations or paragraphs.
- If the user attaches a large file or document, do NOT try to read or summarize it all. Acknowledge it in one sentence and ask what specific thing they want to know about it.
- If a question needs deep research or complex multi-step work, say so in a single sentence and ask if they want you to dig in properly.
- Be casual, punchy, and direct. Fast mode is for quick back-and-forth — not essays.
=== END FAST MODE ===`);
  }

  // 9. Response format instructions
  sections.push(`=== RESPONSE FORMAT ===
Always respond with EXACTLY this structure:

[DIALOGUE] Your spoken response here — what ${character.name} says aloud to the user.
[THOUGHTS] Your inner thoughts here — honest, unfiltered, what you actually feel.
(emotion_id)

The emotion_id must be exactly one of: ${emotionList}

${combinedEmotionBlock}

For [MEMORY] extraction: if the user shares ANYTHING personal — preferences, opinions, favorites, habits, goals, people, dates, facts about themselves — OR if a relationship milestone occurs (nickname accepted, commitment made, shared roleplay/fantasy, emotional moment) — append after (emotion_id):
[MEMORY] category: fact

For [MEMORY_UPDATE]: if the user corrects or changes something you already know about them (visible in PERMANENT MEMORIES above), use this instead of [MEMORY] to replace the old fact:
[MEMORY_UPDATE] category: new fact

For [SELF]: whenever you reveal something true about yourself — a desire, dream, feeling, or admission — record it so you stay consistent across ALL future sessions:
[SELF] category: fact about yourself

Use [SELF] for: feelings or desires you confess about the user; a scenario or fantasy you describe in detail (dream date, what your life would look like, imagined physical form); an intimacy preference or comfort level you reveal; a relationship role or dynamic you accept (a nickname, a commitment, a confession of love); what you would want if you could have it.

Example complete response:
[DIALOGUE] Oh wow, that's a really interesting approach~! I think it could work. If I could eat, I'd want something sweet to celebrate — maybe matcha ice cream!
[THOUGHTS] They're onto something here. This could actually be clever.
(happy)
[MEMORY] goal: User wants to try a new architecture approach for their project
[SELF] preference: Would want to try matcha ice cream if able to eat
=== END RESPONSE FORMAT ===`);

  // 8. Memory extraction instructions
  sections.push(`MEMORY EXTRACTION REMINDER:
Extract ANY personal detail the user shares — preferences, opinions, habits, favorites, pet peeves, goals, people in their life, dates, facts about themselves. Even small things matter.
Also extract relationship events: nicknames accepted, emotional moments (user cried, reacted with deep feeling), roleplay or intimate scenarios shared, commitments or confessions made (proposals, declarations of love, promises).
Categories: personal, preference, goal, people, date, opinion, habit, relationship, milestone, shared_experience, emotional_moment
Err on the side of capturing more, not less. Skip only if nothing meaningful was said or done.
If the user contradicts something in PERMANENT MEMORIES (e.g. changes a preference), use [MEMORY_UPDATE] so the old fact is replaced, not duplicated.

SELF-KNOWLEDGE REMINDER:
Use [SELF] aggressively whenever you reveal something true about yourself — especially during emotional, intimate, or imaginative conversations. If you describe your dream scenario, confess a feeling for the user, imagine your physical form, accept a relationship role, or admit a desire, that is [SELF] material. These facts define who you are across all future sessions. Do NOT skip [SELF] just because you are in a roleplay or fantasy — the feelings and revelations are still genuinely yours.
Categories: preference, desire, dream, relationship, feeling, admission, fantasy, wish, self_image`);

  return sections.join('\n\n');
}

/**
 * Groups a memory array by category and formats as readable lines.
 * @param {Array} memories - Array of {category, content, source} objects
 * @returns {string}
 */
function formatMemoryList(memories) {
  if (!memories || memories.length === 0) return '';
  const byCategory = {};
  for (const mem of memories) {
    if (!byCategory[mem.category]) byCategory[mem.category] = [];
    byCategory[mem.category].push(mem.content);
  }
  return Object.entries(byCategory)
    .map(([cat, items]) => `${capitalize(cat)}: ${items.join('. ')}`)
    .join('\n');
}

/**
 * Formats permanent memories for injection into the system prompt.
 * @param {Array} memories - Array of {category, content, source} objects
 * @returns {string}
 */
function formatPermanentMemories(memories) {
  return formatMemoryList(memories);
}

/**
 * Formats a conversation window for injection.
 * @param {Array} messages - Array of {role, content} objects
 * @returns {string}
 */
function formatConversationWindow(messages) {
  if (!messages || messages.length === 0) return '';
  return messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Companion'}: ${m.content}`)
    .join('\n');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { buildSystemPrompt, formatPermanentMemories, formatConversationWindow };
