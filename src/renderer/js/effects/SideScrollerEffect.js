'use strict';
/**
 * SideScrollerEffect — Arcade Cabinet "SIDE SCROLLER" random event.
 * Registered under id 'sideScroller'. Used by: Arcade Cabinet package.
 *
 * States: idle → intro → scrolling → boss → game_over → outro
 *
 * A pixel side-scroller plays out autonomously. Hero walks right across a
 * parallax fantasy landscape, cutting down enemies one at a time. Boss
 * arrives, kills hero. GAME OVER flashes, then everything crumbles.
 */
class SideScrollerEffect extends VisualEffect {

  // ── Tuning ────────────────────────────────────────────────────────────────
  static PX           = 5;     // pixel grid unit
  static SCROLL_SPEED = 60;    // px/s world scroll
  static ENGAGE_DIST  = 70;    // px — hero/enemy engage distance
  static MIN_KILLS    = 3;     // kills before boss triggers
  static XP_PER_LEVEL = 90;   // xp needed per level-up
  static ENEMY_TYPES  = ['goblin','slime','harpy','wolf','imp','boar','mimic'];
  static BOSS_TYPES   = ['orc','blob','troll'];

  constructor() {
    super('sideScroller');
    this._canvas    = null;
    this._ctx       = null;
    this._rAF       = null;
    this._state     = 'idle';
    this._t         = 0;
    this._lastTs    = 0;

    // Entities
    this._hero      = null;
    this._enemy     = null;   // active enemy (one at a time)
    this._boss      = null;
    this._particles = [];
    this._floatTexts = [];

    // World / background
    this._layers    = null;   // built by _buildLayers()
    this._groundY   = 0;
    this._scrollX   = 0;      // world scroll accumulator
    this._scrollFrozen = false;

    // Enemy queue
    this._enemyQueue  = [];   // ordered list of enemy type strings
    this._bossType    = 'orc';
    this._bossSpawned = false;

    // HUD state
    this._heroHp    = 100;    // 100 = full, 0 = dead
    this._xp        = 0;
    this._xpTarget  = 0;
    this._gold      = 0;
    this._level     = 1;
    this._killCount = 0;

    // Sub-phase helpers
    this._combatT       = 0;
    this._inCombat      = false;
    this._levelUpT      = 0;
    this._levelUpPhase  = '';  // 'draining' | 'flash'
    this._inLevelUp     = false;
    this._crumbleStarted = false;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get busy() { return this._state !== 'idle'; }

  spawn() {
    if (!this._initCanvas()) return;
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._reset();
    this._state  = 'intro';
    this._t      = 0;
    this._lastTs = 0;
    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  _onStart(config) { this._initCanvas(); }

  _onStop() {
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    if (this._keyHandler) { window.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
    this._state = 'idle';
    if (this._ctx && this._canvas)
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * dismiss() — called when the user sends a message mid-event.
   * Immediately skips to the pixel-crumble outro, bypassing any remaining
   * intro / scrolling / boss / game_over phases.
   * Rule: every event effect MUST implement this and jump straight to crumble.
   */
  dismiss() {
    if (this._state === 'idle') return;
    this._particles      = [];
    this._state          = 'outro';
    this._t              = 0;
    this._crumbleStarted = false;
  }

  // ── Canvas ────────────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return true;
    this._canvas = document.getElementById('bg-side-scroller');
    if (!this._canvas) return false;
    this._ctx = this._canvas.getContext('2d');
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
      if (!this._canvas) return;
      this._canvas.width  = window.innerWidth;
      this._canvas.height = window.innerHeight;
      if (this._state !== 'idle') {
        const ga = this._gameArea();
        this._buildLayers(ga);
      }
    });

    // Dev hotkeys: Ctrl=orc, Shift=blob, Alt=troll — forces immediate boss spawn
    this._keyHandler = (e) => {
      if (this._state !== 'scrolling') return;
      if (this._bossSpawned || this._inCombat || this._inLevelUp) return;
      let type = null;
      if (e.key === 'Control') type = 'orc';
      else if (e.key === 'Shift') type = 'blob';
      else if (e.key === 'Alt') type = 'troll';
      if (!type) return;
      e.preventDefault();
      this._bossType = type;
      this._enemy = null;
      this._inCombat = false;
      this._scrollFrozen = false;
      this._startBossPhase(this._gameArea());
    };
    window.addEventListener('keydown', this._keyHandler);
    return true;
  }

  _gameArea() {
    const el = document.getElementById('output-panel');
    if (!el) return { x: 10, y: 10, w: 700, h: 400 };
    const r = el.getBoundingClientRect();
    return { x: r.left + 4, y: r.top + 4, w: r.width - 8, h: r.height - 8 };
  }

  // ── Reset / Init ──────────────────────────────────────────────────────────

  _reset() {
    const ga = this._gameArea();
    this._scrollX       = 0;
    this._scrollFrozen  = false;
    this._killCount     = 0;
    this._level         = 1;
    this._xp            = 0;
    this._xpTarget      = 0;
    this._gold          = 0;
    this._heroHp        = 100;
    this._particles     = [];
    this._floatTexts    = [];
    this._boss          = null;
    this._enemy         = null;
    this._bossSpawned   = false;
    this._inCombat      = false;
    this._inLevelUp     = false;
    this._crumbleStarted = false;
    this._combatT         = 0;
    this._levelUpT        = 0;
    this._nextEnemyScroll = 80;

    this._buildEnemyQueue();
    this._buildLayers(ga);

    const PX = SideScrollerEffect.PX;
    const groundY = ga.y + ga.h - 28;
    this._groundY = groundY;

    // Hero starts off left edge
    this._hero = {
      x:      ga.x - 60,
      y:      groundY - 11 * PX,
      state:  'walk',   // 'walk' | 'slash' | 'dying' | 'dead'
      frame:  0,
      animT:  0,
      deadT:  0,
    };
  }

  // ── Enemy & Boss Pool ─────────────────────────────────────────────────────

  _buildEnemyQueue() {
    // Fisher-Yates shuffle of ENEMY_TYPES, take first 5
    const pool = [...SideScrollerEffect.ENEMY_TYPES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this._enemyQueue = pool.slice(0, 5);

    // Pick random boss
    const bosses = SideScrollerEffect.BOSS_TYPES;
    this._bossType = bosses[Math.floor(Math.random() * bosses.length)];
  }

  // ── Tick Loop ─────────────────────────────────────────────────────────────

  _tick(ts) {
    if (this._state === 'idle') return;
    const dt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) * 1.3 : 0;
    this._lastTs = ts;
    this._t += dt;

    const cvs = this._canvas;
    const ctx = this._ctx;
    const ga  = this._gameArea();

    // Clear full canvas
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    // Clip to game strip for all drawing
    ctx.save();
    ctx.beginPath();
    ctx.rect(ga.x, ga.y, ga.w, ga.h);
    ctx.clip();

    switch (this._state) {
      case 'intro':     this._update_intro(dt, ga);     break;
      case 'scrolling': this._update_scrolling(dt, ga); break;
      case 'boss':      this._update_boss(dt, ga);      break;
      case 'game_over': this._update_game_over(dt, ga); break;
      case 'outro':     this._update_outro(dt, ga);     break;
    }

    ctx.restore();

    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Phase stubs (filled in later phases) ─────────────────────────────────

  _buildLayers(ga) {
    this._layers = {
      clouds:     this._buildClouds(ga),
      farHills:   this._buildFarHills(ga),
      midBushes:  this._buildMidBushes(ga),
      nearTrees:  this._buildNearTrees(ga),
      fgFences:   this._buildFgFences(ga),
      fgBushes:   this._buildFgBushes(ga),
    };
  }

  _buildFarHills(ga) {
    const W = ga.w + 400;
    const groundY = ga.y + ga.h - 28;
    const baseY   = groundY - 30;
    // Generate jagged hilltop polygon points
    const pts = [];
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * W;
      const peak = (i % 3 === 1) ? 55 : (i % 3 === 2) ? 35 : 20;
      pts.push({ x, y: baseY - peak - Math.sin(i * 1.7) * 12 });
    }
    return { pts, W, offset: 0, speed: 18, baseY };
  }

  _buildMidBushes(ga) {
    const W = ga.w + 500;
    const groundY = ga.y + ga.h - 28;
    const clusters = [];
    // Random gap accumulation for irregular spacing
    let cx = 20 + Math.random() * 40;
    while (cx < W) {
      const n  = 2 + Math.floor(Math.random() * 2); // 2 or 3 blobs
      const blobs = [];
      for (let j = 0; j < n; j++) {
        const rx = 14 + Math.random() * 8;
        const ry = 11 + Math.random() * 5;
        const isTop = (n === 3 && j === 1);
        const dx = isTop ? (Math.random() * 8 - 4) : (j === 0 ? -rx * 0.7 : rx * 0.7) + Math.random() * 6 - 3;
        // base blobs: bottom at groundY; top blob floats above them
        const dy = isTop ? -(ry + 12 + Math.random() * 8) : -ry + 3;
        blobs.push({ dx, dy, rx, ry });
      }
      clusters.push({ bx: cx, by: groundY, blobs });
      cx += Math.random() < 0.45 ? 18 + Math.random() * 50 : 90 + Math.random() * 190;
    }
    return { clusters, W, offset: 0, speed: 38, color: '#3A8A3A' };
  }

  _buildNearTrees(ga) {
    const W = ga.w + 600;
    const groundY = ga.y + ga.h - 28;
    const trees = [];
    // Random gap accumulation for irregular spacing
    let tx = 10 + Math.random() * 60;
    while (tx < W) {
      const th = 60 + Math.random() * 40;
      trees.push({ tx, th, tw: 14 + Math.random() * 10, groundY });
      tx += Math.random() < 0.4 ? 28 + Math.random() * 65 : 110 + Math.random() * 260;
    }
    return { trees, W, offset: 0, speed: 60,
             trunkColor: '#4A2A0E', crownColor: '#1A5520', crownMid: '#2A7530', crownLight: '#3A8A40' };
  }

  _buildClouds(ga) {
    const clouds = [];
    const W = ga.w + 300;
    // x stored relative to ga.x for clean rep-based wrap
    let cx = Math.random() * 80;
    while (cx < W) {
      clouds.push({
        x:  cx,
        y:  ga.y + Math.round(ga.h / 2) - 10 + (Math.random() * 50 - 25),
        rx: 35 + Math.random() * 35,
        ry: 12 + Math.random() * 12,
      });
      cx += Math.random() < 0.35 ? 40 + Math.random() * 80 : 150 + Math.random() * 310;
    }
    return { clouds, W, offset: 0, speed: 12 };
  }

  _buildFgFences(ga) {
    // Fences scroll at ground speed — they're planted objects, not parallax
    const W = ga.w + 500;
    const groundY = ga.y + ga.h - 28;
    const items = [];
    let fx = 20 + Math.random() * 100;
    while (fx < W) {
      const panels = 1 + Math.floor(Math.random() * 5);
      items.push({ x: fx, panels });
      fx += panels * 16 + 8;
      fx += Math.random() < 0.5 ? 30 + Math.random() * 80 : 120 + Math.random() * 280;
    }
    return { items, W, groundY, offset: 0, speed: 60 };
  }

  _buildFgBushes(ga) {
    // Foreground bushes — don't place bushes where enemies will enter from the right.
    // A bush at item.x enters the right edge when scrollX ≈ item.x (layer scrolls at SCROLL_SPEED).
    // Enemy spawns at scrollX = _nextEnemyScroll + i*140 for i=0..4.
    const W = ga.w + 500;
    const groundY = ga.y + ga.h - 28;
    const clearance = 85;
    const forbidZones = [];
    for (let i = 0; i < 5; i++) forbidZones.push(this._nextEnemyScroll + i * 140);

    const items = [];
    let fx = 10 + Math.random() * 60;
    while (fx < W) {
      const r = 10 + Math.random() * 14;
      const blocked = forbidZones.some(z => Math.abs(fx - z) < r + clearance);
      if (!blocked) items.push({ x: fx, r });
      fx += r * 2 + 6;
      fx += Math.random() < 0.5 ? 10 + Math.random() * 50 : 80 + Math.random() * 200;
    }
    return { items, W, groundY, offset: 0, speed: 60 };
  }

  _drawFgFences(ctx, ga, layer) {
    for (let rep = -1; rep <= 1; rep++) {
      const ox = ga.x - layer.offset + rep * layer.W;
      for (const item of layer.items) {
        const dx = ox + item.x;
        if (dx + 130 < ga.x || dx - 20 > ga.x + ga.w) continue;
        this._drawFgFence(ctx, dx, layer.groundY, item.panels);
      }
    }
  }

  _drawFgBushes(ctx, ga, layer) {
    for (let rep = -1; rep <= 1; rep++) {
      const ox = ga.x - layer.offset + rep * layer.W;
      for (const item of layer.items) {
        const dx = ox + item.x;
        if (dx + 60 < ga.x || dx - 60 > ga.x + ga.w) continue;
        this._drawFgBush(ctx, dx, layer.groundY, item.r);
      }
    }
  }

  _drawFgOverlay(ga) {
    if (this._layers?.fgBushes) this._drawFgBushes(this._ctx, ga, this._layers.fgBushes);
  }

  _drawFgFence(ctx, x, groundY, panels) {
    const bw = 6, gap = 4, bh = 26, panelW = bw * 2 + gap * 3;
    const totalW = panels * panelW + gap;
    // Horizontal rails (behind boards)
    ctx.fillStyle = '#5A3210';
    ctx.fillRect(x, groundY - bh + 5, totalW, 4);
    ctx.fillRect(x, groundY - bh + 17, totalW, 4);
    // Rail highlight top edge
    ctx.fillStyle = '#8B5520';
    ctx.fillRect(x, groundY - bh + 5, totalW, 1);
    ctx.fillRect(x, groundY - bh + 17, totalW, 1);
    for (let p = 0; p < panels; p++) {
      for (let b = 0; b < 2; b++) {
        const bx = x + p * panelW + b * (bw + gap) + gap;
        // Board shadow (right side, drawn first)
        ctx.fillStyle = '#4A2808';
        ctx.fillRect(bx + bw - 1, groundY - bh + 1, 2, bh - 1);
        // Board body
        ctx.fillStyle = '#9B6228';
        ctx.fillRect(bx, groundY - bh + 1, bw, bh - 1);
        // Board grain (subtle dark stripe)
        ctx.fillStyle = '#7A4C1A';
        ctx.fillRect(bx + 2, groundY - bh + 1, 1, bh - 1);
        // Pointed cap — 3-row pyramid
        ctx.fillStyle = '#9B6228';
        ctx.fillRect(bx + 1, groundY - bh - 2, bw - 2, 3);
        ctx.fillRect(bx + 2, groundY - bh - 5, bw - 4, 3);
        ctx.fillRect(bx + 3, groundY - bh - 7, bw - 6, 2);
        // Left highlight
        ctx.fillStyle = '#CC8A3A';
        ctx.fillRect(bx, groundY - bh + 1, 1, bh - 1);
        ctx.fillRect(bx + 1, groundY - bh - 2, 1, 3);
        // Nail bolts
        ctx.fillStyle = '#888899';
        ctx.fillRect(bx + 2, groundY - bh + 7, 2, 2);
        ctx.fillRect(bx + 2, groundY - bh + 19, 2, 2);
        // Nail highlight
        ctx.fillStyle = '#AAAACC';
        ctx.fillRect(bx + 2, groundY - bh + 7, 1, 1);
        ctx.fillRect(bx + 2, groundY - bh + 19, 1, 1);
      }
    }
  }

  _drawFgBush(ctx, x, groundY, r) {
    const ri = Math.round(r);
    // Push the bush base down so it grows out of the ground stripe
    const gy = groundY + Math.round(ri * 0.85);
    // Shadow at base
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, gy + 2, ri * 1.15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Back / outer blobs (darkest)
    ctx.fillStyle = '#145514';
    ctx.beginPath();
    ctx.ellipse(x - ri * 0.7, gy - ri * 0.5, ri * 0.75, ri * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + ri * 0.75, gy - ri * 0.55, ri * 0.72, ri * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main center body
    ctx.fillStyle = '#1A7A1A';
    ctx.beginPath();
    ctx.ellipse(x, gy - ri * 0.9, ri * 0.95, ri * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    // Upper side lobes (mid-bright)
    ctx.fillStyle = '#22922A';
    ctx.beginPath();
    ctx.ellipse(x - ri * 0.55, gy - ri * 1.15, ri * 0.65, ri * 0.58, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + ri * 0.6, gy - ri * 1.1, ri * 0.62, ri * 0.55, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Top highlight blob
    ctx.fillStyle = '#3AB83A';
    ctx.beginPath();
    ctx.ellipse(x - ri * 0.15, gy - ri * 1.55, ri * 0.42, ri * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bright specular spot
    ctx.fillStyle = '#66DD66';
    ctx.beginPath();
    ctx.ellipse(x - ri * 0.25, gy - ri * 1.72, ri * 0.18, ri * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Small berry dots (seeded by position, deterministic)
    const seed = Math.round(x * 3.7 + ri * 11.3);
    const pseudo = (n) => ((seed * 1664525 + n * 1013904223) & 0x7FFFFFFF) / 0x7FFFFFFF;
    ctx.fillStyle = '#CC2222';
    for (let i = 0; i < 3; i++) {
      const bx = x + (pseudo(i*3)   - 0.5) * ri * 1.2;
      const by = gy - ri * 0.3 - pseudo(i*3+1) * ri * 1.1;
      ctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
    }
  }

  _drawBg(ga, dt) {
    if (!this._layers) return;
    const ctx = this._ctx;
    const adv = this._scrollFrozen ? 0 : dt;
    const L = this._layers;
    if (adv > 0) {
      L.farHills.offset   = (L.farHills.offset   + L.farHills.speed   * adv) % L.farHills.W;
      L.midBushes.offset  = (L.midBushes.offset  + L.midBushes.speed  * adv) % L.midBushes.W;
      L.nearTrees.offset  = (L.nearTrees.offset  + L.nearTrees.speed  * adv) % L.nearTrees.W;
      L.clouds.offset     = (L.clouds.offset     + L.clouds.speed     * adv) % L.clouds.W;
      L.fgFences.offset   = (L.fgFences.offset   + L.fgFences.speed   * adv) % L.fgFences.W;
      L.fgBushes.offset   = (L.fgBushes.offset   + L.fgBushes.speed   * adv) % L.fgBushes.W;
    }
    // Sky gradient
    const sky = ctx.createLinearGradient(0, ga.y, 0, ga.y + ga.h);
    sky.addColorStop(0, '#050510');
    sky.addColorStop(1, '#0A1A20');
    ctx.fillStyle = sky;
    ctx.fillRect(ga.x, ga.y, ga.w, ga.h);
    this._drawFarHills(ctx, ga, L.farHills);
    this._drawMidBushes(ctx, ga, L.midBushes);
    this._drawNearTrees(ctx, ga, L.nearTrees);
    this._drawClouds(ctx, ga, L.clouds);
    this._drawGround(ctx, ga);
    this._drawFgFences(ctx, ga, L.fgFences);  // fgBushes drawn after hero via _drawFgOverlay
  }

  _drawFarHills(ctx, ga, layer) {
    const groundY = ga.y + ga.h - 28;
    for (let rep = -1; rep <= 1; rep++) {
      const ox = ga.x - layer.offset + rep * layer.W;
      const pts = layer.pts;

      // Pass 1 — dark hill mass
      ctx.fillStyle = '#1E3D1A';
      ctx.beginPath();
      ctx.moveTo(ox + pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(ox + pts[i].x, pts[i].y);
      ctx.lineTo(ox + layer.W, groundY);
      ctx.lineTo(ox, groundY);
      ctx.closePath();
      ctx.fill();

      // Pass 2 — lighter mid-green highlight band clipped to top 30px of hills
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ox + pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(ox + pts[i].x, pts[i].y);
      ctx.lineTo(ox + layer.W, groundY);
      ctx.lineTo(ox, groundY);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#3A6A30';
      // thin horizontal band along hilltops
      ctx.fillRect(ga.x - 10, layer.baseY - 70, ga.w + 20, 30);
      ctx.restore();

      // Pass 3 — mist line at base of hills (fades into sky)
      ctx.fillStyle = 'rgba(10,20,30,0.35)';
      ctx.fillRect(ga.x - 10, groundY - 40, ga.w + 20, 40);

      // Pass 4 — snow caps on tallest peaks (every 3rd point: i%3===1 is peak=55)
      ctx.fillStyle = 'rgba(210,225,255,0.88)';
      for (const pt of pts) {
        if (pt.y < layer.baseY - 40) {
          const px = Math.round(ox + pt.x);
          const py = Math.round(pt.y);
          ctx.fillRect(px - 7, py,     14, 5);
          ctx.fillRect(px - 5, py - 4, 10, 4);
          ctx.fillRect(px - 3, py - 7, 6,  3);
          ctx.fillRect(px - 1, py - 9, 2,  2);
        }
      }
    }
  }

  _drawMidBushes(ctx, ga, layer) {
    ctx.fillStyle = layer.color;
    for (let rep = -1; rep <= 1; rep++) {
      const ox = ga.x - layer.offset + rep * layer.W;
      for (const cl of layer.clusters) {
        for (const b of cl.blobs) {
          ctx.beginPath();
          ctx.ellipse(ox + cl.bx + b.dx, cl.by + b.dy, b.rx, b.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  _drawNearTrees(ctx, ga, layer) {
    for (let rep = -1; rep <= 1; rep++) {
      const ox = ga.x - layer.offset + rep * layer.W;
      for (const tr of layer.trees) {
        const bx = ox + tr.tx;
        const by = tr.groundY;
        const tw = tr.tw;    // base width unit: 14-24
        const th = tr.th;    // total height:    60-100
        const cx = Math.round(bx + tw * 0.5);

        // Trunk
        const trW = Math.max(5, Math.round(tw * 0.32));
        ctx.fillStyle = layer.trunkColor;
        ctx.fillRect(cx - Math.round(trW / 2), by - 20, trW, 20);
        // Trunk highlight
        ctx.fillStyle = '#7A4A20';
        ctx.fillRect(cx - Math.round(trW / 2), by - 20, 1, 20);

        // Pine tiers — 4 stacked triangular bough layers
        // Each tier: rows that widen from tip (top) to base (bottom)
        const tipY = by - 20 - th;
        const tierDefs = [
          { topFrac: 0.00, botFrac: 0.28, wMult: 0.55 },  // very top (narrow tip)
          { topFrac: 0.18, botFrac: 0.52, wMult: 1.00 },  // upper mid
          { topFrac: 0.40, botFrac: 0.76, wMult: 1.55 },  // lower mid
          { topFrac: 0.62, botFrac: 1.00, wMult: 2.10 },  // bottom (widest)
        ];

        for (const def of tierDefs) {
          const topY  = tipY + Math.round(def.topFrac * th);
          const botY  = tipY + Math.round(def.botFrac * th);
          const tH    = botY - topY;
          const maxW  = Math.round(tw * def.wMult);
          const steps = Math.max(3, Math.round(tH / 5));
          for (let s = 0; s < steps; s++) {
            const frac = (s + 1) / steps;  // 0..1 — narrow at top, wide at bottom
            const rW = Math.max(2, Math.round(maxW * frac));
            const rX = cx - Math.round(rW / 2);
            const rY = topY + Math.round(s * tH / steps);
            const rH = Math.ceil(tH / steps) + 1;
            // Lighter color near each tier's tip, darker toward base
            const lightFrac = 1 - frac;
            if      (lightFrac > 0.6) ctx.fillStyle = layer.crownLight;
            else if (lightFrac > 0.3) ctx.fillStyle = layer.crownMid;
            else                      ctx.fillStyle = layer.crownColor;
            ctx.fillRect(rX, rY, rW, rH);
          }
        }

        // Snow cap at very tip
        ctx.fillStyle = 'rgba(220,235,255,0.85)';
        ctx.fillRect(cx - 2, tipY,     4, 4);
        ctx.fillRect(cx - 1, tipY - 3, 2, 3);
      }
    }
  }

  _drawClouds(ctx, ga, layer) {
    for (let rep = -1; rep <= 1; rep++) {
      const ox = ga.x - layer.offset + rep * layer.W;
      for (const cl of layer.clouds) {
        const drawX = ox + cl.x;
        if (drawX + cl.rx + 40 < ga.x || drawX - cl.rx - 40 > ga.x + ga.w) continue;
        this._drawCloud(ctx, drawX, cl.y, cl.rx, cl.ry);
      }
    }
  }

  _drawCloud(ctx, cx, cy, rx, ry) {
    // Underbelly shadow
    ctx.fillStyle = 'rgba(110,140,195,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.6, rx * 0.82, ry * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main body
    ctx.fillStyle = 'rgba(190,208,238,0.88)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Left puff
    ctx.fillStyle = 'rgba(202,218,242,0.84)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.5, cy + ry * 0.1, rx * 0.5, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right puff
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.48, cy + ry * 0.14, rx * 0.46, ry * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    // Upper center (brightest)
    ctx.fillStyle = 'rgba(228,238,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.1, cy - ry * 0.2, rx * 0.58, ry * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    // Top specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.22, cy - ry * 0.42, rx * 0.3, ry * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawGround(ctx, ga) {
    const groundY = ga.y + ga.h - 28;
    const bW = 18, bH = 5, mW = 1, mH = 1;  // brick dims + mortar
    const stride = bW + mW;                   // 19px per brick slot

    // Mortar background
    ctx.fillStyle = '#2E1A06';
    ctx.fillRect(ga.x, groundY + 3, ga.w, 25);

    // Brick rows (4 rows in 25px)
    const bOff = Math.round(this._scrollX) % stride;
    for (let row = 0; row < 4; row++) {
      const rowY  = groundY + 3 + row * (bH + mH);
      const shift = (row % 2) * Math.round(bW * 0.5);
      const startX = ga.x - ((bOff + shift) % stride);
      const isTop = row === 0;
      for (let bx = startX; bx < ga.x + ga.w; bx += stride) {
        // Brick face
        ctx.fillStyle = isTop ? '#8B6218' : '#6A4A0E';
        ctx.fillRect(bx, rowY, bW, bH);
        // Top highlight
        ctx.fillStyle = isTop ? '#AA8030' : '#7A5A18';
        ctx.fillRect(bx, rowY, bW, 1);
        // Left highlight (light source from upper-left)
        ctx.fillStyle = isTop ? '#9A7020' : '#6E5010';
        ctx.fillRect(bx, rowY, 1, bH);
        // Bottom + right shadow
        ctx.fillStyle = '#3A2006';
        ctx.fillRect(bx, rowY + bH - 1, bW, 1);
        ctx.fillRect(bx + bW - 1, rowY, 1, bH);
      }
    }

    // Bottom edge
    ctx.fillStyle = '#1A0E02';
    ctx.fillRect(ga.x, groundY + 27, ga.w, 1);

    // Grass layers
    ctx.fillStyle = '#2A7A18';
    ctx.fillRect(ga.x, groundY - 1, ga.w, 4);
    ctx.fillStyle = '#3EA828';
    ctx.fillRect(ga.x, groundY - 3, ga.w, 2);
    ctx.fillStyle = '#185A0A';
    ctx.fillRect(ga.x, groundY + 2, ga.w, 1);

    // Grass tufts
    const tOff = Math.round(this._scrollX) % 14;
    ctx.fillStyle = '#185A0A';
    for (let tx = ga.x - tOff; tx < ga.x + ga.w + 2; tx += 14) {
      ctx.fillRect(tx,      groundY - 6, 1, 6);
      ctx.fillRect(tx + 4,  groundY - 4, 1, 4);
      ctx.fillRect(tx + 8,  groundY - 8, 1, 8);
      ctx.fillRect(tx + 11, groundY - 3, 1, 3);
    }
    ctx.fillStyle = '#3EA828';
    for (let tx = ga.x - tOff; tx < ga.x + ga.w + 2; tx += 14) {
      ctx.fillRect(tx,     groundY - 6, 1, 2);
      ctx.fillRect(tx + 8, groundY - 8, 1, 2);
    }
  }

  _drawHero(ctx, hero) {
    const PX = SideScrollerEffect.PX;
    const x = Math.round(hero.x);
    const y = Math.round(hero.y);
    if (hero.state === 'dying') {
      const angle = Math.min(1, hero.deadT / 0.3) * (-Math.PI / 2);
      ctx.save();
      ctx.translate(x + 3*PX, y + 5*PX);
      ctx.rotate(angle);
      ctx.translate(-(x + 3*PX), -(y + 5*PX));
      this._drawHeroBody(ctx, x, y, 'idle', 0, PX);
      ctx.restore();
      return;
    }
    if (hero.state === 'dead') return;
    this._drawHeroBody(ctx, x, y, hero.state, hero.frame, PX);
  }

  _drawHeroBody(ctx, x, y, state, frame, PX) {
    // Red cape (drawn behind body, visible on right)
    ctx.fillStyle = '#AA1100';
    ctx.fillRect(x+4*PX, y+4*PX, 2*PX, 5*PX);
    ctx.fillStyle = '#771100';
    ctx.fillRect(x+5*PX, y+4*PX, PX,   5*PX);

    // Hair
    ctx.fillStyle = _HERO_COLORS.H;
    ctx.fillRect(x+PX, y, 4*PX, PX);
    ctx.fillRect(x, y+PX, 6*PX, PX);
    // Hair highlight
    ctx.fillStyle = '#7A4A28';
    ctx.fillRect(x+PX, y, PX, PX);

    // Head (skin)
    ctx.fillStyle = _HERO_COLORS.S;
    ctx.fillRect(x+PX, y+PX, 4*PX, 3*PX);
    // Jaw/cheek shadow
    ctx.fillStyle = '#D89060';
    ctx.fillRect(x+4*PX, y+2*PX, PX, 2*PX);

    // Eyes — whites + blue iris + pupil
    ctx.fillStyle = '#EEEEEE';
    ctx.fillRect(x+2*PX, y+2*PX, PX, PX);
    ctx.fillRect(x+4*PX, y+2*PX, PX, PX);
    ctx.fillStyle = '#3366CC';
    ctx.fillRect(x+2*PX, y+2*PX+2, PX, PX-2);
    ctx.fillRect(x+4*PX, y+2*PX+2, PX, PX-2);
    ctx.fillStyle = '#0A0A22';
    ctx.fillRect(x+2*PX+1, y+3*PX, PX-2, 1);
    ctx.fillRect(x+4*PX+1, y+3*PX, PX-2, 1);

    // Tunic body
    ctx.fillStyle = _HERO_COLORS.T;
    ctx.fillRect(x+PX, y+4*PX, 4*PX, 3*PX);
    // Tunic left highlight
    ctx.fillStyle = '#3355CC';
    ctx.fillRect(x+PX, y+4*PX, PX, 3*PX);
    // Tunic right shadow
    ctx.fillStyle = '#1A3388';
    ctx.fillRect(x+4*PX, y+4*PX, PX, 3*PX);
    // Gold trim band at chest
    ctx.fillStyle = '#DDAA00';
    ctx.fillRect(x+PX, y+4*PX, 4*PX, 2);
    ctx.fillStyle = '#FFCC44';
    ctx.fillRect(x+PX, y+4*PX, 4*PX, 1);

    // Belt
    ctx.fillStyle = _HERO_COLORS.B;
    ctx.fillRect(x+PX, y+7*PX, 4*PX, PX);
    // Belt buckle
    ctx.fillStyle = '#DDAA00';
    ctx.fillRect(x+2*PX, y+7*PX, PX, PX);
    ctx.fillStyle = '#FFEE88';
    ctx.fillRect(x+2*PX, y+7*PX, PX, 2);

    // Sword
    if (state === 'slash') {
      // Blade horizontal
      ctx.fillStyle = _HERO_COLORS.W;
      ctx.fillRect(x-3*PX, y+3*PX, 4*PX, PX);
      // Blade shine
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x-3*PX, y+3*PX, 4*PX, 2);
      // Guard (crosspiece)
      ctx.fillStyle = _HERO_COLORS.X;
      ctx.fillRect(x, y+2*PX, PX, 3*PX);
      ctx.fillStyle = '#CCAA44';
      ctx.fillRect(x, y+2*PX, PX, 2);
    } else {
      // Blade vertical
      ctx.fillStyle = _HERO_COLORS.W;
      ctx.fillRect(x+5*PX, y+2*PX, PX, 4*PX);
      // Blade shine (left edge)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x+5*PX, y+2*PX, 2, 4*PX);
      // Guard crosspiece
      ctx.fillStyle = _HERO_COLORS.X;
      ctx.fillRect(x+4*PX, y+5*PX, 3*PX, PX);
      ctx.fillStyle = '#CCAA44';
      ctx.fillRect(x+4*PX, y+5*PX, 3*PX, 2);
    }

    // Pants (darker blue than tunic)
    ctx.fillStyle = '#334488';
    ctx.fillRect(x+PX,   y+8*PX, 2*PX, 2*PX);
    ctx.fillRect(x+3*PX, y+8*PX, 2*PX, 2*PX);
    // Pants highlight
    ctx.fillStyle = '#445599';
    ctx.fillRect(x+PX,   y+8*PX, PX, 2*PX);
    ctx.fillRect(x+3*PX, y+8*PX, PX, 2*PX);

    // Boots (alternating for walk)
    ctx.fillStyle = _HERO_COLORS.G;
    ctx.fillRect(x+PX,   y+9*PX + (frame===0?PX:0), 2*PX, PX);
    ctx.fillRect(x+3*PX, y+9*PX + (frame===1?PX:0), 2*PX, PX);
    // Boot top highlight
    ctx.fillStyle = '#5A3010';
    ctx.fillRect(x+PX,   y+9*PX + (frame===0?PX:0), 2*PX, 2);
    ctx.fillRect(x+3*PX, y+9*PX + (frame===1?PX:0), 2*PX, 2);
  }

  _drawEnemy(ctx, enemy) {
    if (!enemy || enemy.state === 'gone') return;
    const PX = SideScrollerEffect.PX;
    const x = Math.round(enemy.x);
    const y = Math.round(enemy.y);
    enemy.animT = (enemy.animT || 0) + 0.016;
    const frame = Math.floor(enemy.animT / 0.2) % 3;
    ctx.save();
    if (enemy.state === 'dying') {
      const tilt = Math.min(1, enemy.dyingT / 0.3) * (Math.PI / 2);
      ctx.translate(x + 4*PX, y + 4*PX);
      ctx.rotate(tilt);
      ctx.translate(-(x + 4*PX), -(y + 4*PX));
      if (enemy.dyingT > 0.65) ctx.globalAlpha = Math.floor(enemy.dyingT / 0.15) % 2 === 0 ? 1.0 : 0.25;
      if (enemy.dyingT > 1.05) { enemy.state = 'gone'; ctx.restore(); return; }
    }
    // Ground shadow for non-flying enemies
    if (!{ harpy:1, imp:1 }[enemy.type] && enemy.state !== 'dying') {
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(x + 4*PX, this._groundY + 3, 4*PX, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (enemy.flashT > 0) ctx.filter = 'brightness(10)';
    this[`_drawEnemy_${enemy.type}`]?.(ctx, x, y, frame, PX);
    ctx.filter = 'none';
    ctx.restore();
  }

  _drawEnemy_goblin(ctx, x, y, frame, PX) {
    const C = _ENEMY_COLORS.goblin;
    const lo = frame % 2;
    // Spear shaft
    ctx.fillStyle = C.spear;
    ctx.fillRect(x-6*PX, y+3*PX, 8*PX, PX);
    // Shaft highlight
    ctx.fillStyle = '#DDBB77';
    ctx.fillRect(x-6*PX, y+3*PX, 8*PX, 1);
    // Spear tip (metal, two-tone)
    ctx.fillStyle = '#CCCCDD';
    ctx.fillRect(x-7*PX, y+2*PX, PX, 3*PX);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x-7*PX, y+2*PX, PX, 1);
    // Big pointy ears
    ctx.fillStyle = C.body;
    ctx.fillRect(x-PX,   y+PX, 2*PX, 3*PX);
    ctx.fillRect(x+6*PX, y+PX, 2*PX, 3*PX);
    // Ear shadow
    ctx.fillStyle = C.dark;
    ctx.fillRect(x,      y+PX, 1, 3*PX);
    ctx.fillRect(x+7*PX, y+PX, 1, 3*PX);
    // Head
    ctx.fillStyle = C.body;
    ctx.fillRect(x,      y+PX, 7*PX, 4*PX);
    // Head left highlight
    ctx.fillStyle = '#66CC44';
    ctx.fillRect(x,      y+PX, PX, 4*PX);
    // Mean brows
    ctx.fillStyle = C.dark;
    ctx.fillRect(x+PX,   y+PX,   2*PX, PX);
    ctx.fillRect(x+4*PX, y+PX,   2*PX, PX);
    // Eyes (glow)
    ctx.fillStyle = C.eye;
    ctx.fillRect(x+PX,   y+2*PX, PX, PX);
    ctx.fillRect(x+4*PX, y+2*PX, PX, PX);
    // Eye highlight dot
    ctx.fillStyle = '#FFCC44';
    ctx.fillRect(x+PX,   y+2*PX, 2, 2);
    ctx.fillRect(x+4*PX, y+2*PX, 2, 2);
    // Brown vest/torso
    ctx.fillStyle = C.cloth;
    ctx.fillRect(x,      y+5*PX, PX,   2*PX);
    ctx.fillRect(x+PX,   y+5*PX, 5*PX, 3*PX);
    // Vest left highlight
    ctx.fillStyle = '#AA7744';
    ctx.fillRect(x+PX,   y+5*PX, PX, 3*PX);
    // Vest button/stitch
    ctx.fillStyle = '#CC9966';
    ctx.fillRect(x+3*PX, y+6*PX, 1, PX);
    // Legs
    ctx.fillStyle = C.body;
    ctx.fillRect(x+PX,   y+8*PX+(lo?PX:0), 2*PX, 2*PX);
    ctx.fillRect(x+4*PX, y+8*PX+(lo?0:PX), 2*PX, 2*PX);
    // Leg highlight
    ctx.fillStyle = '#66CC44';
    ctx.fillRect(x+PX,   y+8*PX+(lo?PX:0), PX, 2*PX);
    ctx.fillRect(x+4*PX, y+8*PX+(lo?0:PX), PX, 2*PX);
  }

  _drawEnemy_slime(ctx, x, y, frame, PX) {
    const C = _ENEMY_COLORS.slime;
    const bob = Math.round(Math.sin(Date.now() / 200) * 1.5);
    const yy = y + bob;
    // Shadow beneath (dark green at base)
    ctx.fillStyle = '#0A4A0A';
    ctx.fillRect(x+PX,   yy+5*PX, 7*PX, PX);
    ctx.fillRect(x+2*PX, yy+6*PX, 5*PX, PX);
    // Wide flat oval body
    ctx.fillStyle = C.body;
    ctx.fillRect(x+2*PX, yy,       5*PX, PX);
    ctx.fillRect(x+PX,   yy+PX,    7*PX, PX);
    ctx.fillRect(x,      yy+2*PX,  9*PX, 3*PX);
    ctx.fillRect(x+PX,   yy+5*PX,  7*PX, PX);
    ctx.fillRect(x+2*PX, yy+6*PX,  5*PX, PX);
    // Left/right side shading
    ctx.fillStyle = '#148814';
    ctx.fillRect(x,      yy+2*PX, PX,   3*PX);
    ctx.fillRect(x+8*PX, yy+2*PX, PX,   3*PX);
    // Primary highlight blob
    ctx.fillStyle = C.shine;
    ctx.fillRect(x+2*PX, yy+PX, 3*PX, 2*PX);
    // Secondary smaller highlight
    ctx.fillStyle = '#AAFFAA';
    ctx.fillRect(x+2*PX, yy+PX, 2*PX, PX);
    // Drip/tendril at bottom center
    ctx.fillStyle = C.body;
    ctx.fillRect(x+4*PX, yy+7*PX, PX, PX);
    // Sleepy line eyes
    ctx.fillStyle = '#111111';
    ctx.fillRect(x+PX,   yy+3*PX, 2*PX, PX);
    ctx.fillRect(x+5*PX, yy+3*PX, 2*PX, PX);
    // Eye highlight
    ctx.fillStyle = '#555566';
    ctx.fillRect(x+PX,   yy+3*PX, PX, 1);
    ctx.fillRect(x+5*PX, yy+3*PX, PX, 1);
    // Rosy cheeks
    ctx.fillStyle = '#FF9999';
    ctx.fillRect(x+PX,   yy+4*PX, PX, PX);
    ctx.fillRect(x+6*PX, yy+4*PX, PX, PX);
    // Mouth (small curve)
    ctx.fillStyle = '#0A5A0A';
    ctx.fillRect(x+3*PX, yy+4*PX, 3*PX, 1);
  }

  _drawEnemy_harpy(ctx, x, y, frame, PX) {
    const C = _ENEMY_COLORS.harpy;
    const wo = frame===0 ? -PX : frame===1 ? 0 : PX;
    // Outer wings (dark)
    ctx.fillStyle = C.wingDark;
    ctx.fillRect(x-5*PX, y+2*PX+wo, 5*PX, 5*PX);
    ctx.fillRect(x+8*PX, y+2*PX+wo, 5*PX, 5*PX);
    ctx.fillRect(x-4*PX, y+7*PX+wo, 4*PX, 2*PX);
    ctx.fillRect(x+8*PX, y+7*PX+wo, 4*PX, 2*PX);
    // Wing feather lines (darker stripes on outer wings)
    ctx.fillStyle = '#771199';
    ctx.fillRect(x-5*PX, y+3*PX+wo, 5*PX, 1);
    ctx.fillRect(x-5*PX, y+5*PX+wo, 5*PX, 1);
    ctx.fillRect(x+8*PX, y+3*PX+wo, 5*PX, 1);
    ctx.fillRect(x+8*PX, y+5*PX+wo, 5*PX, 1);
    // Inner wings (lighter)
    ctx.fillStyle = C.wing;
    ctx.fillRect(x-2*PX, y+2*PX+wo, 4*PX, 6*PX);
    ctx.fillRect(x+6*PX, y+2*PX+wo, 4*PX, 6*PX);
    // Inner wing highlight
    ctx.fillStyle = '#EEA8FF';
    ctx.fillRect(x-2*PX, y+2*PX+wo, PX, 6*PX);
    ctx.fillRect(x+9*PX, y+2*PX+wo, PX, 6*PX);
    // Poofy teal hair
    ctx.fillStyle = C.hair;
    ctx.fillRect(x+PX,   y-PX,  5*PX, 2*PX);
    ctx.fillRect(x,      y,     2*PX, PX);
    ctx.fillRect(x+5*PX, y,     2*PX, PX);
    // Hair highlight
    ctx.fillStyle = '#88FFDD';
    ctx.fillRect(x+2*PX, y-PX, 2*PX, PX);
    // Face
    ctx.fillStyle = C.skin;
    ctx.fillRect(x+PX, y+PX, 5*PX, 3*PX);
    // Face shadow right
    ctx.fillStyle = '#E8A888';
    ctx.fillRect(x+5*PX, y+2*PX, PX, 2*PX);
    // Eyes (magenta)
    ctx.fillStyle = C.eye;
    ctx.fillRect(x+2*PX, y+2*PX, PX, PX);
    ctx.fillRect(x+4*PX, y+2*PX, PX, PX);
    // Eye highlight
    ctx.fillStyle = '#FF88CC';
    ctx.fillRect(x+2*PX, y+2*PX, 2, 2);
    ctx.fillRect(x+4*PX, y+2*PX, 2, 2);
    // Torso
    ctx.fillStyle = C.body;
    ctx.fillRect(x+PX, y+4*PX, 5*PX, 4*PX);
    // Torso highlight
    ctx.fillStyle = '#FFCCEE';
    ctx.fillRect(x+PX, y+4*PX, 2*PX, 4*PX);
    // Torso shadow
    ctx.fillStyle = '#CC8899';
    ctx.fillRect(x+5*PX, y+4*PX, PX, 4*PX);
    // Talons
    ctx.fillStyle = C.talon;
    ctx.fillRect(x+PX,   y+8*PX, 2*PX, 2*PX);
    ctx.fillRect(x+4*PX, y+8*PX, 2*PX, 2*PX);
    ctx.fillRect(x,      y+9*PX, 2*PX, PX);
    ctx.fillRect(x+2*PX, y+9*PX, 2*PX, PX);
    ctx.fillRect(x+4*PX, y+9*PX, 2*PX, PX);
    ctx.fillRect(x+6*PX, y+9*PX, PX,   PX);
    // Talon highlight
    ctx.fillStyle = '#FFDD66';
    ctx.fillRect(x,      y+9*PX, PX, 1);
    ctx.fillRect(x+4*PX, y+9*PX, PX, 1);
  }

  _drawEnemy_wolf(ctx, x, y, frame, PX) {
    const C = _ENEMY_COLORS.wolf;
    const lo = frame % 2;
    // Tail
    ctx.fillStyle = C.body;
    ctx.fillRect(x+9*PX,  y+PX, 2*PX, PX);
    ctx.fillRect(x+10*PX, y,    PX,   2*PX);
    // Tail tip (lighter)
    ctx.fillStyle = '#3A4060';
    ctx.fillRect(x+10*PX, y, PX, PX);
    // Pointy ears
    ctx.fillStyle = C.body;
    ctx.fillRect(x+PX,   y,    PX, 2*PX);
    ctx.fillRect(x+3*PX, y,    PX, PX);
    // Ear inner (pink)
    ctx.fillStyle = '#440022';
    ctx.fillRect(x+PX,   y, PX, PX);
    // Head (facing left)
    ctx.fillStyle = C.body;
    ctx.fillRect(x,      y+PX, 5*PX, 4*PX);
    // Head top highlight
    ctx.fillStyle = '#2A3050';
    ctx.fillRect(x,      y+PX, 5*PX, PX);
    // Snout
    ctx.fillStyle = C.snout;
    ctx.fillRect(x-PX,   y+3*PX, 2*PX, 2*PX);
    // Nostril
    ctx.fillStyle = '#0A0A14';
    ctx.fillRect(x-PX,   y+4*PX, PX, 1);
    // Red glowing eye
    ctx.fillStyle = C.eye;
    ctx.fillRect(x+PX,   y+2*PX, PX, PX);
    // Eye glow corona
    ctx.fillStyle = '#FF6666';
    ctx.fillRect(x+PX,   y+2*PX, 2, 2);
    // Body
    ctx.fillStyle = C.body;
    ctx.fillRect(x+3*PX, y+2*PX, 8*PX, 4*PX);
    // Back highlight stripe
    ctx.fillStyle = '#2A3050';
    ctx.fillRect(x+3*PX, y+2*PX, 8*PX, PX);
    // Saddle
    ctx.fillStyle = C.saddle;
    ctx.fillRect(x+4*PX, y+2*PX, 5*PX, 2*PX);
    // Saddle highlight
    ctx.fillStyle = '#3A4050';
    ctx.fillRect(x+4*PX, y+2*PX, 5*PX, 1);
    // 4 legs alternating
    ctx.fillStyle = C.body;
    ctx.fillRect(x+PX,   y+6*PX+(lo?PX:0), 2*PX, 2*PX);
    ctx.fillRect(x+3*PX, y+6*PX+(lo?0:PX), 2*PX, 2*PX);
    ctx.fillRect(x+7*PX, y+6*PX+(lo?PX:0), 2*PX, 2*PX);
    ctx.fillRect(x+9*PX, y+6*PX+(lo?0:PX), 2*PX, 2*PX);
    // Paw tips (lighter)
    ctx.fillStyle = '#2A3050';
    ctx.fillRect(x+PX,   y+7*PX+(lo?PX:0), 2*PX, PX);
    ctx.fillRect(x+7*PX, y+7*PX+(lo?PX:0), 2*PX, PX);
  }

  _drawEnemy_imp(ctx, x, y, frame, PX) {
    const C = _ENEMY_COLORS.imp;
    const wo = frame===0 ? -PX : frame===1 ? 0 : PX;
    const lo = frame % 2;
    // Trident shaft + highlight
    ctx.fillStyle = C.trident;
    ctx.fillRect(x-7*PX, y+4*PX, 8*PX, PX);
    ctx.fillStyle = '#EEDD44';
    ctx.fillRect(x-7*PX, y+4*PX, 8*PX, 1);
    // Center prong
    ctx.fillStyle = C.trident;
    ctx.fillRect(x-8*PX, y+3*PX, PX,   3*PX);
    ctx.fillRect(x-8*PX, y+3*PX, 3*PX, PX);   // top fork
    ctx.fillRect(x-8*PX, y+5*PX, 3*PX, PX);   // bottom fork
    // Prong tips shine
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x-8*PX, y+3*PX, PX, 1);
    ctx.fillRect(x-8*PX, y+5*PX, PX, 1);
    ctx.fillRect(x-8*PX, y+3*PX, 1, PX);
    // Bat wings (flutter)
    ctx.fillStyle = C.wing;
    ctx.fillRect(x-2*PX, y+3*PX+wo, 2*PX, 3*PX);
    ctx.fillRect(x+5*PX, y+3*PX+wo, 2*PX, 3*PX);
    // Wing vein lines
    ctx.fillStyle = '#AA0022';
    ctx.fillRect(x-PX,   y+3*PX+wo, 1, 3*PX);
    ctx.fillRect(x+5*PX, y+3*PX+wo, 1, 3*PX);
    // Wing highlight edge
    ctx.fillStyle = '#BB2233';
    ctx.fillRect(x-2*PX, y+3*PX+wo, PX, 3*PX);
    // Tail
    ctx.fillStyle = C.body;
    ctx.fillRect(x+4*PX, y+8*PX,  PX, 3*PX);
    ctx.fillRect(x+3*PX, y+10*PX, 3*PX, PX);
    ctx.fillRect(x+4*PX, y+11*PX, PX,   PX);
    // Horns
    ctx.fillStyle = C.horn;
    ctx.fillRect(x+PX,   y-PX, PX, 2*PX);
    ctx.fillRect(x+3*PX, y-PX, PX, 2*PX);
    // Horn tips
    ctx.fillStyle = '#990033';
    ctx.fillRect(x+PX,   y-PX, PX, 1);
    ctx.fillRect(x+3*PX, y-PX, PX, 1);
    // Head
    ctx.fillStyle = C.body;
    ctx.fillRect(x,      y+PX, 5*PX, 3*PX);
    // Head left highlight
    ctx.fillStyle = '#EE7766';
    ctx.fillRect(x,      y+PX, PX, 3*PX);
    // Head right shadow
    ctx.fillStyle = '#AA3322';
    ctx.fillRect(x+4*PX, y+PX, PX, 3*PX);
    // Eyes (yellow glow)
    ctx.fillStyle = C.eye;
    ctx.fillRect(x+PX,   y+2*PX, PX, PX);
    ctx.fillRect(x+3*PX, y+2*PX, PX, PX);
    // Eye shine
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x+PX,   y+2*PX, 2, 2);
    ctx.fillRect(x+3*PX, y+2*PX, 2, 2);
    // Torso + arms
    ctx.fillStyle = C.body;
    ctx.fillRect(x+PX,   y+4*PX, 3*PX, 4*PX);
    ctx.fillStyle = '#EE7766';
    ctx.fillRect(x+PX,   y+4*PX, PX,   4*PX);  // torso left highlight
    ctx.fillStyle = C.body;
    ctx.fillRect(x,      y+4*PX, PX,   2*PX);
    ctx.fillRect(x+4*PX, y+4*PX, PX,   2*PX);
    // Legs
    ctx.fillStyle = C.body;
    ctx.fillRect(x+PX,   y+8*PX+(lo?PX:0), PX, 3*PX);
    ctx.fillRect(x+3*PX, y+8*PX+(lo?0:PX), PX, 3*PX);
    // Hoof/foot
    ctx.fillStyle = '#660022';
    ctx.fillRect(x+PX,   y+10*PX+(lo?PX:0), PX, PX);
    ctx.fillRect(x+3*PX, y+10*PX+(lo?0:PX), PX, PX);
  }

  _drawEnemy_boar(ctx, x, y, frame, PX) {
    const C = _ENEMY_COLORS.boar;
    const lo = frame % 2;
    // Dark bristle mane (spiky top)
    ctx.fillStyle = C.mane;
    ctx.fillRect(x+PX,   y,    8*PX, PX);
    // Mane spikes (individual tufts)
    ctx.fillRect(x+2*PX, y-PX, PX, PX);
    ctx.fillRect(x+4*PX, y-PX, PX, PX);
    ctx.fillRect(x+6*PX, y-PX, PX, PX);
    // Main chunky body
    ctx.fillStyle = C.body;
    ctx.fillRect(x,      y+PX,  10*PX, 4*PX);
    ctx.fillRect(x+PX,   y+5*PX, 8*PX, PX);
    // Body top highlight (just below mane)
    ctx.fillStyle = '#DD7744';
    ctx.fillRect(x,      y+PX,  10*PX, PX);
    // Body right shadow
    ctx.fillStyle = '#AA4422';
    ctx.fillRect(x+9*PX, y+PX,  PX,   4*PX);
    // Light underbelly
    ctx.fillStyle = C.light;
    ctx.fillRect(x+3*PX, y+2*PX, 5*PX, 2*PX);
    // Underbelly highlight
    ctx.fillStyle = '#FFCC88';
    ctx.fillRect(x+3*PX, y+2*PX, 5*PX, PX);
    // Eye
    ctx.fillStyle = C.eye;
    ctx.fillRect(x+PX,  y+2*PX, 2*PX, 2*PX);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x+PX,  y+2*PX, PX, PX);
    // Snout
    ctx.fillStyle = C.snout;
    ctx.fillRect(x-2*PX, y+2*PX, 3*PX, 2*PX);
    // Snout highlight
    ctx.fillStyle = '#EECCAA';
    ctx.fillRect(x-2*PX, y+2*PX, 3*PX, PX);
    // Nostril
    ctx.fillStyle = '#885544';
    ctx.fillRect(x-2*PX, y+3*PX, PX, PX);
    // Tusk
    ctx.fillStyle = C.tusk;
    ctx.fillRect(x-3*PX, y+4*PX, 3*PX, PX);
    ctx.fillRect(x-4*PX, y+3*PX, PX,   2*PX);
    ctx.fillStyle = '#FFFFEE';
    ctx.fillRect(x-3*PX, y+4*PX, 3*PX, 1);
    // 4 legs
    ctx.fillStyle = C.body;
    ctx.fillRect(x+2*PX, y+6*PX+(lo?PX:0), 2*PX, 2*PX);
    ctx.fillRect(x+4*PX, y+6*PX+(lo?0:PX), 2*PX, 2*PX);
    ctx.fillRect(x+6*PX, y+6*PX+(lo?PX:0), 2*PX, 2*PX);
    ctx.fillRect(x+8*PX, y+6*PX+(lo?0:PX), 2*PX, 2*PX);
    // Hoof tips
    ctx.fillStyle = '#441100';
    ctx.fillRect(x+2*PX, y+7*PX+(lo?PX:0), 2*PX, PX);
    ctx.fillRect(x+6*PX, y+7*PX+(lo?PX:0), 2*PX, PX);
  }

  _drawEnemy_mimic(ctx, x, y, frame, PX) {
    const C = _ENEMY_COLORS.mimic;
    const gap = frame * PX;
    // Lid (top jaw) with gold trim + highlight
    ctx.fillStyle = C.goldTrim; ctx.fillRect(x, y, 9*PX, PX);
    ctx.fillStyle = '#FFDD44';  ctx.fillRect(x, y, 9*PX, 2);  // trim highlight
    ctx.fillStyle = C.lid;      ctx.fillRect(x, y+PX, 9*PX, PX);
    // Lid wood grain
    ctx.fillStyle = '#5A2A08';
    ctx.fillRect(x+2*PX, y+PX, 1, PX);
    ctx.fillRect(x+5*PX, y+PX, 1, PX);
    ctx.fillRect(x+7*PX, y+PX, 1, PX);
    if (gap > 0) {
      // Dark mouth interior
      ctx.fillStyle = '#050508';
      ctx.fillRect(x+PX, y+2*PX, 7*PX, gap);
      // Tongue glow (even when partially open)
      if (frame >= 1) {
        ctx.fillStyle = '#CC1133';
        ctx.fillRect(x+3*PX, y+2*PX+gap-2, 3*PX, 2);
      }
      // Upper teeth
      ctx.fillStyle = C.teeth;
      for (let t = 0; t < 4; t++) ctx.fillRect(x+(t*2+1)*PX, y+2*PX, PX, gap);
      // Glowing eyes in darkness
      ctx.fillStyle = C.eye;
      ctx.fillRect(x+2*PX, y+2*PX, PX, PX);
      ctx.fillRect(x+5*PX, y+2*PX, PX, PX);
      // Eye glow halo
      ctx.fillStyle = '#FF8844';
      ctx.fillRect(x+2*PX, y+2*PX, 2, 2);
      ctx.fillRect(x+5*PX, y+2*PX, 2, 2);
      // Lower teeth
      ctx.fillStyle = C.teeth;
      for (let t = 0; t < 4; t++) ctx.fillRect(x+(t*2+1)*PX, y+2*PX+gap, PX, PX);
      if (frame === 2) {
        ctx.fillStyle = '#EE2244';
        ctx.fillRect(x+3*PX, y+2*PX+gap, 3*PX, PX);
        // Tongue highlight
        ctx.fillStyle = '#FF6677';
        ctx.fillRect(x+3*PX, y+2*PX+gap, 3*PX, 1);
      }
    }
    // Chest base
    const bY = y + 2*PX + gap + (gap > 0 ? PX : 0);
    ctx.fillStyle = C.goldTrim; ctx.fillRect(x, bY, 9*PX, PX);
    ctx.fillStyle = '#FFDD44';  ctx.fillRect(x, bY, 9*PX, 2);
    ctx.fillStyle = C.box;      ctx.fillRect(x, bY+PX, 9*PX, y+8*PX-(bY+PX));
    // Wood grain on body
    ctx.fillStyle = '#7A3A10';
    ctx.fillRect(x+2*PX, bY+PX, 1, y+8*PX-(bY+PX));
    ctx.fillRect(x+5*PX, bY+PX, 1, y+8*PX-(bY+PX));
    ctx.fillRect(x+7*PX, bY+PX, 1, y+8*PX-(bY+PX));
    // Left highlight on chest
    ctx.fillStyle = '#AA6030';
    ctx.fillRect(x, bY+PX, PX, y+8*PX-(bY+PX));
    ctx.fillStyle = C.goldTrim; ctx.fillRect(x, y+8*PX, 9*PX, PX);
    ctx.fillStyle = '#FFDD44';  ctx.fillRect(x, y+8*PX, 9*PX, 2);
    ctx.fillStyle = C.lock;     ctx.fillRect(x+4*PX, bY+PX, PX, PX);
    // Lock shine
    ctx.fillStyle = '#FFEE88';  ctx.fillRect(x+4*PX, bY+PX, 2, 2);
    // Legs
    ctx.fillStyle = C.leg;
    ctx.fillRect(x+PX,   y+9*PX, 2*PX, PX);
    ctx.fillRect(x+6*PX, y+9*PX, 2*PX, PX);
    // Leg highlight
    ctx.fillStyle = '#CC7730';
    ctx.fillRect(x+PX,   y+9*PX, PX, PX);
    ctx.fillRect(x+6*PX, y+9*PX, PX, PX);
  }

  _drawBoss(ctx, boss) {
    if (!boss) return;
    const PX = SideScrollerEffect.PX;
    const x = Math.round(boss.x);
    const y = Math.round(boss.y + (boss.bobOffset || 0));
    const jx = boss.roaring ? (Math.random() * 4 - 2) : 0;
    ctx.save();
    ctx.translate(jx, 0);
    this[`_drawBoss_${boss.type}`]?.(ctx, x, y, boss.state, PX);
    ctx.restore();
  }

  _drawBoss_orc(ctx, x, y, state, PX) {
    const C = _BOSS_COLORS.orc;
    // Golden nub horns
    ctx.fillStyle = C.horn;
    ctx.fillRect(x+2*PX, y,    2*PX, 2*PX);
    ctx.fillRect(x+7*PX, y,    2*PX, 2*PX);
    // Horn highlight
    ctx.fillStyle = '#FFEE66';
    ctx.fillRect(x+2*PX, y,    PX, PX);
    ctx.fillRect(x+7*PX, y,    PX, PX);
    // Big round head + puffy cheeks
    ctx.fillStyle = C.body;
    ctx.fillRect(x+PX,   y+PX,  9*PX, 2*PX);   // upper head
    ctx.fillRect(x,      y+3*PX, 11*PX, 3*PX);  // wide cheeks
    // Head left highlight
    ctx.fillStyle = '#5AAA2A';
    ctx.fillRect(x+PX, y+PX,   PX, 4*PX);
    ctx.fillRect(x,    y+3*PX, PX, 3*PX);
    // Head right shadow
    ctx.fillStyle = '#326416';
    ctx.fillRect(x+9*PX,  y+PX,   PX, 2*PX);
    ctx.fillRect(x+10*PX, y+3*PX, PX, 3*PX);
    // Brow ridges above eyes (draw before eyes so eyes override)
    ctx.fillStyle = '#2A5510';
    ctx.fillRect(x+2*PX, y+PX,   3*PX, PX);    // left brow
    ctx.fillRect(x+7*PX, y+PX,   3*PX, PX);    // right brow
    // Yellow eyes (squinting)
    ctx.fillStyle = C.eye;
    ctx.fillRect(x+2*PX, y+2*PX, 2*PX, PX);
    ctx.fillRect(x+7*PX, y+2*PX, 2*PX, PX);
    // Eye pupils
    ctx.fillStyle = '#221100';
    ctx.fillRect(x+3*PX, y+2*PX, PX, PX);
    ctx.fillRect(x+8*PX, y+2*PX, PX, PX);
    // Tusks
    ctx.fillStyle = C.tusk;
    ctx.fillRect(x+2*PX, y+5*PX, PX, 2*PX);
    ctx.fillRect(x+8*PX, y+5*PX, PX, 2*PX);
    // Tusk highlight
    ctx.fillStyle = '#FFFFCC';
    ctx.fillRect(x+2*PX, y+5*PX, PX, PX);
    ctx.fillRect(x+8*PX, y+5*PX, PX, PX);
    // Chin / jaw shadow
    ctx.fillStyle = '#326416';
    ctx.fillRect(x+PX, y+5*PX, 9*PX, PX);
    // Open mouth on roar
    if (state === 'roar') {
      ctx.fillStyle = C.mouth;
      ctx.fillRect(x+3*PX, y+4*PX, 5*PX, 2*PX);
      // Roar teeth
      ctx.fillStyle = '#FFFCE8';
      ctx.fillRect(x+3*PX, y+4*PX, PX, PX);
      ctx.fillRect(x+5*PX, y+4*PX, PX, PX);
      ctx.fillRect(x+7*PX, y+4*PX, PX, PX);
    }
    // Massive shoulders
    ctx.fillStyle = C.body;
    ctx.fillRect(x-PX,   y+6*PX,  13*PX, 2*PX);  // shoulder span
    ctx.fillRect(x+PX,   y+8*PX,  9*PX,  3*PX);  // torso
    // Shoulder left highlight
    ctx.fillStyle = '#5AAA2A';
    ctx.fillRect(x-PX,   y+6*PX,  PX, 2*PX);
    ctx.fillRect(x,      y+6*PX,  2*PX, PX);
    // Shoulder right shadow
    ctx.fillStyle = '#326416';
    ctx.fillRect(x+11*PX, y+6*PX, PX, 2*PX);
    // Torso left highlight / right shadow
    ctx.fillStyle = '#5AAA2A';
    ctx.fillRect(x+PX, y+8*PX, PX, 3*PX);
    ctx.fillStyle = '#326416';
    ctx.fillRect(x+9*PX, y+8*PX, PX, 3*PX);
    // Armor chest
    ctx.fillStyle = C.armor;
    ctx.fillRect(x+2*PX, y+6*PX, 7*PX, 3*PX);
    // Armor left highlight band
    ctx.fillStyle = '#7A9966';
    ctx.fillRect(x+2*PX, y+6*PX, PX, 3*PX);
    // Armor right shadow band
    ctx.fillStyle = '#4A5540';
    ctx.fillRect(x+8*PX, y+6*PX, PX, 3*PX);
    // Armor rivets
    ctx.fillStyle = '#AABB88';
    ctx.fillRect(x+3*PX, y+7*PX, PX, PX);
    ctx.fillRect(x+6*PX, y+7*PX, PX, PX);
    // Arms
    ctx.fillStyle = C.body;
    if (state === 'swipe') {
      ctx.fillRect(x-5*PX, y+6*PX, 6*PX, 3*PX);  // left arm lunge
      ctx.fillRect(x-6*PX, y+7*PX, 2*PX, 3*PX);  // fist
      // Arm top highlight
      ctx.fillStyle = '#5AAA2A';
      ctx.fillRect(x-5*PX, y+6*PX, 6*PX, PX);
      ctx.fillStyle = C.body;
    } else {
      ctx.fillRect(x-2*PX, y+6*PX, 3*PX, 3*PX);
      ctx.fillRect(x-3*PX, y+7*PX, 2*PX, 3*PX);
      // Arm left highlight
      ctx.fillStyle = '#5AAA2A';
      ctx.fillRect(x-2*PX, y+6*PX, PX, 3*PX);
      ctx.fillStyle = C.body;
    }
    ctx.fillRect(x+11*PX, y+6*PX, 3*PX, 3*PX);   // right arm
    ctx.fillRect(x+13*PX, y+7*PX, 2*PX, 3*PX);   // right hand
    // Right arm shadow
    ctx.fillStyle = '#326416';
    ctx.fillRect(x+13*PX, y+6*PX, PX, 3*PX);
    // Legs
    ctx.fillStyle = C.body;
    ctx.fillRect(x+2*PX,  y+11*PX, 3*PX, 3*PX);
    ctx.fillRect(x+6*PX,  y+11*PX, 3*PX, 3*PX);
    // Leg left highlights
    ctx.fillStyle = '#5AAA2A';
    ctx.fillRect(x+2*PX, y+11*PX, PX, 3*PX);
    ctx.fillRect(x+6*PX, y+11*PX, PX, 3*PX);
    // Boots
    ctx.fillStyle = C.boot;
    ctx.fillRect(x+PX,    y+13*PX, 4*PX, PX);
    ctx.fillRect(x+6*PX,  y+13*PX, 4*PX, PX);
    // Boot toe highlight
    ctx.fillStyle = '#554422';
    ctx.fillRect(x+PX,   y+13*PX, 2*PX, PX);
    ctx.fillRect(x+6*PX, y+13*PX, 2*PX, PX);
  }

  _drawBoss_blob(ctx, x, y, state, PX) {
    const C = _BOSS_COLORS.blob;
    // Main yellow body — round blob
    ctx.fillStyle = C.body;
    ctx.fillRect(x+3*PX, y,       8*PX, PX);    // head top
    ctx.fillRect(x+PX,   y+PX,    12*PX, 2*PX); // upper head
    ctx.fillRect(x,      y+3*PX,  14*PX, 6*PX); // widest body
    ctx.fillRect(x+PX,   y+9*PX,  12*PX, 2*PX); // lower body
    ctx.fillRect(x+2*PX, y+11*PX, 10*PX, PX);   // waist
    // Right-side shadow
    ctx.fillStyle = '#CC9900';
    ctx.fillRect(x+11*PX, y+3*PX,  3*PX, 6*PX);  // right body edge
    ctx.fillRect(x+10*PX, y+PX,    2*PX, 2*PX);  // upper right
    ctx.fillRect(x+10*PX, y+9*PX,  3*PX, 2*PX);  // lower right taper
    // Underside shadow
    ctx.fillStyle = '#AA7700';
    ctx.fillRect(x+3*PX, y+10*PX, 8*PX, PX);
    // Left-side highlight
    ctx.fillStyle = '#FFE066';
    ctx.fillRect(x,    y+3*PX, 2*PX, 5*PX);
    ctx.fillRect(x+PX, y+PX,   2*PX, 2*PX);
    // Top shine + specular
    ctx.fillStyle = C.shine;
    ctx.fillRect(x+3*PX, y+PX, 4*PX, 2*PX);
    ctx.fillRect(x+4*PX, y,    2*PX, PX);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x+4*PX, y+PX, 2*PX, PX);        // white specular streak
    // ── Single large eye (center-left of face) ──
    const ex = x+5*PX, ey = y+3*PX;
    ctx.fillStyle = C.eyeOuter;
    ctx.fillRect(ex,      ey,      5*PX, 4*PX);   // dark ring
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(ex+PX,   ey+PX,   3*PX, 2*PX);   // sclera
    ctx.fillStyle = C.eyeRed;
    ctx.fillRect(ex+PX,   ey+PX,   2*PX, 2*PX);   // red iris
    ctx.fillStyle = '#000000';
    ctx.fillRect(ex+PX+2, ey+PX+1, PX-2, PX-2);   // pupil
    // Eye inner highlight dot
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(ex+PX, ey+PX, 2, 2);
    // Arms
    ctx.fillStyle = C.body;
    if (state === 'swipe') {
      ctx.fillRect(x-6*PX, y+4*PX, 7*PX, 4*PX);  // left arm extended
      ctx.fillRect(x-7*PX, y+4*PX, 2*PX, 5*PX);  // claw
      // Arm top highlight
      ctx.fillStyle = '#FFE066';
      ctx.fillRect(x-6*PX, y+4*PX, 7*PX, PX);
      // Claw drip
      ctx.fillStyle = '#CC9900';
      ctx.fillRect(x-7*PX, y+8*PX, PX, PX);
      ctx.fillRect(x-6*PX, y+9*PX, PX, PX);
    } else {
      ctx.fillRect(x-3*PX, y+4*PX, 4*PX, 4*PX);  // left arm tucked
      ctx.fillRect(x-4*PX, y+6*PX, 2*PX, 3*PX);  // hand
      // Arm left highlight
      ctx.fillStyle = '#FFE066';
      ctx.fillRect(x-3*PX, y+4*PX, PX, 4*PX);
      // Arm right shadow
      ctx.fillStyle = '#CC9900';
      ctx.fillRect(x+PX,   y+4*PX, PX, 4*PX);
      // Drip from hand
      ctx.fillStyle = '#CC9900';
      ctx.fillRect(x-4*PX, y+9*PX, PX, PX);
    }
    ctx.fillStyle = C.body;
    ctx.fillRect(x+14*PX, y+4*PX, 3*PX, 4*PX);   // right arm
    ctx.fillRect(x+17*PX, y+6*PX, 2*PX, 3*PX);   // right hand
    // Right arm shadow
    ctx.fillStyle = '#CC9900';
    ctx.fillRect(x+16*PX, y+4*PX, PX, 4*PX);
    // Short legs
    ctx.fillStyle = C.body;
    ctx.fillRect(x+3*PX,  y+12*PX, 3*PX, 3*PX);
    ctx.fillRect(x+8*PX,  y+12*PX, 3*PX, 3*PX);
    // Leg left highlights
    ctx.fillStyle = '#FFE066';
    ctx.fillRect(x+3*PX,  y+12*PX, PX, 3*PX);
    ctx.fillRect(x+8*PX,  y+12*PX, PX, 3*PX);
    // Leg bottom shadows
    ctx.fillStyle = '#AA7700';
    ctx.fillRect(x+3*PX,  y+14*PX, 3*PX, PX);
    ctx.fillRect(x+8*PX,  y+14*PX, 3*PX, PX);
    // Open mouth on roar
    if (state === 'roar') {
      ctx.fillStyle = C.mouth;
      ctx.fillRect(x+4*PX, y+9*PX, 6*PX, 2*PX);
      // Roar teeth
      ctx.fillStyle = '#FFFCE8';
      ctx.fillRect(x+4*PX, y+9*PX,  PX, PX);
      ctx.fillRect(x+6*PX, y+9*PX,  PX, PX);
      ctx.fillRect(x+8*PX, y+9*PX,  PX, PX);
      // Drool
      ctx.fillStyle = '#FFEE44';
      ctx.fillRect(x+5*PX, y+11*PX, PX, PX);
      ctx.fillRect(x+7*PX, y+11*PX, PX, 2*PX);
    }
  }

  _drawBoss_troll(ctx, x, y, state, PX) {
    const C = _BOSS_COLORS.troll;
    // Head — wide and round
    ctx.fillStyle = C.body;
    ctx.fillRect(x+2*PX, y,       10*PX, PX);
    ctx.fillRect(x+PX,   y+PX,    12*PX, 2*PX);
    ctx.fillRect(x,      y+3*PX,  14*PX, 3*PX);   // wide jowls
    // Head left highlight
    ctx.fillStyle = '#3A9944';
    ctx.fillRect(x+2*PX, y,      PX, PX);
    ctx.fillRect(x+PX,   y+PX,   PX, 2*PX);
    ctx.fillRect(x,      y+3*PX, PX, 3*PX);
    // Head right shadow
    ctx.fillStyle = '#1A5520';
    ctx.fillRect(x+11*PX, y,      PX, PX);
    ctx.fillRect(x+12*PX, y+PX,   PX, 2*PX);
    ctx.fillRect(x+13*PX, y+3*PX, PX, 3*PX);
    // Heavy brow ridge — dark band across forehead above eye
    ctx.fillStyle = '#1A5520';
    ctx.fillRect(x+4*PX, y,      6*PX, PX);       // brow top shadow
    ctx.fillRect(x+3*PX, y+PX,   4*PX, PX);       // brow overhang left
    ctx.fillRect(x+9*PX, y+PX,   3*PX, PX);       // brow overhang right
    // Single red eye (center forehead)
    ctx.fillStyle = C.eye;
    ctx.fillRect(x+5*PX, y+PX,    3*PX,  2*PX);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x+6*PX, y+PX,    PX,    PX);     // pupil
    // Eye inner glow highlight
    ctx.fillStyle = '#FF8800';
    ctx.fillRect(x+6*PX, y+PX,    2,     2);
    // Open gaping mouth with teeth
    ctx.fillStyle = C.mouth;
    ctx.fillRect(x+2*PX, y+4*PX, 10*PX, 2*PX);
    // Mouth inner depth
    ctx.fillStyle = '#660000';
    ctx.fillRect(x+3*PX, y+4*PX,  8*PX, PX);
    ctx.fillStyle = '#FFFCE8';
    for (let t = 0; t < 5; t++) ctx.fillRect(x+(t*2+2)*PX, y+4*PX, PX, PX);  // upper
    for (let t = 0; t < 4; t++) ctx.fillRect(x+(t*2+3)*PX, y+5*PX, PX, PX);  // lower
    // Chin drool drops
    ctx.fillStyle = '#55EE66';
    ctx.fillRect(x+4*PX, y+6*PX, PX, PX);
    ctx.fillRect(x+7*PX, y+6*PX, PX, 2*PX);
    ctx.fillRect(x+9*PX, y+6*PX, PX, PX);
    // Massive hunched shoulders
    ctx.fillStyle = C.body;
    ctx.fillRect(x-2*PX, y+6*PX,  18*PX, 3*PX);  // shoulders span
    ctx.fillRect(x,      y+9*PX,  14*PX, 3*PX);  // torso
    // Shoulder left highlight
    ctx.fillStyle = '#3A9944';
    ctx.fillRect(x-2*PX, y+6*PX,  PX, 3*PX);
    ctx.fillRect(x-PX,   y+6*PX,  PX, PX);
    // Shoulder right shadow
    ctx.fillStyle = '#1A5520';
    ctx.fillRect(x+15*PX, y+6*PX, PX, 3*PX);
    // Torso left highlight / right shadow
    ctx.fillStyle = '#3A9944';
    ctx.fillRect(x,      y+9*PX,  PX, 3*PX);
    ctx.fillStyle = '#1A5520';
    ctx.fillRect(x+13*PX,y+9*PX,  PX, 3*PX);
    // Lighter belly
    ctx.fillStyle = C.belly;
    ctx.fillRect(x+3*PX, y+9*PX,  8*PX, 2*PX);
    // Belly center highlight
    ctx.fillStyle = '#55BB55';
    ctx.fillRect(x+5*PX, y+9*PX,  4*PX, PX);
    // Club (left side)
    ctx.fillStyle = C.club;
    if (state === 'swipe') {
      ctx.fillRect(x-6*PX, y+3*PX, 5*PX, 2*PX);  // handle
      ctx.fillRect(x-7*PX, y+2*PX, 3*PX, 4*PX);  // club head
      // Club head highlight
      ctx.fillStyle = '#9A7020';
      ctx.fillRect(x-7*PX, y+2*PX, PX, 4*PX);
      // Wood grain lines
      ctx.fillStyle = '#5A3A00';
      ctx.fillRect(x-5*PX, y+3*PX, PX, 2*PX);
      ctx.fillRect(x-3*PX, y+3*PX, PX, 2*PX);
      // Metal nail spike
      ctx.fillStyle = '#BBBBBB';
      ctx.fillRect(x-8*PX, y+3*PX, PX, 2*PX);
    } else {
      ctx.fillRect(x-2*PX, y+6*PX, 2*PX, 6*PX);  // handle
      ctx.fillRect(x-3*PX, y+6*PX, 4*PX, 4*PX);  // club head
      // Club head highlight
      ctx.fillStyle = '#9A7020';
      ctx.fillRect(x-3*PX, y+6*PX, PX, 4*PX);
      // Wood grain lines
      ctx.fillStyle = '#5A3A00';
      ctx.fillRect(x-2*PX, y+7*PX, PX, 3*PX);
      ctx.fillRect(x+PX,   y+7*PX, PX, 3*PX);
      // Metal nail spikes
      ctx.fillStyle = '#BBBBBB';
      ctx.fillRect(x-4*PX, y+7*PX, PX, 2*PX);
      ctx.fillRect(x,      y+5*PX, PX, PX);
    }
    // Loincloth
    ctx.fillStyle = C.loin;
    ctx.fillRect(x+3*PX, y+12*PX, 8*PX, 2*PX);
    // Loincloth top highlight
    ctx.fillStyle = '#AA5522';
    ctx.fillRect(x+3*PX, y+12*PX, 8*PX, PX);
    // Legs
    ctx.fillStyle = C.leg;
    ctx.fillRect(x+2*PX,  y+12*PX, 4*PX, 3*PX);
    ctx.fillRect(x+8*PX,  y+12*PX, 4*PX, 3*PX);
    // Leg left highlights
    ctx.fillStyle = '#2A7733';
    ctx.fillRect(x+2*PX,  y+12*PX, PX, 3*PX);
    ctx.fillRect(x+8*PX,  y+12*PX, PX, 3*PX);
    // Leg right shadows
    ctx.fillStyle = '#112218';
    ctx.fillRect(x+5*PX,  y+12*PX, PX, 3*PX);
    ctx.fillRect(x+11*PX, y+12*PX, PX, 3*PX);
  }

  _drawHUD(ctx, ga) {
    const x = ga.x + Math.round(ga.w * 0.28);
    const y = ga.y + Math.round(ga.h / 2) - 10;
    // HP bar
    ctx.fillStyle = '#440000'; ctx.fillRect(x, y, 80, 8);
    ctx.fillStyle = this._heroHp > 0 ? '#FF2200' : '#220000';
    ctx.fillRect(x, y, 80 * (this._heroHp / 100), 8);
    ctx.strokeStyle = '#662200'; ctx.lineWidth = 1; ctx.strokeRect(x, y, 80, 8);
    ctx.font = '8px "Courier New", monospace'; ctx.fillStyle = '#FFAA88'; ctx.fillText('HP', x+1, y+7);
    // XP bar
    ctx.fillStyle = '#003344'; ctx.fillRect(x, y+12, 80, 6);
    ctx.fillStyle = '#00CCFF'; ctx.fillRect(x, y+12, 80 * Math.min(1, this._xp / SideScrollerEffect.XP_PER_LEVEL), 6);
    ctx.strokeStyle = '#004466'; ctx.strokeRect(x, y+12, 80, 6);
    // LVL label
    ctx.font = 'bold 9px "Courier New", monospace'; ctx.fillStyle = '#FFCC00';
    ctx.fillText('LVL ' + this._level, x + 86, y + 18);
    // Gold — right side, same vertical band
    ctx.fillStyle = '#FFAA00'; ctx.textAlign = 'right';
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.fillText('GOLD: ' + this._gold, ga.x + Math.round(ga.w * 0.72), y + 8);
    ctx.textAlign = 'left';
  }

  _update_intro(dt, ga) {
    const hero = this._hero;
    const heroTarget = ga.x + ga.w * 0.28;
    hero.x += 80 * dt;
    hero.animT += dt;
    if (hero.animT > 0.15) { hero.animT = 0; hero.frame = (hero.frame + 1) % 2; }
    hero.state = 'walk';
    this._drawBg(ga, 0);
    this._drawHero(this._ctx, hero);
    this._drawFgOverlay(ga);
    this._drawHUD(this._ctx, ga);
    if (hero.x >= heroTarget) {
      hero.x = heroTarget;
      hero.state = 'idle';
      this._state = 'scrolling';
      this._t = 0;
    }
  }

  _update_scrolling(dt, ga) {
    if (this._inCombat)  { this._updateCombat(dt, ga);  return; }
    if (this._inLevelUp) { this._updateLevelUp(dt, ga); return; }

    const hero = this._hero;
    if (!this._scrollFrozen) this._scrollX += SideScrollerEffect.SCROLL_SPEED * dt;

    // Walk anim
    hero.animT += dt;
    if (hero.animT > 0.15) { hero.animT = 0; hero.frame = (hero.frame + 1) % 2; }
    hero.state = 'walk';

    // Spawn next enemy
    if (!this._enemy && this._enemyQueue.length > 0 && this._scrollX >= this._nextEnemyScroll) {
      this._spawnEnemy(ga);
    }

    // Boss trigger
    if (!this._enemy && !this._bossSpawned && this._enemyQueue.length === 0 && this._killCount >= SideScrollerEffect.MIN_KILLS) {
      this._startBossPhase(ga);
      return;
    }

    // Advance enemy — starts just off right edge, walks left with world scroll
    if (this._enemy && this._enemy.state === 'walk') {
      const enemy = this._enemy;
      enemy.x = (ga.x + ga.w + 10) - (this._scrollX - enemy.spawnScrollX);
      if (enemy.x <= hero.x + SideScrollerEffect.ENGAGE_DIST) this._startCombat();
    }

    this._drawBg(ga, dt);
    if (this._enemy) this._drawEnemy(this._ctx, this._enemy);
    this._drawHero(this._ctx, hero);
    this._drawFgOverlay(ga);
    this._updateFloatTexts(dt);
    this._drawFloatTexts(this._ctx);
    this._drawHUD(this._ctx, ga);
  }

  _spawnEnemy(ga) {
    const type = this._enemyQueue.shift();
    const PX = SideScrollerEffect.PX;
    const floatOff = { harpy: 20, imp: 15 }[type] || 0;
    const h = ({ goblin:10, slime:7, harpy:12, wolf:9, imp:12, boar:8, mimic:10 }[type] || 10) * PX;
    this._enemy = {
      type, state: 'walk',
      x: ga.x + ga.w + 10,
      y: this._groundY - h - floatOff,
      spawnScrollX: this._scrollX,
      frame: 0, animT: 0, flashT: 0, dyingT: 0,
    };
    this._nextEnemyScroll += 140;
  }

  _startCombat() {
    this._scrollFrozen = true;
    this._inCombat = true;
    this._combatT  = 0;
    this._hero.state = 'slash';
    this._enemy.state = 'hit';
  }

  _updateCombat(dt, ga) {
    this._combatT += dt;
    const ct    = this._combatT;
    const hero  = this._hero;
    const enemy = this._enemy;

    if (ct < 0.2)  hero.state = 'slash';
    if (ct >= 0.2) hero.state = 'idle';
    if (ct >= 0.25 && enemy && enemy.flashT <= 0) enemy.flashT = 0.12;
    if (enemy && enemy.flashT > 0) enemy.flashT -= dt;
    if (ct >= 0.35 && enemy && enemy.state !== 'dying') { enemy.state = 'dying'; enemy.dyingT = 0; }
    if (enemy && enemy.state === 'dying') enemy.dyingT += dt;

    if (ct >= 0.65 && enemy && !enemy._floatSpawned) {
      enemy._floatSpawned = true;
      const xpGain   = 20 + Math.floor(Math.random() * 20);
      const goldGain = 5  + Math.floor(Math.random() * 10);
      this._xp      += xpGain;
      this._xpTarget = this._xp;
      this._gold    += goldGain;
      this._spawnFloatText(`+${xpGain} EXP`, enemy.x + 15, enemy.y - 10, '#00FFCC');
      this._spawnFloatText(`+${goldGain} G`,  enemy.x - 5,  enemy.y - 25, '#FFCC00');
    }

    if (ct >= 1.05) {
      this._killCount++;
      this._enemy        = null;
      this._inCombat     = false;
      this._scrollFrozen = false;
      hero.state = 'walk';
      if (this._killCount >= SideScrollerEffect.MIN_KILLS && this._level === 1 && !this._inLevelUp) {
        this._startLevelUp();
        return;
      }
    }

    this._drawBg(ga, 0);
    if (enemy && enemy.state !== 'gone') this._drawEnemy(this._ctx, enemy);
    this._drawHero(this._ctx, hero);
    this._drawFgOverlay(ga);
    this._updateFloatTexts(dt);
    this._drawFloatTexts(this._ctx);
    this._drawHUD(this._ctx, ga);
  }

  _spawnFloatText(text, x, y, color) {
    this._floatTexts.push({ text, x, y, vy: -40, alpha: 1, life: 1.4, maxLife: 1.4, color });
  }

  _updateFloatTexts(dt) {
    for (const ft of this._floatTexts) { ft.y += ft.vy * dt; ft.life -= dt; ft.alpha = ft.life < 0.4 ? ft.life / 0.4 : 1; }
    this._floatTexts = this._floatTexts.filter(ft => ft.life > 0);
  }

  _drawFloatTexts(ctx) {
    ctx.textAlign = 'center';
    for (const ft of this._floatTexts) {
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillStyle = '#000'; ctx.fillText(ft.text, ft.x+1, ft.y+1);
      ctx.fillStyle = ft.color; ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  _startLevelUp() {
    this._scrollFrozen = true;
    this._inLevelUp    = true;
    this._levelUpT     = 0;
    this._levelUpPhase = 'draining';
  }

  _updateLevelUp(dt, ga) {
    this._levelUpT += dt;
    const lt = this._levelUpT;
    if (this._levelUpPhase === 'draining') {
      this._xp = Math.max(0, this._xpTarget * (1 - lt / 0.5));
      if (lt >= 0.5) { this._xp = 0; this._level++; this._levelUpPhase = 'flash'; this._levelUpT = 0; }
    }
    this._drawBg(ga, 0);
    if (this._enemy) this._drawEnemy(this._ctx, this._enemy);
    this._drawHero(this._ctx, this._hero);
    this._drawFgOverlay(ga);
    this._drawHUD(this._ctx, ga);
    if (this._levelUpPhase === 'flash' && this._levelUpT < 0.7) {
      const scale = 1 + Math.sin(this._levelUpT * Math.PI / 0.7) * 0.3;
      const ctx = this._ctx;
      ctx.save();
      ctx.font = `bold ${Math.round(20 * scale)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFCC00';
      ctx.shadowColor = '#FF8800'; ctx.shadowBlur = 8;
      ctx.fillText('LVL UP!', ga.x + ga.w / 2, ga.y + ga.h / 2);
      ctx.shadowBlur = 0; ctx.restore();
    }
    if (this._levelUpPhase === 'flash' && this._levelUpT >= 1.2) {
      this._inLevelUp    = false;
      this._scrollFrozen = false;
    }
  }

  _startBossPhase(ga) {
    this._bossSpawned = true;
    const PX = SideScrollerEffect.PX;
    // Each boss sprite has a different pixel height to the bottom of its feet
    const bossH = { orc: 14, blob: 15, troll: 15 }[this._bossType] || 15;
    const bossY  = this._groundY - bossH * PX;
    this._boss = {
      type: this._bossType,
      x: ga.x + ga.w + 60,
      y: bossY,
      baseY: bossY,
      state: 'walk_in',
      bobT: 0, bobOffset: 0, roaring: false,
      scriptT: 0, _roarTextSpawned: false,
    };
    this._state = 'boss';
    this._t     = 0;
  }

  _update_boss(dt, ga) {
    const boss = this._boss;
    const hero = this._hero;
    boss.scriptT += dt;
    const target = ga.x + ga.w * 0.38;

    // Walk in — world keeps scrolling, hero walks toward boss
    if (boss.state === 'walk_in') {
      this._scrollX += SideScrollerEffect.SCROLL_SPEED * dt;
      hero.animT += dt;
      if (hero.animT > 0.15) { hero.animT = 0; hero.frame = (hero.frame + 1) % 2; }
      hero.state = 'walk';
      boss.x -= SideScrollerEffect.SCROLL_SPEED * dt;
      if (boss.x <= target) {
        boss.x = target; boss.state = 'pause'; boss.scriptT = 0;
        hero.state = 'idle'; this._scrollFrozen = true;
      }
    }
    // Capture st AFTER walk_in may have reset it
    const st = boss.scriptT;

    if (boss.state === 'pause' && st >= 0.5) {
      boss.state = 'roar'; boss.roaring = true; boss.scriptT = 0;
      if (!boss._roarTextSpawned) {
        boss._roarTextSpawned = true;
        this._spawnFloatText('GRAAAH!', boss.x + 30, boss.y - 10, '#FF4400');
      }
    }
    if (boss.state === 'roar'  && boss.scriptT >= 0.6) { boss.roaring = false; boss.state = 'idle';  boss.scriptT = 0; }
    if (boss.state === 'idle'  && boss.scriptT >= 0.8) { boss.state = 'swipe'; boss.scriptT = 0; }
    if (boss.state === 'swipe' && boss.scriptT >= 0.5 && this._hero.state !== 'dying' && this._hero.state !== 'dead') {
      this._hero.state = 'dying'; this._hero.deadT = 0; this._heroHp = 0;
    }
    if (this._hero.state === 'dying') {
      this._hero.deadT += dt;
      if (this._hero.deadT > 1.05) this._hero.state = 'dead';
    }
    if (boss.state === 'swipe' && boss.scriptT >= 2.0) { this._state = 'game_over'; this._t = 0; boss.state = 'victory'; }

    boss.bobT    += dt;
    // Gentle upward-only breathe — boss never lifts off ground
    boss.bobOffset = -Math.abs(Math.sin(boss.bobT * 1.2)) * 2;

    this._drawBg(ga, dt);
    this._drawHero(this._ctx, this._hero);
    this._drawBoss(this._ctx, boss);
    this._drawFgOverlay(ga);
    this._updateFloatTexts(dt);
    this._drawFloatTexts(this._ctx);
    this._drawHUD(this._ctx, ga);
  }

  _update_game_over(dt, ga) {
    const boss = this._boss;
    const ctx  = this._ctx;

    // Solid dark background — no faded-asset soup
    ctx.fillStyle = '#040408';
    ctx.fillRect(ga.x, ga.y, ga.w, ga.h);

    // Boss laughs — bobs fast and alternates idle/roar
    if (boss) {
      boss.bobT    += dt;
      boss.bobOffset = Math.sin(boss.bobT * 9) * 6;
      boss.state   = Math.floor(this._t / 0.28) % 2 === 0 ? 'idle' : 'roar';
      boss.roaring = (boss.state === 'roar');
      this._drawBoss(ctx, boss);
    }

    // GAME OVER — blinking white early, solid red after
    const blinks   = Math.floor(this._t / 0.22);
    const blinking = this._t < 1.2;
    const visible  = !blinking || blinks % 2 === 0;
    if (visible) {
      ctx.font = 'bold 28px "Courier New", monospace';
      ctx.textAlign = 'center';
      const cx = ga.x + ga.w / 2;
      const cy = ga.y + ga.h / 2 + 4;
      ctx.fillStyle = '#000';
      ctx.fillText('GAME OVER', cx + 3, cy + 3);
      ctx.shadowColor = '#FF0000'; ctx.shadowBlur = blinking ? 22 : 14;
      ctx.fillStyle = blinking ? '#FFFFFF' : '#FF2200';
      ctx.fillText('GAME OVER', cx, cy);
      ctx.shadowBlur = 0; ctx.textAlign = 'left';
    }

    if (this._t >= 3.2) { this._state = 'outro'; this._t = 0; this._crumbleStarted = false; }
  }

  _buildCrumble(ga) {
    const PX = SideScrollerEffect.PX;
    const groundY = this._groundY;
    for (let x = ga.x; x < ga.x + ga.w; x += 8) {
      this._particles.push(this._mkPart(x, groundY,      '#8B6914'));
      this._particles.push(this._mkPart(x, groundY + 12, '#5A4010'));
    }
    if (this._boss) {
      const bx = this._boss.x, by = this._boss.y;
      for (let i = 0; i < 30; i++)
        this._particles.push(this._mkPart(bx + Math.random()*12*PX, by + Math.random()*14*PX, '#1A6622'));
    }
    if (this._layers?.nearTrees) {
      for (const tr of this._layers.nearTrees.trees) {
        for (let i = 0; i < 6; i++) {
          const px = ga.x + tr.tx - this._layers.nearTrees.offset + Math.random() * tr.tw;
          this._particles.push(this._mkPart(px, tr.groundY - tr.th + Math.random()*20, '#2A6A2A'));
        }
      }
    }
  }

  _mkPart(x, y, color) {
    return { x, y, color, vx:(Math.random()-0.5)*140, vy:-80-Math.random()*60, size:3+Math.random()*3, life:1.5+Math.random()*1.0, maxLife:2.5 };
  }

  _updateParticles(dt) {
    for (const p of this._particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 280*dt; p.life -= dt; }
    this._particles = this._particles.filter(p => p.life > 0);
  }

  _drawParticles(ctx) {
    for (const p of this._particles) { ctx.globalAlpha = Math.max(0, p.life/p.maxLife); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
  }

  _spawnHitParticles(x, y, count, color) {
    for (let i = 0; i < count; i++)
      this._particles.push({ x, y, color, vx:(Math.random()-0.5)*120, vy:-40-Math.random()*60, size:2+Math.random()*3, life:0.4+Math.random()*0.3, maxLife:0.7 });
  }

  _spawnDeathParticles(enemy) {
    const colors = { goblin:'#4AAA22', slime:'#22AA22', harpy:'#CC88EE', wolf:'#1A1E2A', imp:'#DD5544', boar:'#CC6633', mimic:'#FFB800' };
    const c = colors[enemy.type] || '#FFFFFF';
    for (let i = 0; i < 12; i++)
      this._particles.push({ x:enemy.x+Math.random()*40, y:enemy.y+Math.random()*30, color:c, vx:(Math.random()-0.5)*100, vy:-60-Math.random()*60, size:2+Math.random()*4, life:0.6+Math.random()*0.5, maxLife:1.1 });
  }

  _spawnBossRoarParticles(x, y) {
    for (let i = 0; i < 8; i++)
      this._particles.push({ x:x+Math.random()*20-10, y, color:'#AA8800', vx:(Math.random()-0.5)*60, vy:-20-Math.random()*40, size:2+Math.random()*2, life:0.5+Math.random()*0.3, maxLife:0.8 });
  }

  _update_outro(dt, ga) {
    if (!this._crumbleStarted) { this._crumbleStarted = true; this._buildCrumble(ga); }
    this._updateParticles(dt);
    this._drawParticles(this._ctx);
    if (this._particles.length === 0 || this._t > 4.5) {
      this._state = 'idle';
      if (this._ctx && this._canvas) this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

}

// ── Sprite color palettes ────────────────────────────────────────────────────

const _HERO_COLORS = { H:'#4A2000', S:'#FFB870', T:'#2244AA', B:'#885500', G:'#3A1A00', W:'#CCDDFF', X:'#885500' };

const _BOSS_COLORS = {
  orc:  { body:'#4A8A22', horn:'#DDBB22', eye:'#FFEE00', tusk:'#EEDDAA', armor:'#667755', mouth:'#CC0000', boot:'#331100' },
  blob: { body:'#FFCC00', shine:'#FFEE88', eyeOuter:'#111111', eyeRed:'#FF2200', mouth:'#CC0000' },
  troll:{ body:'#2A7733', belly:'#44AA44', eye:'#FF2200', club:'#7A5500', loin:'#8B4513', leg:'#1A5528', mouth:'#CC0000' },
};

const _ENEMY_COLORS = {
  goblin:  { body:'#4AAA22', dark:'#226611', eye:'#FF6600', spear:'#BB9955', cloth:'#885522' },
  slime:   { body:'#22AA22', shine:'#77EE55', eye:'#111111' },
  harpy:   { hair:'#44DDAA', skin:'#FFCCAA', wing:'#CC88EE', wingDark:'#9944BB', body:'#FFAACC', eye:'#FF0099', talon:'#DDAA22' },
  wolf:    { body:'#1A1E2A', saddle:'#2A3040', snout:'#181C28', eye:'#FF0000' },
  imp:     { wing:'#880011', body:'#DD5544', horn:'#660022', eye:'#FFFF00', trident:'#CCAA00' },
  boar:    { body:'#CC6633', light:'#EEAA66', snout:'#DDBB99', tusk:'#FFFFCC', eye:'#220022', mane:'#882211' },
  mimic:   { box:'#8B4513', goldTrim:'#FFB800', lid:'#6B3410', lock:'#FFCC00', teeth:'#FFFCE8', eye:'#FF4400', leg:'#AA5500' },
};

PackageRegistry.registerEffect(new SideScrollerEffect());
