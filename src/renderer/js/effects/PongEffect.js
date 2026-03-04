'use strict';
/**
 * PongEffect — Arcade Cabinet "PONG" random event.
 * Registered under id 'pong'. Used by: Arcade Cabinet package.
 *
 * States: idle → intro → active → outro → idle
 *
 * Paddle AI behaviour:
 *   drift  — ball moving away from this side: paddle wanders to random spots
 *            anywhere in the arena, like a lost player with no goal.
 *   commit — ball heading toward this side: paddle predicts the intercept
 *            and moves to block it.
 *   Miss (10%): instead of committing when the ball turns toward this side,
 *   the paddle keeps drifting until the ball is only 28% of the arena width
 *   away — by then it physically cannot reach the intercept from most
 *   wander positions at normal paddle speed.
 */
class PongEffect extends VisualEffect {

  // ── Tuning ────────────────────────────────────────────────────────────────
  static ACTIVE_DURATION    = 50;    // seconds of normal play
  static PADDLE_W           = 10;
  static PADDLE_H           = 52;
  static PADDLE_MAX_SPEED   = 310;   // px/s — commit speed
  static PADDLE_DRIFT_SPEED = 130;   // px/s — wander speed
  static BALL_SIZE          = 8;
  static BALL_SPEED_INIT    = 340;   // px/s first serve
  static BALL_SPEED_MAX     = 540;   // hard cap — paddles can still intercept
  static BALL_SPEED_PER_HIT = 0.07;  // fractional speed gain per hit
  static OUTRO_DURATION     = 4.5;
  static OUTRO_SPEED_MULT   = 2.8;
  static MISS_BLINK_DUR     = 0.8;   // blink duration after a point, then reset
  static MISS_CHANCE        = 0.10;  // base miss chance at low ball speed
  static MISS_GUARANTEE_SPD = 440;   // above this px/s paddles always miss

  constructor() {
    super('pong');
    this._canvas         = null;
    this._ctx            = null;
    this._rAF            = null;
    this._state          = 'idle';
    this._t              = 0;
    this._lastTs         = 0;

    this._ball           = null;
    this._paddles        = null;
    this._scores         = [0, 0];
    this._particles      = [];
    this._crumbleStarted = false;
    this._blinkVis       = true;
    this._inMiss         = false;
    this._missT          = 0;
    this._fastLoser      = null;   // 'left' | 'right' — designated loser in fast rally
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get busy() { return this._state !== 'idle'; }

  spawn() {
    if (!this._initCanvas()) return;
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._buildScene();
    this._state          = 'intro';
    this._t              = 0;
    this._lastTs         = 0;
    this._blinkVis       = true;
    this._crumbleStarted = false;
    this._inMiss         = false;
    this._missT          = 0;
    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  _onStart(config) { this._initCanvas(); }

  _onStop() {
    if (this._rAF) { cancelAnimationFrame(this._rAF); this._rAF = null; }
    this._state = 'idle';
    if (this._ctx && this._canvas)
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  // ── Canvas ────────────────────────────────────────────────────────────────

  _initCanvas() {
    if (this._canvas) return true;
    this._canvas = document.getElementById('bg-pong');
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
    return { x: r.left + 8, y: r.top + 8, w: r.width - 16, h: r.height - 16 };
  }

  // ── Scene setup ───────────────────────────────────────────────────────────

  _buildScene() {
    const ga    = this._gameArea();
    const cx    = ga.x + ga.w / 2;
    const cy    = ga.y + ga.h / 2;
    const PW    = PongEffect.PADDLE_W;
    const PH    = PongEffect.PADDLE_H;
    const inset = 14;

    const makePaddle = (startX, targetX) => ({
      x: startX, y: cy - PH / 2, w: PW, h: PH, targetX,
      // AI state
      aiMode:     'drift',      // 'drift' | 'commit'
      aiTargetY:  ga.y + Math.random() * (ga.h - PH),  // initial random wander spot
      aiWanderT:  Math.random() * 0.3,  // stagger first wander picks between paddles
      aiCommitT:  -1,           // ≥0: countdown (s) until we switch to commit; -1=off
      aiPredictT: 0,            // in commit: countdown to next intercept prediction refresh
      aiDecided:  false,        // have we rolled for this ball approach
      aiWillMiss: false,        // will deliberately react too late this approach
    });

    this._paddles = {
      left:  makePaddle(ga.x - PW - 8,   ga.x + inset),
      right: makePaddle(ga.x + ga.w + 8, ga.x + ga.w - inset - PW),
    };

    const angle = this._launchAngle();
    const spd   = PongEffect.BALL_SPEED_INIT;
    this._ball = {
      x: cx, y: cy + (Math.random() - 0.5) * ga.h * 0.35,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      size: PongEffect.BALL_SIZE,
    };

    this._scores         = [0, 0];
    this._particles      = [];
    this._crumbleStarted = false;
  }

  /** Always launches with ±15°–50° vertical component so vy is never trivially tiny. */
  _launchAngle() {
    const base    = Math.random() < 0.5 ? 0 : Math.PI;
    const MIN_ANG = Math.PI * 0.083;
    const MAX_ANG = Math.PI * 0.28;
    const mag     = MIN_ANG + Math.random() * (MAX_ANG - MIN_ANG);
    return base + (Math.random() < 0.5 ? 1 : -1) * mag;
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  _tick(ts) {
    if (this._state === 'idle') { this._rAF = null; return; }
    if (this._lastTs === 0) this._lastTs = ts;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.10);
    this._lastTs = ts;
    this._t += dt;

    const ga = this._gameArea();
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    switch (this._state) {
      case 'intro':  this._updateIntro(dt, ga);  break;
      case 'active': this._updateActive(dt, ga); break;
      case 'outro':  this._updateOutro(dt, ga);  break;
    }

    this._rAF = requestAnimationFrame(ts => this._tick(ts));
  }

  // ── Phase: intro ──────────────────────────────────────────────────────────

  _updateIntro(dt, ga) {
    const slide = 430 * dt;
    for (const pd of [this._paddles.left, this._paddles.right]) {
      const dx = pd.targetX - pd.x;
      pd.x += Math.sign(dx) * Math.min(Math.abs(dx), slide);
    }
    if (this._t >= 1.5) {
      this._paddles.left.x  = this._paddles.left.targetX;
      this._paddles.right.x = this._paddles.right.targetX;
      this._state = 'active';
      this._t     = 0;
    }
    this._drawScene(ga, false);
  }

  // ── Phase: active ─────────────────────────────────────────────────────────

  _updateActive(dt, ga) {
    if (this._inMiss) {
      this._missT += dt;
      if (Math.floor(this._missT / 0.10) % 2 === 0)
        this._drawScene(ga, false);
      if (this._missT >= PongEffect.MISS_BLINK_DUR) {
        this._inMiss = false;
        this._resetBall(ga);
      }
      return;
    }

    if (this._t >= PongEffect.ACTIVE_DURATION) {
      this._state          = 'outro';
      this._t              = 0;
      this._blinkVis       = true;
      this._crumbleStarted = false;
      const spd    = Math.hypot(this._ball.vx, this._ball.vy);
      const newSpd = Math.min(spd * PongEffect.OUTRO_SPEED_MULT, 2000);
      this._ball.vx = (this._ball.vx / spd) * newSpd;
      this._ball.vy = (this._ball.vy / spd) * newSpd;
      return;
    }

    this._moveBall(dt, ga);
    this._movePaddleAI(dt, ga, this._paddles.left,  true);
    this._movePaddleAI(dt, ga, this._paddles.right, false);
    this._drawScene(ga, true);
  }

  // ── Phase: outro ──────────────────────────────────────────────────────────

  _updateOutro(dt, ga) {
    if (this._t < PongEffect.OUTRO_DURATION) {
      this._moveBall(dt, ga);
      this._movePaddleAI(dt, ga, this._paddles.left,  true,  45);
      this._movePaddleAI(dt, ga, this._paddles.right, false, 45);
      this._blinkVis = Math.floor(this._t / 0.09) % 2 === 0;
      if (this._blinkVis) this._drawScene(ga, true);
      return;
    }

    if (!this._crumbleStarted) {
      this._crumbleStarted = true;
      this._buildCrumble(ga);
    }

    for (const p of this._particles) {
      p.vy += 290 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    }
    this._particles = this._particles.filter(p => p.life > 0 && p.y < this._canvas.height + 20);
    for (const p of this._particles) {
      this._ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.85;
      this._ctx.fillStyle   = p.color;
      this._ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    this._ctx.globalAlpha = 1;

    if (this._particles.length === 0 || this._t > PongEffect.OUTRO_DURATION + 3.5) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._state = 'idle';
    }
  }

  // ── Ball movement ─────────────────────────────────────────────────────────

  _moveBall(dt, ga) {
    const ball = this._ball;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    const hs = ball.size / 2;

    if (ball.y - hs < ga.y) {
      ball.y = ga.y + hs; ball.vy = Math.abs(ball.vy);
      this._jitter(ball, 0.07);
      this._enforceAngleLimits(ball);
    }
    if (ball.y + hs > ga.y + ga.h) {
      ball.y = ga.y + ga.h - hs; ball.vy = -Math.abs(ball.vy);
      this._jitter(ball, 0.07);
      this._enforceAngleLimits(ball);
    }

    const lp = this._paddles.left;
    if (ball.vx < 0 &&
        ball.x - hs <= lp.x + lp.w && ball.x + hs >= lp.x &&
        ball.y + hs >= lp.y         && ball.y - hs <= lp.y + lp.h) {
      ball.x = lp.x + lp.w + hs;
      this._bounceOffPaddle(ball, lp, true);
    }

    const rp = this._paddles.right;
    if (ball.vx > 0 &&
        ball.x + hs >= rp.x      && ball.x - hs <= rp.x + rp.w &&
        ball.y + hs >= rp.y      && ball.y - hs <= rp.y + rp.h) {
      ball.x = rp.x - hs;
      this._bounceOffPaddle(ball, rp, false);
    }

    if (this._state === 'active') {
      if (ball.x < ga.x - 40) { this._scores[1]++; this._startMiss(); }
      else if (ball.x > ga.x + ga.w + 40) { this._scores[0]++; this._startMiss(); }
    }
  }

  _startMiss() {
    this._inMiss = true; this._missT = 0;
    this._fastLoser = null;
    this._ball.vx = 0; this._ball.vy = 0;
    const ga2 = this._gameArea();
    for (const pd of [this._paddles.left, this._paddles.right]) {
      pd.aiMode    = 'drift';
      pd.aiCommitT = -1;
      pd.aiDecided = false;
      pd.aiWillMiss = false;
      pd.aiWanderT  = 0;   // pick a new wander target immediately
      pd.aiTargetY  = ga2.y + Math.random() * (ga2.h - pd.h);
    }
  }

  _bounceOffPaddle(ball, paddle, isLeft) {
    const relY = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
    // Max deflection capped at ±50° so the ball never launches near-vertically
    let angle  = relY * (Math.PI * 0.278);   // ±50° max from horizontal
    const MIN  = Math.PI * 0.10;
    if (Math.abs(angle) < MIN) {
      angle = (angle === 0 ? (Math.random() < 0.5 ? 1 : -1) : Math.sign(angle))
              * (MIN + Math.random() * MIN * 0.6);
    }
    const spd = Math.min(
      Math.hypot(ball.vx, ball.vy) * (1 + PongEffect.BALL_SPEED_PER_HIT),
      PongEffect.BALL_SPEED_MAX
    );
    ball.vx = Math.cos(angle) * spd * (isLeft ? 1 : -1);
    ball.vy = Math.sin(angle) * spd;
    this._jitter(ball, 0.11);
    this._enforceAngleLimits(ball);
  }

  /**
   * Rotate the ball's velocity by a small random angle (±maxRad radians),
   * preserving speed. Prevents perfect periodic diagonal loops.
   */
  _jitter(ball, maxRad) {
    const spd   = Math.hypot(ball.vx, ball.vy);
    if (spd === 0) return;
    const angle = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 2 * maxRad;
    ball.vx = Math.cos(angle) * spd;
    ball.vy = Math.sin(angle) * spd;
  }

  /**
   * Clamp ball angle so it stays between ±18° and ±50° from horizontal.
   * Prevents both the near-horizontal grind AND the near-vertical crawl.
   * Speed is always preserved after clamping.
   */
  _enforceAngleLimits(ball) {
    const spd = Math.hypot(ball.vx, ball.vy);
    if (spd === 0) return;
    const MIN_VY = spd * 0.15;  // sin(~8.6°) — minimum vertical
    const MAX_VY = spd * 0.77;  // sin(~50°)  — maximum vertical
    let vy = ball.vy;
    if (Math.abs(vy) < MIN_VY) {
      vy = (vy >= 0 ? 1 : -1) * (MIN_VY + Math.random() * MIN_VY * 0.4);
    } else if (Math.abs(vy) > MAX_VY) {
      vy = Math.sign(vy) * MAX_VY;
    }
    if (vy !== ball.vy) {
      ball.vy = vy;
      const scale = spd / Math.hypot(ball.vx, ball.vy);
      ball.vx *= scale;
      ball.vy *= scale;
    }
  }

  _resetBall(ga) {
    const spd = Math.min(
      PongEffect.BALL_SPEED_MAX,
      PongEffect.BALL_SPEED_INIT * (1 + (this._t / PongEffect.ACTIVE_DURATION) * 0.3)
    );
    const angle = this._launchAngle();
    this._ball.x  = ga.x + ga.w / 2;
    this._ball.y  = ga.y + ga.h * 0.2 + Math.random() * ga.h * 0.6;
    this._ball.vx = Math.cos(angle) * spd;
    this._ball.vy = Math.sin(angle) * spd;
  }

  // ── Paddle AI ─────────────────────────────────────────────────────────────

  /**
   * Two-mode paddle AI — always in motion, never twitching at a spot.
   *
   * DRIFT (ball moving away):
   *   Paddle wanders freely to random positions anywhere in the arena.
   *   As soon as it arrives within 5 px of its target it picks a new one,
   *   so it is ALWAYS travelling somewhere. No stopping. No twitching.
   *   aiWanderT controls how long before picking the next destination.
   *
   * COMMIT (ball heading toward this side):
   *   Paddle moves at full speed toward the predicted intercept, refreshing
   *   the prediction every 0.12–0.22 s to account for mid-flight bounces.
   *
   * Commit timing (physics-based, varies per rally):
   *   When the ball first turns toward this paddle, we calculate:
   *     tBall   = time for ball to reach our face
   *     tPaddle = time we need to cross from current Y to the intercept
   *     lastMoment = tBall - tPaddle  (latest we can start and still arrive)
   *   Then we pick a random delay in [max(0, lastMoment−1.0), lastMoment],
   *   so sometimes we move early (up to 1 s spare) and sometimes just in time.
   *
   * Miss (10%):
   *   On a miss roll we set delay = lastMoment + 0.12–0.35 s (too late).
   *   The paddle then tries to reach the intercept but physically can't.
   *
   * speedOverride: fixed px/s cap used in outro so paddles are helpless.
   */
  _movePaddleAI(dt, ga, paddle, isLeft, speedOverride = null) {
    const ball       = this._ball;
    const ballToward = isLeft ? ball.vx < 0 : ball.vx > 0;
    const faceX      = isLeft ? paddle.targetX + paddle.w : paddle.targetX;

    // ── Direction-change handling ──────────────────────────────────────────

    if (!ballToward) {
      // Ball turned away — back to free drift; clear this-approach state
      if (paddle.aiMode === 'commit' || paddle.aiCommitT >= 0) {
        paddle.aiMode    = 'commit' === paddle.aiMode ? 'drift' : paddle.aiMode;
        paddle.aiMode    = 'drift';
        paddle.aiCommitT = -1;
        paddle.aiDecided = false;
        paddle.aiWillMiss = false;
        paddle.aiWanderT  = 0;   // pick a new wander target right away
      }
    } else {
      // Ball heading toward us
      if (!paddle.aiDecided) {
        // First frame ball turned our way: make the hit/miss roll and
        // compute how long to keep drifting before committing.
        paddle.aiDecided  = true;
        const ballSpd     = Math.hypot(ball.vx, ball.vy);
        if (ballSpd >= PongEffect.MISS_GUARANTEE_SPD) {
          // Randomly designate one side as loser for this fast rally (once per rally)
          if (this._fastLoser === null) {
            this._fastLoser = Math.random() < 0.5 ? 'left' : 'right';
          }
          paddle.aiWillMiss = isLeft ? this._fastLoser === 'left' : this._fastLoser === 'right';
        } else {
          paddle.aiWillMiss = Math.random() < PongEffect.MISS_CHANCE;
        }
        paddle.aiCommitT  = this._calcCommitDelay(ga, paddle, faceX, paddle.aiWillMiss);
      }

      // Count down commit delay (keep drifting meanwhile)
      if (paddle.aiCommitT >= 0) {
        paddle.aiCommitT -= dt;
        if (paddle.aiCommitT <= 0 && paddle.aiMode === 'drift') {
          paddle.aiMode    = 'commit';
          paddle.aiPredictT = 0;   // predict immediately on first commit frame
        }
      }
    }

    // ── Wander (drift mode) — always moving, never stopping ───────────────

    if (paddle.aiMode === 'drift') {
      const minY    = ga.y;
      const maxY    = ga.y + ga.h - paddle.h;
      const clamped = Math.max(minY, Math.min(maxY, paddle.aiTargetY));
      const nearTarget = Math.abs(paddle.y - clamped) < 5;

      paddle.aiWanderT -= dt;
      if (paddle.aiWanderT <= 0 || nearTarget) {
        // Arrived (or timer expired) — immediately pick a new destination
        // anywhere in the full arena so the paddle is always travelling
        paddle.aiTargetY = ga.y + Math.random() * (ga.h - paddle.h);
        paddle.aiWanderT = 0.25 + Math.random() * 0.45;  // 0.25–0.70 s
      }
    }

    // ── Intercept prediction (commit mode) ────────────────────────────────

    if (paddle.aiMode === 'commit') {
      paddle.aiPredictT -= dt;
      if (paddle.aiPredictT <= 0) {
        const predicted  = this._predictBallY(ga, faceX);
        // Tiny natural jitter so the block isn't always pixel-perfect
        paddle.aiTargetY = predicted - paddle.h / 2
                         + (Math.random() - 0.5) * paddle.h * 0.12;
        paddle.aiPredictT = 0.12 + Math.random() * 0.10;
      }
    }

    // ── Movement ──────────────────────────────────────────────────────────

    const baseSpd      = paddle.aiMode === 'commit'
                         ? PongEffect.PADDLE_MAX_SPEED
                         : PongEffect.PADDLE_DRIFT_SPEED;
    const effectiveSpd = speedOverride ?? baseSpd;

    const minY    = ga.y;
    const maxY    = ga.y + ga.h - paddle.h;
    const clamped = Math.max(minY, Math.min(maxY, paddle.aiTargetY));
    const dy      = clamped - paddle.y;
    paddle.y     += Math.sign(dy) * Math.min(Math.abs(dy), effectiveSpd * dt);
    paddle.y      = Math.max(minY, Math.min(maxY, paddle.y));
  }

  /**
   * Physics-based commit delay.
   *
   * Calculates the latest possible moment the paddle can start moving and
   * still reach the intercept, then picks randomly within [lastMoment−1s, lastMoment].
   * For a miss roll: delays slightly past lastMoment so arrival is impossible.
   */
  _calcCommitDelay(ga, paddle, faceX, willMiss) {
    const ball  = this._ball;
    const absvx = Math.abs(ball.vx);
    if (absvx < 1) return 0;

    // Time for ball to reach this paddle's face
    const tBall = Math.abs(faceX - ball.x) / absvx;

    // Time this paddle needs to travel from its current centre to the intercept
    const interceptY  = this._predictBallY(ga, faceX);
    const paddleMidY  = paddle.y + paddle.h / 2;
    const tPaddle     = Math.abs(paddleMidY - interceptY) / PongEffect.PADDLE_MAX_SPEED;

    // Latest start time that still allows arrival (with a small safety buffer)
    const lastMoment = Math.max(0, tBall - tPaddle - 0.06);

    if (willMiss) {
      // Start after the last possible moment — can't make it
      return lastMoment + 0.12 + Math.random() * 0.23;
    }

    // Normal: random window between "1 second early" and "just barely made it"
    const earliest = Math.max(0, lastMoment - 1.0);
    return earliest + Math.random() * (lastMoment - earliest);
  }

  /**
   * Predict ball Y at targetX using periodic wall-bounce reflection.
   * Exact result for any number of bounces, no iteration needed.
   */
  _predictBallY(ga, targetX) {
    const ball = this._ball;
    if (ball.vx === 0) return ball.y;
    const t = (targetX - ball.x) / ball.vx;
    if (t < 0) return ball.y;
    let relY = (ball.y + ball.vy * t) - ga.y;
    const h  = ga.h;
    relY = ((relY % (2 * h)) + 2 * h) % (2 * h);
    if (relY > h) relY = 2 * h - relY;
    return ga.y + relY;
  }

  // ── Crumble ───────────────────────────────────────────────────────────────

  _buildCrumble(ga) {
    const addPaddle = (pd) => {
      for (let py = 0; py < pd.h; py += 4) {
        for (let px = 0; px < pd.w; px += 4) {
          this._particles.push({
            x: pd.x + px + Math.random() * 4, y: pd.y + py + Math.random() * 4,
            vx: (Math.random() - 0.5) * 95,   vy: -65 - Math.random() * 90,
            size: Math.random() < 0.35 ? 4 : 2, color: '#ffee00',
            life: 1.0 + Math.random() * 1.4,   maxLife: 2.4,
          });
        }
      }
    };
    addPaddle(this._paddles.left);
    addPaddle(this._paddles.right);

    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, spd = 50 + Math.random() * 130;
      this._particles.push({
        x: this._ball.x + (Math.random() - 0.5) * 10,
        y: this._ball.y + (Math.random() - 0.5) * 10,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 45,
        size: Math.random() < 0.4 ? 4 : 2, color: '#ffffff',
        life: 1.2 + Math.random() * 1.1, maxLife: 2.3,
      });
    }
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _drawScene(ga, drawBall) {
    const ctx = this._ctx;
    ctx.save();
    ctx.globalAlpha = 0.84;
    ctx.beginPath();
    ctx.rect(ga.x, ga.y, ga.w, ga.h);
    ctx.clip();
    this._drawCenterLine(ctx, ga);
    this._drawScore(ctx, ga);
    this._drawPaddle(ctx, this._paddles.left);
    this._drawPaddle(ctx, this._paddles.right);
    if (drawBall) this._drawBall(ctx);
    ctx.restore();
  }

  _drawCenterLine(ctx, ga) {
    ctx.strokeStyle = 'rgba(255,238,0,0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(ga.x + ga.w / 2, ga.y + 6);
    ctx.lineTo(ga.x + ga.w / 2, ga.y + ga.h - 6);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawScore(ctx, ga) {
    ctx.save();
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,238,0,0.50)';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffee00'; ctx.shadowBlur = 6;
    const qw = ga.w / 4;
    ctx.fillText(String(this._scores[0]), ga.x + qw,        ga.y + 26);
    ctx.fillText(String(this._scores[1]), ga.x + ga.w - qw, ga.y + 26);
    ctx.restore();
  }

  _drawPaddle(ctx, pd) {
    ctx.fillStyle = '#ffee00';
    ctx.fillRect(Math.round(pd.x), Math.round(pd.y), pd.w, pd.h);
    ctx.fillStyle = 'rgba(255,255,200,0.30)';
    ctx.fillRect(Math.round(pd.x) + 2, Math.round(pd.y) + 2, pd.w - 4, pd.h - 4);
  }

  _drawBall(ctx) {
    const b = this._ball, hs = b.size / 2;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffee00'; ctx.shadowBlur = 6;
    ctx.fillRect(Math.round(b.x - hs), Math.round(b.y - hs), b.size, b.size);
    ctx.shadowBlur = 0;
  }
}

PackageRegistry.registerEffect(new PongEffect());
