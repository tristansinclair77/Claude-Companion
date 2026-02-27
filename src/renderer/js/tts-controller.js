'use strict';
// TTS Controller — plays Aria's voice in the renderer process.
// Receives base64 WAV audio from main via IPC and plays it with the HTML5 Audio API.
// The VOICE button toggles TTS on/off; the ▾ caret opens the voice picker popup.
// Voice list is grouped: KOKORO (English) first, then VITS ANIME (JP) if any models are present.
// The TTS playbar (replay, seek, time, volume) sits above the action buttons.

(function () {
  const btnVoice       = document.getElementById('btn-voice');
  const btnVoicePicker = document.getElementById('btn-voice-picker');
  const voicePicker    = document.getElementById('voice-picker');
  const btnReplay      = document.getElementById('btn-replay');
  const ttsSeek        = document.getElementById('tts-seek');
  const ttsTime        = document.getElementById('tts-time');
  const ttsVolume      = document.getElementById('tts-volume');
  const btnTtsSync     = document.getElementById('btn-tts-sync');
  const btnStop        = document.getElementById('btn-stop');
  const btnPause       = document.getElementById('btn-pause');

  let currentAudio    = null;
  let lastAudioBase64 = null;
  let voiceEnabled    = true;
  let currentVoiceId  = 'af_heart';
  let _volume         = 1.0;
  let _seeking        = false;
  let _waitForAudio   = false;
  let _isPlaying      = false;
  let _isPaused       = false;

  // Expose state for companion-display.js to read
  window._ttsState = {
    get waitForAudio() { return _waitForAudio; },
    get voiceEnabled()  { return voiceEnabled;  },
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function fmt(sec) {
    if (!isFinite(sec) || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /** Update the CSS fill gradient on a range input (--pct custom property). */
  function updateSliderFill(el) {
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 1;
    const pct = ((parseFloat(el.value) - min) / (max - min)) * 100;
    el.style.setProperty('--pct', pct.toFixed(1));
  }

  function setPlaybarEnabled(enabled) {
    if (ttsSeek) ttsSeek.disabled = !enabled;
  }

  function _updatePlayControls() {
    const hasAudio = !!lastAudioBase64;
    if (_isPlaying) {
      if (btnReplay) btnReplay.classList.add('hidden');
      if (btnStop)   btnStop.classList.remove('hidden');
      if (btnPause) {
        btnPause.classList.remove('hidden');
        btnPause.textContent = _isPaused ? '▶' : '⏸';
        btnPause.title       = _isPaused ? 'Resume audio' : 'Pause audio';
      }
    } else {
      if (btnReplay) { btnReplay.classList.remove('hidden'); btnReplay.disabled = !hasAudio; }
      if (btnStop)   btnStop.classList.add('hidden');
      if (btnPause)  btnPause.classList.add('hidden');
    }
  }

  function updateTime(current, duration) {
    if (!ttsTime) return;
    if (isFinite(duration) && duration > 0) {
      ttsTime.textContent = `${fmt(current)} / ${fmt(duration)}`;
    } else {
      ttsTime.textContent = fmt(current);
    }
  }

  // ── Audio playback ──────────────────────────────────────────────────────────

  function attachListeners(audio) {
    audio.addEventListener('loadedmetadata', () => {
      updateTime(0, audio.duration);
      if (ttsSeek) {
        ttsSeek.value = 0;
        updateSliderFill(ttsSeek);
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (_seeking || !isFinite(audio.duration)) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      if (ttsSeek) {
        ttsSeek.value = pct;
        updateSliderFill(ttsSeek);
      }
      updateTime(audio.currentTime, audio.duration);
    });

    audio.addEventListener('ended', () => {
      if (ttsSeek) {
        ttsSeek.value = 100;
        updateSliderFill(ttsSeek);
      }
      updateTime(audio.duration, audio.duration);
      currentAudio = null;
      _isPlaying = false;
      _isPaused  = false;
      _updatePlayControls();
    });
  }

  function stopCurrentAudio(_internal = false) {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    if (!_internal) {
      _isPlaying = false;
      _isPaused  = false;
      _updatePlayControls();
    }
  }

  function playAudio(base64, startPct) {
    stopCurrentAudio(true); // internal — don't flip controls yet
    if (!voiceEnabled && startPct === undefined) {
      // Voice off and not a manual replay — reset controls cleanly
      _isPlaying = false;
      _isPaused  = false;
      _updatePlayControls();
      return;
    }
    const audio = new Audio('data:audio/wav;base64,' + base64);
    audio.volume = _volume;
    currentAudio = audio;
    attachListeners(audio);

    if (startPct !== undefined && startPct > 0) {
      audio.addEventListener('loadedmetadata', () => {
        audio.currentTime = (startPct / 100) * audio.duration;
        audio.play().catch(err => console.warn('[TTS] play error:', err.message));
      }, { once: true });
    } else {
      audio.play().catch(err => console.warn('[TTS] play error:', err.message));
    }

    _isPlaying = true;
    _isPaused  = false;
    _updatePlayControls();
    setPlaybarEnabled(true);
  }

  window.claudeAPI.on('tts:audio', (base64) => {
    lastAudioBase64 = base64;
    // If sync mode is on, notify companion-display BEFORE playing so the
    // typewriter starts at the same moment audio begins.
    if (_waitForAudio) {
      document.dispatchEvent(new CustomEvent('tts:audio-ready'));
    }
    playAudio(base64);
  });

  window.claudeAPI.on('tts:stop', () => {
    stopCurrentAudio();
  });

  // ── Playbar controls ─────────────────────────────────────────────────────────

  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      if (!lastAudioBase64) return;
      // Force-play even if voice is muted — replay is intentional
      const saved = voiceEnabled;
      voiceEnabled = true;
      playAudio(lastAudioBase64);
      voiceEnabled = saved;
    });
  }

  if (btnStop) {
    btnStop.addEventListener('click', () => stopCurrentAudio());
  }

  if (btnPause) {
    btnPause.addEventListener('click', () => {
      if (!currentAudio) return;
      if (_isPaused) {
        currentAudio.play().catch(err => console.warn('[TTS] resume error:', err.message));
        _isPaused = false;
      } else {
        currentAudio.pause();
        _isPaused = true;
      }
      _updatePlayControls();
    });
  }

  if (ttsSeek) {
    ttsSeek.addEventListener('mousedown',  () => { _seeking = true; });
    ttsSeek.addEventListener('touchstart', () => { _seeking = true; }, { passive: true });

    ttsSeek.addEventListener('input', () => {
      updateSliderFill(ttsSeek);
      if (currentAudio && isFinite(currentAudio.duration)) {
        updateTime((ttsSeek.value / 100) * currentAudio.duration, currentAudio.duration);
      }
    });

    ttsSeek.addEventListener('change', () => {
      _seeking = false;
      updateSliderFill(ttsSeek);
      if (currentAudio && isFinite(currentAudio.duration)) {
        currentAudio.currentTime = (ttsSeek.value / 100) * currentAudio.duration;
      } else if (lastAudioBase64) {
        // Audio ended — start replay from the selected position
        playAudio(lastAudioBase64, parseFloat(ttsSeek.value));
      }
    });
  }

  if (ttsVolume) {
    ttsVolume.value = _volume;
    updateSliderFill(ttsVolume);
    ttsVolume.addEventListener('input', () => {
      _volume = parseFloat(ttsVolume.value);
      updateSliderFill(ttsVolume);
      if (currentAudio) currentAudio.volume = _volume;
    });
  }

  // ── Toggle button ───────────────────────────────────────────────────────────

  function updateBtn() {
    if (!btnVoice) return;
    if (voiceEnabled) {
      btnVoice.textContent = '🔊 VOICE';
      btnVoice.style.opacity = '1';
      btnVoice.title = 'Voice ON — click to mute';
    } else {
      btnVoice.textContent = '🔇 VOICE';
      btnVoice.style.opacity = '0.45';
      btnVoice.title = 'Voice OFF — click to unmute';
    }
  }

  if (btnVoice) {
    btnVoice.addEventListener('click', async () => {
      voiceEnabled = !voiceEnabled;
      await window.claudeAPI.ttsSetEnabled(voiceEnabled);
      if (!voiceEnabled) stopCurrentAudio();
      updateBtn();
    });
  }

  // ── Voice picker popup ──────────────────────────────────────────────────────

  function closePicker() {
    voicePicker?.classList.add('hidden');
  }

  function openPicker() {
    voicePicker?.classList.remove('hidden');
  }

  if (btnVoicePicker) {
    btnVoicePicker.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!voicePicker?.classList.contains('hidden')) {
        closePicker();
      } else {
        openPicker();
      }
    });
  }

  document.addEventListener('click', () => closePicker());
  voicePicker?.addEventListener('click', (e) => e.stopPropagation());

  function populateVoicePicker(voices, activeId) {
    if (!voicePicker) return;
    voicePicker.innerHTML = '';
    for (const v of voices) {
      if (v.isHeader) {
        const el = document.createElement('div');
        el.className = 'voice-section-header';
        el.textContent = v.label;
        voicePicker.appendChild(el);
      } else {
        const el = document.createElement('div');
        el.className = 'voice-option' + (v.id === activeId ? ' active' : '');
        el.dataset.id = v.id;
        el.textContent = v.label;
        el.addEventListener('click', async () => {
          await window.claudeAPI.ttsSetVoice(v.id);
          currentVoiceId = v.id;
          voicePicker.querySelectorAll('.voice-option').forEach(o => o.classList.remove('active'));
          el.classList.add('active');
          closePicker();
        });
        voicePicker.appendChild(el);
      }
    }
  }

  // ── SYNC toggle ─────────────────────────────────────────────────────────────

  function updateSyncBtn() {
    if (!btnTtsSync) return;
    if (_waitForAudio) {
      btnTtsSync.classList.add('active');
      btnTtsSync.title = 'SYNC ON — text waits for audio to begin (click to disable)';
    } else {
      btnTtsSync.classList.remove('active');
      btnTtsSync.title = 'SYNC: wait for audio to begin before text starts typing';
    }
  }

  if (btnTtsSync) {
    btnTtsSync.addEventListener('click', () => {
      _waitForAudio = !_waitForAudio;
      updateSyncBtn();
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  async function init() {
    try {
      const [settings, voices] = await Promise.all([
        window.claudeAPI.ttsGetSettings(),
        window.claudeAPI.ttsGetVoices(),
      ]);
      voiceEnabled   = settings.enabled;
      currentVoiceId = settings.voice;
      populateVoicePicker(voices, currentVoiceId);
    } catch {
      voiceEnabled = true;
    }
    updateBtn();
    updateSyncBtn();
    // Initialise slider fills
    if (ttsVolume) updateSliderFill(ttsVolume);
    if (ttsSeek)   updateSliderFill(ttsSeek);
  }

  init();
})();
