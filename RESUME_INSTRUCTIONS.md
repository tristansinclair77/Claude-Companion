# Resume Instructions for Claude

Read `CLAUDE.md` first — it has working instructions, project overview, and key technical facts.
Then read this file to know exactly where we are.

---

## Current State (updated after Emotion Expansion + Emotional Axis System)

The app is running and functional. All Phase 1–9 files are on disk. Phase 10 complete. [SELF] tag, debug logging, Save Conversation, improved memory extraction, retroactive memory scan, 38 single emotions + 27 combined/blended emotions, persistent 4-axis emotional state system, and Emotional Axis Monitor pop-out are all implemented.

---

## What Is Complete

### Phases 1–9 ✅ — All source files written (see DEVELOPMENT_PLAN.md for details)

### Phase 10 Work Done ✅

**Fixed: Claude CLI hang** — `src/main/claude-bridge.js`
- Strips Electron/VSCode env vars before spawning, closes stdin immediately,
  stderr logging, 120s timeout, uses `node cli.js` directly, `--dangerously-skip-permissions`.

**Fixed: Screenshare crash** — `src/main/claude-bridge.js`
- Stdin error handler, `--input-format stream-json` with base64 image via stdin.

**Fixed: Conversation memory lost on restart**
- `knowledge-db.js` — `insertMessage()` + `getRecentMessages(n)`
- `session-manager.js` — `loadFromDB()` restores `messageWindow`
- `main.js` — loads last 30 messages on startup; saves every message to DB

**Added: Contradicting memory handling**
- `response-parser.js` — parses `[MEMORY_UPDATE]` → `memoryUpdates[]`
- `system-prompt.js` — instructs Claude to use `[MEMORY_UPDATE]` for corrections
- `knowledge-db.js` — `replaceMemory()` with Jaccard deactivation of old facts
- `local-brain.js` — handles `memoryUpdates` after Claude response

**Fixed: Memory extraction too conservative** — `system-prompt.js`

**Fixed: Local brain never firing** — `constants.js`
- `CONFIDENCE_THRESHOLD` lowered 0.75 → 0.25 (old value was unreachable)

**Added: RAG context injection**
- `knowledge-db.js` — `searchRelatedContext(query, limit)`
- `local-brain.js` — retrieves related past Q&A before Claude call
- `claude-bridge.js` — injects recalled context into prompt (400-char snippets)

**Utilities:**
- `RUN.bat` — double-click launcher
- `C:/Users/trist/AppData/Local/Temp/dbquery.js` — DB inspection script
  Run: `ELECTRON_RUN_AS_NODE=1 "node_modules/electron/dist/electron.exe" "C:/Users/trist/AppData/Local/Temp/dbquery.js" "characters/default/knowledge.db"`

---

## [SELF] Tag Feature ✅ (implemented)

**Problem solved:** Aria states a preference (e.g., "matcha ice cream") and now remembers it across sessions.

**What was done:**
1. `src/shared/response-parser.js` — parses `[SELF] category: fact` → `selfFacts[]`; also strips `[SELF]` from display text
2. `src/shared/system-prompt.js`:
   - `buildSystemPrompt` now accepts raw memory objects array (not pre-formatted string)
   - Splits memories by `source`: user memories vs `companion_self`
   - Injects `=== WHAT YOU'VE TOLD THE USER ABOUT YOURSELF ===` section for companion_self memories
   - Added `[SELF]` instruction + example to the response format block
   - Added `formatMemoryList()` internal helper; `formatPermanentMemories()` kept for compat
3. `src/main/claude-bridge.js` — passes raw `permanentMemories` array directly to `buildSystemPrompt` (removed `formatPermanentMemories` import/call)
4. `src/main/local-brain.js` — after Claude response, stores `selfFacts` via `db.insertMemory({ ..., source: 'companion_self' })` and syncs session manager

No schema changes — reuses `permanent_memories` table with `source = 'companion_self'`.

---

## Debug Session Logging ✅ (implemented)

**What was done:**
- `src/main/debug-logger.js` — singleton logger, rolling 5-slot history
  - On each app start: slot-5 deleted, slots shift down (4→5, 3→4...), fresh slot-1 created
  - Each slot: `debug-sessions/slot-N/meta.json` + `session.jsonl` (one JSON event per line)
- `main.js` — calls `logger.init()` before brain init; logs `startup` event with memory counts
- `local-brain.js` — logs: `user_message`, `route_filler`, `route_local_hit`, `route_local_miss`, `memory_ops`, `error`
- `claude-bridge.js` — logs: `claude_call` (full system prompt + user prompt + memories injected + relatedContext), `claude_response` (raw + parsed dialogue/emotion/memories), `error`

**Reading logs:**
- Open `debug-sessions/slot-1/session.jsonl` (most recent session)
- Each line is valid JSON. Use `JSON.parse(line)` per line, or search with grep for specific `type` fields.
- `slot-1` = most recent, `slot-5` = oldest (5 sessions kept)

---

## Save Conversation Feature ✅ (implemented)

**What it does:** User clicks "💾 SAVE CHAT" button → Claude summarizes the conversation → summary stored in `conversation_sessions` DB table AND appended to `master_summary` (so Aria remembers it in future sessions). Full message transcript stored as `messages_json` in same row.

**Files changed:**
1. `knowledge-db.js` — schema migration (`ALTER TABLE conversation_sessions ADD COLUMN messages_json`), added `insertConversationSession`, `getAllConversationSessions`, `getConversationSessionById`
2. `claude-bridge.js` — added `summarizeConversation({ messages, characterName })` — spawns Claude with plain-text system prompt, returns `{ summary }`
3. `main.js` — imports `summarizeConversation`; calls `registerDebugViewerIPC(win, db)` (passes DB); added `conversation:save` IPC handler
4. `preload/preload.js` — exposed `saveConversation: () => ipcRenderer.invoke('conversation:save')`
5. `src/renderer/index.html` — added `💾 SAVE CHAT` button to action buttons
6. `src/renderer/js/chat-controller.js` — handles save button click, shows toast on success/failure
7. `debug-viewer-ipc.js` — `registerDebugViewerIPC(mainWindow, db)` now accepts db; added standalone DB getter (read-only); added `debug-viewer:list-saved-conversations` and `debug-viewer:load-saved-conversation` IPC handlers
8. `preload/debug-preload.js` — exposed `listSavedConversations` and `loadSavedConversation`
9. `src/renderer/debug-viewer.html` — added "SAVED CHATS" button in title bar; added `#saved-overlay` panel (list + transcript panes)
10. `src/renderer/js/debug-viewer.js` — added `bindSaved()`, `openSavedPanel`, `renderSavedList`, `loadSavedConversation`, `renderSavedTranscript`

**How the debug viewer SAVED panel works:**
- Click "SAVED CHATS" → overlay appears (full-screen over debug view)
- Left: list of saved conversations (date, preview, message count)
- Right: full transcript for selected conversation (user in cyan, Aria in purple), with summary at top
- "◂ BACK" button returns to normal debug session view

**Other fixes this session:**
- Screenshare: `--output-format stream-json` (was `json` — caused crash when `--input-format stream-json`)
- Emotion picker now resets to blank after each message send

## Memory System Improvements ✅ (this session)

**Problem:** Aria was not capturing enough memories from emotional/intimate conversations — especially `[SELF]` facts about her own desires and relationship dynamics.

**Root cause analysis:**
- The old `[SELF]` instruction was too passive ("if you state a fact about yourself")
- The `[MEMORY]` instruction only mentioned user-shared facts, not relationship milestones
- No "SELF-KNOWLEDGE REMINDER" paralleling the MEMORY EXTRACTION REMINDER

**Fixed in `src/shared/system-prompt.js`:**
- Expanded `[SELF]` instruction with concrete examples: feelings/desires toward user, dream scenarios, intimacy preferences, relationship roles accepted, confessions
- Expanded `[MEMORY]` instruction to include relationship milestones (nicknames, proposals, shared roleplay, emotional moments)
- Added `relationship, milestone, shared_experience, emotional_moment` to [MEMORY] categories
- Added `SELF-KNOWLEDGE REMINDER` block (parallel to MEMORY EXTRACTION REMINDER) emphasizing aggressive [SELF] use during emotional/intimate/imaginative conversations
- Added explicit: "Do NOT skip [SELF] just because you are in a roleplay or fantasy — the feelings and revelations are still genuinely yours."

---

## Session Save + Extract Memories ✅ (this session)

**New features in the Debug Viewer:**

### SAVE SESSION button
- Appears in the debug viewer title bar; enabled when a slot is loaded
- Reads the JSONL session, extracts user/Aria message pairs
- Calls `summarizeConversation` → stores as `conversation_session` in DB
- Appends summary to `master_summary` (so Aria remembers it in future sessions)
- Viewable in SAVED CHATS panel

### EXTRACT MEM button
- Also in title bar, enabled when slot is loaded
- Sends the full conversation to Claude with a memory-extraction-only system prompt
- Claude outputs only `[MEMORY]` and `[SELF]` tags
- Results inserted into `permanent_memories` with Jaccard dedup
- Can be run multiple times after improving the memory system
- **Also appears per-row in the SAVED CHATS panel** for saved conversations

**New function `extractMemories()` in `claude-bridge.js`:**
- Plain prompt: no character persona, just "extract memories from this conversation"
- System prompt specifically asks for: user facts, Aria self-facts, relationship milestones
- Parses `[MEMORY]` → user facts; `[SELF]` → companion_self facts

**Files changed:**
1. `src/shared/system-prompt.js` — improved [SELF]/[MEMORY] instructions + SELF REMINDER
2. `src/main/claude-bridge.js` — added `extractMemories()`, updated exports
3. `src/main/debug-viewer-ipc.js` — fixed misplaced handlers (moved inside function); added `getKdb()` for write access; added `save-slot-to-memory` and `extract-memories` IPC handlers
4. `src/preload/debug-preload.js` — exposed `saveSlotToMemory`, `extractMemories`
5. `src/renderer/debug-viewer.html` — added SAVE SESSION and EXTRACT MEM buttons to title bar
6. `src/renderer/js/debug-viewer.js` — enabled buttons on slot load; added `saveCurrentSession`, `extractCurrentSessionMemories`, `runExtractMemories`, `showNavToast`; added per-row EXTRACT MEM button in saved conversations list

**Also fixed:** The `list-saved-conversations` and `load-saved-conversation` handlers were accidentally placed outside `registerDebugViewerIPC()` (a bug from last session). Fixed by moving them inside the function — they now have proper access to the `db` parameter.

---

## Character Pack: Appearance Reference ✅ (this session)

**Schema change:** Character packs now support a visual identity reference.

**New required files in a character pack:**
- `appearance.json` — detailed text description of the character's physical appearance
- `character_reference.png` — a reference image (face/body shot or character sheet)
- `art/` folder — optional additional artwork

**`character.json` now includes:**
```json
{
  "character_reference_image": "character_reference.png",
  "appearance_file": "appearance.json",
  ...
}
```

**`appearance.json` schema:** `character`, `character_reference_image`, `art{}`, `height`, `build`, `hair`, `eyes`, `skin`, `face`, `outfit{}`, `accessories{}`, `color_palette{}`, `visual_notes[]`, `self_description`

**What happens at runtime:**
- `main.js` `loadCharacterPack()` loads `appearance.json` and merges it into the `character` object as `character._appearance`
- `system-prompt.js` section 3 injects a `=== YOUR PHYSICAL APPEARANCE ===` block with all appearance fields formatted as readable text
- Aria now knows exactly what she looks like and will describe herself consistently

**Aria's character pack files:**
- `character_reference.png` — three-quarter back/face view (from art images)
- `art/aria_front_body.png` — front-lower body shot
- `art/aria_back.png` — full back shot
- `art/aria_side_face.png` — three-quarter face view
- NOTE: The formal character reference sheet (multi-view technical document) should be saved as `character_reference_sheet.png` when available

---

## Debug Viewer ✅ (this session)

**New standalone tool:** `COMMANDS/DEBUG_VIEWER.bat` (or `npm run debug-viewer`)
- Launches Electron with `--debug-viewer` flag — no companion window, no logger rotation
- Reads rolling `slot-1..5` sessions AND pinned `saved-*` sessions
- Same cyberpunk UI aesthetic as companion app

**Features:**
- Slot buttons 1–5 (rolling sessions) + `📌 S1, S2...` buttons for pinned sessions
- `←`/`→` arrows + keyboard to navigate exchanges
- Displays: dialogue, thoughts, emotion badge, portrait, new memories (per-exchange)
- `MEM ●` indicator in nav bar when an exchange has memory extractions
- **SYS-PROMPT** button → pop-out window with full injected system prompt
- **📌 PIN** button → copies current slot to `saved-N` (immune to rotation)
- **SAVE SESSION** → summarizes + saves to DB (appends to master_summary)
- **EXTRACT MEM** → runs Claude memory extraction on full session, shows results pop-out
- **SAVED CHATS** → overlay showing all DB-saved conversation summaries + transcripts

**Files:**
- `src/main/debug-viewer-ipc.js` — all IPC (list slots, parse JSONL, pin, save, extract)
- `src/preload/debug-preload.js` — preload for debug window
- `src/renderer/debug-viewer.html` — viewer UI
- `src/renderer/js/debug-viewer.js` — all viewer logic
- `scripts/launch-debug-viewer.js` — launcher (mirrors launch.js, passes --debug-viewer)

**ENAMETOOLONG fix (this session):**
- `src/main/claude-bridge.js` — always uses `--input-format stream-json` (stdin) for ALL calls
- Previously only screenshots used stdin; text mode used `-p` CLI arg which hit Windows 32KB limit on long conversations
- System prompt (~5KB) stays as CLI arg; full conversation window travels via stdin (no limit)

**Claude CLI note:** command is now `node cli.js --input-format stream-json --output-format stream-json --system-prompt <sys> --dangerously-skip-permissions` with user message as JSON via stdin.

---

## Emotion Expansion + Axis System ✅ (latest session)

### 38 Emotions (was 19)
- Added 19 new extended emotions: `excited`, `loving`, `nervous`, `longing`, `curious`, `disappointed`, `relieved`, `playful`, `proud`, `apologetic`, `content`, `flirty`, `flustered`, `in_awe`, `in_pleasure`, `sleepy`, `sickly`, `wheezing_laughter`, `frantic_desperation`
- Images in `characters/default/emotions/` (real art)
- Updated `constants.js`, `emotion-picker.js`, `companion-display.js`

### 27 Combined/Blended Emotions
- Pairs of compatible emotions (e.g. `happy_confused`, `sad_angry`, `flustered_nervous`)
- Images in `characters/default/emotions/combined/` (placeholder colored PNGs — replace with real art)
- Defined in `constants.js`: `COMBINED_EMOTIONS`, `COMBINED_EMOTION_MAP`
- `response-parser.js` validates blended IDs via `COMBINED_EMOTION_MAP`
- `companion-display.js` loads from `combined/` subfolder, shows both emojis in badge
- System prompt lists all blended IDs by tier so Claude knows when to use them
- Script: `scripts/gen-placeholder-combined.js` regenerates placeholders

### 4-Axis Persistent Emotional State
- **Axes:** Valence, Arousal, Social, Physical (0–100 each)
- **Storage:** `emotional_state` table in `knowledge.db` (single row, persists forever)
- **Drift:** After each response, axes drift 15% toward the emitted emotion's axis profile (`EMOTION_AXES` in constants.js)
- **System prompt:** Current axis values injected as `=== YOUR CURRENT EMOTIONAL BASELINE ===` so Claude knows Aria's resting state
- **DB methods:** `getEmotionalState()`, `setEmotionalState({valence, arousal, social, physical})`
- **Wired through:** `local-brain.js` → `claude-bridge.js` → `buildSystemPrompt`; drift computed + saved in `main.js` after every response
- **Renderer:** Compact 4-bar meter strip in portrait panel (`companion-display.js`: `updateMeters(state)`)

### Emotional Axis Monitor Pop-out
- Button: **💠 AXIS** in main action bar
- Opens `src/renderer/emotional-state.html` — dedicated frameless window (400×540)
- Shows all 4 axes as large color-interpolated bars with pole labels, current value, description
- Shows last emitted emotion (emoji + label)
- Live updates pushed from `main.js` via `state:update` IPC after each response
- **Reset button** resets axes to neutral baseline (V:50, A:40, S:50, P:70)
- Files: `src/preload/emotional-state-preload.js`, `src/renderer/emotional-state.html`
- IPC channels: `emotional-state:open`, `emotional-state:minimize`, `emotional-state:close`, `emotional-state:get`, `emotional-state:reset`
- `main.js`: `pushEmotionalStateUpdate(state, emotionId)` called after every axis update

---

## Other Known Gaps

- **Master summary bloat** — `appendToMasterSummary` just concatenates; may grow large over many saves. Future: periodically re-summarize the master summary itself.
- **Mic** — stub only ("coming soon" toast). Whisper = future work.

---

## Key Technical Reminders

- Launch: `npm start` or `RUN.bat` (never `electron .` directly — ELECTRON_RUN_AS_NODE)
- Claude CLI: `node <cli.js path> --input-format stream-json --output-format stream-json --system-prompt <sys> --dangerously-skip-permissions` with user message JSON via stdin (always stream-json now — fixes Windows ENAMETOOLONG)
- DB: `better-sqlite3` built for Electron — cannot load with system Node.js
