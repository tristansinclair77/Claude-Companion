# Fantasy RPG — Visual Package Design Document

## Overview

A warm, retro-fantasy visual package to contrast the existing Cybernetic (sci-fi) package.
Draws from classic CRPG / tabletop aesthetics: candlelight, parchment, aged wood, dungeons.
All effects are pure CSS / Canvas animations — no external assets required.

---

## Color Scheme

| Variable        | Value       | Purpose                            |
|-----------------|-------------|------------------------------------|
| `--cyan`        | `#ffaa00`   | PRIMARY — deep amber gold          |
| `--cyan-dim`    | `#664400`   | DIM — tarnished bronze             |
| `--green`       | `#22cc66`   | ACCENT — forest emerald            |
| `--magenta`     | `#cc2222`   | HIGHLIGHT — blood red              |
| `--purple`      | `#9944ff`   | PURPLE — arcane violet             |
| `--orange`      | `#ff6600`   | ORANGE — ember glow                |
| `--red`         | `#aa1111`   | RED — deep crimson                 |
| `--yellow`      | `#ffdd88`   | YELLOW — candlelight               |
| `--bg-dark`     | `#0a0806`   | DEEP — near-black, warm undertone  |
| `--bg-panel`    | `#100d09`   | PANEL — dark aged wood             |
| `--bg-mid`      | `#18130e`   | MID — slightly lighter wood        |
| `--bg-input`    | `#0e0b07`   | INPUT — deep shadow                |
| `--border`      | `#2a1a08`   | BORDER — dark amber                |
| `--border-glow` | `#ffaa0022` | BORDER GLOW — amber haze with alpha|

---

## Effect Modules

### Static / Always-on

#### Parchment Overlay
- A semi-transparent warm amber wash layered over the entire UI.
- Gives the impression of aged paper or vellum.
- Implemented as a fixed `::after` pseudo-element or overlay `<div>` with a radial gradient
  (amber at edges, lighter centre) and `mix-blend-mode: multiply`.
- Adjustable opacity (5–25% range).

---

### Seasonal Animated Backgrounds (Four Seasons)
One active at a time. Replaces the hex/square grid concept for this package.

#### 1. Rain (Autumn / Storm)
- Diagonal streaks of semi-transparent lines falling from top-right to bottom-left.
- Randomised speed, length, opacity per streak.
- Canvas-drawn, ~40–80 streaks active at once.
- Optional: occasional lightning flash (1-frame white overlay flicker, rare random interval).
- Colour: steel blue-grey `rgba(180,200,220,0.35)`.

#### 2. Sunbeams (Summer)
- 4–8 wide, soft light rays emanating from the upper portion of the panel.
- Slowly animate in opacity (pulse in/out, 8–15s cycles, each ray offset).
- Implemented as rotated `div`s with linear-gradient (white/amber → transparent).
- Colour: warm gold `rgba(255,220,100,0.08)` — very subtle, ambient.

#### 3. Gentle Snow (Winter)
- 60–120 small circular flakes of varying size (1–4px radius).
- Float slowly downward with gentle horizontal drift (sine wave on x-axis).
- Canvas-drawn with per-flake randomised speed, size, opacity.
- Colour: near-white `rgba(220,235,255,0.7)`.

#### 4. Falling Leaves (Autumn)
- 15–30 small leaf silhouettes (simple polygon or SVG path drawn on canvas).
- Drift downward with rotation and horizontal sway.
- Colour palette: amber, rust, gold, dark red — randomly assigned per leaf.
- Physics: slight acceleration due to gravity, occasional "catch" where a leaf briefly
  floats upward as if caught by a breeze.

---

### Atmospheric Particles

#### Ground Fog
- Slowly drifting semi-transparent wisps across the bottom 15–25% of the panel.
- Implemented as large blurred ellipses (`filter: blur`) animated across the x-axis.
- Multiple layers at slightly different speeds for depth.
- Colour: `rgba(200,180,150,0.12)` — very faint warm mist.
- Can be layered with any seasonal effect.

#### Ember Drift (Hot Embers)
- Small bright particles (2–5px) that rise from below or pop in from random positions.
- Colour: bright red-orange core `#ff4400` → fading amber → transparent as they rise.
- Physics: initial upward velocity, gradual deceleration, slight x-axis drift.
- Fade out as they travel upward / off-screen.
- 10–20 active embers at a time; random spawn intervals.
- Intensity adjustable (low / medium / high).

#### "Rare Item!" Sparkles
- Small 4- or 6-pointed star glints that randomly appear at random (x, y) positions.
- Animate: scale from 0 → 1.2 → 0 with a brief bright flash, then disappear.
- Colour: golden-white `#ffffaa` with soft glow.
- Frequency: very low (1–3 sparkles on screen at any moment, spawning every 2–8s).
- Optional: slight prismatic colour shift (ROYGBIV cycle) on each sparkle for "legendary" feel.
- Drawn on Canvas or as absolutely-positioned DOM elements with keyframe animations.

---

## Implementation Notes

### Rendering Architecture
- All particle/seasonal effects share a single full-screen `<canvas>` element
  (`id="rpg-canvas"`) layered behind the panel content.
- The parchment overlay is a separate `<div id="rpg-parchment">` above the canvas
  but below panel content, using `pointer-events: none`.
- Sunbeams use DOM divs (easier to CSS-animate opacity) rather than canvas.

### Effect Module Keys (for package definition)
```js
effectModules: [
  'parchment',    // amber overlay wash
  'season',       // which season is active: 'rain' | 'sun' | 'snow' | 'leaves'
  'fog',          // ground fog wisps
  'embers',       // rising ember particles
  'sparkles',     // rare item star glints
]
```

### Settings Controls (VFX Creator)
| Control           | Type    | Range / Options                        |
|-------------------|---------|----------------------------------------|
| Parchment Opacity | Slider  | 0–30%                                  |
| Season            | Select  | Off / Rain / Sunbeams / Snow / Leaves  |
| Rain Intensity    | Slider  | 20–120 streaks                         |
| Snow Density      | Slider  | 30–150 flakes                          |
| Leaf Count        | Slider  | 10–40 leaves                           |
| Ground Fog        | Toggle  | On/Off                                 |
| Fog Opacity       | Slider  | 0–30%                                  |
| Embers            | Toggle  | On/Off                                 |
| Ember Intensity   | Select  | Low / Medium / High                    |
| Sparkles          | Toggle  | On/Off                                 |
| Sparkle Frequency | Select  | Rare / Occasional / Frequent           |

---

## What to Build First

**Phase 1 — Foundation**
1. Define the `FANTASY_RPG` package in `BUILTIN_PACKAGES` with full color scheme.
2. Parchment overlay (CSS only, immediate visual impact).
3. Ember Drift (canvas particles — warm, atmospheric, not too complex).
4. "Rare Item" Sparkles (DOM keyframe animation — relatively simple, great payoff).

**Phase 2 — Seasons**
5. Falling Leaves (most visually distinctive of the four seasons).
6. Gentle Snow.
7. Rain.
8. Sunbeams.

**Phase 3 — Atmosphere**
9. Ground Fog.
10. VFX Creator controls for all RPG modules.

---

---

## Axis Bar Effect — "Divination Tremor"

> Implemented in Cybernetic as VU Meter Bounce (see `animations.css: vu-bounce`).
> Fantasy RPG gets its own thematic variant below.

### Concept
The axis bars occasionally "flicker" as if a mystical oracle is reading an unstable fate.
During a tremor event the bars blink out, snap to a falsified value, then resolve back to truth.

### Behaviour
- **Idle**: bars are static at their correct values (no constant animation).
- **Tremor trigger**: a random timer fires every 8–20s per bar (independent timers per axis).
- **Tremor sequence** (total ≈ 600ms):
  1. Bar fades to ~30% opacity (0–80ms, ease-in).
  2. Bar width snaps to a "false" value: actual ± 15–30% (random, clamped 5–95%).
  3. Bar flickers 2–3 times at ~60ms intervals (opacity 0.15 ↔ 0.8).
  4. Bar snaps back to true value, fades to full opacity (80ms, ease-out).
- **Color during tremor**: briefly tints toward `--magenta` (blood red) — augury gone wrong.

### Implementation notes
- JS-driven: a `setInterval`/`setTimeout` chain per bar, not a looping CSS keyframe.
- Attach to `axis-bar-fill` elements after each `updateMeters()` re-render.
- Respect `document.body.dataset.package === 'fantasy_rpg'` before running timers;
  clear timers on package switch.
- The false value calculation: `trueVal + (Math.random() * 0.30 - 0.15)`, clamped 0.05–0.95.

---

## Open Questions / Future Ideas
- **Candlelight Flicker**: subtle luminance oscillation on the whole window — low priority
  since it can cause eye strain; could be a toggle-off-by-default option.
- **Magic Circle**: slowly rotating arcane sigil centered in the background — possible Phase 4.
- **Dungeon / Tavern sub-themes**: reuse the same modules with different season/fog/ember
  combinations, just change the active season preset and parchment opacity.
- **Pixel Scanlines**: chunky CRPG-style scan lines — could be a standalone toggle.
