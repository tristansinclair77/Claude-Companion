'use strict';
// Dynamic CRT and ambient effects — scanline flicker, portrait glow pulse.

var UIEffects = (() => {
  function init() {
    dynamicScanlineFlicker();
    // Additional effects can go here
  }

  function dynamicScanlineFlicker() {
    const overlay = document.querySelector('.crt-overlay');
    if (!overlay) return;

    // Randomly intensify the scanline overlay occasionally (subtle)
    setInterval(() => {
      const r = Math.random();
      if (r < 0.02) {
        // Occasional brief flicker
        overlay.style.opacity = (0.5 + Math.random() * 0.4).toFixed(2);
        setTimeout(() => { overlay.style.opacity = ''; }, 80 + Math.random() * 120);
      }
    }, 500);
  }

  return { init };
})();
