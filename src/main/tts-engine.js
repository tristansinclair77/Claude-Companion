'use strict';
// TTS engine — three backends:
//   kokoro  : kokoro-js (English, local ONNX, no internet after first download)
//   vits    : local Python Flask server on localhost:5002 (anime JP voices)
//   rvc     : local Python Flask server on localhost:5003 (RVC voice conversion)
//             RVC pipeline: Kokoro generates source audio → RVC converts to target voice
//
// The active backend is determined by the voice ID prefix:
//   rvc:<FolderName>   → RVC backend
//   <vitsModelId>      → VITS backend (if the ID appears in the VITS models dir)
//   <kokoroId>         → Kokoro backend (default)
//
// If VITS or RVC synthesis fails, it falls back to kokoro silently.

const http   = require('http');
const path   = require('path');
const fs     = require('fs');
const { spawn } = require('child_process');

// ── State ─────────────────────────────────────────────────────────────────────

let _ttsPromise = null; // resolves to KokoroTTS instance once loaded
let _enabled    = true;
let _voice      = 'af_heart';
let _speed      = 1.0;
let _isVitsVoice = false;
let _isRvcVoice  = false;
let _vitsProc   = null; // child_process handle for the VITS server
let _rvcProc    = null; // child_process handle for the RVC server
let _rvcModelsDir   = '';
let _pitchShift     = 0;
let _indexRate      = 0.75;
let _f0method       = 'harvest';
let _protect        = 0.33;
let _rvcSourceVoice = ''; // voice ID to use as RVC input; empty = Kokoro af_heart

// ── Kokoro helpers ─────────────────────────────────────────────────────────────

function _initModel() {
  _ttsPromise = (async () => {
    console.log('[TTS] Loading Kokoro model (q8, ~86 MB on first run)…');
    const { KokoroTTS } = await import('kokoro-js');
    const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
      dtype:  'q8',
      device: 'cpu',
    });
    console.log('[TTS] Kokoro model ready.');
    return tts;
  })().catch(err => {
    console.warn('[TTS] model load failed:', err.message);
    _ttsPromise = null;
    throw err;
  });
}

async function _getTTS() {
  if (!_ttsPromise) _initModel();
  return _ttsPromise;
}

/** Encode Float32Array PCM samples to a WAV Buffer. */
function _toWav(samples, sampleRate) {
  const len = samples.length;
  const buf = Buffer.alloc(44 + len * 2);
  buf.write('RIFF',              0);
  buf.writeUInt32LE(36 + len * 2, 4);
  buf.write('WAVE',              8);
  buf.write('fmt ',             12);
  buf.writeUInt32LE(16,         16);
  buf.writeUInt16LE(1,          20); // PCM
  buf.writeUInt16LE(1,          22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2,          32); // block align
  buf.writeUInt16LE(16,         34); // bits per sample
  buf.write('data',             36);
  buf.writeUInt32LE(len * 2,    40);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7FFF), 44 + i * 2);
  }
  return buf;
}

/** Maximum characters per Kokoro synthesis call.
 *  Kokoro's ONNX model silently truncates at ~512 phoneme tokens (~450 English chars). */
const _KOKORO_CHUNK_LIMIT = 450;

/**
 * Split text into chunks of at most maxLen characters, breaking at sentence
 * boundaries (. ! ? ;) where possible, then at word boundaries.
 */
function _splitChunks(text, maxLen = _KOKORO_CHUNK_LIMIT) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let cutAt = -1;
    // Prefer a sentence-end boundary within the window
    for (let i = maxLen; i > 0; i--) {
      if ('.!?;'.includes(remaining[i])) { cutAt = i + 1; break; }
    }
    // Fall back to last space
    if (cutAt === -1) {
      for (let i = maxLen; i > 0; i--) {
        if (remaining[i] === ' ') { cutAt = i; break; }
      }
    }
    // Hard cut
    if (cutAt === -1) cutAt = maxLen;

    const chunk = remaining.slice(0, cutAt).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(cutAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.filter(c => c.length > 0);
}

/**
 * Generate Kokoro audio for arbitrarily long text by chunking at the model
 * limit, synthesising each piece, then concatenating the Float32 PCM samples.
 * Returns the same shape as tts.generate(): { audio: Float32Array, sampling_rate }.
 */
async function _kokoroGenerate(tts, text, voice) {
  const chunks = _splitChunks(text);
  if (chunks.length === 1) {
    return tts.generate(text, { voice, speed: _speed });
  }
  const parts = [];
  let sampleRate = 24000;
  for (const chunk of chunks) {
    const result = await tts.generate(chunk, { voice, speed: _speed });
    parts.push(result.audio);
    sampleRate = result.sampling_rate;
  }
  const totalLen = parts.reduce((n, a) => n + a.length, 0);
  const combined = new Float32Array(totalLen);
  let offset = 0;
  for (const part of parts) { combined.set(part, offset); offset += part.length; }
  return { audio: combined, sampling_rate: sampleRate };
}

/** Strip markup that shouldn't be spoken aloud. */
function _cleanText(text) {
  return text
    .replace(/\*[^*]*\*/g, '')   // remove *action text*
    .replace(/\*/g, '')           // remove any remaining lone asterisks
    .replace(/~/g, '')            // remove tildes (speech quirk marker)
    .replace(/\[DIALOGUE\]/gi, '')
    .replace(/\[THOUGHTS\]/gi, '')
    .replace(/\[MEMORY[^\]]*\]/gi, '')
    .replace(/\[SELF[^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── VITS helpers ──────────────────────────────────────────────────────────────

const _VITS_PORT = 5002;
const _MODELS_DIR = path.join(__dirname, '../../scripts/tts-server/models');

/** Return the folder names of all valid VITS model directories. */
function _getVitsModelIds() {
  try {
    return fs.readdirSync(_MODELS_DIR).filter(name => {
      const dir = path.join(_MODELS_DIR, name);
      try {
        return (
          fs.statSync(dir).isDirectory() &&
          fs.existsSync(path.join(dir, 'config.json')) &&
          fs.readdirSync(dir).some(f => f.endsWith('.pth'))
        );
      } catch { return false; }
    });
  } catch { return []; }
}

/** Parse a voice ID that may be "model_id" or "model_id:speaker_index". */
function _parseVoiceId(voiceId) {
  const colon = voiceId.lastIndexOf(':');
  if (colon !== -1) {
    const modelId    = voiceId.slice(0, colon);
    const speakerId  = parseInt(voiceId.slice(colon + 1), 10);
    return { modelId, speakerId: isNaN(speakerId) ? 0 : speakerId };
  }
  return { modelId: voiceId, speakerId: 0 };
}

/** Fetch synthesized WAV bytes from the VITS server. */
function _fetchVitsAudio(text, voice) {
  return new Promise((resolve, reject) => {
    const { modelId, speakerId } = _parseVoiceId(voice);
    const params = new URLSearchParams({ text, voice: modelId, speaker: String(speakerId) });
    const req = http.request(
      { hostname: '127.0.0.1', port: _VITS_PORT, path: `/synthesize?${params}`, method: 'GET' },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`VITS server returned HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end',  ()    => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.setTimeout(90000, () => { req.destroy(); reject(new Error('VITS request timeout')); });
    req.end();
  });
}

async function _synthesizeVits(text) {
  try {
    return await _fetchVitsAudio(text, _voice);
  } catch (err) {
    console.warn('[TTS] VITS failed, falling back to kokoro:', err.message);
    const saved = _voice;
    _voice = 'af_heart';
    try {
      const tts   = await _getTTS();
      const audio = await _kokoroGenerate(tts, text, 'af_heart');
      return _toWav(audio.audio, audio.sampling_rate);
    } finally {
      _voice = saved;
    }
  }
}

// ── RVC helpers ───────────────────────────────────────────────────────────────

const _RVC_PORT = 5003;

/** Return the folder names of all valid RVC model directories. */
function _getRvcModelIds() {
  if (!_rvcModelsDir) return [];
  try {
    return fs.readdirSync(_rvcModelsDir).filter(name => {
      const dir = path.join(_rvcModelsDir, name);
      try {
        if (!fs.statSync(dir).isDirectory()) return false;
        const files = fs.readdirSync(dir);
        return files.some(f => f.endsWith('.pth')) && files.some(f => f.endsWith('.index'));
      } catch { return false; }
    });
  } catch { return []; }
}

/**
 * POST a WAV buffer to the RVC server and return the converted WAV buffer.
 * voice should be in "rvc:ModelId" or "ModelId" format.
 */
function _fetchRvcAudio(wavBuffer, voice) {
  return new Promise((resolve, reject) => {
    const modelId = voice.startsWith('rvc:') ? voice.slice(4) : voice;
    const params  = new URLSearchParams({
      voice:      modelId,
      pitch:      String(_pitchShift),
      index_rate: String(_indexRate),
      protect:    String(_protect),
      f0:         _f0method,
    });
    const options = {
      hostname: '127.0.0.1',
      port:     _RVC_PORT,
      path:     `/convert?${params}`,
      method:   'POST',
      headers:  {
        'Content-Type':   'audio/wav',
        'Content-Length': wavBuffer.length,
      },
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          let msg = `RVC server returned HTTP ${res.statusCode}`;
          try { msg += ': ' + JSON.parse(Buffer.concat(chunks).toString()).error; } catch {}
          reject(new Error(msg));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('RVC request timeout')); });
    req.write(wavBuffer);
    req.end();
  });
}

/**
 * RVC synthesis pipeline:
 *   1. Generate source audio — VITS if configured, else Kokoro
 *   2. POST to RVC server for voice conversion
 *   3. Return converted WAV buffer (falls back to source audio on error)
 */
async function _synthesizeRvc(text) {
  // Determine whether source is a VITS model or Kokoro
  const srcVoice  = _rvcSourceVoice;
  const isKokoro  = !srcVoice || KOKORO_VOICES.some(v => v.id === srcVoice);
  const kokoroId  = isKokoro ? (srcVoice || 'af_heart') : 'af_heart';

  let sourceWav = null;

  // Try VITS source first (if configured)
  if (!isKokoro) {
    try {
      sourceWav = await _fetchVitsAudio(text, srcVoice);
      console.log('[TTS] RVC source: VITS', srcVoice);
    } catch (err) {
      console.warn('[TTS] VITS source failed, falling back to Kokoro:', err.message);
    }
  }

  // Kokoro fallback (or primary if source is Kokoro / VITS failed)
  if (!sourceWav) {
    try {
      const tts   = await _getTTS();
      const audio = await _kokoroGenerate(tts, text, kokoroId);
      sourceWav   = _toWav(audio.audio, audio.sampling_rate);
      if (isKokoro) console.log('[TTS] RVC source: Kokoro', kokoroId);
    } catch (err) {
      console.warn('[TTS] Source audio generation failed for RVC pipeline:', err.message);
      return null;
    }
  }

  try {
    return await _fetchRvcAudio(sourceWav, _voice);
  } catch (err) {
    console.warn('[TTS] RVC conversion failed, returning source audio:', err.message);
    return sourceWav;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the VITS Python server as a background child process.
 * Called once at app startup. Failures are silent — kokoro takes over.
 */
function startVitsServer() {
  const scriptPath = path.join(__dirname, '../../scripts/tts-server/server.py');
  if (!fs.existsSync(scriptPath)) {
    console.warn('[TTS] VITS server script not found:', scriptPath);
    return;
  }
  try {
    _vitsProc = spawn('python', [scriptPath, '--port', String(_VITS_PORT)], {
      stdio: 'pipe',
      cwd:   path.dirname(scriptPath),
      detached: false,
    });
    _vitsProc.stdout.on('data', d => console.log('[VITS]', d.toString().trimEnd()));
    _vitsProc.stderr.on('data', d => console.log('[VITS]', d.toString().trimEnd()));
    _vitsProc.on('error', err => console.warn('[VITS] server error:', err.message));
    _vitsProc.on('exit',  code => {
      if (code !== 0 && code !== null) console.warn('[VITS] server exited with code', code);
      _vitsProc = null;
    });
    console.log('[TTS] VITS server starting on port', _VITS_PORT);
  } catch (err) {
    console.warn('[TTS] Could not start VITS server (Python not found?):', err.message);
  }
}

/**
 * Start the RVC Python server as a background child process.
 * Called once at app startup if rvc.modelsDir is configured.
 * Failures are silent — kokoro audio is returned as fallback.
 */
function _killStaleRvcServer() {
  // Kill any stale Python process already bound to _RVC_PORT (e.g. from a crashed previous run).
  // Uses PowerShell on Windows — fails silently if PS isn't available or the port is free.
  return new Promise(resolve => {
    try {
      const ps = spawn('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        `$p = (Get-NetTCPConnection -LocalPort ${_RVC_PORT} -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }`,
      ], { stdio: 'pipe' });
      ps.on('close', () => setTimeout(resolve, 300)); // small pause to let the port free up
      ps.on('error', resolve);
    } catch { resolve(); }
  });
}

function startRvcServer() {
  const scriptPath = path.join(__dirname, '../../scripts/rvc-server/server.py');
  // Prefer the dedicated Python 3.10 venv — fairseq (required by rvc_python) needs Python < 3.12.
  const venvPython = path.join(__dirname, '../../scripts/rvc-server/venv/Scripts/python.exe');
  const pythonExe  = fs.existsSync(venvPython) ? venvPython : 'python';

  if (!fs.existsSync(scriptPath)) {
    console.warn('[RVC] server script not found:', scriptPath);
    return;
  }
  if (!_rvcModelsDir) {
    console.log('[RVC] No modelsDir configured — RVC server not started.');
    return;
  }

  const _doSpawn = () => {
    try {
      _rvcProc = spawn(pythonExe, [scriptPath, '--models-dir', _rvcModelsDir, '--port', String(_RVC_PORT)], {
        stdio: 'pipe',
        cwd:   path.dirname(scriptPath),
        detached: false,
      });
      _rvcProc.stdout.on('data', d => console.log('[RVC]', d.toString().trimEnd()));
      _rvcProc.stderr.on('data', d => console.log('[RVC]', d.toString().trimEnd()));
      _rvcProc.on('error', err => console.warn('[RVC] server error:', err.message));
      _rvcProc.on('exit',  code => {
        if (code !== 0 && code !== null) console.warn('[RVC] server exited with code', code);
        _rvcProc = null;
      });
      console.log('[TTS] RVC server starting on port', _RVC_PORT, '| models:', _rvcModelsDir);
    } catch (err) {
      console.warn('[TTS] Could not start RVC server (Python not found?):', err.message);
    }
  };

  // Kill any stale process on the port first, then spawn fresh.
  _killStaleRvcServer().then(_doSpawn);
}

/**
 * Configure the RVC backend. Call this from main.js after reading config.json.
 * @param {{ modelsDir?: string, pitchShift?: number }} opts
 */
function setRvcConfig({ modelsDir = '', pitchShift = 0, indexRate = 0.75, f0method = 'harvest', protect = 0.33, sourceVoice = '' } = {}) {
  _rvcModelsDir   = modelsDir || '';
  _pitchShift     = parseInt(pitchShift, 10) || 0;
  _indexRate      = parseFloat(indexRate)  || 0.75;
  _f0method       = f0method || 'harvest';
  _protect        = parseFloat(protect)   || 0.33;
  _rvcSourceVoice = sourceVoice || '';
}

function getRvcConfig() {
  return {
    modelsDir:   _rvcModelsDir,
    pitchShift:  _pitchShift,
    indexRate:   _indexRate,
    f0method:    _f0method,
    protect:     _protect,
    sourceVoice: _rvcSourceVoice,
  };
}

/**
 * Synthesise text to a WAV Buffer. Returns null if disabled or on error.
 * Routes to RVC, VITS, or Kokoro depending on the active voice ID.
 */
async function synthesize(text) {
  if (!_enabled) return null;
  const clean = _cleanText(text);
  if (!clean) return null;

  if (_isRvcVoice)  return _synthesizeRvc(clean);
  if (_isVitsVoice) return _synthesizeVits(clean);

  // "None" selected — play the RVC source voice directly (no conversion).
  // If source is a VITS/StyleTTS2 voice, fetch it from the VITS server.
  const srcVoice    = _rvcSourceVoice;
  const srcIsKokoro = !srcVoice || KOKORO_VOICES.some(v => v.id === srcVoice);
  if (!srcIsKokoro) {
    try {
      return await _fetchVitsAudio(clean, srcVoice);
    } catch (err) {
      console.warn('[TTS] Source voice failed, falling back to Kokoro:', err.message);
    }
  }

  try {
    const kokoroId = srcIsKokoro ? (srcVoice || 'af_heart') : 'af_heart';
    const tts      = await _getTTS();
    const audio    = await _kokoroGenerate(tts, clean, kokoroId);
    return _toWav(audio.audio, audio.sampling_rate);
  } catch (err) {
    console.warn('[TTS] synthesis failed:', err.message);
    return null;
  }
}

function setEnabled(val) { _enabled = !!val; }

function setVoice(voiceName) {
  _voice       = voiceName;
  _isRvcVoice  = voiceName.startsWith('rvc:');
  if (_isRvcVoice) {
    _isVitsVoice = false;
  } else {
    const { modelId } = _parseVoiceId(voiceName);
    _isVitsVoice = _getVitsModelIds().includes(modelId);
  }
}

function setSpeed(speed) { _speed = parseFloat(speed) || 1.0; }

function setRate(val) {
  const n = parseFloat(val);
  if (!isNaN(n)) setSpeed(n);
}

function getSettings() {
  return { enabled: _enabled, voice: _voice, speed: _speed };
}

// ── Voice lists ───────────────────────────────────────────────────────────────

const KOKORO_VOICES = [
  { id: 'af_heart',    label: 'Heart (US) ★'   },
  { id: 'af_bella',    label: 'Bella (US) ★'   },
  { id: 'af_aoede',    label: 'Aoede (US)'      },
  { id: 'af_nicole',   label: 'Nicole (US)'     },
  { id: 'af_sarah',    label: 'Sarah (US)'      },
  { id: 'af_sky',      label: 'Sky (US)'        },
  { id: 'bf_emma',     label: 'Emma (UK)'       },
  { id: 'bf_isabella', label: 'Isabella (UK)'   },
  { id: 'am_adam',     label: 'Adam (US)'       },
  { id: 'bm_george',   label: 'George (UK)'     },
];

// Keep VOICES alias so any existing code referencing ttsEngine.VOICES still works.
const VOICES = KOKORO_VOICES;

/**
 * Returns all voices grouped with section headers.
 * isHeader entries are non-selectable dividers.
 * Multi-speaker VITS models are expanded to one entry per speaker.
 * RVC models appear as a third section with id = "rvc:<FolderName>".
 */
function getVoices() {
  const vitsIds = _getVitsModelIds();
  const rvcIds  = _getRvcModelIds();
  const list    = [];

  list.push({ id: '__kokoro_hdr__', label: '── KOKORO ──────────────────', isHeader: true });
  list.push(...KOKORO_VOICES);

  // StyleTTS2 is always listed under VITS (served by the same Flask server on port 5002).
  list.push({ id: '__vits_hdr__', label: '── VITS / STYLETTS2 ─────────', isHeader: true });
  list.push({ id: 'styletts2', label: 'StyleTTS2 LJSpeech [EN]' });

  for (const modelId of vitsIds) {
      const configPath = path.join(_MODELS_DIR, modelId, 'config.json');
      let speakers = null;
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (Array.isArray(cfg.speakers) && cfg.speakers.length > 0) {
          speakers = cfg.speakers;
        }
      } catch { /* ignore */ }

      if (speakers) {
        for (let i = 0; i < speakers.length; i++) {
          list.push({ id: `${modelId}:${i}`, label: `${speakers[i]} [JP]` });
        }
      } else {
        const label = modelId.charAt(0).toUpperCase() + modelId.slice(1).replace(/[_-]/g, ' ') + ' [JP]';
        list.push({ id: modelId, label });
      }
  }

  if (rvcIds.length > 0) {
    list.push({ id: '__rvc_hdr__', label: '── RVC ─────────────────────', isHeader: true });
    for (const folderId of rvcIds) {
      const label = folderId.replace(/model$/i, '').replace(/[_-]/g, ' ').trim() + ' [RVC]';
      list.push({ id: `rvc:${folderId}`, label });
    }
  }

  return list;
}

// Begin Kokoro model warm-up immediately so first message has no delay.
_initModel();

module.exports = {
  synthesize, setEnabled, setVoice, setSpeed, setRate, getSettings,
  getVoices, startVitsServer, startRvcServer, setRvcConfig, getRvcConfig,
  VOICES, KOKORO_VOICES,
};
