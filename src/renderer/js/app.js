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
  PersonaPopup.init();
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
  BackgroundSettings.init();
  RvcSettings.init();

  // Emotional axis monitor pop-out
  document.getElementById('btn-axis').addEventListener('click', () => {
    window.claudeAPI.openEmotionalState();
  });

  // Message history editor
  document.getElementById('btn-msg-editor').addEventListener('click', () => {
    window.claudeAPI.openMessageEditor();
  });

  // Tracker popup toggle
  const btnTrackers    = document.getElementById('btn-trackers');
  const trackerPopup   = document.getElementById('tracker-popup');
  btnTrackers?.addEventListener('click', (e) => {
    e.stopPropagation();
    trackerPopup?.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!trackerPopup?.classList.contains('hidden') &&
        !trackerPopup?.contains(e.target) &&
        e.target !== btnTrackers) {
      trackerPopup?.classList.add('hidden');
    }
  });

  // Fast mode toggle
  const btnFast = document.getElementById('btn-fast');
  function _applyFastBtn(active) {
    if (active) {
      btnFast.classList.add('active');
      btnFast.title = 'Fast mode ON — brief responses, Haiku model, limited file reading (click to disable)';
    } else {
      btnFast.classList.remove('active');
      btnFast.title = 'Fast mode: brief responses, Haiku model, limited file reading';
    }
  }
  window.claudeAPI.getFastMode().then(_applyFastBtn);
  btnFast.addEventListener('click', async () => {
    const current = btnFast.classList.contains('active');
    const next = await window.claudeAPI.setFastMode(!current);
    _applyFastBtn(next);
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
      if (data.characterId) {
        CompanionDisplay.setCharacterDir(`../../characters/${data.characterId}`);
      }
      CompanionDisplay.setGreeting(data.character, data.emotionalState || null);
    }
    if (data && data.fastMode !== undefined) {
      _applyFastBtn(data.fastMode);
    }
    if (data && data.trackers) {
      CompanionDisplay.updateTrackers(data.trackers);
    }
  });

  // Tracker update — Aria decided to record something
  window.claudeAPI.on('companion:trackers', (data) => {
    CompanionDisplay?.updateTrackers?.(data.trackers);
  });

  // Sensation pulse — flash indicator near portrait on physical sensation events
  window.claudeAPI.on('companion:sensation', (data) => {
    CompanionDisplay?.showSensationPulse?.(data.delta, data.lingers);
    CompanionDisplay?.updateSensationReadout?.(data.current);
  });

  // ── RPG Adventure — opens as a pop-out window ─────────────────────────────
  if (typeof RPGPanel !== 'undefined') {
    RPGPanel.init();
    const btnAdventure = document.getElementById('btn-adventure');
    if (btnAdventure) {
      btnAdventure.addEventListener('click', () => window.rpgAPI.openWindow('adventure'));
    }
  }

  // Focus input on load
  const inputEl = document.getElementById('user-input');
  if (inputEl) setTimeout(() => inputEl.focus(), 300);

  console.log('[App] Claude Companion initialized.');
})();
