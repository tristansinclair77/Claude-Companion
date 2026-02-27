const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('debugAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('debug-viewer:minimize'),
  maximize: () => ipcRenderer.send('debug-viewer:maximize'),
  close:    () => ipcRenderer.send('debug-viewer:close'),

  // Session data
  listSlots:   ()     => ipcRenderer.invoke('debug-viewer:list-slots'),
  loadSession: (slot) => ipcRenderer.invoke('debug-viewer:load-session', slot),

  // Pop-outs
  openSysPrompt:     (text) => ipcRenderer.send('debug-viewer:open-sysprompt', text),
  openExtractResult: (html) => ipcRenderer.send('debug-viewer:open-extract-result', html),

  // Saved conversations
  listSavedConversations: () => ipcRenderer.invoke('debug-viewer:list-saved-conversations'),
  loadSavedConversation:  (id) => ipcRenderer.invoke('debug-viewer:load-saved-conversation', id),

  // Pin a slot to saved-N (immune to rotation)
  pinSlot: (slot) => ipcRenderer.invoke('debug-viewer:pin-slot', slot),

  // Save a debug slot session to memory
  saveSlotToMemory: (slot) => ipcRenderer.invoke('debug-viewer:save-slot-to-memory', slot),

  // Extract memories from a slot or saved conversation
  extractMemories: (opts) => ipcRenderer.invoke('debug-viewer:extract-memories', opts),
});

// Also expose a minimal close API so the system-prompt pop-out window can close itself.
// The pop-out is loaded as a data: URL so it can't use Node — it just calls this.
contextBridge.exposeInMainWorld('syspromptAPI', {
  close: () => ipcRenderer.send('debug-viewer:close'),
});
