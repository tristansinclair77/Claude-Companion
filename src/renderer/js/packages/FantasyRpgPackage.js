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

    // ── Settings menu theme ─────────────────────────────────────────────────
    // Fantasy RPG: parchment texture, warm serif headers, hand-drawn double
    // borders like an illuminated manuscript margin. Slightly rounded corners
    // for a hand-cut feel — nothing looks laser-precise here.
    this.settingsTheme = {
      panelBg:              'var(--bg-dark)',
      // Fine parchment noise — feels like aged paper without needing an image.
      patternSvg:           `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 0.7 0 0 0 0 0.55 0 0 0 0 0.25 0 0 0 1 0'/></filter><rect width='40' height='40' filter='url(%23n)' opacity='0.35'/></svg>`,
      patternOpacity:       0.08,
      patternSize:          '40px',
      borderStyle:          'double',
      borderWidth:          '3px',
      cornerRadius:         '3px',
      headerFont:           'Palatino Linotype, Palatino, "Book Antiqua", serif',
      headerTransform:      'uppercase',
      headerLetterSpacing:  '4px',
      headerWeight:         'bold',
      headerFontSize:       '12px',
      headerPadding:        '10px 16px',
      headerDividerHeight:  '2px',
      sections: {
        baseGame: {
          headerBg:    'linear-gradient(180deg, color-mix(in srgb, #ffaa00 20%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, #ffaa00 6%, var(--bg-panel))',
          headerColor: '#ffdd88',
          borderColor: 'color-mix(in srgb, #ffaa00 55%, transparent)',
          accent:      'var(--cyan)',   // amber gold on this package
        },
        visualPackage: {
          headerBg:    'linear-gradient(180deg, color-mix(in srgb, #ddaa00 20%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, #ddaa00 6%, var(--bg-panel))',
          headerColor: '#ffe4a0',
          borderColor: 'color-mix(in srgb, #ddaa00 55%, transparent)',
          accent:      'var(--green)',
        },
        companion: {
          headerBg:    'linear-gradient(180deg, color-mix(in srgb, #cc3333 22%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, #cc3333 6%, var(--bg-panel))',
          headerColor: '#ff9988',
          borderColor: 'color-mix(in srgb, #cc3333 55%, transparent)',
          accent:      'var(--magenta)',
        },
        adventure: {
          headerBg:    'linear-gradient(180deg, color-mix(in srgb, #ff6600 20%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, #ff6600 6%, var(--bg-panel))',
          headerColor: '#ffcc88',
          borderColor: 'color-mix(in srgb, #ff6600 55%, transparent)',
          accent:      'var(--orange)',
        },
        story: {
          headerBg:    'linear-gradient(180deg, color-mix(in srgb, #ffdd88 22%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, #ffdd88 6%, var(--bg-panel))',
          headerColor: '#fff0c8',
          borderColor: 'color-mix(in srgb, #ffdd88 55%, transparent)',
          accent:      'var(--yellow)',
        },
      },
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
