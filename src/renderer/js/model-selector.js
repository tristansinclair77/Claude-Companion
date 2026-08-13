'use strict';
// Model selector — title-bar dropdown for switching Aria's chat model between
// Haiku 4.5, Sonnet 4.6, and Opus 4.7. null means "use CLI default" (Haiku).
// Fast Mode remains independent — it only affects context truncation.

var ModelSelector = (() => {
  const btn      = document.getElementById('btn-model');
  const labelEl  = document.getElementById('btn-model-label');
  const picker   = document.getElementById('model-picker');

  // Order = user-facing display order. `id: null` maps to the CLI default.
  const OPTIONS = [
    { id: 'claude-haiku-4-5-20251001', label: 'HAIKU 4.5',  hint: 'fast, cheapest'   },
    { id: 'claude-sonnet-4-6',         label: 'SONNET 4.6', hint: 'balanced'         },
    { id: 'claude-opus-4-7',           label: 'OPUS 4.7',   hint: 'deepest, slowest' },
  ];

  const SHORT_LABEL = {
    'claude-haiku-4-5-20251001': 'HAIKU',
    'claude-sonnet-4-6':          'SONNET',
    'claude-opus-4-7':            'OPUS',
  };

  let _current = null;

  function _render() {
    picker.innerHTML = '';
    for (const opt of OPTIONS) {
      const row = document.createElement('div');
      row.className = 'model-option' + (opt.id === (_current || 'claude-haiku-4-5-20251001') ? ' active' : '');
      row.dataset.modelId = opt.id;

      const check = document.createElement('span');
      check.className = 'model-check';
      check.textContent = '✓';

      const label = document.createElement('span');
      label.textContent = opt.label;

      const hint = document.createElement('span');
      hint.className = 'model-hint';
      hint.textContent = opt.hint;

      row.appendChild(check);
      row.appendChild(label);
      row.appendChild(hint);
      row.addEventListener('click', () => _pick(opt.id));
      picker.appendChild(row);
    }
  }

  function _refreshLabel() {
    const effective = _current || 'claude-haiku-4-5-20251001';
    labelEl.textContent = SHORT_LABEL[effective] || 'MODEL';
  }

  async function _pick(id) {
    _current = await window.claudeAPI.setModel(id);
    _refreshLabel();
    _render();
    _close();
  }

  function _open() {
    _render();
    picker.classList.remove('hidden');
    btn.classList.add('active');
  }

  function _close() {
    picker.classList.add('hidden');
    btn.classList.remove('active');
  }

  function _toggle() {
    picker.classList.contains('hidden') ? _open() : _close();
  }

  async function init() {
    try {
      _current = await window.claudeAPI.getModel();
    } catch { _current = null; }
    _refreshLabel();

    btn.addEventListener('click', (e) => { e.stopPropagation(); _toggle(); });

    document.addEventListener('click', (e) => {
      if (!picker.classList.contains('hidden') && !picker.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        _close();
      }
    });
  }

  return { init };
})();
