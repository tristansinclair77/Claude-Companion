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

    // ── Settings menu theme ─────────────────────────────────────────────────
    // Cybernetic: sharp angular corners, circuit-board hex pattern, LED-glow
    // borders with subtle chromatic edge. Uses hard 90° corners (no radius)
    // and single-pixel double borders for a screen-print PCB feel.
    this.settingsTheme = {
      panelBg:              'var(--bg-dark)',
      // Faint hexagonal PCB pattern — feels like a circuit board etched into
      // the section body without becoming visually loud.
      patternSvg:           `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='32' viewBox='0 0 28 32'><path d='M14 0L28 8v16L14 32L0 24V8Z' fill='none' stroke='%2300ffcc' stroke-width='0.5' opacity='0.4'/></svg>`,
      patternOpacity:       0.06,
      patternSize:          '28px 32px',
      borderStyle:          'solid',
      borderWidth:          '1px',
      cornerRadius:         '0',
      headerFont:           'inherit',
      headerTransform:      'uppercase',
      headerLetterSpacing:  '3px',
      headerWeight:         'bold',
      headerFontSize:       '11px',
      headerPadding:        '8px 14px',
      headerDividerHeight:  '1px',
      sections: {
        baseGame: {
          headerBg:    'linear-gradient(90deg, color-mix(in srgb, var(--cyan) 18%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--cyan) 4%, var(--bg-panel))',
          headerColor: 'var(--cyan)',
          borderColor: 'color-mix(in srgb, var(--cyan) 45%, transparent)',
          accent:      'var(--cyan)',
        },
        visualPackage: {
          headerBg:    'linear-gradient(90deg, color-mix(in srgb, var(--green) 18%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--green) 4%, var(--bg-panel))',
          headerColor: 'var(--green)',
          borderColor: 'color-mix(in srgb, var(--green) 45%, transparent)',
          accent:      'var(--green)',
        },
        companion: {
          headerBg:    'linear-gradient(90deg, color-mix(in srgb, var(--magenta) 18%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--magenta) 4%, var(--bg-panel))',
          headerColor: 'var(--magenta)',
          borderColor: 'color-mix(in srgb, var(--magenta) 45%, transparent)',
          accent:      'var(--magenta)',
        },
        adventure: {
          headerBg:    'linear-gradient(90deg, color-mix(in srgb, var(--orange) 18%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--orange) 4%, var(--bg-panel))',
          headerColor: 'var(--orange)',
          borderColor: 'color-mix(in srgb, var(--orange) 45%, transparent)',
          accent:      'var(--orange)',
        },
        story: {
          headerBg:    'linear-gradient(90deg, color-mix(in srgb, var(--yellow) 18%, var(--bg-panel)), var(--bg-panel))',
          bodyBg:      'color-mix(in srgb, var(--yellow) 4%, var(--bg-panel))',
          headerColor: 'var(--yellow)',
          borderColor: 'color-mix(in srgb, var(--yellow) 45%, transparent)',
          accent:      'var(--yellow)',
        },
      },
    };

    // ── Effects ──────────────────────────────────────────────────────────────
    // effectModules: which named sections appear in the settings panel.
    // Scanlines still render (see scanlinesIntensity below), but the
    // scanlines control panel is owned by the Arcade package.
    this.effectModules = ['grid', 'filmGrain', 'overlayEffects', 'vuBounce'];

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
        vuBounce:       true,
      },
    };
  }
}

PackageRegistry.registerPackage(new CyberneticPackage());
