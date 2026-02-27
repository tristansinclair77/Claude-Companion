'use strict';
// App orchestrator — initializes all modules, wires window controls, handles app:init.

(function() {
  // Window controls
  document.getElementById('btn-minimize').addEventListener('click', () => window.claudeAPI.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.claudeAPI.maximize());
  document.getElementById('btn-close').addEventListener('click',    () => window.claudeAPI.close());

  // Initialize modules
  UIEffects.init();

  EmotionPicker.init((emotionId) => {
    console.log('[EmotionPicker] Selected:', emotionId);
  });

  FileAttach.init();
  ScreenCaptureUI.init();
  MicController.init((transcript) => {
    // When Whisper transcription is ready, auto-fill input
    const input = document.getElementById('user-input');
    if (input && transcript) {
      input.value = transcript;
      input.focus();
    }
  });

  ChatController.init();

  // Handle app:init event from main process (character data, memories, etc.)
  window.claudeAPI.on('app:init', (data) => {
    if (data && data.character) {
      CompanionDisplay.setGreeting(data.character);
    }
  });

  // Focus input on load
  const inputEl = document.getElementById('user-input');
  if (inputEl) setTimeout(() => inputEl.focus(), 300);

  console.log('[App] Claude Companion initialized.');
})();
