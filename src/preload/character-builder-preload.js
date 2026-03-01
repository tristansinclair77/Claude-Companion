const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('charBuilderAPI', {
  minimize:    () =>       ipcRenderer.send('character-builder:minimize'),
  maximize:    () =>       ipcRenderer.send('character-builder:maximize'),
  close:       () =>       ipcRenderer.send('character-builder:close'),

  load:        ()         => ipcRenderer.invoke('character-builder:load'),
  save:        (data)     => ipcRenderer.invoke('character-builder:save', data),
  pickImage:   ()         => ipcRenderer.invoke('character-builder:pick-image'),
  pickSaveDir: ()         => ipcRenderer.invoke('character-builder:pick-save-dir'),
  readImage:   (filePath) => ipcRenderer.invoke('character-builder:read-image', filePath),

  // Wizard: ask Claude to fill in a single field or generate a block.
  // payload: { field, userDescription, characterContext, emotionOptions, imagePaths }
  askClaude:   (payload)  => ipcRenderer.invoke('character-builder:ask-claude', payload),
});
