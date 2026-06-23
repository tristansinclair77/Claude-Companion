// Requests Panel — displays Aria's self-queued feature requests.
// Wires up the "✦ REQUESTS" button, panel open/close, list rendering, and delete actions.

(function () {
  const panel   = document.getElementById('requests-panel');
  const list    = document.getElementById('requests-list');
  const btnOpen = document.getElementById('btn-requests');
  const btnClose= document.getElementById('btn-requests-close');
  const badge   = document.getElementById('requests-badge');

  if (!panel || !list || !btnOpen) return;

  // ── Open / Close ─────────────────────────────────────────────────────────────

  function open() {
    panel.classList.remove('hidden');
    refresh();
  }

  function close() {
    panel.classList.add('hidden');
  }

  btnOpen.addEventListener('click', () => {
    panel.classList.contains('hidden') ? open() : close();
  });

  if (btnClose) {
    btnClose.addEventListener('click', close);
  }

  // Close if user clicks outside the panel or its button
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('hidden') &&
        !panel.contains(e.target) &&
        e.target !== btnOpen &&
        !btnOpen.contains(e.target)) {
      close();
    }
  });

  // ── Badge ─────────────────────────────────────────────────────────────────────

  function updateBadge(count) {
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  async function refresh() {
    let requests = [];
    try {
      requests = await window.claudeAPI.getFeatureRequests();
    } catch (e) {
      console.warn('[RequestsPanel] Failed to load requests:', e);
    }

    updateBadge(requests.length);
    render(requests);
  }

  function render(requests) {
    list.innerHTML = '';

    if (!requests || requests.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'requests-empty';
      empty.textContent = '// no requests queued';
      list.appendChild(empty);
      return;
    }

    for (const req of requests) {
      const item = document.createElement('div');
      item.className = 'requests-item';
      item.dataset.id = req.id;

      const header = document.createElement('div');
      header.className = 'requests-item-header';

      const title = document.createElement('span');
      title.className = 'requests-item-title';
      title.textContent = req.title;

      const del = document.createElement('button');
      del.className = 'requests-item-delete';
      del.title = 'Remove request';
      del.textContent = '🗑';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRequest(req.id);
      });

      header.appendChild(title);
      header.appendChild(del);

      const desc = document.createElement('div');
      desc.className = 'requests-item-desc';
      desc.textContent = req.description;

      const meta = document.createElement('div');
      meta.className = 'requests-item-meta';
      meta.textContent = 'Added ' + formatDate(req.addedAt);

      item.appendChild(header);
      item.appendChild(desc);
      item.appendChild(meta);
      list.appendChild(item);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function deleteRequest(id) {
    try {
      await window.claudeAPI.deleteFeatureRequest(id);
      // Panel refreshes via the feature-requests:updated event
    } catch (e) {
      console.warn('[RequestsPanel] Delete failed:', e);
    }
  }

  // ── Live updates from main process ───────────────────────────────────────────

  window.claudeAPI.on('feature-requests:updated', (payload) => {
    // Always refresh badge; refresh list only if panel is open.
    // payload may be { flash: true, source: 'adventure' } — if so, briefly
    // pulse the button + badge so the user notices a new request arrived.
    window.claudeAPI.getFeatureRequests().then((requests) => {
      updateBadge((requests || []).length);
      if (!panel.classList.contains('hidden')) {
        render(requests || []);
      }
      if (payload && payload.flash) {
        _flashRequestsButton();
      }
    }).catch(() => {});
  });

  function _flashRequestsButton() {
    if (!btnOpen) return;
    // Restart the animation by removing then re-adding the class on the next
    // frame — without this, repeat flashes in a row don't replay.
    btnOpen.classList.remove('flash-new');
    if (badge) badge.classList.remove('flash-new');
    void btnOpen.offsetWidth;  // force reflow
    btnOpen.classList.add('flash-new');
    if (badge) badge.classList.add('flash-new');
    setTimeout(() => {
      btnOpen.classList.remove('flash-new');
      if (badge) badge.classList.remove('flash-new');
    }, 5200);  // matches 1.6s × 3 iterations in CSS
  }

  // ── Initial badge load ────────────────────────────────────────────────────────

  window.claudeAPI.getFeatureRequests().then((requests) => {
    updateBadge((requests || []).length);
  }).catch(() => {});

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso.slice(0, 10);
    }
  }
})();
