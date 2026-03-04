'use strict';
/**
 * ArcadeEffect — Arcade Cabinet visual package canvas effect.
 * Extends VisualEffect. Registered with PackageRegistry under id 'arcadeBorder'.
 *
 * Draws a pixel-art bezel frame around the content area (below the title bar):
 *   - Left / right dark bezel strips with a bright inner border line
 *   - Bottom strip with a scrolling marquee (INSERT COIN, PLAYER 1 READY, etc.)
 *   - A bright accent line at the top of the frame (title-bar bottom edge)
 *   - Corner bracket decorations where the bezels meet
 *   - Occasional spark bursts at the corner brackets
 *
 * The canvas sits at z-index: 1 (above regular content, behind title-bar z-index:100
 * and settings panels). pointer-events: none so it never blocks clicks.
 */
class ArcadeEffect extends VisualEffect {

  constructor() {
    super('arcadeBorder');

    this._canvas     = null;
    this._ctx        = null;
    this._rAF        = null;
    this._marqueeX   = 0;
    this._sparks     = [];
    this._sparkTimer = 0;
    this._textW      = 0;   // cached marquee text width
  }

  // ── Constants ─────────────────────────────────────────────────────────────

  static get TITLE_H()   { return 32; }   // matches --title-h in main.css
  static get SIDE_W()    { return 14; }   // left and right bezel width (px)
  static get BOTTOM_H()  { return 26; }   // bottom bezel height (px)
  static get LINE_W()    { return 2;  }   // bright inner border line thickness

  // Colors — arcade primary palette
  static get C_BEZEL()   { return '#0e0a0a'; }  // dark cabinet body
  static get C_BORDER()  { return '#ffee00'; }  // player-1 yellow border line
  static get C_ACCENT()  { return '#ff2200'; }  // p2 red accent
  static get C_DIM()     { return '#886600'; }  // dim yellow (outer edge)
  static get C_TEXT()    { return '#ffee00'; }  // marquee text

  static get MARQUEE_TEXT() {
    return '  INSERT COIN  ✦  PLAYER 1 READY  ✦  HI-SCORE 000000  ✦  PRESS START  ✦  GAME OVER  ✦  1UP  ✦  CONTINUE?  ✦  ';
  }
  static get MARQUEE_SPEED() { return 1.1; }  // px per frame (rightward scroll)

  // ── VisualEffect hooks ────────────────────────────────────────────────────

  _onStart(config) {
    if (!this._initCanvas()) return;
    this._marqueeX   = 0;
    this._sparks     = [];
    this._sparkTimer = 0;
    this._measureMarquee();
    this._tick();
  }

  _onStop() {
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    if (this._ctx && this._canvas) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  // No live config keys to update yet; inherits default (stop+restart) from base.

  // ── Canvas init ───────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return true;
    this._canvas = document.getElementById('bg-arcade');
    if (!this._canvas) return false;
    this._ctx = this._canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    return true;
  }

  _resize() {
    if (!this._canvas) return;
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
    this._measureMarquee();
  }

  _measureMarquee() {
    if (!this._ctx) return;
    this._ctx.font = 'bold 10px "Courier New", monospace';
    this._textW = this._ctx.measureText(ArcadeEffect.MARQUEE_TEXT).width;
  }

  // ── Sparks ────────────────────────────────────────────────────────────────

  _spawnSparks() {
    const W  = this._canvas.width, H = this._canvas.height;
    const S  = ArcadeEffect.SIDE_W, TH = ArcadeEffect.TITLE_H, BH = ArcadeEffect.BOTTOM_H;
    // Inner corner positions (where the bezel meets the screen area)
    const corners = [
      { x: S,     y: TH        },
      { x: W - S, y: TH        },
      { x: S,     y: H - BH    },
      { x: W - S, y: H - BH    },
    ];
    const c = corners[Math.floor(Math.random() * corners.length)];
    const count = 7 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      this._sparks.push({
        x:     c.x + (Math.random() - 0.5) * 14,
        y:     c.y + (Math.random() - 0.5) * 14,
        vx:    (Math.random() - 0.5) * 5.0,
        vy:    (Math.random() - 0.5) * 5.0 - 1.0,
        life:  1.0,
        decay: 0.011 + Math.random() * 0.010,
        size:  2 + Math.floor(Math.random() * 4),
        color: Math.random() < 0.55 ? '#ffee00' : (Math.random() < 0.5 ? '#ffffff' : '#ffaa00'),
      });
    }
  }

  _updateSparks() {
    // Trigger a burst every 100–280 frames
    this._sparkTimer++;
    if (this._sparkTimer > 100 + Math.floor(Math.random() * 180)) {
      this._spawnSparks();
      this._sparkTimer = 0;
    }
    for (const s of this._sparks) {
      s.x    += s.vx;
      s.y    += s.vy;
      s.life -= s.decay;
    }
    this._sparks = this._sparks.filter(s => s.life > 0);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this._ctx;
    const W = this._canvas.width, H = this._canvas.height;
    const S = ArcadeEffect.SIDE_W, TH = ArcadeEffect.TITLE_H, BH = ArcadeEffect.BOTTOM_H;
    const LW = ArcadeEffect.LINE_W;

    ctx.clearRect(0, 0, W, H);

    // ── Left bezel fill ─────────────────────────────────────────────────────
    ctx.fillStyle = ArcadeEffect.C_BEZEL;
    ctx.fillRect(0, TH, S, H - TH);

    // ── Right bezel fill ────────────────────────────────────────────────────
    ctx.fillRect(W - S, TH, S, H - TH);

    // ── Bottom bezel fill ───────────────────────────────────────────────────
    ctx.fillRect(S, H - BH, W - S * 2, BH);

    // ── Inner bright border — the "screen bezel" rectangle ──────────────────
    // Top line (just below title bar)
    ctx.fillStyle = ArcadeEffect.C_BORDER;
    ctx.fillRect(0, TH, W, LW);

    // Left inner edge
    ctx.fillRect(S - LW, TH + LW, LW, H - TH - BH - LW);

    // Right inner edge
    ctx.fillRect(W - S, TH + LW, LW, H - TH - BH - LW);

    // Bottom inner edge (top of bottom bezel)
    ctx.fillRect(S, H - BH, W - S * 2, LW);

    // ── Outer dim edge lines ────────────────────────────────────────────────
    ctx.fillStyle = ArcadeEffect.C_DIM;
    ctx.fillRect(0, TH, 1, H - TH);          // far left
    ctx.fillRect(W - 1, TH, 1, H - TH);      // far right
    ctx.fillRect(0, H - 1, W, 1);             // very bottom

    // ── Corner brackets ─────────────────────────────────────────────────────
    this._drawCorners(ctx, W, H, S, TH, BH);

    // ── Bottom marquee ──────────────────────────────────────────────────────
    this._drawMarquee(ctx, W, H, S, BH);

    // ── Sparks ──────────────────────────────────────────────────────────────
    for (const s of this._sparks) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle   = s.color;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  _drawCorners(ctx, W, H, S, TH, BH) {
    const ARM = 16;  // bracket arm length along the inner border line
    const THK = 3;   // arm thickness
    const CAP = 6;   // center cap size
    const corners = [
      { x: S,     y: TH,     dx:  1, dy:  1 },  // top-left
      { x: W - S, y: TH,     dx: -1, dy:  1 },  // top-right
      { x: S,     y: H - BH, dx:  1, dy: -1 },  // bottom-left
      { x: W - S, y: H - BH, dx: -1, dy: -1 },  // bottom-right
    ];
    for (const { x, y, dx, dy } of corners) {
      // Bright yellow bracket arms running along the inner border lines
      ctx.fillStyle = '#ffff88';
      // Horizontal arm (along top/bottom inner border)
      ctx.fillRect(dx > 0 ? x : x - ARM, y - 1, ARM, THK);
      // Vertical arm (along left/right inner border)
      ctx.fillRect(x - 1, dy > 0 ? y : y - ARM, THK, ARM);
      // Red center cap
      ctx.fillStyle = ArcadeEffect.C_ACCENT;
      ctx.fillRect(x - CAP / 2, y - CAP / 2, CAP, CAP);
      // White center pip
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  _drawMarquee(ctx, W, H, S, BH) {
    const text  = ArcadeEffect.MARQUEE_TEXT;
    const yMid  = H - BH / 2 + 3;    // vertical center of bottom bezel
    const clipX = S + ArcadeEffect.LINE_W + 4;
    const clipW = W - (S + ArcadeEffect.LINE_W + 4) * 2;

    // Scroll left; keep _marqueeX in (-textW, 0] so modulo-based draw always fills
    this._marqueeX -= ArcadeEffect.MARQUEE_SPEED;
    if (this._marqueeX <= -this._textW) this._marqueeX += this._textW;

    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, H - BH + ArcadeEffect.LINE_W + 1, clipW, BH - ArcadeEffect.LINE_W - 2);
    ctx.clip();

    ctx.font        = 'bold 10px "Courier New", monospace';
    ctx.fillStyle   = ArcadeEffect.C_TEXT;
    ctx.shadowColor = '#ffee0088';
    ctx.shadowBlur  = 5;
    // Draw enough copies to fill the entire clip region — no gaps regardless of screen width
    for (let x = this._marqueeX; x < clipX + clipW; x += this._textW) {
      ctx.fillText(text, x, yMid);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  _tick() {
    if (!this._running || !this._canvas) { this._rAF = null; return; }
    this._updateSparks();
    this._draw();
    this._rAF = requestAnimationFrame(() => this._tick());
  }
}

PackageRegistry.registerEffect(new ArcadeEffect());
