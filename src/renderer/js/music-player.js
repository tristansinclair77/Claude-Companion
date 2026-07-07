// Music Player — renderer module that owns two HTML5 <audio> elements and
// performs crossfades / hard loops between them.
//
// Receives play requests from the main process via window.musicAPI.onCue.
// Persists volume + loop mode + enabled toggles via the main-process config.

const MusicPlayer = (function () {
  const CROSSFADE_MS_DEFAULT = 2000;
  const LOOP_OVERLAP_MS      = 1800;  // start the loop fade-in this many ms before the natural end

  // ── State ─────────────────────────────────────────────────────────────────
  let _audA, _audB;
  let _active = 'A';          // which element is currently the primary
  let _enabled    = true;
  // Per-mode volume slots. The active volume is whichever slot matches
  // the current app mode (companion / adventure / story). Music re-adjusts
  // automatically when the user switches modes so a 50% Companion setting
  // and 100% Adventure setting are BOTH respected.
  let _volumes    = { companion: 0.50, adventure: 0.50, story: 0.50 };
  let _loopMode   = 'crossfade';  // 'crossfade' | 'finish_restart'
  let _crossfadeMs = CROSSFADE_MS_DEFAULT;

  // Read current mode from body class. Adventure and Story are mutually
  // exclusive; Companion is the default when neither is active.
  function _currentMode() {
    if (document.body.classList.contains('adventure-mode')) return 'adventure';
    if (document.body.classList.contains('story-mode'))     return 'story';
    return 'companion';
  }
  function _effectiveVolume() {
    const m = _currentMode();
    const v = _volumes[m];
    return typeof v === 'number' ? v : 0.5;
  }

  let _currentCue = null;      // { bibleId, name, file, variant, ... } or null
  let _pausedByUser = false;
  let _loopWatcher  = null;    // setInterval handle

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    _audA = new Audio();
    _audB = new Audio();
    for (const a of [_audA, _audB]) {
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';
      a.volume = 0;
    }
    // Pull persisted settings from main
    try {
      const s = await window.musicAPI.getSettings();
      if (s) {
        if (typeof s.enabled  === 'boolean') _enabled  = s.enabled;
        if (s.volumes && typeof s.volumes === 'object') {
          if (typeof s.volumes.companion === 'number') _volumes.companion = s.volumes.companion;
          if (typeof s.volumes.adventure === 'number') _volumes.adventure = s.volumes.adventure;
          if (typeof s.volumes.story     === 'number') _volumes.story     = s.volumes.story;
        } else if (typeof s.volume === 'number') {
          _volumes.companion = _volumes.adventure = _volumes.story = s.volume;
        }
        if (typeof s.loopMode === 'string')  _loopMode = s.loopMode;
        if (typeof s.crossfadeMs === 'number') _crossfadeMs = s.crossfadeMs;
      }
    } catch (e) { /* fine, use defaults */ }

    // Watch for mode changes on body class — when the user enters/exits
    // Adventure or Story, the effective volume slot flips; the currently
    // playing track needs to smoothly rebalance to the new slot.
    const modeObserver = new MutationObserver(() => {
      const cur = _active === 'A' ? _audA : _audB;
      if (cur && !cur.paused) cur.volume = _effectiveVolume();
    });
    modeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Subscribe to push directives from the main process
    if (window.musicAPI && typeof window.musicAPI.onCue === 'function') {
      window.musicAPI.onCue((payload) => {
        _handleCueDirective(payload);
      });
    }

    _startLoopWatcher();
    console.log('[MusicPlayer] initialized — volumes:', _volumes, 'loopMode:', _loopMode, 'enabled:', _enabled);
  }

  // ── Cue directive entry point ─────────────────────────────────────────────
  // payload = { kind: 'play'|'pause'|'resume'|'stop', cue?: {...} }
  function _handleCueDirective(payload) {
    if (!payload || !payload.kind) return;
    switch (payload.kind) {
      case 'play':   playCue(payload.cue); break;
      case 'pause':  pause();              break;
      case 'resume': resume();             break;
      case 'stop':   stop();               break;
      case 'volume': setVolume(payload.value); break;
      case 'loop_mode': setLoopMode(payload.value); break;
      case 'enabled':  setEnabled(payload.value); break;
    }
  }

  // ── Public ────────────────────────────────────────────────────────────────
  function playCue(cue) {
    if (!_enabled || !cue || !cue.file) return;

    // Idempotent: same cue + same variant is a no-op (don't restart the track).
    if (_currentCue && _currentCue.bibleId === cue.bibleId && _currentCue.variant === cue.variant) {
      _onNowPlayingChanged();   // re-broadcast so the UI re-syncs on tab focus etc.
      return;
    }
    // Same cue but different variant — keep playing the current variant rather
    // than thrash. Only re-pick on next scene change.
    if (_currentCue && _currentCue.bibleId === cue.bibleId) {
      _currentCue = { ..._currentCue, ...cue, file: _currentCue.file, variant: _currentCue.variant };
      _onNowPlayingChanged();
      return;
    }
    _currentCue = cue;
    _pausedByUser = false;
    _crossfadeTo(cue.file);
    _onNowPlayingChanged();
  }

  function pause() {
    _pausedByUser = true;
    const cur = _active === 'A' ? _audA : _audB;
    try { cur.pause(); } catch {}
    _onNowPlayingChanged();
  }

  function resume() {
    _pausedByUser = false;
    const cur = _active === 'A' ? _audA : _audB;
    if (cur.src) {
      try { cur.play().catch(() => {}); } catch {}
    }
    _onNowPlayingChanged();
  }

  function stop() {
    _pausedByUser = false;
    _currentCue = null;
    _fadeAndStop(_audA, 300);
    _fadeAndStop(_audB, 300);
    _onNowPlayingChanged();
  }

  // setVolume(value, opts?) — writes to the given mode slot (defaults to
  // the current mode). Renderer UIs pass their mode explicitly so the
  // Companion slider always writes companion, the Adventure slider always
  // writes adventure, etc., regardless of what mode is currently active.
  function setVolume(v, opts = {}) {
    const value = Math.max(0, Math.min(1, Number(v) || 0));
    const mode  = (opts.mode === 'adventure' || opts.mode === 'story' || opts.mode === 'companion')
      ? opts.mode
      : _currentMode();
    _volumes[mode] = value;
    // If the slot we just wrote is the CURRENTLY-EFFECTIVE one, apply live.
    if (mode === _currentMode()) {
      const cur = _active === 'A' ? _audA : _audB;
      if (cur && !cur.paused) cur.volume = value;
    }
    window.musicAPI && window.musicAPI.setSettings({ volumes: { [mode]: value } });
  }
  function getVolumes() { return { ...volumesSnapshot() }; }
  function volumesSnapshot() { return { companion: _volumes.companion, adventure: _volumes.adventure, story: _volumes.story }; }

  function setLoopMode(mode) {
    if (mode !== 'crossfade' && mode !== 'finish_restart') return;
    _loopMode = mode;
    window.musicAPI && window.musicAPI.setSettings({ loopMode: _loopMode });
  }

  function setEnabled(b) {
    _enabled = !!b;
    if (!_enabled) stop();
    window.musicAPI && window.musicAPI.setSettings({ enabled: _enabled });
  }

  function getNowPlaying() {
    if (!_currentCue) return null;
    const cur = _active === 'A' ? _audA : _audB;
    return {
      ..._currentCue,
      paused: _pausedByUser || (cur && cur.paused),
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  function _toFileUrl(p) {
    // Convert Windows absolute path → file:/// URL
    return 'file:///' + p.replace(/\\/g, '/').replace(/ /g, '%20').replace(/#/g, '%23').replace(/\?/g, '%3F');
  }

  function _crossfadeTo(filePath) {
    const next   = _active === 'A' ? _audB : _audA;
    const prev   = _active === 'A' ? _audA : _audB;
    next.src     = _toFileUrl(filePath);
    next.volume  = 0;
    next.loop    = false;  // loop is hand-rolled per mode
    const playPromise = next.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch((e) => console.warn('[MusicPlayer] play failed:', e && e.message));
    }
    _active = _active === 'A' ? 'B' : 'A';
    _fadeVolume(next, 0, _effectiveVolume(), _crossfadeMs);
    _fadeVolume(prev, prev.volume, 0, _crossfadeMs, () => { try { prev.pause(); } catch {} prev.src = ''; });
  }

  function _fadeAndStop(audio, ms) {
    if (!audio || !audio.src) return;
    _fadeVolume(audio, audio.volume, 0, ms, () => { try { audio.pause(); } catch {} audio.src = ''; });
  }

  function _fadeVolume(audio, from, to, ms, done) {
    if (!audio) { done && done(); return; }
    const steps = Math.max(8, Math.floor(ms / 40));
    const dv = (to - from) / steps;
    let i = 0;
    const tick = () => {
      i += 1;
      audio.volume = Math.max(0, Math.min(1, from + dv * i));
      if (i >= steps) {
        audio.volume = to;
        done && done();
        return;
      }
      setTimeout(tick, ms / steps);
    };
    audio.volume = from;
    setTimeout(tick, ms / steps);
  }

  // Polls the active element near end-of-file so we can perform the loop.
  function _startLoopWatcher() {
    if (_loopWatcher) clearInterval(_loopWatcher);
    _loopWatcher = setInterval(() => {
      if (!_currentCue || _pausedByUser) return;
      const cur = _active === 'A' ? _audA : _audB;
      if (!cur || !cur.duration || isNaN(cur.duration) || cur.duration === Infinity) return;
      const remaining = (cur.duration - cur.currentTime) * 1000;
      if (_loopMode === 'crossfade') {
        if (remaining > 0 && remaining < LOOP_OVERLAP_MS && !cur._loopFiring) {
          cur._loopFiring = true;
          // Crossfade into the same file from the start
          _crossfadeTo(_currentCue.file);
          setTimeout(() => { cur._loopFiring = false; }, _crossfadeMs + 400);
        }
      } else { // finish_restart
        if (cur.ended && !cur._restartFiring) {
          cur._restartFiring = true;
          cur.currentTime = 0;
          cur.volume = _effectiveVolume();
          const p = cur.play();
          if (p && typeof p.then === 'function') p.catch(() => {});
          setTimeout(() => { cur._restartFiring = false; }, 300);
        }
      }
    }, 250);
  }

  function _onNowPlayingChanged() {
    document.dispatchEvent(new CustomEvent('music:now-playing', { detail: getNowPlaying() }));
  }

  return { init, playCue, pause, resume, stop, setVolume, getVolumes, setLoopMode, setEnabled, getNowPlaying };
})();

window.MusicPlayer = MusicPlayer;

// Auto-init once DOM is ready and musicAPI exists
function _bootMusicPlayer() {
  if (window.musicAPI) MusicPlayer.init();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _bootMusicPlayer);
} else {
  _bootMusicPlayer();
}
