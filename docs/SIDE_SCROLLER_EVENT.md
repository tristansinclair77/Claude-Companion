# SideScrollerEffect — Arcade Event Design Document

Arcade Cabinet random event. ID: `sideScroller`.
Duration: ~55 seconds active + outro. Registered alongside SpaceInvaders, Asteroids, Pong.

---

## What It Is

A pixel side-scroller plays out autonomously inside the output panel. A small hero character
walks right across a parallax fantasy landscape, cutting down enemies that shamble in from the
right. Gold and XP counters tick up with each kill. Partway through, a boss enters from the
right edge — a large, grotesque creature. A dramatic multi-hit exchange plays out, the hero
takes the final blow and dies, **GAME OVER** flashes in red, then everything crumbles into
falling pixel shards and drops out of frame.

The player does nothing. It is a show.

---

## Phases

```
idle → intro → scrolling → boss_approach → boss_fight → game_over → outro → idle
```

| Phase          | Duration   | Description |
|----------------|------------|-------------|
| `intro`        | ~1.5s      | Hero slides in from left edge, lands on ground |
| `scrolling`    | ~35s       | Hero walks right; enemies spawn from right; combat encounters |
| `boss_approach`| ~3s        | Boss slides in from right; hero stops, turns to face it |
| `boss_fight`   | ~8s        | Multi-hit exchange; hero dies at the end |
| `game_over`    | ~3s        | "GAME OVER" text blinks red/white; particles burst |
| `outro`        | ~4s        | Everything crumbles into falling pixel shards |

---

## Visual Layers (back to front)

### Parallax Background — 4 layers

All layers tile horizontally and scroll left continuously at different speeds.

| Layer | Speed     | Contents |
|-------|-----------|----------|
| 0 — Sky      | 0 px/s   | Flat dark-blue/black gradient fill; static |
| 1 — Far mountains | 12 px/s | Jagged silhouette silhouette, muted purple/grey, ~60px tall |
| 2 — Mid hills    | 28 px/s | Rounder hills, dark green, ~40px tall; occasional pixel tree |
| 3 — Near trees   | 55 px/s | Dense tree line, bright green, ~25px tall |
| 4 — Ground       | 0 px/s  | Solid flat strip along the bottom, ~18px tall, pixel-tile texture |

Ground Y is fixed: `ga.y + ga.h - 18`. All characters stand on it.

### HUD (drawn on top)

- **HP bar** — top-left corner of panel. Small red bar that depletes during boss fight.
- **XP / GOLD** — top-right. `XP: 0   G: 0` in tiny monospace; increments on kill.
- **Level badge** — beside XP. `LVL 1` → `LVL 2` mid-fight for a small flourish.

---

## Characters

All sprites are drawn with `ctx.fillRect` using a pixel grid. Pixel size `PX = 3`.

### Hero — `heroSprite`

~9×12 pixel grid at PX=3 → **27×36px** on screen.

```
Idle/Walk frame A:        Walk frame B:
. . X X X X . . .        . . X X X X . . .
. X X X X X X . .        . X X X X X X . .
. . X X X X . . .  body  . . X X X X . . .
. . X X X X . . .        . . X X X X . . .
. . . X X . . . .        . . . X X . . . .
. . X . . X . . .  legs  . X X . . . . . .  (legs swapped)
```

States: `walk` (2-frame, 0.15s/frame) · `slash` (1 frame, hold 0.25s) · `hit` (flash white) · `dead` (collapse: rotate 90°)

**Slash effect**: a small horizontal yellow flash line extends 14px from hero's sword arm.

### Enemy Types

Three types spawn randomly. Each has a `walk` + `hit` + `dead` state.

**Type A — Slime** (6×5 grid, bounces up/down ±3px as it walks):
```
. X X X X .
X X X X X X
X . X . X X   (googly eyes)
X X X X X X
. X X X X .
```
Color: `#44bb44` (green). Speed: 45 px/s toward hero.

**Type B — Skeleton** (7×11 grid, shambles with slight lean):
```
. X X X X X .   skull
. X . . . X .
. . X X X . .   ribcage
. . X X X . .
X . X X X . X   arms out
. . . X . . .   hip
. X . X . X .   legs
```
Color: `#ddddcc` (bone white). Speed: 30 px/s.

**Type C — Flying Eye** (8×7 grid, floats ~30px above ground, oscillates):
```
. . X X X X . .
. X X X X X X .
X X X . X X X X   pupil gap
X X X X X X X X
X X X X X X X X
. X X X X X X .
. . X X X X . .
```
Color: `#ff4444` (red). Float oscillation: `sin(t * 3) * 8` px vertical. Speed: 55 px/s.

### Boss — `bossSprite`

Large. ~18×20 pixel grid at PX=3 → **54×60px**. Yellow blob body, stubby arms, one giant eye.

```
. . . X X X X X X X X X X . . . .   head / top
. . X X X X X X X X X X X X . . .
. X X X X X X X X X X X X X X . .
. X X . . . . . . . . . . X X . .
X X X . . X X X X X X . . X X X .   eye row (giant eye center)
X X X . . X X X X X X . . X X X .
X X X . . X X . . X X . . X X X .   pupil gap
X X X . . X X X X X X . . X X X .
. X X X X X X X X X X X X X X . .   body
. X X X X X X X X X X X X X X . .
X X . X X X X X X X X X X . X X .   stubby arms
X X . X X X X X X X X X X . X X .
. . . . . X X X X X X . . . . . .   legs
. . . . . X X . . X X . . . . . .
```

Colors: body `#ffcc00` (yellow), eye `#ff2200` (red pupil), arms `#ffaa00`.

Boss states: `walk_in` · `idle` (gentle bob) · `attack_swipe` · `attack_beam` · `stagger` · `victory`

**Boss HP**: 6 hits. Rendered as 6 small yellow squares top-center of panel, deplete one-by-one.

---

## Combat System

### Normal Enemy Encounter

1. Enemy enters from right at its walk speed.
2. When enemy X reaches hero X + 60px (sword range): **combat lock** begins.
   - Hero stops walking; background continues scrolling.
   - Hero plays `slash` animation.
   - Enemy flashes white for 0.1s, staggers back 8px.
   - After 1–2 exchanges (enemy has 1–2 HP): enemy plays `dead`, collapses, spawns 6–10 pixel particles.
   - XP +10–25, Gold +5–15 ticks up (animated counter, not instant).
   - Hero resumes walking after 0.4s.

### Spawn Schedule (scrolling phase)

- Enemy 1: at ~t=4s
- Enemy 2: at ~t=10s
- Enemy 3: at ~t=17s (flying type always)
- Enemy 4: at ~t=25s (always skeleton, telegraphs boss is near)
- Boss approach: at ~t=33s

### Boss Fight Choreography

```
t+0.0s  Boss walks in from right; hero stops
t+1.5s  Brief pause — both characters face each other
t+2.0s  Hero dashes forward, slashes (SFX flash). Boss staggers. Boss HP: 5
t+2.8s  Boss swipe attack: arm extends, hero flies back 20px, HP bar drops 20%
t+3.5s  Hero slashes again. Boss HP: 4
t+4.2s  Boss beam attack: a horizontal yellow line shoots from boss eye.
         Hero dodges up (jumps) but takes glancing hit — HP drops 40%
t+5.5s  Hero slashes twice rapidly. Boss HP: 2
t+6.0s  Boss enters rage: flashes red, moves forward fast
t+6.5s  Boss final swipe — HEAVY HIT. Hero launches left, lands, collapses.
         HP bar → 0. Hero plays `dead` animation (tumbles, pixels scatter).
t+7.5s  Boss raises arms: `victory` pose (arms up, pulses bright).
```

### GAME OVER Screen

- Red `GAME OVER` text, bold, centered in panel, font ~22px.
- Blinks 4× at 0.25s interval (alternates red/white).
- After 1.5s blinks, text goes solid dim red.
- Boss still visible in victory pose for 1s.
- Then outro triggers.

---

## Particle Effects

| Event              | Particles | Colors | Behavior |
|--------------------|-----------|--------|----------|
| Enemy death        | 8–12 px   | enemy color + white | burst outward, gravity, fade |
| Hero slash hit     | 5 px      | yellow + white | small forward spray |
| Boss beam hit      | 15 px     | yellow, orange | horizontal spray left |
| Hero death         | 20 px     | hero color + red | explode all directions |
| Outro crumble      | All sprites → particles | original colors | rain down with gravity |

---

## Outro Crumble

Same pattern as Pong / Space Invaders:
- All visible pixels (hero remains, boss, ground strip, HUD) break into 3–4px particles.
- Each particle gets random `vx ∈ [-60, 60]` and `vy ∈ [-120, -20]`, gravity `+260 px/s²`.
- Particles fade out over 1.5–2.5s.
- When `particles.length === 0` → state = `idle`.

---

## Implementation Checklist

### Setup & Infrastructure
- [ ] Create `src/renderer/js/effects/SideScrollerEffect.js`
- [ ] Add `<canvas id="bg-side-scroller">` to `index.html` after `#bg-pong`
- [ ] Add `#bg-side-scroller` CSS rule in `bg-effects.css` (z-index: 2)
- [ ] Add `<script src="js/effects/SideScrollerEffect.js">` to `index.html`
- [ ] Register effect in `ArcadePackage.js` (`effectModules` + `moduleEnabled`)
- [ ] Add `_applySideScroller()` + settings wiring in `settings.js`
- [ ] Add `side-scroller-spawn-btn` button in settings HTML
- [ ] Add `'sideScroller'` to `_EVENT_IDS` in `settings.js` and `ArcadeAmbientEffect.js`

### Core Engine
- [ ] `VisualEffect` subclass, `spawn()`, `get busy()`, `_onStart`, `_onStop`
- [ ] Canvas init + resize handler
- [ ] `_gameArea()` helper (same as other effects)
- [ ] State machine: `idle → intro → scrolling → boss_approach → boss_fight → game_over → outro`
- [ ] RAF tick loop with `dt = min(elapsed/1000, 0.10)`
- [ ] Ground Y constant computed from `ga`

### Parallax Background
- [ ] Sky gradient fill (static)
- [ ] Layer 1 — far mountains: generate jagged silhouette geometry once, tile + scroll
- [ ] Layer 2 — mid hills: rounded bumps + pixel trees, tile + scroll
- [ ] Layer 3 — near treeline: dense shorter trees, tile + scroll
- [ ] Ground strip: tiled pixel-brick row at bottom

### Hero Sprite & Animation
- [ ] `_drawHero(ctx, x, y, state, frame)` — pixel grid renderer
- [ ] Walk animation: 2-frame cycle, 0.15s per frame
- [ ] Slash animation: 1 frame + sword flash line
- [ ] Hit flash: white overlay for 0.1s
- [ ] Death animation: hero falls/rotates over 0.5s, then particle burst

### Enemy System
- [ ] Enemy object structure: `{ type, x, y, hp, state, frame, animT }`
- [ ] `_drawEnemy(ctx, enemy)` dispatches to type-specific draw
- [ ] Slime sprite + bounce offset
- [ ] Skeleton sprite
- [ ] Flying eye sprite + vertical oscillation
- [ ] Enemy spawn scheduler (fixed times during scrolling phase)
- [ ] Enemy walk AI: move toward hero at type speed
- [ ] Combat lock detection (proximity check)

### Combat Logic
- [ ] Normal combat resolver: slash → enemy flash → repeat until dead
- [ ] Enemy death: particles + XP/Gold counter increment animation
- [ ] Hero resume walk after combat clear

### Boss
- [ ] Boss sprite draw (large pixel grid)
- [ ] Boss HP bar (6 squares top-center)
- [ ] Boss walk-in from right
- [ ] Boss fight choreography (scripted sequence, time-based)
- [ ] Boss attack: swipe (arm extend, hero knockback)
- [ ] Boss attack: beam (horizontal line effect, hero jump-dodge)
- [ ] Boss rage phase (red flash, speed up)
- [ ] Boss final hit → hero death
- [ ] Boss victory pose

### HUD
- [ ] Hero HP bar (top-left, depletes during boss fight)
- [ ] XP + Gold counters (top-right, animated tick-up)
- [ ] Level badge (LVL 1 → LVL 2 partway through)

### GAME OVER Screen
- [ ] Centered "GAME OVER" text, bold red, 22px
- [ ] 4× blink at 0.25s interval (red ↔ white)
- [ ] Hold solid dim red for 1s
- [ ] Transition to outro

### Outro Crumble
- [ ] `_buildCrumble()` — convert all visible sprite pixels to particles
- [ ] Gravity physics for particles
- [ ] Alpha fade per particle
- [ ] `state = 'idle'` when all particles gone or timeout

### Polish
- [ ] Clip all drawing to `ga` rect (same as other effects)
- [ ] Ensure `_onStop` clears canvas + cancels RAF
- [ ] Test idle auto-spawn triggers `sideScroller` correctly
- [ ] Update `IDEAS.md` — move `sideScroller` from ideas to "Already built"
- [ ] Update `RESUME_INSTRUCTIONS.md`
