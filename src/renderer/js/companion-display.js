'use strict';
// Renders companion dialogue (typewriter), thoughts, emotion badge, portrait swap, and emotional axis meters.

var CompanionDisplay = (() => {
  const dialogueEl  = document.getElementById('dialogue-text');
  const thoughtsEl  = document.getElementById('thoughts-text');
  const emotionEl   = document.getElementById('emotion-badge');
  const portraitEl  = document.getElementById('companion-portrait');

  let typewriterTimer  = null;
  let _pendingDialogue = null;
  let _audioWaitTimer  = null;
  let _streamedText    = null; // tracks last text pushed via showStreamChunk
  let characterDir = '../../characters/default'; // default; updated from app.js

  // ── All 38 single emotions ─────────────────────────────────────────────────
  const EMOTIONS = {
    neutral:              { emoji: '😐', color: '#888888' },
    happy:                { emoji: '😊', color: '#ffdd00' },
    soft_smile:           { emoji: '🙂', color: '#ffcc44' },
    laughing:             { emoji: '😄', color: '#ff9900' },
    confident:            { emoji: '😎', color: '#00ccff' },
    smug:                 { emoji: '😏', color: '#aa44ff' },
    surprised:            { emoji: '😮', color: '#ffaa00' },
    shocked:              { emoji: '😱', color: '#ff4444' },
    confused:             { emoji: '😕', color: '#aa8800' },
    thinking:             { emoji: '🤔', color: '#4488ff' },
    concerned:            { emoji: '😟', color: '#ff8844' },
    sad:                  { emoji: '😢', color: '#4488bb' },
    angry:                { emoji: '😠', color: '#ff2222' },
    determined:           { emoji: '💪', color: '#ff6600' },
    embarrassed:          { emoji: '😳', color: '#ff88aa' },
    exhausted:            { emoji: '😴', color: '#666688' },
    pout:                 { emoji: '😤', color: '#dd6600' },
    crying:               { emoji: '😭', color: '#6688cc' },
    lustful_desire:       { emoji: '😍', color: '#ff44aa' },
    excited:              { emoji: '🤩', color: '#ffaa00' },
    loving:               { emoji: '💗', color: '#ff6688' },
    nervous:              { emoji: '😬', color: '#aaaa44' },
    longing:              { emoji: '🥺', color: '#8899cc' },
    curious:              { emoji: '🧐', color: '#44aaff' },
    disappointed:         { emoji: '😞', color: '#888899' },
    relieved:             { emoji: '😅', color: '#66cc88' },
    playful:              { emoji: '😜', color: '#ffcc00' },
    proud:                { emoji: '🫡', color: '#ffaa44' },
    apologetic:           { emoji: '🙏', color: '#aaaaaa' },
    content:              { emoji: '😌', color: '#88cc88' },
    flirty:               { emoji: '😘', color: '#ff66aa' },
    flustered:            { emoji: '😖', color: '#ff8899' },
    in_awe:               { emoji: '😲', color: '#88aaff' },
    in_pleasure:          { emoji: '🥰', color: '#ff88cc' },
    sleepy:               { emoji: '💤', color: '#8888aa' },
    sickly:               { emoji: '🤒', color: '#88aa44' },
    wheezing_laughter:    { emoji: '🤣', color: '#ff8800' },
    frantic_desperation:  { emoji: '😰', color: '#ff4400' },
  };

  // ── Combined / blended emotions (image lives in emotions/combined/<id>.png) ─
  const COMBINED_EMOTIONS = {
    happy_confused:              { emoji: '😊😕', color: '#d4b200', label: 'Happy & Confused'           },
    nervous_excited:             { emoji: '😬🤩', color: '#d4aa22', label: 'Nervous & Excited'          },
    sad_angry:                   { emoji: '😢😠', color: '#a1556e', label: 'Sad & Angry'                },
    concerned_thinking:          { emoji: '😟🤔', color: '#a188a1', label: 'Concerned & Thinking'       },
    embarrassed_laughing:        { emoji: '😳😄', color: '#ff9055', label: 'Embarrassed & Laughing'     },
    loving_sad:                  { emoji: '💗😢', color: '#a177a1', label: 'Loving & Sad'               },
    confident_smug:              { emoji: '😎😏', color: '#5588ff', label: 'Confident & Smug'           },
    exhausted_sad:               { emoji: '😴😢', color: '#5577a1', label: 'Exhausted & Sad'            },
    flustered_nervous:           { emoji: '😖😬', color: '#d4996e', label: 'Flustered & Nervous'        },
    curious_confused:            { emoji: '🧐😕', color: '#77997f', label: 'Curious & Confused'         },
    sickly_sad:                  { emoji: '🤒😢', color: '#66997f', label: 'Sickly & Sad'               },
    sickly_exhausted:            { emoji: '🤒😴', color: '#778866', label: 'Sickly & Exhausted'         },
    relieved_exhausted:          { emoji: '😅😴', color: '#669988', label: 'Relieved & Exhausted'       },
    proud_loving:                { emoji: '🫡💗', color: '#ff8866', label: 'Proud & Loving'             },
    playful_confident:           { emoji: '😜😎', color: '#7fcc7f', label: 'Playful & Confident'        },
    shocked_confused:            { emoji: '😱😕', color: '#d46622', label: 'Shocked & Confused'         },
    longing_sad:                 { emoji: '🥺😢', color: '#6690c3', label: 'Longing & Sad'              },
    content_loving:              { emoji: '😌💗', color: '#c39988', label: 'Content & Loving'           },
    embarrassed_apologetic:      { emoji: '😳🙏', color: '#d499aa', label: 'Embarrassed & Apologetic'   },
    frantic_desperation_crying:  { emoji: '😰😭', color: '#b26666', label: 'Frantic & Crying'           },
    laughing_crying:             { emoji: '😄😭', color: '#b29066', label: 'Laughing & Crying'          },
    smug_angry:                  { emoji: '😏😠', color: '#d43390', label: 'Smug & Angry'               },
    thinking_concerned:          { emoji: '🤔😟', color: '#a188a1', label: 'Thinking & Concerned'       },
    excited_nervous:             { emoji: '🤩😬', color: '#d4aa22', label: 'Excited & Nervous'          },
    in_pleasure_embarrassed:     { emoji: '🥰😳', color: '#ff88bb', label: 'In Pleasure & Embarrassed'  },
    flirty_nervous:              { emoji: '😘😬', color: '#d48877', label: 'Flirty & Nervous'           },
    wheezing_laughter_exhausted: { emoji: '🤣😴', color: '#b27744', label: 'Wheezing & Exhausted'       },
  };

  // ── Meter bar setup ────────────────────────────────────────────────────────
  let metersEl = null;

  // ── Divination Tremor — attributed to: Fantasy RPG package ─────────────────
  // Bars idle at true value; a random tremor fires every 8–20s per bar.
  // JS-driven (not CSS): fade → falsify → flicker → restore. Blood-red tint.
  let _tremorTimers = [];

  function _stopDivinationTremor() {
    _tremorTimers.forEach(t => clearTimeout(t));
    _tremorTimers = [];
  }

  function _startDivinationTremor() {
    _stopDivinationTremor();
    if (document.body.dataset.package !== 'fantasy_rpg') return;
    const fills = metersEl?.querySelectorAll('.axis-bar-fill');
    if (!fills?.length) return;

    fills.forEach((fill) => {
      const trueVal = parseFloat(fill.style.getPropertyValue('--bar-val')) || 0.5;

      function scheduleTremor() {
        const delay = 8000 + Math.random() * 12000; // 8–20s per bar, independent
        const t = setTimeout(() => {
          if (document.body.dataset.package !== 'fantasy_rpg' || !fill.isConnected) return;

          // Step 1: Dim gently — stays visible, just less bright
          fill.style.transition = 'opacity 200ms ease-in';
          fill.style.opacity    = '0.55';

          const t2 = setTimeout(() => {
            if (!fill.isConnected) return;

            // Step 2: Snap to a falsified value (±10–20%), keep bar's own color
            const offset  = (Math.random() * 0.20) - 0.10;
            const fakeVal = Math.max(0.08, Math.min(0.92, trueVal + offset));
            fill.style.transition = 'none';
            fill.style.width      = (fakeVal * 100).toFixed(1) + '%';

            // Step 3: Narrow-range flicker with variable speed per pulse
            // Opacity stays between 0.42–0.82 — never goes near-black
            const flickerCount = 2 + Math.floor(Math.random() * 2);
            let f = 0;
            function flicker() {
              if (!fill.isConnected) return;
              if (f >= flickerCount * 2) {
                // Step 4: Dim slightly, swap color+width while dim, fade back to full
                const restoreDur = 80 + Math.floor(Math.random() * 60);
                fill.style.transition = `opacity ${restoreDur}ms ease-out`;
                fill.style.opacity    = '0.38';
                const t5 = setTimeout(() => {
                  if (!fill.isConnected) return;
                  fill.style.transition = 'none';
                  fill.style.width      = (trueVal * 100).toFixed(1) + '%';
                  fill.style.transition = 'opacity 200ms ease-in';
                  fill.style.opacity    = '1';
                  const t6 = setTimeout(() => {
                    if (!fill.isConnected) return;
                    fill.style.transition = '';
                    scheduleTremor();
                  }, 200);
                  _tremorTimers.push(t6);
                }, restoreDur);
                _tremorTimers.push(t5);
                return;
              }
              // Variable speed: each half-cycle picks its own duration
              const dur           = 55 + Math.floor(Math.random() * 95); // 55–150ms
              const targetOpacity = (f % 2 === 0) ? '0.42' : '0.82';
              fill.style.transition = `opacity ${dur}ms ease-in-out`;
              fill.style.opacity    = targetOpacity;
              f++;
              const t4 = setTimeout(flicker, dur + 15);
              _tremorTimers.push(t4);
            }
            const t3 = setTimeout(flicker, 30);
            _tremorTimers.push(t3);
          }, 200);
          _tremorTimers.push(t2);
        }, delay);
        _tremorTimers.push(t);
      }

      scheduleTremor();
    });
  }

  // ── Arcade Glitch — attributed to: Arcade Cabinet package ─────────────────
  // Axis bars occasionally glitch: pixels shift, bar crumbles + falls, then repairs.
  // Only ONE bar can glitch at a time; a cooldown prevents back-to-back triggers.
  let _glitchTimers   = [];
  let _glitchActive   = false;
  let _glitchCooldownEnd = 0;   // Date.now() timestamp — no new glitch before this

  function _stopArcadeGlitch() {
    _glitchTimers.forEach(t => clearTimeout(t));
    _glitchTimers      = [];
    _glitchActive      = false;
    _glitchCooldownEnd = 0;
  }

  function _startArcadeGlitch() {
    _stopArcadeGlitch();
    if (document.body.dataset.package !== 'arcade_cabinet') return;
    const fills = metersEl?.querySelectorAll('.axis-bar-fill');
    if (!fills?.length) return;

    fills.forEach((fill, idx) => {
      function scheduleGlitch() {
        const delay = 8000 + Math.random() * 12000;
        const t = setTimeout(() => {
          if (document.body.dataset.package !== 'arcade_cabinet' || !fill.isConnected) return;
          // Another bar is already glitching or we're in the inter-glitch cooldown — try again later
          if (_glitchActive || Date.now() < _glitchCooldownEnd) {
            scheduleGlitch();
            return;
          }
          _glitchActive = true;
          _runGlitch(fill, () => {
            _glitchActive      = false;
            _glitchCooldownEnd = Date.now() + 1800;  // 1.8s breather before the next one
            scheduleGlitch();
          });
        }, delay);
        _glitchTimers.push(t);
      }
      // Stagger initial trigger by bar index so all four bars don't compete immediately
      const t0 = setTimeout(() => scheduleGlitch(), idx * 2200);
      _glitchTimers.push(t0);
    });
  }

  function _runGlitch(fill, onDone) {
    const trueBarVal = parseFloat(fill.style.getPropertyValue('--bar-val')) || 0.5;
    // Phase 1: Rapid pixel jolts — bar snaps to wrong positions 3–5 times
    const joltCount = 3 + Math.floor(Math.random() * 3);
    let j = 0;
    function doJolt() {
      if (!fill.isConnected) { onDone(); return; }
      if (j >= joltCount) { _doCrumble(fill, trueBarVal, onDone); return; }
      const joltVal = Math.max(0.04, Math.min(0.96, trueBarVal + (Math.random() - 0.5) * 0.30));
      fill.style.transition = 'none';
      fill.style.width      = (joltVal * 100).toFixed(1) + '%';
      fill.style.filter     = j % 2 === 0 ? 'brightness(2.2) saturate(0.1)' : 'brightness(0.25)';
      j++;
      const t = setTimeout(doJolt, 30 + Math.random() * 55);
      _glitchTimers.push(t);
    }
    doJolt();
  }

  function _doCrumble(fill, trueBarVal, onDone) {
    if (!fill.isConnected) { onDone(); return; }
    // Spawn falling pixel fragments from the bar's screen position
    const rect       = fill.getBoundingClientRect();
    const fragCount  = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < fragCount; i++) {
      const frag     = document.createElement('div');
      const fragX    = rect.left + Math.random() * rect.width;
      const size     = 2 + Math.floor(Math.random() * 3);
      const fallDist = 22 + Math.random() * 36;
      const driftX   = (Math.random() - 0.5) * 18;
      const color    = Math.random() < 0.6 ? '#ffee00' : '#ffffff';
      frag.style.cssText = [
        'position:fixed',
        `left:${fragX.toFixed(1)}px`,
        `top:${rect.top.toFixed(1)}px`,
        `width:${size}px`,
        `height:${size}px`,
        `background:${color}`,
        'pointer-events:none',
        'z-index:9998',
        'will-change:transform,opacity',
      ].join(';');
      document.body.appendChild(frag);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        frag.style.transition = 'transform 0.5s ease-in, opacity 0.5s ease-in';
        frag.style.transform  = `translate(${driftX.toFixed(1)}px, ${fallDist.toFixed(1)}px)`;
        frag.style.opacity    = '0';
      }));
      const tFrag = setTimeout(() => frag.remove(), 650);
      _glitchTimers.push(tFrag);
    }
    // Bar collapses to nothing then fades to dark
    fill.style.transition = 'none';
    fill.style.width      = '0%';
    fill.style.filter     = '';
    const tHide = setTimeout(() => {
      if (!fill.isConnected) { onDone(); return; }
      fill.style.opacity = '0.08';
      _doRepair(fill, trueBarVal, onDone, 0);
    }, 350);
    _glitchTimers.push(tHide);
  }

  function _doRepair(fill, trueBarVal, onDone, blinkCount) {
    if (!fill.isConnected) { onDone(); return; }
    const maxBlinks = 5 + Math.floor(Math.random() * 4);
    if (blinkCount >= maxBlinks) {
      // Fully restored
      fill.style.transition = 'none';
      fill.style.width      = (trueBarVal * 100).toFixed(1) + '%';
      fill.style.opacity    = '1';
      fill.style.filter     = '';
      const tDone = setTimeout(onDone, 60);
      _glitchTimers.push(tDone);
      return;
    }
    // Binary blink — steps(1) so the transition is instantaneous (digital feel)
    const dur = 55 + Math.floor(Math.random() * 110);
    fill.style.transition = `opacity ${dur}ms steps(1)`;
    fill.style.opacity    = blinkCount % 2 === 0 ? '0.75' : '0.05';
    // On every other blink, partially rebuild the bar width to suggest repair
    if (blinkCount % 2 === 0 && blinkCount > 0) {
      fill.style.width = (trueBarVal * (0.4 + Math.random() * 0.6) * 100).toFixed(1) + '%';
    }
    const tNext = setTimeout(() => _doRepair(fill, trueBarVal, onDone, blinkCount + 1), dur + 20);
    _glitchTimers.push(tNext);
  }

  // Returns the display label for an axis key — runes in Fantasy RPG, text otherwise.
  function _axisLabel(key) {
    if (document.body.dataset.package === 'fantasy_rpg') {
      return { VAL: '♥', ARO: '⚔', SOC: '☿', PHY: '✦' }[key] || key;
    }
    return key;
  }

  function ensureMeters() {
    // Use the static DOM element added in index.html — no dynamic creation needed
    if (!metersEl) metersEl = document.getElementById('emotion-meters');
  }

  // Neutral starting state shown at app launch
  const _NEUTRAL_STATE = { valence: 50, arousal: 50, social: 50, physical: 50 };
  let _cachedMeterState = null;

  function updateMeters(state) {
    ensureMeters();
    if (!metersEl) return;
    // Stop any running per-theme effects before the DOM is replaced — timers hold refs to old elements.
    _stopDivinationTremor();
    _stopArcadeGlitch();
    // undefined = re-render with cached state (called by _applyBarWidth after padding change)
    // null/object = update the cache too
    if (state !== undefined) _cachedMeterState = state;
    const s = _cachedMeterState || _NEUTRAL_STATE;
    // Read per-package axis color stops from CSS custom properties so bars adapt to any theme
    const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const axes = [
      { label: _axisLabel('VAL'), val: s.valence,  low: cssVar('--axis-val-lo'), high: cssVar('--axis-val-hi') },
      { label: _axisLabel('ARO'), val: s.arousal,  low: cssVar('--axis-aro-lo'), high: cssVar('--axis-aro-hi') },
      { label: _axisLabel('SOC'), val: s.social,   low: cssVar('--axis-soc-lo'), high: cssVar('--axis-soc-hi') },
      { label: _axisLabel('PHY'), val: s.physical, low: cssVar('--axis-phy-lo'), high: cssVar('--axis-phy-hi') },
    ];

    // Show 3-letter labels in the left padding area when barWidth ≤ 80
    const barWidth = parseInt(metersEl.dataset.barWidth || '100', 10);
    const showLabels = barWidth <= 80;

    metersEl.innerHTML = axes.map(({ label, val, low, high }, idx) => {
      const pct   = Math.max(10, Math.min(100, val ?? 50));
      const color = lerpHex(low, high, pct / 100);
      // Label sits in the left padding area via position:absolute right:calc(100% + 5px)
      // Fantasy RPG uses single-glyph runes so font-size is slightly larger (9px vs 7px)
      const isRpg     = document.body.dataset.package === 'fantasy_rpg';
      const labelSize = isRpg ? '9px' : '7px';
      const labelHtml = showLabels
        ? `<span style="position:absolute;right:calc(100% + 5px);top:0;font-size:${labelSize};` +
          `letter-spacing:1px;color:var(--cyan-dim);line-height:8px;white-space:nowrap;">${label}</span>`
        : '';
      // --bar-val (0–1) drives width via CSS; animation-delay staggers per-bar phase
      const barVal = (pct / 100).toFixed(4);
      const phaseDelay = -(idx * 0.55).toFixed(2);
      return `<div style="position:relative;height:8px;margin-bottom:7px;">` +
        labelHtml +
        `<div style="height:8px;background:var(--bg-dark);border:1px solid var(--border-glow);overflow:hidden;">` +
        `<div class="axis-bar-fill" style="--bar-val:${barVal};animation-delay:${phaseDelay}s;background:${color};"></div>` +
        `</div>` +
        `<div style="position:absolute;left:0;top:-3px;width:1px;height:14px;background:var(--border-glow);"></div>` +
        `<div style="position:absolute;right:0;top:-3px;width:1px;height:14px;background:var(--border-glow);"></div>` +
        `</div>`;
    }).join('');

    // Start per-theme axis bar effects now that new bar elements exist in DOM
    _startDivinationTremor();   // Fantasy RPG: divination tremor flicker
    _startArcadeGlitch();       // Arcade Cabinet: pixel corruption + repair sequence
  }

  function lerpHex(a, b, t) {
    const parseHex = (h) => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = parseHex(a);
    const [r2, g2, b2] = parseHex(b);
    const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0');
    const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0');
    const bv = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0');
    return `#${r}${g}${bv}`;
  }

  // ── Core display functions ─────────────────────────────────────────────────

  function setCharacterDir(dir) {
    characterDir = dir;
  }

  /** Preload every emotion PNG into the browser's memory cache. */
  function _preloadEmotionImages() {
    for (const id of Object.keys(EMOTIONS)) {
      const img = new Image();
      img.src = `${characterDir}/emotions/${id}.png`;
    }
    for (const id of Object.keys(COMBINED_EMOTIONS)) {
      const img = new Image();
      img.src = `${characterDir}/emotions/combined/${id}.png`;
    }
  }

  // ── Audio-sync helpers ─────────────────────────────────────────────────────

  function _cancelAudioWait() {
    if (_audioWaitTimer) { clearTimeout(_audioWaitTimer); _audioWaitTimer = null; }
    document.removeEventListener('tts:audio-ready', _onAudioReady);
    _pendingDialogue = null;
  }

  function _onAudioReady() {
    if (_audioWaitTimer) { clearTimeout(_audioWaitTimer); _audioWaitTimer = null; }
    if (_pendingDialogue !== null) {
      typewriterText(dialogueEl, _pendingDialogue, 22);
      _pendingDialogue = null;
    }
  }

  /**
   * Called as soon as the Claude CLI connects (before API response arrives).
   * Hides the loading spinner and shows a thinking state so the UI feels alive.
   */
  function showThinking() {
    if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
    setEmotion('thinking');
    dialogueEl.textContent = '';
    dialogueEl.classList.add('typewriter-cursor');
    // _streamedText stays null — showResponse will do a full typewriter render
  }

  /**
   * Called in real-time as Claude streams its response. Shows text immediately
   * without typewriter so the user sees it as Claude generates it.
   */
  function showStreamChunk(text) {
    if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
    _cancelAudioWait();
    _streamedText = text;
    dialogueEl.textContent = text;
    dialogueEl.classList.add('typewriter-cursor');
  }

  function showResponse({ dialogue, thoughts, emotion, source, emotionalState }) {
    // Cancel any previous audio-sync wait (new message arrived)
    _cancelAudioWait();

    // Stop any running typewriter
    if (typewriterTimer) clearTimeout(typewriterTimer);

    // Update thoughts immediately
    thoughtsEl.textContent = thoughts || '';

    // Update emotion badge and portrait
    setEmotion(emotion || 'neutral');

    // Flash neon effect
    dialogueEl.classList.remove('new-response');
    void dialogueEl.offsetWidth; // force reflow
    dialogueEl.classList.add('new-response');

    // Update meter bars if emotional state provided
    if (emotionalState) updateMeters(emotionalState);

    // If streaming already delivered this exact dialogue, skip re-typing it.
    // Just finalize the display (emotion/thoughts are already updated above).
    if (_streamedText !== null && dialogue && _streamedText.trim() === dialogue.trim()) {
      _streamedText = null;
      dialogueEl.textContent = dialogue;
      dialogueEl.classList.remove('typewriter-cursor');
      return;
    }
    _streamedText = null;

    // Decide whether to wait for audio before typing
    const syncEnabled = window._ttsState?.waitForAudio && window._ttsState?.voiceEnabled;
    if (syncEnabled && dialogue) {
      // Hold typewriter — show waiting cursor, start typing on tts:audio-ready
      dialogueEl.textContent = '';
      dialogueEl.classList.add('typewriter-cursor');
      _pendingDialogue = dialogue;
      document.addEventListener('tts:audio-ready', _onAudioReady, { once: true });
      // Safety fallback: if audio never arrives (synthesis error, disabled, etc.)
      // type the text after 45 seconds so it's never stuck blank
      _audioWaitTimer = setTimeout(() => {
        document.removeEventListener('tts:audio-ready', _onAudioReady);
        if (_pendingDialogue !== null) {
          typewriterText(dialogueEl, _pendingDialogue, 22);
          _pendingDialogue = null;
        }
      }, 45000);
    } else {
      typewriterText(dialogueEl, dialogue || '', 22);
    }
  }

  function setEmotion(emotionId) {
    const combined = COMBINED_EMOTIONS[emotionId];
    const single   = EMOTIONS[emotionId];
    const info     = combined || single || EMOTIONS.neutral;
    const isCombined = !!combined;

    // Badge label
    const label = combined
      ? combined.label.toUpperCase()
      : emotionId.replace(/_/g, ' ').toUpperCase();
    emotionEl.textContent = `${info.emoji} ${label}`;
    emotionEl.style.color = info.color;
    emotionEl.style.borderColor = info.color + '44';

    // Portrait image path — uses characterDir so custom character packs work
    const imgPath = isCombined
      ? `${characterDir}/emotions/combined/${emotionId}.png`
      : `${characterDir}/emotions/${emotionId}.png`;

    if (portraitEl.getAttribute('src') !== imgPath) {
      // With images preloaded, onload fires from cache in <10ms — transition feels instant.
      portraitEl.style.transition = 'opacity 0.12s';
      portraitEl.style.opacity = '0';
      portraitEl.src = imgPath;
      portraitEl.onload  = () => { portraitEl.style.opacity = '1'; };
      portraitEl.onerror = () => {
        portraitEl.src = `${characterDir}/emotions/neutral.png`;
        portraitEl.style.opacity = '1';
      };
    }

    // Update portrait glow color
    const glowEl = document.getElementById('portrait-glow');
    if (glowEl) {
      glowEl.style.boxShadow = `0 0 40px ${info.color}44, inset 0 0 20px ${info.color}22`;
    }
  }

  function typewriterText(el, text, delayMs) {
    el.textContent = '';
    el.classList.add('typewriter-cursor');
    let i = 0;

    function step() {
      if (i < text.length) {
        el.textContent += text[i];
        i++;
        typewriterTimer = setTimeout(step, delayMs);
      } else {
        el.classList.remove('typewriter-cursor');
      }
    }

    step();
  }

  // ── Sensation pulse indicator ──────────────────────────────────────────────

  function showSensationPulse(delta, lingers) {
    if (!delta) return;
    const frame = document.getElementById('portrait-frame');
    if (!frame) return;

    // Remove any in-progress pulse so rapid sensations restart cleanly
    const existing = frame.querySelector('.sensation-pulse');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'sensation-pulse' +
      (delta > 0 ? ' pleasure' : ' pain') +
      (lingers   ? ' linger'   : '');
    const sign   = delta > 0 ? '+' : '';
    const symbol = delta > 0 ? '\u25b2' : '\u25bc';  // ▲ / ▼
    el.textContent = `${symbol} ${sign}${delta.toFixed(2)}`;
    frame.appendChild(el);

    setTimeout(() => el.remove(), 2500);
  }

  function updateTrackers(trackers) {
    const el = document.getElementById('tracker-popup');
    if (!el) return;
    const entries = Object.entries(trackers || {});
    if (entries.length === 0) {
      el.innerHTML = '<div class="tracker-popup-header">// TRACKERS</div><div class="tracker-popup-empty">No trackers yet.</div>';
      return;
    }
    el.innerHTML =
      '<div class="tracker-popup-header">// TRACKERS</div>' +
      entries.map(([k, v]) => {
        const label = k.replace(/_/g, ' ');
        return `<div class="tracker-row"><span class="tracker-name">${label}</span><span class="tracker-val">${v}</span></div>`;
      }).join('');
  }

  function updateSensationReadout(val) {
    const el = document.getElementById('sensation-readout');
    if (!el) return;
    const v = typeof val === 'number' ? val : 0;
    const sign   = v > 0 ? '+' : '';
    const symbol = v >  0.02 ? '▲' : v < -0.02 ? '▼' : '●';
    const cls    = v >  0.02 ? 'pleasure' : v < -0.02 ? 'pain' : 'neutral-sen';
    el.textContent = `SEN  ${symbol} ${sign}${v.toFixed(2)}`;
    el.className = cls;
  }

  function setGreeting(character, emotionalState) {
    // Preload all emotion PNGs into browser memory cache — portrait swaps become near-instant.
    _preloadEmotionImages();

    dialogueEl.textContent = '';
    thoughtsEl.textContent = character.initial_thoughts || '';
    setEmotion(character.initial_emotion || 'soft_smile');

    // Type out greeting
    typewriterText(dialogueEl, character.greeting || `Hi! I'm ${character.name}.`, 30);

    // Set avatar
    const avatarEl = document.getElementById('avatar-img');
    if (avatarEl) {
      avatarEl.src = `${characterDir}/avatar-small.png`;
    }

    // Always show meter bars (neutral 50% if no state yet from main process)
    updateMeters(emotionalState || null);
  }

  return { showResponse, showThinking, showStreamChunk, setEmotion, setGreeting, setCharacterDir, updateMeters, showSensationPulse, updateSensationReadout, updateTrackers };
})();
