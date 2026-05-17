"""
One-off recovery script: saves all messages since the last conversation_sessions row
as a single new saved-chat row, with a Haiku-generated summary appended to
master_summary. Mirrors what the in-app Save Chat handler does, but with no
500-message ceiling and using stream-json stdin so the prompt doesn't traverse
the Windows command-line.
"""
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "characters" / "default" / "knowledge.db"
CLAUDE_EXE = r"C:\Users\trist\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe"
CHARACTER_NAME = "Aria"

SYSTEM_PROMPT = (
    "You are a conversation summarizer. Write a 3-5 sentence paragraph (plain text only, "
    "no tags or formatting) that summarizes the conversation you are shown. Write in "
    "third-person past tense. Capture: main topics discussed, any personal details the "
    "user shared, memorable moments, emotional tone. Output ONLY the summary paragraph "
    "and nothing else."
)


def fetch_unsaved(db: sqlite3.Connection):
    db.row_factory = sqlite3.Row
    last = db.execute(
        "SELECT id, ended_at FROM conversation_sessions ORDER BY id DESC LIMIT 1"
    ).fetchone()
    cutoff = last["ended_at"] if last else "1970-01-01"
    rows = db.execute(
        """
        SELECT role, content, emotion,
               CAST(strftime('%s', timestamp) AS INTEGER) * 1000 AS timestamp,
               timestamp AS iso_timestamp
        FROM conversation_messages
        WHERE timestamp > ?
        ORDER BY id ASC
        """,
        (cutoff,),
    ).fetchall()
    return last, [dict(r) for r in rows]


def run_summarizer(conv_text: str, sys_prompt_file: Path) -> str:
    payload = (
        json.dumps(
            {
                "type": "user",
                "message": {
                    "role": "user",
                    "content": [{"type": "text", "text": f"Summarize this conversation:\n\n{conv_text}"}],
                },
            }
        )
        + "\n"
    )
    proc = subprocess.run(
        [
            CLAUDE_EXE,
            "--input-format", "stream-json",
            "--output-format", "stream-json",
            "--verbose",
            "--model", "claude-haiku-4-5-20251001",
            "--system-prompt-file", str(sys_prompt_file),
            "--dangerously-skip-permissions",
        ],
        input=payload,
        text=True,
        capture_output=True,
        timeout=180,
    )
    if proc.returncode != 0 and not proc.stdout:
        raise RuntimeError(f"claude exited {proc.returncode}: {proc.stderr[:400]}")
    # Find the last JSON line with a 'result' field
    for line in reversed([ln for ln in proc.stdout.splitlines() if ln.strip()]):
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if obj.get("result"):
            return str(obj["result"]).strip()
        if obj.get("type") == "result" and obj.get("result"):
            return str(obj["result"]).strip()
    return proc.stdout.strip()


def main():
    db = sqlite3.connect(str(DB_PATH))
    last, messages = fetch_unsaved(db)
    if not messages:
        print("Nothing to recover — no messages newer than last saved session.")
        return
    print(f"Last saved session: id={last['id'] if last else None} ended_at={last['ended_at'] if last else None}")
    print(f"Messages to recover: {len(messages)}")
    print(f"  first: {messages[0]['iso_timestamp']}  role={messages[0]['role']}")
    print(f"  last:  {messages[-1]['iso_timestamp']}  role={messages[-1]['role']}")

    started_at = messages[0]["iso_timestamp"]
    ended_at = messages[-1]["iso_timestamp"]

    # Build conv text — feed a generous slice (Haiku handles it fine; we no longer
    # hit a command-line cap because we pipe via stdin).
    conv_text = "\n".join(
        f"{'User' if m['role'] == 'user' else CHARACTER_NAME}: {m['content']}"
        for m in messages
    )
    # Cap at 80k chars so the summarizer call stays fast. Plenty for a 3-5 sentence summary.
    conv_text = conv_text[:80000]
    print(f"Conv text length fed to summarizer: {len(conv_text):,} chars")

    sys_tmp = Path(__file__).parent / f"_sys_prompt_{int(time.time())}.txt"
    sys_tmp.write_text(SYSTEM_PROMPT, encoding="utf-8")
    try:
        print("Calling Claude (Haiku) to summarize... (this may take ~30s)")
        summary = run_summarizer(conv_text, sys_tmp)
    finally:
        sys_tmp.unlink(missing_ok=True)

    print()
    print("=== Summary ===")
    print(summary)
    print()

    # Strip emotion (extra metadata) — match the shape produced by getRecentMessages:
    # {role, content, emotion, timestamp}.
    msgs_for_json = [
        {
            "role": m["role"],
            "content": m["content"],
            "emotion": m["emotion"],
            "timestamp": m["timestamp"],
        }
        for m in messages
    ]
    messages_json = json.dumps(msgs_for_json)

    # Insert the session
    cur = db.execute(
        """
        INSERT INTO conversation_sessions (started_at, ended_at, message_count, summary, messages_json)
        VALUES (?, ?, ?, ?, ?)
        """,
        (started_at, ended_at, len(messages), summary, messages_json),
    )
    new_id = cur.lastrowid

    # Append to master_summary, mirroring the JS handler
    existing = db.execute("SELECT summary FROM master_summary WHERE id = 1").fetchone()
    existing_text = existing[0] if existing and existing[0] else ""
    date_str = time.strftime("%d %b %Y")
    new_summary = (
        f"{existing_text}\n\n[Saved {date_str}] {summary}" if existing_text else f"[Saved {date_str}] {summary}"
    )
    db.execute(
        "UPDATE master_summary SET summary = ?, last_updated = datetime('now') WHERE id = 1",
        (new_summary,),
    )
    db.commit()

    print(f"Saved as conversation_sessions row id={new_id}")
    print(f"messages_json size: {len(messages_json):,} bytes ({len(messages_json)/1024:.1f} KB)")
    print("master_summary updated.")


if __name__ == "__main__":
    main()
