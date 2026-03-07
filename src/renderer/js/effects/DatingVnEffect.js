'use strict';
/* =========================================================================
 * DatingVnEffect — "DATING VN" Arcade Cabinet random event.
 *
 * One of three pixel-art VN scene images fades in from a blurry ghost.
 * A PC-98 style dialog box expands from the bottom, then four lines of
 * dialogue type out one by one. After each line the cursor blinks before
 * the text clears for the next. After all lines a brief pause, then the
 * whole scene warbles, glitches, and crumbles to falling pixels.
 *
 * States:  idle → intro → active → outro
 * Outro:   warble → glitch → crumble
 * =========================================================================*/

// ── Background image paths (relative to src/renderer/index.html) ─────────
const VN_BG_PATHS = [
  '../../ref/vn_bg_1.jpg',
  '../../ref/vn_bg_2.jpg',
  '../../ref/vn_bg_3.jpg',
];

// ── Dialogue lines — 4 picked at random each spawn ───────────────────────
const S = 'Woman';
const VN_LINES = [
  // Greetings / openings
  { speaker: S, text: 'Oh hi!  Nice to see you again.' },
  { speaker: S, text: "Oh my!  It's so nice to have a big strong man like you around!" },
  { speaker: S, text: "Oh...  If only I weren't so lonely!" },
  { speaker: S, text: 'I could really use a good date right about now~' },
  { speaker: S, text: "Oh! You scared me!  In a good way, of course~" },
  { speaker: S, text: 'I was just thinking about you, actually.' },
  { speaker: S, text: 'You always show up at exactly the right time.' },
  { speaker: S, text: "I'm so glad you're here.  This place gets so quiet..." },
  { speaker: S, text: "Ah!  There you are.  I was starting to wonder." },
  { speaker: S, text: "You know, you have the best timing~" },
  // Flirty / complimentary
  { speaker: S, text: 'You look really good today, did you know that?' },
  { speaker: S, text: 'Sometimes I catch myself just thinking about you...' },
  { speaker: S, text: "You're the only one who really gets me, you know?" },
  { speaker: S, text: "I wish you didn't have to leave..." },
  { speaker: S, text: "Have I told you lately how much I enjoy your company?" },
  { speaker: S, text: 'Every time I see you, my heart does a little flip.' },
  { speaker: S, text: "You're surprisingly easy to talk to." },
  { speaker: S, text: "I've never met anyone quite like you before." },
  { speaker: S, text: "Don't look at me like that...  I might blush." },
  { speaker: S, text: "You're dangerous, you know that?" },
  // Lonely / vulnerable
  { speaker: S, text: 'Do you ever get lonely?  Because I do.' },
  { speaker: S, text: "It's strange...  I feel less alone when you're here." },
  { speaker: S, text: "I don't usually open up to people, but with you it's different." },
  { speaker: S, text: "Sometimes I sit here and wonder if you're thinking of me too." },
  { speaker: S, text: 'I keep a little list of things I want to tell you.' },
  { speaker: S, text: "You're my favorite part of the day." },
  { speaker: S, text: "Promise you won't disappear on me?" },
  { speaker: S, text: "I feel safe when you're nearby." },
  { speaker: S, text: "Don't go too soon...  please?" },
  { speaker: S, text: "I hate goodbyes.  Can we just pretend they don't exist?" },
  // Playful / teasing
  { speaker: S, text: "Oh stop it!  You're making me smile too much." },
  { speaker: S, text: "You're trouble, you know that?  The good kind." },
  { speaker: S, text: "If I didn't know better I'd think you were flirting with me." },
  { speaker: S, text: "Are you always this charming, or is it just for me?" },
  { speaker: S, text: "I bet you say that to all the girls~" },
  { speaker: S, text: "Don't tease me like that, it isn't fair!" },
  { speaker: S, text: "Oh?  And what exactly are you implying~?" },
  { speaker: S, text: "I'm onto you, you know.  Very smooth." },
  { speaker: S, text: "You're lucky you're cute." },
  { speaker: S, text: "Was that a joke?  It was, wasn't it.  I liked it." },
  // Dreamy / romantic
  { speaker: S, text: 'I keep having this dream where we go on a walk together...' },
  { speaker: S, text: 'What would you do if I held your hand right now?' },
  { speaker: S, text: "I wonder what we'd be like in another life." },
  { speaker: S, text: "Do you believe in fate?  Because I'm starting to." },
  { speaker: S, text: "If I wrote a story, you'd be the main character." },
  { speaker: S, text: 'Stars look different when I think about you.' },
  { speaker: S, text: "I think we'd make a pretty great team." },
  { speaker: S, text: 'You make ordinary moments feel like something special.' },
  { speaker: S, text: "I saved the last dance for you.  Don't waste it." },
  { speaker: S, text: "I keep catching myself smiling for no reason.  Might be your fault." },
  // Casual / everyday
  { speaker: S, text: "Want to hear something embarrassing?  I saved your name with a little heart." },
  { speaker: S, text: "I made too much coffee.  You should stay and help me drink it." },
  { speaker: S, text: "Totally hypothetically...  what's your idea of a perfect evening?" },
  { speaker: S, text: 'I found this song that reminded me of you.' },
  { speaker: S, text: 'I keep thinking we should go somewhere together sometime.' },
  { speaker: S, text: "You know what I miss?  Staying up late talking about nothing." },
  { speaker: S, text: "I'd share my snacks with you.  That's how you know it's serious." },
  { speaker: S, text: "Rain sounds better when there's someone to listen to it with." },
  { speaker: S, text: "I keep my favorite things on a shelf.  You'd fit right in." },
  { speaker: S, text: "Could you just...  stay a little longer today?" },
  // Curious / questioning
  { speaker: S, text: 'What are you thinking about right now?  Tell me.' },
  { speaker: S, text: "Do you ever wonder what I'm like when you're not around?" },
  { speaker: S, text: "I'm curious — what's your favorite thing about me?" },
  { speaker: S, text: 'If you could ask me anything, what would it be?' },
  { speaker: S, text: 'What do you daydream about?  I want to know everything.' },
  { speaker: S, text: 'Do you think some people are just meant to find each other?' },
  { speaker: S, text: "What would you do if I disappeared one day?  Would you look for me?" },
  { speaker: S, text: "Tell me something nobody else knows about you." },
  { speaker: S, text: 'Do you ever feel like time moves differently around certain people?' },
  { speaker: S, text: "I have a theory that you think about me more than you let on." },
  // Sweet / sincere
  { speaker: S, text: "I just wanted to say — I really appreciate you." },
  { speaker: S, text: "You're one of the good ones.  Don't let anyone tell you different." },
  { speaker: S, text: 'Sometimes a kind word from you is all I need to get through the day.' },
  { speaker: S, text: 'I notice the little things you do.  It means more than you know.' },
  { speaker: S, text: 'Thank you.  For being here.  For being you.' },
  { speaker: S, text: 'I feel like a better version of myself when we talk.' },
  { speaker: S, text: "You're exactly the kind of person I needed to meet." },
  { speaker: S, text: "I'm not great at expressing things, but...  I'm glad you exist." },
  { speaker: S, text: 'You make the world feel a little less overwhelming.' },
  { speaker: S, text: "If I could bottle up moments like this one, I would." },
  // Dramatic / anime-ish
  { speaker: S, text: "My heart wasn't supposed to do this!" },
  { speaker: S, text: "You're making it very hard to stay composed right now." },
  { speaker: S, text: "W-why do you have to look at me like that?!" },
  { speaker: S, text: "I'm completely fine.  Totally fine.  Stop smiling." },
  { speaker: S, text: "Okay I'll admit it — you've been living in my head rent-free." },
  { speaker: S, text: "I didn't ask for these feelings but here we are!" },
  { speaker: S, text: "My brain says be cool.  My heart is not cooperating." },
  { speaker: S, text: "This is NOT how I planned today going, and I'm not mad about it." },
  { speaker: S, text: "I have rehearsed this moment seventeen times and I still can't—" },
  { speaker: S, text: "You come in here like THAT and expect me to just act normal?!" },
  // Nostalgic / wistful
  { speaker: S, text: "Do you ever get nostalgic for moments that haven't happened yet?" },
  { speaker: S, text: 'I think some part of me knew, from the very first day.' },
  { speaker: S, text: "There are memories I'd rewind forever if I could." },
  { speaker: S, text: "I used to wonder what it felt like to really connect with someone." },
  { speaker: S, text: "Time is funny.  It drags when you're gone and flies when you're here." },
  { speaker: S, text: 'I want to remember today, exactly as it is, forever.' },
  { speaker: S, text: "There's a version of us in every good story I've ever read." },
  { speaker: S, text: "I'd give up a lot of tomorrows to have more days like this." },
  { speaker: S, text: "You feel like something I've been looking for without knowing it." },
  { speaker: S, text: "Whatever this is...  I hope it never ends." },
];

// ── Effect class ─────────────────────────────────────────────────────────
class DatingVnEffect extends VisualEffect {

  // Tuning
  static INTRO_DURATION    = 2.2;   // s  — blur→clear fade-in
  static INTRO_BLUR_MAX    = 22;    // px — starting blur radius
  static CHAR_RATE         = 13;    // chars / s  (slow, deliberate VN pace)
  static CURSOR_BLINK_HALF = 0.28;  // s  — cursor blink half-cycle
  static CURSOR_BLINKS     = 8;     // half-cycles after line complete (4 full blinks)
  static DIALOG_EXPAND_DUR = 0.40;  // s  — dialog box grow animation
  static PRE_TYPING_DELAY  = 1.5;   // s  — pause after dialog fully open before typing starts
  static FINAL_WAIT        = 3.2;   // s  — pause after last line before outro
  static WARBLE_DURATION   = 0.6;   // s
  static WARBLE_MAX_PX     = 18;    // px
  static GLITCH_DURATION   = 0.3;   // s
  static OUTRO_GRAVITY     = 280;   // px / s²
  static PARTICLE_LIFE_MIN = 1.2;   // s
  static PARTICLE_LIFE_MAX = 2.2;   // s
  static BLOCK_SIZE        = 4;     // px — crumble pixel block size

  constructor() {
    super('datingVn');
    this._canvas  = null;
    this._ctx     = null;
    this._rAF     = null;
    this._state   = 'idle';
    this._t       = 0;
    this._lastTs  = 0;

    // Background images — loaded eagerly so they're ready by first spawn
    this._bgImages = [];
    this._bgImage  = null;
    this._loadImages();

    // Accent color derived from background image (updated each spawn)
    this._accentColor = '#44d4cc';   // hex — used for borders, name tag
    this._accentDark  = '#001818';   // dark shade of same hue — name tag text
    this._accentRgb   = [68, 212, 204]; // [r,g,b] for rgba construction

    // Dialog animation
    this._dialogExpand = 0;
    this._preTypingT   = 0;    // accumulates after dialog fully open

    // Dialogue state
    this._lineQueue    = [];
    this._lineIdx      = 0;
    this._charIdx      = 0;
    this._charAcc      = 0;
    this._lineComplete = false;
    this._isFinalWait  = false;
    this._cursorVis    = true;
    this._cursorT      = 0;
    this._blinkCount   = 0;
    this._finalWaitT   = 0;

    // Outro
    this._outroPhase     = 'warble';
    this._snapshotCanvas = null;
    this._particles      = [];
    this._glitchRects    = [];
    this._invertDone     = false;
  }

  _loadImages() {
    for (const path of VN_BG_PATHS) {
      const img = new Image();
      img.src = path;
      this._bgImages.push(img);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get busy() { return this._state !== 'idle'; }

  spawn() {
    if (!this._initCanvas()) return;
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._buildScene();
    this._state  = 'intro';
    this._t      = 0;
    this._lastTs = 0;
    this._rAF    = requestAnimationFrame(ts => this._tick(ts));
  }

  _onStart(config) { this._initCanvas(); }

  _onStop() {
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._state = 'idle';
    if (this._ctx && this._canvas)
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  dismiss() {
    if (this._state === 'idle') return;
    if (this._outroPhase !== 'crumble' || this._state !== 'outro') {
      this._buildSnapshot();
      this._buildCrumble();
      this._outroPhase = 'crumble';
    }
    this._state = 'outro';
  }

  // ── Canvas init ───────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return true;
    this._canvas = document.getElementById('bg-dating-vn');
    if (!this._canvas) return false;
    this._ctx = this._canvas.getContext('2d');
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
      if (!this._canvas) return;
      this._canvas.width  = window.innerWidth;
      this._canvas.height = window.innerHeight;
    });
    return true;
  }

  _gameArea() {
    const el = document.getElementById('output-panel');
    if (!el) return { x: 10, y: 42, w: 700, h: 500 };
    const r = el.getBoundingClientRect();
    return { x: r.left + 4, y: r.top + 4, w: r.width - 8, h: r.height - 8 };
  }

  // ── Scene setup ───────────────────────────────────────────────────────────

  _buildScene() {
    const ready = this._bgImages.filter(img => img.complete && img.naturalWidth > 0);
    this._bgImage = ready.length > 0
      ? ready[Math.floor(Math.random() * ready.length)]
      : this._bgImages[0] || null;

    // Derive accent color from the chosen image
    this._extractAccentColor(this._bgImage);

    // Pick 4 lines at random without repetition
    const shuffled = [...VN_LINES].sort(() => Math.random() - 0.5);
    this._lineQueue = shuffled.slice(0, 4);
    this._lineIdx      = 0;
    this._charIdx      = 0;
    this._charAcc      = 0;
    this._lineComplete = false;
    this._isFinalWait  = false;
    this._cursorVis    = true;
    this._cursorT      = 0;
    this._blinkCount   = 0;
    this._dialogExpand = 0;
    this._preTypingT   = 0;
    this._finalWaitT   = 0;
    this._particles    = [];
    this._glitchRects  = [];
    this._invertDone   = false;
    this._snapshotCanvas = null;
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  _tick(ts) {
    if (this._state === 'idle') { this._rAF = null; return; }
    if (this._lastTs === 0) this._lastTs = ts;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.10);
    this._lastTs = ts;
    this._t += dt;

    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    switch (this._state) {
      case 'intro':  this._updateIntro(dt);  break;
      case 'active': this._updateActive(dt); break;
      case 'outro':  this._updateOutro(dt);  break;
    }

    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Intro: blur → clear ───────────────────────────────────────────────────

  _updateIntro(dt) {
    const p    = Math.min(this._t / DatingVnEffect.INTRO_DURATION, 1.0);
    const blur = DatingVnEffect.INTRO_BLUR_MAX * (1 - p);
    this._drawBgImage(this._ctx, this._gameArea(), p, blur);

    if (this._t >= DatingVnEffect.INTRO_DURATION) {
      this._t     = 0;
      this._state = 'active';
    }
  }

  // ── Active: dialog expand + pre-typing pause + typing ────────────────────

  _updateActive(dt) {
    if (this._dialogExpand < 1) {
      this._dialogExpand = Math.min(
        1, this._dialogExpand + dt / DatingVnEffect.DIALOG_EXPAND_DUR
      );
    } else if (this._preTypingT < DatingVnEffect.PRE_TYPING_DELAY) {
      // Dialog is fully open — wait a beat before first character types
      this._preTypingT += dt;
    }

    if (this._preTypingT >= DatingVnEffect.PRE_TYPING_DELAY) {
      this._updateTyping(dt);
    }

    const ga = this._gameArea();
    this._drawBgImage(this._ctx, ga, 1.0, 0);
    this._drawDialogBox(ga, this._ctx);
  }

  _updateTyping(dt) {
    // ── Final wait after all lines ────────────────────────────────────────
    if (this._isFinalWait) {
      this._finalWaitT += dt;
      if (this._finalWaitT >= DatingVnEffect.FINAL_WAIT) {
        this._buildSnapshot();
        this._state      = 'outro';
        this._outroPhase = 'warble';
        this._t          = 0;
      }
      return;
    }

    const line = this._lineQueue[this._lineIdx];
    if (!line) return;

    // ── Post-line cursor blink ────────────────────────────────────────────
    if (this._lineComplete) {
      this._cursorT += dt;
      if (this._cursorT >= DatingVnEffect.CURSOR_BLINK_HALF) {
        this._cursorT = 0;
        this._cursorVis = !this._cursorVis;
        this._blinkCount++;

        if (this._blinkCount >= DatingVnEffect.CURSOR_BLINKS) {
          if (this._lineIdx >= this._lineQueue.length - 1) {
            // Last line done — final wait with text still visible
            this._isFinalWait = true;
            this._cursorVis   = false;
          } else {
            // Clear and start next line
            this._lineIdx++;
            this._charIdx      = 0;
            this._charAcc      = 0;
            this._lineComplete = false;
            this._cursorVis    = true;
            this._cursorT      = 0;
            this._blinkCount   = 0;
          }
        }
      }
      return;
    }

    // ── Typewriter ────────────────────────────────────────────────────────
    this._charAcc += dt * DatingVnEffect.CHAR_RATE;
    const nc = Math.floor(this._charAcc);
    if (nc > 0) {
      this._charAcc -= nc;
      this._charIdx  = Math.min(this._charIdx + nc, line.text.length);
    }

    this._cursorT += dt;
    if (this._cursorT >= DatingVnEffect.CURSOR_BLINK_HALF) {
      this._cursorT   = 0;
      this._cursorVis = !this._cursorVis;
    }

    if (this._charIdx >= line.text.length) {
      this._lineComplete = true;
      this._cursorVis    = true;
      this._cursorT      = 0;
      this._blinkCount   = 0;
    }
  }

  // ── Accent color extraction ───────────────────────────────────────────────

  /**
   * Samples the background image at low resolution, bins pixels by hue, and
   * picks the dominant saturated hue to use as the dialog accent color.
   * Falls back to teal if the image isn't loaded or getImageData fails.
   */
  _extractAccentColor(img) {
    const fallback = () => {
      this._accentColor = '#44d4cc';
      this._accentDark  = '#001818';
      this._accentRgb   = [68, 212, 204];
    };
    if (!img || !img.complete || !img.naturalWidth) { fallback(); return; }

    // Draw to a tiny 48×30 canvas for fast sampling
    const W = 48, H = 30;
    const tc = document.createElement('canvas');
    tc.width = W; tc.height = H;
    const tCtx = tc.getContext('2d');
    tCtx.drawImage(img, 0, 0, W, H);

    let data;
    try { data = tCtx.getImageData(0, 0, W, H).data; }
    catch (_) { fallback(); return; }

    // Bin pixels by hue in 10° buckets; skip near-grey and extreme brightness
    const bins = Array.from({ length: 36 }, () => ({ count: 0, satSum: 0 }));
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const [h, s, l] = this._rgbToHsl(r, g, b);
      if (s < 0.20 || l < 0.15 || l > 0.88) continue;
      const bin = Math.floor(h / 10) % 36;
      bins[bin].count++;
      bins[bin].satSum += s;
    }

    // Dominant bin = highest total saturation mass
    let bestBin = -1, bestScore = 0;
    for (let i = 0; i < 36; i++) {
      if (bins[i].satSum > bestScore) { bestScore = bins[i].satSum; bestBin = i; }
    }
    if (bestBin < 0) { fallback(); return; }

    const hue   = bestBin * 10 + 5;  // centre of winning bucket
    const hex   = this._hslToHex(hue, 0.82, 0.64);
    const dark  = this._hslToHex(hue, 0.75, 0.14);
    const v     = parseInt(hex.slice(1), 16);
    this._accentColor = hex;
    this._accentDark  = dark;
    this._accentRgb   = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  _rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
    return [h * 360, s, l];
  }

  _hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const toHex = x => Math.round(hue2rgb(x) * 255).toString(16).padStart(2, '0');
    return `#${toHex(h / 360 + 1 / 3)}${toHex(h / 360)}${toHex(h / 360 - 1 / 3)}`;
  }

  // ── Background image drawing ──────────────────────────────────────────────

  _drawBgImage(ctx, ga, alpha, blurPx) {
    const img = this._bgImage;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ga.x, ga.y, ga.w, ga.h);
    ctx.clip();
    ctx.globalAlpha = alpha;

    if (!img || !img.complete || !img.naturalWidth) {
      ctx.fillStyle = '#080412';
      ctx.fillRect(ga.x, ga.y, ga.w, ga.h);
    } else if (blurPx > 0.5) {
      const m = Math.ceil(blurPx * 1.5);
      ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
      ctx.drawImage(img, ga.x - m, ga.y - m, ga.w + m * 2, ga.h + m * 2);
      ctx.filter = 'none';
    } else {
      ctx.drawImage(img, ga.x, ga.y, ga.w, ga.h);
    }

    ctx.restore();
  }

  // ── Dialog box ────────────────────────────────────────────────────────────

  _drawDialogBox(ga, ctx) {
    if (this._dialogExpand <= 0) return;

    const line = this._lineQueue[this._lineIdx];
    if (!line) return;

    // ── Box geometry — inset from edges so image shows around the border ────
    const hPad   = Math.floor(ga.w * 0.04);   // ~4% left & right
    const bPad   = Math.floor(ga.h * 0.03);   // ~3% off the bottom
    const fullBH = Math.floor(ga.h * 0.19);
    const bw     = ga.w - hPad * 2;
    const bx     = ga.x + hPad;
    const fullBy = ga.y + ga.h - fullBH - bPad;

    // Accent color components
    const [ar, ag, ab] = this._accentRgb;
    const acFull = this._accentColor;
    const acDim  = `rgba(${ar},${ag},${ab},0.28)`;

    // Expand: grows upward from bottom edge
    const bh = Math.floor(fullBH * this._dialogExpand);
    const by = fullBy + fullBH - bh;
    if (bh < 4) return;

    // ── Box chrome (clipped to current expand height) ────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();

    ctx.fillStyle = 'rgba(4,2,18,0.93)';
    ctx.fillRect(bx, fullBy, bw, fullBH);

    ctx.strokeStyle = acFull;
    ctx.lineWidth   = 2;
    ctx.strokeRect(bx + 1, fullBy + 1, bw - 2, fullBH - 2);

    ctx.strokeStyle = acDim;
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx + 5, fullBy + 5, bw - 10, fullBH - 10);

    ctx.restore();

    // ── Text content (fades in when box is ≥ 65% open) ──────────────────
    if (this._dialogExpand < 0.65) return;
    const textAlpha = Math.min(1, (this._dialogExpand - 0.65) / 0.35);

    ctx.save();
    ctx.globalAlpha = textAlpha;

    // Typewriter text font size — compute first so name tag can match
    const fontSize = Math.max(11, Math.floor(ga.h * 0.038));

    // Name tag chip — height and font match the dialog body text
    const namePx = fontSize;
    const nameH  = namePx + 10;   // top+bottom padding inside chip
    ctx.font = `bold ${namePx}px "Courier New", monospace`;
    const nameW = Math.ceil(ctx.measureText(line.speaker).width) + 28;
    ctx.fillStyle = acFull;
    ctx.fillRect(bx + 14, fullBy - nameH + 2, nameW, nameH);

    // Angled notch on right of name tag
    ctx.beginPath();
    ctx.moveTo(bx + 14 + nameW,     fullBy - nameH + 2);
    ctx.lineTo(bx + 14 + nameW + 8, fullBy + 2);
    ctx.lineTo(bx + 14 + nameW,     fullBy + 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,2,18,0.93)';
    ctx.fill();

    // Name text
    ctx.fillStyle    = this._accentDark;
    ctx.font         = `bold ${namePx}px "Courier New", monospace`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(line.speaker, bx + 20, fullBy - nameH / 2 + 2);
    ctx.font         = `${fontSize}px "Courier New", monospace`;
    ctx.fillStyle    = '#d8f4f0';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';

    const textX = bx + 24;
    const textY = fullBy + 14;
    const maxW  = bw - 50;
    const lineH = Math.floor(fontSize * 1.55);

    const visText = line.text.slice(0, this._charIdx);
    const wrapped = this._wrapLines(ctx, visText, maxW);
    for (let i = 0; i < wrapped.length; i++) {
      ctx.fillText(wrapped[i], textX, textY + i * lineH);
    }

    // Block cursor
    if (this._cursorVis) {
      const last   = wrapped[wrapped.length - 1] || '';
      const rowOff = (wrapped.length - 1) * lineH;
      ctx.fillStyle = acFull;
      ctx.fillText('█', textX + ctx.measureText(last).width + 2, textY + rowOff);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _wrapLines(ctx, text, maxW) {
    if (!text) return [''];
    const words  = text.split(' ');
    const result = [];
    let   current = '';
    for (const w of words) {
      const test = current ? current + ' ' + w : w;
      if (ctx.measureText(test).width <= maxW) {
        current = test;
      } else {
        if (current) result.push(current);
        current = w;
      }
    }
    if (current) result.push(current);
    return result.length ? result : [''];
  }

  // ── Snapshot (for outro) ──────────────────────────────────────────────────

  _buildSnapshot() {
    const ga = this._gameArea();
    this._snapshotCanvas = document.createElement('canvas');
    this._snapshotCanvas.width  = ga.w;
    this._snapshotCanvas.height = ga.h;
    const sCtx = this._snapshotCanvas.getContext('2d');

    const img = this._bgImage;
    if (img && img.complete && img.naturalWidth > 0) {
      sCtx.drawImage(img, 0, 0, ga.w, ga.h);
    } else {
      sCtx.fillStyle = '#080412';
      sCtx.fillRect(0, 0, ga.w, ga.h);
    }

    const localGa = { x: 0, y: 0, w: ga.w, h: ga.h };
    this._drawDialogBox(localGa, sCtx);
  }

  // ── Outro ─────────────────────────────────────────────────────────────────

  _updateOutro(dt) {
    switch (this._outroPhase) {
      case 'warble':  this._updateWarble();    break;
      case 'glitch':  this._updateGlitch();    break;
      case 'crumble': this._updateCrumble(dt); break;
    }
  }

  // ── Warble ────────────────────────────────────────────────────────────────

  _updateWarble() {
    const progress    = Math.min(this._t / DatingVnEffect.WARBLE_DURATION, 1.0);
    const maxDisplace = DatingVnEffect.WARBLE_MAX_PX * progress;
    const ga          = this._gameArea();
    const snap        = this._snapshotCanvas;
    if (!snap) { this._outroPhase = 'glitch'; this._t = 0; return; }

    const ctx    = this._ctx;
    const stripH = 4;
    ctx.save();
    for (let y = 0; y < ga.h; y += stripH) {
      const h      = Math.min(stripH, ga.h - y);
      const offset = Math.sin((y / ga.h + this._t * 3.0) * Math.PI * 6) * maxDisplace;
      ctx.drawImage(snap, 0, y, ga.w, h, ga.x + offset, ga.y + y, ga.w, h);
    }
    ctx.restore();

    if (this._t >= DatingVnEffect.WARBLE_DURATION) {
      this._outroPhase = 'glitch';
      this._t          = 0;
      this._buildGlitchRects();
    }
  }

  _buildGlitchRects() {
    const ga = this._gameArea();
    this._glitchRects = [];
    this._invertDone  = false;
    for (let i = 0; i < 10; i++) {
      this._glitchRects.push({
        x:     ga.x + Math.random() * ga.w * 0.75,
        y:     ga.y + Math.random() * ga.h * 0.75,
        w:     ga.w * (0.10 + Math.random() * 0.35),
        h:     ga.h * (0.04 + Math.random() * 0.18),
        color: ['#ff0000','#00ffff','#ffffff','#ff00ff','#ffff00'][Math.floor(Math.random() * 5)],
        alpha: 0.38 + Math.random() * 0.42,
      });
    }
  }

  // ── Glitch ────────────────────────────────────────────────────────────────

  _updateGlitch() {
    const ga   = this._gameArea();
    const snap = this._snapshotCanvas;
    const ctx  = this._ctx;

    if (snap) {
      const stripH = 4;
      ctx.save();
      for (let y = 0; y < ga.h; y += stripH) {
        const h      = Math.min(stripH, ga.h - y);
        const offset = Math.sin((y / ga.h) * Math.PI * 6) * DatingVnEffect.WARBLE_MAX_PX;
        ctx.drawImage(snap, 0, y, ga.w, h, ga.x + offset, ga.y + y, ga.w, h);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const r of this._glitchRects) {
      if (Math.random() < 0.45) continue;
      ctx.globalAlpha = r.alpha;
      ctx.fillStyle   = r.color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();

    if (this._t >= DatingVnEffect.GLITCH_DURATION * 0.45 && !this._invertDone) {
      this._invertDone = true;
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ga.x, ga.y, ga.w, ga.h);
      ctx.restore();
    }

    if (snap && this._t < DatingVnEffect.GLITCH_DURATION * 0.80) {
      const shift = 7;
      ctx.save();
      ctx.globalAlpha              = 0.22;
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'hue-rotate(0deg) saturate(4)';
      ctx.drawImage(snap, ga.x - shift, ga.y, ga.w, ga.h);
      ctx.filter = 'hue-rotate(180deg) saturate(4)';
      ctx.drawImage(snap, ga.x + shift, ga.y, ga.w, ga.h);
      ctx.filter = 'none';
      ctx.restore();
    }

    if (this._t >= DatingVnEffect.GLITCH_DURATION) {
      this._outroPhase = 'crumble';
      this._t          = 0;
      this._buildCrumble();
    }
  }

  // ── Crumble ───────────────────────────────────────────────────────────────

  _buildCrumble() {
    const ga   = this._gameArea();
    const snap = this._snapshotCanvas;
    this._particles = [];
    if (!snap) return;

    const BS   = DatingVnEffect.BLOCK_SIZE;
    const cols = Math.ceil(ga.w / BS);
    const rows = Math.ceil(ga.h / BS);
    const gCX  = ga.x + ga.w / 2;
    const gCY  = ga.y + ga.h / 2;

    // Try a single bulk getImageData read (fast; falls back to drawImage if tainted)
    let pixels = null;
    try {
      pixels = snap.getContext('2d').getImageData(0, 0, ga.w, ga.h).data;
    } catch (_) { /* canvas taint — use drawImage path instead */ }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = col * BS;
        const py = row * BS;
        const cx = px + Math.floor(BS / 2);
        const cy = py + Math.floor(BS / 2);

        // Sample center-pixel color when available; skip fully transparent blocks
        let color = null;   // null → use drawImage in _updateCrumble
        if (pixels) {
          const i = (cy * ga.w + cx) * 4;
          if (pixels[i + 3] < 8) continue;
          color = `rgb(${pixels[i]},${pixels[i + 1]},${pixels[i + 2]})`;
        }

        const sx    = ga.x + px + BS / 2;
        const sy    = ga.y + py + BS / 2;
        const dx    = sx - gCX, dy = sy - gCY;
        const dist  = Math.hypot(dx, dy) || 1;
        const speed = 50 + Math.random() * 170;
        const life  = DatingVnEffect.PARTICLE_LIFE_MIN +
                      Math.random() * (DatingVnEffect.PARTICLE_LIFE_MAX - DatingVnEffect.PARTICLE_LIFE_MIN);

        this._particles.push({
          srcX: px, srcY: py,   // source region in snapshot (for drawImage fallback)
          x: sx, y: sy,
          vx: (dx / dist) * speed * (0.6 + Math.random() * 0.8),
          vy: (dy / dist) * speed * (0.6 + Math.random() * 0.8) - 45,
          size: BS,
          color,                // null if getImageData failed
          life,
          maxLife: life,
          gravity: DatingVnEffect.OUTRO_GRAVITY,
        });
      }
    }
  }

  _updateCrumble(dt) {
    const snap = this._snapshotCanvas;

    for (const p of this._particles) {
      p.vy   += p.gravity * dt;
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.life -= dt;
    }
    this._particles = this._particles.filter(
      p => p.life > 0 && p.y < this._canvas.height + 40
    );

    const ctx = this._ctx;
    ctx.save();
    for (const p of this._particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.88;
      if (p.color) {
        // Fast path: solid-color fillRect
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
      } else if (snap) {
        // Fallback: draw the actual image tile (works even if canvas was tainted)
        ctx.drawImage(
          snap, p.srcX, p.srcY, p.size, p.size,
          Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size
        );
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (this._particles.length === 0) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._state = 'idle';
    }
  }
}

// ── Register ─────────────────────────────────────────────────────────────
PackageRegistry.registerEffect(new DatingVnEffect());
