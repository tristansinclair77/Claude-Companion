# Claude Companion — Working Instructions for Claude

## Work Strategy

### Write-First, Verify-Second
Always write ALL source files to disk before doing verification runs. This way, if context
limits are hit, no work is lost. Files on disk are permanent checkpoints.

When resuming, read the existing files to understand current state, then continue from
the right phase.

### Keep RESUME_INSTRUCTIONS.md Current
After every significant batch of work, update `RESUME_INSTRUCTIONS.md` so it accurately
reflects the current state of the project. A fresh Claude session should be able to read
that file and immediately know:
- What has been built
- What phase we're on
- What is left to do
- Any known issues or decisions made

### Context Management
- Write files in batches — don't pause to test after each individual file
- Update RESUME_INSTRUCTIONS.md at natural stopping points (end of a phase)
- Use MEMORY.md for cross-session patterns and preferences
- This project's design docs live at the root:
  - `DEVELOPMENT_PLAN.md` — architecture and phases
  - `CHECKLIST.md` — granular task list
  - `AI_LEARNING.md` — neural brain design
  - `MEMORY_AND_SESSIONS.md` — session and memory system

## Project: Claude Companion

### What it is
Electron desktop AI companion app with 1980s/90s anime cyberpunk UI.
Backend: `claude -p` CLI (user's Max plan). Local learning brain routes simple
queries locally; novel queries go to Claude.

### Key Technical Facts
- **Platform**: Windows, Electron 40.x, Node 22.15.0
- **ELECTRON_RUN_AS_NODE=1** is set by the VSCode/Claude Code terminal.
  Always launch via `node scripts/launch.js` (which clears this env var).
  `npm start` calls this script.
- **better-sqlite3** requires `electron-rebuild` after install (already done).
- **Claude CLI**: spawned as `claude.cmd -p "<prompt>" --output-format json --system-prompt "<sys>"`
  Every call is a FRESH session — full context (core rules + character + memories + window) is
  injected every time. No `--resume` flag.
- **Response format**: Claude must output `[DIALOGUE]`, `[THOUGHTS]`, `(emotion_id)`, optional `[MEMORY]` lines.
- **19 emotions**: neutral, happy, soft_smile, laughing, confident, smug, surprised, shocked,
  confused, thinking, concerned, sad, angry, determined, embarrassed, exhausted, pout, crying, lustful_desire
- **3-tier brain router**: Filler (instant JSON) → Local (SQLite FTS5 + Jaccard) → Claude CLI
- **Source indicator**: FILLER ● (green) / LOCAL ● (orange) / CLAUDE ● (cyan) in title bar

### Directory Structure
```
src/
  main/          ← Electron main process
    main.js      ← App bootstrap + all IPC handlers
    claude-bridge.js
    local-brain.js
    knowledge-db.js
    session-manager.js
    screen-capture.js
    file-handler.js
    web-fetcher.js
    hotkey-manager.js
    neural/      ← Phase 2 neural micro-models (future)
  preload/
    preload.js   ← contextBridge IPC exposure
  renderer/
    index.html   ← Full UI
    styles/      ← main.css, crt-effects.css, animations.css
    js/          ← app.js, chat-controller.js, companion-display.js,
                    emotion-picker.js, file-attach.js, screen-capture-ui.js,
                    source-indicator.js, ui-effects.js, mic-controller.js
  shared/
    constants.js
    core-rules.js
    system-prompt.js
    response-parser.js
characters/
  default/       ← Aria character pack
    character.json, rules.json, filler-responses.json
    emotions/    ← 19 placeholder PNG images
    knowledge.db ← created at runtime
assets/icons/
scripts/
  launch.js      ← clears ELECTRON_RUN_AS_NODE, launches electron
  gen-placeholder-emotions.js
```
