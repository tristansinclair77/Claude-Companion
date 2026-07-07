'use strict';
/**
 * VisualPackage — base class for all Visual Packages.
 *
 * Each Visual Package defines six categories:
 *   1. Colorscheme  — CSS variable map applied to :root
 *   2. Effects      — which settings module sections to slot in + their defaults
 *   3. Background   — background image / video / canvas scenery
 *   4. Fonts        — UI and header font overrides
 *   5. Music        — ambient audio track
 *   6. Sounds       — UI sound effect pack
 *
 * Subclasses set properties in their constructor and call
 * PackageRegistry.registerPackage(this) at the bottom of their file.
 *
 * settings.js calls toConfig() to get a plain object it can save/load.
 */
class VisualPackage {

  constructor() {
    // Identity
    this.id   = '';
    this.name = '';
    this.desc = '';

    // ── Category 1: Colorscheme ─────────────────────────────────────────────
    // Map of CSS variable names → hex values applied to :root on package switch.
    this.colors = {};

    // ── Category 2: Effects ─────────────────────────────────────────────────
    // effectModules: which named sections appear in the settings panel for this package.
    // defaultEffects: starting values for the live effect state when using this package.
    this.effectModules  = [];
    this.defaultEffects = {};

    // ── Category 3: Background ──────────────────────────────────────────────
    // type: 'none' | 'image' | 'video'
    // src:  path/URL to the asset, or null
    this.background = { type: 'none', src: null };

    // ── Category 4: Fonts ───────────────────────────────────────────────────
    // null = use default (system/CSS-defined). Values are CSS font-family strings.
    this.fonts = { ui: null, header: null };

    // ── Category 5: Music ───────────────────────────────────────────────────
    // track: path/URL to audio file, or null
    // volume: 0.0–1.0
    this.music = { track: null, volume: 0.5 };

    // ── Category 6: Sounds ──────────────────────────────────────────────────
    // pack: identifier for a sound effect pack, or null (uses default UI sounds)
    this.sounds = { pack: null };

    // ── Category 7: Settings menu theme ─────────────────────────────────────
    // Drives the visual look of the Settings ⚙ menu — each super-section
    // (Base Game, Visual Package, Companion, Adventure, Story) gets its own
    // header + body theming pulled from these values. Defaults auto-derive
    // from the package's existing colorscheme so every package works out of
    // the box; individual packages override any field to get distinctive
    // per-super-section design (patterns, corner shapes, etched borders, etc.).
    //
    // All colour values are CSS-variable references so they resolve against
    // whatever colours the active package has installed on :root at the moment
    // — that keeps things responsive to package switches without a rebind.
    this.settingsTheme = {
      // Outer wrapper background under all super-sections
      panelBg:              'var(--bg-dark)',

      // Optional SVG pattern applied to each super-section body as a subtle
      // background texture. Data-URI SVG string, or null for no pattern.
      // Packages that want to be distinctive (parchment, circuits, pixel-grid)
      // supply their own; defaults leave it null.
      patternSvg:           null,
      patternOpacity:       0.05,   // 0..1 — how visible the pattern is
      patternSize:          '24px', // tile size

      // Border style per super-section box
      borderStyle:          'solid',    // 'solid' | 'double' | 'ridge' | 'groove' | 'dashed'
      borderWidth:          '1px',
      cornerRadius:         '0',

      // Header appearance (super-section title)
      headerFont:           'inherit',      // font-family override, or 'inherit'
      headerTransform:      'uppercase',
      headerLetterSpacing:  '2px',
      headerWeight:         'bold',
      headerFontSize:       '11px',
      headerPadding:        '8px 14px',
      headerDividerHeight:  '1px',          // divider line under the header

      // Per-super-section colours. Each entry is { headerBg, bodyBg,
      // headerColor, borderColor, accent }. Defaults use existing package
      // accent variables so each super-section gets a naturally-distinct
      // colour from the palette the package already defines.
      sections: {
        baseGame: {
          headerBg:    'color-mix(in srgb, var(--cyan) 12%, var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--cyan) 3%,  var(--bg-panel))',
          headerColor: 'var(--cyan)',
          borderColor: 'color-mix(in srgb, var(--cyan) 30%, transparent)',
          accent:      'var(--cyan)',
        },
        visualPackage: {
          headerBg:    'color-mix(in srgb, var(--green) 12%, var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--green) 3%,  var(--bg-panel))',
          headerColor: 'var(--green)',
          borderColor: 'color-mix(in srgb, var(--green) 30%, transparent)',
          accent:      'var(--green)',
        },
        companion: {
          headerBg:    'color-mix(in srgb, var(--magenta) 12%, var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--magenta) 3%,  var(--bg-panel))',
          headerColor: 'var(--magenta)',
          borderColor: 'color-mix(in srgb, var(--magenta) 30%, transparent)',
          accent:      'var(--magenta)',
        },
        adventure: {
          headerBg:    'color-mix(in srgb, var(--orange) 12%, var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--orange) 3%,  var(--bg-panel))',
          headerColor: 'var(--orange)',
          borderColor: 'color-mix(in srgb, var(--orange) 30%, transparent)',
          accent:      'var(--orange)',
        },
        story: {
          headerBg:    'color-mix(in srgb, var(--yellow) 12%, var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--yellow) 3%,  var(--bg-panel))',
          headerColor: 'var(--yellow)',
          borderColor: 'color-mix(in srgb, var(--yellow) 30%, transparent)',
          accent:      'var(--yellow)',
        },
      },
    };
  }

  /**
   * Returns a plain config object compatible with settings.js save/load system.
   * Merges any user-saved effect overrides on top of this package's defaults,
   * so user tweaks survive package switches and app restarts.
   *
   * @param {Object} savedEffects — previously persisted effect state for this package
   * @returns {Object}
   */
  toConfig(savedEffects = {}) {
    return {
      id:             this.id,
      name:           this.name,
      desc:           this.desc,
      colors:         { ...this.colors },
      effectModules:  [...this.effectModules],
      effects:        { ...this.defaultEffects, ...savedEffects },
      background:     { ...this.background },
      fonts:          { ...this.fonts },
      music:          { ...this.music },
      sounds:         { ...this.sounds },
      settingsTheme:  JSON.parse(JSON.stringify(this.settingsTheme)),
    };
  }
}
