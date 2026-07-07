'use strict';
/**
 * AdventurePackage — "ADVENTURE TERMINAL" Visual Package.
 *
 * Aesthetic: green phosphor CRT terminal — black void backgrounds, bright green
 * primary accent, pixel font, heavy scanlines. Matches the text-adventure panel's
 * own colour palette so the entire app feels like one cohesive terminal screen.
 *
 * Applied automatically when adventure mode is entered; restored on exit.
 * The user's own package selection is preserved — this is a temporary overlay.
 *
 * Active effects: heavy scanlines (authentic CRT), light static film grain.
 * Background: none (pure colour + effect layers).
 * Fonts:      'Press Start 2P' fallback to Courier New (pixel terminal face).
 * Music:      none (adventure music is managed by the adventure module itself).
 * Sounds:     none.
 */
class AdventurePackage extends VisualPackage {

  constructor() {
    super();

    this.id   = 'adventure_terminal';
    this.name = 'ADVENTURE';
    this.desc = 'green phosphor CRT terminal';

    // ── Colorscheme ──────────────────────────────────────────────────────────
    this.colors = {
      '--cyan':          '#66ff8b',   // green phosphor — primary accent
      '--cyan-dim':      '#1a6b33',   // dim phosphor
      '--green':         '#00ff66',   // bright terminal green
      '--magenta':       '#ff4466',   // alert / Aria-line accent
      '--purple':        '#aa44ff',   // spell / arcane
      '--orange':        '#ffaa00',   // warning / gold
      '--red':           '#ff2244',   // danger / enemy
      '--yellow':        '#ffea88',   // prompt / highlight
      '--bg-dark':       '#000c02',   // near-black with green tint
      '--bg-panel':      '#001204',   // panel surface
      '--bg-mid':        '#001806',   // slightly lighter
      '--bg-input':      '#000a02',   // input background
      '--border':        '#003308',   // dark green border
      '--border-glow':   'rgba(102, 255, 139, 0.15)',  // phosphor haze
      // Axis bar gradient stops — full green family
      '--axis-val-lo':   '#1a4422',
      '--axis-val-hi':   '#66ff8b',
      '--axis-aro-lo':   '#0a3311',
      '--axis-aro-hi':   '#00ff66',
      '--axis-soc-lo':   '#003322',
      '--axis-soc-hi':   '#33ffcc',
      '--axis-phy-lo':   '#112211',
      '--axis-phy-hi':   '#88ffbb',
      // Package-specific UI tints
      '--badge-filler':  '#00cc44',
      '--thoughts-color':'#1a6b33',
    };

    // ── Settings menu theme ─────────────────────────────────────────────────
    // Adventure Terminal: CRT phosphor look — hard 90° corners, faint
    // scanline pattern, dashed pixel borders, pixel-terminal header font.
    // Every super-section reads like a different terminal window.
    this.settingsTheme = {
      panelBg:              '#000000',
      // Faint horizontal scanlines — one line every 3px, CRT feel.
      patternSvg:           `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='3'><rect width='4' height='1' fill='%2366ff8b' opacity='0.35'/></svg>`,
      patternOpacity:       0.08,
      patternSize:          '4px 3px',
      borderStyle:          'dashed',
      borderWidth:          '1px',
      cornerRadius:         '0',
      headerFont:           "'Press Start 2P', 'Courier New', monospace",
      headerTransform:      'uppercase',
      headerLetterSpacing:  '2px',
      headerWeight:         'normal',
      headerFontSize:       '9px',
      headerPadding:        '10px 14px',
      headerDividerHeight:  '1px',
      sections: {
        baseGame: {
          headerBg:    'color-mix(in srgb, #66ff8b 15%, #000000)',
          bodyBg:      'color-mix(in srgb, #66ff8b 4%, #000000)',
          headerColor: '#66ff8b',
          borderColor: 'color-mix(in srgb, #66ff8b 55%, transparent)',
          accent:      '#66ff8b',
        },
        visualPackage: {
          headerBg:    'color-mix(in srgb, #ffdd44 15%, #000000)',
          bodyBg:      'color-mix(in srgb, #ffdd44 4%, #000000)',
          headerColor: '#ffdd44',
          borderColor: 'color-mix(in srgb, #ffdd44 55%, transparent)',
          accent:      '#ffdd44',
        },
        companion: {
          headerBg:    'color-mix(in srgb, #ff6b9d 15%, #000000)',
          bodyBg:      'color-mix(in srgb, #ff6b9d 4%, #000000)',
          headerColor: '#ff6b9d',
          borderColor: 'color-mix(in srgb, #ff6b9d 55%, transparent)',
          accent:      '#ff6b9d',
        },
        adventure: {
          headerBg:    'color-mix(in srgb, #ff8844 15%, #000000)',
          bodyBg:      'color-mix(in srgb, #ff8844 4%, #000000)',
          headerColor: '#ff8844',
          borderColor: 'color-mix(in srgb, #ff8844 55%, transparent)',
          accent:      '#ff8844',
        },
        story: {
          headerBg:    'color-mix(in srgb, #44ddff 15%, #000000)',
          bodyBg:      'color-mix(in srgb, #44ddff 4%, #000000)',
          headerColor: '#44ddff',
          borderColor: 'color-mix(in srgb, #44ddff 55%, transparent)',
          accent:      '#44ddff',
        },
      },
    };

    // ── Effects ──────────────────────────────────────────────────────────────
    // Adventure's heavy CRT scanlines still render (see scanlinesIntensity
    // below), but the settings panel for scanlines belongs to Arcade only.
    this.effectModules = ['filmGrain'];

    this.defaultEffects = {
      grid:                'off',
      gridColor:           'cyan',
      gridAnimate:         false,
      gridOpacity:         0,
      filmGrain:           true,
      filmGrainOpacity:    4,
      filmGrainAnimate:    false,   // static grain — phosphor noise feel
      dataRain:            false,
      circuitPattern:      false,
      edgeGlow:            false,
      chromaticAberration: false,
      scanlinesIntensity:  'heavy', // thick CRT scanlines over full UI
      parchmentOpacity:    0,
      seasonMode:          'off',
      vuAmp:               5,
      vuSpeed:             22,
      moduleEnabled: {
        filmGrain: true,
      },
    };
  }
}

PackageRegistry.registerPackage(new AdventurePackage());
