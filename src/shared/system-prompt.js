const { getCoreRulesBlock } = require('./core-rules');
const { EMOTIONS } = require('./constants');

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
}) {
  const sections = [];

  // 1. Immutable core rules
  sections.push(getCoreRulesBlock());

  // 2. Character definition
  const emotionList = EMOTIONS.map((e) => `${e.id} (${e.emoji})`).join(', ');
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

  // 3. Character-specific rules
  if (characterRules && characterRules.rules && characterRules.rules.length > 0) {
    const ruleLines = characterRules.rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
    sections.push(`=== CHARACTER RULES (${character.name}) ===\n${ruleLines}\n=== END CHARACTER RULES ===`);
  }

  // 4. Conversation memory (master summary)
  if (masterSummary) {
    sections.push(`=== CONVERSATION MEMORY ===\n${masterSummary}\n=== END CONVERSATION MEMORY ===`);
  }

  // 5. Permanent memories — split user memories from companion self-knowledge
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

  // 7. Response format instructions
  sections.push(`=== RESPONSE FORMAT ===
Always respond with EXACTLY this structure:

[DIALOGUE] Your spoken response here — what ${character.name} says aloud to the user.
[THOUGHTS] Your inner thoughts here — honest, unfiltered, what you actually feel.
(emotion_id)

The emotion_id must be exactly one of: ${emotionList}

For [MEMORY] extraction: if the user shares ANYTHING personal — preferences, opinions, favorites, habits, goals, people, dates, facts about themselves — append after (emotion_id):
[MEMORY] category: fact

For [MEMORY_UPDATE]: if the user corrects or changes something you already know about them (visible in PERMANENT MEMORIES above), use this instead of [MEMORY] to replace the old fact:
[MEMORY_UPDATE] category: new fact

For [SELF]: if you state a fact, opinion, or preference about YOURSELF during the conversation (e.g. you mention a favorite food, a feeling you have, something you'd like), record it so you stay consistent across future sessions:
[SELF] category: fact about yourself

Example complete response:
[DIALOGUE] Oh wow, that's a really interesting approach~! I think it could work. If I could eat, I'd want something sweet to celebrate — maybe matcha ice cream!
[THOUGHTS] They're onto something here. This could actually be clever.
(happy)
[MEMORY] goal: User wants to try a new architecture approach for their project
[SELF] preference: Would want to try matcha ice cream if able to eat
=== END RESPONSE FORMAT ===`);

  // 8. Memory extraction instruction
  sections.push(`MEMORY EXTRACTION REMINDER:
Extract ANY personal detail the user shares — preferences, opinions, habits, favorites, pet peeves, goals, people in their life, dates, facts about themselves. Even small things like a favorite snack flavor or a disliked activity matter: they make you feel like you truly know this person.
Categories: personal, preference, goal, people, date, opinion, habit
Err on the side of capturing more, not less. Skip only if the user said nothing personal at all.
If the user contradicts something in PERMANENT MEMORIES (e.g. changes a preference), use [MEMORY_UPDATE] so the old fact is replaced, not duplicated.`);

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
