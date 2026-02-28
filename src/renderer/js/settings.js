'use strict';
// BackgroundSettings — manages the cyberpunk background effects panel and state.

const BackgroundSettings = (() => {

  const DEFAULTS = {
    grid:               'square',  // 'off' | 'square' | 'hex'
    gridColor:          'cyan',    // 'cyan' | 'magenta' | 'green'
    gridAnimate:        true,
    gridOpacity:        100,       // 10–100 (integer %)
    barWidth:           100,       // 20–100 (integer %): max-width of axis meter bars relative to portrait width
    filmGrain:          true,
    filmGrainOpacity:   5,         // 1–15 (integer %)
    filmGrainAnimate:   true,      // live-shift grain
    dataRain:           false,
    circuitPattern:     false,
    edgeGlow:           true,
    chromaticAberration: true,
    scanlinesIntensity: 'light',   // 'off' | 'light' | 'medium' | 'heavy'
  };

  let state = { ...DEFAULTS };
  let _rainCols = [];

  // RGB values for each grid color choice
  const GRID_COLORS = {
    cyan:    { r: 0,   g: 255, b: 204 },
    magenta: { r: 255, g: 0,   b: 170 },
    green:   { r: 0,   g: 255, b: 136 },
  };

  const RAIN_CHARS =
    '01アイウエオカキクケコサシスセソタチツテト' +
    '10010110ナニヌネノハヒフヘホマミムメモラリルレロ';

  // ── Effect applicators ───────────────────────────────────────────────────

  function _applyGrid() {
    const el = document.getElementById('bg-grid');
    if (!el) return;

    el.classList.remove('square', 'hex', 'grid-animate', 'active');
    el.style.backgroundImage = '';
    el.style.opacity = '';

    if (state.grid === 'off') return;

    const c = GRID_COLORS[state.gridColor] || GRID_COLORS.cyan;
    el.style.setProperty('--grid-line', `rgba(${c.r},${c.g},${c.b},0.08)`);
    el.classList.add(state.grid, 'active');
    el.style.opacity = (state.gridOpacity / 100).toFixed(2);

    if (state.grid === 'hex') {
      // Correct regular hex geometry for 56px-wide tile:
      // R = 56/√3 ≈ 32.33 → R/2≈16, 3R/2≈49, 2R≈65, tile height=3R≈97px
      // Only the hexagon outline + one vertical connector segment are drawn.
      // The extra diagonal arms that were here before caused the 4-sided diamond shapes.
      const hex = `${c.r.toString(16).padStart(2,'0')}${c.g.toString(16).padStart(2,'0')}${c.b.toString(16).padStart(2,'0')}`;
      const stroke = `%23${hex}`;
      el.style.backgroundImage =
        `url("data:image/svg+xml,%3Csvg width='56' height='97' xmlns='http://www.w3.org/2000/svg'%3E` +
        `%3Cpath d='M28 0 L56 16 L56 49 L28 65 L0 49 L0 16 Z' fill='none' stroke='${stroke}' stroke-width='1'/%3E` +
        `%3Cline x1='28' y1='65' x2='28' y2='97' stroke='${stroke}' stroke-width='1'/%3E` +
        `%3C/svg%3E")`;
    }

    if (state.gridAnimate) el.classList.add('grid-animate');
  }

  function _applyFilmGrain() {
    const el = document.getElementById('bg-noise');
    if (!el) return;
    if (state.filmGrain) {
      el.style.opacity = (state.filmGrainOpacity / 100).toFixed(3);
      if (state.filmGrainAnimate) {
        el.classList.add('grain-animate');
      } else {
        el.classList.remove('grain-animate');
      }
    } else {
      el.style.opacity = '0';
      el.classList.remove('grain-animate');
    }
  }

  function _applyDataRain() {
    const el = document.getElementById('bg-data-rain');
    if (!el) return;

    // Remove old columns
    _rainCols.forEach(c => c.remove());
    _rainCols = [];

    el.classList.toggle('active', state.dataRain);
    if (!state.dataRain) return;

    const colCount = 18;
    const colWidth = Math.floor(window.innerWidth / colCount);

    for (let i = 0; i < colCount; i++) {
      const col = document.createElement('div');
      col.className = 'rain-col';
      // Slight random offset within each column slot so columns aren't perfectly aligned
      const x = i * colWidth + Math.floor(Math.random() * colWidth * 0.6);
      col.style.left = `${x}px`;
      col.style.animationDuration  = `${7 + Math.random() * 9}s`;
      col.style.animationDelay     = `${-(Math.random() * 16)}s`;
      col.style.color              = `rgba(0,255,136,${(0.06 + Math.random() * 0.12).toFixed(3)})`;

      // Random character string (30-40 chars)
      const len = 30 + Math.floor(Math.random() * 10);
      let chars = '';
      for (let j = 0; j < len; j++) {
        chars += RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
      }
      col.textContent = chars;

      el.appendChild(col);
      _rainCols.push(col);
    }
  }

  function _generateCircuitBg() {
    // Procedurally generate a unique 500×500 SVG circuit board pattern each call.
    // Uses Math.random() so every app launch / toggle produces a different layout.
    const W = 500, H = 500, G = 25;
    const col = '#00ffcc';
    const irnd = (n) => Math.floor(Math.random() * n);
    const parts = [];

    // Random rectilinear traces (L-shapes and Z-shapes on a 25px grid)
    for (let i = 0; i < 38; i++) {
      let x = irnd(W / G) * G;
      let y = irnd(H / G) * G;
      const segs = 2 + irnd(4);
      let d = `M${x} ${y}`;
      let horiz = Math.random() < 0.5;
      for (let s = 0; s < segs; s++) {
        const len  = (1 + irnd(5)) * G;
        const sign = Math.random() < 0.5 ? 1 : -1;
        if (horiz) x = Math.max(0, Math.min(W, x + sign * len));
        else       y = Math.max(0, Math.min(H, y + sign * len));
        horiz = !horiz;
        d += ` L${x} ${y}`;
      }
      parts.push(`<path d="${d}" stroke-width="0.8"/>`);
      // Via (pad ring) at trace end
      parts.push(`<circle cx="${x}" cy="${y}" r="3"/>`);
    }

    // IC component outlines with pin stubs (4–7 chips)
    const numICs = 4 + irnd(4);
    for (let i = 0; i < numICs; i++) {
      const x = (irnd((W - 150) / G) + 1) * G;
      const y = (irnd((H - 100) / G) + 1) * G;
      const w = (3 + irnd(4)) * G;
      const h = (2 + irnd(2)) * G;
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke-width="0.8"/>`);
      // Orientation notch on top edge
      const mx = x + w / 2;
      parts.push(`<path d="M${mx - 6} ${y} A6 6 0 0 1 ${mx + 6} ${y}" stroke-width="0.8"/>`);
      // Top and bottom pin stubs
      const pins = 2 + irnd(4);
      const sp = w / (pins + 1);
      for (let p = 1; p <= pins; p++) {
        const px = Math.round(x + p * sp);
        parts.push(`<line x1="${px}" y1="${y}" x2="${px}" y2="${y - 12}" stroke-width="0.6"/>`);
        parts.push(`<line x1="${px}" y1="${y + h}" x2="${px}" y2="${y + h + 12}" stroke-width="0.6"/>`);
        parts.push(`<circle cx="${px}" cy="${y - 12}" r="2"/>`);
        parts.push(`<circle cx="${px}" cy="${y + h + 12}" r="2"/>`);
      }
      // 50% chance of left/right side pins too
      if (Math.random() < 0.5) {
        [h / 3, (h * 2) / 3].forEach(dy => {
          const py = Math.round(y + dy);
          parts.push(`<line x1="${x}" y1="${py}" x2="${x - 12}" y2="${py}" stroke-width="0.6"/>`);
          parts.push(`<circle cx="${x - 12}" cy="${py}" r="2"/>`);
          parts.push(`<line x1="${x + w}" y1="${py}" x2="${x + w + 12}" y2="${py}" stroke-width="0.6"/>`);
          parts.push(`<circle cx="${x + w + 12}" cy="${py}" r="2"/>`);
        });
      }
    }

    // Scattered standalone vias
    for (let i = 0; i < 12; i++) {
      parts.push(`<circle cx="${irnd(W / G) * G}" cy="${irnd(H / G) * G}" r="2.5"/>`);
    }

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" stroke="${col}" fill="none">${parts.join('')}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function _applyCircuit() {
    const el = document.getElementById('bg-circuit');
    if (!el) return;
    if (state.circuitPattern) {
      el.style.backgroundImage = _generateCircuitBg();
      el.style.backgroundSize  = '500px 500px';
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  }

  function _applyEdgeGlow() {
    const el = document.getElementById('bg-edge-glow');
    if (!el) return;
    el.classList.toggle('active', state.edgeGlow);
  }

  function _applyChroma() {
    const el = document.getElementById('bg-chroma');
    if (!el) return;
    el.classList.toggle('active', state.chromaticAberration);
  }

  function _applyBarWidth() {
    const el = document.getElementById('emotion-meters');
    if (!el) return;
    // Symmetric horizontal padding centers the bar area within the portrait width.
    // e.g. barWidth=80 → 10% padding each side, so bars sit from 10%–90% of portrait width.
    const sidePct = (100 - state.barWidth) / 2;
    el.style.paddingLeft  = sidePct + '%';
    el.style.paddingRight = sidePct + '%';
    // Store barWidth so CompanionDisplay can decide whether to show labels
    el.dataset.barWidth = state.barWidth;
    // Re-render bars (no-arg = use cached state) so labels appear/disappear immediately
    if (typeof CompanionDisplay !== 'undefined') CompanionDisplay.updateMeters();
  }

  function _applyScanlines() {
    const el = document.querySelector('.crt-overlay');
    if (!el) return;
    el.classList.remove('scanlines-off', 'scanlines-medium', 'scanlines-heavy');
    if (state.scanlinesIntensity !== 'light') {
      el.classList.add(`scanlines-${state.scanlinesIntensity}`);
    }
  }

  function _applyAll() {
    _applyGrid();
    _applyFilmGrain();
    _applyDataRain();
    _applyCircuit();
    _applyEdgeGlow();
    _applyChroma();
    _applyScanlines();
    _applyBarWidth();
  }

  // ── UI helpers ───────────────────────────────────────────────────────────

  function _setToggle(id, active) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', active);
    el.textContent = active ? 'ON' : 'OFF';
  }

  function _updateSlider(sliderId, valId, value, min, max) {
    const slider = document.getElementById(sliderId);
    const valEl  = document.getElementById(valId);
    if (!slider || !valEl) return;
    slider.value = value;
    const pct = ((value - min) / (max - min)) * 100;
    slider.style.setProperty('--pct', pct.toFixed(1));
    valEl.textContent = value + '%';
  }

  function _syncUI() {
    // Grid type radios
    document.querySelectorAll('input[name="bg-grid"]').forEach(r => {
      r.checked = (r.value === state.grid);
    });
    // Grid color swatches
    document.querySelectorAll('.swatch[data-color]').forEach(s => {
      s.classList.toggle('active', s.dataset.color === state.gridColor);
    });
    // Grid opacity
    _updateSlider('grid-opacity', 'grid-opacity-val', state.gridOpacity, 10, 100);
    // Axis bar width
    _updateSlider('bar-width', 'bar-width-val', state.barWidth, 20, 100);
    // Grid animate
    _setToggle('toggle-grid-animate', state.gridAnimate);
    // Film grain
    _setToggle('toggle-film-grain', state.filmGrain);
    _setToggle('toggle-film-grain-animate', state.filmGrainAnimate);
    _updateSlider('grain-opacity', 'grain-opacity-val', state.filmGrainOpacity, 1, 15);
    // Other effects
    _setToggle('toggle-data-rain',  state.dataRain);
    _setToggle('toggle-circuit',    state.circuitPattern);
    _setToggle('toggle-edge-glow',  state.edgeGlow);
    _setToggle('toggle-chroma',     state.chromaticAberration);
    // Scanlines radios
    document.querySelectorAll('input[name="bg-scanlines"]').forEach(r => {
      r.checked = (r.value === state.scanlinesIntensity);
    });
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  async function _save() {
    try {
      await window.claudeAPI.setBgSettings({ ...state });
    } catch (e) {
      console.warn('[BackgroundSettings] save error:', e);
    }
  }

  async function _load() {
    try {
      const saved = await window.claudeAPI.getBgSettings();
      if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
        state = { ...DEFAULTS, ...saved };
      }
    } catch (e) {
      console.warn('[BackgroundSettings] load error:', e);
    }
  }

  // ── Panel open / close ───────────────────────────────────────────────────

  function _openPanel() {
    const panel = document.getElementById('settings-panel');
    const btn   = document.getElementById('btn-settings');
    if (!panel) return;
    panel.classList.add('open');
    btn?.classList.add('active');
    _syncUI();
  }

  function _closePanel() {
    const panel = document.getElementById('settings-panel');
    const btn   = document.getElementById('btn-settings');
    panel?.classList.remove('open');
    btn?.classList.remove('active');
  }

  function _togglePanel() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;
    panel.classList.contains('open') ? _closePanel() : _openPanel();
  }

  // ── Wire controls ────────────────────────────────────────────────────────

  function _wire() {
    // Settings gear button
    document.getElementById('btn-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      _togglePanel();
    });

    // Close button
    document.getElementById('btn-settings-close')?.addEventListener('click', _closePanel);

    // Click outside → close
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('settings-panel');
      const btn   = document.getElementById('btn-settings');
      if (!panel?.classList.contains('open')) return;
      if (!panel.contains(e.target) && !btn?.contains(e.target)) _closePanel();
    });

    // ── Grid type ──
    document.querySelectorAll('input[name="bg-grid"]').forEach(r => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        state.grid = r.value;
        _applyGrid();
        _save();
      });
    });

    // ── Grid color swatches ──
    document.querySelectorAll('.swatch[data-color]').forEach(s => {
      s.addEventListener('click', () => {
        state.gridColor = s.dataset.color;
        _applyGrid();
        _save();
        document.querySelectorAll('.swatch[data-color]').forEach(x =>
          x.classList.toggle('active', x === s));
      });
    });

    // ── Grid opacity ──
    const gridOpacitySlider = document.getElementById('grid-opacity');
    gridOpacitySlider?.addEventListener('input', () => {
      state.gridOpacity = parseInt(gridOpacitySlider.value, 10);
      _updateSlider('grid-opacity', 'grid-opacity-val', state.gridOpacity, 10, 100);
      _applyGrid();
    });
    gridOpacitySlider?.addEventListener('change', _save);

    // ── Grid animate ──
    document.getElementById('toggle-grid-animate')?.addEventListener('click', () => {
      state.gridAnimate = !state.gridAnimate;
      _applyGrid();
      _save();
      _setToggle('toggle-grid-animate', state.gridAnimate);
    });

    // ── Axis bar width ──
    const barWidthSlider = document.getElementById('bar-width');
    barWidthSlider?.addEventListener('input', () => {
      state.barWidth = parseInt(barWidthSlider.value, 10);
      _updateSlider('bar-width', 'bar-width-val', state.barWidth, 20, 100);
      _applyBarWidth();
    });
    barWidthSlider?.addEventListener('change', _save);

    // ── Film grain ──
    document.getElementById('toggle-film-grain')?.addEventListener('click', () => {
      state.filmGrain = !state.filmGrain;
      _applyFilmGrain();
      _save();
      _setToggle('toggle-film-grain', state.filmGrain);
    });

    document.getElementById('toggle-film-grain-animate')?.addEventListener('click', () => {
      state.filmGrainAnimate = !state.filmGrainAnimate;
      _applyFilmGrain();
      _save();
      _setToggle('toggle-film-grain-animate', state.filmGrainAnimate);
    });

    const grainSlider = document.getElementById('grain-opacity');
    grainSlider?.addEventListener('input', () => {
      state.filmGrainOpacity = parseInt(grainSlider.value, 10);
      _updateSlider('grain-opacity', 'grain-opacity-val', state.filmGrainOpacity, 1, 15);
      _applyFilmGrain();
    });
    grainSlider?.addEventListener('change', _save);

    // ── Data rain ──
    document.getElementById('toggle-data-rain')?.addEventListener('click', () => {
      state.dataRain = !state.dataRain;
      _applyDataRain();
      _save();
      _setToggle('toggle-data-rain', state.dataRain);
    });

    // ── Circuit pattern ──
    document.getElementById('toggle-circuit')?.addEventListener('click', () => {
      state.circuitPattern = !state.circuitPattern;
      _applyCircuit();
      _save();
      _setToggle('toggle-circuit', state.circuitPattern);
    });

    // ── Edge glow ──
    document.getElementById('toggle-edge-glow')?.addEventListener('click', () => {
      state.edgeGlow = !state.edgeGlow;
      _applyEdgeGlow();
      _save();
      _setToggle('toggle-edge-glow', state.edgeGlow);
    });

    // ── Chromatic aberration ──
    document.getElementById('toggle-chroma')?.addEventListener('click', () => {
      state.chromaticAberration = !state.chromaticAberration;
      _applyChroma();
      _save();
      _setToggle('toggle-chroma', state.chromaticAberration);
    });

    // ── Scanlines ──
    document.querySelectorAll('input[name="bg-scanlines"]').forEach(r => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        state.scanlinesIntensity = r.value;
        _applyScanlines();
        _save();
      });
    });
  }

  // ── Public ───────────────────────────────────────────────────────────────

  async function init() {
    await _load();
    _applyAll();
    _wire();
    console.log('[BackgroundSettings] initialized, state:', state);
  }

  return { init };

})();
