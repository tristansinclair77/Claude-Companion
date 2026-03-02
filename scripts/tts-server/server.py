#!/usr/bin/env python3
"""VITS TTS Server for Claude Companion.

Flask HTTP server that runs local VITS models for anime character voices.

API:
  GET /health                                               -> {"status": "ok", "voices": N}
  GET /voices                                               -> [{"id": "moet-tts-18:0", "label": "Special Week [JP]"}, ...]
  GET /synthesize?text=Hello&voice=moet-tts-18&speaker=0   -> audio/wav
  GET /synthesize?text=...&voice=moet-tts-18&notranslate=1 -> audio/wav (skip EN->JP)

Multi-speaker models
--------------------
If config.json contains a "speakers" list, /voices returns one entry per speaker:
  id = "<model_id>:<speaker_index>",  label = "<speaker_name> [JP]"
Single-speaker models return one entry with id = "<model_id>".

Per-model symbol sets
---------------------
Symbol priority (highest to lowest):
  1. config.json "symbols" key  (from training -- most reliable)
  2. models/<name>/symbols.py
  3. models/<name>/text/symbols.py
  4. Global text/symbols.py
"""

import os
import sys
import io
import json
import struct
import logging
import importlib.util

import numpy as np
from flask import Flask, request, jsonify, send_file

# Ensure this script's directory is on sys.path for sibling-module imports.
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

import torch
import commons
import utils
from models import SynthesizerTrn
from text.symbols import symbols as _GLOBAL_SYMBOLS

# Force stdout/stderr to UTF-8 so Unicode log chars don't crash on Windows cp1252.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

logging.basicConfig(level=logging.INFO, format='[VITS] %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# Suppress verbose debug spam from third-party libraries
for _noisy in ('numba', 'numba.core', 'urllib3', 'cached_path', 'filelock',
               'matplotlib', 'google', 'transformers'):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

# ── StyleTTS2 optional backend ────────────────────────────────────────────────
# Detected once at startup; if importable, a 'styletts2:default' voice is added.

_STYLETTS2_AVAILABLE = False
_styletts2_instance  = None

try:
    import styletts2  # just check importability — don't load the model yet
    _STYLETTS2_AVAILABLE = True
    logger.info('StyleTTS2 detected — will register styletts2:default voice.')
except Exception as _e:
    logger.info(f'StyleTTS2 not available ({_e}); skipping.')


_styletts2_ref_s = None  # pre-computed style vector (avoids re-download every call)


def _get_styletts2():
    """Lazy-load the StyleTTS2 instance and pre-compute the default style vector."""
    global _styletts2_instance, _styletts2_ref_s
    if _styletts2_instance is None:
        logger.info('Loading StyleTTS2 model (first use, may download ~300 MB)...')
        from styletts2 import tts as _stts_mod
        from cached_path import cached_path
        _styletts2_instance = _stts_mod.StyleTTS2()
        # Pre-compute style from the default LJSpeech reference so every call
        # gets consistent prosody rather than a random style sample.
        try:
            ref_path = cached_path(_stts_mod.DEFAULT_TARGET_VOICE_URL)
            _styletts2_ref_s = _styletts2_instance.compute_style(ref_path)
            logger.info('StyleTTS2 style vector ready.')
        except Exception as exc:
            logger.warning(f'StyleTTS2 style pre-compute failed ({exc}); will use random style.')
        logger.info('StyleTTS2 model ready.')
    return _styletts2_instance


def _do_synthesize_styletts2(text: str):
    """Synthesize text with StyleTTS2. Returns (numpy_float32_array, sample_rate)."""
    stts = _get_styletts2()
    import numpy as np
    wav = stts.inference(
        text,
        diffusion_steps=10,
        embedding_scale=2,      # text drives prosody more strongly → less random emphasis
        ref_s=_styletts2_ref_s, # consistent style across every call
    )
    return np.array(wav, dtype=np.float32), 24000

app = Flask(__name__)

MODELS_DIR = os.path.join(_HERE, 'models')

# Loaded model cache: { model_id: {'net': SynthesizerTrn, 'hps': HParams,
#                                   'sym_to_id': dict, 'n_speakers': int} }
_model_cache = {}
# Discovered voices: list of dicts with id/label/config/pth/dir
_available_voices = []

# ── EN->JP Translation ────────────────────────────────────────────────────────

_translator = None


def _init_translator():
    global _translator
    try:
        from argostranslate import package as ap, translate as at

        installed = at.get_installed_languages()
        en_lang = next((l for l in installed if l.code == 'en'), None)
        ja_lang = next((l for l in installed if l.code == 'ja'), None)

        if en_lang and ja_lang:
            _translator = en_lang.get_translation(ja_lang)
            logger.info('EN->JP translation ready (offline).')
            return

        # Not installed yet -- download once.
        logger.info('Downloading EN->JP argostranslate package (one-time, ~100 MB)...')
        ap.update_package_index()
        pkgs = ap.get_available_packages()
        pkg = next((p for p in pkgs if p.from_code == 'en' and p.to_code == 'ja'), None)
        if pkg:
            ap.install_from_path(pkg.download())
            installed = at.get_installed_languages()
            en_lang = next((l for l in installed if l.code == 'en'), None)
            ja_lang = next((l for l in installed if l.code == 'ja'), None)
            if en_lang and ja_lang:
                _translator = en_lang.get_translation(ja_lang)
                logger.info('EN->JP translation installed and ready.')
    except Exception as exc:
        logger.warning(f'argostranslate unavailable ({exc}). Text will pass through as-is.')


def _translate(text: str) -> str:
    if _translator is None:
        return text
    try:
        return _translator.translate(text)
    except Exception:
        return text


# ── Symbol set helpers ────────────────────────────────────────────────────────

def _load_model_symbols(hps, model_dir: str):
    """Return the symbol list for a model.

    Priority:
      1. hps.symbols  (stored in config.json -- most reliable)
      2. model_dir/symbols.py
      3. model_dir/text/symbols.py
      4. global text/symbols.py
    """
    # 1. From config.json (present in skytnt/moe-tts models)
    if hasattr(hps, 'symbols') and hps.symbols:
        syms = list(hps.symbols)
        logger.info(f'Using symbols from config.json ({len(syms)} symbols)')
        return syms

    # 2/3. From a symbols.py file inside the model folder
    for candidate in [
        os.path.join(model_dir, 'symbols.py'),
        os.path.join(model_dir, 'text', 'symbols.py'),
    ]:
        if os.path.isfile(candidate):
            spec = importlib.util.spec_from_file_location('_model_symbols', candidate)
            mod  = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            logger.info(f'Using model-specific symbols ({len(mod.symbols)} symbols): {candidate}')
            return mod.symbols

    # 4. Global fallback
    logger.info(f'Using global symbols ({len(_GLOBAL_SYMBOLS)} symbols)')
    return _GLOBAL_SYMBOLS


def _apply_cleaners(text: str, cleaner_names: list) -> str:
    """Run text through the named cleaner functions."""
    import text.cleaners as _cleaners_mod
    for name in cleaner_names:
        fn = getattr(_cleaners_mod, name, None)
        if fn is None:
            raise ValueError(f'Unknown cleaner: {name}')
        text = fn(text)
    return text


# ── Model discovery & loading ─────────────────────────────────────────────────

def _discover_voices():
    global _available_voices
    _available_voices = []

    if not os.path.isdir(MODELS_DIR):
        logger.warning(f'models/ directory not found: {MODELS_DIR}')
        return

    for name in sorted(os.listdir(MODELS_DIR)):
        model_dir = os.path.join(MODELS_DIR, name)
        if not os.path.isdir(model_dir):
            continue
        config_path = os.path.join(model_dir, 'config.json')
        pth_files = [f for f in os.listdir(model_dir) if f.endswith('.pth')]
        if os.path.isfile(config_path) and pth_files:
            pth_path = os.path.join(model_dir, pth_files[0])
            label = name.replace('_', ' ').replace('-', ' ').title() + ' [JP]'
            _available_voices.append({
                'id': name,
                'label': label,
                'dir': model_dir,
                'config': config_path,
                'pth': pth_path,
            })
            logger.info(f'Found model: {name}  ({pth_files[0]})')

    if _STYLETTS2_AVAILABLE:
        _available_voices.append({
            'id':    'styletts2',
            'label': 'StyleTTS2 LJSpeech [EN]',
            'type':  'styletts2',
        })
        logger.info('Registered voice: styletts2:default')

    if not _available_voices:
        logger.info('No models found. Place <name>/config.json + <name>/<*.pth> in models/.')


def _load_model(model_id: str):
    if model_id in _model_cache:
        return _model_cache[model_id]

    voice = next((v for v in _available_voices if v['id'] == model_id), None)
    if voice is None:
        return None

    try:
        hps = utils.get_hparams_from_file(voice['config'])

        model_symbols = _load_model_symbols(hps, voice['dir'])
        sym_to_id     = {s: i for i, s in enumerate(model_symbols)}
        n_speakers    = getattr(hps.data, 'n_speakers', 0)

        net_g = SynthesizerTrn(
            len(model_symbols),
            hps.data.filter_length // 2 + 1,
            hps.train.segment_size // hps.data.hop_length,
            n_speakers=n_speakers,
            **hps.model,
        ).eval()
        utils.load_checkpoint(voice['pth'], net_g, None)

        _model_cache[model_id] = {
            'net':        net_g,
            'hps':        hps,
            'sym_to_id':  sym_to_id,
            'n_speakers': n_speakers,
        }
        logger.info(f'Model loaded: {model_id} (vocab={len(model_symbols)}, speakers={n_speakers})')
        return _model_cache[model_id]
    except Exception as exc:
        logger.error(f'Failed to load model {model_id}: {exc}')
        return None


# ── Audio helpers ─────────────────────────────────────────────────────────────

def _array_to_wav(samples: np.ndarray, sample_rate: int) -> io.BytesIO:
    """Encode a float32 numpy array as a 16-bit mono WAV in a BytesIO buffer."""
    samples = np.clip(samples, -1.0, 1.0)
    pcm  = (samples * 32767).astype(np.int16)
    data = pcm.tobytes()
    buf  = io.BytesIO()
    buf.write(b'RIFF')
    buf.write(struct.pack('<I', 36 + len(data)))
    buf.write(b'WAVE')
    buf.write(b'fmt ')
    buf.write(struct.pack('<I', 16))
    buf.write(struct.pack('<HHIIHH', 1, 1, sample_rate, sample_rate * 2, 2, 16))
    buf.write(b'data')
    buf.write(struct.pack('<I', len(data)))
    buf.write(data)
    buf.seek(0)
    return buf


# ── Core synthesis ────────────────────────────────────────────────────────────

def _do_synthesize(text: str, model_id: str, speaker_id: int = 0,
                   notranslate: bool = False):
    model_data = _load_model(model_id)
    if model_data is None:
        return None, None

    net_g      = model_data['net']
    hps        = model_data['hps']
    sym_to_id  = model_data['sym_to_id']
    n_speakers = model_data['n_speakers']

    jp_text = text if notranslate else _translate(text)
    logger.info(f'[{model_id}:{speaker_id}] "{text[:60]}" -> "{jp_text[:60]}"')

    cleaner_names = list(hps.data.text_cleaners) if hasattr(hps.data, 'text_cleaners') else ['japanese_cleaners']
    cleaned   = _apply_cleaners(jp_text, cleaner_names)
    text_norm = [sym_to_id[s] for s in cleaned if s in sym_to_id]
    text_norm = commons.intersperse(text_norm, 0)
    stn       = torch.LongTensor(text_norm)

    sid = torch.LongTensor([speaker_id]) if n_speakers > 0 else None

    with torch.no_grad():
        x     = stn.unsqueeze(0)
        x_len = torch.LongTensor([stn.size(0)])
        audio = net_g.infer(
            x, x_len,
            noise_scale=0.667,
            noise_scale_w=0.8,
            length_scale=1.0,
            sid=sid,
        )[0][0, 0].data.float().numpy()

    return audio, hps.data.sampling_rate


# ── Flask routes ──────────────────────────────────────────────────────────────

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'voices': len(_available_voices)})


@app.route('/voices')
def list_voices():
    """Return one entry per speaker for multi-speaker models, else one per model."""
    result = []
    for v in _available_voices:
        if v.get('type') == 'styletts2':
            result.append({'id': 'styletts2', 'label': v['label']})
            continue
        try:
            hps = utils.get_hparams_from_file(v['config'])
            speakers = list(hps.speakers) if hasattr(hps, 'speakers') and hps.speakers else []
        except Exception:
            speakers = []

        if speakers:
            for i, sp_name in enumerate(speakers):
                result.append({'id': f"{v['id']}:{i}", 'label': f"{sp_name} [JP]"})
        else:
            result.append({'id': v['id'], 'label': v['label']})
    return jsonify(result)


@app.route('/synthesize')
def synthesize():
    text        = request.args.get('text',        '').strip()
    voice_param = request.args.get('voice',       '').strip()
    notranslate = request.args.get('notranslate', '0') == '1'

    if not text:
        return jsonify({'error': 'text parameter required'}), 400
    if not voice_param:
        return jsonify({'error': 'voice parameter required'}), 400

    # Support both "model_id" and "model_id:speaker_id" formats
    if ':' in voice_param:
        model_id, sp_str = voice_param.rsplit(':', 1)
        try:
            speaker_id = int(sp_str)
        except ValueError:
            return jsonify({'error': f'invalid speaker index: {sp_str}'}), 400
    else:
        model_id   = voice_param
        speaker_id = int(request.args.get('speaker', '0') or '0')

    if not any(v['id'] == model_id for v in _available_voices):
        return jsonify({'error': f'unknown voice: {model_id}'}), 404

    # Route StyleTTS2 voices to the dedicated backend
    if model_id == 'styletts2':
        try:
            audio, sr = _do_synthesize_styletts2(text)
        except Exception as exc:
            logger.error(f'StyleTTS2 synthesis failed: {exc}')
            return jsonify({'error': f'styletts2 synthesis failed: {exc}'}), 500
        return send_file(_array_to_wav(audio, sr), mimetype='audio/wav')

    audio, sr = _do_synthesize(text, model_id, speaker_id=speaker_id,
                                notranslate=notranslate)
    if audio is None:
        return jsonify({'error': 'synthesis failed -- check server logs'}), 500

    return send_file(_array_to_wav(audio, sr), mimetype='audio/wav')


# ── Entry point ───────────────────────────────────────────────────────────────

def _warmup():
    """Pre-load model, pyopenjtalk dictionary, and Stanza before first real request.

    All one-time downloads happen here so they don't cause a timeout on the
    first synthesis request from the Electron app.
    """
    if not _available_voices:
        return
    model_id = _available_voices[0]['id']
    logger.info(f'Warming up {model_id} (downloading any missing resources)...')
    try:
        _do_synthesize('Hello.', model_id, speaker_id=0, notranslate=False)
        logger.info('Warmup complete -- server ready.')
    except Exception as exc:
        logger.warning(f'Warmup failed (non-fatal): {exc}')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='VITS TTS Server for Claude Companion')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5002)
    args = parser.parse_args()

    _discover_voices()
    _init_translator()
    _warmup()

    logger.info(f'Starting on http://{args.host}:{args.port}')
    logger.info(f'Voices: {[v["id"] for v in _available_voices] or "(none)"}')
    app.run(host=args.host, port=args.port, debug=False, threaded=True)
