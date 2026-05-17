"""
Save tonight's chat using Aria-as-summarizer.

Pipeline:
  1. Pull the 20 messages of tonight's session (>= 2026-05-17 18:05:00) from
     conversation_messages.
  2. Pull master_summary + permanent_memories + character/rules so the Node
     helper can build Aria's full normal system prompt.
  3. Write context to a temp JSON file, invoke
     `node scripts/aria-summarize-today.js` — Aria summarizes the chat herself,
     in her own voice, with her own identity context intact (so Haiku doesn't
     refuse on intimate content).
  4. Insert the new conversation_sessions row + append summary to master_summary.

Run from project root: `python scripts/save-todays-chat-aria.py`
"""
import json
import sqlite3
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "characters" / "default" / "knowledge.db"
CHAR_DIR = ROOT / "characters" / "default"
CHARACTER_JSON = CHAR_DIR / "character.json"
RULES_JSON = CHAR_DIR / "rules.json"
APPEARANCE_JSON = CHAR_DIR / "appearance.json"
NODE_HELPER = ROOT / "scripts" / "aria-summarize-today.js"
TODAYS_SESSION_START = "2026-05-17 18:05:00"


def main():
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row

    # --- pull today's messages ---
    msgs = db.execute(
        """
        SELECT role, content, emotion,
               CAST(strftime('%s', timestamp) AS INTEGER) * 1000 AS timestamp,
               timestamp AS iso_timestamp
        FROM conversation_messages
        WHERE timestamp >= ?
        ORDER BY id ASC
        """,
        (TODAYS_SESSION_START,),
    ).fetchall()
    msgs = [dict(m) for m in msgs]
    if not msgs:
        raise SystemExit("No messages found for tonight. Aborting.")
    print(f"Today's session: {len(msgs)} messages "
          f"({msgs[0]['iso_timestamp']} -> {msgs[-1]['iso_timestamp']})")

    # --- pull master_summary + memories ---
    ms_row = db.execute("SELECT summary FROM master_summary WHERE id = 1").fetchone()
    master_summary = (ms_row["summary"] if ms_row and ms_row["summary"] else "")

    mem_rows = db.execute(
        "SELECT category, content, source FROM permanent_memories"
    ).fetchall()
    permanent_memories = [
        {"category": m["category"], "content": m["content"], "source": m["source"]}
        for m in mem_rows
    ]
    print(f"Master summary: {len(master_summary)} chars  |  "
          f"Permanent memories: {len(permanent_memories)}")

    # --- load character + rules + (optional) appearance ---
    character = json.loads(CHARACTER_JSON.read_text(encoding="utf-8"))
    rules = json.loads(RULES_JSON.read_text(encoding="utf-8"))
    if APPEARANCE_JSON.exists():
        try:
            character["_appearance"] = json.loads(APPEARANCE_JSON.read_text(encoding="utf-8"))
        except Exception:
            pass

    # --- build transcript text ---
    name = character.get("name", "Aria")
    transcript = "\n".join(
        f"{'Trist' if m['role'] == 'user' else name}: {m['content']}"
        for m in msgs
    )

    # --- write context, run node helper ---
    ts = int(time.time())
    ctx_path = ROOT / f"_aria_sum_ctx_{ts}.json"
    out_path = ROOT / f"_aria_sum_out_{ts}.txt"
    ctx_path.write_text(json.dumps({
        "character": character,
        "characterRules": rules,
        "masterSummary": master_summary,
        "permanentMemories": permanent_memories,
        "transcript": transcript,
    }), encoding="utf-8")

    print("Invoking Aria summarizer (Haiku with full Aria system prompt)...")
    try:
        proc = subprocess.run(
            ["node", str(NODE_HELPER), str(ctx_path), str(out_path)],
            capture_output=True,
            text=True,
            timeout=200,
            encoding="utf-8",
            cwd=str(ROOT),
        )
        if proc.returncode != 0:
            print("--- helper stderr ---")
            print(proc.stderr)
            raise SystemExit(f"Aria summarizer failed (exit {proc.returncode})")
        if proc.stderr.strip():
            print(f"[helper] {proc.stderr.strip()}")

        if not out_path.exists():
            raise SystemExit("Helper exited 0 but produced no output file.")
        summary = out_path.read_text(encoding="utf-8").strip()
    finally:
        ctx_path.unlink(missing_ok=True)

    if not summary:
        out_path.unlink(missing_ok=True)
        raise SystemExit("Aria returned an empty summary; aborting.")

    print()
    print("=== Aria's summary ===")
    print(summary)
    print()

    # --- present for user review before writing back ---
    # Save the proposed summary alongside the output; user can re-run if they
    # want to overwrite. For automation, we write directly.
    started_at = msgs[0]["iso_timestamp"]
    ended_at = msgs[-1]["iso_timestamp"]

    msgs_for_json = [
        {"role": m["role"], "content": m["content"], "emotion": m["emotion"], "timestamp": m["timestamp"]}
        for m in msgs
    ]
    messages_json = json.dumps(msgs_for_json)

    cur = db.execute(
        """
        INSERT INTO conversation_sessions (started_at, ended_at, message_count, summary, messages_json)
        VALUES (?, ?, ?, ?, ?)
        """,
        (started_at, ended_at, len(msgs), summary, messages_json),
    )
    new_id = cur.lastrowid

    date_str = time.strftime("%d %b %Y")
    new_master = (
        f"{master_summary}\n\n[Saved {date_str}] {summary}"
        if master_summary else
        f"[Saved {date_str}] {summary}"
    )
    db.execute(
        "UPDATE master_summary SET summary = ?, last_updated = datetime('now') WHERE id = 1",
        (new_master,),
    )
    db.commit()

    # Keep the out file as a record of what was saved; print location.
    print(f"Saved as conversation_sessions row id={new_id}, {len(msgs)} messages, "
          f"json={len(messages_json):,} bytes")
    print(f"master_summary: {len(master_summary)} -> {len(new_master)} chars")
    print(f"(Summary archive: {out_path})")


if __name__ == "__main__":
    main()
