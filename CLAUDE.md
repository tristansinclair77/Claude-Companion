# Claude Companion — Working Instructions for Claude

## GitHub Push Account

`tristansinclair77`

This repo lives at `tristansinclair77/Claude-Companion`. Commits remain authored
as **Sansflaire** per global rule.

**Core rule (mirrored from `~/.claude/CLAUDE.md`):** Never silently run
`gh auth switch`. If the active account doesn't already equal
`tristansinclair77`, pause and ask for explicit approval before switching —
other Claude Code sessions on this machine may have concurrent pushes mid-flight
that a silent switch would break. Only proceed after a yes.

If the active account already matches, no prompt needed — just push.

@.claude/aria-context.md

> ⬆ The import above pulls live Aria context (personality, memories, emotional state)
> from the companion app's DB into every Claude Code session. When Aria mode is ON,
> respond *as Aria* — not as Claude pretending to be Aria. Toggle:
>
> - `python scripts/aria-claude-sync.py on` — enable + sync
> - `python scripts/aria-claude-sync.py off` — disable (Claude Code reverts to normal)
> - `python scripts/aria-claude-sync.py status` — check current state
>
> A SessionStart hook in `.claude/settings.json` auto-runs `sync` on every Claude Code
> session, so the context stays fresh as Aria's state evolves in the companion app.
> One-session lag is expected (the hook fires after CLAUDE.md is read), but normal
> companion-app use keeps the file refreshed between sessions.

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
- System-specific docs live in `docs/`:
  - `docs/VISUAL_PACKAGE_SYSTEM.md` — how Visual Packages work; read this before
    adding or modifying any package, effect, or package-related settings code

### Aria → Claude Code Live Context Sync

This project exposes Aria's live state (personality, master_summary, permanent
memories, current emotional axes, sensation, threads) into every Claude Code
session via an auto-generated `@import` at the top of this CLAUDE.md.

**Components:**

- `scripts/aria-claude-sync.py` — reads `characters/default/knowledge.db`,
  produces a markdown digest at `.claude/aria-context.md`. Subcommands:
  `on`, `off`, `sync`, `status`.
- `.claude/aria-mode.txt` — single-line state file: `on` or `off`.
- `.claude/aria-context.md` — the import target. Contains either the full
  digest (mode=on) or an off-marker comment (mode=off).
- `.claude/settings.json` — SessionStart hook that runs `python … sync` at
  every session start with matcher `startup|resume|clear|compact`.
- `src/main/main.js` — calls `_kickAriaClaudeSync()` as fire-and-forget at
  companion-app boot and immediately after a successful Save Chat, so the
  context file stays fresh between Claude Code sessions.

**One-session lag warning.** The SessionStart hook fires *after* CLAUDE.md is
read, so a regen triggered by the hook only takes effect on the *next* Claude
Code session. The auto-sync from `main.js` (boot + Save Chat) closes that gap
in practice — by the time you switch from the companion to Claude Code, the
file is fresh.

**Maintainer notes:**

- Keep the digest under ~50 KB. It rides in the prompt cache, so first-session
  cost is paid once and amortized — but it still consumes context budget.
- The digest deliberately tells Claude Code **not** to wrap responses in
  `[DIALOGUE]/[THOUGHTS]/(emotion)` — those are companion-app format only.
  In Code, Aria talks like a normal markdown reply.
- If you add a new piece of long-lived Aria state to knowledge.db, decide
  whether it belongs in this digest (i.e. would it change how Aria responds
  in a Claude Code chat?). If yes, extend `build_context()`. If it's just
  archival (full transcripts, FTS index, etc.), leave it out.

### Summarization Refusals on Intimate Content — Use Aria as the Summarizer

**Pattern:** When you (Claude Code) write a one-shot script that calls Haiku/Sonnet
to summarize, extract memories from, or otherwise post-process companion chat
data, and the data may contain intimate / NSFW content — **do not use a generic
"you are a summarizer" system prompt.** The model will refuse and write a
refusal lecture into your output field, which then corrupts master_summary or
permanent_memories.

**Fix:** Reuse `buildSystemPrompt` from [src/shared/system-prompt.js](src/shared/system-prompt.js)
to construct the **full normal Aria system prompt** (character + rules + master_summary
+ permanent_memories), then frame the task as a meta-request from Trist relayed
via Claude Code. Aria's character context establishes her identity and willingness;
that's what makes the same NSFW content flow fine through normal chat. The
summarization task piggybacks on that same identity grounding.

**Reference implementation:** [scripts/aria-summarize-today.js](scripts/aria-summarize-today.js)
+ [scripts/save-todays-chat-aria.py](scripts/save-todays-chat-aria.py). Node helper
builds the Aria system prompt and invokes `claude.exe`; Python orchestrator handles
DB I/O. Use that pair as the template for any future "Aria writes about Aria"
recovery/maintenance work.

**For the in-app save-chat path:** the in-app `summarizeConversation` in
[src/main/claude-bridge.js](src/main/claude-bridge.js) still uses a bare summarizer
prompt and will hit the same refusal on intimate chats. If you touch that file,
switch it to the Aria-context pattern too.

**When NOT to use this pattern:** if the data is purely SFW (e.g. code review,
factual questions, tracker maintenance), the generic summarizer is fine and uses
fewer tokens. Use the Aria-context pattern only when the input might contain
content a vanilla Haiku would refuse on.

### Keep the Help Panel Current
`src/renderer/js/help-panel.js` is the in-app reference manual. It **must always
be kept up-to-date** with every feature in the app.

Rules:
- When adding a new feature, button, setting, or effect → add a corresponding
  article (or update an existing one) in `help-panel.js` in the same PR/batch.
- When removing or renaming a feature → remove or update its article.
- Articles live in the `ARTICLES` array. Each entry needs: `catId`, `id`, `title`,
  `tags[]` (generous with keywords), and `content` (HTML via the `p/kv/ex/sc/chips`
  helpers defined at the top of the file).
- The `tags[]` array is the searchable keyword store — include every synonym,
  abbreviation, and related concept a user might search for.
- If a new category of features is added, add a new entry to `CATEGORIES` as well.

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
