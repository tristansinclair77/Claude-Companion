'use strict';
// App orchestrator — initializes all modules, wires window controls, handles app:init.

(function() {
  // Window controls
  document.getElementById('btn-minimize').addEventListener('click', () => window.claudeAPI.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.claudeAPI.maximize());
  document.getElementById('btn-close').addEventListener('click',    () => window.claudeAPI.close());

  // Portrait panel toggle
  const btnPortrait = document.getElementById('btn-portrait');
  function _applyPortraitVisible(visible) {
    document.body.classList.toggle('portrait-hidden', !visible);
    btnPortrait.classList.toggle('active', !visible);
    btnPortrait.title = visible ? 'Hide portrait panel' : 'Show portrait panel';
  }
  window.claudeAPI.getPortraitVisible().then(_applyPortraitVisible);
  btnPortrait.addEventListener('click', async () => {
    const visible = document.body.classList.contains('portrait-hidden');
    const next = await window.claudeAPI.setPortraitVisible(visible);
    _applyPortraitVisible(next);
  });

  // Initialize modules
  UIEffects.init();

  EmotionPicker.init((emotionId) => {
    console.log('[EmotionPicker] Selected:', emotionId);
  });

  FileAttach.init();
  PersonaPopup.init();
  ScreenCaptureUI.init();

  ChatController.init();
  BackgroundSettings.init();
  HelpPanel.init();
  MusicSelector.init();

  // Chat-storage size warning — fires once on startup if knowledge.db > 1 GB.
  // The DB never auto-prunes, so this is the user's nudge to clean things up.
  (async () => {
    const WARN_THRESHOLD = 1024 * 1024 * 1024; // 1 GB
    try {
      const { bytes } = await window.claudeAPI.getChatStorageSize();
      if (typeof bytes !== 'number' || bytes < WARN_THRESHOLD) return;
      const banner   = document.getElementById('storage-warning');
      const text     = document.getElementById('storage-warning-text');
      const dismiss  = document.getElementById('storage-warning-dismiss');
      if (!banner || !text || !dismiss) return;
      const gb = (bytes / (1024 * 1024 * 1024)).toFixed(2);
      text.innerHTML =
        `⚠ Chat storage is <strong>${gb} GB</strong>. Consider archiving or deleting old messages ` +
        `from the message editor to keep performance snappy.`;
      banner.classList.remove('hidden');
      dismiss.addEventListener('click', () => banner.classList.add('hidden'), { once: true });
    } catch (err) {
      console.warn('[App] Storage size check failed:', err);
    }
  })();

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
    // Apply build mode class before any other rendering runs so DEBUG-only
    // elements never flash on-screen in a PUBLIC build.
    const mode = (data && data.buildMode === 'public') ? 'public' : 'debug';
    document.body.classList.add('build-' + mode);
    // Also expose for JS code that wants to gate features
    window.BUILD_MODE     = mode;
    window.IS_DEBUG_BUILD = (mode === 'debug');
    window.IS_PUBLIC_BUILD = (mode === 'public');

    if (data && data.character) {
      charNameEl.textContent = data.character.name.toUpperCase();
      if (data.characterId) {
        CompanionDisplay.setCharacterDir(`../../characters/${data.characterId}`);
      }
      // Apply persisted body state (clothing + cum) so portrait variants
      // resolve correctly even before the first Claude turn.
      if (data.bodyState) CompanionDisplay.setBodyState(data.bodyState);

      // Restore the last on-screen state if we have one — keeps the screen
      // continuous across app restarts. Falls back to the canned greeting on
      // a fresh install or when no companion message has been saved yet.
      if (data.lastDisplay && data.lastDisplay.dialogue) {
        CompanionDisplay.restoreLastDisplay(data.lastDisplay, data.emotionalState || null, data.bodyState || null);
      } else {
        CompanionDisplay.setGreeting(data.character, data.emotionalState || null);
      }
    }
    if (data && data.fastMode !== undefined) {
      _applyFastBtn(data.fastMode);
    }
    if (data && data.trackers) {
      CompanionDisplay.updateTrackers(data.trackers);
    }
    if (data && typeof data.affection === 'number') {
      CompanionDisplay.updateAffectionHeart(data.affection);
    }
  });

  // Tracker update — Aria decided to record something
  window.claudeAPI.on('companion:trackers', (data) => {
    CompanionDisplay?.updateTrackers?.(data.trackers);
  });

  // Affection heart — Aria sets her felt connection level each response
  window.claudeAPI.on('companion:affection', (data) => {
    CompanionDisplay?.updateAffectionHeart?.(data.value);
  });

  // Sensation pulse — flash indicator near portrait on physical sensation events
  window.claudeAPI.on('companion:sensation', (data) => {
    CompanionDisplay?.showSensationPulse?.(data.delta, data.lingers);
    CompanionDisplay?.updateSensationReadout?.(data.current);
  });

  // ── Text Adventure — inline CRT terminal swaps the chat conversation column ──
  if (typeof TextAdventure !== 'undefined') {
    TextAdventure.init();
    const btnAdventure = document.getElementById('btn-adventure');
    if (btnAdventure) {
      btnAdventure.addEventListener('click', () => TextAdventure.toggle());
    }
  }

  // ── Text Story — narrative panel, no Aria involvement ──────────────────────
  if (typeof TextStory !== 'undefined') {
    TextStory.init();
    const btnStory = document.getElementById('btn-story');
    if (btnStory) {
      btnStory.addEventListener('click', () => TextStory.toggle());
    }
  }

  // Focus input on load
  const inputEl = document.getElementById('user-input');
  if (inputEl) setTimeout(() => inputEl.focus(), 300);

  console.log('[App] Claude Companion initialized.');
})();
