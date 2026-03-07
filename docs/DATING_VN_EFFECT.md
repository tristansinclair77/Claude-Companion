# Dating VN Effect — Design Document

## Overview

A PC-98 style dating visual novel scene that uses real pixel-art background images
(`ref/vn_bg_1.jpg`, `ref/vn_bg_2.jpg`, `ref/vn_bg_3.jpg`). Each image already contains
a character and a scene; no procedural sprite drawing is needed.

**Effect ID:** `datingVn`
**File:** `src/renderer/js/effects/DatingVnEffect.js`
**Canvas:** `#bg-dating-vn`
**States:** `idle → intro → active → outro`
**Outro phases:** `warble → glitch → crumble`

---

## Visual Flow

```
1. INTRO (2.2 s)
   Image fades in from full blur (22 px) + alpha 0, simultaneously
   clearing to sharp focus + full alpha. No dialog during this phase.

2. DIALOG EXPAND (0.4 s, overlaps with start of active phase)
   A PC-98 style dialog box at the bottom of the game area grows
   upward from the bottom edge into its full height (~38% of game area).
   Border and text fade in as the box expands.

3. ACTIVE — typing loop
   For each of the 4 lines:
     a. Text types out character by character at 38 chars/s.
        Cursor (█) blinks at 0.28 s half-cycle while typing.
     b. When line is complete, cursor blinks 8 more half-cycles (4 full
        blinks = ~2.2 s visible blinking at end).
     c. Text clears; next line starts typing.
   After the last line's end-blink, enter FINAL WAIT.

4. FINAL WAIT (3.2 s)
   Image fully visible. Dialog box shows last line's full text, no cursor.
   After wait expires, snapshot is taken and OUTRO begins.

5. OUTRO
   a. Warble (0.6 s): scanline sine-wave displacement ramps 0→18 px.
   b. Glitch (0.3 s): colour flash rects, one-shot invert, RGB channel split.
   c. Crumble (1.2–2.2 s): entire image fragments into 4×4 px blocks that
      fly outward with gravity and fade to alpha 0.
   Effect returns to idle once all particles are gone.
```

---

## Background Images

Three pixel-art VN scene JPGs in the `ref/` folder:

| File | Scene |
|------|-------|
| `vn_bg_1.jpg` | Post-apocalyptic mechanic girl in a repair garage |
| `vn_bg_2.jpg` | Fantasy apothecary / shop owner |
| `vn_bg_3.jpg` | Red-haired scientist in a research lab |

Images are loaded eagerly at construction time via `new Image()` with path
`../../ref/vn_bg_N.jpg` (relative to `src/renderer/index.html`). On each
`spawn()`, one loaded image is picked at random.

**Blur intro technique:** `ctx.filter = 'blur(Xpx)'` is applied during
`drawImage`. The canvas is clipped to the game area first, and the image is
drawn with `±margin` padding to prevent edge bleeding from the blur kernel.

---

## Dialog Box Design

- Position: bottom `38%` of the game area, full width (edge to edge)
- Expand animation: grows upward from the bottom edge over 0.40 s
- Text and name tag fade in when box is ≥ 65% open

### Colours

| Element | Value |
|---------|-------|
| Background fill | `rgba(4, 2, 18, 0.93)` — near-black with blue tint |
| Outer border | `#44d4cc` — 2 px bright teal |
| Inner border | `rgba(68,212,204,0.28)` — 1 px dim teal |
| Name tag chip | `#44d4cc` fill, `#001818` text |
| Dialogue text | `#d8f4f0` — light teal-white |
| Cursor | `#44d4cc █` block cursor |

### Cursor behaviour

- **While typing:** cursor blinks at 0.28 s half-cycle (visible throughout)
- **After line done:** cursor blinks exactly 8 half-cycles (4 full blinks) then
  either the text clears and the next line starts, or final-wait begins
- **During final wait:** cursor hidden, last line text remains fully visible

---

## Dialogue Lines

```js
{ speaker: 'ARIA', text: 'Oh hi!  Nice to see you again, Player!' }
{ speaker: 'ARIA', text: "Oh my!  It's so nice to have a big strong man like you around!" }
{ speaker: 'ARIA', text: "Oh...  if only I weren't so lonely!" }
{ speaker: 'ARIA', text: 'I could really use a good date right about now~' }
```

All four lines are shown in order (no randomisation). A new spawn always starts
from the first line.

---

## Constants Reference

| Constant | Value | Purpose |
|----------|-------|---------|
| `INTRO_DURATION` | 2.2 s | Blur → clear fade-in |
| `INTRO_BLUR_MAX` | 22 px | Starting blur radius |
| `CHAR_RATE` | 38 | Characters per second |
| `CURSOR_BLINK_HALF` | 0.28 s | Cursor blink half-cycle |
| `CURSOR_BLINKS` | 8 | Half-cycles after line complete |
| `DIALOG_EXPAND_DUR` | 0.40 s | Dialog grow animation |
| `FINAL_WAIT` | 3.2 s | Pause after last line |
| `WARBLE_DURATION` | 0.6 s | Scanline warp phase |
| `WARBLE_MAX_PX` | 18 px | Max displacement |
| `GLITCH_DURATION` | 0.3 s | RGB flash phase |
| `OUTRO_GRAVITY` | 280 px/s² | Particle gravity |
| `PARTICLE_LIFE_MIN` | 1.2 s | Shortest particle life |
| `PARTICLE_LIFE_MAX` | 2.2 s | Longest particle life |
| `BLOCK_SIZE` | 4 px | Crumble pixel block size |

---

## Files Touched

| File | Change |
|------|--------|
| `src/renderer/js/effects/DatingVnEffect.js` | Complete rewrite |
| `src/renderer/js/help-panel.js` | Update Dating VN description |
| `ref/vn_bg_1.jpg` | Source image (read-only) |
| `ref/vn_bg_2.jpg` | Source image (read-only) |
| `ref/vn_bg_3.jpg` | Source image (read-only) |

Integration files (ArcadePackage.js, ArcadeAmbientEffect.js, chat-controller.js,
index.html, bg-effects.css) require **no changes** — the effect ID, canvas ID,
and class API are identical to the previous version.
