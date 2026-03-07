'use strict';
// BackgroundSettings — manages visual packages and the background/display settings panel.
// Packages and effects are registered via PackageRegistry (see vp/ and packages/ folders).

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
    seasonMode:          'off',     // 'off' | 'random' | 'snow' | 'rain' | 'sunbeams' | 'leaves'
    vuAmp:               5,         // 1–15: VU meter bounce amplitude (÷100 = decimal offset)
    vuSpeed:             22,        // 5–60: VU meter speed (÷10 = seconds per cycle)
    arcadeRasterBeam:    true,      // arcade ambient sub-effects
    arcadePixelDust:     true,
    arcadeAttract:       true,
    arcadeGlitches:      true,
    moduleEnabled:       {},        // per-module on/off; missing key = enabled by default
  };

  let state = { ...DEFAULTS };
  let _rainCols = [];
  let _siPollInterval   = null;  // polls while an event is running to re-enable spawn btn
  let _idleCheckTimer   = null;  // setInterval that checks for user inactivity
  let _lastActivity     = Date.now();
  let _idleThresholdMs  = 0;    // randomised each cycle: 120–180 s

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
      seasonMode:          state.seasonMode,
      vuAmp:               state.vuAmp,
      vuSpeed:             state.vuSpeed,
      arcadeRasterBeam:    state.arcadeRasterBeam,
      arcadePixelDust:     state.arcadePixelDust,
      arcadeAttract:       state.arcadeAttract,
      arcadeGlitches:      state.arcadeGlitches,
      moduleEnabled:       { ...(state.moduleEnabled || {}) },
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
    // Expose active package on <body> so package-specific CSS rules can target it
    document.body.dataset.package = _activePackageId || '';
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

    // Set data-package BEFORE _applyAll so updateMeters renders with the correct theme
    document.body.dataset.package = id;

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

  function _isModuleEnabled(mod) {
    return state.moduleEnabled?.[mod] !== false;
  }

  function _applyVuBounce() {
    const root = document.documentElement;
    root.style.setProperty('--vu-amp',   (state.vuAmp   / 100).toFixed(3));
    root.style.setProperty('--vu-speed', (state.vuSpeed / 10).toFixed(1) + 's');
  }

  function _applyTvGlass() {
    const effect = PackageRegistry.getEffect('tvGlass');
    if (!effect) return;
    const active = (_getActivePackage()?.effectModules || []).includes('tvGlass')
                   && _isModuleEnabled('tvGlass');
    if (active) {
      if (!effect.running) effect.start({});
    } else {
      effect.stop();
    }
  }

  function _applyArcadeBorder() {
    const effect = PackageRegistry.getEffect('arcadeBorder');
    if (!effect) return;
    const active = (_getActivePackage()?.effectModules || []).includes('arcadeBorder')
                   && _isModuleEnabled('arcadeBorder');
    if (active) {
      if (!effect.running) effect.start({});
    } else {
      effect.stop();
    }
  }

  function _applySpaceInvaders() {
    const effect = PackageRegistry.getEffect('spaceInvaders');
    if (!effect) return;
    const active = (_getActivePackage()?.effectModules || []).includes('spaceInvaders')
                   && _isModuleEnabled('spaceInvaders');
    if (active) {
      if (!effect.running) effect.start({});
    } else {
      effect.stop();
    }
  }

  function _applyAsteroids() {
    const effect = PackageRegistry.getEffect('asteroids');
    if (!effect) return;
    const active = (_getActivePackage()?.effectModules || []).includes('asteroids')
                   && _isModuleEnabled('asteroids');
    if (active) {
      if (!effect.running) effect.start({});
    } else {
      effect.stop();
    }
  }

  function _applyPong() {
    const effect = PackageRegistry.getEffect('pong');
    if (!effect) return;
    const active = (_getActivePackage()?.effectModules || []).includes('pong')
                   && _isModuleEnabled('pong');
    if (active) {
      if (!effect.running) effect.start({});
    } else {
      effect.stop();
    }
  }

  function _applySideScroller() {
    const effect = PackageRegistry.getEffect('sideScroller');
    if (!effect) return;
    const active = (_getActivePackage()?.effectModules || []).includes('sideScroller')
                   && _isModuleEnabled('sideScroller');
    if (active) {
      if (!effect.running) effect.start({});
    } else {
      effect.stop();
    }
  }

  function _applyArcadeAmbient() {
    const effect = PackageRegistry.getEffect('arcadeAmbient');
    if (!effect) return;
    const active = (_getActivePackage()?.effectModules || []).includes('arcadeAmbient')
                   && _isModuleEnabled('arcadeAmbient');
    if (active) {
      const cfg = {
        rasterBeam: state.arcadeRasterBeam !== false,
        pixelDust:  state.arcadePixelDust  !== false,
        attract:    state.arcadeAttract    !== false,
        glitches:   state.arcadeGlitches   !== false,
      };
      if (!effect.running) {
        effect.start(cfg);
      } else {
        effect.update('rasterBeam', cfg.rasterBeam);
        effect.update('pixelDust',  cfg.pixelDust);
        effect.update('attract',    cfg.attract);
        effect.update('glitches',   cfg.glitches);
      }
    } else {
      effect.stop();
    }
  }

  function _applySeasons() {
    const effect = PackageRegistry.getEffect('seasons');
    if (!effect) return;
    const hasSeasons = (_getActivePackage()?.effectModules || []).includes('seasons')
                       && _isModuleEnabled('seasons');
    if (hasSeasons) {
      effect.running
        ? effect.update('seasonMode', state.seasonMode || 'off')
        : effect.start({ seasonMode: state.seasonMode || 'off' });
    } else {
      effect.stop();
    }
  }

  // Override disabled modules — runs last in _applyAll so their effects are suppressed
  function _applyModuleEnabled() {
    if (!_isModuleEnabled('grid')) {
      document.getElementById('bg-grid')?.classList.remove('active', 'grid-animate', 'square', 'hex');
    }
    if (!_isModuleEnabled('filmGrain')) {
      const el = document.getElementById('bg-noise');
      if (el) { el.style.opacity = '0'; el.classList.remove('grain-animate'); }
    }
    if (!_isModuleEnabled('overlayEffects')) {
      ['bg-edge-glow', 'bg-chroma', 'bg-data-rain', 'bg-circuit'].forEach(id =>
        document.getElementById(id)?.classList.remove('active'));
    }
    if (!_isModuleEnabled('scanlines')) {
      document.querySelector('.crt-overlay')?.classList.add('scanlines-off');
    }
    if (!_isModuleEnabled('parchment')) {
      const el = document.getElementById('bg-parchment');
      if (el) el.style.opacity = '0';
    }
    if (!_isModuleEnabled('seasons')) {
      PackageRegistry.getEffect('seasons')?.stop();
    }
    if (!_isModuleEnabled('spaceInvaders')) {
      PackageRegistry.getEffect('spaceInvaders')?.stop();
    }
    if (!_isModuleEnabled('asteroids')) {
      PackageRegistry.getEffect('asteroids')?.stop();
    }
    if (!_isModuleEnabled('pong')) {
      PackageRegistry.getEffect('pong')?.stop();
    }
    if (!_isModuleEnabled('sideScroller')) {
      PackageRegistry.getEffect('sideScroller')?.stop();
    }
    if (!_isModuleEnabled('tvGlass')) {
      PackageRegistry.getEffect('tvGlass')?.stop();
    }
    if (!_isModuleEnabled('arcadeBorder')) {
      PackageRegistry.getEffect('arcadeBorder')?.stop();
    }
    if (!_isModuleEnabled('arcadeAmbient')) {
      PackageRegistry.getEffect('arcadeAmbient')?.stop();
    }
  }

  // Sync module toggle button visuals and section disabled state
  function _syncModuleToggleUI() {
    document.querySelectorAll('.module-toggle-btn').forEach(btn => {
      const on = _isModuleEnabled(btn.dataset.module);
      btn.classList.toggle('module-on',  on);
      btn.classList.toggle('module-off', !on);
      btn.textContent = on ? 'ON' : 'OFF';
    });
    document.querySelectorAll('[data-effect-module]').forEach(section => {
      if (!section.querySelector(':scope > .settings-section-title')) return;
      section.classList.toggle('module-disabled', !_isModuleEnabled(section.dataset.effectModule));
    });
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
    _applyVuBounce();
    _applySeasons();
    _applySpaceInvaders();
    _applyAsteroids();
    _applyPong();
    _applySideScroller();
    _applyArcadeAmbient();
    _applyTvGlass();
    _applyArcadeBorder();
    _applyModuleEnabled(); // must run last — overrides state from disabled modules
  }

  // ── UI helpers ───────────────────────────────────────────────────────────

  function _setToggle(id, active) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', active);
    el.textContent = active ? 'ON' : 'OFF';
  }

  // All arcade event IDs — adding a new event here auto-gates all spawn buttons
  const _EVENT_IDS = ['spaceInvaders', 'asteroids', 'pong', 'sideScroller', 'pacman'];

  function _syncEventSpawnBtns() {
    const anyBusy = _EVENT_IDS.some(id => PackageRegistry.getEffect(id)?.busy);
    for (const id of ['si-spawn-btn', 'ast-spawn-btn', 'pong-spawn-btn', 'ss-spawn-btn', 'pm-spawn-btn']) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.disabled = anyBusy;
      btn.classList.toggle('active', !anyBusy);
    }
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
    // Season mode buttons
    document.querySelectorAll('.season-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.season === (state.seasonMode || 'off')));
    // Parchment opacity
    _updateSlider('parchment-opacity', 'parchment-opacity-val', state.parchmentOpacity, 0, 30);
    // VU bounce controls
    _updateSlider('vu-amp', 'vu-amp-val', state.vuAmp, 1, 15);
    _updateSlider('vu-speed', 'vu-speed-val', state.vuSpeed, 5, 60);
    const vuSpeedValEl = document.getElementById('vu-speed-val');
    if (vuSpeedValEl) vuSpeedValEl.textContent = (state.vuSpeed / 10).toFixed(1) + 's';
    // Event spawn buttons — dim all while any event is busy
    _syncEventSpawnBtns();
    // Arcade ambient sub-effect toggles
    _setToggle('ambient-raster-btn',  state.arcadeRasterBeam !== false);
    _setToggle('ambient-dust-btn',    state.arcadePixelDust  !== false);
    _setToggle('ambient-attract-btn', state.arcadeAttract    !== false);
    _setToggle('ambient-glitch-btn',  state.arcadeGlitches   !== false);
    // Module toggle buttons
    _syncModuleToggleUI();
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

    // ── Response length ──
    document.getElementById('response-length-group')?.addEventListener('change', (e) => {
      if (e.target.name === 'response-length') {
        window.claudeAPI.setResponseLength(e.target.value).catch(() => {});
      }
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

    // ── Seasons ──
    document.querySelectorAll('.season-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.seasonMode = btn.dataset.season;
        _applySeasons();
        _save();
        document.querySelectorAll('.season-btn').forEach(b =>
          b.classList.toggle('active', b === btn));
      });
    });

    // ── VU Bounce ──
    const vuAmpSlider   = document.getElementById('vu-amp');
    const vuSpeedSlider = document.getElementById('vu-speed');
    vuAmpSlider?.addEventListener('input', () => {
      state.vuAmp = parseInt(vuAmpSlider.value, 10);
      _updateSlider('vu-amp', 'vu-amp-val', state.vuAmp, 1, 15);
      _applyVuBounce();
    });
    vuAmpSlider?.addEventListener('change', _save);
    vuSpeedSlider?.addEventListener('input', () => {
      state.vuSpeed = parseInt(vuSpeedSlider.value, 10);
      _updateSlider('vu-speed', 'vu-speed-val', state.vuSpeed, 5, 60);
      const el = document.getElementById('vu-speed-val');
      if (el) el.textContent = (state.vuSpeed / 10).toFixed(1) + 's';
      _applyVuBounce();
    });
    vuSpeedSlider?.addEventListener('change', _save);

    // ── Module on/off toggles (injected dynamically into package section headers) ──
    document.querySelectorAll('[data-effect-module]').forEach(section => {
      const titleEl = section.querySelector(':scope > .settings-section-title');
      if (!titleEl) return; // skip sub-sections without a title (e.g. vuBounce sliders)
      const mod = section.dataset.effectModule;
      const btn = document.createElement('button');
      btn.className = 'module-toggle-btn';
      btn.dataset.module = mod;
      titleEl.appendChild(btn);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.moduleEnabled) state.moduleEnabled = {};
        state.moduleEnabled[mod] = !_isModuleEnabled(mod);
        _syncModuleToggleUI();
        _applyAll();   // re-applies everything; _applyModuleEnabled() at end suppresses disabled ones
        _save();
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!state.moduleEnabled) state.moduleEnabled = {};
        state.moduleEnabled[mod] = false;
        _syncModuleToggleUI();
        _applyModuleEnabled();
        _save();
      });
    });
    // Arcade event spawn buttons — all share the busy-gate; poll re-enables after run
    function _spawnEvent(effectId) {
      if (_EVENT_IDS.some(id => PackageRegistry.getEffect(id)?.busy)) return;
      PackageRegistry.getEffect(effectId)?.spawn();
      _syncEventSpawnBtns();
      if (_siPollInterval) clearInterval(_siPollInterval);
      _siPollInterval = setInterval(() => {
        _syncEventSpawnBtns();
        if (!_EVENT_IDS.some(id => PackageRegistry.getEffect(id)?.busy)) {
          clearInterval(_siPollInterval); _siPollInterval = null;
        }
      }, 500);
    }
    document.getElementById('si-spawn-btn')?.addEventListener('click',   () => _spawnEvent('spaceInvaders'));
    document.getElementById('ast-spawn-btn')?.addEventListener('click',  () => _spawnEvent('asteroids'));
    document.getElementById('pong-spawn-btn')?.addEventListener('click', () => _spawnEvent('pong'));
    document.getElementById('ss-spawn-btn')?.addEventListener('click',   () => _spawnEvent('sideScroller'));
    document.getElementById('pm-spawn-btn')?.addEventListener('click',   () => _spawnEvent('pacman'));

    // ── Idle auto-spawn ───────────────────────────────────────────────────────
    // After 2–3 min of user inactivity, fire a random arcade event (if arcade
    // package is active and no event is already running).
    function _pickIdleThreshold() {
      return (120 + Math.random() * 60) * 1000;   // 120–180 s in ms
    }
    function _idleSpawn() {
      const mods = _getActivePackage()?.effectModules || [];
      const eligible = _EVENT_IDS.filter(id =>
        mods.includes(id) && _isModuleEnabled(id)
      );
      if (!eligible.length) return;
      if (_EVENT_IDS.some(id => PackageRegistry.getEffect(id)?.busy)) return;
      const id = eligible[Math.floor(Math.random() * eligible.length)];
      _spawnEvent(id);
    }
    _idleThresholdMs = _pickIdleThreshold();
    _idleCheckTimer  = setInterval(() => {
      if (Date.now() - _lastActivity >= _idleThresholdMs) {
        _lastActivity    = Date.now();           // prevent double-firing
        _idleThresholdMs = _pickIdleThreshold(); // new random window next cycle
        _idleSpawn();
      }
    }, 15_000);   // check every 15 s

    // Reset idle counter on any user interaction
    const _resetIdle = () => { _lastActivity = Date.now(); };
    document.addEventListener('mousemove',  _resetIdle, { passive: true });
    document.addEventListener('mousedown',  _resetIdle, { passive: true });
    document.addEventListener('keydown',    _resetIdle, { passive: true });
    document.addEventListener('touchstart', _resetIdle, { passive: true });

    // Arcade Ambient — sub-effect toggle buttons
    [
      ['ambient-raster-btn',  'arcadeRasterBeam', 'rasterBeam'],
      ['ambient-dust-btn',    'arcadePixelDust',  'pixelDust'],
      ['ambient-attract-btn', 'arcadeAttract',    'attract'],
      ['ambient-glitch-btn',  'arcadeGlitches',   'glitches'],
    ].forEach(([id, stateKey, effectKey]) => {
      document.getElementById(id)?.addEventListener('click', () => {
        state[stateKey] = !(state[stateKey] !== false);
        _syncUI();
        const effect = PackageRegistry.getEffect('arcadeAmbient');
        if (effect?.running) effect.update(effectKey, state[stateKey]);
        _save();
      });
    });

    _syncModuleToggleUI();
  }

  // ── Public ───────────────────────────────────────────────────────────────

  async function init() {
    await _load();

    // Re-seed package configs from PackageRegistry so any code-level color/effect
    // updates take effect immediately without needing to clear saved config.
    // Only saved effect overrides are preserved from config.json.
    const savedEffectsMap = new Map((_packages || []).map(p => [p.id, p.effects]));
    _packages = PackageRegistry.getPackageConfigs(savedEffectsMap);

    if (!_activePackageId) {
      _activePackageId = _packages[0]?.id || 'cybernetic';
    }

    // Apply the active package's color scheme and effects
    const pkg = _getActivePackage();
    if (pkg) {
      _applyColorScheme(pkg.colors);
      Object.assign(state, pkg.effects || {});
    }

    // Set data-package BEFORE _applyAll so updateMeters renders with correct theme symbols
    document.body.dataset.package = _activePackageId || '';
    _applyAll();
    _applyEffectModuleVisibility();
    _renderPackageSelector();

    // Load saved zoom
    try {
      _zoom = await window.claudeAPI.getZoom();
    } catch { _zoom = 100; }
    _syncZoomUI();

    // Load saved response length
    try {
      const len = await window.claudeAPI.getResponseLength();
      const radio = document.querySelector(`input[name="response-length"][value="${len}"]`);
      if (radio) radio.checked = true;
    } catch {}

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
