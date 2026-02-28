#!/usr/bin/env python3
"""Quick VITS voice tester — try a .pth model before adding it to the companion.

Usage
-----
  # Basic test (config.json auto-detected from same folder as .pth)
  python scripts/test-voice.py --pth "path/to/G_12000.pth"

  # Explicit config
  python scripts/test-voice.py --pth "path/to/G_12000.pth" --config "path/to/config.json"

  # Custom text / speaker index
  python scripts/test-voice.py --pth ... --text "Testing 123" --speaker 2

  # Skip EN->JP translation (pass text directly)
  python scripts/test-voice.py --pth ... --notranslate --text "ありがとう"

  # Interactive: cycle through every speaker automatically
  python scripts/test-voice.py --pth ... --interactive

  # Save WAV instead of auto-playing
  python scripts/test-voice.py --pth ... --out output.wav

About config.json
-----------------
config.json defines the model architecture (vocab size, number of speakers, etc.).
Most moe-tts / skytnt VITS models ship with one alongside the .pth file.

If you only have a .pth and no config:
  • Download the matching config.json from the same HuggingFace repo you got the .pth from.
  • moe-tts (skytnt) models: https://huggingface.co/skytnt/moe-tts
  • Many VITS models: search "<model name> vits config.json"
"""

import argparse
import io
import importlib.util
import os
import struct
import subprocess
import sys
import tempfile

# ── Point Python at the tts-server dir so we can import VITS modules ─────────

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_SERVER_DIR  = os.path.join(_SCRIPT_DIR, 'tts-server')

if not os.path.isdir(_SERVER_DIR):
    sys.exit(f'ERROR: tts-server directory not found at {_SERVER_DIR}')

sys.path.insert(0, _SERVER_DIR)

try:
    import numpy as np
    import torch
    import commons
    import utils
    from models import SynthesizerTrn
    from text.symbols import symbols as _GLOBAL_SYMBOLS
except ImportError as e:
    sys.exit(
        f'ERROR: Missing dependency — {e}\n'
        f'Install with:  pip install -r scripts/tts-server/requirements.txt\n'
        f'(PyTorch first: pip install torch --index-url https://download.pytorch.org/whl/cpu)'
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_model_symbols(hps, model_dir):
    """Same priority as server.py: config > local symbols.py > global."""
    if hasattr(hps, 'symbols') and hps.symbols:
        syms = list(hps.symbols)
        print(f'  [symbols] from config.json  ({len(syms)} symbols)')
        return syms

    for candidate in [
        os.path.join(model_dir, 'symbols.py'),
        os.path.join(model_dir, 'text', 'symbols.py'),
    ]:
        if os.path.isfile(candidate):
            spec = importlib.util.spec_from_file_location('_model_symbols', candidate)
            mod  = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            print(f'  [symbols] from {os.path.basename(candidate)}  ({len(mod.symbols)} symbols)')
            return mod.symbols

    print(f'  [symbols] using global fallback  ({len(_GLOBAL_SYMBOLS)} symbols)')
    return _GLOBAL_SYMBOLS


def _apply_cleaners(text, cleaner_names):
    import text.cleaners as _cleaners_mod
    for name in cleaner_names:
        fn = getattr(_cleaners_mod, name, None)
        if fn is None:
            print(f'  [warn] unknown cleaner: {name} — skipped')
            continue
        text = fn(text)
    return text


def _array_to_wav(samples, sample_rate):
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
    return buf.read()


def _play_wav(path):
    """Open a WAV with the system default player."""
    print(f'  [play] {path}')
    if sys.platform == 'win32':
        os.startfile(path)
    elif sys.platform == 'darwin':
        subprocess.run(['open', path], check=False)
    else:
        subprocess.run(['xdg-open', path], check=False)


def _init_translator():
    try:
        from argostranslate import translate as at
        installed = at.get_installed_languages()
        en_lang = next((l for l in installed if l.code == 'en'), None)
        ja_lang = next((l for l in installed if l.code == 'ja'), None)
        if en_lang and ja_lang:
            return en_lang.get_translation(ja_lang)
    except Exception:
        pass
    return None


def _find_config(pth_path):
    """Look for config.json in the same directory as the .pth file."""
    model_dir   = os.path.dirname(pth_path)
    config_path = os.path.join(model_dir, 'config.json')
    if os.path.isfile(config_path):
        return config_path
    return None


# ── Core ─────────────────────────────────────────────────────────────────────

def load_model(pth_path, config_path):
    model_dir = os.path.dirname(pth_path)

    print(f'\n[tester] Config  : {config_path}')
    print(f'[tester] Model   : {pth_path}')

    hps           = utils.get_hparams_from_file(config_path)
    model_symbols = _load_model_symbols(hps, model_dir)
    sym_to_id     = {s: i for i, s in enumerate(model_symbols)}
    n_speakers    = getattr(hps.data, 'n_speakers', 0)

    print(f'[tester] Speakers: {n_speakers}  |  vocab: {len(model_symbols)}')

    net_g = SynthesizerTrn(
        len(model_symbols),
        hps.data.filter_length  // 2 + 1,
        hps.train.segment_size  // hps.data.hop_length,
        n_speakers=n_speakers,
        **hps.model,
    ).eval()
    utils.load_checkpoint(pth_path, net_g, None)
    print('[tester] Checkpoint loaded.\n')

    # Show speaker list if available
    speaker_names = []
    if hasattr(hps, 'speakers') and hps.speakers:
        speaker_names = list(hps.speakers)
        print('[tester] Speaker list:')
        for i, name in enumerate(speaker_names):
            print(f'  [{i:>3}] {name}')
        print()

    return net_g, hps, sym_to_id, n_speakers, speaker_names


def synthesize_one(text, speaker_id, net_g, hps, sym_to_id, n_speakers, translator, notranslate):
    jp_text = text
    if translator and not notranslate:
        jp_text = translator.translate(text)
        if jp_text != text:
            print(f'  [translate] "{text}"  ->  "{jp_text}"')

    cleaner_names = list(hps.data.text_cleaners) if hasattr(hps.data, 'text_cleaners') else ['japanese_cleaners']
    cleaned   = _apply_cleaners(jp_text, cleaner_names)
    text_norm = [sym_to_id[s] for s in cleaned if s in sym_to_id]
    text_norm = commons.intersperse(text_norm, 0)

    if not text_norm:
        print('  [warn] No recognisable phonemes — try --notranslate or different text.')
        return None, None

    stn = torch.LongTensor(text_norm)
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


def save_and_play(wav_bytes, out_path=None, prefix='vits_test_'):
    if out_path:
        with open(out_path, 'wb') as f:
            f.write(wav_bytes)
        _play_wav(out_path)
        return out_path
    else:
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False, prefix=prefix) as f:
            f.write(wav_bytes)
            tmp = f.name
        _play_wav(tmp)
        return tmp


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description='VITS voice tester — play a .pth model before adding it to Claude Companion.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument('--pth',    required=True, metavar='PATH',
                    help='Path to the VITS model checkpoint (.pth)')
    ap.add_argument('--config', default=None,  metavar='PATH',
                    help='Path to config.json (auto-detected from .pth directory if omitted)')
    ap.add_argument('--text',   default='Hello, I am your companion. Testing one two three.',
                    metavar='TEXT', help='Text to synthesize')
    ap.add_argument('--speaker', type=int, default=0, metavar='N',
                    help='Speaker index for multi-speaker models (default: 0)')
    ap.add_argument('--notranslate', action='store_true',
                    help='Skip EN->JP translation; pass text directly to the model')
    ap.add_argument('--interactive', action='store_true',
                    help='Cycle through all speakers interactively')
    ap.add_argument('--out', default=None, metavar='FILE',
                    help='Save WAV to this path instead of a temp file')
    args = ap.parse_args()

    pth_path = os.path.abspath(args.pth)
    if not os.path.isfile(pth_path):
        sys.exit(f'ERROR: .pth file not found: {pth_path}')

    # ── Config resolution ────────────────────────────────────────────────────
    config_path = args.config
    if config_path:
        config_path = os.path.abspath(config_path)
        if not os.path.isfile(config_path):
            sys.exit(f'ERROR: config.json not found: {config_path}')
    else:
        config_path = _find_config(pth_path)
        if config_path:
            print(f'[tester] Auto-detected config: {config_path}')
        else:
            print(
                '\nERROR: No config.json found next to your .pth file.\n\n'
                'VITS models need a config.json to define the model architecture.\n'
                'Where to get it:\n'
                '  • Download the config.json from the same repo you got the .pth from.\n'
                '  • moe-tts (skytnt) models: https://huggingface.co/skytnt/moe-tts\n'
                '    Each model folder has both model.pth and config.json.\n'
                '  • Then re-run:  python scripts/test-voice.py --pth path/to/model.pth\n'
                '    (it will auto-detect config.json if it is in the same folder)\n'
                '\nAlternatively pass it explicitly:\n'
                '  python scripts/test-voice.py --pth model.pth --config config.json\n'
            )
            sys.exit(1)

    # ── Load model ───────────────────────────────────────────────────────────
    net_g, hps, sym_to_id, n_speakers, speaker_names = load_model(pth_path, config_path)

    # ── Translator ───────────────────────────────────────────────────────────
    translator = None
    if not args.notranslate:
        print('[tester] Initialising EN->JP translator...')
        translator = _init_translator()
        if translator:
            print('[tester] Translator ready.')
        else:
            print('[tester] No translator installed — text passed through as-is.')
            print('         (install with: pip install argostranslate)\n')

    # ── Synthesize ───────────────────────────────────────────────────────────
    def run_speaker(speaker_id, out=None, prefix='vits_test_'):
        name = speaker_names[speaker_id] if speaker_id < len(speaker_names) else f'speaker_{speaker_id}'
        print(f'[tester] Synthesizing — speaker {speaker_id} ({name}) ...')
        audio, sr = synthesize_one(
            args.text, speaker_id,
            net_g, hps, sym_to_id, n_speakers,
            translator, args.notranslate,
        )
        if audio is None:
            print('[tester] Synthesis produced no audio — skipping.\n')
            return
        wav_bytes = _array_to_wav(audio, sr)
        saved = save_and_play(wav_bytes, out_path=out,
                              prefix=f'vits_spk{speaker_id}_')
        print(f'[tester] Saved to: {saved}\n')

    if args.interactive and n_speakers > 1:
        total = n_speakers
        print(f'[tester] Interactive mode — {total} speakers.')
        print(f'[tester] Text: "{args.text}"\n')
        for i in range(total):
            name = speaker_names[i] if i < len(speaker_names) else f'Speaker {i}'
            ans = input(f'  Play speaker {i} ({name})? [Enter=yes / s=skip / q=quit]: ').strip().lower()
            if ans == 'q':
                break
            if ans == 's':
                continue
            run_speaker(i)
    elif args.interactive and n_speakers <= 1:
        print('[tester] --interactive has no effect on single-speaker models.')
        run_speaker(0, out=args.out)
    else:
        run_speaker(args.speaker, out=args.out)

    print('[tester] Done.')


if __name__ == '__main__':
    main()
