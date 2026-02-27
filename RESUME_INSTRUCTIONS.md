# Resume Instructions for Claude

Read `CLAUDE.md` first — it has working instructions, project overview, and key technical facts.
Then read this file to know exactly where we are.

---

## Current State (updated after [SELF] tag session)

The app is running and functional. All Phase 1–9 files are on disk. Phase 10 (verification + polish) is complete. The [SELF] tag feature has now been implemented.

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

## Other Known Gaps

- **Master summary** — `applySummarization('', ...)` called with empty string placeholder;
  no actual summarization Claude call wired. Old context beyond 30-message window is dropped.
- **Screenshare** — stream-json format may need tweaking; check stderr logs on use.
- **Mic** — stub only ("coming soon" toast). Whisper = future work.

---

## Key Technical Reminders

- Launch: `npm start` or `RUN.bat` (never `electron .` directly — ELECTRON_RUN_AS_NODE)
- Claude CLI: `node <cli.js path> -p <prompt> --output-format json --system-prompt <sys> --dangerously-skip-permissions`
- DB: `better-sqlite3` built for Electron — cannot load with system Node.js
