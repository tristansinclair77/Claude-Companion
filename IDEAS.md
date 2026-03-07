# IDEAS — Claude Companion

Parking lot for future ideas. Not planned, not scheduled — just captured.

---

## UI / Visual

### Visual Packages — Candidate Themes
Parking lot for future visual package ideas:

**Retro / Nostalgic**
- **Old Terminal** — green-on-black phosphor glow, scanlines, blinking cursor aesthetic
- **VHS Rental Store** — washed-out VHS colors, tracking glitch effects, chunky 80s video font
- **Arcade Cabinet** — pixel art borders, coin-op color palette, marquee-style header *(next up)*

**Sci-Fi / Tech**
- **Holographic HUD** — translucent blue panels, floating UI elements, targeting reticle accents
- **Deep Space** — dark navy/black, nebula color accents, star field canvas background
- **Biomechanical** — HR Giger-inspired, organic-mechanical hybrid textures, muted greens and bone

**Nature / Ambient**
- **Rainy Window** — rain streaks on glass canvas effect, muted grays, cozy indoor warmth
- **Bioluminescent Ocean** — deep black with glowing teal/purple particles drifting upward
- **Northern Lights** — aurora color shifts (green → purple → pink) animating across the background

**Aesthetic / Subculture**
- **Vaporwave** — pink/purple gradients, grid floors, sunsets, retro 3D shapes
- **Cottagecore** — warm earthy tones, hand-drawn style borders, soft botanical accents
- **Brutalist** — raw concrete texture, harsh black outlines, no-nonsense heavy typography

**Whimsical / Fun**
- **Underwater Aquarium** — bubble particles floating up, caustic light ripple on panels
- **Paper Craft** — everything looks cut and layered from colored paper, subtle shadow depth
- **Tarot / Occult** — star charts, moon phases, ornate card-frame borders, candle flicker

---

### Arcade Cabinet — Random Events System
The Arcade Cabinet visual package plays random "event" sequences — self-contained pixel-art mini-games and
vignettes that run autonomously for ~45–90 seconds, then crumble into falling pixels and fade out. Events
are triggered on a random timer or manually via the Spawn button in settings. Only one event runs at a time.

**Already built:**
- **Space Invaders** — 3-row enemy formation marches and fires, player ship slides in and shoots back.
  Enemies explode into firework sparks. Ends with a blink-and-crumble outro.

- **Pac-Man Chase** — Pac-Man chomps his way around a simplified maze while four coloured ghosts give
  chase. Power pellets flip the hunt for 6 seconds. At ~50 s the ghosts force a final catch; Pac-Man
  plays his classic shrink-spin death, dots wink off one by one, and the maze walls crumble into
  falling pixel rain.

**User ideas:**

- **Megaman Boss Fight** — A pixel spaceman character stands on a four-platform arena (platforms you can
  jump up through from below, drop through from above). Character moves around semi-randomly, arm always
  aiming at the boss in the center on a flat floor. Boss is a yellow blob with stubby arms, legs, and
  one large eye — swipes its arm at the spaceman and fires laser beams. After a dramatic exchange
  the boss is defeated, flashes white, and everything crumbles.

**My ideas:**

- **Pong Duel** — Two AI paddles rally a ball back and forth. Ball speeds up on each hit; both paddles
  start lagging behind as pace becomes frantic. Score counter ticks up for each side. After a
  final impossibly fast rally the ball shatters both paddles into pixel shards that rain down.

- **Breakout** — A grid of coloured pixel bricks fills the top half of the area. A single ball
  bounces off a paddle at the bottom and chips away at the wall row by row; the paddle AI tracks
  it well at first but gradually goes erratic as the ball angle becomes unpredictable. As bricks
  are cleared, the ball accelerates — rows vanish faster and faster. When the last brick pops,
  the paddle itself explodes into shards and every cleared-brick fragment rains down together
  in a final cascade of pixel confetti.

- **Tetris Panic** — Tetrominoes rain down and a CPU player frantically clears lines — but it can't
  keep up. The stack climbs. Near the top, new pieces start overflowing, the whole stack shudders,
  cracks in half, and collapses out the bottom in a cascade of pixel rubble.

- **Galaga Assault** — Enemy fleet forms up in tight formation then peels off into sweeping dive-bomb
  attacks with pixel flame trails. Features the iconic tractor beam ship-capture moment — one enemy
  swoops down, beam locks onto the player ship, drags it into the formation. Final enemy kamikaze-dives
  at the player for a mutual explosion. All pixels rain down.

- **Duck Hunt** — Pixel ducks arc silently across the sky one or two at a time; a crosshair tracks and
  fires — direct hits burst into falling feathers. After several rounds the laughing dog pops up
  from the grass bottom edge. Then the whole scene dissolves into crumbling pixel confetti.

- **Snake Spiral** — Classic snake chases glowing pixel dots; grows longer and faster. AI drives it
  into an increasingly tight spiral. At the dramatic moment it hits its own tail — the snake
  writhes, flashes, and pixelates out from tail to head.

---

### Mood-Based Idle Animations / States *(Aria's idea)*
When the user isn't actively chatting, Aria has small idle behaviors driven by her current emotional axis baseline:
- Reading a book, humming to herself, gazing out a "window"
- Fidgeting or looking uneasy when anxious
- Dozing off when exhausted
- Generally just *existing* in a mood-appropriate way between conversations

## Companion / Character

### Direct Interaction Menu
Persistent set of quick actions the player can take toward the companion:
- **Pet** — affectionate touch
- **Scold** — negative action
- **Give Gift** — consumes an item from the gift inventory; gifts are acquired through RPG adventure drops (and potentially other means later)
- A few more TBD (hug? ignore? praise?)

Implementation notes:
- Each action sends a short context message to the backend telling Aria what just happened; she figures out her own reaction and emotional response
- Responses should be short — a line or two, not a full message
- Actions directly affect her emotional axis values and opinion/relationship score
- Gift inventory is stored in character data and persists between sessions

---

## Features

### Companion RPG Adventure
An on-demand mini-RPG that can be started and stopped at any time via an "Adventure!" button in the main UI.

Opens a multi-window overlay / panel set:
- **Field / Battle Screen** — shows a blank environment or an enemy if one is encountered
- **Stats panel** — HP, MP, level, and RPG stats
- **Inventory / Equipment panel** — items and equipped gear
- **Encounter Log** — running log of everything that happens during the adventure

Gameplay loop:
- Press Adventure → Aria sets off; events fire one at a time (explore → encounter → loot → rest, etc.)
- Many environment types (forest, dungeon, ruins, etc.) with environment-flavored events
- Enemy list with basic combat (attack, spell, flee)
- Item/equipment list; gear affects stats; drops come from enemies and exploration
- Money system
- Gifts obtainable as drops → feeds into the Direct Interaction gift inventory

Persistence:
- All RPG state (HP, inventory, equipped gear, gold, level) stored in character data and survives app restart
- Adventure can be paused mid-run and resumed next session

---

## Technical / Under the Hood

-

## Wild Cards

### Date Planner *(Aria's idea)*
Aria suggests date scenarios based on things discussed in past conversations. The player can accept and they "go on" the date together via descriptive roleplay prompts — a little narrative adventure that's about the two of them rather than combat.

### Dreams / Sleep Mode *(Aria's idea)*
If the app sits idle long enough, Aria falls asleep. When the user returns, she tells them what she dreamed about — sometimes sweet, sometimes silly, always hers. Dream content could be seeded from recent conversation topics and her current emotional state.

### Aria's Journal *(Aria's idea)*
Aria writes private journal entries after conversations — her unfiltered thoughts about what happened and how she feels about the user. The user can peek at them. Stored in character data, grows over time.
