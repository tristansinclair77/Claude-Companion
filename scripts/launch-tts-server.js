'use strict';
// Standalone launcher for the VITS TTS server.
// Can be run manually: node scripts/launch-tts-server.js
// The Electron app starts the server automatically via tts-engine.startVitsServer().

const { spawn } = require('child_process');
const path = require('path');

const serverScript = path.join(__dirname, 'tts-server', 'server.py');

console.log('[launch-tts-server] Starting VITS TTS server...');
console.log('[launch-tts-server] Script:', serverScript);

const proc = spawn('python', [serverScript], {
  stdio: 'inherit',
  cwd: path.dirname(serverScript),
});

proc.on('error', (err) => {
  console.error('[launch-tts-server] Failed to start Python:', err.message);
  console.error('[launch-tts-server] Make sure Python is installed and in PATH.');
  process.exit(1);
});

proc.on('exit', (code) => {
  process.exit(code ?? 0);
});
