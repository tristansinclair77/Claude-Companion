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
  static ENEMY_TYPES  = ['imp', 'wolf', 'harpy', 'boar'];
  static BOSS_TYPES   = ['ogre'];

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
    this._bossType    = 'ogre';
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

    // Sprite system
    this._sprites        = null;   // loaded sprite sets (name → OffscreenCanvas[])
    this._bgImage        = null;   // bg_mountain PNG
    this._spritesReady   = false;
    this._spritesLoading = false;
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
    if (!this._spritesReady) {
      this._loadSprites().then(() => {
        this._rAF = requestAnimationFrame(ts => this._tick(ts));
      });
    } else {
      this._rAF = requestAnimationFrame(ts => this._tick(ts));
    }
  }

  // ── Sprite Loading ─────────────────────────────────────────────────────────

  async _loadSprites() {
    if (this._spritesLoading || this._spritesReady) return;
    this._spritesLoading = true;
    const names = ['heroWalk', 'heroAttack', 'heroLoop', 'impLoop', 'wolfLoop', 'harpyLoop', 'boarLoop', 'ogreLoop', 'ogreAttack', 'bush1', 'bush2', 'bush3', 'tree1', 'tree2', 'tree3', 'tree4'];
    this._sprites = {};
    const jsonLoad = Promise.all(names.map(async name => {
      try {
        const res  = await fetch(`./sprites/${name}.json`);
        const data = await res.json();
        this._sprites[name] = this._renderJsonFrames(data);
      } catch (e) {
        console.warn(`SideScroller: failed to load sprite ${name}:`, e);
        this._sprites[name] = [];
      }
    }));
    const pngLoad = new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { this._bgImage = img; resolve(); };
      img.onerror = () => { console.warn('SideScroller: failed to load bg_mountain PNG'); resolve(); };
      img.src = '../../assets/pixelarteditor/bg_mountain_f1.png';
    });
    await Promise.all([jsonLoad, pngLoad]);
    this._spritesReady  = true;
    this._spritesLoading = false;
  }

  /**
   * Convert a pixel-art editor JSON save into an array of OffscreenCanvas (one per frame).
   * Each canvas is sized to the tight bounding box of ALL frames combined.
   */
  _renderJsonFrames(data) {
    // Compute global bounding box across all frames
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const frame of data.frames) {
      for (const key of Object.keys(frame)) {
        const [cx, cy] = key.split(',').map(Number);
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;
      }
    }
    if (!isFinite(minX)) return [];
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    return data.frames.map(frame => {
      const oc  = new OffscreenCanvas(w, h);
      const ctx = oc.getContext('2d');
      for (const [key, color] of Object.entries(frame)) {
        const [cx, cy] = key.split(',').map(Number);
        ctx.fillStyle = color;
        ctx.fillRect(cx - minX, cy - minY, 1, 1);
      }
      return oc;
    });
  }

  /** Draw a pre-rendered sprite frame, optionally flipped horizontally. */
  _drawSpriteFrame(frames, frameIdx, ctx, x, y, flipX = false) {
    if (!frames || !frames.length) return;
    const oc = frames[frameIdx % frames.length];
    if (!oc) return;
    if (flipX) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(oc, -x - oc.width, y);
      ctx.restore();
    } else {
      ctx.drawImage(oc, x, y);
    }
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

    // Dev hotkey: Ctrl — forces immediate ogre boss spawn
    this._keyHandler = (e) => {
      if (this._state !== 'scrolling') return;
      if (this._bossSpawned || this._inCombat || this._inLevelUp) return;
      if (e.key !== 'Control') return;
      e.preventDefault();
      this._bossType = 'ogre';
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

    // Hero starts off left edge — footY is the ground contact point (sprites are drawn foot-anchored)
    this._hero = {
      x:      ga.x - 60,
      footY:  groundY + 6,   // feet sit 6px into ground stripe
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
      bgMtn:      this._buildBgMountain(ga),
      nearTrees:  this._buildNearTrees(ga),
      fgFences:   this._buildFgFences(ga),
      fgBushes:   this._buildFgBushes(ga),
    };
  }

  _buildBgMountain(ga) {
    // Width determined at draw time from the loaded PNG; use placeholder until ready
    return { offset: 0, speed: 18, W: 512 };
  }

  _drawBgMountain(ctx, ga, layer) {
    const img = this._bgImage;
    if (!img) {
      ctx.fillStyle = '#050510';
      ctx.fillRect(ga.x, ga.y, ga.w, ga.h);
      return;
    }
    layer.W = img.naturalWidth;
    const iw       = img.naturalWidth;
    const groundY  = ga.y + ga.h - 28;
    const drawY    = Math.round(groundY - img.naturalHeight);
    // Start one full tile-width before the left edge to guarantee no seam on the left
    const startX   = Math.floor(ga.x - (layer.offset % iw)) - iw;
    // Fill any sky gap above by tiling the image's top row stretched to that height
    if (drawY > ga.y) {
      const gapH = drawY - ga.y;
      for (let x = startX; x < ga.x + ga.w + iw; x += iw) {
        ctx.drawImage(img, 0, 0, iw, 1, Math.round(x), ga.y, iw, gapH);
      }
    }
    for (let x = startX; x < ga.x + ga.w + iw; x += iw) {
      ctx.drawImage(img, Math.round(x), drawY);
    }
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
      trees.push({ tx, groundY, variant: Math.ceil(Math.random() * 4) });
      tx += Math.random() < 0.4 ? 28 + Math.random() * 65 : 110 + Math.random() * 260;
    }
    return { trees, W, offset: 0, speed: 60 };
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
      // Advance past actual fence width (panelW=24, totalW = panels*24+4) then add gap
      fx += panels * 24 + 4;
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
      if (!blocked) items.push({ x: fx, r, variant: Math.floor(Math.random() * 3) + 1 });
      // Bush sprites are ~64px wide, center-anchored — need at least 65px center-to-center
      fx += 65;
      fx += Math.random() < 0.5 ? 10 + Math.random() * 50 : 80 + Math.random() * 200;
    }
    return { items, W, groundY, offset: 0, speed: 60 };
  }

  _drawFgFences(ctx, ga, layer) {
    for (let rep = -1; rep <= 1; rep++) {
      const ox = ga.x - layer.offset + rep * layer.W;
      for (const item of layer.items) {
        const dx = ox + item.x;
        if (dx + 200 < ga.x || dx - 20 > ga.x + ga.w) continue;
        ctx.save();
        ctx.translate(dx, layer.groundY);
        ctx.scale(1.5, 1.5);
        ctx.translate(-dx, -layer.groundY);
        this._drawFgFence(ctx, dx, layer.groundY, item.panels);
        ctx.restore();
      }
    }
  }

  _drawFgBushes(ctx, ga, layer) {
    for (let rep = -1; rep <= 1; rep++) {
      const ox = ga.x - layer.offset + rep * layer.W;
      for (const item of layer.items) {
        const dx = ox + item.x;
        if (dx + 80 < ga.x || dx - 80 > ga.x + ga.w) continue;
        this._drawFgBush(ctx, dx, layer.groundY, item.r, item.variant);
      }
    }
  }

  _drawFgOverlay(ga) {
    // All ground-layer objects now drawn in _drawBg before the hero; nothing drawn on top here.
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

  _drawFgBush(ctx, x, groundY, r, variant = 1) {
    // Use pixel-art sprite if loaded
    if (this._spritesReady) {
      const key = `bush${variant}`;
      const frames = this._sprites[key];
      if (frames && frames.length) {
        const oc = frames[0];
        ctx.filter = 'brightness(0.6)';
        ctx.drawImage(oc, Math.round(x - oc.width / 2), groundY - oc.height);
        ctx.filter = 'none';
        return;
      }
    }
    // Procedural fallback (used before sprites load)
    const ri = Math.round(r);
    const gy = groundY + Math.round(ri * 0.85);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, gy + 2, ri * 1.15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#145514';
    ctx.beginPath();
    ctx.ellipse(x - ri * 0.7, gy - ri * 0.5, ri * 0.75, ri * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + ri * 0.75, gy - ri * 0.55, ri * 0.72, ri * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1A7A1A';
    ctx.beginPath();
    ctx.ellipse(x, gy - ri * 0.9, ri * 0.95, ri * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22922A';
    ctx.beginPath();
    ctx.ellipse(x - ri * 0.55, gy - ri * 1.15, ri * 0.65, ri * 0.58, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + ri * 0.6, gy - ri * 1.1, ri * 0.62, ri * 0.55, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBg(ga, dt) {
    if (!this._layers) return;
    const ctx = this._ctx;
    const adv = this._scrollFrozen ? 0 : dt;
    const L = this._layers;
    if (adv > 0) {
      L.bgMtn.offset      = (L.bgMtn.offset      + L.bgMtn.speed      * adv) % L.bgMtn.W;
      L.nearTrees.offset  = (L.nearTrees.offset  + L.nearTrees.speed  * adv) % L.nearTrees.W;
      L.fgFences.offset   = (L.fgFences.offset   + L.fgFences.speed   * adv) % L.fgFences.W;
      L.fgBushes.offset   = (L.fgBushes.offset   + L.fgBushes.speed   * adv) % L.fgBushes.W;
    }
    this._drawBgMountain(ctx, ga, L.bgMtn);
    this._drawNearTrees(ctx, ga, L.nearTrees);
    this._drawGround(ctx, ga);
    this._drawFgBushes(ctx, ga, L.fgBushes);
    this._drawFgFences(ctx, ga, L.fgFences);
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
        const bx = Math.round(ox + tr.tx);
        const by = tr.groundY;
        if (!this._spritesReady) continue;
        const key    = `tree${tr.variant}`;
        const frames = this._sprites[key];
        if (!frames || !frames.length) continue;
        const oc = frames[0];
        const dw = oc.width  * 2;
        const dh = oc.height * 2;
        // Center horizontally, bottom of sprite sits at groundY, drawn at 2x
        ctx.drawImage(oc, bx - Math.round(dw / 2), by - dh, dw, dh);
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
    const totalH  = 28;  // full ground strip height

    // Deep soil base
    ctx.fillStyle = '#1A3A0A';
    ctx.fillRect(ga.x, groundY, ga.w, totalH);

    // Mid soil layer
    ctx.fillStyle = '#224E10';
    ctx.fillRect(ga.x, groundY + 4, ga.w, totalH - 4);

    // Lower soil shadow
    ctx.fillStyle = '#162E08';
    ctx.fillRect(ga.x, groundY + 14, ga.w, totalH - 14);

    // Scrolling soil texture — dark vertical streaks
    const sOff = Math.round(this._scrollX) % 11;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let tx = ga.x - sOff; tx < ga.x + ga.w; tx += 11) {
      ctx.fillRect(tx, groundY + 6, 1, totalH - 6);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let tx = ga.x - sOff + 5; tx < ga.x + ga.w; tx += 11) {
      ctx.fillRect(tx, groundY + 6, 1, totalH - 6);
    }

    // Top grass band
    ctx.fillStyle = '#2A6E12';
    ctx.fillRect(ga.x, groundY, ga.w, 5);
    ctx.fillStyle = '#3A9020';
    ctx.fillRect(ga.x, groundY, ga.w, 3);
    ctx.fillStyle = '#4AAA28';
    ctx.fillRect(ga.x, groundY, ga.w, 1);

    // Grass tufts
    const tOff = Math.round(this._scrollX) % 14;
    ctx.fillStyle = '#1A5008';
    for (let tx = ga.x - tOff; tx < ga.x + ga.w + 2; tx += 14) {
      ctx.fillRect(tx,      groundY - 6, 1, 7);
      ctx.fillRect(tx + 4,  groundY - 4, 1, 5);
      ctx.fillRect(tx + 8,  groundY - 8, 1, 9);
      ctx.fillRect(tx + 11, groundY - 3, 1, 4);
    }
    ctx.fillStyle = '#4AAA28';
    for (let tx = ga.x - tOff; tx < ga.x + ga.w + 2; tx += 14) {
      ctx.fillRect(tx,     groundY - 6, 1, 2);
      ctx.fillRect(tx + 8, groundY - 8, 1, 2);
    }
    // Tuft highlights
    ctx.fillStyle = '#6ACC3A';
    for (let tx = ga.x - tOff; tx < ga.x + ga.w + 2; tx += 14) {
      ctx.fillRect(tx,     groundY - 6, 1, 1);
      ctx.fillRect(tx + 8, groundY - 8, 1, 1);
    }
  }

  _drawHero(ctx, hero) {
    if (!this._spritesReady) return;
    const x     = Math.round(hero.x);
    const footY = Math.round(hero.footY);

    let frames, frameIdx;
    if (hero.state === 'slash') {
      frames    = this._sprites.heroAttack;
      frameIdx  = hero.frame;
    } else if (hero.state === 'idle') {
      frames    = this._sprites.heroLoop;
      frameIdx  = hero.frame;
    } else {
      frames    = this._sprites.heroWalk;
      frameIdx  = hero.frame;
    }

    const oc = (frames && frames.length) ? frames[frameIdx % frames.length] : null;
    if (!oc) return;

    // All animations draw foot-anchored: top-left = (x, footY - height)
    const drawY = footY - oc.height;

    if (hero.state === 'dying' || hero.state === 'dead') {
      if (!hero._exploded) {
        hero._exploded = true;
        this._spawnSpriteParticles(oc, x, drawY);
      }
      // Brief white flash then invisible — particles handle the visual
      if (hero.deadT < 0.12) {
        ctx.filter = 'brightness(10)';
        ctx.drawImage(oc, x, drawY);
        ctx.filter = 'none';
      }
      return;
    }

    ctx.drawImage(oc, x, drawY);
  }

  _drawEnemy(ctx, enemy) {
    if (!enemy || enemy.state === 'gone') return;
    if (!this._spritesReady) return;
    const x = Math.round(enemy.x);
    const y = Math.round(enemy.y);

    // Advance animation timer (uses per-enemy animT so it's independent of tick dt)
    enemy.animT = (enemy.animT || 0) + 0.016;
    const spriteMap = { imp: 'impLoop', wolf: 'wolfLoop', harpy: 'harpyLoop', boar: 'boarLoop' };
    const spriteName = spriteMap[enemy.type];
    const frames = spriteName ? this._sprites[spriteName] : null;
    if (!frames || !frames.length) return;
    const frameIdx = Math.floor(enemy.animT * 4) % frames.length;  // 4 fps (halved from 8)
    const oc = frames[frameIdx % frames.length];

    // imp and wolf sprites face right in the editor, but need to face left in-game
    const flipX = (enemy.type === 'imp' || enemy.type === 'wolf');

    ctx.save();

    if (enemy.state === 'dying') {
      if (!enemy._exploded) {
        enemy._exploded = true;
        this._spawnSpriteParticles(oc, x, y);
      }
      // Brief white flash then invisible — particles handle the visual
      if (enemy.dyingT < 0.12) {
        ctx.filter = 'brightness(10)';
        if (flipX) { ctx.scale(-1, 1); ctx.drawImage(oc, -(x + oc.width), y); }
        else { ctx.drawImage(oc, x, y); }
        ctx.filter = 'none';
      }
      if (enemy.dyingT > 0.25) enemy.state = 'gone';
      ctx.restore();
      return;
    }

    // Ground shadow for non-flying enemies
    if (enemy.type !== 'harpy' && enemy.type !== 'imp' && enemy.state !== 'dying') {
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(x + oc.width / 2, this._groundY + 3, oc.width * 0.4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (enemy.flashT > 0) ctx.filter = 'brightness(10)';
    if (flipX) {
      ctx.scale(-1, 1);
      ctx.drawImage(oc, -(x + oc.width), y);
    } else {
      ctx.drawImage(oc, x, y);
    }
    ctx.filter = 'none';
    ctx.restore();
  }


  _drawBoss(ctx, boss) {
    if (!boss || !this._spritesReady) return;
    const x = Math.round(boss.x);
    const y = Math.round(boss.y + (boss.bobOffset || 0));

    // Choose frames based on boss state
    const useAttack = (boss.state === 'swipe');
    const frames = useAttack ? this._sprites.ogreAttack : this._sprites.ogreLoop;
    if (!frames || !frames.length) return;

    // Reset animation timer on state change so attack plays from the beginning
    if (boss._prevDrawState !== boss.state) {
      boss._bossAnimT    = 0;
      boss._prevDrawState = boss.state;
    }
    boss._bossAnimT = (boss._bossAnimT || 0) + 0.016;

    let frameIdx;
    if (useAttack) {
      // Attack plays once at 2fps then holds on last frame
      frameIdx = Math.min(Math.floor(boss._bossAnimT * 2), frames.length - 1);
    } else {
      // Idle loops at 2fps
      frameIdx = Math.floor(boss._bossAnimT * 2) % frames.length;
    }
    const oc = frames[frameIdx];

    // Screenshake on roar
    const jx = boss.roaring ? (Math.random() * 4 - 2) : 0;
    ctx.save();
    if (jx !== 0) ctx.translate(jx, 0);
    ctx.drawImage(oc, x, y, oc.width * 1.6, oc.height * 1.6);
    ctx.restore();
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
    hero.frame = Math.floor(hero.animT * 4) % 5;
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
    hero.frame = Math.floor(hero.animT * 4) % 5;
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
    this._updateParticles(dt);
    this._drawParticles(this._ctx);
    this._updateFloatTexts(dt);
    this._drawFloatTexts(this._ctx);
    this._drawHUD(this._ctx, ga);
  }

  _spawnEnemy(ga) {
    const type = this._enemyQueue.shift();
    // Sprite heights (bounding box) at 1:1 scale, plus fly offset for airborne enemies
    const heightMap = { imp: 75, wolf: 43, harpy: 75, boar: 45 };
    const flyMap    = { imp: 30, harpy: 30 };
    const h       = heightMap[type] || 60;
    const flyOff  = flyMap[type]    || 0;
    this._enemy = {
      type, state: 'walk',
      x: ga.x + ga.w + 10,
      y: this._groundY + 7 - h - flyOff,
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
    this._hero.frame = 0;
    this._enemy.state = 'hit';
  }

  _updateCombat(dt, ga) {
    this._combatT += dt;
    const ct    = this._combatT;
    const hero  = this._hero;
    const enemy = this._enemy;

    if (ct < 0.45) { hero.state = 'slash'; hero.frame = Math.min(Math.floor(ct * 11), 4); }
    if (ct >= 0.45) hero.state = 'idle';
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
    this._updateParticles(dt);
    this._drawParticles(this._ctx);
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
    this._updateParticles(dt);
    this._drawParticles(this._ctx);
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
    // Ogre sprite bounding box height = 75px at 1:1
    const bossY = this._groundY + 5 - Math.round(75 * 1.6);
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
      hero.frame = Math.floor(hero.animT * 4) % 5;
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

    boss.bobOffset = 0;

    this._drawBg(ga, dt);
    this._drawHero(this._ctx, this._hero);
    this._drawBoss(this._ctx, boss);
    this._updateParticles(dt);
    this._drawParticles(this._ctx);
    this._updateFloatTexts(dt);
    this._drawFloatTexts(this._ctx);
    this._drawHUD(this._ctx, ga);
  }

  _update_game_over(dt, ga) {
    const boss = this._boss;
    const ctx  = this._ctx;

    // Draw full scene frozen in place
    this._drawBg(ga, 0);
    this._drawHero(ctx, this._hero);
    if (boss) {
      boss.state     = 'idle';
      boss.bobOffset = 0;
      boss.roaring   = false;
      this._drawBoss(ctx, boss);
    }

    // GAME OVER — blinking white early, solid red after
    const blinks   = Math.floor(this._t / 0.22);
    const blinking = this._t < 1.2;
    const visible  = !blinking || blinks % 2 === 0;
    if (visible) {
      ctx.font = 'bold 32px "Press Start 2P", "Courier New", monospace';
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
    const colors = { harpy:'#CC88EE', wolf:'#1A1E2A', imp:'#DD5544', boar:'#CC6633' };
    const c = colors[enemy.type] || '#FFFFFF';
    for (let i = 0; i < 12; i++)
      this._particles.push({ x:enemy.x+Math.random()*40, y:enemy.y+Math.random()*30, color:c, vx:(Math.random()-0.5)*100, vy:-60-Math.random()*60, size:2+Math.random()*4, life:0.6+Math.random()*0.5, maxLife:1.1 });
  }

  _spawnSpriteParticles(oc, worldX, worldY) {
    if (!oc) return;
    const d    = oc.getContext('2d').getImageData(0, 0, oc.width, oc.height).data;
    const step = 3;
    for (let py = 0; py < oc.height; py += step) {
      for (let px = 0; px < oc.width; px += step) {
        const i = (py * oc.width + px) * 4;
        if (d[i + 3] < 128) continue;
        const color = `#${d[i].toString(16).padStart(2,'0')}${d[i+1].toString(16).padStart(2,'0')}${d[i+2].toString(16).padStart(2,'0')}`;
        this._particles.push({
          x: worldX + px, y: worldY + py,
          color,
          vx: (Math.random() - 0.5) * 160,
          vy: -90 - Math.random() * 90,
          size: step + 1,
          life: 0.5 + Math.random() * 0.5,
          maxLife: 1.0,
        });
      }
    }
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

// (Color palette constants removed — sprites are now drawn from JSON pixel art data.)

PackageRegistry.registerEffect(new SideScrollerEffect());
