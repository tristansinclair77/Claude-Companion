@echo off
:: ── Visual Effects Creator ────────────────────────────────────────────────────
:: Opens the standalone Visual Effects Creator window.
:: Configure and preview visual effects for any visual package.
:: ─────────────────────────────────────────────────────────────────────────────
cd /d "%~dp0\.."
node scripts\launch.js --vfx-creator
