'use strict';
/**
 * WraithPackage — "WRAITH" Visual Package (Vesper).
 *
 * Aesthetic: spectral violet / deep twilight — cold moonlight through fog,
 * haunting elegance, the colour of things between worlds.
 *
 * Active effects: film grain (ghostly mist), edge glow (spectral emanation),
 *                 chromatic aberration (seen-through-a-veil distortion),
 *                 light scanlines, VU bounce.
 * Background: none (depth from color layers alone).
 * Fonts:      'Trebuchet MS' thin sans-serif — wispy, not monospace-blocky.
 * Music:      none yet.
 * Sounds:     none yet.
 */
class WraithPackage extends VisualPackage {

  constructor() {
    super();

    this.id   = 'wraith';
    this.name = 'WRAITH';
    this.desc = 'spectral violet / deep twilight';

    // ── Colorscheme ──────────────────────────────────────────────────────────
    this.colors = {
      '--cyan':          '#b388ff',   // pale spectral violet — primary accent
      '--cyan-dim':      '#4a2080',   // deep shadow-purple
      '--green':         '#9c6fff',   // cooler lavender (secondary accent role)
      '--magenta':       '#e040d0',   // ghostly spectral magenta
      '--purple':        '#7b2fff',   // deep arcane violet
      '--orange':        '#6688cc',   // ethereal steel-blue (moonlit mist)
      '--red':           '#cc2266',   // cold crimson — spectral fade
      '--yellow':        '#ddc8ff',   // ghostly pale lavender-white
      '--bg-dark':       '#06040d',   // near-black with deep violet tint
      '--bg-panel':      '#0c0815',   // dark indigo-void
      '--bg-mid':        '#10091e',   // midnight violet
      '--bg-input':      '#080610',   // deep shadow
      '--border':        '#1c0f33',   // dark violet border
      '--border-glow':   'rgba(160, 100, 255, 0.15)',  // spectral violet haze
      // Axis bar gradient stops — all in the violet/spectral family
      '--axis-val-lo':   '#110022',   // void
      '--axis-val-hi':   '#bb66ff',   // bright spectral
      '--axis-aro-lo':   '#0a0022',   // cold indigo void
      '--axis-aro-hi':   '#c0aaff',   // cool white-violet
      '--axis-soc-lo':   '#0d0015',   // near-black
      '--axis-soc-hi':   '#8877bb',   // misty periwinkle
      '--axis-phy-lo':   '#22203a',   // slate-void
      '--axis-phy-hi':   '#aab0cc',   // silver-lavender
      // Package-specific UI tints
      '--badge-filler':  '#9933cc',   // vivid spectral purple for filler badge
      '--thoughts-color':'#6644aa',   // muted purple — Vesper's inner voice
    };

    // ── Effects ──────────────────────────────────────────────────────────────
    this.effectModules = ['filmGrain', 'overlayEffects', 'scanlines', 'wraithAmbient'];

    this.defaultEffects = {
      grid:                'off',
      gridColor:           'cyan',
      gridAnimate:         false,
      gridOpacity:         0,
      filmGrain:           true,
      filmGrainOpacity:    8,          // misty spectral noise — slightly heavier
      filmGrainAnimate:    true,
      dataRain:            false,
      circuitPattern:      false,
      edgeGlow:            true,       // spectral emanation from the edges
      chromaticAberration: true,       // seen-through-a-veil distortion
      scanlinesIntensity:  'light',    // subtle texture, not full CRT
      parchmentOpacity:    0,
      seasonMode:          'off',
      vuAmp:               0,
      vuSpeed:             22,
      moduleEnabled: {
        filmGrain:      true,
        overlayEffects: true,
        scanlines:      true,
        wraithAmbient:  true,
      },
    };
  }
}

PackageRegistry.registerPackage(new WraithPackage());
