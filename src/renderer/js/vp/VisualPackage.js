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
    };
  }
}
