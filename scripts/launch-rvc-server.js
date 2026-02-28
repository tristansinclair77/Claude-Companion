'use strict';
// Standalone launcher for the RVC voice conversion server.
// Can be run manually: node scripts/launch-rvc-server.js
// The Electron app starts the server automatically via ttsEngine.startRvcServer().
//
// The --models-dir argument is read from config.json (rvc.modelsDir).
// If not configured, the server will start but report no models.

const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');

const CONFIG_PATH = path.join(__dirname, '../config.json');
const serverScript = path.join(__dirname, 'rvc-server', 'server.py');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

const cfg       = readConfig();
const modelsDir = cfg.rvc?.modelsDir || '';

if (!modelsDir) {
  console.error('[launch-rvc-server] No rvc.modelsDir set in config.json.');
  console.error('[launch-rvc-server] Add: { "rvc": { "modelsDir": "path/to/models" } }');
  process.exit(1);
}

// Prefer dedicated Python 3.10 venv — fairseq (required by rvc_python) needs Python < 3.12.
const venvPython = path.join(__dirname, 'rvc-server', 'venv', 'Scripts', 'python.exe');
const pythonExe  = fs.existsSync(venvPython) ? venvPython : 'python';

console.log('[launch-rvc-server] Starting RVC server...');
console.log('[launch-rvc-server] Python    :', pythonExe);
console.log('[launch-rvc-server] Script    :', serverScript);
console.log('[launch-rvc-server] Models dir:', modelsDir);

const proc = spawn(pythonExe, [serverScript, '--models-dir', modelsDir], {
  stdio: 'inherit',
  cwd: path.dirname(serverScript),
});

proc.on('error', (err) => {
  console.error('[launch-rvc-server] Failed to start Python:', err.message);
  console.error('[launch-rvc-server] Make sure Python is installed and rvc_python is installed.');
  console.error('[launch-rvc-server] Install: pip install rvc_python flask soundfile');
  process.exit(1);
});

proc.on('exit', (code) => {
  process.exit(code ?? 0);
});
