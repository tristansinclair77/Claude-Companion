'use strict';
// Minimal preload for the standalone Color Scheme Creator and Visual Effects Creator windows.
// Exposes only what the creators need: bg settings load/save + window controls.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('creatorAPI', {
  // Window controls — uses sender-based routing so one preload works for both creators
  minimize: () => ipcRenderer.send('creator:minimize'),
  close:    () => ipcRenderer.send('creator:close'),

  // Visual package settings (same store as the main companion app)
  getBgSettings: ()    => ipcRenderer.invoke('settings:get-bg'),
  setBgSettings: (bg)  => ipcRenderer.invoke('settings:set-bg', bg),
});
