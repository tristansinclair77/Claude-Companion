@echo off
:: ── Drawing Overlay ───────────────────────────────────────────────────────────
:: Transparent always-on-top image overlay for tracing / 1:1 reference drawing.
:: Load an image, then press Ctrl+Shift+T to lock it as a click-through overlay.
:: Ctrl+Shift+Up / Down adjusts opacity while tracing.
:: ─────────────────────────────────────────────────────────────────────────────
cd /d "%~dp0\..\tools\drawing-overlay"
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)
npm start
pause
