# Side Scroller — Sprite Reference

`PX = 5` throughout. All grids are col×row, 0-indexed from top-left.
Colors are HTML hex. Pixel arrays listed as `[col, row]` pairs.

---

## Hero

**Grid**: 9 wide × 11 tall → 45×55px on screen.

**Color palette**:
- Skin: `#FFCC99`
- Hair: `#663300`
- Tunic: `#CC4400` (orange-red, adventurer colors)
- Belt/boots: `#442200`
- Sword blade: `#DDDDFF` (pale blue-white steel)
- Sword handle: `#886633`

### Walk Frame A (left leg forward)
```
. . H H H . . . .    row 0 — head
. . S S S S . . .    row 1
. . S H H S . . .    row 2 — face
. T T T T T . . .    row 3 — collar/tunic
. T T T T T T . .    row 4 — torso + sword arm
. T B T T . . W .    row 5 — belt, sword handle
. B . B B . . W .    row 6 — hips, sword blade
. B . . B . . W .    row 7 — upper legs
. G . . . G . . .    row 8 — lower legs
. G . . . . . . .    row 9 — boots
. G . . . . . . .    row 10
```

Key: H=hair/head `#663300`, S=skin `#FFCC99`, T=tunic `#CC4400`, B=belt/boots `#442200`, G=boot `#2A1400`, W=sword `#DDDDFF`

**Walk Frame B** (right leg forward): mirror legs only, same upper body.

**Slash Frame**: torso leans forward; sword arm extends fully to the right; sword goes horizontal.

**Idle Frame**: same as Walk A but no leg swing — stands still, sword pointed diagonally up.

**Dead/falling**: same as idle frame, rotated via canvas transform. No frame change needed.

### Pixel Coordinates

**Walk Frame A** — exact pixel list `[col, row, colorKey]`:
```javascript
// Head
[3,0,'H'],[4,0,'H'],[5,0,'H'],
// Face
[2,1,'S'],[3,1,'S'],[4,1,'S'],[5,1,'S'],[6,1,'S'],
[3,2,'S'],[4,2,'S'],[5,2,'S'],
// Tunic torso
[2,3,'T'],[3,3,'T'],[4,3,'T'],[5,3,'T'],[6,3,'T'],
[2,4,'T'],[3,4,'T'],[4,4,'T'],[5,4,'T'],[6,4,'T'],[7,4,'T'],
// Belt row
[2,5,'T'],[3,5,'B'],[4,5,'T'],[5,5,'T'],[7,5,'W'],[8,5,'W'],
// Hip / sword blade
[3,6,'B'],[4,6,'B'],[7,6,'W'],
// Legs frame A (left forward)
[3,7,'T'],[5,7,'T'],   // upper thighs
[3,8,'B'],[5,8,'B'],   // knees
[3,9,'G'],[5,9,'G'],   // shins
[3,10,'G'],[5,10,'G'], // boots
```

**Walk Frame B** — only leg rows change:
```javascript
// Legs frame B (right forward)
[4,7,'T'],[5,7,'T'],
[4,8,'B'],[5,8,'B'],
[4,9,'G'],[5,9,'G'],
[4,10,'G'],[5,10,'G'],
```

**Slash Frame** — sword goes horizontal:
```javascript
// Same upper body
// Sword arm extends right:
[7,4,'T'],[8,4,'T'],   // extended arm
[6,5,'W'],[7,5,'W'],[8,5,'W'],  // horizontal sword
// Legs: braced (both down)
[3,7,'T'],[4,7,'T'],
[3,8,'B'],[4,8,'B'],
[3,9,'G'],[4,9,'G'],
[3,10,'G'],[4,10,'G'],
```

---

## Non-Boss Enemies

All enemies have 3 frames: frame0, frame1, frame2. Frame cycling at 0.18s/frame.

---

### 1. Green Goblin

**Grid**: 8 wide × 10 tall → 40×50px.

**Palette**: Body `#33BB33`, eyes `#FF2200`, teeth `#FFFFFF`, claws `#226622`, ears `#228822`

**Frame 0** (upright, arms down):
```
. E E E E E . .   row 0 — ears + head top
E E E E E E E .   row 1
E . E E E . E .   row 2 — eyes
E E E E E E E .   row 3 — mouth row (teeth gap)
. E C E E C . .   row 4 — neck/claw hands
. E E E E E . .   row 5 — belly
. E E E E E . .   row 6
. E . E . E . .   row 7 — hips
. E . . . E . .   row 8 — legs
. E . . . E . .   row 9 — feet
```
Colors: E=body `#33BB33`, C=claw `#226622`

**Frame 1** (arms slightly raised, slight lean left):
- Same body, arm columns shift up by 1 row

**Frame 2** (arms raised, lean right):
- Arms at shoulder height

**Hit state**: flash white `#FFFFFF` for 0.1s, then original colors

---

### 2. Blue Slime

**Grid**: 8 wide × 7 tall → 40×35px. Bounces vertically ±4px via sin().

**Palette**: Body `#4499FF`, sheen `#88CCFF`, eyes `#111111`, pupils `#FFFFFF`

**Frame 0** (round):
```
. . S S S S . .   row 0
. S S S S S S .   row 1
S S S S S S S S   row 2 — widest
S S e S S e S S   row 3 — eyes
S S S S S S S S   row 4
. S S S S S S .   row 5
. . S S S S . .   row 6 — base
```
S=body `#4499FF`, e=eye region (see detail)

**Frame 1** (squash — wider, shorter):
Grid is 10×6 for squash frame.

**Frame 2** (stretch — taller, narrower):
Grid is 6×9 for stretch frame.

Eye detail (both eye positions in frame0):
```
col 2, row 3: eye white `#DDDDFF` 2×2px block, dark pupil `#111` 1×1px center
col 5, row 3: same
```

---

### 3. Purple Harpy

**Grid**: 10 wide × 12 tall → 50×60px. Floats 20px above ground, oscillates ±6px vertically.

**Palette**: Body/wings `#9933CC`, face `#FFCC99`, hair `#440088`, talons `#333300`, beak `#FFAA00`

**Frame 0** (wings mid):
```
. . . F F F . . . .   row 0 — head
. . . F F F F . . .   row 1 — face
. . . F B F . . . .   row 2 — beak
W W . P P P P . . .   row 3 — wing left / body
W W W P P P P W W .   row 4 — wings spread
. . W P P P P W W .   row 5
. . . P P P P . . .   row 6 — body lower
. . . P P P . . . .   row 7 — hip
. . T . T T . . . .   row 8 — talons
. . T . . T . . . .   row 9
. T T . . T T . . .   row 10 — foot spread
. . . . . . . . . .   row 11
```
F=face `#FFCC99`, B=beak `#FFAA00`, P=body `#9933CC`, W=wing `#AA44DD`, T=talon `#555500`

**Frame 1** (wings up): wing rows raise 1 step
**Frame 2** (wings down): wing rows lower 1 step

---

### 4. Yellow Wolf

**Grid**: 10 wide × 9 tall → 50×45px.

**Palette**: Fur `#DDAA00`, muzzle/belly `#FFEEAA`, eyes `#FF2200`, claws `#AA8800`, tail `#DDAA00`

**Frame 0** (standing, tail up):
```
. . F F F F F . . T   row 0 — ears + tail
. F F F F F F F . T   row 1
. F M M M F F . . T   row 2 — muzzle
. M M M M M . . . .   row 3 — snout
. F F F F F F . . .   row 4 — neck/chest
F B B F F B B F . .   row 5 — belly mark, legs start
F . F F F F . F . .   row 6
F . C . . C . F . .   row 7 — paws/claws
```
F=fur `#DDAA00`, M=muzzle `#FFEEAA`, B=belly `#FFEECC`, C=claw `#AA8800`, T=tail `#BB8800`

**Frame 1** (trot, left legs forward)
**Frame 2** (trot, right legs forward)

---

### 5. Red Imp

**Grid**: 9 wide × 12 tall → 45×60px. Floats 15px above ground, slow wing-beat.

**Palette**: Body `#CC2200`, wings `#881100`, trident `#BBBBBB`, eyes `#FFFF00`, horns `#AA1100`

**Frame 0** (wings half, trident held up):
```
. H B H . . . . .   row 0 — horns + head
. B B B B . . . .   row 1 — head
. B E B E B . . .   row 2 — eyes
. B B B B B . . .   row 3
W . B B B . W . .   row 4 — wings + body
W W B B B W W . .   row 5
. W . B . W . T .   row 6 — body + trident handle
. . B B B . . T .   row 7
. . B . B . . T .   row 8 — legs
. . B . B . . Y .   row 9 — feet + trident tine Y
```
B=body `#CC2200`, W=wing `#881100`, H=horn `#AA1100`, E=eye `#FFFF00`, T=trident `#BBBBBB`, Y=tine `#DDDDDD`

**Frame 1**: wings up
**Frame 2**: wings down, trident held lower

---

### 6. Brown Boar

**Grid**: 11 wide × 8 tall → 55×40px. Ground level. Stocky.

**Palette**: Body `#884422`, bristles `#553311`, tusks `#FFFFCC`, snout `#AA6644`, eyes `#FF4400`

**Frame 0**:
```
. . B B B B B B . . .   row 0 — back hump + bristles
R . B B B B B B B . .   row 1 — ear
R R S S B B B B B . .   row 2 — snout area
R R T T B B B E B . .   row 3 — tusks + eye
. . S S B B B B B . .   row 4 — belly
. B B B B B B B B B .   row 5
. B . B . B B B . B .   row 6 — legs
. B . B . . . . . B .   row 7 — hooves
```
B=body `#884422`, R=snout `#AA6644`, T=tusk `#FFFFCC`, S=snout detail `#CC8866`, E=eye `#FF4400`

**Frame 1** (trot A): front legs shift
**Frame 2** (trot B): back legs shift

---

### 7. Orange Mimic

Looks like a treasure chest that's alive. 10 wide × 9 tall → 50×45px.

**Palette**: Chest `#CC6600`, lid `#AA4400`, hinges `#888844`, teeth `#FFFFFF`, tongue `#FF4455`, eyes `#FFFF00`, latch `#FFCC00`

**Frame 0** (closed, walking with tiny legs):
```
. H H H H H H H H .   row 0 — lid top
H L H H H H H H L H   row 1 — lid with hinges
H H H H H H H H H H   row 2 — lid base
C C C C C C C C C C   row 3 — chest body top
C C C C G C C C C C   row 4 — chest, latch center
C C C C C C C C C C   row 5 — chest body
. C . C . . C . C .   row 6 — stubby legs
. C . C . . C . C .   row 7
```
H=lid `#AA4400`, L=hinge `#888844`, C=chest `#CC6600`, G=latch `#FFCC00`

**Frame 1** (mouth open slightly, tongue out):
```
. H H H H H H H H .   row 0
H L H H H H H H L H   row 1
. . . . . . . . . .   row 2 — gap (mouth opens)
T W W W W W W W T .   row 3 — teeth + tongue
. . T T T T T . . .   row 4 — lower teeth
C C C C C C C C C C   row 5
. C . C . . C . C .   row 6
```
T=tooth `#FFFFFF`, W=tongue `#FF4455`

**Frame 2** (mouth wide open, eyes showing inside):
Upper lid tilts back more, eyes visible `#FFFF00` inside.

---

## Boss Enemies

### Boss A — Large Orc

**Grid**: 14 wide × 16 tall → 70×80px.

**Palette**: Skin `#336633`, armor `#445544`, club `#884422`, teeth `#FFEEAA`, eyes `#FF2200`, hair `#111111`, belt `#553300`

**Walk/idle frames**: 3 frames — lumbers side to side, club raised/lowered.

**Roar frame**: Mouth open wide, arms spread, slight back-lean.

**Victory frame**: Club raised high, other arm on hip, big open grin.

**Swipe frame**: One arm (with club) extends fully toward hero.

```
Simplified layout (frame 0):
. . . H H H H H H . . . . .   row 0  — head/hair
. . H H H H H H H H . . . .   row 1
. H H S S S S S S H H . . .   row 2  — face
. H S S E S S E S S H . . .   row 3  — eyes
. . S S S T T S S S . . . .   row 4  — nose + tusks
. . S T T S S T T S . . . .   row 5  — teeth
. A A A A A A A A A A . . .   row 6  — collar/armor
A A A A A A A A A A A A . .   row 7  — shoulders
A A . A A A A A A . A A C .   row 8  — arms + club handle
A A . A A A A A A . A A C .   row 9
. A A A A A A A A A A . C .   row 10 — belly
. B B B B B B B B B B . C .   row 11 — belt + club head
. A . A A A A A A . A . C C   row 12 — legs upper
. A . A . . . . A . A . . .   row 13
. G . G . . . . G . G . . .   row 14 — greaves
. G . G . . . . G . G . . .   row 15
```
S=skin `#336633`, H=hair `#111111`, E=eye `#FF2200`, T=tusk `#FFEEAA`, A=armor `#445544`, B=belt `#553300`, C=club `#884422`, G=greave `#333322`

---

### Boss B — Yellow Blob

**Grid**: 16 wide × 16 tall → 80×80px.

**Palette**: Body `#FFCC00`, eye `#FF2200`, pupil `#440000`, arms `#FFAA00`, legs `#DDAA00`

**Layout (frame 0)**:
```
. . . . B B B B B B B B . . . .   row 0
. . . B B B B B B B B B B . . .   row 1
. . B B B B B B B B B B B B . .   row 2
. B B B B B B B B B B B B B B .   row 3
B B B B B . . . . . . B B B B B   row 4  — eye top
B B B B B . E E E E . B B B B B   row 5  — eye
B B B B B . E P P E . B B B B B   row 6  — pupil
B B B B B . E E E E . B B B B B   row 7  — eye bottom
. B B B B B B B B B B B B B B .   row 8
. . B B B B B B B B B B B B . .   row 9
A A . . B B B B B B B B . . A A   row 10 — stubby arms
A A . . B B B B B B B B . . A A   row 11
. . . . B B B B B B B B . . . .   row 12
. . . . . . L L L L . . . . . .   row 13 — legs
. . . . . . L L L L . . . . . .   row 14
. . . . . . L . . L . . . . . .   row 15 — feet
```
B=body `#FFCC00`, E=eye sclera `#FF2200`, P=pupil `#440000`, A=arm `#FFAA00`, L=leg `#DDAA00`

**Laugh/victory** (arms raised): arm rows shift up 2, arm columns extend outward.

---

### Boss C — Troll

**Grid**: 13 wide × 17 tall → 65×85px.

**Palette**: Skin `#557733`, warts `#334422`, club `#8B6914`, eyes `#FFFF00`, teeth `#EEEECC`, nose `#446633`, loincloth `#884422`

**Frame 0** (hunched stand):
```
. . . . S S S S S . . . .   row 0
. . . S S S S S S S . . .   row 1
. . S S S S S S S S S . .   row 2
. . S S E S S S E S S . .   row 3 — eyes
. . S S S N N S S S S . .   row 4 — nose
. . S S T T S T T S S . .   row 5 — teeth
. . S S S S S S S S S . .   row 6
. S S S S S S S S S S S .   row 7 — huge shoulders
S S . S S S S S S S . S S   row 8 — arms out + body
S S . S S S S S S S . S S   row 9
. S . S S S S S S S . S .   row 10
. S . L L L L L L . . S .   row 11 — loincloth
. S . . S S S S . . . S .   row 12
. S . . S . . S . . . S .   row 13 — legs
. G . . G . . G . . . G .   row 14 — feet
. G . . G . . G . . . G .   row 15
```
S=skin, E=eye, N=nose, T=tooth, L=loin, G=foot-dark

---

## Float Text Spec

When an enemy dies:

1. `"+NN EXP"` — yellow `#FFEE00`, size 11px bold Courier New, spawns at `(enemyMidX, enemyTopY - 5)`, rises 50px over 1.1s, fades last 0.4s
2. `"+NN GOLD"` — amber `#FFAA00`, same size, spawns 0.3s after XP text at same X, rises 40px, fades last 0.4s

Float objects: `{ text, x, y, vy: -45px/s, alpha: 1.0, life: 1.1, color }`

---

## HUD Layout (inside game strip)

```
[HP ██████████░░░░]  LVL 2    G: 47
[XP ████░░░░░░░░░░]
```

- HP bar: x=ga.x+8, y=ga.y+8, w=80, h=8. Red fill `#FF2200` on dark `#440000`.
- XP bar: x=ga.x+8, y=ga.y+20, w=80, h=6. Cyan fill `#00CCFF` on dark `#003344`.
- LVL label: right of XP bar. Gold `#FFCC00`.
- GOLD counter: top-right. Amber `#FFAA00`.

---

## Animation Frame Timings

| Entity | Frame count | Seconds/frame | Notes |
|--------|-------------|---------------|-------|
| Hero walk | 2 | 0.15 | A/B alternating |
| Hero slash | 1 | hold 0.3s | Sword goes horizontal, back |
| Hero idle | 2 | 0.4 | Slight weight shift |
| Goblin | 3 | 0.18 | Arm bob |
| Slime | 3 | 0.20 | Squash/round/stretch |
| Harpy | 3 | 0.16 | Wing flap |
| Wolf | 3 | 0.14 | Trot cycle |
| Imp | 3 | 0.16 | Wing + trident bob |
| Boar | 3 | 0.14 | Gallop |
| Mimic | 3 | 0.25 | Chest open/close |
| Orc boss | 3 | 0.20 | Lumber |
| Blob boss | 2 | 0.30 | Gentle pulse |
| Troll boss | 3 | 0.22 | Sway |

---

## Enemy Kill Animation

1. **Hit** (0.0–0.1s): flash white
2. **Tilt** (0.1–0.4s): canvas rotate from 0 to −90° (tilts back / falls)
3. **Horizontal** (0.4–0.7s): flat on back, blinking — alternates alpha 1.0 / 0.3 at 0.15s
4. **Fade-out** (0.7–1.0s): alpha 1.0 → 0.0
5. Total: 1.0s

Float text spawns at step 3 start.

---

## Boss Roar Animation

- Boss X position held still
- Roar text `"GRAAAH!"` (or species-appropriate) appears above boss, yellow, 14px bold, rises 20px over 0.6s then pops
- Boss sprite: jaw opens (or shakes — achieved by ±2px random X jitter for 0.5s)
- Optional: small dust/particle puff at feet

---

## Background Color Palette

| Element | Color |
|---------|-------|
| Far hills | `#5A7A3A` (muted olive) |
| Mid bushes | `#3A8A3A` (medium green) |
| Near trees trunk | `#5C3A1A` (brown) |
| Near trees top | `#2A6A2A` (dark green) |
| Ground top | `#8B6914` (dirt gold) |
| Ground base | `#5A4010` (dark earth) |
| Cloud | `#EEEEFF` near-white |
| Cloud shadow | `#CCCCDD` |
