'use strict';
/**
 * FantasyRpgPackage — "FANTASY RPG" Visual Package.
 *
 * Aesthetic: warm amber / arcane, parchment and candlelight.
 * Active effects: parchment overlay, seasons canvas (snow/rain/sunbeams/leaves).
 * Background: none yet (parchment gradient handled by #bg-parchment layer in bg-effects.css).
 * Fonts:      default (serif font applied via data-package CSS in main.css).
 * Music:      none yet.
 * Sounds:     none yet.
 */
class FantasyRpgPackage extends VisualPackage {

  constructor() {
    super();

    this.id   = 'fantasy_rpg';
    this.name = 'FANTASY RPG';
    this.desc = 'warm amber / arcane';

    // ── Colorscheme ──────────────────────────────────────────────────────────
    this.colors = {
      '--cyan':          '#ffaa00',   // amber gold — primary accent
      '--cyan-dim':      '#885500',   // tarnished bronze
      '--green':         '#ddaa00',   // warm amber-gold
      '--magenta':       '#cc3333',   // deep blood red
      '--purple':        '#9944ff',   // arcane violet
      '--orange':        '#ff6600',   // ember orange
      '--red':           '#993311',   // dark crimson
      '--yellow':        '#ffdd88',   // candlelight
      '--bg-dark':       '#0a0806',   // near-black warm
      '--bg-panel':      '#100d09',   // dark aged wood
      '--bg-mid':        '#18130e',   // slightly lighter
      '--bg-input':      '#0e0b07',   // deep shadow
      '--border':        '#2a1a08',   // dark amber border
      '--border-glow':   '#ffaa0022', // amber haze with alpha
      // Axis bar gradient stops — all warm family
      '--axis-val-lo':   '#882200',
      '--axis-val-hi':   '#ddaa00',
      '--axis-aro-lo':   '#332211',
      '--axis-aro-hi':   '#ff6600',
      '--axis-soc-lo':   '#2a3322',
      '--axis-soc-hi':   '#ffaa00',
      '--axis-phy-lo':   '#443322',
      '--axis-phy-hi':   '#ffdd88',
      // Package-specific UI tints
      '--badge-filler':  '#66aa44',
      '--thoughts-color':'#997755',
    };

    // ── Effects ──────────────────────────────────────────────────────────────
    this.effectModules = ['parchment', 'seasons'];

    this.defaultEffects = {
      grid:                'off',
      gridColor:           'cyan',
      gridAnimate:         false,
      gridOpacity:         0,
      filmGrain:           false,
      filmGrainOpacity:    5,
      filmGrainAnimate:    false,
      dataRain:            false,
      circuitPattern:      false,
      edgeGlow:            false,
      chromaticAberration: false,
      scanlinesIntensity:  'off',
      parchmentOpacity:    15,
      seasonMode:          'off',
      vuAmp:               5,
      vuSpeed:             22,
      moduleEnabled: {
        parchment: true,
        seasons:   true,
      },
    };
  }
}

PackageRegistry.registerPackage(new FantasyRpgPackage());
