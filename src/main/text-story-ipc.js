// Text-Story IPC + Storyteller bridge.
//
// Owns:
//   story:list                — list all stories in stories/ folder
//   story:get                 — load one story by slug (state + log)
//   story:create              — new story (writes folder + files)
//   story:delete              — nuke a story folder
//   story:rename              — rename (updates title + slug)
//   story:update-settings     — patch settings on the fly
//   story:take-turn           — main narrator turn (single-phase)
//   story:retry-turn          — nudge storyteller to re-emit if last turn failed
//   story:ask                 — Ask Storyteller (side chat, may include state corrections)
//   story:ask-history         — fetch Ask Storyteller transcript
//   story:ask-clear           — wipe Ask Storyteller transcript
//   story:catalogs            — return the STORY_TYPES / SEGMENT_LENGTHS / etc.
//                               so the UI doesn't have to duplicate them
//
// Each turn is ONE call to claude.exe with a big system prompt. No Aria
// context whatsoever. No sendToClaude() — we spawn the CLI directly with a
// dedicated system-prompt file so nothing companion-related leaks in.

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const store = require('./text-story-store');
const {
  buildTurnPrompt,
  buildBlueprintPrompt,
  buildDetailsPrompt,
  buildAskStorytellerPrompt,
  buildCompanionChatContext,
  buildCompanionReactionContext,
  buildCompanionSuggestChoiceContext,
  buildSummarizeOldLogPrompt,
  // Pacing / planning setup chain (STORY_GUIDELINES_PATCH §4)
  buildStoryOverviewPrompt,
  buildChapterSkeletonPrompt,
  buildEventSkeletonPrompt,
  buildEventSummariesPrompt,
} = require('./text-story-rules');
const { sendToClaude } = require('./claude-bridge');
const musicEngine      = require('./music-engine');
const { dialog } = require('electron');

// ── Claude CLI resolution (mirrors claude-bridge.js so Story mode doesn't
//    have to depend on that module) ──────────────────────────────────────────

let _resolved = null;
function resolveClaudeSpawn() {
  if (_resolved) return _resolved;
  if (process.platform === 'win32') {
    try {
      const cmdPath = execSync('where claude.cmd', { shell: true })
        .toString().trim().split(/\r?\n/)[0].trim();
      const cmdDir = path.dirname(cmdPath);
      const scriptPath = path.join(cmdDir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
      if (fs.existsSync(scriptPath)) {
        _resolved = { cmd: 'node', prefix: [scriptPath] };
        return _resolved;
      }
    } catch (e) {
      console.warn('[TextStory] could not auto-resolve claude script:', e.message);
    }
    _resolved = { cmd: 'claude.cmd', prefix: [], shell: true };
  } else {
    _resolved = { cmd: 'claude', prefix: [], shell: false };
  }
  return _resolved;
}

function _cleanEnv() {
  const e = { ...process.env };
  delete e.ELECTRON_RUN_AS_NODE;
  delete e.ELECTRON_NO_ASAR;
  delete e.ELECTRON_RESOURCES_PATH;
  delete e.VSCODE_PID;
  delete e.VSCODE_IPC_HOOK;
  delete e.VSCODE_HANDLES_UNCAUGHT_ERRORS;
  delete e.VSCODE_NLS_CONFIG;
  return e;
}

// ── Direct Claude call ───────────────────────────────────────────────────
//
// Writes system prompt to a tmp file, streams a user message in, collects
// the raw assistant text. Uses stream-json IO like runGmStateAgent().

function _extractRawText(stdout) {
  // Each line is a stream-json event; the assistant text is inside events
  // whose type === 'assistant', in message.content[i].text.
  const out = [];
  const lines = String(stdout || '').split(/\r?\n/);
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    let obj = null;
    try { obj = JSON.parse(l); } catch { continue; }
    if (!obj) continue;
    if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
      for (const c of obj.message.content) {
        if (c && c.type === 'text' && typeof c.text === 'string') out.push(c.text);
      }
    } else if (obj.type === 'result' && typeof obj.result === 'string') {
      out.push(obj.result);
    }
  }
  return out.join('');
}

async function callStoryteller({ systemPrompt, userPrompt, model, timeoutMs = 240000 }) {
  const { cmd, prefix, shell } = resolveClaudeSpawn();
  const sysTmpPath = path.join(os.tmpdir(), `cc_story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`);
  fs.writeFileSync(sysTmpPath, systemPrompt, 'utf8');

  return new Promise((resolve, reject) => {
    const _cleanup = () => { try { fs.unlinkSync(sysTmpPath); } catch {} };

    const args = [
      ...prefix,
      '--input-format',  'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--system-prompt-file', sysTmpPath,
      '--dangerously-skip-permissions',
    ];
    if (model) { args.push('--model', model); }

    const proc = spawn(cmd, args, {
      env: _cleanEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(shell ? { shell: true } : {}),
    });

    proc.stdin.on('error', () => {});
    const msg = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: userPrompt }] },
    }) + '\n';
    proc.stdin.write(msg, () => proc.stdin.end());

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c.toString(); });
    proc.stderr.on('data', (c) => { stderr += c.toString(); });

    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      _cleanup();
      reject(new Error('Storyteller call timed out'));
    }, timeoutMs);

    proc.on('close', () => {
      clearTimeout(timer);
      _cleanup();
      try {
        const raw = _extractRawText(stdout) || stdout.trim();
        resolve({ raw, stderr });
      } catch (e) {
        reject(e);
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      _cleanup();
      reject(err);
    });
  });
}

// ── Response parsing ──────────────────────────────────────────────────────

function _extractBlock(raw, tag, fallbackBoundaries) {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
  const m = raw.match(re);
  if (m) return { value: m[1].trim(), residue: raw.replace(m[0], '').trim() };
  // Fallback — the opener exists but the closer was omitted (a real Claude
  // failure mode). Extract everything from the opener up to the earliest
  // occurrence of any known sibling tag, or to end-of-string.
  if (Array.isArray(fallbackBoundaries) && fallbackBoundaries.length) {
    const openRe = new RegExp(`\\[${tag}\\]`, 'i');
    const openMatch = raw.match(openRe);
    if (!openMatch) return { value: null, residue: raw };
    const openIdx = openMatch.index;
    const afterOpen = openIdx + openMatch[0].length;
    // Find the earliest boundary tag position AFTER the opener
    let endIdx = raw.length;
    for (const b of fallbackBoundaries) {
      const bRe = new RegExp(`\\[${b}\\]`, 'i');
      const bMatch = raw.slice(afterOpen).match(bRe);
      if (bMatch) {
        const abs = afterOpen + bMatch.index;
        if (abs < endIdx) endIdx = abs;
      }
    }
    const value = raw.slice(afterOpen, endIdx).trim();
    if (!value) return { value: null, residue: raw };
    const residue = (raw.slice(0, openIdx) + raw.slice(endIdx)).trim();
    return { value, residue };
  }
  return { value: null, residue: raw };
}

function _extractLine(raw, tag) {
  const re = new RegExp(`^[ \\t]*\\[${tag}\\][ \\t]*(.+?)[ \\t]*$`, 'mi');
  const m = raw.match(re);
  if (!m) return { value: null, residue: raw };
  return { value: m[1].trim(), residue: raw.replace(m[0], '').trim() };
}

function _safeJsonParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  // Fenced code block?
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  // Some models leak a trailing comma before ] or }. Try to fix it.
  try {
    const cleaned = s.replace(/,(\s*[\]}])/g, '$1');
    return JSON.parse(cleaned);
  } catch {}
  return null;
}

// Scrub markdown emphasis, leaked closers, and stray XML-ish tags from prose.
// Also handle the case where a duplicated response body leaks a second
// [STORY] / [STATE] / [CHOICES] / [MUSIC] / [SCENE] opener inside the prose —
// trim everything from the first stray opener onward, since content past
// that point is the start of a spurious duplicate emit.
function _scrubProse(s) {
  if (!s) return '';
  let out = String(s);
  // If a stray structural opener appears in the middle of the prose, cut
  // it off there — that marks the start of a duplicate response body.
  const stray = out.search(/\[(STORY|STATE|CHOICES|MUSIC|SCENE)\]/i);
  if (stray > 0) out = out.slice(0, stray);
  // Strip **bold** and *italic* pairs (markdown), keep the inner text.
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
  out = out.replace(/\*([^*\n]+)\*/g, '$1');
  // Strip stray [/TAG] closers (any).
  out = out.replace(/\[\/[A-Za-z_]+\]/g, '');
  // Strip any leaked <thinking>...</thinking> blocks.
  out = out.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  return out;
}

// Parse the [REPORT] block. Free-form key/value pairs, one per line.
// Returns null when no block is present, or an object with the parsed fields.
// See STORY_GUIDELINES_PATCH §6.1 for the schema.
function _parseReportBlock(rawBlockText) {
  if (!rawBlockText) return null;
  const out = {};
  const lines = String(rawBlockText).split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    // Strip wrapping quotes on the value
    const q = val.match(/^"(.*)"$/);
    if (q) val = q[1];
    // Coerce integers on known-numeric fields
    if (key === 'original_budget' || key === 'requested_new_budget') {
      const n = parseInt(val, 10);
      out[key] = Number.isFinite(n) ? n : val;
    } else {
      out[key] = val;
    }
  }
  return Object.keys(out).length ? out : null;
}

function parseTurnResponse(raw) {
  // Order matters — extract choices first (it's the deepest tail block),
  // then state, then story, then scene line. Everything left over gets
  // treated as "prose bleed" and logged for debugging.
  let residue = raw || '';

  // REPORT block — extract first so it doesn't contaminate STORY parsing.
  const report = _extractBlock(residue, 'REPORT');
  residue = report.residue;

  const music = _extractLine(residue, 'MUSIC');
  residue = music.residue;

  const choices = _extractBlock(residue, 'CHOICES');
  residue = choices.residue;

  const state = _extractBlock(residue, 'STATE');
  residue = state.residue;

  // STORY block: robust fallback — Claude occasionally omits the [/STORY]
  // closer AND sometimes emits the entire response twice. Boundaries
  // include STORY itself so a duplicate second copy terminates the
  // extraction of the first.
  const story = _extractBlock(residue, 'STORY', ['STORY', 'STATE', 'CHOICES', 'MUSIC', 'SCENE']);
  residue = story.residue;

  const scene = _extractLine(residue, 'SCENE');
  residue = scene.residue;

  let stateDiff = null;
  if (state.value) stateDiff = _safeJsonParse(state.value);

  let choiceList = null;
  if (choices.value) {
    const parsed = _safeJsonParse(choices.value);
    if (Array.isArray(parsed)) {
      choiceList = parsed
        .map((c) => (typeof c === 'string' ? c : (c && c.text) || ''))
        .filter(Boolean);
    }
  }

  return {
    scene:     scene.value || null,
    story:     _scrubProse(story.value),
    stateDiff,
    choices:   choiceList,
    music:     music.value || null,
    report:    _parseReportBlock(report.value),
    residue,
  };
}

// Ask-Storyteller response has a plain-prose body + optional [STATE] block.
function parseAskResponse(raw) {
  let residue = raw || '';
  const state = _extractBlock(residue, 'STATE');
  residue = state.residue;
  const body = _scrubProse(residue).trim();
  let stateDiff = null;
  if (state.value) stateDiff = _safeJsonParse(state.value);
  return { body, stateDiff };
}

// ── Validation ─────────────────────────────────────────────────────────────

function validateTurn(parsed) {
  const fatal = [];
  const warnings = [];
  if (!parsed.story || parsed.story.length < 20) {
    fatal.push('Missing or empty [STORY] block');
  }
  if (!parsed.scene) warnings.push('Missing [SCENE] line');
  if (!parsed.stateDiff) warnings.push('Missing or unparseable [STATE] block');
  return { valid: fatal.length === 0, fatal, warnings };
}

// ── IPC registration ──────────────────────────────────────────────────────

function register({ ipcMain, mainWindow, storiesRoot, getCharacterContext, characterDir }) {
  if (!ipcMain || !storiesRoot) {
    console.warn('[TextStory] register called without ipcMain or storiesRoot — skipping.');
    return;
  }
  store.ensureRoot(storiesRoot);

  // Verbose diagnostic — this log shows up in the Electron main-process console.
  console.log('[TextStory] IPC registered. storiesRoot =', storiesRoot);

  // Catalogs (story types, segment lengths, etc.) — a single call for the UI.
  ipcMain.handle('story:catalogs', () => ({
    storyTypes:       store.STORY_TYPES,
    segmentLengths:   store.SEGMENT_LENGTHS,
    choiceFrequencies: store.CHOICE_FREQUENCIES,
    nsfwLevels:       store.NSFW_LEVELS,
    storyLengths:     store.STORY_LENGTHS,   // STORY_GUIDELINES_PATCH §3.3.2
    defaults:         store.DEFAULT_SETTINGS,
  }));

  ipcMain.handle('story:list', () => {
    return { stories: store.listStories(storiesRoot) };
  });

  ipcMain.handle('story:get', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    if (!fs.existsSync(dir)) return { success: false, error: 'Story not found.' };
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story state could not be loaded.' };
    const log = store.loadLog(dir);
    return { success: true, state, log };
  });

  ipcMain.handle('story:create', (_e, opts = {}) => {
    const { title, storyType, storyTypeLabel, startingContext, mainCharacter, settings, storyLength } = opts;
    try {
      const { slug, state } = store.createStory(storiesRoot, {
        title: title || 'Untitled Story',
        storyType,
        storyTypeLabel,
        startingContext,
        mainCharacter,
        settings,
        storyLength,   // preset slug — resolved by the store
      });
      return { success: true, slug, state, log: [] };
    } catch (e) {
      console.warn('[TextStory] create failed:', e.message);
      return { success: false, error: e.message };
    }
  });

  // ── Blueprint generation ────────────────────────────────────────────
  // Fires ONCE after story creation (renderer calls it before the opening
  // turn). Storyteller designs the entire plot arc as a canonical JSON
  // blueprint which then travels in every subsequent turn's prompt.
  // Also backfills state.title if the wizard left it blank.
  ipcMain.handle('story:generate-blueprint', async (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };

    // If a blueprint already exists, don't regenerate — the caller should
    // only invoke this once. Return the existing one.
    if (state.storyBlueprint) {
      return { success: true, state, cached: true };
    }

    const { system, user } = buildBlueprintPrompt(state);

    let raw = '';
    try {
      const res = await callStoryteller({ systemPrompt: system, userPrompt: user });
      raw = res.raw || '';
    } catch (err) {
      console.warn('[TextStory] Blueprint call failed:', err.message);
      try {
        store.appendDebugResponse(dir, {
          phase: 'blueprint',
          userMessage: user,
          systemPrompt: system,
          userPrompt:   user,
          raw: '',
          meta: { error: err.message },
        });
      } catch {}
      return { success: false, error: 'Blueprint call failed: ' + err.message };
    }

    // Parse [BLUEPRINT] JSON
    const block = _extractBlock(raw, 'BLUEPRINT');
    const bp    = _safeJsonParse(block.value);

    try {
      store.appendDebugResponse(dir, {
        phase: 'blueprint',
        userMessage: user,
        systemPrompt: system,
        userPrompt:   user,
        raw,
        meta: {
          parsedOk: !!bp,
          hasKeyChars:   !!(bp && Array.isArray(bp.keyCharacters) && bp.keyCharacters.length),
          hasFixedEvts:  !!(bp && Array.isArray(bp.fixedEvents)   && bp.fixedEvents.length),
          hasArc:        !!(bp && bp.arc && typeof bp.arc === 'object'),
          hasChapters:   !!(bp && bp.chapters && Array.isArray(bp.chapters.list) && bp.chapters.list.length),
          titleFromBP:   bp && bp.title,
        },
      });
    } catch {}

    if (!bp || typeof bp !== 'object') {
      return {
        success: false,
        error: 'Storyteller did not return a valid [BLUEPRINT] JSON block. Retry from the library.',
        rawPreview: (raw || '').slice(0, 500),
      };
    }

    // Backfill title on the state if the wizard left it blank
    // (or if user picked the placeholder "Untitled Story").
    if ((!state.title || state.title === 'Untitled Story') && typeof bp.title === 'string' && bp.title.trim()) {
      state.title = bp.title.trim();
    }
    // Backfill main character if wizard left blank
    if (bp.mainCharacter && typeof bp.mainCharacter === 'object') {
      const mc = state.mainCharacter || {};
      if (!mc.name        && bp.mainCharacter.name)        mc.name        = bp.mainCharacter.name;
      if (!mc.gender      && bp.mainCharacter.gender)      mc.gender      = bp.mainCharacter.gender;
      if (!mc.background  && bp.mainCharacter.background)  mc.background  = bp.mainCharacter.background;
      if (!mc.appearance  && bp.mainCharacter.appearance)  mc.appearance  = bp.mainCharacter.appearance;
      if (!mc.personality && bp.mainCharacter.personality) mc.personality = bp.mainCharacter.personality;
      state.mainCharacter = mc;
    }

    // Normalize + persist the blueprint (strip mainCharacter — it lives on state.mainCharacter now)
    const cleanBp = { ...bp };
    delete cleanBp.mainCharacter;
    delete cleanBp.title;   // title is on state, not on blueprint
    // Sane defaults
    if (typeof cleanBp.progress    !== 'number') cleanBp.progress    = 0;
    if (typeof cleanBp.currentAct  !== 'string') cleanBp.currentAct  = 'beginning';
    if (typeof cleanBp.currentBeat !== 'string') cleanBp.currentBeat = 'opening';
    // Chapters: fall back to derivation from beats if Storyteller didn't emit them
    if (!cleanBp.chapters || !Array.isArray(cleanBp.chapters.list) || cleanBp.chapters.list.length === 0) {
      cleanBp.chapters = store._deriveChaptersFromBeats(cleanBp);
    }
    if (typeof cleanBp.chapters.currentChapter !== 'number' || cleanBp.chapters.currentChapter < 1) {
      cleanBp.chapters.currentChapter = 1;
    }
    if (typeof cleanBp.chapters.total !== 'number') {
      cleanBp.chapters.total = cleanBp.chapters.list.length || 1;
    }
    // Backfill sectionBudget on each chapter. If Claude didn't specify, split
    // the storyLength target evenly across the chapters as a default.
    const defaultChapterBudget = Math.max(
      1,
      Math.round(((state.storyLength && state.storyLength.targetSections) || 180) / (cleanBp.chapters.list.length || 1))
    );
    for (const ch of cleanBp.chapters.list) {
      if (typeof ch.sectionBudget !== 'number' || ch.sectionBudget < 1) ch.sectionBudget = defaultChapterBudget;
      if (typeof ch.sectionsUsed  !== 'number') ch.sectionsUsed = 0;
    }
    // Initialize STORY_GUIDELINES_PATCH containers (populated by later setup calls).
    if (!cleanBp.storyOverview)                       cleanBp.storyOverview     = null;
    if (!Array.isArray(cleanBp.chapterSummaries))     cleanBp.chapterSummaries  = [];
    if (!Array.isArray(cleanBp.eventSummaries))       cleanBp.eventSummaries    = [];
    if (!Array.isArray(cleanBp.events))               cleanBp.events            = [];
    state.storyBlueprint = cleanBp;

    store.saveState(dir, state);
    return { success: true, state };
  });

  // ── Pacing/planning setup chain (STORY_GUIDELINES_PATCH §4) ──────────
  //
  // Stage 2: STORY OVERVIEW — the core. Exhaustively detailed. One call.
  // Stage 3: CHAPTER SKELETON — per-chapter summaries with sectionBudget +
  //          connective tissue. One call for the whole chapter list.
  // Stage 5: EVENT SKELETON — for each chapter, 2–5 events. One call per
  //          chapter (12 chapters → 12 calls).
  // Stage 6: EVENT SUMMARIES — per-event broad summaries. Batched (2 per call).
  //
  // Each handler is independent — the renderer chains them and shows
  // progress. If a batch fails, only that batch retries; every other
  // batch's saved output survives.

  ipcMain.handle('story:generate-story-overview', async (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state || !state.storyBlueprint) return { success: false, error: 'Blueprint must exist first.' };

    const { system, user } = buildStoryOverviewPrompt(state);
    let raw = '';
    try {
      const res = await callStoryteller({ systemPrompt: system, userPrompt: user });
      raw = res.raw || '';
    } catch (err) {
      try { store.appendDebugResponse(dir, { phase: 'story-overview', systemPrompt: system, userPrompt: user, raw: '', meta: { error: err.message } }); } catch {}
      return { success: false, error: 'Story-overview call failed: ' + err.message };
    }
    const block = _extractBlock(raw, 'STORY_OVERVIEW');
    const ov = _safeJsonParse(block.value);
    try {
      store.appendDebugResponse(dir, { phase: 'story-overview', systemPrompt: system, userPrompt: user, raw, meta: { parsedOk: !!ov } });
    } catch {}
    if (!ov || typeof ov !== 'object') return { success: false, error: 'Story-overview parse failed.', rawPreview: (raw || '').slice(0, 500) };
    state.storyBlueprint.storyOverview = ov;
    store.saveState(dir, state);
    return { success: true, storyOverview: ov, state };
  });

  ipcMain.handle('story:generate-chapter-skeleton', async (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state || !state.storyBlueprint) return { success: false, error: 'Blueprint must exist first.' };

    const { system, user } = buildChapterSkeletonPrompt(state);
    let raw = '';
    try {
      const res = await callStoryteller({ systemPrompt: system, userPrompt: user });
      raw = res.raw || '';
    } catch (err) {
      try { store.appendDebugResponse(dir, { phase: 'chapter-skeleton', systemPrompt: system, userPrompt: user, raw: '', meta: { error: err.message } }); } catch {}
      return { success: false, error: 'Chapter-skeleton call failed: ' + err.message };
    }
    const block = _extractBlock(raw, 'CHAPTER_SKELETON');
    const parsed = _safeJsonParse(block.value);
    try {
      store.appendDebugResponse(dir, { phase: 'chapter-skeleton', systemPrompt: system, userPrompt: user, raw, meta: { parsedOk: !!parsed, count: parsed && Array.isArray(parsed.chapterSummaries) ? parsed.chapterSummaries.length : 0 } });
    } catch {}
    if (!parsed || !Array.isArray(parsed.chapterSummaries)) return { success: false, error: 'Chapter-skeleton parse failed.', rawPreview: (raw || '').slice(0, 500) };

    // Persist chapter summaries + push sectionBudget back onto the chapter list.
    state.storyBlueprint.chapterSummaries = parsed.chapterSummaries;
    if (state.storyBlueprint.chapters && Array.isArray(state.storyBlueprint.chapters.list)) {
      for (const s of parsed.chapterSummaries) {
        const ch = state.storyBlueprint.chapters.list.find((c) => c.number === s.chapterNumber);
        if (ch && typeof s.sectionBudget === 'number') ch.sectionBudget = s.sectionBudget;
      }
    }
    store.saveState(dir, state);
    return { success: true, chapterSummaries: parsed.chapterSummaries, state };
  });

  ipcMain.handle('story:generate-event-skeleton', async (_e, { slug, chapterNumber } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const ch = Math.max(1, parseInt(chapterNumber, 10) || 1);
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state || !state.storyBlueprint) return { success: false, error: 'Blueprint must exist first.' };

    const { system, user } = buildEventSkeletonPrompt(state, ch);
    let raw = '';
    try {
      const res = await callStoryteller({ systemPrompt: system, userPrompt: user });
      raw = res.raw || '';
    } catch (err) {
      try { store.appendDebugResponse(dir, { phase: 'event-skeleton', systemPrompt: system, userPrompt: user, raw: '', meta: { chapter: ch, error: err.message } }); } catch {}
      return { success: false, error: 'Event-skeleton call failed: ' + err.message };
    }
    const block = _extractBlock(raw, 'EVENT_SKELETON');
    const parsed = _safeJsonParse(block.value);
    try {
      store.appendDebugResponse(dir, { phase: 'event-skeleton', systemPrompt: system, userPrompt: user, raw, meta: { chapter: ch, parsedOk: !!parsed, count: parsed && Array.isArray(parsed.events) ? parsed.events.length : 0 } });
    } catch {}
    if (!parsed || !Array.isArray(parsed.events)) return { success: false, error: 'Event-skeleton parse failed.', rawPreview: (raw || '').slice(0, 500) };

    // Merge events for this chapter into the blueprint. Prior events for
    // this chapter get replaced; other chapters' events are preserved.
    if (!Array.isArray(state.storyBlueprint.events)) state.storyBlueprint.events = [];
    state.storyBlueprint.events = state.storyBlueprint.events.filter((e) => (e.chapterNumber || 0) !== ch);
    for (const ev of parsed.events) {
      if (!ev || !ev.id) continue;
      state.storyBlueprint.events.push({
        status:       'pending',
        sectionsUsed: 0,
        sectionBudget: 2,
        ...ev,
        chapterNumber: ch,
      });
    }
    // If this is chapter 1 and no event is active anywhere, activate the first.
    if (ch === 1 && !state.storyBlueprint.events.some((e) => e.status === 'active')) {
      const first = state.storyBlueprint.events
        .filter((e) => (e.chapterNumber || 0) === 1)
        .sort((a, b) => (a.orderInChapter || 0) - (b.orderInChapter || 0))[0];
      if (first) first.status = 'active';
    }
    store.saveState(dir, state);
    return { success: true, events: parsed.events, state };
  });

  ipcMain.handle('story:generate-event-summaries', async (_e, { slug, eventIds } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    if (!Array.isArray(eventIds) || !eventIds.length) return { success: false, error: 'eventIds is required.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state || !state.storyBlueprint) return { success: false, error: 'Blueprint must exist first.' };

    const { system, user } = buildEventSummariesPrompt(state, eventIds);
    let raw = '';
    try {
      const res = await callStoryteller({ systemPrompt: system, userPrompt: user });
      raw = res.raw || '';
    } catch (err) {
      try { store.appendDebugResponse(dir, { phase: 'event-summaries', systemPrompt: system, userPrompt: user, raw: '', meta: { eventIds, error: err.message } }); } catch {}
      return { success: false, error: 'Event-summaries call failed: ' + err.message };
    }
    const block = _extractBlock(raw, 'EVENT_SUMMARIES');
    const parsed = _safeJsonParse(block.value);
    try {
      store.appendDebugResponse(dir, { phase: 'event-summaries', systemPrompt: system, userPrompt: user, raw, meta: { eventIds, parsedOk: !!parsed, count: parsed && Array.isArray(parsed.eventSummaries) ? parsed.eventSummaries.length : 0 } });
    } catch {}
    if (!parsed || !Array.isArray(parsed.eventSummaries)) return { success: false, error: 'Event-summaries parse failed.', rawPreview: (raw || '').slice(0, 500) };

    // Merge — replace existing summaries by id, add new ones.
    if (!Array.isArray(state.storyBlueprint.eventSummaries)) state.storyBlueprint.eventSummaries = [];
    for (const s of parsed.eventSummaries) {
      if (!s || !s.id) continue;
      const idx = state.storyBlueprint.eventSummaries.findIndex((x) => x.id === s.id);
      if (idx >= 0) state.storyBlueprint.eventSummaries[idx] = s;
      else          state.storyBlueprint.eventSummaries.push(s);
    }
    store.saveState(dir, state);
    return { success: true, eventSummaries: parsed.eventSummaries, state };
  });

  ipcMain.handle('story:reports', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    if (!fs.existsSync(dir)) return { success: false, error: 'Story not found.' };
    return { success: true, reports: store.loadReports(dir) };
  });

  // ── Details generation ──────────────────────────────────────────────
  // Second-pass call: takes the current blueprint and generates deep
  // details for every character (visual desc, outfits, quirks, health,
  // relationships, 4× AI prompts) and every chapter (expanded summary,
  // characters involved, leadsFrom/leadsTo, key events, importance).
  //
  // Called automatically for new stories after blueprint, and for existing
  // stories on first open if state.storyBlueprint.characterDetails is
  // missing. Idempotent: passing { force: true } regenerates; otherwise
  // returns the cached details.
  ipcMain.handle('story:generate-details', async (_e, { slug, force } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    if (!state.storyBlueprint) return { success: false, error: 'Story has no blueprint yet — generate blueprint first.' };

    // Idempotency check
    const bp = state.storyBlueprint;
    if (!force
        && Array.isArray(bp.characterDetails) && bp.characterDetails.length
        && Array.isArray(bp.chapterDetails)   && bp.chapterDetails.length) {
      return { success: true, state, cached: true };
    }

    // Strategy:
    //   • Character bible is generated in BATCHES OF 3 characters per call.
    //     For 12 characters that's 4 calls, each producing ~7500 tokens of
    //     output (~90s per call) — well under any timeout. Each batch saves
    //     incrementally so a mid-run failure doesn't lose completed batches.
    //   • Chapter breakdown is one call (already survives its own timeout —
    //     verified in the wild at ~130KB of output).
    // Progress messages get sent to the renderer so the busy overlay can
    // show which batch is currently running.
    const CHAR_BATCH = 3;

    function _emitPhaseProgress(label) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        try { mainWindow.webContents.send('story:details-progress', { label }); } catch {}
      }
    }

    async function _runOneCharacterBatch(batchIds, batchIndex, batchCount) {
      const { system, user } = buildDetailsPrompt(state, { scope: 'characters', characterIds: batchIds });
      const label = `Character batch ${batchIndex + 1} of ${batchCount} (${batchIds.length} chars)`;
      _emitPhaseProgress(label);
      try {
        const res = await callStoryteller({ systemPrompt: system, userPrompt: user, timeoutMs: 300000 });
        const raw = res.raw || '';
        const block = _extractBlock(raw, 'DETAILS');
        const det   = _safeJsonParse(block.value);
        try {
          store.appendDebugResponse(dir, {
            phase: 'details',
            userMessage: user,
            systemPrompt: system,
            userPrompt:   user,
            raw,
            meta: {
              scope: 'characters',
              batchIndex,
              batchCount,
              batchIds,
              parsedOk: !!det,
              charDetailsCount: det && Array.isArray(det.characterDetails) ? det.characterDetails.length : 0,
            },
          });
        } catch {}
        if (!det || !Array.isArray(det.characterDetails)) {
          return { ok: false, error: label + ' — no valid characterDetails returned', rawPreview: (raw || '').slice(0, 300) };
        }
        // Merge in — de-dupe by id so re-running doesn't create duplicates
        if (!Array.isArray(state.storyBlueprint.characterDetails)) state.storyBlueprint.characterDetails = [];
        const existingById = new Map(state.storyBlueprint.characterDetails.map((c) => [c.id, c]));
        for (const c of det.characterDetails) {
          if (!c || !c.id) continue;
          existingById.set(c.id, c);
        }
        state.storyBlueprint.characterDetails = Array.from(existingById.values());
        store.saveState(dir, state);
        return { ok: true, count: det.characterDetails.length };
      } catch (err) {
        try {
          store.appendDebugResponse(dir, {
            phase: 'details',
            userMessage: user,
            systemPrompt: system,
            userPrompt:   user,
            raw: '',
            meta: { scope: 'characters', batchIndex, batchIds, error: err.message },
          });
        } catch {}
        return { ok: false, error: label + ' — ' + err.message };
      }
    }

    async function _runChapters() {
      const { system, user } = buildDetailsPrompt(state, { scope: 'chapters' });
      _emitPhaseProgress('Chapter deep-dives (single call)');
      try {
        const res = await callStoryteller({ systemPrompt: system, userPrompt: user, timeoutMs: 600000 });
        const raw = res.raw || '';
        const block = _extractBlock(raw, 'DETAILS');
        const det   = _safeJsonParse(block.value);
        try {
          store.appendDebugResponse(dir, {
            phase: 'details',
            userMessage: user,
            systemPrompt: system,
            userPrompt:   user,
            raw,
            meta: {
              scope: 'chapters',
              parsedOk: !!det,
              chapterDetailsCount: det && Array.isArray(det.chapterDetails) ? det.chapterDetails.length : 0,
            },
          });
        } catch {}
        if (!det || !Array.isArray(det.chapterDetails)) {
          return { ok: false, error: 'Chapter details — no valid chapterDetails returned', rawPreview: (raw || '').slice(0, 300) };
        }
        state.storyBlueprint.chapterDetails = det.chapterDetails;
        store.saveState(dir, state);
        return { ok: true, count: det.chapterDetails.length };
      } catch (err) {
        try {
          store.appendDebugResponse(dir, {
            phase: 'details',
            userMessage: user,
            systemPrompt: system,
            userPrompt:   user,
            raw: '',
            meta: { scope: 'chapters', error: err.message },
          });
        } catch {}
        return { ok: false, error: 'Chapter details — ' + err.message };
      }
    }

    // Build the character id list: main character (id "main_character") first,
    // then keyCharacters, then sideCharacters.
    const charIds = ['main_character'];
    for (const c of (state.storyBlueprint.keyCharacters  || [])) if (c && c.id) charIds.push(c.id);
    for (const c of (state.storyBlueprint.sideCharacters || [])) if (c && c.id) charIds.push(c.id);
    // Skip characters that already have populated details when NOT forcing regen
    if (!force && Array.isArray(state.storyBlueprint.characterDetails) && state.storyBlueprint.characterDetails.length) {
      const done = new Set(state.storyBlueprint.characterDetails.map((c) => c && c.id).filter(Boolean));
      for (let i = charIds.length - 1; i >= 0; i--) {
        if (done.has(charIds[i])) charIds.splice(i, 1);
      }
    } else if (force) {
      // Force regen — wipe previous details so batching starts clean
      state.storyBlueprint.characterDetails = [];
    }

    // Batch characters into groups of CHAR_BATCH
    const batches = [];
    for (let i = 0; i < charIds.length; i += CHAR_BATCH) {
      batches.push(charIds.slice(i, i + CHAR_BATCH));
    }

    const batchResults = [];
    for (let i = 0; i < batches.length; i++) {
      batchResults.push(await _runOneCharacterBatch(batches[i], i, batches.length));
    }
    // Chapters: skip if we already have them and not forcing
    let chaptersRes = { ok: true, skipped: true };
    if (force || !Array.isArray(state.storyBlueprint.chapterDetails) || state.storyBlueprint.chapterDetails.length === 0) {
      chaptersRes = await _runChapters();
    }

    _emitPhaseProgress('');   // clear progress message

    const anySuccess = batchResults.some((r) => r.ok) || chaptersRes.ok;
    const anyFailure = batchResults.some((r) => !r.ok) || !chaptersRes.ok;
    if (!anySuccess) {
      return {
        success: false,
        error: 'All details calls failed. ' + [
          ...batchResults.filter((r) => !r.ok).map((r) => r.error),
          !chaptersRes.ok ? chaptersRes.error : null,
        ].filter(Boolean).join(' | '),
      };
    }
    return {
      success: true,
      state,
      partial: anyFailure,
      charBatchesOk:    batchResults.filter((r) => r.ok).length,
      charBatchesTotal: batchResults.length,
      chaptersOk:       chaptersRes.ok,
      warnings:         [
        ...batchResults.filter((r) => !r.ok).map((r) => r.error),
        !chaptersRes.ok ? chaptersRes.error : null,
      ].filter(Boolean),
    };
  });

  ipcMain.handle('story:delete', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const ok = store.deleteStory(storiesRoot, slug);
    return { success: ok };
  });

  ipcMain.handle('story:rename', (_e, { slug, title } = {}) => {
    if (!slug || !title) return { success: false, error: 'Missing slug or title.' };
    const res = store.renameStory(storiesRoot, slug, title);
    if (!res) return { success: false, error: 'Rename failed.' };
    return { success: true, slug: res.slug, state: res.state };
  });

  ipcMain.handle('story:update-settings', (_e, { slug, settings } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    state.settings = { ...state.settings, ...(settings || {}) };
    store.saveState(dir, state);
    return { success: true, state };
  });

  // ── Nudge ─────────────────────────────────────────────────────────────
  // Queue a one-shot reader directive that fires on the next turn.
  // Passing null/empty clears the pending nudge.
  ipcMain.handle('story:set-nudge', (_e, { slug, nudge } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    const clean = (typeof nudge === 'string' && nudge.trim()) ? nudge.trim() : null;
    state.pendingNudge = clean;
    store.saveState(dir, state);
    return { success: true, state };
  });

  // ── Main turn ────────────────────────────────────────────────────────
  ipcMain.handle('story:take-turn', async (_e, opts = {}) => {
    const { slug } = opts;
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    const log = store.loadLog(dir);

    const kind = opts.kind || 'freeform';
    const input = String(opts.input || '').trim();
    // Read pending nudge (set via story:set-nudge). Cleared after a
    // successful turn so it fires exactly once.
    const nudge = (typeof state.pendingNudge === 'string' && state.pendingNudge.trim()) ? state.pendingNudge.trim() : '';

    // Append the player's action to the log BEFORE we call. If the call
    // fails, at least we have a record of what they tried to do.
    if (nudge) {
      store.appendLog(dir, { kind: 'nudge', text: nudge });
    }
    if (kind === 'choice') {
      store.appendLog(dir, { kind: 'choice-taken', choice: input, idx: (opts.idx ?? null) });
    } else if (kind === 'freeform') {
      if (input) store.appendLog(dir, { kind: 'freeform', text: input });
    } else if (kind === 'continue') {
      store.appendLog(dir, { kind: 'continue' });
    }

    // Build music catalog once — small (a few KB), can go into every turn prompt
    let musicCatalog = '';
    try { musicCatalog = musicEngine.formatBibleForPrompt(); } catch {}
    const { system, user } = buildTurnPrompt(state, log, input, { kind, nudge, musicCatalog });

    let raw = '';
    let stderr = '';
    try {
      const res = await callStoryteller({ systemPrompt: system, userPrompt: user });
      raw = res.raw || '';
      stderr = res.stderr || '';
    } catch (err) {
      console.warn('[TextStory] Storyteller call failed:', err.message);
      try {
        store.appendDebugResponse(dir, {
          phase: 'turn',
          userMessage: input || '(continue)',
          systemPrompt: system,
          userPrompt:   user,
          raw: '',
          meta: { error: err.message, stderr },
        });
      } catch {}
      return { success: false, error: 'Storyteller call failed: ' + err.message };
    }

    const parsed = parseTurnResponse(raw);
    const validation = validateTurn(parsed);

    try {
      store.appendDebugResponse(dir, {
        phase: 'turn',
        userMessage: input || (kind === 'continue' ? '(continue)' : ''),
        systemPrompt: system,
        userPrompt:   user,
        raw,
        meta: {
          kind,
          valid:          validation.valid,
          fatal:          validation.fatal,
          warnings:       validation.warnings,
          scene:          parsed.scene,
          storyLength:    parsed.story ? parsed.story.length : 0,
          choicesCount:   parsed.choices ? parsed.choices.length : 0,
          hasStateDiff:   !!parsed.stateDiff,
        },
      });
    } catch {}

    if (!validation.valid) {
      // Fail LOUDLY — surface it in the UI instead of silently doing nothing.
      state.lastError = {
        when: new Date().toISOString(),
        fatal: validation.fatal,
        warnings: validation.warnings,
        rawPreview: (raw || '').slice(0, 500),
      };
      store.saveState(dir, state);
      return {
        success: false,
        error: 'Storyteller response invalid: ' + validation.fatal.join('; '),
        rawPreview: (raw || '').slice(0, 500),
        state,
        log: store.loadLog(dir),
      };
    }

    // Apply state diff
    state.turnCount = (state.turnCount || 0) + 1;
    if (parsed.stateDiff) {
      try { store.applyStateDiff(state, parsed.stateDiff, { turn: state.turnCount }); }
      catch (e) { console.warn('[TextStory] applyStateDiff error:', e.message); }
    }

    // Handle [REPORT] — persist, grow the target budget, notify the renderer.
    // (STORY_GUIDELINES_PATCH §6.)
    let persistedReport = null;
    if (parsed.report && typeof parsed.report === 'object') {
      try {
        // Persist the raw report to disk with the turn number for context.
        persistedReport = {
          turn: state.turnCount,
          section: state.turnCount,
          ...parsed.report,
        };
        store.appendReport(dir, persistedReport);
        // Grow the target's sectionBudget so the next turn's PACING CONTRACT
        // reflects the granted extension.
        const applied = store.applyReportToBudget(state, parsed.report);
        persistedReport.applied = applied;
      } catch (e) {
        console.warn('[TextStory] report handling failed:', e.message);
      }
    }

    // Pacing lifecycle — bump sectionsUsed and process event transitions.
    // (STORY_GUIDELINES_PATCH §5.1.)
    try { store.bumpSectionCounters(state); }               catch (e) { console.warn('[TextStory] bumpSectionCounters error:', e.message); }
    try { store.processEventTransitions(state); }           catch (e) { console.warn('[TextStory] processEventTransitions error:', e.message); }

    state.pendingChoices = Array.isArray(parsed.choices) && parsed.choices.length > 0 ? parsed.choices : null;
    state.pendingNudge   = null;   // single-use; fired successfully, clear it
    state.lastError = null;
    store.saveState(dir, state);

    // Emit report event to renderer for the loud banner.
    if (persistedReport && mainWindow && !mainWindow.isDestroyed()) {
      try { mainWindow.webContents.send('story:report', { slug, report: persistedReport }); } catch {}
    }

    // Append story block + choices to log (tagged with the current chapter
    // so the renderer can build a chapter-jump index and export can group)
    const currentChapter = (state.storyBlueprint && state.storyBlueprint.chapters && state.storyBlueprint.chapters.currentChapter) || null;
    store.appendLog(dir, {
      kind: 'story',
      text: parsed.story,
      scene: parsed.scene || (state.scene && state.scene.name) || null,
      chapter: currentChapter,
      section: state.turnCount,
    });
    if (state.pendingChoices) {
      store.appendLog(dir, {
        kind: 'choice-offered',
        choices: state.pendingChoices,
      });
    }

    const freshLog = store.loadLog(dir);

    // Music: resolve any [MUSIC] directive from this turn and forward to renderer
    if (parsed.music && mainWindow && !mainWindow.isDestroyed()) {
      try {
        const v = String(parsed.music).trim();
        const lower = v.toLowerCase();
        let directive = null;
        if (lower === 'pause')  directive = { kind: 'pause'  };
        else if (lower === 'resume') directive = { kind: 'resume' };
        else if (lower === 'stop' || lower === 'silence') directive = { kind: 'stop' };
        else {
          const cue = musicEngine.resolveCueForPayload(v);
          if (cue && cue.ok) {
            directive = { kind: 'play', cue };
            state.lastMusicCueId = cue.id || cue.name || v;
            store.saveState(dir, state);
          }
        }
        if (directive) mainWindow.webContents.send('music:cue', directive);
      } catch (e) { console.warn('[TextStory] music cue resolve failed:', e.message); }
    }

    const payload = {
      success: true,
      state,
      log: freshLog,
      turn: {
        scene: parsed.scene,
        story: parsed.story,
        choices: state.pendingChoices,
        warnings: validation.warnings,
        music: parsed.music || null,
      },
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('story:update', payload);
    }
    return payload;
  });

  // ── Ask Storyteller ─────────────────────────────────────────────────
  ipcMain.handle('story:ask', async (_e, { slug, message } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const text = String(message || '').trim();
    if (!text) return { success: false, error: 'Empty message.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    const log = store.loadLog(dir);
    const history = store.loadStorytellerChat(dir);

    const { system, user } = buildAskStorytellerPrompt(state, log, history, text);

    let raw = '';
    try {
      const res = await callStoryteller({ systemPrompt: system, userPrompt: user });
      raw = res.raw || '';
    } catch (err) {
      console.warn('[TextStory] Ask-Storyteller call failed:', err.message);
      return { success: false, error: 'Storyteller call failed: ' + err.message };
    }

    const parsed = parseAskResponse(raw);

    try {
      store.appendDebugResponse(dir, {
        phase: 'ask',
        userMessage: text,
        systemPrompt: system,
        userPrompt:   user,
        raw,
        meta: {
          bodyLength: parsed.body.length,
          hasStateDiff: !!parsed.stateDiff,
        },
      });
    } catch {}

    // Apply state correction if the storyteller included one
    let stateChanged = false;
    if (parsed.stateDiff) {
      try {
        store.applyStateDiff(state, parsed.stateDiff, { turn: state.turnCount });
        store.saveState(dir, state);
        stateChanged = true;
        // Log the correction as a system entry so the narrative log shows it
        store.appendLog(dir, {
          kind: 'correction',
          text: '(The storyteller applied a correction from your Ask-Storyteller conversation.)',
        });
      } catch (e) {
        console.warn('[TextStory] Ask-state diff apply failed:', e.message);
      }
    }

    // Persist the exchange
    store.appendStorytellerChat(dir, { role: 'user', content: text });
    store.appendStorytellerChat(dir, { role: 'storyteller', content: parsed.body });

    if (mainWindow && !mainWindow.isDestroyed() && stateChanged) {
      mainWindow.webContents.send('story:update', {
        success: true,
        state,
        log: store.loadLog(dir),
        turn: null,
      });
    }

    return {
      success:      true,
      reply:        parsed.body,
      stateChanged,
      state:        stateChanged ? state : null,
    };
  });

  ipcMain.handle('story:ask-history', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    return { success: true, history: store.loadStorytellerChat(dir) };
  });

  ipcMain.handle('story:ask-clear', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    store.clearStorytellerChat(dir);
    return { success: true };
  });

  // ── Retry — remove the last player action from the log and let the
  //    user try a different action. Useful when the storyteller went off
  //    the rails or hit an error.
  ipcMain.handle('story:retry-turn', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    const log = store.loadLog(dir);
    // Pop trailing story + choice-offered pair (if present) plus the
    // preceding player action. This mirrors what the user "just saw".
    let popped = 0;
    while (log.length > 0 && popped < 4) {
      const last = log[log.length - 1];
      if (['story', 'choice-offered', 'choice-taken', 'freeform', 'continue'].includes(last.kind)) {
        log.pop();
        popped++;
        // Stop after we've popped a player action following a story block.
        if (['choice-taken', 'freeform', 'continue'].includes(last.kind)) break;
      } else {
        break;
      }
    }
    store.saveLog(dir, log);
    state.turnCount = Math.max(0, (state.turnCount || 0) - 1);
    state.pendingChoices = null;
    state.lastError = null;
    store.saveState(dir, state);
    return { success: true, state, log };
  });

  // ── Companion chat about the story ───────────────────────────────────
  // Aria talks WITH Trist about the story he's reading. She's not IN the
  // story — she's the reader alongside him. Full companion context flows
  // through sendToClaude(); the story is added as an addon block.
  ipcMain.handle('story:companion-chat', async (_e, { slug, message } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const text = String(message || '').trim();
    if (!text) return { success: false, error: 'Empty message.' };
    if (typeof getCharacterContext !== 'function') {
      return { success: false, error: 'Companion context not wired.' };
    }
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    const log = store.loadLog(dir);
    const history = store.loadCompanionChat(dir);

    const ctx = getCharacterContext() || {};
    const storyAddon = buildCompanionChatContext(state, log);

    // Feed the ongoing companion-chat back to Aria as her conversation window
    // so she remembers what they were just saying about the story.
    const conversationWindow = history.map((m) => ({ role: m.role === 'companion' ? 'companion' : 'user', content: m.content }));

    let response;
    try {
      response = await sendToClaude({
        userMessage:       text,
        character:         ctx.character,
        characterRules:    ctx.characterRules,
        masterSummary:     ctx.masterSummary,
        permanentMemories: ctx.permanentMemories,
        userProfile:       ctx.userProfile,
        conversationWindow,
        detectedEmotion:   '',
        attachments:       [],
        relatedContext:    [],
        emotionalState:    ctx.emotionalState,
        fastMode:          false,
        addonContexts:     [...(ctx.addonContexts || []), storyAddon],
        trackers:          ctx.trackers,
        activeThreads:     ctx.activeThreads,
        characterDir:      characterDir,
        conversationDynamic: '',
        personalityForce:  ctx.personalityForce,
        featureRequests:   ctx.featureRequests,
        pendingDeletionNotifications: [],
        previousEmotion:   'neutral',
        bodyState:         ctx.bodyState,
        workingShortMemories: [],
        workingLongMemories:  [],
      });
    } catch (err) {
      console.warn('[TextStory] Companion-chat call failed:', err.message);
      return { success: false, error: 'Companion call failed: ' + err.message };
    }

    const dialogue = response.dialogue || '';
    const thoughts = response.thoughts || '';
    const emotion  = response.emotion  || 'neutral';

    try {
      store.appendDebugResponse(dir, {
        phase: 'companion-chat',
        userMessage: text,
        raw: response.raw || '',
        meta: { dialogueLength: dialogue.length, emotion },
      });
    } catch {}

    store.appendCompanionChat(dir, { role: 'user',      content: text });
    store.appendCompanionChat(dir, { role: 'companion', content: dialogue, thoughts, emotion });

    return {
      success: true,
      reply: { dialogue, thoughts, emotion },
    };
  });

  ipcMain.handle('story:companion-chat-history', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    return { success: true, history: store.loadCompanionChat(dir) };
  });

  ipcMain.handle('story:companion-chat-clear', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    store.clearCompanionChat(dir);
    return { success: true };
  });

  // ── Live companion reaction ─────────────────────────────────────────
  // Light-context call fires after every story turn. Uses the active
  // companion via getCharacterContext() so it's whoever the user has
  // selected — Aria by default, but any character pack works.
  ipcMain.handle('story:react', async (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    if (typeof getCharacterContext !== 'function') return { success: false, error: 'Companion context not wired.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    const log = store.loadLog(dir);
    // Find the most recent story entry — that's what the companion is reacting to.
    let lastStory = null;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i] && log[i].kind === 'story') { lastStory = log[i]; break; }
    }
    if (!lastStory) return { success: false, error: 'No story segment yet to react to.' };

    const ctx = getCharacterContext() || {};
    const reactionCtx = buildCompanionReactionContext(state, lastStory);

    let response;
    try {
      response = await sendToClaude({
        userMessage:       '(react to the just-read segment)',
        character:         ctx.character,
        characterRules:    ctx.characterRules,
        // Light context: skip the heavy memory pipeline
        masterSummary:     '',
        permanentMemories: [],
        userProfile:       '',
        conversationWindow: [],
        detectedEmotion:   '',
        attachments:       [],
        relatedContext:    [],
        emotionalState:    ctx.emotionalState,
        fastMode:          true,
        addonContexts:     [reactionCtx],
        trackers:          {},
        activeThreads:     [],
        characterDir:      characterDir,
        conversationDynamic: '',
        personalityForce:  ctx.personalityForce,
        featureRequests:   [],
        pendingDeletionNotifications: [],
        previousEmotion:   'neutral',
        bodyState:         ctx.bodyState,
        workingShortMemories: [],
        workingLongMemories:  [],
      });
    } catch (err) {
      console.warn('[TextStory] Reaction call failed:', err.message);
      return { success: false, error: err.message };
    }

    const dialogue = response.dialogue || '';
    const thoughts = response.thoughts || '';
    const emotion  = response.emotion  || 'neutral';
    const companionName = (ctx.character && ctx.character.name) || 'Companion';

    if (dialogue) {
      store.appendReaction(dir, {
        section: state.turnCount || 0,
        companionName,
        dialogue,
        thoughts,
        emotion,
      });
    }

    return { success: true, reaction: { companionName, dialogue, thoughts, emotion } };
  });

  ipcMain.handle('story:reactions', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    return { success: true, reactions: store.loadReactions(dir) };
  });

  // ── Companion suggests a choice ─────────────────────────────────────
  ipcMain.handle('story:suggest-choice', async (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    if (typeof getCharacterContext !== 'function') return { success: false, error: 'Companion context not wired.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    if (!state.pendingChoices || !state.pendingChoices.length) return { success: false, error: 'No pending choices to suggest from.' };
    const log = store.loadLog(dir);
    let lastStory = null;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i] && log[i].kind === 'story') { lastStory = log[i]; break; }
    }

    const ctx = getCharacterContext() || {};
    const suggestCtx = buildCompanionSuggestChoiceContext(state, lastStory, state.pendingChoices);

    let response;
    try {
      response = await sendToClaude({
        userMessage:       '(which choice should I pick?)',
        character:         ctx.character,
        characterRules:    ctx.characterRules,
        masterSummary:     '',
        permanentMemories: [],
        userProfile:       '',
        conversationWindow: [],
        detectedEmotion:   '',
        attachments:       [],
        relatedContext:    [],
        emotionalState:    ctx.emotionalState,
        fastMode:          true,
        addonContexts:     [suggestCtx],
        trackers:          {},
        activeThreads:     [],
        characterDir:      characterDir,
        conversationDynamic: '',
        personalityForce:  ctx.personalityForce,
        featureRequests:   [],
        pendingDeletionNotifications: [],
        previousEmotion:   'neutral',
        bodyState:         ctx.bodyState,
        workingShortMemories: [],
        workingLongMemories:  [],
      });
    } catch (err) {
      console.warn('[TextStory] Suggest-choice call failed:', err.message);
      return { success: false, error: err.message };
    }
    const companionName = (ctx.character && ctx.character.name) || 'Companion';
    return {
      success: true,
      suggestion: {
        companionName,
        dialogue: response.dialogue || '',
        thoughts: response.thoughts || '',
        emotion:  response.emotion  || 'neutral',
      },
    };
  });

  // ── Stats + bookmarks + export ───────────────────────────────────────
  ipcMain.handle('story:stats', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    return { success: true, stats: store.computeStats(dir) };
  });

  ipcMain.handle('story:bookmarks', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    return { success: true, bookmarks: store.loadBookmarks(dir) };
  });

  ipcMain.handle('story:toggle-bookmark', (_e, { slug, logIdx, label } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const bookmarks = store.toggleBookmark(dir, logIdx, label || '');
    return { success: true, bookmarks };
  });

  ipcMain.handle('story:export', async (_e, { slug, format } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    const fmt = format === 'txt' ? 'txt' : 'md';
    const prose = store.exportProse(dir, fmt);
    const defaultName = (state.title || 'story').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) + '.' + fmt;
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Story Prose',
      defaultPath: defaultName,
      filters: fmt === 'md'
        ? [{ name: 'Markdown', extensions: ['md'] }, { name: 'All Files', extensions: ['*'] }]
        : [{ name: 'Plain Text', extensions: ['txt'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (res.canceled || !res.filePath) return { success: false, canceled: true };
    fs.writeFileSync(res.filePath, prose, 'utf8');
    return { success: true, filePath: res.filePath, byteCount: Buffer.byteLength(prose, 'utf8') };
  });

  // ── Portrait upload ─────────────────────────────────────────────────
  ipcMain.handle('story:upload-portrait', async (_e, { slug, characterId } = {}) => {
    if (!slug)        return { success: false, error: 'No slug provided.' };
    if (!characterId) return { success: false, error: 'No character id provided.' };
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Pick a portrait image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (res.canceled || !res.filePaths || !res.filePaths[0]) return { success: false, canceled: true };
    const dir = store._storyDir(storiesRoot, slug);
    try {
      const savedTo = store.setPortrait(dir, characterId, res.filePaths[0]);
      return { success: true, portraitPath: savedTo };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('story:clear-portrait', (_e, { slug, characterId } = {}) => {
    if (!slug)        return { success: false, error: 'No slug provided.' };
    if (!characterId) return { success: false, error: 'No character id provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    store.clearPortrait(dir, characterId);
    return { success: true };
  });

  ipcMain.handle('story:list-portraits', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    return { success: true, portraits: store.listPortraits(dir) };
  });

  // ── Summarize old log (rolls old sections into memory.rolledLog) ────
  ipcMain.handle('story:summarize-old-log', async (_e, { slug, chunkSize } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    const log = store.loadLog(dir);
    // Find the earliest chunk of "story" entries that hasn't been rolled yet
    const rolled = state.memory.rolledLog || [];
    const highestRolledSection = rolled.length ? Math.max(...rolled.map((r) => r.toSection || 0)) : 0;
    // Take the next 30 story entries after the last rolled one.
    const size = Number.isFinite(chunkSize) && chunkSize > 0 ? Math.min(chunkSize, 60) : 30;
    const eligible = log.filter((e) => e && e.kind === 'story' && typeof e.section === 'number' && e.section > highestRolledSection);
    if (eligible.length < size + 20) {
      // Only roll if there's a clear buffer of recent sections to preserve
      return { success: true, skipped: true, reason: 'Not enough old sections beyond the last roll to summarize.' };
    }
    const chunk = eligible.slice(0, size);
    const fromSection = chunk[0].section;
    const toSection   = chunk[chunk.length - 1].section;

    const { system, user } = buildSummarizeOldLogPrompt(state, chunk);
    let raw = '';
    try {
      const r = await callStoryteller({ systemPrompt: system, userPrompt: user, timeoutMs: 180000 });
      raw = r.raw || '';
    } catch (err) {
      console.warn('[TextStory] Summarize call failed:', err.message);
      return { success: false, error: err.message };
    }
    const summaryBlock = _extractBlock(raw, 'SUMMARY');
    const summary = (summaryBlock.value || '').trim();
    if (!summary) return { success: false, error: 'Summarizer returned no [SUMMARY] block.' };

    state.memory.rolledLog.push({ fromSection, toSection, summary, t: new Date().toISOString() });
    store.saveState(dir, state);
    try {
      store.appendDebugResponse(dir, {
        phase: 'summarize',
        userMessage: user,
        systemPrompt: system,
        userPrompt:   user,
        raw,
        meta: { fromSection, toSection, summaryLength: summary.length },
      });
    } catch {}
    return { success: true, rolled: { fromSection, toSection, summaryLength: summary.length } };
  });

  // ── Debug snapshot ──────────────────────────────────────────────────
  // Returns everything the Debug Inspector needs to show:
  //   • current state + log
  //   • the exact system+user prompt that WOULD be sent right now
  //   • the last-actually-sent prompt+response for turn and blueprint calls
  // Intentionally spoils the story — the button label warns the user.
  ipcMain.handle('story:get-debug-snapshot', (_e, { slug } = {}) => {
    if (!slug) return { success: false, error: 'No slug provided.' };
    const dir = store._storyDir(storiesRoot, slug);
    const state = store.loadState(dir);
    if (!state) return { success: false, error: 'Story not found.' };
    const log = store.loadLog(dir);
    // Rebuild the exact prompt a "continue" turn would send right now.
    const previewNudge = (typeof state.pendingNudge === 'string' && state.pendingNudge.trim()) ? state.pendingNudge.trim() : '';
    const { system, user } = buildTurnPrompt(state, log, '', { kind: 'continue', nudge: previewNudge });
    return {
      success: true,
      state,
      log,
      blueprint:            state.storyBlueprint || null,
      currentTurnPrompt:    { system, user },
      lastTurnCall:         store.lastDebugResponseByPhase(dir, 'turn'),
      lastBlueprintCall:    store.lastDebugResponseByPhase(dir, 'blueprint'),
      lastDetailsCall:      store.lastDebugResponseByPhase(dir, 'details'),
      lastAskCall:          store.lastDebugResponseByPhase(dir, 'ask'),
    };
  });
}

module.exports = { register };
