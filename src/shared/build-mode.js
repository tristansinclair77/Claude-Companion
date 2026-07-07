// Build mode — DEBUG (developer build with inspector tools, source indicators,
// affection heart, etc.) vs PUBLIC (shipping build with those stripped).
//
// Resolution order (main-process side):
//   1. Explicit env var `CLAUDE_COMPANION_BUILD` if set to 'debug' or 'public'
//   2. Default: 'debug'
//
// On the renderer side, main.js sends the resolved BUILD_MODE via the app:init
// IPC payload. The renderer sets `document.body.classList.add('build-debug' | 'build-public')`
// and CSS handles the rest via `.build-debug-only` / `.build-public-only` classes.
//
// Package scripts (see package.json):
//   npm run start           — debug (default)
//   npm run build:debug     — explicit debug
//   npm run build:public    — public build

const raw = String(process.env.CLAUDE_COMPANION_BUILD || '').toLowerCase().trim();
const BUILD_MODE = raw === 'public' ? 'public' : 'debug';

const IS_DEBUG_BUILD  = BUILD_MODE === 'debug';
const IS_PUBLIC_BUILD = BUILD_MODE === 'public';

module.exports = { BUILD_MODE, IS_DEBUG_BUILD, IS_PUBLIC_BUILD };
