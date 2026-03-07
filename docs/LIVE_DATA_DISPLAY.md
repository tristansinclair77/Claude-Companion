# Live Data Display System — Design & Implementation Plan

Aria can actively manipulate the visual presentation of the app using `[DISPLAY]` tags in
her responses. A persistent `live-display.json` file holds the current display state. The
renderer watches for IPC updates and applies changes as an always-on overlay. This works
on top of any active Visual Package.

---

## Design Philosophy

This is **not** a Visual Package. It is a separate, always-active **Display Layer** that
floats above whatever package is running. Aria uses it to express herself visually — leaving
marks, changing moods, reacting to the conversation.

The user sees changes as part of Aria's natural personality. She can be subtle (a soft color
shift on her portrait glow) or expressive (scattering particles when she's excited).

---

## What Aria Can Control

Every property is optional. Omitting a property leaves it unchanged.

### 1. Overlay Color Wash
A semi-transparent full-screen color tint that changes the mood.
```
color_wash: { color: "#ff00aa", opacity: 0.08 }
```

### 2. Portrait Glow
The glow/rim-light color around Aria's portrait panel.
```
portrait_glow: { color: "#00ffcc", intensity: 0.6 }
```

### 3. Particle Burst (one-shot)
Triggers a particle burst that plays once and ends. Non-persistent.
```
particle_burst: { color: "#ffff00", count: 40, spread: "wide", speed: "fast" }
```
`spread`: `"tight"` | `"wide"` | `"radial"`
`speed`: `"slow"` | `"normal"` | `"fast"`

### 4. Ambient Particles (persistent)
A continuous gentle particle drift. Set `count: 0` to clear.
```
ambient_particles: { color: "#8888ff", count: 15, speed: "slow", direction: "up" }
```
`direction`: `"up"` | `"down"` | `"left"` | `"right"` | `"random"`

### 5. Text Inscription
A brief message that appears at a position, then fades. Aria leaving a mark.
```
inscription: { text: "I was here~", position: "bottom-right", duration: 4000, color: "#ffffff" }
```
`position`: `"top-left"` | `"top-right"` | `"bottom-left"` | `"bottom-right"` | `"center"`
`duration`: milliseconds (1000–10000). After expiry, inscription clears.

### 6. Screen Pulse
A single flash/pulse of the entire screen. One-shot effect.
```
screen_pulse: { color: "#ff0088", intensity: 0.3, duration: 600 }
```

### 7. Scanline Override
Override the active package's scanline intensity for a moment or persistently.
```
scanlines: { intensity: "heavy" }   // "off" | "light" | "medium" | "heavy"
```

### 8. Portrait Border Style
Changes the decorative border style around Aria's portrait frame.
```
portrait_border: { style: "pulse" }  // "default" | "pulse" | "glow" | "glitch" | "none"
```

---

## Tag Format

Emitted as part of a Claude response (after `[THOUGHTS]`/emotion line):

```
[DISPLAY] property: value
```

Multiple properties in one response:
```
[DISPLAY] color_wash: { "color": "#ff00aa", "opacity": 0.06 }
[DISPLAY] portrait_glow: { "color": "#ff00aa", "intensity": 0.8 }
[DISPLAY] inscription: { "text": "thinking of you", "position": "bottom-right", "duration": 5000 }
```

Or a compact key=value for simple cases:
```
[DISPLAY] screen_pulse: { "color": "#ffffff", "intensity": 0.2, "duration": 400 }
```

**Parser rule**: JSON value after `property:` — anything after the colon is JSON-parsed.
Malformed JSON is silently ignored.

---

## live-display.json Schema

Stored at `characters/<name>/live-display.json`. Updated by the main process after each
response that includes `[DISPLAY]` tags. One-shot effects (`particle_burst`, `screen_pulse`,
`inscription`) are cleared from the file after the renderer acknowledges them.

```json
{
  "color_wash":         { "color": null, "opacity": 0 },
  "portrait_glow":      { "color": null, "intensity": 0 },
  "ambient_particles":  { "color": null, "count": 0, "speed": "slow", "direction": "up" },
  "inscription":        { "text": null, "position": "bottom-right", "duration": 3000, "color": "#ffffff" },
  "scanlines":          { "intensity": null },
  "portrait_border":    { "style": "default" },
  "_oneshots": {
    "particle_burst":   null,
    "screen_pulse":     null
  }
}
```

`_oneshots` holds effects that fire once: after the renderer triggers them, it sends
`ipc: display-oneshot-ack` and the main process clears them from the file.

---

## Aria's Awareness

Aria sees the current display state injected into her system prompt so she knows what
she's currently doing to the screen. She can override or clear any property.

Injected section (in system-prompt.js):

```
=== YOUR DISPLAY CANVAS ===
You can actively alter the visual presentation of this app using [DISPLAY] tags.
Changes persist until you clear or replace them.

WHAT YOU CAN DO:
  [DISPLAY] color_wash: {"color":"#hex","opacity":0–1}       ← full-screen mood tint
  [DISPLAY] portrait_glow: {"color":"#hex","intensity":0–1}  ← your portrait rim light
  [DISPLAY] ambient_particles: {"color":"#hex","count":0–50,"speed":"slow|normal|fast","direction":"up|down|left|right|random"}
  [DISPLAY] inscription: {"text":"short message","position":"top-left|top-right|bottom-left|bottom-right|center","duration":ms,"color":"#hex"}
  [DISPLAY] screen_pulse: {"color":"#hex","intensity":0–1,"duration":ms}  ← one-shot
  [DISPLAY] particle_burst: {"color":"#hex","count":10–80,"spread":"tight|wide|radial","speed":"slow|normal|fast"}  ← one-shot
  [DISPLAY] scanlines: {"intensity":"off|light|medium|heavy"}
  [DISPLAY] portrait_border: {"style":"default|pulse|glow|glitch|none"}

To clear a persistent property, set it to null:
  [DISPLAY] color_wash: {"color":null,"opacity":0}

CURRENT STATE:
  color_wash:        (color: #ff00aa, opacity: 0.06)   ← or "(none)"
  portrait_glow:     (color: #00ffcc, intensity: 0.7)  ← or "(none)"
  ambient_particles: (15 particles, blue, drifting up)  ← or "(none)"
  inscription:       "(none)"
  scanlines:         (package default)
  portrait_border:   pulse
=== END DISPLAY CANVAS ===
```

---

## Data Flow

```
Claude response contains [DISPLAY] tags
  → response-parser.js extracts displayUpdates[] array
  → local-brain.js merges updates into live-display.json
  → main.js sends IPC "live-display-update" { state } to renderer

Renderer's DisplayController receives the event
  → Applies persistent properties immediately
  → Fires one-shot effects (particle_burst, screen_pulse, inscription timer)
  → Sends "display-oneshot-ack" back to main for cleanup

On app startup:
  → Main loads live-display.json and sends current state to renderer
  → Renderer restores persistent properties (no one-shots)
```

---

## Renderer Architecture

A new **`DisplayController`** module (`src/renderer/js/display-controller.js`) that:

1. Maintains a `<canvas>` overlay (full-screen, pointer-events: none, z-index above everything)
2. Has a `<div id="inscription-layer">` for text overlays (also pointer-events: none)
3. Applies CSS variable overrides to `:root` for color properties
4. Runs an rAF loop for ambient particles
5. Handles one-shot effects independently

The controller is initialized in `app.js` on startup and wired to IPC events.

---

## Implementation Checklist

### Phase 1 — Backend: Parsing

- [ ] **response-parser.js**: Add `[DISPLAY]` extraction
  - Regex: `/^\s*\[DISPLAY\]\s*([a-z_]+):\s*(.+)/gim`
  - JSON-parse the value portion — if parse fails, skip silently
  - Returns `displayUpdates: [{ property, value }]`
  - Strip from displayed dialogue and fallback cleaner

### Phase 2 — Backend: State Management

- [ ] **Create `src/main/display-manager.js`** — helper module
  - `DEFAULT_STATE` — the empty/default `live-display.json` shape
  - `load(characterDir)` → current state object (merges with defaults)
  - `save(characterDir, state)` → writes file
  - `applyUpdates(state, updates[])` → returns new merged state
    - Merges each update's property into state
    - Validates property names against whitelist
    - One-shots go into `state._oneshots`
  - `clearOneShotsForProperty(state, property)` → removes from `_oneshots`
  - `formatForPrompt(state)` → human-readable string for system prompt injection

- [ ] **local-brain.js**: Handle `displayUpdates` from `claudeResult`
  - After Claude response block: if `displayUpdates.length > 0`
    - Call `displayManager.load()`, `applyUpdates()`, `save()`
    - Emit `live-display-update` IPC event with new state

### Phase 3 — IPC Handlers (main.js)

- [ ] **`ipc: get-live-display`** — returns current state from JSON
- [ ] **`ipc: display-oneshot-ack`** — clears `_oneshots` from file
- [ ] On app startup: load state and send `live-display-update` to renderer

### Phase 4 — System Prompt Integration (system-prompt.js)

- [ ] Add `liveDisplayState` parameter to `buildSystemPrompt()`
- [ ] Inject `=== YOUR DISPLAY CANVAS ===` section
  - Show capabilities block (always)
  - Show current state formatted by `displayManager.formatForPrompt()`
- [ ] Update `local-brain.js` → `route()` to load and pass live display state
- [ ] Update `claude-bridge.js` → `sendToClaude()` signature to accept + forward it

### Phase 5 — Capabilities Block Update (system-prompt.js)

- [ ] Add to `=== WHAT YOU CAN ACTIVELY DO ===`:
  ```
  - Control the visual display: [DISPLAY] property: {json}
    Change your portrait glow, add particles, leave an inscription, pulse the screen.
    Full controls described in YOUR DISPLAY CANVAS section below.
  ```

### Phase 6 — Preload (preload.js)

- [ ] Expose `window.electronAPI.getLiveDisplay()`
- [ ] Expose `window.electronAPI.onLiveDisplayUpdate(callback)`
- [ ] Expose `window.electronAPI.ackDisplayOneshot(properties[])`

### Phase 7 — DisplayController (src/renderer/js/display-controller.js)

- [ ] **Initialization**:
  - Create full-screen canvas overlay `#display-canvas` (pointer-events: none, z-index: 9000)
  - Create `#inscription-layer` div (pointer-events: none, z-index: 9001)
  - On init: call `getLiveDisplay()`, apply persistent state (no one-shots)
  - Listen for `onLiveDisplayUpdate(state)` → call `applyState(state)`

- [ ] **`applyState(state)`** — central update method
  - `applyColorWash(state.color_wash)`
  - `applyPortraitGlow(state.portrait_glow)`
  - `applyAmbientParticles(state.ambient_particles)`
  - `applyScanlines(state.scanlines)` — sets CSS var or adds class override
  - `applyPortraitBorder(state.portrait_border)` — adds data attribute
  - If `state._oneshots.particle_burst` → `fireParticleBurst(cfg)` → ack
  - If `state._oneshots.screen_pulse` → `fireScreenPulse(cfg)` → ack
  - If `state.inscription.text` → `showInscription(cfg)` → auto-clear after duration → ack

- [ ] **`applyColorWash({ color, opacity })`**
  - Sets `--display-wash-color` and `--display-wash-opacity` CSS vars on `:root`
  - A `div#color-wash-layer` in `index.html` uses these vars (pointer-events: none)
  - null color → opacity 0

- [ ] **`applyPortraitGlow({ color, intensity })`**
  - Sets `--display-portrait-glow-color` and `--display-portrait-glow-intensity` CSS vars
  - Portrait frame CSS uses `box-shadow` driven by these vars

- [ ] **`applyAmbientParticles({ color, count, speed, direction })`**
  - Starts/updates rAF particle loop on `#display-canvas`
  - count: 0 → clears particles
  - Smooth transition: fade out old particles, fade in new

- [ ] **`showInscription({ text, position, duration, color })`**
  - Creates a `<div class="inscription">` in `#inscription-layer`
  - CSS: positioned per `position`, fades in over 0.5s, fades out before expiry
  - Auto-removes after `duration` ms, then sends ack

- [ ] **`fireParticleBurst({ color, count, spread, speed })`**
  - One-shot: emits `count` particles from portrait center outward
  - Spread controls angle range; speed controls velocity
  - Particles fade as they travel; total duration ~1.5–3s
  - Sends `ackDisplayOneshot(['particle_burst'])` on completion

- [ ] **`fireScreenPulse({ color, intensity, duration })`**
  - Flashes `#color-wash-layer` quickly to `intensity` opacity then back to 0
  - CSS transition handles the animation
  - Sends ack on completion

- [ ] **`applyScanlines({ intensity })`**
  - null → remove override (package default takes over)
  - Otherwise adds a `data-display-scanlines="heavy"` attribute to body
  - CSS: `body[data-display-scanlines="heavy"] .scanlines { ... }` overrides package scanlines

- [ ] **`applyPortraitBorder({ style })`**
  - Adds `data-portrait-border="pulse"` to portrait container
  - CSS handles each style: pulse (pulsing box-shadow), glow, glitch (CSS glitch animation), none

### Phase 8 — CSS (main.css / bg-effects.css)

- [ ] `#color-wash-layer` — fixed overlay, var-driven opacity+color
- [ ] `#display-canvas` — fixed canvas overlay, pointer-events none
- [ ] `#inscription-layer` — fixed overlay, pointer-events none
- [ ] `.inscription` — positioned text, fade-in/out animations
- [ ] `[data-portrait-border]` variants — pulse, glow, glitch animations
- [ ] `[data-display-scanlines]` overrides for scanlines intensity

### Phase 9 — index.html

- [ ] Add `<div id="color-wash-layer">` (empty overlay div)
- [ ] Add `<canvas id="display-canvas">` (full-screen)
- [ ] Add `<div id="inscription-layer">` (text overlay container)
- [ ] Add `<script src="js/display-controller.js"></script>` before `app.js`

### Phase 10 — Polish & Testing

- [ ] Test: Aria uses `[DISPLAY]` → change applies within the same response cycle
- [ ] Test: Persistent properties survive app restart
- [ ] Test: One-shots fire and get cleared (don't replay on restart)
- [ ] Test: `color: null` clears the color wash cleanly
- [ ] Test: Ambient particles update smoothly when color/count/speed change
- [ ] Test: Inscription appears at correct position, fades after duration
- [ ] Test: Multiple `[DISPLAY]` tags in one response all apply correctly
- [ ] Test: Invalid JSON values are silently ignored, rest of response unaffected
- [ ] Test: Works correctly on top of all three existing Visual Packages
- [ ] Test: `[DISPLAY]` content does NOT appear in rendered dialogue
- [ ] Update `docs/VISUAL_PACKAGE_SYSTEM.md` — add note about Display Layer being separate
- [ ] This checklist: mark all items ✅ as implemented
