// Music Engine — main-process module that owns the soundtrack bible and the
// physical music library on disk.
//
// Responsibilities:
//   - Load ref/_bible.json (167 cue entries) at startup
//   - Scan music/{category}/ folders and map each bible_id → list of variant
//     MP3 absolute paths
//   - Provide cue lookup by id, by name, and by mood/energy filter
//   - Provide a slim text manifest formatter suitable for inclusion in the
//     Adventure system prompt (so Claude can pick cues by id)
//
// Playback itself happens in the renderer via HTML5 <audio> — this module is
// pure data + path resolution.

const fs   = require('fs');
const path = require('path');

const BIBLE_PATH = path.join(__dirname, '..', '..', 'ref', '_bible.json');
const MUSIC_DIR  = path.join(__dirname, '..', '..', 'music');

let _tracks       = [];   // raw bible track array
let _byId         = new Map();
let _byName       = new Map();   // normalized lowercased name → track
let _variantFiles = new Map();   // bible_id → [{ path, variant, basename }]
let _loaded       = false;

function _normalizeName(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function _scanMusicDir() {
  // Each category folder is named like "01 - Field & Overworld". Inside, each
  // file is like "001 - Forest (Day) (var 2) [hash].mp3". We bucket files by
  // the leading 3-digit bible_id so name typos don't trip us up.
  _variantFiles = new Map();
  if (!fs.existsSync(MUSIC_DIR)) {
    console.warn('[MusicEngine] music/ directory not found at', MUSIC_DIR);
    return;
  }
  for (const cat of fs.readdirSync(MUSIC_DIR)) {
    const catPath = path.join(MUSIC_DIR, cat);
    let stat;
    try { stat = fs.statSync(catPath); } catch { continue; }
    if (!stat.isDirectory()) continue;
    for (const file of fs.readdirSync(catPath)) {
      if (!file.toLowerCase().endsWith('.mp3')) continue;
      const m = file.match(/^(\d{3})\s*-\s*(.+?)\s*\(var\s*(\d+)\)\s*\[[^\]]+\]\.mp3$/i);
      if (!m) {
        // Some files may have been renamed; still try to extract just the id.
        const m2 = file.match(/^(\d{3})/);
        if (!m2) continue;
        const id = parseInt(m2[1], 10);
        if (!_variantFiles.has(id)) _variantFiles.set(id, []);
        _variantFiles.get(id).push({ path: path.join(catPath, file), variant: 1, basename: file });
        continue;
      }
      const id = parseInt(m[1], 10);
      const variant = parseInt(m[3], 10);
      if (!_variantFiles.has(id)) _variantFiles.set(id, []);
      _variantFiles.get(id).push({ path: path.join(catPath, file), variant, basename: file });
    }
  }
  // Stable sort variants by variant number
  for (const arr of _variantFiles.values()) arr.sort((a, b) => a.variant - b.variant);
}

function load() {
  if (_loaded) return;
  try {
    const bible = JSON.parse(fs.readFileSync(BIBLE_PATH, 'utf8'));
    _tracks = Array.isArray(bible.tracks) ? bible.tracks : [];
    _byId   = new Map();
    _byName = new Map();
    for (const t of _tracks) {
      _byId.set(t.id, t);
      _byName.set(_normalizeName(t.name), t);
    }
    _scanMusicDir();
    _loaded = true;
    const filesAvailable = [..._variantFiles.values()].reduce((n, arr) => n + arr.length, 0);
    console.log(`[MusicEngine] loaded ${_tracks.length} cues, ${_variantFiles.size} cues with files (${filesAvailable} mp3s)`);
  } catch (e) {
    console.warn('[MusicEngine] failed to load bible:', e.message);
    _loaded = true;  // mark loaded so we don't retry forever; engine just returns nothing
  }
}

function isLoaded() { return _loaded; }
function hasLibrary() { return _tracks.length > 0; }

function getTrackById(id) {
  load();
  return _byId.get(Number(id)) || null;
}

function getTrackByName(name) {
  load();
  return _byName.get(_normalizeName(name)) || null;
}

function getVariantPathsForId(id) {
  load();
  return _variantFiles.get(Number(id)) || [];
}

// Resolves any caller-supplied identifier (number id, numeric string, or name)
// to a track + a randomly chosen variant file path.
function resolveCue(idOrName, { variantHint = null } = {}) {
  load();
  let track = null;
  if (typeof idOrName === 'number') {
    track = getTrackById(idOrName);
  } else if (typeof idOrName === 'string') {
    const trimmed = idOrName.trim();
    if (/^\d+$/.test(trimmed)) track = getTrackById(parseInt(trimmed, 10));
    if (!track) track = getTrackByName(trimmed);
  }
  if (!track) return null;
  const variants = getVariantPathsForId(track.id);
  if (variants.length === 0) {
    return { track, file: null, variant: null, available: false };
  }
  let chosen;
  if (variantHint && variants.find((v) => v.variant === variantHint)) {
    chosen = variants.find((v) => v.variant === variantHint);
  } else {
    chosen = variants[Math.floor(Math.random() * variants.length)];
  }
  return {
    track,
    file:     chosen.path,
    variant:  chosen.variant,
    basename: chosen.basename,
    available: true,
  };
}

// Mood/energy fallback search — used when a name lookup fails. moods is an
// array of mood tags (any overlap counts); energy is optional filter.
function searchByMoodEnergy({ moods = [], energy = null, category = null } = {}) {
  load();
  const moodSet = new Set(moods.map((m) => String(m).toUpperCase()));
  const matches = [];
  for (const t of _tracks) {
    const overlap = (t.mood || []).filter((m) => moodSet.has(String(m).toUpperCase())).length;
    if (moodSet.size > 0 && overlap === 0) continue;
    if (energy && String(t.energy).toUpperCase() !== String(energy).toUpperCase()) continue;
    if (category && !(t.category || '').toUpperCase().includes(String(category).toUpperCase())) continue;
    matches.push({ track: t, score: overlap });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.map((m) => m.track);
}

// ── Slim manifest for system prompts ────────────────────────────────────────
//
// Returns a compact text block listing every cue the bible knows about, formatted
// for Claude to pick from. Format per line:
//
//   <id> | <name> | <energy> | <mood1>,<mood2>,... | <function>
//
// 167 cues × ~80 chars = ~13 KB. Rides in the cached system prompt so the
// first-call cost is amortized.

function formatBibleForPrompt() {
  load();
  if (_tracks.length === 0) return '(soundtrack bible not available — music disabled)';
  const lines = ['MUSIC CUE CATALOG (use the leading id with the [MUSIC] tag):'];
  let curCat = null;
  for (const t of _tracks) {
    if (t.category !== curCat) {
      curCat = t.category;
      lines.push(`\n[ ${t.category} ]`);
    }
    const moods = (t.mood || []).join(',');
    lines.push(`${String(t.id).padStart(3, '0')} | ${t.name} | ${t.energy} | ${moods} | ${t.function}`);
  }
  return lines.join('\n');
}

// Resolve a cue and produce the payload the renderer needs to play it.
function resolveCueForPayload(idOrName) {
  const r = resolveCue(idOrName);
  if (!r) return { ok: false, reason: `cue "${idOrName}" not found in bible` };
  if (!r.available) return { ok: false, reason: `cue ${r.track.id} (${r.track.name}) has no MP3 on disk` };
  return {
    ok:        true,
    bibleId:   r.track.id,
    name:      r.track.name,
    category:  r.track.category,
    mood:      r.track.mood,
    energy:    r.track.energy,
    function:  r.track.function,
    variant:   r.variant,
    file:      r.file,
    basename:  r.basename,
  };
}

module.exports = {
  load,
  isLoaded,
  hasLibrary,
  getTrackById,
  getTrackByName,
  getVariantPathsForId,
  resolveCue,
  resolveCueForPayload,
  searchByMoodEnergy,
  formatBibleForPrompt,
};
