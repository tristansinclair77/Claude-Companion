#!/usr/bin/env node
// Launches the Character Builder as a standalone Electron window.
// Clears ELECTRON_RUN_AS_NODE so Electron renders normally (VSCode/Claude Code sets it).
const { execFileSync } = require('child_process');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

try {
  execFileSync(electronPath, ['.', '--char-builder'], {
    stdio: 'inherit',
    env,
    cwd: require('path').join(__dirname, '..'),
  });
} catch (err) {
  if (err.status !== null) process.exit(err.status);
}
