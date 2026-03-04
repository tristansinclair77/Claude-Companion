'use strict';
/**
 * SeasonsEffect — Fantasy RPG canvas weather / seasonal ambient effects.
 * Extends VisualEffect. Registered with PackageRegistry under id 'seasons'.
 *
 * Supported modes: 'off' | 'snow' | 'rain' | 'sunbeams' | 'leaves' | 'random'
 * The 'random' mode picks a season at start and rotates every 4–7 minutes.
 *
 * BackgroundSettings activates this via:
 *   effect.start({ seasonMode: 'sunbeams' })
 *   effect.update('seasonMode', 'snow')      ← triggers crossfade, no restart
 *   effect.stop()
 */
class SeasonsEffect extends VisualEffect {

  constructor() {
    super('seasons');

    this._canvas     = null;
    this._ctx        = null;
    this._rAF        = null;
    this._parts      = [];
    this._mode       = 'off';    // user-selected mode
    this._activeMode = 'off';    // season currently being drawn
    this._alpha      = 1;
    this._randTimer  = null;
  }

  // ── VisualEffect hooks ────────────────────────────────────────────────────

  _onStart(config) {
    this._setMode(config.seasonMode || 'off');
  }

  _onStop() {
    this._setMode('off');
  }

  /** Override: update seasonMode in-place using the existing crossfade. */
  _onUpdate(key, value) {
    if (key === 'seasonMode') this._setMode(value);
  }

  // ── Constants ─────────────────────────────────────────────────────────────

  static get SEASON_LIST() { return ['snow', 'rain', 'sunbeams', 'leaves']; }

  static get CF_STEPS()    { return 15; }
  static get CF_INTERVAL() { return 20; } // ms — total crossfade ≈ 300ms

  // ── Canvas init ───────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return true;
    this._canvas = document.getElementById('bg-season');
    if (!this._canvas) return false;
    Object.assign(this._canvas.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      width:         '100%',
      height:        '100%',
      pointerEvents: 'none',
      zIndex:        '-1',
    });
    this._ctx = this._canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    return true;
  }

  _resize() {
    if (!this._canvas) return;
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
    if (this._activeMode !== 'off') {
      this._parts = this._makeParticles(this._activeMode);
    }
  }

  // ── Particle factories ────────────────────────────────────────────────────

  _makeParticles(mode) {
    const W = this._canvas.width, H = this._canvas.height;
    switch (mode) {

      case 'snow':
        return Array.from({ length: 60 }, () => ({
          x:     Math.random() * W,
          y:     Math.random() * H,
          r:     0.8 + Math.random() * 1.4,
          a:     0.35 + Math.random() * 0.45,
          vy:    0.3  + Math.random() * 0.7,
          vx:    (Math.random() - 0.5) * 0.25,
          phase: Math.random() * Math.PI * 2,
        }));

      case 'rain':
        return Array.from({ length: 85 }, () => ({
          x:   Math.random() * W,
          y:   Math.random() * H,
          len: 8  + Math.random() * 12,
          a:   0.12 + Math.random() * 0.20,
          vy:  7    + Math.random() * 8,
        }));

      case 'sunbeams': {
        const sx = W * 0.64, sy = -H * 0.06;
        const rays = Array.from({ length: 8 }, (_, i) => ({
          type:  'ray',
          sx, sy,
          angle: -0.55 + (i / 7) * 1.35 + (Math.random() - 0.5) * 0.12,
          len:   H * (1.2 + Math.random() * 0.5),
          w:     18 + Math.random() * 55,
          a:     0.022 + Math.random() * 0.026,
          phase: Math.random() * Math.PI * 2,
          speed: 0.003  + Math.random() * 0.003,
        }));
        const motes = Array.from({ length: 45 }, () => ({
          type:  'mote',
          x:     Math.random() * W,
          y:     Math.random() * H,
          r:     0.6 + Math.random() * 2.0,
          a:     0.45 + Math.random() * 0.5,
          vy:    -(0.04 + Math.random() * 0.10),
          vx:    (Math.random() - 0.5) * 0.05,
          phase: Math.random() * Math.PI * 2,
        }));
        return [...rays, ...motes];
      }

      case 'leaves': {
        const COLS = [
          [210, 95,  25],
          [195, 140, 18],
          [170, 55,  18],
          [225, 165, 38],
          [150, 75,  18],
        ];
        return Array.from({ length: 28 }, () => {
          const c = COLS[Math.floor(Math.random() * COLS.length)];
          return {
            x:      Math.random() * W,
            y:      Math.random() * H,
            r:      2.5 + Math.random() * 2.5,
            a:      0.5 + Math.random() * 0.4,
            vy:     0.4 + Math.random() * 0.9,
            vx:     (Math.random() - 0.5) * 0.5,
            phase:  Math.random() * Math.PI * 2,
            rot:    Math.random() * Math.PI * 2,
            rotSpd: (Math.random() - 0.5) * 0.035,
            color:  c,
          };
        });
      }

      default: return [];
    }
  }

  // ── Draw functions ────────────────────────────────────────────────────────

  _drawSnow() {
    const W = this._canvas.width, H = this._canvas.height;
    this._ctx.clearRect(0, 0, W, H);
    for (const p of this._parts) {
      p.phase += 0.008;
      p.x += p.vx + Math.sin(p.phase) * 0.18;
      p.y += p.vy;
      if (p.y > H + 4)  { p.y = -4; p.x = Math.random() * W; }
      if (p.x < -4)       p.x = W + 4;
      if (p.x > W + 4)    p.x = -4;
      this._ctx.beginPath();
      this._ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this._ctx.fillStyle = `rgba(210,228,255,${(p.a * this._alpha).toFixed(3)})`;
      this._ctx.fill();
    }
  }

  _drawRain() {
    const W = this._canvas.width, H = this._canvas.height;
    this._ctx.clearRect(0, 0, W, H);
    this._ctx.lineWidth = 1;
    for (const p of this._parts) {
      p.y += p.vy;
      if (p.y > H + p.len) { p.y = -p.len; p.x = Math.random() * W; }
      this._ctx.beginPath();
      this._ctx.moveTo(p.x, p.y);
      this._ctx.lineTo(p.x - 1.5, p.y + p.len);
      this._ctx.strokeStyle = `rgba(155,185,215,${(p.a * this._alpha).toFixed(3)})`;
      this._ctx.stroke();
    }
  }

  _drawSunbeams() {
    const W = this._canvas.width, H = this._canvas.height;
    this._ctx.clearRect(0, 0, W, H);

    this._ctx.save();
    this._ctx.filter = 'blur(14px)';
    for (const p of this._parts) {
      if (p.type !== 'ray') continue;
      p.phase += p.speed;
      const a  = (p.a + Math.sin(p.phase) * 0.01) * this._alpha;
      const ex = p.sx + Math.sin(p.angle) * p.len;
      const ey = p.sy + Math.cos(p.angle) * p.len;
      const px = Math.cos(p.angle) * p.w / 2;
      const py = -Math.sin(p.angle) * p.w / 2;
      const grad = this._ctx.createLinearGradient(p.sx, p.sy, ex, ey);
      grad.addColorStop(0,    `rgba(255,225,140,${Math.min(1, a * 4).toFixed(3)})`);
      grad.addColorStop(0.15, `rgba(255,205,90,${a.toFixed(3)})`);
      grad.addColorStop(1,    'rgba(255,185,65,0)');
      this._ctx.beginPath();
      this._ctx.moveTo(p.sx, p.sy);
      this._ctx.lineTo(ex + px, ey + py);
      this._ctx.lineTo(ex - px, ey - py);
      this._ctx.closePath();
      this._ctx.fillStyle = grad;
      this._ctx.fill();
    }
    this._ctx.restore();

    this._ctx.save();
    this._ctx.shadowColor = 'rgba(255,248,210,0.85)';
    this._ctx.shadowBlur  = 5;
    for (const p of this._parts) {
      if (p.type !== 'mote') continue;
      p.phase += 0.006;
      p.x += p.vx + Math.sin(p.phase) * 0.04;
      p.y += p.vy;
      if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
      const a = p.a * (0.6 + Math.sin(p.phase) * 0.4) * this._alpha;
      this._ctx.beginPath();
      this._ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this._ctx.fillStyle = `rgba(255,248,210,${a.toFixed(3)})`;
      this._ctx.fill();
    }
    this._ctx.restore();
  }

  _drawLeaves() {
    const W = this._canvas.width, H = this._canvas.height;
    this._ctx.clearRect(0, 0, W, H);
    for (const p of this._parts) {
      p.phase  += 0.01;
      p.rot    += p.rotSpd;
      p.x      += p.vx + Math.sin(p.phase) * 0.35;
      p.y      += p.vy;
      if (p.y > H + 10)  { p.y = -10; p.x = Math.random() * W; }
      if (p.x < -10)       p.x = W + 10;
      if (p.x > W + 10)    p.x = -10;
      this._ctx.save();
      this._ctx.translate(p.x, p.y);
      this._ctx.rotate(p.rot);
      this._ctx.beginPath();
      this._ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
      const [r, g, b] = p.color;
      this._ctx.fillStyle = `rgba(${r},${g},${b},${(p.a * this._alpha).toFixed(3)})`;
      this._ctx.fill();
      this._ctx.restore();
    }
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  _tick() {
    if (!this._canvas || this._activeMode === 'off') { this._rAF = null; return; }
    const drawFns = {
      snow: () => this._drawSnow(),
      rain: () => this._drawRain(),
      sunbeams: () => this._drawSunbeams(),
      leaves: () => this._drawLeaves(),
    };
    const fn = drawFns[this._activeMode];
    if (fn) fn();
    this._rAF = requestAnimationFrame(() => this._tick());
  }

  // ── Crossfade ─────────────────────────────────────────────────────────────

  _crossfadeTo(newActiveMode, onComplete) {
    const { CF_STEPS, CF_INTERVAL } = SeasonsEffect;
    let i = 0;
    const out = setInterval(() => {
      this._alpha = 1 - (++i / CF_STEPS);
      if (i >= CF_STEPS) {
        clearInterval(out);
        this._alpha      = 0;
        this._parts      = this._makeParticles(newActiveMode);
        this._activeMode = newActiveMode;
        document.body.dataset.season = newActiveMode;
        let j = 0;
        const inn = setInterval(() => {
          this._alpha = ++j / CF_STEPS;
          if (j >= CF_STEPS) {
            clearInterval(inn);
            this._alpha = 1;
            if (onComplete) onComplete();
          }
        }, CF_INTERVAL);
      }
    }, CF_INTERVAL);
  }

  // ── Random-mode scheduling ────────────────────────────────────────────────

  _scheduleNextRandom() {
    if (this._mode !== 'random') return;
    const delay = (4 + Math.random() * 3) * 60 * 1000; // 4–7 minutes
    this._randTimer = setTimeout(() => {
      const options = SeasonsEffect.SEASON_LIST.filter(s => s !== this._activeMode);
      const next    = options[Math.floor(Math.random() * options.length)];
      this._crossfadeTo(next, () => this._scheduleNextRandom());
    }, delay);
  }

  // ── Core mode setter ──────────────────────────────────────────────────────

  _setMode(mode) {
    if (!this._initCanvas()) return;

    if (this._rAF)       { cancelAnimationFrame(this._rAF); this._rAF = null; }
    if (this._randTimer) { clearTimeout(this._randTimer);   this._randTimer = null; }

    this._mode  = mode;
    this._alpha = 1;

    if (mode === 'off') {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._activeMode = 'off';
      document.body.dataset.season = '';
      return;
    }

    this._activeMode = (mode === 'random')
      ? SeasonsEffect.SEASON_LIST[Math.floor(Math.random() * SeasonsEffect.SEASON_LIST.length)]
      : mode;

    this._parts = this._makeParticles(this._activeMode);
    document.body.dataset.season = this._activeMode;
    this._tick();

    if (mode === 'random') this._scheduleNextRandom();
  }
}

// Register with the PackageRegistry so BackgroundSettings can activate this effect
// by name ('seasons') without a direct import or global SeasonEffects reference.
PackageRegistry.registerEffect(new SeasonsEffect());
