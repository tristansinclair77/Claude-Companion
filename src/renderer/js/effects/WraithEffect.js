'use strict';
/**
 * WraithEffect — ambient canvas effects for the WRAITH visual package (Vesper).
 * Registered under id 'wraithAmbient'.
 *
 * Canvas effects (always on, drawn on #bg-wraith):
 *   - Cobwebs      : faint webs in the corners of #output-panel, swaying in a slow breeze
 *
 * Canvas effects (occasional, auto-triggered):
 *   - Lightning    : full-screen flash + 4-pane window silhouette cast on the screen (every 3–8 min)
 *   - Ghost        : barely visible ghost floats in from off-screen, drifts to a random spot, fades out (every 2–5 min)
 *   - Spider       : small spider crawls out from a corner, wanders, then scurries off-screen (every 3–7 min)
 */
class WraithEffect extends VisualEffect {

  // ── Tuning ────────────────────────────────────────────────────────────────
  static LIGHTNING_INTERVAL_MIN = 180;   // seconds — minimum gap between strikes
  static LIGHTNING_INTERVAL_MAX = 480;   // seconds — maximum gap
  static LIGHTNING_DURATION     = 0.65;  // seconds — canvas window-shadow lifetime

  static GHOST_INTERVAL_MIN  = 120;   // seconds
  static GHOST_INTERVAL_MAX  = 300;   // seconds
  static GHOST_FADE_IN       = 1.8;   // seconds — alpha ramp up
  static GHOST_HOLD          = 4.0;   // seconds — peak visibility
  static GHOST_FADE_OUT      = 2.5;   // seconds — alpha ramp down
  static GHOST_MAX_ALPHA     = 0.13;  // barely visible

  static SPIDER_INTERVAL_MIN = 180;   // seconds
  static SPIDER_INTERVAL_MAX = 420;   // seconds
  static SPIDER_SPEED        = 65;    // pixels per second

  static COBWEB_SWAY_HZ   = 0.18;   // oscillation frequency
  static COBWEB_SWAY_AMP  = 3.5;    // pixels — max displacement of central spoke tip
  static COBWEB_RADII     = [18, 36, 54];  // ring distances from corner (px)
  static COBWEB_SPOKES    = [0, 22.5, 45, 67.5, 90];  // degrees from edge-axis

  constructor() {
    super('wraithAmbient');
    this._canvas      = null;
    this._ctx         = null;
    this._rAF         = null;
    this._lastTs      = 0;
    this._t           = 0;       // global elapsed seconds (drives cobweb sway)

    // Lightning
    this._lightningT     = -1;   // -1 = idle; 0→1 = playing
    this._lightningTimer = null;

    // Ghost
    this._ghost      = null;
    this._ghostTimer = null;

    // Spider
    this._spider      = null;
    this._spiderTimer = null;
  }

  // ── VisualEffect hooks ────────────────────────────────────────────────────

  _onStart(config = {}) {
    this._initCanvas();
    this._t          = 0;
    this._lightningT = -1;
    this._ghost      = null;
    this._spider     = null;
    this._lastTs     = 0;

    this._scheduleLightning();
    this._scheduleGhost();
    this._scheduleSpider();

    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  _onStop() {
    if (this._rAF)          { cancelAnimationFrame(this._rAF);    this._rAF = null; }
    if (this._lightningTimer){ clearTimeout(this._lightningTimer); this._lightningTimer = null; }
    if (this._ghostTimer)   { clearTimeout(this._ghostTimer);     this._ghostTimer = null; }
    if (this._spiderTimer)  { clearTimeout(this._spiderTimer);    this._spiderTimer = null; }

    document.getElementById('wraith-lightning-overlay')?.remove();

    if (this._ctx && this._canvas)
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    this._ghost  = null;
    this._spider = null;
  }

  // ── Canvas init ───────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return;
    this._canvas = document.getElementById('bg-wraith');
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

  // ── Main tick ─────────────────────────────────────────────────────────────

  _tick(ts) {
    if (!this._running || !this._canvas) { this._rAF = null; return; }
    if (!this._lastTs) this._lastTs = ts;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.10);
    this._lastTs = ts;
    this._t += dt;

    // Advance ghost
    if (this._ghost) {
      this._ghost.elapsed += dt;
      this._ghost.x += this._ghost.vx * dt;
      this._ghost.y += this._ghost.vy * dt;
      if (this._ghost.elapsed >= this._ghost.totalDuration) this._ghost = null;
    }

    // Advance spider
    if (this._spider) this._updateSpider(dt);

    // Advance lightning canvas phase
    if (this._lightningT >= 0) {
      this._lightningT += dt / WraithEffect.LIGHTNING_DURATION;
      if (this._lightningT >= 1) this._lightningT = -1;
    }

    this._draw();
    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Master draw ───────────────────────────────────────────────────────────

  _draw() {
    const { _ctx: ctx, _canvas: cv } = this;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    this._drawCobwebs(ctx, W, H);
    if (this._ghost)       this._drawGhost(ctx);
    if (this._spider)      this._drawSpider(ctx);
    if (this._lightningT >= 0) this._drawLightningWindow(ctx, W, H);
  }

  // ── Cobwebs ───────────────────────────────────────────────────────────────

  _drawCobwebs(ctx, W, H) {
    const panel = document.getElementById('output-panel');
    if (!panel) return;
    const r    = panel.getBoundingClientRect();
    const sway = Math.sin(this._t * WraithEffect.COBWEB_SWAY_HZ * Math.PI * 2)
               * WraithEffect.COBWEB_SWAY_AMP;

    ctx.save();
    ctx.strokeStyle = '#c8b4ee';
    ctx.lineWidth   = 0.6;
    ctx.globalAlpha = 0.30;

    // top-left corner: opens right (+x) and down (+y)
    this._drawCornerWeb(ctx, r.left, r.top,   +1, +1, sway);
    // top-right corner: opens left (−x) and down (+y)
    this._drawCornerWeb(ctx, r.right, r.top,  -1, +1, sway);
    // bottom-left corner: opens right (+x) and up (−y)
    this._drawCornerWeb(ctx, r.left, r.bottom, +1, -1, sway);
    // bottom-right corner: opens left (−x) and up (−y)
    this._drawCornerWeb(ctx, r.right, r.bottom,-1, -1, sway);

    ctx.restore();
  }

  /**
   * Draw a single corner cobweb.
   * @param {number} cx, cy   — corner anchor point
   * @param {number} xSign    — +1 (open right) or -1 (open left)
   * @param {number} ySign    — +1 (open down) or -1 (open up)
   * @param {number} sway     — current sway displacement in pixels
   */
  _drawCornerWeb(ctx, cx, cy, xSign, ySign, sway) {
    const ANGLES = WraithEffect.COBWEB_SPOKES;  // 0..90 degrees
    const RADII  = WraithEffect.COBWEB_RADII;

    // Compute spoke tip positions with sway applied to middle spokes.
    // Sway direction: perpendicular to the 45° bisector of the corner,
    // implemented as +sway on x and -sway on y (or vice versa).
    // Edge anchors (0° and 90°) get no sway.
    const swayFactors = [0, 0.5, 1.0, 0.5, 0];  // matches ANGLES array

    // For each radius, pre-compute the ring points once
    const rings = RADII.map(r =>
      ANGLES.map((a, i) => {
        const rad = a * Math.PI / 180;
        const sf  = swayFactors[i];
        return {
          x: cx + xSign * (Math.cos(rad) * r + sway * sf * 0.60),
          y: cy + ySign * (Math.sin(rad) * r - sway * sf * 0.35),
        };
      })
    );

    // Draw radial spokes from corner to outermost ring
    for (let i = 0; i < ANGLES.length; i++) {
      const tip = rings[rings.length - 1][i];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }

    // Draw ring segments between adjacent spokes using quadratic bezier.
    // Control point is at the mid-angle, at 88% of the ring radius (slightly inward).
    for (const pts of rings) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const a0 = ANGLES[i], a1 = ANGLES[i + 1];
        const rIdx = RADII.indexOf(RADII[rings.indexOf(pts)]);
        const r = RADII[rIdx] * 0.88;
        const midRad = ((a0 + a1) / 2) * Math.PI / 180;
        const sf = (swayFactors[i] + swayFactors[i + 1]) / 2;
        const cpx = cx + xSign * (Math.cos(midRad) * r + sway * sf * 0.6);
        const cpy = cy + ySign * (Math.sin(midRad) * r - sway * sf * 0.35);
        ctx.quadraticCurveTo(cpx, cpy, pts[i + 1].x, pts[i + 1].y);
      }
      ctx.stroke();
    }
  }

  // ── Ghost ─────────────────────────────────────────────────────────────────

  _scheduleGhost() {
    const MIN   = WraithEffect.GHOST_INTERVAL_MIN * 1000;
    const MAX   = WraithEffect.GHOST_INTERVAL_MAX * 1000;
    const delay = MIN + Math.random() * (MAX - MIN);
    this._ghostTimer = setTimeout(() => {
      if (!this._running) return;
      this._spawnGhost();
      this._scheduleGhost();
    }, delay);
  }

  _spawnGhost() {
    if (this._ghost) return;
    const panel = document.getElementById('output-panel');
    if (!panel) return;
    const r = panel.getBoundingClientRect();

    // Pick a random entry edge
    const edge = Math.floor(Math.random() * 4);
    let sx, sy;
    switch (edge) {
      case 0: sx = r.left - 70;                         sy = r.top + Math.random() * r.height; break;
      case 1: sx = r.right + 70;                        sy = r.top + Math.random() * r.height; break;
      case 2: sx = r.left + Math.random() * r.width;    sy = r.top - 90;                       break;
      default:sx = r.left + Math.random() * r.width;    sy = r.bottom + 90;                    break;
    }

    const tx = r.left + 30 + Math.random() * (r.width  - 60);
    const ty = r.top  + 30 + Math.random() * (r.height - 60);
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const totalDuration = WraithEffect.GHOST_FADE_IN + WraithEffect.GHOST_HOLD + WraithEffect.GHOST_FADE_OUT;
    const speed = dist / (WraithEffect.GHOST_FADE_IN + WraithEffect.GHOST_HOLD * 0.4);

    this._ghost = {
      x: sx, y: sy,
      vx: (dx / dist) * speed * 0.45,
      vy: (dy / dist) * speed * 0.45,
      elapsed:       0,
      totalDuration,
      wobblePhase:   Math.random() * Math.PI * 2,
    };
  }

  _ghostAlpha() {
    if (!this._ghost) return 0;
    const { elapsed, totalDuration } = this._ghost;
    const fi = WraithEffect.GHOST_FADE_IN;
    const fo = WraithEffect.GHOST_FADE_OUT;
    const max = WraithEffect.GHOST_MAX_ALPHA;
    if (elapsed < fi)                         return (elapsed / fi) * max;
    if (elapsed < totalDuration - fo)         return max;
    return Math.max(0, ((totalDuration - elapsed) / fo) * max);
  }

  _drawGhost(ctx) {
    const alpha = this._ghostAlpha();
    if (alpha <= 0) return;

    const g      = this._ghost;
    const wobble = Math.sin(this._t * 1.3 + g.wobblePhase) * 5;
    const x      = g.x;
    const y      = g.y + wobble;
    const W2     = 28;   // half-width
    const H2     = 40;   // total height

    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer glow halo
    const halo = ctx.createRadialGradient(x, y - 4, 4, x, y - 4, W2 * 2.0);
    halo.addColorStop(0,   'rgba(210, 180, 255, 0.70)');
    halo.addColorStop(0.45,'rgba(160, 110, 230, 0.30)');
    halo.addColorStop(1,   'rgba(80,  40, 160, 0.00)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(x, y - 4, W2 * 2.0, H2 * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ghost body
    ctx.fillStyle = 'rgba(240, 228, 255, 0.88)';
    ctx.beginPath();
    // Dome (top half circle)
    ctx.arc(x, y - H2 * 0.22, W2, Math.PI, 0, false);
    // Right side down
    ctx.lineTo(x + W2, y + H2 * 0.55);
    // Wavy bottom — 4 bumps
    const bumps = 4;
    const bumpH = 7;
    for (let i = bumps; i >= 0; i--) {
      const bx = x - W2 + (i / bumps) * W2 * 2;
      const by = y + H2 * 0.55 + (i % 2 === 0 ? -bumpH : bumpH);
      ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fill();

    // Inner highlight (slightly transparent overlay for volume feel)
    const shine = ctx.createRadialGradient(x - 8, y - H2 * 0.15, 2, x - 4, y - H2 * 0.1, W2 * 0.9);
    shine.addColorStop(0,   'rgba(255, 252, 255, 0.45)');
    shine.addColorStop(0.5, 'rgba(220, 200, 255, 0.10)');
    shine.addColorStop(1,   'rgba(180, 150, 255, 0.00)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.ellipse(x - 4, y - H2 * 0.10, W2 * 0.75, H2 * 0.45, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — hollow dark ovals
    ctx.fillStyle = 'rgba(35, 8, 75, 0.75)';
    ctx.beginPath();
    ctx.ellipse(x - 9, y - H2 * 0.08, 5.5, 8, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 9, y - H2 * 0.08, 5.5, 8,  0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Spider ────────────────────────────────────────────────────────────────

  _scheduleSpider() {
    const MIN   = WraithEffect.SPIDER_INTERVAL_MIN * 1000;
    const MAX   = WraithEffect.SPIDER_INTERVAL_MAX * 1000;
    const delay = MIN + Math.random() * (MAX - MIN);
    this._spiderTimer = setTimeout(() => {
      if (!this._running) return;
      this._spawnSpider();
      this._scheduleSpider();
    }, delay);
  }

  _spawnSpider() {
    if (this._spider) return;
    const panel = document.getElementById('output-panel');
    if (!panel) return;
    const r = panel.getBoundingClientRect();

    // Start from a random panel corner
    const corner = Math.floor(Math.random() * 4);
    let sx, sy;
    switch (corner) {
      case 0: sx = r.left  + 4; sy = r.top    + 4; break;
      case 1: sx = r.right - 4; sy = r.top    + 4; break;
      case 2: sx = r.left  + 4; sy = r.bottom - 4; break;
      default:sx = r.right - 4; sy = r.bottom - 4; break;
    }

    // A few interior waypoints, then an exit off-screen
    const wps = [];
    for (let i = 0; i < 4; i++) {
      wps.push({
        x: r.left + 10 + Math.random() * (r.width  - 20),
        y: r.top  + 10 + Math.random() * (r.height - 20),
      });
    }
    // Exit
    const exitEdge = Math.floor(Math.random() * 4);
    switch (exitEdge) {
      case 0: wps.push({ x: r.left  - 35, y: r.top + Math.random() * r.height }); break;
      case 1: wps.push({ x: r.right + 35, y: r.top + Math.random() * r.height }); break;
      case 2: wps.push({ x: r.left + Math.random() * r.width, y: r.top    - 35 }); break;
      default:wps.push({ x: r.left + Math.random() * r.width, y: r.bottom + 35 }); break;
    }

    this._spider = { x: sx, y: sy, waypoints: wps, wpIdx: 0, legT: 0 };
  }

  _updateSpider(dt) {
    const s = this._spider;
    if (!s) return;

    s.legT += dt;

    if (s.wpIdx >= s.waypoints.length) {
      this._spider = null;
      return;
    }
    const tgt  = s.waypoints[s.wpIdx];
    const dx   = tgt.x - s.x;
    const dy   = tgt.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = WraithEffect.SPIDER_SPEED * dt;

    if (dist <= step) {
      s.x = tgt.x; s.y = tgt.y;
      s.wpIdx++;
    } else {
      s.x += (dx / dist) * step;
      s.y += (dy / dist) * step;
    }
  }

  _drawSpider(ctx) {
    const s = this._spider;
    if (!s) return;

    const x = s.x, y = s.y;

    // Determine heading angle (toward current waypoint)
    let headAngle = 0;
    if (s.wpIdx < s.waypoints.length) {
      const t = s.waypoints[s.wpIdx];
      headAngle = Math.atan2(t.y - y, t.x - x);
    }

    const wave = Math.sin(s.legT * 9) * 3;

    ctx.save();
    ctx.globalAlpha   = 0.72;
    ctx.strokeStyle   = '#0e0520';
    ctx.fillStyle     = '#0e0520';
    ctx.lineWidth     = 1.0;

    // 8 legs — 4 per side, alternating bent-up / bent-down for walking illusion
    // Angles are in local (un-rotated) space; we rotate the whole ctx
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(headAngle);

    const legPairs = [
      // [near-angle, far-angle, side]  — local space, side: +1 top, -1 bottom
      [-0.35, -0.70],   // front-top
      [ 0.35,  0.70],   // front-bottom
      [-0.65, -1.10],
      [ 0.65,  1.10],
      [-1.00, -1.45],
      [ 1.00,  1.45],
      [-1.40, -1.80],
      [ 1.40,  1.80],
    ];

    for (let i = 0; i < legPairs.length; i++) {
      const [a1, a2] = legPairs[i];
      const legWave  = (i % 2 === 0 ? 1 : -1) * wave;
      // Joint (mid-leg bend)
      const mx = Math.cos(a1) * 10 + legWave * 0.3;
      const my = Math.sin(a1) * 10 + legWave;
      // Tip
      const tx = mx + Math.cos(a2) * 10;
      const ty = my + Math.sin(a2) * 10 + legWave * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(mx, my, tx, ty);
      ctx.stroke();
    }

    // Abdomen — large oval behind
    ctx.beginPath();
    ctx.ellipse(-7, 0, 7.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cephalothorax — smaller oval in front
    ctx.beginPath();
    ctx.ellipse(2, 0, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Purple eyes
    ctx.fillStyle = '#9922ee';
    ctx.beginPath();
    ctx.arc(5.5, -1.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5.5,  1.5, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // un-rotate
    ctx.restore(); // un-alpha
  }

  // ── Lightning ─────────────────────────────────────────────────────────────

  _scheduleLightning() {
    const MIN   = WraithEffect.LIGHTNING_INTERVAL_MIN * 1000;
    const MAX   = WraithEffect.LIGHTNING_INTERVAL_MAX * 1000;
    const delay = MIN + Math.random() * (MAX - MIN);
    this._lightningTimer = setTimeout(() => {
      if (!this._running) return;
      this._triggerLightning();
      this._scheduleLightning();
    }, delay);
  }

  _triggerLightning() {
    this._lightningT = 0;
    this._doLightningFlash();
  }

  /**
   * DOM-based flash: 3-flicker sequence that simulates a lightning strike.
   * The bright white/lavender overlay pulses rapidly then fades to a brief
   * afterglow while the canvas draws the window-shadow pattern.
   */
  _doLightningFlash() {
    const ov = document.createElement('div');
    ov.id = 'wraith-lightning-overlay';
    ov.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9998', 'pointer-events:none',
      'background:rgba(220,200,255,0)',
      'transition:background 0.03s linear',
    ].join(';');
    document.body.appendChild(ov);

    const set = (bg, delay, transition) => setTimeout(() => {
      if (!document.getElementById('wraith-lightning-overlay')) return;
      if (transition) ov.style.transition = transition;
      ov.style.background = bg;
    }, delay);

    // Initial snap to very bright
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ov.style.background = 'rgba(225,210,255,0.88)';
    }));
    // First flicker
    set('rgba(190,160,255,0.22)', 55,  'background 0.08s ease-out');
    set('rgba(225,210,255,0.70)', 120, 'background 0.03s linear');
    // Second flicker (shorter)
    set('rgba(190,160,255,0.08)', 165, 'background 0.10s ease-out');
    set('rgba(210,190,255,0.45)', 220, 'background 0.02s linear');
    // Settle into faint afterglow while window-shadow is drawn on canvas
    set('rgba(160,120,220,0.04)', 275, 'background 0.36s ease-out');
    // Remove
    setTimeout(() => document.getElementById('wraith-lightning-overlay')?.remove(), 660);
  }

  /**
   * Draw the window-shadow silhouette that appears on the "wall" during the flash.
   * Resembles a 4-pane window frame (two horizontal × two vertical divisions)
   * cast from behind (bright zones between bars, dark frame bars).
   * Phase t=0→1 over LIGHTNING_DURATION seconds.
   */
  _drawLightningWindow(ctx, W, H) {
    const t = this._lightningT;
    // Visible from t=0.08 to t=0.70; fades at both ends
    if (t < 0.08 || t > 0.72) return;
    const fadeIn  = Math.min(1, (t - 0.08) / 0.12);
    const fadeOut = t > 0.58 ? Math.max(0, 1 - (t - 0.58) / 0.14) : 1;
    const alpha   = fadeIn * fadeOut;
    if (alpha <= 0) return;

    // Window parameters — slightly off-center, as if from upper-right
    const cx  = W * 0.38;
    const cy  = H * 0.24;
    const ww  = W * 0.30;
    const wh  = H * 0.38;
    const fw  = 11;          // frame / divider bar thickness

    ctx.save();
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle   = 'rgba(200, 170, 255, 1)';

    // Outer frame bars
    ctx.fillRect(cx - ww / 2,       cy - wh / 2,       ww,  fw);   // top rail
    ctx.fillRect(cx - ww / 2,       cy + wh / 2 - fw,  ww,  fw);   // bottom rail
    ctx.fillRect(cx - ww / 2,       cy - wh / 2,       fw,  wh);   // left stile
    ctx.fillRect(cx + ww / 2 - fw,  cy - wh / 2,       fw,  wh);   // right stile

    // Centre dividers (4-pane window cross)
    ctx.fillRect(cx - ww / 2,       cy - fw / 2,        ww,  fw);   // horizontal bar
    ctx.fillRect(cx - fw / 2,       cy - wh / 2,        fw,  wh);   // vertical bar

    // Light "cast" rectangles between the bars (bright patches on the wall)
    ctx.globalAlpha = alpha * 0.06;
    ctx.fillStyle   = 'rgba(230, 210, 255, 1)';
    const innerX = cx - ww / 2 + fw;
    const innerY = cy - wh / 2 + fw;
    const paneW  = ww / 2 - fw * 1.5;
    const paneH  = wh / 2 - fw * 1.5;
    ctx.fillRect(innerX,             innerY,             paneW, paneH);  // TL pane
    ctx.fillRect(cx + fw / 2,        innerY,             paneW, paneH);  // TR pane
    ctx.fillRect(innerX,             cy + fw / 2,        paneW, paneH);  // BL pane
    ctx.fillRect(cx + fw / 2,        cy + fw / 2,        paneW, paneH);  // BR pane

    ctx.restore();
  }
}

PackageRegistry.registerEffect(new WraithEffect());
