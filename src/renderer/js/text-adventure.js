// Text Adventure renderer module.
// Owns the #text-adventure DOM, the CRT terminal, HUD, drawer, overlays,
// and the side-chat panel. Talks to main via window.adventureAPI.

const TextAdventure = (function () {
  const TONES = [
    { id: 'classic_high_fantasy',  label: 'CLASSIC HIGH FANTASY',
      blurb: 'Elves, knights, dungeons, ancient evils. Pure D&D.' },
    { id: 'dark_gothic_horror',    label: 'DARK GOTHIC HORROR',
      blurb: 'Cursed lands, undead, blood-soaked rituals. Heavy dread.' },
    { id: 'sword_and_sorcery',     label: 'SWORD & SORCERY',
      blurb: 'Lone wanderer, decadent cities, morally grey schemes.' },
    { id: 'comedic_dungeon',       label: 'COMEDIC DUNGEON',
      blurb: 'Pratchett-flavored — danger with a wink. Aria has a field day.' },
    { id: 'mythic_norse',          label: 'MYTHIC NORSE',
      blurb: 'Frost giants, runes, dying gods, fate-bound oaths.' },
    { id: 'arabian_arcane',        label: 'ARABIAN ARCANE',
      blurb: 'Djinn, sand-cities, lamp-bound wishes, ancient bazaars.' },
    { id: 'eldritch_weird',        label: 'ELDRITCH WEIRD',
      blurb: 'Things that should not exist. Sanity is a resource.' },
    { id: 'surprise_me',           label: 'SURPRISE ME',
      blurb: "Claude picks a tone you haven't seen yet." },
  ];

  const DRAWER_TABS = [
    { id: 'inventory', label: 'INV' },
    { id: 'equipment', label: 'EQUIP' },
    { id: 'spells',    label: 'SPELLS' },
    { id: 'stats',     label: 'STATS' },
    { id: 'aria',      label: 'ARIA', cls: 'aria' },
    { id: 'story',     label: 'STORY' },
    { id: 'memory',    label: 'WORLD' },
  ];

  // ── DOM refs ─────────────────────────────────────────────────────────────
  let root;
  let scrollEl;
  let inputEl;
  let sendBtn;
  let hudSceneEl, hudTimeEl;
  let pHpBar, pHpText, pMpBar, pMpText, pXpBar, pLvlText;
  let aHpBar, aHpText, aMpBar, aMpText, aLvlText;
  let enemyPanel, enemySpriteEl, enemyNameEl, enemyHpBar, enemyHpText, enemyDescEl;
  let overlayNewGame, overlayDeath, overlaySideChat, drawer;
  let toneGrid, settingInput, startBtn;
  let deathCauseEl, btnNewGameFromDeath, btnExitFromDeath;
  let drawerTabs, drawerSections;
  let scScroll, scInput, scSendBtn, scResumeBtn, scClearBtn;
  let unsubscribeUpdate = null;

  let _selectedTone = TONES[0].id;
  let _activeState = null;
  let _busy = false;
  let _sideChatBusy = false;
  let _drawerActiveTab = 'inventory';
  let _savedChatEmotion = null;   // Aria's portrait emotion before adventure mode took over

  // ── Typewriter settings + queue ─────────────────────────────────────────
  let _typewriterOn  = true;
  let _typeCps       = 80;
  let _skipOnClick   = true;
  // Queue of pending typewriter jobs: { el, text, idx, timer }
  let _typeQueue     = [];
  let _typing        = null;   // currently animating job

  function setTypeSettings(s) {
    if (!s) return;
    if (typeof s.typewriter  === 'boolean') _typewriterOn = s.typewriter;
    if (typeof s.typeCps     === 'number')  _typeCps      = Math.max(10, Math.min(800, s.typeCps));
    if (typeof s.skipOnClick === 'boolean') _skipOnClick  = s.skipOnClick;
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    root = document.getElementById('text-adventure');
    if (!root) return;
    _renderShell();
    _wireEvents();
    // Pull persisted display settings (typewriter speed etc.)
    if (window.adventureAPI && typeof window.adventureAPI.getDisplaySettings === 'function') {
      window.adventureAPI.getDisplaySettings().then(setTypeSettings).catch(() => {});
    }
  }

  function toggle() {
    if (document.body.classList.contains('adventure-mode')) {
      _exit();
    } else {
      _enter();
    }
  }

  async function _enter() {
    // Snapshot Aria's current chat-mode portrait so we can restore it on exit.
    if (window.CompanionDisplay && typeof window.CompanionDisplay.getCurrentEmotion === 'function') {
      _savedChatEmotion = window.CompanionDisplay.getCurrentEmotion();
    }
    document.body.classList.add('adventure-mode');
    root.classList.remove('hidden');
    // Switch the full app to the Adventure Terminal visual package
    if (window.BackgroundSettings?.switchPackageTemporary) {
      window.BackgroundSettings.switchPackageTemporary('adventure_terminal');
    }
    if (!unsubscribeUpdate) {
      unsubscribeUpdate = window.adventureAPI.onUpdate(_handleUpdate);
    }
    try {
      const { state, log, resumeCue } = await window.adventureAPI.getState();
      if (!state) {
        _showNewGameOverlay();
        return;
      }
      _activeState = state;
      _renderHud(state);
      _renderEnemy(state.enemy);
      _renderLog(log || []);
      if (!state.alive) _showDeathOverlay(state.deathCause || 'You have fallen.', state.deathOf);
      else _hideOverlays();
      // Resume the last-known music cue if there is one — gives a returning
      // run an immediate soundtrack instead of waiting for the next [MUSIC].
      if (resumeCue && resumeCue.ok && window.MusicPlayer && !state.deathOf) {
        window.MusicPlayer.playCue(resumeCue);
      }
      _focusInput();
    } catch (e) {
      console.error('[TextAdventure] enter failed:', e);
    }
  }

  function _exit() {
    document.body.classList.remove('adventure-mode');
    root.classList.add('hidden');
    // Restore the user's normal visual package
    if (window.BackgroundSettings?.restorePackageAfterTemporary) {
      window.BackgroundSettings.restorePackageAfterTemporary();
    }
    if (drawer) drawer.classList.remove('open');
    _hideSideChat();
    // Adventure music belongs to adventure mode — stop on exit so it doesn't
    // bleed into normal chat.
    if (window.MusicPlayer) window.MusicPlayer.stop();
    // Restore Aria's pre-adventure portrait so chat mode looks like itself again.
    if (_savedChatEmotion && window.CompanionDisplay && typeof window.CompanionDisplay.setEmotion === 'function') {
      window.CompanionDisplay.setEmotion(_savedChatEmotion);
    }
  }

  // ── Shell DOM ────────────────────────────────────────────────────────────
  function _renderShell() {
    root.innerHTML = `
      <div class="ta-hud">
        <div class="ta-hud-row">
          <div class="ta-hud-scene" id="ta-scene-name">— SCENE —</div>
          <div class="ta-hud-time" id="ta-time-label" title="In-world time">Day 1 — Morning</div>
          <div class="ta-music-badge" id="ta-music-badge" title="Now playing — click to pause/resume">♫ —</div>
          <div class="ta-hud-actions">
            <button class="ta-hud-btn aria" id="ta-btn-sidechat">TALK TO ARIA</button>
            <button class="ta-hud-btn" data-drawer="inventory">INV</button>
            <button class="ta-hud-btn" data-drawer="equipment">EQUIP</button>
            <button class="ta-hud-btn" data-drawer="spells">SPELLS</button>
            <button class="ta-hud-btn" data-drawer="stats">STATS</button>
            <button class="ta-hud-btn aria" data-drawer="aria">ARIA</button>
            <button class="ta-hud-btn" data-drawer="story">STORY</button>
            <button class="ta-hud-btn" data-drawer="memory">WORLD</button>
            <button class="ta-hud-btn warn" id="ta-btn-reset">RESET</button>
            <button class="ta-hud-btn" id="ta-btn-exit">EXIT</button>
          </div>
        </div>
        <div class="ta-hud-row">
          <span class="ta-hud-name player">TRIST</span>
          <span class="ta-hud-stat" title="Trist HP">HP <div class="ta-hud-bar"><span id="ta-p-hp" style="transform: scaleX(1)"></span></div><span id="ta-p-hp-t">0/0</span></span>
          <span class="ta-hud-stat" title="Trist MP">MP <div class="ta-hud-bar mp"><span id="ta-p-mp" style="transform: scaleX(1)"></span></div><span id="ta-p-mp-t">0/0</span></span>
          <span class="ta-hud-stat" title="Trist XP">LV <span id="ta-p-lvl">1</span><div class="ta-hud-bar xp"><span id="ta-p-xp" style="transform: scaleX(0)"></span></div></span>
        </div>
        <div class="ta-hud-row">
          <span class="ta-hud-name aria">ARIA</span>
          <span class="ta-hud-stat" title="Aria HP">HP <div class="ta-hud-bar"><span id="ta-a-hp" style="transform: scaleX(1)"></span></div><span id="ta-a-hp-t">0/0</span></span>
          <span class="ta-hud-stat" title="Aria MP">MP <div class="ta-hud-bar mp"><span id="ta-a-mp" style="transform: scaleX(1)"></span></div><span id="ta-a-mp-t">0/0</span></span>
          <span class="ta-hud-stat" title="Aria level">LV <span id="ta-a-lvl">1</span></span>
        </div>
      </div>

      <div class="ta-body">
        <div class="ta-scroll" id="ta-scroll"></div>
        <div class="ta-enemy hidden" id="ta-enemy">
          <div class="ta-enemy-label">// HOSTILE</div>
          <img class="ta-enemy-sprite" id="ta-enemy-sprite" src="" alt="" />
          <div class="ta-enemy-name"  id="ta-enemy-name"></div>
          <div class="ta-enemy-hp"><span id="ta-enemy-hp-fill" style="transform: scaleX(1)"></span></div>
          <div class="ta-enemy-hp-text" id="ta-enemy-hp-text"></div>
          <div class="ta-enemy-desc" id="ta-enemy-desc"></div>
        </div>
      </div>

      <div class="ta-input-row">
        <span class="ta-prompt">&gt;</span>
        <input class="ta-input" id="ta-input" type="text" maxlength="500" spellcheck="false"
               placeholder="What do you do?" />
        <button class="ta-send" id="ta-send">SEND</button>
      </div>

      <!-- New game overlay -->
      <div class="ta-overlay hidden" id="ta-overlay-new">
        <h2>// NEW ADVENTURE</h2>
        <p>Game basics — stats, inventory, levels — are always the same.<br/>
           Pick a tone, optionally describe your own setting, and begin.</p>
        <div class="ta-tone-grid" id="ta-tone-grid"></div>
        <textarea class="ta-setting-input" id="ta-setting-input"
                  placeholder="Optional: describe your setting in your own words (e.g. 'an abandoned space station orbiting a dying sun')"></textarea>
        <div class="ta-overlay-actions">
          <button class="ta-overlay-btn" id="ta-start-btn">BEGIN ADVENTURE</button>
          <button class="ta-overlay-btn" id="ta-cancel-new">EXIT TO CHAT</button>
        </div>
      </div>

      <!-- Death overlay -->
      <div class="ta-overlay death hidden" id="ta-overlay-death">
        <h2>YOU DIED</h2>
        <p id="ta-death-cause">—</p>
        <p style="opacity:0.65">The adventure ends here. Start a new one or return to chat.</p>
        <div class="ta-overlay-actions">
          <button class="ta-overlay-btn" id="ta-newgame-from-death">NEW GAME</button>
          <button class="ta-overlay-btn danger" id="ta-exit-from-death">EXIT TO CHAT</button>
        </div>
      </div>

      <!-- Side-chat overlay -->
      <div class="ta-overlay side-chat hidden" id="ta-overlay-sidechat">
        <div class="ta-sc-header">
          <span class="ta-sc-title">// SIDE-CHAT WITH ARIA</span>
          <span class="ta-sc-paused">STORY PAUSED</span>
          <button class="ta-sc-clear"  id="ta-sc-clear" title="Wipe side-chat history">CLEAR</button>
          <button class="ta-sc-resume" id="ta-sc-resume">RESUME STORY</button>
        </div>
        <div class="ta-sc-scroll" id="ta-sc-scroll"></div>
        <div class="ta-sc-input-row">
          <textarea class="ta-sc-input" id="ta-sc-input" rows="2" maxlength="1000"
                    placeholder="Talk to Aria — the story holds where it is..."></textarea>
          <button class="ta-sc-send" id="ta-sc-send">SEND</button>
        </div>
      </div>

      <!-- Drawer -->
      <div class="ta-drawer" id="ta-drawer">
        <div class="ta-drawer-tabs" id="ta-drawer-tabs"></div>
        <div class="ta-drawer-section" id="ta-drawer-section"></div>
        <button class="ta-drawer-close" id="ta-drawer-close">CLOSE</button>
      </div>
    `;

    // Cache refs
    scrollEl     = root.querySelector('#ta-scroll');
    inputEl      = root.querySelector('#ta-input');
    sendBtn      = root.querySelector('#ta-send');
    hudSceneEl   = root.querySelector('#ta-scene-name');
    hudTimeEl    = root.querySelector('#ta-time-label');

    pHpBar  = root.querySelector('#ta-p-hp');  pHpText = root.querySelector('#ta-p-hp-t');
    pMpBar  = root.querySelector('#ta-p-mp');  pMpText = root.querySelector('#ta-p-mp-t');
    pXpBar  = root.querySelector('#ta-p-xp');  pLvlText = root.querySelector('#ta-p-lvl');
    aHpBar  = root.querySelector('#ta-a-hp');  aHpText = root.querySelector('#ta-a-hp-t');
    aMpBar  = root.querySelector('#ta-a-mp');  aMpText = root.querySelector('#ta-a-mp-t');
    aLvlText = root.querySelector('#ta-a-lvl');

    enemyPanel   = root.querySelector('#ta-enemy');
    enemySpriteEl= root.querySelector('#ta-enemy-sprite');
    enemyNameEl  = root.querySelector('#ta-enemy-name');
    enemyHpBar   = root.querySelector('#ta-enemy-hp-fill');
    enemyHpText  = root.querySelector('#ta-enemy-hp-text');
    enemyDescEl  = root.querySelector('#ta-enemy-desc');

    overlayNewGame  = root.querySelector('#ta-overlay-new');
    overlayDeath    = root.querySelector('#ta-overlay-death');
    overlaySideChat = root.querySelector('#ta-overlay-sidechat');
    drawer       = root.querySelector('#ta-drawer');
    toneGrid     = root.querySelector('#ta-tone-grid');
    settingInput = root.querySelector('#ta-setting-input');
    startBtn     = root.querySelector('#ta-start-btn');
    deathCauseEl       = root.querySelector('#ta-death-cause');
    btnNewGameFromDeath = root.querySelector('#ta-newgame-from-death');
    btnExitFromDeath    = root.querySelector('#ta-exit-from-death');
    drawerTabs   = root.querySelector('#ta-drawer-tabs');
    drawerSections = root.querySelector('#ta-drawer-section');
    scScroll     = root.querySelector('#ta-sc-scroll');
    scInput      = root.querySelector('#ta-sc-input');
    scSendBtn    = root.querySelector('#ta-sc-send');
    scResumeBtn  = root.querySelector('#ta-sc-resume');
    scClearBtn   = root.querySelector('#ta-sc-clear');

    _renderToneGrid();
    _renderDrawerTabs();
  }

  function _renderToneGrid() {
    toneGrid.innerHTML = '';
    for (const t of TONES) {
      const btn = document.createElement('button');
      btn.className = 'ta-tone-btn' + (t.id === _selectedTone ? ' selected' : '');
      btn.dataset.tone = t.id;
      btn.innerHTML = `${t.label}<small>${t.blurb}</small>`;
      btn.addEventListener('click', () => {
        _selectedTone = t.id;
        for (const b of toneGrid.querySelectorAll('.ta-tone-btn')) {
          b.classList.toggle('selected', b.dataset.tone === t.id);
        }
      });
      toneGrid.appendChild(btn);
    }
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  function _renderDrawerTabs() {
    drawerTabs.innerHTML = '';
    for (const t of DRAWER_TABS) {
      const b = document.createElement('button');
      b.className = 'ta-drawer-tab' + (t.cls ? ' ' + t.cls : '') + (t.id === _drawerActiveTab ? ' active' : '');
      b.dataset.tab = t.id;
      b.textContent = t.label;
      b.addEventListener('click', () => _selectDrawerTab(t.id));
      drawerTabs.appendChild(b);
    }
  }

  function _selectDrawerTab(id) {
    _drawerActiveTab = id;
    for (const x of drawerTabs.querySelectorAll('.ta-drawer-tab')) {
      x.classList.toggle('active', x.dataset.tab === id);
    }
    _renderDrawerContent();
  }

  function _renderDrawerContent() {
    if (!_activeState) {
      drawerSections.innerHTML = '<div class="ta-list-empty">// no game in progress</div>';
      return;
    }
    const state = _activeState;
    const p = state.player;
    if (_drawerActiveTab === 'inventory') {
      _renderInventoryDrawer(p.inventory || [], p.equipment || {});
    } else if (_drawerActiveTab === 'equipment') {
      _renderEquipmentDrawer(p.equipment || {});
    } else if (_drawerActiveTab === 'spells') {
      _renderSpellsDrawer(p.spells || [], p.abilities || []);
    } else if (_drawerActiveTab === 'stats') {
      _renderStatsDrawer(p, 'TRIST');
    } else if (_drawerActiveTab === 'aria') {
      _renderAriaDrawer(state.aria || {});
    } else if (_drawerActiveTab === 'story') {
      _renderStoryDrawer(state.memory || {});
    } else if (_drawerActiveTab === 'memory') {
      _renderWorldDrawer(state.memory || {});
    }
  }

  function _renderInventoryDrawer(inv, equipment) {
    if (!inv.length) {
      drawerSections.innerHTML = '<div class="ta-list-empty">// inventory empty</div>';
      return;
    }
    const equippedIds = new Set(
      Object.values(equipment || {}).filter(Boolean).map((x) => (x.id || x.name || '').toLowerCase())
    );
    drawerSections.innerHTML = inv.map((it) => {
      const key = ((it.id || it.name) || '').toLowerCase();
      const isEq = equippedIds.has(key);
      const qty = (typeof it.qty === 'number' && it.qty > 1) ? ` <span class="qty">×${it.qty}</span>` : '';
      const desc = it.desc ? `<div class="desc">${_escape(it.desc)}</div>` : '';
      return `<div class="ta-list-row ${isEq ? 'equipped' : ''}">
        <span class="name">${_escape(it.name || it.id)}</span>${qty}
        ${desc}
      </div>`;
    }).join('');
  }

  function _renderEquipmentDrawer(eq) {
    const slots = ['weapon','offhand','head','body','feet','accessory'];
    drawerSections.innerHTML = slots.map((slot) => {
      const item = eq[slot];
      const text = item ? _escape(item.name || item.id) : '— empty —';
      const cls  = item ? '' : 'empty';
      return `<div class="ta-equip-slot">
        <span class="slot-name">${slot.toUpperCase()}</span>
        <span class="slot-item ${cls}">${text}</span>
      </div>`;
    }).join('');
  }

  function _renderSpellsDrawer(spells, abilities) {
    let html = '';
    if (spells.length) {
      html += '<div class="ta-section-title">// SPELLS</div>';
      html += spells.map((s) => `<div class="ta-list-row">
        <span class="name">${_escape(s.name || s.id)}</span>
        ${typeof s.cost === 'number' ? `<span class="qty">${s.cost} MP</span>` : ''}
        ${s.desc ? `<div class="desc">${_escape(s.desc)}</div>` : ''}
      </div>`).join('');
    }
    if (abilities.length) {
      html += '<div class="ta-section-title">// ABILITIES</div>';
      html += abilities.map((a) => `<div class="ta-list-row">
        <span class="name">${_escape(a.name || a.id)}</span>
        ${a.desc ? `<div class="desc">${_escape(a.desc)}</div>` : ''}
      </div>`).join('');
    }
    if (!html) html = '<div class="ta-list-empty">// no spells or abilities known</div>';
    drawerSections.innerHTML = html;
  }

  function _renderStatsDrawer(p, label) {
    const buffs    = (p.buffs    || []).map((b) => `<div class="ta-list-row"><span class="name">+ ${_escape(b.name || b.id)}</span><span class="qty">${b.turnsRemaining ?? '∞'}t</span>${b.effect ? `<div class="desc">${_escape(b.effect)}</div>` : ''}</div>`).join('');
    const debuffs  = (p.debuffs  || []).map((b) => `<div class="ta-list-row" style="color:#ffaabb"><span class="name">− ${_escape(b.name || b.id)}</span><span class="qty">${b.turnsRemaining ?? '∞'}t</span>${b.effect ? `<div class="desc">${_escape(b.effect)}</div>` : ''}</div>`).join('');
    drawerSections.innerHTML = `
      <div class="ta-section-title">// ${label || 'STATS'}</div>
      <div class="ta-stat-row"><span class="label">LEVEL</span><span class="val">${p.level || 1}</span></div>
      <div class="ta-stat-row"><span class="label">XP</span><span class="val">${p.xp ?? 0} / ${p.xpToNext ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">HP</span><span class="val">${p.hp ?? 0} / ${p.maxHp ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">MP</span><span class="val">${p.mp ?? 0} / ${p.maxMp ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">GOLD</span><span class="val">${p.gold ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">STR</span><span class="val">${p.str ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">DEX</span><span class="val">${p.dex ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">INT</span><span class="val">${p.int ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">WIS</span><span class="val">${p.wis ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">CON</span><span class="val">${p.con ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">LUCK</span><span class="val">${p.luck ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">HEALTH</span><span class="val ${p.illness ? 'illness-yes' : ''}">${p.illness ? _escape(p.illness) : 'healthy'}</span></div>
      ${buffs   ? '<div class="ta-section-title">// BUFFS</div>'   + buffs   : ''}
      ${debuffs ? '<div class="ta-section-title pink">// DEBUFFS</div>' + debuffs : ''}
    `;
  }

  function _renderAriaDrawer(aria) {
    if (!aria || !aria.name) {
      drawerSections.innerHTML = '<div class="ta-list-empty">// Aria not present</div>';
      return;
    }
    // Reuse the stats block, then append her inventory/spells.
    const equipment = aria.equipment || {};
    const equippedIds = new Set(
      Object.values(equipment).filter(Boolean).map((x) => (x.id || x.name || '').toLowerCase())
    );
    const slots = ['weapon','offhand','head','body','feet','accessory'];
    const equipHtml = slots.map((slot) => {
      const item = equipment[slot];
      const text = item ? _escape(item.name || item.id) : '— empty —';
      const cls  = item ? '' : 'empty';
      return `<div class="ta-equip-slot">
        <span class="slot-name">${slot.toUpperCase()}</span>
        <span class="slot-item ${cls}">${text}</span>
      </div>`;
    }).join('');
    const invHtml = (aria.inventory || []).map((it) => {
      const key = ((it.id || it.name) || '').toLowerCase();
      const isEq = equippedIds.has(key);
      const qty = (typeof it.qty === 'number' && it.qty > 1) ? ` <span class="qty">×${it.qty}</span>` : '';
      const desc = it.desc ? `<div class="desc">${_escape(it.desc)}</div>` : '';
      return `<div class="ta-list-row ${isEq ? 'equipped' : ''}">
        <span class="name">${_escape(it.name || it.id)}</span>${qty}${desc}
      </div>`;
    }).join('') || '<div class="ta-list-empty">// nothing carried</div>';
    const spellsHtml = (aria.spells || []).map((s) => `<div class="ta-list-row">
      <span class="name">${_escape(s.name || s.id)}</span>
      ${typeof s.cost === 'number' ? `<span class="qty">${s.cost} MP</span>` : ''}
      ${s.desc ? `<div class="desc">${_escape(s.desc)}</div>` : ''}
    </div>`).join('') || '<div class="ta-list-empty">// no spells known</div>';

    drawerSections.innerHTML = `
      <div class="ta-section-title pink">// ARIA — STATS</div>
      <div class="ta-stat-row"><span class="label">LEVEL</span><span class="val">${aria.level || 1}</span></div>
      <div class="ta-stat-row"><span class="label">XP</span><span class="val">${aria.xp ?? 0} / ${aria.xpToNext ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">HP</span><span class="val">${aria.hp ?? 0} / ${aria.maxHp ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">MP</span><span class="val">${aria.mp ?? 0} / ${aria.maxMp ?? 0}</span></div>
      <div class="ta-stat-row"><span class="label">STR / DEX / INT</span><span class="val">${aria.str}/${aria.dex}/${aria.int}</span></div>
      <div class="ta-stat-row"><span class="label">WIS / CON / LUCK</span><span class="val">${aria.wis}/${aria.con}/${aria.luck}</span></div>
      <div class="ta-stat-row"><span class="label">HEALTH</span><span class="val ${aria.illness ? 'illness-yes' : ''}">${aria.illness ? _escape(aria.illness) : 'healthy'}</span></div>
      <div class="ta-section-title pink">// EQUIPMENT</div>
      ${equipHtml}
      <div class="ta-section-title pink">// INVENTORY</div>
      ${invHtml}
      <div class="ta-section-title pink">// SPELLS</div>
      ${spellsHtml}
    `;
  }

  function _renderStoryDrawer(memory) {
    const summary = memory.storySummary || '';
    const events  = memory.events || [];
    const cur     = memory.currentSituation || '';
    const goal    = memory.immediateGoal    || '';
    drawerSections.innerHTML = `
      <div class="ta-section-title">// STORY SO FAR</div>
      ${summary
        ? `<div class="ta-story-summary">${_escape(summary)}</div>`
        : '<div class="ta-story-empty">— Claude will write a recap as the story develops —</div>'
      }
      <div class="ta-section-title gold">// RIGHT NOW</div>
      <div class="ta-list-row">
        ${cur  ? `<div class="desc"><span style="color:#ffea88">Where:</span> ${_escape(cur)}</div>`  : ''}
        ${goal ? `<div class="desc"><span style="color:#ffea88">Goal:</span>  ${_escape(goal)}</div>` : ''}
        ${!cur && !goal ? '<span class="ta-list-empty">// unknown</span>' : ''}
      </div>
      <div class="ta-section-title">// EVENT LOG</div>
      ${events.length
        ? events.slice().reverse().map((e) =>
            `<div class="ta-list-row"><span class="qty">turn ${e.turn ?? '?'}</span> ${_escape(e.desc || '')}</div>`
          ).join('')
        : '<div class="ta-list-empty">// no events recorded yet</div>'
      }
    `;
  }

  function _renderWorldDrawer(memory) {
    const npcs      = memory.npcs      || [];
    const locations = memory.locations || [];
    const quests    = memory.quests    || [];
    const lore      = memory.lore      || [];
    drawerSections.innerHTML = `
      <div class="ta-section-title">// NPCS</div>
      ${npcs.length
        ? npcs.map((n) => `<div class="ta-list-row">
            <span class="name">${_escape(n.name || n.id)}</span>
            ${n.status ? `<span class="qty">${_escape(n.status)}</span>` : ''}
            ${n.location ? `<div class="desc"><span style="color:#ffea88">at:</span> ${_escape(n.location)}</div>` : ''}
            ${n.desc ? `<div class="desc">${_escape(n.desc)}</div>` : ''}
            ${n.notes ? `<div class="desc" style="opacity:0.6">${_escape(n.notes)}</div>` : ''}
          </div>`).join('')
        : '<div class="ta-list-empty">// no NPCs met yet</div>'
      }
      <div class="ta-section-title">// LOCATIONS</div>
      ${locations.length
        ? locations.map((l) => `<div class="ta-list-row">
            <span class="name">${_escape(l.name || l.id)}</span>
            ${l.desc ? `<div class="desc">${_escape(l.desc)}</div>` : ''}
            ${l.notable ? `<div class="desc" style="opacity:0.6">${_escape(l.notable)}</div>` : ''}
          </div>`).join('')
        : '<div class="ta-list-empty">// no places visited yet</div>'
      }
      <div class="ta-section-title">// QUESTS</div>
      ${quests.length
        ? quests.map((q) => {
            const statusCls = q.status === 'done' ? 'color:#66ff8b'
                            : q.status === 'failed' ? 'color:#ff5577'
                            : 'color:#ffea88';
            return `<div class="ta-list-row">
              <span class="name">${_escape(q.name || q.id)}</span>
              <span class="qty" style="${statusCls}">[${_escape(q.status || 'active')}]</span>
              ${q.desc ? `<div class="desc">${_escape(q.desc)}</div>` : ''}
              ${q.notes ? `<div class="desc" style="opacity:0.6">${_escape(q.notes)}</div>` : ''}
            </div>`;
          }).join('')
        : '<div class="ta-list-empty">// no quests yet</div>'
      }
      <div class="ta-section-title">// LORE</div>
      ${lore.length
        ? lore.map((s) => `<div class="ta-list-row">${_escape(s)}</div>`).join('')
        : '<div class="ta-list-empty">// no lore learned yet</div>'
      }
    `;
  }

  // ── Events ───────────────────────────────────────────────────────────────
  function _wireEvents() {
    sendBtn.addEventListener('click', _submitAction);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _submitAction();
      }
    });

    root.querySelector('#ta-btn-exit').addEventListener('click', _exit);
    document.getElementById('btn-adventure-exit')?.addEventListener('click', _exit);
    root.querySelector('#ta-btn-reset').addEventListener('click', _confirmReset);
    root.querySelector('#ta-btn-sidechat').addEventListener('click', _openSideChat);

    // Click in the terminal scroll area while typewriter is animating →
    // finish all in-progress + queued jobs instantly. Ignore clicks on the
    // enemy panel / HUD.
    scrollEl.addEventListener('click', () => {
      if (!_skipOnClick) return;
      if (_typing || _typeQueue.length > 0) _typeFinishAll();
    });

    // Music badge — click toggles pause/resume; updates from MusicPlayer events.
    const musicBadge = root.querySelector('#ta-music-badge');
    musicBadge.addEventListener('click', () => {
      const np = window.MusicPlayer && window.MusicPlayer.getNowPlaying();
      if (!np) return;
      if (np.paused) window.MusicPlayer.resume(); else window.MusicPlayer.pause();
    });
    document.addEventListener('music:now-playing', (e) => {
      const np = e.detail;
      if (!np) {
        musicBadge.textContent = '♫ —';
        musicBadge.classList.remove('playing', 'paused');
      } else if (np.paused) {
        musicBadge.textContent = `♫ ${np.name} (paused)`;
        musicBadge.classList.remove('playing');
        musicBadge.classList.add('paused');
      } else {
        musicBadge.textContent = `♫ ${np.name} [#${np.bibleId}]`;
        musicBadge.classList.remove('paused');
        musicBadge.classList.add('playing');
        console.log(`♫ now playing: ${np.name} [#${np.bibleId}] — ${(np.mood||[]).join('+')} / ${np.energy} (var ${np.variant})`);
      }
    });

    for (const btn of root.querySelectorAll('.ta-hud-btn[data-drawer]')) {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.drawer;
        _selectDrawerTab(tab);
        drawer.classList.toggle('open');
      });
    }
    root.querySelector('#ta-drawer-close').addEventListener('click', () => drawer.classList.remove('open'));

    startBtn.addEventListener('click', _startNewGame);
    root.querySelector('#ta-cancel-new').addEventListener('click', _exit);

    btnNewGameFromDeath.addEventListener('click', async () => {
      await window.adventureAPI.resetGame();
      _activeState = null;
      _renderLog([]);
      _showNewGameOverlay();
    });
    btnExitFromDeath.addEventListener('click', _exit);

    // Side-chat events
    scSendBtn.addEventListener('click', _sideChatSend);
    scInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _sideChatSend();
      }
    });
    scResumeBtn.addEventListener('click', _hideSideChat);
    scClearBtn.addEventListener('click', async () => {
      if (!confirm('Clear the side-chat history?\nThis does not affect the adventure.')) return;
      await window.adventureAPI.sideChatClear();
      _renderSideChat([]);
    });
  }

  async function _startNewGame() {
    const tone = _selectedTone;
    const setting = settingInput.value.trim();
    try {
      const { state } = await window.adventureAPI.newGame({ tone, setting });
      _activeState = state;
      _hideOverlays();
      _renderHud(state);
      _renderEnemy(state.enemy);
      _renderLog([]);
      _addEntry('system', 'GAME START — ' + tone.toUpperCase());
      _busy = true;
      sendBtn.disabled = true;
      _addThinkingEntry();
      await window.adventureAPI.takeAction(
        '(BEGIN ADVENTURE — set the opening scene, introduce Aria as my party member, and describe where we are)'
      );
    } catch (e) {
      console.error('[TextAdventure] start failed:', e);
      _busy = false;
      sendBtn.disabled = false;
      _removeThinkingEntry();
    }
  }

  async function _confirmReset() {
    if (!confirm('Reset the current adventure?\nAll progress, memory, and side-chat will be wiped.')) return;
    await window.adventureAPI.resetGame();
    _activeState = null;
    _renderLog([]);
    _hideOverlays();
    _showNewGameOverlay();
  }

  async function _submitAction() {
    if (_busy) return;
    const text = inputEl.value.trim();
    if (!text) return;
    if (!_activeState) { _showNewGameOverlay(); return; }
    if (!_activeState.alive) {
      _showDeathOverlay(_activeState.deathCause || 'You have fallen.', _activeState.deathOf);
      return;
    }
    inputEl.value = '';
    _addEntry('action', text);
    _busy = true;
    sendBtn.disabled = true;
    _addThinkingEntry();
    try {
      await window.adventureAPI.takeAction(text);
    } catch (e) {
      console.error('[TextAdventure] action failed:', e);
      _removeThinkingEntry();
      _addEntry('system', 'ERROR — ' + (e.message || 'unknown'));
      _busy = false;
      sendBtn.disabled = false;
      _focusInput();
    }
  }

  // ── Update handler ───────────────────────────────────────────────────────
  function _handleUpdate(payload) {
    _removeThinkingEntry();
    _busy = false;
    sendBtn.disabled = false;
    if (!payload) return;
    const { state, turnResponse } = payload;
    _activeState = state;

    if (turnResponse) {
      if (turnResponse.narrator) _addEntryAnimated('narrator', turnResponse.narrator);
      if (turnResponse.aria)     _addEntryAnimated('aria', turnResponse.aria.dialogue);
      // Portrait reflects Aria's in-story emotional state this turn — driven
      // by the parser's portraitEmotion which prefers meta-comment (emotion)
      // over standalone [ARIA_EMOTION] when both are present.
      const pe = turnResponse.portraitEmotion
              || (turnResponse.aria && turnResponse.aria.emotion);
      if (pe && window.CompanionDisplay && typeof window.CompanionDisplay.setEmotion === 'function') {
        window.CompanionDisplay.setEmotion(pe);
      }
    }

    _renderHud(state);
    _renderEnemy(state.enemy);
    if (drawer.classList.contains('open')) _renderDrawerContent();

    if (!state.alive) {
      _showDeathOverlay(state.deathCause || 'You have fallen.', state.deathOf);
    } else {
      _focusInput();
    }
  }

  // ── HUD / enemy renders ──────────────────────────────────────────────────
  function _setBar(bar, frac) {
    if (!bar) return;
    bar.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
  }
  function _renderHud(state) {
    if (!state) return;
    const p = state.player;
    const a = state.aria || {};
    hudSceneEl.textContent = state.scene && state.scene.name ? state.scene.name : '— SCENE —';
    if (hudTimeEl) {
      const t = state.time || {};
      hudTimeEl.textContent = t.label || (t.dayCount && t.phase ? `Day ${t.dayCount} — ${t.phase}` : '');
    }

    _setBar(pHpBar, p.maxHp > 0 ? p.hp / p.maxHp : 0);
    _setBar(pMpBar, p.maxMp > 0 ? p.mp / p.maxMp : 0);
    _setBar(pXpBar, p.xpToNext > 0 ? p.xp / p.xpToNext : 0);
    pHpText.textContent = `${p.hp}/${p.maxHp}`;
    pMpText.textContent = `${p.mp}/${p.maxMp}`;
    pLvlText.textContent = String(p.level);

    _setBar(aHpBar, a.maxHp > 0 ? a.hp / a.maxHp : 0);
    _setBar(aMpBar, a.maxMp > 0 ? a.mp / a.maxMp : 0);
    aHpText.textContent = `${a.hp ?? 0}/${a.maxHp ?? 0}`;
    aMpText.textContent = `${a.mp ?? 0}/${a.maxMp ?? 0}`;
    aLvlText.textContent = String(a.level ?? 1);
  }

  function _renderEnemy(enemy) {
    if (!enemy) {
      enemyPanel.classList.add('hidden');
      enemySpriteEl.src = '';
      return;
    }
    enemyPanel.classList.remove('hidden');
    const slug = (enemy.slug || enemy.id || '').toLowerCase().replace(/\s+/g, '_');
    if (slug) {
      enemySpriteEl.src = `../../assets/monsters/${slug}.png`;
      enemySpriteEl.onerror = () => { enemySpriteEl.src = ''; };
    } else {
      enemySpriteEl.src = '';
    }
    enemyNameEl.textContent = enemy.name || slug || '???';
    const maxHp = enemy.maxHp ?? enemy.hp ?? 1;
    _setBar(enemyHpBar, maxHp > 0 ? (enemy.hp ?? 0) / maxHp : 1);
    enemyHpText.textContent = `${enemy.hp ?? 0}/${maxHp} HP`;
    enemyDescEl.textContent = enemy.desc || '';
  }

  // ── Log / scroll ─────────────────────────────────────────────────────────
  function _renderLog(log) {
    scrollEl.innerHTML = '';
    for (const e of log) _appendEntryDom(e.kind, e.text);
    _scrollToBottom();
  }

  function _addEntry(kind, text) {
    _appendEntryDom(kind, text);
    _scrollToBottom();
  }

  function _appendEntryDom(kind, text) {
    const div = document.createElement('div');
    div.className = 'ta-entry ' + (kind || 'narrator');
    div.textContent = text;
    scrollEl.appendChild(div);
  }

  // Typewriter-animated entry. Appends an empty div first then types into it
  // at _typeCps characters/second. Queues subsequent calls so they appear in
  // order. A click in the terminal area finishes the current job instantly.
  function _addEntryAnimated(kind, text) {
    if (!_typewriterOn || !text) {
      _addEntry(kind, text);
      return;
    }
    const div = document.createElement('div');
    div.className = 'ta-entry ' + (kind || 'narrator') + ' ta-typing';
    div.textContent = '';
    scrollEl.appendChild(div);
    _scrollToBottom();
    _typeQueue.push({ el: div, text, idx: 0, timer: null });
    if (!_typing) _typeStartNext();
  }

  function _typeStartNext() {
    _typing = _typeQueue.shift() || null;
    if (!_typing) return;
    _typeTick();
  }

  function _typeTick() {
    if (!_typing) return;
    const job = _typing;
    const msPerChar = Math.max(1, Math.round(1000 / Math.max(10, _typeCps)));
    // Burst-write so very high cps doesn't cripple the setTimeout loop:
    // characters per tick = ceil(burst). We always tick every ~10ms minimum.
    const burst = Math.max(1, Math.round(10 / msPerChar));
    const delay = Math.max(10, msPerChar * burst);
    const advance = () => {
      if (!_typing || _typing !== job) return;
      job.idx = Math.min(job.text.length, job.idx + burst);
      job.el.textContent = job.text.slice(0, job.idx);
      _scrollToBottomSoft();
      if (job.idx >= job.text.length) {
        job.el.classList.remove('ta-typing');
        _typing = null;
        _typeStartNext();
        return;
      }
      job.timer = setTimeout(advance, delay);
    };
    job.timer = setTimeout(advance, delay);
  }

  function _typeFinishAll() {
    if (_typing) {
      if (_typing.timer) { clearTimeout(_typing.timer); _typing.timer = null; }
      _typing.el.textContent = _typing.text;
      _typing.el.classList.remove('ta-typing');
      _typing = null;
    }
    for (const job of _typeQueue) {
      if (job.timer) clearTimeout(job.timer);
      job.el.textContent = job.text;
      job.el.classList.remove('ta-typing');
    }
    _typeQueue = [];
    _scrollToBottom();
  }

  // Soft scroll — only scroll if the user hasn't manually scrolled up.
  function _scrollToBottomSoft() {
    const nearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 60;
    if (nearBottom) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  let _thinkingEl = null;
  function _addThinkingEntry() {
    _removeThinkingEntry();
    _thinkingEl = document.createElement('div');
    _thinkingEl.className = 'ta-entry ta-thinking';
    _thinkingEl.textContent = '... rolling the dice ...';
    scrollEl.appendChild(_thinkingEl);
    _scrollToBottom();
  }
  function _removeThinkingEntry() {
    if (_thinkingEl && _thinkingEl.parentNode) _thinkingEl.parentNode.removeChild(_thinkingEl);
    _thinkingEl = null;
  }

  function _scrollToBottom() {
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  // ── Overlays ─────────────────────────────────────────────────────────────
  function _showNewGameOverlay() {
    overlayDeath.classList.add('hidden');
    overlaySideChat.classList.add('hidden');
    overlayNewGame.classList.remove('hidden');
    settingInput.value = '';
    setTimeout(() => settingInput.focus(), 80);
  }
  function _showDeathOverlay(cause, who) {
    overlayNewGame.classList.add('hidden');
    overlaySideChat.classList.add('hidden');
    const prefix = who === 'aria' ? 'Aria has fallen — ' : (who === 'player' ? 'You have fallen — ' : '');
    deathCauseEl.textContent = prefix + cause;
    overlayDeath.classList.remove('hidden');
  }
  function _hideOverlays() {
    overlayNewGame.classList.add('hidden');
    overlayDeath.classList.add('hidden');
    overlaySideChat.classList.add('hidden');
  }

  // ── Side chat ────────────────────────────────────────────────────────────
  async function _openSideChat() {
    if (!_activeState) {
      _showNewGameOverlay();
      return;
    }
    overlayNewGame.classList.add('hidden');
    overlayDeath.classList.add('hidden');
    overlaySideChat.classList.remove('hidden');
    try {
      const { history } = await window.adventureAPI.sideChatHistory();
      _renderSideChat(history || []);
    } catch (e) {
      console.warn('[TextAdventure] side-chat history failed:', e);
      _renderSideChat([]);
    }
    setTimeout(() => scInput && scInput.focus(), 60);
  }

  function _hideSideChat() {
    overlaySideChat.classList.add('hidden');
    _focusInput();
  }

  function _renderSideChat(history) {
    scScroll.innerHTML = '';
    if (!history.length) {
      scScroll.innerHTML = '<div class="ta-sc-empty">// No side-chat yet. Say something — the story will hold.</div>';
      return;
    }
    for (const m of history) _appendSideChatMsg(m);
    _scScrollToBottom();
  }
  function _appendSideChatMsg(m) {
    const div = document.createElement('div');
    div.className = 'ta-sc-msg ' + (m.role === 'companion' ? 'aria' : 'user');
    const main = document.createElement('div');
    main.textContent = m.content || '';
    div.appendChild(main);
    if (m.role === 'companion' && m.thoughts) {
      const th = document.createElement('span');
      th.className = 'thoughts';
      th.textContent = '(' + m.thoughts + ')';
      div.appendChild(th);
    }
    scScroll.appendChild(div);
  }
  function _scScrollToBottom() {
    scScroll.scrollTop = scScroll.scrollHeight;
  }

  async function _sideChatSend() {
    if (_sideChatBusy) return;
    const text = scInput.value.trim();
    if (!text) return;
    scInput.value = '';
    _appendSideChatMsg({ role: 'user', content: text });
    _scScrollToBottom();

    const thinking = document.createElement('div');
    thinking.className = 'ta-sc-msg aria ta-sc-thinking';
    thinking.textContent = '... thinking ...';
    scScroll.appendChild(thinking);
    _scScrollToBottom();

    _sideChatBusy = true;
    scSendBtn.disabled = true;
    try {
      const res = await window.adventureAPI.sideChatSend(text);
      thinking.remove();
      if (res && res.success && res.reply) {
        _appendSideChatMsg({ role: 'companion', content: res.reply.dialogue, thoughts: res.reply.thoughts, emotion: res.reply.emotion });
        _scScrollToBottom();
        if (res.reply.emotion && window.CompanionDisplay && typeof window.CompanionDisplay.setEmotion === 'function') {
          window.CompanionDisplay.setEmotion(res.reply.emotion);
        }
      } else {
        _appendSideChatMsg({ role: 'companion', content: '(no response — ' + (res && res.error || 'unknown error') + ')' });
        _scScrollToBottom();
      }
    } catch (e) {
      thinking.remove();
      _appendSideChatMsg({ role: 'companion', content: '(error: ' + (e.message || e) + ')' });
      _scScrollToBottom();
    } finally {
      _sideChatBusy = false;
      scSendBtn.disabled = false;
      scInput.focus();
    }
  }

  function _focusInput() {
    setTimeout(() => inputEl && inputEl.focus(), 30);
  }

  function _escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { init, toggle, setTypeSettings };
})();

window.TextAdventure = TextAdventure;
