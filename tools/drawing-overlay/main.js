const { app, BrowserWindow, globalShortcut, ipcMain, dialog, screen } = require('electron');
const path = require('path');

let win = null;
let isClickThrough = false;
let currentOpacity = 0.5;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(false);
}

function setClickThrough(enabled) {
  isClickThrough = enabled;
  win.setIgnoreMouseEvents(enabled, { forward: true });
  win.webContents.send('click-through-changed', enabled);
  win.setOpacity(enabled ? currentOpacity : 1.0);
}

function adjustOpacity(delta) {
  currentOpacity = Math.min(0.95, Math.max(0.05, currentOpacity + delta));
  if (isClickThrough) win.setOpacity(currentOpacity);
  win.webContents.send('opacity-changed', currentOpacity);
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+T', () => {
    setClickThrough(!isClickThrough);
  });

  globalShortcut.register('CommandOrControl+Shift+Up', () => {
    adjustOpacity(0.05);
  });

  globalShortcut.register('CommandOrControl+Shift+Down', () => {
    adjustOpacity(-0.05);
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// --- IPC ---

ipcMain.handle('open-image', async () => {
  win.setAlwaysOnTop(false);
  const result = await dialog.showOpenDialog({
    title: 'Open Reference Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }],
    properties: ['openFile'],
  });
  win.setAlwaysOnTop(true, 'floating');
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('toggle-click-through', () => {
  setClickThrough(!isClickThrough);
  return isClickThrough;
});

ipcMain.handle('set-opacity', (_e, value) => {
  currentOpacity = value;
  if (isClickThrough) win.setOpacity(currentOpacity);
});

ipcMain.handle('get-state', () => ({ isClickThrough, opacity: currentOpacity }));

ipcMain.handle('resize-to-image', (_e, imgWidth, imgHeight) => {
  // Add toolbar height (38px) to image height
  const TOOLBAR_H = 38;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.min(imgWidth, sw);
  const h = Math.min(imgHeight + TOOLBAR_H, sh);
  win.setSize(w, h);
});

ipcMain.handle('close', () => {
  win.destroy();
});

app.on('window-all-closed', () => app.quit());
