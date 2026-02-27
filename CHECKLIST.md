# Claude Companion — Development Checklist

## Phase 1: Project Scaffolding
- [ ] `npm init` with correct package.json (name, main, scripts)
- [ ] Install `electron` as dev dependency
- [ ] Install `better-sqlite3` as dependency
- [ ] Install `electron-rebuild` as dev dependency
- [ ] Run `electron-rebuild` to build native modules
- [ ] Create directory structure: `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/`, `characters/default/`, `assets/icons/`
- [ ] Create `src/main/main.js` — Electron main process with frameless BrowserWindow
- [ ] Create `src/preload/preload.js` — contextBridge IPC exposure
- [ ] Create `src/renderer/index.html` — minimal test page
- [ ] Create `.gitignore`
- [ ] **VERIFY**: `npm start` opens a dark frameless Electron window

## Phase 2: Core Rules + Character Pack System
- [ ] Create `src/shared/core-rules.js` — 10 immutable hardcoded rules
- [ ] Create `src/shared/constants.js` — 19 emotions with emoji, color, filename
- [ ] Create `characters/default/character.json` — Aria personality definition
- [ ] Create `characters/default/rules.json` — character-specific rules
- [ ] Create `characters/default/filler-responses.json` — greetings, acknowledgments, confusion, laughter triggers
- [ ] Create `src/shared/system-prompt.js` — builds full prompt from core-rules + character + rules
- [ ] Create 19 placeholder emotion images in `characters/default/emotions/`
- [ ] Create `characters/default/avatar-small.png` — placeholder avatar
- [ ] **VERIFY**: System prompt builds correctly with core rules at top

## Phase 3: Claude CLI Bridge
- [ ] Create `src/shared/response-parser.js` — parse `[DIALOGUE]`/`[THOUGHTS]`/emotion
- [ ] Create `src/main/session-manager.js` — track session_id for `--resume`
- [ ] Create `src/main/claude-bridge.js` — spawn `claude.cmd -p --output-format json`
- [ ] Handle first message (with `--system-prompt`) vs subsequent (`--resume`)
- [ ] Capture `session_id` from JSON response
- [ ] Send parsed response to renderer via IPC
- [ ] Handle errors, timeouts, process cleanup
- [ ] **VERIFY**: Hardcoded test message returns structured dialogue + thoughts + emotion

## Phase 4: Local Brain & Knowledge DB
- [ ] Create `src/main/knowledge-db.js` — SQLite setup with `better-sqlite3`
- [ ] Create `learned_responses` table with FTS5
- [ ] Create `user_profile` table
- [ ] Create `visual_triggers` table (for screen capture learning)
- [ ] Implement CRUD operations (insert, query, update confidence)
- [ ] Create `src/main/local-brain.js` — Brain Router
- [ ] Implement filler response check (exact trigger match, instant)
- [ ] Implement knowledge DB search (FTS5 + Jaccard similarity)
- [ ] Implement confidence threshold check (default 0.75)
- [ ] Implement Claude fallthrough (when local can't answer)
- [ ] Implement learning: store Claude responses in knowledge DB
- [ ] Implement confidence adjustment (+0.05 positive, -0.1 correction)
- [ ] Return source type with every response (filler/local/claude)
- [ ] **VERIFY**: "hello" → filler. Novel question → Claude. Repeat → local brain

## Phase 5: Full UI Build (HTML + CSS)
- [ ] Create `src/renderer/index.html` — full layout
  - [ ] CRT scanline overlay div
  - [ ] Custom frameless title bar with source indicators
  - [ ] Top section: companion panel (dialogue + thoughts) + portrait frame
  - [ ] Bottom section: input area with avatar, textarea, send button
  - [ ] 4 action buttons: Mic, Folder, Screen, Emotion
  - [ ] Attachment bar (hidden by default)
  - [ ] Emotion picker popup (hidden by default)
  - [ ] Loading overlay
- [ ] Create `src/renderer/styles/main.css` — cyberpunk theme
  - [ ] CSS variables: neon cyan, green, magenta, purple, dark backgrounds
  - [ ] Layout: flexbox, top section split (companion panel + portrait)
  - [ ] Title bar: draggable, window controls, source badges
  - [ ] Input area: textarea styling, button styling
  - [ ] Portrait frame: neon border glow
  - [ ] Emotion picker: grid layout, hover effects
  - [ ] Attachment bar styling
  - [ ] Loading overlay styling
- [ ] Create `src/renderer/styles/crt-effects.css`
  - [ ] Scanline overlay (repeating-linear-gradient)
  - [ ] CRT flicker animation
  - [ ] Vignette effect (radial-gradient)
- [ ] Create `src/renderer/styles/animations.css`
  - [ ] Neon text-shadow pulse
  - [ ] Typing cursor blink
  - [ ] Loading spinner rotation
  - [ ] Emotion badge glow
- [ ] **VERIFY**: UI matches mockup with CRT effects, correct layout, neon colors

## Phase 6: Renderer JavaScript
- [ ] Create `src/renderer/js/app.js` — initialize all modules, wire window controls, set greeting
- [ ] Create `src/renderer/js/chat-controller.js`
  - [ ] Send button + Enter key handler
  - [ ] Call `claudeAPI.sendMessage()` with brain routing
  - [ ] Listen for response/error events
  - [ ] Manage emotion and attachment state
  - [ ] Show/hide loading overlay
- [ ] Create `src/renderer/js/companion-display.js`
  - [ ] Typewriter effect (30ms/char) for dialogue
  - [ ] Italic thoughts display
  - [ ] Emotion badge update with correct color
  - [ ] Portrait image swap based on emotion
- [ ] Create `src/renderer/js/emotion-picker.js`
  - [ ] Build popup grid of 19 emotions
  - [ ] Click handler sets user emotion on ChatController
  - [ ] Visual feedback in input placeholder
  - [ ] Close on outside click
- [ ] Create `src/renderer/js/file-attach.js`
  - [ ] Folder button triggers file dialog (files OR folders)
  - [ ] Display attachment bar with filenames
  - [ ] Remove attachment button
- [ ] Create `src/renderer/js/screen-capture-ui.js`
  - [ ] Screen button (👁️) triggers screenshot
  - [ ] Show thumbnail in attachment bar
  - [ ] Auto-detect visual-intent phrases
  - [ ] "📸 Screen captured" toast notification
- [ ] Create `src/renderer/js/source-indicator.js`
  - [ ] Update title bar badge: Local (orange) / Claude (cyan) / Filler (green)
- [ ] Create `src/renderer/js/ui-effects.js`
  - [ ] Dynamic scanline opacity flicker
  - [ ] Ambient portrait frame glow pulse
- [ ] **VERIFY**: Full interactive flow — send message, see typewriter, thoughts, emotion, source badge

## Phase 7: File Handler + Web Fetcher + IPC Wiring
- [ ] Create `src/main/file-handler.js`
  - [ ] Electron `dialog.showOpenDialog` for files
  - [ ] Electron `dialog.showOpenDialog` for folders
  - [ ] Recursive folder scanning with file tree summary
  - [ ] Content reading with 50K char truncation
  - [ ] File type detection and filtering
- [ ] Create `src/main/web-fetcher.js`
  - [ ] Fetch URL via Node `https`
  - [ ] Strip HTML to plain text
  - [ ] Truncate and return as context
- [ ] Wire all IPC handlers in `src/main/main.js`
  - [ ] `claude:send-message` → brain router → claude-bridge
  - [ ] `dialog:open-file` → file-handler
  - [ ] `dialog:open-folder` → file-handler
  - [ ] `screen:capture` → screen-capture
  - [ ] `web:fetch` → web-fetcher
  - [ ] `window:minimize/maximize/close` → window controls
- [ ] **VERIFY**: Attach folder → companion knows contents. URL → companion discusses page.

## Phase 8: Screen Capture & Visual Awareness
- [ ] Create `src/main/screen-capture.js`
  - [ ] Use Electron `desktopCapturer` for screen capture
  - [ ] Save PNG to temp directory
  - [ ] Return path + size + thumbnail
- [ ] Manual button implementation
  - [ ] Click → capture → thumbnail in attachment bar
  - [ ] Include screenshot context in Claude message
- [ ] Auto-detection implementation
  - [ ] Check user input against visual triggers (explicit list)
  - [ ] Check against learned triggers from knowledge DB
  - [ ] Auto-capture + "📸 Screen captured" toast
- [ ] Learning implementation
  - [ ] Track phrases when user manually clicks Screen
  - [ ] Add new phrases to learned triggers (low confidence)
  - [ ] Increase confidence on repeated manual captures
  - [ ] Decrease confidence on false positives
- [ ] **VERIFY**: Click Screen → thumbnail → Claude responds. "look at this" → auto-capture

## Phase 9: Global Hotkey + Microphone
- [ ] Create `src/main/hotkey-manager.js`
  - [ ] Register F2 as global hotkey via `globalShortcut`
  - [ ] Toggle mic recording via IPC
  - [ ] Bring window to focus if minimized
  - [ ] Unregister on app quit
- [ ] Create `src/renderer/js/mic-controller.js`
  - [ ] `getUserMedia` audio capture
  - [ ] `MediaRecorder` for recording chunks
  - [ ] Visual recording indicator (red pulse)
  - [ ] v1: "Transcription coming soon" tooltip
  - [ ] v2: Integrate Whisper via `@xenova/transformers`
- [ ] **VERIFY**: Press F2 from any app → window activates, mic indicator pulses

## Phase 10: Polish & Enhancements
- [ ] Streaming responses via `--output-format stream-json`
- [ ] `--json-schema` for reliable structured output
- [ ] Scrollable conversation history panel
- [ ] Character pack switcher in settings menu
- [ ] Error recovery: auto-restart session if `--resume` fails
- [ ] Sound effects (optional): keypress, notification chime
- [ ] Package with `electron-builder` for distribution
- [ ] **FINAL VERIFY**: Complete end-to-end test of all features
