'use strict';
/**
 * ArcadeAmbientEffect — persistent ambient + occasional CRT glitch effects.
 * Registered under id 'arcadeAmbient'. Used by: Arcade Cabinet package.
 *
 * Canvas effects (continuous, drawn on #bg-arcade-ambient z-index:3):
 *   - Shadow game  : ghost version of a random arcade game at very low alpha,
 *                    visible only when no real event effect is running
 *   - Raster beam  : faint bright line sweeping top→bottom like a CRT electron beam
 *   - Attract mode : "INSERT COIN" pixel-text blinking in the game area when idle
 *   - Pixel dust   : tiny 1px sparks that appear and twinkle out across the screen
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

  // Shadow game
  static SHADOW_ALPHA          = 0.08;  // how faint the ghost game is
  static SHADOW_ROTATE_MIN     = 25;    // seconds before switching game type
  static SHADOW_ROTATE_MAX     = 50;

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

    // "1 QUARTER!" drop animation — plays when any event effect starts
    this._wasEventBusy   = false;
    this._quarterT       = -1;    // -1 = inactive; ≥0 = elapsed seconds
    this._quarterStartY  = 0;    // screen Y where the text begins

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

    // Shadow game
    this._anyBusy          = false;
    this._shadowType       = null;   // 'pong' | 'invaders' | 'asteroids'
    this._shadowState      = null;
    this._shadowRotateT    = 0;
    this._shadowRotateInterval = 0;  // set randomly on first init
  }

  // ── VisualEffect hooks ────────────────────────────────────────────────────

  _onStart(config = {}) {
    this._rasterEnabled  = config.rasterBeam !== false;
    this._dustEnabled    = config.pixelDust  !== false;
    this._attractEnabled = config.attract    !== false;
    this._glitchEnabled  = config.glitches   !== false;

    this._initCanvas();
    this._rasterY  = Math.random();
    this._attractT = 0;
    this._attractVis = true;
    this._dust     = [];
    this._dustAccum = 0;
    this._degaussT = -1;
    this._lastTs   = 0;

    this._anyBusy          = false;
    this._shadowType       = null;
    this._shadowState      = null;
    this._shadowRotateT    = 0;
    this._shadowRotateInterval = 0;

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
    this._attractVis = this._attractT < period * 0.55;

    // Detect event start → trigger "1 QUARTER!" animation
    const _EVENT_IDS = ['spaceInvaders', 'asteroids', 'pong'];
    const anyBusy    = _EVENT_IDS.some(id => PackageRegistry.getEffect(id)?.busy);
    this._anyBusy    = anyBusy;
    if (anyBusy && !this._wasEventBusy && this._quarterT < 0) {
      const panel = document.getElementById('output-panel');
      const r     = panel?.getBoundingClientRect();
      this._quarterStartY = r ? r.top + r.height * 0.80 : this._canvas.height * 0.72;
      this._quarterT      = 0;
    }
    this._wasEventBusy = anyBusy;
    if (this._quarterT >= 0) {
      this._quarterT += dt;
      if (this._quarterT > 1.5) this._quarterT = -1;
    }

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

    // Shadow game — update only when no real event is running
    if (!anyBusy) {
      this._shadowRotateT += dt;
      if (this._shadowType === null || this._shadowRotateT >= this._shadowRotateInterval) {
        this._shadowRotateT = 0;
        this._shadowRotateInterval = ArcadeAmbientEffect.SHADOW_ROTATE_MIN
          + Math.random() * (ArcadeAmbientEffect.SHADOW_ROTATE_MAX - ArcadeAmbientEffect.SHADOW_ROTATE_MIN);
        const types      = ['pong', 'invaders', 'asteroids'];
        const candidates = types.filter(t => t !== this._shadowType);
        this._shadowType  = candidates[Math.floor(Math.random() * candidates.length)];
        this._shadowState = this._shadowInit(this._shadowType);
      }
      this._shadowUpdate(dt);
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
      size:  Math.random() < 0.15 ? 2 : 1,
    });
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;
    ctx.clearRect(0, 0, W, H);

    this._drawShadow(ctx);                  // ghost game — drawn first, behind everything
    if (this._rasterEnabled)  this._drawRaster(ctx, W, H);
    if (this._dustEnabled)    this._drawDust(ctx);
    if (this._attractEnabled) this._drawAttract(ctx);
    if (this._glitchEnabled && this._degaussT >= 0) this._drawDegauss(ctx, W, H);
  }

  _drawRaster(ctx, W, H) {
    const TH    = 32;
    const drawH = H - TH;
    const y     = TH + this._rasterY * drawH;
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
      const alpha = Math.sin(d.life * Math.PI) * 0.50;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = d.color;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), d.size, d.size);
    }
    ctx.globalAlpha = 1;
  }

  _drawAttract(ctx) {
    const panel = document.getElementById('output-panel');
    if (!panel) return;
    const r = panel.getBoundingClientRect();

    // ── "1 QUARTER!" drop animation ───────────────────────────────────────
    if (this._quarterT >= 0) {
      const FLASH = 0.28;
      const SINK  = 1.22;
      const t     = this._quarterT;
      let alpha, y;
      if (t < FLASH) {
        alpha = 0.95 * Math.sin((t / FLASH) * Math.PI);
        y     = this._quarterStartY;
      } else {
        const st   = t - FLASH;
        const frac = st / SINK;
        alpha = Math.max(0, 0.85 * (1 - frac * frac));
        y     = this._quarterStartY + 380 * st * st;
      }
      if (alpha > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.left, r.top, r.width, r.height);
        ctx.clip();
        ctx.font          = 'bold 14px "Courier New", monospace';
        ctx.textAlign     = 'center';
        ctx.letterSpacing = '3px';
        ctx.globalAlpha   = alpha;
        ctx.fillStyle     = '#ffee00';
        ctx.shadowColor   = '#ffee00';
        ctx.shadowBlur    = 14;
        ctx.fillText('1 QUARTER!', r.left + r.width / 2, y);
        ctx.restore();
      }
    }

    // ── INSERT COIN ───────────────────────────────────────────────────────
    if (this._anyBusy || this._quarterT >= 0) return;
    if (!this._attractVis) return;

    ctx.save();
    ctx.font          = 'bold 14px "Courier New", monospace';
    ctx.textAlign     = 'center';
    ctx.letterSpacing = '3px';
    ctx.globalAlpha   = 0.20;
    ctx.fillStyle     = '#ffee00';
    ctx.shadowColor   = '#ffee00';
    ctx.shadowBlur    = 10;
    ctx.fillText('INSERT COIN', r.left + r.width / 2, r.top + r.height * 0.80);
    ctx.restore();
  }

  _drawDegauss(ctx, W, H) {
    const t = this._degaussT;
    if (t < 0.18) {
      const a = Math.sin((t / 0.18) * Math.PI) * 0.32;
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      const prog  = (t - 0.18) / 0.82;
      const maxR  = Math.sqrt(W * W + H * H) * 0.6;
      const r1    = prog * maxR * 1.15;
      const r0    = Math.max(0, r1 - 80);
      const fade  = 1 - prog;
      if (r1 > r0) {
        const hue  = prog * 320;
        const grad = ctx.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, r1);
        grad.addColorStop(0,    `hsla(${hue},100%,65%,0)`);
        grad.addColorStop(0.35, `hsla(${hue},100%,65%,${(0.28 * fade).toFixed(3)})`);
        grad.addColorStop(0.7,  `hsla(${(hue + 70) % 360},100%,65%,${(0.14 * fade).toFixed(3)})`);
        grad.addColorStop(1,    `hsla(${(hue + 140) % 360},100%,65%,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  // ── Shadow game ───────────────────────────────────────────────────────────

  /** Returns the inner rect of the output-panel (game area). */
  _shadowPanel() {
    const panel = document.getElementById('output-panel');
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    return { x: r.left + 8, y: r.top + 8, w: r.width - 16, h: r.height - 16 };
  }

  _shadowInit(type) {
    const ga = this._shadowPanel();
    if (!ga) return null;
    switch (type) {
      case 'pong':      return this._shadowInitPong(ga);
      case 'invaders':  return this._shadowInitInvaders(ga);
      case 'asteroids': return this._shadowInitAsteroids(ga);
    }
    return null;
  }

  _shadowUpdate(dt) {
    if (!this._shadowState) return;
    const ga = this._shadowPanel();
    if (!ga) return;
    switch (this._shadowType) {
      case 'pong':      this._shadowUpdatePong(dt, ga);      break;
      case 'invaders':  this._shadowUpdateInvaders(dt, ga);  break;
      case 'asteroids': this._shadowUpdateAsteroids(dt, ga); break;
    }
  }

  _drawShadow(ctx) {
    if (this._anyBusy || !this._shadowType || !this._shadowState) return;
    const ga = this._shadowPanel();
    if (!ga) return;
    ctx.save();
    ctx.globalAlpha = ArcadeAmbientEffect.SHADOW_ALPHA;
    ctx.beginPath(); ctx.rect(ga.x, ga.y, ga.w, ga.h); ctx.clip();
    switch (this._shadowType) {
      case 'pong':      this._shadowDrawPong(ctx, ga);      break;
      case 'invaders':  this._shadowDrawInvaders(ctx, ga);  break;
      case 'asteroids': this._shadowDrawAsteroids(ctx, ga); break;
    }
    ctx.restore();
  }

  // ── Shadow Pong ───────────────────────────────────────────────────────────

  _shadowInitPong(ga) {
    const spd = 150;
    const ang = (Math.random() < 0.5 ? 0 : Math.PI)
              + (Math.random() < 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.30);
    return {
      ball:   { x: ga.x + ga.w / 2, y: ga.y + ga.h * 0.25 + Math.random() * ga.h * 0.5,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd },
      leftY:  ga.y + ga.h / 2 - 26,
      rightY: ga.y + ga.h / 2 - 26,
    };
  }

  _shadowUpdatePong(dt, ga) {
    const s = this._shadowState;
    const b = s.ball;
    const PH = 52, PW = 8, hs = 4, inset = 16, trackSpd = 100;

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Wall bounces
    if (b.y - hs < ga.y) { b.y = ga.y + hs; b.vy = Math.abs(b.vy); }
    if (b.y + hs > ga.y + ga.h) { b.y = ga.y + ga.h - hs; b.vy = -Math.abs(b.vy); }

    const lx = ga.x + inset;
    const rx = ga.x + ga.w - inset - PW;

    // Paddle tracking
    const ltgt = Math.max(ga.y, Math.min(ga.y + ga.h - PH, b.y - PH / 2));
    const rtgt = Math.max(ga.y, Math.min(ga.y + ga.h - PH, b.y - PH / 2));
    const ldiff = ltgt - s.leftY;
    s.leftY  += Math.sign(ldiff) * Math.min(Math.abs(ldiff), trackSpd * dt);
    const rdiff = rtgt - s.rightY;
    s.rightY += Math.sign(rdiff) * Math.min(Math.abs(rdiff), trackSpd * dt);

    // Paddle bounces
    if (b.vx < 0 && b.x - hs <= lx + PW && b.x + hs >= lx
        && b.y + hs >= s.leftY && b.y - hs <= s.leftY + PH) {
      b.x = lx + PW + hs; b.vx = Math.abs(b.vx);
    }
    if (b.vx > 0 && b.x + hs >= rx && b.x - hs <= rx + PW
        && b.y + hs >= s.rightY && b.y - hs <= s.rightY + PH) {
      b.x = rx - hs; b.vx = -Math.abs(b.vx);
    }

    // Reset if ball exits
    if (b.x < ga.x - 20 || b.x > ga.x + ga.w + 20) {
      const spd = 150;
      const ang = (Math.random() < 0.5 ? 0 : Math.PI)
                + (Math.random() < 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.30);
      b.x = ga.x + ga.w / 2;
      b.y = ga.y + ga.h * 0.25 + Math.random() * ga.h * 0.5;
      b.vx = Math.cos(ang) * spd;
      b.vy = Math.sin(ang) * spd;
    }
  }

  _shadowDrawPong(ctx, ga) {
    const s = this._shadowState;
    const PH = 52, PW = 8, inset = 16;
    ctx.fillStyle = '#888888';
    ctx.fillRect(Math.round(ga.x + inset),             Math.round(s.leftY),  PW, PH);
    ctx.fillRect(Math.round(ga.x + ga.w - inset - PW), Math.round(s.rightY), PW, PH);
    const b = s.ball;
    ctx.fillRect(Math.round(b.x - 4), Math.round(b.y - 4), 8, 8);
  }

  // ── Shadow Invaders ───────────────────────────────────────────────────────
  // Pixel-art invaders formation + player ship + barriers, all in shadow form.

  _shadowInitInvaders(ga) {
    return {
      offsetX: 0, offsetY: 0, dir: 1, stepT: 0, stepInterval: 0.65,
      ship: { x: ga.x + ga.w / 2, vx: 22 },
    };
  }

  _shadowUpdateInvaders(dt, ga) {
    const s = this._shadowState;
    // Compute how far the formation can travel before hitting either wall.
    // Formation left starts at ga.x+30+offsetX; right edge = left + (cols-1)*colW + sprite_w
    const px = 3, cols = 8, colW = (ga.w - 60) / cols;
    const formationW = (cols - 1) * colW + 5 * px;  // full formation width
    const maxTravel  = Math.max(0, ga.w - 60 - formationW);  // rightmost valid offsetX
    s.stepT += dt;
    if (s.stepT >= s.stepInterval) {
      s.stepT -= s.stepInterval;
      s.offsetX += s.dir * 7;
      if (s.offsetX > maxTravel || s.offsetX < 0) {
        s.dir     *= -1;
        s.offsetX  = Math.max(0, Math.min(maxTravel, s.offsetX));  // clamp to valid range
        s.offsetY += 14;
        if (s.offsetY > ga.h * 0.42) s.offsetY = 0;
      }
    }
    // Player ship drifts slowly at the bottom
    s.ship.x += s.ship.vx * dt;
    const minX = ga.x + 20, maxX = ga.x + ga.w - 20;
    if (s.ship.x < minX) { s.ship.x = minX; s.ship.vx =  Math.abs(s.ship.vx); }
    if (s.ship.x > maxX) { s.ship.x = maxX; s.ship.vx = -Math.abs(s.ship.vx); }
  }

  _shadowDrawInvaders(ctx, ga) {
    const s    = this._shadowState;
    const px   = 3;                           // pixel size
    const cols = 8, rows = 3;
    const colW = (ga.w - 60) / cols;
    const rowH = 5 * px + 10;                // sprite height + gap

    ctx.fillStyle = '#888888';

    // Formation
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = Math.round(ga.x + 30 + s.offsetX + col * colW);
        const y = Math.round(ga.y + 20 + s.offsetY + row * rowH);
        this._shadowDrawInvaderSprite(ctx, x, y, px);
      }
    }

    // 4 barriers
    const barrierY = ga.y + ga.h * 0.72;
    for (let i = 0; i < 4; i++) {
      const bx = ga.x + ga.w * (0.13 + i * 0.25);
      this._shadowDrawBarrier(ctx, bx, barrierY, px);
    }

    // Player ship
    this._shadowDrawPlayerShip(ctx, s.ship.x, ga.y + ga.h - 18, px);
  }

  /** 5×5 pixel-art alien sprite:
   *   . X . X .
   *   X X X X X
   *   X . X . X
   *   . X X X .
   *   . X . X .   ← feet / tentacles
   */
  _shadowDrawInvaderSprite(ctx, x, y, px) {
    const pixels = [
      [1,0],[3,0],
      [0,1],[1,1],[2,1],[3,1],[4,1],
      [0,2],[2,2],[4,2],
      [1,3],[2,3],[3,3],
      [1,4],[3,4],
    ];
    for (const [c, r] of pixels)
      ctx.fillRect(x + c * px, y + r * px, px, px);
  }

  /** 6×4 barrier with bottom-centre notch cut out. */
  _shadowDrawBarrier(ctx, cx, y, px) {
    const pixels = [
      [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],
      [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],
      [0,2],[1,2],            [4,2],[5,2],
      [0,3],[1,3],            [4,3],[5,3],
    ];
    const ox = Math.round(cx - 3 * px);
    for (const [c, r] of pixels)
      ctx.fillRect(ox + c * px, y + r * px, px, px);
  }

  /** 5×3 player ship chevron pointing up. */
  _shadowDrawPlayerShip(ctx, cx, y, px) {
    const pixels = [
            [2,0],
        [1,1],[2,1],[3,1],
      [0,2],[1,2],[2,2],[3,2],[4,2],
    ];
    const ox = Math.round(cx - 2 * px);
    for (const [c, r] of pixels)
      ctx.fillRect(ox + c * px, y + r * px, px, px);
  }

  // ── Shadow Asteroids ──────────────────────────────────────────────────────

  _shadowInitAsteroids(ga) {
    const rocks = [];
    for (let i = 0; i < 6; i++) {
      const verts = 6 + Math.floor(Math.random() * 4);
      rocks.push({
        x:    ga.x + 30 + Math.random() * (ga.w - 60),
        y:    ga.y + 30 + Math.random() * (ga.h - 60),
        vx:   (Math.random() - 0.5) * 28,
        vy:   (Math.random() - 0.5) * 28,
        r:    18 + Math.random() * 22,
        rot:  Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.6,
        jags: Array.from({ length: verts }, () => 0.65 + Math.random() * 0.65),
        verts,
      });
    }
    const ship = {
      x:    ga.x + ga.w / 2,
      y:    ga.y + ga.h / 2,
      vx:   (Math.random() - 0.5) * 40,
      vy:   (Math.random() - 0.5) * 40,
      rot:  Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.8,  // slow lazy spin
    };
    return { rocks, ship };
  }

  _shadowUpdateAsteroids(dt, ga) {
    for (const rock of this._shadowState.rocks) {
      rock.x   += rock.vx * dt;
      rock.y   += rock.vy * dt;
      rock.rot += rock.rotV * dt;
      if (rock.x < ga.x - rock.r)             rock.x = ga.x + ga.w + rock.r;
      else if (rock.x > ga.x + ga.w + rock.r) rock.x = ga.x - rock.r;
      if (rock.y < ga.y - rock.r)             rock.y = ga.y + ga.h + rock.r;
      else if (rock.y > ga.y + ga.h + rock.r) rock.y = ga.y - rock.r;
    }
    const ship = this._shadowState.ship;
    ship.x   += ship.vx * dt;
    ship.y   += ship.vy * dt;
    ship.rot += ship.rotV * dt;
    if (ship.x < ga.x)          { ship.x = ga.x;          ship.vx =  Math.abs(ship.vx); }
    if (ship.x > ga.x + ga.w)   { ship.x = ga.x + ga.w;   ship.vx = -Math.abs(ship.vx); }
    if (ship.y < ga.y)          { ship.y = ga.y;           ship.vy =  Math.abs(ship.vy); }
    if (ship.y > ga.y + ga.h)   { ship.y = ga.y + ga.h;   ship.vy = -Math.abs(ship.vy); }
  }

  _shadowDrawAsteroids(ctx, ga) {
    ctx.strokeStyle = '#888888';
    ctx.lineWidth   = 1.5;
    // Rocks
    for (const rock of this._shadowState.rocks) {
      ctx.beginPath();
      for (let i = 0; i < rock.verts; i++) {
        const a    = rock.rot + (i / rock.verts) * Math.PI * 2;
        const dist = rock.r * rock.jags[i];
        const x    = rock.x + Math.cos(a) * dist;
        const y    = rock.y + Math.sin(a) * dist;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    // Ship — classic triangle pointing in direction of rot
    const ship = this._shadowState.ship;
    const sz   = 10;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.rot);
    ctx.beginPath();
    ctx.moveTo(sz, 0);
    ctx.lineTo(-sz * 0.7,  sz * 0.55);
    ctx.lineTo(-sz * 0.7, -sz * 0.55);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // ── CRT pop-on ────────────────────────────────────────────────────────────

  _doCrtPopOn() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none';

    const top = document.createElement('div');
    top.style.cssText = 'position:absolute;top:0;left:0;right:0;height:50%;background:#080808';

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
      this._degaussT = 0;
      this._scheduleDegauss();
    }, delay);
  }
}

PackageRegistry.registerEffect(new ArcadeAmbientEffect());
