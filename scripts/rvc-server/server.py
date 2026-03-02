#!/usr/bin/env python3
"""RVC Voice Conversion Server for Claude Companion.

Flask HTTP server that converts audio using RVC (Retrieval-based Voice Conversion) models.
Sits between Kokoro TTS (source voice) and the audio playback layer.

API:
  GET /health                                          -> {"status": "ok", "models": N}
  GET /voices                                          -> [{"id": "rvc:FolderName", "label": "..."}, ...]
  POST /convert?voice=FolderName&pitch=0&f0=harvest   -> audio/wav (converted audio)
       Body: raw WAV bytes (Content-Type: audio/wav)

rvc_python API (v0.1.5):
  rvc = RVCInference(device='cpu:0')
  rvc.load_model(pth_path, version='v2', index_path='...')  -> sets current_model
  rvc.set_params(f0up_key=0, f0method='harvest', ...)
  rvc.infer_file(input_path, output_path)              -> file paths only
  rvc.current_model = basename  -> switch between already-loaded models

Model discovery:
  Scans --models-dir for subfolders containing both a *.pth and *.index file.
"""

import argparse
import io
import os
import sys
import tempfile
import logging
import traceback
import torch

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

logging.basicConfig(level=logging.INFO, format='[RVC] %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

try:
    from flask import Flask, request, jsonify, send_file
    from rvc_python.infer import RVCInference
except ImportError as e:
    logger.error(f'Missing dependency: {e}')
    logger.error('Install with:  pip install rvc_python flask')
    sys.exit(1)

app = Flask(__name__)

_MODELS_DIR: str | None = None
_available_models: list = []

# Single shared RVCInference instance — HuBERT loads once, shared by all voices.
_rvc: RVCInference | None = None

# Maps model_id -> pth_basename (the key used in rvc.models dict)
_loaded: dict = {}


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


# ── RVC instance & model loading ─────────────────────────────────────────────

def _get_rvc() -> RVCInference:
    global _rvc
    if _rvc is None:
        logger.info('Initialising RVCInference (downloading HuBERT on first run)...')
        _rvc = RVCInference(device='cpu:0')
        logger.info('RVCInference ready.')
    return _rvc


def _detect_model_version(pth_path: str) -> str:
    """Auto-detect v1 vs v2 by inspecting the phone embedding weight shape."""
    try:
        cpt = torch.load(pth_path, map_location='cpu')
        if 'version' in cpt:
            return str(cpt['version'])
        weight = cpt.get('weight', {}).get('enc_p.emb_phone.weight')
        if weight is not None:
            return 'v2' if weight.shape[1] == 768 else 'v1'
    except Exception as exc:
        logger.warning(f'Version detection failed for {pth_path}: {exc}')
    return 'v1'


def _load_voice(model_id: str) -> bool:
    """Ensure the model is loaded and set as current. Returns True on success."""
    model = next((m for m in _available_models if m['id'] == model_id), None)
    if model is None:
        return False

    rvc = _get_rvc()

    if model_id in _loaded:
        # Already loaded — just make it current
        rvc.current_model = _loaded[model_id]
        return True

    try:
        version = _detect_model_version(model['pth'])
        logger.info(f'Loading model: {model_id} (detected {version}) ...')
        rvc.load_model(model['pth'], version=version, index_path=model['index'])
        # rvc.current_model is now set to os.path.basename(pth_path)
        pth_basename = os.path.basename(model['pth'])
        _loaded[model_id] = pth_basename
        logger.info(f'Model ready: {model_id}  (key={pth_basename})')
        return True
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error(f'Failed to load {model_id}:\n{tb}')
        raise  # re-raise so convert_audio can return the real error message


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
    index_rate  = float(request.args.get('index_rate', 0.75))
    protect     = float(request.args.get('protect', 0.33))

    if not voice_param:
        return jsonify({'error': 'voice parameter required'}), 400

    model_id = voice_param[4:] if voice_param.startswith('rvc:') else voice_param

    if not any(m['id'] == model_id for m in _available_models):
        return jsonify({'error': f'unknown model: {model_id}'}), 404

    wav_bytes = request.data
    if not wav_bytes:
        return jsonify({'error': 'request body must contain WAV audio bytes'}), 400

    try:
        loaded = _load_voice(model_id)
    except Exception as exc:
        return jsonify({'error': f'load_model failed: {exc}'}), 500

    if not loaded:
        return jsonify({'error': f'model {model_id} not found in available list'}), 500

    rvc = _get_rvc()
    rvc.set_params(f0up_key=pitch, f0method=f0_method, index_rate=index_rate, protect=protect)

    # infer_file works on file paths only — write input to temp, read output back
    fd_in, input_path = tempfile.mkstemp(suffix='.wav', prefix='rvc_in_')
    output_path = input_path + '_out.wav'
    try:
        with os.fdopen(fd_in, 'wb') as f:
            f.write(wav_bytes)

        rvc.infer_file(input_path, output_path)

        with open(output_path, 'rb') as f:
            result_bytes = f.read()

        logger.info(f'[{model_id}] pitch={pitch:+d} f0={f0_method} '
                    f'index={index_rate:.2f} protect={protect:.2f}  '
                    f'in={len(wav_bytes)//1000}KB -> out={len(result_bytes)//1000}KB')

        return send_file(io.BytesIO(result_bytes), mimetype='audio/wav')

    except Exception as exc:
        logger.error(f'Conversion failed for {model_id}: {exc}')
        return jsonify({'error': str(exc)}), 500

    finally:
        try: os.unlink(input_path)
        except OSError: pass
        try: os.unlink(output_path)
        except OSError: pass


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
    app.run(host=args.host, port=args.port, debug=False, threaded=False)
