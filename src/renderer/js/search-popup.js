'use strict';
// Web search popup — the user asks Aria to look something up on the internet.
// Three modes:
//   WEB    → DuckDuckGo pages → attached as text context to the next message.
//   IMAGE  → Openverse image → shown in MediaPopup + text context to Aria.
//   VIDEO  → YouTube video   → shown in MediaPopup + text context to Aria.

var SearchPopup = (() => {
  const popup     = document.getElementById('search-popup');
  const input     = document.getElementById('search-input');
  const btn       = document.getElementById('btn-search');
  const goBtn     = document.getElementById('btn-search-go');
  const cancelBtn = document.getElementById('btn-search-cancel');
  const statusEl  = document.getElementById('search-status');
  const hintEl    = document.getElementById('search-mode-hint');
  const messageEl = document.getElementById('user-input');
  const modeBtns  = Array.from(document.querySelectorAll('#search-popup .search-mode-btn'));
  const siteRow   = document.getElementById('search-site-row');
  const siteSel   = document.getElementById('search-site-select');

  // Per-mode: which sites the backend actually supports. Empty value = the mode's
  // default backend (DDG for web, Openverse for image, YouTube for video).
  const SITES = {
    web:   [
      { value: '',                label: 'DuckDuckGo (default)' },
    ],
    image: [
      { value: '',                label: 'Openverse (default, mostly SFW)' },
      { value: 'gelbooru.com',    label: 'gelbooru.com' },
    ],
    video: [
      { value: '',                label: 'YouTube (default)' },
      { value: 'rule34video.com', label: 'rule34video.com' },
    ],
  };

  const HINT = {
    web:   'Aria will read what she finds and answer as herself.',
    image: 'She\'ll pick an image, pop it up centered, and react to it in her reply.',
    video: 'Pick a site above, or type site:<host> in the query for one-offs.',
  };
  const PLACEHOLDER = {
    web:   'Search the web, or paste a URL...\ne.g. "best noise-cancelling headphones 2026"\nor "https://example.com/article"',
    image: 'Describe an image to find...\ne.g. "cozy library with candles"\nor "aurora borealis over pine forest"',
    video: 'Describe a video to find...\ne.g. "how to make sourdough"\nor "lofi study playlist"',
  };

  let _mode = 'web';
  let _site = '';           // '' = default backend for the current mode
  let _busy = false;

  function _setMode(m) {
    _mode = m;
    modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
    input.placeholder = PLACEHOLDER[m];
    hintEl.textContent = HINT[m];
    _rebuildSiteSelect();
  }

  function _rebuildSiteSelect() {
    const opts = SITES[_mode] || [];
    // Hide the row entirely if there's only the default (no user-visible choice).
    if (opts.length <= 1) {
      siteRow.classList.add('hidden');
      _site = '';
      return;
    }
    siteRow.classList.remove('hidden');
    siteSel.innerHTML = '';
    for (const o of opts) {
      const el = document.createElement('option');
      el.value = o.value;
      el.textContent = o.label;
      siteSel.appendChild(el);
    }
    // Preserve prior choice if still valid; otherwise reset to default.
    const valid = opts.some((o) => o.value === _site);
    siteSel.value = valid ? _site : '';
    _site = siteSel.value;
  }

  function _open() {
    popup.classList.remove('hidden');
    btn.classList.add('active');
    input.focus();
    _setStatus('');
  }

  function _close() {
    popup.classList.add('hidden');
    btn.classList.remove('active');
  }

  function _toggle() {
    if (_busy) return;
    popup.classList.contains('hidden') ? _open() : _close();
  }

  function _setStatus(text, kind) {
    if (!statusEl) return;
    if (!text) {
      statusEl.classList.add('hidden');
      statusEl.textContent = '';
      statusEl.classList.remove('error');
      return;
    }
    statusEl.textContent = text;
    statusEl.classList.remove('hidden');
    statusEl.classList.toggle('error', kind === 'error');
  }

  async function _go() {
    if (_busy) return;
    const raw = input.value.trim();
    if (!raw) {
      _setStatus('Enter a query first.', 'error');
      return;
    }

    _busy = true;
    goBtn.disabled = true;
    cancelBtn.disabled = true;
    goBtn.textContent = 'WORKING…';
    _setStatus(_mode === 'image' ? 'Finding an image…'
              : _mode === 'video' ? 'Finding a video…'
              : 'Searching the web…');

    try {
      // Pass the site as a separate arg so the backend can dispatch to a
      // per-host handler cleanly. Never mangle the raw query text — that
      // was breaking URL pastes.
      const result = await window.claudeAPI.webSearch(raw, _mode, _site);
      if (!result || !result.success) {
        throw new Error((result && result.error) || 'Search failed');
      }

      // Always drop the text summary in as a url-type attachment so the
      // companion's next reply is grounded in what was found.
      FileAttach.addAttachment({
        type: 'url',
        name: result.name || `🔎 Search: "${raw}"`,
        url: result.url || `search://${encodeURIComponent(raw)}`,
        content: result.content || '',
      });

      // Image / video → also open the media popup with the primary result.
      if ((result.mediaType === 'image' || result.mediaType === 'video') && result.media && result.media.primary) {
        MediaPopup.show({
          mediaType: result.mediaType,
          query:     result.media.query || raw,
          primary:   result.media.primary,
          alternates: result.media.alternates || [],
        });
      }

      // Prefill an Aria-friendly prompt if the message box is empty.
      if (!messageEl.value.trim()) {
        const isUrl = /^https?:\/\//i.test(raw);
        if (result.mediaType === 'image') {
          messageEl.value = `Hey Aria — I asked you to find me an image of "${raw}". What do you think of the one you picked?`;
        } else if (result.mediaType === 'video') {
          messageEl.value = `Hey Aria — I asked you to find me a video about "${raw}". What did you land on?`;
        } else if (isUrl) {
          messageEl.value = `Hey Aria — can you take a look at this page and tell me what it's about?`;
        } else {
          messageEl.value = `Hey Aria — I asked the web about "${raw}". What did you find?`;
        }
      }

      _close();
      messageEl.focus();
    } catch (err) {
      _setStatus(err.message || 'Search failed', 'error');
    } finally {
      _busy = false;
      goBtn.disabled = false;
      cancelBtn.disabled = false;
      goBtn.textContent = 'SEARCH';
    }
  }

  function init() {
    btn.addEventListener('click', (e) => { e.stopPropagation(); _toggle(); });
    goBtn.addEventListener('click', _go);
    cancelBtn.addEventListener('click', _close);
    modeBtns.forEach((b) => b.addEventListener('click', () => _setMode(b.dataset.mode)));
    siteSel.addEventListener('change', () => { _site = siteSel.value; });
    _setMode('web');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _go(); }
      if (e.key === 'Escape') _close();
    });

    document.addEventListener('click', (e) => {
      if (_busy) return;
      if (!popup.classList.contains('hidden') && !popup.contains(e.target) && e.target !== btn) {
        _close();
      }
    });
  }

  return { init };
})();
