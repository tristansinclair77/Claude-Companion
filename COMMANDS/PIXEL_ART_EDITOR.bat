@echo off
:: ── Pixel Art Editor ───────────────────────────────────────────────────────
:: Opens the standalone Pixel Art Editor in your default browser.
:: Draw sprites, characters, tiles, and animations. Save as JSON for Claude.
:: ─────────────────────────────────────────────────────────────────────────────
cd /d "%~dp0\.."
start "" "tools\pixel-art-editor\index.html"
