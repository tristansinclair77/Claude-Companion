# Side Scroller Effect — Rewrite Plan

This document is the master plan for a full rewrite of `SideScrollerEffect.js`.
Sub-documents contain pixel art grids and detailed specs.

---

## What's Wrong With V1

| Problem | Root Cause |
|---------|-----------|
| Effect covers chat text | `_gameArea()` returns full output-panel rect; sky fill blots it out |
| Sprites too small | `PX = 3` — characters are microscopic |
| Colors too dull | Dark navy sky, muted greens, grey sprites |
| Hero enters fully before scrolling | Walk-to-center, THEN scroll should begin together correctly |
| Enemies don't move | Enemies used absolute X; they need a "world position" carried with the scroll offset |
| No one-at-a-time queue | Multiple enemies spawned by timer; need a kill-gated queue |
| No kill animation | Enemy just disappeared |
| No float text | "+EXP / +GOLD" should rise above the kill point |
| No level-up sequence | XP just incremented; no visual reset |
| Boss sequence weak | Walk-in only; no roar, no swipe, no dramatic death |
| No 2-3 frame idle/walk animation for enemies | Static sprites only |

---

## Plan Steps

### Step 1 — Drawing Area ("Game Strip")

**Problem**: The effect must NOT cover companion dialogue/thoughts.

**Solution**: Confine all drawing to the **bottom 38% of the output-panel**, minimum 200px, maximum 260px. The text above stays completely unobscured.

```
Output panel (full height)
┌────────────────────────────────┐
│  [dialogue text]               │  ← untouched
│  [thoughts text]               │  ← untouched
├────────────────────────────────┤  ← gameStrip.y
│  [clouds drifting]             │
│  [hills + trees + bushes]      │
│  [hero  ← → enemies]           │
│  [ground]                      │
└────────────────────────────────┘  ← panel bottom
```

`_gameArea()` returns this bottom strip rect only. All clipping, drawing, and coordinate math uses this rect.

---

### Step 2 — Pixel Scale

`PX = 5`

- Hero body: ~11 rows tall → 55px
- Regular enemy: 8–10 rows → 40–50px
- Boss: ~14 rows → 70px
- Ground strip: 28px
- Clouds: small ellipses, no pixel grid needed
- Total strip height: ~240px (hero fits with headroom)

---

### Step 3 — Background (No Sky)

The sky fill is removed (transparent canvas shows dark panel behind it — fine).

**Layers drawn bottom-to-top:**

| Layer | Speed (px/s) | Contents |
|-------|-------------|----------|
| Far hills | 18 | Tall rounded silhouette, muted olive-green |
| Mid bushes | 38 | Shorter rounded clusters, medium green |
| Near trees | 70 | Tall skinny trunks + treetop blobs, bright green |
| Clouds | 12 | 3–5 small white puffball ellipses drifting left |
| Ground | 0 | Flat strip 28px, dark brown, horizontal mortar line |

Clouds are NOT part of the game strip; they float above it (in the transparent canvas area just above the strip, still clipped to full panel width). They are drawn before the ground clip, so they peek above the game strip top edge slightly. Actually — clouds should stay inside the strip (top of strip) to avoid visual weirdness.

All layers tile seamlessly. Geometry is generated once in `_buildLayers(ga)`.

---

### Step 4 — Enemy System Redesign

**Key change**: enemies have a `worldX` value. The world scrolls left at `SCROLL_SPEED`. The enemy's screen X is `ga.x + ga.w * 0.72 - (heroWorldX - enemy.worldX)` — i.e., an enemy spawned 600 world-units ahead of the hero will start off the right edge and gradually get closer as the world scrolls.

**One at a time queue**: Only one active enemy exists at a time. The next enemy is queued by world distance, not time. When the active enemy dies (and its death animation finishes), the world resumes scrolling and the next queued enemy advances.

**Enemy pool**: 7 non-boss types. At run start, shuffle the pool and pick 4–5 for this run (no repeats). Boss pool: 3 types, pick 1 randomly.

**Non-boss types** (see `SIDE_SCROLLER_SPRITES.md` for pixel grids):
1. Green Goblin
2. Blue Slime
3. Purple Harpy
4. Yellow Wolf
5. Red Imp (bat wings + trident)
6. Brown Boar
7. Orange Mimic

**Boss types**:
1. Large Orc
2. Yellow Blob (red eyeball, arms, legs)
3. Troll

---

### Step 5 — State Machine

```
idle
 └→ intro          Hero walks in from left until center (1.5s)
     └→ scrolling  World scrolls; enemies advance one-by-one
         └→ boss   Boss enters, roars, swipes, hero dies (scripted ~6s)
             └→ game_over   Screen darkens, GAME OVER blinks (3s)
                 └→ outro   Crumble particles → idle
```

**Scrolling sub-states** (managed within `scrolling` phase via `_phase` field):
- `walk` — hero walks, world scrolls
- `combat` — scrolling paused, hero slashes, enemy death animation plays
- `levelup` — XP resets to 0, level badge animates (1s), then resumes

Transition to `boss` phase: after `MIN_KILLS` (3) enemies are dead AND enough world distance has passed.

---

### Step 6 — Combat Flow

When `enemy.screenX` reaches `heroX + ENGAGE_DIST`:

1. Scrolling stops
2. Hero plays `slash` anim (sword goes horizontal 0.2s, back vertical 0.2s) — repeatable 1–2 times
3. Enemy: `hit` state → tilt backward over 0.3s (rotate from 0° to −90°)
4. Enemy: `fallen` state → flat horizontal, blink 3× at 0.25s interval (alpha flicker)
5. Enemy: disappears
6. Float text spawns:
   - `+NN EXP` rises 40px over 1.0s then fades
   - `+NN GOLD` rises 60px over 1.0s then fades (offset slightly so they don't overlap)
7. Scrolling resumes; next enemy starts advancing

---

### Step 7 — Level-Up Sequence

After 3 kills:
- XP counter animates down to 0 over 0.5s
- `LVL UP!` text appears center-ish in gold, pulses 1×, then fades
- Level badge increments
- Next enemy queue continues

---

### Step 8 — Boss Sequence

1. Boss enters from right edge, scrolls in (scrolling continues until boss at ~60% x)
2. Scrolling stops. Both face each other.
3. `ROAR` text appears above boss (0.5s), boss jiggles/shakes in place
4. Brief pause (0.5s)
5. Boss arm swipe: arm pixel extends left toward hero (0.4s)
6. Hero hit: same tilt-fall-blink-disappear animation as enemy death
7. Screen darkens (dark red overlay, 60% alpha)
8. `GAME OVER` text: bold, red, centered in game strip, blinks 4× (0.25s on/off)
9. Boss: victory pose (arms raised), bobbing up and down on ground. Stays for 2s.
10. → outro

---

### Step 9 — Outro Crumble

Same pattern as Pong/SpaceInvaders:
- All visible entities (boss, ground strip, hill pixels, tree pixels, clouds) scatter into 3–4px particles
- Each particle: `vx ∈ [−70, 70]`, `vy ∈ [−140, −10]`, gravity `+280 px/s²`
- Alpha fade over 1.5–2.5s
- `state = 'idle'` when `particles.length === 0` or timeout 4s

---

### Step 10 — HUD

All HUD elements stay inside the game strip.

- **HP bar** — top-left corner of strip. Full OR empty (boss swipe → instant to 0). Width 70px, height 8px. Red fill.
- **XP bar** — below HP bar. Cyan fill, width 70px. Counts up as enemies die, resets on level up.
- **`LVL N`** — right of XP bar. Increments on level-up.
- **GOLD counter** — top-right of strip. Yellow text, `G: NN`

---

## File Changes Summary

| File | Change |
|------|--------|
| `SideScrollerEffect.js` | Full rewrite |
| `index.html` | No change needed (canvas + script tag already added) |
| `bg-effects.css` | No change needed |
| `ArcadePackage.js` | No change needed |
| `settings.js` | No change needed |
| `ArcadeAmbientEffect.js` | No change needed |

---

## See Also

- [SIDE_SCROLLER_SPRITES.md](SIDE_SCROLLER_SPRITES.md) — all pixel art grids, color palettes, animation frames
