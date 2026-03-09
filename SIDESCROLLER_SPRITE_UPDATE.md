# SideScroller Sprite Update — Task Checklist

## Summary

Replace all procedural pixel-art drawing in `SideScrollerEffect.js` with sprite-data-driven
rendering using the JSON save files from the pixel-art editor. Only hero, enemies, and boss
are being updated. Bushes/trees/clouds are untouched.

### Key Facts
- **Hero** faces RIGHT (sprites naturally face right — no flip needed)
- **Enemies** face LEFT (sprites naturally face left — no flip needed)
- **Enemy pool**: `['imp', 'wolf', 'harpy', 'boar']` — goblin, slime, mimic REMOVED
- **Boss pool**: `['ogre']` — orc, blob, troll REMOVED
- **Sprite scale**: 1:1 (1 pixel-art cell = 1 screen pixel)
- **Loading method**: `fetch('./sprites/<name>.json')` from renderer (files copied there)

### Sprite Dimensions (bounding box at 1:1 scale)
| Sprite     | Frames | Width | Height | Notes               |
|------------|--------|-------|--------|---------------------|
| heroWalk   | 5      | 60    | 86     | walk animation      |
| heroAttack | 5      | 96    | 117    | slash/attack        |
| heroLoop   | 5      | 96    | 117    | idle loop           |
| impLoop    | 6      | 83    | 75     | enemy, flying       |
| wolfLoop   | 6      | 82    | 57     | enemy, ground       |
| harpyLoop  | 6      | 54    | 75     | enemy, flying       |
| boarLoop   | 4      | 76    | 45     | enemy, ground       |
| ogreLoop   | 2      | 70    | 75     | boss idle           |
| ogreAttack | 6      | 104   | 75     | boss attack/swipe   |

### Hero State → Sprite Map
- `'walk'` → heroWalk frames (cycling)
- `'idle'` → heroLoop frames (cycling)
- `'slash'` → heroAttack frames (cycling)
- `'dying'` → heroLoop frame 0 (tilt effect applied)
- `'dead'` → nothing drawn

### Boss State → Sprite Map
- `'walk_in'`, `'pause'`, `'idle'`, `'roar'`, `'victory'` → ogreLoop frames
- `'swipe'` → ogreAttack frames

### Enemy Y Positions (feet at groundY - 3)
- imp: flying, offset up by 30px → y = groundY - 3 - 75 - 30
- wolf: y = groundY - 3 - 57
- harpy: flying, offset up by 30px → y = groundY - 3 - 75 - 30
- boar: y = groundY - 3 - 45

---

## Checklist

- [x] **Step 1**: Create `src/renderer/sprites/` directory and copy the 9 required JSON files there
- [x] **Step 2**: Add sprite-loading system to `SideScrollerEffect` (async fetch + OffscreenCanvas pre-render)
- [x] **Step 3**: Update `ENEMY_TYPES` and `BOSS_TYPES` static constants
- [x] **Step 4**: Replace `_drawHero` / `_drawHeroBody` with sprite-based rendering
- [x] **Step 5**: Replace `_drawEnemy` and all `_drawEnemy_*` methods with sprite-based rendering
- [x] **Step 6**: Replace `_drawBoss` and all `_drawBoss_*` methods with ogre sprite rendering
- [x] **Step 7**: Update `_spawnEnemy()` heights and `_startBossPhase()` boss height for new sprites
- [x] **Step 8**: Update `_spawnDeathParticles()` to remove dead enemy types
- [x] **Step 9**: Update dev hotkeys — remove orc/blob/troll, just ogre
- [x] **Step 10**: Remove old color palette constants and dead `_drawBoss_*` / `_drawEnemy_*` methods
