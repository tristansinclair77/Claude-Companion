'use strict';
// Music selector — title bar bar + dropdown to browse/play the adventure soundtrack.

const MusicSelector = (() => {
  let _bar, _nameEl, _dropdown, _searchInput, _trackList;
  let _bible = null;
  let _currentBibleId = null;
  let _open = false;

  const CAT_SHORT = {
    'I. FIELD & OVERWORLD':                    'FIELD & OVERWORLD',
    'II. TOWNS & SETTLEMENTS':                 'TOWNS & SETTLEMENTS',
    'III. SACRED, SCHOLARLY & SAFE INTERIORS': 'SACRED & SAFE INTERIORS',
    'IV. DUNGEONS & UNDERGROUND':              'DUNGEONS & UNDERGROUND',
    'V. STRONGHOLDS & ENEMY CAMPS':            'STRONGHOLDS & CAMPS',
    'VI. BATTLE THEMES':                       'BATTLE THEMES',
    'VII. CUTSCENES — TENDER & WARM':          'CUTSCENES: TENDER',
    'VIII. CUTSCENES — SORROW & LOSS':         'CUTSCENES: SORROW',
    'IX. CUTSCENES — DRAMA & REVELATION':      'CUTSCENES: DRAMA',
    'X. CUTSCENES — HOPE & TRIUMPH':           'CUTSCENES: TRIUMPH',
    'XI. CELEBRATIONS & CEREMONIES':           'CELEBRATIONS',
    'XII. ENDINGS & CREDITS':                  'ENDINGS & CREDITS',
  };

  const ENERGY_COLOR = {
    LOW:     '#00ff8880',
    MEDIUM:  '#00ffcc88',
    HIGH:    '#ffaa0088',
    EXTREME: '#ff446688',
  };

  function _catLabel(fullCat) {
    return CAT_SHORT[fullCat] || fullCat;
  }

  function _filteredTracks() {
    if (!_bible) return [];
    const q = (_searchInput?.value || '').trim().toLowerCase();
    if (!q) return _bible;
    return _bible.filter((t) =>
      t.name.toLowerCase().includes(q) || String(t.id).includes(q)
    );
  }

  function _renderTracks() {
    if (!_trackList) return;
    const tracks = _filteredTracks();
    if (!tracks.length) {
      _trackList.innerHTML = '<div class="md-empty">No tracks match.</div>';
      return;
    }
    let html = '';
    let lastCat = null;
    for (const t of tracks) {
      if (t.category !== lastCat) {
        lastCat = t.category;
        html += `<div class="md-cat-header">${_catLabel(t.category)}</div>`;
      }
      const active = t.id === _currentBibleId;
      const ec = ENERGY_COLOR[t.energy] || '#ffffff44';
      html += `<div class="md-track${active ? ' md-track-active' : ''}" data-id="${t.id}">
        <span class="md-track-id">${String(t.id).padStart(3, '0')}</span>
        <span class="md-track-name">${t.name}</span>
        <span class="md-track-energy" style="color:${ec}">${t.energy}</span>
      </div>`;
    }
    _trackList.innerHTML = html;

    _trackList.querySelectorAll('.md-track').forEach((el) => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.id, 10);
        if (id === _currentBibleId) {
          window.musicAPI.stop();
        } else {
          window.musicAPI.playCue(id);
        }
        _closeDropdown();
      });
    });
  }

  function _positionDropdown() {
    if (!_bar || !_dropdown) return;
    const rect = _bar.getBoundingClientRect();
    _dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    _dropdown.style.top = rect.bottom + 'px';
  }

  async function _openDropdown() {
    await _loadBible();
    if (!_bible || !_bible.length) return;
    _renderTracks();
    _positionDropdown();
    _dropdown.classList.remove('hidden');
    _open = true;
    _bar.classList.add('active');
    // Focus search
    setTimeout(() => _searchInput?.focus(), 30);
  }

  function _closeDropdown() {
    _dropdown?.classList.add('hidden');
    _open = false;
    _bar?.classList.remove('active');
  }

  function _updateBar(detail) {
    _currentBibleId = detail ? detail.bibleId : null;
    if (_nameEl) {
      _nameEl.textContent = detail ? detail.name : '—';
    }
    if (_bar) {
      _bar.classList.toggle('playing', !!detail && !detail.paused);
    }
    // Update active highlight in open dropdown
    if (_open && _trackList) {
      _trackList.querySelectorAll('.md-track').forEach((el) => {
        el.classList.toggle('md-track-active', parseInt(el.dataset.id, 10) === _currentBibleId);
      });
    }
  }

  async function _loadBible() {
    if (_bible) return;
    const result = await window.musicAPI.getBible();
    _bible = result.tracks || result;
  }

  function init() {
    _bar        = document.getElementById('chat-music-bar');
    _nameEl     = document.getElementById('chat-music-name');
    _dropdown   = document.getElementById('music-dropdown');
    _searchInput = document.getElementById('md-search');
    _trackList  = document.getElementById('md-track-list');

    if (!_bar || !_dropdown) return;

    // Eagerly load bible in background so first click is instant
    _loadBible();

    _bar.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_open) {
        _closeDropdown();
      } else {
        _openDropdown();
      }
    });

    _searchInput?.addEventListener('input', () => _renderTracks());

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (_open && !_dropdown.contains(e.target) && e.target !== _bar) {
        _closeDropdown();
      }
    });

    // Reposition on resize
    window.addEventListener('resize', () => {
      if (_open) _positionDropdown();
    });

    // Track playback state
    document.addEventListener('music:now-playing', (e) => {
      _updateBar(e.detail);
    });

    // Sync initial state if music is already playing
    if (window.MusicPlayer) {
      _updateBar(window.MusicPlayer.getNowPlaying());
    }
  }

  return { init };
})();

window.MusicSelector = MusicSelector;
