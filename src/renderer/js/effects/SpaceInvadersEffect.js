'use strict';
/**
 * SpaceInvadersEffect — Background Space Invaders random event.
 * Extends VisualEffect. Registered under id 'spaceInvaders'.
 *
 * Confined entirely to #output-panel (the left chat area).
 * Canvas clips to that panel's bounding rect so nothing spills elsewhere.
 *
 * Sequence: ship slides in from right edge → shields & enemies blink in →
 *           1.5 s pause → active game → outro blink + crumble.
 *
 * Canvas sits at z-index: 2 — above arcade border (z:1), below tv glass (z:15).
 * Rendered at 40% globalAlpha — purely a background novelty effect.
 */
class SpaceInvadersEffect extends VisualEffect {

  // ── Tuning ────────────────────────────────────────────────────────────────
  static PIX             = 3;    // screen px per game px
  static ACTIVE_DURATION = 55;   // seconds
  static ENEMY_SPEED     = 60;   // px/s horizontal march
  static ENEMY_DROP_Y    = 18;   // px downward step per direction reversal
  static PLAYER_FIRE_MIN = 0.30; // fastest burst interval
  static PLAYER_FIRE_MAX = 2.60; // slowest interval
  static ENEMY_FIRE      = 1.3;  // seconds between enemy shots
  static BULLET_SPEED    = 270;  // px/s

  constructor() {
    super('spaceInvaders');
    this._canvas          = null;
    this._ctx             = null;
    this._rAF             = null;
    this._state           = 'idle'; // idle|slide-in|blink-in|pause|active|outro
    this._lastTs          = 0;
    this._t               = 0;
    this._ship            = null;
    this._enemies         = [];
    this._shields         = [];
    this._bullets         = [];
    this._particles       = [];
    this._enemyDirX       = 1;
    this._animTimer       = 0;
    this._animFrame       = 0;
    this._lastPlayerFire  = 0;
    this._nextPlayerFire  = 0;
    this._lastEnemyFire   = 0;
    this._blinkInT        = 0;
    this._blinkVis        = true;
    this._crumbleStarted  = false;
    this._shipHitTimer    = 0;   // > 0 → ship is flashing white
    this._explosions      = [];  // [{x,y,w,h,t,maxT,color}]
  }

  // ── VisualEffect hooks ────────────────────────────────────────────────────

  _onStart(config) { this._initCanvas(); }

  _onStop() {
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._state = 'idle';
    if (this._ctx) this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  // ── Canvas init ───────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return true;
    this._canvas = document.getElementById('bg-space-invaders');
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
  }

  // ── Game area — confined to the left output panel ─────────────────────────

  _gameArea() {
    const el = document.getElementById('output-panel');
    if (!el) return { x: 10, y: 40, w: 700, h: 500 };
    const r = el.getBoundingClientRect();
    // Small inset so entities don't hug the panel border
    return { x: r.left + 10, y: r.top + 10, w: r.width - 20, h: r.height - 20 };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** True while a game sequence is running (not idle). Use to gate spawn button. */
  get busy() { return this._state !== 'idle'; }

  spawn() {
    if (!this._initCanvas()) return;
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    const ga = this._gameArea();
    this._buildScene(ga);
    this._state  = 'slide-in';
    this._lastTs = 0;
    this._t      = 0;
    this._rAF    = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Scene setup ───────────────────────────────────────────────────────────

  _buildScene(ga) {
    const P  = SpaceInvadersEffect.PIX;

    // Player ship — will slide in from the right edge of the game area
    const sw = SI_SHIP[0].length * P;
    const sh = SI_SHIP.length    * P;
    const shipY = ga.y + ga.h * 0.88;
    this._ship = {
      x:         ga.x + ga.w + 10,   // starts just off the right edge
      y:         Math.min(shipY, ga.y + ga.h - sh - 4),
      targetX:   0,   // set below after formation bounds are known
      w:  sw, h: sh,
      // Movement AI
      planX:        0,
      planSpeed:    300,
      planTimer:    0,
      planInterval: 0,
    };

    // Enemy formation — 3 rows × 8 cols
    this._enemies = [];
    const COLS = 8, ROWS = 3;
    const EW = 12 * P, EH = 8 * P;
    const GAP_X = 5 * P, GAP_Y = 4 * P;
    const totalEW = COLS * EW + (COLS - 1) * GAP_X;
    const ex0     = ga.x + (ga.w - totalEW) / 2;
    const ey0     = ga.y + ga.h * 0.08;
    // Store formation bounds so the ship AI can reference them
    this._formX = ex0;
    this._formW = totalEW;
    // Ship parks at formation center after slide-in
    const formCenter = ex0 + (totalEW - sw) / 2;
    this._ship.targetX = formCenter;
    this._ship.planX   = formCenter;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        this._enemies.push({
          type: ['squid', 'crab', 'octopus'][row],
          x: ex0 + col * (EW + GAP_X),
          y: ey0 + row * (EH + GAP_Y),
          w: EW, h: EH,
          alive: true,
        });
      }
    }

    // Shields — 4 bunkers at 72% height, evenly spaced
    this._shields = [];
    const SW = 22 * P, SH = 16 * P;
    const sY = ga.y + ga.h * 0.72;
    for (let i = 0; i < 4; i++) {
      this._shields.push({
        x:  ga.x + ga.w * (i + 1) / 5 - SW / 2,
        y:  sY,
        w:  SW, h: SH,
        px: new Uint8Array(22 * 16).fill(1),
      });
    }

    this._bullets         = [];
    this._particles       = [];
    this._enemyDirX       = 1;
    this._animTimer       = 0;
    this._animFrame       = 0;
    this._lastPlayerFire  = 0;
    this._nextPlayerFire  = this._randFireInterval();
    this._lastEnemyFire   = 0;
    this._blinkInT        = 0;
    this._blinkVis        = true;
    this._crumbleStarted  = false;
    this._shipHitTimer    = 0;
    this._explosions      = [];
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  _tick(ts) {
    if (this._state === 'idle') { this._rAF = null; return; }
    if (this._lastTs === 0) this._lastTs = ts;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.10);
    this._lastTs = ts;
    this._t += dt;

    const ga  = this._gameArea();
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    // Clip all drawing to the game area
    ctx.save();
    ctx.beginPath();
    ctx.rect(ga.x, ga.y, ga.w, ga.h);
    ctx.clip();

    switch (this._state) {
      case 'slide-in': this._updateSlideIn(dt, ga); break;
      case 'blink-in': this._updateBlinkIn(dt, ga); break;
      case 'pause':    this._updatePause(dt, ga);   break;
      case 'active':   this._updateActive(dt, ga);  break;
      case 'outro':    this._updateOutro(dt, ga);   break;
    }

    ctx.restore();

    if (this._state !== 'idle') {
      this._rAF = requestAnimationFrame(ts => this._tick(ts));
    } else {
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._rAF = null;
    }
  }

  // ── Phase: slide-in — ship enters from right edge ─────────────────────────

  _updateSlideIn(dt, ga) {
    this._ship.x -= 400 * dt;
    if (this._ship.x <= this._ship.targetX) {
      this._ship.x  = this._ship.targetX;
      this._state   = 'blink-in';
      this._t       = 0;
      this._blinkInT = 0;
    }
    this._drawScene(true, false, false);
  }

  // ── Phase: blink-in — shields & enemies flash into existence ──────────────

  _updateBlinkIn(dt, ga) {
    this._blinkInT += dt;
    this._blinkVis = Math.floor(this._blinkInT / 0.10) % 2 === 0;
    if (this._blinkInT >= 0.80) {
      this._blinkVis = true;
      this._state    = 'pause';
      this._t        = 0;
    }
    // Ship always solid; shields + enemies blink
    this._drawScene(true, this._blinkVis, false);
  }

  // ── Phase: pause — everything frozen, giving a moment to see the scene ────

  _updatePause(dt, ga) {
    if (this._t >= 1.5) {
      this._state = 'active';
      this._t     = 0;
      this._planShipMove(ga);  // kick off ship AI
    }
    this._drawScene(true, true, false);
  }

  // ── Ship movement AI ──────────────────────────────────────────────────────

  _planShipMove(ga) {
    // Ship roams within the enemy formation width (+/- small overshoot)
    const overshoot = 18;
    const minX = this._formX - overshoot;
    const maxX = this._formX + this._formW - this._ship.w + overshoot;
    const roll = Math.random();

    if (roll < 0.40) {
      // DART — jump to a distant position fast
      let newX;
      do { newX = minX + Math.random() * (maxX - minX); }
      while (Math.abs(newX - this._ship.x) < (maxX - minX) * 0.25);
      this._ship.planX        = newX;
      this._ship.planSpeed    = 290 + Math.random() * 130;
      this._ship.planInterval = 0.3 + Math.random() * 0.5;
    } else if (roll < 0.65) {
      // DRIFT — slow slide
      const dir  = Math.random() < 0.5 ? -1 : 1;
      const dist = 55 + Math.random() * 110;
      this._ship.planX        = Math.max(minX, Math.min(maxX, this._ship.x + dir * dist));
      this._ship.planSpeed    = 50 + Math.random() * 55;
      this._ship.planInterval = 1.4 + Math.random() * 1.6;
    } else if (roll < 0.85) {
      // JUKE — short quick dodge
      const dir  = Math.random() < 0.5 ? -1 : 1;
      const dist = 70 + Math.random() * 80;
      this._ship.planX        = Math.max(minX, Math.min(maxX, this._ship.x + dir * dist));
      this._ship.planSpeed    = 190 + Math.random() * 110;
      this._ship.planInterval = 0.5 + Math.random() * 0.7;
    } else {
      // HOVER — hold still
      this._ship.planX        = this._ship.x;
      this._ship.planSpeed    = 0;
      this._ship.planInterval = 0.6 + Math.random() * 1.1;
    }
    this._ship.planTimer = 0;
  }

  _updateShipMove(dt, ga) {
    const dx   = this._ship.planX - this._ship.x;
    const step = this._ship.planSpeed * dt;
    if (Math.abs(dx) <= step) {
      this._ship.x = this._ship.planX;
    } else {
      this._ship.x += Math.sign(dx) * step;
    }

    // Clamp to formation bounds + small overshoot
    const overshoot = 18;
    this._ship.x = Math.max(this._formX - overshoot,
                   Math.min(this._formX + this._formW - this._ship.w + overshoot, this._ship.x));

    this._ship.planTimer += dt;
    const hovering = this._ship.planSpeed === 0;
    const arrived  = !hovering && Math.abs(this._ship.planX - this._ship.x) < 2;
    if (arrived || this._ship.planTimer >= this._ship.planInterval) {
      this._planShipMove(ga);
    }
  }

  // ── Enemy march (classic Space Invaders) ──────────────────────────────────

  _moveEnemies(dt, ga) {
    const alive = this._enemies.filter(e => e.alive);
    if (!alive.length) return;

    const step = SpaceInvadersEffect.ENEMY_SPEED * dt * this._enemyDirX;
    let minX = Infinity, maxX = -Infinity;
    for (const e of alive) {
      if (e.x < minX)       minX = e.x;
      if (e.x + e.w > maxX) maxX = e.x + e.w;
    }

    const pad = 14;
    if (maxX + step > ga.x + ga.w - pad || minX + step < ga.x + pad) {
      // Hit boundary — reverse direction and drop one step
      this._enemyDirX *= -1;
      for (const e of this._enemies) e.y += SpaceInvadersEffect.ENEMY_DROP_Y;
    } else {
      for (const e of this._enemies) e.x += step;
    }
    // No continuous Y drift — only drop on direction reversal (classic behaviour)
  }

  // ── Bullets ───────────────────────────────────────────────────────────────

  _moveBullets(dt, ga) {
    for (const b of this._bullets) b.y += b.dy * dt;

    const P = SpaceInvadersEffect.PIX;

    // Helper: bullet vs shield collision
    const hitShield = (b) => {
      for (const s of this._shields) {
        if (b.x >= s.x && b.x <= s.x + s.w &&
            b.y >= s.y && b.y <= s.y + s.h) {
          const col = Math.floor((b.x - s.x) / P);
          const row = Math.floor((b.y - s.y) / P);
          if (col >= 0 && col < 22 && row >= 0 && row < 16) {
            const idx = row * 22 + col;
            if (s.px[idx] && SI_SHIELD[row]?.[col] === '#') {
              s.px[idx] = 0;
              b.dead = true;
              return true;
            }
          }
        }
      }
      return false;
    };

    // Player bullets: shields first, then enemies
    for (const b of this._bullets) {
      if (b.type !== 'player' || b.dead) continue;
      if (hitShield(b)) continue;
      for (const e of this._enemies) {
        if (!e.alive) continue;
        if (b.x >= e.x - 2 && b.x <= e.x + e.w + 2 &&
            b.y >= e.y     && b.y <= e.y + e.h) {
          e.alive = false;
          b.dead  = true;
          // Firework burst at enemy centre
          const baseColor = { squid: '#ffee00', crab: '#00dd44', octopus: '#ff4400' }[e.type];
          const palette   = [baseColor, '#ffffff', '#ffaa00'];
          const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
          const count = 9 + Math.floor(Math.random() * 5);   // 9–13 sparks
          const sparks = [];
          for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.35;
            const speed = 50 + Math.random() * 120;
            sparks.push({
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: palette[Math.floor(Math.random() * palette.length)],
              size:  1 + Math.floor(Math.random() * 2),  // 1 or 2 game-px
            });
          }
          this._explosions.push({ cx, cy, t: 0, maxT: 0.44, sparks });
          break;
        }
      }
    }

    // Enemy bullets: shields, then ship
    for (const b of this._bullets) {
      if (b.type !== 'enemy' || b.dead) continue;
      if (hitShield(b)) continue;
      // Check ship hit
      if (b.x >= this._ship.x && b.x <= this._ship.x + this._ship.w &&
          b.y >= this._ship.y && b.y <= this._ship.y + this._ship.h) {
        b.dead = true;
        this._shipHitTimer = 0.44; // ~6 rapid white-flash blinks
      }
    }

    // Cull off-screen
    const H = this._canvas.height;
    this._bullets = this._bullets.filter(b => !b.dead && b.y > -20 && b.y < H + 20);
  }

  // ── Phase: active ─────────────────────────────────────────────────────────

  _updateActive(dt, ga) {
    if (this._t >= SpaceInvadersEffect.ACTIVE_DURATION) {
      this._state          = 'outro';
      this._t              = 0;
      this._blinkVis       = true;
      this._crumbleStarted = false;
      return;
    }

    this._animTimer += dt;
    if (this._animTimer >= 0.6) { this._animTimer = 0; this._animFrame ^= 1; }

    if (this._shipHitTimer > 0) this._shipHitTimer = Math.max(0, this._shipHitTimer - dt);
    for (let i = this._explosions.length - 1; i >= 0; i--) {
      this._explosions[i].t += dt;
      if (this._explosions[i].t >= this._explosions[i].maxT) this._explosions.splice(i, 1);
    }

    this._updateShipMove(dt, ga);
    this._moveEnemies(dt, ga);
    this._moveBullets(dt, ga);

    // Player fire — randomised interval, leaning toward occasional bursts
    this._lastPlayerFire += dt;
    if (this._lastPlayerFire >= this._nextPlayerFire) {
      this._lastPlayerFire = 0;
      this._nextPlayerFire = this._randFireInterval();
      this._bullets.push({
        x: this._ship.x + this._ship.w / 2,
        y: this._ship.y,
        dy: -SpaceInvadersEffect.BULLET_SPEED,
        type: 'player',
      });
    }

    // Enemy fire
    this._lastEnemyFire += dt;
    if (this._lastEnemyFire >= SpaceInvadersEffect.ENEMY_FIRE) {
      this._lastEnemyFire = 0;
      const alive = this._enemies.filter(e => e.alive);
      if (alive.length) {
        const e = alive[Math.floor(Math.random() * alive.length)];
        this._bullets.push({
          x:    e.x + e.w / 2,
          y:    e.y + e.h,
          dy:   SpaceInvadersEffect.BULLET_SPEED * 0.52,
          type: 'enemy',
        });
      }
    }

    this._drawScene(true, true, true);
  }

  // ── Fire interval randomiser ─────────────────────────────────────────────
  // 30% chance of a fast burst (0.30–0.75s), 70% moderate (0.90–2.60s)
  _randFireInterval() {
    if (Math.random() < 0.30) {
      return SpaceInvadersEffect.PLAYER_FIRE_MIN
           + Math.random() * (0.75 - SpaceInvadersEffect.PLAYER_FIRE_MIN);
    }
    return 0.90 + Math.random() * (SpaceInvadersEffect.PLAYER_FIRE_MAX - 0.90);
  }

  // ── Phase: outro — blink then crumble ─────────────────────────────────────

  _updateOutro(dt, ga) {
    const BLINK_DUR = 2.8;
    const BLINK_INT = 0.12;

    if (this._t < BLINK_DUR) {
      this._blinkVis = Math.floor(this._t / BLINK_INT) % 2 === 0;
      if (this._blinkVis) this._drawScene(true, true, false);
    } else {
      if (!this._crumbleStarted) {
        this._crumbleStarted = true;
        this._spawnParticles();
      }
      for (const p of this._particles) {
        p.vy    += 380 * dt;
        p.vx    += (Math.random() - 0.5) * 20 * dt;
        p.x     += p.vx * dt;
        p.y     += p.vy * dt;
        p.alpha -= 0.48 * dt;
      }
      this._particles = this._particles.filter(p => p.alpha > 0);
      this._drawParticles();
      if (this._particles.length === 0) this._state = 'idle';
    }
  }

  _spawnParticles() {
    const P = SpaceInvadersEffect.PIX;
    const mkPts = (x, y, w, h, color) => {
      const n = Math.max(4, Math.floor(w * h / (P * P * 4)));
      for (let i = 0; i < n; i++) {
        this._particles.push({
          x: x + Math.random() * w,
          y: y + Math.random() * h,
          vx: (Math.random() - 0.5) * 80,
          vy: -30 + Math.random() * 60,
          size: P * (0.5 + Math.random()),
          color,
          alpha: 0.9,
        });
      }
    };
    mkPts(this._ship.x, this._ship.y, this._ship.w, this._ship.h, '#ffee00');
    const ec = { squid: '#ffee00', crab: '#00dd44', octopus: '#ff4400' };
    for (const e of this._enemies) {
      if (e.alive) mkPts(e.x, e.y, e.w, e.h, ec[e.type]);
    }
    for (const s of this._shields) mkPts(s.x, s.y, s.w, s.h, '#00dd44');
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  // drawShip: always draw ship; drawFormation: draw shields + enemies; drawBullets
  _drawScene(drawShip, drawFormation, drawBullets) {
    const ctx = this._ctx;
    ctx.save();
    ctx.globalAlpha = 0.42;
    if (drawFormation) { this._drawShields(); this._drawEnemies(); }
    this._drawExplosions();
    if (drawShip)      this._drawShip();
    if (drawBullets)   this._drawBullets();
    ctx.restore();
  }

  _drawExplosions() {
    if (!this._explosions.length) return;
    const P = SpaceInvadersEffect.PIX, ctx = this._ctx;
    for (const ex of this._explosions) {
      const alpha = 1.0 - ex.t / ex.maxT;
      ctx.save();
      for (const sp of ex.sparks) {
        const px = ex.cx + sp.vx * ex.t;
        const py = ex.cy + sp.vy * ex.t;
        const sz = sp.size * P;
        ctx.globalAlpha = 0.42 * alpha;
        ctx.fillStyle   = sp.color;
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
      ctx.restore();
    }
  }

  _drawShip() {
    const P = SpaceInvadersEffect.PIX, ctx = this._ctx;
    // When hit: rapid white/invisible blink (cycle every 0.07s)
    if (this._shipHitTimer > 0) {
      if (Math.floor(this._shipHitTimer / 0.07) % 2 === 0) return; // invisible frame
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = '#ffee00';
    }
    for (let r = 0; r < SI_SHIP.length; r++)
      for (let c = 0; c < SI_SHIP[r].length; c++)
        if (SI_SHIP[r][c] === '#')
          ctx.fillRect(this._ship.x + c * P, this._ship.y + r * P, P, P);
  }

  _drawEnemies() {
    const P = SpaceInvadersEffect.PIX, ctx = this._ctx;
    const colors = { squid: '#ffee00', crab: '#00dd44', octopus: '#ff4400' };
    for (const e of this._enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = colors[e.type];
      const sprite  = SI_INVADERS[e.type][this._animFrame];
      for (let r = 0; r < sprite.length; r++)
        for (let c = 0; c < sprite[r].length; c++)
          if (sprite[r][c] === '#')
            ctx.fillRect(e.x + c * P, e.y + r * P, P, P);
    }
  }

  _drawShields() {
    const P = SpaceInvadersEffect.PIX, ctx = this._ctx;
    ctx.fillStyle = '#00dd44';
    for (const s of this._shields) {
      for (let i = 0; i < s.px.length; i++) {
        if (!s.px[i]) continue;
        const c = i % 22, r = Math.floor(i / 22);
        if (SI_SHIELD[r]?.[c] === '#')
          ctx.fillRect(s.x + c * P, s.y + r * P, P, P);
      }
    }
  }

  _drawBullets() {
    const P = SpaceInvadersEffect.PIX, ctx = this._ctx;
    for (const b of this._bullets) {
      ctx.fillStyle = b.type === 'player' ? '#ffffff' : '#ff6600';
      ctx.fillRect(b.x - 1, b.y - P, 2, P * 3);
    }
  }

  _drawParticles() {
    const ctx = this._ctx;
    for (const p of this._particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.42;
      ctx.fillStyle   = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    }
  }
}

// ── Sprite data ───────────────────────────────────────────────────────────────

// Player ship — 9×7 game pixels
const SI_SHIP = [
  '    #    ',
  '   ###   ',
  '  #####  ',
  '#########',
  '#########',
  ' ##   ## ',
  '  #   #  ',
];

// Enemies — 2 animation frames each
const SI_INVADERS = {

  squid: [   // top row — 8×8
    [
      '   ##   ',
      '  ####  ',
      ' ###### ',
      '## ## ##',
      '########',
      ' # ## # ',
      '#      #',
      ' #    # ',
    ],
    [
      '   ##   ',
      '  ####  ',
      ' ###### ',
      '## ## ##',
      '########',
      '  ####  ',
      ' #    # ',
      '#      #',
    ],
  ],

  crab: [    // middle row — 11×8
    [
      '  #   #  ',
      '   # #   ',
      '  #####  ',
      ' ## # ## ',
      '##  #  ##',
      '#  ###  #',
      '  #   #  ',
      ' #     # ',
    ],
    [
      '  #   #  ',
      '#  # #  #',
      ' ####### ',
      '## # # ##',
      '###   ###',
      ' ##   ## ',
      '#  # #  #',
      '  ## ##  ',
    ],
  ],

  octopus: [ // bottom row — 10×8
    [
      '  ######  ',
      '##########',
      '## #### ##',
      '##########',
      '  ##  ##  ',
      ' ###  ### ',
      '#  #  #  #',
      '  #    #  ',
    ],
    [
      '  ######  ',
      '##########',
      '## #### ##',
      '##########',
      '###    ###',
      ' # #### # ',
      '# #    # #',
      ' ##    ## ',
    ],
  ],
};

// Shield bunker shape — exactly 22 wide × 16 tall
const SI_SHIELD = [
  '     ############     ',
  '   ################   ',
  '  ##################  ',
  ' #################### ',
  '######################',
  '######################',
  '######################',
  '######################',
  '######################',
  '######################',
  '######################',
  '########      ########',
  '#######        #######',
  '######          ######',
  '#####            #####',
  '####              ####',
];

PackageRegistry.registerEffect(new SpaceInvadersEffect());
