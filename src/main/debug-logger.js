'use strict';
// Debug session logger — captures everything that happens each run.
// Keeps a rolling 5-slot history. Slot-1 is always the most recent session.
// On each app start: slot-5 deleted, 4→5, 3→4, 2→3, 1→2, fresh slot-1 created.

const fs = require('fs');
const path = require('path');

const DEBUG_DIR = path.join(__dirname, '../../debug-sessions');
const NUM_SLOTS = 5;

let _sessionFile = null;

// ── Initialization ─────────────────────────────────────────────────────────────

function init() {
  try {
    if (!fs.existsSync(DEBUG_DIR)) {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
    }

    // Shift slots down: delete slot-5, rename 4→5, 3→4, 2→3, 1→2
    // Iterate from highest slot to lowest to avoid name collisions
    for (let i = NUM_SLOTS; i >= 1; i--) {
      const slotPath = path.join(DEBUG_DIR, `slot-${i}`);
      if (i === NUM_SLOTS) {
        if (fs.existsSync(slotPath)) {
          fs.rmSync(slotPath, { recursive: true, force: true });
        }
      } else {
        if (fs.existsSync(slotPath)) {
          fs.renameSync(slotPath, path.join(DEBUG_DIR, `slot-${i + 1}`));
        }
      }
    }

    // Create fresh slot-1 for this session
    const slot1 = path.join(DEBUG_DIR, 'slot-1');
    fs.mkdirSync(slot1, { recursive: true });
    fs.writeFileSync(
      path.join(slot1, 'meta.json'),
      JSON.stringify({ slot: 1, startedAt: new Date().toISOString() }, null, 2),
    );

    _sessionFile = path.join(slot1, 'session.jsonl');
    _write({ type: 'session_start', slot: 1 });
    console.log('[DebugLogger] Session started → debug-sessions/slot-1/session.jsonl');
  } catch (err) {
    console.warn('[DebugLogger] init failed:', err.message);
  }
}

// ── Public logging API ─────────────────────────────────────────────────────────

/**
 * Appends one structured event to the current session file.
 * @param {string} type - Event type identifier
 * @param {object} data - Any serializable data
 */
function log(type, data) {
  if (!_sessionFile) return;
  _write({ type, ...data });
}

function _write(obj) {
  try {
    const line = JSON.stringify({ t: new Date().toISOString(), ...obj }) + '\n';
    fs.appendFileSync(_sessionFile, line, 'utf-8');
  } catch (err) {
    console.warn('[DebugLogger] write failed:', err.message);
  }
}

module.exports = { init, log };
