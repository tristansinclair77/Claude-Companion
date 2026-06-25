'use strict';
/**
 * WraithEffect — ambient canvas effects for the WRAITH visual package (Vesper).
 * Registered under id 'wraithAmbient'.
 *
 * Three independently-toggleable sub-systems, each controlled by a settings module:
 *   wraithCobwebs   : random asymmetric corner webs swaying in a faint breeze
 *   wraithSpirits   : occasional ghost float + spider scurry
 *   wraithLightning : occasional lightning flash with 4-pane window shadow
 *
 * All three share one rAF loop; the effect stops only when all three are disabled.
 */
class WraithEffect extends VisualEffect {

  // ── Tuning ────────────────────────────────────────────────────────────────
  static LIGHTNING_DURATION = 0.65;  // seconds for canvas window-shadow pass

  // Interval presets [min, max] in seconds
  static GHOST_INTERVALS     = { short:[30,60],   normal:[120,300], long:[300,600]  };
  static SPIDER_INTERVALS    = { short:[60,90],   normal:[180,420], long:[420,720]  };
  static LIGHTNING_INTERVALS = { short:[60,120],  normal:[180,480], long:[480,900]  };

  static COBWEB_SWAY_HZ_DEFAULT  = 0.18;
  static COBWEB_AMP_DEFAULT      = 3.5;

  constructor() {
    super('wraithAmbient');
    this._canvas  = null;
    this._ctx     = null;
    this._rAF     = null;
    this._lastTs  = 0;
    this._t       = 0;

    // ── Sub-system enabled flags (set from config) ──────────────────────────
    this._cobwebsEnabled   = true;
    this._cobwebSwayHz     = WraithEffect.COBWEB_SWAY_HZ_DEFAULT;
    this._cobwebAmp        = WraithEffect.COBWEB_AMP_DEFAULT;
    this._cobwebOpacityMult= 1.0;

    this._ghostEnabled   = true;
    this._ghostInterval  = 'normal';
    this._spiderEnabled  = true;
    this._spiderInterval = 'normal';

    this._lightningEnabled  = true;
    this._lightningInterval = 'normal';

    // ── Runtime state ────────────────────────────────────────────────────────
    this._lightningT     = -1;
    this._lightningTimer = null;
    this._ghost          = null;
    this._ghostTimer     = null;
    this._spider         = null;
    this._spiderTimer    = null;
    this._cobwebs        = null;
  }

  // ── VisualEffect hooks ────────────────────────────────────────────────────

  _onStart(config = {}) {
    // Read config into instance state
    this._cobwebsEnabled    = config.cobwebsEnabled   !== false;
    this._cobwebSwayHz      = config.cobwebSwayHz     ?? WraithEffect.COBWEB_SWAY_HZ_DEFAULT;
    this._cobwebAmp         = config.cobwebAmp        ?? WraithEffect.COBWEB_AMP_DEFAULT;
    this._cobwebOpacityMult = config.cobwebOpacity    ?? 1.0;
    this._ghostEnabled      = config.ghostEnabled     !== false;
    this._ghostInterval     = config.ghostInterval    || 'normal';
    this._spiderEnabled     = config.spiderEnabled    !== false;
    this._spiderInterval    = config.spiderInterval   || 'normal';
    this._lightningEnabled  = config.lightningEnabled !== false;
    this._lightningInterval = config.lightningInterval|| 'normal';

    this._initCanvas();
    this._t          = 0;
    this._lightningT = -1;
    this._ghost      = null;
    this._spider     = null;
    this._lastTs     = 0;

    this._generateCobwebs();
    this._scheduleLightning();
    this._scheduleGhost();
    this._scheduleSpider();

    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  _onStop() {
    if (this._rAF)           { cancelAnimationFrame(this._rAF);    this._rAF = null; }
    if (this._lightningTimer){ clearTimeout(this._lightningTimer); this._lightningTimer = null; }
    if (this._ghostTimer)    { clearTimeout(this._ghostTimer);     this._ghostTimer = null; }
    if (this._spiderTimer)   { clearTimeout(this._spiderTimer);    this._spiderTimer = null; }
    document.getElementById('wraith-lightning-overlay')?.remove();
    if (this._ctx && this._canvas)
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._ghost  = null;
    this._spider = null;
  }

  _onUpdate(key, value) {
    switch (key) {
      case 'cobwebsEnabled':
        this._cobwebsEnabled = value;
        break;
      case 'cobwebSwayHz':
        this._cobwebSwayHz = value;
        break;
      case 'cobwebAmp':
        this._cobwebAmp = value;
        break;
      case 'cobwebOpacity':
        this._cobwebOpacityMult = value;
        break;
      case 'cobwebRegen':
        if (value) this._generateCobwebs();
        break;
      case 'ghostEnabled':
        this._ghostEnabled = value;
        if (!value) { clearTimeout(this._ghostTimer); this._ghostTimer = null; }
        else        this._scheduleGhost();
        break;
      case 'ghostInterval':
        this._ghostInterval = value;
        this._rescheduleGhost();
        break;
      case 'spiderEnabled':
        this._spiderEnabled = value;
        if (!value) { clearTimeout(this._spiderTimer); this._spiderTimer = null; this._spider = null; }
        else        this._scheduleSpider();
        break;
      case 'spiderInterval':
        this._spiderInterval = value;
        this._rescheduleSpider();
        break;
      case 'lightningEnabled':
        this._lightningEnabled = value;
        if (!value) { clearTimeout(this._lightningTimer); this._lightningTimer = null; }
        else        this._scheduleLightning();
        break;
      case 'lightningInterval':
        this._lightningInterval = value;
        this._rescheduleLightning();
        break;
    }
  }

  // ── Public spawn methods (called from settings spawn buttons) ─────────────

  spawnGhost() {
    if (!this._running) return;
    clearTimeout(this._ghostTimer);
    this._ghostTimer = null;
    this._spawnGhost();
    this._scheduleGhost();
  }

  spawnSpider() {
    if (!this._running) return;
    clearTimeout(this._spiderTimer);
    this._spiderTimer = null;
    this._spider = null;
    this._spawnSpider();
    this._scheduleSpider();
  }

  triggerLightning() {
    if (!this._running) return;
    this._triggerLightning();
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

  // ── Interval helpers ──────────────────────────────────────────────────────

  _intervalMs(mode, table) {
    const [mn, mx] = table[mode] || table.normal;
    return (mn + Math.random() * (mx - mn)) * 1000;
  }

  _rescheduleGhost() {
    clearTimeout(this._ghostTimer);
    this._ghostTimer = null;
    this._scheduleGhost();
  }

  _rescheduleSpider() {
    clearTimeout(this._spiderTimer);
    this._spiderTimer = null;
    this._scheduleSpider();
  }

  _rescheduleLightning() {
    clearTimeout(this._lightningTimer);
    this._lightningTimer = null;
    this._scheduleLightning();
  }

  // ── Main tick ─────────────────────────────────────────────────────────────

  _tick(ts) {
    if (!this._running || !this._canvas) { this._rAF = null; return; }
    if (!this._lastTs) this._lastTs = ts;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.10);
    this._lastTs = ts;
    this._t += dt;

    if (this._ghost) {
      this._ghost.elapsed += dt;
      this._ghost.x += this._ghost.vx * dt;
      this._ghost.y += this._ghost.vy * dt;
      if (this._ghost.elapsed >= this._ghost.totalDuration) this._ghost = null;
    }

    if (this._spider) this._updateSpider(dt);

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

    if (this._cobwebsEnabled) this._drawCobwebs(ctx, W, H);
    if (this._ghost)          this._drawGhost(ctx);
    if (this._spider)         this._drawSpider(ctx);
    if (this._lightningT >= 0) this._drawLightningWindow(ctx, W, H);
  }

  // ── Cobwebs ───────────────────────────────────────────────────────────────

  /**
   * Generate one unique random web config per corner. Each call fully randomises
   * all four webs independently — called once at start and on REGEN.
   */
  _generateCobwebs() {
    const corners = [
      { xSign: +1, ySign: +1 },   // top-left
      { xSign: -1, ySign: +1 },   // top-right
      { xSign: +1, ySign: -1 },   // bottom-left
      { xSign: -1, ySign: -1 },   // bottom-right
    ];

    this._cobwebs = corners.map(({ xSign, ySign }) => {
      const spread      = 50 + Math.random() * 35;            // 50–85° arc span
      const numInterior = 1 + Math.floor(Math.random() * 4); // 1–4 interior spokes (3–6 total)
      const baseRadius  = 32 + Math.random() * 52;            // 32–84px rough reach
      const numRings    = 3 + Math.floor(Math.random() * 3); // 3–5 rings
      const alpha       = 0.18 + Math.random() * 0.22;       // per-web opacity
      const lineWidth   = 0.40 + Math.random() * 0.55;       // per-web stroke weight
      const missRate    = 0.05 + Math.random() * 0.20;       // 5–25% ring segment miss rate

      // Build spoke angles — 0° and spread° are wall-anchor endpoints; interior vary randomly
      const rawAngles = [0];
      for (let i = 0; i < numInterior; i++)
        rawAngles.push(spread * (0.1 + Math.random() * 0.8));
      rawAngles.push(spread);
      rawAngles.sort((a, b) => a - b);

      // Remove spokes closer than 7° to keep gaps readable
      const angles = [rawAngles[0]];
      for (let i = 1; i < rawAngles.length; i++)
        if (rawAngles[i] - angles[angles.length - 1] >= 7) angles.push(rawAngles[i]);

      // Each spoke gets its own length so the web has a natural ragged silhouette.
      // Wall anchors run ~full length; interior spokes vary more.
      const spokeLengths = angles.map((_, i) => {
        const isEdge = (i === 0 || i === angles.length - 1);
        return baseRadius * (isEdge ? 0.80 + Math.random() * 0.40 : 0.55 + Math.random() * 0.65);
      });

      // Sway factors: 0 at wall-anchors (fixed), sine peak in middle
      const swayFactors = angles.map(a => Math.sin((a / spread) * Math.PI));

      // Ring tiers stored as fractions of each spoke's individual length.
      // Tiers spread from ~15% to ~95% of each spoke.
      const rings = [];
      for (let i = 0; i < numRings; i++) {
        const frac = 0.15 + 0.80 * ((i + 0.5 + (Math.random() - 0.5) * 0.4) / numRings);
        const segments = angles.slice(0, -1).map(() => Math.random() > missRate);
        rings.push({ frac, segments });
      }
      rings.sort((a, b) => a.frac - b.frac);

      return { xSign, ySign, angles, spokeLengths, rings, swayFactors, alpha, lineWidth };
    });
  }

  _drawCobwebs(ctx, W, H) {
    if (!this._cobwebs) return;
    const panel = document.getElementById('output-panel');
    if (!panel) return;
    const r    = panel.getBoundingClientRect();
    const sway = Math.sin(this._t * this._cobwebSwayHz * Math.PI * 2) * this._cobwebAmp;

    const corners = [
      { cx: r.left,  cy: r.top    },
      { cx: r.right, cy: r.top    },
      { cx: r.left,  cy: r.bottom },
      { cx: r.right, cy: r.bottom },
    ];
    corners.forEach(({ cx, cy }, i) => this._drawCornerWeb(ctx, cx, cy, this._cobwebs[i], sway));
  }

  _drawCornerWeb(ctx, cx, cy, web, sway) {
    const { xSign, ySign, angles, spokeLengths, rings, swayFactors, alpha, lineWidth } = web;
    if (!rings.length || !angles.length) return;

    ctx.save();
    ctx.strokeStyle = '#c8b4ee';
    ctx.lineWidth   = lineWidth;
    ctx.globalAlpha = alpha * this._cobwebOpacityMult;

    // Return canvas coords for spoke[i] at fraction frac of its own length, with sway.
    const pt = (i, frac) => {
      const rad = angles[i] * Math.PI / 180;
      const r   = spokeLengths[i] * frac;
      const sf  = swayFactors[i];
      return {
        x: cx + xSign * (Math.cos(rad) * r + sway * sf * 0.60),
        y: cy + ySign * (Math.sin(rad) * r - sway * sf * 0.35),
      };
    };

    // Radial spokes — each extends to its own max length
    for (let i = 0; i < angles.length; i++) {
      const tip = pt(i, 1.0);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }

    // Ring segments — each drawn individually; bezier control point pushed AWAY from
    // the corner so rings curve outward (classic drooping spiderweb look).
    for (const ring of rings) {
      for (let i = 0; i < angles.length - 1; i++) {
        if (!ring.segments[i]) continue;
        const p0  = pt(i,     ring.frac);
        const p1  = pt(i + 1, ring.frac);
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        // Push midpoint outward from corner to make rings droop naturally
        const vx   = midX - cx;
        const vy   = midY - cy;
        const dist = Math.sqrt(vx * vx + vy * vy) || 1;
        const push = dist * 0.28;
        const cpx  = midX + (vx / dist) * push;
        const cpy  = midY + (vy / dist) * push;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(cpx, cpy, p1.x, p1.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ── Ghost ─────────────────────────────────────────────────────────────────

  _scheduleGhost() {
    if (!this._ghostEnabled) return;
    const delay = this._intervalMs(this._ghostInterval, WraithEffect.GHOST_INTERVALS);
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
    const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
    const fi    = 1.8, hold = 4.0, fo = 2.5;
    const speed = dist / (fi + hold * 0.4);

    this._ghost = {
      x: sx, y: sy,
      vx: (dx / dist) * speed * 0.45,
      vy: (dy / dist) * speed * 0.45,
      elapsed: 0,
      totalDuration: fi + hold + fo,
      wobblePhase: Math.random() * Math.PI * 2,
    };
  }

  _ghostAlpha() {
    if (!this._ghost) return 0;
    const { elapsed, totalDuration } = this._ghost;
    const fi = 1.8, fo = 2.5, max = 0.13;
    if (elapsed < fi)                    return (elapsed / fi) * max;
    if (elapsed < totalDuration - fo)    return max;
    return Math.max(0, ((totalDuration - elapsed) / fo) * max);
  }

  _drawGhost(ctx) {
    const alpha = this._ghostAlpha();
    if (alpha <= 0) return;
    const g      = this._ghost;
    const wobble = Math.sin(this._t * 1.3 + g.wobblePhase) * 5;
    const x      = g.x;
    const y      = g.y + wobble;
    const W2     = 28, H2 = 40;

    ctx.save();
    ctx.globalAlpha = alpha;

    const halo = ctx.createRadialGradient(x, y - 4, 4, x, y - 4, W2 * 2.0);
    halo.addColorStop(0,    'rgba(210, 180, 255, 0.70)');
    halo.addColorStop(0.45, 'rgba(160, 110, 230, 0.30)');
    halo.addColorStop(1,    'rgba(80,  40,  160, 0.00)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(x, y - 4, W2 * 2.0, H2 * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(240, 228, 255, 0.88)';
    ctx.beginPath();
    ctx.arc(x, y - H2 * 0.22, W2, Math.PI, 0, false);
    ctx.lineTo(x + W2, y + H2 * 0.55);
    const bumps = 4, bumpH = 7;
    for (let i = bumps; i >= 0; i--) {
      const bx = x - W2 + (i / bumps) * W2 * 2;
      const by = y + H2 * 0.55 + (i % 2 === 0 ? -bumpH : bumpH);
      ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fill();

    const shine = ctx.createRadialGradient(x - 8, y - H2 * 0.15, 2, x - 4, y - H2 * 0.1, W2 * 0.9);
    shine.addColorStop(0,   'rgba(255,252,255,0.45)');
    shine.addColorStop(0.5, 'rgba(220,200,255,0.10)');
    shine.addColorStop(1,   'rgba(180,150,255,0.00)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.ellipse(x - 4, y - H2 * 0.10, W2 * 0.75, H2 * 0.45, -0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(35, 8, 75, 0.75)';
    ctx.beginPath(); ctx.ellipse(x - 9, y - H2 * 0.08, 5.5, 8, -0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 9, y - H2 * 0.08, 5.5, 8,  0.18, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  // ── Spider ────────────────────────────────────────────────────────────────

  _scheduleSpider() {
    if (!this._spiderEnabled) return;
    const delay = this._intervalMs(this._spiderInterval, WraithEffect.SPIDER_INTERVALS);
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

    const corner = Math.floor(Math.random() * 4);
    let sx, sy;
    switch (corner) {
      case 0: sx = r.left  + 4; sy = r.top    + 4; break;
      case 1: sx = r.right - 4; sy = r.top    + 4; break;
      case 2: sx = r.left  + 4; sy = r.bottom - 4; break;
      default:sx = r.right - 4; sy = r.bottom - 4; break;
    }

    const wps = [];
    for (let i = 0; i < 4; i++) {
      wps.push({
        x: r.left + 10 + Math.random() * (r.width  - 20),
        y: r.top  + 10 + Math.random() * (r.height - 20),
      });
    }
    const exitEdge = Math.floor(Math.random() * 4);
    switch (exitEdge) {
      case 0: wps.push({ x: r.left  - 40, y: r.top  + Math.random() * r.height }); break;
      case 1: wps.push({ x: r.right + 40, y: r.top  + Math.random() * r.height }); break;
      case 2: wps.push({ x: r.left  + Math.random() * r.width, y: r.top    - 40 }); break;
      default:wps.push({ x: r.left  + Math.random() * r.width, y: r.bottom + 40 }); break;
    }

    // Initial heading toward first waypoint
    const dx0 = wps[0].x - sx, dy0 = wps[0].y - sy;
    const initialAngle = Math.atan2(dy0, dx0);

    this._spider = { x: sx, y: sy, angle: initialAngle, waypoints: wps, wpIdx: 0, legT: 0 };
  }

  _updateSpider(dt) {
    const s = this._spider;
    if (!s) return;

    s.legT += dt;

    if (s.wpIdx >= s.waypoints.length) { this._spider = null; return; }

    const tgt  = s.waypoints[s.wpIdx];
    const dx   = tgt.x - s.x;
    const dy   = tgt.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    // Smooth rotation toward heading (8 rad/s max turn rate)
    const targetAngle = Math.atan2(dy, dx);
    const angleDiff   = ((targetAngle - s.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    s.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 8 * dt);

    // Eased speed: ease-out — fast approach, decelerate near waypoint
    const DECEL_DIST = 40;
    const MAX_SPEED  = 230;
    const MIN_SPEED  = 20;
    const proximity  = dist < DECEL_DIST ? dist / DECEL_DIST : 1.0;
    const speed      = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * Math.sqrt(proximity);
    const step       = speed * dt;

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

    // Symmetrical 8-legged spider drawn in local space (faces +x = direction of travel)
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = 0.88;

    const LEG_COLOR  = '#9966cc';   // mid-purple — visible on dark backgrounds
    const BODY_COLOR = '#8855bb';

    // 4 legs per side — perfectly mirrored about the x-axis
    // Angles (in local degrees from +x): front→back spread across the body
    const BASE_ANGLES = [32, 56, 80, 104];  // degrees from forward for each leg
    const THIGH_LEN   = 10;
    const SHIN_LEN    = 10;

    ctx.strokeStyle = LEG_COLOR;
    ctx.lineWidth   = 1.1;

    for (let side = 0; side < 2; side++) {
      const ym = side === 0 ? -1 : 1;   // -1 = top, +1 = bottom
      for (let i = 0; i < 4; i++) {
        const rad  = BASE_ANGLES[i] * Math.PI / 180;
        // Alternate legs rise/fall on opposite wave phases (walking gait)
        const wave = Math.sin(s.legT * 10 + i * Math.PI * 0.75) * 2.5 * ym;

        // Thigh: from body to joint
        const jx = Math.cos(rad) * THIGH_LEN;
        const jy = ym * Math.sin(rad) * THIGH_LEN + wave;

        // Shin: continues from joint, angled further outward
        const shinRad = rad + 0.38;
        const tx = jx + Math.cos(shinRad) * SHIN_LEN;
        const ty = jy + ym * Math.sin(shinRad) * SHIN_LEN;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(jx, jy, tx, ty);
        ctx.stroke();
      }
    }

    // Body: abdomen (rear oval) + cephalothorax (front oval)
    ctx.fillStyle = BODY_COLOR;

    ctx.beginPath();
    ctx.ellipse(-7, 0, 8, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(2, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Lightning ─────────────────────────────────────────────────────────────

  _scheduleLightning() {
    if (!this._lightningEnabled) return;
    const delay = this._intervalMs(this._lightningInterval, WraithEffect.LIGHTNING_INTERVALS);
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

  _doLightningFlash() {
    const ov = document.createElement('div');
    ov.id = 'wraith-lightning-overlay';
    ov.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9998', 'pointer-events:none',
      'background:rgba(220,200,255,0)', 'transition:background 0.03s linear',
    ].join(';');
    document.body.appendChild(ov);

    const set = (bg, delay, transition) => setTimeout(() => {
      if (!document.getElementById('wraith-lightning-overlay')) return;
      if (transition) ov.style.transition = transition;
      ov.style.background = bg;
    }, delay);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      ov.style.background = 'rgba(225,210,255,0.88)';
    }));
    set('rgba(190,160,255,0.22)', 55,  'background 0.08s ease-out');
    set('rgba(225,210,255,0.70)', 120, 'background 0.03s linear');
    set('rgba(190,160,255,0.08)', 165, 'background 0.10s ease-out');
    set('rgba(210,190,255,0.45)', 220, 'background 0.02s linear');
    set('rgba(160,120,220,0.04)', 275, 'background 0.36s ease-out');
    setTimeout(() => document.getElementById('wraith-lightning-overlay')?.remove(), 660);
  }

  _drawLightningWindow(ctx, W, H) {
    const t = this._lightningT;
    if (t < 0.08 || t > 0.72) return;
    const fadeIn  = Math.min(1, (t - 0.08) / 0.12);
    const fadeOut = t > 0.58 ? Math.max(0, 1 - (t - 0.58) / 0.14) : 1;
    const alpha   = fadeIn * fadeOut;
    if (alpha <= 0) return;

    const cx  = W * 0.38, cy = H * 0.24;
    const ww  = W * 0.30, wh = H * 0.38;
    const fw  = 11;

    ctx.save();
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle   = 'rgba(200, 170, 255, 1)';

    ctx.fillRect(cx - ww / 2,      cy - wh / 2,       ww,  fw);
    ctx.fillRect(cx - ww / 2,      cy + wh / 2 - fw,  ww,  fw);
    ctx.fillRect(cx - ww / 2,      cy - wh / 2,       fw,  wh);
    ctx.fillRect(cx + ww / 2 - fw, cy - wh / 2,       fw,  wh);
    ctx.fillRect(cx - ww / 2,      cy - fw / 2,        ww,  fw);
    ctx.fillRect(cx - fw / 2,      cy - wh / 2,        fw,  wh);

    ctx.globalAlpha = alpha * 0.06;
    ctx.fillStyle   = 'rgba(230, 210, 255, 1)';
    const ix = cx - ww / 2 + fw, iy = cy - wh / 2 + fw;
    const pw = ww / 2 - fw * 1.5, ph = wh / 2 - fw * 1.5;
    ctx.fillRect(ix,        iy,        pw, ph);
    ctx.fillRect(cx + fw/2, iy,        pw, ph);
    ctx.fillRect(ix,        cy + fw/2, pw, ph);
    ctx.fillRect(cx + fw/2, cy + fw/2, pw, ph);

    ctx.restore();
  }
}

PackageRegistry.registerEffect(new WraithEffect());
