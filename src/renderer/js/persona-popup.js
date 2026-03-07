'use strict';
// Persona force popup — lets the user apply a temporary personality directive.

var PersonaPopup = (() => {
  const popup    = document.getElementById('persona-popup');
  const textarea = document.getElementById('persona-input');
  const btn      = document.getElementById('btn-persona');
  const applyBtn = document.getElementById('btn-persona-apply');
  const clearBtn = document.getElementById('btn-persona-clear');

  let _active = false; // whether a directive is currently applied

  function _setActive(text) {
    _active = !!text;
    if (_active) {
      btn.classList.add('active');
      btn.title = 'Personality directive active — click to edit';
    } else {
      btn.classList.remove('active');
      btn.title = 'Force a temporary personality directive';
    }
  }

  function _open() {
    popup.classList.remove('hidden');
    btn.classList.add('active');
    textarea.focus();
  }

  function _close() {
    popup.classList.add('hidden');
    if (!_active) btn.classList.remove('active');
  }

  function _toggle() {
    popup.classList.contains('hidden') ? _open() : _close();
  }

  async function _apply() {
    const text = textarea.value.trim();
    await window.claudeAPI.setPersona(text);
    _setActive(text);
    _close();
  }

  async function _clear() {
    textarea.value = '';
    await window.claudeAPI.setPersona('');
    _setActive('');
    _close();
  }

  async function init() {
    // Restore any previously set directive (session-only, so will be empty on fresh start)
    try {
      const saved = await window.claudeAPI.getPersona();
      if (saved) {
        textarea.value = saved;
        _setActive(saved);
      }
    } catch {}

    btn.addEventListener('click', (e) => { e.stopPropagation(); _toggle(); });
    applyBtn.addEventListener('click', _apply);
    clearBtn.addEventListener('click', _clear);

    // Ctrl+Enter applies
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); _apply(); }
      if (e.key === 'Escape') _close();
    });

    // Click outside closes
    document.addEventListener('click', (e) => {
      if (!popup.classList.contains('hidden') && !popup.contains(e.target) && e.target !== btn) {
        _close();
      }
    });
  }

  return { init };
})();
