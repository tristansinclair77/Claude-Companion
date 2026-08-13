'use strict';
// Companion Authoring UI — the banner that shows what the companion is
// currently building in Story / Adventure mode, plus the confirmation prompt
// when she wants to replace a campaign that's already in progress.
//
// Story planning is a multi-minute background job (one Claude call per stage),
// so the user needs a persistent, cancellable indicator — a transient toast
// would leave them wondering whether anything is happening at all.
//
// See docs/COMPANION_AUTHORING.md.

const CompanionAuthoringUI = (() => {
  let bar, titleEl, labelEl, cancelBtn, dismissBtn;
  let confirmBox, confirmTextEl, confirmYes, confirmNo;
  let _pendingAdventureId = null;
  let _idleHideTimer = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    bar         = $('authoring-banner');
    if (!bar) return;
    titleEl     = $('authoring-banner-title');
    labelEl     = $('authoring-banner-label');
    cancelBtn   = $('authoring-banner-cancel');
    dismissBtn  = $('authoring-banner-dismiss');
    confirmBox    = $('authoring-confirm');
    confirmTextEl = $('authoring-confirm-text');
    confirmYes    = $('authoring-confirm-yes');
    confirmNo     = $('authoring-confirm-no');

    cancelBtn?.addEventListener('click', async () => {
      cancelBtn.disabled = true;
      labelEl.textContent = 'Stopping after the current stage…';
      try { await window.authoringAPI.cancel(); } catch {}
    });
    dismissBtn?.addEventListener('click', () => _hide());

    confirmYes?.addEventListener('click', () => _resolveAdventure(true));
    confirmNo?.addEventListener('click',  () => _resolveAdventure(false));

    if (!window.authoringAPI) return;

    // Restore state on load — a plan may still be running from before a
    // renderer reload (the job lives in the main process).
    window.authoringAPI.status().then((st) => _applyStatus(st)).catch(() => {});
    window.authoringAPI.onEvent(_onEvent);
  }

  function _show({ title, label, showCancel = false, tone = 'work' }) {
    if (!bar) return;
    clearTimeout(_idleHideTimer);
    bar.classList.remove('hidden', 'tone-work', 'tone-done', 'tone-error');
    bar.classList.add('tone-' + tone);
    titleEl.textContent = title || '';
    labelEl.textContent = label || '';
    cancelBtn.classList.toggle('hidden', !showCancel);
    cancelBtn.disabled = false;
  }

  function _hide() {
    if (!bar) return;
    clearTimeout(_idleHideTimer);
    bar.classList.add('hidden');
  }

  function _autoHide(ms) {
    clearTimeout(_idleHideTimer);
    _idleHideTimer = setTimeout(_hide, ms);
  }

  function _applyStatus(st) {
    if (!st) return;
    if (st.pendingAdventure) {
      _promptAdventure({
        id: st.pendingAdventure.id,
        tone: st.pendingAdventure.tone,
        setting: st.pendingAdventure.setting,
        existing: null,
      });
    }
    if (st.running) {
      const queued = (st.queued && st.queued.length) ? ` · ${st.queued.length} queued` : '';
      _show({
        title: `Building “${st.running.title}”${queued}`,
        label: st.running.label || 'Planning…',
        showCancel: true,
      });
    } else if (!st.pendingAdventure) {
      _hide();
    }
  }

  function _onEvent(ev) {
    if (!ev || !bar) return;
    const st = ev.status || null;

    switch (ev.kind) {
      case 'story-created':
        _show({
          title: `New story: “${ev.title}”`,
          label: 'Created. Planning is queued…',
          showCancel: true,
        });
        break;

      case 'plan-start':
        _show({ title: `Building “${ev.title}”`, label: 'Starting…', showCancel: true });
        break;

      case 'plan-progress': {
        const queued = (st && st.queued && st.queued.length) ? ` · ${st.queued.length} queued` : '';
        _show({
          title: `Building “${ev.title}”${queued}`,
          label: `${ev.label || 'Working…'}  (stage ${ev.calls || 0})`,
          showCancel: true,
        });
        break;
      }

      case 'plan-done': {
        const warn = (ev.warnings && ev.warnings.length) ? ` — ${ev.warnings.length} stage(s) had problems` : '';
        if (ev.cancelled) {
          _show({ title: `Stopped building “${ev.title}”`, label: 'Cancelled. Open it in Story mode and use REGEN PLAN to finish.', tone: 'error' });
        } else if (ev.aborted) {
          _show({ title: `“${ev.title}” is partly planned`, label: `Stopped early${warn}. Open it in Story mode and use REGEN PLAN to finish.`, tone: 'error' });
        } else {
          _show({ title: `“${ev.title}” is ready`, label: `Planned and waiting in Story mode${warn}.`, tone: 'done' });
          _autoHide(60000);
        }
        _refreshStoryLibrary();
        break;
      }

      case 'story-failed':
        _show({ title: `Could not build “${ev.title || 'story'}”`, label: ev.error || 'Unknown error.', tone: 'error' });
        break;

      case 'story-updated':
        _show({ title: `“${ev.title}” updated`, label: (ev.changed || []).join(', '), tone: 'done' });
        _autoHide(12000);
        _refreshStoryLibrary();
        break;

      case 'story-nudged':
        _show({ title: `Note queued for “${ev.title}”`, label: ev.nudge || '', tone: 'done' });
        _autoHide(12000);
        break;

      case 'adventure-proposed':
        _promptAdventure(ev);
        break;

      case 'adventure-created':
        _show({ title: 'New campaign set up', label: `Tone: ${ev.tone}. Open Adventure mode to begin.`, tone: 'done' });
        _autoHide(30000);
        break;

      case 'adventure-declined':
        _hide();
        break;

      case 'notices':
        // Only surface notices when nothing more specific is on screen —
        // the kind-specific branches above are more informative.
        if (bar.classList.contains('hidden') && ev.notices && ev.notices.length) {
          _show({ title: 'Workshop', label: ev.notices[0], tone: 'done' });
          _autoHide(15000);
        }
        break;

      case 'status':
        _applyStatus(st);
        break;
    }
  }

  // ── Replace-my-campaign confirmation ────────────────────────────────────
  function _promptAdventure(ev) {
    if (!confirmBox) return;
    _pendingAdventureId = ev.id || null;
    const existing = ev.existing;
    const lines = [];
    lines.push('Your companion designed a new adventure campaign.');
    if (existing && existing.turnCount) {
      lines.push(`Starting it will REPLACE your current campaign (${existing.tone || 'unknown tone'}, ${existing.turnCount} turns in${existing.scene ? `, at “${existing.scene}”` : ''}). That cannot be undone.`);
    } else {
      lines.push('Starting it will replace whatever is currently in the adventure slot.');
    }
    if (ev.tone)    lines.push(`New tone: ${ev.tone}`);
    if (ev.setting) lines.push(`Setting: ${ev.setting}`);
    confirmTextEl.textContent = lines.join('\n');
    confirmBox.classList.remove('hidden');
  }

  async function _resolveAdventure(approved) {
    const id = _pendingAdventureId;
    _pendingAdventureId = null;
    confirmBox.classList.add('hidden');
    try {
      const res = await window.authoringAPI.resolveAdventure(id, approved);
      if (res && res.approved) {
        _show({ title: 'New campaign set up', label: 'Open Adventure mode to begin.', tone: 'done' });
        _autoHide(30000);
      }
    } catch (err) {
      _show({ title: 'Could not start the campaign', label: err.message || String(err), tone: 'error' });
    }
  }

  // Ask the Story module to re-read the library so a companion-made story
  // appears without an app restart. No-op when Story mode hasn't been opened.
  function _refreshStoryLibrary() {
    try {
      if (typeof TextStory !== 'undefined' && typeof TextStory.notifyExternalChange === 'function') {
        TextStory.notifyExternalChange();
      }
    } catch {}
  }

  return { init };
})();
