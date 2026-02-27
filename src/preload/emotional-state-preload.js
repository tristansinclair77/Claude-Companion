const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('axisAPI', {
  minimize: () => ipcRenderer.send('emotional-state:minimize'),
  close:    () => ipcRenderer.send('emotional-state:close'),

  // Request the current state from main
  getState: () => ipcRenderer.invoke('emotional-state:get'),

  // Reset axes to neutral baseline
  reset: () => ipcRenderer.invoke('emotional-state:reset'),

  // Live update stream — main pushes state on every response
  on: (channel, callback) => {
    if (channel === 'state:update') {
      ipcRenderer.on('state:update', (event, ...args) => callback(...args));
    }
  },
});
