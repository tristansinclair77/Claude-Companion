# Resume Instructions for Claude

Read `CLAUDE.md` first, then this file.

---

## Current State

App is fully functional. All phases complete. TTS has been upgraded from Microsoft Edge TTS to **kokoro-js** (local ONNX, no internet after first download).

The **VITS Anime TTS** backend is implemented and working. The user has `moet-tts-18` (Uma Musume, 87 speakers) in `scripts/tts-server/models/moet-tts-18/`.

---

## VITS Anime TTS — Status

### Files Written

| File | Status |
|---|---|
| `scripts/tts-server/server.py` | ✅ Flask server, multi-speaker, per-model symbols, notranslate flag |
| `scripts/tts-server/models.py` | ✅ VITS neural net (PyWaifu, MIT) |
| `scripts/tts-server/modules.py` | ✅ |
| `scripts/tts-server/attentions.py` | ✅ |
| `scripts/tts-server/commons.py` | ✅ |
| `scripts/tts-server/transforms.py` | ✅ |
| `scripts/tts-server/utils.py` | ✅ |
| `scripts/tts-server/monotonic_align.py` | ✅ Stub (training-only) |
| `scripts/tts-server/text/__init__.py` | ✅ |
| `scripts/tts-server/text/symbols.py` | ✅ |
| `scripts/tts-server/text/cleaners.py` | ✅ |
| `scripts/tts-server/text/japanese.py` | ✅ |
| `scripts/tts-server/requirements.txt` | ✅ |
| `scripts/tts-server/models/` | ✅ User has `moet-tts-18/` here |
| `scripts/launch-tts-server.js` | ✅ Standalone launcher |
| `src/main/tts-engine.js` | ✅ VITS backend, multi-speaker, startVitsServer() |
| `src/renderer/js/tts-controller.js` | ✅ Grouped voice picker (KOKORO / VITS ANIME) |
| `src/main/main.js` | ✅ Calls ttsEngine.startVitsServer() at startup |
| `src/renderer/styles/main.css` | ✅ .voice-section-header style added |

### Setup Required (User Steps)

Before VITS voices appear in the picker, the user must:

1. **Install Python deps:**
   ```
   pip install torch --index-url https://download.pytorch.org/whl/cpu
   pip install flask scipy numpy argostranslate unidecode pyopenjtalk
   ```

2. **Run the app** — `npm start`. The VITS server auto-starts.

### Architecture

```
tts-engine.js
├── backend "kokoro"  -> kokoro-js (English, already working)
└── backend "vits"    -> HTTP GET http://localhost:5002/synthesize?text=&voice=MODEL_ID&speaker=N
                         -> auto-started by Electron on app launch
                         -> falls back to kokoro if server not running
```

Voice IDs for multi-speaker models use the format `<model_id>:<speaker_index>`:
- `moet-tts-18:0`  → Special Week
- `moet-tts-18:6`  → Gold Ship
- etc.

Voice picker groups:
```
── KOKORO ─────────────────────    af_heart ★, af_bella ★, ...
── VITS ANIME ─────────────────    Special Week [JP], Silence Suzuka [JP], ... (87 total)
```

### How Multi-Speaker / Symbols Work

The `moet-tts-18` model stores its 40 symbols and 87 speaker names directly in `config.json`.

- **server.py** reads `hps.symbols` from config.json (priority over global symbols.py)
- **server.py** reads `hps.data.n_speakers` and passes it to `SynthesizerTrn`
- **server.py** passes `sid=torch.LongTensor([speaker_id])` to `net_g.infer()`
- **server.py** `/voices` endpoint expands multi-speaker models to one entry per speaker
- **tts-engine.js** `getVoices()` reads `config.json` speakers directly from disk
- **tts-engine.js** parses `"model:speaker"` voice IDs via `_parseVoiceId()`
- **server.py** accepts `?notranslate=1` to skip argostranslate (for future Claude translation feature)

### Known Constraints
- VITS voices require Python 3.x + ~1 GB of pip packages (torch, pyopenjtalk)
- argostranslate downloads ~100 MB on first run for EN->JP translation
- pyopenjtalk may need a C++ compiler on Windows if no wheel is available for Python 3.13
  - Fallback: use `pip install pyopenjtalk-prebuilt` if available, or Python 3.11

---

## Next Steps

Possible future work:
- **Settings menu with Claude JP translation checkbox** — user wanted a checkbox to send
  text to Claude for EN->JP translation instead of argostranslate. The `notranslate=1`
  query param on the server is already in place. Needs: settings modal in index.html,
  config.json persistence, IPC handlers, and the translation call in tts-engine.js.
- Add more VITS voices by dropping model packs into `scripts/tts-server/models/`
- Expose noise_scale / length_scale controls in the UI
- Add a "VITS server status" indicator in the title bar
