@echo off
:: ── Color Scheme Creator ──────────────────────────────────────────────────────
:: Opens the standalone Color Scheme Creator window.
:: Edit and preview color schemes for any visual package.
:: ─────────────────────────────────────────────────────────────────────────────
cd /d "%~dp0\.."
node scripts\launch.js --color-creator
