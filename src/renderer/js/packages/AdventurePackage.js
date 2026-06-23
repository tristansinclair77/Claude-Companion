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

    // ── Effects ──────────────────────────────────────────────────────────────
    this.effectModules = ['scanlines', 'filmGrain'];

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
        scanlines: true,
        filmGrain: true,
      },
    };
  }
}

PackageRegistry.registerPackage(new AdventurePackage());
