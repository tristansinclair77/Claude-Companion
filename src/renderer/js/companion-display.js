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

  function ensureMeters() {
    if (metersEl) return;
    metersEl = document.createElement('div');
    metersEl.id = 'emotion-meters';
    metersEl.style.cssText =
      'padding:8px 10px 6px;font-family:"Courier New",monospace;font-size:9px;' +
      'letter-spacing:1px;color:#336644;border-top:1px solid #00ff8811;margin-top:4px;';
    const panel = document.getElementById('portrait-panel');
    if (panel) panel.appendChild(metersEl);
  }

  function updateMeters(state) {
    ensureMeters();
    if (!metersEl || !state) return;
    const axes = [
      { key: 'valence',  label: 'VAL', negLabel: 'NEG', posLabel: 'POS', val: state.valence,  low: '#ff4444', high: '#00ff88' },
      { key: 'arousal',  label: 'ARO', negLabel: 'CLM', posLabel: 'ACT', val: state.arousal,  low: '#4488ff', high: '#ff8800' },
      { key: 'social',   label: 'SOC', negLabel: 'SUB', posLabel: 'DOM', val: state.social,   low: '#8844aa', high: '#00ccff' },
      { key: 'physical', label: 'PHY', negLabel: 'TRD', posLabel: 'HTH', val: state.physical, low: '#888866', high: '#88ff44' },
    ];

    metersEl.innerHTML = axes.map(({ label, negLabel, posLabel, val, low, high }) => {
      const pct = Math.max(0, Math.min(100, val));
      // Interpolate color between low and high
      const t = pct / 100;
      const color = lerpHex(low, high, t);
      return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;">` +
        `<span style="width:22px;color:#336644;">${label}</span>` +
        `<span style="width:20px;text-align:right;color:#224433;font-size:8px;">${negLabel}</span>` +
        `<div style="flex:1;height:4px;background:#0a1a12;border:1px solid #00ff8818;border-radius:2px;overflow:hidden;">` +
        `<div style="width:${pct}%;height:100%;background:${color};border-radius:2px;transition:width 0.6s ease;"></div>` +
        `</div>` +
        `<span style="width:20px;color:#224433;font-size:8px;">${posLabel}</span>` +
        `<span style="width:24px;text-align:right;color:${color};font-size:8px;">${Math.round(pct)}</span>` +
        `</div>`;
    }).join('');
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

    // Portrait image path
    const imgPath = isCombined
      ? `../../characters/default/emotions/combined/${emotionId}.png`
      : `../../characters/default/emotions/${emotionId}.png`;

    if (portraitEl.getAttribute('src') !== imgPath) {
      portraitEl.style.opacity = '0';
      portraitEl.src = imgPath;
      portraitEl.onload = () => {
        portraitEl.style.transition = 'opacity 0.3s';
        portraitEl.style.opacity = '1';
      };
      portraitEl.onerror = () => {
        // Fallback to neutral
        portraitEl.src = '../../characters/default/emotions/neutral.png';
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

  function setGreeting(character, emotionalState) {
    dialogueEl.textContent = '';
    thoughtsEl.textContent = character.initial_thoughts || '';
    setEmotion(character.initial_emotion || 'soft_smile');

    // Type out greeting
    typewriterText(dialogueEl, character.greeting || `Hi! I'm ${character.name}.`, 30);

    // Set avatar
    const avatarEl = document.getElementById('avatar-img');
    if (avatarEl) {
      avatarEl.src = '../../characters/default/avatar-small.png';
    }

    // Show initial meter state
    if (emotionalState) updateMeters(emotionalState);
  }

  return { showResponse, setEmotion, setGreeting, setCharacterDir, updateMeters };
})();
