# Visual Package System

Visual Packages are full theme/skin replacements for the app. Each package controls six
categories of presentation. Packages are self-contained classes that register themselves
at script load time — adding a new package requires no changes to any existing file except
`index.html`.

---

## The Six Categories

Every Visual Package defines (or stubs out) these six categories:

| Category | What it controls | Status |
|---|---|---|
| **Colorscheme** | CSS variable map applied to `:root` | Implemented |
| **Effects** | Animated overlays, canvas effects, screen filters | Implemented |
| **Background** | Background image / video / scenery | Stubbed (future) |
| **Fonts** | UI and header font-family overrides | Stubbed (future) |
| **Music** | Ambient audio track | Stubbed (future) |
| **Sounds** | UI sound effect pack | Stubbed (future) |

---

## File Structure

```
src/renderer/js/
  vp/
    VisualPackage.js        ← base class all packages extend
    VisualEffect.js         ← base class all canvas/DOM effects extend
    PackageRegistry.js      ← singleton registry; settings.js talks to this
  effects/
    SeasonsEffect.js        ← Fantasy RPG: snow/rain/sunbeams/leaves canvas effect
  packages/
    CyberneticPackage.js    ← "CYBERNETIC" package
    FantasyRpgPackage.js    ← "FANTASY RPG" package

src/renderer/styles/
  bg-effects.css            ← shared effect layer CSS (grid, noise, parchment, scanlines…)
```

---

## Base Classes

### `VisualPackage`
All packages extend this. Set properties in the constructor, then call
`PackageRegistry.registerPackage(this)` at the bottom of the file.

```js
class MyPackage extends VisualPackage {
  constructor() {
    super();
    this.id   = 'my_package';
    this.name = 'MY PACKAGE';
    this.desc = 'short description';

    this.colors = { '--cyan': '#ff00ff', ... };

    this.effectModules  = ['grid', 'scanlines'];   // settings sections to show
    this.defaultEffects = { grid: 'hex', ... };    // starting values for those controls

    // Optional — leave as inherited defaults if not used yet:
    // this.background = { type: 'none', src: null };
    // this.fonts      = { ui: null, header: null };
    // this.music      = { track: null, volume: 0.5 };
    // this.sounds     = { pack: null };
  }
}
PackageRegistry.registerPackage(new MyPackage());
```

**`toConfig(savedEffects)`** — called by `PackageRegistry.getPackageConfigs()`. Returns a
plain object (id, name, desc, colors, effectModules, effects, background, fonts, music,
sounds). Merges `savedEffects` on top of `defaultEffects` so user tweaks survive restarts.

---

### `VisualEffect`
All canvas/DOM effects extend this. Register with `PackageRegistry.registerEffect(this)`.
`BackgroundSettings` activates effects by id — it never imports or references effect classes
directly.

```js
class MyEffect extends VisualEffect {
  constructor() {
    super('my_effect_id');  // id must match the string used in effectModules
    // declare any internal state here
  }

  _onStart(config) {
    // config = the merged effect state object; pull out whatever keys you need
    // start your rAF loop, inject your canvas, etc.
  }

  _onStop() {
    // cancel rAF, clear canvas, remove DOM elements, etc.
  }

  _onUpdate(key, value) {
    // called when one config key changes while the effect is running.
    // Default (from base class): stop + restart. Override for smooth transitions.
    // Example: if (key === 'seasonMode') this._crossfadeTo(value);
  }
}
PackageRegistry.registerEffect(new MyEffect());
```

**Public API** (called by `settings.js`):
- `effect.start(config)` — activate
- `effect.stop()` — deactivate (idempotent)
- `effect.update(key, value)` — change one value while running
- `effect.running` — boolean getter

---

### `PackageRegistry`
IIFE singleton. Packages and effects register themselves; `settings.js` queries it.

```js
PackageRegistry.registerPackage(pkg)           // called at bottom of each package file
PackageRegistry.registerEffect(effect)         // called at bottom of each effect file
PackageRegistry.getEffect('seasons')           // returns VisualEffect instance or null
PackageRegistry.getPackageConfigs(savedMap)    // returns array of plain config objects
```

---

## `effectModules` and the Settings Panel

The settings panel uses `data-effect-module="<name>"` attributes on section elements.
When a package is activated, `_applyEffectModuleVisibility()` in `settings.js` shows only
the sections whose names appear in `effectModules`. Everything else is hidden.

**Currently defined module names:**

| Name | Controls |
|---|---|
| `grid` | Perspective grid (type, color, opacity, animate) |
| `filmGrain` | Film grain overlay (opacity, animate) |
| `overlayEffects` | Data rain, circuit pattern, edge glow, chromatic aberration |
| `scanlines` | Scanline intensity (off / light / medium / heavy) |
| `vuBounce` | VU meter bounce amplitude + speed |
| `parchment` | Parchment warm-tone overlay opacity |
| `seasons` | Season/weather canvas effect mode selector |
| `tvGlass` | CRT glass overlay — vignette, glare highlight, rim lights (on/off) |
| `arcadeBorder` | Arcade bezel frame canvas (on/off module toggle only) |

---

## How to Add a New Visual Package

1. **Create `src/renderer/js/packages/MyPackage.js`** — extend `VisualPackage`, set all
   six categories, call `PackageRegistry.registerPackage(new MyPackage())`.

2. **If the package needs a custom canvas effect**, create
   `src/renderer/js/effects/MyEffect.js` — extend `VisualEffect`, call
   `PackageRegistry.registerEffect(new MyEffect())`.

3. **Add script tags to `src/renderer/index.html`** before `settings.js`, in this order:
   ```html
   <script src="js/effects/MyEffect.js"></script>     <!-- if applicable -->
   <script src="js/packages/MyPackage.js"></script>
   ```

4. **If the package needs new CSS effect layers**, add them to `bg-effects.css`
   (shared layers that any package can use) or add a package-specific CSS block
   scoped with `body[data-package="my_package"] { ... }` in `main.css`.

5. **If the package needs new settings UI sections**, add them to `index.html` with the
   `data-effect-module="<name>"` attribute and add that name to the package's
   `effectModules` array. Wire up the controls in `settings.js`.

No changes to `PackageRegistry`, `VisualPackage`, `VisualEffect`, or `settings.js` core
logic are needed for a new package that uses only existing effect modules.

---

## Existing Packages

### CYBERNETIC (`cybernetic`)
- **Vibe**: neon green / teal, matrix / cyberpunk
- **Effects**: grid, film grain, overlay effects, scanlines, VU bounce
- **Canvas effects**: none (all DOM/CSS-based)

### FANTASY RPG (`fantasy_rpg`)
- **Vibe**: warm amber / arcane, parchment and candlelight
- **Effects**: parchment overlay, seasons canvas
- **Canvas effects**: `SeasonsEffect` — snow, rain, sunbeams, leaves, random rotation

### ARCADE CABINET (`arcade_cabinet`)
- **Vibe**: deep black, coin-op yellow, 1980s arcade energy
- **Effects**: arcadeBorder canvas, heavy scanlines, light static film grain
- **Canvas effects**: `ArcadeEffect` — pixel-art bezel frame around the content area,
  scrolling "INSERT COIN / PLAYER 1 READY / …" marquee in the bottom strip,
  pixel-bracket corner decorations, occasional spark bursts at the corners
