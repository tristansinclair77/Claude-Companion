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

    // ── Effects ──────────────────────────────────────────────────────────────
    this.effectModules = ['tvGlass', 'arcadeBorder', 'spaceInvaders', 'asteroids', 'pong', 'sideScroller', 'arcadeAmbient', 'scanlines', 'filmGrain'];

    this.defaultEffects = {
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
        sideScroller:   true,
        arcadeAmbient:  true,
        scanlines:      true,
        filmGrain:      true,
      },
    };
  }
}

PackageRegistry.registerPackage(new ArcadePackage());
