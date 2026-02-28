#!/usr/bin/env python3
"""RVC Voice Conversion Server for Claude Companion.

Flask HTTP server that converts audio using RVC (Retrieval-based Voice Conversion) models.
Sits between Kokoro TTS (source voice) and the audio playback layer.

API:
  GET /health                                          -> {"status": "ok", "models": N}
  GET /voices                                          -> [{"id": "rvc:FolderName", "label": "..."}, ...]
  POST /convert?voice=FolderName&pitch=0&f0=harvest   -> audio/wav (converted audio)
       Body: raw WAV bytes (Content-Type: audio/wav)

Model discovery:
  Scans --models-dir for subfolders containing both a *.pth and *.index file.
  Example layout:
    models-dir/
      AkeboshiHimari/
        AkeboshiHimari.pth
        added_IVF532_Flat_nprobe_1_AkeboshiHimari_v2.index
"""

import argparse
import io
import os
import sys
import logging

# Force UTF-8 on Windows so log characters don't crash on cp1252.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

logging.basicConfig(level=logging.INFO, format='[RVC] %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

try:
    import numpy as np
    import soundfile as sf
    from flask import Flask, request, jsonify, send_file
    from rvc_python.infer import RVCInference
except ImportError as e:
    logger.error(f'Missing dependency: {e}')
    logger.error('Install with:  pip install rvc_python flask soundfile')
    sys.exit(1)

app = Flask(__name__)

# Set by CLI args before app.run()
_MODELS_DIR: str | None = None

# Discovered model list: list of dicts with id/label/dir/pth/index keys
_available_models: list = []

# Lazy-loaded model cache: { model_id: RVCInference }
_model_cache: dict = {}


# ── Model discovery ──────────────────────────────────────────────────────────

def _discover_models():
    global _available_models
    _available_models = []

    if not _MODELS_DIR or not os.path.isdir(_MODELS_DIR):
        logger.warning(f'Models directory not found: {_MODELS_DIR}')
        return

    for name in sorted(os.listdir(_MODELS_DIR)):
        model_dir = os.path.join(_MODELS_DIR, name)
        if not os.path.isdir(model_dir):
            continue
        try:
            files       = os.listdir(model_dir)
            pth_files   = [f for f in files if f.endswith('.pth')]
            index_files = [f for f in files if f.endswith('.index')]
        except OSError:
            continue

        if pth_files and index_files:
            pth_path   = os.path.join(model_dir, pth_files[0])
            index_path = os.path.join(model_dir, index_files[0])
            # Humanise label: remove common suffixes, convert separators to spaces
            label = name.replace('model', '').replace('_', ' ').replace('-', ' ').strip()
            _available_models.append({
                'id':    name,
                'label': f'{label} [RVC]',
                'dir':   model_dir,
                'pth':   pth_path,
                'index': index_path,
            })
            logger.info(f'Found: {name}  ({pth_files[0]})')

    if not _available_models:
        logger.info(f'No models found in {_MODELS_DIR}.')
        logger.info('Each model subfolder needs *.pth + *.index files.')


# ── Model loading ────────────────────────────────────────────────────────────

def _get_rvc(model_id: str) -> 'RVCInference | None':
    if model_id in _model_cache:
        return _model_cache[model_id]

    model = next((m for m in _available_models if m['id'] == model_id), None)
    if model is None:
        return None

    try:
        logger.info(f'Loading model: {model_id} ...')
        rvc = RVCInference(device='cpu:0')
        rvc.load_model(model['pth'], model['index'])
        _model_cache[model_id] = rvc
        logger.info(f'Model ready: {model_id}')
        return rvc
    except Exception as exc:
        logger.error(f'Failed to load {model_id}: {exc}')
        return None


# ── Flask routes ─────────────────────────────────────────────────────────────

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'models': len(_available_models)})


@app.route('/voices')
def list_voices():
    return jsonify([
        {'id': f"rvc:{m['id']}", 'label': m['label']}
        for m in _available_models
    ])


@app.route('/convert', methods=['POST'])
def convert_audio():
    voice_param = request.args.get('voice', '').strip()
    pitch       = int(request.args.get('pitch', 0))
    f0_method   = request.args.get('f0', 'harvest')

    if not voice_param:
        return jsonify({'error': 'voice parameter required'}), 400

    # Accept either "FolderName" or "rvc:FolderName"
    model_id = voice_param[4:] if voice_param.startswith('rvc:') else voice_param

    if not any(m['id'] == model_id for m in _available_models):
        return jsonify({'error': f'unknown model: {model_id}'}), 404

    wav_bytes = request.data
    if not wav_bytes:
        return jsonify({'error': 'request body must contain WAV audio bytes'}), 400

    rvc = _get_rvc(model_id)
    if rvc is None:
        return jsonify({'error': f'failed to load model {model_id} — check server logs'}), 500

    try:
        # Parse input WAV
        audio_in, sr_in = sf.read(io.BytesIO(wav_bytes), dtype='float32', always_2d=False)
        if audio_in.ndim > 1:
            audio_in = audio_in[:, 0]  # mono — take first channel

        # RVC conversion — set pitch shift attribute then call infer
        rvc.f0_up_key = pitch
        audio_out = rvc.infer(audio_in, sr_in)

        # Encode output as WAV
        out_buf = io.BytesIO()
        sf.write(out_buf, audio_out, rvc.tgt_sr, format='WAV', subtype='PCM_16')
        out_buf.seek(0)

        dur_in  = len(audio_in)  / sr_in
        dur_out = len(audio_out) / rvc.tgt_sr
        logger.info(
            f'[{model_id}] pitch={pitch:+d} f0={f0_method} '
            f'in={dur_in:.1f}s -> out={dur_out:.1f}s'
        )
        return send_file(out_buf, mimetype='audio/wav')

    except Exception as exc:
        logger.error(f'Conversion failed for {model_id}: {exc}')
        return jsonify({'error': str(exc)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='RVC Voice Conversion Server for Claude Companion'
    )
    parser.add_argument('--host',       default='127.0.0.1')
    parser.add_argument('--port',       type=int, default=5003)
    parser.add_argument('--models-dir', required=True, dest='models_dir',
                        help='Directory containing RVC model subfolders (*.pth + *.index)')
    args = parser.parse_args()

    _MODELS_DIR = args.models_dir
    _discover_models()

    logger.info(f'Starting on http://{args.host}:{args.port}')
    logger.info(f'Models ({len(_available_models)}): {[m["id"] for m in _available_models] or "(none)"}')
    app.run(host=args.host, port=args.port, debug=False, threaded=True)
