'use strict';
/* =========================================================================
 * PacManEffect — "PAC-MAN CHASE" Arcade Cabinet random event.
 *
 * Pac-Man loops around the perimeter of a 17×11 tile maze while four ghosts
 * navigate the interior. A power pellet flips the chase. At ~50 s the death
 * sequence fires: Pac-Man shrinks away, dots wink off, maze crumbles into
 * falling pixels.
 *
 * States:  idle → intro → active → death → outro → idle
 * =========================================================================*/

// ── Maze layout (17 cols × 11 rows) ───────────────────────────────────────
// # = wall   . = dot   o = power pellet   (space) = empty (no dot)
const PM_MAZE = [
  '#################',   // row 0
  '#o.............o#',   // row 1  — top corridor, power pellets at corners
  '#.#####.#.#####.#',   // row 2
  '#...............#',   // row 3
  '#.##.#.###.#.##.#',   // row 4
  '#...#.......#...#',   // row 5  — centre: ghosts start at col 8
  '#.##.#.###.#.##.#',   // row 6
  '#...............#',   // row 7
  '#.#####.#.#####.#',   // row 8
  '#o.............o#',   // row 9  — bottom corridor
  '#################',   // row 10
];

const PM_COLS = 17;
const PM_ROWS = 11;

// Walkability lookup (true = Pac-Man / ghost can enter)
const PM_WALKABLE = PM_MAZE.map(row => row.split('').map(c => c !== '#'));

// Ghost starting position (centre of maze)
const PM_GHOST_CENTER = { col: 8, row: 5 };

// Pac-Man waypoints — snake through all rows via cols 1 and 15.
// Col 1 and col 15 are walkable in every row (rows 2,4,6,8 included).
// Each consecutive pair shares the same row OR same col — always a straight
// walkable corridor.  Loop closure: (1,9) → (1,1) is col 1 going back up.
const PM_WAYPOINTS = [
  { col: 1,  row: 1 },   // top-left
  { col: 15, row: 1 },   // top-right
  { col: 15, row: 3 },   // drop to row 3
  { col: 1,  row: 3 },   // cross row 3
  { col: 1,  row: 7 },   // drop to row 7 (passes through rows 4-6)
  { col: 15, row: 7 },   // cross row 7
  { col: 15, row: 9 },   // drop to row 9
  { col: 1,  row: 9 },   // cross bottom; wraps → col 1 back up to row 1
];

// Ghost definitions
const PM_GHOSTS_DEF = [
  { id: 'blinky', color: '#ff2200', exitDelay: 0.0, corner: { col: 15, row: 1 } },
  { id: 'pinky',  color: '#ffaacc', exitDelay: 1.5, corner: { col: 1,  row: 1 } },
  { id: 'inky',   color: '#00ccee', exitDelay: 3.0, corner: { col: 15, row: 9 } },
  { id: 'clyde',  color: '#ffaa00', exitDelay: 4.5, corner: { col: 1,  row: 9 } },
];

// ── Pixel-art sprite bitmaps (7-wide grids, 0=empty 1=filled) ─────────────
// Pac-Man facing right: open mouth (wedge cut toward right side)
const PM_SPRITE_OPEN = [
  [0,0,1,1,1,0,0],
  [0,1,1,1,1,1,0],
  [1,1,1,1,0,0,0],
  [1,1,1,0,0,0,0],
  [1,1,1,1,0,0,0],
  [0,1,1,1,1,1,0],
  [0,0,1,1,1,0,0],
];
// Pac-Man fully closed
const PM_SPRITE_CLOSED = [
  [0,0,1,1,1,0,0],
  [0,1,1,1,1,1,0],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [0,1,1,1,1,1,0],
  [0,0,1,1,1,0,0],
];
// Ghost body (7 wide × 8 tall) — eyes overlaid separately
const PM_GHOST_BODY = [
  [0,0,1,1,1,0,0],
  [0,1,1,1,1,1,0],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [1,0,1,0,1,0,1],   // alternating bottom edge = wavy skirt
];

// ── Pixel font — 3×5 bitmaps for digits 0-9 and '!' ──────────────────────
const PM_PIXEL_FONT = {
  '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
  '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
  '2': [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
  '3': [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
  '4': [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
  '5': [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
  '6': [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
  '7': [[1,1,1],[0,0,1],[0,1,0],[0,1,0],[0,1,0]],
  '8': [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
  '9': [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
  '!': [[0,1,0],[0,1,0],[0,1,0],[0,0,0],[0,1,0]],
  'x': [[1,0,1],[1,0,1],[0,1,0],[1,0,1],[1,0,1]],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function _isWalkable(col, row) {
  if (row < 0 || row >= PM_ROWS || col < 0 || col >= PM_COLS) return false;
  return PM_WALKABLE[row][col];
}

// Greedy next-step: pick adjacent tile that minimises Manhattan distance to
// target, never reversing unless forced.
function _ghostStep(ghost, targetCol, targetRow) {
  const dirs = [
    { dc:  0, dr: -1 },
    { dc:  0, dr:  1 },
    { dc: -1, dr:  0 },
    { dc:  1, dr:  0 },
  ];
  const revDc = -ghost.dc;
  const revDr = -ghost.dr;
  let best = null, bestDist = Infinity;

  for (const d of dirs) {
    if (d.dc === revDc && d.dr === revDr) continue;
    const nc = ghost.col + d.dc;
    const nr = ghost.row + d.dr;
    if (!_isWalkable(nc, nr)) continue;
    const dist = Math.abs(nc - targetCol) + Math.abs(nr - targetRow);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }

  if (!best) {
    // Forced reverse
    const rc = ghost.col + revDc, rr = ghost.row + revDr;
    if (_isWalkable(rc, rr)) best = { dc: revDc, dr: revDr };
  }

  return best || { dc: 0, dr: 0 };
}

// Random valid direction (frightened mode)
function _ghostStepRandom(ghost) {
  const dirs = [
    { dc:  0, dr: -1 }, { dc:  0, dr:  1 },
    { dc: -1, dr:  0 }, { dc:  1, dr:  0 },
  ];
  const revDc = -ghost.dc, revDr = -ghost.dr;
  const valid = dirs.filter(d => {
    if (d.dc === revDc && d.dr === revDr) return false;
    return _isWalkable(ghost.col + d.dc, ghost.row + d.dr);
  });
  if (!valid.length) return { dc: revDc, dr: revDr };
  return valid[Math.floor(Math.random() * valid.length)];
}

// ── Effect class ───────────────────────────────────────────────────────────

class PacManEffect extends VisualEffect {

  // Tuning
  static ACTIVE_DURATION    = 50;    // s — forced death at this point
  static PM_SPEED           = 3.5;   // tiles / s
  static GHOST_SPEED        = 2.6;   // tiles / s (normal)
  static GHOST_FRIGHT_SPEED = 1.4;   // tiles / s (frightened)
  static FRIGHT_DURATION    = 6.0;   // s per power pellet
  static FRIGHT_BLINK_AT    = 2.0;   // s remaining when blink starts
  static DEATH_ANIM_DUR     = 1.6;   // s for Pac-Man collapse animation
  static DOT_WINK_RATE      = 55;    // dots per second to wink off
  static OUTRO_GRAVITY      = 310;   // px / s²
  static SCATTER_DURATION   = 5.0;   // s of initial scatter per ghost
  static GHOST_RESPAWN_T    = 2.5;   // s before eaten ghost re-enters play

  constructor() {
    super('pacman');
    this._canvas   = null;
    this._ctx      = null;
    this._rAF      = null;
    this._state    = 'idle';    // idle | intro | active | death | outro
    this._t        = 0;
    this._lastTs   = 0;

    this._dots     = null;      // Map<"col,row", true>
    this._pellets  = null;      // Map<"col,row", true>
    this._score    = 0;
    this._ghostMult = 1;

    this._pm       = null;
    this._pmAlive  = true;
    this._pmDeathT = 0;

    this._ghosts   = [];
    this._frightT  = 0;

    this._blinkVis = true;
    this._blinkT   = 0;

    this._particles    = [];
    this._dotWinkList  = [];
    this._dotWinkAcc   = 0;
    this._rings        = [];   // expanding shockwave circles on ghost-eat
    this._scorePopups  = [];   // floating score text on ghost-eat

    this._lives    = 0;        // remaining extra lives (respawns)
    this._respawnT = 0;        // >0: Pac-Man is blinking (invincible after respawn)

    this._tileW    = 28;
    this._tileH    = 28;
    this._mazeX    = 0;
    this._mazeY    = 0;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get busy() { return this._state !== 'idle'; }

  spawn() {
    if (!this._initCanvas()) return;
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._buildScene();
    this._state  = 'intro';
    this._t      = 0;
    this._lastTs = 0;
    this._blinkVis = true;
    this._blinkT   = 0;
    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  _onStart(config) { this._initCanvas(); }

  _onStop() {
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._state = 'idle';
    if (this._ctx && this._canvas)
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * dismiss() — called when the user sends a message mid-event.
   * Immediately skips to the pixel-crumble outro, bypassing death animation.
   * Rule: every event effect MUST implement this and jump straight to crumble.
   */
  dismiss() {
    if (this._state === 'idle') return;
    if (this._state !== 'outro') {
      this._particles = [];
      this._buildCrumble();
    }
    this._state = 'outro';
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return true;
    this._canvas = document.getElementById('bg-pacman');
    if (!this._canvas) return false;
    this._ctx = this._canvas.getContext('2d');
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
      if (!this._canvas) return;
      this._canvas.width  = window.innerWidth;
      this._canvas.height = window.innerHeight;
    });
    return true;
  }

  _gameArea() {
    const el = document.getElementById('output-panel');
    if (!el) return { x: 10, y: 42, w: 700, h: 500 };
    const r = el.getBoundingClientRect();
    return { x: r.left + 4, y: r.top + 4, w: r.width - 8, h: r.height - 8 };
  }

  _buildScene() {
    const ga = this._gameArea();

    // Use separate tile width and height so the maze fills the full game area.
    this._tileW = ga.w / PM_COLS;
    this._tileH = ga.h / PM_ROWS;
    this._mazeX = ga.x;
    this._mazeY = ga.y;

    // Populate dots and pellets from maze
    this._dots    = new Map();
    this._pellets = new Map();
    for (let r = 0; r < PM_ROWS; r++) {
      for (let c = 0; c < PM_COLS; c++) {
        const ch = PM_MAZE[r][c];
        if (ch === '.') this._dots.set(`${c},${r}`, true);
        if (ch === 'o') this._pellets.set(`${c},${r}`, true);
      }
    }

    this._score     = 0;
    this._frightT   = 0;
    this._ghostMult = 1;
    this._pmAlive   = true;
    this._pmDeathT  = 0;
    this._lives     = 2;        // 2 extra lives → 3 total tries
    this._respawnT  = 0;
    this._particles   = [];
    this._dotWinkList = [];
    this._dotWinkAcc  = 0;
    this._rings       = [];
    this._scorePopups = [];

    // Pac-Man — start at top-left corridor, facing right
    const wp0 = PM_WAYPOINTS[0];
    this._pm = {
      x:      this._mazeX + (wp0.col + 0.5) * this._tileW,
      y:      this._mazeY + (wp0.row + 0.5) * this._tileH,
      col:    wp0.col,
      row:    wp0.row,
      wpIdx:  1,          // index of next target waypoint
      dx: 1, dy: 0,       // facing direction (for mouth)
      mouthT: 0,
    };

    // Ghosts — all start at the maze centre, staggered exit times
    this._ghosts = PM_GHOSTS_DEF.map(def => ({
      id:        def.id,
      color:     def.color,
      corner:    def.corner,
      exitDelay: def.exitDelay,
      col:       PM_GHOST_CENTER.col,
      row:       PM_GHOST_CENTER.row,
      x:         this._mazeX + (PM_GHOST_CENTER.col + 0.5) * this._tileW,
      y:         this._mazeY + (PM_GHOST_CENTER.row + 0.5) * this._tileH,
      dc: 0, dr: 0,
      mode:      'waiting',   // waiting | scatter | chase | frightened | eaten
      modeT:     0,
      respawnT:  0,
      stuckT:    0,           // time without advancing to a new tile
    }));
  }

  // ── Main tick ─────────────────────────────────────────────────────────────

  _tick(ts) {
    if (this._state === 'idle') { this._rAF = null; return; }
    if (this._lastTs === 0) this._lastTs = ts;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.10);
    this._lastTs = ts;
    this._t += dt;

    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    switch (this._state) {
      case 'intro':  this._updateIntro(dt);  break;
      case 'active': this._updateActive(dt); break;
      case 'death':  this._updateDeath(dt);  break;
      case 'outro':  this._updateOutro(dt);  break;
    }

    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Intro (1.2 s blink-in) ────────────────────────────────────────────────

  _updateIntro(dt) {
    this._blinkT += dt;
    if (this._blinkT >= 0.10) { this._blinkT = 0; this._blinkVis = !this._blinkVis; }

    this._ctx.save();
    this._ctx.globalAlpha = 0.88;
    this._drawMaze();
    this._drawDots();
    if (this._blinkVis) {
      this._drawPacMan();
      for (const g of this._ghosts) this._drawGhost(g);
    }
    this._drawScore();
    this._ctx.restore();

    if (this._t >= 1.2) { this._t = 0; this._state = 'active'; }
  }

  // ── Active ────────────────────────────────────────────────────────────────

  _updateActive(dt) {
    if (this._t >= PacManEffect.ACTIVE_DURATION) {
      this._startDeath();
      return;
    }

    if (this._respawnT > 0) this._respawnT -= dt;
    this._updateFrightened(dt);
    this._updatePacMan(dt);
    this._updateGhosts(dt);
    this._resolveGhostCollisions();
    this._checkCollisions();
    this._tickParticles(dt);
    this._tickRings(dt);
    this._tickScorePopups(dt);

    this._ctx.save();
    this._ctx.globalAlpha = 0.88;
    this._drawMaze();
    this._drawDots();
    this._drawPacMan();
    for (const g of this._ghosts) this._drawGhost(g);
    this._drawRings();
    this._drawParticles();
    this._drawScorePopups();
    this._drawScore();
    this._ctx.restore();
  }

  _updateFrightened(dt) {
    if (this._frightT <= 0) return;
    this._frightT -= dt;
    if (this._frightT <= 0) {
      this._frightT  = 0;
      this._ghostMult = 1;
      for (const g of this._ghosts) {
        if (g.mode === 'frightened') g.mode = 'chase';
      }
    }
  }

  _updatePacMan(dt) {
    const pm = this._pm;
    const TW = this._tileW, TH = this._tileH;
    const T  = Math.min(TW, TH);

    pm.mouthT += dt * 5;  // ~5 chomps per second

    const wp  = PM_WAYPOINTS[pm.wpIdx % PM_WAYPOINTS.length];
    const tx  = this._mazeX + (wp.col + 0.5) * TW;
    const ty  = this._mazeY + (wp.row + 0.5) * TH;
    const ddx = tx - pm.x;
    const ddy = ty - pm.y;
    const dist = Math.hypot(ddx, ddy);
    const step = PacManEffect.PM_SPEED * T * dt;

    if (dist <= step + 0.5) {
      // Arrived — snap, eat, advance
      pm.x = tx; pm.y = ty;
      pm.col = wp.col; pm.row = wp.row;
      pm.wpIdx = (pm.wpIdx + 1) % PM_WAYPOINTS.length;

      const key = `${wp.col},${wp.row}`;
      if (this._dots.has(key))    { this._dots.delete(key);    this._score += 10; }
      if (this._pellets.has(key)) { this._pellets.delete(key); this._score += 50; this._activateFrightened(); }
    } else {
      // Move toward waypoint
      pm.x += (ddx / dist) * step;
      pm.y += (ddy / dist) * step;
      // Update facing direction
      if (Math.abs(ddx) > Math.abs(ddy)) {
        pm.dx = ddx > 0 ? 1 : -1; pm.dy = 0;
      } else {
        pm.dx = 0; pm.dy = ddy > 0 ? 1 : -1;
      }
    }

    // Eat dots along the path (not just at waypoints)
    const nearCol = Math.round((pm.x - this._mazeX) / TW - 0.5);
    const nearRow = Math.round((pm.y - this._mazeY) / TH - 0.5);
    const nKey = `${nearCol},${nearRow}`;
    if (this._dots.has(nKey))    { this._dots.delete(nKey);    this._score += 10; }
    if (this._pellets.has(nKey)) { this._pellets.delete(nKey); this._score += 50; this._activateFrightened(); }
  }

  _activateFrightened() {
    this._frightT   = PacManEffect.FRIGHT_DURATION;
    this._ghostMult = 1;
    for (const g of this._ghosts) {
      if (g.mode === 'chase' || g.mode === 'scatter') {
        g.mode = 'frightened';
        g.dc = -g.dc; g.dr = -g.dr;  // reverse on fright
      }
    }
  }

  _updateGhosts(dt) {
    const T = Math.min(this._tileW, this._tileH);

    for (const g of this._ghosts) {
      // Waiting — delay before joining play
      if (g.mode === 'waiting') {
        g.modeT += dt;
        if (g.modeT >= g.exitDelay) {
          g.mode  = 'scatter';
          g.modeT = 0;
          // Set initial direction: move toward own scatter corner
          g.dc = g.corner.col > g.col ? 1 : -1;
          g.dr = 0;
        }
        continue;
      }

      // Stuck detection: if the ghost hasn't advanced to a new tile for too
      // long (e.g. blocked by all-walls situation or a collision edge-case),
      // kick it in a random walkable direction.
      g.stuckT += dt;
      if (g.stuckT > 0.8) {
        g.stuckT = 0;
        const dirs = [{dc:1,dr:0},{dc:-1,dr:0},{dc:0,dr:1},{dc:0,dr:-1}];
        const valid = dirs.filter(d => _isWalkable(g.col + d.dc, g.row + d.dr));
        if (valid.length) {
          const d = valid[Math.floor(Math.random() * valid.length)];
          g.dc = d.dc; g.dr = d.dr;
        }
      }

      // Eaten — respawn timer, then re-enter as chase
      if (g.mode === 'eaten') {
        g.respawnT -= dt;
        if (g.respawnT <= 0) {
          g.mode  = 'chase';
          g.col   = PM_GHOST_CENTER.col;
          g.row   = PM_GHOST_CENTER.row;
          g.x     = this._mazeX + (g.col + 0.5) * this._tileW;
          g.y     = this._mazeY + (g.row + 0.5) * this._tileH;
          g.dc = 0; g.dr = 0;
        }
        continue;
      }

      // Scatter → switch to chase after duration
      if (g.mode === 'scatter') {
        g.modeT += dt;
        if (g.modeT >= PacManEffect.SCATTER_DURATION) {
          g.mode  = 'chase';
          g.modeT = 0;
        }
        this._moveGhost(g, g.corner.col, g.corner.row,
          PacManEffect.GHOST_SPEED, dt, T, false);
        continue;
      }

      if (g.mode === 'chase') {
        // Personality-based targeting (classic Pac-Man rules)
        const pm = this._pm;
        let tCol = pm.col, tRow = pm.row;   // default: Blinky — target Pac-Man directly

        if (g.id === 'pinky') {
          // 4 tiles ahead of Pac-Man's direction
          tCol = Math.max(0, Math.min(PM_COLS - 1, pm.col + pm.dx * 4));
          tRow = Math.max(0, Math.min(PM_ROWS - 1, pm.row + pm.dy * 4));

        } else if (g.id === 'inky') {
          // Pivot = 2 tiles ahead of PM; target = pivot + (pivot - Blinky)
          const blinky = this._ghosts.find(h => h.id === 'blinky');
          const pivC   = pm.col + pm.dx * 2;
          const pivR   = pm.row + pm.dy * 2;
          if (blinky) {
            tCol = Math.max(0, Math.min(PM_COLS - 1, pivC + (pivC - blinky.col)));
            tRow = Math.max(0, Math.min(PM_ROWS - 1, pivR + (pivR - blinky.row)));
          }

        } else if (g.id === 'clyde') {
          // Chase if >8 tiles away; retreat to corner if close
          const dist = Math.abs(g.col - pm.col) + Math.abs(g.row - pm.row);
          if (dist <= 8) { tCol = g.corner.col; tRow = g.corner.row; }
        }

        this._moveGhost(g, tCol, tRow, PacManEffect.GHOST_SPEED, dt, T, false);
        continue;
      }

      if (g.mode === 'frightened') {
        this._moveGhost(g, 0, 0,
          PacManEffect.GHOST_FRIGHT_SPEED, dt, T, true);
      }
    }
  }

  _moveGhost(g, targetCol, targetRow, spd, dt, _unused, random) {
    const TW = this._tileW, TH = this._tileH;
    const T  = Math.min(TW, TH);
    const tx = this._mazeX + (g.col + 0.5) * TW;
    const ty = this._mazeY + (g.row + 0.5) * TH;
    const dx = tx - g.x;
    const dy = ty - g.y;
    const distToCenter = Math.hypot(dx, dy);
    const step = spd * T * dt;

    if (distToCenter <= step + 0.5) {
      // Arrived at tile centre — snap and choose next tile
      g.x = tx; g.y = ty;
      let next = random
        ? _ghostStepRandom(g)
        : _ghostStep(g, targetCol, targetRow);
      // If greedy found no move, fall back to random to avoid permanent lock
      if (next.dc === 0 && next.dr === 0) next = _ghostStepRandom(g);
      g.dc = next.dc; g.dr = next.dr;
      const nc = g.col + g.dc, nr = g.row + g.dr;
      if (_isWalkable(nc, nr)) {
        g.col = nc; g.row = nr;
        g.stuckT = 0;   // successfully advanced — reset stuck timer
      } else {
        g.dc = 0; g.dr = 0;
      }
    } else {
      g.x += (dx / distToCenter) * step;
      g.y += (dy / distToCenter) * step;
    }
  }

  _checkCollisions() {
    if (this._respawnT > 0) return;   // invincible during respawn blink
    const hitRadius = Math.min(this._tileW, this._tileH) * 0.50;

    for (const g of this._ghosts) {
      if (g.mode === 'waiting' || g.mode === 'eaten') continue;
      if (Math.hypot(g.x - this._pm.x, g.y - this._pm.y) > hitRadius) continue;

      if (g.mode === 'frightened') {
        // Pac-Man eats ghost
        const pts = 200 * this._ghostMult;
        this._score += pts;
        this._ghostMult = Math.min(this._ghostMult * 2, 8);
        this._spawnEatPop(g.x, g.y, g.color, pts);
        g.mode     = 'eaten';
        g.respawnT = PacManEffect.GHOST_RESPAWN_T;
      } else {
        // Ghost catches Pac-Man
        this._startDeath();
        return;
      }
    }
  }

  _resolveGhostCollisions() {
    // When two ghosts occupy overlapping positions, reverse both of their
    // current directions so they bounce away from each other.
    const T = Math.min(this._tileW, this._tileH);
    const bumpRadius = T * 0.70;

    for (let i = 0; i < this._ghosts.length; i++) {
      const a = this._ghosts[i];
      if (a.mode === 'waiting' || a.mode === 'eaten') continue;

      for (let j = i + 1; j < this._ghosts.length; j++) {
        const b = this._ghosts[j];
        if (b.mode === 'waiting' || b.mode === 'eaten') continue;

        if (Math.hypot(a.x - b.x, a.y - b.y) > bumpRadius) continue;

        // Reverse both ghosts' current directions (flip dc/dr)
        // Only reverse if they are actually moving toward each other
        // (prevents double-reversal on consecutive frames)
        const approaching = (b.x - a.x) * (b.dc - a.dc) + (b.y - a.y) * (b.dr - a.dr) < 0;
        if (!approaching) continue;

        a.dc = -a.dc; a.dr = -a.dr;
        b.dc = -b.dc; b.dr = -b.dr;

        // If reversed direction is blocked, pick any walkable direction instead
        const _fix = g => {
          if (!_isWalkable(g.col + g.dc, g.row + g.dr)) {
            const dirs = [{dc:1,dr:0},{dc:-1,dr:0},{dc:0,dr:1},{dc:0,dr:-1}];
            const valid = dirs.filter(d => _isWalkable(g.col + d.dc, g.row + d.dr));
            if (valid.length) { const d = valid[Math.floor(Math.random() * valid.length)]; g.dc = d.dc; g.dr = d.dr; }
            else { g.dc = 0; g.dr = 0; }
          }
        };
        _fix(a); _fix(b);
      }
    }
  }

  _spawnEatPop(x, y, color, pts) {
    const T = Math.min(this._tileW, this._tileH);

    // Big radial burst in ghost color
    for (let i = 0; i < 30; i++) {
      const a   = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 160;
      this._particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 35,
        size:    Math.random() < 0.35 ? 6 : 3,
        color,
        life:    0.35 + Math.random() * 0.40,
        maxLife: 0.75,
        gravity: 260,
      });
    }

    // 8-point white/yellow star burst — sharp cardinal + diagonal rays
    for (let i = 0; i < 8; i++) {
      const a   = (i / 8) * Math.PI * 2;
      const spd = 160 + Math.random() * 55;
      this._particles.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size:    5,
        color:   i % 2 === 0 ? '#ffffff' : '#ffee00',
        life:    0.30,
        maxLife: 0.30,
        gravity: 0,
      });
    }

    // Expanding shockwave ring
    this._rings.push({ x, y, r: 0, maxR: T * 2.0, life: 1.0, maxLife: 1.0, color });

    // Floating score popup
    this._scorePopups.push({ x, y, text: String(pts) + '!', vy: -70, life: 1.0, maxLife: 1.0, color });
  }

  // ── Tick helpers ──────────────────────────────────────────────────────────

  _tickRings(dt) {
    for (const r of this._rings) {
      r.r    += (r.maxR / (r.maxLife * 0.45)) * dt;
      r.life -= dt;
    }
    this._rings = this._rings.filter(r => r.life > 0);
  }

  _tickScorePopups(dt) {
    for (const p of this._scorePopups) {
      p.y   += p.vy * dt;
      p.vy  *= 0.88;
      p.life -= dt;
    }
    this._scorePopups = this._scorePopups.filter(p => p.life > 0);
  }

  // ── Draw helpers ──────────────────────────────────────────────────────────

  _drawRings() {
    const ctx = this._ctx;
    ctx.save();
    for (const r of this._rings) {
      const alpha = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = alpha * 0.80;
      ctx.strokeStyle = r.color;
      ctx.shadowColor = r.color;
      ctx.shadowBlur  = 14;
      ctx.lineWidth   = Math.max(1, 4 * alpha);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  _drawScorePopups() {
    const ctx = this._ctx;
    const T   = Math.min(this._tileW, this._tileH);
    const px  = Math.max(2, Math.floor(T * 0.14));  // 1 font-pixel in screen pixels
    ctx.save();
    for (const p of this._scorePopups) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 10;
      this._drawPixelText(ctx, p.text, p.x, Math.round(p.y), px, p.color);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // Render a string using the 3×5 pixel font, centred on cx.
  _drawPixelText(ctx, text, cx, y, px, color) {
    const charW  = 3 * px + px;   // 3-col glyph + 1px kerning gap
    const totalW = text.length * charW - px;
    let sx = Math.round(cx - totalW / 2);
    ctx.fillStyle = color;
    for (const ch of text) {
      const glyph = PM_PIXEL_FONT[ch];
      if (!glyph) { sx += charW; continue; }
      for (let r = 0; r < glyph.length; r++) {
        for (let c = 0; c < 3; c++) {
          if (glyph[r][c]) ctx.fillRect(sx + c * px, y + r * px, px, px);
        }
      }
      sx += charW;
    }
  }

  // ── Death ─────────────────────────────────────────────────────────────────

  _startDeath() {
    this._pmAlive  = false;
    this._pmDeathT = 0;
    this._state    = 'death';
    this._t        = 0;
    for (const g of this._ghosts) { g.dc = 0; g.dr = 0; }  // freeze ghosts
  }

  _updateDeath(dt) {
    this._pmDeathT += dt;
    this._tickParticles(dt);
    this._tickRings(dt);
    this._tickScorePopups(dt);

    this._ctx.save();
    this._ctx.globalAlpha = 0.88;
    this._drawMaze();
    this._drawDots();
    for (const g of this._ghosts) this._drawGhost(g);
    this._drawPacManDeath(this._pmDeathT);
    this._drawRings();
    this._drawParticles();
    this._drawScorePopups();
    this._drawScore();
    this._ctx.restore();

    if (this._pmDeathT >= PacManEffect.DEATH_ANIM_DUR) {
      if (this._lives > 0) {
        this._lives--;
        this._respawnPacMan();
      } else {
        this._t     = 0;
        this._state = 'outro';
        this._buildCrumble();
      }
    }
  }

  _respawnPacMan() {
    const wp0 = PM_WAYPOINTS[0];
    this._pm = {
      x:      this._mazeX + (wp0.col + 0.5) * this._tileW,
      y:      this._mazeY + (wp0.row + 0.5) * this._tileH,
      col:    wp0.col,
      row:    wp0.row,
      wpIdx:  1,
      dx: 1, dy: 0,
      mouthT: 0,
    };
    this._pmAlive   = true;
    this._pmDeathT  = 0;
    this._respawnT  = 2.2;   // seconds of invincible blinking
    this._particles = [];
    this._rings     = [];
    this._state     = 'active';
  }

  // ── Outro ─────────────────────────────────────────────────────────────────

  _updateOutro(dt) {
    // Wink off remaining dots sequentially
    this._dotWinkAcc += dt * PacManEffect.DOT_WINK_RATE;
    const winkCount = Math.floor(this._dotWinkAcc);
    if (winkCount > 0) {
      this._dotWinkAcc -= winkCount;
      for (let i = 0; i < winkCount && this._dotWinkList.length > 0; i++) {
        const key = this._dotWinkList.shift();
        this._dots.delete(key);
        this._pellets.delete(key);
      }
    }

    this._tickParticles(dt);

    this._ctx.save();
    this._ctx.globalAlpha = 0.88;
    // Do NOT draw the maze — the crumble particles ARE the walls falling apart.
    this._drawDots();
    this._drawParticles();
    this._drawScore();
    this._ctx.restore();

    if (this._particles.length === 0 && this._dotWinkList.length === 0) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._state = 'idle';
    }
  }

  _buildCrumble() {
    const TW = this._tileW, TH = this._tileH;
    const T  = Math.min(TW, TH);

    // Collect remaining dots/pellets into wink list (top-left to bottom-right)
    const allDots = [];
    for (let r = 0; r < PM_ROWS; r++)
      for (let c = 0; c < PM_COLS; c++) {
        const k = `${c},${r}`;
        if (this._dots.has(k) || this._pellets.has(k)) allDots.push(k);
      }
    this._dotWinkList = allDots;
    this._dotWinkAcc  = 0;

    // Wall particles — one burst per wall tile
    for (let r = 0; r < PM_ROWS; r++) {
      for (let c = 0; c < PM_COLS; c++) {
        if (PM_WALKABLE[r][c]) continue;
        const wx = this._mazeX + c * TW;
        const wy = this._mazeY + r * TH;
        const count = Math.max(3, Math.floor(TW * TH / 22));
        for (let i = 0; i < count; i++) {
          this._particles.push({
            x:       wx + Math.random() * T,
            y:       wy + Math.random() * T,
            vx:      (Math.random() - 0.5) * 80,
            vy:      -30 - Math.random() * 80,
            size:    Math.random() < 0.35 ? 4 : 2,
            color:   '#2233dd',
            life:    1.0 + Math.random() * 1.6,
            maxLife: 2.6,
            gravity: PacManEffect.OUTRO_GRAVITY,
          });
        }
      }
    }

    // Ghost particles
    for (const g of this._ghosts) {
      if (g.mode === 'eaten') continue;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 30 + Math.random() * 70;
        this._particles.push({
          x: g.x + (Math.random() - 0.5) * TW,
          y: g.y + (Math.random() - 0.5) * TH,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd - 45,
          size: Math.random() < 0.4 ? 4 : 2,
          color: g.color,
          life:    1.0 + Math.random() * 1.4,
          maxLife: 2.4,
          gravity: PacManEffect.OUTRO_GRAVITY,
        });
      }
    }
  }

  _tickParticles(dt) {
    for (const p of this._particles) {
      p.vy += (p.gravity || 0) * dt;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.life -= dt;
    }
    this._particles = this._particles.filter(
      p => p.life > 0 && p.y < this._canvas.height + 20
    );
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _drawMaze() {
    const ctx = this._ctx;
    const TW  = this._tileW, TH = this._tileH;

    ctx.save();
    ctx.shadowColor = '#2233dd';
    ctx.shadowBlur  = 7;
    ctx.fillStyle   = '#2233dd';

    for (let r = 0; r < PM_ROWS; r++) {
      for (let c = 0; c < PM_COLS; c++) {
        if (!PM_WALKABLE[r][c]) {
          ctx.fillRect(
            this._mazeX + c * TW + 1,
            this._mazeY + r * TH + 1,
            TW - 2, TH - 2
          );
        }
      }
    }
    ctx.restore();
  }

  _drawDots() {
    const ctx = this._ctx;
    const TW  = this._tileW, TH = this._tileH;
    const T   = Math.min(TW, TH);
    const now = performance.now() / 1000;
    const dotR = Math.max(2, Math.floor(T * 0.10));

    ctx.save();
    ctx.fillStyle   = '#ffee88';
    ctx.globalAlpha = 0.75;
    for (const [key] of this._dots) {
      const [cs, rs] = key.split(',');
      const cx = this._mazeX + (+cs + 0.5) * TW;
      const cy = this._mazeY + (+rs + 0.5) * TH;
      ctx.fillRect(cx - dotR, cy - dotR, dotR * 2, dotR * 2);
    }
    ctx.restore();

    // Power pellets — pulsing square block
    const pulseA  = 0.55 + 0.45 * Math.sin(now * 4);
    const pelletS = Math.max(6, Math.floor(T * 0.38));
    ctx.save();
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur  = 10;
    ctx.globalAlpha = pulseA;
    for (const [key] of this._pellets) {
      const [cs, rs] = key.split(',');
      const cx = this._mazeX + (+cs + 0.5) * TW;
      const cy = this._mazeY + (+rs + 0.5) * TH;
      ctx.fillRect(Math.round(cx - pelletS / 2), Math.round(cy - pelletS / 2), pelletS, pelletS);
    }
    ctx.restore();
  }

  _drawPacMan() {
    if (!this._pmAlive) return;
    // Blink during respawn invincibility window
    if (this._respawnT > 0) {
      const now = performance.now() / 1000;
      if (Math.floor(now * 7) % 2 === 0) return;
    }
    const pm  = this._pm;
    const ctx = this._ctx;
    const T   = Math.min(this._tileW, this._tileH);
    const PX  = Math.max(2, Math.floor(T / 7));   // 1 sprite pixel = PX screen pixels
    const S   = PX * 7;
    // cycle: open ~55% of the time, closed ~45% — feels like a quick snapping chomp
    const cycle     = pm.mouthT % 1.0;
    const mouthOpen = cycle > 0.45;
    const sprite    = mouthOpen ? PM_SPRITE_OPEN : PM_SPRITE_CLOSED;

    ctx.save();
    ctx.fillStyle   = '#ffee00';
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur  = 6;

    // Rotate canvas so the open-mouth always faces the direction of travel
    ctx.translate(pm.x, pm.y);
    if      (pm.dx === -1)              ctx.scale(-1, 1);
    else if (pm.dy === -1)              ctx.rotate(-Math.PI / 2);
    else if (pm.dy ===  1)              ctx.rotate( Math.PI / 2);
    // dx === 1: no transform (sprite faces right by default)

    const ox = -Math.floor(S / 2);
    const oy = -Math.floor(S / 2);
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (sprite[r][c]) ctx.fillRect(ox + c * PX, oy + r * PX, PX, PX);
      }
    }
    ctx.restore();
  }

  _drawPacManDeath(deathT) {
    const pm       = this._pm;
    const ctx      = this._ctx;
    const T        = Math.min(this._tileW, this._tileH);
    const dur      = PacManEffect.DEATH_ANIM_DUR;
    const progress = Math.min(deathT / dur, 1.0);
    if (progress >= 1) return;

    // Pie-chart death rendered as pixel blocks.
    // Gap angle grows from π/8 (~22°) to 2π (all gone).
    // Each pixel of PM_SPRITE_CLOSED is kept only if its angle from the sprite
    // centre falls OUTSIDE the gap — so the yellow body crumbles block-by-block.
    const startGap = Math.PI / 8;
    const gapAngle = startGap + progress * (Math.PI * 2 - startGap);
    const halfGap  = gapAngle / 2;

    const PX = Math.max(2, Math.floor(T / 7));
    const S  = PX * 7;
    const ox = -Math.floor(S / 2);
    const oy = -Math.floor(S / 2);

    ctx.save();
    ctx.translate(pm.x, pm.y);

    // Rotate so the gap faces the direction Pac-Man was moving
    if      (pm.dx === -1) ctx.rotate(Math.PI);
    else if (pm.dy === -1) ctx.rotate(-Math.PI / 2);
    else if (pm.dy ===  1) ctx.rotate( Math.PI / 2);

    ctx.fillStyle   = '#ffee00';
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur  = 6;
    ctx.globalAlpha = 0.9;

    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (!PM_SPRITE_CLOSED[r][c]) continue;
        // Centre of this pixel block relative to sprite origin (0,0)
        const pcx = ox + (c + 0.5) * PX;
        const pcy = oy + (r + 0.5) * PX;
        // Skip pixels whose angle falls inside the gap (they've been "eaten")
        if (Math.abs(Math.atan2(pcy, pcx)) <= halfGap) continue;
        ctx.fillRect(ox + c * PX, oy + r * PX, PX, PX);
      }
    }

    ctx.restore();
  }

  _drawGhost(g) {
    if (g.mode === 'waiting' || g.mode === 'eaten') return;

    const ctx = this._ctx;
    const T   = Math.min(this._tileW, this._tileH);
    const PX  = Math.max(2, Math.floor(T / 7));
    const now = performance.now() / 1000;

    const frightened = g.mode === 'frightened';
    const blinking   = frightened && this._frightT <= PacManEffect.FRIGHT_BLINK_AT;
    const blinkOn    = !blinking || (Math.floor(now * 5) % 2 === 0);
    if (!blinkOn) return;

    const bodyColor = frightened
      ? ((blinking && Math.floor(now * 5) % 2 === 1) ? '#ffffff' : '#2244cc')
      : g.color;

    // Sprite is 7 wide × 8 tall
    const SW = PX * 7, SH = PX * 8;
    const ox = Math.round(g.x - SW / 2);
    const oy = Math.round(g.y - SH / 2);

    ctx.save();
    ctx.fillStyle = bodyColor;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 7; c++) {
        if (PM_GHOST_BODY[r][c]) ctx.fillRect(ox + c * PX, oy + r * PX, PX, PX);
      }
    }

    if (!frightened) {
      // White eye blocks: 2×2 px each at cols 1-2 and cols 4-5, rows 2-3
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 1 * PX, oy + 2 * PX, PX * 2, PX * 2);
      ctx.fillRect(ox + 4 * PX, oy + 2 * PX, PX * 2, PX * 2);

      // Pupils: 1×1 px, snap to 8-direction toward Pac-Man
      const pa   = Math.atan2(this._pm.y - g.y, this._pm.x - g.x);
      const pdc  = Math.round(Math.cos(pa));
      const pdr  = Math.round(Math.sin(pa));
      // pupil offset within the 2×2 eye: (0,0)=top-left … (1,1)=bottom-right
      const poc  = pdc === 1 ? 1 : 0;
      const por  = pdr === 1 ? 1 : 0;
      ctx.fillStyle = '#0000cc';
      ctx.fillRect(ox + (1 + poc) * PX, oy + (2 + por) * PX, PX, PX);
      ctx.fillRect(ox + (4 + poc) * PX, oy + (2 + por) * PX, PX, PX);
    } else {
      // Frightened: two white pixel dashes for eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + 1 * PX, oy + 3 * PX, PX * 2, PX);
      ctx.fillRect(ox + 4 * PX, oy + 3 * PX, PX * 2, PX);
    }

    ctx.restore();
  }

  _drawScore() {
    const ctx = this._ctx;
    const ga  = this._gameArea();
    ctx.save();
    ctx.font         = `bold ${Math.max(11, Math.floor(Math.min(this._tileW, this._tileH) * 0.55))}px "Courier New", monospace`;
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';
    ctx.globalAlpha  = 0.80;
    ctx.fillText(String(this._score).padStart(6, '0'), ga.x + ga.w - 8, ga.y + 6);
    ctx.restore();
  }

  _drawParticles() {
    const ctx = this._ctx;
    ctx.save();
    for (const p of this._particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.85;
      ctx.fillStyle   = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ── Register ───────────────────────────────────────────────────────────────
PackageRegistry.registerEffect(new PacManEffect());
