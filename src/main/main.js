const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const HotkeyManager = require('./hotkey-manager');
const KnowledgeDB = require('./knowledge-db');
const SessionManager = require('./session-manager');
const LocalBrain = require('./local-brain');
const { captureScreen, cleanupScreenshot } = require('./screen-capture');
const { openFilePicker, openFolderPicker } = require('./file-handler');
const { fetchUrl } = require('./web-fetcher');

const CHARACTER_DIR = path.join(__dirname, '../../characters/default');
const DB_PATH = path.join(CHARACTER_DIR, 'knowledge.db');

let mainWindow;
let hotkeyManager;
let db;
let sessionManager;
let localBrain;
let character;
let characterRules;
let fillerResponses;

// ── App Bootstrap ─────────────────────────────────────────────────────────────

function loadCharacterPack() {
  character = JSON.parse(fs.readFileSync(path.join(CHARACTER_DIR, 'character.json'), 'utf-8'));
  characterRules = JSON.parse(fs.readFileSync(path.join(CHARACTER_DIR, 'rules.json'), 'utf-8'));
  fillerResponses = JSON.parse(fs.readFileSync(path.join(CHARACTER_DIR, 'filler-responses.json'), 'utf-8'));
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

  localBrain = new LocalBrain({
    db,
    fillerResponses,
    character,
    characterRules,
    sessionManager,
  });
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

app.whenReady().then(() => {
  loadCharacterPack();
  initBrain();

  const win = createWindow();

  hotkeyManager = new HotkeyManager(win);
  hotkeyManager.register('F2');

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('app:init', {
      character,
      masterSummary: sessionManager.masterSummary,
      permanentMemories: sessionManager.permanentMemories,
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
  try {
    sessionManager.addMessage('user', message, userEmotion);
    db.insertMessage({ role: 'user', content: message, emotion: userEmotion });
    const response = await localBrain.route(message, { userEmotion, attachments });
    sessionManager.addMessage('companion', response.dialogue, response.emotion);
    db.insertMessage({ role: 'companion', content: response.dialogue, emotion: response.emotion });

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
