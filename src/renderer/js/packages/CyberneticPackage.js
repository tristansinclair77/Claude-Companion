'use strict';
/**
 * CyberneticPackage — "CYBERNETIC" Visual Package.
 *
 * Aesthetic: neon green / teal, cyberpunk / matrix vibe.
 * Active effects: grid, film grain, overlay effects (data rain, circuit, edge glow,
 *                 chromatic aberration), scanlines, VU bounce.
 * Background: none (pure effect-layer aesthetic, no scenery image).
 * Fonts:      default.
 * Music:      none yet.
 * Sounds:     none yet.
 */
class CyberneticPackage extends VisualPackage {

  constructor() {
    super();

    this.id   = 'cybernetic';
    this.name = 'CYBERNETIC';
    this.desc = 'neon green / teal';

    // ── Colorscheme ──────────────────────────────────────────────────────────
    this.colors = {
      '--cyan':          '#00ffcc',
      '--cyan-dim':      '#007755',
      '--green':         '#00ff88',
      '--magenta':       '#ff00aa',
      '--purple':        '#aa44ff',
      '--orange':        '#ff8800',
      '--red':           '#ff2244',
      '--yellow':        '#ffdd00',
      '--bg-dark':       '#0a0a0f',
      '--bg-panel':      '#0d0d16',
      '--bg-mid':        '#111122',
      '--bg-input':      '#0c0c18',
      '--border':        '#001a0f',
      '--border-glow':   '#00ff8833',
      // Axis bar gradient stops
      '--axis-val-lo':   '#ff4444',
      '--axis-val-hi':   '#00ff88',
      '--axis-aro-lo':   '#4488ff',
      '--axis-aro-hi':   '#ff8800',
      '--axis-soc-lo':   '#8844aa',
      '--axis-soc-hi':   '#00ccff',
      '--axis-phy-lo':   '#888866',
      '--axis-phy-hi':   '#88ff44',
      // Package-specific UI tints
      '--badge-filler':  '#00cc44',
      '--thoughts-color':'#558866',
    };

    // ── Effects ──────────────────────────────────────────────────────────────
    // effectModules: which named sections appear in the settings panel
    this.effectModules = ['grid', 'filmGrain', 'overlayEffects', 'scanlines', 'vuBounce'];

    // defaultEffects: the starting state for all effect controls this package uses
    this.defaultEffects = {
      grid:                'square',
      gridColor:           'cyan',
      gridAnimate:         true,
      gridOpacity:         100,
      filmGrain:           true,
      filmGrainOpacity:    5,
      filmGrainAnimate:    true,
      dataRain:            false,
      circuitPattern:      false,
      edgeGlow:            true,
      chromaticAberration: true,
      scanlinesIntensity:  'light',
      parchmentOpacity:    0,
      vuAmp:               5,
      vuSpeed:             22,
      moduleEnabled: {
        grid:           true,
        filmGrain:      true,
        overlayEffects: true,
        scanlines:      true,
        vuBounce:       true,
      },
    };
  }
}

PackageRegistry.registerPackage(new CyberneticPackage());
