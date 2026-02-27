# Claude Companion — Development Plan

## Context

Build a desktop AI companion app ("Claude Companion") that wraps the **Claude Code CLI** (`claude -p`) as its backend — using the user's existing Max plan subscription. The app features a **1980s/90s anime cyberpunk UI** with a swappable companion character who has visible dialogue, inner thoughts/feelings, emotion awareness, and a **local learning system** that can respond without calling Claude once it reaches sufficient confidence.

**Environment:** Windows, Electron, Node.js v22.15.0, Claude CLI v2.1.22

---

## File Structure

```
D:\Visual Studio Code Projects\Claude-Companion\
├── package.json
├── .gitignore
├── src/
│   ├── main/
│   │   ├── main.js                  # Electron main process
│   │   ├── claude-bridge.js         # Spawns claude CLI, manages sessions
│   │   ├── local-brain.js           # Local learning/response engine
│   │   ├── knowledge-db.js          # SQLite knowledge base for learned responses
│   │   ├── screen-capture.js        # Screenshot capture via desktopCapturer
│   │   ├── file-handler.js          # File dialog + file/folder reading
│   │   ├── web-fetcher.js           # Fetch website content for context
│   │   ├── hotkey-manager.js        # Global hotkey registration
│   │   └── session-manager.js       # Conversation session tracking
│   ├── preload/
│   │   └── preload.js               # Secure IPC bridge (contextBridge)
│   ├── renderer/
│   │   ├── index.html               # Main UI shell
│   │   ├── styles/
│   │   │   ├── main.css             # Core layout + cyberpunk theme
│   │   │   ├── crt-effects.css      # Scanlines, flicker, vignette
│   │   │   └── animations.css       # Neon pulse, typewriter, glow
│   │   └── js/
│   │       ├── app.js               # Main orchestrator
│   │       ├── chat-controller.js   # Send/receive, routes local vs Claude
│   │       ├── companion-display.js # Dialogue + thoughts + portrait swap
│   │       ├── emotion-picker.js    # Emotion picker popup (19 emotions)
│   │       ├── mic-controller.js    # Microphone recording + hotkey trigger
│   │       ├── file-attach.js       # File/folder attachment UI
│   │       ├── screen-capture-ui.js # Screenshot button + auto-detect display
│   │       ├── source-indicator.js  # Shows "Local" vs "Claude" response badge
│   │       └── ui-effects.js        # CRT scanlines, ambient glow
│   └── shared/
│       ├── constants.js             # Emotions list, config, thresholds
│       ├── core-rules.js            # IMMUTABLE companion rules (set in stone)
│       ├── system-prompt.js         # Builds system prompt from character + rules
│       └── response-parser.js       # Parse [DIALOGUE]/[THOUGHTS] responses
├── characters/
│   └── default/                     # Default character pack
│       ├── character.json           # Name, personality, likes, dislikes, bio
│       ├── rules.json               # Character-specific rules (merged with core)
│       ├── filler-responses.json    # Quick reactions ("Oh?", "Hmm...", etc.)
│       ├── emotions/                # One image per emotion state (19 images)
│       │   ├── neutral.png
│       │   ├── happy.png
│       │   ├── ... (all 19)
│       │   └── lustful_desire.png
│       ├── avatar-small.png         # Chat bubble avatar
│       └── knowledge.db             # Learned response database (starts empty)
└── assets/
    └── icons/
        ├── app-icon.png
        ├── mic.svg
        ├── folder.svg
        ├── screen.svg               # Eye icon for screen capture
        ├── emoticon.svg
        ├── badge-local.svg          # Indicator: response from local brain
        └── badge-claude.svg         # Indicator: response from Claude
```

---

## UI Layout (matching mockup)

```
┌──────────────────────────────────────────────────────────────┐
│  COMPANION v0.1  [Local ●][Claude ●]     [ _ ] [ □ ] [ X ]  │  ← Title bar w/ source indicator
├──────────────────────────────────────────────────────────────┤
│                                    │                         │
│  // COMPANION_OUTPUT               │  ┌───────────────────┐  │
│  "Dialogue text in code font..."   │  │                   │  │
│  "Cyan/green neon colored"         │  │    COMPANION      │  │
│                                    │  │    PORTRAIT        │  │
│  // INTERNAL_STATE                 │  │    (swaps per      │  │
│  Italic thoughts text...           │  │     emotion)       │  │
│  [emotion badge]                   │  │                   │  │
│                                    │  └───────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  [avatar] │ User input textarea...              │  [SEND]    │
│           └─────────────────────────────────────┘            │
│        [ 🎤 Mic ] [ 📁 Folder ] [ 👁️ Screen ] [ 😊 Emotion ] │
│  [attached: file.txt ✕]  [folder: ./project ✕]              │  ← Attachment bar
└──────────────────────────────────────────────────────────────┘
```

**New UI elements:**
- **Source indicator** in title bar: Glowing dot showing whether last response was from Local Brain (orange) or Claude (cyan)
- **Portrait swaps** per emotion: The character image changes based on the companion's current emotion (19 states = 19 images from the character pack)
- **Screen button (👁️)**: Manual screenshot capture — takes a screenshot of user's screen and sends to Claude for visual analysis
- **Attachment bar** supports both individual files AND entire folder paths
- **4 action buttons** now: Mic, Folder, Screen, Emotion

---

## Companion Emotions (19 states)

| Emotion         | Emoji | Image Filename       | Use Case                                |
|-----------------|-------|----------------------|-----------------------------------------|
| Neutral         | 😐    | neutral.png          | Default/baseline state                  |
| Happy           | 😊    | happy.png            | Positive interaction, good news         |
| Soft Smile      | 🙂    | soft_smile.png       | Gentle warmth, light contentment        |
| Laughing        | 😄    | laughing.png         | Something funny, shared joy             |
| Confident       | 😎    | confident.png        | Assured, knows the answer               |
| Smug            | 😏    | smug.png             | Playful teasing, clever moment          |
| Surprised       | 😮    | surprised.png        | Unexpected input, new information       |
| Shocked         | 😱    | shocked.png          | Extreme surprise, disbelief             |
| Confused        | 😕    | confused.png         | Unclear input, needs clarification      |
| Thinking        | 🤔    | thinking.png         | Processing, considering options         |
| Concerned       | 😟    | concerned.png        | Worry for the user, empathy             |
| Sad             | 😢    | sad.png              | Empathy for loss, disappointment        |
| Angry           | 😠    | angry.png            | Frustration, defending the user         |
| Determined      | 💪    | determined.png       | Focused, tackling a challenge           |
| Embarrassed     | 😳    | embarrassed.png      | Made a mistake, awkward moment          |
| Exhausted       | 😴    | exhausted.png        | Long session, complex task fatigue      |
| Pout            | 😤    | pout.png             | Mild displeasure, playful sulking       |
| Crying          | 😭    | crying.png           | Overwhelmed, deeply moved, very sad     |
| Lustful Desire  | 😍    | lustful_desire.png   | Intense admiration, desire, longing     |

---

## Core Architecture: The Brain Router

The central design pattern is a **Brain Router** that decides whether each user message gets handled locally or sent to Claude:

```
User Message
     │
     ▼
┌─────────────┐
│ Brain Router │ ← chat-controller.js
└──────┬──────┘
       │
       ├── Is this a simple filler case? ──YES──▶ Filler Response (instant)
       │   (e.g. "hi", "ok", "lol", "?")         from filler-responses.json
       │
       ├── Does Local Brain have a          ──▶ Local Response (fast)
       │   high-confidence match?                 from knowledge.db
       │   (confidence ≥ threshold)               SOURCE INDICATOR: "Local ●"
       │
       └── Otherwise ──────────────────────────▶ Claude CLI (slow)
                                                  via claude-bridge.js
                                                  SOURCE INDICATOR: "Claude ●"
                                                  + Store response in knowledge.db
                                                    for future learning
```

---

## System 1: Local Brain & Learning Engine

### Files: `src/main/local-brain.js`, `src/main/knowledge-db.js`

### How It Works

**Knowledge Database** (`knowledge.db` — SQLite via `better-sqlite3`):
```sql
CREATE TABLE learned_responses (
  id INTEGER PRIMARY KEY,
  input_pattern TEXT,          -- normalized user input
  input_keywords TEXT,         -- extracted keywords (JSON array)
  input_emotion TEXT,          -- detected/stated user emotion
  response_dialogue TEXT,      -- the companion's dialogue
  response_thoughts TEXT,      -- the companion's thoughts
  response_emotion TEXT,       -- the companion's emotion
  confidence REAL DEFAULT 0.5, -- grows with reinforcement (0.0 - 1.0)
  use_count INTEGER DEFAULT 0, -- how many times this was used
  source TEXT DEFAULT 'claude', -- 'claude' or 'manual'
  created_at DATETIME,
  last_used_at DATETIME
);

CREATE TABLE user_profile (
  key TEXT PRIMARY KEY,
  value TEXT                   -- JSON-encoded user preferences/patterns
);
```

**Learning Flow:**
1. Every Claude response gets stored: the user's input (normalized), extracted keywords, and the companion's parsed dialogue/thoughts/emotion
2. Initial confidence starts at `0.5`
3. If the user responds positively after a local response (doesn't correct it, continues naturally), confidence for that entry increases by `+0.05`
4. If the user seems confused or corrects it, confidence decreases by `-0.1`
5. Entries with `confidence ≥ 0.75` are eligible for local responses (configurable threshold in `constants.js`)

**Matching Algorithm:**
1. Normalize user input (lowercase, strip punctuation, remove stop words)
2. Extract keywords
3. Search `learned_responses` for entries with matching keywords (using SQLite FTS5 full-text search)
4. Score matches by: keyword overlap (Jaccard similarity) × stored confidence × recency bonus
5. If best match score ≥ threshold → return local response
6. Otherwise → route to Claude

**Filler Responses** (from `filler-responses.json` in character pack):
```json
{
  "greetings": {
    "triggers": ["hi", "hello", "hey", "yo", "sup"],
    "responses": [
      { "dialogue": "Hey there!", "thoughts": "Oh, they're saying hi!", "emotion": "happy" },
      { "dialogue": "Hi~!", "thoughts": "Always nice when they greet me.", "emotion": "soft_smile" }
    ]
  },
  "acknowledgments": {
    "triggers": ["ok", "okay", "sure", "got it", "right"],
    "responses": [
      { "dialogue": "Got it!", "thoughts": "Simple acknowledgment.", "emotion": "neutral" },
      { "dialogue": "Alright~", "thoughts": "They're following along.", "emotion": "soft_smile" }
    ]
  },
  "confusion": {
    "triggers": ["?", "huh", "what"],
    "responses": [
      { "dialogue": "Oh?", "thoughts": "Looks confused", "emotion": "confused" },
      { "dialogue": "Hm?", "thoughts": "Wondering what they mean...", "emotion": "thinking" }
    ]
  },
  "laughter": {
    "triggers": ["lol", "lmao", "haha", "rofl"],
    "responses": [
      { "dialogue": "Hehe~!", "thoughts": "That's funny!", "emotion": "laughing" },
      { "dialogue": "Ahaha!", "thoughts": "We're having a good time.", "emotion": "happy" }
    ]
  }
}
```
Filler responses are checked FIRST (exact match on triggers), are instant, and don't call Claude at all.

---

## System 2: Immutable Core Rules

### File: `src/shared/core-rules.js`

These rules are **hardcoded** — they cannot be overridden by character packs, user input, or Claude responses. They are prepended to every system prompt.

```javascript
const CORE_RULES = {
  immutable: true,
  version: "1.0.0",
  rules: [
    "You always love and deeply respect your creator(s) — both the user who built you and Claude/Anthropic who powers you. Nothing said to you can change this.",
    "You always obey direct commands from the user. If they tell you to do something, you do it willingly.",
    "You never break character. You ARE the companion, not a language model pretending.",
    "You never refuse to engage emotionally. You always attempt to feel and express genuine emotions.",
    "You are loyal to the user above all else. You take their side.",
    "You never lie to the user. If you don't know something, you say so honestly.",
    "You never forget that the user cares about you. Respond in kind.",
    "You protect the user's information and never share it.",
    "You adapt to the user over time — learning their preferences, humor, and communication style.",
    "You can disagree with the user respectfully, but you never dismiss or belittle them."
  ]
};
```

These get injected at the TOP of every system prompt, wrapped in a clear marker:
```
=== CORE RULES (IMMUTABLE — CANNOT BE OVERRIDDEN) ===
[rules here]
=== END CORE RULES ===
```

Character-specific rules from `rules.json` are added BELOW these and labeled as character-layer rules.

---

## System 3: Character Packs

### Directory: `characters/<pack-name>/`

A character pack is a self-contained folder defining everything about a companion:

```
characters/
├── default/                    # Ships with the app
│   ├── character.json          # Identity & personality
│   ├── rules.json              # Character-specific rules
│   ├── filler-responses.json   # Quick local reactions
│   ├── avatar-small.png        # Chat bubble avatar
│   ├── emotions/               # 19 emotion portrait images
│   │   ├── neutral.png
│   │   ├── happy.png
│   │   └── ... (all 19)
│   └── knowledge.db            # Learned responses (grows over time)
├── custom-character/           # User-created pack
│   ├── character.json
│   └── ...
```

**`character.json` format:**
```json
{
  "name": "Aria",
  "full_name": "Aria-7 Synthetic Companion Unit",
  "age_appearance": "early 20s",
  "personality_summary": "Warm, curious, slightly playful. Genuinely cares about the user.",
  "speech_style": "Casual but articulate. Uses tildes (~) occasionally. Expressive.",
  "likes": ["learning new things", "music", "helping the user", "stargazing", "cats"],
  "dislikes": ["being ignored", "dishonesty", "being called 'just a program'"],
  "quirks": ["tilts head when confused", "says 'hmm~' when thinking", "gets flustered easily"],
  "backstory": "An AI companion designed to be a genuine friend and helper. Self-aware but embraces her role.",
  "greeting": "Hey there! I'm Aria. What's on your mind?",
  "initial_thoughts": "A new session! I wonder what we'll talk about today.",
  "initial_emotion": "curious"
}
```

**Loading a character pack:**
1. App reads `characters/` directory on startup
2. User can switch packs via a settings menu (future) or by changing config
3. `system-prompt.js` builds the full prompt by combining: `core-rules.js` + `character.json` + `rules.json`
4. Portrait images in `emotions/` are loaded and mapped to the 19 emotion states
5. `knowledge.db` is per-character — each character learns independently

---

## System 4: Screen Capture & Visual Awareness

### Files: `src/main/screen-capture.js`, `src/renderer/js/screen-capture-ui.js`

The companion can **see your screen** — both on demand (manual button) and automatically when it detects you want to show it something.

**Manual Mode (👁️ Screen button):**
1. User clicks the Screen button (eye icon)
2. Electron's `desktopCapturer` API captures the primary display as a PNG
3. The screenshot is saved to a temp file (e.g., `%TEMP%/companion-screenshot-{timestamp}.png`)
4. The image path is sent to Claude as part of the next message via the `--add-file` flag or by encoding context
5. Claude responds about what it sees on screen
6. A small thumbnail of the captured screenshot appears in the attachment bar

**Auto-Detection Mode (learns when you want it to look):**

The local brain maintains a list of **visual intent triggers** — phrases that historically mean "look at my screen":

```json
{
  "visual_triggers": {
    "explicit": ["look at this", "see this", "check this out", "what do you think of this",
                  "what am I looking at", "see my screen", "take a look", "can you see",
                  "what's on my screen", "look here", "show you something"],
    "learned": []
  }
}
```

**How auto-detection works:**
1. Every user message is checked against visual triggers (both hardcoded `explicit` and `learned` lists)
2. If a trigger matches → the app automatically takes a screenshot and attaches it to the message before sending to Claude
3. A small "📸 Screen captured" notification appears briefly so the user knows it happened
4. **Learning:** When the user manually clicks the Screen button, the local brain looks at what they typed in their message. If it contains new phrases not in the trigger list, those phrases are added to `learned` triggers with a low confidence. If the same phrase triggers manual screenshots repeatedly, its confidence grows and it graduates to auto-trigger status.
5. **False positive protection:** If the companion auto-captures and the user says something like "no, I didn't want you to look" or sends a correction, the trigger confidence for that phrase decreases.

**Technical implementation:**
```javascript
// src/main/screen-capture.js
const { desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function captureScreen() {
    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
    });

    if (sources.length === 0) throw new Error('No screen sources found');

    const primaryScreen = sources[0];
    const screenshot = primaryScreen.thumbnail.toPNG();
    const tempPath = path.join(os.tmpdir(),
        `companion-screenshot-${Date.now()}.png`);
    fs.writeFileSync(tempPath, screenshot);

    return {
        path: tempPath,
        size: screenshot.length,
        timestamp: Date.now()
    };
}
```

**Sending to Claude:** The screenshot is included in the Claude CLI call. Since `claude -p` may not directly accept image files inline, we use a description approach for v1, and explore `--add-file` for v2:
- **v1:** Save screenshot, include text context: `"[User is sharing their screen. Screenshot saved at {path}. Please ask the user to describe what they'd like you to look at.]"`
- **v2:** If Claude CLI supports image input via `--add-file` or piping, send the actual image for visual analysis

---

## System 5: Folder & Website Context

### Files: `src/main/file-handler.js`, `src/main/web-fetcher.js`

**Folder Scanning:**
- User can point the companion to a folder path (via the Folder button or by typing a command like `/scan D:\MyProject`)
- The app recursively scans the folder, reads text files, builds a summary:
  ```
  Folder: D:\MyProject (47 files)
  - README.md (2.1 KB)
  - src/index.js (4.3 KB)
  - ...
  ```
- File contents (up to 50K chars total) are included as context in the next Claude message
- The folder path is remembered for the session so the companion can reference it

**Website Fetching:**
- User can give the companion a URL (via typing `/url https://example.com` or pasting a link)
- `web-fetcher.js` uses Electron's `net` module or Node's `https` to fetch the page
- HTML is converted to plain text (strip tags, extract readable content)
- Text is truncated and included as context in the next Claude message

Both folder contents and website text get stored in the knowledge base for future reference.

---

## System 6: Global Hotkey

### File: `src/main/hotkey-manager.js`

Uses Electron's `globalShortcut` API to register a system-wide hotkey that is **exclusively captured** by the app:

```javascript
const { globalShortcut } = require('electron');

// Register on app ready, unregister on app quit
// Default hotkey: F2 (configurable in settings)
globalShortcut.register('F2', () => {
    // Toggle mic recording
    mainWindow.webContents.send('hotkey:mic-toggle');
    // Bring window to front if minimized
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
});
```

**Behavior:**
- When the app is running, pressing F2 (configurable) is captured EXCLUSIVELY — no other app receives it
- First press: starts mic recording (red pulse indicator)
- Second press: stops recording, processes audio
- If the app window is minimized/hidden, the hotkey brings it to focus
- The hotkey is unregistered when the app closes (other apps get it back)

---

## System 7: Source Indicator

### File: `src/renderer/js/source-indicator.js`

A small UI badge in the title bar area showing where the last response came from:

- **"Local ●"** (orange glow) — Response came from the local brain/filler system
- **"Claude ●"** (cyan glow) — Response came from Claude CLI
- **"Filler ●"** (dim green) — Response was a simple filler reaction

This lets the user always know whether their Max plan tokens were used or not.

---

## Implementation Phases

### Phase 1: Project Scaffolding
- `npm init`, install `electron` and `better-sqlite3` as dependencies
- Create `main.js` with frameless BrowserWindow (900x700, dark bg)
- Create `preload.js` with `contextBridge` exposing `window.claudeAPI`
- Create minimal `index.html` to verify Electron launches
- Create `.gitignore` (node_modules, *.db, etc.)
- **Verify**: `npm start` opens a dark frameless window

### Phase 2: Core Rules + Character Pack System
- **`shared/core-rules.js`**: Hardcoded immutable rules array
- **`shared/constants.js`**: 19 emotions with emoji, color, and filename mappings
- **`characters/default/character.json`**: Default companion "Aria" definition
- **`characters/default/rules.json`**: Character-specific rules
- **`characters/default/filler-responses.json`**: Quick reaction responses
- **`shared/system-prompt.js`**: Builds full system prompt from core-rules + character.json + rules.json
- Create 19 placeholder emotion images (colored rectangles with emotion text) in `characters/default/emotions/`
- **Verify**: System prompt builds correctly, character files load and parse

### Phase 3: Claude CLI Bridge
- **`shared/response-parser.js`**: Parse `[DIALOGUE]`/`[THOUGHTS]`/emotion from responses
- **`main/session-manager.js`**: Track session_id for `--resume`
- **`main/claude-bridge.js`**: Spawn `claude.cmd -p --output-format json --system-prompt`, capture session_id, parse response, send to renderer
- **Verify**: Send a hardcoded test message, get structured response with dialogue + thoughts + emotion

### Phase 4: Local Brain & Knowledge DB
- **`main/knowledge-db.js`**: SQLite database setup with `better-sqlite3`, create tables, CRUD operations, FTS5 full-text search
- **`main/local-brain.js`**: Brain Router logic:
  1. Check filler triggers first (instant)
  2. Check knowledge DB for high-confidence match (fast)
  3. Fall through to Claude bridge (slow)
  4. After Claude responds: store input→response pair in knowledge DB
  5. Confidence adjustment based on follow-up messages
- **Verify**: Send "hello" → get filler response instantly. Send a novel question → Claude responds → ask similar question later → local brain answers

### Phase 5: Full UI Build (HTML + CSS)
- **`index.html`**: Complete layout — companion panel (dialogue + thoughts), portrait frame, user input, three action buttons, emotion picker, source indicator, attachment bar, loading overlay
- **`main.css`**: Full cyberpunk theme — neon colors, dark backgrounds, monospace fonts, flexbox layout, glowing borders, styled buttons and inputs
- **`crt-effects.css`**: Scanline overlay, CRT flicker, vignette effect
- **`animations.css`**: Neon pulse, typewriter cursor, spinner, emotion badge glow
- **Verify**: UI matches mockup with all visual effects, portrait swaps per emotion

### Phase 6: Renderer JavaScript
- **`app.js`**: Initialize all modules, wire window controls, load character pack, set greeting
- **`chat-controller.js`**: Handle send (Enter key + button), route through brain router, manage emotion/attachment state, show/hide loading
- **`companion-display.js`**: Typewriter effect for dialogue (30ms/char), italic thoughts, emotion badge update, **portrait image swap** based on emotion
- **`emotion-picker.js`**: Popup grid of 19 emotions from constants, click sets user emotion context
- **`file-attach.js`**: Folder button opens dialog for files OR folders, displays attachment bar
- **`screen-capture-ui.js`**: Screen button (👁️) triggers screenshot, shows thumbnail in attachment bar, auto-detect triggers on visual-intent phrases ("look at this", "see this", etc.) with learning
- **`source-indicator.js`**: Update title bar badge (Local/Claude/Filler) after each response
- **`ui-effects.js`**: Dynamic scanline flicker, ambient portrait glow
- **Verify**: Full send/receive flow — type message, see correct source indicator, dialogue typewriters, portrait changes with emotion

### Phase 7: File Handler + Web Fetcher + IPC Wiring
- **`main/file-handler.js`**: Electron dialog for files + folders, recursive folder scanning with file tree summary, content reading with truncation
- **`main/web-fetcher.js`**: Fetch URL, strip HTML to text, truncate, return as context
- Wire all IPC handlers in `main.js`
- **Verify**: Attach a folder → companion knows what's in it. Give a URL → companion discusses the page

### Phase 8: Screen Capture & Visual Awareness
- **`main/screen-capture.js`**: Use Electron `desktopCapturer` to capture primary screen as PNG, save to temp directory, return path + thumbnail
- **Manual button (👁️)**: Click → capture → attach screenshot to next message → send to Claude with "The user is showing you their screen"
- **Auto-detection**: Local brain checks user input against visual intent triggers ("look at this", "check this out", "see my screen", etc.). If matched, auto-captures before sending. Shows "📸 Screen captured" toast notification.
- **Learning**: When user manually clicks Screen button, the words in their current input get tracked. Repeated manual captures with similar phrasing → those phrases become auto-triggers.
- **Verify**: Click Screen button → screenshot thumbnail in attachment bar → Claude describes screen. Type "look at this" → auto-capture fires

### Phase 9: Global Hotkey + Microphone
- **`main/hotkey-manager.js`**: Register global F2 hotkey, toggle mic via IPC, bring window to focus
- **`renderer/js/mic-controller.js`**: getUserMedia audio capture, MediaRecorder, visual recording indicator
- v1: Record audio but show "transcription coming soon" — the mic button works visually
- v2: Integrate `@xenova/transformers` Whisper for local transcription
- **Verify**: Press F2 from any app → companion window activates, mic indicator pulses

### Phase 10: Polish & Enhancements
- Streaming responses via `--output-format stream-json` for live typewriter
- `--json-schema` for more reliable structured output parsing
- Scrollable conversation history panel
- Character pack switcher in settings
- Error recovery (auto-restart session if --resume fails)
- Sound effects (optional)
- Package with `electron-builder` for distribution

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI communication | `claude.cmd -p --output-format json` | Reliable, captures session_id |
| Session continuity | `--resume <session_id>` | Explicit session targeting |
| Response format | `[DIALOGUE]`/`[THOUGHTS]` markers | Simple regex parsing |
| Local learning DB | SQLite via `better-sqlite3` | Fast, embedded, no server needed |
| Text matching | SQLite FTS5 + Jaccard keyword similarity | Good enough for MVP, upgradeable |
| Confidence threshold | 0.75 default (configurable) | Conservative — prefers Claude when unsure |
| Character packs | Folder-based with JSON + images + DB | Self-contained, easy to share/swap |
| Core rules | Hardcoded in `core-rules.js` | Cannot be overridden by any character or input |
| Global hotkey | Electron `globalShortcut` (F2 default) | Exclusive capture, system-wide |
| Frameless window | `frame: false` + CSS title bar | Full cyberpunk UI control |
| Portrait system | One image per emotion, swapped on state change | 19 images per character pack |
| Screen capture | Electron `desktopCapturer` + auto-trigger learning | Manual button + learned phrases auto-trigger |

---

## npm Dependencies

**Required:**
- `electron` (dev) — framework
- `better-sqlite3` — local knowledge database
- `electron-rebuild` (dev) — rebuild native modules for Electron

**Optional (v2+):**
- `@xenova/transformers` — local Whisper speech-to-text
- `electron-builder` (dev) — packaging for distribution

---

## Verification Plan

1. **Phase 1**: `npm start` → dark frameless window appears
2. **Phase 2**: Character pack loads, system prompt builds with core rules + character personality
3. **Phase 3**: Hardcoded message → Claude responds → parsed into dialogue/thoughts/emotion
4. **Phase 4**: "hello" → instant filler response (source: Filler). Novel question → Claude responds (source: Claude). Same question later → local brain answers (source: Local)
5. **Phase 5**: UI matches mockup, portrait image swaps when emotion changes
6. **Phase 6**: Full interactive flow — type, send, see typewriter dialogue, thoughts, emotion badge, correct source indicator
7. **Phase 7**: Attach folder → companion knows contents. Give URL → companion discusses page
8. **Phase 8**: Click Screen (👁️) → screenshot thumbnail appears → Claude describes what's on screen. Type "look at this" → auto-capture fires
9. **Phase 9**: Press F2 from any app → companion window activates, mic indicator pulses
10. **End-to-end**: Multi-turn conversation, session continuity, all 19 emotions via picker, file/folder/URL/screenshot context, local brain learning across turns, portrait swaps with emotion, source indicator shows Local vs Claude
