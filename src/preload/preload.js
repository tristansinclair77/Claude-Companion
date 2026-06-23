const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('claudeAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Messaging — routes through brain router in main process
  sendMessage: (payload) => ipcRenderer.invoke('claude:send-message', payload),

  // Screen capture
  captureScreen: () => ipcRenderer.invoke('screen:capture'),
  checkVisualTrigger: (msg) => ipcRenderer.invoke('brain:check-visual-trigger', msg),

  // File handling
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  openFolder: () => ipcRenderer.invoke('dialog:open-folder'),

  // Web fetch
  fetchUrl: (url) => ipcRenderer.invoke('web:fetch', url),

  // Feedback signal to brain
  sendFeedback: (message) => ipcRenderer.send('brain:feedback', { message }),

  // Save current conversation to long-term memory
  saveConversation: () => ipcRenderer.invoke('conversation:save'),

  // Remove the last exchange (user message + companion reply) from session memory
  popLastExchange: () => ipcRenderer.invoke('session:pop-last'),

  // Open the message history editor
  openMessageEditor: () => ipcRenderer.send('msgs:open'),

  // Open the emotional axis monitor pop-out
  openEmotionalState: () => ipcRenderer.send('emotional-state:open'),

  // Feature Requests
  getFeatureRequests:    ()   => ipcRenderer.invoke('feature-requests:get'),
  deleteFeatureRequest:  (id) => ipcRenderer.invoke('feature-requests:delete', id),

  // Character management
  listCharacters:  ()       => ipcRenderer.invoke('character:list'),
  switchCharacter: (charId) => ipcRenderer.invoke('character:switch', charId),

  // Fast mode
  getFastMode: ()      => ipcRenderer.invoke('settings:get-fast-mode'),
  setFastMode: (val)   => ipcRenderer.invoke('settings:set-fast-mode', val),

  // Get native file path from a File object (Electron 32+ replacement for file.path)
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Response length
  getResponseLength: ()    => ipcRenderer.invoke('settings:get-response-length'),
  setResponseLength: (val) => ipcRenderer.invoke('settings:set-response-length', val),

  // Personality force override
  getPersona: ()     => ipcRenderer.invoke('persona:get'),
  setPersona: (text) => ipcRenderer.invoke('persona:set', text),
  getPersonaHistory: ()    => ipcRenderer.invoke('persona:history-get'),
  setPersonaHistory: (arr) => ipcRenderer.invoke('persona:history-set', arr),

  // Chat-storage size check (bytes) — used to show a 1 GB warning on startup
  getChatStorageSize: () => ipcRenderer.invoke('storage:get-chat-size'),

  // Portrait panel visibility
  getPortraitVisible: ()      => ipcRenderer.invoke('settings:get-portrait-visible'),
  setPortraitVisible: (val)   => ipcRenderer.invoke('settings:set-portrait-visible', val),

  // Background / display settings
  getBgSettings: ()    => ipcRenderer.invoke('settings:get-bg'),
  setBgSettings: (bg)  => ipcRenderer.invoke('settings:set-bg', bg),

  // UI zoom (percent integer: 75–200)
  getZoom: ()      => ipcRenderer.invoke('settings:get-zoom'),
  setZoom: (pct)   => ipcRenderer.invoke('settings:set-zoom', pct),

  // RVC voice conversion settings
  getRvcConfig: ()      => ipcRenderer.invoke('rvc:get-config'),
  setRvcConfig: (cfg)   => ipcRenderer.invoke('rvc:set-config', cfg),

  // TTS controls
  ttsGetSettings: ()          => ipcRenderer.invoke('tts:get-settings'),
  ttsGetVoices:   ()          => ipcRenderer.invoke('tts:get-voices'),
  ttsSetEnabled:  (val)       => ipcRenderer.invoke('tts:set-enabled', val),
  ttsSetVoice:    (voiceName) => ipcRenderer.invoke('tts:set-voice', voiceName),
  ttsSetRate:     (rate)      => ipcRenderer.invoke('tts:set-rate', rate),

  // Event listeners (renderer ← receives from main)
  on: (channel, callback) => {
    const allowed = [
      'hotkey:mic-toggle',
      'app:init',
      'tts:audio',
      'tts:stop',
      'tts:loading',
      'tts:loading-done',
      'claude:stream-chunk',
      'companion:sensation',
      'companion:trackers',
      'companion:affection',
      'feature-requests:updated',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

// ── Music API ──────────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('musicAPI', {
  getSettings: ()                => ipcRenderer.invoke('music:get-settings'),
  setSettings: (partial)         => ipcRenderer.invoke('music:set-settings', partial),
  playCue:     (idOrName)        => ipcRenderer.invoke('music:play-cue', { idOrName }),
  pause:       ()                => ipcRenderer.invoke('music:pause'),
  resume:      ()                => ipcRenderer.invoke('music:resume'),
  stop:        ()                => ipcRenderer.invoke('music:stop'),
  getBible:    ()                => ipcRenderer.invoke('music:get-bible'),
  onCue:       (cb) => {
    const listener = (_evt, payload) => cb(payload);
    ipcRenderer.on('music:cue', listener);
    return () => ipcRenderer.removeListener('music:cue', listener);
  },
});

// ── Text Adventure API ─────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('adventureAPI', {
  getDisplaySettings: ()        => ipcRenderer.invoke('adventure-display:get-settings'),
  setDisplaySettings: (partial) => ipcRenderer.invoke('adventure-display:set-settings', partial),
  getState:      ()             => ipcRenderer.invoke('adventure:get-state'),
  newGame:       (opts)         => ipcRenderer.invoke('adventure:new-game', opts),
  takeAction:    (action)       => ipcRenderer.invoke('adventure:take-action', { action }),
  resetGame:     ()             => ipcRenderer.invoke('adventure:reset'),
  getLog:        (limit)        => ipcRenderer.invoke('adventure:get-log', { limit }),
  listMonsters:  ()             => ipcRenderer.invoke('adventure:list-monsters'),
  sideChatSend:    (message)    => ipcRenderer.invoke('adventure:side-chat-send', { message }),
  sideChatHistory: ()           => ipcRenderer.invoke('adventure:side-chat-history'),
  sideChatClear:   ()           => ipcRenderer.invoke('adventure:side-chat-clear'),
  onUpdate:    (cb) => {
    const listener = (_evt, payload) => cb(payload);
    ipcRenderer.on('adventure:update', listener);
    return () => ipcRenderer.removeListener('adventure:update', listener);
  },
});
