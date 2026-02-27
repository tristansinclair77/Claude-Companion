# Aria's Adventure — Visual & Text Effects

Last updated: 2026-02-27
Status: Design / Pre-Implementation

---

## Design Philosophy

Effects should be:
- **Instant-read** — You know what happened before you consciously process it
- **Proportional** — Small events get small effects; legendary drops get full spectacle
- **Non-blocking** — Most effects play WHILE the game continues, not instead of it
- **Themed** — Cyberpunk, anime, digital glitch aesthetic throughout
- **Achievable** — All effects described here are CSS/Canvas/DOM achievable without external libraries

All effects are implemented in `rpg-effects.js` (controller) and `rpg-effects.css` (keyframes/styles).

---

## Effect Categories

1. Combat Events
2. Loot & Drop Events
3. Character Progression Events
4. Zone & Exploration Events
5. Status Effects (visual feedback)
6. Companion / Bond Events
7. Special / Rare Events
8. UI Text Effects
9. Ambient & Idle Effects
10. Prestige & Milestone Events

---

## 1. Combat Events

### 1.1 Enemy Kill — Border Kill Flash
**Trigger:** Enemy HP reaches 0
**Effect:** The entire window border pulses red outward and fades in 400ms
- `box-shadow: 0 0 0 4px rgba(255,30,30,0.9)` → `0 0 0 0px transparent`
- Ease-out timing function, single pulse
- Intensity scales with enemy difficulty (brighter/wider for Elite/Boss)

### 1.2 Player Hit Taken — Red Vignette Pulse
**Trigger:** Player takes damage
**Effect:** Red vignette bleeds in from screen edges, fades over 600ms
- `radial-gradient` overlay element, opacity 0 → 0.4 → 0 on outer 30% of screen
- Scales with damage amount (25% HP hit = 0.6 opacity, 50% HP hit = 0.9 opacity)

### 1.3 Player Critical Hit — Orange Flash + Text
**Trigger:** Player lands a critical hit
**Effect:** Brief orange radial flash + "CRITICAL!" text rises from the hit
- `background: radial-gradient(circle, rgba(255,140,0,0.4), transparent)` — flash 200ms
- "CRITICAL!" text appears at enemy card, rises 30px and fades out over 800ms
- Text style: bold, orange, slight neon glow effect

### 1.4 Enemy Critical Hit on Player — Shake + Dark Red Flash
**Trigger:** Enemy lands a crit on the player
**Effect:** Screen shake (CSS transform: translateX oscillation) + very dark red vignette
- 3-frame shake: left 4px → right 4px → left 2px → center, over 300ms
- Dark red vignette at full opacity (0.6), fades over 800ms

### 1.5 Miss / Dodge — Blue Afterimage Flash
**Trigger:** An attack misses (player or enemy)
**Effect:** Briefly renders a translucent blue ghost of the defending party, then vanishes
- DOM element clone of the avatar, opacity 0.4 blue tinted, shifts slightly left, fades in 100ms out in 400ms
- "MISS!" or "DODGE!" text in blue, rises from the defender position

### 1.6 Boss Encounter — Dramatic Intro
**Trigger:** Boss room is entered
**Effect:**
- Screen dims to 20% brightness over 800ms
- Red vignette crawls in from all edges simultaneously
- Boss name renders centered in large text with neon red glow, holds 1.5 seconds
- Screen brightens back, combat begins
- Combat log entry: big bold "⚠ BOSS ENCOUNTER ⚠" in red

### 1.7 Stun Applied — Electric Crackle
**Trigger:** Stun status applied to an enemy
**Effect:** Yellow electric arc lines (CSS borders + pseudo-elements) pulse around the enemy card 2×

### 1.8 Bleed Applied — Red Drip Animation
**Trigger:** Bleed applied to enemy or player
**Effect:** Small red droplet CSS elements appear at top of the target's card, "drip" downward and fade

### 1.9 Aria Assist — Cyan Pulse from Portrait
**Trigger:** Companion assist triggers
**Effect:** Cyan/teal glow radiates outward from the companion portrait area
- `box-shadow` on portrait: 0 → `0 0 25px 10px rgba(0,220,220,0.7)` → 0, over 600ms
- Companion portrait briefly switches to its "combat/excited" emotion frame

### 1.10 Enemy Enrage — Red Aura Activation
**Trigger:** Boss hits 50% HP and triggers Enrage
**Effect:** Pulsing red aura appears around enemy card, stays until end of fight
- Continuous low-frequency pulse animation (CSS keyframes) on border-color cycling red → dark red

### 1.11 Player Attack Animation — Slash Line
**Trigger:** Player attacks
**Effect:** A single diagonal slash line (thin, white or weapon-color) crosses the enemy card and fades in 200ms
- Different shapes per weapon type: straight line (sword), arc (scythe), dot+line (pistol), wave (whip)

---

## 2. Loot & Drop Events

### 2.1 Common Drop — Simple Item Card Appear
**Trigger:** Common item drops
**Effect:** Item card slides in from right, gray border, no special animation
- Standard CSS slide-in transition, 300ms ease

### 2.2 Uncommon Drop — Green Shimmer
**Trigger:** Uncommon item drops
**Effect:** Item card slides in with a brief green shimmer sweep across it (left to right, 400ms)
- CSS `background: linear-gradient(90deg, transparent, rgba(0,200,100,0.3), transparent)` animation

### 2.3 Rare Drop — Blue Glow Pulse
**Trigger:** Rare item drops
**Effect:** Item card appears with pulsing blue outer glow, holds for 1.5 seconds then settles
- `box-shadow: 0 0 0 2px rgba(50,120,255,0.9)` pulsing twice then fading to subtle static glow

### 2.4 Epic Drop — Purple Cascade + Sound (UI Bell)
**Trigger:** Epic item drops
**Effect:** Purple sparkle particles cascade from top of screen to land on item card
- Particle system: 20–30 small `div` elements, each animated from y:-50px to item position, random x offset, fade on land
- Item card has persistent purple glow border

### 2.5 Legendary Drop — Full Screen Moment
**Trigger:** Legendary item drops
**Effect:** THIS is the big one:
1. Screen dims to 10% for 200ms
2. Background fills with slowly rotating rainbow gradient overlay (0.15 opacity)
3. "LEGENDARY DROP" text sweeps in from left in huge neon orange font
4. Lightning bolt animations (CSS) fire from corners toward item card
5. Item card reveals with a burst animation (scales from 0.1 → 1.1 → 1.0 with bounce)
6. Companion portrait swaps to maximum excitement emotion
7. Entire sequence: ~2.5 seconds total, then settles to item card with persistent animated glow

### 2.6 Set Piece Drop — Color Ring Animation
**Trigger:** A gear set piece drops
**Effect:** Item card is ringed by a rotating glowing border in the set's theme color (defined per set)
- `border-image` or rotating `conic-gradient` animation on the item card border
- Small "SET PIECE" badge on the item card

### 2.7 Shiny Enemy Appears — Purple Vignette Surge
**Trigger:** Shiny enemy spawns
**Effect:**
- Purple vignette surges in from screen edges (deeper than normal effects)
- Electric static texture overlay briefly flickers across the screen (CSS noise filter)
- Shiny enemy name appears with a "✦" prefix and electric purple glow
- Companion portrait shifts to "surprised" or "excited" emotion

### 2.8 Treasure Room — Gold Shimmer
**Trigger:** Treasure room entered
**Effect:** Warm golden light sweeps upward from the bottom of the panel like a sunrise (400ms)
- `background: linear-gradient(0deg, rgba(255,200,0,0.2), transparent)` rising

### 2.9 Gold Drop — Coin Bounce
**Trigger:** Gold collected
**Effect:** Gold amount number briefly bounces (+5px, back) with a golden shimmer, +[amount] appears briefly

---

## 3. Character Progression Events

### 3.1 Level Up — Neon Gradient Vertical Sweep
**Trigger:** Character levels up
**Effect:** THIS is a signature effect:
1. From the bottom of the entire app window, a bright neon gradient (cyan-to-white) sweeps upward across the ENTIRE UI in 700ms
2. As it passes, it leaves a brief rainbow afterglow that fades in the following 300ms
3. "LEVEL UP!" text appears in center screen — enormous, bold, neon white with glow — holds 1s then fades
4. XP bar resets with a satisfying wipe animation
5. Companion portrait swaps to a happy/excited emotion
6. Stat allocation prompt slides up from the bottom of the panel

Implementation: A `position:fixed` overlay div with the gradient, animated with `translateY` from 100vh to -100vh.

### 3.2 Stat Allocated — Stat Number Tick Up
**Trigger:** Player spends a stat point
**Effect:** The stat value ticks upward with a brief counting animation (number rapidly cycles from old to new value over 300ms), then the stat row flashes the stat's color once

### 3.3 Achievement Unlocked — Toast Notification
**Trigger:** Achievement condition met
**Effect:** A toast notification slides in from the top-right:
- Dark background, achievement icon/badge
- Achievement name in bold neon
- Brief 300ms slide-in, holds 3 seconds, slides out
- Small golden glow persists on the achievement name during the hold

### 3.4 Prestige — White Flash Rebirth
**Trigger:** Prestige is activated
**Effect:**
1. Entire screen fills with white (full opacity) in 400ms
2. Holds white for 500ms
3. Fades back to black
4. Interface reloads with the character's Prestige Badge now visible
5. A small animated phoenix/star icon burns next to the character name permanently
6. Brief text: "PRESTIGE [N]" in gold appears center screen as the fade completes

### 3.5 First Legendary Ever — Special Milestone Moment
**Trigger:** Player receives their very first legendary drop
**Effect:** All legendary drop effects PLUS:
- "FIRST LEGENDARY!" banner sweeps in addition to item reveal
- Companion gets a special reaction (uses `first_legendary` scenario key)

### 3.6 Zone Unlocked — Map Expands
**Trigger:** New zone tier unlocked
**Effect:** In the zone selection UI, the new tier zone cards animate in from the edges, glowing briefly with a "NEW" badge

---

## 4. Zone & Exploration Events

### 4.1 New Floor Entry — Scan Line
**Trigger:** Player advances to next floor
**Effect:** A scan line (thin horizontal line) sweeps top-to-bottom across the panel, refreshing the floor display. Like a CRT screen refresh.
- Timing: 300ms sweep

### 4.2 Boss Floor Warning — Countdown Pulse
**Trigger:** Player is about to enter the boss floor (one floor before)
**Effect:** Floor counter pulses red/orange, tooltip "BOSS FLOOR NEXT" appears briefly

### 4.3 Run Extraction — Escape Animation
**Trigger:** Player chooses to extract from a run
**Effect:** Panel briefly shows a "EXTRACTING..." loading bar in green that completes over 800ms, then results screen slides in

### 4.4 Player Death — Desaturate + Static
**Trigger:** Player HP reaches 0 without Iron Will
**Effect:**
1. Screen desaturates to grayscale over 500ms
2. Red static/noise filter pulses across the display (CSS filter: contrast + grain)
3. "RUN ENDED" text in faded red appears
4. Companion portrait switches to "sad" or "concerned" emotion
5. After 2 seconds, results screen (with run summary) slides in

### 4.5 Secret Room Discovered — Hidden Reveal
**Trigger:** Secret room found
**Effect:** Panel briefly flickers as if the secret room is "loading in," then expands with a "SECRET DISCOVERED" text in cyan with a shimmer across the room content

### 4.6 Run Complete — Green Cascade
**Trigger:** Boss defeated, zone cleared
**Effect:** Green light cascades DOWN the panel borders (opposite direction from Level Up), celebrating completion. "ZONE CLEARED" text in green with glow.

---

## 5. Status Effect Visuals

### 5.1 Bleed Active — Red Drip Overlay
Ongoing drip animation on affected character card (subtle, 3-second cycle)

### 5.2 Stun Active — Yellow Static Ring
Yellow electric ring around stunned character card, pulses slowly until stun expires

### 5.3 Blind Active — Blur Effect on Player Actions
Player action buttons get a slight blur (filter:blur(1px)) while Blind is active

### 5.4 Regen Active — Green Pulse
Soft green glow pulsing around the player HP bar while Regen is active

### 5.5 Cursed / Debuffed — Purple Haze
Subtle purple overlay on the affected entity's card, wisps of smoke CSS animation at edges

### 5.6 Barrier Active — Blue Shield Shimmer
Blue transparent shield shimmer on the entity's card, dissipates when barrier is broken

---

## 6. Companion / Bond Events

### 6.1 Bond Level Increase — Heart Burst
**Trigger:** CHA-based bond milestone reached
**Effect:** Small heart icon bursts from companion portrait, expands, fades. Brief warm pink glow on portrait.

### 6.2 Max Bond — Portrait Glow
**Trigger:** Maximum CHA / bond level reached
**Effect:** Companion portrait permanently gains a soft warm glow border (subtle, always-on after this)

### 6.3 Companion Reacts to Rare Drop — Portrait Emote
**Trigger:** Companion scenario response fires on a rare+ drop
**Effect:** Portrait emotion switches, brief starburst animation around portrait border

### 6.4 Companion Damaged (Assist Fail) — Portrait Shake
**Trigger:** Companion takes the hit instead of player (from Synthetic Soul set or Aria's Core)
**Effect:** Portrait briefly shakes (2× left-right), then settles. Brief red tint on portrait (500ms).

---

## 7. Special / Rare Events

### 7.1 Shiny Kill — Sparkle Burst
**Trigger:** Shiny enemy is defeated
**Effect:** Purple sparkle burst at enemy position, multiple particles arcing outward and fading

### 7.2 Set Bonus Activated — Rainbow Border Pulse
**Trigger:** Player equips the piece that completes a 2pc, 4pc, or 6pc set bonus
**Effect:** A brief rainbow rotating border effect fires around the whole panel, "SET BONUS UNLOCKED!" text in the set's color

### 7.3 Chaos Orb Fires — Random Color Flash
**Trigger:** Chaos Orb trinket triggers
**Effect:** Random color flash (picks from: red, blue, green, purple, orange, cyan) washes across the panel briefly

### 7.4 Void Banish (Void Rune) — Implosion Effect
**Trigger:** Void Rune banishes an enemy
**Effect:** Enemy card rapidly shrinks (scale 1 → 0.1) while a void-black circle expands from center and collapses. Enemy gone. Eerie.

### 7.5 Time Crystal Activates — Clock Rewind
**Trigger:** Time Crystal undoes the last hit
**Effect:** Entire panel briefly plays a frame-reverse animation (subtle CSS animation reversing recent transitions), hit damage undone with a white flash

### 7.6 Boss Special Ability — Warning Flash
**Trigger:** Boss uses a special ability
**Effect:** Red warning bar appears at top of combat log "⚠ [BOSS ABILITY NAME]" in orange/red, accompanied by brief border flash

---

## 8. UI Text Effects

### 8.1 Floating Damage Numbers
All damage dealt renders as a floating number above the target, rising and fading over 800ms.
- Player damage: white/yellow
- Enemy damage on player: red
- Crit damage: larger, orange, "!" suffix
- True damage: bright white, "TRUE" tag

### 8.2 XP Gain Number — Cyan Pop
XP gained renders as "+[amount] XP" in cyan at the XP bar position, rises slightly and fades

### 8.3 Gold Gain — Gold Counter Increment
Gold counter ticks up numerically (counting animation) when gold is received, brief gold shimmer

### 8.4 Combat Log Text Effects
- Kill messages: red, bold
- Loot messages: colored by rarity (gray/green/blue/purple/orange)
- Aria assist messages: cyan
- Status effects: yellow/purple based on type
- System messages (floor advance, etc.): gray

### 8.5 Level Number — Sweep In
When level displayed updates, new number sweeps in from the right (CSS translateX), old one sweeps out left

### 8.6 "COMBO x[N]" Display
When combo attacks chain (certain weapons/sets), a combo counter appears in top-right of combat log:
- "x2" in white → "x5" in yellow → "x10" in orange → "x20+" in red with shake
- Counter pulses with each additional hit

### 8.7 Neon Text Flicker (Ambient)
Zone name and some UI labels get a subtle random flicker (opacity 1.0 → 0.95 → 1.0) occasionally, like broken neon signs

---

## 9. Ambient & Idle Effects

### 9.1 CRT Scanlines
The RPG panel has a subtle CRT scanline overlay at all times (2px repeating gradient, 3% opacity)

### 9.2 Idle Companion Breathing
When no action is happening, companion portrait has a very subtle scale pulse (1.0 → 1.01 → 1.0, 3s cycle) simulating breathing

### 9.3 HP Bar Pulse (Low HP)
When player HP is below 20%, the HP bar pulses red slowly (continuous low-opacity glow animation)

### 9.4 Zone Background Flicker
Some zones (Glitch, Corrupted, Void types) have ambient background color flickers on the panel — very subtle, gives life to the zone theme

### 9.5 Typing Effect for Combat Log
New lines in the combat log appear with a brief typing effect (characters appear rapidly left to right, 30ms per character for short lines)

### 9.6 Floating Data Particles (High-Tech Zones)
In tech/AI zones, tiny dots float upward from the panel bottom as ambient animation

---

## 10. Prestige & Milestone Events

### 10.1 Prestige Badge Earned — Flaming Badge
New prestige badge appears with a brief flame/burn animation, then settles as a permanent static icon

### 10.2 100 Kills Milestone — Kill Counter Flash
When total kill count hits a round number (100, 500, 1000...), brief stats flash and "MILESTONE" text appears

### 10.3 First Clear of Zone Tier — Zone Banner
First time a zone tier is fully cleared, a banner sweeps across the screen: "[ZONE NAME] CONQUERED" in that tier's theme color

### 10.4 Ascendant Mode Unlock (Prestige 5) — Dark Mode Shift
When Ascendant Mode unlocks, the entire RPG panel theme shifts: darker background, more intense border colors, companion portrait gets a dark glow

---

## Implementation Notes

### CSS Approach
All effect animations are CSS keyframe animations triggered by JavaScript class additions.
```js
// Example: trigger level up sweep
document.getElementById('rpg-panel').classList.add('effect-levelup');
setTimeout(() => el.classList.remove('effect-levelup'), 1200);
```

### Effect Queue
Effects should queue, not stack. If two effects fire simultaneously, delay the second by 200ms.
A simple array-based queue in `rpg-effects.js` handles this.

### Performance
- Use `will-change: transform, opacity` on frequently animated elements
- Particle effects use pooled DOM nodes (pre-created, reused) to avoid GC pressure
- All animations use `requestAnimationFrame` when JS-driven

### Accessibility
- All effects can be disabled in settings (reduce motion option)
- Critical information is never conveyed ONLY through effects — always backed by text

### Z-Index Layers
```
1000 - Combat log text
2000 - Floating damage numbers
3000 - Full-screen flash effects (level up, legendary)
4000 - Screen overlay effects (vignette, death desaturate)
9999 - Achievement toast notifications
```
