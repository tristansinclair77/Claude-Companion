/**
 * Debug Viewer — renderer script
 * Handles slot selection, exchange navigation, and rendering debug session data.
 */
(function () {
  'use strict';

  // ── Emotion map (matches companion-display.js) ────────────────────────────
  const EMOTIONS = {
    neutral:         { emoji: '😐', color: '#888888' },
    happy:           { emoji: '😊', color: '#ffdd00' },
    soft_smile:      { emoji: '🙂', color: '#ffcc44' },
    laughing:        { emoji: '😄', color: '#ff9900' },
    confident:       { emoji: '😎', color: '#00ccff' },
    smug:            { emoji: '😏', color: '#aa44ff' },
    surprised:       { emoji: '😮', color: '#ffaa00' },
    shocked:         { emoji: '😱', color: '#ff4444' },
    confused:        { emoji: '😕', color: '#aa8800' },
    thinking:        { emoji: '🤔', color: '#4488ff' },
    concerned:       { emoji: '😟', color: '#ff8844' },
    sad:             { emoji: '😢', color: '#4488bb' },
    angry:           { emoji: '😠', color: '#ff2222' },
    determined:      { emoji: '💪', color: '#ff6600' },
    embarrassed:     { emoji: '😳', color: '#ff88aa' },
    exhausted:       { emoji: '😴', color: '#666688' },
    pout:            { emoji: '😤', color: '#dd6600' },
    crying:          { emoji: '😭', color: '#6688cc' },
    lustful_desire:  { emoji: '😍', color: '#ff44aa' },
  };

  // Source badge color map
  const SOURCE_COLORS = {
    FILLER: '#00cc44',
    LOCAL:  '#ff8800',
    CLAUDE: '#00ffcc',
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let slots = [];            // available slot metadata
  let activeSlot = null;     // currently loaded slot number
  let exchanges = [];        // parsed exchanges for active session
  let currentIndex = -1;     // which exchange we're on (0-based)

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const slotBtns        = document.querySelectorAll('.slot-btn');
  const pinnedBtnsEl    = document.getElementById('pinned-btns');
  const pinnedSep       = document.getElementById('pinned-sep');
  const pinnedLabel     = document.getElementById('pinned-label');
  const btnPrev         = document.getElementById('btn-prev');
  const btnNext         = document.getElementById('btn-next');
  const btnSysPrompt    = document.getElementById('btn-sysprompt');
  const btnPin          = document.getElementById('btn-pin');
  const btnSaveSession  = document.getElementById('btn-save-session');
  const btnExtractMem   = document.getElementById('btn-extract-mem');
  const counterCur      = document.getElementById('counter-current');
  const counterTotal  = document.getElementById('counter-total');
  const navTimestamp  = document.getElementById('nav-timestamp');
  const navSourceBadge = document.getElementById('nav-source-badge');

  const dialogueEl    = document.getElementById('dialogue-text');
  const thoughtsEl    = document.getElementById('thoughts-text');
  const emotionBadgeEl = document.getElementById('emotion-badge');
  const portraitEl    = document.getElementById('companion-portrait');
  const memorySection = document.getElementById('memory-section');
  const memoryList    = document.getElementById('memory-list');

  const debugUserText      = document.getElementById('debug-user-text');
  const debugStatusTime    = document.getElementById('debug-status-time');
  const debugStatusEmotion = document.getElementById('debug-status-emotion');
  const memIndicator       = document.getElementById('mem-indicator');

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    bindWindowControls();
    bindNavigation();
    bindKeyboard();
    await loadSlotList();
    // Auto-load slot 1 if available
    const s1 = slots.find(s => s.slot === 1);
    if (s1) loadSlot(1);
  }

  // ── Window controls ───────────────────────────────────────────────────────
  function bindWindowControls() {
    document.getElementById('btn-minimize').addEventListener('click', () => window.debugAPI.minimize());
    document.getElementById('btn-maximize').addEventListener('click', () => window.debugAPI.maximize());
    document.getElementById('btn-close').addEventListener('click',    () => window.debugAPI.close());
    btnSysPrompt.addEventListener('click', openSysPrompt);
    btnPin.addEventListener('click', pinCurrentSlot);
    btnSaveSession.addEventListener('click', saveCurrentSession);
    btnExtractMem.addEventListener('click', extractCurrentSessionMemories);
  }

  // ── Slot management ───────────────────────────────────────────────────────
  async function loadSlotList() {
    const result = await window.debugAPI.listSlots();
    if (!result.success) { console.error('[DebugViewer] listSlots failed:', result.error); return; }
    slots = result.slots;

    // Update rolling slot buttons (1-5)
    slotBtns.forEach(btn => {
      const n = parseInt(btn.dataset.slot);
      const meta = slots.find(s => s.slot === n && !s.pinned);
      if (meta) {
        btn.classList.remove('empty');
        const dt = meta.startedAt ? new Date(meta.startedAt) : null;
        btn.title = dt ? formatDatetime(dt) : `Slot ${n}`;
        btn.addEventListener('click', () => loadDir(meta.dirName, btn));
      } else {
        btn.classList.add('empty');
        btn.title = 'Empty';
      }
    });

    // Render pinned session buttons dynamically
    const pinned = slots.filter(s => s.pinned);
    pinnedBtnsEl.innerHTML = '';
    if (pinned.length > 0) {
      pinnedSep.style.display = '';
      pinnedLabel.style.display = '';
      pinned.forEach(meta => {
        const btn = document.createElement('button');
        btn.className = 'slot-btn';
        btn.style.color = '#aa44ff';
        btn.style.borderColor = '#aa44ff44';
        btn.textContent = meta.dirName.replace('saved-', 'S');
        const dt = meta.startedAt ? new Date(meta.startedAt) : null;
        btn.title = (dt ? formatDatetime(dt) : meta.dirName) + ' (pinned)';
        btn.addEventListener('click', () => loadDir(meta.dirName, btn));
        pinnedBtnsEl.appendChild(btn);
      });
    } else {
      pinnedSep.style.display = 'none';
      pinnedLabel.style.display = 'none';
    }
  }

  // activeDirName tracks which directory is loaded (slot or pinned)
  let activeDirName = null;

  async function loadDir(dirName, clickedBtn) {
    const result = await window.debugAPI.loadSession(dirName);
    if (!result.success) { console.error('[DebugViewer] loadSession failed:', result.error); return; }

    activeDirName = dirName;
    // Determine activeSlot (for pin/save ops) — null if pinned
    const meta = slots.find(s => s.dirName === dirName);
    activeSlot = (meta && !meta.pinned) ? meta.slot : null;

    exchanges = result.exchanges;
    currentIndex = exchanges.length > 0 ? 0 : -1;

    // Clear active state on all buttons then set on clicked
    slotBtns.forEach(b => b.classList.remove('active'));
    pinnedBtnsEl.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
    if (clickedBtn) clickedBtn.classList.add('active');

    counterTotal.textContent = exchanges.length || '0';
    renderExchange();

    const hasData = exchanges.length > 0;
    btnSaveSession.disabled = !hasData;
    btnSaveSession.style.opacity = hasData ? '1' : '0.4';
    btnExtractMem.disabled = !hasData;
    btnExtractMem.style.opacity = hasData ? '1' : '0.4';
    // PIN only available for rolling slots (not already-pinned sessions)
    const isPinnable = hasData && activeSlot !== null;
    btnPin.disabled = !isPinnable;
    btnPin.style.opacity = isPinnable ? '1' : '0.4';
    btnPin.style.color = isPinnable ? '#aa44ff' : '#664488';
  }

  async function loadSlot(n) {
    const meta = slots.find(s => s.slot === n && !s.pinned);
    if (!meta) return;
    const btn = document.getElementById(`slot-btn-${n}`);
    await loadDir(meta.dirName, btn);
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function bindNavigation() {
    btnPrev.addEventListener('click', () => navigate(-1));
    btnNext.addEventListener('click', () => navigate(+1));
  }

  function navigate(delta) {
    if (exchanges.length === 0) return;
    const next = currentIndex + delta;
    if (next < 0 || next >= exchanges.length) return;
    currentIndex = next;
    renderExchange();
  }

  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { navigate(-1); return; }
      if (e.key === 'ArrowRight') { navigate(+1); return; }
      // Slot shortcuts: 1-5
      if (e.key >= '1' && e.key <= '5') {
        const n = parseInt(e.key);
        const meta = slots.find(s => s.slot === n);
        if (meta) loadSlot(n);
      }
    });
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  function renderExchange() {
    updateNavButtons();

    if (currentIndex < 0 || exchanges.length === 0) {
      showEmpty();
      return;
    }

    const ex = exchanges[currentIndex];
    counterCur.textContent = currentIndex + 1;

    renderResponse(ex);
    renderUserMessage(ex);
    renderMeta(ex);
    renderMemories(ex);
    enableSysPromptBtn(ex);
  }

  function renderResponse(ex) {
    const resp = ex.claudeResponse;

    if (!resp) {
      dialogueEl.textContent = '— no response recorded —';
      thoughtsEl.textContent = '';
      emotionBadgeEl.textContent = '';
      emotionBadgeEl.style.color = '';
      emotionBadgeEl.style.borderColor = '';
      portraitEl.src = '';
      return;
    }

    // Dialogue
    dialogueEl.textContent = resp.dialogue || resp.raw || '—';

    // Thoughts
    thoughtsEl.textContent = resp.thoughts || '';

    // Emotion badge + portrait
    const emotionId = resp.emotion || 'neutral';
    const emo = EMOTIONS[emotionId] || EMOTIONS.neutral;
    emotionBadgeEl.textContent = `${emo.emoji} ${emotionId.replace(/_/g, ' ')}`;
    emotionBadgeEl.style.color = emo.color;
    emotionBadgeEl.style.borderColor = emo.color + '66';
    emotionBadgeEl.style.textShadow = `0 0 6px ${emo.color}88`;
    portraitEl.src = `../../characters/default/emotions/${emotionId}.png`;
    portraitEl.onerror = () => { portraitEl.src = ''; };
  }

  function renderUserMessage(ex) {
    const um = ex.userMessage;
    if (!um) {
      debugUserText.textContent = '—';
      debugStatusEmotion.style.display = 'none';
      return;
    }

    debugUserText.textContent = um.message || '—';

    // User emotion
    if (um.emotion && um.emotion !== 'neutral') {
      const emo = EMOTIONS[um.emotion] || null;
      if (emo) {
        debugStatusEmotion.textContent = `${emo.emoji} ${um.emotion.replace(/_/g, ' ')}`;
        debugStatusEmotion.style.color = emo.color;
        debugStatusEmotion.style.borderColor = emo.color + '66';
        debugStatusEmotion.style.display = '';
      }
    } else {
      debugStatusEmotion.style.display = 'none';
    }
  }

  function renderMeta(ex) {
    // Timestamp from user_message event
    const ev = ex.userMessage || ex.claudeResponse;
    if (ev && ev.t) {
      debugStatusTime.textContent = formatDatetime(new Date(ev.t));
      navTimestamp.textContent = formatTime(new Date(ev.t));
    } else {
      debugStatusTime.textContent = '—';
      navTimestamp.textContent = '—';
    }

    // Source badge
    const resp = ex.claudeResponse;
    const source = resp ? (resp.source || detectSource(resp)) : null;
    if (source) {
      const color = SOURCE_COLORS[source] || SOURCE_COLORS.CLAUDE;
      navSourceBadge.textContent = `${source} ●`;
      navSourceBadge.style.color = color;
      navSourceBadge.style.textShadow = `0 0 6px ${color}`;
    } else {
      navSourceBadge.textContent = '';
    }
  }

  function renderMemories(ex) {
    const resp = ex.claudeResponse;
    if (!resp) {
      memorySection.classList.add('empty');
      memoryList.innerHTML = '';
      memIndicator.style.display = 'none';
      return;
    }

    // All three memory types live on claude_response
    const userMems   = resp.memoriesExtracted      || [];
    const updates    = resp.memoryUpdatesExtracted  || [];
    const selfFacts  = resp.selfFactsExtracted      || [];

    if (userMems.length === 0 && updates.length === 0 && selfFacts.length === 0) {
      memorySection.classList.add('empty');
      memoryList.innerHTML = '';
      memIndicator.style.display = 'none';
      return;
    }
    memIndicator.style.display = '';

    memorySection.classList.remove('empty');
    memoryList.innerHTML = '';

    const addChip = (mem, typeLabel, color) => {
      const chip = document.createElement('div');
      chip.className = 'memory-chip';
      chip.style.borderLeftColor = color;
      chip.style.color = color;
      chip.style.background = color + '0a';
      const cat = mem.category || '';
      const content = mem.content || mem.fact || JSON.stringify(mem);
      const typeSpan = `<span class="mem-type" style="color:#335544;font-size:9px;margin-right:4px;">${typeLabel}</span>`;
      const catSpan  = cat ? `<span class="mem-cat">[${escapeHtml(cat)}]</span>` : '';
      chip.innerHTML = typeSpan + catSpan + escapeHtml(content);
      memoryList.appendChild(chip);
    };

    for (const m of userMems)  addChip(m, 'USER',   '#00ff88');
    for (const m of updates)   addChip(m, 'UPDATE', '#ffdd00');
    for (const m of selfFacts) addChip(m, 'SELF',   '#aa44ff');
  }

  function enableSysPromptBtn(ex) {
    const hasPrompt = ex.claudeCall && ex.claudeCall.systemPrompt;
    btnSysPrompt.disabled = !hasPrompt;
  }

  function showEmpty() {
    counterCur.textContent = '—';
    counterTotal.textContent = '—';
    navTimestamp.textContent = '—';
    navSourceBadge.textContent = '';
    dialogueEl.innerHTML = `<div id="empty-state">
      <span class="empty-icon">◈</span>
      <span>SELECT A SLOT TO BEGIN</span>
    </div>`;
    thoughtsEl.textContent = '';
    emotionBadgeEl.textContent = '';
    debugUserText.textContent = '—';
    debugStatusTime.textContent = '—';
    debugStatusEmotion.style.display = 'none';
    memorySection.classList.add('empty');
    memIndicator.style.display = 'none';
    btnSysPrompt.disabled = true;
  }

  function updateNavButtons() {
    btnPrev.disabled = currentIndex <= 0;
    btnNext.disabled = currentIndex >= exchanges.length - 1;
  }

  // ── System prompt pop-out ─────────────────────────────────────────────────
  function openSysPrompt() {
    const ex = exchanges[currentIndex];
    if (!ex || !ex.claudeCall || !ex.claudeCall.systemPrompt) return;
    window.debugAPI.openSysPrompt(ex.claudeCall.systemPrompt);
  }

  // ── Session Actions ───────────────────────────────────────────────────────

  async function saveCurrentSession() {
    if (activeSlot == null) return;
    btnSaveSession.disabled = true;
    btnSaveSession.textContent = 'SAVING...';
    try {
      const result = await window.debugAPI.saveSlotToMemory(activeSlot);
      if (result.success) {
        showNavToast(`Saved! ${result.messageCount} messages summarized.`);
      } else {
        showNavToast(`Save failed: ${result.error}`);
      }
    } catch (err) {
      showNavToast(`Error: ${err.message}`);
    } finally {
      btnSaveSession.disabled = false;
      btnSaveSession.textContent = 'SAVE SESSION';
    }
  }

  async function pinCurrentSlot() {
    if (activeSlot == null) return;
    btnPin.disabled = true;
    btnPin.textContent = 'PINNING...';
    try {
      const result = await window.debugAPI.pinSlot(activeSlot);
      if (result.success) {
        showNavToast(`Pinned as ${result.name} — safe from rotation.`);
        await loadSlotList(); // refresh to show new pinned button
      } else {
        showNavToast(`Pin failed: ${result.error}`);
      }
    } catch (err) {
      showNavToast(`Error: ${err.message}`);
    } finally {
      btnPin.textContent = '📌 PIN';
      // Re-evaluate disabled state based on current selection
      btnPin.disabled = activeSlot === null;
    }
  }

  async function extractCurrentSessionMemories() {
    if (!activeDirName) return;
    const opts = activeSlot !== null ? { slot: activeSlot } : { dirName: activeDirName };
    await runExtractMemories(opts, btnExtractMem);
  }

  async function runExtractMemories(opts, btn) {
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'EXTRACTING...';
    try {
      const result = await window.debugAPI.extractMemories(opts);
      showExtractResult(result);
    } catch (err) {
      showExtractResult({ success: false, error: err.message });
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  function showExtractResult(result) {
    let html = '';
    if (!result.success) {
      html = `<div style="color:#ff4444;font-size:12px;padding:12px;">[ERROR] ${escapeHtml(result.error || 'Unknown error')}</div>`;
    } else {
      const mems     = result.memories  || [];
      const selfs    = result.selfFacts || [];
      const total    = mems.length + selfs.length;

      html += `<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #00ff8822;">`;
      html += `<div style="font-size:11px;letter-spacing:2px;color:#00ff88;margin-bottom:4px;">EXTRACTION COMPLETE</div>`;
      html += `<div style="font-size:10px;color:#335544;">${total} items added to knowledge.db &nbsp;|&nbsp; `;
      html += `${mems.length} user facts &nbsp;|&nbsp; ${selfs.length} Aria self-facts</div>`;
      html += `</div>`;

      if (mems.length > 0) {
        html += `<div style="font-size:10px;letter-spacing:2px;color:#00ff88;margin-bottom:8px;">// USER_MEMORIES</div>`;
        for (const m of mems) {
          html += `<div style="margin-bottom:8px;border-left:2px solid #00ff88;padding-left:8px;background:#00ff880a;">`;
          html += `<div style="font-size:9px;color:#335544;letter-spacing:1px;">[${escapeHtml(m.category || '?')}]</div>`;
          html += `<div style="color:#00cc66;font-size:12px;line-height:1.5;">${escapeHtml(m.content || '')}</div>`;
          html += `</div>`;
        }
      }

      if (selfs.length > 0) {
        html += `<div style="font-size:10px;letter-spacing:2px;color:#aa44ff;margin-bottom:8px;margin-top:${mems.length ? 14 : 0}px;">// ARIA_SELF_FACTS</div>`;
        for (const s of selfs) {
          html += `<div style="margin-bottom:8px;border-left:2px solid #aa44ff;padding-left:8px;background:#aa44ff0a;">`;
          html += `<div style="font-size:9px;color:#664488;letter-spacing:1px;">[${escapeHtml(s.category || '?')}]</div>`;
          html += `<div style="color:#cc88ff;font-size:12px;line-height:1.5;">${escapeHtml(s.content || '')}</div>`;
          html += `</div>`;
        }
      }

      if (total === 0) {
        html += `<div style="color:#335544;font-size:11px;letter-spacing:1px;">No new memories were extracted from this session.</div>`;
      }
    }

    showResultPopup('// EXTRACT_RESULT', html);
  }

  function showResultPopup(title, bodyHtml) {
    // Build a self-contained HTML page and pass via openSysPrompt mechanism.
    // We repurpose the same pop-out channel but embed full HTML.
    const fullHtml = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;background:#0a0a0f;color:#00ffcc;font-family:'Courier New',monospace;font-size:12px;overflow:hidden;}
  #titlebar{height:32px;background:#0d0d16;border-bottom:1px solid #00ff8833;display:flex;align-items:center;justify-content:space-between;padding:0 10px;-webkit-app-region:drag;flex-shrink:0;}
  #titlebar span{font-size:11px;letter-spacing:3px;color:#00ffcc;text-shadow:0 0 8px #00ffcc;}
  #close-btn{-webkit-app-region:no-drag;background:none;border:1px solid #ff224433;color:#ff224488;width:24px;height:20px;cursor:pointer;font-size:10px;font-family:'Courier New',monospace;}
  #close-btn:hover{background:#ff2244;color:#fff;}
  #content{height:calc(100% - 32px);overflow-y:auto;padding:14px 16px;line-height:1.6;scrollbar-width:thin;scrollbar-color:#007755 transparent;}
  .crt{position:fixed;inset:0;pointer-events:none;z-index:9999;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px);}
</style>
</head><body>
<div class="crt"></div>
<div id="titlebar">
  <span>${title.replace(/</g,'&lt;')}</span>
  <button id="close-btn">✕</button>
</div>
<div id="content">${bodyHtml}</div>
<script>
  document.getElementById('close-btn').addEventListener('click', () => {
    if(window.syspromptAPI) window.syspromptAPI.close();
    else window.close();
  });
</script>
</body></html>`;

    window.debugAPI.openExtractResult(fullHtml);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  function formatDatetime(dt) {
    return dt.toLocaleString('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).replace(',', '');
  }

  function formatTime(dt) {
    return dt.toLocaleTimeString('en-GB', { hour12: false });
  }

  function detectSource(resp) {
    // Heuristic if source field missing
    if (!resp) return null;
    if (resp.source) return resp.source.toUpperCase();
    // raw field presence suggests it came from Claude CLI
    if (resp.raw) return 'CLAUDE';
    return null;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Saved Conversations ───────────────────────────────────────────────────

  const savedOverlay    = document.getElementById('saved-overlay');
  const savedList       = document.getElementById('saved-list');
  const savedTranscript = document.getElementById('saved-transcript');
  const btnSaved        = document.getElementById('btn-saved');
  const btnSavedBack    = document.getElementById('btn-saved-back');

  function bindSaved() {
    btnSaved.addEventListener('click', openSavedPanel);
    btnSavedBack.addEventListener('click', closeSavedPanel);
  }

  async function openSavedPanel() {
    savedOverlay.style.display = 'flex';
    savedList.innerHTML = '<div style="padding:12px;color:#335544;font-size:10px;letter-spacing:2px;">LOADING...</div>';
    savedTranscript.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#335544;letter-spacing:2px;font-size:11px;">SELECT A SAVED CONVERSATION</div>';
    try {
      const result = await window.debugAPI.listSavedConversations();
      renderSavedList(result.conversations || []);
    } catch (err) {
      savedList.innerHTML = `<div style="padding:12px;color:#ff4444;font-size:10px;">${escapeHtml(err.message)}</div>`;
    }
  }

  function closeSavedPanel() {
    savedOverlay.style.display = 'none';
  }

  function renderSavedList(conversations) {
    savedList.innerHTML = '';
    if (!conversations.length) {
      savedList.innerHTML = '<div style="padding:12px;color:#335544;font-size:10px;letter-spacing:1px;">NO SAVED CONVERSATIONS</div>';
      return;
    }
    for (const conv of conversations) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:10px 12px;border-bottom:1px solid #aa44ff11;transition:background 0.1s;';
      const date = conv.ended_at ? formatDatetime(new Date(conv.ended_at)) : '—';
      const preview = (conv.summary || '').slice(0, 80);
      item.innerHTML =
        `<div style="font-size:10px;color:#aa44ff;letter-spacing:1px;margin-bottom:3px;cursor:pointer;" class="saved-item-header">${escapeHtml(date)}</div>` +
        `<div style="font-size:11px;color:var(--cyan-dim);line-height:1.4;cursor:pointer;" class="saved-item-header">${escapeHtml(preview)}${conv.summary && conv.summary.length > 80 ? '…' : ''}</div>` +
        `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:5px;">` +
        `<span style="font-size:9px;color:#335544;">${conv.message_count || 0} messages</span>` +
        `<button class="extract-saved-btn" style="background:none;border:1px solid #00ff8833;color:#007733;font-family:var(--font-mono);font-size:9px;letter-spacing:1px;padding:1px 6px;cursor:pointer;" title="Re-scan and extract memories from this conversation">EXTRACT MEM</button>` +
        `</div>`;
      item.addEventListener('mouseenter', () => { item.style.background = '#aa44ff0a'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.querySelectorAll('.saved-item-header').forEach(el => {
        el.addEventListener('click', () => loadSavedConversation(conv.id));
      });
      const extractBtn = item.querySelector('.extract-saved-btn');
      extractBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        runExtractMemories({ savedId: conv.id }, extractBtn);
      });
      savedList.appendChild(item);
    }
  }

  async function loadSavedConversation(id) {
    savedTranscript.innerHTML = '<div style="color:#335544;letter-spacing:2px;font-size:10px;padding:12px;">LOADING...</div>';
    try {
      const result = await window.debugAPI.loadSavedConversation(id);
      if (!result.success) throw new Error(result.error);
      renderSavedTranscript(result);
    } catch (err) {
      savedTranscript.innerHTML = `<div style="color:#ff4444;font-size:11px;padding:12px;">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderSavedTranscript(data) {
    const messages = data.messages || [];
    const date = data.savedAt ? formatDatetime(new Date(data.savedAt)) : '—';
    let html = `<div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #aa44ff22;">`;
    html += `<div style="font-size:10px;color:#aa44ff;letter-spacing:2px;margin-bottom:6px;">SAVED ${escapeHtml(date)}</div>`;
    if (data.summary) {
      html += `<div style="font-size:11px;color:#335544;line-height:1.6;font-style:italic;">${escapeHtml(data.summary)}</div>`;
    }
    html += `</div>`;
    for (const msg of messages) {
      const isUser = msg.role === 'user';
      const color  = isUser ? 'var(--cyan)' : '#aa44ff';
      const label  = isUser ? 'USER' : 'ARIA';
      html += `<div style="margin-bottom:14px;">`;
      html += `<div style="font-size:9px;letter-spacing:2px;color:${color};margin-bottom:3px;">${label}</div>`;
      html += `<div style="color:${isUser ? 'var(--cyan-dim)' : '#cc88ff'};line-height:1.6;">${escapeHtml(msg.content)}</div>`;
      html += `</div>`;
    }
    if (!messages.length) {
      html += `<div style="color:#335544;font-size:10px;letter-spacing:1px;">NO MESSAGES RECORDED</div>`;
    }
    savedTranscript.innerHTML = html;
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  init();
  bindSaved();
})();
