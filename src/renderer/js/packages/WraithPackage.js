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

    // ── Settings menu theme ─────────────────────────────────────────────────
    // Wraith: hair-thin single-line borders, generous corner radius for a
    // soft ethereal shape, faint diagonal mist-gradient pattern in the body,
    // wispy sans-serif header font. Nothing feels solid — everything drifts.
    this.settingsTheme = {
      panelBg:              '#0a0714',
      // Diagonal mist streaks — a faint spectral texture without loud lines.
      patternSvg:           `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><defs><linearGradient id='m' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23b388ff' stop-opacity='0.4'/><stop offset='100%' stop-color='%23b388ff' stop-opacity='0'/></linearGradient></defs><rect width='60' height='60' fill='url(%23m)'/></svg>`,
      patternOpacity:       0.10,
      patternSize:          '60px',
      borderStyle:          'solid',
      borderWidth:          '1px',
      cornerRadius:         '10px',
      headerFont:           "'Trebuchet MS', 'Segoe UI', sans-serif",
      headerTransform:      'uppercase',
      headerLetterSpacing:  '5px',
      headerWeight:         '300',       // thin — wispy
      headerFontSize:       '11px',
      headerPadding:        '12px 18px',
      headerDividerHeight:  '1px',
      sections: {
        baseGame: {
          headerBg:    'linear-gradient(135deg, color-mix(in srgb, #b388ff 18%, #0a0714), #0a0714 70%)',
          bodyBg:      'color-mix(in srgb, #b388ff 4%, #0a0714)',
          headerColor: '#d0b8ff',
          borderColor: 'color-mix(in srgb, #b388ff 35%, transparent)',
          accent:      '#b388ff',
        },
        visualPackage: {
          headerBg:    'linear-gradient(135deg, color-mix(in srgb, #9c6fff 18%, #0a0714), #0a0714 70%)',
          bodyBg:      'color-mix(in srgb, #9c6fff 4%, #0a0714)',
          headerColor: '#c9b0ff',
          borderColor: 'color-mix(in srgb, #9c6fff 35%, transparent)',
          accent:      '#9c6fff',
        },
        companion: {
          headerBg:    'linear-gradient(135deg, color-mix(in srgb, #e040d0 18%, #0a0714), #0a0714 70%)',
          bodyBg:      'color-mix(in srgb, #e040d0 4%, #0a0714)',
          headerColor: '#ff9ce8',
          borderColor: 'color-mix(in srgb, #e040d0 35%, transparent)',
          accent:      '#e040d0',
        },
        adventure: {
          headerBg:    'linear-gradient(135deg, color-mix(in srgb, #7a5cff 18%, #0a0714), #0a0714 70%)',
          bodyBg:      'color-mix(in srgb, #7a5cff 4%, #0a0714)',
          headerColor: '#b0a0ff',
          borderColor: 'color-mix(in srgb, #7a5cff 35%, transparent)',
          accent:      '#7a5cff',
        },
        story: {
          headerBg:    'linear-gradient(135deg, color-mix(in srgb, #d8a0ff 20%, #0a0714), #0a0714 70%)',
          bodyBg:      'color-mix(in srgb, #d8a0ff 4%, #0a0714)',
          headerColor: '#ecd0ff',
          borderColor: 'color-mix(in srgb, #d8a0ff 35%, transparent)',
          accent:      '#d8a0ff',
        },
      },
    };

    // ── Effects ──────────────────────────────────────────────────────────────
    // Wraith's edge-glow / chromatic-aberration / light-scanlines still run as
    // part of its "spectral emanation" aesthetic (see defaultEffects below),
    // but their settings panels ('overlayEffects', 'scanlines') are owned by
    // the packages they belong to — Cybernetic and Arcade respectively — and
    // are intentionally NOT exposed here.
    this.effectModules = [
      'filmGrain',
      'wraithCobwebs', 'wraithSpirits', 'wraithLightning',
    ];

    this.defaultEffects = {
      grid:                'off',
      gridColor:           'cyan',
      gridAnimate:         false,
      gridOpacity:         0,
      filmGrain:           true,
      filmGrainOpacity:    8,
      filmGrainAnimate:    true,
      dataRain:            false,
      circuitPattern:      false,
      edgeGlow:            true,
      chromaticAberration: true,
      scanlinesIntensity:  'light',
      parchmentOpacity:    0,
      seasonMode:          'off',
      vuAmp:               0,
      vuSpeed:             22,
      // Wraith sub-system settings
      wraithCobwebSwayHz:   2,          // slider 1-6 → effect /10
      wraithCobwebAmp:      4,          // slider 0-12
      wraithCobwebOpacity:  5,          // slider 1-10 → effect /10
      wraithGhostEnabled:   true,
      wraithGhostInterval:  'normal',
      wraithSpiderEnabled:  true,
      wraithSpiderInterval: 'normal',
      wraithLightningEnabled:  true,
      wraithLightningInterval: 'normal',
      moduleEnabled: {
        filmGrain:       true,
        wraithCobwebs:   true,
        wraithSpirits:   true,
        wraithLightning: true,
      },
    };
  }
}

PackageRegistry.registerPackage(new WraithPackage());
