'use strict';
/**
 * AsteroidsEffect — Arcade Cabinet "ASTEROIDS" random event.
 * Registered under id 'asteroids'. Used by: Arcade Cabinet package.
 *
 * States: idle → intro → active → outro → idle
 *
 * intro  (2s)  : Ship drifts in from left, blinking (invincible). At t=1.0s
 *                large asteroids spawn from the frame edges and drift inward.
 * active (60s) : Ship AI hunts asteroids. Large → 2-3 mediums → 2-3 smalls.
 *                Smalls are one-hit / no split. Ship wraps around edges.
 *                When alive count drops low, a fresh large drifts in from an edge.
 * outro  (5.5s): All entities blink rapidly, then crumble into falling pixel rain.
 *
 * Canvas: #bg-asteroids (z-index: 2, same as space invaders — events never overlap).
 */
class AsteroidsEffect extends VisualEffect {

  // ── Tuning ────────────────────────────────────────────────────────────────
  static ACTIVE_DURATION   = 60;    // seconds of active gameplay
  static SHIP_ROT_SPEED    = 3.8;   // rad/s rotation speed (AI turns toward target)
  static SHIP_THRUST       = 195;   // px/s² acceleration when thrusting
  static SHIP_MAXSPEED     = 255;   // px/s cap
  static BULLET_SPEED      = 430;   // px/s
  static BULLET_LIFE       = 1.5;   // seconds before bullet expires
  static FIRE_INTERVAL     = 0.52;  // seconds between shots
  static INVINC_DUR        = 2.2;   // seconds of invincibility after respawn
  static ASTEROID_COUNT    = 5;     // initial large asteroids (spawned from edges)
  static THRUST_ON_TIME    = 0.65;  // seconds of thrust per burst
  static THRUST_OFF_TIME   = 1.6;   // seconds between thrust bursts
  static MIN_ASTEROID_CT   = 4;     // trigger replacement when alive count < this

  constructor() {
    super('asteroids');
    this._canvas          = null;
    this._ctx             = null;
    this._rAF             = null;
    this._state           = 'idle';
    this._t               = 0;
    this._lastTs          = 0;

    this._ship            = null;
    this._asteroids       = [];
    this._bullets         = [];
    this._explosions      = [];   // [{cx,cy,t,maxT,sparks:[{vx,vy,color,size}]}]
    this._particles       = [];   // crumble pixels

    this._fireCooldown    = 0;
    this._thrustTimer     = 0;
    this._thrusting       = false;
    this._blinkVis        = true;
    this._crumbleStarted  = false;
    this._introAstSpawned = false;
    this._spawnCooldown   = 0;    // seconds before next edge spawn is allowed
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** True while a sequence is running. Used to gate all event spawn buttons. */
  get busy() { return this._state !== 'idle'; }

  spawn() {
    if (!this._initCanvas()) return;
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._buildScene();
    this._state          = 'intro';
    this._t              = 0;
    this._lastTs         = 0;
    this._blinkVis       = true;
    this._crumbleStarted = false;
    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── VisualEffect hooks ────────────────────────────────────────────────────

  _onStart(config) { this._initCanvas(); }

  _onStop() {
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._state = 'idle';
    if (this._ctx && this._canvas)
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * dismiss() — called when the user sends a message mid-event.
   * Immediately skips to the pixel-crumble outro, bypassing the blink phase.
   * Rule: every event effect MUST implement this and jump straight to crumble.
   */
  dismiss() {
    if (this._state === 'idle') return;
    this._state          = 'outro';
    this._t              = 2.5 + 1;   // past BLINK_DUR — skip straight to crumble
    this._crumbleStarted = false;
  }

  // ── Canvas ────────────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return true;
    this._canvas = document.getElementById('bg-asteroids');
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
    return { x: r.left + 8, y: r.top + 8, w: r.width - 16, h: r.height - 16 };
  }

  // ── Scene setup ───────────────────────────────────────────────────────────

  _buildScene() {
    const ga = this._gameArea();
    // Ship enters from the left during intro — no asteroids yet
    this._ship = {
      x:          ga.x - 35,
      y:          ga.y + ga.h * 0.52,
      vx:         58,
      vy:         0,
      angle:      0,          // current heading (radians; 0 = right)
      invincible: AsteroidsEffect.INVINC_DUR,
      alive:      true,
    };
    this._thrusting       = false;
    this._thrustTimer     = 0;
    this._fireCooldown    = 0;
    this._introAstSpawned = false;
    this._spawnCooldown   = 0;
    // Asteroids will be spawned from edges during intro — field starts empty
    this._asteroids  = [];
    this._bullets    = [];
    this._explosions = [];
    this._particles  = [];
  }

  // ── Asteroid spawning ─────────────────────────────────────────────────────

  /** Spawn one asteroid near `center` (splits) or at a random inside position. */
  _spawnAsteroid(size, ga, options = {}) {
    const { center = null, avoidPos = null } = options;
    const radii  = { large: 50, medium: 26, small: 13 };
    const speedR = { large: [28, 52], medium: [48, 82], small: [72, 130] };
    const radius = radii[size];
    const [sMin, sMax] = speedR[size];
    const speed  = sMin + Math.random() * (sMax - sMin);
    const vAngle = Math.random() * Math.PI * 2;

    let x, y;
    if (center) {
      x = center.x + (Math.random() - 0.5) * 44;
      y = center.y + (Math.random() - 0.5) * 44;
      x = Math.max(ga.x + radius, Math.min(ga.x + ga.w - radius, x));
      y = Math.max(ga.y + radius, Math.min(ga.y + ga.h - radius, y));
    } else {
      let attempts = 0;
      do {
        x = ga.x + radius + Math.random() * (ga.w - radius * 2);
        y = ga.y + radius + Math.random() * (ga.h - radius * 2);
        attempts++;
      } while (avoidPos && attempts < 20 &&
               Math.hypot(x - avoidPos.x, y - avoidPos.y) < 130);
    }

    this._asteroids.push({
      x, y,
      vx:       Math.cos(vAngle) * speed,
      vy:       Math.sin(vAngle) * speed,
      size,
      radius,
      shape:    this._genShape(radius),
      angle:    Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.8,
      alive:    true,
      entering: false,  // split/interior spawn — wrap applies immediately
    });
  }

  /**
   * Spawn one asteroid from just outside a random frame edge.
   * Velocity is aimed roughly toward the game area interior.
   * Tagged `entering: true` so wrap logic is suppressed until it crosses the boundary.
   */
  _spawnAsteroidFromEdge(size, ga) {
    const radii  = { large: 50, medium: 26, small: 13 };
    const speedR = { large: [28, 52], medium: [48, 82], small: [72, 130] };
    const radius = radii[size] || 50;
    const [sMin, sMax] = speedR[size] || [28, 52];
    const speed  = sMin + Math.random() * (sMax - sMin);

    const edge = Math.floor(Math.random() * 4); // 0=top 1=right 2=bottom 3=left
    let x, y;
    switch (edge) {
      case 0: x = ga.x + Math.random() * ga.w;  y = ga.y - radius - 4;          break; // top
      case 1: x = ga.x + ga.w + radius + 4;     y = ga.y + Math.random() * ga.h; break; // right
      case 2: x = ga.x + Math.random() * ga.w;  y = ga.y + ga.h + radius + 4;   break; // bottom
      default: x = ga.x - radius - 4;           y = ga.y + Math.random() * ga.h; break; // left
    }

    // Aim toward center of game area with ±50° random spread
    const cx = ga.x + ga.w / 2, cy = ga.y + ga.h / 2;
    const baseAngle = Math.atan2(cy - y, cx - x);
    const vAngle    = baseAngle + (Math.random() - 0.5) * (Math.PI * 0.55);

    this._asteroids.push({
      x, y,
      vx:       Math.cos(vAngle) * speed,
      vy:       Math.sin(vAngle) * speed,
      size,
      radius,
      shape:    this._genShape(radius),
      angle:    Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.8,
      alive:    true,
      entering: true,  // suppress wrap until fully inside the game area
    });
  }

  _genShape(radius) {
    const count = 10 + Math.floor(Math.random() * 4);
    return Array.from({ length: count }, (_, i) => {
      const a = (2 * Math.PI * i / count) + (Math.random() - 0.5) * 0.28;
      const r = radius * (0.70 + Math.random() * 0.30);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  _tick(ts) {
    if (this._state === 'idle') { this._rAF = null; return; }
    if (this._lastTs === 0) this._lastTs = ts;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.10);
    this._lastTs = ts;
    this._t += dt;

    const ga = this._gameArea();
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    switch (this._state) {
      case 'intro':  this._updateIntro(dt, ga);  break;
      case 'active': this._updateActive(dt, ga); break;
      case 'outro':  this._updateOutro(dt, ga);  break;
    }

    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Phase: intro ──────────────────────────────────────────────────────────

  _updateIntro(dt, ga) {
    // After ship has mostly drifted in, spawn asteroids from the frame edges
    if (this._t >= 1.0 && !this._introAstSpawned) {
      this._introAstSpawned = true;
      for (let i = 0; i < AsteroidsEffect.ASTEROID_COUNT; i++)
        this._spawnAsteroidFromEdge('large', ga);
    }

    this._moveAsteroids(dt, ga);

    // Ship drifts in at constant velocity
    this._ship.x += this._ship.vx * dt;
    this._ship.y += this._ship.vy * dt;

    if (this._ship.invincible > 0) {
      this._ship.invincible -= dt;
      this._blinkVis = Math.floor(this._ship.invincible / 0.14) % 2 === 0;
    }

    if (this._t >= 2.0) {
      // Kill drift before handing off to AI
      this._ship.vx = 0;
      this._ship.vy = 0;
      this._state   = 'active';
      this._t       = 0;
    }

    this._drawScene(ga, true, false);
  }

  // ── Phase: active ─────────────────────────────────────────────────────────

  _updateActive(dt, ga) {
    if (this._t >= AsteroidsEffect.ACTIVE_DURATION) {
      this._state          = 'outro';
      this._t              = 0;
      this._blinkVis       = true;
      this._crumbleStarted = false;
      return;
    }

    this._moveAsteroids(dt, ga);
    this._moveBullets(dt, ga);

    if (this._ship.alive) {
      this._updateShipAI(dt, ga);
      this._ship.x += this._ship.vx * dt;
      this._ship.y += this._ship.vy * dt;
      // Wrap around edges — classic Asteroids behaviour, maintains speed + direction
      if      (this._ship.x < ga.x - 12)           this._ship.x = ga.x + ga.w + 12;
      else if (this._ship.x > ga.x + ga.w + 12)    this._ship.x = ga.x - 12;
      if      (this._ship.y < ga.y - 12)           this._ship.y = ga.y + ga.h + 12;
      else if (this._ship.y > ga.y + ga.h + 12)    this._ship.y = ga.y - 12;
    }

    // Keep the field populated — when things get sparse, drift a new large in from an edge
    if (this._spawnCooldown > 0) this._spawnCooldown -= dt;
    if (this._asteroids.filter(a => a.alive).length < AsteroidsEffect.MIN_ASTEROID_CT
        && this._spawnCooldown <= 0) {
      this._spawnAsteroidFromEdge('large', ga);
      this._spawnCooldown = 4.0;
    }

    // Age explosions
    for (let i = this._explosions.length - 1; i >= 0; i--) {
      this._explosions[i].t += dt;
      if (this._explosions[i].t >= this._explosions[i].maxT) this._explosions.splice(i, 1);
    }

    this._checkBulletAsteroid(ga);
    if (this._ship.alive && this._ship.invincible <= 0)
      this._checkShipAsteroid(ga);

    // Invincibility blink — extend the grace period if ship is still overlapping an asteroid
    if (this._ship.invincible > 0) {
      this._ship.invincible -= dt;
      if (this._ship.invincible <= 0 && this._isShipTouchingAsteroid()) {
        this._ship.invincible = 0.35;  // brief extension; repeats until clear
      }
      this._blinkVis = this._ship.invincible > 0
        ? Math.floor(this._ship.invincible / 0.12) % 2 === 0
        : true;
    } else {
      this._blinkVis = true;
    }

    if (this._fireCooldown > 0) this._fireCooldown -= dt;

    this._drawScene(ga, true, true);
  }

  // ── Phase: outro ──────────────────────────────────────────────────────────

  _updateOutro(dt, ga) {
    const BLINK_DUR = 2.5;
    const BLINK_INT = 0.09;

    if (this._t < BLINK_DUR) {
      this._blinkVis = Math.floor(this._t / BLINK_INT) % 2 === 0;
      this._moveAsteroids(dt, ga);
      if (this._blinkVis) this._drawAsteroidsRaw(ga);
      return;
    }

    if (!this._crumbleStarted) {
      this._crumbleStarted = true;
      this._buildCrumble();
    }

    for (const p of this._particles) {
      p.vy   += 310 * dt;
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.life -= dt;
    }
    this._particles = this._particles.filter(p => p.life > 0 && p.y < this._canvas.height + 20);

    for (const p of this._particles) {
      this._ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.80;
      this._ctx.fillStyle   = p.color;
      this._ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    this._ctx.globalAlpha = 1;

    if (this._particles.length === 0 || this._t > BLINK_DUR + 3.8) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._state = 'idle';
    }
  }

  _buildCrumble() {
    const COLORS = { large: '#cccccc', medium: '#aaaaaa', small: '#888888' };
    for (const ast of this._asteroids) {
      if (!ast.alive) continue;
      const count = Math.floor(ast.radius * 0.85);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * ast.radius;
        this._particles.push({
          x:       ast.x + Math.cos(a) * r,
          y:       ast.y + Math.sin(a) * r,
          vx:      (Math.random() - 0.5) * 55,
          vy:      -25 + Math.random() * 25,
          size:    Math.random() < 0.28 ? 4 : 2,
          color:   COLORS[ast.size],
          life:    1.1 + Math.random() * 1.5,
          maxLife: 2.6,
        });
      }
    }
    if (this._ship.alive) {
      for (let i = 0; i < 16; i++) {
        this._particles.push({
          x:       this._ship.x + (Math.random() - 0.5) * 26,
          y:       this._ship.y + (Math.random() - 0.5) * 26,
          vx:      (Math.random() - 0.5) * 130,
          vy:      -90 - Math.random() * 70,
          size:    Math.random() < 0.4 ? 4 : 2,
          color:   '#ffee00',
          life:    1.4 + Math.random() * 1.2,
          maxLife: 2.6,
        });
      }
    }
  }

  // ── Ship AI ───────────────────────────────────────────────────────────────

  _updateShipAI(dt, ga) {
    const ship = this._ship;

    // Nearest alive asteroid (favour larger ones)
    let nearest = null, nearScore = Infinity;
    for (const ast of this._asteroids) {
      if (!ast.alive) continue;
      const d     = Math.hypot(ast.x - ship.x, ast.y - ship.y);
      const score = d / (ast.size === 'large' ? 0.6 : ast.size === 'medium' ? 0.8 : 1.0);
      if (score < nearScore) { nearScore = score; nearest = ast; }
    }

    if (nearest) {
      const targetAngle = Math.atan2(nearest.y - ship.y, nearest.x - ship.x);
      const diff        = this._angleDiff(targetAngle, ship.angle);
      const rotStep     = AsteroidsEffect.SHIP_ROT_SPEED * dt;
      ship.angle += Math.sign(diff) * Math.min(Math.abs(diff), rotStep);

      // Fire when aimed within ~9°
      if (Math.abs(diff) < 0.16 && this._fireCooldown <= 0) {
        this._fireCooldown = AsteroidsEffect.FIRE_INTERVAL;
        this._bullets.push({
          x:    ship.x + Math.cos(ship.angle) * 18,
          y:    ship.y + Math.sin(ship.angle) * 18,
          vx:   Math.cos(ship.angle) * AsteroidsEffect.BULLET_SPEED + ship.vx,
          vy:   Math.sin(ship.angle) * AsteroidsEffect.BULLET_SPEED + ship.vy,
          life: AsteroidsEffect.BULLET_LIFE,
        });
      }

      // Burst thrust
      this._thrustTimer -= dt;
      if (this._thrustTimer <= 0) {
        this._thrusting   = !this._thrusting;
        this._thrustTimer = this._thrusting
          ? AsteroidsEffect.THRUST_ON_TIME  * (0.5 + Math.random() * 0.9)
          : AsteroidsEffect.THRUST_OFF_TIME * (0.4 + Math.random());
      }
      if (this._thrusting) {
        ship.vx += Math.cos(ship.angle) * AsteroidsEffect.SHIP_THRUST * dt;
        ship.vy += Math.sin(ship.angle) * AsteroidsEffect.SHIP_THRUST * dt;
      }
    }

    // Speed cap
    const spd = Math.hypot(ship.vx, ship.vy);
    if (spd > AsteroidsEffect.SHIP_MAXSPEED) {
      const ratio = AsteroidsEffect.SHIP_MAXSPEED / spd;
      ship.vx *= ratio;
      ship.vy *= ratio;
    }
  }

  _angleDiff(target, current) {
    let d = target - current;
    while (d >  Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  _moveAsteroids(dt, ga) {
    for (const ast of this._asteroids) {
      if (!ast.alive) continue;
      ast.x     += ast.vx * dt;
      ast.y     += ast.vy * dt;
      ast.angle += ast.rotSpeed * dt;

      if (ast.entering) {
        // Suppress wrap until the asteroid has crossed inside the game area boundary
        const inX = ast.x > ga.x - ast.radius && ast.x < ga.x + ga.w + ast.radius;
        const inY = ast.y > ga.y - ast.radius && ast.y < ga.y + ga.h + ast.radius;
        if (inX && inY) ast.entering = false;
      } else {
        // Wrap around game area edges
        if (ast.x < ga.x - ast.radius)           ast.x = ga.x + ga.w + ast.radius;
        if (ast.x > ga.x + ga.w + ast.radius)    ast.x = ga.x - ast.radius;
        if (ast.y < ga.y - ast.radius)           ast.y = ga.y + ga.h + ast.radius;
        if (ast.y > ga.y + ga.h + ast.radius)    ast.y = ga.y - ast.radius;
      }
    }
  }

  _moveBullets(dt, ga) {
    for (const b of this._bullets) {
      b.x    += b.vx * dt;
      b.y    += b.vy * dt;
      b.life -= dt;
    }
    this._bullets = this._bullets.filter(b =>
      b.life > 0 &&
      b.x > ga.x - 30 && b.x < ga.x + ga.w + 30 &&
      b.y > ga.y - 30 && b.y < ga.y + ga.h + 30
    );
  }

  // ── Collisions ────────────────────────────────────────────────────────────

  _checkBulletAsteroid(ga) {
    for (const b of this._bullets) {
      if (b.dead) continue;
      for (const ast of this._asteroids) {
        if (!ast.alive) continue;
        if (Math.hypot(b.x - ast.x, b.y - ast.y) < ast.radius) {
          b.dead = true;
          this._hitAsteroid(ast, ga);
          break;
        }
      }
    }
    this._bullets   = this._bullets.filter(b => !b.dead);
    this._asteroids = this._asteroids.filter(a => a.alive);
  }

  _hitAsteroid(ast, ga) {
    ast.alive = false;
    const COLORS = { large: '#cccccc', medium: '#aaaaaa', small: '#888888' };
    this._spawnExplosion(ast.x, ast.y, COLORS[ast.size]);

    if (ast.size === 'large') {
      const count = 2 + Math.floor(Math.random() * 2); // 2–3 mediums
      for (let i = 0; i < count; i++)
        this._spawnAsteroid('medium', ga, { center: { x: ast.x, y: ast.y } });
    } else if (ast.size === 'medium') {
      const count = 2 + Math.floor(Math.random() * 2); // 2–3 smalls
      for (let i = 0; i < count; i++)
        this._spawnAsteroid('small', ga, { center: { x: ast.x, y: ast.y } });
    }
    // smalls: one-hit, no split
  }

  _isShipTouchingAsteroid() {
    for (const ast of this._asteroids) {
      if (!ast.alive) continue;
      if (Math.hypot(this._ship.x - ast.x, this._ship.y - ast.y) < ast.radius + 11)
        return true;
    }
    return false;
  }

  _checkShipAsteroid(ga) {
    for (const ast of this._asteroids) {
      if (!ast.alive) continue;
      if (Math.hypot(this._ship.x - ast.x, this._ship.y - ast.y) < ast.radius + 11) {
        this._killShip(ga);
        // The asteroid that struck the ship is also destroyed
        this._hitAsteroid(ast, ga);
        this._asteroids = this._asteroids.filter(a => a.alive);
        return;
      }
    }
  }

  _killShip(ga) {
    // Safety guard — an invincible (blinking) ship cannot be destroyed
    if (this._ship.invincible > 0) return;

    this._spawnExplosion(this._ship.x, this._ship.y, '#ffee00');
    // Respawn in center, fully invincible (no lives limit)
    this._ship.x          = ga.x + ga.w * 0.5;
    this._ship.y          = ga.y + ga.h * 0.5;
    this._ship.vx         = 0;
    this._ship.vy         = 0;
    this._ship.invincible = AsteroidsEffect.INVINC_DUR;
    this._blinkVis        = true;
  }

  _spawnExplosion(cx, cy, baseColor) {
    const palette = [baseColor, '#ffffff', '#ffee00'];
    const count   = 10 + Math.floor(Math.random() * 6);
    const sparks  = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 140;
      sparks.push({
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed,
        color: palette[Math.floor(Math.random() * palette.length)],
        size:  1 + Math.floor(Math.random() * 2),
      });
    }
    this._explosions.push({ cx, cy, t: 0, maxT: 0.50, sparks });
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  /**
   * Returns the set of screen positions at which to draw an entity.
   * Includes the canonical position plus any "ghost" copies needed to show the
   * entity emerging from the opposite edge when it straddles the game area boundary.
   */
  _wrapPositions(x, y, margin, ga) {
    const nearL = x - margin < ga.x;
    const nearR = x + margin > ga.x + ga.w;
    const nearT = y - margin < ga.y;
    const nearB = y + margin > ga.y + ga.h;
    const pos = [[x, y]];
    if (nearL) pos.push([x + ga.w, y]);
    if (nearR) pos.push([x - ga.w, y]);
    if (nearT) pos.push([x, y + ga.h]);
    if (nearB) pos.push([x, y - ga.h]);
    if (nearL && nearT) pos.push([x + ga.w, y + ga.h]);
    if (nearR && nearT) pos.push([x - ga.w, y + ga.h]);
    if (nearL && nearB) pos.push([x + ga.w, y - ga.h]);
    if (nearR && nearB) pos.push([x - ga.w, y - ga.h]);
    return pos;
  }

  _drawScene(ga, drawShip, drawBullets) {
    const ctx = this._ctx;
    ctx.save();
    ctx.globalAlpha = 0.80;
    // Clip everything to the game area — entities split cleanly at the edges
    ctx.beginPath();
    ctx.rect(ga.x, ga.y, ga.w, ga.h);
    ctx.clip();

    this._drawAsteroidsRaw(ga);
    this._drawExplosions(ga);
    if (drawShip && this._ship.alive && this._blinkVis) this._drawShip(ga);
    if (drawBullets) this._drawBullets(ga);

    ctx.restore();
  }

  _drawShip(ga) {
    const ship = this._ship;
    const ctx  = this._ctx;
    const S    = 14;  // half-size px
    const positions = this._wrapPositions(ship.x, ship.y, S * 1.5, ga);
    for (const [px, py] of positions) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ship.angle);

      // Body — filled yellow triangle
      ctx.fillStyle = '#ffee00';
      ctx.beginPath();
      ctx.moveTo( S * 1.45,  0);
      ctx.lineTo(-S * 0.55, -S * 0.78);
      ctx.lineTo(-S * 0.18,  0);
      ctx.lineTo(-S * 0.55,  S * 0.78);
      ctx.closePath();
      ctx.fill();

      // Thrust flame — visible only while thrusting (and not in invincibility window)
      if (this._thrusting && ship.invincible <= 0) {
        const fl = S * (0.6 + Math.random() * 0.5);  // flicker
        ctx.fillStyle = '#ff6600';
        ctx.globalAlpha *= 0.85;
        ctx.beginPath();
        ctx.moveTo(-S * 0.18, -3);
        ctx.lineTo(-S * 0.18 - fl, 0);
        ctx.lineTo(-S * 0.18,  3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawAsteroidsRaw(ga) {
    const ctx = this._ctx;
    for (const ast of this._asteroids) {
      if (!ast.alive) continue;
      const positions = this._wrapPositions(ast.x, ast.y, ast.radius, ga);
      for (const [px, py] of positions) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ast.angle);
        ctx.strokeStyle = '#d8d8d8';
        ctx.lineWidth   = 2;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        for (let i = 0; i < ast.shape.length; i++) {
          const { x, y } = ast.shape[i];
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  _drawBullets(ga) {
    const ctx = this._ctx;
    ctx.fillStyle = '#ffee00';
    for (const b of this._bullets) {
      const positions = this._wrapPositions(b.x, b.y, 4, ga);
      for (const [px, py] of positions)
        ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4);
    }
  }

  _drawExplosions(ga) {
    const ctx = this._ctx;
    for (const ex of this._explosions) {
      const alpha = 1.0 - ex.t / ex.maxT;
      const positions = this._wrapPositions(ex.cx, ex.cy, 160, ga);
      for (const [basex, basey] of positions) {
        for (const sp of ex.sparks) {
          const px = basex + sp.vx * ex.t;
          const py = basey + sp.vy * ex.t;
          const sz = sp.size * 3;
          ctx.globalAlpha = 0.80 * alpha;
          ctx.fillStyle   = sp.color;
          ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
        }
      }
    }
    ctx.globalAlpha = 0.80;
  }
}

PackageRegistry.registerEffect(new AsteroidsEffect());
