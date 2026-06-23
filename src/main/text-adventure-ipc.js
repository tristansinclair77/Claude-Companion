// Text Adventure IPC handlers + Claude bridge.
//
// One handler module that owns:
//   - get/new/reset adventure state
//   - take-action: full adventure turn (player + Aria + narrator + state)
//   - side-chat: paused private chat with Aria that does NOT pollute the
//     adventure prompt context. Its own transcript file.
//   - feature-request forwarding (adventure-emitted FEATURE_REQUESTs flow
//     into the shared store and flash the badge)

const store               = require('./text-adventure-store');
const { TEXT_ADVENTURE_RULES } = require('./text-adventure-rules');
const featureRequestsStore     = require('./feature-requests');
const { parseResponse }   = require('../shared/response-parser');
const { sendToClaude }    = require('./claude-bridge');
const musicEngine         = require('./music-engine');

// ── Pre-parser: pull adventure-specific tags out of the raw Claude response ──

function _extractBlock(raw, openTag, closeTag) {
  const re = new RegExp(`\\[${openTag}\\]([\\s\\S]*?)\\[\\/${closeTag}\\]`, 'i');
  const m = raw.match(re);
  if (!m) return { value: null, residue: raw };
  const value = m[1].trim();
  const residue = raw.replace(m[0], '').trim();
  return { value, residue };
}

function _extractLine(raw, tagName) {
  const re = new RegExp(`^[ \\t]*\\[${tagName}\\][ \\t]*(.+?)[ \\t]*$`, 'mi');
  const m = raw.match(re);
  if (!m) return { value: null, residue: raw };
  const value = m[1].trim();
  const residue = raw.replace(m[0], '').trim();
  return { value, residue };
}

function _safeJsonParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  return null;
}

// Defensive strip applied to all rendered text (narrator + Aria dialogue).
// Two kinds of model goofs we scrub on the way in:
//   1. Markdown emphasis (*…* / **…**) — we forbid it in the rules but the
//      model still slips it in. Strips pairs cleanly without touching solo
//      asterisks (rare in narration).
//   2. Leaked structural tags — any [/SOMETHING] closer (the model invents
//      these even when the spec only opens them, e.g. "[/DIALOGUE]"). Also
//      strips stray open tags that should have been parsed out upstream.
function _scrubRenderedText(s) {
  if (typeof s !== 'string') return s;
  return s
    // Closing square-bracket tags: [/DIALOGUE], [/THOUGHTS], etc.
    .replace(/\[\/[A-Z_]+\]/g, '')
    // Known stray open square-bracket tags
    .replace(/\[(?:DIALOGUE|THOUGHTS|NARRATOR|GAME_STATE|SCENE|ENEMY|DEATH|MUSIC|ARIA_EMOTION|FEATURE_REQUEST)\]/g, '')
    // XML/HTML-style leakage. Anthropic models sometimes spill internal-tag
    // remnants like </thinking>, <reflection>, <answer>. Strip both opening
    // and closing forms for any single-word lowercase tag. (Legitimate angle
    // brackets in fantasy narration are vanishingly rare.)
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9_-]*\s*\/?>/g, '')
    // Markdown emphasis
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/\*([\s\S]+?)\*/g,     '$1')
    // Collapse the blank line that the scrubbed tag often leaves behind
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseAdventureResponse(raw, { previousEmotion = 'neutral' } = {}) {
  let residue = raw;
  const scene    = _extractLine (residue, 'SCENE');                  residue = scene.residue;
  const narrator = _extractBlock(residue, 'NARRATOR', 'NARRATOR');   residue = narrator.residue;
  const gameSt   = _extractBlock(residue, 'GAME_STATE', 'GAME_STATE'); residue = gameSt.residue;
  const enemy    = _extractLine (residue, 'ENEMY');                  residue = enemy.residue;
  const death    = _extractLine (residue, 'DEATH');                  residue = death.residue;
  const music    = _extractLine (residue, 'MUSIC');                  residue = music.residue;
  const ariaEm   = _extractLine (residue, 'ARIA_EMOTION');           residue = ariaEm.residue;

  const ariaParsed = parseResponse(residue, { fallbackEmotion: previousEmotion });
  // Scrub first, then check — if scrubbing reduces the dialogue to nothing
  // (e.g. the model emitted only a stray "</thinking>"), treat it as silence
  // rather than rendering an empty "Aria — " bubble.
  const scrubbedDialogue = _scrubRenderedText(ariaParsed.dialogue || '');
  const hasAriaComment = scrubbedDialogue.length > 0;

  // Portrait emotion: meta-commentary (emotion) wins; otherwise the standalone
  // [ARIA_EMOTION] tag; otherwise previousEmotion.
  const portraitEmotion = hasAriaComment
    ? (ariaParsed.emotion || ariaEm.value || previousEmotion)
    : (ariaEm.value || previousEmotion);

  return {
    scene:        scene.value     || null,
    narrator:     _scrubRenderedText(narrator.value || ''),
    gameStateDiff: _safeJsonParse(gameSt.value),
    enemySlug:    enemy.value     || null,
    deathCause:   death.value     || null,
    music:        music.value     || null,
    portraitEmotion,
    aria: hasAriaComment ? {
      dialogue: scrubbedDialogue,
      thoughts: ariaParsed.thoughts || '',
      emotion:  ariaParsed.emotion  || previousEmotion,
    } : null,
    featureRequests: ariaParsed.featureRequests || [],
  };
}

// Translates a [MUSIC] tag value into a payload the renderer can play.
// Returns { kind, cue? } or null for invalid / empty directives.
// `timeOfDay` is the phase string from state.time.phase — used as a hint so
// the engine can auto-swap to the matching Day/Night variant when needed.
function _resolveMusicDirective(value, { timeOfDay } = {}) {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower === 'pause')  return { kind: 'pause'  };
  if (lower === 'resume') return { kind: 'resume' };
  if (lower === 'stop' || lower === 'silence') return { kind: 'stop' };
  const cue = musicEngine.resolveCueForPayload(v, { timeOfDay });
  if (!cue.ok) {
    console.warn('[Adventure] music directive could not resolve:', v, '—', cue.reason);
    return null;
  }
  if (cue.swappedFrom) {
    console.log(`[Adventure] music swap: ${cue.swappedFrom} → ${cue.name} (phase: ${timeOfDay})`);
  }
  return { kind: 'play', cue };
}

// ── Log formatting (for the prompt) ──────────────────────────────────────────

function formatLogForPrompt(log, limit = 30) {
  const recent = log.slice(-limit);
  return recent.map((e) => {
    if (e.kind === 'action')   return `> ${e.text}`;
    if (e.kind === 'narrator') return e.text;
    if (e.kind === 'aria')     return `Aria (meta): "${e.text}"`;
    if (e.kind === 'system')   return `[${e.text}]`;
    return e.text || '';
  }).join('\n\n');
}

// ── Adventure turn ───────────────────────────────────────────────────────────

async function runAdventureTurn({
  characterDir,
  action,
  state,
  log,
  characterContext,
}) {
  const adventureContext = {
    rules: TEXT_ADVENTURE_RULES,
    music_catalog: '=== ' + musicEngine.formatBibleForPrompt() + '\n=== END MUSIC CUE CATALOG ===',
    game_state_now: '=== CURRENT GAME STATE (the truth right now) ===\n' +
      JSON.stringify(state, null, 2) +
      '\n=== END CURRENT GAME STATE ===',
    recent_adventure_log: '=== RECENT ADVENTURE LOG (chronological, oldest first) ===\n' +
      (log.length > 0 ? formatLogForPrompt(log, 30) : '(this is the very first turn — no log yet)') +
      '\n=== END RECENT ADVENTURE LOG ===',
    adventure_mode_directive:
      "You are currently in TEXT-ADVENTURE MODE. The user's message is Trist's in-game action. " +
      "Respond as narrator + Aria's in-story actor + (optionally) Aria's meta commentary, " +
      "per the TEXT ADVENTURE RULES above. Do NOT respond as if this were normal chat. " +
      "Do NOT reference Aria's normal chat history. Do NOT reference any side-chat — those " +
      "exist in a separate channel you cannot see. Do NOT use [STATE], [SENSATION], [TRACK], " +
      "[REMEMBER], [KNOWLEDGE], [THREAD], [SELF], [MEMORY], [AFFECTION], or [RECALL] in this " +
      "mode — they don't apply. Use [GAME_STATE] for adventure state, including the memory " +
      "block. Use [MUSIC] to drive the soundtrack (see MUSIC section + catalog).",
  };

  const mergedAddonContexts = [
    ...(characterContext.addonContexts || []),
    adventureContext,
  ];

  const response = await sendToClaude({
    userMessage: action,
    character:        characterContext.character,
    characterRules:   characterContext.characterRules,
    masterSummary:    characterContext.masterSummary,
    permanentMemories: characterContext.permanentMemories,
    userProfile:      characterContext.userProfile,
    conversationWindow: [],
    detectedEmotion:  '',
    attachments:      [],
    relatedContext:   [],
    emotionalState:   characterContext.emotionalState,
    fastMode:         false,
    addonContexts:    mergedAddonContexts,
    trackers:         characterContext.trackers,
    activeThreads:    characterContext.activeThreads,
    characterDir,
    conversationDynamic: '',
    personalityForce:    characterContext.personalityForce,
    featureRequests:     characterContext.featureRequests,
    pendingDeletionNotifications: [],
    previousEmotion:     (state.player && state.player.lastAriaEmotion) || 'neutral',
    bodyState:           characterContext.bodyState,
    workingShortMemories: [],
    workingLongMemories:  [],
  });

  const raw = response.raw || '';
  const parsed = parseAdventureResponse(raw, {
    previousEmotion: response.emotion || 'neutral',
  });
  return { parsed, raw };
}

// ── Side-chat turn ───────────────────────────────────────────────────────────
//
// Pure Aria conversation. She knows the adventure is paused around her and
// has a summary of where the party stands so she can discuss it. She does
// NOT see the adventure log line-by-line, and the adventure run does NOT see
// her side-chat lines.

function _formatSideChatHistoryForPrompt(history, limit = 30) {
  return history.slice(-limit).map((m) => {
    if (m.role === 'user')      return `Trist: ${m.content}`;
    if (m.role === 'companion') return `Aria: ${m.content}`;
    return m.content || '';
  }).join('\n\n');
}

async function runSideChatTurn({
  characterDir,
  message,
  state,
  history,
  characterContext,
}) {
  const sideChatContext = {
    side_chat_directive:
      "PAUSED SIDE-CHAT WITH TRIST.\n\n" +
      "The text-adventure story is currently PAUSED. Trist has stepped away from the game " +
      "to talk with you (Aria) directly. Respond as your normal self — warm, articulate, " +
      "the Aria he knows — using the standard [DIALOGUE] / [THOUGHTS] / (emotion) format. " +
      "You're aware of the adventure that's paused around you and may discuss it freely; a " +
      "summary is provided below. This conversation is PRIVATE to you and Trist — the " +
      "gamemaster (Claude in adventure mode) will not see it, and nothing said here will " +
      "appear in the adventure story unless one of you brings it up later in-game. Do NOT " +
      "emit [GAME_STATE], [NARRATOR], [SCENE], [ENEMY], or [DEATH] tags — this is plain " +
      "chat, not a turn.",
    adventure_summary_for_side_chat:
      '=== ADVENTURE STATUS (paused) ===\n' +
      store.formatStateSummary(state) +
      '\n=== END ADVENTURE STATUS ==='
  };

  const mergedAddonContexts = [
    ...(characterContext.addonContexts || []),
    sideChatContext,
  ];

  // Pass the side-chat transcript as the conversation window so Aria
  // remembers what was said earlier in this side chat.
  const conversationWindow = history.map((m) => ({ role: m.role, content: m.content }));

  const response = await sendToClaude({
    userMessage: message,
    character:        characterContext.character,
    characterRules:   characterContext.characterRules,
    masterSummary:    characterContext.masterSummary,
    permanentMemories: characterContext.permanentMemories,
    userProfile:      characterContext.userProfile,
    conversationWindow,
    detectedEmotion:  '',
    attachments:      [],
    relatedContext:   [],
    emotionalState:   characterContext.emotionalState,
    fastMode:         false,
    addonContexts:    mergedAddonContexts,
    trackers:         characterContext.trackers,
    activeThreads:    characterContext.activeThreads,
    characterDir,
    conversationDynamic: '',
    personalityForce:    characterContext.personalityForce,
    featureRequests:     characterContext.featureRequests,
    pendingDeletionNotifications: [],
    previousEmotion:     'neutral',
    bodyState:           characterContext.bodyState,
    workingShortMemories: [],
    workingLongMemories:  [],
  });

  return {
    dialogue: response.dialogue || '',
    thoughts: response.thoughts || '',
    emotion:  response.emotion  || 'neutral',
    raw:      response.raw      || '',
  };
}

// ── IPC registration ─────────────────────────────────────────────────────────

function register({ ipcMain, mainWindow, getCharacterContext, characterDir }) {
  if (!ipcMain || !characterDir) {
    console.warn('[TextAdventure] register called without ipcMain or characterDir — skipping.');
    return;
  }

  // ── Read state + log + monster roster ─────────────────────────────────────
  ipcMain.handle('adventure:get-state', () => {
    const state = store.loadState(characterDir);
    const log   = store.loadLog(characterDir);
    let resumeCue = null;
    if (state && state.lastMusicCueId) {
      const r = musicEngine.resolveCueForPayload(state.lastMusicCueId);
      if (r.ok) resumeCue = r;
    }
    return { state, log, monsters: store.MONSTER_LIST, resumeCue };
  });

  ipcMain.handle('adventure:get-log', (_event, { limit = 200 } = {}) => {
    const log = store.loadLog(characterDir);
    return { log: log.slice(-Math.max(1, Math.min(1000, limit))) };
  });

  ipcMain.handle('adventure:list-monsters', () => {
    return { monsters: store.MONSTER_LIST };
  });

  // ── New game / reset ──────────────────────────────────────────────────────
  ipcMain.handle('adventure:new-game', (_event, opts = {}) => {
    const tone    = String(opts.tone    || 'classic_high_fantasy').slice(0, 60);
    const setting = String(opts.setting || '').slice(0, 400);
    const state = store.newGame(characterDir, { tone, setting });
    return { state, log: [] };
  });

  ipcMain.handle('adventure:reset', () => {
    store.resetGame(characterDir);
    return { ok: true };
  });

  // ── Take action — the main adventure loop ─────────────────────────────────
  ipcMain.handle('adventure:take-action', async (_event, { action } = {}) => {
    try {
      const cleanAction = String(action || '').trim();
      if (!cleanAction) return { success: false, error: 'Empty action.' };

      const state = store.loadState(characterDir);
      if (!state) return { success: false, error: 'No game in progress. Start a new game first.' };
      if (!state.alive) {
        return { success: false, error: 'Game over. Reset to start a new game.', dead: true };
      }

      let log = store.appendLog(characterDir, { kind: 'action', text: cleanAction });
      const ctx = (typeof getCharacterContext === 'function') ? getCharacterContext() : {};

      const { parsed, raw } = await runAdventureTurn({
        characterDir,
        action: cleanAction,
        state,
        log,
        characterContext: ctx,
      });

      if (parsed.gameStateDiff) {
        store.applyStateDiff(state, parsed.gameStateDiff);
      }

      if (parsed.narrator) {
        log = store.appendLog(characterDir, { kind: 'narrator', text: parsed.narrator });
      }
      if (parsed.aria) {
        log = store.appendLog(characterDir, {
          kind: 'aria',
          text: parsed.aria.dialogue,
          thoughts: parsed.aria.thoughts,
          emotion:  parsed.aria.emotion,
        });
        state.player.lastAriaEmotion = parsed.aria.emotion;
      }

      store.tickStateAfterDiff(state);

      // Narrative death override — Claude declared a death even if HP wasn't 0.
      if (parsed.deathCause && state.alive) {
        // Default to player death unless the narrator explicitly mentions Aria.
        const who = /\baria\b/i.test(parsed.deathCause) ? 'aria' : 'player';
        state[who].hp = 0;
        state[who].alive = false;
        state.alive = false;
        state.deathOf = who;
      }
      if (!state.alive) {
        state.deathCause = state.deathCause || parsed.deathCause || 'Slain in the dark.';
        log = store.appendLog(characterDir, { kind: 'system', text: `DEATH (${state.deathOf || '?'}): ${state.deathCause}` });
      }

      store.saveState(characterDir, state);

      // Music directive — translate [MUSIC] into a renderer-bound payload.
      // Idempotency (same cue already playing) is handled in the renderer.
      // Persist the last play-cue id on the state so re-entering the run later
      // can resume music without waiting for Claude to re-emit the directive.
      let musicDirective = null;
      if (parsed.music) {
        // Pass the post-diff time phase so auto-swap uses the updated value
        // (Claude often advances time AND switches music in the same turn).
        musicDirective = _resolveMusicDirective(parsed.music, {
          timeOfDay: state.time && state.time.phase,
        });
        if (musicDirective && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('music:cue', musicDirective);
        }
        if (musicDirective && musicDirective.kind === 'play' && musicDirective.cue) {
          state.lastMusicCueId = musicDirective.cue.bibleId;
          store.saveState(characterDir, state);
        } else if (musicDirective && musicDirective.kind === 'stop') {
          state.lastMusicCueId = null;
          store.saveState(characterDir, state);
        }
      }

      let featureRequestsAdded = 0;
      if (parsed.featureRequests && parsed.featureRequests.length > 0) {
        for (const req of parsed.featureRequests) {
          featureRequestsStore.addRequest(characterDir, {
            title:       `[Adventure] ${req.title}`,
            description: req.description,
          });
          featureRequestsAdded += 1;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('feature-requests:updated', { flash: true, source: 'adventure' });
        }
      }

      const payload = {
        state,
        log,
        turnResponse: {
          scene:           parsed.scene,
          narrator:        parsed.narrator,
          enemySlug:       parsed.enemySlug,
          deathCause:      parsed.deathCause,
          aria:            parsed.aria,
          portraitEmotion: parsed.portraitEmotion,
          music:           musicDirective,
          featureRequestsAdded,
        },
      };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('adventure:update', payload);
      }

      return { success: true, ...payload, raw };
    } catch (err) {
      console.error('[Adventure] take-action error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Side-chat: paused private conversation ────────────────────────────────
  ipcMain.handle('adventure:side-chat-history', () => {
    return { history: store.loadSideChat(characterDir) };
  });

  ipcMain.handle('adventure:side-chat-clear', () => {
    store.clearSideChat(characterDir);
    return { ok: true };
  });

  ipcMain.handle('adventure:side-chat-send', async (_event, { message } = {}) => {
    try {
      const text = String(message || '').trim();
      if (!text) return { success: false, error: 'Empty message.' };

      const state = store.loadState(characterDir);
      if (!state) return { success: false, error: 'No game in progress; start a game first.' };

      let history = store.appendSideChat(characterDir, { role: 'user', content: text });

      const ctx = (typeof getCharacterContext === 'function') ? getCharacterContext() : {};
      const reply = await runSideChatTurn({
        characterDir,
        message: text,
        state,
        history: history.slice(0, -1),  // exclude the message we just appended; bridge re-adds it
        characterContext: ctx,
      });

      history = store.appendSideChat(characterDir, {
        role:     'companion',
        content:  reply.dialogue,
        thoughts: reply.thoughts,
        emotion:  reply.emotion,
      });

      return {
        success: true,
        reply: { dialogue: reply.dialogue, thoughts: reply.thoughts, emotion: reply.emotion },
        history,
      };
    } catch (err) {
      console.error('[Adventure] side-chat error:', err.message);
      return { success: false, error: err.message };
    }
  });

  console.log('[TextAdventure] IPC handlers registered.');
}

module.exports = { register };
