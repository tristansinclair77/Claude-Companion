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

  // Emotional axis monitor pop-out
  document.getElementById('btn-axis').addEventListener('click', () => {
    window.claudeAPI.openEmotionalState();
  });

// Character selector — name display + picker dropdown
  const charSelector = document.getElementById('char-selector');
  const charPicker   = document.getElementById('char-picker');
  const charNameEl   = document.getElementById('char-name');

  charSelector.addEventListener('click', async () => {
    if (!charPicker.classList.contains('hidden')) {
      charPicker.classList.add('hidden');
      return;
    }
    const chars = await window.claudeAPI.listCharacters();
    charPicker.innerHTML = chars.map((c) =>
      `<div class="char-option${c.active ? ' active' : ''}" data-id="${c.id}">${c.name}</div>`
    ).join('');
    charPicker.querySelectorAll('.char-option').forEach((el) => {
      el.addEventListener('click', () => {
        charPicker.classList.add('hidden');
        if (!el.classList.contains('active')) {
          window.claudeAPI.switchCharacter(el.dataset.id);
        }
      });
    });
    charPicker.classList.remove('hidden');
  });

  // Close picker when clicking outside it
  document.addEventListener('click', (e) => {
    if (!charSelector.contains(e.target) && !charPicker.contains(e.target)) {
      charPicker.classList.add('hidden');
    }
  });

  // Handle app:init event from main process (character data, memories, etc.)
  window.claudeAPI.on('app:init', (data) => {
    if (data && data.character) {
      charNameEl.textContent = data.character.name.toUpperCase();
      CompanionDisplay.setGreeting(data.character, data.emotionalState || null);
    }
  });

  // Focus input on load
  const inputEl = document.getElementById('user-input');
  if (inputEl) setTimeout(() => inputEl.focus(), 300);

  console.log('[App] Claude Companion initialized.');
})();
