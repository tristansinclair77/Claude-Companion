# Pac-Man Chase — Arcade Cabinet Event Effect Design Document

## Overview
A self-contained pixel-art Pac-Man vignette that runs autonomously for ~55 seconds,
then ends with Pac-Man's classic death animation followed by a full pixel-rain crumble.
Triggered by the random event system or manually via the settings spawn button.

---

## Visual Design

### Maze
- Simplified but recognizable Pac-Man maze, 19 tiles wide × 13 tiles tall.
- Tile size computed dynamically so the maze fills ~85% of the game area height.
- Walls drawn as filled pixel-blue rectangles (`#2222cc` with a faint glow).
- Corridors contain small dot squares (4×4 px, `#ffee88` at 70% alpha).
- Four power pellets at the four inner corners (8×8 px, pulsing opacity).

### Pac-Man
- Yellow filled circle (`#ffee00`), radius = 0.44 × tile size.
- Mouth: two arc lines; mouth angle animates between 0° and 40° as he moves.
  Mouth direction always faces the direction of travel.
- When stopped (death), mouth snaps shut.

### Ghosts
Four ghosts, each a distinct colour:
| Ghost  | Colour   | Hex       |
|--------|----------|-----------|
| Blinky | Red      | `#ff2200` |
| Pinky  | Pink     | `#ffaacc` |
| Inky   | Cyan     | `#00ccee` |
| Clyde  | Orange   | `#ffaa00` |

Shape: dome top (arc), rectangular sides, wavy bottom (3 scallops), two white eyes
with small dark pupils. All drawn with canvas paths — no sprites.

Frightened mode: body turns dark blue (`#2244cc`), eyes disappear, replaced by two
small white horizontal dashes. Blink white/blue for the last 2 seconds of the timer.

### Score
Top-right of the game area. White `'Press Start 2P'`-style text (pixel font stack).
- 10 pts per dot
- 50 pts per power pellet
- 200 pts per ghost eaten (doubles: 200, 400, 800, 1600)

---

## Maze Layout
19 cols × 13 rows. Key:
- `#` wall
- `.` dot
- `o` power pellet
- ` ` empty corridor (no dot — used for ghost house area)
- `G` ghost start position (drawn as empty)

```
###################
#o...#.......#..o.#
#.##.#.#####.#.##.#
#.............#...#  <- wait, needs to be 19 wide exactly
#.##.##..##.##.##.#
#......#   #......#
####.###   ###.####
#......#   #......#
#.##.##.###.##.##.#
#.#.........#....##
#.##.#.#####.#.##.#
#o...#.......#..o.#
###################
```

Exact maze array defined in code as `const PM_MAZE` — 19-char strings × 13 rows.
Power pellets at four inner corners (row 1 col 1, row 1 col 17, row 11 col 1, row 11 col 17).
Ghost house is the open 3×1 space in the centre rows 5–7, cols 8–10.

---

## Lifecycle

### Phase 1 — intro (1.2s)
- Maze draws in: walls materialise with a fast blink-in (3 flashes at 100ms).
- Pac-Man and ghosts appear blinking (invincible frames aesthetic).
- All dots visible from frame 1.
- Transitions to `active` at t = 1.2s.

### Phase 2 — active (~50s)
**Pac-Man**
- Follows a predetermined waypoint circuit around the maze corridors.
- Speed: 120 px/s (≈ 4.4 tiles/s at 28px tiles).
- Mouth oscillates at 6 Hz (open 0°→40°→0°).
- When passing over a dot grid cell: dot is removed, score +10.
- When passing over a power pellet: pellet removed, score +50, frightened mode starts.

**Ghost AI (per ghost)**
- Each ghost moves tile-by-tile, choosing direction at each intersection.
- Normal mode: BFS shortest path toward Pac-Man's current tile.
  Blinky always targets Pac-Man directly. The others have mild scatter variance.
- Scatter mode (first 5s and again after each ghost death): target own corner.
- Frightened mode: random valid direction at each intersection; speed halved.
- Ghosts start in ghost house, exit one at a time (0s, 2s, 4s, 6s delays).
- Respawn: eaten ghost returns to ghost house, re-exits after 3s.

**Power Pellet Frightened Window**: 6 seconds.
**Ghost eat score**: 200, 400, 800, 1600 per consecutive ghost eaten in one pellet window.

**Outro trigger**: at t ≥ 50s, force the death sequence (ghosts converge,
catch Pac-Man regardless of frightened state).

### Phase 3 — outro (~7s total)

**Death (0–2.5s)**
- All ghosts freeze.
- Pac-Man plays death animation: mouth opens wide (to 360° — full circle shrinks),
  implemented as a shrinking/collapsing wedge spiral (radius shrinks from full to 0
  over 1.2s while rotating). Classic feel.
- Pac-Man flashes white briefly at t=0.
- Score display lingers.

**Crumble (2.5–7s)**
- Dots wink off one by one (sequential, left-to-right top-to-bottom, ~15ms each).
- Maze walls shatter: spawn particles at every wall tile (2×2 and 4×4 mix),
  initial velocity: vy = –50 to –120, vx = ±random spread.
- Ghost bodies also crumble: spawn a cluster of their colour pixels.
- Gravity: 320 px/s².  Fade by `life / maxLife`.
- Idle when all particles below canvas bottom.

---

## Colour Palette
| Element          | Hex       |
|------------------|-----------|
| Maze walls       | `#2233dd` |
| Maze wall glow   | `#2233dd44` |
| Dots             | `#ffee88` |
| Power pellets    | `#ffffff` |
| Pac-Man          | `#ffee00` |
| Score text       | `#ffffff` |
| Ghost (frightened)| `#2244cc`|
| Ghost eyes       | `#ffffff` |
| Ghost pupils     | `#0000aa` |

---

## Bug Fixes Applied (v2)
- Added missing `#bg-pacman` CSS rule (`position:fixed; inset:0; z-index:2`) — **root cause of nothing rendering**
- Replaced 13-row maze: row 6 was `###.###  G  ###.###` which blocked cols 1 and 17
  vertically, making the waypoint loop impossible to navigate
- New maze: 17 cols × 11 rows, symmetric, no blocking middle row
- Replaced diagonal/wall-crossing waypoints with a clean 4-corner perimeter loop
- Replaced ghost 'house' mode with simpler 'waiting' mode (ghosts start at centre tile,
  join play after their exit delay)
- Ghost movement is now `_moveGhost(random=true/false)` — single method, not duplicated

## Integration Checklist

- [ ] **`PacManEffect.js`** — maze layout constant (`PM_MAZE`)
- [ ] **`PacManEffect.js`** — class scaffold, constructor, `busy` getter, `spawn()`, `_onStart`, `_onStop`
- [ ] **`PacManEffect.js`** — `_initCanvas()`, `_gameArea()`, `_buildScene()`
- [ ] **`PacManEffect.js`** — maze rendering: walls, dots, power pellets
- [ ] **`PacManEffect.js`** — Pac-Man rendering (circle + animated mouth)
- [ ] **`PacManEffect.js`** — Ghost rendering (dome shape + eyes + frightened mode)
- [ ] **`PacManEffect.js`** — Score display
- [ ] **`PacManEffect.js`** — Intro phase (blink-in, 1.2s)
- [ ] **`PacManEffect.js`** — Active: Pac-Man waypoint movement + dot eating
- [ ] **`PacManEffect.js`** — Active: power pellet + frightened mode timer
- [ ] **`PacManEffect.js`** — Active: ghost AI (pathfinding, scatter, frightened)
- [ ] **`PacManEffect.js`** — Active: collision detection (ghost catches Pac-Man / Pac-Man eats ghost)
- [ ] **`PacManEffect.js`** — Outro: death animation (shrinking wedge spiral)
- [ ] **`PacManEffect.js`** — Outro: dot wink-off + maze wall crumble + ghost particle rain
- [ ] **`PacManEffect.js`** — `PackageRegistry.registerEffect(new PacManEffect())` at bottom
- [ ] **`index.html`** — `<canvas id="bg-pacman">` added with other bg canvases
- [ ] **`index.html`** — `<script src="js/effects/PacManEffect.js">` added with other effect scripts
- [ ] **`index.html`** — settings section `data-effect-module="pacman"` with spawn button `pm-spawn-btn`
- [ ] **`ArcadePackage.js`** — `'pacman'` added to `effectModules` array
- [ ] **`ArcadePackage.js`** — `pacman: true` added to `defaultEffects.moduleEnabled`
- [ ] **`settings.js`** — `'pacman'` added to `_EVENT_IDS` array
- [ ] **`settings.js`** — `'pm-spawn-btn'` added to `_syncEventSpawnBtns` button list
- [ ] **`settings.js`** — `pm-spawn-btn` click listener wired to `_spawnEvent('pacman')`
- [ ] **`ArcadeAmbientEffect.js`** — `'pacman'` added to local `_EVENT_IDS` array
- [ ] **`IDEAS.md`** — Pac-Man Chase moved to "Already built" section

---

## Notes & Decisions
- No full BFS pathfinding library — ghosts use a simple greedy tile-step (pick direction
  that minimises Manhattan distance to target, avoiding reverse unless forced).
  Good enough for the aesthetic; perfect pathfinding isn't the point.
- Maze is static — no random generation. Same layout every run.
- Ghost house exit timing is hardcoded (0s, 2s, 4s, 6s from active start).
- At t≥50s the death sequence is forced regardless of game state, so the event
  always ends cleanly within the ~55–60s window.
