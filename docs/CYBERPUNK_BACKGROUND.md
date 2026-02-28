# Cyberpunk Background System — Design Document

## Overview

The Claude Companion UI aims for a **1980s/1990s anime sci-fi aesthetic** — think Ghost in the Shell, Akira, Bubblegum Crisis, Serial Experiments Lain, and classic cyberpunk anime terminals. This document outlines programmatic (CSS-only) techniques to achieve this look without requiring external image assets.

---

## Design Goals

- **Retrofuturistic**: Feels like a computer terminal from 1988's vision of 2020
- **Layered depth**: Multiple subtle effects that combine into a rich visual
- **Performance**: Pure CSS, no heavy canvas rendering or JS animation loops
- **Configurable**: Each layer can be toggled/adjusted independently
- **Non-distracting**: Enhances the UI without competing with Aria or chat content

---

## Effect Layers

### 1. Perspective Grid (Tron / Cyberspace)

A classic cyberpunk element — a grid that recedes into the distance, suggesting infinite digital space.

```css
.cyber-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    /* Horizontal lines */
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 50px,
      rgba(0, 255, 255, 0.03) 50px,
      rgba(0, 255, 255, 0.03) 51px
    ),
    /* Vertical lines */
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 50px,
      rgba(0, 255, 255, 0.03) 50px,
      rgba(0, 255, 255, 0.03) 51px
    );
  /* Perspective transform for depth */
  transform: perspective(500px) rotateX(60deg);
  transform-origin: center top;
  opacity: 0.5;
}
```

**Variations:**
- Animate the grid scrolling downward for "flying through cyberspace" effect
- Use magenta/pink instead of cyan for variety
- Add glow with a blurred duplicate layer

---

### 2. Animated Scrolling Grid

Makes the grid feel alive — slowly scrolling to suggest movement through digital space.

```css
@keyframes grid-scroll {
  0% { background-position: 0 0; }
  100% { background-position: 0 50px; }
}

.cyber-grid-animated {
  animation: grid-scroll 4s linear infinite;
}
```

---

### 3. Film Grain / Noise Texture

Adds analog warmth and that VHS/CRT quality. Pure SVG filter, no images needed.

```css
.noise-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}
```

**Optional**: Animate with subtle position shifts for "live" grain effect.

---

### 4. Enhanced Scanlines

We already have scanlines, but we can enhance them with:

```css
.scanlines-enhanced {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  );
  /* Subtle animation for CRT flicker */
  animation: scanline-flicker 0.1s infinite;
}

@keyframes scanline-flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.98; }
}
```

---

### 5. Chromatic Aberration / RGB Split

Classic CRT effect — slight color channel separation at edges.

```css
.chromatic-aberration {
  position: fixed;
  inset: 0;
  pointer-events: none;
  /* Red channel shift left, blue shift right */
  box-shadow:
    inset 2px 0 4px rgba(255, 0, 0, 0.1),
    inset -2px 0 4px rgba(0, 0, 255, 0.1);
}
```

---

### 6. Data Rain (Matrix-style)

Falling characters or symbols in the background. CSS-only version using pseudo-elements:

```css
.data-rain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.data-rain::before {
  content: "01001010 11010100 00101101 10110010";
  position: absolute;
  top: -100%;
  left: 0;
  right: 0;
  font-family: monospace;
  font-size: 10px;
  color: rgba(0, 255, 100, 0.1);
  white-space: nowrap;
  animation: data-fall 20s linear infinite;
  letter-spacing: 20px;
  writing-mode: vertical-rl;
}

@keyframes data-fall {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(200%); }
}
```

**Note**: For richer data rain, multiple columns with staggered animations would be needed.

---

### 7. Circuit Board Pattern

SVG-based repeating circuit traces.

```css
.circuit-pattern {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 50 H40 V20 H60 V50 H90 M50 50 V80' stroke='%2300ffff' stroke-width='1' fill='none'/%3E%3Ccircle cx='40' cy='20' r='3' fill='%2300ffff'/%3E%3Ccircle cx='60' cy='50' r='3' fill='%2300ffff'/%3E%3Ccircle cx='50' cy='80' r='3' fill='%2300ffff'/%3E%3C/svg%3E");
  background-size: 100px 100px;
}
```

---

### 8. Gradient Glow Edges

Soft neon glow around the edges of the window.

```css
.edge-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  box-shadow:
    inset 0 0 100px rgba(0, 255, 255, 0.05),
    inset 0 0 200px rgba(255, 0, 128, 0.03);
}
```

---

### 9. Hex Grid Pattern

Alternative to square grid — more futuristic/alien feeling.

```css
.hex-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg width='56' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 0 L56 17 L56 51 L28 68 L0 51 L0 17 Z' fill='none' stroke='%2300ffff' stroke-width='0.5'/%3E%3Cpath d='M28 68 L56 85 L56 100 M28 68 L0 85 L0 100' fill='none' stroke='%2300ffff' stroke-width='0.5'/%3E%3C/svg%3E");
  background-size: 56px 100px;
}
```

---

## Recommended Layer Stack

For the full cyberpunk experience, layer these effects (bottom to top):

1. **Base color**: `#0a0a0f` (already have this)
2. **Perspective grid**: Subtle cyan grid with depth
3. **Circuit pattern OR hex grid**: Pick one, very low opacity
4. **Noise texture**: 3-5% opacity for analog feel
5. **Scanlines**: Already implemented
6. **Edge glow**: Soft neon around borders
7. **Chromatic aberration**: Slight RGB split
8. **Vignette**: Already implemented

---

## Implementation Plan

### Phase 1: Add to crt-effects.css
Create new CSS classes for each effect layer.

### Phase 2: Add HTML elements
Add overlay divs to index.html for each layer.

### Phase 3: Settings/Toggles (Optional)
Add user controls to enable/disable each effect layer.

---

## Performance Considerations

- All effects use `pointer-events: none` so they don't interfere with UI
- CSS animations are GPU-accelerated via `transform` and `opacity`
- SVG data URIs are tiny and render efficiently
- Effects can be disabled on low-end hardware via settings

---

## Reference Inspirations

- **Ghost in the Shell (1995)**: Green/cyan terminal screens, data streams
- **Akira (1988)**: Neon city lights, red/cyan color palette
- **Bubblegum Crisis (1987)**: Retro terminals, circuit aesthetics
- **Serial Experiments Lain (1998)**: Static, noise, glitch effects
- **Blade Runner (1982)**: Rain, neon glow, chromatic aberration
- **Tron (1982)**: Perspective grids, glowing lines

---

## Next Steps

1. [ ] Pick 3-4 effects to implement first
2. [ ] Add CSS to `crt-effects.css`
3. [ ] Add overlay elements to `index.html`
4. [ ] Test performance impact
5. [ ] Fine-tune opacity/colors until it feels right
6. [ ] Consider adding settings toggles for each layer
