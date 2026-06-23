// Tiny self-contained binder for the ADVENTURE MUSIC settings panel section.
// Reads/writes via window.musicAPI and pushes runtime changes to MusicPlayer.

(function () {
  const enabledBtn   = document.getElementById('music-enabled-btn');
  const volSlider    = document.getElementById('music-volume');
  const volVal       = document.getElementById('music-volume-val');
  const loopRadios   = document.querySelectorAll('input[name="music-loop"]');
  const fadeSlider   = document.getElementById('music-crossfade');
  const fadeVal      = document.getElementById('music-crossfade-val');
  const statusText   = document.getElementById('music-status-text');

  if (!enabledBtn || !volSlider) return;
  if (!window.musicAPI)          return;

  // ── Load initial state ─────────────────────────────────────────────────
  window.musicAPI.getSettings().then((s) => {
    if (!s) return;
    _renderEnabled(s.enabled);
    volSlider.value = Math.round((s.volume || 0) * 100);
    volVal.textContent = volSlider.value + '%';
    fadeSlider.value = s.crossfadeMs || 2000;
    fadeVal.textContent = fadeSlider.value;
    for (const r of loopRadios) r.checked = (r.value === s.loopMode);
  }).catch(() => {});

  // ── Events ─────────────────────────────────────────────────────────────
  enabledBtn.addEventListener('click', () => {
    const next = !enabledBtn.classList.contains('active');
    _renderEnabled(next);
    window.musicAPI.setSettings({ enabled: next });
    if (window.MusicPlayer) window.MusicPlayer.setEnabled(next);
  });

  volSlider.addEventListener('input', () => {
    const pct = parseInt(volSlider.value, 10);
    volVal.textContent = pct + '%';
    const v = pct / 100;
    window.musicAPI.setSettings({ volume: v });
    if (window.MusicPlayer) window.MusicPlayer.setVolume(v);
  });

  for (const r of loopRadios) {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      window.musicAPI.setSettings({ loopMode: r.value });
      if (window.MusicPlayer) window.MusicPlayer.setLoopMode(r.value);
    });
  }

  fadeSlider.addEventListener('input', () => {
    const ms = parseInt(fadeSlider.value, 10);
    fadeVal.textContent = String(ms);
    window.musicAPI.setSettings({ crossfadeMs: ms });
    // MusicPlayer reads from main on next playCue; live updates aren't needed
    // since the active crossfade has already started.
  });

  // ── Status indicator ───────────────────────────────────────────────────
  document.addEventListener('music:now-playing', (e) => {
    const np = e.detail;
    if (!np)            statusText.textContent = '— stopped —';
    else if (np.paused) statusText.textContent = 'paused: ' + np.name;
    else                statusText.textContent = `▶ ${np.name} (var ${np.variant}) — ${np.energy} ${(np.mood||[]).join('+')}`;
  });

  function _renderEnabled(b) {
    enabledBtn.classList.toggle('active', !!b);
    enabledBtn.textContent = b ? 'ON' : 'OFF';
  }
})();
