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

  // Event listeners (renderer ← receives from main)
  on: (channel, callback) => {
    const allowed = [
      'app:init',
      // ARCHIVED: TTS channels — voice feature disabled
      // 'tts:audio', 'tts:stop', 'tts:loading', 'tts:loading-done',
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

// ── Text Story API ─────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('storyAPI', {
  catalogs:      ()               => ipcRenderer.invoke('story:catalogs'),
  list:          ()               => ipcRenderer.invoke('story:list'),
  get:           (slug)           => ipcRenderer.invoke('story:get', { slug }),
  create:        (opts)           => ipcRenderer.invoke('story:create', opts),
  generateBlueprint: (slug)       => ipcRenderer.invoke('story:generate-blueprint', { slug }),
  generateDetails:   (slug, force) => ipcRenderer.invoke('story:generate-details',   { slug, force }),
  onDetailsProgress: (cb) => {
    const listener = (_evt, payload) => cb(payload);
    ipcRenderer.on('story:details-progress', listener);
    return () => ipcRenderer.removeListener('story:details-progress', listener);
  },
  delete:        (slug)           => ipcRenderer.invoke('story:delete', { slug }),
  rename:        (slug, title)    => ipcRenderer.invoke('story:rename', { slug, title }),
  updateSettings: (slug, settings) => ipcRenderer.invoke('story:update-settings', { slug, settings }),
  takeTurn:      (opts)           => ipcRenderer.invoke('story:take-turn', opts),
  retryTurn:     (slug)           => ipcRenderer.invoke('story:retry-turn', { slug }),
  setNudge:      (slug, nudge)    => ipcRenderer.invoke('story:set-nudge', { slug, nudge }),
  ask:           (slug, message)  => ipcRenderer.invoke('story:ask', { slug, message }),
  askHistory:    (slug)           => ipcRenderer.invoke('story:ask-history', { slug }),
  askClear:      (slug)           => ipcRenderer.invoke('story:ask-clear', { slug }),
  companionChat:        (slug, message) => ipcRenderer.invoke('story:companion-chat', { slug, message }),
  companionChatHistory: (slug)          => ipcRenderer.invoke('story:companion-chat-history', { slug }),
  companionChatClear:   (slug)          => ipcRenderer.invoke('story:companion-chat-clear', { slug }),
  getDebugSnapshot:     (slug)          => ipcRenderer.invoke('story:get-debug-snapshot', { slug }),
  react:                (slug)          => ipcRenderer.invoke('story:react',                { slug }),
  reactions:            (slug)          => ipcRenderer.invoke('story:reactions',            { slug }),
  suggestChoice:        (slug)          => ipcRenderer.invoke('story:suggest-choice',       { slug }),
  stats:                (slug)          => ipcRenderer.invoke('story:stats',                { slug }),
  bookmarks:            (slug)          => ipcRenderer.invoke('story:bookmarks',            { slug }),
  toggleBookmark:       (slug, logIdx, label) => ipcRenderer.invoke('story:toggle-bookmark', { slug, logIdx, label }),
  exportStory:          (slug, format)  => ipcRenderer.invoke('story:export',               { slug, format }),
  uploadPortrait:       (slug, characterId) => ipcRenderer.invoke('story:upload-portrait',  { slug, characterId }),
  clearPortrait:        (slug, characterId) => ipcRenderer.invoke('story:clear-portrait',   { slug, characterId }),
  listPortraits:        (slug)          => ipcRenderer.invoke('story:list-portraits',       { slug }),
  summarizeOldLog:      (slug, chunkSize) => ipcRenderer.invoke('story:summarize-old-log',  { slug, chunkSize }),
  // Pacing / planning setup chain (STORY_GUIDELINES_PATCH §4)
  generateStoryOverview:    (slug)                  => ipcRenderer.invoke('story:generate-story-overview',    { slug }),
  generateChapterSkeleton:  (slug)                  => ipcRenderer.invoke('story:generate-chapter-skeleton',  { slug }),
  generateEventSkeleton:    (slug, chapterNumber)   => ipcRenderer.invoke('story:generate-event-skeleton',    { slug, chapterNumber }),
  generateEventSummaries:   (slug, eventIds)        => ipcRenderer.invoke('story:generate-event-summaries',   { slug, eventIds }),
  reports:                  (slug)                  => ipcRenderer.invoke('story:reports',                    { slug }),
  onReport: (cb) => {
    const listener = (_evt, payload) => cb(payload);
    ipcRenderer.on('story:report', listener);
    return () => ipcRenderer.removeListener('story:report', listener);
  },
  confirm:       (message, detail, confirmLabel, cancelLabel) =>
    ipcRenderer.invoke('dialog:confirm', { message, detail, confirmLabel, cancelLabel }),
  onUpdate:      (cb) => {
    const listener = (_evt, payload) => cb(payload);
    ipcRenderer.on('story:update', listener);
    return () => ipcRenderer.removeListener('story:update', listener);
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
  askGm:              (message) => ipcRenderer.invoke('adventure:ask-gm', { message }),
  gmChatHistory:      ()        => ipcRenderer.invoke('adventure:gm-chat-history'),
  gmChatClear:        ()        => ipcRenderer.invoke('adventure:gm-chat-clear'),
  clearSessionChats:  ()        => ipcRenderer.invoke('adventure:clear-session-chats'),
  exportGame:      ()           => ipcRenderer.invoke('adventure:export-game'),
  importGame:      ()           => ipcRenderer.invoke('adventure:import-game'),
  confirm:     (message, detail, confirmLabel, cancelLabel) =>
    ipcRenderer.invoke('dialog:confirm', { message, detail, confirmLabel, cancelLabel }),
  retryAction: () => ipcRenderer.invoke('adventure:retry-action'),
  onUpdate:    (cb) => {
    const listener = (_evt, payload) => cb(payload);
    ipcRenderer.on('adventure:update', listener);
    return () => ipcRenderer.removeListener('adventure:update', listener);
  },
});
