/**
 * Character Builder IPC Handlers
 * Provides load/save/image-pick operations for the character builder window.
 */

const { ipcMain, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const CHARACTERS_BASE = path.join(__dirname, '../../characters');

let builderWindow = null;

// ── Window ─────────────────────────────────────────────────────────────────────

function createBuilderWindow(parentWindow) {
  if (builderWindow && !builderWindow.isDestroyed()) {
    builderWindow.focus();
    return;
  }

  builderWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    parent: parentWindow || undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/character-builder-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    title: 'Character Builder',
  });

  builderWindow.loadFile(path.join(__dirname, '../renderer/character-builder.html'));
  builderWindow.once('ready-to-show', () => builderWindow.show());
  builderWindow.on('closed', () => { builderWindow = null; });
}

// ── Image Helpers ──────────────────────────────────────────────────────────────

function imageToDataUrl(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) return null;
    const data = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase().slice(1);
    const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch { return null; }
}

// Returns { base: { emotionId: { filePath, dataUrl } }, combined: { ... } }
function loadEmotionImages(characterDir) {
  const emotionsDir = path.join(characterDir, 'emotions');
  const combinedDir = path.join(emotionsDir, 'combined');
  const result = { base: {}, combined: {} };

  if (fs.existsSync(emotionsDir)) {
    const files = fs.readdirSync(emotionsDir)
      .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
    for (const file of files) {
      const emotionId = path.basename(file, path.extname(file));
      const filePath = path.join(emotionsDir, file);
      result.base[emotionId] = { filePath, dataUrl: null }; // dataUrl loaded lazily
    }
  }

  if (fs.existsSync(combinedDir)) {
    const files = fs.readdirSync(combinedDir)
      .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
    for (const file of files) {
      const emotionId = path.basename(file, path.extname(file));
      const filePath = path.join(combinedDir, file);
      result.combined[emotionId] = { filePath, dataUrl: null };
    }
  }

  return result;
}

// ── IPC Registration ───────────────────────────────────────────────────────────

function registerCharacterBuilderIPC(mainWindow) {
  ipcMain.on('character-builder:open', () => {
    createBuilderWindow(mainWindow);
  });

  ipcMain.on('character-builder:minimize', () => builderWindow?.minimize());
  ipcMain.on('character-builder:maximize', () => {
    builderWindow?.isMaximized() ? builderWindow.unmaximize() : builderWindow?.maximize();
  });
  ipcMain.on('character-builder:close', () => builderWindow?.close());

  // Load character from a directory the user picks
  ipcMain.handle('character-builder:load', async () => {
    const win = builderWindow || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Character Directory',
      defaultPath: CHARACTERS_BASE,
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true };

    const characterDir = result.filePaths[0];

    let character = {};
    let rules = { character: '', version: '1.0.0', rules: [] };
    let fillerResponses = {};
    let appearance = {};

    try {
      const p = path.join(characterDir, 'character.json');
      if (fs.existsSync(p)) character = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}

    try {
      const p = path.join(characterDir, 'rules.json');
      if (fs.existsSync(p)) rules = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}

    try {
      const p = path.join(characterDir, 'filler-responses.json');
      if (fs.existsSync(p)) fillerResponses = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}

    try {
      const appFile = character.appearance_file || 'appearance.json';
      const p = path.join(characterDir, appFile);
      if (fs.existsSync(p)) appearance = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {}

    const emotionImages = loadEmotionImages(characterDir);

    return { success: true, characterDir, character, rules, fillerResponses, appearance, emotionImages };
  });

  // Pick a single image file
  ipcMain.handle('character-builder:pick-image', async () => {
    const win = builderWindow || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { success: false };
    const filePath = result.filePaths[0];
    const dataUrl = imageToDataUrl(filePath);
    return { success: true, filePath, dataUrl };
  });

  // Pick a directory to save a new character into
  ipcMain.handle('character-builder:pick-save-dir', async () => {
    const win = builderWindow || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose folder to save character into (create new folder here)',
      defaultPath: CHARACTERS_BASE,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { success: false };
    return { success: true, dirPath: result.filePaths[0] };
  });

  // Read a single image as base64 data URL (lazy portrait loading)
  ipcMain.handle('character-builder:read-image', (event, filePath) => {
    const dataUrl = imageToDataUrl(filePath);
    return { success: !!dataUrl, dataUrl };
  });

  // Save character to disk
  ipcMain.handle('character-builder:save', async (event, data) => {
    try {
      const { characterDir, character, rules, fillerResponses, appearance, emotionImages, combinedEmotionImages } = data;
      if (!characterDir) return { success: false, error: 'No save directory specified.' };

      fs.mkdirSync(characterDir, { recursive: true });

      fs.writeFileSync(path.join(characterDir, 'character.json'), JSON.stringify(character, null, 2), 'utf-8');
      fs.writeFileSync(path.join(characterDir, 'rules.json'), JSON.stringify(rules, null, 2), 'utf-8');
      fs.writeFileSync(path.join(characterDir, 'filler-responses.json'), JSON.stringify(fillerResponses, null, 2), 'utf-8');

      const appearanceFile = character.appearance_file || 'appearance.json';
      if (Object.keys(appearance).length > 0) {
        fs.writeFileSync(path.join(characterDir, appearanceFile), JSON.stringify(appearance, null, 2), 'utf-8');
      }

      // Copy/save emotion images
      const emotionsDir = path.join(characterDir, 'emotions');
      fs.mkdirSync(emotionsDir, { recursive: true });

      if (emotionImages) {
        for (const [emotionId, filePath] of Object.entries(emotionImages)) {
          if (!filePath) continue;
          const destFile = path.join(emotionsDir, `${emotionId}.png`);
          try {
            if (path.resolve(filePath) !== path.resolve(destFile)) {
              fs.copyFileSync(filePath, destFile);
            }
          } catch (e) {
            console.warn(`[CharBuilder] Could not copy image for ${emotionId}:`, e.message);
          }
        }
      }

      if (combinedEmotionImages) {
        const combinedDir = path.join(emotionsDir, 'combined');
        fs.mkdirSync(combinedDir, { recursive: true });
        for (const [emotionId, filePath] of Object.entries(combinedEmotionImages)) {
          if (!filePath) continue;
          const destFile = path.join(combinedDir, `${emotionId}.png`);
          try {
            if (path.resolve(filePath) !== path.resolve(destFile)) {
              fs.copyFileSync(filePath, destFile);
            }
          } catch (e) {
            console.warn(`[CharBuilder] Could not copy combined image for ${emotionId}:`, e.message);
          }
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerCharacterBuilderIPC };
