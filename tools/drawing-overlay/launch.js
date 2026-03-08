/**
 * launch.js — clears ELECTRON_RUN_AS_NODE before spawning Electron.
 * Required when launching from VSCode / Claude Code terminal.
 */
const { spawn } = require('child_process');
const path = require('path');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = [path.join(__dirname, 'main.js'), ...process.argv.slice(2)];
const child = spawn(electronPath, args, { stdio: 'inherit', env });

child.on('exit', (code) => process.exit(code ?? 0));
