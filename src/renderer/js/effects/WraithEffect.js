'use strict';
/**
 * WraithEffect — ambient canvas effects for the WRAITH visual package (Vesper).
 * Registered under id 'wraithAmbient'.
 *
 * Three independently-toggleable sub-systems, each controlled by a settings module:
 *   wraithCobwebs   : random asymmetric corner webs swaying in a faint breeze
 *   wraithSpirits   : occasional mote drift + spider scurry (both spam-spawnable)
 *   wraithLightning : occasional lightning flash (DOM overlay)
 *
 * All three share one rAF loop; the effect stops only when all three are disabled.
 */
class WraithEffect extends VisualEffect {

  // ── Tuning ────────────────────────────────────────────────────────────────
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
    // Ghosts & spiders are ARRAYS so the SPAWN buttons can be spammed to
    // stack multiple simultaneously. Each entity self-terminates when done.
    this._lightningTimer = null;
    this._ghosts         = [];
    this._ghostTimer     = null;
    this._spiders        = [];
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
    this._ghosts     = [];
    this._spiders    = [];
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
    this._ghosts  = [];
    this._spiders = [];
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
        if (!value) { clearTimeout(this._spiderTimer); this._spiderTimer = null; }
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
  // Spam-friendly: each call unconditionally adds a new entity. The
  // scheduler timers run independently and are NOT touched here — so the
  // player can machine-gun the SPAWN button without disturbing the natural
  // ambient cadence.

  spawnGhost()  { if (this._running) this._spawnGhost();  }
  spawnSpider() { if (this._running) this._spawnSpider(); }

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

    for (const g of this._ghosts) this._updateGhost(g, dt);
    this._ghosts = this._ghosts.filter(g => g.elapsed < g.totalDuration || g.childMotes.length > 0);

    for (const s of this._spiders) this._updateSpider(s, dt);
    this._spiders = this._spiders.filter(s => s.wpIdx < s.waypoints.length);

    this._draw();
    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Master draw ───────────────────────────────────────────────────────────

  _draw() {
    const { _ctx: ctx, _canvas: cv } = this;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    if (this._cobwebsEnabled) this._drawCobwebs(ctx, W, H);
    for (const g of this._ghosts) this._drawGhost(ctx, g);
    for (const s of this._spiders) this._drawSpider(ctx, s);
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
      // Fixed 90° span so the two wall-anchor spokes lie exactly along the
      // window's edges — the web fits its corner perfectly, no gap or overshoot.
      const spread      = 90;
      // 2–6 interior spokes (+ 2 wall anchors) = 4–8 total. Minimum 4 spokes
      // is a hard floor — anything less looks like a broken web fragment,
      // not a corner cobweb.
      const numInterior = 2 + Math.floor(Math.random() * 5);
      const baseRadius  = 32 + Math.random() * 52;            // 32–84px rough reach
      // 3–8 tiers of connecting webbing (counting the outermost tip ring).
      // Minimum 3 so the web never reads as bare; 8 max keeps it busy but not
      // solid.
      const numRings    = 3 + Math.floor(Math.random() * 6);
      const alpha       = 0.18 + Math.random() * 0.22;       // per-web opacity
      const lineWidth   = 0.40 + Math.random() * 0.55;       // per-web stroke weight

      // Distribute interior spokes evenly across the arc with a small jitter,
      // so the web reads as "structured" even at high spoke counts. Purely
      // random placement collapses into visible clumps and gaps.
      const rawAngles = [0];
      for (let i = 0; i < numInterior; i++) {
        const base   = spread * (i + 1) / (numInterior + 1);
        const jitter = spread * 0.05 * (Math.random() - 0.5);
        rawAngles.push(base + jitter);
      }
      rawAngles.push(spread);
      rawAngles.sort((a, b) => a - b);

      const angles = rawAngles;

      // Spoke lengths form a smooth curve across the arc.
      //   • The two wall-anchor spokes get their own random lengths.
      //   • A "median" length sits between the two edge lengths (never longer
      //     than the longer edge, never shorter than the shorter edge).
      //   • Interior spokes lerp: edgeA → median across the first half, then
      //     median → edgeB across the second half. A tiny bracket-clamped
      //     jitter keeps things natural without ever escaping the envelope.
      // Result: no more long/short/long/short toothy silhouettes — the tips
      // trace a soft curve from one wall anchor to the other.
      const edgeLenA  = baseRadius * (0.85 + Math.random() * 0.35);
      const edgeLenB  = baseRadius * (0.85 + Math.random() * 0.35);
      const minEdge   = Math.min(edgeLenA, edgeLenB);
      const maxEdge   = Math.max(edgeLenA, edgeLenB);
      const medianLen = minEdge + Math.random() * (maxEdge - minEdge);
      const N = angles.length;
      const spokeLengths = angles.map((_, i) => {
        if (i === 0)     return edgeLenA;
        if (i === N - 1) return edgeLenB;
        const t = i / (N - 1);
        const [aLen, bLen, localT] = (t <= 0.5)
          ? [edgeLenA, medianLen, t * 2]
          : [medianLen, edgeLenB, (t - 0.5) * 2];
        const base   = aLen + (bLen - aLen) * localT;
        const jitter = (Math.random() - 0.5) * 0.08 * base;
        // Clamp inside the [min(aLen,bLen), max(aLen,bLen)] envelope so the
        // interior length never overshoots the two segment endpoints.
        const lo = Math.min(aLen, bLen);
        const hi = Math.max(aLen, bLen);
        return Math.max(lo, Math.min(hi, base + jitter));
      });

      // Sway factors: 0 at wall-anchors (fixed), sine peak in middle
      const swayFactors = angles.map(a => Math.sin((a / spread) * Math.PI));

      // Ring tiers.
      //
      // OUTERMOST ring sits exactly at the spoke tips (frac = 1.0) with every
      // segment present as a plain `normal` connector. HARD RULE: the outer
      // edge is always full — no misses, no diagonals, no variants. Every tip
      // is guaranteed to be connected to its two neighbouring tips.
      //
      // INNER rings drop inward toward the corner. Each inner-ring segment
      // rolls one of three variants for visual variety:
      //   • normal — plain ring segment at ring.frac on both spokes.
      //   • miss   — segment omitted (variant A, "torn").
      //   • diag   — one endpoint pulled DOWN toward the corner, so the
      //              segment slants from tier X to a lower tier on the next
      //              spoke (variant B).
      const rings = [
        { frac: 1.0, segments: angles.slice(0, -1).map(() => ({ type: 'normal' })) },
      ];
      const innerRingCount = Math.max(0, numRings - 1);
      for (let i = 0; i < innerRingCount; i++) {
        // Distribute inner rings between ~20% and ~80% of each spoke's length.
        const frac = 0.20 + 0.60 * ((i + 0.5 + (Math.random() - 0.5) * 0.35) / innerRingCount);
        const segments = angles.slice(0, -1).map(() => {
          const r = Math.random();
          if (r < 0.12) return { type: 'miss' };
          if (r < 0.30) return {
            type: 'diag',
            // How far to pull the low end down (fractions of ring.frac).
            // 0.35..0.75 range = clearly slanted but never collapsing to zero.
            drop: 0.35 + Math.random() * 0.40,
            // Randomize which end is the low one so diagonals go both ways.
            flipLow: Math.random() < 0.5,
          };
          return { type: 'normal' };
        });
        rings.push({ frac, segments });
      }
      rings.sort((a, b) => a.frac - b.frac);

      // INTER-WEBS (variant C): extra connector strands slung between two
      // adjacent ring tiers on a random spoke pair. Both endpoints sit at
      // fracs strictly between the two rings, so the strand looks like a
      // bit of stray webbing bridging one tier to the next. Rolled per
      // (tier gap × spoke pair). Rate is modest so they read as accidental
      // extras, not a second full ring.
      const interWebs = [];
      for (let ri = 0; ri < rings.length - 1; ri++) {
        const loFrac = rings[ri].frac;
        const hiFrac = rings[ri + 1].frac;
        for (let si = 0; si < angles.length - 1; si++) {
          if (Math.random() < 0.22) {
            // Random fracs in the tier gap; the two ends can (and usually do)
            // sit at different fracs so the strand slants naturally.
            const fA = loFrac + (0.15 + Math.random() * 0.70) * (hiFrac - loFrac);
            const fB = loFrac + (0.15 + Math.random() * 0.70) * (hiFrac - loFrac);
            interWebs.push({ spoke: si, fracA: fA, fracB: fB });
          }
        }
      }

      return { xSign, ySign, angles, spokeLengths, rings, swayFactors, alpha, lineWidth, interWebs };
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
    const { xSign, ySign, angles, spokeLengths, rings, swayFactors, alpha, lineWidth, interWebs } = web;
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

    // Draw a single ring/connector curve from p0 to p1 with a small outward
    // bow. The push is intentionally modest — silk strands are pulled taut
    // between spokes, they don't balloon outward. Push scales with the
    // segment's midpoint distance from the corner so far-out strands don't
    // look absurdly flat while close-in ones don't collapse to straight lines.
    const drawStrand = (p0, p1) => {
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      const vx   = midX - cx;
      const vy   = midY - cy;
      const dist = Math.sqrt(vx * vx + vy * vy) || 1;
      const push = dist * 0.06;   // taut — was 0.28 (arched way too far out)
      const cpx  = midX + (vx / dist) * push;
      const cpy  = midY + (vy / dist) * push;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(cpx, cpy, p1.x, p1.y);
      ctx.stroke();
    };

    // Radial spokes — each extends to its own max length.
    for (let i = 0; i < angles.length; i++) {
      const tip = pt(i, 1.0);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }

    // Ring segments — each drawn per variant.
    //   normal → both endpoints at ring.frac.
    //   miss   → skip entirely.
    //   diag   → one endpoint pulled down to a lower frac (toward the corner).
    for (const ring of rings) {
      for (let i = 0; i < angles.length - 1; i++) {
        const seg = ring.segments[i];
        if (!seg || seg.type === 'miss') continue;

        let fA = ring.frac, fB = ring.frac;
        if (seg.type === 'diag') {
          // Pull the "low" end down toward the corner. Clamp so it never
          // dips below 0.10 of the spoke's length (keeps it visibly above
          // the corner cluster).
          const low = Math.max(0.10, ring.frac * (1 - seg.drop));
          if (seg.flipLow) fA = low; else fB = low;
        }
        drawStrand(pt(i, fA), pt(i + 1, fB));
      }
    }

    // Inter-web extras (variant C) — strands slung between tiers on a random
    // spoke pair. Both endpoints already sit BETWEEN two rings so they're
    // never orphans: each end lands on a spoke line.
    if (interWebs) {
      for (const iw of interWebs) {
        drawStrand(pt(iw.spoke, iw.fracA), pt(iw.spoke + 1, iw.fracB));
      }
    }

    ctx.restore();
  }

  // ── Ghost / Mote ──────────────────────────────────────────────────────────

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

    // Aim roughly at panel center so it swirls inward, not off-screen.
    const tx = r.left + r.width  * 0.5;
    const ty = r.top  + r.height * 0.5;
    const initialAngle = Math.atan2(ty - sy, tx - sx);

    const fi = 2.4, hold = 6.5, fo = 3.0;

    this._ghosts.push({
      x: sx, y: sy,
      angle: initialAngle,

      // Curved wandering: two overlapping sine waves at different frequencies
      // per axis produce a non-repeating swirl. Seeds are per-mote so stacked
      // spawns drift independently.
      turnSeedA:  Math.random() * Math.PI * 2,
      turnSeedB:  Math.random() * Math.PI * 2,
      maxTurn:    1.4 + Math.random() * 1.0,     // 1.4–2.4 rad/s peak turn (~80–140°/s)

      // Speed shifts throughout life too — same two-sine trick per mote.
      speedSeedA: Math.random() * Math.PI * 2,
      speedSeedB: Math.random() * Math.PI * 2,
      baseSpeed:  120 + Math.random() * 40,       // 120–160 px/s baseline
      speedAmp:   70  + Math.random() * 40,       // ±70–110 px/s modulation

      elapsed: 0,
      totalDuration: fi + hold + fo,
      fi, hold, fo,
      pulsePhase: Math.random() * Math.PI * 2,
      childMotes: [],
      nextEmit:   0.30 + Math.random() * 0.35,
    });
  }

  // Update position + child-mote emission for one ghost.
  _updateGhost(g, dt) {
    g.elapsed += dt;

    // Curved swirling path — angle drifts with two overlapping sines;
    // speed modulates with its own two-sine envelope.
    const turnRate =
      (Math.sin(this._t * 0.55 + g.turnSeedA) * 0.7 +
       Math.sin(this._t * 1.30 + g.turnSeedB) * 0.4) * g.maxTurn;
    g.angle += turnRate * dt;

    const speedMod =
      Math.sin(this._t * 0.45 + g.speedSeedA) * 0.65 +
      Math.sin(this._t * 1.10 + g.speedSeedB) * 0.35;
    const curSpeed = Math.max(20, g.baseSpeed + g.speedAmp * speedMod);

    g.x += Math.cos(g.angle) * curSpeed * dt;
    g.y += Math.sin(g.angle) * curSpeed * dt;

    // Emit tiny child motes while the main mote is "present" (not yet
    // fading out). Each emitted mote drifts in a random direction and
    // slowly fades to nothing.
    g.nextEmit -= dt;
    if (g.nextEmit <= 0 && g.elapsed < g.fi + g.hold) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 7 + Math.random() * 8;                  // 7–15 px/s
      g.childMotes.push({
        x:      g.x + (Math.random() - 0.5) * 6,
        y:      g.y + (Math.random() - 0.5) * 6,
        vx:     Math.cos(ang) * spd,
        vy:     Math.sin(ang) * spd,
        age:    0,
        life:   2.0 + Math.random() * 1.8,                // 2.0–3.8s
        radius: 1.5 + Math.random() * 1.6,                // 1.5–3.1px core
      });
      g.nextEmit = 0.30 + Math.random() * 0.45;
    }

    for (const cm of g.childMotes) {
      cm.age += dt;
      cm.x   += cm.vx * dt;
      cm.y   += cm.vy * dt;
    }
    g.childMotes = g.childMotes.filter(cm => cm.age < cm.life);
  }

  // Envelope for a mote's presence — fade in, hold, fade out.
  _ghostAlpha(g) {
    const { elapsed, totalDuration, fi, fo } = g;
    const max = 0.85;
    if (elapsed < fi)                 return (elapsed / fi) * max;
    if (elapsed < totalDuration - fo) return max;
    return Math.max(0, ((totalDuration - elapsed) / fo) * max);
  }

  // 3-stop pulse: white → teal-white → background → white.
  // `phase` seeds each mote (or child) so they aren't perfectly in sync.
  _motePulseColor(phase) {
    const CYCLE = 6.0;
    const p = (((this._t + phase) % CYCLE) + CYCLE) % CYCLE / CYCLE;   // 0..1
    // Stops laid out so index i → i+1 blends across a third of the cycle.
    // Last stop wraps back to white for a seamless loop.
    const stops = [
      [255, 255, 255],   // white
      [180, 250, 240],   // teal-white
      [ 6,   4,  13],    // ~bg-dark
      [255, 255, 255],   // white (wrap)
    ];
    const seg = p * 3;
    const si  = Math.min(2, Math.floor(seg));
    const sf  = seg - si;
    const c0  = stops[si], c1 = stops[si + 1];
    return [
      Math.round(c0[0] + (c1[0] - c0[0]) * sf),
      Math.round(c0[1] + (c1[1] - c0[1]) * sf),
      Math.round(c0[2] + (c1[2] - c0[2]) * sf),
    ];
  }

  _drawGhost(ctx, g) {
    if (!g) return;
    const envelope = this._ghostAlpha(g);
    if (envelope <= 0 && g.childMotes.length === 0) return;

    const [R, G, B] = this._motePulseColor(g.pulsePhase);
    const CORE_R    = 22;        // full-opacity core radius (falls off from here)

    ctx.save();

    // Main mote — opaque center, radial falloff to 0.
    if (envelope > 0) {
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, CORE_R);
      grad.addColorStop(0.00, `rgba(${R},${G},${B},${envelope})`);
      grad.addColorStop(0.35, `rgba(${R},${G},${B},${envelope * 0.55})`);
      grad.addColorStop(1.00, `rgba(${R},${G},${B},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(g.x, g.y, CORE_R, 0, Math.PI * 2);
      ctx.fill();
    }

    // Emitted child motes — same pulse (offset phase), tiny, fade out.
    for (const cm of g.childMotes) {
      const [cr, cg, cb] = this._motePulseColor(g.pulsePhase + cm.life);
      const lifeAlpha    = Math.max(0, 1 - cm.age / cm.life);
      const a            = lifeAlpha * lifeAlpha * 0.75;   // ease-out fade
      if (a <= 0.01) continue;
      const cR = cm.radius * 3.0;
      const cgd = ctx.createRadialGradient(cm.x, cm.y, 0, cm.x, cm.y, cR);
      cgd.addColorStop(0.0, `rgba(${cr},${cg},${cb},${a})`);
      cgd.addColorStop(0.5, `rgba(${cr},${cg},${cb},${a * 0.35})`);
      cgd.addColorStop(1.0, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = cgd;
      ctx.beginPath();
      ctx.arc(cm.x, cm.y, cR, 0, Math.PI * 2);
      ctx.fill();
    }

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

    this._spiders.push({ x: sx, y: sy, angle: initialAngle, waypoints: wps, wpIdx: 0, legT: 0 });
  }

  _updateSpider(s, dt) {
    if (!s) return;

    s.legT += dt;

    if (s.wpIdx >= s.waypoints.length) return;

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

  _drawSpider(ctx, s) {
    if (!s) return;

    // Symmetrical 8-legged spider drawn in local space (faces +x = direction of travel)
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = 0.92;

    // 4 legs per side — perfectly mirrored about the x-axis
    // Angles (in local degrees from +x): front→back spread across the body
    const BASE_ANGLES = [32, 56, 80, 104];  // degrees from forward for each leg
    const THIGH_LEN   = 10;
    const SHIN_LEN    = 10;

    // Legs: plain black
    ctx.strokeStyle = '#000000';
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

    // Body — each oval is black with a deep pink-purple radial gradient
    // blooming from center to edge. The scale trick shapes the gradient to
    // the ellipse so the falloff matches the body shape.
    const drawBody = (ox, oy, rw, rh) => {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(1, rh / rw);
      // Black base
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(0, 0, rw, 0, Math.PI * 2);
      ctx.fill();
      // Deep pink → purple radial gradient overlay — dark & moody, not neon.
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
      grad.addColorStop(0.00, 'rgba(180,  50, 130, 0.80)');   // deep magenta core
      grad.addColorStop(0.55, 'rgba(105,  25, 110, 0.40)');   // dark purple mid
      grad.addColorStop(1.00, 'rgba( 40,   8,  55, 0.00)');   // fades to black edge
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rw, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    drawBody(-7, 0, 8, 5.5);   // abdomen
    drawBody( 2, 0, 5, 4);     // cephalothorax

    // 8 tiny red eyes on the cephalothorax — very low alpha, hard to spot,
    // slow soft pulse. Classic spider arrangement: 2 large front-central +
    // 6 smaller flanking, arranged in staggered rows near the front.
    const eyePulse = 0.18 + 0.10 * (Math.sin(s.legT * 2.2) * 0.5 + 0.5);
    ctx.fillStyle = `rgba(230, 40, 40, ${eyePulse})`;
    const eyes = [
      { x: 6.4, y: -0.6, r: 0.50 },   // primary median row (bigger)
      { x: 6.4, y:  0.6, r: 0.50 },
      { x: 5.5, y: -1.4, r: 0.35 },   // upper flank
      { x: 5.5, y:  1.4, r: 0.35 },   // lower flank
      { x: 5.4, y: -0.3, r: 0.32 },   // inner secondary row
      { x: 5.4, y:  0.3, r: 0.32 },
      { x: 4.4, y: -1.6, r: 0.28 },   // rear-outer
      { x: 4.4, y:  1.6, r: 0.28 },
    ];
    for (const e of eyes) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }

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

}

PackageRegistry.registerEffect(new WraithEffect());
