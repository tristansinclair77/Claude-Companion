# IDEAS — Claude Companion

Parking lot for future ideas. Not planned, not scheduled — just captured.

---

## UI / Visual

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
