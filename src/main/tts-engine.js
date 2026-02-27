'use strict';
// TTS engine — two backends:
//   kokoro  : kokoro-js (English, local ONNX, no internet after first download)
//   vits    : local Python Flask server on localhost:5002 (anime JP voices)
//
// The active backend is determined by whether _voice is a VITS voice ID.
// If VITS synthesis fails for any reason, it falls back to kokoro silently.

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
let _vitsProc   = null; // child_process handle for the Python server

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

/** Strip markup that shouldn't be spoken aloud. */
function _cleanText(text) {
  return text
    .replace(/\*[^*]*\*/g, '')
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
    // Graceful fallback: switch to default kokoro voice for this call only
    const saved = _voice;
    _voice = 'af_heart';
    try {
      const tts   = await _getTTS();
      const audio = await tts.generate(text, { voice: 'af_heart', speed: _speed });
      return _toWav(audio.audio, audio.sampling_rate);
    } finally {
      _voice = saved; // restore VITS voice for next call (user may fix server)
    }
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
 * Synthesise text to a WAV Buffer. Returns null if disabled or on error.
 * Routes to VITS if a VITS voice is active, otherwise uses Kokoro.
 */
async function synthesize(text) {
  if (!_enabled) return null;
  const clean = _cleanText(text);
  if (!clean) return null;

  if (_isVitsVoice) return _synthesizeVits(clean);

  try {
    const tts   = await _getTTS();
    const audio = await tts.generate(clean, { voice: _voice, speed: _speed });
    return _toWav(audio.audio, audio.sampling_rate);
  } catch (err) {
    console.warn('[TTS] synthesis failed:', err.message);
    return null;
  }
}

function setEnabled(val) { _enabled = !!val; }

function setVoice(voiceName) {
  _voice = voiceName;
  const { modelId } = _parseVoiceId(voiceName);
  _isVitsVoice = _getVitsModelIds().includes(modelId);
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
 * Multi-speaker VITS models (config.json has "speakers" list) are expanded to
 * one entry per speaker: id = "<model_id>:<speaker_index>".
 */
function getVoices() {
  const modelIds = _getVitsModelIds();
  const list = [];

  list.push({ id: '__kokoro_hdr__', label: '── KOKORO ──────────────────', isHeader: true });
  list.push(...KOKORO_VOICES);

  if (modelIds.length > 0) {
    list.push({ id: '__vits_hdr__', label: '── VITS ANIME ──────────────', isHeader: true });
    for (const modelId of modelIds) {
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
  }

  return list;
}

// Begin Kokoro model warm-up immediately so first message has no delay.
_initModel();

module.exports = {
  synthesize, setEnabled, setVoice, setSpeed, setRate, getSettings,
  getVoices, startVitsServer,
  VOICES, KOKORO_VOICES,
};
