// Binder for the ADVENTURE TEXT settings section (typewriter on/off, speed,
// skip-on-click). Pushes live updates into the running TextAdventure module.

(function () {
  const tw      = document.getElementById('adv-typewriter-btn');
  const cps     = document.getElementById('adv-type-cps');
  const cpsVal  = document.getElementById('adv-type-cps-val');
  const skip    = document.getElementById('adv-skip-click-btn');
  const expBtn  = document.getElementById('adv-export-btn');
  const impBtn  = document.getElementById('adv-import-btn');

  if (!tw || !cps || !skip || !window.adventureAPI) return;

  function _setOn(btn, on) {
    btn.classList.toggle('active', !!on);
    btn.textContent = on ? 'ON' : 'OFF';
  }

  function _pushLive(partial) {
    if (window.TextAdventure && typeof window.TextAdventure.setTypeSettings === 'function') {
      window.TextAdventure.setTypeSettings(partial);
    }
  }

  // Load persisted
  window.adventureAPI.getDisplaySettings().then((s) => {
    if (!s) return;
    _setOn(tw, s.typewriter !== false);
    cps.value = s.typeCps || 80;
    cpsVal.textContent = cps.value + ' cps';
    _setOn(skip, s.skipOnClick !== false);
  }).catch(() => {});

  tw.addEventListener('click', () => {
    const next = !tw.classList.contains('active');
    _setOn(tw, next);
    window.adventureAPI.setDisplaySettings({ typewriter: next });
    _pushLive({ typewriter: next });
  });

  cps.addEventListener('input', () => {
    const v = parseInt(cps.value, 10);
    cpsVal.textContent = v + ' cps';
    window.adventureAPI.setDisplaySettings({ typeCps: v });
    _pushLive({ typeCps: v });
  });

  skip.addEventListener('click', () => {
    const next = !skip.classList.contains('active');
    _setOn(skip, next);
    window.adventureAPI.setDisplaySettings({ skipOnClick: next });
    _pushLive({ skipOnClick: next });
  });

  if (expBtn) {
    expBtn.addEventListener('click', () => {
      if (window.TextAdventure && typeof window.TextAdventure.exportGame === 'function') {
        window.TextAdventure.exportGame();
      }
    });
  }
  if (impBtn) {
    impBtn.addEventListener('click', () => {
      if (window.TextAdventure && typeof window.TextAdventure.importGame === 'function') {
        window.TextAdventure.importGame();
      }
    });
  }
})();
