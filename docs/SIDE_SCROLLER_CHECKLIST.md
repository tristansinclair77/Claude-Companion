# Side Scroller V2 — Implementation Checklist

Work through these in order. Check off each item when done.
Reference: `SIDE_SCROLLER_PLAN.md` and `SIDE_SCROLLER_SPRITES.md`.

---

## PHASE 1 — Foundation

- [x] **1.1** Delete the entire body of `SideScrollerEffect.js` and start fresh (keep the `PackageRegistry.registerEffect` call at the bottom)
- [x] **1.2** Define `static PX = 5` at the top of the class
- [x] **1.3** Write `_gameArea()` to return the **bottom strip only** — `h = Math.max(200, Math.min(260, panelH * 0.38))`, `y = panelBottom - h`
- [x] **1.4** Write `_initCanvas()` — same pattern as PongEffect (fixed, full-window canvas, resize listener)
- [x] **1.5** Write constructor state fields: `_state`, `_t`, `_lastTs`, `_hero`, `_enemy`, `_boss`, `_particles`, `_floatTexts`, `_layers`, `_groundY`, `_scrollX`, `_killCount`, `_level`, `_xp`, `_xpTarget`, `_gold`, `_enemyQueue`, `_bossType`
- [x] **1.6** Implement `get busy()` — returns `this._state !== 'idle'`
- [x] **1.7** Implement `_onStart()` and `_onStop()` stubs (cancel RAF, clear canvas)
- [x] **1.8** Implement `spawn()` — calls `_reset()`, sets state to `'intro'`, starts RAF

---

## PHASE 2 — Enemy & Boss Pool (Random, No Repeats)

- [x] **2.1** Define `static ENEMY_TYPES` array: `['goblin','slime','harpy','wolf','imp','boar','mimic']`
- [x] **2.2** Define `static BOSS_TYPES` array: `['orc','blob','troll']`
- [x] **2.3** Write `_buildEnemyQueue()` — Fisher-Yates shuffle of `ENEMY_TYPES`, take first 5; pick 1 random boss from `BOSS_TYPES`; store on `this._enemyQueue` and `this._bossType`

---

## PHASE 3 — Background Layers

- [x] **3.1** Write `_buildLayers(ga)` — calls sub-builders, stores on `this._layers`
- [x] **3.2** Write `_buildFarHills(ga)` — jagged point array, W = ga.w + 400, color `#5A7A3A`, speed 18 px/s
- [x] **3.3** Write `_buildMidBushes(ga)` — ellipse cluster array, W = ga.w + 500, color `#3A8A3A`, speed 38 px/s
- [x] **3.4** Write `_buildNearTrees(ga)` — trunk+crown pair array, W = ga.w + 600, trunk `#5C3A1A`, crown `#2A6A2A`, speed 70 px/s
- [x] **3.5** Write `_buildClouds(ga)` — 4–5 cloud objects `{x, y, w, h}` spread across width, drift speed 12 px/s
- [x] **3.6** Write `_drawBg(ga, dt)` — draws all layers in order (far → near → clouds → ground), advances offsets by `dt` only when `dt > 0`
- [x] **3.7** Write `_drawFarHills(ctx, ga, layer)` — `ctx.beginPath`, polygon fill using point array, tiled with 2 repeats
- [x] **3.8** Write `_drawMidBushes(ctx, ga, layer)` — `ctx.ellipse` clusters, tiled
- [x] **3.9** Write `_drawNearTrees(ctx, ga, layer)` — trunk `fillRect` + crown `fillRect`, tiled
- [x] **3.10** Write `_drawClouds(ctx, ga, layer)` — layered ellipses for puffy look (3 overlapping ellipses per cloud)
- [x] **3.11** Write `_drawGround(ctx, ga)` — flat strip `#8B6914` top strip + `#5A4010` base, horizontal mortar lines every 8px

---

## PHASE 4 — Hero Sprite

- [x] **4.1** Write `_drawHero(ctx, hero)` — dispatches to sub-draw based on `hero.state` and `hero.frame`
- [x] **4.2** Write `_heroPixels_walk(frame)` — returns pixel array for frame 0 (left leg forward) and frame 1 (right leg forward). Uses color keys: `H`=hair, `S`=skin, `T`=tunic, `B`=belt, `G`=boot, `W`=sword-blade, `X`=sword-handle
- [x] **4.3** Write `_heroPixels_slash()` — sword arm extended horizontally, legs braced
- [x] **4.4** Write `_heroPixels_idle(frame)` — 2 frames, subtle weight-shift (one leg slightly bent)
- [x] **4.5** Write color map `_HERO_COLORS` — maps key → hex
- [x] **4.6** Add `hero.dead` branch in `_drawHero` — applies canvas rotation transform based on `hero.deadT` progress (0° → −90° over 0.3s)

---

## PHASE 5 — Enemy Sprites (7 types × 3 frames each)

- [x] **5.1** Write `_drawEnemy(ctx, enemy)` — dispatches to `_drawEnemy_${enemy.type}(ctx, enemy)`; applies flash-white override when `enemy.flashT > 0`; applies tilt rotation when `enemy.state === 'dying'`
- [x] **5.2** Write `_drawEnemy_goblin(ctx, x, y, frame, colors)` — 8×10 grid, 3 frames (arms down, arms mid, arms up)
- [x] **5.3** Write `_drawEnemy_slime(ctx, x, y, frame, colors)` — 8×7 grid, 3 frames (round/squash/stretch), vertical bounce offset via `sin(animT)`
- [x] **5.4** Write `_drawEnemy_harpy(ctx, x, y, frame, colors)` — 10×12 grid, 3 frames (wings mid/up/down), floats 20px above ground
- [x] **5.5** Write `_drawEnemy_wolf(ctx, x, y, frame, colors)` — 10×9 grid, 3 frames (trot A/B/C)
- [x] **5.6** Write `_drawEnemy_imp(ctx, x, y, frame, colors)` — 9×12 grid, 3 frames (wings half/up/down + trident bob), floats 15px above ground
- [x] **5.7** Write `_drawEnemy_boar(ctx, x, y, frame, colors)` — 11×8 grid, 3 frames (gallop A/B/C)
- [x] **5.8** Write `_drawEnemy_mimic(ctx, x, y, frame, colors)` — 10×9 grid, 3 frames (closed/open-slightly/wide-open)
- [x] **5.9** Write `_ENEMY_COLORS` map — one palette object per enemy type

---

## PHASE 6 — Boss Sprites (3 types × 3 frames each)

- [x] **6.1** Write `_drawBoss(ctx, boss)` — dispatches to `_drawBoss_${boss.type}(ctx, boss)`, applies `boss.bobOffset` for victory bob, applies roar-jitter when `boss.roaring`
- [x] **6.2** Write `_drawBoss_orc(ctx, x, y, frame, state, colors)` — 14×16 grid, frames: walk/idle/roar/swipe/victory
- [x] **6.3** Write `_drawBoss_blob(ctx, x, y, frame, state, colors)` — 16×16 grid, frames: pulse A/B, roar (eye wide), swipe (arm extends), victory (arms raised)
- [x] **6.4** Write `_drawBoss_troll(ctx, x, y, frame, state, colors)` — 13×17 grid, frames: sway A/B/C, roar, swipe, victory
- [x] **6.5** Write `_BOSS_COLORS` map

---

## PHASE 7 — Tick Loop & State Machine

- [x] **7.1** Write `_tick(ts)` — standard RAF pattern: compute `dt`, clear canvas, `ctx.save/clip(ga)`, dispatch to `_update_${state}(dt, ga)`, `ctx.restore`, re-queue RAF
- [x] **7.2** Write `_reset()` — calls `_buildLayers`, `_buildEnemyQueue`, initializes hero at left edge, resets all counters, sets `_scrollX = 0`, `_killCount = 0`

---

## PHASE 8 — Phase: intro

- [x] **8.1** Write `_update_intro(dt, ga)` — hero walks right from `ga.x - 50` toward center (`ga.x + ga.w * 0.28`), animate walk frames; NO background scroll yet; draw background static, draw hero, draw HUD
- [x] **8.2** Transition: when `hero.x >= heroTarget` → set state to `'scrolling'`, reset `_t = 0`

---

## PHASE 9 — Phase: scrolling

- [x] **9.1** Write `_update_scrolling(dt, ga)` — main scrolling loop
- [x] **9.2** Implement scroll: `_scrollX += SCROLL_SPEED * dt` (60 px/s); pass `dt` to `_drawBg` so layers advance
- [x] **9.3** Implement enemy advancement: active enemy's `screenX = ga.x + ga.w * 0.72 - (_scrollX - enemy.spawnScrollX)`; enemy is off-screen right until `screenX < ga.x + ga.w`
- [x] **9.4** Implement spawn trigger: when `_scrollX` reaches `enemy.spawnScrollDist`, set enemy as active (pop from `_enemyQueue`)
- [x] **9.5** Implement engage detection: when `enemy.screenX <= heroX + ENGAGE_DIST (70px)` → begin combat
- [x] **9.6** Hero walk animation: advance `hero.animT`, flip frame every 0.15s; ONLY animate when not in combat
- [x] **9.7** Implement boss trigger: after `MIN_KILLS (3)` enemies dead AND queue empty (or after 4th kill) → next spawn is boss
- [x] **9.8** Draw calls: `_drawBg`, `_drawHero`, `_drawEnemy` (if active), `_drawFloatTexts`, `_drawHUD`

---

## PHASE 10 — Combat Sub-State

- [x] **10.1** Write `_startCombat(enemy)` — freeze `_scrollFrozen = true`; set `hero.state = 'slash'`; set `enemy.state = 'hit'`
- [x] **10.2** Write `_updateCombat(dt, ga)` — manages combat timeline:
  - `t=0.0`: hero slash frame (sword horizontal)
  - `t=0.2`: sword returns vertical
  - `t=0.25`: enemy flash white (`enemy.flashT = 0.1`)
  - `t=0.35`: enemy `state = 'dying'`, begin tilt rotation
  - `t=0.65`: enemy horizontal (−90°), begin blink (alt alpha at 0.15s)
  - `t=0.65`: spawn float texts `+NN EXP` and `+NN GOLD`
  - `t=1.05`: enemy fully gone
  - `t=1.05`: increment `_killCount`; add XP/gold to targets; check level-up; `_scrollFrozen = false`; set hero back to `'walk'`
- [x] **10.3** Write enemy tilt rendering — `ctx.save`, `ctx.translate(enemy.cx, enemy.cy)`, `ctx.rotate(tiltAngle)`, draw enemy, `ctx.restore`
- [x] **10.4** Write enemy blink rendering — `ctx.globalAlpha` alternates 1.0 / 0.25 based on `Math.floor(blinkT / 0.15) % 2`

---

## PHASE 11 — Float Texts

- [x] **11.1** Define float text object structure: `{ text, x, y, vy, alpha, life, maxLife, color, size }`
- [x] **11.2** Write `_spawnFloatText(text, x, y, color)` — pushes to `_floatTexts`
- [x] **11.3** Write `_updateFloatTexts(dt)` — advances `y`, decrements `life`, fades alpha in last 0.4s
- [x] **11.4** Write `_drawFloatTexts(ctx)` — renders each text with `globalAlpha`, bold 11px Courier New, `textAlign: 'center'`, yellow shadow

---

## PHASE 12 — Level-Up Sequence

- [x] **12.1** Write `_startLevelUp()` — freeze scroll, set `_levelUpT = 0`, `_levelUpState = 'draining'`
- [x] **12.2** Write `_updateLevelUp(dt, ga)`:
  - `draining`: animate `_xp` from target back to 0 over 0.5s
  - At `t=0.5`: increment `_level`; set `_levelUpState = 'flash'`
  - `flash`: draw `"LVL UP!"` text center of strip, gold, pulses (scale 1.0→1.3→1.0) over 0.7s
  - At `t=1.2`: unfreeze scroll, return to scrolling
- [x] **12.3** Trigger condition: `_killCount >= 3 && _level === 1` (only once)

---

## PHASE 13 — Phase: boss

- [x] **13.1** Write `_startBossPhase(ga)` — create boss object `{ type: _bossType, x: ga.x + ga.w + 10, y: groundY - bossH, state: 'walk_in', bobT: 0, roarT: -1, swipeT: -1 }`
- [x] **13.2** Write `_update_boss(dt, ga)` — scripted sequence:
  - `walk_in`: boss scrolls left until `boss.x <= ga.x + ga.w * 0.65`; background scrolls with it
  - `t=0`: stop scroll; boss stands still; pause 0.4s
  - `t=0.4`: boss `state = 'roar'`; `roarT = 0`; spawn roar text `"GRAAAH!"` above boss
  - `t=0.4–0.9`: boss shakes (±2px X jitter), roar text rises/fades
  - `t=1.1`: boss `state = 'idle'`; pause 0.5s; bob up/down
  - `t=1.6`: boss `state = 'swipe'`; arm pixel extends toward hero over 0.3s
  - `t=1.9`: hero hit — hero `state = 'dying'`; hero death animation (same tilt-fall-blink as enemy)
  - `t=2.9`: hero fully gone; transition to `'game_over'`
- [x] **13.3** Implement boss bob: `boss.y = baseY + Math.sin(boss.bobT * 3) * 4`, `boss.bobT += dt`
- [x] **13.4** Draw roar text above boss at `boss.x + bossW/2`

---

## PHASE 14 — Phase: game_over

- [x] **14.1** Write `_update_game_over(dt, ga)` — draws background static + boss in victory pose
- [x] **14.2** Draw dark red overlay: `ctx.fillStyle = 'rgba(80,0,0,0.55)'`, `fillRect(ga.x, ga.y, ga.w, ga.h)`
- [x] **14.3** Draw `"GAME OVER"` text: bold 24px Courier New, centered horizontally in strip, vertically centered. Blink 4× at 0.25s interval (alt red `#FF2200` / white `#FFFFFF`), then hold dim `#881100`
- [x] **14.4** Boss victory bob: continues during game_over
- [x] **14.5** Transition: at `t >= 3.2` → set state `'outro'`, `_crumbleStarted = false`

---

## PHASE 15 — Phase: outro (Crumble)

- [x] **15.1** Write `_buildCrumble(ga)` — scatter pixels from:
  - Boss sprite pixels (sample every 2nd pixel, keep colors)
  - Ground strip (horizontal band of particles)
  - Tree/bush top portions (sample 30 random positions along each layer)
  - Cloud positions (4–6 white particles per cloud)
- [x] **15.2** Each particle: `vx ∈ [−70, 70]`, `vy ∈ [−140, −10]`, gravity `+280 px/s²`, size 3–5px, life 1.5–2.5s, color from source
- [x] **15.3** Write `_updateParticles(dt)` — advance positions, apply gravity, decrement life
- [x] **15.4** Write `_drawParticles(ctx)` — `globalAlpha = life/maxLife`, `fillRect`
- [x] **15.5** Write `_update_outro(dt, ga)` — builds crumble on first frame, updates+draws particles, transitions to `'idle'` when `particles.length === 0` or `_t > 4.5`

---

## PHASE 16 — HUD

- [x] **16.1** Write `_drawHUD(ctx, ga)` — draws HP bar, XP bar, LVL label, GOLD counter inside game strip top-left/right areas
- [x] **16.2** HP bar: width 80px, height 8px, red fill `#FF2200`, dark bg `#440000`, border `#662200`. Value is binary — full (`_heroHp = 100`) or empty (`_heroHp = 0`)
- [x] **16.3** XP bar: width 80px, height 6px, cyan `#00CCFF` fill, dark bg `#003344`. Fill fraction = `_xp / XP_PER_LEVEL`
- [x] **16.4** LVL label: `"LVL " + _level`, gold `#FFCC00`, 9px bold, right of XP bar
- [x] **16.5** Gold counter: `"G: " + _gold`, amber `#FFAA00`, 9px bold, top-right of strip

---

## PHASE 17 — Particles (General)

- [x] **17.1** Write `_spawnHitParticles(x, y, count, color)` — burst used for slash impact
- [x] **17.2** Write `_spawnDeathParticles(enemy)` — larger burst, uses enemy color palette
- [x] **17.3** Write `_spawnBossRoarParticles(x, y)` — small dust puff at feet


---

## PHASE 18 — Polish & Verification

- [ ] **18.1** Verify clip rect: all drawing stays within `ga` (test by checking nothing bleeds into text area)
- [ ] **18.2** Verify enemy queue: run effect 3+ times, confirm no repeated enemy types within a single run
- [ ] **18.3** Verify boss type: confirm different boss can appear across runs
- [ ] **18.4** Verify scroll stop/resume: scroll freezes during combat, resumes correctly after
- [ ] **18.5** Verify level-up: triggers exactly once after 3rd kill, XP drains to 0, LVL increments
- [ ] **18.6** Verify kill animation: tilt → fall → blink → disappear plays cleanly, float text appears
- [ ] **18.7** Verify boss sequence: roar text shows, swipe hits hero, hero dies same as enemy
- [ ] **18.8** Verify GAME OVER: red overlay, 4× blink, boss continues bobbing
- [ ] **18.9** Verify outro crumble: particles fall and fade, state returns to `'idle'`
- [ ] **18.10** Verify HUD: HP drops to 0 instantly on boss swipe; XP bar resets on level-up
- [ ] **18.11** Verify `get busy()` gates ArcadeAmbient "INSERT COIN" and spawn buttons correctly
- [ ] **18.12** Update `RESUME_INSTRUCTIONS.md` — note sideScroller V2 complete

---

## Total Items: 72
## Completed: 69 / 72
