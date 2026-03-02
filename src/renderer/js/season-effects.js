'use strict';
// SeasonEffects — canvas particle weather effects + UI lighting for visual packages.
// Currently attributed to: Fantasy RPG package.
// Activated by settings.js; data-season attribute on <body> drives CSS lighting.

const SeasonEffects = (() => {

  let _canvas     = null;
  let _ctx        = null;
  let _rAF        = null;
  let _parts      = [];
  let _mode       = 'off';    // the user-selected mode ('off','random','snow',...)
  let _activeMode = 'off';    // the season actually being drawn right now
  let _alpha      = 1;        // global opacity multiplier used by all draw calls
  let _randTimer  = null;

  const SEASON_LIST = ['snow', 'rain', 'sunbeams', 'leaves'];

  // Crossfade constants
  const CF_STEPS    = 15;
  const CF_INTERVAL = 20; // ms — total crossfade ≈ 600ms

  // ── Canvas init ─────────────────────────────────────────────────────────────

  function _init() {
    if (_canvas) return true;
    _canvas = document.getElementById('bg-season');
    if (!_canvas) return false;
    Object.assign(_canvas.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '-1',
    });
    _ctx = _canvas.getContext('2d');
    _resize();
    window.addEventListener('resize', _resize);
    return true;
  }

  function _resize() {
    if (!_canvas) return;
    _canvas.width  = window.innerWidth;
    _canvas.height = window.innerHeight;
    // Re-create particles for the new canvas dimensions (sunbeam source point also rescales)
    if (_activeMode !== 'off') _parts = _makeParticles(_activeMode);
  }

  // ── Particle factories ───────────────────────────────────────────────────────

  function _makeParticles(mode) {
    const W = _canvas.width, H = _canvas.height;
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
        // Source point: just above the canvas, offset toward the right
        const sx = W * 0.64, sy = -H * 0.06;
        // 8 rays fanning downward from the source
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
        // 45 illuminated dust motes drifting lazily through the sunbeams
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
          [210, 95,  25],  // burnt orange
          [195, 140, 18],  // amber
          [170, 55,  18],  // rust red
          [225, 165, 38],  // golden
          [150, 75,  18],  // dark rust
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

  // ── Draw functions ───────────────────────────────────────────────────────────

  function _drawSnow() {
    const W = _canvas.width, H = _canvas.height;
    _ctx.clearRect(0, 0, W, H);
    for (const p of _parts) {
      p.phase += 0.008;
      p.x += p.vx + Math.sin(p.phase) * 0.18;
      p.y += p.vy;
      if (p.y > H + 4)  { p.y = -4; p.x = Math.random() * W; }
      if (p.x < -4)       p.x = W + 4;
      if (p.x > W + 4)    p.x = -4;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      _ctx.fillStyle = `rgba(210,228,255,${(p.a * _alpha).toFixed(3)})`;
      _ctx.fill();
    }
  }

  function _drawRain() {
    const W = _canvas.width, H = _canvas.height;
    _ctx.clearRect(0, 0, W, H);
    _ctx.lineWidth = 1;
    for (const p of _parts) {
      p.y += p.vy;
      if (p.y > H + p.len) { p.y = -p.len; p.x = Math.random() * W; }
      _ctx.beginPath();
      _ctx.moveTo(p.x, p.y);
      _ctx.lineTo(p.x - 1.5, p.y + p.len);
      _ctx.strokeStyle = `rgba(155,185,215,${(p.a * _alpha).toFixed(3)})`;
      _ctx.stroke();
    }
  }

  function _drawSunbeams() {
    const W = _canvas.width, H = _canvas.height;
    _ctx.clearRect(0, 0, W, H);

    // Rays: blurred so edges fade softly into the background instead of hard-cutting
    _ctx.save();
    _ctx.filter = 'blur(14px)';
    for (const p of _parts) {
      if (p.type !== 'ray') continue;
      p.phase += p.speed;
      const a  = (p.a + Math.sin(p.phase) * 0.01) * _alpha;
      const ex = p.sx + Math.sin(p.angle) * p.len;
      const ey = p.sy + Math.cos(p.angle) * p.len;
      // Perpendicular vector for the far-end width
      const px = Math.cos(p.angle) * p.w / 2;
      const py = -Math.sin(p.angle) * p.w / 2;
      const grad = _ctx.createLinearGradient(p.sx, p.sy, ex, ey);
      grad.addColorStop(0,    `rgba(255,225,140,${Math.min(1, a * 4).toFixed(3)})`);
      grad.addColorStop(0.15, `rgba(255,205,90,${a.toFixed(3)})`);
      grad.addColorStop(1,    'rgba(255,185,65,0)');
      _ctx.beginPath();
      _ctx.moveTo(p.sx, p.sy);
      _ctx.lineTo(ex + px, ey + py);
      _ctx.lineTo(ex - px, ey - py);
      _ctx.closePath();
      _ctx.fillStyle = grad;
      _ctx.fill();
    }
    _ctx.restore();

    // Dust motes: illuminated dust particles drifting lazily in the light
    _ctx.save();
    _ctx.shadowColor = 'rgba(255,248,210,0.85)';
    _ctx.shadowBlur  = 5;
    for (const p of _parts) {
      if (p.type !== 'mote') continue;
      p.phase += 0.006;
      p.x += p.vx + Math.sin(p.phase) * 0.04;
      p.y += p.vy;
      if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
      const a = p.a * (0.6 + Math.sin(p.phase) * 0.4) * _alpha;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      _ctx.fillStyle = `rgba(255,248,210,${a.toFixed(3)})`;
      _ctx.fill();
    }
    _ctx.restore();
  }

  function _drawLeaves() {
    const W = _canvas.width, H = _canvas.height;
    _ctx.clearRect(0, 0, W, H);
    for (const p of _parts) {
      p.phase  += 0.01;
      p.rot    += p.rotSpd;
      p.x      += p.vx + Math.sin(p.phase) * 0.35;
      p.y      += p.vy;
      if (p.y > H + 10)  { p.y = -10; p.x = Math.random() * W; }
      if (p.x < -10)       p.x = W + 10;
      if (p.x > W + 10)    p.x = -10;
      _ctx.save();
      _ctx.translate(p.x, p.y);
      _ctx.rotate(p.rot);
      _ctx.beginPath();
      _ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
      const [r, g, b] = p.color;
      _ctx.fillStyle = `rgba(${r},${g},${b},${(p.a * _alpha).toFixed(3)})`;
      _ctx.fill();
      _ctx.restore();
    }
  }

  const _DRAW = {
    snow: _drawSnow, rain: _drawRain, sunbeams: _drawSunbeams, leaves: _drawLeaves,
  };

  // ── Animation loop ───────────────────────────────────────────────────────────

  function _tick() {
    if (!_canvas || _activeMode === 'off') { _rAF = null; return; }
    const fn = _DRAW[_activeMode];
    if (fn) fn();
    _rAF = requestAnimationFrame(_tick);
  }

  // ── Crossfade to a new active mode ───────────────────────────────────────────

  function _switchTo(newActiveMode, onComplete) {
    let i = 0;
    const out = setInterval(() => {
      _alpha = 1 - (++i / CF_STEPS);
      if (i >= CF_STEPS) {
        clearInterval(out);
        _alpha      = 0;
        _parts      = _makeParticles(newActiveMode);
        _activeMode = newActiveMode;
        document.body.dataset.season = newActiveMode;
        let j = 0;
        const inn = setInterval(() => {
          _alpha = ++j / CF_STEPS;
          if (j >= CF_STEPS) {
            clearInterval(inn);
            _alpha = 1;
            if (onComplete) onComplete();
          }
        }, CF_INTERVAL);
      }
    }, CF_INTERVAL);
  }

  // ── Random-mode scheduling ───────────────────────────────────────────────────

  function _scheduleNextRandom() {
    if (_mode !== 'random') return;
    const delay = (4 + Math.random() * 3) * 60 * 1000; // 4–7 minutes
    _randTimer = setTimeout(() => {
      const options = SEASON_LIST.filter(s => s !== _activeMode);
      const next    = options[Math.floor(Math.random() * options.length)];
      _switchTo(next, _scheduleNextRandom);
    }, delay);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  function setMode(mode) {
    if (!_init()) return;

    // Cancel any in-flight animation + random timer
    if (_rAF)       { cancelAnimationFrame(_rAF); _rAF = null; }
    if (_randTimer) { clearTimeout(_randTimer);   _randTimer = null; }

    _mode  = mode;
    _alpha = 1;

    if (mode === 'off') {
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      _activeMode = 'off';
      document.body.dataset.season = '';
      return;
    }

    _activeMode = (mode === 'random')
      ? SEASON_LIST[Math.floor(Math.random() * SEASON_LIST.length)]
      : mode;

    _parts = _makeParticles(_activeMode);
    document.body.dataset.season = _activeMode;
    _tick();

    if (mode === 'random') _scheduleNextRandom();
  }

  function stop() { setMode('off'); }

  return { setMode, stop };

})();
