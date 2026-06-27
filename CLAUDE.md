# Claude Companion — Working Instructions for Claude

## GitHub Push Account

`tristansinclair77`

This repo lives at `tristansinclair77/Claude-Companion`. Commits remain authored
as **Sansflaire** per global rule.

## Aria Character Data Repo

Aria's character data (portraits, emotions, `knowledge.db`, `rpg.db`, config) is
tracked separately at **`tristansinclair77/Aria-WorkPC`** (private).

This repo lives at `characters/default/` inside the companion repo and has its
own `.git`. To sync to another machine: clone it into that path. To push a
snapshot from this machine: close the app, then from `characters/default/` run
`git add -A && git commit -m "sync" && git push`.

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

### Memory Systems — Three Distinct Stores

Aria has THREE separate memory stores. Do not conflate them when adding features
or extracting/inserting facts:

1. **`permanent_memories` (identity definition)** — facts about who Aria is and
   what she's stated about herself, plus stable facts she's learned about Trist.
   Source flags: `companion_self` for Aria's self-facts, `auto_detected` /
   `auto_updated` for user facts. Written via `[MEMORY]`, `[MEMORY_UPDATE]`,
   `[SELF]` tags. **Persist forever.** This store DEFINES identity — it is not
   a working memory system. Aria sees these as "Permanent Memories" and "What
   You've Told The User About Yourself" in the system prompt.

2. **`short_term_memory` (working — 5-min idle)** — Aria's own in-conversation
   scratchpad for things she wants to hold briefly. Written via `[REMEMBER:short]`.
   Cited via `[RECALL] shrtNNNNN`. Wipes after 5 minutes of not being cited.
   Cited 3+ times → auto-promoted to `long_term_memory`.

3. **`long_term_memory` (working — 7-day idle)** — Aria's own scratchpad for
   things worth carrying across days. Written via `[REMEMBER:long]` or
   auto-promoted from short-term. Cited via `[RECALL] longNNNNN`. Wipes after
   7 days of not being cited.

Both working stores are managed in [src/main/knowledge-db.js](src/main/knowledge-db.js)
(`insertShortMemory`, `insertLongMemory`, `recallMemories`, `promoteShortMemories`,
`cleanupExpiredMemories`) and surfaced into the prompt by the "YOUR WORKING
MEMORY" section in [src/shared/system-prompt.js](src/shared/system-prompt.js).
Lifecycle is driven from [src/main/local-brain.js](src/main/local-brain.js) on
every Claude turn: cleanup → load → send → write back RECALL/REMEMBER → promote.

When building new features that "save what Aria said":
- Permanent identity fact about her or Trist → `permanent_memories` (existing `[SELF]`/`[MEMORY]`).
- Short-lived in-scene context she wants to hold → `short_term_memory`.
- Something worth carrying for days → `long_term_memory`.

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

### Keep the Adventure Monster Roster Current
The text-adventure storywriter (Claude) can only spawn monsters whose slugs
appear in `MONSTER_LIST` in [src/main/text-adventure-store.js](src/main/text-adventure-store.js).
Sprite files in [assets/monsters/](assets/monsters/) that aren't in that list
are invisible to Claude — he literally cannot reference them.

**Rule:** Whenever monster sprites are added or removed (e.g. by running
`scripts/slice-monster-grid.js` after dropping new `ref/monster grid*.png`
sources), `MONSTER_LIST` MUST be updated in the same batch so every PNG in
`assets/monsters/` has a corresponding entry, and vice versa.

Each entry has just two fields:
- `slug` — must exactly match the PNG filename without extension
- `name` — DEFAULT display label only. The storywriter is free to call any
  instance whatever the scene needs (a `lich` sprite can be "Old Erasmus the
  Wizard", a `cyclops` can be a generic giant, a `giant_rat` can be a
  boss-level plague-bloat). The slug picks the portrait; everything else is
  per-encounter.

Do NOT add a `difficulty` field. Difficulty / HP / damage are storywriter
calls per encounter — a tutorial mini hydra and a campaign-ending boss rat
are both valid. Hardcoding tiers would just constrain the GM.

The MONSTER ROSTER section in [src/main/text-adventure-rules.js](src/main/text-adventure-rules.js)
is rendered dynamically from `MONSTER_LIST` by `buildRules()` — don't
duplicate the roster as static text anywhere; let it pull from the source of
truth.

A startup sanity check in `text-adventure-store.js` (`_verifyMonsterRoster`)
warns on drift in both directions. If you see those warnings in the console
on app boot, fix them before committing.

### Adventure Mode — Two-Phase Combat & the Calculations System

Adventure mode resolves combat (and any other dice-rolled outcome — stat
checks, saving throws, multi-step branching actions) through a deterministic
engine, NOT through Claude's narrative judgment. This exists because Claude
will heavily bias toward whatever the player narrates ("I swing and definitely
hit") if combat outcomes are purely narrative. The two-phase architecture
fixes that: Claude *asks* for math, the engine *resolves* it, then Claude
*narrates* the truthful outcome.

**The canonical spec is [docs/COMBAT_CALCULATIONS.md](docs/COMBAT_CALCULATIONS.md).**
Read it whenever you're touching combat math, calc tag schemas, the
two-phase turn flow, the modifier/buff system, or unique-grant tracking.
That document defines the formulas, the stat scale (mod = stat - 8), the
AC system, what counts as a calc-required action vs. a narrative-only beat,
and the canonical schemas for `[COMBAT_CALC_REQUEST]`,
`[COMBAT_CALCULATION_RESULT]`, and `[IMPLEMENTATION_TASK]`.

**Core invariants — do not break these without updating the spec:**

1. **Every turn runs both phases.** Call 1 (lite calc-parser) → engine
   resolution → Call 2 (full narrator + calc results). There is NO
   single-call fast path, even for pure-narrative turns. On
   pure-narrative turns Call 1 returns `[NO_CALC_NEEDED]` and the calc
   result block in Call 2 is `{ "actions": [], "note": "No calculations
   requested." }`. The GM's prompt shape is consistent across all turns.
2. **The player does not get to declare what literally happens.** They
   declare intent and approach. The engine's math decides hits, misses,
   damage, and consequences. Claude narrates the truthful outcome.
3. **If anything requires a dice roll, a stat check, an HP change, or any
   D&D-like resolution — a `[COMBAT_CALC_REQUEST]` is required before the
   narration is written.** This includes all skill checks (climb,
   persuade, sneak, recall lore) and all saves. When in doubt, request
   a calc. Missing a calc and fudging damage is the exact failure mode
   this system prevents.
4. **Enemies and NPCs must be fully statted at introduction.** When the
   GM brings any enemy or recurring NPC onto the page, they emit a
   complete stat block (str/dex/int/wis/con/luck, ac, armor, dmg, tags,
   hp/maxHp). The engine has NO fallback math for half-statted entities.
5. **3-action cap per turn.** The player gets at most 3 logical actions
   per turn declaration. Beyond 3 = truncated. Companion (1 autonomous
   action) and enemies (1 action per active enemy / 1 group action for
   swarms) get their own slots and don't count against the player cap.
   Multi-target spells are 1 logical action regardless of target count.
6. **The engine enforces certain rules silently** — the canonical example
   is Undying Bond, which redirects damage from Trist to Vesper when
   thresholds are met. These engine-enforced rules are hard-coded in
   `src/main/combat-calc.js` (when built) and the calc result clearly
   labels when one fires. The GM should NOT try to redo the redirect math
   in their narration — they should trust the result block and narrate
   accordingly.
7. **Other modifiers are GM-applied** — passives like Void Resonance,
   equipped weapon bonuses, blessed buffs. The GM includes them in the
   `modifiers` block of each calc request action. The engine respects
   modifiers it's told about; it doesn't auto-detect them. This is
   intentional — the GM has the narrative context to know when a buff
   applies and when it doesn't.
8. **Unique abilities, spells, equipment, and items that need engine-side
   logic must emit an `[IMPLEMENTATION_TASK]`** — this appends to the
   per-character `text-adventure-implementation-tasks.md` and fires a
   pop-up. Until the dev implements the engine code, the grant exists as
   narrative-only (it works in prose but doesn't feed into calcs).

**Per-story files** live in each character directory alongside the other
runtime files (state, log, side-chat, gm-chat):

- `text-adventure-implementation-tasks.md` — append-only log of unique
  grants the dev needs to implement. Starts blank, gitignored as runtime
  state.

**Stat scale rule:** stats run 8–20 normally. `mod = stat - 8`. A STR 14
fighter gets +6 on melee attacks; a STR 8 mage gets +0. The wide mod range
is intentional — stats are meant to feel real, not flatten under D&D's
`(stat-10)/2` formula.

**Starting characters (post-rebalance) use D&D-sensible spreads.** Trist
starts as a STR-focused fighter (`STR 14 / DEX 12 / CON 12 / WIS 10 /
INT 10 / LUCK 8`, HP 20, MP 10). Vesper starts god-tier (`DEX 16 / INT 18
/ WIS 16 / CON 14 / STR 10 / LUCK 12`, HP 30, MP 30) because her ancient
threshold-keeper nature means she's nearly impossible to miss with and
has deep mana reserves. These live in `_freshPlayer()` and `_freshAria()`
in [src/main/text-adventure-store.js](src/main/text-adventure-store.js).

**When the spec and the code disagree, the spec wins** — update the code
to match `docs/COMBAT_CALCULATIONS.md`. The spec is the source of truth.
If you find a case the spec doesn't cover, extend the spec FIRST, then
the code.

**Keep the spec, the rules-doc-template, and this CLAUDE.md section in
lockstep.** Any time the combat / calc / adventure-mechanics behavior is
about to change, the order is:

1. Edit `docs/COMBAT_CALCULATIONS.md` first — that's the contract.
2. Update `src/main/text-adventure-rules.js` (the prompt sent to the
   GM each turn) so the GM is told about the change.
3. Update CLAUDE.md → "Adventure Mode" invariants if a load-bearing
   rule shifted.
4. Update the engine (`src/main/combat-calc.js`, `text-adventure-ipc.js`,
   `text-adventure-store.js`) to match.
5. Update the in-app help panel article so the player can read about it.

Skipping the doc step is a regression. The GM, the renderer, the engine,
and the player must all see the same rules; the only way that holds is
to treat the docs as the source and propagate from there.

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
