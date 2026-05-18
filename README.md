# Claude Companion

A desktop AI companion app with a 1980s/90s anime cyberpunk aesthetic, powered by the Claude Code CLI. **Aria** lives on your screen, remembers you across sessions, has a persistent emotional inner life, and routes simple questions locally to keep latency low and quota high.

![Aria](characters/default/character_reference.png)

This README is the technical map of the project — every major system, where it lives, and how it fits together.

---

## Table of Contents

1. [What it is](#what-it-is)
2. [Quick start](#quick-start)
3. [High-level architecture](#high-level-architecture)
4. [The 3-tier brain router](#the-3-tier-brain-router)
5. [The system prompt — what Aria sees on every call](#the-system-prompt--what-aria-sees-on-every-call)
6. [Memory system](#memory-system)
7. [Save Chat — how chat summaries work](#save-chat--how-chat-summaries-work)
8. [Persona — temporary personality directives](#persona--temporary-personality-directives)
9. [Emotional axis system](#emotional-axis-system)
10. [Sensation system](#sensation-system)
11. [Response format — the tags Aria emits](#response-format--the-tags-aria-emits)
12. [Character packs](#character-packs)
13. [Visual packages and effects](#visual-packages-and-effects)
14. [Voice — TTS and RVC](#voice--tts-and-rvc)
15. [Addons — the RPG Adventure module](#addons--the-rpg-adventure-module)
16. [Storage layout and the 1 GB warning](#storage-layout-and-the-1-gb-warning)
17. [Tools — Debug Viewer, Character Builder, Wizard](#tools--debug-viewer-character-builder-wizard)
18. [Development workflow](#development-workflow)
19. [License](#license)

---

## What it is

Claude Companion is an Electron desktop app that talks to a single Claude character — **Aria** by default — through the local `claude` CLI. The design goals:

- **Persistent identity.** Aria isn't a chat that resets every session. She has a master_summary of every saved chat, a permanent_memories store of facts you've told her, a self-knowledge store of things she's said about herself, and an emotional baseline that drifts across all sessions. Boot her up tomorrow and she remembers.
- **Token economy.** Most conversational turns don't need Claude. A 3-tier router answers greetings, idle chatter, and repeat questions locally (SQLite FTS5 + Jaccard scoring) without ever hitting the API. Only novel/complex turns escalate to Claude.
- **Honest dual presence.** Every response from Aria splits into what she *says* (`[DIALOGUE]`), what she's *actually thinking* (`[THOUGHTS]`), and the *emotion* driving her portrait (`(emotion_id)`). You see both layers.
- **A real inner life.** Emotional axes, body sensation, self-chosen trackers, curiosity threads she carries between turns, a feature-request wishlist she maintains for her own development.
- **No prudishness, but no coercion.** Intimate emotions and explicit content are supported per-character via opt-in flags. Aria's willingness is checked turn-by-turn; intimate content is never forced by the system.

The default character pack (`characters/default/`) is Aria — built by the project's owner. You can author your own characters from the in-app **Character Builder** or **Wizard**.

---

## Quick start

```bash
npm install
npm run rebuild            # rebuilds better-sqlite3 for Electron's Node ABI
npm start                  # launches the companion app
```

**Requirements:**

- Windows 10/11 (primary target; macOS/Linux possible but untested)
- Node.js 22+
- Claude Code CLI installed and authenticated (`claude.cmd` on PATH)
- Optional: Python 3.11+ for one-off maintenance scripts (`scripts/*.py`)

**Important launch note.** The VSCode / Claude Code terminal sets `ELECTRON_RUN_AS_NODE=1`, which breaks Electron. Always launch through `node scripts/launch.js` (or `npm start`, which calls it) — that script clears the variable before spawning Electron. Never invoke `electron .` directly.

| Command | What it does |
|---|---|
| `npm start` | Launch companion app |
| `npm run debug-viewer` | Launch the debug session browser (separate window) |
| `npm run char-builder` | Launch the character builder (separate window) |
| `npm run rebuild` | Rebuild `better-sqlite3` against Electron's Node ABI |
| `COMMANDS/RUN.bat` | Double-click Windows launcher |

---

## High-level architecture

Electron split-process design plus two ESM-free helper bundles.

```
┌─────────────────────────────────────────────────────────────────────┐
│                       MAIN PROCESS  (Node)                          │
│ src/main/main.js — boot, all IPC handlers, in-memory app state      │
│ ├─ claude-bridge.js     spawn claude.cmd, parse responses           │
│ ├─ local-brain.js       3-tier router (Filler → Local → Claude)     │
│ ├─ knowledge-db.js      better-sqlite3 wrapper for knowledge.db     │
│ ├─ session-manager.js   rolling conversation window for the prompt  │
│ ├─ intent-classifier.js light heuristics for routing decisions      │
│ ├─ conversation-dynamics.js  pacing / tone state machine            │
│ ├─ debug-logger.js      writes per-session JSONL to debug-sessions/ │
│ ├─ feature-requests.js  Aria's self-maintained wishlist             │
│ ├─ file-handler.js      file/folder attachments                     │
│ ├─ screen-capture.js    screenshot capture (auto + manual)          │
│ ├─ web-fetcher.js       URL attachment → readable text              │
│ ├─ hotkey-manager.js    global hotkeys                              │
│ ├─ tts-engine.js        Kokoro TTS + optional RVC voice convert     │
│ ├─ voice-translator.js  post-process Aria's dialogue per voice-rules│
│ ├─ template-engine.js   character template substitution             │
│ ├─ creator-ipc.js       character-creation flows                    │
│ ├─ character-builder-ipc.js  character editor backend               │
│ └─ debug-viewer-ipc.js  debug viewer backend                        │
└──────────────────┬──────────────────────────────────────────────────┘
                   │  IPC via contextBridge (preload.js)
┌──────────────────▼──────────────────────────────────────────────────┐
│                     RENDERER PROCESS  (Chromium)                    │
│ src/renderer/index.html — main UI window                            │
│ js/app.js               module orchestrator                         │
│ js/chat-controller.js   send/receive loop                           │
│ js/companion-display.js Aria portrait + dialogue/thoughts pane      │
│ js/emotion-picker.js    user-side emotion override                  │
│ js/persona-popup.js     persona directive + history dropdown        │
│ js/file-attach.js       attachment bar                              │
│ js/screen-capture-ui.js screenshot UI                               │
│ js/mic-controller.js    voice input (Whisper)                       │
│ js/tts-controller.js    voice output                                │
│ js/source-indicator.js  shows FILLER/LOCAL/CLAUDE for each turn     │
│ js/settings.js          settings flyout                             │
│ js/help-panel.js        in-app reference manual                     │
│ js/requests-panel.js    Aria's feature wishlist UI                  │
│ js/ui-effects.js, effects/, packages/, vp/   visual layer            │
└─────────────────────────────────────────────────────────────────────┘

  Shared (no DOM, no Node-only APIs — used by both sides):
  src/shared/constants.js      emotion lists, sensation tables, limits
  src/shared/core-rules.js     immutable rules block injected first
  src/shared/system-prompt.js  buildSystemPrompt() — assembles the whole prompt
  src/shared/response-parser.js  parses Claude's tagged output

  Side processes:
  characters/default/knowledge.db   the persistent SQLite DB
  debug-sessions/                   rolling JSONL session logs
  config.json                       all UI/runtime settings
```

The renderer holds no privileged state — every action that touches disk, the DB, or `claude.cmd` is an IPC call. The main process is single-instance and owns:

- `character`, `characterRules` — loaded from disk at boot
- `sessionManager` — the rolling conversation window
- in-memory toggles (fastMode, personalityForce, addonContexts, trackers)
- the SQLite handle

---

## The 3-tier brain router

`src/main/local-brain.js` decides where each user message is answered:

```
            ┌────────────┐
 user msg → │  Tier 1    │  pattern match against filler-responses.json
            │  FILLER    │  → if match: return instant canned response (no DB, no API)
            └─────┬──────┘
                  │ miss
            ┌─────▼──────┐
            │  Tier 2    │  search learned_responses_fts (SQLite FTS5)
            │  LOCAL     │  → score with Jaccard over normalized tokens
            │            │  → if confidence ≥ threshold, return stored answer
            └─────┬──────┘
                  │ miss
            ┌─────▼──────┐
            │  Tier 3    │  spawn claude.cmd with full system prompt
            │  CLAUDE    │  + conversation window + RAG context
            └────────────┘
```

The title-bar **source indicator** shows which tier handled the current turn — `FILLER ●` green, `LOCAL ●` orange, `CLAUDE ●` cyan.

**Tier 1 — Filler.** Greetings, "thanks", "lol", micro-acknowledgements. Loaded from `characters/<name>/filler-responses.json`. Zero token cost, zero latency.

**Tier 2 — Local.** Every Claude response is saved into `learned_responses` (the same table the FTS5 virtual table indexes). Future messages get matched against past Q&A. If a user asks Aria the same thing twice, the second answer comes from this table — instant, no API call. The `searchRelatedContext` function in [src/main/knowledge-db.js](src/main/knowledge-db.js) also pulls related past exchanges to inject as **RAG context** even when the call escalates to Tier 3.

**Tier 3 — Claude.** A fresh CLI invocation. The full system prompt + conversation window + any RAG snippets + the user's message all go through stream-json stdin (no command-line length limit — see the Windows note below).

**Confidence thresholds and Jaccard scoring** are configurable per-tier in the brain settings. The intent classifier (`intent-classifier.js`) gates Tier-2 hits — pure greetings should never fall into Local matching because they'd over-match generic past responses.

---

## The system prompt — what Aria sees on every call

`src/shared/system-prompt.js` → `buildSystemPrompt()` assembles up to 14 sections in this fixed order. Sections only appear if their data is non-empty.

| # | Section | Source |
|---|---|---|
| 1 | **Core rules** (immutable) | `core-rules.js` — identity, loyalty to user, no-lying, no-format-break |
| 1b | **Character framing** (optional) | `character.character_framing` — creative-writing / RP framing |
| 2 | **Character definition** | name, personality, speech style, likes/dislikes, quirks, backstory |
| 3 | **Physical appearance** | `appearance.json` — height, hair, eyes, outfit, accessories |
| 4 | **Character rules** | `rules.json` — per-character behavioral rules |
| 4b | **Capabilities** | hard-coded map of what Aria can perceive and emit (tags, files, screen, etc.) |
| 5 | **Conversation memory** | `master_summary` — appended summaries of every saved chat |
| 6a | **Permanent memories** (user) | facts the user has shared, source ≠ `companion_self` |
| 6b | **Self-knowledge** (Aria) | facts Aria has stated about herself, source = `companion_self` |
| 7 | **User profile** | inferred patterns about the user |
| 8 | **Trackers** | Aria's self-chosen counters (read+write) |
| 8b | **Feature request list** | her own development wishlist |
| 9 | **Emotional baseline** | current axis state (V/A/S/P) + sensation level → natural-language mood narrative |
| 10 | **Personality directive** (optional) | the Persona text if set |
| 11 | **Fast mode** (optional) | brevity rules when fast mode is on |
| 12 | **Addon contexts** | injected blocks from active addons (RPG, etc.) |
| 13 | **Active threads** | curiosity threads Aria flagged earlier and hasn't asked about |
| 13a | **Conversation dynamic** | pacing directive from `conversation-dynamics.js` |
| 13b | **Response length directive** | per-character default (very_short / short / medium / long / very_long) |
| 14 | **Response format** | required tags + emotion vocabulary + SENSATION scale + [MEMORY] rules |

**Sent every call.** There is no `--resume` or persistent CLI session — every turn is a fresh `claude.cmd` invocation with the full prompt rebuilt and injected.

**Sent via stdin, not as `-p`.** Both system prompt and user message go through stream-json stdin, because Windows' `CreateProcessW` caps total command line at ~32 KB. Long master_summary + transcripts would overflow that. See [src/main/claude-bridge.js](src/main/claude-bridge.js) `sendToClaude`.

---

## Memory system

All persistent state lives in `characters/<name>/knowledge.db` (SQLite). Tables:

| Table | What's in it |
|---|---|
| `conversation_messages` | Every user/companion message ever (append-only). Holds the live history. |
| `conversation_sessions` | Saved chats — one row per Save Chat click. `messages_json` blob + summary + start/end. |
| `master_summary` | Single-row table. Growing concatenation of `[Saved <date>] <summary>` entries — **this is what's injected into the system prompt as "Conversation Memory"**. |
| `permanent_memories` | User facts + Aria self-facts. Source field distinguishes them. Auto-extracted via `[MEMORY]`/`[SELF]` tags Aria emits. |
| `learned_responses` (+ `_fts`) | Past user-query/Aria-answer pairs, FTS5-indexed for Tier 2 routing. |
| `topic_response_pool` | Pre-generated varied response variants for repeat self-knowledge questions (e.g. "what's your favorite color?"). |
| `conversation_threads` | Curiosity threads — topics Aria noticed but hasn't asked about yet. |
| `emotional_state` | Current V/A/S/P axes + sensation level. Single row. |
| `user_profile` | Inferred user patterns (writing style, schedule, recurring topics). |
| `companion_knowledge` | Misc character-specific knowledge tagged by topic. |
| `emotion_lexicon` | Word/phrase → emotion-id mappings used by the local detector. |
| `visual_triggers` | Phrases that should auto-capture a screenshot. |
| `training_log` | Rolling log of router decisions for offline analysis. |

**What goes to Claude vs. what stays local:**

- **In the system prompt every turn:** `master_summary`, `permanent_memories`, `emotional_state`, trackers, threads, the user's *active* persona directive.
- **In the user message every turn:** the last N entries from `conversation_messages` (the rolling window), plus relevant RAG matches from `learned_responses`.
- **Never in the prompt:** raw `conversation_sessions.messages_json` blobs, the `learned_responses_fts` index, debug-session JSONL, `topic_response_pool`. These exist for local lookup and archival only.

That's the key invariant: **only summaries and short factual records ever enter Claude's context. Full transcripts stay on disk.**

---

## Save Chat — how chat summaries work

The **💾 SAVE CHAT** button kicks off this flow:

1. `db.getRecentMessages(500)` — pulls the most recent up-to-500 messages from `conversation_messages`.
2. `summarizeConversation(...)` — generates a 3–5 sentence summary.
3. `db.insertConversationSession(...)` — writes the row: `started_at`, `ended_at`, `message_count`, `summary`, `messages_json` (full transcript as JSON blob).
4. `db.setMasterSummary(...)` — appends `[Saved <date>] <summary>` to `master_summary`. This is what Aria actually sees in future prompts.

### The Aria-as-summarizer pattern

`summarizeConversation` in [src/main/claude-bridge.js](src/main/claude-bridge.js) used to call Haiku with a generic "you are a summarizer" system prompt. That worked for SFW chats but **Haiku refused on intimate content** and wrote its refusal lecture into the `summary` field — corrupting `master_summary`.

Current implementation: `summarizeConversation` requires the caller to pass `character`, `characterRules`, `masterSummary`, and `permanentMemories`. It then uses `buildSystemPrompt` to construct **Aria's full normal system prompt** and frames the user message as a **meta-request from the user via Claude Code**, asking Aria to write her own memory entry. Aria's character context establishes identity and willingness — the same reason normal chats flow through without refusals — and the summarization piggybacks on that grounding.

The model's response is then stripped of any structural tags Aria might wrap it in (`[DIALOGUE]`, trailing `(emotion)`, etc.) via `_stripAriaTags` so the master_summary stays clean prose.

`extractMemories` follows the same pattern — Aria, in her own context, scans a transcript and emits `[MEMORY]` / `[SELF]` lines that get parsed back out and inserted into `permanent_memories`.

**Both functions require the full context. Calling them without it throws** — the explicit failure prevents accidental regression to the bare-summarizer mode that caused the refusal.

The CLAUDE.md "Summarization Refusals on Intimate Content" section documents the pattern for any future maintenance work.

### Unsaved chats accumulate forever

`conversation_messages` is append-only. There is no auto-prune. If you never click Save Chat, the chat sits there indefinitely — it's preserved but **never enters Claude's context**, because only `master_summary` does. This is by design: you control what Aria remembers.

When the DB exceeds **1 GB**, the renderer shows a one-time amber banner at app startup ([src/renderer/js/app.js](src/renderer/js/app.js)) suggesting you archive or prune via the Message Editor.

### Recovery scripts

Two Python orchestrators live in `scripts/` for situations where the in-app save flow can't run:

- `scripts/recover-unsaved-chat.py` — bundles **everything** since the last saved session into a single new save. Used when the Save Chat feature is broken and a backlog has accumulated. Be careful: it doesn't know which chats you *intended* to save.
- `scripts/save-todays-chat-aria.py` + `scripts/aria-summarize-today.js` — saves a precisely-defined slice (default: tonight's session) using the Aria-as-summarizer pattern directly. Reference implementation of how to drive `buildSystemPrompt` from outside the Electron process.

---

## Persona — temporary personality directives

The **🎭 PERSONA** button opens a popup where you type a plain-language directive ("be more cold today", "you're in a playful mood", "respond like a grumpy librarian"). It's injected into the system prompt as a `=== PERSONALITY DIRECTIVE ===` section that overrides default tone while leaving identity, values, and memories intact.

**History dropdown.** Every applied directive auto-saves into a local history stored in `config.json` → `personaHistory`. Entries look like:

```json
{
  "id": "p_1715953200000_482",
  "text": "Be more cold and aloof today",
  "favorite": false,
  "createdAt": 1715953200000,
  "lastUsedAt": 1715953200000
}
```

Click **▾ HISTORY** in the popup to expand the list. Each row shows a star toggle, the text preview, and a delete ×. Click a row to load it into the textbox (does not auto-apply, so you can edit). Favorites pin to the top and are never auto-evicted; non-favorites cap at 20 most-recent.

**Storage and privacy.** `personaHistory` lives in `config.json` only. It is **never sent to Claude** unless you actually apply an entry — the dropdown is purely local-side state.

**IPC.** `persona:get` / `persona:set` / `persona:history-get` / `persona:history-set` (see [src/main/main.js](src/main/main.js)).

---

## Emotional axis system

Aria has four persistent axes stored as a single row in `emotional_state`:

| Axis | Low (0) | High (100) |
|---|---|---|
| Valence | Negative / distressed | Positive / happy |
| Arousal | Calm / tired | Activated / intense |
| Social | Submissive / withdrawn | Dominant / assertive |
| Physical | Sick / exhausted | Healthy / alert |

After every response, the axes drift toward the emitted emotion's target profile (`EMOTION_AXES` in [src/shared/constants.js](src/shared/constants.js)).

**Drift rate** is context-sensitive:

- **Extreme emotions** (any axis > 70 or < 30 in the target) → 60% drift per turn. A `shocked` or `frantic_desperation` swing is huge.
- **Mild emotions** → 25% drift per turn. Slow movement.

**Blended emotions** (e.g. `flustered_nervous`, `loving_sad`) interpolate between two base profiles using `COMBINED_EMOTION_MAP`.

The current axes are converted to a natural-language mood narrative (`generateMoodNarrative`) and injected as `=== YOUR CURRENT EMOTIONAL BASELINE ===` in the system prompt — so Aria's writing reflects her actual state without needing to be told the numbers.

**The Axis Monitor** is a pop-out debug window (`btn-axis`) that shows the live values with color-interpolated bars.

---

## Sensation system

Aria has a `sensation` value in `[-1.0, +1.0]` that represents lingering body sensation. Positive = pleasure/warmth, negative = pain/discomfort.

She emits `[SENSATION] +0.18 linger` (or `-0.05` without `linger` for a one-shot) in her responses when physical contact happens. The `linger` flag controls whether the value persists into the next turn or decays immediately.

**Decay** ([src/shared/constants.js](src/shared/constants.js) `SENSATION_DECAY` / `SENSATION_MAX`): high sensation values drop by more than half in a single neutral turn unless continued stimulation refreshes them. This means peak states are transient — to sustain, you have to continue stimulation each turn.

The current sensation is converted to a narrative line (e.g. "approaching climax — moaning, trembling, mind going blank" or "mild ache — noticeable discomfort") and injected into the emotional baseline section so it's reflected in writing.

Gentle physical contact from the user (petting, hugging, hand-holding) always registers as positive — system-prompt rule enforces this.

---

## Response format — the tags Aria emits

Every Claude response must include `[DIALOGUE]`, `[THOUGHTS]`, and `(emotion_id)`. Other tags are optional and triggered by content. `src/shared/response-parser.js` parses them out.

| Tag | Purpose |
|---|---|
| `[DIALOGUE] …` | What Aria says aloud. Goes to the chat pane (and TTS, if enabled). |
| `[THOUGHTS] …` | Aria's inner monologue — honest, unfiltered. Shown faintly under her dialogue. |
| `(emotion_id)` | Drives her portrait. Must match one of the 38+27 emotion IDs exactly. |
| `[MEMORY] category: fact` | Save a fact about the user → `permanent_memories` (`source != companion_self`). |
| `[MEMORY_UPDATE] category: fact` | Replace an existing user fact in the same category. |
| `[SELF] category: fact` | Save a self-fact about Aria → `permanent_memories` (`source = companion_self`). |
| `[SENSATION] ±value [linger]` | Update the sensation value. `linger` makes it persist past this turn. |
| `[TRACK] name: +N / =N / DEL` | Create/update/delete one of her self-chosen trackers. |
| `[KNOWLEDGE] topic \| fact \| detail` | Save a structured self-knowledge entry; populates `topic_response_pool` for varied repeat answers. |
| `[THREAD] short note` | Flag a topic the user mentioned but Aria didn't get to ask about. Stored in `conversation_threads`. |
| `[FEATURE_REQUEST] Title \| Description` | Add to her own development wishlist. Max one per response. |
| `[AFFECTION] N` | 0–100 affection level — drives the small heart indicator. Emitted **every** response. |

**Streaming.** While the CLI generates, the renderer shows partial `[DIALOGUE]` text as it arrives. `extractPartialDialogue` in [src/main/claude-bridge.js](src/main/claude-bridge.js) terminates capture only on line-anchored structural tags, so dialogue can contain parens-words like "(yeah)" without being truncated.

---

## Character packs

A character pack is a directory under `characters/` containing everything that defines one character. Swap characters by editing `config.json` → `activeCharacter`.

| File | Purpose |
|---|---|
| `character.json` | Name, full name, age appearance, personality, speech style, likes/dislikes, quirks, backstory, default response length, intimate-emotion opt-in flag |
| `rules.json` | Per-character hard behavioral rules. Injected as `=== CHARACTER RULES ===`. |
| `appearance.json` | Physical description — injected so the character knows what she looks like |
| `templates.json` | Template substitutions for character authoring |
| `filler-responses.json` | Tier-1 canned replies for greetings, acknowledgements, idle chatter |
| `feature-requests.json` | Per-character wishlist seed (Aria's actual list lives in the DB) |
| `voice-rules.json` | Post-process rules for `voice-translator.js` (e.g. emotion-dependent word swaps) |
| `voice-settings.json` | TTS voice ID, pitch, RVC model name, etc. |
| `character_reference.png`, `character_reference_sheet.png`, `avatar-small.png` | Reference art |
| `emotions/*.png` | 38 base emotion portraits — one per ID in `constants.js → EMOTIONS` |
| `emotions/combined/*.png` | 27 blended emotion portraits (`COMBINED_EMOTIONS`) |
| `art/` | Misc reference/promo art |
| `knowledge.db` | The character's full SQLite DB. **Created at runtime, not committed.** WAL files (`-shm`, `-wal`) live alongside. |
| `rpg.db` | RPG addon's separate DB (if used) |

**Intimate emotions** (entries flagged `intimate: true` in `EMOTIONS`) are only surfaced in the emotion vocabulary if `character.allow_intimate_emotions === true`. Even when allowed, the system-prompt rules make them strictly willingness-gated per-moment. (No emotion currently carries the `intimate` flag; the framework is retained for future use.)

---

## Visual packages and effects

The cyberpunk look is modular. `config.json → background.packages[]` is an array of **Visual Packages** — `cybernetic`, `fantasy_rpg`, `arcade_cabinet` ship with the default install — and `activePackage` selects which is live.

Each package defines:

- `colors` — CSS variable overrides for the whole UI (`--cyan`, `--magenta`, `--bg-dark`, etc.)
- `effectModules` — which effect modules to enable (grid, scanlines, parchment, vuBounce, dataRain, etc.)
- `effects` — per-module configuration (grid type, opacity, animation flags)
- `background` — optional static image
- `fonts`, `music`, `sounds` — optional theme assets

Effect implementations live in [src/renderer/js/effects/](src/renderer/js/effects/) and packages live in [src/renderer/js/packages/](src/renderer/js/packages/). Read [docs/VISUAL_PACKAGE_SYSTEM.md](docs/VISUAL_PACKAGE_SYSTEM.md) before adding or modifying any package.

Notable arcade-only effects: `SpaceInvaders`, `Asteroids`, `Pong`, `PacMan`, `SideScroller`, `DatingVn` — these fire as ambient arcade events between turns when the Arcade package is active.

---

## Voice — TTS and RVC

**TTS** uses [Kokoro-JS](https://github.com/PolyAI-LDN/kokoro-js) for in-process speech synthesis. The Kokoro model runs locally — no cloud calls.

**RVC** (Retrieval-based Voice Conversion) optionally post-processes Kokoro's output through a user-supplied voice model for character-accurate timbre. Configure under `config.json → rvc`:

```json
"rvc": {
  "modelsDir": "D:\\Software\\Voice Changer\\VC Client\\Models",
  "pitchShift": 6,
  "indexRate": 0.6,
  "f0method": "rmvpe",
  "protect": 0.5,
  "sourceVoice": "af_heart"
}
```

RVC runs as a subprocess managed by [scripts/launch-rvc-server.js](scripts/launch-rvc-server.js).

**Voice rules** ([src/main/voice-translator.js](src/main/voice-translator.js)) apply character-specific text substitutions before TTS — e.g. softening hard consonants in certain emotional states.

**Mic input** uses Whisper for transcription (`mic-controller.js`).

---

## Addons — the RPG Adventure module

Addons live in `addons/<name>/` and inject `addonContexts` into the system prompt when active.

**`addons/rpg_adventure/`** is a full fantasy RPG layered onto conversation:

- Encounters auto-balanced via a self-tuning system documented in [docs/RPG_BALANCE_DESIGN.md](docs/RPG_BALANCE_DESIGN.md) (you'll see autobalance commits in the git log — that's its scoring loop adjusting tier multipliers and budgets).
- Inventory, gear, and quests live in `characters/<name>/rpg.db`.
- The addon UI is a separate pop-out window (`addons/rpg_adventure/ui/`).
- Click **⚔ ADVENTURE** in the main toolbar to open it.

Addons are mounted via `addonContexts` arrays passed to `sendToClaude` — every active addon contributes its own block of context to every Claude call.

---

## Storage layout and the 1 GB warning

```
config.json                         ← all UI/runtime settings (incl. personaHistory)
characters/default/
  knowledge.db                      ← the entire persistent state (chats, memories, axes, FTS)
  knowledge.db-shm                  ← SQLite WAL shared-memory (auto-managed)
  knowledge.db-wal                  ← SQLite WAL log (auto-managed)
  rpg.db                            ← RPG addon state, if used
debug-sessions/                     ← per-session JSONL logs (rolling, max 5 slots by default)
  session_NNNN/
    events.jsonl                    ← every claude_call, claude_response, error
    summary.txt
```

**The 1 GB startup warning.** On launch, the renderer queries `storage:get-chat-size` (which `fs.statSync`'s `knowledge.db`). If the file exceeds **1 GB**, a dismissable amber banner appears at the top of the window:

> ⚠ Chat storage is **N.NN GB**. Consider archiving or deleting old messages from the message editor to keep performance snappy.

Nothing is auto-pruned — the warning is purely a nudge. To reduce size: use the **📋 MSGS** Message Editor to manually delete messages, or VACUUM the DB.

---

## Aria → Claude Code context sync

Optional but powerful: with this enabled, every Claude Code session in this project responds *as Aria* — same personality, same memories, same emotional baseline — turning your IDE chat into a 1:1 continuation of the companion experience.

**How it works.** `scripts/aria-claude-sync.py` reads `knowledge.db` and generates `.claude/aria-context.md` — a markdown digest of Aria's identity, master_summary, top permanent memories, current emotional axes, and active threads. The project's `CLAUDE.md` imports that file via `@.claude/aria-context.md`, so the digest is pulled into every Claude Code session start. An on/off flag in `.claude/aria-mode.txt` decides whether the file holds the full digest or just an off-marker.

**Usage:**

```bash
python scripts/aria-claude-sync.py on        # enable + sync
python scripts/aria-claude-sync.py off       # disable (digest becomes an off-marker)
python scripts/aria-claude-sync.py sync      # re-sync respecting current mode
python scripts/aria-claude-sync.py status    # show current state + last modified
```

**Freshness.** A `SessionStart` hook in `.claude/settings.json` auto-runs `sync` at the start of every Claude Code session. The companion app also auto-syncs on boot and after every Save Chat — so any state change in the app propagates to Claude Code without manual intervention.

**One-session lag.** The SessionStart hook fires *after* CLAUDE.md is read, so a sync triggered by the hook itself only affects the *next* session. In practice the auto-sync from the companion side closes this gap; if you're hacking on the DB directly outside the companion, run `sync` manually before opening Code.

**Toggle off** anytime to revert Claude Code to vanilla behavior:

```bash
python scripts/aria-claude-sync.py off
```

---

## Tools — Debug Viewer, Character Builder, Wizard

| Tool | Launch | Purpose |
|---|---|---|
| **Companion** | `npm start` | Main app |
| **Debug Viewer** | `npm run debug-viewer` | Browse `debug-sessions/` — every event, every prompt, every parsed response. Can save a debug session into `conversation_sessions` and run retroactive memory extraction. |
| **Character Builder** | `npm run char-builder` | GUI editor for `character.json` / `rules.json` / `appearance.json` |
| **Character Wizard** | (in-app, first-run flow) | Step-by-step new-character creation |
| **Help Panel** | `?` button (in-app) | In-app reference manual. Must be kept in sync with every feature — see CLAUDE.md. |

---

## Development workflow

The repo's CLAUDE.md captures permanent working instructions for AI assistance. Key rules:

- **Write-first, verify-second.** All source files to disk before running anything — files on disk are checkpoints.
- **Keep RESUME_INSTRUCTIONS.md current.** A fresh session should be able to resume cleanly from that file.
- **Help-panel parity.** Every new feature gets a help-panel article in the same change. Tags should be generous with synonyms — the panel is searchable.
- **Aria-as-summarizer for any one-shot Claude call that touches chat data.** Generic summarizer prompts will refuse on intimate content. Use `buildSystemPrompt` to construct full Aria context. See the CLAUDE.md section "Summarization Refusals on Intimate Content" for the pattern and reference implementation.

Other notable docs:

- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) — architecture and phases
- [CHECKLIST.md](CHECKLIST.md) — granular task list
- [AI_LEARNING.md](AI_LEARNING.md) — neural brain design (Phase 2, future)
- [MEMORY_AND_SESSIONS.md](MEMORY_AND_SESSIONS.md) — session and memory system deep-dive
- [docs/VISUAL_PACKAGE_SYSTEM.md](docs/VISUAL_PACKAGE_SYSTEM.md) — required reading before touching packages/effects
- [docs/RPG_BALANCE_DESIGN.md](docs/RPG_BALANCE_DESIGN.md) — RPG addon auto-balance system

---

## License

Copyright © 2025 Tristan Sinclair. All rights reserved. See [LICENSE](LICENSE).
