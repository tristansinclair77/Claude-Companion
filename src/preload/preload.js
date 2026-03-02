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
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

// ── RPG Addon API ──────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('rpgAPI', {
  getState:          ()                     => ipcRenderer.invoke('rpg:get-state'),
  startAdventure:    (zoneId)               => ipcRenderer.invoke('rpg:start-adventure', { zoneId }),
  takeAction:        (action, payload = {}) => ipcRenderer.invoke('rpg:take-action', { action, payload }),
  endRun:            (result)               => ipcRenderer.invoke('rpg:end-run', { result }),
  getInventory:      ()                     => ipcRenderer.invoke('rpg:get-inventory'),
  equipItem:         (slot, inventoryId)    => ipcRenderer.invoke('rpg:equip-item', { slot, inventoryId }),
  unequipSlot:       (slot)                 => ipcRenderer.invoke('rpg:unequip-slot', { slot }),
  sellItem:          (inventoryId, gold)    => ipcRenderer.invoke('rpg:sell-item', { inventoryId, gold }),
  dropItem:          (inventoryId)          => ipcRenderer.invoke('rpg:drop-item', { inventoryId }),
  getZones:          ()                     => ipcRenderer.invoke('rpg:get-zones'),
  allocateStat:      (stat)                 => ipcRenderer.invoke('rpg:allocate-stat', { stat }),
  getRunHistory:     (limit)                => ipcRenderer.invoke('rpg:get-run-history', { limit }),
  getAchievements:   ()                     => ipcRenderer.invoke('rpg:get-achievements'),
  prestige:          ()                     => ipcRenderer.invoke('rpg:prestige'),
  rest:              ()                     => ipcRenderer.invoke('rpg:rest'),
  openWindow:        (type)                 => ipcRenderer.invoke('rpg:open-window', { type }),
  getResponses:      (scenarioKey)          => ipcRenderer.invoke('rpg:get-responses', { scenarioKey }),
  refreshResponses:  (scenarioKey)          => ipcRenderer.invoke('rpg:refresh-responses', { scenarioKey }),
  runEndBundle:      ()                     => ipcRenderer.invoke('rpg:run-end-bundle'),
  levelUpBundle:     ()                     => ipcRenderer.invoke('rpg:level-up-bundle'),
  getScenarioResponse: (key, gameState)     => ipcRenderer.invoke('rpg:get-scenario-response', { key, gameState }),
  generateResponsePool: (key, gameState)    => ipcRenderer.invoke('rpg:generate-response-pool', { key, gameState }),
  suggestZone:         ()                   => ipcRenderer.invoke('rpg:suggest-zone'),
  openDevTools:        ()                   => ipcRenderer.invoke('rpg:open-devtools'),
});
