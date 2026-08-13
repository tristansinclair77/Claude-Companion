'use strict';
// Media popup — centered image/video display. Called by SearchPopup when the
// user requests an image or video search. Exposes: show({...}), hide(), close(),
// and isOpen().
//
//   SAVE  — for images, opens native Save-As dialog and downloads the file.
//           for videos, opens the video URL in the OS default browser (since
//           YouTube can't be arbitrarily downloaded from here).
//   HIDE  — shrinks the popup to a mini chip in the bottom-right. Click the
//           chip to restore. State is preserved so nothing is re-fetched.
//   CLOSE — dismisses the popup entirely.

var MediaPopup = (() => {
  const popup    = document.getElementById('media-popup');
  const titleEl  = document.getElementById('media-popup-title');
  const contentEl= document.getElementById('media-popup-content');
  const metaEl   = document.getElementById('media-popup-meta');
  const saveBtn  = document.getElementById('btn-media-save');
  const hideBtn  = document.getElementById('btn-media-hide');
  const closeBtn = document.getElementById('btn-media-close');
  const miniBtn    = document.getElementById('media-popup-mini');
  const miniIconEl = document.getElementById('media-mini-icon');
  const miniLabel  = document.getElementById('media-mini-label');

  // Currently-displayed record. Kept even while HIDE is engaged so the mini
  // chip's restore-click can re-render without a network round-trip.
  let _current = null;

  // Route remote http(s) image URLs through the main process so we can attach
  // a proper Referer (defeats hotlink protection on gelbooru et al.).
  function _proxyImg(url) {
    if (!url || !/^https?:\/\//i.test(url)) return url;
    return 'companion-img://fetch/' + encodeURIComponent(url);
  }

  // Try the primary image; on load-error, walk through alternates until one
  // works. Only shows the "removed at source" message once nothing loads.
  function _renderImageWithFallback(el, current) {
    const candidates = [current.primary, ...(current.alternates || [])].filter(Boolean);
    let idx = 0;

    function tryNext() {
      if (idx >= candidates.length) {
        el.innerHTML = '<div class="media-error">All ' + candidates.length + ' candidate images failed to load. Try a different query.</div>';
        return;
      }
      const cand = candidates[idx++];
      el.innerHTML = '';
      const img = document.createElement('img');
      img.alt = cand.title || 'Image result';
      img.referrerPolicy = 'no-referrer';
      img.src = _proxyImg(cand.imageUrl);
      img.addEventListener('error', tryNext);
      el.appendChild(img);
    }
    tryNext();
  }

  function _renderInto(el, current) {
    el.innerHTML = '';
    if (!current) return;

    if (current.mediaType === 'image') {
      _renderImageWithFallback(el, current);
    } else if (current.mediaType === 'video') {
      const frame = document.createElement('iframe');
      // Autoplay-enabled embed. YouTube honors ?autoplay=1&mute=0; ignored
      // hosts just drop the param. Adding an autoplay hint to `allow` is
      // required by Chromium's Permissions Policy before autoplay=1 will
      // actually start playback in-place.
      const sep = current.primary.embedUrl.includes('?') ? '&' : '?';
      frame.src = current.primary.embedUrl + sep + 'autoplay=1&rel=0';
      frame.allow = 'autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture';
      frame.allowFullscreen = true;
      frame.title = current.primary.title || 'Video result';
      el.appendChild(frame);
    }
  }

  function _renderMeta(current) {
    if (!current) { metaEl.innerHTML = ''; return; }
    const p = current.primary;
    // No <a target="_blank"> here — those trigger a new Electron BrowserWindow
    // on click, which is exactly the "opens another window" bug we're avoiding.
    // Everything stays inline; the media itself is embedded above.
    if (current.mediaType === 'image') {
      const bits = [];
      if (p.creator)          bits.push('by <strong>' + _escape(p.creator) + '</strong>');
      if (p.source)           bits.push('on ' + _escape(p.source));
      if (p.license)          bits.push('<em>' + _escape(p.license) + '</em>');
      if (p.width && p.height) bits.push(p.width + '×' + p.height);
      metaEl.innerHTML =
        '<div>' + _escape(p.title || '') + '</div>' +
        (bits.length ? '<div>' + bits.join(' · ') + '</div>' : '');
    } else if (current.mediaType === 'video') {
      const bits = [];
      if (p.channel)  bits.push(_escape(p.channel));
      if (p.duration) bits.push(_escape(p.duration));
      if (p.views)    bits.push(_escape(p.views));
      metaEl.innerHTML =
        '<div>' + _escape(p.title || '') + '</div>' +
        (bits.length ? '<div>' + bits.join(' · ') + '</div>' : '');
    }
  }

  function _escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function _updateHeader(current) {
    if (!current) return;
    const kind = current.mediaType === 'video' ? '// VIDEO' : '// IMAGE';
    titleEl.textContent = kind + ' — ' + (current.query || '');
    miniIconEl.textContent = current.mediaType === 'video' ? '🎬' : '🖼';
    miniLabel.textContent  = current.mediaType === 'video' ? 'VIDEO' : 'IMAGE';
    // SAVE is only meaningful for images (writes bytes to disk). For videos
    // there's nothing sensible to do with the embed URL — the video already
    // plays in-place — so we hide the button entirely to stop users clicking
    // it and getting a new Electron window as a surprise.
    if (current.mediaType === 'video') {
      saveBtn.classList.add('hidden');
    } else {
      saveBtn.classList.remove('hidden');
      saveBtn.textContent = '💾 SAVE';
      saveBtn.title       = 'Save the image to disk';
    }
  }

  function show(current) {
    _current = current;
    _updateHeader(current);
    _renderInto(contentEl, current);
    _renderMeta(current);
    popup.classList.remove('hidden');
    miniBtn.classList.add('hidden');
  }

  function hide() {
    if (!_current) return;
    popup.classList.add('hidden');
    miniBtn.classList.remove('hidden');
  }

  function _restore() {
    if (!_current) return;
    // Re-render so a video that was paused mid-frame comes back clean.
    _renderInto(contentEl, _current);
    popup.classList.remove('hidden');
    miniBtn.classList.add('hidden');
  }

  function close() {
    _current = null;
    contentEl.innerHTML = '';
    metaEl.innerHTML = '';
    popup.classList.add('hidden');
    miniBtn.classList.add('hidden');
  }

  function isOpen() {
    return !popup.classList.contains('hidden') || !miniBtn.classList.contains('hidden');
  }

  async function _save() {
    if (!_current) return;
    if (_current.mediaType === 'video') {
      // SAVE button is hidden for videos — this branch is unreachable through
      // the UI but retained as a defensive no-op in case some code path still
      // calls _save() while a video is showing. Videos play inline in the
      // iframe; there is deliberately no external-window fallback here.
      return;
    }
    saveBtn.disabled = true;
    const prevLabel = saveBtn.textContent;
    saveBtn.textContent = '⏳ SAVING…';
    try {
      const filenameStem = (_current.primary.title || _current.query || 'image')
        .replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
      const res = await window.claudeAPI.saveImage(_current.primary.imageUrl, filenameStem);
      if (res && res.success) {
        saveBtn.textContent = '✓ SAVED';
        _showToast('Saved to ' + res.path);
        setTimeout(() => { saveBtn.textContent = prevLabel; }, 1500);
      } else if (res && res.canceled) {
        saveBtn.textContent = prevLabel;
      } else {
        saveBtn.textContent = '✕ ERR';
        _showToast('Save failed: ' + ((res && res.error) || 'unknown'));
        setTimeout(() => { saveBtn.textContent = prevLabel; }, 1800);
      }
    } catch (err) {
      saveBtn.textContent = '✕ ERR';
      _showToast('Save failed: ' + err.message);
      setTimeout(() => { saveBtn.textContent = prevLabel; }, 1800);
    } finally {
      saveBtn.disabled = false;
    }
  }

  function _showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3200);
  }

  function init() {
    saveBtn.addEventListener('click', _save);
    hideBtn.addEventListener('click', hide);
    closeBtn.addEventListener('click', close);
    miniBtn.addEventListener('click', _restore);

    // Escape while the full popup is visible → HIDE (not close, so the content
    // stays available). Escape while mini is visible → close it.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!popup.classList.contains('hidden')) { e.preventDefault(); hide(); }
      else if (!miniBtn.classList.contains('hidden')) { e.preventDefault(); close(); }
    });

    // Clicking anywhere on the popup (including the backdrop) does NOTHING.
    // Users must click HIDE, CLOSE, or press Escape explicitly. This avoids
    // the "click makes another popup appear" confusion where an accidental
    // backdrop click was hiding the frame and showing the mini chip.
  }

  return { init, show, hide, close, isOpen };
})();
