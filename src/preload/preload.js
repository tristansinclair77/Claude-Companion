const { contextBridge, ipcRenderer } = require('electron');

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

  // Save current conversation to Aria's long-term memory
  saveConversation: () => ipcRenderer.invoke('conversation:save'),

  // Open the emotional axis monitor pop-out
  openEmotionalState: () => ipcRenderer.send('emotional-state:open'),

  // Character management
  listCharacters:  ()       => ipcRenderer.invoke('character:list'),
  switchCharacter: (charId) => ipcRenderer.invoke('character:switch', charId),

  // Fast mode
  getFastMode: ()      => ipcRenderer.invoke('settings:get-fast-mode'),
  setFastMode: (val)   => ipcRenderer.invoke('settings:set-fast-mode', val),

  // Background / display settings
  getBgSettings: ()    => ipcRenderer.invoke('settings:get-bg'),
  setBgSettings: (bg)  => ipcRenderer.invoke('settings:set-bg', bg),

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
      'claude:stream-chunk',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
