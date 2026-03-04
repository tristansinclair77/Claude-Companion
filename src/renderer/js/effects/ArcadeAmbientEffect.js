'use strict';
/**
 * ArcadeAmbientEffect — persistent ambient + occasional CRT glitch effects.
 * Registered under id 'arcadeAmbient'. Used by: Arcade Cabinet package.
 *
 * Canvas effects (continuous, drawn on #bg-arcade-ambient z-index:3):
 *   - Raster beam : faint bright line sweeping top→bottom like a CRT electron beam
 *   - Attract mode: "INSERT COIN" pixel-text blinking in the game area when SI is idle
 *   - Pixel dust  : tiny 1px sparks that appear and twinkle out across the screen
 *
 * Canvas effects (occasional, auto-triggered):
 *   - Degauss ripple: expanding rainbow bloom from screen centre (every 5–15 min)
 *
 * DOM effects (occasional, CSS-based):
 *   - CRT pop-on   : screen powers on from a horizontal line on every _onStart()
 *   - Hold slip    : image briefly shears sideways, then snaps back (every 1.5–4 min)
 */
class ArcadeAmbientEffect extends VisualEffect {

  // ── Tuning ────────────────────────────────────────────────────────────────
  static RASTER_SPEED          = 0.30;  // screen-heights per second
  static ATTRACT_BLINK         = 1.0;   // seconds per on/off blink cycle
  static DUST_RATE             = 3.5;   // new sparks per second
  static DUST_LIFE_BASE        = 1.3;   // base seconds each spark lives
  static SLIP_INTERVAL_MIN     = 90;    // seconds min between hold-slip events
  static SLIP_INTERVAL_MAX     = 240;   // seconds max
  static DEGAUSS_INTERVAL_MIN  = 300;   // seconds min between degauss events (5 min)
  static DEGAUSS_INTERVAL_MAX  = 900;   // seconds max (15 min)
  static DEGAUSS_DURATION      = 0.7;   // seconds for the degauss animation

  constructor() {
    super('arcadeAmbient');
    this._canvas       = null;
    this._ctx          = null;
    this._rAF          = null;
    this._lastTs       = 0;

    // Raster beam — Y position as fraction of drawable height (0–1, wraps)
    this._rasterY      = 0;

    // Attract mode
    this._attractT     = 0;
    this._attractVis   = true;

    // Pixel dust
    this._dust         = [];
    this._dustAccum    = 0;

    // Degauss
    this._degaussT     = -1;     // -1 = inactive; 0→1 = running
    this._degaussTimer = null;

    // Hold slip
    this._slipTimer    = null;

    // Per-sub-effect enables (can be toggled live)
    this._rasterEnabled  = true;
    this._dustEnabled    = true;
    this._attractEnabled = true;
    this._glitchEnabled  = true;
  }

  // ── VisualEffect hooks ────────────────────────────────────────────────────

  _onStart(config = {}) {
    this._rasterEnabled  = config.rasterBeam !== false;
    this._dustEnabled    = config.pixelDust  !== false;
    this._attractEnabled = config.attract    !== false;
    this._glitchEnabled  = config.glitches   !== false;

    this._initCanvas();
    this._rasterY  = Math.random();   // start beam at a random position
    this._attractT = 0;
    this._attractVis = true;
    this._dust     = [];
    this._dustAccum = 0;
    this._degaussT = -1;
    this._lastTs   = 0;
    if (this._glitchEnabled) this._scheduleSlip();
    if (this._glitchEnabled) this._scheduleDegauss();
    this._doCrtPopOn();
    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  _onStop() {
    if (this._rAF)        { cancelAnimationFrame(this._rAF);   this._rAF = null; }
    if (this._slipTimer)  { clearTimeout(this._slipTimer);  this._slipTimer = null; }
    if (this._degaussTimer){ clearTimeout(this._degaussTimer); this._degaussTimer = null; }
    if (this._ctx && this._canvas)
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    // Restore any lingering hold-slip transform
    document.getElementById('main-content') && (document.getElementById('main-content').style.transform = '');
  }

  _onUpdate(key, value) {
    switch (key) {
      case 'rasterBeam': this._rasterEnabled  = value; break;
      case 'pixelDust':  this._dustEnabled    = value; break;
      case 'attract':    this._attractEnabled = value; break;
      case 'glitches':
        this._glitchEnabled = value;
        if (!value) {
          if (this._slipTimer)   { clearTimeout(this._slipTimer);   this._slipTimer   = null; }
          if (this._degaussTimer){ clearTimeout(this._degaussTimer); this._degaussTimer = null; }
          this._degaussT = -1;
        } else {
          if (!this._slipTimer)   this._scheduleSlip();
          if (!this._degaussTimer) this._scheduleDegauss();
        }
        break;
    }
  }

  // ── Canvas init ───────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return;
    this._canvas = document.getElementById('bg-arcade-ambient');
    if (!this._canvas) return;
    this._ctx = this._canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    if (!this._canvas) return;
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  _tick(ts) {
    if (!this._running || !this._canvas) { this._rAF = null; return; }
    if (!this._lastTs) this._lastTs = ts;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.10);
    this._lastTs = ts;

    this._rasterY += ArcadeAmbientEffect.RASTER_SPEED * dt;
    if (this._rasterY > 1) this._rasterY -= 1;

    this._attractT += dt;
    const period = ArcadeAmbientEffect.ATTRACT_BLINK;
    if (this._attractT >= period) this._attractT -= period;
    this._attractVis = this._attractT < period * 0.55;  // 55% on, 45% off

    if (this._dustEnabled) {
      this._dustAccum += dt * ArcadeAmbientEffect.DUST_RATE;
      while (this._dustAccum >= 1) {
        this._dustAccum -= 1;
        this._spawnDust();
      }
    }
    for (const d of this._dust) d.life -= d.decay * dt;
    this._dust = this._dust.filter(d => d.life > 0);

    if (this._degaussT >= 0) {
      this._degaussT += dt / ArcadeAmbientEffect.DEGAUSS_DURATION;
      if (this._degaussT >= 1) this._degaussT = -1;
    }

    this._draw();
    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Pixel dust ────────────────────────────────────────────────────────────

  _spawnDust() {
    if (!this._canvas) return;
    const W = this._canvas.width, H = this._canvas.height;
    const PALETTE = ['#ffee00', '#ffffff', '#ffaa00', '#00dd44', '#ff4400'];
    const life = ArcadeAmbientEffect.DUST_LIFE_BASE * (0.5 + Math.random());
    this._dust.push({
      x:     Math.random() * W,
      y:     Math.random() * H,
      life:  1.0,
      decay: 1 / life,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      size:  Math.random() < 0.15 ? 2 : 1,  // occasional 2px spark
    });
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (this._rasterEnabled)  this._drawRaster(ctx, W, H);
    if (this._dustEnabled)    this._drawDust(ctx);
    if (this._attractEnabled) this._drawAttract(ctx);
    if (this._glitchEnabled && this._degaussT >= 0) this._drawDegauss(ctx, W, H);
  }

  _drawRaster(ctx, W, H) {
    const TH    = 32;               // title bar height
    const drawH = H - TH;
    const y     = TH + this._rasterY * drawH;

    // Soft gradient: transparent → dim yellow → bright white at centre → dim yellow → transparent
    const grad = ctx.createLinearGradient(0, y - 6, 0, y + 8);
    grad.addColorStop(0,    'rgba(255,255,255,0)');
    grad.addColorStop(0.35, 'rgba(255,238,0,0.05)');
    grad.addColorStop(0.5,  'rgba(255,255,255,0.10)');
    grad.addColorStop(0.65, 'rgba(255,238,0,0.05)');
    grad.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 6, W, 14);
  }

  _drawDust(ctx) {
    for (const d of this._dust) {
      // Sparkle: ramp up then down using sine over lifetime
      const alpha = Math.sin(d.life * Math.PI) * 0.50;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = d.color;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), d.size, d.size);
    }
    ctx.globalAlpha = 1;
  }

  _drawAttract(ctx) {
    // Suppressed while Space Invaders game is active
    const si = PackageRegistry.getEffect('spaceInvaders');
    if (si && si._state !== 'idle') return;
    if (!this._attractVis) return;

    const panel = document.getElementById('output-panel');
    if (!panel) return;
    const r = panel.getBoundingClientRect();

    ctx.save();
    ctx.font        = 'bold 14px "Courier New", monospace';
    ctx.textAlign   = 'center';
    ctx.letterSpacing = '3px';
    ctx.globalAlpha = 0.20;
    ctx.fillStyle   = '#ffee00';
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur  = 10;
    ctx.fillText('INSERT COIN', r.left + r.width / 2, r.top + r.height * 0.80);
    ctx.restore();
  }

  _drawDegauss(ctx, W, H) {
    const t = this._degaussT;  // 0→1

    if (t < 0.18) {
      // Phase 1 (0–0.18): quick white flash
      const a = Math.sin((t / 0.18) * Math.PI) * 0.32;
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      // Phase 2 (0.18–1): rainbow ripple expanding from centre
      const prog  = (t - 0.18) / 0.82;
      const maxR  = Math.sqrt(W * W + H * H) * 0.6;
      const r1    = prog * maxR * 1.15;
      const r0    = Math.max(0, r1 - 80);
      const fade  = 1 - prog;          // ring fades as it expands
      if (r1 > r0) {
        const hue  = prog * 320;
        const grad = ctx.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, r1);
        grad.addColorStop(0,   `hsla(${hue},100%,65%,0)`);
        grad.addColorStop(0.35, `hsla(${hue},100%,65%,${(0.28 * fade).toFixed(3)})`);
        grad.addColorStop(0.7,  `hsla(${(hue + 70) % 360},100%,65%,${(0.14 * fade).toFixed(3)})`);
        grad.addColorStop(1,   `hsla(${(hue + 140) % 360},100%,65%,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  // ── CRT pop-on ────────────────────────────────────────────────────────────
  // Two black panels (top half / bottom half) split outward to reveal the app.

  _doCrtPopOn() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none';

    const top = document.createElement('div');
    top.style.cssText = 'position:absolute;top:0;left:0;right:0;height:50%;background:#080808';

    // Bright scan line at the join
    const line = document.createElement('div');
    line.style.cssText = [
      'position:absolute',
      'top:calc(50% - 1px)',
      'left:0',
      'right:0',
      'height:2px',
      'background:#ffee00',
      'box-shadow:0 0 8px 2px #ffee00',
      'transition:opacity 0.12s ease-out',
    ].join(';');

    const bot = document.createElement('div');
    bot.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:50%;background:#080808';

    wrap.appendChild(top);
    wrap.appendChild(line);
    wrap.appendChild(bot);
    document.body.appendChild(wrap);

    // Next frame: panels retract to reveal app; line fades
    requestAnimationFrame(() => requestAnimationFrame(() => {
      top.style.transition = 'height 0.30s ease-out';
      bot.style.transition = 'height 0.30s ease-out';
      top.style.height = '0%';
      bot.style.height = '0%';
      setTimeout(() => { line.style.opacity = '0'; }, 100);
    }));

    setTimeout(() => wrap.remove(), 550);
  }

  // ── Hold slip ─────────────────────────────────────────────────────────────

  _scheduleSlip() {
    const MIN = ArcadeAmbientEffect.SLIP_INTERVAL_MIN * 1000;
    const MAX = ArcadeAmbientEffect.SLIP_INTERVAL_MAX * 1000;
    const delay = MIN + Math.random() * (MAX - MIN);
    this._slipTimer = setTimeout(() => {
      if (!this._running || !this._glitchEnabled) return;
      this._doHoldSlip();
      this._scheduleSlip();
    }, delay);
  }

  _doHoldSlip() {
    const mc = document.getElementById('main-content');
    if (!mc) return;
    const amount = (8 + Math.random() * 18) * (Math.random() < 0.5 ? 1 : -1);
    mc.style.transition = 'none';
    mc.style.transform  = `translateX(${amount.toFixed(1)}px)`;
    // A second micro-slip in the opposite direction before snap-back
    setTimeout(() => {
      if (!this._running) return;
      mc.style.transform = `translateX(${(-amount * 0.35).toFixed(1)}px)`;
    }, 55);
    setTimeout(() => {
      if (!this._running) return;
      mc.style.transform = '';
    }, 110);
  }

  // ── Degauss ───────────────────────────────────────────────────────────────

  _scheduleDegauss() {
    const MIN = ArcadeAmbientEffect.DEGAUSS_INTERVAL_MIN * 1000;
    const MAX = ArcadeAmbientEffect.DEGAUSS_INTERVAL_MAX * 1000;
    const delay = MIN + Math.random() * (MAX - MIN);
    this._degaussTimer = setTimeout(() => {
      if (!this._running || !this._glitchEnabled) return;
      this._degaussT = 0;        // trigger the animation
      this._scheduleDegauss();
    }, delay);
  }
}

PackageRegistry.registerEffect(new ArcadeAmbientEffect());
