'use strict';
// Music selector — browse and play the adventure soundtrack from normal chat.

const MusicSelector = (() => {
  let _panel, _btn, _searchInput, _trackList, _nowPlayingBar, _volSlider, _stopBtn;
  let _bible = null;
  let _activeCategory = 'ALL';
  let _currentBibleId = null;

  const CAT_SHORT = {
    'I. FIELD & OVERWORLD':                  'FIELD',
    'II. TOWNS & SETTLEMENTS':               'TOWNS',
    'III. SACRED, SCHOLARLY & SAFE INTERIORS': 'SACRED',
    'IV. DUNGEONS & UNDERGROUND':            'DUNGEONS',
    'V. STRONGHOLDS & ENEMY CAMPS':          'CAMPS',
    'VI. BATTLE THEMES':                     'BATTLE',
    'VII. CUTSCENES — TENDER & WARM':        'TENDER',
    'VIII. CUTSCENES — SORROW & LOSS':       'SORROW',
    'IX. CUTSCENES — DRAMA & REVELATION':    'DRAMA',
    'X. CUTSCENES — HOPE & TRIUMPH':         'TRIUMPH',
    'XI. CELEBRATIONS & CEREMONIES':         'CELEBRATE',
    'XII. ENDINGS & CREDITS':               'ENDINGS',
  };

  const ENERGY_COLOR = {
    LOW:     '#00ff8880',
    MEDIUM:  '#00ffcc88',
    HIGH:    '#ffaa0088',
    EXTREME: '#ff446688',
  };

  function _catShort(fullCat) {
    return CAT_SHORT[fullCat] || fullCat.split(/[.—]/)[0].trim().slice(0, 10);
  }

  function _filteredTracks() {
    if (!_bible) return [];
    const q = (_searchInput?.value || '').trim().toLowerCase();
    return _bible.filter((t) => {
      if (_activeCategory !== 'ALL' && t.category !== _activeCategory) return false;
      if (q && !t.name.toLowerCase().includes(q) && !String(t.id).includes(q)) return false;
      return true;
    });
  }

  function _renderTracks() {
    if (!_trackList) return;
    const tracks = _filteredTracks();
    if (!tracks.length) {
      _trackList.innerHTML = '<div class="ms-empty">No tracks match.</div>';
      return;
    }
    let html = '';
    let lastCat = null;
    for (const t of tracks) {
      if (_activeCategory === 'ALL' && t.category !== lastCat) {
        lastCat = t.category;
        html += `<div class="ms-cat-header">${_catShort(t.category)}</div>`;
      }
      const active = t.id === _currentBibleId;
      const ec = ENERGY_COLOR[t.energy] || '#ffffff44';
      html += `<div class="ms-track${active ? ' ms-track-active' : ''}" data-id="${t.id}">
        <span class="ms-track-id">${String(t.id).padStart(3, '0')}</span>
        <span class="ms-track-name">${t.name}</span>
        <span class="ms-track-energy" style="color:${ec}">${t.energy}</span>
      </div>`;
    }
    _trackList.innerHTML = html;

    _trackList.querySelectorAll('.ms-track').forEach((el) => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.id, 10);
        if (id === _currentBibleId) {
          window.musicAPI.stop();
        } else {
          window.musicAPI.playCue(id);
        }
      });
    });
  }

  function _renderCategoryTabs() {
    const tabBar = _panel.querySelector('#ms-cat-tabs');
    if (!tabBar || !_bible) return;
    const cats = [...new Set(_bible.map((t) => t.category))];
    let html = `<button class="ms-cat-tab${_activeCategory === 'ALL' ? ' active' : ''}" data-cat="ALL">ALL</button>`;
    for (const c of cats) {
      const active = _activeCategory === c;
      html += `<button class="ms-cat-tab${active ? ' active' : ''}" data-cat="${c}">${_catShort(c)}</button>`;
    }
    tabBar.innerHTML = html;
    tabBar.querySelectorAll('.ms-cat-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        _activeCategory = btn.dataset.cat;
        _renderCategoryTabs();
        _renderTracks();
      });
    });
  }

  function _updateNowPlaying(detail) {
    _currentBibleId = detail ? detail.bibleId : null;

    if (_btn) {
      _btn.classList.toggle('active', !!detail && !detail.paused);
    }
    if (_nowPlayingBar) {
      if (detail) {
        const icon = detail.paused ? '⏸' : '♫';
        _nowPlayingBar.textContent = `${icon} ${detail.name}`;
        _nowPlayingBar.classList.remove('ms-nowplaying-idle');
      } else {
        _nowPlayingBar.textContent = '— nothing playing —';
        _nowPlayingBar.classList.add('ms-nowplaying-idle');
      }
    }
    if (_stopBtn) {
      _stopBtn.disabled = !detail;
    }
    // Re-highlight active row without full re-render
    if (_trackList) {
      _trackList.querySelectorAll('.ms-track').forEach((el) => {
        el.classList.toggle('ms-track-active', parseInt(el.dataset.id, 10) === _currentBibleId);
      });
    }
  }

  async function _open() {
    if (!_bible) {
      const result = await window.musicAPI.getBible();
      _bible = result.tracks || result;
    }
    const settings = await window.musicAPI.getSettings();
    if (_volSlider) _volSlider.value = settings.volume ?? 0.55;

    _renderCategoryTabs();
    _renderTracks();

    // Sync current playing state from MusicPlayer
    if (window.MusicPlayer) {
      _updateNowPlaying(window.MusicPlayer.getNowPlaying());
    }

    _panel.classList.remove('hidden');
    _btn.classList.add('open');
  }

  function _close() {
    _panel.classList.add('hidden');
    _btn.classList.remove('open');
  }

  function init() {
    _panel  = document.getElementById('music-selector-panel');
    _btn    = document.getElementById('btn-music');
    _trackList   = document.getElementById('ms-track-list');
    _nowPlayingBar = document.getElementById('ms-now-playing');
    _searchInput = document.getElementById('ms-search');
    _volSlider   = document.getElementById('ms-volume');
    _stopBtn     = document.getElementById('ms-stop-btn');

    if (!_panel || !_btn) return;

    _btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_panel.classList.contains('hidden')) {
        _open();
      } else {
        _close();
      }
    });

    document.addEventListener('click', (e) => {
      if (!_panel.classList.contains('hidden') &&
          !_panel.contains(e.target) && e.target !== _btn) {
        _close();
      }
    });

    document.getElementById('ms-close-btn')?.addEventListener('click', _close);

    _stopBtn?.addEventListener('click', () => window.musicAPI.stop());

    _searchInput?.addEventListener('input', () => _renderTracks());

    _volSlider?.addEventListener('input', () => {
      const v = parseFloat(_volSlider.value);
      window.MusicPlayer?.setVolume(v);
      window.musicAPI.setSettings({ volume: v });
    });

    // Track playback state changes
    document.addEventListener('music:now-playing', (e) => {
      _updateNowPlaying(e.detail);
    });
  }

  return { init };
})();

window.MusicSelector = MusicSelector;
