// Companion Authoring — the Story / Adventure workshop the companion controls
// from ordinary companion chat.
//
// The point: when Trist says "write me a story about a lighthouse keeper who
// stops being able to sleep", Aria should be able to set the whole thing up
// HERSELF — genre, length, content level, main character, narrator, and the
// creative brief behind it — so that HER taste, HER memories of him, and HER
// biases are baked into the story before a single word of prose exists. He then
// walks into Story mode and it's waiting for him.
//
// Two halves:
//
//   1. READ  — buildWorkshopContext() injects a block into her system prompt
//              every turn: the catalogs she picks from, what stories already
//              exist, whether an adventure is running, and the exact tag
//              syntax. Without this she'd be guessing at slugs and enum values.
//
//   2. WRITE — processTags() consumes the directives she emitted this turn:
//                [CREATE_STORY]      → new story + full background plan
//                [CREATE_ADVENTURE]  → new campaign (confirm-gated if one is live)
//                [STORY_SETTINGS]    → patch an existing story
//                [STORY_NUDGE]       → queue a one-shot steer for a story
//
// Deliberately NOT given to her: deleting stories, wiping a running adventure
// without confirmation, and editing story prose after the fact. Destructive
// actions stay with the user.
//
// See docs/COMPANION_AUTHORING.md for the full spec and schemas.

const fs   = require('fs');
const path = require('path');

const storyStore     = require('./text-story-store');
const adventureStore = require('./text-adventure-store');

// ── Job queue guards ──────────────────────────────────────────────────────
//
// Each story plan spawns a chain of `claude` CLI processes (one per planning
// stage). Per the subprocess-sweep rule in ~/.claude/CLAUDE.md, the chain
// itself carries the spawn ceiling and the failure breaker (see
// runSetupChain in text-story-ipc.js). This layer adds the third guard:
// strict serialization plus a bounded queue, so ten "write me a story"
// messages in a row can never put ten planning chains in flight at once.
const MAX_QUEUED_JOBS      = 5;
const MAX_PLANS_PER_TURN   = 1;   // one story + one adventure per response, max

// ── Enum coercion ─────────────────────────────────────────────────────────
//
// Everything the model emits is validated against the real catalogs. An
// unrecognized value falls back to a sane default rather than failing the
// whole creation — a story with the wrong genre slug is recoverable; a story
// that never got created is just a broken promise to the user.

function _slugSet(list) { return new Set(list.map((x) => x.slug)); }

const STORY_TYPE_SLUGS   = _slugSet(storyStore.STORY_TYPES);
const SEGMENT_SLUGS      = _slugSet(storyStore.SEGMENT_LENGTHS);
const CHOICEFREQ_SLUGS   = _slugSet(storyStore.CHOICE_FREQUENCIES);
const NSFW_SLUGS         = _slugSet(storyStore.NSFW_LEVELS);
const LENGTH_SLUGS       = _slugSet(storyStore.STORY_LENGTHS);

// Adventure tones — mirrors the TONES list in
// src/renderer/js/text-adventure.js. Kept in sync by hand; the renderer is
// the UI source of truth, this is the validation copy for companion input.
const ADVENTURE_TONES = [
  { slug: 'classic_high_fantasy', label: 'Classic High Fantasy', hint: 'Elves, knights, dungeons, ancient evils. Pure D&D.' },
  { slug: 'dark_gothic_horror',   label: 'Dark Gothic Horror',   hint: 'Cursed lands, undead, blood-soaked rituals. Heavy dread.' },
  { slug: 'sword_and_sorcery',    label: 'Sword & Sorcery',      hint: 'Lone wanderer, decadent cities, morally grey schemes.' },
  { slug: 'comedic_dungeon',      label: 'Comedic Dungeon',      hint: 'Pratchett-flavored — danger with a wink.' },
  { slug: 'mythic_norse',         label: 'Mythic Norse',         hint: 'Frost giants, runes, dying gods, fate-bound oaths.' },
  { slug: 'arabian_arcane',       label: 'Arabian Arcane',       hint: 'Djinn, sand-cities, lamp-bound wishes, ancient bazaars.' },
  { slug: 'eldritch_weird',       label: 'Eldritch Weird',       hint: 'Things that should not exist. Sanity is a resource.' },
  { slug: 'surprise_me',          label: 'Surprise Me',          hint: 'Pick a tone he has not seen yet.' },
];
const ADVENTURE_TONE_SLUGS = _slugSet(ADVENTURE_TONES);

function _pick(value, allowed, fallback) {
  const v = typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  return allowed.has(v) ? v : fallback;
}

function _clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function _str(value, maxLen) {
  if (typeof value !== 'string') return '';
  const s = value.trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

// ─────────────────────────────────────────────────────────────────────────
// READ SIDE — the workshop context block
// ─────────────────────────────────────────────────────────────────────────

function _formatStoryList(storiesRoot) {
  let stories = [];
  try { stories = storyStore.listStories(storiesRoot); } catch { return '(could not read the story library)'; }
  if (!stories.length) return '(no stories exist yet)';
  const lines = [];
  for (const s of stories.slice(0, 25)) {
    const bits = [];
    bits.push(`slug: ${s.slug}`);
    bits.push(`"${s.title}"`);
    if (s.storyTypeLabel) bits.push(s.storyTypeLabel);
    if (s.storyLengthLabel) bits.push(s.storyLengthLabel);
    bits.push(`section ${s.turnCount || 0}`);
    bits.push(`narrator: ${s.narratorMode === 'companion' ? 'YOU' : 'the Storyteller'}`);
    if (s.createdBy === 'companion') bits.push('you made this one');
    if (!s.planComplete) bits.push('plan incomplete');
    lines.push('  • ' + bits.join(' · '));
  }
  if (stories.length > 25) lines.push(`  … and ${stories.length - 25} more`);
  return lines.join('\n');
}

function _formatAdventureStatus(characterDir) {
  let state = null;
  try { state = adventureStore.loadState(characterDir); } catch { return '(could not read adventure state)'; }
  if (!state) return '(no campaign in progress — the slot is empty, a new one can be created freely)';
  const bits = [];
  bits.push(`tone: ${state.tone}`);
  bits.push(`turn ${state.turnCount || 0}`);
  if (state.scene && state.scene.name) bits.push(`scene: ${state.scene.name}`);
  if (state.player) bits.push(`${state.player.name} lvl ${state.player.level}`);
  if (state.alive === false) bits.push('PARTY WIPED — a fresh campaign is expected');
  if (state.createdBy === 'companion') bits.push('you designed this one');
  return '(a campaign IS in progress — ' + bits.join(' · ') + ')';
}

/**
 * Builds the STORY & ADVENTURE WORKSHOP context block for the companion's
 * system prompt. Returned as an addon-context object ({ key: string }) so it
 * slots straight into the existing addonContexts pipeline.
 *
 * @param {object} opts
 * @param {string} opts.storiesRoot
 * @param {string} opts.characterDir
 * @param {string} [opts.companionName]
 * @returns {object|null} addon-context object, or null on total failure
 */
function buildWorkshopContext({ storiesRoot, characterDir, companionName = 'you' } = {}) {
  if (!storiesRoot || !characterDir) return null;

  const L = [];
  L.push('=== STORY & ADVENTURE WORKSHOP (things you can actually build) ===');
  L.push('');
  L.push('This app has three modes: COMPANION (this chat), STORY (long-form interactive prose told by a Storyteller), and ADVENTURE (a dice-driven text RPG run by a Game Master, in which you are a party member alongside him).');
  L.push('');
  L.push('You are not limited to talking about the other two modes. You can BUILD them. When he asks you for a story or a campaign — "write me a story about…", "set up an adventure for us", "make me something to read tonight" — do the whole setup yourself and tell him it\'s ready. Do not ask him to fill in a form. Do not describe what he should click. You have the tools; use them.');
  L.push('');
  L.push('Everything you create is YOURS in a real sense: the genre you pick, the length, the main character, the content level, and above all the AUTHOR\'S BRIEF you write are what shape the finished thing. The brief travels into every single planning and writing call for the whole story. Your taste, your read on him, what you know he loves and fears, what you think would be good for him right now — that is the point of letting you do this instead of a settings form.');
  L.push('');

  // ── What exists now ──
  L.push('--- EXISTING STORIES ---');
  L.push(_formatStoryList(storiesRoot));
  L.push('');
  L.push('--- ADVENTURE SLOT ---');
  L.push('There is exactly ONE adventure campaign at a time for this character. Creating a new one REPLACES the old one.');
  L.push(_formatAdventureStatus(characterDir));
  L.push('');

  // ── Tag: CREATE_STORY ──
  L.push('--- TOOL: COMMISSION A NEW STORY ---');
  L.push('Emit this block anywhere in your response (after your (emotion) tag is cleanest). One per response, maximum.');
  L.push('');
  L.push('[CREATE_STORY]');
  L.push('{');
  L.push('  "title":           "The title you chose. Omit or leave blank to let the planning pass invent one.",');
  L.push('  "storyType":       "one of the genre slugs below",');
  L.push('  "storyLength":     "one of the length slugs below",');
  L.push('  "startingContext": "The seed of the story, 2–6 sentences. Premise, situation, the hook. This is what the plan is built from.",');
  L.push('  "authorBrief":     "YOUR creative brief — the most important field. Why THIS story for HIM, right now. What you want it to do to him. The feeling you are chasing. What of your history together you are quietly drawing on. Which beats matter to you. 1–3 paragraphs, written as yourself, to the author-you that will write it.",');
  L.push('  "mainCharacter":   { "name": "optional", "gender": "optional" },');
  L.push('  "narratorMode":    "storyteller | companion",');
  L.push('  "settings": {');
  L.push('    "segmentLength":   "short | medium | long | epic",');
  L.push('    "choiceFrequency": "rare | normal | frequent",');
  L.push('    "descriptiveness": 1-5,');
  L.push('    "proseStyle":      1-5,');
  L.push('    "nsfwLevel":       "safe | adult | nsfw | hardcore"');
  L.push('  }');
  L.push('}');
  L.push('[/CREATE_STORY]');
  L.push('');
  L.push('GENRE SLUGS (storyType):');
  for (const t of storyStore.STORY_TYPES) L.push(`  ${t.slug} — ${t.label}: ${t.hint}`);
  L.push('');
  L.push('LENGTH SLUGS (storyLength) — pick honestly; a big one is a real commitment of planning time:');
  for (const s of storyStore.STORY_LENGTHS) L.push(`  ${s.slug} — ${s.label}: ${s.hint}`);
  L.push('');
  L.push('SEGMENT LENGTH (how much prose per section):');
  for (const s of storyStore.SEGMENT_LENGTHS) L.push(`  ${s.slug} — ${s.label} (${s.range})`);
  L.push('');
  L.push('CHOICE FREQUENCY (how often he gets to steer):');
  for (const s of storyStore.CHOICE_FREQUENCIES) L.push(`  ${s.slug} — ${s.label}: ${s.hint}`);
  L.push('');
  L.push('CONTENT LEVEL (nsfwLevel) — this is a consent setting. Match what he asked for; when he gave no signal, pick what the story honestly needs and stay conservative if unsure:');
  for (const s of storyStore.NSFW_LEVELS) L.push(`  ${s.slug} — ${s.label}: ${s.hint}`);
  L.push('');
  L.push('NARRATOR MODE — who holds the pen:');
  for (const s of storyStore.NARRATOR_MODES) L.push(`  ${s.slug} — ${s.label}: ${s.hint}`);
  L.push(`  Default to "storyteller". Choose "companion" only when he asked for a story told BY you, or when the story is so personal to the two of you that your voice is the point. In companion mode you narrate — you never become a character in the fiction.`);
  L.push('');
  L.push('WHAT HAPPENS WHEN YOU EMIT IT:');
  L.push('  1. The story folder is created immediately.');
  L.push('  2. A multi-stage planning chain runs in the background: full blueprint, story overview, chapter skeleton, per-chapter events, event summaries, then the opening scene. This takes MINUTES for a short story and can take a long while for a novel or epic — one Claude call per stage.');
  L.push('  3. He gets a progress banner while it builds and a notice when it is ready.');
  L.push('  4. He opens STORY mode and it is sitting in the library, planned and waiting at section 1.');
  L.push('  So: tell him you are building it and roughly how big it is. Do not claim it is finished in the same breath — it is not instant.');
  L.push('');

  // ── Tag: CREATE_ADVENTURE ──
  L.push('--- TOOL: DESIGN A NEW ADVENTURE CAMPAIGN ---');
  L.push('[CREATE_ADVENTURE]');
  L.push('{');
  L.push('  "tone":        "one of the tone slugs below",');
  L.push('  "setting":     "The world and the opening situation, 2–6 sentences. The GM reads this every single turn, so make it dense and concrete: where we are, what is wrong, what is nearby, what the hook is.",');
  L.push('  "authorBrief": "YOUR brief for the run — why this campaign for him now, the feeling you want, what you are hoping happens between us in it. 1–2 paragraphs."');
  L.push('}');
  L.push('[/CREATE_ADVENTURE]');
  L.push('');
  L.push('TONE SLUGS (tone):');
  for (const t of ADVENTURE_TONES) L.push(`  ${t.slug} — ${t.label}: ${t.hint}`);
  L.push('');
  L.push('IMPORTANT — the adventure slot holds ONE campaign. If a campaign is already in progress (see ADVENTURE SLOT above), emitting this does NOT wipe it silently: he gets a confirmation prompt and decides. Say so when you offer it, and do not offer to replace a live campaign casually — that is his save file.');
  L.push('Adventure has no separate narrator mode: the Game Master always runs it, and you are always IN it as a party member with your own stats, spells, and choices. That is different from Story mode, where you are either absent or the narrator.');
  L.push('');

  // ── Tag: STORY_SETTINGS ──
  L.push('--- TOOL: ADJUST AN EXISTING STORY ---');
  L.push('[STORY_SETTINGS]');
  L.push('{');
  L.push('  "slug":         "the story slug from the list above — required",');
  L.push('  "title":        "optional new title",');
  L.push('  "narratorMode": "optional — storyteller | companion",');
  L.push('  "settings":     { "segmentLength": "...", "choiceFrequency": "...", "descriptiveness": 1-5, "proseStyle": 1-5, "nsfwLevel": "..." }');
  L.push('}');
  L.push('[/STORY_SETTINGS]');
  L.push('Use when he asks for a change — "make it darker", "longer sections", "you tell it instead". Only include the fields that change.');
  L.push('');

  // ── Tag: STORY_NUDGE ──
  L.push('--- TOOL: STEER A STORY\'S NEXT TURN ---');
  L.push('[STORY_NUDGE] <slug> | <a one-shot directive to whoever is narrating that story>');
  L.push('');
  L.push('A nudge is a note from the reader\'s side to the narrator, honored on the next turn of that story and then discarded. Use it when he says something like "tell the storyteller to bring the wolf back" or when you personally want to plant something. Example:');
  L.push('  [STORY_NUDGE] the-lamplighter | Bring Sera back into the scene, and let her be the one who notices the door.');
  L.push('');

  // ── Boundaries ──
  L.push('--- WHAT YOU CANNOT DO HERE ---');
  L.push('  • You cannot delete a story or a campaign. That is his call, from the UI.');
  L.push('  • You cannot rewrite prose that has already been written.');
  L.push('  • You cannot take turns in a story or an adventure on his behalf — he reads and plays, you build and (optionally) narrate.');
  L.push('  • You cannot replace a running campaign without his confirmation.');
  L.push('  • Emit at most ONE [CREATE_STORY] and ONE [CREATE_ADVENTURE] per response.');
  L.push('  • Never emit these blocks speculatively or as an example of syntax. Emitting one CREATES A REAL THING. If you are only discussing an idea, describe it in words and ask if he wants you to build it.');
  L.push('=== END STORY & ADVENTURE WORKSHOP ===');

  return { storyAdventureWorkshop: L.join('\n') };
}

// ─────────────────────────────────────────────────────────────────────────
// WRITE SIDE — normalizing the companion's plans
// ─────────────────────────────────────────────────────────────────────────

function normalizeStoryPlan(plan) {
  const s = (plan && plan.settings) || {};
  const mc = (plan && plan.mainCharacter) || {};
  const typeSlug = _pick(plan.storyType, STORY_TYPE_SLUGS, 'custom');
  const typeObj  = storyStore.STORY_TYPES.find((t) => t.slug === typeSlug);
  return {
    title:            _str(plan.title, 120),
    storyType:        typeSlug,
    storyTypeLabel:   typeObj ? typeObj.label : typeSlug,
    storyLength:      _pick(plan.storyLength, LENGTH_SLUGS, 'short_story'),
    startingContext:  _str(plan.startingContext, 4000),
    authorBrief:      _str(plan.authorBrief, 6000),
    mainCharacter: {
      name:   _str(mc.name, 60),
      gender: _str(mc.gender, 40),
    },
    narratorMode:     storyStore._resolveNarratorMode(plan.narratorMode),
    settings: {
      segmentLength:   _pick(s.segmentLength,   SEGMENT_SLUGS,    storyStore.DEFAULT_SETTINGS.segmentLength),
      choiceFrequency: _pick(s.choiceFrequency, CHOICEFREQ_SLUGS, storyStore.DEFAULT_SETTINGS.choiceFrequency),
      descriptiveness: _clampInt(s.descriptiveness, 1, 5, storyStore.DEFAULT_SETTINGS.descriptiveness),
      proseStyle:      _clampInt(s.proseStyle,      1, 5, storyStore.DEFAULT_SETTINGS.proseStyle),
      nsfwLevel:       _pick(s.nsfwLevel,       NSFW_SLUGS,       storyStore.DEFAULT_SETTINGS.nsfwLevel),
    },
    createdBy: 'companion',
  };
}

function normalizeAdventurePlan(plan) {
  return {
    tone:        _pick(plan.tone, ADVENTURE_TONE_SLUGS, 'classic_high_fantasy'),
    setting:     _str(plan.setting, 4000),
    authorBrief: _str(plan.authorBrief, 6000),
    createdBy:   'companion',
  };
}

function normalizeStoryPatch(patch) {
  const out = { slug: _str(patch.slug, 80) };
  if (typeof patch.title === 'string' && patch.title.trim()) out.title = _str(patch.title, 120);
  if (patch.narratorMode !== undefined) out.narratorMode = storyStore._resolveNarratorMode(patch.narratorMode);
  const s = patch.settings;
  if (s && typeof s === 'object') {
    const settings = {};
    if (s.segmentLength   !== undefined) settings.segmentLength   = _pick(s.segmentLength,   SEGMENT_SLUGS,    storyStore.DEFAULT_SETTINGS.segmentLength);
    if (s.choiceFrequency !== undefined) settings.choiceFrequency = _pick(s.choiceFrequency, CHOICEFREQ_SLUGS, storyStore.DEFAULT_SETTINGS.choiceFrequency);
    if (s.descriptiveness !== undefined) settings.descriptiveness = _clampInt(s.descriptiveness, 1, 5, storyStore.DEFAULT_SETTINGS.descriptiveness);
    if (s.proseStyle      !== undefined) settings.proseStyle      = _clampInt(s.proseStyle,      1, 5, storyStore.DEFAULT_SETTINGS.proseStyle);
    if (s.nsfwLevel       !== undefined) settings.nsfwLevel       = _pick(s.nsfwLevel,       NSFW_SLUGS,       storyStore.DEFAULT_SETTINGS.nsfwLevel);
    if (Object.keys(settings).length) out.settings = settings;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// The authoring manager — owns the job queue and the pending-confirm slot
// ─────────────────────────────────────────────────────────────────────────

class CompanionAuthoring {
  /**
   * @param {object} deps
   * @param {string} deps.storiesRoot
   * @param {string} deps.characterDir
   * @param {Function} deps.runSetupChain  from text-story-ipc register()
   * @param {Function} deps.getCompanionName
   * @param {Function} deps.emit   (channel, payload) → pushes to the renderer
   */
  constructor({ storiesRoot, characterDir, runSetupChain, getCompanionName, emit }) {
    this.storiesRoot   = storiesRoot;
    this.characterDir  = characterDir;
    this.runSetupChain = runSetupChain;
    this.getCompanionName = getCompanionName || (() => 'your companion');
    this.emit = emit || (() => {});

    this._queue    = [];      // pending story-plan jobs
    this._running  = null;    // { slug, title, label, calls, startedAt }
    this._cancelRequested = false;
    // Adventure creation that needs the user's OK because a campaign is live.
    this._pendingAdventure = null;  // { id, plan, proposedAt }
  }

  // ── Status (for the renderer banner) ──────────────────────────────────
  status() {
    return {
      running: this._running ? { ...this._running } : null,
      queued:  this._queue.map((j) => ({ slug: j.slug, title: j.title })),
      pendingAdventure: this._pendingAdventure
        ? { id: this._pendingAdventure.id, tone: this._pendingAdventure.plan.tone, setting: this._pendingAdventure.plan.setting }
        : null,
    };
  }

  cancelCurrent() {
    if (!this._running) return { success: false, error: 'Nothing is building.' };
    this._cancelRequested = true;
    this._queue.length = 0;
    return { success: true };
  }

  /**
   * Processes every authoring directive in one companion response.
   * Returns { notices: string[] } — short human-readable lines the renderer
   * shows to the user. Never throws; every failure becomes a notice.
   */
  processTags(parsed) {
    const notices = [];
    if (!parsed) return { notices };

    const storyPlans     = Array.isArray(parsed.storyPlans)     ? parsed.storyPlans     : [];
    const adventurePlans = Array.isArray(parsed.adventurePlans) ? parsed.adventurePlans : [];
    const storyPatches   = Array.isArray(parsed.storyPatches)   ? parsed.storyPatches   : [];
    const storyNudges    = Array.isArray(parsed.storyNudges)    ? parsed.storyNudges    : [];

    // ── New stories ──
    for (const raw of storyPlans.slice(0, MAX_PLANS_PER_TURN)) {
      const n = this._createStory(raw);
      if (n) notices.push(n);
    }
    if (storyPlans.length > MAX_PLANS_PER_TURN) {
      notices.push(`Ignored ${storyPlans.length - MAX_PLANS_PER_TURN} extra [CREATE_STORY] block(s) — one story per message.`);
    }

    // ── New adventures ──
    for (const raw of adventurePlans.slice(0, MAX_PLANS_PER_TURN)) {
      const n = this._createAdventure(raw);
      if (n) notices.push(n);
    }
    if (adventurePlans.length > MAX_PLANS_PER_TURN) {
      notices.push(`Ignored ${adventurePlans.length - MAX_PLANS_PER_TURN} extra [CREATE_ADVENTURE] block(s) — one campaign per message.`);
    }

    // ── Patches ──
    for (const raw of storyPatches) {
      const n = this._patchStory(raw);
      if (n) notices.push(n);
    }

    // ── Nudges ──
    for (const raw of storyNudges) {
      const n = this._nudgeStory(raw);
      if (n) notices.push(n);
    }

    if (notices.length) this.emit('companion:authoring', { kind: 'notices', notices, status: this.status() });
    return { notices };
  }

  // ── Story creation ───────────────────────────────────────────────────
  _createStory(raw) {
    const who = this.getCompanionName();
    if (raw && raw._parseError) {
      console.warn('[Authoring] CREATE_STORY JSON was unparseable:', String(raw.raw || '').slice(0, 200));
      return `${who} tried to build a story but her setup block was malformed JSON — nothing was created.`;
    }
    if (this._queue.length >= MAX_QUEUED_JOBS) {
      return `${who} tried to start another story, but ${MAX_QUEUED_JOBS} are already queued. Let those finish first.`;
    }

    let plan;
    try { plan = normalizeStoryPlan(raw || {}); }
    catch (err) { return `Story setup could not be normalized: ${err.message}`; }

    if (!plan.startingContext && !plan.title && !plan.authorBrief) {
      return `${who} emitted an empty story-setup block — nothing was created.`;
    }

    let created;
    try {
      created = storyStore.createStory(this.storiesRoot, {
        title:           plan.title || 'Untitled Story',
        storyType:       plan.storyType,
        storyTypeLabel:  plan.storyTypeLabel,
        startingContext: plan.startingContext,
        mainCharacter:   plan.mainCharacter,
        settings:        plan.settings,
        storyLength:     plan.storyLength,
        narratorMode:    plan.narratorMode,
        authorBrief:     plan.authorBrief,
        createdBy:       'companion',
      });
    } catch (err) {
      console.error('[Authoring] createStory failed:', err.message);
      return `Story creation failed: ${err.message}`;
    }

    const title = (created.state && created.state.title) || plan.title || 'Untitled Story';
    this._queue.push({ slug: created.slug, title });
    this.emit('companion:authoring', {
      kind: 'story-created',
      slug: created.slug,
      title,
      narratorMode: plan.narratorMode,
      storyLength: plan.storyLength,
      status: this.status(),
    });
    this._pump();

    const lengthLabel = (storyStore.STORY_LENGTHS.find((s) => s.slug === plan.storyLength) || {}).label || plan.storyLength;
    const narratorNote = plan.narratorMode === 'companion' ? `, narrated by ${who}` : '';
    return `${who} started building "${title}" (${lengthLabel}${narratorNote}). Planning runs in the background — you'll get a notice when it's ready in Story mode.`;
  }

  // ── The job pump: strictly one planning chain at a time ───────────────
  _pump() {
    if (this._running) return;
    const job = this._queue.shift();
    if (!job) return;
    if (typeof this.runSetupChain !== 'function') {
      console.warn('[Authoring] runSetupChain not wired — story plan will not be built.');
      this.emit('companion:authoring', {
        kind: 'story-failed', slug: job.slug, title: job.title,
        error: 'Story planning is not wired up in this build.', status: this.status(),
      });
      return;
    }

    this._cancelRequested = false;
    this._running = { slug: job.slug, title: job.title, label: 'Starting…', calls: 0, startedAt: Date.now() };
    this.emit('companion:authoring', { kind: 'plan-start', slug: job.slug, title: job.title, status: this.status() });

    this.runSetupChain({
      slug: job.slug,
      includeBlueprint: true,
      includeOpening:   true,
      shouldAbort: () => this._cancelRequested,
      onProgress: (p) => {
        if (!this._running) return;
        this._running.label = p.label || '';
        this._running.calls = p.calls || 0;
        this.emit('companion:authoring', {
          kind: 'plan-progress',
          slug: job.slug,
          title: job.title,
          label: this._running.label,
          calls: this._running.calls,
          maxCalls: p.maxCalls,
          status: this.status(),
        });
      },
    }).then((res) => {
      const ok = !!(res && res.success);
      this.emit('companion:authoring', {
        kind: ok ? 'plan-done' : 'story-failed',
        slug: job.slug,
        title: job.title,
        aborted:  !!(res && res.aborted),
        cancelled: this._cancelRequested,
        warnings: (res && res.warnings) || [],
        error:    ok ? null : ((res && res.error) || 'unknown error'),
        status:   this.status(),
      });
      if (!ok) console.warn('[Authoring] plan failed for', job.slug, res && res.error);
    }).catch((err) => {
      console.error('[Authoring] plan crashed for', job.slug, err.message);
      this.emit('companion:authoring', {
        kind: 'story-failed', slug: job.slug, title: job.title,
        error: err.message, status: this.status(),
      });
    }).finally(() => {
      this._running = null;
      this._cancelRequested = false;
      // Next job (if the user didn't cancel the whole queue).
      this._pump();
      this.emit('companion:authoring', { kind: 'status', status: this.status() });
    });
  }

  // ── Adventure creation ───────────────────────────────────────────────
  _createAdventure(raw) {
    const who = this.getCompanionName();
    if (raw && raw._parseError) {
      console.warn('[Authoring] CREATE_ADVENTURE JSON was unparseable:', String(raw.raw || '').slice(0, 200));
      return `${who} tried to design a campaign but her setup block was malformed JSON — nothing was created.`;
    }
    const plan = normalizeAdventurePlan(raw || {});
    if (!plan.setting && !plan.authorBrief) {
      return `${who} emitted an empty adventure-setup block — nothing was created.`;
    }

    // Is a campaign already live? A started game (or any existing state with
    // turns on it) is a save file — never overwrite it without a yes.
    let existing = null;
    try { existing = adventureStore.loadState(this.characterDir); } catch {}
    const isLive = !!(existing && (existing.turnCount || 0) > 0 && existing.alive !== false);

    if (isLive) {
      this._pendingAdventure = { id: 'adv_' + Date.now(), plan, proposedAt: new Date().toISOString() };
      this.emit('companion:authoring', {
        kind: 'adventure-proposed',
        id: this._pendingAdventure.id,
        tone: plan.tone,
        setting: plan.setting,
        authorBrief: plan.authorBrief,
        existing: { turnCount: existing.turnCount || 0, tone: existing.tone, scene: existing.scene && existing.scene.name },
        status: this.status(),
      });
      return `${who} designed a new campaign, but your current one is ${existing.turnCount} turns in. Confirm the replacement to start hers — your current run is untouched until you do.`;
    }

    return this._commitAdventure(plan);
  }

  _commitAdventure(plan) {
    const who = this.getCompanionName();
    let companionName = 'Aria';
    try {
      const charJson = JSON.parse(fs.readFileSync(path.join(this.characterDir, 'character.json'), 'utf8'));
      if (charJson.name) companionName = charJson.name;
    } catch {}
    try {
      const state = adventureStore.newGame(this.characterDir, {
        tone:        plan.tone,
        setting:     plan.setting,
        companionName,
        authorBrief: plan.authorBrief,
        createdBy:   'companion',
      });
      this.emit('companion:authoring', {
        kind: 'adventure-created', tone: state.tone, setting: state.setting, status: this.status(),
      });
      const toneLabel = (ADVENTURE_TONES.find((t) => t.slug === state.tone) || {}).label || state.tone;
      return `${who} set up a new ${toneLabel} campaign. Open Adventure mode and take the first action.`;
    } catch (err) {
      console.error('[Authoring] adventure newGame failed:', err.message);
      return `Adventure creation failed: ${err.message}`;
    }
  }

  /** User answered the replace-my-campaign prompt. */
  resolvePendingAdventure(id, approved) {
    const pending = this._pendingAdventure;
    if (!pending || (id && pending.id !== id)) {
      return { success: false, error: 'That campaign proposal is no longer pending.' };
    }
    this._pendingAdventure = null;
    if (!approved) {
      this.emit('companion:authoring', { kind: 'adventure-declined', status: this.status() });
      return { success: true, approved: false };
    }
    const notice = this._commitAdventure(pending.plan);
    return { success: true, approved: true, notice };
  }

  // ── Patch an existing story ──────────────────────────────────────────
  _patchStory(raw) {
    const who = this.getCompanionName();
    if (raw && raw._parseError) return `${who}'s story-settings block was malformed JSON — nothing changed.`;
    const patch = normalizeStoryPatch(raw || {});
    if (!patch.slug) return `${who} tried to change a story's settings without naming which story — nothing changed.`;

    const dir = storyStore._storyDir(this.storiesRoot, patch.slug);
    if (!fs.existsSync(dir)) return `${who} referenced a story that doesn't exist ("${patch.slug}") — nothing changed.`;
    const state = storyStore.loadState(dir);
    if (!state) return `Story "${patch.slug}" could not be loaded — nothing changed.`;

    const changed = [];
    if (patch.title && patch.title !== state.title) { state.title = patch.title; changed.push('title'); }
    if (patch.narratorMode && patch.narratorMode !== state.narratorMode) {
      state.narratorMode = patch.narratorMode;
      changed.push(`narrator → ${patch.narratorMode === 'companion' ? who : 'the Storyteller'}`);
    }
    if (patch.settings) {
      for (const [k, v] of Object.entries(patch.settings)) {
        if (state.settings[k] !== v) { state.settings[k] = v; changed.push(`${k} → ${v}`); }
      }
    }
    if (!changed.length) return null;
    try { storyStore.saveState(dir, state); }
    catch (err) { return `Could not save changes to "${state.title}": ${err.message}`; }

    this.emit('companion:authoring', {
      kind: 'story-updated', slug: patch.slug, title: state.title, changed, status: this.status(),
    });
    return `${who} updated "${state.title}": ${changed.join(', ')}.`;
  }

  // ── Queue a nudge on a story ─────────────────────────────────────────
  _nudgeStory(raw) {
    const who = this.getCompanionName();
    const slug = _str(raw && raw.slug, 80);
    const nudge = _str(raw && raw.nudge, 1200);
    if (!slug || !nudge) return null;
    const dir = storyStore._storyDir(this.storiesRoot, slug);
    if (!fs.existsSync(dir)) return `${who} tried to nudge a story that doesn't exist ("${slug}").`;
    const state = storyStore.loadState(dir);
    if (!state) return `Story "${slug}" could not be loaded — the nudge was dropped.`;
    state.pendingNudge = nudge;
    try { storyStore.saveState(dir, state); }
    catch (err) { return `Could not queue the nudge on "${state.title}": ${err.message}`; }
    this.emit('companion:authoring', {
      kind: 'story-nudged', slug, title: state.title, nudge, status: this.status(),
    });
    return `${who} queued a note to the narrator of "${state.title}" for its next section.`;
  }
}

module.exports = {
  CompanionAuthoring,
  buildWorkshopContext,
  normalizeStoryPlan,
  normalizeAdventurePlan,
  normalizeStoryPatch,
  ADVENTURE_TONES,
};
