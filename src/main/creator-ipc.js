'use strict';
/**
 * Creator IPC — standalone Color Scheme Creator and Visual Effects Creator windows.
 *
 * Each window uses creator-preload.js and reads/writes the same bgSettings
 * store as the main companion app (config.json → background key).
 *
 * Window controls use sender-based routing so one set of IPC channels handles
 * both creators without naming conflicts.
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');

let _colorCreatorWin = null;
let _vfxCreatorWin   = null;

// ── Window factory ────────────────────────────────────────────────────────────

function _createWindow(type, parentWindow) {
  const isColor   = type === 'color';
  const existing  = isColor ? _colorCreatorWin : _vfxCreatorWin;

  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }

  const win = new BrowserWindow({
    width:     420,
    height:    isColor ? 740 : 640,
    minWidth:  380,
    minHeight: 480,
    frame:     false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    parent:    parentWindow || undefined,
    webPreferences: {
      preload:          path.join(__dirname, '../preload/creator-preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
    show:      false,
    resizable: true,
    title:     isColor ? 'Color Scheme Creator' : 'Visual Effects Creator',
  });

  const htmlFile = isColor ? 'color-scheme-creator.html' : 'visual-effects-creator.html';
  win.loadFile(path.join(__dirname, '../renderer', htmlFile));
  win.once('ready-to-show', () => win.show());

  if (isColor) {
    _colorCreatorWin = win;
    win.on('closed', () => { _colorCreatorWin = null; });
  } else {
    _vfxCreatorWin = win;
    win.on('closed', () => { _vfxCreatorWin = null; });
  }
}

// ── IPC Registration ──────────────────────────────────────────────────────────

function registerCreatorIPC(mainWindow) {
  // Open commands (emitted by main.js on startup when using --color-creator / --vfx-creator)
  ipcMain.on('color-creator:open', () => _createWindow('color', mainWindow));
  ipcMain.on('vfx-creator:open',   () => _createWindow('vfx',   mainWindow));

  // Window controls — route by sender so both creators share the same channels
  ipcMain.on('creator:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on('creator:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

module.exports = { registerCreatorIPC };
