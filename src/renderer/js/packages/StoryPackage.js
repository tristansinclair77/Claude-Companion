'use strict';
/**
 * StoryPackage — "STORY" Visual Package.
 *
 * Applied automatically while story mode is open; restored on exit.
 * Deliberately effect-free: story is for reading, ambient distractions
 * (Wraith lightning, arcade ambient, grid animation, etc.) get in the way.
 * Colors mirror the Cybernetic baseline so the transition stays visually calm
 * regardless of which package the user was on before entering story mode.
 */
class StoryPackage extends VisualPackage {

  constructor() {
    super();

    this.id   = 'story_terminal';
    this.name = 'STORY';
    this.desc = 'quiet reading mode — no ambient effects';

    // ── Colorscheme ──────────────────────────────────────────────────────────
    // Baseline cyan/teal palette lifted from Cybernetic. Keeps the UI legible
    // and familiar; the point of this package is the *absence* of effects, not
    // a new aesthetic.
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
      '--axis-val-lo':   '#ff4444',
      '--axis-val-hi':   '#00ff88',
      '--axis-aro-lo':   '#4488ff',
      '--axis-aro-hi':   '#ff8800',
      '--axis-soc-lo':   '#8844aa',
      '--axis-soc-hi':   '#00ccff',
      '--axis-phy-lo':   '#888866',
      '--axis-phy-hi':   '#88ff44',
      '--badge-filler':  '#00cc44',
      '--thoughts-color':'#558866',
    };

    // ── Effects ──────────────────────────────────────────────────────────────
    // No effect modules — the package exposes no settings sections.
    // Every applicator in settings.js gates on effectModules.includes(id);
    // an empty list drops every effect into its .stop() branch.
    this.effectModules = [];

    this.defaultEffects = {
      grid:                'off',
      gridColor:           'cyan',
      gridAnimate:         false,
      gridOpacity:         0,
      filmGrain:           false,
      filmGrainOpacity:    0,
      filmGrainAnimate:    false,
      dataRain:            false,
      circuitPattern:      false,
      edgeGlow:            false,
      chromaticAberration: false,
      scanlinesIntensity:  'off',
      parchmentOpacity:    0,
      seasonMode:          'off',
      vuAmp:               0,
      vuSpeed:             0,
      moduleEnabled: {},
    };
  }
}

PackageRegistry.registerPackage(new StoryPackage());
