'use strict';
// BackgroundSettings — manages visual packages and the background/display settings panel.

// ── Built-in Visual Packages ──────────────────────────────────────────────────

const BUILTIN_PACKAGES = [
  {
    id: 'cybernetic',
    name: 'CYBERNETIC',
    desc: 'neon green / teal',
    effectModules: ['grid', 'filmGrain', 'overlayEffects', 'scanlines'],
    colors: {
      '--cyan':        '#00ffcc',
      '--cyan-dim':    '#007755',
      '--green':       '#00ff88',
      '--magenta':     '#ff00aa',
      '--purple':      '#aa44ff',
      '--orange':      '#ff8800',
      '--red':         '#ff2244',
      '--yellow':      '#ffdd00',
      '--bg-dark':     '#0a0a0f',
      '--bg-panel':    '#0d0d16',
      '--bg-mid':      '#111122',
      '--bg-input':    '#0c0c18',
      '--border':      '#001a0f',
      '--border-glow': '#00ff8833',
      // Axis bar gradient stops
      '--axis-val-lo': '#ff4444', '--axis-val-hi': '#00ff88',
      '--axis-aro-lo': '#4488ff', '--axis-aro-hi': '#ff8800',
      '--axis-soc-lo': '#8844aa', '--axis-soc-hi': '#00ccff',
      '--axis-phy-lo': '#888866', '--axis-phy-hi': '#88ff44',
    },
    effects: {
      grid: 'square', gridColor: 'cyan', gridAnimate: true, gridOpacity: 100,
      filmGrain: true, filmGrainOpacity: 5, filmGrainAnimate: true,
      dataRain: false, circuitPattern: false, edgeGlow: true,
      chromaticAberration: true, scanlinesIntensity: 'light',
      parchmentOpacity: 0,
    },
  },
  {
    id: 'fantasy_rpg',
    name: 'FANTASY RPG',
    desc: 'warm amber / arcane',
    effectModules: ['parchment'],
    colors: {
      '--cyan':        '#ffaa00',   // amber gold — primary (replaces neon cyan)
      '--cyan-dim':    '#885500',   // tarnished bronze
      '--green':       '#ddaa00',   // warm amber-gold (volume bar, FAST btn)
      '--magenta':     '#cc3333',   // deep blood red
      '--purple':      '#9944ff',   // arcane violet
      '--orange':      '#ff6600',   // ember orange
      '--red':         '#993311',   // dark crimson
      '--yellow':      '#ffdd88',   // candlelight
      '--bg-dark':     '#0a0806',   // near-black warm
      '--bg-panel':    '#100d09',   // dark aged wood
      '--bg-mid':      '#18130e',   // slightly lighter
      '--bg-input':    '#0e0b07',   // deep shadow
      '--border':      '#2a1a08',   // dark amber border
      '--border-glow': '#ffaa0022', // amber haze with alpha
      // Axis bar gradient stops — all warm family, no cool→warm lerp clashes
      '--axis-val-lo': '#882200', '--axis-val-hi': '#ddaa00',
      '--axis-aro-lo': '#332211', '--axis-aro-hi': '#ff6600',
      '--axis-soc-lo': '#2a3322', '--axis-soc-hi': '#ffaa00',
      '--axis-phy-lo': '#443322', '--axis-phy-hi': '#ffdd88',
    },
    effects: {
      grid: 'off', gridColor: 'cyan', gridAnimate: false, gridOpacity: 0,
      filmGrain: false, filmGrainOpacity: 5, filmGrainAnimate: false,
      dataRain: false, circuitPattern: false, edgeGlow: false,
      chromaticAberration: false, scanlinesIntensity: 'off',
      parchmentOpacity: 15,
    },
  },
];

// ── BackgroundSettings ────────────────────────────────────────────────────────

const BackgroundSettings = (() => {

  const DEFAULTS = {
    grid:                'square',  // 'off' | 'square' | 'hex'
    gridColor:           'cyan',    // 'cyan' | 'magenta' | 'green'
    gridAnimate:         true,
    gridOpacity:         100,       // 10–100 (integer %)
    barWidth:            100,       // 20–100 (integer %): max-width of axis meter bars
    filmGrain:           true,
    filmGrainOpacity:    5,         // 1–15 (integer %)
    filmGrainAnimate:    true,
    dataRain:            false,
    circuitPattern:      false,
    edgeGlow:            true,
    chromaticAberration: true,
    scanlinesIntensity:  'light',   // 'off' | 'light' | 'medium' | 'heavy'
    parchmentOpacity:    0,         // 0–30 (integer %)
  };

  let state = { ...DEFAULTS };
  let _rainCols = [];

  // ── Package state ─────────────────────────────────────────────────────────

  let _packages        = [];
  let _activePackageId = null;

  function _getActivePackage() {
    return _packages.find(p => p.id === _activePackageId) || _packages[0] || null;
  }

  // Write current live effect state back into the active package object so it
  // persists when switching away and is saved into config.json.
  function _syncEffectStateToPackage() {
    const pkg = _packages.find(p => p.id === _activePackageId);
    if (!pkg) return;
    pkg.effects = {
      grid:                state.grid,
      gridColor:           state.gridColor,
      gridAnimate:         state.gridAnimate,
      gridOpacity:         state.gridOpacity,
      filmGrain:           state.filmGrain,
      filmGrainOpacity:    state.filmGrainOpacity,
      filmGrainAnimate:    state.filmGrainAnimate,
      dataRain:            state.dataRain,
      circuitPattern:      state.circuitPattern,
      edgeGlow:            state.edgeGlow,
      chromaticAberration: state.chromaticAberration,
      scanlinesIntensity:  state.scanlinesIntensity,
      parchmentOpacity:    state.parchmentOpacity,
    };
  }

  // Apply a package's color variables to :root
  function _applyColorScheme(colors) {
    const root = document.documentElement;
    Object.entries(colors).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  // Show only the settings sections that belong to the active package's modules.
  // Sections without data-effect-module are always shown (UI SCALE, AXIS METERS, RVC VOICE).
  function _applyEffectModuleVisibility() {
    const pkg     = _getActivePackage();
    const modules = pkg?.effectModules || [];
    document.querySelectorAll('[data-effect-module]').forEach(el => {
      el.style.display = modules.includes(el.dataset.effectModule) ? '' : 'none';
    });
  }

  // Render the package selector buttons into #pkg-selector
  function _renderPackageSelector() {
    const container = document.getElementById('pkg-selector');
    if (!container) return;
    container.innerHTML = '';
    _packages.forEach(pkg => {
      const btn = document.createElement('button');
      btn.className = 'pkg-btn' + (pkg.id === _activePackageId ? ' active' : '');
      btn.textContent = pkg.name;
      btn.title = pkg.desc || '';
      btn.addEventListener('click', () => _switchPackage(pkg.id));
      container.appendChild(btn);
    });
  }

  // Switch to a different visual package
  function _switchPackage(id) {
    if (id === _activePackageId) return;

    _syncEffectStateToPackage();   // save current state into the departing package
    _activePackageId = id;

    const pkg = _getActivePackage();
    if (!pkg) return;

    // Apply color scheme first so the UI immediately reflects the new palette
    _applyColorScheme(pkg.colors);

    // Load this package's saved effects into live state
    Object.assign(state, pkg.effects || {});

    _applyAll();
    _applyEffectModuleVisibility();
    _renderPackageSelector();
    _syncUI();
    _save();
  }

  // ── Zoom state ────────────────────────────────────────────────────────────

  const _ZOOM_STEPS = [75, 90, 100, 110, 125, 150, 175, 200];
  let _zoom = 100;

  function _syncZoomUI() {
    const el = document.getElementById('zoom-val');
    if (el) el.textContent = _zoom + '%';
  }

  async function _setZoom(pct) {
    _zoom = pct;
    _syncZoomUI();
    try { await window.claudeAPI.setZoom(pct); } catch (e) {
      console.warn('[BackgroundSettings] zoom error:', e);
    }
  }

  // ── Grid color map ────────────────────────────────────────────────────────

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
      el.classList.toggle('grain-animate', state.filmGrainAnimate);
    } else {
      el.style.opacity = '0';
      el.classList.remove('grain-animate');
    }
  }

  function _applyDataRain() {
    const el = document.getElementById('bg-data-rain');
    if (!el) return;

    _rainCols.forEach(c => c.remove());
    _rainCols = [];

    el.classList.toggle('active', state.dataRain);
    if (!state.dataRain) return;

    const colCount = 18;
    const colWidth = Math.floor(window.innerWidth / colCount);

    for (let i = 0; i < colCount; i++) {
      const col = document.createElement('div');
      col.className = 'rain-col';
      const x = i * colWidth + Math.floor(Math.random() * colWidth * 0.6);
      col.style.left = `${x}px`;
      col.style.animationDuration  = `${7 + Math.random() * 9}s`;
      col.style.animationDelay     = `${-(Math.random() * 16)}s`;
      col.style.color              = `rgba(0,255,136,${(0.06 + Math.random() * 0.12).toFixed(3)})`;

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
    const W = 500, H = 500, G = 25;
    const col = '#00ffcc';
    const irnd = (n) => Math.floor(Math.random() * n);
    const parts = [];

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
      parts.push(`<circle cx="${x}" cy="${y}" r="3"/>`);
    }

    const numICs = 4 + irnd(4);
    for (let i = 0; i < numICs; i++) {
      const x = (irnd((W - 150) / G) + 1) * G;
      const y = (irnd((H - 100) / G) + 1) * G;
      const w = (3 + irnd(4)) * G;
      const h = (2 + irnd(2)) * G;
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke-width="0.8"/>`);
      const mx = x + w / 2;
      parts.push(`<path d="M${mx - 6} ${y} A6 6 0 0 1 ${mx + 6} ${y}" stroke-width="0.8"/>`);
      const pins = 2 + irnd(4);
      const sp = w / (pins + 1);
      for (let p = 1; p <= pins; p++) {
        const px = Math.round(x + p * sp);
        parts.push(`<line x1="${px}" y1="${y}" x2="${px}" y2="${y - 12}" stroke-width="0.6"/>`);
        parts.push(`<line x1="${px}" y1="${y + h}" x2="${px}" y2="${y + h + 12}" stroke-width="0.6"/>`);
        parts.push(`<circle cx="${px}" cy="${y - 12}" r="2"/>`);
        parts.push(`<circle cx="${px}" cy="${y + h + 12}" r="2"/>`);
      }
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
    const sidePct = (100 - state.barWidth) / 2;
    el.style.paddingLeft  = sidePct + '%';
    el.style.paddingRight = sidePct + '%';
    el.dataset.barWidth = state.barWidth;
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

  function _applyParchment() {
    const el = document.getElementById('bg-parchment');
    if (!el) return;
    const pkg = _getActivePackage();
    const hasParchment = (pkg?.effectModules || []).includes('parchment');
    if (hasParchment && state.parchmentOpacity > 0) {
      el.style.opacity = (state.parchmentOpacity / 100).toFixed(3);
      el.classList.add('active');
    } else {
      el.style.opacity = '0';
      el.classList.remove('active');
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
    _applyParchment();
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
    // Parchment opacity
    _updateSlider('parchment-opacity', 'parchment-opacity-val', state.parchmentOpacity, 0, 30);
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  async function _save() {
    _syncEffectStateToPackage();
    try {
      await window.claudeAPI.setBgSettings({
        ...state,
        activePackage: _activePackageId,
        packages:      _packages,
      });
    } catch (e) {
      console.warn('[BackgroundSettings] save error:', e);
    }
  }

  async function _load() {
    try {
      const saved = await window.claudeAPI.getBgSettings();
      if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
        state = { ...DEFAULTS, ...saved };
        if (Array.isArray(saved.packages) && saved.packages.length > 0) {
          _packages = saved.packages;
        }
        if (saved.activePackage) {
          _activePackageId = saved.activePackage;
        }
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
    document.getElementById('btn-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      _togglePanel();
    });

    document.getElementById('btn-settings-close')?.addEventListener('click', _closePanel);

    document.addEventListener('click', (e) => {
      const panel = document.getElementById('settings-panel');
      const btn   = document.getElementById('btn-settings');
      if (!panel?.classList.contains('open')) return;
      if (!panel.contains(e.target) && !btn?.contains(e.target)) _closePanel();
    });

    // ── Zoom ──
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      const idx = _ZOOM_STEPS.indexOf(_zoom);
      const prev = idx > 0 ? _ZOOM_STEPS[idx - 1] : _ZOOM_STEPS[0];
      _setZoom(prev);
    });
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      const idx = _ZOOM_STEPS.indexOf(_zoom);
      const next = idx < _ZOOM_STEPS.length - 1 ? _ZOOM_STEPS[idx + 1] : _ZOOM_STEPS[_ZOOM_STEPS.length - 1];
      _setZoom(next);
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

    // ── Parchment opacity ──
    const parchSlider = document.getElementById('parchment-opacity');
    parchSlider?.addEventListener('input', () => {
      state.parchmentOpacity = parseInt(parchSlider.value, 10);
      _updateSlider('parchment-opacity', 'parchment-opacity-val', state.parchmentOpacity, 0, 30);
      _applyParchment();
    });
    parchSlider?.addEventListener('change', _save);
  }

  // ── Public ───────────────────────────────────────────────────────────────

  async function init() {
    await _load();

    // Always re-seed builtin package COLORS from code so any color updates take effect
    // immediately without needing to clear saved config. Only saved effects are preserved.
    const savedEffectsMap = new Map((_packages || []).map(p => [p.id, p.effects]));
    _packages = JSON.parse(JSON.stringify(BUILTIN_PACKAGES)).map(builtin => {
      const saved = savedEffectsMap.get(builtin.id);
      return saved ? { ...builtin, effects: { ...builtin.effects, ...saved } } : builtin;
    });

    if (!_activePackageId) {
      _activePackageId = _packages[0]?.id || 'cybernetic';
    }

    // Apply the active package's color scheme and effects
    const pkg = _getActivePackage();
    if (pkg) {
      _applyColorScheme(pkg.colors);
      Object.assign(state, pkg.effects || {});
    }

    _applyAll();
    _applyEffectModuleVisibility();
    _renderPackageSelector();

    // Load saved zoom
    try {
      _zoom = await window.claudeAPI.getZoom();
    } catch { _zoom = 100; }
    _syncZoomUI();

    _syncUI();
    _wire();
    console.log('[BackgroundSettings] initialized, package:', _activePackageId);
  }

  return { init };

})();

// ── RVC Settings ─────────────────────────────────────────────────────────────

const RvcSettings = (() => {

  const DEFAULTS = {
    pitchShift:  0,
    indexRate:   0.75,
    f0method:    'harvest',
    protect:     0.33,
    sourceVoice: '',
  };

  let state = { ...DEFAULTS };

  function _pitchLabel(v) {
    return v > 0 ? `+${v} st` : v < 0 ? `${v} st` : '0 st';
  }

  function _pct(val, min, max) {
    return ((val - min) / (max - min)) * 100;
  }

  function _syncUI() {
    const pitchEl  = document.getElementById('rvc-pitch');
    const pitchVal = document.getElementById('rvc-pitch-val');
    if (pitchEl) {
      pitchEl.value = state.pitchShift;
      pitchEl.style.setProperty('--pct', _pct(state.pitchShift, -12, 12).toFixed(1));
    }
    if (pitchVal) pitchVal.textContent = _pitchLabel(state.pitchShift);

    const idxInt = Math.round(state.indexRate * 100);
    const idxEl  = document.getElementById('rvc-index');
    const idxVal = document.getElementById('rvc-index-val');
    if (idxEl) {
      idxEl.value = idxInt;
      idxEl.style.setProperty('--pct', _pct(idxInt, 0, 100).toFixed(1));
    }
    if (idxVal) idxVal.textContent = state.indexRate.toFixed(2);

    const protInt = Math.round(state.protect * 100);
    const protEl  = document.getElementById('rvc-protect');
    const protVal = document.getElementById('rvc-protect-val');
    if (protEl) {
      protEl.value = protInt;
      protEl.style.setProperty('--pct', _pct(protInt, 0, 50).toFixed(1));
    }
    if (protVal) protVal.textContent = state.protect.toFixed(2);

    document.querySelectorAll('input[name="rvc-f0"]').forEach(r => {
      r.checked = r.value === state.f0method;
    });

    const srcEl = document.getElementById('rvc-source');
    if (srcEl) srcEl.value = state.sourceVoice;
  }

  async function _populateSourceSelect() {
    const srcEl = document.getElementById('rvc-source');
    if (!srcEl) return;

    srcEl.innerHTML = '<option value="">Kokoro (default)</option>';

    try {
      const voices = await window.claudeAPI.ttsGetVoices();
      if (!Array.isArray(voices)) return;

      let kokoroFrag = '';
      let vitsFrag   = '';
      let inVits     = false;

      for (const v of voices) {
        if (v.isHeader) {
          inVits = v.label.includes('VITS');
          continue;
        }
        if (v.id.startsWith('rvc:')) continue;

        const opt = `<option value="${v.id}">${v.label}</option>`;
        if (inVits) vitsFrag += opt;
        else        kokoroFrag += opt;
      }

      if (kokoroFrag) {
        srcEl.innerHTML += `<optgroup label="── KOKORO">${kokoroFrag}</optgroup>`;
      }
      if (vitsFrag) {
        srcEl.innerHTML += `<optgroup label="── VITS ANIME">${vitsFrag}</optgroup>`;
      }
    } catch (e) {
      console.warn('[RvcSettings] could not fetch voice list:', e);
    }

    srcEl.value = state.sourceVoice;
  }

  async function _save() {
    try {
      await window.claudeAPI.setRvcConfig({ ...state });
    } catch (e) {
      console.warn('[RvcSettings] save error:', e);
    }
  }

  async function _load() {
    try {
      const saved = await window.claudeAPI.getRvcConfig();
      if (saved && typeof saved === 'object') {
        state = { ...DEFAULTS, ...saved };
      }
    } catch (e) {
      console.warn('[RvcSettings] load error:', e);
    }
  }

  function _wire() {
    document.getElementById('btn-settings')?.addEventListener('click', _syncUI);

    const pitchEl = document.getElementById('rvc-pitch');
    pitchEl?.addEventListener('input', () => {
      state.pitchShift = parseInt(pitchEl.value, 10);
      document.getElementById('rvc-pitch-val').textContent = _pitchLabel(state.pitchShift);
      pitchEl.style.setProperty('--pct', _pct(state.pitchShift, -12, 12).toFixed(1));
    });
    pitchEl?.addEventListener('change', _save);

    const idxEl = document.getElementById('rvc-index');
    idxEl?.addEventListener('input', () => {
      state.indexRate = parseInt(idxEl.value, 10) / 100;
      document.getElementById('rvc-index-val').textContent = state.indexRate.toFixed(2);
      idxEl.style.setProperty('--pct', _pct(parseInt(idxEl.value, 10), 0, 100).toFixed(1));
    });
    idxEl?.addEventListener('change', _save);

    const protEl = document.getElementById('rvc-protect');
    protEl?.addEventListener('input', () => {
      state.protect = parseInt(protEl.value, 10) / 100;
      document.getElementById('rvc-protect-val').textContent = state.protect.toFixed(2);
      protEl.style.setProperty('--pct', _pct(parseInt(protEl.value, 10), 0, 50).toFixed(1));
    });
    protEl?.addEventListener('change', _save);

    document.querySelectorAll('input[name="rvc-f0"]').forEach(r => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        state.f0method = r.value;
        _save();
      });
    });

    const srcEl = document.getElementById('rvc-source');
    srcEl?.addEventListener('change', () => {
      state.sourceVoice = srcEl.value;
      _save();
    });
  }

  async function init() {
    await _load();
    await _populateSourceSelect();
    _syncUI();
    _wire();
  }

  return { init };

})();
