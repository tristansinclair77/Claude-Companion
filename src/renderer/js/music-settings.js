// Binder for the settings-panel music controls.
//
// Three volume sliders — one per app mode — each writing to its own slot
// (companion / adventure / story). The music player picks the correct slot
// automatically based on which mode class is on <body>, so a 50% Companion
// setting and 100% Adventure setting are BOTH respected simultaneously.

(function () {
  const enabledBtn   = document.getElementById('music-enabled-btn');
  const volCompanion = document.getElementById('music-volume-companion');
  const volCompVal   = document.getElementById('music-volume-companion-val');
  const volAdventure = document.getElementById('music-volume-adventure');
  const volAdvVal    = document.getElementById('music-volume-adventure-val');
  const volStory     = document.getElementById('music-volume-story');
  const volStoryVal  = document.getElementById('music-volume-story-val');
  const loopRadios   = document.querySelectorAll('input[name="music-loop"]');
  const fadeSlider   = document.getElementById('music-crossfade');
  const fadeVal      = document.getElementById('music-crossfade-val');
  const statusText   = document.getElementById('music-status-text');

  if (!window.musicAPI) return;

  // ── Helpers ────────────────────────────────────────────────────────────
  function _setSlider(slider, valEl, pct) {
    if (!slider) return;
    slider.value = pct;
    if (valEl) valEl.textContent = pct + '%';
  }

  function _wireVolumeSlider(slider, valEl, mode) {
    if (!slider) return;
    slider.addEventListener('input', () => {
      const pct = parseInt(slider.value, 10);
      if (valEl) valEl.textContent = pct + '%';
      const v = pct / 100;
      // Write ONLY this mode's slot. Music engine picks the right slot
      // based on the current body-class mode.
      window.musicAPI.setSettings({ volumes: { [mode]: v } });
      if (window.MusicPlayer) window.MusicPlayer.setVolume(v, { mode });
    });
  }

  // ── Load initial state ─────────────────────────────────────────────────
  window.musicAPI.getSettings().then((s) => {
    if (!s) return;
    _renderEnabled(s.enabled);
    const vols = s.volumes || {};
    _setSlider(volCompanion, volCompVal, Math.round((vols.companion ?? s.volume ?? 0.5) * 100));
    _setSlider(volAdventure, volAdvVal,  Math.round((vols.adventure ?? s.volume ?? 0.5) * 100));
    _setSlider(volStory,     volStoryVal, Math.round((vols.story     ?? s.volume ?? 0.5) * 100));
    if (fadeSlider) {
      fadeSlider.value = s.crossfadeMs || 2000;
      if (fadeVal) fadeVal.textContent = fadeSlider.value;
    }
    for (const r of loopRadios) r.checked = (r.value === s.loopMode);
  }).catch(() => {});

  // ── Events ─────────────────────────────────────────────────────────────
  if (enabledBtn) {
    enabledBtn.addEventListener('click', () => {
      const next = !enabledBtn.classList.contains('active');
      _renderEnabled(next);
      window.musicAPI.setSettings({ enabled: next });
      if (window.MusicPlayer) window.MusicPlayer.setEnabled(next);
    });
  }

  _wireVolumeSlider(volCompanion, volCompVal,  'companion');
  _wireVolumeSlider(volAdventure, volAdvVal,   'adventure');
  _wireVolumeSlider(volStory,     volStoryVal, 'story');

  for (const r of loopRadios) {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      window.musicAPI.setSettings({ loopMode: r.value });
      if (window.MusicPlayer) window.MusicPlayer.setLoopMode(r.value);
    });
  }

  if (fadeSlider) {
    fadeSlider.addEventListener('input', () => {
      const ms = parseInt(fadeSlider.value, 10);
      if (fadeVal) fadeVal.textContent = String(ms);
      window.musicAPI.setSettings({ crossfadeMs: ms });
    });
  }

  // ── Status indicator ───────────────────────────────────────────────────
  document.addEventListener('music:now-playing', (e) => {
    if (!statusText) return;
    const np = e.detail;
    if (!np)            statusText.textContent = '— stopped —';
    else if (np.paused) statusText.textContent = 'paused: ' + np.name;
    else                statusText.textContent = `▶ ${np.name} (var ${np.variant}) — ${np.energy} ${(np.mood||[]).join('+')}`;
  });

  function _renderEnabled(b) {
    if (!enabledBtn) return;
    enabledBtn.classList.toggle('active', !!b);
    enabledBtn.textContent = b ? 'ON' : 'OFF';
  }
})();
