#!/usr/bin/env node
// Launches Electron with ELECTRON_RUN_AS_NODE cleared.
// Needed because VSCode/Claude Code sets ELECTRON_RUN_AS_NODE=1 in the terminal,
// which would prevent Electron from creating windows.
const { execFileSync } = require('child_process');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = process.argv.slice(2);

try {
  execFileSync(electronPath, ['.', ...args], {
    stdio: 'inherit',
    env,
    cwd: process.cwd(),
  });
} catch (err) {
  if (err.status !== null) process.exit(err.status);
}
