# Claude Companion

A desktop AI companion app with a 1980s/90s anime cyberpunk aesthetic, powered by the Claude CLI. Aria lives on your screen, remembers you across sessions, and has a persistent emotional inner life that evolves over time.

![Aria](characters/default/character_reference.png)

---

## Features

- **Persistent memory** — Aria remembers facts about you and about herself ([MEMORY] and [SELF] tags), survives restarts, builds up over time
- **Persistent emotional axes** — Four axes (Valence, Arousal, Social, Physical) track her baseline mood across all sessions and drift based on every interaction
- **38 single emotions + 27 blended states** — Rich expression system with real artwork; blended emotions (e.g. `flustered_nervous`, `loving_sad`) for complex moments
- **3-tier brain router** — Filler (instant) → Local SQLite FTS5 brain → Claude CLI. Simple queries never leave your machine
- **RAG context injection** — Related past conversations recalled and prepended to each Claude call
- **Save Conversation** — Summarize and store sessions to long-term memory; Aria references them in future conversations
- **Emotional Axis Monitor** — Pop-out debug window showing live axis state with color-interpolated bars
- **Debug Viewer** — Standalone session log browser: navigate exchanges, view system prompts, extract memories retroactively
- **Character packs** — Swap characters by pointing at a different directory; each pack has its own artwork, rules, and knowledge DB
- **Screen capture** — Attach a screenshot to any message; Aria sees what you see

---

## Requirements

- Windows (tested on Windows 11)
- [Node.js](https://nodejs.org/) v22+
- [Claude Code CLI](https://claude.ai/code) installed and authenticated (`claude` available in PATH)

---

## Setup

```bash
npm install
npm run rebuild        # rebuilds better-sqlite3 for Electron
npm start
```

> **Never run `electron .` directly** — the VSCode terminal sets `ELECTRON_RUN_AS_NODE=1` which breaks Electron.
> Always use `npm start` or `COMMANDS/RUN.bat`.

---

## Project Structure

```
src/
  main/           Electron main process (brain router, DB, IPC)
  preload/        contextBridge API exposure
  renderer/       UI (HTML/CSS/JS — cyberpunk aesthetic)
  shared/         constants, system prompt builder, response parser

characters/
  default/        Aria character pack
    character.json, rules.json, appearance.json
    emotions/     38 single emotion portraits
    emotions/combined/  27 blended emotion portraits (placeholder — replace with art)
    knowledge.db  (created at runtime — not committed)

scripts/          Launch helpers, asset generators
COMMANDS/         Batch launchers for Windows
debug-sessions/   Rolling session logs (not committed)
```

---

## Launching Tools

| Command | What it does |
|---|---|
| `npm start` | Launch companion app |
| `npm run debug-viewer` | Launch debug session browser |
| `COMMANDS/RUN.bat` | Double-click launcher |
| `COMMANDS/DEBUG_VIEWER.bat` | Debug viewer launcher |

---

## Character Packs

A character pack is a directory under `characters/` containing:

| File | Purpose |
|---|---|
| `character.json` | Name, personality, greeting, model settings |
| `rules.json` | Hard behavioral rules injected into every prompt |
| `appearance.json` | Physical description injected so she knows what she looks like |
| `character_reference.png` | Reference portrait |
| `filler-responses.json` | Instant local responses for greetings/fillers |
| `emotions/*.png` | Emotion portrait images |
| `emotions/combined/*.png` | Blended emotion images |

---

## Emotional Axis System

Aria has four persistent axes stored in her database:

| Axis | Low | High |
|---|---|---|
| Valence | Negative / distressed | Positive / happy |
| Arousal | Calm / tired | Activated / intense |
| Social | Submissive / withdrawn | Dominant / assertive |
| Physical | Sick / exhausted | Healthy / alert |

After every response, axes drift toward the emitted emotion's profile. Extreme emotions (arousal > 70, valence < 30, etc.) cause large swings (60% drift); mild emotions drift slowly (25%). The current baseline is injected into every system prompt so Aria's writing reflects her actual state.

---

## License

Copyright (c) 2025 Tristan Sinclair. All rights reserved.
See [LICENSE](LICENSE).
