# Ideas & TODO — Claude Companion

A running list of architectural ideas, future features, and design notes.
Grouped by category. Not a priority-sorted backlog — just a place to capture thoughts.

---

## Effects System Architecture

### Standalone, Attributable Effects
**Idea:** Visual effects should be self-contained modules that are *attributed* to a package
but not *exclusive* to it. Any package can opt-in to any effect.

Current approach:
- Effects are standalone (CSS keyframes + JS logic live in their own files/sections)
- Each effect is activated by a CSS selector like `[data-package="cybernetic"] .axis-bar-fill`
- The active package is exposed on `<body data-package="...">` by `settings.js`

What this enables:
- A future "Fantasy Cyberpunk" hybrid package can reuse `vu-bounce` from Cybernetic
- Adding a new package never requires duplicating effect code — just opt-in
- Effects can be mixed and matched in any combination

**Convention to maintain:**
- Every effect animation/keyframe should have a comment header like:
  ```css
  /* EffectName — attributed to: Package Name */
  ```
- The CSS selector that *activates* the effect should reference `[data-package="..."]`
  so it's easy to see which package "owns" it by default, and easy to add more packages.
- All JS-driven effects should check `document.body.dataset.package` and clean up
  (clear timers, cancel rAF loops) on package switch.

---

### Effects Playground Tool
**Idea:** A standalone window (like VFX Creator) where you can preview and tune individual
effects in isolation — without being tied to a specific visual package.

Features envisioned:
- List of all registered effects on the left (checkboxes to enable)
- Live preview area (maybe a canvas or the main window itself)
- Per-effect parameter sliders (intensity, speed, density, etc.)
- "Assign to package" button — writes the effect into a package's `effectModules`
- Export: copies the relevant CSS + JS snippet to clipboard

Implementation notes:
- Effects would need a formal registration system: an `EFFECTS_REGISTRY` object where
  each effect declares its name, parameters, default values, and an `apply(params)` function.
- This registry would drive both the Playground UI and the package system.
- Low priority until there are 6+ effects worth browsing.

---

### Effect Registration Format (future)
When the registry is formalized, each effect entry might look like:
```js
{
  id:          'vu-bounce',
  name:        'VU Meter Bounce',
  description: 'Axis bars oscillate around their true value like a live audio meter.',
  defaultAttribution: 'cybernetic',
  params: {
    amplitude: { type: 'float', default: 0.05, min: 0.01, max: 0.12 },
    speed:     { type: 'float', default: 2.2,  min: 0.5,  max: 6.0  },
  },
  applyCSS: () => { /* injects @keyframes and selector */ },
  cleanupCSS: () => { /* removes injected rules */ },
}
```

---

## Visual Packages — Backlog

### Axes Bar Effects (per-package)
| Package      | Effect                | Status     | Doc |
|--------------|----------------------|------------|-----|
| Cybernetic   | VU Meter Bounce       | Implemented | animations.css |
| Fantasy RPG  | Divination Tremor     | Idea written | FANTASY_RPG_BACKGROUND.md |

### Package Ideas (not started)
- **SYNTHWAVE** — hot pink / electric purple, 80s retro sunset gradient background
- **TERMINAL GREEN** — monochrome phosphor green, no gradients, scanlines heavy
- **VOID** — deep purple / pitch black, minimal, floating particle dust
- **SAKURA** — soft pinks and whites, cherry blossom petal particle fall

---

## UI / Feature Ideas

- **Emotion axis labels as runes/glyphs** — in Fantasy RPG, replace VAL/ARO/SOC/PHY
  with themed symbols (♥ ☿ ✦ ⚔ or custom glyphs)
- **Package-specific title bar font** — swap the monospace font for a serif/fantasy font
  when Fantasy RPG is active
- **Seasonal auto-switch** — Fantasy RPG season effect automatically changes based on
  the real-world month (winter → snow, spring → rain, summer → sunbeams, autumn → leaves)
- **Companion sound themes** — per-package ambient audio (faint neon hum for Cybernetic,
  fireplace crackle for Fantasy RPG) with volume control
