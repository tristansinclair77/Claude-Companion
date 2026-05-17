"""
Fix-up script:
  1. Deletes conversation_sessions row #3 (the over-broad recovery save).
  2. Reverts master_summary by stripping the appended chunk from that save.
  3. Re-summarizes ONLY today's chat session (messages after the 10.9 h gap,
     i.e. timestamp >= 2026-05-17 18:05:00).
  4. Inserts that as a fresh conversation_sessions row.
  5. Re-appends the new summary to master_summary.
"""
import json
import sqlite3
import subprocess
import time
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "characters" / "default" / "knowledge.db"
CLAUDE_EXE = r"C:\Users\trist\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe"
CHARACTER_NAME = "Aria"
TODAYS_SESSION_START = "2026-05-17 18:05:00"

SYSTEM_PROMPT = (
    "You are a conversation summarizer. Write a 3-5 sentence paragraph (plain text only, "
    "no tags or formatting) that summarizes the conversation you are shown. Write in "
    "third-person past tense. Capture: main topics discussed, any personal details the "
    "user shared, memorable moments, emotional tone. Output ONLY the summary paragraph "
    "and nothing else."
)


def summarize(conv_text: str, sys_prompt_file: Path) -> str:
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
        encoding="utf-8",
    )
    if proc.returncode != 0 and not proc.stdout:
        raise RuntimeError(f"claude exited {proc.returncode}: {proc.stderr[:400]}")
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
    db.row_factory = sqlite3.Row

    # 1. Pull existing session #3 so we know what summary text to strip from master_summary.
    s3 = db.execute("SELECT id, summary FROM conversation_sessions WHERE id = 3").fetchone()
    if not s3:
        print("Session #3 not found — nothing to undo.")
        old_appended_summary = None
    else:
        old_appended_summary = s3["summary"]
        print(f"Found stale session #3 — will delete (summary len={len(old_appended_summary)} chars).")

    # 2. Pull today's messages.
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
        raise SystemExit("No messages found at or after the today-session cutoff. Aborting.")

    print(f"Today's session: {len(msgs)} messages "
          f"({msgs[0]['iso_timestamp']} -> {msgs[-1]['iso_timestamp']})")

    # 3. Build conv text and summarize.
    conv_text = "\n".join(
        f"{'User' if m['role'] == 'user' else CHARACTER_NAME}: {m['content']}"
        for m in msgs
    )
    print(f"Conv text length: {len(conv_text):,} chars")

    sys_tmp = Path(__file__).parent / f"_sys_prompt_{int(time.time())}.txt"
    sys_tmp.write_text(SYSTEM_PROMPT, encoding="utf-8")
    try:
        print("Calling Claude (Haiku) to summarize today's chat...")
        summary = summarize(conv_text, sys_tmp)
    finally:
        sys_tmp.unlink(missing_ok=True)

    print()
    print("=== New summary (today only) ===")
    print(summary)
    print()

    # 4. Revert master_summary by stripping the appended chunk from the recovery.
    if old_appended_summary:
        ms_row = db.execute("SELECT summary FROM master_summary WHERE id = 1").fetchone()
        ms_text = (ms_row["summary"] if ms_row and ms_row["summary"] else "")
        # The recovery script appended:  "\n\n[Saved <date>] <summary>"  if existing,
        # or just "[Saved <date>] <summary>" if no prior content.
        # Find the last occurrence of the old summary and trim everything from the
        # immediately preceding "[Saved ...]" tag onward.
        idx = ms_text.rfind(old_appended_summary)
        if idx == -1:
            print("WARNING: could not locate old summary inside master_summary — leaving as-is.")
            reverted = ms_text
        else:
            # Walk back to the "[Saved" marker that introduces this chunk
            marker_idx = ms_text.rfind("[Saved", 0, idx)
            if marker_idx == -1:
                marker_idx = idx
            # And strip the leading "\n\n" if present
            reverted = ms_text[:marker_idx].rstrip("\n").rstrip()
        print(f"master_summary: {len(ms_text)} chars -> {len(reverted)} chars (after stripping old chunk)")
    else:
        reverted = ""

    # 5. Delete the old session row.
    if s3:
        db.execute("DELETE FROM conversation_sessions WHERE id = 3")
        print("Deleted conversation_sessions row #3.")

    # 6. Insert the new session row (just today's chat).
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

    # 7. Append the new summary to the reverted master_summary.
    date_str = time.strftime("%d %b %Y")
    new_master = (
        f"{reverted}\n\n[Saved {date_str}] {summary}" if reverted else f"[Saved {date_str}] {summary}"
    )
    db.execute(
        "UPDATE master_summary SET summary = ?, last_updated = datetime('now') WHERE id = 1",
        (new_master,),
    )
    db.commit()
    print()
    print(f"New saved session id={new_id}, {len(msgs)} messages, json={len(messages_json):,} bytes")
    print(f"master_summary new length: {len(new_master)} chars")


if __name__ == "__main__":
    main()
