'use strict';
/**
 * ArcadePackage — "ARCADE CABINET" Visual Package.
 *
 * Aesthetic: deep black cabinet with bold coin-op yellow, 1980s arcade energy.
 * Active effects: tvGlass canvas (CRT glass surface — glare, vignette, rim lights),
 *                 arcadeBorder canvas (bezel frame + marquee + sparks),
 *                 spaceInvaders canvas (random event — ship + shields + enemy waves),
 *                 heavy scanlines (authentic CRT), light static film grain.
 * Background: none (the border effect provides all the scenery).
 * Fonts:      default.
 * Music:      none yet.
 * Sounds:     none yet.
 */
class ArcadePackage extends VisualPackage {

  constructor() {
    super();

    this.id   = 'arcade_cabinet';
    this.name = 'ARCADE';
    this.desc = 'coin-op yellow / pixel bezel';

    // ── Colorscheme ──────────────────────────────────────────────────────────
    this.colors = {
      '--cyan':          '#ffee00',   // player-1 yellow — primary accent
      '--cyan-dim':      '#997700',   // dim yellow
      '--green':         '#00dd44',   // insert-coin green
      '--magenta':       '#ff2200',   // p2 red
      '--purple':        '#ff6600',   // orange accent
      '--orange':        '#ffaa00',   // amber highlight
      '--red':           '#cc0000',   // deep red
      '--yellow':        '#ffff66',   // bright highlight
      '--bg-dark':       '#080808',   // near-black cabinet body
      '--bg-panel':      '#0f0f0f',   // panel surface
      '--bg-mid':        '#161616',   // mid tone
      '--bg-input':      '#0a0a0a',   // input background
      '--border':        '#2a1400',   // very dark amber border
      '--border-glow':   '#ffee0033', // yellow haze with alpha
      // Axis bar gradient stops
      '--axis-val-lo':   '#882200',
      '--axis-val-hi':   '#ffee00',
      '--axis-aro-lo':   '#221100',
      '--axis-aro-hi':   '#ff4400',
      '--axis-soc-lo':   '#002211',
      '--axis-soc-hi':   '#00dd44',
      '--axis-phy-lo':   '#001133',
      '--axis-phy-hi':   '#4488ff',
      // Package-specific UI tints
      '--badge-filler':  '#00bb44',
      '--thoughts-color':'#886600',
    };

    // ── Settings menu theme ─────────────────────────────────────────────────
    // Arcade: chunky pixel-block bezel, 8-bit palette, ridge borders like a
    // cabinet marquee. Zero corner radius (pixels don't curve) and blocky
    // dividers. Faint checker pattern in the section bodies for that
    // sprite-sheet feel.
    this.settingsTheme = {
      panelBg:              '#0a0800',
      // 2×2 pixel checker — reads as a subtle 8-bit texture behind the content.
      patternSvg:           `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><rect width='2' height='2' fill='%23ffee00' opacity='0.6'/><rect x='2' y='2' width='2' height='2' fill='%23ffee00' opacity='0.6'/></svg>`,
      patternOpacity:       0.06,
      patternSize:          '4px',
      borderStyle:          'ridge',
      borderWidth:          '3px',
      cornerRadius:         '0',
      headerFont:           "'Press Start 2P', 'Courier New', monospace",
      headerTransform:      'uppercase',
      headerLetterSpacing:  '3px',
      headerWeight:         'normal',
      headerFontSize:       '10px',
      headerPadding:        '12px 16px',
      headerDividerHeight:  '3px',
      sections: {
        baseGame: {
          headerBg:    'linear-gradient(180deg, #ffee00 0%, color-mix(in srgb, #ffee00 30%, #0a0800) 100%)',
          bodyBg:      'color-mix(in srgb, #ffee00 5%, #0a0800)',
          headerColor: '#0a0800',
          borderColor: '#997700',
          accent:      '#ffee00',
        },
        visualPackage: {
          headerBg:    'linear-gradient(180deg, #00dd44 0%, color-mix(in srgb, #00dd44 30%, #0a0800) 100%)',
          bodyBg:      'color-mix(in srgb, #00dd44 5%, #0a0800)',
          headerColor: '#0a0800',
          borderColor: '#008833',
          accent:      '#00dd44',
        },
        companion: {
          headerBg:    'linear-gradient(180deg, #ff2200 0%, color-mix(in srgb, #ff2200 30%, #0a0800) 100%)',
          bodyBg:      'color-mix(in srgb, #ff2200 5%, #0a0800)',
          headerColor: '#fff',
          borderColor: '#aa1500',
          accent:      '#ff2200',
        },
        adventure: {
          headerBg:    'linear-gradient(180deg, #ff6600 0%, color-mix(in srgb, #ff6600 30%, #0a0800) 100%)',
          bodyBg:      'color-mix(in srgb, #ff6600 5%, #0a0800)',
          headerColor: '#fff',
          borderColor: '#aa4400',
          accent:      '#ff6600',
        },
        story: {
          headerBg:    'linear-gradient(180deg, #00aaff 0%, color-mix(in srgb, #00aaff 30%, #0a0800) 100%)',
          bodyBg:      'color-mix(in srgb, #00aaff 5%, #0a0800)',
          headerColor: '#0a0800',
          borderColor: '#0077bb',
          accent:      '#00aaff',
        },
      },
    };

    // ── Effects ──────────────────────────────────────────────────────────────
    // Side Scroller intentionally omitted — the code still exists but it is no
    // longer selectable as a random event and its settings row is hidden.
    this.effectModules = ['tvGlass', 'arcadeBorder', 'spaceInvaders', 'asteroids', 'pong', 'pacman', 'datingVn', 'arcadeAmbient', 'scanlines', 'filmGrain'];

    this.defaultEffects = {
      arcadePrimaryColor:  '#ffee00', // player-1 yellow; overrides --cyan when arcade package is active
      grid:                'off',
      gridColor:           'cyan',
      gridAnimate:         false,
      gridOpacity:         0,
      filmGrain:           true,
      filmGrainOpacity:    4,
      filmGrainAnimate:    false,   // static grain — more period-accurate
      dataRain:            false,
      circuitPattern:      false,
      edgeGlow:            false,
      chromaticAberration: false,
      scanlinesIntensity:  'heavy', // thick CRT scanlines
      parchmentOpacity:    0,
      vuAmp:               5,
      vuSpeed:             22,
      arcadeRasterBeam:    true,
      arcadePixelDust:     true,
      arcadeAttract:       true,
      arcadeGlitches:      true,
      moduleEnabled: {
        tvGlass:        true,
        arcadeBorder:   true,
        spaceInvaders:  true,
        asteroids:      true,
        pong:           true,
        pacman:         true,
        datingVn:       true,
        arcadeAmbient:  true,
        scanlines:      true,
        filmGrain:      true,
      },
    };
  }
}

PackageRegistry.registerPackage(new ArcadePackage());
