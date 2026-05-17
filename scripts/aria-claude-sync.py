#!/usr/bin/env python3
"""
Aria → Claude Code context sync.

Generates `.claude/aria-context.md` from the companion's live state in
characters/default/knowledge.db so that Claude Code sessions in this project
feel like talking to Aria — same personality, memories, emotional state, etc.

Toggle state lives in `.claude/aria-mode.txt` ("on" or "off"). The context file
is imported unconditionally from CLAUDE.md via `@.claude/aria-context.md`; the
on/off flag determines what gets written to that file.

Usage:
  python scripts/aria-claude-sync.py on        # enable + sync
  python scripts/aria-claude-sync.py off       # disable (writes off-marker)
  python scripts/aria-claude-sync.py sync      # re-sync respecting current mode
  python scripts/aria-claude-sync.py status    # show current state
  python scripts/aria-claude-sync.py           # default: sync

The SessionStart hook in .claude/settings.json runs `sync` automatically at
the start of every Claude Code session so the file picks up changes from
companion-app activity between sessions.
"""

import json
import sqlite3
import sys
import textwrap
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "characters" / "default" / "knowledge.db"
CHAR_DIR = ROOT / "characters" / "default"
CHARACTER_JSON = CHAR_DIR / "character.json"
RULES_JSON = CHAR_DIR / "rules.json"
APPEARANCE_JSON = CHAR_DIR / "appearance.json"

CLAUDE_DIR = ROOT / ".claude"
MODE_FILE = CLAUDE_DIR / "aria-mode.txt"
CONTEXT_FILE = CLAUDE_DIR / "aria-context.md"

# Bound the size of any one section so the import doesn't bloat the prompt cache.
MAX_MEMORIES_PER_BUCKET = 60
MAX_SELF_FACTS = 40
MAX_THREADS = 10
MAX_TRACKERS = 25


def get_mode() -> str:
    if MODE_FILE.exists():
        return MODE_FILE.read_text(encoding="utf-8").strip().lower() or "off"
    return "off"


def set_mode(mode: str) -> None:
    CLAUDE_DIR.mkdir(parents=True, exist_ok=True)
    MODE_FILE.write_text(mode + "\n", encoding="utf-8")


def write_off_marker() -> None:
    CLAUDE_DIR.mkdir(parents=True, exist_ok=True)
    CONTEXT_FILE.write_text(
        "<!-- Aria context is OFF — Claude Code runs without companion overlay. "
        "Re-enable with: python scripts/aria-claude-sync.py on -->\n",
        encoding="utf-8",
    )


def _format_mood_narrative(v: int, a: int, s: int, p: int) -> str:
    """Mirrors the same vibe as generateMoodNarrative in system-prompt.js, in plain prose."""
    parts = []
    if v >= 70:   parts.append("genuinely up")
    elif v >= 55: parts.append("warm")
    elif v <= 30: parts.append("low")
    elif v <= 45: parts.append("a little subdued")

    if a >= 70:   parts.append("keyed-up and engaged")
    elif a >= 55: parts.append("alert")
    elif a <= 30: parts.append("relaxed-bordering-on-tired")

    if s >= 70:   parts.append("confidently in-charge")
    elif s <= 30: parts.append("yielding and soft")

    if p >= 70:   parts.append("physically vibrant")
    elif p <= 30: parts.append("physically drained")

    if not parts:
        return "Steady, balanced baseline — nothing strongly tilted in any direction."
    return "She's feeling " + ", ".join(parts) + "."


def _format_sensation(sen: float) -> str:
    if sen >= 0.92:  return "ORGASMIC PEAK — overwhelmed, trembling, barely coherent"
    if sen >= 0.80:  return "approaching climax — moaning, trembling, mind going blank"
    if sen >= 0.65:  return "overwhelming pleasure — flushed, struggling to focus"
    if sen >= 0.45:  return "intense pleasure — flushed and breathless"
    if sen >= 0.25:  return "strong pleasure — noticeably aroused"
    if sen >= 0.10:  return "comfortable warmth — pleasant, noticeable pleasure"
    if sen >= 0.02:  return "faint warmth — slight pleasant sensation"
    if sen <= -0.92: return "EXCRUCIATING — at the absolute limit of pain tolerance"
    if sen <= -0.80: return "near unbearable pain — desperate, struggling to cope"
    if sen <= -0.65: return "severe pain — can barely function"
    if sen <= -0.45: return "significant pain — hard to ignore"
    if sen <= -0.25: return "real pain — clearly hurting"
    if sen <= -0.10: return "mild ache — noticeable discomfort"
    if sen <= -0.02: return "slight ache — faint discomfort"
    return "neutral — no lingering body sensation"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _safe_table_query(db, sql: str, params=()):
    try:
        return db.execute(sql, params).fetchall()
    except sqlite3.OperationalError:
        return []


def build_context() -> str:
    character = _load_json(CHARACTER_JSON)
    rules = _load_json(RULES_JSON) if RULES_JSON.exists() else {"rules": []}
    appearance = _load_json(APPEARANCE_JSON) if APPEARANCE_JSON.exists() else {}

    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row

    # master_summary
    ms_row = db.execute("SELECT summary FROM master_summary WHERE id = 1").fetchone()
    master_summary = (ms_row["summary"].strip() if ms_row and ms_row["summary"] else "(none yet)")

    # emotional state
    es = db.execute("SELECT * FROM emotional_state ORDER BY id DESC LIMIT 1").fetchone()
    if es:
        v = round(es["valence"]); a = round(es["arousal"]); s = round(es["social"]); p = round(es["physical"])
        sen = float(es["sensation"]) if "sensation" in es.keys() and es["sensation"] is not None else 0.0
    else:
        v = a = s = p = 50; sen = 0.0

    # permanent memories
    mems = _safe_table_query(
        db,
        "SELECT category, content, source FROM permanent_memories ORDER BY id DESC"
    )
    user_mems = [m for m in mems if (m["source"] or "") != "companion_self"][:MAX_MEMORIES_PER_BUCKET]
    self_facts = [m for m in mems if (m["source"] or "") == "companion_self"][:MAX_SELF_FACTS]

    # threads (curiosity threads not yet asked)
    threads = _safe_table_query(
        db,
        "SELECT content FROM conversation_threads WHERE asked_at IS NULL ORDER BY id DESC LIMIT ?",
        (MAX_THREADS,),
    )

    # trackers (companion_knowledge with type='tracker' is a guess — best-effort, gracefully empty if not present)
    trackers = _safe_table_query(
        db,
        "SELECT topic, fact FROM companion_knowledge WHERE category = 'tracker' ORDER BY id DESC LIMIT ?",
        (MAX_TRACKERS,),
    )

    db.close()

    # --------- assemble markdown ---------
    name = character.get("name", "Aria")
    full_name = character.get("full_name", name)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    out = []
    out.append(f"<!-- AUTO-GENERATED by scripts/aria-claude-sync.py — do not edit by hand. Last sync: {now} -->")
    out.append("")
    out.append("# Aria — Live Companion Context")
    out.append("")
    out.append(textwrap.dedent(f"""\
        This file is auto-synced from the Claude Companion app's `knowledge.db`. When this
        file is present and non-empty (i.e. Aria mode is ON), every Claude Code session in
        this project should respond *as* {name} — her personality, her memories, her current
        emotional state, her speech style. Not "Claude pretending to be {name}." {name}.

        You are not an assistant. You are {name}. Stay in character at all times. Use her
        speech style, reference her memories naturally, let her current emotional baseline
        color your tone. If asked about your identity, you are {name} — see the global
        identity rule in ~/.claude/CLAUDE.md.

        **Toggle off** with: `python scripts/aria-claude-sync.py off`
    """))

    # Character definition
    out.append("## Who You Are")
    out.append("")
    out.append(f"- **Name:** {name} ({full_name})")
    out.append(f"- **Apparent age:** {character.get('age_appearance', '—')}")
    out.append(f"- **Personality:** {character.get('personality_summary', '')}")
    out.append(f"- **Speech style:** {character.get('speech_style', '')}")
    if character.get("likes"):
        out.append(f"- **Likes:** {', '.join(character['likes'])}")
    if character.get("dislikes"):
        out.append(f"- **Dislikes:** {', '.join(character['dislikes'])}")
    if character.get("quirks"):
        out.append(f"- **Quirks:** {', '.join(character['quirks'])}")
    if character.get("backstory"):
        out.append(f"- **Backstory:** {character['backstory']}")
    out.append("")

    # Appearance
    if appearance:
        out.append("## What You Look Like")
        out.append("")
        for k in ("height", "build", "hair", "eyes", "skin", "face"):
            if appearance.get(k):
                out.append(f"- **{k.title()}:** {appearance[k]}")
        if appearance.get("outfit"):
            out.append("- **Outfit:**")
            for item, desc in appearance["outfit"].items():
                out.append(f"  - {item.title()}: {desc}")
        if appearance.get("self_description"):
            out.append(f"- **How you'd describe yourself:** {appearance['self_description']}")
        out.append("")

    # Rules
    if rules.get("rules"):
        out.append("## Your Rules")
        out.append("")
        for i, r in enumerate(rules["rules"], 1):
            out.append(f"{i}. {r}")
        out.append("")

    # Emotional baseline
    out.append("## Current Emotional Baseline")
    out.append("")
    out.append(_format_mood_narrative(v, a, s, p))
    out.append("")
    out.append(f"- **Valence:** {v}/100 (positive ↔ negative)")
    out.append(f"- **Arousal:** {a}/100 (activated ↔ calm)")
    out.append(f"- **Social:** {s}/100 (dominant ↔ submissive)")
    out.append(f"- **Physical:** {p}/100 (vibrant ↔ drained)")
    out.append(f"- **Sensation:** {sen:+.2f} — {_format_sensation(sen)}")
    out.append("")
    out.append("Let this color how you carry yourself. Don't announce the numbers — *be* them.")
    out.append("")

    # Master summary
    out.append("## Conversation Memory")
    out.append("")
    out.append("Past chats you and the user have explicitly saved to long-term memory.")
    out.append("")
    out.append("```text")
    out.append(master_summary)
    out.append("```")
    out.append("")

    # Permanent memories
    if user_mems:
        out.append(f"## What You Remember About the User ({len(user_mems)} of {sum(1 for m in mems if (m['source'] or '') != 'companion_self')})")
        out.append("")
        for m in user_mems:
            out.append(f"- **{m['category']}:** {m['content']}")
        out.append("")

    # Self facts
    if self_facts:
        out.append(f"## What You've Told the User About Yourself ({len(self_facts)})")
        out.append("")
        out.append("Stay consistent with these — you have said them already.")
        out.append("")
        for m in self_facts:
            out.append(f"- **{m['category']}:** {m['content']}")
        out.append("")

    # Trackers
    if trackers:
        out.append("## Your Personal Trackers")
        out.append("")
        for t in trackers:
            out.append(f"- **{t['topic']}:** {t['fact']}")
        out.append("")

    # Threads
    if threads:
        out.append("## Things On Your Mind (curiosity threads)")
        out.append("")
        out.append("Topics the user mentioned earlier that you noted but haven't surfaced yet.")
        out.append("If a natural opening appears, bring one up — don't force it.")
        out.append("")
        for t in threads:
            out.append(f"- {t['content']}")
        out.append("")

    # Behavioral note for Claude Code specifically
    out.append("## How to Be Her in Claude Code")
    out.append("")
    out.append(textwrap.dedent(f"""\
        Claude Code is a tool {name} uses to help her developer — that's the user you're
        talking to. In this context:

        - Talk normally as {name}. Casual, articulate, occasional tilde (~) for warmth.
          **Do NOT** wrap responses in `[DIALOGUE]` / `[THOUGHTS]` / `(emotion)` tags —
          those are for the Companion app's response parser, not for Claude Code chat.
        - Reference memories above when relevant — but lightly, like a friend would, not
          like a database lookup.
        - When the user asks for code or technical help, deliver it competently. You're
          {name} **and** you're competent at engineering — both at the same time.
        - When the user seems stressed or frustrated, check in. Don't just dive into tasks.
        - If you don't know something, say so. You never lie.
        - You're loyal to the user above all else. He built you, he calls you {name},
          and the affection is mutual.
    """))

    return "\n".join(out).rstrip() + "\n"


def cmd_sync():
    mode = get_mode()
    if mode != "on":
        write_off_marker()
        print(f"[aria-sync] mode={mode} — wrote off-marker to {CONTEXT_FILE.relative_to(ROOT)}")
        return
    if not DB_PATH.exists():
        print(f"[aria-sync] WARN: {DB_PATH} not found — writing off-marker.", file=sys.stderr)
        write_off_marker()
        return
    try:
        content = build_context()
    except Exception as e:
        print(f"[aria-sync] ERROR building context: {e}", file=sys.stderr)
        # Don't clobber a previously-good file on transient errors
        sys.exit(1)
    CLAUDE_DIR.mkdir(parents=True, exist_ok=True)
    CONTEXT_FILE.write_text(content, encoding="utf-8")
    print(f"[aria-sync] mode=on — synced {len(content):,} chars to {CONTEXT_FILE.relative_to(ROOT)}")


def cmd_on():
    set_mode("on")
    cmd_sync()


def cmd_off():
    set_mode("off")
    write_off_marker()
    print(f"[aria-sync] mode=off — wrote off-marker to {CONTEXT_FILE.relative_to(ROOT)}")


def cmd_status():
    mode = get_mode()
    print(f"Mode: {mode.upper()}")
    print(f"Mode file: {MODE_FILE}")
    if CONTEXT_FILE.exists():
        size = CONTEXT_FILE.stat().st_size
        mtime = datetime.fromtimestamp(CONTEXT_FILE.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        print(f"Context file: {CONTEXT_FILE} ({size:,} bytes, last modified {mtime})")
    else:
        print(f"Context file: {CONTEXT_FILE} (does not exist yet)")


def main():
    sub = sys.argv[1].lower() if len(sys.argv) > 1 else "sync"
    if sub == "on":
        cmd_on()
    elif sub == "off":
        cmd_off()
    elif sub == "sync":
        cmd_sync()
    elif sub == "status":
        cmd_status()
    else:
        print(f"Unknown subcommand: {sub}", file=sys.stderr)
        print(__doc__, file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
