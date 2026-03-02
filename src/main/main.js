const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const logger = require('./debug-logger');
const HotkeyManager = require('./hotkey-manager');
const KnowledgeDB = require('./knowledge-db');
const SessionManager = require('./session-manager');
const LocalBrain = require('./local-brain');
const { captureScreen, cleanupScreenshot } = require('./screen-capture');
const { openFilePicker, openFolderPicker } = require('./file-handler');
const { fetchUrl } = require('./web-fetcher');
const { registerDebugViewerIPC } = require('./debug-viewer-ipc');
const { registerCharacterBuilderIPC } = require('./character-builder-ipc');
const { summarizeConversation } = require('./claude-bridge');
const { EMOTION_AXES, COMBINED_EMOTION_MAP, SENSATION_DECAY, SENSATION_MAX } = require('../shared/constants');
const ttsEngine = require('./tts-engine');

const CHARACTERS_BASE = path.join(__dirname, '../../characters');
const ADDONS_BASE     = path.join(__dirname, '../../addons');
const CONFIG_PATH     = path.join(__dirname, '../../config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

function writeConfig(updates) {
  const cfg = readConfig();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...cfg, ...updates }, null, 2));
}

function getActiveCharacterName() {
  return readConfig().activeCharacter || 'default';
}

const ACTIVE_CHARACTER = getActiveCharacterName();
const CHARACTER_DIR    = path.join(CHARACTERS_BASE, ACTIVE_CHARACTER);
const DB_PATH          = path.join(CHARACTER_DIR, 'knowledge.db');

let mainWindow;
let hotkeyManager;
let db;
let sessionManager;
let localBrain;
let character;
let characterRules;
let fillerResponses;
let _fastMode = false;
let _addonContexts = []; // merged context blobs from loaded addons
let _currentSensation = 0; // Session-only pleasure/pain accumulator; resets on app restart
let _trackers = {};         // Persistent named counters (loaded from DB per character)

// ── App Bootstrap ─────────────────────────────────────────────────────────────

function loadCharacterPack() {
  character = JSON.parse(fs.readFileSync(path.join(CHARACTER_DIR, 'character.json'), 'utf-8'));
  characterRules = JSON.parse(fs.readFileSync(path.join(CHARACTER_DIR, 'rules.json'), 'utf-8'));
  fillerResponses = JSON.parse(fs.readFileSync(path.join(CHARACTER_DIR, 'filler-responses.json'), 'utf-8'));

  // Load appearance description if referenced in character.json
  if (character.appearance_file) {
    const appearancePath = path.join(CHARACTER_DIR, character.appearance_file);
    if (fs.existsSync(appearancePath)) {
      try {
        character._appearance = JSON.parse(fs.readFileSync(appearancePath, 'utf-8'));
        console.log('[App] Appearance description loaded for:', character.name);
      } catch (e) {
        console.warn('[App] Could not load appearance file:', e.message);
      }
    }
  }

  console.log('[App] Character pack loaded:', character.name);
}

function initBrain() {
  console.log('[App] Initializing brain...');
  db = new KnowledgeDB(DB_PATH);
  db.open();
  console.log('[App] Knowledge DB opened:', DB_PATH);

  sessionManager = new SessionManager();

  const masterSummary = db.getMasterSummary();
  const permanentMemories = db.getAllMemories();
  const recentMessages = db.getRecentMessages(30);
  sessionManager.loadFromDB({ masterSummary, permanentMemories, recentMessages });
  console.log('[App] Restored', recentMessages.length, 'messages from DB');

  logger.log('startup', {
    memoriesLoaded: permanentMemories.length,
    messagesRestored: recentMessages.length,
    masterSummaryLength: masterSummary ? masterSummary.length : 0,
    memoriesBySource: permanentMemories.reduce((acc, m) => {
      acc[m.source || 'unknown'] = (acc[m.source || 'unknown'] || 0) + 1;
      return acc;
    }, {}),
  });

  localBrain = new LocalBrain({
    db,
    fillerResponses,
    character,
    characterRules,
    sessionManager,
  });
}

function loadAddons() {
  _addonContexts = [];
  if (!fs.existsSync(ADDONS_BASE)) return;

  const addonDirs = fs.readdirSync(ADDONS_BASE).filter((d) => {
    const manifestPath = path.join(ADDONS_BASE, d, 'manifest.json');
    return fs.existsSync(manifestPath);
  });

  for (const dir of addonDirs) {
    const addonDir     = path.join(ADDONS_BASE, dir);
    const manifestPath = path.join(addonDir, 'manifest.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      // Load addon context file (appended to system prompt)
      if (manifest.contextFile) {
        const ctxPath = path.join(addonDir, manifest.contextFile);
        if (fs.existsSync(ctxPath)) {
          const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf-8'));
          _addonContexts.push(ctx);
        }
      }

      // Register IPC handlers
      if (manifest.ipcModule) {
        const ipcModulePath = path.join(addonDir, manifest.ipcModule);
        if (fs.existsSync(ipcModulePath)) {
          const addonIpc = require(ipcModulePath);
          if (typeof addonIpc.register === 'function') {
            addonIpc.register({ ipcMain, characterDir: CHARACTER_DIR });
            console.log('[App] Addon loaded:', manifest.name, manifest.version);
          }
        }
      }
    } catch (e) {
      console.error('[App] Failed to load addon in', dir + ':', e.message);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

const DEBUG_VIEWER_MODE = process.argv.includes('--debug-viewer');
const CHAR_BUILDER_MODE = process.argv.includes('--char-builder');

app.whenReady().then(() => {
  if (DEBUG_VIEWER_MODE) {
    // Standalone debug viewer — no companion window, no brain
    registerDebugViewerIPC(null, null);
    ipcMain.emit('debug-viewer:open');
    return;
  }

  if (CHAR_BUILDER_MODE) {
    // Standalone character builder — no companion window, no brain
    registerCharacterBuilderIPC(null);
    ipcMain.emit('character-builder:open');
    return;
  }

  logger.init();
  loadCharacterPack();
  initBrain();
  loadAddons();
  ttsEngine.startVitsServer();

  // Configure and start RVC voice conversion server
  const rvcCfg = readConfig().rvc || {};
  ttsEngine.setRvcConfig(rvcCfg);
  ttsEngine.startRvcServer();

  // Restore persisted TTS settings
  const savedTts = readConfig().tts || {};
  if (savedTts.voice)              ttsEngine.setVoice(savedTts.voice);
  if (savedTts.enabled !== undefined) ttsEngine.setEnabled(savedTts.enabled);
  if (savedTts.speed  !== undefined)  ttsEngine.setRate(savedTts.speed);

  // Restore fast mode
  _fastMode = readConfig().fastMode || false;
  console.log('[App] Fast mode:', _fastMode ? 'ON' : 'OFF');

  const win = createWindow();

  hotkeyManager = new HotkeyManager(win);
  hotkeyManager.register('F2');

  registerDebugViewerIPC(win, db);
  registerCharacterBuilderIPC(win);

  win.webContents.on('did-finish-load', () => {
    // Apply saved zoom factor immediately so text is the right size from the first frame
    const savedZoom = readConfig().zoom || 100;
    win.webContents.setZoomFactor(savedZoom / 100);

    _trackers = db.getProfileValue('trackers') || {};
    win.webContents.send('app:init', {
      character,
      characterId: ACTIVE_CHARACTER,
      masterSummary: sessionManager.masterSummary,
      permanentMemories: sessionManager.permanentMemories,
      emotionalState: db.getEmotionalState(),
      fastMode: _fastMode,
      trackers: _trackers,
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (db) {
    try { saveSessionOnExit(); } catch {}
    db.close();
  }
  if (hotkeyManager) hotkeyManager.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

function saveSessionOnExit() {
  const currentSummary = sessionManager.masterSummary;
  if (currentSummary) db.setMasterSummary(currentSummary);
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

ipcMain.handle('claude:send-message', async (event, payload) => {
  const { message, userEmotion, attachments } = payload;
  // Stop any in-progress TTS before processing the new message
  mainWindow?.webContents.send('tts:stop');
  try {
    // DB insert first (persistence only — does not affect prompt context)
    db.insertMessage({ role: 'user', content: message, emotion: userEmotion });
    const onStreamChunk = (partialDialogue) => {
      mainWindow?.webContents.send('claude:stream-chunk', { text: partialDialogue });
    };
    const response = await localBrain.route(message, { userEmotion, attachments, onStreamChunk, fastMode: _fastMode, sensation: _currentSensation, addonContexts: _addonContexts, trackers: _trackers });
    // Add to session window AFTER route() so the current message isn't already in the
    // conversation window when Claude builds the prompt (claude-bridge appends it explicitly).
    sessionManager.addMessage('user', message, userEmotion);
    sessionManager.addMessage('companion', response.dialogue, response.emotion);
    db.insertMessage({ role: 'companion', content: response.dialogue, emotion: response.emotion });

    // Update persistent emotional axis state (drift 15% toward emitted emotion)
    const emotionId = response.emotion;
    let target = EMOTION_AXES[emotionId];
    if (!target && COMBINED_EMOTION_MAP[emotionId]) {
      const ce = COMBINED_EMOTION_MAP[emotionId];
      const axA = EMOTION_AXES[ce.a] || EMOTION_AXES.neutral;
      const axB = EMOTION_AXES[ce.b] || EMOTION_AXES.neutral;
      target = { V: (axA.V + axB.V) / 2, A: (axA.A + axB.A) / 2, S: (axA.S + axB.S) / 2, P: (axA.P + axB.P) / 2 };
    }
    if (target) {
      // Drift rate: 0.60 for extreme emotions (any axis > 70 or < 30), 0.25 for mild.
      // Extreme emotions (in_pleasure, frantic_desperation, shocked, angry, etc.) cause
      // large axis swings in a single message. Ordinary emotions drift slowly.
      const isExtreme = target.V > 70 || target.V < 30 ||
                        target.A > 70 || target.A < 30 ||
                        target.S > 70 || target.S < 30 ||
                        target.P > 70 || target.P < 30;
      const DRIFT = isExtreme ? 0.60 : 0.25;
      const cur = db.getEmotionalState();
      const newState = {
        valence:  cur.valence  + (target.V - cur.valence)  * DRIFT,
        arousal:  cur.arousal  + (target.A - cur.arousal)  * DRIFT,
        social:   cur.social   + (target.S - cur.social)   * DRIFT,
        physical: cur.physical + (target.P - cur.physical) * DRIFT,
      };
      db.setEmotionalState(newState);
      response.emotionalState = newState;
      pushEmotionalStateUpdate(newState, emotionId);
      logger.log('axis_drift', {
        emotion: emotionId,
        extreme: isExtreme,
        driftRate: DRIFT,
        prev: { V: Math.round(cur.valence), A: Math.round(cur.arousal), S: Math.round(cur.social), P: Math.round(cur.physical) },
        next: { V: Math.round(newState.valence), A: Math.round(newState.arousal), S: Math.round(newState.social), P: Math.round(newState.physical) },
        target: { V: target.V, A: target.A, S: target.S, P: target.P },
      });
    }

    // Update session sensation state (decay existing, accumulate if lingering)
    // Decay rate is steeper at high intensities — peak pleasure/pain cannot be sustained passively.
    const sensationDelta = response.sensation || 0;
    const _absS = Math.abs(_currentSensation);
    const _decayRate = _absS >= 0.90 ? 0.40   // peak: hard crash without active stimulation
                     : _absS >= 0.70 ? 0.58   // overwhelming: fades quickly
                     : _absS >= 0.50 ? 0.74   // intense: noticeably faster
                     : SENSATION_DECAY;        // normal (0.88)
    _currentSensation *= _decayRate;
    if (response.sensationLingers && sensationDelta !== 0) {
      _currentSensation = Math.max(-SENSATION_MAX, Math.min(SENSATION_MAX, _currentSensation + sensationDelta));
    }
    if (sensationDelta !== 0) {
      mainWindow?.webContents.send('companion:sensation', {
        delta: sensationDelta,
        lingers: !!response.sensationLingers,
        current: _currentSensation,
      });
    }

    // Update persistent tracker counts
    if (response.trackUpdates && response.trackUpdates.length > 0) {
      for (const upd of response.trackUpdates) {
        if (upd.op === 'del') {
          delete _trackers[upd.name];
        } else if (upd.op === 'set') {
          _trackers[upd.name] = Math.round(upd.value);
        } else {
          // op === 'add' (default)
          _trackers[upd.name] = Math.round((_trackers[upd.name] || 0) + upd.delta);
        }
      }
      db.setProfileValue('trackers', _trackers);
      mainWindow?.webContents.send('companion:trackers', { trackers: _trackers });
    }

    // Fire TTS synthesis in parallel — don't await, send audio when ready
    if (response.dialogue) {
      const ttsEnabled = ttsEngine.getSettings().enabled;
      if (ttsEnabled) {
        mainWindow?.webContents.send('tts:loading');
      }
      ttsEngine.synthesize(response.dialogue).then(audioBuf => {
        if (audioBuf) {
          mainWindow?.webContents.send('tts:audio', audioBuf.toString('base64'));
        } else if (ttsEnabled) {
          mainWindow?.webContents.send('tts:loading-done');
        }
      }).catch(err => {
        console.warn('[TTS] synthesis error:', err.message);
        if (ttsEnabled) mainWindow?.webContents.send('tts:loading-done');
      });
    }

    const sumCheck = sessionManager.checkForSummarization();
    if (sumCheck) {
      sessionManager.applySummarization('', sumCheck.remaining);
    }

    const screenshotAtt = (attachments || []).find((a) => a.type === 'screenshot');
    if (screenshotAtt && screenshotAtt.path) cleanupScreenshot(screenshotAtt.path);

    return { success: true, ...response };
  } catch (err) {
    console.error('[IPC] send-message error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('screen:capture', async () => {
  try {
    const result = await captureScreen();
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('brain:check-visual-trigger', async (event, message) => {
  try {
    return { needsCapture: localBrain.hasVisualTrigger(message) };
  } catch {
    return { needsCapture: false };
  }
});

ipcMain.handle('dialog:open-file', async () => {
  try {
    const result = await openFilePicker(mainWindow);
    return result ? { success: true, ...result } : { success: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('dialog:open-folder', async () => {
  try {
    const result = await openFolderPicker(mainWindow);
    return result ? { success: true, ...result } : { success: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('web:fetch', async (event, url) => {
  try {
    const result = await fetchUrl(url);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('brain:feedback', (event, { message }) => {
  try { localBrain.applyFeedback(message); } catch {}
});

ipcMain.handle('conversation:save', async () => {
  try {
    const messages = db.getRecentMessages(500);
    if (!messages.length) return { success: false, error: 'No messages to save.' };

    const { summary } = await summarizeConversation({
      messages,
      characterName: character.name,
    });

    const now = new Date().toISOString();
    db.insertConversationSession({
      startedAt: null,
      endedAt: now,
      messageCount: messages.length,
      summary,
      messagesJson: JSON.stringify(messages),
    });

    // Append to master summary so Aria remembers this conversation
    const existing = db.getMasterSummary();
    const dateStr = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    const newSummary = existing
      ? `${existing}\n\n[Saved ${dateStr}] ${summary}`
      : `[Saved ${dateStr}] ${summary}`;
    db.setMasterSummary(newSummary);
    sessionManager.setMasterSummary(newSummary);

    return { success: true, summary };
  } catch (err) {
    console.error('[conversation:save] error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('session:pop-last', () => {
  if (!sessionManager) return { success: false };
  const removed = sessionManager.popLastExchange();
  return { success: removed };
});

// ── Message History Editor ────────────────────────────────────────────────────
let messageEditorWindow = null;

ipcMain.on('msgs:open', () => {
  if (messageEditorWindow && !messageEditorWindow.isDestroyed()) {
    messageEditorWindow.focus();
    return;
  }
  messageEditorWindow = new BrowserWindow({
    width: 620,
    height: 720,
    minWidth: 480,
    minHeight: 400,
    frame: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/message-editor-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    title: 'Message History',
  });
  messageEditorWindow.loadFile(path.join(__dirname, '../renderer/message-editor.html'));
  messageEditorWindow.once('ready-to-show', () => messageEditorWindow.show());
  messageEditorWindow.on('closed', () => { messageEditorWindow = null; });
});

ipcMain.on('msgs:minimize', () => messageEditorWindow?.minimize());
ipcMain.on('msgs:close',    () => messageEditorWindow?.close());

ipcMain.handle('msgs:list', () => {
  if (!db) return [];
  return db.db.prepare(
    'SELECT id, role, content, emotion FROM conversation_messages ORDER BY id DESC'
  ).all();
});

ipcMain.handle('msgs:delete-one', (_event, id) => {
  if (!db) return false;
  db.db.prepare('DELETE FROM conversation_messages WHERE id = ?').run(id);
  return true;
});

ipcMain.on('debug-viewer:open-from-main', () => {
  ipcMain.emit('debug-viewer:open');
});

// ── Emotional Axis Monitor pop-out ────────────────────────────────────────────

let emotionalStateWindow = null;

// Helper to look up last-emitted emotion info for the monitor window
let _lastEmotionId = 'neutral';
const { EMOTIONS: _EMOTIONS_LIST, COMBINED_EMOTIONS: _COMBINED_LIST } = require('../shared/constants');
const _EMOTION_INFO_MAP = Object.fromEntries([
  ..._EMOTIONS_LIST.map(e => [e.id, { id: e.id, emoji: e.emoji, label: e.label }]),
  ..._COMBINED_LIST.map(e => [e.id, { id: e.id, emoji: e.emoji, label: e.label }]),
]);

ipcMain.on('emotional-state:open', () => {
  if (emotionalStateWindow && !emotionalStateWindow.isDestroyed()) {
    emotionalStateWindow.focus();
    return;
  }

  emotionalStateWindow = new BrowserWindow({
    width: 400,
    height: 540,
    minWidth: 340,
    minHeight: 440,
    frame: false,
    backgroundColor: '#0a0a0f',

    webPreferences: {
      preload: path.join(__dirname, '../preload/emotional-state-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    title: 'Emotional Axis Monitor',
  });

  emotionalStateWindow.loadFile(path.join(__dirname, '../renderer/emotional-state.html'));

  emotionalStateWindow.once('ready-to-show', () => emotionalStateWindow.show());
  emotionalStateWindow.on('closed', () => { emotionalStateWindow = null; });
});

ipcMain.on('emotional-state:minimize', () => emotionalStateWindow?.minimize());
ipcMain.on('emotional-state:close',    () => emotionalStateWindow?.close());

ipcMain.handle('emotional-state:get', () => {
  const state = db ? db.getEmotionalState() : { valence: 50, arousal: 40, social: 50, physical: 70 };
  const emotion = _EMOTION_INFO_MAP[_lastEmotionId] || _EMOTION_INFO_MAP['neutral'];
  return { state, emotion };
});

ipcMain.handle('emotional-state:reset', () => {
  const defaultState = { valence: 50, arousal: 40, social: 50, physical: 70 };
  if (db) db.setEmotionalState(defaultState);
  return { state: defaultState };
});

// ── TTS IPC ───────────────────────────────────────────────────────────────────

ipcMain.handle('tts:get-settings', () => ttsEngine.getSettings());
ipcMain.handle('tts:get-voices',   () => ttsEngine.getVoices());

ipcMain.handle('tts:set-enabled', (event, val) => {
  ttsEngine.setEnabled(val);
  const s = ttsEngine.getSettings();
  writeConfig({ tts: { ...((readConfig().tts) || {}), enabled: s.enabled } });
  return s;
});
ipcMain.handle('tts:set-voice', (event, voiceName) => {
  ttsEngine.setVoice(voiceName);
  const s = ttsEngine.getSettings();
  writeConfig({ tts: { ...((readConfig().tts) || {}), voice: s.voice } });
  return s;
});
ipcMain.handle('tts:set-rate', (event, rate) => {
  ttsEngine.setRate(rate);
  const s = ttsEngine.getSettings();
  writeConfig({ tts: { ...((readConfig().tts) || {}), speed: s.speed } });
  return s;
});

// ── Fast mode IPC ─────────────────────────────────────────────────────────────

ipcMain.handle('settings:get-fast-mode', () => _fastMode);

ipcMain.handle('settings:set-fast-mode', (_event, val) => {
  _fastMode = !!val;
  writeConfig({ fastMode: _fastMode });
  console.log('[App] Fast mode:', _fastMode ? 'ON' : 'OFF');
  return _fastMode;
});

// ── UI zoom IPC ────────────────────────────────────────────────────────────

ipcMain.handle('settings:get-zoom', () => readConfig().zoom || 100);

ipcMain.handle('settings:set-zoom', (_event, pct) => {
  const clamped = Math.max(50, Math.min(300, Math.round(pct)));
  writeConfig({ zoom: clamped });
  mainWindow?.webContents.setZoomFactor(clamped / 100);
  return clamped;
});

// ── Background / display settings IPC ─────────────────────────────────────

ipcMain.handle('settings:get-bg', () => {
  return readConfig().background || {};
});

ipcMain.handle('settings:set-bg', (_event, bg) => {
  writeConfig({ background: bg });
  return bg;
});

// ── RVC voice conversion settings ─────────────────────────────────────────────

ipcMain.handle('rvc:get-config', () => {
  return readConfig().rvc || {};
});

ipcMain.handle('rvc:set-config', (_event, cfg) => {
  const current = readConfig();
  const merged  = { ...(current.rvc || {}), ...cfg };
  writeConfig({ rvc: merged });
  ttsEngine.setRvcConfig(merged);
  return merged;
});

// ── Character management ──────────────────────────────────────────────────────

ipcMain.handle('character:list', () => {
  try {
    return fs.readdirSync(CHARACTERS_BASE)
      .filter((d) => {
        const stat = fs.statSync(path.join(CHARACTERS_BASE, d));
        const hasChar = fs.existsSync(path.join(CHARACTERS_BASE, d, 'character.json'));
        return stat.isDirectory() && hasChar;
      })
      .map((d) => {
        const char = JSON.parse(fs.readFileSync(path.join(CHARACTERS_BASE, d, 'character.json'), 'utf-8'));
        return { id: d, name: char.name, active: d === ACTIVE_CHARACTER };
      });
  } catch (e) {
    console.error('[Character] list error:', e.message);
    return [];
  }
});

ipcMain.handle('character:switch', (_event, charId) => {
  try {
    writeConfig({ activeCharacter: charId });
    app.relaunch();
    app.quit();
    return { success: true };
  } catch (e) {
    console.error('[Character] switch error:', e.message);
    return { success: false, error: e.message };
  }
});

// ── Push live updates to the emotional state window after each response ───────
function pushEmotionalStateUpdate(state, emotionId) {
  if (!emotionalStateWindow || emotionalStateWindow.isDestroyed()) return;
  _lastEmotionId = emotionId || _lastEmotionId;
  const emotion = _EMOTION_INFO_MAP[_lastEmotionId] || _EMOTION_INFO_MAP['neutral'];
  emotionalStateWindow.webContents.send('state:update', { state, emotion });
}
