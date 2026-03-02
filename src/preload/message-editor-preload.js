'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('msgAPI', {
  list:          ()   => ipcRenderer.invoke('msgs:list'),
  deleteOne:     (id) => ipcRenderer.invoke('msgs:delete-one', id),
  minimize:      ()   => ipcRenderer.send('msgs:minimize'),
  close:         ()   => ipcRenderer.send('msgs:close'),
});
