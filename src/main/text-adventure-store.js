// Text-adventure state storage.
//
// One game per character. State lives in characters/<name>/text-adventure.json,
// the scrolling log lives in characters/<name>/text-adventure-log.json, and
// the side-chat transcript lives in characters/<name>/text-adventure-side-chat.json.
//
// Death (either character) → ALL THREE files are wiped on the next reset/new-game.
// Exiting adventure mode mid-run does NOT wipe — the user can resume later.

const fs   = require('fs');
const path = require('path');

const STATE_FILENAME     = 'text-adventure.json';
const LOG_FILENAME       = 'text-adventure-log.json';
const SIDECHAT_FILENAME  = 'text-adventure-side-chat.json';

const LOG_MAX_ENTRIES       = 200;
const SIDECHAT_MAX_ENTRIES  = 80;

// Hard caps so long campaigns can't bloat the prompt unbounded. Claude is
// expected to prune via [GAME_STATE].memory.*.remove when things go stale,
// but the engine enforces a ceiling.
const MEMORY_CAPS = {
  npcs:      80,
  locations: 60,
  quests:    40,
  events:    120,
  lore:      80,
};

// Sixteen monsters available — names must match the slug filenames in
// assets/monsters/<slug>.png. Pretty labels are what Claude/UI display.
const MONSTER_LIST = [
  { slug: 'goblin',      name: 'Goblin',       difficulty: 1 },
  { slug: 'giant_bug',   name: 'Giant Bug',    difficulty: 1 },
  { slug: 'slime',       name: 'Slime',        difficulty: 1 },
  { slug: 'kobold',      name: 'Kobold',       difficulty: 1 },
  { slug: 'wolf',        name: 'Wolf',         difficulty: 2 },
  { slug: 'bandit',      name: 'Bandit',       difficulty: 2 },
  { slug: 'skeleton',    name: 'Skeleton',     difficulty: 2 },
  { slug: 'zombie',      name: 'Zombie',       difficulty: 2 },
  { slug: 'mimic_chest', name: 'Mimic Chest',  difficulty: 3 },
  { slug: 'harpy',       name: 'Harpy',        difficulty: 3 },
  { slug: 'living_tree', name: 'Living Tree',  difficulty: 3 },
  { slug: 'gargoyle',    name: 'Gargoyle',     difficulty: 4 },
  { slug: 'ogre',        name: 'Ogre',         difficulty: 4 },
  { slug: 'wraith',      name: 'Wraith',       difficulty: 4 },
  { slug: 'dark_mage',   name: 'Dark Mage',    difficulty: 5 },
  { slug: 'minotaur',    name: 'Minotaur',     difficulty: 5 },
];

function _statePath   (characterDir) { return path.join(characterDir, STATE_FILENAME);     }
function _logPath     (characterDir) { return path.join(characterDir, LOG_FILENAME);       }
function _sideChatPath(characterDir) { return path.join(characterDir, SIDECHAT_FILENAME);  }

// ── Default state ──────────────────────────────────────────────────────────────

function _emptyCharacter(overrides = {}) {
  return {
    name:    'Hero',
    level:    1,
    xp:       0,
    xpToNext: 50,
    hp:       20,
    maxHp:    20,
    mp:       10,
    maxMp:    10,
    str:      8,
    dex:      8,
    int:      8,
    wis:      8,
    con:      8,
    luck:     8,
    illness:  null,
    gold:     0,
    inventory: [],
    equipment: { weapon: null, offhand: null, head: null, body: null, feet: null, accessory: null },
    spells:    [],
    abilities: [],
    buffs:     [],
    debuffs:   [],
    alive:     true,
    ...overrides,
  };
}

function _freshPlayer() {
  return _emptyCharacter({
    name:    'Trist',
    str:     9,  // slight warrior lean — Aria covers magic
    con:     9,
    gold:    10,
  });
}

function _freshAria() {
  return _emptyCharacter({
    name:    'Aria',
    hp:      18, maxHp: 18,
    mp:      14, maxMp: 14,
    str:      7,
    dex:      9,
    int:     10,
    wis:      9,
    con:      7,
    luck:     8,
    spells: [
      { id: 'firebolt',   name: 'Firebolt',   cost: 3, desc: 'A small darting flame she can throw at one foe.' },
      { id: 'mend_wound', name: 'Mend Wound', cost: 4, desc: 'Closes a gash and restores a little HP to an ally.' },
    ],
    gold:    0,
  });
}

function _freshMemory() {
  return {
    npcs:      [],   // [{ id, name, desc, location, status, notes }]
    locations: [],   // [{ id, name, desc, notable }]
    quests:    [],   // [{ id, name, desc, status: 'active'|'done'|'failed', notes }]
    events:    [],   // [{ turn, desc }]
    lore:      [],   // [string]
    currentSituation: '',  // short-term: where we are, what's happening right now
    immediateGoal:    '',  // short-term: what we're trying to do next
    storySummary:     '',  // rolling prose recap of the campaign — refreshed by Claude after major beats
    storySummaryUpdatedTurn: 0,  // turn the recap was last rewritten
  };
}

function _freshState({ tone, setting }) {
  return {
    version:  3,
    started:  new Date().toISOString(),
    tone:     tone    || 'classic_high_fantasy',
    setting:  setting || '',
    scene:    { name: 'The Beginning', area: 'Unknown' },
    time:     { dayCount: 1, phase: 'morning', label: 'Day 1 — Morning' },
    player:   _freshPlayer(),
    aria:     _freshAria(),
    memory:   _freshMemory(),
    enemy:        null,
    encounterIdx: 0,
    turnCount:    0,
    alive:        true,
    deathCause:   null,
    deathOf:      null,   // 'player' | 'aria' | null
  };
}

function _emptyLog()      { return []; }
function _emptySideChat() { return []; }

// ── File I/O ───────────────────────────────────────────────────────────────────

function loadState(characterDir) {
  try {
    const p = _statePath(characterDir);
    if (!fs.existsSync(p)) return null;
    const state = JSON.parse(fs.readFileSync(p, 'utf8'));
    // Forward-compat: backfill any new top-level fields older saves are missing.
    if (!state.aria)   state.aria   = _freshAria();
    if (!state.memory) state.memory = _freshMemory();
    if (!state.time)   state.time   = { dayCount: 1, phase: 'morning', label: 'Day 1 — Morning' };
    return state;
  } catch (e) {
    console.warn('[TextAdventure] loadState failed:', e.message);
    return null;
  }
}

function saveState(characterDir, state) {
  fs.writeFileSync(_statePath(characterDir), JSON.stringify(state, null, 2), 'utf8');
}

function loadLog(characterDir) {
  try {
    const p = _logPath(characterDir);
    if (!fs.existsSync(p)) return _emptyLog();
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return _emptyLog(); }
}

function saveLog(characterDir, log) {
  const trimmed = log.slice(-LOG_MAX_ENTRIES);
  fs.writeFileSync(_logPath(characterDir), JSON.stringify(trimmed, null, 2), 'utf8');
}

function appendLog(characterDir, entry) {
  const log = loadLog(characterDir);
  log.push({ ...entry, t: new Date().toISOString() });
  saveLog(characterDir, log);
  return log;
}

// ── Side-chat I/O ──────────────────────────────────────────────────────────────

function loadSideChat(characterDir) {
  try {
    const p = _sideChatPath(characterDir);
    if (!fs.existsSync(p)) return _emptySideChat();
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return _emptySideChat(); }
}

function saveSideChat(characterDir, chat) {
  const trimmed = chat.slice(-SIDECHAT_MAX_ENTRIES);
  fs.writeFileSync(_sideChatPath(characterDir), JSON.stringify(trimmed, null, 2), 'utf8');
}

function appendSideChat(characterDir, entry) {
  const chat = loadSideChat(characterDir);
  chat.push({ ...entry, t: new Date().toISOString() });
  saveSideChat(characterDir, chat);
  return chat;
}

function clearSideChat(characterDir) {
  try { fs.unlinkSync(_sideChatPath(characterDir)); } catch {}
}

// ── Game lifecycle ─────────────────────────────────────────────────────────────

function newGame(characterDir, { tone, setting } = {}) {
  const state = _freshState({ tone, setting });
  saveState(characterDir, state);
  saveLog(characterDir, _emptyLog());
  saveSideChat(characterDir, _emptySideChat());
  return state;
}

function resetGame(characterDir) {
  try { fs.unlinkSync(_statePath   (characterDir)); } catch {}
  try { fs.unlinkSync(_logPath     (characterDir)); } catch {}
  try { fs.unlinkSync(_sideChatPath(characterDir)); } catch {}
}

// ── State diff helpers ─────────────────────────────────────────────────────────

function _applyDelta(target, delta) {
  if (!delta || typeof delta !== 'object') return;
  for (const [k, v] of Object.entries(delta)) {
    if (typeof v !== 'number') continue;
    if (typeof target[k] !== 'number') continue;
    target[k] = target[k] + v;
  }
}

function _applySet(target, set) {
  if (!set || typeof set !== 'object') return;
  for (const [k, v] of Object.entries(set)) {
    target[k] = v;
  }
}

function _normalizeId(s) {
  return String(s || '').toLowerCase().trim();
}

function _addCollection(arr, items, capKey) {
  if (!Array.isArray(items)) return;
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const existingIdx = arr.findIndex((x) =>
      (it.id && x.id && _normalizeId(x.id) === _normalizeId(it.id)) ||
      (!it.id && it.name && x.name && _normalizeId(x.name) === _normalizeId(it.name))
    );
    if (existingIdx !== -1 && typeof it.qty === 'number' && typeof arr[existingIdx].qty === 'number') {
      arr[existingIdx].qty += it.qty;
    } else {
      arr.push({ ...it });
    }
  }
  // Enforce hard cap (drop oldest)
  if (capKey && MEMORY_CAPS[capKey] && arr.length > MEMORY_CAPS[capKey]) {
    arr.splice(0, arr.length - MEMORY_CAPS[capKey]);
  }
}

function _addStrings(arr, items, capKey) {
  if (!Array.isArray(items)) return;
  for (const s of items) {
    if (typeof s !== 'string') continue;
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (!arr.includes(trimmed)) arr.push(trimmed);
  }
  if (capKey && MEMORY_CAPS[capKey] && arr.length > MEMORY_CAPS[capKey]) {
    arr.splice(0, arr.length - MEMORY_CAPS[capKey]);
  }
}

function _removeCollection(arr, ids) {
  if (!Array.isArray(ids)) return;
  for (const ref of ids) {
    const key = typeof ref === 'string' ? ref : (ref && (ref.id || ref.name));
    if (!key) continue;
    const norm = _normalizeId(key);
    const idx = arr.findIndex((x) =>
      (x.id && _normalizeId(x.id) === norm) ||
      (x.name && _normalizeId(x.name) === norm)
    );
    if (idx !== -1) arr.splice(idx, 1);
  }
}

function _removeStrings(arr, items) {
  if (!Array.isArray(items)) return;
  for (const s of items) {
    if (typeof s !== 'string') continue;
    const idx = arr.findIndex((x) => x.toLowerCase().trim() === s.toLowerCase().trim());
    if (idx !== -1) arr.splice(idx, 1);
  }
}

function _updateCollection(arr, updates) {
  if (!Array.isArray(updates)) return;
  for (const upd of updates) {
    if (!upd || typeof upd !== 'object') continue;
    const norm = _normalizeId(upd.id || upd.name);
    if (!norm) continue;
    const target = arr.find((x) =>
      (x.id && _normalizeId(x.id) === norm) ||
      (x.name && _normalizeId(x.name) === norm)
    );
    if (target) Object.assign(target, upd);
  }
}

// Apply a character-block diff (used for both player and aria — they share schema).
function _applyCharacterDiff(target, diff) {
  if (!diff || typeof diff !== 'object') return;
  _applyDelta(target, diff.delta || {});
  _applySet  (target, diff.set   || {});
  if (diff.inventory) {
    _addCollection   (target.inventory, diff.inventory.add    || []);
    _removeCollection(target.inventory, diff.inventory.remove || []);
  }
  if (Array.isArray(diff.equipment)) {
    for (const e of diff.equipment) {
      if (e && e.slot && Object.prototype.hasOwnProperty.call(target.equipment, e.slot)) {
        target.equipment[e.slot] = e.item || null;
      }
    }
  }
  for (const key of ['spells', 'abilities', 'buffs', 'debuffs']) {
    if (diff[key]) {
      _addCollection   (target[key], diff[key].add    || []);
      _removeCollection(target[key], diff[key].remove || []);
    }
  }
}

// ── State diff application ─────────────────────────────────────────────────────

function applyStateDiff(state, diff) {
  if (!diff || typeof diff !== 'object') return state;

  // Character diffs
  if (diff.player) _applyCharacterDiff(state.player, diff.player);
  if (diff.aria)   _applyCharacterDiff(state.aria,   diff.aria);

  // Scene
  if (diff.scene && typeof diff.scene === 'object') {
    state.scene = { ...state.scene, ...diff.scene };
  }

  // Time of day — { dayCount, phase, label } — set as a partial merge.
  if (diff.time && typeof diff.time === 'object') {
    state.time = { ...state.time, ...diff.time };
    // Auto-derive label if Claude only updated dayCount/phase and forgot label
    if (!diff.time.label && state.time.dayCount && state.time.phase) {
      const phaseTitle = String(state.time.phase).replace(/^\w/, (c) => c.toUpperCase());
      state.time.label = `Day ${state.time.dayCount} — ${phaseTitle}`;
    }
  }

  // Enemy
  if (Object.prototype.hasOwnProperty.call(diff, 'enemy')) {
    const wasEnemy = !!state.enemy;
    state.enemy = diff.enemy || null;
    if (state.enemy && !wasEnemy) state.encounterIdx += 1;
  }

  // Memory diffs
  if (diff.memory && typeof diff.memory === 'object') {
    const mem = state.memory;
    if (diff.memory.set && typeof diff.memory.set === 'object') {
      if (typeof diff.memory.set.currentSituation === 'string') mem.currentSituation = diff.memory.set.currentSituation;
      if (typeof diff.memory.set.immediateGoal    === 'string') mem.immediateGoal    = diff.memory.set.immediateGoal;
      if (typeof diff.memory.set.storySummary     === 'string') {
        mem.storySummary = diff.memory.set.storySummary;
        mem.storySummaryUpdatedTurn = state.turnCount + 1;  // turnCount is pre-tick here
      }
    }
    for (const collKey of ['npcs', 'locations', 'quests']) {
      const d = diff.memory[collKey];
      if (!d) continue;
      _addCollection   (mem[collKey], d.add    || [], collKey);
      _removeCollection(mem[collKey], d.remove || []);
      _updateCollection(mem[collKey], d.update || []);
    }
    if (diff.memory.events) {
      _addCollection   (mem.events, diff.memory.events.add    || [], 'events');
      _removeCollection(mem.events, diff.memory.events.remove || []);
    }
    if (diff.memory.lore) {
      _addStrings   (mem.lore, diff.memory.lore.add    || [], 'lore');
      _removeStrings(mem.lore, diff.memory.lore.remove || []);
    }
  }

  // Direct top-level pass-throughs
  if (typeof diff.turnCount === 'number') state.turnCount = diff.turnCount;
  if (diff.deathCause)                    state.deathCause = String(diff.deathCause).slice(0, 400);
  if (diff.deathOf && ['player', 'aria'].includes(diff.deathOf)) state.deathOf = diff.deathOf;

  return state;
}

// ── Tick + survival check ──────────────────────────────────────────────────────

function _tickCharacter(c) {
  if (!c) return;
  c.hp   = Math.max(0, Math.min(c.maxHp, c.hp));
  c.mp   = Math.max(0, Math.min(c.maxMp, c.mp));
  if (typeof c.gold === 'number') c.gold = Math.max(0, c.gold);
  while (c.xp >= c.xpToNext) {
    c.xp      -= c.xpToNext;
    c.level   += 1;
    c.xpToNext = Math.round(c.xpToNext * 1.5 + 25);
    c.maxHp   += 5;
    c.hp       = c.maxHp;
    c.maxMp   += 2;
    c.mp       = c.maxMp;
  }
  for (const key of ['buffs', 'debuffs']) {
    c[key] = (c[key] || []).filter((b) => {
      if (typeof b.turnsRemaining === 'number') {
        b.turnsRemaining -= 1;
        return b.turnsRemaining > 0;
      }
      return true;
    });
  }
  if (c.hp === 0) c.alive = false;
}

function tickStateAfterDiff(state) {
  _tickCharacter(state.player);
  _tickCharacter(state.aria);

  if (state.enemy) {
    state.enemy.hp = Math.max(0, state.enemy.hp);
    if (state.enemy.hp === 0) state.enemy = null;
  }

  // Either-died → game over
  if (!state.player.alive || !state.aria.alive) {
    state.alive = false;
    if (!state.deathOf) state.deathOf = !state.player.alive ? 'player' : 'aria';
  }

  // Bound events list by turn (and event entries get the current turn stamped
  // when Claude omits one).
  for (const ev of state.memory.events) {
    if (typeof ev.turn !== 'number') ev.turn = state.turnCount + 1;
  }

  state.turnCount += 1;
  return state;
}

// ── Compact-state helper for side-chat context ────────────────────────────────
//
// Produces a slim text summary of the current game so Aria, in a paused side
// chat, knows what's happening without us dumping the whole state JSON at
// her. Used by side-chat IPC; not sent during normal turns.

function formatStateSummary(state) {
  if (!state) return '(no game in progress)';
  const p = state.player;
  const a = state.aria;
  const m = state.memory;
  const parts = [];
  parts.push(`Tone: ${state.tone}${state.setting ? ` — "${state.setting}"` : ''}`);
  parts.push(`Scene: ${state.scene.name}${state.scene.area ? ` (${state.scene.area})` : ''}`);
  if (m.storySummary)     parts.push(`Story so far:\n${m.storySummary}`);
  if (m.currentSituation) parts.push(`Right now: ${m.currentSituation}`);
  if (m.immediateGoal)    parts.push(`Trying to: ${m.immediateGoal}`);
  parts.push(`Trist: lvl ${p.level} • HP ${p.hp}/${p.maxHp} • MP ${p.mp}/${p.maxMp}${p.illness ? ` • ${p.illness}` : ''}`);
  parts.push(`Aria:  lvl ${a.level} • HP ${a.hp}/${a.maxHp} • MP ${a.mp}/${a.maxMp}${a.illness ? ` • ${a.illness}` : ''}`);
  if (state.enemy) parts.push(`Active enemy: ${state.enemy.name} (HP ${state.enemy.hp}/${state.enemy.maxHp})`);
  const activeQuests = (m.quests || []).filter((q) => q.status === 'active' || !q.status);
  if (activeQuests.length) {
    parts.push('Active quests:');
    for (const q of activeQuests.slice(0, 5)) parts.push(`  - ${q.name}: ${q.desc || ''}`);
  }
  const recentEvents = (m.events || []).slice(-5);
  if (recentEvents.length) {
    parts.push('Recent events:');
    for (const e of recentEvents) parts.push(`  - ${e.desc}`);
  }
  return parts.join('\n');
}

// ── Public API ─────────────────────────────────────────────────────────────────

module.exports = {
  MONSTER_LIST,
  loadState,
  saveState,
  loadLog,
  saveLog,
  appendLog,
  loadSideChat,
  saveSideChat,
  appendSideChat,
  clearSideChat,
  newGame,
  resetGame,
  applyStateDiff,
  tickStateAfterDiff,
  formatStateSummary,
};
