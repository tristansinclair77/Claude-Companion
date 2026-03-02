/**
 * Debug Viewer IPC Handlers
 * Reads debug session slots and parses JSONL event data for the debug viewer window.
 */

const { ipcMain, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { summarizeConversation, extractMemories } = require('./claude-bridge');

const DEBUG_DIR = path.join(__dirname, '../../debug-sessions');
const DB_PATH = path.join(__dirname, '../../characters/default/knowledge.db');
const CHARACTER_PATH = path.join(__dirname, '../../characters/default/character.json');
const MAX_SLOTS = 5;

let _standaloneDb = null;
let _standaloneKdb = null;

// Returns raw better-sqlite3 handle for read queries. Passed db is a KnowledgeDB — use its .db property.
function getDb(db) {
  if (db) return db.db; // KnowledgeDB exposes raw handle as .db
  if (_standaloneDb) return _standaloneDb;
  try {
    const Database = require('better-sqlite3');
    _standaloneDb = new Database(DB_PATH, { readonly: true });
    return _standaloneDb;
  } catch {
    return null;
  }
}

// Returns a KnowledgeDB instance for write operations.
function getKdb(db) {
  if (db) return db; // already a KnowledgeDB
  if (_standaloneKdb) return _standaloneKdb;
  try {
    const KnowledgeDB = require('./knowledge-db');
    _standaloneKdb = new KnowledgeDB(DB_PATH);
    _standaloneKdb.open();
    return _standaloneKdb;
  } catch (e) {
    console.error('[DebugViewerIPC] Could not open KnowledgeDB:', e.message);
    return null;
  }
}

// Loads character name from character.json (for summarization labels).
function getCharacterName() {
  try { return JSON.parse(fs.readFileSync(CHARACTER_PATH, 'utf-8')).name || 'Aria'; } catch { return 'Aria'; }
}

// Extracts user+assistant message pairs from a parsed session's exchanges.
function exchangesToMessages(exchanges) {
  const messages = [];
  for (const ex of exchanges) {
    if (ex.userMessage?.message) {
      messages.push({ role: 'user', content: ex.userMessage.message });
    }
    if (ex.claudeResponse?.dialogue) {
      messages.push({ role: 'assistant', content: ex.claudeResponse.dialogue });
    }
  }
  return messages;
}

let debugWindow = null;

// ── Session Reading ────────────────────────────────────────────────────────────

function listSlots() {
  const slots = [];

  // Rolling slots (slot-1 through slot-5)
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const slotDir = path.join(DEBUG_DIR, `slot-${i}`);
    const metaPath = path.join(slotDir, 'meta.json');
    const jsonlPath = path.join(slotDir, 'session.jsonl');
    if (!fs.existsSync(metaPath) || !fs.existsSync(jsonlPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const stat = fs.statSync(jsonlPath);
      slots.push({ dirName: `slot-${i}`, slot: i, pinned: false, startedAt: meta.startedAt || null, fileSize: stat.size });
    } catch { /* skip corrupt */ }
  }

  // Pinned sessions (saved-* directories — immune to rotation)
  try {
    const entries = fs.readdirSync(DEBUG_DIR);
    for (const entry of entries.filter(e => e.startsWith('saved-')).sort()) {
      const dir = path.join(DEBUG_DIR, entry);
      const metaPath = path.join(dir, 'meta.json');
      const jsonlPath = path.join(dir, 'session.jsonl');
      if (!fs.existsSync(jsonlPath)) continue;
      try {
        const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};
        const stat = fs.statSync(jsonlPath);
        slots.push({ dirName: entry, slot: null, pinned: true, startedAt: meta.startedAt || null, fileSize: stat.size });
      } catch { /* skip corrupt */ }
    }
  } catch { /* DEBUG_DIR may not exist */ }

  return slots;
}

// slotOrDir: a slot number (1-5) or a directory name string (e.g. 'saved-1')
function parseSession(slotOrDir) {
  const dirName = typeof slotOrDir === 'number' ? `slot-${slotOrDir}` : slotOrDir;
  const jsonlPath = path.join(DEBUG_DIR, dirName, 'session.jsonl');
  if (!fs.existsSync(jsonlPath)) return { events: [], exchanges: [] };

  const raw = fs.readFileSync(jsonlPath, 'utf-8');
  const lines = raw.trim().split('\n').filter(Boolean);
  const events = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }

  // Group events into exchanges: each exchange = one user message + its claude response
  const exchanges = [];
  let pendingExchange = null;

  for (const ev of events) {
    if (ev.type === 'session_start' || ev.type === 'startup') continue;

    if (ev.type === 'user_message') {
      // Flush any pending exchange that never got a response (shouldn't happen, but safety)
      if (pendingExchange) exchanges.push(pendingExchange);
      pendingExchange = {
        userMessage: ev,
        claudeCall: null,
        claudeResponse: null,
        memoryOps: [],
      };
    } else if (ev.type === 'claude_call' && pendingExchange) {
      pendingExchange.claudeCall = ev;
    } else if (ev.type === 'claude_response' && pendingExchange) {
      pendingExchange.claudeResponse = ev;
    } else if (ev.type === 'memory_ops' && pendingExchange) {
      pendingExchange.memoryOps.push(ev);
    } else if (ev.type === 'claude_response' && !pendingExchange) {
      // Orphaned response — create an exchange with no user message
      exchanges.push({
        userMessage: null,
        claudeCall: null,
        claudeResponse: ev,
        memoryOps: [],
      });
    }

    // Once we have a response, finalize the exchange
    if (pendingExchange && pendingExchange.claudeResponse) {
      exchanges.push(pendingExchange);
      pendingExchange = null;
    }
  }
  // Flush any incomplete exchange at end (e.g. in-flight when app closed)
  if (pendingExchange) exchanges.push(pendingExchange);

  return { events, exchanges };
}

// ── Window Creation ────────────────────────────────────────────────────────────

function createDebugWindow(parentWindow) {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.focus();
    return;
  }

  debugWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    parent: parentWindow || undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/debug-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    title: 'Debug Viewer',
  });

  debugWindow.loadFile(path.join(__dirname, '../renderer/debug-viewer.html'));

  debugWindow.once('ready-to-show', () => {
    debugWindow.show();
  });

  debugWindow.on('closed', () => {
    debugWindow = null;
  });
}

// ── IPC Registration ────────────────────────────────────────────────────────────

function registerDebugViewerIPC(mainWindow, db) {
  // Open the debug viewer window
  ipcMain.on('debug-viewer:open', () => {
    createDebugWindow(mainWindow);
  });

  // Window controls for the debug viewer itself
  ipcMain.on('debug-viewer:minimize', () => debugWindow?.minimize());
  ipcMain.on('debug-viewer:maximize', () => {
    debugWindow?.isMaximized() ? debugWindow.unmaximize() : debugWindow?.maximize();
  });
  ipcMain.on('debug-viewer:close', () => debugWindow?.destroy());

  // List available slots
  ipcMain.handle('debug-viewer:list-slots', () => {
    try { return { success: true, slots: listSlots() }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  // Load a session by slot number or directory name (e.g. 'saved-1')
  ipcMain.handle('debug-viewer:load-session', (event, slotOrDir) => {
    try {
      const data = parseSession(slotOrDir);
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Pin the current slot — copies it to saved-N so it won't be rotated away
  ipcMain.handle('debug-viewer:pin-slot', (event, slot) => {
    try {
      const slotDir = path.join(DEBUG_DIR, `slot-${slot}`);
      if (!fs.existsSync(slotDir)) return { success: false, error: 'Slot not found.' };
      // Find next available saved-N name
      let n = 1;
      while (fs.existsSync(path.join(DEBUG_DIR, `saved-${n}`))) n++;
      const destDir = path.join(DEBUG_DIR, `saved-${n}`);
      fs.cpSync(slotDir, destDir, { recursive: true });
      return { success: true, name: `saved-${n}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Open system prompt pop-out (a new small window with plain text)
  ipcMain.on('debug-viewer:open-sysprompt', (event, systemPrompt) => {
    const win = new BrowserWindow({
      width: 700,
      height: 600,
      frame: false,
      backgroundColor: '#0a0a0f',
      parent: debugWindow || undefined,
      webPreferences: {
        preload: path.join(__dirname, '../preload/debug-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      show: false,
      title: 'System Prompt',
    });

    // Encode prompt as data URL to avoid IPC timing issues
    const escaped = systemPrompt
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;background:#0a0a0f;color:#00ffcc;font-family:'Courier New',monospace;font-size:12px;overflow:hidden;}
  #titlebar{height:32px;background:#0d0d16;border-bottom:1px solid #00ff8833;display:flex;align-items:center;justify-content:space-between;padding:0 10px;-webkit-app-region:drag;}
  #titlebar span{font-size:11px;letter-spacing:3px;color:#00ffcc;text-shadow:0 0 8px #00ffcc;}
  #close-btn{-webkit-app-region:no-drag;background:none;border:1px solid #ff224433;color:#ff224488;width:24px;height:20px;cursor:pointer;font-size:10px;font-family:'Courier New',monospace;}
  #close-btn:hover{background:#ff2244;color:#fff;}
  #content{height:calc(100% - 32px);overflow-y:auto;padding:14px 16px;white-space:pre-wrap;word-break:break-word;line-height:1.6;scrollbar-width:thin;scrollbar-color:#007755 transparent;}
  .crt{position:fixed;inset:0;pointer-events:none;z-index:9999;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px);}
</style>
</head><body>
<div class="crt"></div>
<div id="titlebar">
  <span>// SYSTEM_PROMPT</span>
  <button id="close-btn" onclick="window.syspromptAPI.close()">✕</button>
</div>
<div id="content">${escaped}</div>
<script>
  document.getElementById('close-btn').addEventListener('click', () => {
    window.syspromptAPI && window.syspromptAPI.close
      ? window.syspromptAPI.close()
      : window.close();
  });
</script>
</body></html>`;

    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    win.once('ready-to-show', () => win.show());
  });

  // Generic pop-out that loads a caller-provided HTML string
  ipcMain.on('debug-viewer:open-extract-result', (event, fullHtml) => {
    const win = new BrowserWindow({
      width: 560,
      height: 520,
      frame: false,
      backgroundColor: '#0a0a0f',
      parent: debugWindow || undefined,
      webPreferences: {
        preload: path.join(__dirname, '../preload/debug-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      show: false,
      title: 'Extract Result',
    });
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));
    win.once('ready-to-show', () => win.show());
  });

  // List all saved conversations (from DB)
  ipcMain.handle('debug-viewer:list-saved-conversations', () => {
    try {
      const d = getDb(db);
      if (!d) return { success: true, conversations: [] };
      const rows = d.prepare(
        'SELECT id, started_at, ended_at, message_count, summary FROM conversation_sessions ORDER BY id DESC'
      ).all();
      return { success: true, conversations: rows };
    } catch (err) {
      return { success: false, error: err.message, conversations: [] };
    }
  });

  // Load one saved conversation (returns messages_json + summary)
  ipcMain.handle('debug-viewer:load-saved-conversation', (event, id) => {
    try {
      const d = getDb(db);
      if (!d) return { success: false, error: 'DB unavailable' };
      const row = d.prepare('SELECT * FROM conversation_sessions WHERE id = ?').get(id);
      if (!row) return { success: false, error: 'Not found' };
      let messages = [];
      try { messages = JSON.parse(row.messages_json || '[]'); } catch {}
      return { success: true, id: row.id, summary: row.summary, savedAt: row.ended_at, messageCount: row.message_count, messages };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Save a debug session slot to conversation_sessions + master summary
  ipcMain.handle('debug-viewer:save-slot-to-memory', async (event, slot) => {
    try {
      const data = parseSession(slot);
      const messages = exchangesToMessages(data.exchanges);
      if (!messages.length) return { success: false, error: 'No messages found in this session.' };

      const characterName = getCharacterName();
      const { summary } = await summarizeConversation({ messages, characterName });

      const kdb = getKdb(db);
      if (!kdb) return { success: false, error: 'Database unavailable.' };

      const now = new Date().toISOString();
      kdb.insertConversationSession({
        startedAt: null,
        endedAt: now,
        messageCount: messages.length,
        summary,
        messagesJson: JSON.stringify(messages),
      });

      const existing = kdb.getMasterSummary();
      const dateStr = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
      const newSummary = existing
        ? `${existing}\n\n[Saved ${dateStr}] ${summary}`
        : `[Saved ${dateStr}] ${summary}`;
      kdb.setMasterSummary(newSummary);

      return { success: true, summary, messageCount: messages.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Extract memories from a session slot or saved conversation and insert into DB
  ipcMain.handle('debug-viewer:extract-memories', async (event, opts) => {
    try {
      let messages = [];

      if (opts.slot != null || opts.dirName != null) {
        // From a debug session slot or pinned dir
        const data = parseSession(opts.dirName || opts.slot);
        messages = exchangesToMessages(data.exchanges);
      } else if (opts.savedId != null) {
        // From a saved conversation_session
        const d = getDb(db);
        if (!d) return { success: false, error: 'DB unavailable' };
        const row = d.prepare('SELECT messages_json FROM conversation_sessions WHERE id = ?').get(opts.savedId);
        if (!row) return { success: false, error: 'Saved conversation not found.' };
        try { messages = JSON.parse(row.messages_json || '[]'); } catch {}
      }

      if (!messages.length) return { success: false, error: 'No messages to scan.' };

      const characterName = getCharacterName();
      const { memories, selfFacts } = await extractMemories({ messages, characterName });

      const kdb = getKdb(db);
      if (!kdb) return { success: false, error: 'Database unavailable.' };

      let memoriesAdded = 0;
      let selfAdded = 0;

      for (const m of memories) {
        try {
          kdb.insertMemory({ category: m.category, content: m.content, source: 'auto_detected' });
          memoriesAdded++;
        } catch {}
      }
      for (const s of selfFacts) {
        try {
          kdb.insertMemory({ category: s.category, content: s.content, source: 'companion_self' });
          selfAdded++;
        } catch {}
      }

      return { success: true, memoriesAdded, selfAdded, total: memoriesAdded + selfAdded, memories, selfFacts };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerDebugViewerIPC };
