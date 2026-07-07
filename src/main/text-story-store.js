// Text-Story state storage.
//
// Each story lives in its own folder under STORIES_ROOT/<slug>/. That folder
// holds everything for the story — state, log, storyteller-chat, debug log.
// Unlike Adventure (which piggybacks on a character folder), Story is
// entirely standalone. It does NOT touch Aria's character.json, master
// summary, or permanent memories.
//
// Files (per story):
//   story.json                    — main state (mainCharacter, scene, memory, settings)
//   story-log.json                — narrative log (rolling cap)
//   story-storyteller-chat.json   — Ask Storyteller transcript (rolling cap)
//   story-debug-responses.json    — rolling raw-response capture

const fs   = require('fs');
const path = require('path');

const STATE_FILENAME              = 'story.json';
const LOG_FILENAME                = 'story-log.json';
const STCHAT_FILENAME             = 'story-storyteller-chat.json';
const COMPCHAT_FILENAME           = 'story-companion-chat.json';
const REACTIONS_FILENAME          = 'story-reactions.json';
const BOOKMARKS_FILENAME          = 'story-bookmarks.json';
const ANNOTATIONS_FILENAME        = 'story-annotations.json';
const DEBUG_RESPONSES_FILENAME    = 'story-debug-responses.json';
// [REPORT] overrun log — append-only, uncapped. See STORY_GUIDELINES_PATCH §6.
const REPORTS_FILENAME            = 'story-reports.json';

// Story files intentionally have NO disk cap — user directive: everything
// stored for the story at all times. Files grow forever with the story.
// The prompt-side window (log.slice(-N) inside text-story-rules.js) still
// limits what's actually sent to the Storyteller each turn; that's a
// separate concern from what's kept on disk.
const LOG_MAX_ENTRIES             = null;   // unlimited
const STCHAT_MAX_ENTRIES          = null;   // unlimited
const COMPCHAT_MAX_ENTRIES        = null;   // unlimited
const DEBUG_RESPONSES_CAP         = null;   // unlimited

// Prompt-bloat guardrails. The storyteller is expected to prune via
// [STATE].memory.*.remove when things go stale, but we enforce ceilings.
const MEMORY_CAPS = {
  characters: 80,
  locations:  60,
  items:      60,
  events:     200,
  goals:      40,
  lore:       80,
};

// ── Story-type catalog ────────────────────────────────────────────────────

const STORY_TYPES = [
  { slug: 'fantasy_epic',      label: 'Epic Fantasy',
    hint: 'High fantasy world with kingdoms, magic, ancient prophecies, and larger-than-life heroes.' },
  { slug: 'dark_fantasy',      label: 'Dark Fantasy',
    hint: 'Grimdark, morally ambiguous world. Corruption, ruined empires, dread, and hard choices.' },
  { slug: 'sword_and_sorcery', label: 'Sword & Sorcery',
    hint: 'Small-scale adventures — mercenaries, thieves, tomb raids, ancient magic. Personal stakes.' },
  { slug: 'sci_fi',            label: 'Science Fiction',
    hint: 'Space, futures, worlds shaped by technology. Hard or soft — the storyteller decides.' },
  { slug: 'cyberpunk',         label: 'Cyberpunk',
    hint: 'Neon-lit near-future. Megacorps, hackers, augmentations, moral rot beneath the chrome.' },
  { slug: 'horror',            label: 'Horror',
    hint: 'Fear, dread, the wrong thing in the woods. Psychological or visceral, storyteller\'s call.' },
  { slug: 'mystery_noir',      label: 'Mystery / Noir',
    hint: 'Detective work in a rain-slick city. Secrets, lies, femme fatales, unreliable clients.' },
  { slug: 'romance',           label: 'Romance',
    hint: 'A story where the central engine is a relationship. Setting can be anything.' },
  { slug: 'slice_of_life',     label: 'Slice of Life',
    hint: 'Quiet, character-driven. Small worlds, small stakes, deep emotional beats.' },
  { slug: 'historical',        label: 'Historical',
    hint: 'A specific real-world period brought to life. Storyteller picks the era if unspecified.' },
  { slug: 'post_apocalyptic',  label: 'Post-Apocalyptic',
    hint: 'The world ended. What survives, what people do, what can still be built.' },
  { slug: 'surreal',           label: 'Surreal / Dreamlike',
    hint: 'Loose logic, symbolic imagery, mood over plot. The dream you can\'t remember on waking.' },
  { slug: 'custom',            label: '(Let the Storyteller choose)',
    hint: 'You have no preference. The storyteller picks a genre appropriate for your starting context.' },
];

// ── Settings catalog (for renderer to render dropdowns / sliders) ─────────

const SEGMENT_LENGTHS = [
  { slug: 'short',  label: 'Short',   range: '150–250 words',   hint: 'Snappy, fast-paced. More user interactions per unit of story.' },
  { slug: 'medium', label: 'Medium',  range: '300–500 words',   hint: 'Balanced pacing. Default.' },
  { slug: 'long',   label: 'Long',    range: '600–900 words',   hint: 'Immersive segments. Reads like a proper chapter chunk.' },
  { slug: 'epic',   label: 'Epic',    range: '1000–1500 words', hint: 'Full chapter-sized segments. Rare interruptions.' },
];

const CHOICE_FREQUENCIES = [
  { slug: 'rare',      label: 'Rare',      hint: 'Long stretches without a choice prompt. The story flows on its own most of the time.' },
  { slug: 'normal',    label: 'Normal',    hint: 'Roughly every 1–2 segments, when a real decision would matter.' },
  { slug: 'frequent',  label: 'Frequent',  hint: 'Most turns end with a choice. Highly interactive.' },
];

const NSFW_LEVELS = [
  { slug: 'safe',      label: 'Safe',
    hint: 'No sexual content. Violence is fantasy-standard (not gratuitous). Suitable for all-ages framing.' },
  { slug: 'adult',     label: 'Adult Themes',
    hint: 'Mature themes may appear (sex, violence, drug use) but nothing explicit on the page. Fade-to-black for intimacy.' },
  { slug: 'nsfw',      label: 'NSFW Allowed',
    hint: 'Sex and violence rendered on-page when the story calls for it. Explicit but not the point of the story.' },
  { slug: 'hardcore',  label: 'Hardcore Integrated',
    hint: 'Unfiltered. Explicit content can be central to plot, character, or theme. No fade-to-black.' },
];

// Story-length presets. A "section" is one to two printed book pages.
// targetSections is a PLANNING ANCHOR the Storyteller aims for during setup —
// it is NOT a cap. Chapter/event sectionBudget values across the story should
// roughly sum to this target. Overruns via [REPORT] can push the actual total
// higher. See docs/STORY_GUIDELINES_PATCH.md §3.3.2 for the full spec.
const STORY_LENGTHS = [
  { slug: 'poem',         label: 'Poem',
    hint: 'A single lyric arc; a fable. Very short — one chapter.',
    targetSections: 7,    sectionRange: [4, 10],     chapterRange: [1, 1] },
  { slug: 'short_story',  label: 'Short Story',
    hint: 'A short-story-collection entry. 1–4 chapters, ~20 sections.',
    targetSections: 20,   sectionRange: [12, 30],    chapterRange: [1, 4] },
  { slug: 'novelette',    label: 'Novelette / Light Novel',
    hint: 'A light novel or JP novelette. 5–10 chapters, ~60 sections.',
    targetSections: 60,   sectionRange: [40, 80],    chapterRange: [5, 10] },
  { slug: 'novel',        label: 'Novel',
    hint: 'A standard novel. 10–25 chapters, ~180 sections.',
    targetSections: 180,  sectionRange: [120, 250],  chapterRange: [10, 25] },
  { slug: 'story_book',   label: 'Story Book',
    hint: 'A long, thick novel (600+ printed pages). 25–40 chapters, ~400 sections.',
    targetSections: 400,  sectionRange: [300, 500],  chapterRange: [25, 40] },
  { slug: 'epic',         label: 'Epic',
    hint: 'Odyssey-scale; multi-book epic. 40+ chapters, ~1000 sections.',
    targetSections: 1000, sectionRange: [600, 1500], chapterRange: [40, 80] },
];

function _resolveStoryLength(preset) {
  const found = STORY_LENGTHS.find((s) => s.slug === preset);
  const base  = found || STORY_LENGTHS.find((s) => s.slug === 'novel');
  return {
    preset:              base.slug,
    label:               base.label,
    targetSections:      base.targetSections,
    sectionRange:        base.sectionRange.slice(),
    chapterRange:        base.chapterRange.slice(),
    sectionEqualsPages:  '1–2',
  };
}

// ── Path helpers ──────────────────────────────────────────────────────────

function _storyDir(storiesRoot, slug) { return path.join(storiesRoot, slug); }
function _statePath     (storyDir) { return path.join(storyDir, STATE_FILENAME);              }
function _logPath       (storyDir) { return path.join(storyDir, LOG_FILENAME);                }
function _stChatPath    (storyDir) { return path.join(storyDir, STCHAT_FILENAME);             }
function _compChatPath  (storyDir) { return path.join(storyDir, COMPCHAT_FILENAME);           }
function _reactionsPath (storyDir) { return path.join(storyDir, REACTIONS_FILENAME);          }
function _bookmarksPath (storyDir) { return path.join(storyDir, BOOKMARKS_FILENAME);          }
function _annotationsPath(storyDir){ return path.join(storyDir, ANNOTATIONS_FILENAME);        }
function _debugPath     (storyDir) { return path.join(storyDir, DEBUG_RESPONSES_FILENAME);    }
function _reportsPath   (storyDir) { return path.join(storyDir, REPORTS_FILENAME);            }

function ensureRoot(storiesRoot) {
  if (!fs.existsSync(storiesRoot)) fs.mkdirSync(storiesRoot, { recursive: true });
  return storiesRoot;
}

function _slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}

function _uniqueSlug(storiesRoot, base) {
  const b = _slugify(base);
  let slug = b;
  let n = 2;
  while (fs.existsSync(_storyDir(storiesRoot, slug))) {
    slug = `${b}-${n++}`;
    if (n > 999) { slug = `${b}-${Date.now()}`; break; }
  }
  return slug;
}

// ── Chapter derivation ────────────────────────────────────────────────────
// When a blueprint predates chapter tracking (or the Storyteller didn't
// emit them), derive a chapter list from the arc's key_beats. Each beat
// becomes one chapter. Also used by story:generate-blueprint as a fallback
// when the model forgets to emit chapters.

function _deriveChaptersFromBeats(bp) {
  const list = [];
  const acts = bp && bp.arc ? bp.arc : {};
  ['beginning', 'middle', 'end'].forEach((actName) => {
    const act = acts[actName];
    if (!act || !Array.isArray(act.key_beats)) return;
    act.key_beats.forEach((beat) => {
      const n = list.length + 1;
      list.push({
        number: n,
        act:    actName,
        title:  typeof beat === 'string' ? beat : (beat && beat.title) || `Chapter ${n}`,
      });
    });
  });
  return {
    total:           list.length || 1,
    currentChapter:  1,
    list,
  };
}

// ── Fresh state builders ──────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  segmentLength:    'medium',
  descriptiveness:  3,
  proseStyle:       3,
  nsfwLevel:        'safe',
  choiceFrequency:  'normal',
};

function _freshMemory() {
  return {
    characters:            [],
    locations:             [],
    items:                 [],
    events:                [],
    goals:                 [],
    lore:                  [],
    storySummary:          '',
    storySummaryUpdatedTurn: 0,
    // Rolled-up summaries of old log chunks — populated by
    // story:summarize-old-log when the log grows. Each entry is a dense
    // prose recap of a contiguous chunk of old sections.
    rolledLog:             [],   // [{ fromSection, toSection, summary, t }]
  };
}

function _freshMainCharacter({ name = '', gender = '' } = {}) {
  return {
    name:        String(name || '').trim(),
    gender:      String(gender || '').trim(),
    background:  '',
    appearance:  '',
    personality: '',
    notes:       '',
  };
}

function _freshScene() {
  // characters[] — ids of characters PRESENT in the current scene right now
  // (not the whole chapter's cast). Updated per turn by the Storyteller.
  return { name: 'Prologue', location: '', time: '', situation: '', characters: [] };
}

function _freshState({ title, slug, storyType, storyTypeLabel, startingContext, mainCharacter, settings, storyLength }) {
  const now = new Date().toISOString();
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  return {
    version:         1,
    slug,
    title:           title || 'Untitled Story',
    storyType,
    storyTypeLabel:  storyTypeLabel || storyType,
    created:         now,
    updated:         now,
    settings:        merged,
    // User-picked size at setup time. Injected into every setup-time prompt
    // and displayed in the pacing UI so Claude/UI always know the target.
    // See STORY_GUIDELINES_PATCH §3.3.2.
    storyLength:     _resolveStoryLength(storyLength || 'novel'),
    startingContext: String(startingContext || '').trim(),
    mainCharacter:   _freshMainCharacter(mainCharacter),
    scene:           _freshScene(),
    memory:          _freshMemory(),
    turnCount:       0,
    pendingChoices:  null,
    pendingNudge:    null,
    // Blueprint — populated by story:generate-blueprint after creation.
    // The Storyteller designs the entire plot before writing the opening
    // scene, and this blueprint is passed into EVERY subsequent turn as
    // the canonical plan. See docs/COMBAT_CALCULATIONS.md style rules —
    // blueprint is the spec, prose is the implementation.
    //
    // Post-patch (STORY_GUIDELINES_PATCH): the blueprint also holds
    // storyOverview (the story core), chapterSummaries[], eventSummaries[],
    // and events[] (pacing atoms). See docs/STORY_GUIDELINES_PATCH.md.
    storyBlueprint:  null,
    lastError:       null,
  };
}

// ── Story-list scanning ───────────────────────────────────────────────────

function listStories(storiesRoot) {
  ensureRoot(storiesRoot);
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(storiesRoot, { withFileTypes: true }); } catch { return out; }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const slug = ent.name;
    const dir  = _storyDir(storiesRoot, slug);
    const stateFile = _statePath(dir);
    if (!fs.existsSync(stateFile)) continue;
    try {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      out.push({
        slug,
        title:           state.title || slug,
        storyType:       state.storyType || null,
        storyTypeLabel:  state.storyTypeLabel || null,
        created:         state.created || null,
        updated:         state.updated || null,
        turnCount:       state.turnCount || 0,
        mainCharacter:   state.mainCharacter ? {
          name:   state.mainCharacter.name || '',
          gender: state.mainCharacter.gender || '',
        } : { name: '', gender: '' },
        sceneName:       state.scene ? state.scene.name || null : null,
      });
    } catch (e) {
      console.warn('[TextStory] listStories: failed to parse', slug, e.message);
    }
  }
  // Most-recently-updated first
  out.sort((a, b) => {
    const ta = new Date(a.updated || 0).getTime();
    const tb = new Date(b.updated || 0).getTime();
    return tb - ta;
  });
  return out;
}

// ── Create / delete / rename ──────────────────────────────────────────────

function createStory(storiesRoot, {
  title, storyType, storyTypeLabel, startingContext, mainCharacter, settings, storyLength,
} = {}) {
  ensureRoot(storiesRoot);
  const slug = _uniqueSlug(storiesRoot, title || 'untitled-story');
  const dir  = _storyDir(storiesRoot, slug);
  fs.mkdirSync(dir, { recursive: true });
  const state = _freshState({ title, slug, storyType, storyTypeLabel, startingContext, mainCharacter, settings, storyLength });
  fs.writeFileSync(_statePath(dir), JSON.stringify(state, null, 2), 'utf8');
  fs.writeFileSync(_logPath(dir), '[]', 'utf8');
  fs.writeFileSync(_stChatPath(dir), '[]', 'utf8');
  fs.writeFileSync(_debugPath(dir), '[]', 'utf8');
  fs.writeFileSync(_reportsPath(dir), '[]', 'utf8');
  return { slug, state };
}

function deleteStory(storiesRoot, slug) {
  const dir = _storyDir(storiesRoot, slug);
  if (!fs.existsSync(dir)) return false;
  // Recursive delete via fs.rmSync — Node 22 supports this natively.
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch (e) {
    console.warn('[TextStory] deleteStory failed:', e.message);
    return false;
  }
}

function renameStory(storiesRoot, oldSlug, newTitle) {
  const oldDir = _storyDir(storiesRoot, oldSlug);
  if (!fs.existsSync(oldDir)) return null;
  const newSlug = _uniqueSlug(storiesRoot, newTitle);
  const newDir  = _storyDir(storiesRoot, newSlug);
  if (oldSlug !== newSlug) {
    fs.renameSync(oldDir, newDir);
  }
  // Update state.title + slug
  const state = loadState(newDir);
  if (state) {
    state.title   = newTitle;
    state.slug    = newSlug;
    state.updated = new Date().toISOString();
    saveState(newDir, state);
  }
  return { slug: newSlug, state };
}

// ── Load / save state ─────────────────────────────────────────────────────

function loadState(storyDir) {
  try {
    const p = _statePath(storyDir);
    if (!fs.existsSync(p)) return null;
    const state = JSON.parse(fs.readFileSync(p, 'utf8'));
    // Forward-compat backfills
    if (!state.settings)        state.settings = { ...DEFAULT_SETTINGS };
    if (!state.mainCharacter)   state.mainCharacter = _freshMainCharacter();
    if (!state.scene)           state.scene   = _freshScene();
    if (state.scene && !Array.isArray(state.scene.characters)) state.scene.characters = [];
    if (!state.memory)          state.memory  = _freshMemory();
    for (const k of Object.keys(_freshMemory())) {
      if (Array.isArray(_freshMemory()[k]) && !Array.isArray(state.memory[k])) state.memory[k] = [];
    }
    if (!Array.isArray(state.memory.rolledLog)) state.memory.rolledLog = [];
    if (state.pendingChoices === undefined) state.pendingChoices = null;
    if (state.pendingNudge   === undefined) state.pendingNudge   = null;
    if (state.storyBlueprint === undefined) state.storyBlueprint = null;
    // Backfill chapters on existing blueprints so old stories get the new
    // chapter tracker without a Claude regen. Derived from arc.key_beats.
    if (state.storyBlueprint && !state.storyBlueprint.chapters) {
      state.storyBlueprint.chapters = _deriveChaptersFromBeats(state.storyBlueprint);
    }
    // Backfill storyLength on old stories so the STORY LENGTH picker is
    // meaningful for everyone. Default = novel.
    if (!state.storyLength) state.storyLength = _resolveStoryLength('novel');
    // Backfill pacing-patch fields on the blueprint so old stories can be
    // rendered without null-guards everywhere. These stay empty until a
    // REGEN PLAN pass fills them.
    if (state.storyBlueprint) {
      if (!state.storyBlueprint.storyOverview)     state.storyBlueprint.storyOverview     = null;
      if (!Array.isArray(state.storyBlueprint.chapterSummaries)) state.storyBlueprint.chapterSummaries = [];
      if (!Array.isArray(state.storyBlueprint.eventSummaries))   state.storyBlueprint.eventSummaries   = [];
      if (!Array.isArray(state.storyBlueprint.events))           state.storyBlueprint.events           = [];
      // Ensure chapter list entries have sectionBudget/sectionsUsed.
      if (state.storyBlueprint.chapters && Array.isArray(state.storyBlueprint.chapters.list)) {
        for (const ch of state.storyBlueprint.chapters.list) {
          if (typeof ch.sectionBudget !== 'number') ch.sectionBudget = 3;
          if (typeof ch.sectionsUsed  !== 'number') ch.sectionsUsed  = 0;
        }
      }
    }
    return state;
  } catch (e) {
    console.warn('[TextStory] loadState failed:', e.message);
    return null;
  }
}

function saveState(storyDir, state) {
  state.updated = new Date().toISOString();
  fs.writeFileSync(_statePath(storyDir), JSON.stringify(state, null, 2), 'utf8');
}

// ── Log I/O ───────────────────────────────────────────────────────────────

function loadLog(storyDir) {
  try {
    const p = _logPath(storyDir);
    if (!fs.existsSync(p)) return [];
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveLog(storyDir, log) {
  const trimmed = LOG_MAX_ENTRIES ? log.slice(-LOG_MAX_ENTRIES) : log;
  fs.writeFileSync(_logPath(storyDir), JSON.stringify(trimmed, null, 2), 'utf8');
}

function appendLog(storyDir, entry) {
  const log = loadLog(storyDir);
  log.push({ ...entry, t: new Date().toISOString() });
  saveLog(storyDir, log);
  return log;
}

// ── Storyteller-chat I/O ─────────────────────────────────────────────────

function loadStorytellerChat(storyDir) {
  try {
    const p = _stChatPath(storyDir);
    if (!fs.existsSync(p)) return [];
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveStorytellerChat(storyDir, chat) {
  const trimmed = STCHAT_MAX_ENTRIES ? chat.slice(-STCHAT_MAX_ENTRIES) : chat;
  fs.writeFileSync(_stChatPath(storyDir), JSON.stringify(trimmed, null, 2), 'utf8');
}

function appendStorytellerChat(storyDir, entry) {
  const chat = loadStorytellerChat(storyDir);
  chat.push({ ...entry, t: new Date().toISOString() });
  saveStorytellerChat(storyDir, chat);
  return chat;
}

function clearStorytellerChat(storyDir) {
  try { fs.unlinkSync(_stChatPath(storyDir)); } catch {}
}

// ── Companion-chat I/O ───────────────────────────────────────────────────
// Aria's meta-chat about the story. She's a "reader" alongside Trist, not
// a character in the fiction. Transcript is separate from the storyteller
// meta-chat so the two channels don't cross-contaminate.

function loadCompanionChat(storyDir) {
  try {
    const p = _compChatPath(storyDir);
    if (!fs.existsSync(p)) return [];
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveCompanionChat(storyDir, chat) {
  const trimmed = COMPCHAT_MAX_ENTRIES ? chat.slice(-COMPCHAT_MAX_ENTRIES) : chat;
  fs.writeFileSync(_compChatPath(storyDir), JSON.stringify(trimmed, null, 2), 'utf8');
}

function appendCompanionChat(storyDir, entry) {
  const chat = loadCompanionChat(storyDir);
  chat.push({ ...entry, t: new Date().toISOString() });
  saveCompanionChat(storyDir, chat);
  return chat;
}

function clearCompanionChat(storyDir) {
  try { fs.unlinkSync(_compChatPath(storyDir)); } catch {}
}

// ── Companion reactions (unbounded — grows forever with the story) ───────
// Each reaction: { turn, companionName, dialogue, emotion, t }
function loadReactions(storyDir) {
  try {
    const p = _reactionsPath(storyDir);
    if (!fs.existsSync(p)) return [];
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveReactions(storyDir, reactions) {
  fs.writeFileSync(_reactionsPath(storyDir), JSON.stringify(reactions, null, 2), 'utf8');
}
function appendReaction(storyDir, entry) {
  const arr = loadReactions(storyDir);
  arr.push({ ...entry, t: new Date().toISOString() });
  saveReactions(storyDir, arr);
  return arr;
}

// ── Bookmarks ────────────────────────────────────────────────────────────
// Each bookmark: { id, logIdx, label, t }
function loadBookmarks(storyDir) {
  try {
    const p = _bookmarksPath(storyDir);
    if (!fs.existsSync(p)) return [];
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveBookmarks(storyDir, arr) {
  fs.writeFileSync(_bookmarksPath(storyDir), JSON.stringify(arr, null, 2), 'utf8');
}
function toggleBookmark(storyDir, logIdx, label = '') {
  const arr = loadBookmarks(storyDir);
  const existing = arr.findIndex((b) => b.logIdx === logIdx);
  if (existing >= 0) {
    arr.splice(existing, 1);
  } else {
    arr.push({ id: 'bm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), logIdx, label, t: new Date().toISOString() });
  }
  saveBookmarks(storyDir, arr);
  return arr;
}

// ── Annotations (per-log-entry personal notes) ───────────────────────────
// Each annotation: { id, logIdx, text, t }
function loadAnnotations(storyDir) {
  try {
    const p = _annotationsPath(storyDir);
    if (!fs.existsSync(p)) return [];
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveAnnotations(storyDir, arr) {
  fs.writeFileSync(_annotationsPath(storyDir), JSON.stringify(arr, null, 2), 'utf8');
}
function upsertAnnotation(storyDir, logIdx, text) {
  const arr = loadAnnotations(storyDir);
  const existing = arr.findIndex((a) => a.logIdx === logIdx);
  const clean = String(text || '').trim();
  if (!clean) {
    // Empty text deletes the annotation
    if (existing >= 0) arr.splice(existing, 1);
  } else if (existing >= 0) {
    arr[existing] = { ...arr[existing], text: clean, t: new Date().toISOString() };
  } else {
    arr.push({ id: 'an_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), logIdx, text: clean, t: new Date().toISOString() });
  }
  saveAnnotations(storyDir, arr);
  return arr;
}

// ── Stats + export ───────────────────────────────────────────────────────

function computeStats(storyDir) {
  const state = loadState(storyDir);
  const log   = loadLog(storyDir);
  const reactions = loadReactions(storyDir);
  const bookmarks = loadBookmarks(storyDir);
  const annotations = loadAnnotations(storyDir);
  const stories = log.filter((e) => e.kind === 'story');
  const wordCount = stories.reduce((sum, e) => sum + (String(e.text || '').split(/\s+/).filter(Boolean).length), 0);
  const bp = state && state.storyBlueprint;
  return {
    title:            state ? state.title : null,
    created:          state ? state.created : null,
    updated:          state ? state.updated : null,
    sectionCount:     state ? state.turnCount || 0 : 0,
    storyEntries:     stories.length,
    wordCount,
    charactersEstablished: state && state.memory ? (state.memory.characters || []).length : 0,
    locationsEstablished:  state && state.memory ? (state.memory.locations  || []).length : 0,
    eventsRecorded:        state && state.memory ? (state.memory.events     || []).length : 0,
    reactionCount:    reactions.length,
    bookmarkCount:    bookmarks.length,
    annotationCount:  annotations.length,
    chapterCurrent:   bp && bp.chapters ? bp.chapters.currentChapter : null,
    chapterTotal:     bp && bp.chapters ? bp.chapters.total          : null,
    fixedEventsPending:   bp && Array.isArray(bp.fixedEvents) ? bp.fixedEvents.filter((e) => (e.status || 'pending') === 'pending').length : 0,
    fixedEventsTriggered: bp && Array.isArray(bp.fixedEvents) ? bp.fixedEvents.filter((e) => e.status === 'triggered').length : 0,
  };
}

// Build a clean prose export of the story: title, chapter headers, and the
// concatenation of every [kind: 'story'] log entry with the scene name as a
// small header. Player actions optionally included as a short byline.
function exportProse(storyDir, format = 'md', { includePlayerActions = true } = {}) {
  const state = loadState(storyDir);
  const log   = loadLog(storyDir);
  const bp    = state ? state.storyBlueprint : null;
  const title = state ? state.title : 'Untitled Story';
  const chapters = bp && bp.chapters && Array.isArray(bp.chapters.list) ? bp.chapters.list : [];

  const lines = [];
  const isMd  = format === 'md';

  if (isMd) {
    lines.push('# ' + title);
    lines.push('');
    if (bp && bp.premise) { lines.push('_' + bp.premise.replace(/_/g, '\\_') + '_'); lines.push(''); }
  } else {
    lines.push(title);
    lines.push('='.repeat(title.length));
    lines.push('');
  }

  let lastChapter = null;
  let lastScene = null;
  for (const entry of log) {
    if (!entry) continue;
    if (entry.kind === 'story') {
      // Chapter header if we just entered a new chapter
      if (typeof entry.chapter === 'number' && entry.chapter !== lastChapter) {
        lastChapter = entry.chapter;
        const chObj = chapters.find((c) => c.number === entry.chapter);
        const chTitle = chObj ? chObj.title : ('Chapter ' + entry.chapter);
        lines.push('');
        lines.push(isMd ? `## Chapter ${entry.chapter} — ${chTitle}` : `\n\n\nCHAPTER ${entry.chapter} — ${chTitle}\n${'-'.repeat(40)}`);
        lines.push('');
      }
      // Scene header
      if (entry.scene && entry.scene !== lastScene) {
        lastScene = entry.scene;
        lines.push(isMd ? `### ${entry.scene}` : `\n[ ${entry.scene} ]`);
        lines.push('');
      }
      lines.push(entry.text || '');
      lines.push('');
    } else if (includePlayerActions && (entry.kind === 'choice-taken' || entry.kind === 'freeform')) {
      const label = entry.kind === 'choice-taken' ? 'You chose' : 'You';
      const body  = entry.kind === 'choice-taken' ? entry.choice : entry.text;
      if (body) {
        lines.push(isMd ? `> _${label}: ${String(body).replace(/_/g, '\\_')}_` : `[${label}: ${body}]`);
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}

// ── Character portraits (user-uploaded PNG/JPG/WebP per character) ───────
// Files live in stories/<slug>/portraits/<characterId>.<ext>.

const PORTRAIT_DIRNAME = 'portraits';
const PORTRAIT_EXTS    = ['.png', '.jpg', '.jpeg', '.webp'];

function _portraitDir(storyDir) { return path.join(storyDir, PORTRAIT_DIRNAME); }

function listPortraits(storyDir) {
  const dir = _portraitDir(storyDir);
  const out = {};
  if (!fs.existsSync(dir)) return out;
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (!PORTRAIT_EXTS.includes(ext)) continue;
    const id = name.slice(0, name.length - ext.length);
    out[id] = path.join(dir, name);
  }
  return out;
}

// Copy an uploaded file into the story's portraits folder, keyed by
// character id. Any pre-existing portrait for that id (of any supported
// extension) is deleted first.
function setPortrait(storyDir, characterId, sourceFilePath) {
  if (!characterId) throw new Error('character id required');
  const ext = path.extname(sourceFilePath || '').toLowerCase();
  if (!PORTRAIT_EXTS.includes(ext)) throw new Error('unsupported portrait extension: ' + ext);
  const dir = _portraitDir(storyDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Remove any existing portrait for this id
  for (const e of PORTRAIT_EXTS) {
    const p = path.join(dir, characterId + e);
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
  }
  const dst = path.join(dir, characterId + ext);
  fs.copyFileSync(sourceFilePath, dst);
  return dst;
}

function clearPortrait(storyDir, characterId) {
  const dir = _portraitDir(storyDir);
  for (const e of PORTRAIT_EXTS) {
    const p = path.join(dir, characterId + e);
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
  }
}

// Fork: deep-copy a story folder to a new slug. Updates title on the copy.
function forkStory(storiesRoot, sourceSlug, newTitle) {
  const src = _storyDir(storiesRoot, sourceSlug);
  if (!fs.existsSync(src)) return null;
  const newSlug = _uniqueSlug(storiesRoot, newTitle || (loadState(src) || {}).title || 'story-fork');
  const dst = _storyDir(storiesRoot, newSlug);
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    try { fs.copyFileSync(path.join(src, name), path.join(dst, name)); } catch {}
  }
  // Update title + slug + fresh timestamps + record fork lineage
  const state = loadState(dst);
  if (state) {
    state.title = newTitle || (state.title + ' (fork)');
    state.slug  = newSlug;
    state.forkedFrom = { slug: sourceSlug, at: new Date().toISOString(), atSection: state.turnCount || 0 };
    state.updated = new Date().toISOString();
    saveState(dst, state);
  }
  return { slug: newSlug, state };
}

// ── Debug-response log ────────────────────────────────────────────────────

function loadDebugResponses(storyDir) {
  try {
    const p = _debugPath(storyDir);
    if (!fs.existsSync(p)) return [];
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function appendDebugResponse(storyDir, entry) {
  const arr = loadDebugResponses(storyDir);
  // entry may include: phase, userMessage, raw, meta,
  // systemPrompt (the full system prompt sent to Claude),
  // userPrompt (the user-role turn message sent to Claude).
  arr.push({ ...entry, t: new Date().toISOString() });
  const trimmed = DEBUG_RESPONSES_CAP ? arr.slice(-DEBUG_RESPONSES_CAP) : arr;
  fs.writeFileSync(_debugPath(storyDir), JSON.stringify(trimmed, null, 2), 'utf8');
}

// Return the most recent debug entry matching a given phase (or null).
function lastDebugResponseByPhase(storyDir, phase) {
  const arr = loadDebugResponses(storyDir);
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] && arr[i].phase === phase) return arr[i];
  }
  return null;
}

// ── [REPORT] overrun log (append-only, uncapped) ─────────────────────────
// See STORY_GUIDELINES_PATCH §6. Each entry captures a Storyteller-emitted
// budget-expansion request: which scope needs more budget, by how much, and
// why. Persisted to disk; surfaced as a loud banner + REPORTS inspector tab.

function loadReports(storyDir) {
  try {
    const p = _reportsPath(storyDir);
    if (!fs.existsSync(p)) return [];
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function appendReport(storyDir, entry) {
  const arr = loadReports(storyDir);
  arr.push({ ...entry, t: new Date().toISOString() });
  fs.writeFileSync(_reportsPath(storyDir), JSON.stringify(arr, null, 2), 'utf8');
  return arr;
}

// ── Pacing lifecycle ─────────────────────────────────────────────────────
//
// The engine bumps sectionsUsed AFTER the Storyteller's diff is applied for
// a turn, then processes any active→resolved transitions the diff marked.
// See STORY_GUIDELINES_PATCH §5.1.

function _currentChapterEntry(state) {
  const bp = state && state.storyBlueprint;
  if (!bp || !bp.chapters || !Array.isArray(bp.chapters.list)) return null;
  const cur = bp.chapters.currentChapter || 1;
  return bp.chapters.list.find((c) => c.number === cur) || null;
}

function activeEvent(state) {
  const bp = state && state.storyBlueprint;
  if (!bp || !Array.isArray(bp.events)) return null;
  return bp.events.find((e) => e.status === 'active') || null;
}

// Bump sectionsUsed on the current chapter and the currently-active event.
// Called AFTER applyStateDiff during a turn.
function bumpSectionCounters(state) {
  const ch = _currentChapterEntry(state);
  if (ch) {
    if (typeof ch.sectionBudget !== 'number') ch.sectionBudget = 3;
    if (typeof ch.sectionsUsed  !== 'number') ch.sectionsUsed  = 0;
    ch.sectionsUsed += 1;
  }
  const ev = activeEvent(state);
  if (ev) {
    if (typeof ev.sectionBudget !== 'number') ev.sectionBudget = 2;
    if (typeof ev.sectionsUsed  !== 'number') ev.sectionsUsed  = 0;
    ev.sectionsUsed += 1;
  }
}

// After a turn, if no event is `active` in the current chapter, promote the
// first pending event by orderInChapter to `active`. Abandon any pending
// events left over in prior chapters (with a debug warning).
function processEventTransitions(state) {
  const bp = state && state.storyBlueprint;
  if (!bp || !Array.isArray(bp.events) || !bp.chapters) return { promoted: null, abandoned: [] };
  const currentChapter = bp.chapters.currentChapter || 1;
  let promoted = null;
  const abandoned = [];
  // Abandon pending events in earlier chapters
  for (const ev of bp.events) {
    if (ev.status === 'pending' && (ev.chapterNumber || 0) < currentChapter) {
      ev.status = 'abandoned';
      abandoned.push(ev.id);
    }
  }
  // If no active event in the current chapter, promote the next pending one
  const inChapter = bp.events
    .filter((e) => (e.chapterNumber || 0) === currentChapter)
    .sort((a, b) => (a.orderInChapter || 0) - (b.orderInChapter || 0));
  const hasActive = inChapter.some((e) => e.status === 'active');
  if (!hasActive) {
    const nextPending = inChapter.find((e) => e.status === 'pending');
    if (nextPending) {
      nextPending.status = 'active';
      promoted = nextPending.id;
    }
  }
  return { promoted, abandoned };
}

// Apply a [REPORT] to the target's sectionBudget. Called after the report
// is parsed and appended to disk.
function applyReportToBudget(state, report) {
  if (!report || !state || !state.storyBlueprint) return false;
  const bp = state.storyBlueprint;
  const newBudget = Math.max(1, Math.floor(Number(report.requested_new_budget) || 0));
  if (!newBudget) return false;
  if (report.kind === 'event_overrun' && Array.isArray(bp.events)) {
    const ev = bp.events.find((e) => e.id === report.scope_id);
    if (ev) { ev.sectionBudget = newBudget; return true; }
  }
  if (report.kind === 'chapter_overrun' && bp.chapters && Array.isArray(bp.chapters.list)) {
    const chNum = Number(report.scope_id);
    const ch = bp.chapters.list.find((c) => c.number === chNum);
    if (ch) { ch.sectionBudget = newBudget; return true; }
  }
  if (report.kind === 'story_overrun' && state.storyLength) {
    state.storyLength.targetSections = newBudget;
    return true;
  }
  return false;
}

// ── State diff application ────────────────────────────────────────────────
//
// The storyteller emits a partial diff in the [STATE] block each turn. This
// function merges that diff into the live state in place. The diff schema is
// permissive — every field is optional; unknown keys are ignored.
//
// Schema:
//   {
//     "title":         "optional new title",
//     "storyType":     "optional new type slug",
//     "mainCharacter": { name?, gender?, background?, appearance?, personality?, notes? },
//     "scene":         { name?, location?, time?, situation? },
//     "memory": {
//        "characters":  { "add": [...], "update": [...], "remove": [...ids] },
//        "locations":   { "add": [...], "update": [...], "remove": [...ids] },
//        "items":       { "add": [...], "update": [...], "remove": [...ids] },
//        "events":      { "add": [{ title, description }] },
//        "goals":       { "add": [...], "update": [...], "remove": [...ids] },
//        "lore":        { "add": [...], "remove": [...] },
//        "storySummary": "..."
//     }
//   }

function _mergeShallow(target, patch, allowedKeys) {
  if (!patch || typeof patch !== 'object') return;
  for (const k of allowedKeys) {
    if (patch[k] !== undefined) target[k] = patch[k];
  }
}

function _applyMemoryCollection(list, diff, keyField, cap) {
  if (!diff || typeof diff !== 'object') return list;
  let out = Array.isArray(list) ? list.slice() : [];
  if (Array.isArray(diff.remove)) {
    const removeSet = new Set(diff.remove.map(String));
    out = out.filter((e) => !removeSet.has(String(e[keyField])));
  }
  if (Array.isArray(diff.update)) {
    for (const patch of diff.update) {
      if (!patch || typeof patch !== 'object') continue;
      const key = patch[keyField];
      if (key === undefined || key === null) continue;
      const idx = out.findIndex((e) => String(e[keyField]) === String(key));
      if (idx >= 0) out[idx] = { ...out[idx], ...patch };
    }
  }
  if (Array.isArray(diff.add)) {
    for (const rec of diff.add) {
      if (!rec || typeof rec !== 'object') continue;
      // If an entity with this id already exists, treat it as an update.
      const key = rec[keyField];
      if (key !== undefined && key !== null) {
        const idx = out.findIndex((e) => String(e[keyField]) === String(key));
        if (idx >= 0) { out[idx] = { ...out[idx], ...rec }; continue; }
      }
      out.push(rec);
    }
  }
  if (cap && out.length > cap) out = out.slice(-cap);
  return out;
}

function _applyStringList(list, diff, cap) {
  if (!diff || typeof diff !== 'object') return list;
  let out = Array.isArray(list) ? list.slice() : [];
  if (Array.isArray(diff.remove)) {
    const rm = new Set(diff.remove.map(String));
    out = out.filter((s) => !rm.has(String(s)));
  }
  if (Array.isArray(diff.add)) {
    for (const s of diff.add) {
      if (typeof s === 'string' && s.trim() && !out.includes(s)) out.push(s);
    }
  }
  if (cap && out.length > cap) out = out.slice(-cap);
  return out;
}

function applyStateDiff(state, diff, { turn = state.turnCount || 0 } = {}) {
  if (!diff || typeof diff !== 'object') return;

  if (typeof diff.title       === 'string' && diff.title.trim())       state.title      = diff.title.trim();
  if (typeof diff.storyType   === 'string' && diff.storyType.trim())   state.storyType  = diff.storyType.trim();

  _mergeShallow(state.mainCharacter, diff.mainCharacter,
    ['name', 'gender', 'background', 'appearance', 'personality', 'notes']);
  _mergeShallow(state.scene, diff.scene,
    ['name', 'location', 'time', 'situation']);
  // scene.characters — full replacement (not merge). The Storyteller emits
  // the current on-stage character-id list per turn; missing = empty list.
  if (diff.scene && Array.isArray(diff.scene.characters)) {
    state.scene.characters = diff.scene.characters.slice();
  }

  if (diff.settings && typeof diff.settings === 'object') {
    _mergeShallow(state.settings, diff.settings,
      ['segmentLength', 'descriptiveness', 'proseStyle', 'nsfwLevel', 'choiceFrequency']);
  }

  const m = diff.memory;
  if (m && typeof m === 'object') {
    state.memory.characters = _applyMemoryCollection(state.memory.characters, m.characters, 'id', MEMORY_CAPS.characters);
    state.memory.locations  = _applyMemoryCollection(state.memory.locations,  m.locations,  'id', MEMORY_CAPS.locations);
    state.memory.items      = _applyMemoryCollection(state.memory.items,      m.items,      'id', MEMORY_CAPS.items);
    state.memory.goals      = _applyMemoryCollection(state.memory.goals,      m.goals,      'id', MEMORY_CAPS.goals);
    state.memory.lore       = _applyStringList(state.memory.lore, m.lore, MEMORY_CAPS.lore);

    // Events: append-only, storyteller emits new event entries.
    if (m.events && Array.isArray(m.events.add)) {
      for (const ev of m.events.add) {
        if (!ev || typeof ev !== 'object') continue;
        state.memory.events.push({
          turn: typeof ev.turn === 'number' ? ev.turn : turn,
          title: ev.title || '',
          description: ev.description || '',
        });
      }
      if (state.memory.events.length > MEMORY_CAPS.events) {
        state.memory.events = state.memory.events.slice(-MEMORY_CAPS.events);
      }
    }

    if (typeof m.storySummary === 'string') {
      state.memory.storySummary = m.storySummary;
      state.memory.storySummaryUpdatedTurn = turn;
    }
  }

  // Blueprint diff — the Storyteller can update progression markers
  // (currentAct, currentBeat, progress) each turn and mark fixed events
  // as triggered. Whole-blueprint replacement is intentionally NOT
  // supported here — that only happens via the dedicated
  // story:generate-blueprint pathway.
  const bp = diff.storyBlueprint;
  if (bp && typeof bp === 'object' && state.storyBlueprint && typeof state.storyBlueprint === 'object') {
    if (typeof bp.currentAct  === 'string') state.storyBlueprint.currentAct  = bp.currentAct;
    if (typeof bp.currentBeat === 'string') state.storyBlueprint.currentBeat = bp.currentBeat;
    if (typeof bp.progress    === 'number') state.storyBlueprint.progress    = Math.max(0, Math.min(1, bp.progress));

    // Chapter progression
    if (bp.chapters && typeof bp.chapters === 'object' && state.storyBlueprint.chapters) {
      if (typeof bp.chapters.currentChapter === 'number') {
        const total = state.storyBlueprint.chapters.total || (state.storyBlueprint.chapters.list ? state.storyBlueprint.chapters.list.length : 1);
        state.storyBlueprint.chapters.currentChapter = Math.max(1, Math.min(total, Math.floor(bp.chapters.currentChapter)));
      }
    }

    // Fixed events: allow status transitions (pending → triggered) by id.
    if (bp.fixedEvents && Array.isArray(bp.fixedEvents.update) && Array.isArray(state.storyBlueprint.fixedEvents)) {
      for (const patch of bp.fixedEvents.update) {
        if (!patch || !patch.id) continue;
        const idx = state.storyBlueprint.fixedEvents.findIndex((e) => String(e.id) === String(patch.id));
        if (idx >= 0) state.storyBlueprint.fixedEvents[idx] = { ...state.storyBlueprint.fixedEvents[idx], ...patch };
      }
    }
    // Side characters: allow additions if a new one enters the scene.
    if (bp.sideCharacters && Array.isArray(bp.sideCharacters.add) && Array.isArray(state.storyBlueprint.sideCharacters)) {
      for (const rec of bp.sideCharacters.add) {
        if (!rec || !rec.id) continue;
        const exists = state.storyBlueprint.sideCharacters.some((c) => String(c.id) === String(rec.id));
        if (!exists) state.storyBlueprint.sideCharacters.push(rec);
      }
    }
    // Planted hints (foreshadowing): additions + status transitions
    if (bp.plantedHints && typeof bp.plantedHints === 'object') {
      if (!Array.isArray(state.storyBlueprint.plantedHints)) state.storyBlueprint.plantedHints = [];
      if (Array.isArray(bp.plantedHints.update)) {
        for (const patch of bp.plantedHints.update) {
          if (!patch || !patch.id) continue;
          const idx = state.storyBlueprint.plantedHints.findIndex((h) => String(h.id) === String(patch.id));
          if (idx >= 0) state.storyBlueprint.plantedHints[idx] = { ...state.storyBlueprint.plantedHints[idx], ...patch };
        }
      }
      if (Array.isArray(bp.plantedHints.add)) {
        for (const rec of bp.plantedHints.add) {
          if (!rec || !rec.id) continue;
          const exists = state.storyBlueprint.plantedHints.some((h) => String(h.id) === String(rec.id));
          if (!exists) state.storyBlueprint.plantedHints.push(rec);
        }
      }
    }

    // Events (STORY_GUIDELINES_PATCH §3.2). Pacing atoms. The Storyteller
    // marks the active event as resolved via events.update; the engine
    // promotes the next pending event afterwards (see processEventTransitions).
    if (bp.events && typeof bp.events === 'object' && !Array.isArray(bp.events)) {
      if (!Array.isArray(state.storyBlueprint.events)) state.storyBlueprint.events = [];
      if (Array.isArray(bp.events.remove)) {
        const rm = new Set(bp.events.remove.map(String));
        state.storyBlueprint.events = state.storyBlueprint.events.filter((e) => !rm.has(String(e.id)));
      }
      if (Array.isArray(bp.events.update)) {
        for (const patch of bp.events.update) {
          if (!patch || !patch.id) continue;
          const idx = state.storyBlueprint.events.findIndex((e) => String(e.id) === String(patch.id));
          if (idx >= 0) state.storyBlueprint.events[idx] = { ...state.storyBlueprint.events[idx], ...patch };
        }
      }
      if (Array.isArray(bp.events.add)) {
        for (const rec of bp.events.add) {
          if (!rec || !rec.id) continue;
          const exists = state.storyBlueprint.events.some((e) => String(e.id) === String(rec.id));
          if (!exists) {
            state.storyBlueprint.events.push({
              status:       'pending',
              sectionsUsed: 0,
              sectionBudget: 2,
              ...rec,
            });
          }
        }
      }
    }

    // Chapter summaries + event summaries — read-only during runtime except
    // via targeted updates. The Storyteller may retcon a summary via
    // chapterSummaries.update / eventSummaries.update in the [STATE] block.
    if (bp.chapterSummaries && typeof bp.chapterSummaries === 'object' && !Array.isArray(bp.chapterSummaries)) {
      if (!Array.isArray(state.storyBlueprint.chapterSummaries)) state.storyBlueprint.chapterSummaries = [];
      if (Array.isArray(bp.chapterSummaries.update)) {
        for (const patch of bp.chapterSummaries.update) {
          if (!patch || typeof patch.chapterNumber !== 'number') continue;
          const idx = state.storyBlueprint.chapterSummaries.findIndex((s) => s.chapterNumber === patch.chapterNumber);
          if (idx >= 0) state.storyBlueprint.chapterSummaries[idx] = { ...state.storyBlueprint.chapterSummaries[idx], ...patch };
        }
      }
    }
    if (bp.eventSummaries && typeof bp.eventSummaries === 'object' && !Array.isArray(bp.eventSummaries)) {
      if (!Array.isArray(state.storyBlueprint.eventSummaries)) state.storyBlueprint.eventSummaries = [];
      if (Array.isArray(bp.eventSummaries.update)) {
        for (const patch of bp.eventSummaries.update) {
          if (!patch || !patch.id) continue;
          const idx = state.storyBlueprint.eventSummaries.findIndex((s) => s.id === patch.id);
          if (idx >= 0) state.storyBlueprint.eventSummaries[idx] = { ...state.storyBlueprint.eventSummaries[idx], ...patch };
        }
      }
    }

    // storyOverview — rare mid-story updates (retcon). Full replace when set.
    if (bp.storyOverview && typeof bp.storyOverview === 'object') {
      state.storyBlueprint.storyOverview = { ...(state.storyBlueprint.storyOverview || {}), ...bp.storyOverview };
    }
  }

  // storyLength — updates via top-level diff. targetSections may grow via
  // [REPORT] story_overrun; preset only changes via explicit user re-pick.
  if (diff.storyLength && typeof diff.storyLength === 'object' && state.storyLength) {
    if (typeof diff.storyLength.targetSections === 'number') {
      state.storyLength.targetSections = Math.max(1, Math.floor(diff.storyLength.targetSections));
    }
    if (typeof diff.storyLength.preset === 'string') {
      state.storyLength = _resolveStoryLength(diff.storyLength.preset);
    }
  }
}

// ── State summary (for Ask-Storyteller prompt) ────────────────────────────

function formatStateSummary(state) {
  if (!state) return '(no active story)';
  const lines = [];
  lines.push(`Title: ${state.title}`);
  lines.push(`Type: ${state.storyTypeLabel || state.storyType}`);
  lines.push(`Turn: ${state.turnCount}`);
  const mc = state.mainCharacter || {};
  lines.push(`Main character: ${mc.name || '(unnamed)'} — ${mc.gender || '(gender unset)'}`);
  if (mc.background) lines.push(`  Background: ${mc.background}`);
  const sc = state.scene || {};
  lines.push(`Scene: ${sc.name || '(unnamed)'}${sc.location ? ' @ ' + sc.location : ''}${sc.time ? ' — ' + sc.time : ''}`);
  if (sc.situation) lines.push(`  Situation: ${sc.situation}`);
  if (state.memory.storySummary) {
    lines.push('');
    lines.push('Story so far:');
    lines.push(state.memory.storySummary);
  }
  const goals = (state.memory.goals || []).filter((g) => g.status === 'active');
  if (goals.length) {
    lines.push('');
    lines.push('Active goals:');
    for (const g of goals) lines.push(`  • ${g.title}${g.description ? ' — ' + g.description : ''}`);
  }
  return lines.join('\n');
}

// ── Module exports ────────────────────────────────────────────────────────

module.exports = {
  // catalogs
  STORY_TYPES,
  SEGMENT_LENGTHS,
  CHOICE_FREQUENCIES,
  NSFW_LEVELS,
  STORY_LENGTHS,
  DEFAULT_SETTINGS,
  MEMORY_CAPS,
  // paths
  ensureRoot,
  // list / create / delete / rename
  listStories,
  createStory,
  deleteStory,
  renameStory,
  // state
  loadState,
  saveState,
  applyStateDiff,
  formatStateSummary,
  // log
  loadLog,
  saveLog,
  appendLog,
  // storyteller-chat
  loadStorytellerChat,
  saveStorytellerChat,
  appendStorytellerChat,
  clearStorytellerChat,
  // companion-chat
  loadCompanionChat,
  saveCompanionChat,
  appendCompanionChat,
  clearCompanionChat,
  // reactions
  loadReactions,
  appendReaction,
  // bookmarks
  loadBookmarks,
  toggleBookmark,
  // annotations
  loadAnnotations,
  upsertAnnotation,
  // stats + export
  computeStats,
  exportProse,
  // portraits
  listPortraits,
  setPortrait,
  clearPortrait,
  // debug
  loadDebugResponses,
  appendDebugResponse,
  lastDebugResponseByPhase,
  // reports + pacing lifecycle (STORY_GUIDELINES_PATCH)
  loadReports,
  appendReport,
  bumpSectionCounters,
  processEventTransitions,
  applyReportToBudget,
  activeEvent,
  _resolveStoryLength,
  // chapter helper (exposed for the blueprint IPC's post-parse fallback)
  _deriveChaptersFromBeats,
  // internal helpers (exposed for tests / future use)
  _storyDir,
  _statePath,
};
