'use strict';
// Persona force popup — lets the user apply a temporary personality directive,
// with a persistent history of recent + favorited entries.

var PersonaPopup = (() => {
  const popup       = document.getElementById('persona-popup');
  const textarea    = document.getElementById('persona-input');
  const btn         = document.getElementById('btn-persona');
  const applyBtn    = document.getElementById('btn-persona-apply');
  const clearBtn    = document.getElementById('btn-persona-clear');
  const historyBtn  = document.getElementById('btn-persona-history');
  const historyList = document.getElementById('persona-history-list');

  // Cap non-favorited entries so the dropdown doesn't grow forever.
  // Favorites are always retained regardless of recency.
  const MAX_RECENT = 20;

  let _active = false;     // a directive is currently applied
  let _history = [];       // [{id, text, favorite, createdAt, lastUsedAt}]

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
    historyList.classList.add('hidden');
    historyBtn.textContent = '▾ HISTORY';
    if (!_active) btn.classList.remove('active');
  }

  function _toggle() {
    popup.classList.contains('hidden') ? _open() : _close();
  }

  async function _persistHistory() {
    try { _history = await window.claudeAPI.setPersonaHistory(_history) || _history; }
    catch (e) { console.warn('[Persona] history save failed:', e); }
  }

  function _findExisting(text) {
    const norm = text.trim().toLowerCase();
    return _history.find(h => (h.text || '').trim().toLowerCase() === norm);
  }

  async function _recordUsage(text) {
    const t = (text || '').trim();
    if (!t) return;
    const now = Date.now();
    const existing = _findExisting(t);
    if (existing) {
      existing.lastUsedAt = now;
    } else {
      _history.unshift({
        id: 'p_' + now + '_' + Math.floor(Math.random() * 1000),
        text: t,
        favorite: false,
        createdAt: now,
        lastUsedAt: now,
      });
      _pruneRecents();
    }
    await _persistHistory();
    _renderList();
  }

  function _pruneRecents() {
    const favs = _history.filter(h => h.favorite);
    const recents = _history
      .filter(h => !h.favorite)
      .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
      .slice(0, MAX_RECENT);
    _history = [...favs, ...recents];
  }

  async function _toggleFavorite(id) {
    const entry = _history.find(h => h.id === id);
    if (!entry) return;
    entry.favorite = !entry.favorite;
    _pruneRecents();
    await _persistHistory();
    _renderList();
  }

  async function _deleteEntry(id) {
    _history = _history.filter(h => h.id !== id);
    await _persistHistory();
    _renderList();
  }

  function _renderList() {
    historyList.innerHTML = '';
    if (!_history.length) {
      const empty = document.createElement('div');
      empty.className = 'ph-empty';
      empty.textContent = '// NO ENTRIES YET';
      historyList.appendChild(empty);
      return;
    }

    const favs    = _history.filter(h => h.favorite)
                            .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
    const recents = _history.filter(h => !h.favorite)
                            .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));

    if (favs.length) {
      _appendSectionLabel('★ FAVORITES');
      favs.forEach(h => historyList.appendChild(_buildRow(h)));
    }
    if (recents.length) {
      if (favs.length) _appendSectionLabel('RECENT');
      recents.forEach(h => historyList.appendChild(_buildRow(h)));
    }
  }

  function _appendSectionLabel(text) {
    const lab = document.createElement('div');
    lab.className = 'ph-section-label';
    lab.textContent = text;
    historyList.appendChild(lab);
  }

  function _buildRow(entry) {
    const row = document.createElement('div');
    row.className = 'ph-row';
    row.title = entry.text;

    const star = document.createElement('span');
    star.className = 'ph-star' + (entry.favorite ? ' fav' : '');
    star.textContent = entry.favorite ? '★' : '☆';
    star.title = entry.favorite ? 'Unfavorite' : 'Favorite';
    star.addEventListener('click', (e) => { e.stopPropagation(); _toggleFavorite(entry.id); });

    const text = document.createElement('span');
    text.className = 'ph-text';
    text.textContent = entry.text;

    const del = document.createElement('span');
    del.className = 'ph-del';
    del.textContent = '×';
    del.title = 'Remove from history';
    del.addEventListener('click', (e) => { e.stopPropagation(); _deleteEntry(entry.id); });

    // Click row text → load into textarea (does NOT auto-apply, so user can edit first)
    row.addEventListener('click', () => {
      textarea.value = entry.text;
      textarea.focus();
      historyList.classList.add('hidden');
      historyBtn.textContent = '▾ HISTORY';
    });

    row.appendChild(star);
    row.appendChild(text);
    row.appendChild(del);
    return row;
  }

  function _toggleHistoryList() {
    const hidden = historyList.classList.toggle('hidden');
    historyBtn.textContent = hidden ? '▾ HISTORY' : '▴ HISTORY';
  }

  async function _apply() {
    const text = textarea.value.trim();
    await window.claudeAPI.setPersona(text);
    _setActive(text);
    if (text) await _recordUsage(text);
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

    try {
      const arr = await window.claudeAPI.getPersonaHistory();
      _history = Array.isArray(arr) ? arr : [];
      _renderList();
    } catch (e) { console.warn('[Persona] history load failed:', e); }

    btn.addEventListener('click', (e) => { e.stopPropagation(); _toggle(); });
    applyBtn.addEventListener('click', _apply);
    clearBtn.addEventListener('click', _clear);
    historyBtn.addEventListener('click', (e) => { e.stopPropagation(); _toggleHistoryList(); });

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
