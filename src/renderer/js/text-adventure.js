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
    { id: 'equipment', label: 'EQP' },
    { id: 'spells',    label: 'SPL' },
    { id: 'abilities', label: 'ABL' },
    { id: 'stats',     label: 'STA' },
    { id: 'summons',   label: 'SUM' },
    { id: 'story',     label: 'SAGA' },
    { id: 'memory',    label: 'LORE' },
    { id: 'map',       label: 'MAP'  },
  ];

  // ── DOM refs ─────────────────────────────────────────────────────────────
  let root;
  let scrollEl;
  let inputEl;
  let sendBtn;
  let retryBtn;
  let hudSceneEl, hudTimeEl;
  let pHpBar, pHpText, pMpBar, pMpText, pXpBar, pLvlText;
  let aHpBar, aHpText, aMpBar, aMpText, aLvlText;
  let enemyPanel, enemySpriteEl, enemyNameEl, enemyHpBar, enemyHpText, enemyDescEl;
  let overlayNewGame, overlayDeath, overlaySideChat, drawer;
  let toneGrid, settingInput, startBtn;
  let deathCauseEl, btnNewGameFromDeath, btnExitFromDeath;
  let drawerTabs, drawerSections, drawerCharSel;
  let scScroll, scInput, scSendBtn, scResumeBtn, scClearBtn;
  let partyPanelEl, partyExtrasEl, partyToggleBtn;
  let overlayGmChat, gmScrollEl, gmInputEl, gmSendBtn, gmCloseBtn;
  let overlayLevelUp, luTitleEl, luNarrativeEl, luGainsEl, luContinueBtn;
  let overlayImplTask, itTitleEl, itMetaEl, itBodyEl, itContinueBtn;
  let overlayConfirm, confirmTitleEl, confirmMsgEl, confirmOkBtn, confirmCancelBtn;
  let _confirmResolve = null;
  let _levelUpQueue = [];
  let _implTaskQueue = [];
  let unsubscribeUpdate = null;

  let _selectedTone = TONES[0].id;
  let _activeState = null;
  let _busy = false;
  let _sideChatBusy = false;
  let _gmBusy = false;
  let _gmHistory = [];
  let _partyPanelOpen = false;
  let _drawerActiveTab = 'inventory';
  let _drawerCharTarget = 0;  // index into _getCharRoster()
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
    // Wipe side-chat and GM-chat files — each adventure session starts fresh.
    try { await window.adventureAPI.clearSessionChats(); } catch {}
    // Also reset in-memory GM history so the overlay is clean.
    _gmHistory = [];
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
      // Restore Aria's last-known adventure portrait. Adventure tracks its
      // own portrait state separate from chat mode — state.player.lastAriaEmotion
      // is written on every turn (see text-adventure-ipc.js take-action) and
      // survives app shutdown via text-adventure.json. Without this restore,
      // the portrait would either show whatever was in chat mode or fall back
      // to the default until the next turn lands.
      const restoreEmotion = state.player && state.player.lastAriaEmotion;
      if (restoreEmotion && window.CompanionDisplay && typeof window.CompanionDisplay.setEmotion === 'function') {
        window.CompanionDisplay.setEmotion(restoreEmotion);
      }
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
    _closeGmChat();
    if (_partyPanelOpen) _togglePartyPanel();
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
            <button class="ta-hud-btn" id="ta-party-toggle" title="Show/hide party HP &amp; MP">PTY</button>
            <button class="ta-hud-btn aria" id="ta-btn-sidechat" title="Talk to companion — pauses the story">CHAT</button>
            <button class="ta-hud-btn" id="ta-btn-askgm" title="Ask the Game Master a meta question">ASK</button>
            <button class="ta-hud-btn" data-drawer="inventory" title="Inventory">INV</button>
            <button class="ta-hud-btn" data-drawer="equipment" title="Equipment">EQP</button>
            <button class="ta-hud-btn" data-drawer="spells" title="Spells">SPL</button>
            <button class="ta-hud-btn" data-drawer="abilities" title="Abilities">ABL</button>
            <button class="ta-hud-btn" data-drawer="stats" title="Stats &amp; Buffs">STA</button>
            <button class="ta-hud-btn" data-drawer="summons" title="Summons &amp; Bound Entities">SUM</button>
            <button class="ta-hud-btn" data-drawer="story" title="Story — recap, events, goals">SAGA</button>
            <button class="ta-hud-btn" data-drawer="memory" title="World — NPCs, quests, lore">LORE</button>
            <button class="ta-hud-btn" data-drawer="map" title="Spatial positions — who is where">MAP</button>
            <button class="ta-hud-btn warn" id="ta-btn-reset" title="Reset — wipes all progress">RST</button>
            <button class="ta-hud-btn" id="ta-btn-exit">EXIT</button>
          </div>
        </div>

        <!-- Party panel: absolute-positioned dropdown below HUD -->
        <div class="ta-party-panel" id="ta-party-panel">
          <div class="ta-hud-row ta-party-row">
            <span class="ta-hud-name player" id="ta-p-name">TRIS</span>
            <span class="ta-hud-stat" title="Trist HP">HP <div class="ta-hud-bar"><span id="ta-p-hp" style="transform: scaleX(1)"></span></div><span id="ta-p-hp-t">0/0</span></span>
            <span class="ta-hud-stat" title="Trist MP">MP <div class="ta-hud-bar mp"><span id="ta-p-mp" style="transform: scaleX(1)"></span></div><span id="ta-p-mp-t">0/0</span></span>
            <span class="ta-hud-stat" title="Trist XP">LV <span id="ta-p-lvl">1</span><div class="ta-hud-bar xp"><span id="ta-p-xp" style="transform: scaleX(0)"></span></div></span>
          </div>
          <div class="ta-hud-row ta-party-row">
            <span class="ta-hud-name aria" id="ta-a-name">ARIA</span>
            <span class="ta-hud-stat" title="Companion HP">HP <div class="ta-hud-bar"><span id="ta-a-hp" style="transform: scaleX(1)"></span></div><span id="ta-a-hp-t">0/0</span></span>
            <span class="ta-hud-stat" title="Companion MP">MP <div class="ta-hud-bar mp"><span id="ta-a-mp" style="transform: scaleX(1)"></span></div><span id="ta-a-mp-t">0/0</span></span>
            <span class="ta-hud-stat" title="Companion level">LV <span id="ta-a-lvl">1</span></span>
          </div>
          <div id="ta-party-extras"></div>
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
        <button class="ta-retry" id="ta-retry" title="Undo last turn and resend">RETRY</button>
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
          <span class="ta-sc-title" id="ta-sc-title">// SIDE-CHAT WITH ARIA</span>
          <span class="ta-sc-paused">STORY PAUSED</span>
          <button class="ta-sc-clear"  id="ta-sc-clear" title="Wipe side-chat history">CLEAR</button>
          <button class="ta-sc-resume" id="ta-sc-resume">RESUME STORY</button>
        </div>
        <div class="ta-sc-scroll" id="ta-sc-scroll"></div>
        <div class="ta-sc-input-row">
          <textarea class="ta-sc-input" id="ta-sc-input" rows="2" maxlength="1000"
                    placeholder="Talk to your companion — the story holds where it is..."></textarea>
          <button class="ta-sc-send" id="ta-sc-send">SEND</button>
        </div>
      </div>

      <!-- Implementation-task overlay -->
      <div class="ta-overlay impl-task hidden" id="ta-overlay-impltask">
        <div class="ta-it-badge">IMPLEMENTATION TASK</div>
        <h2 id="ta-it-title">— UNIQUE GRANT —</h2>
        <div class="ta-it-meta" id="ta-it-meta"></div>
        <div class="ta-it-body" id="ta-it-body"></div>
        <p class="ta-it-footnote">Logged to <code>text-adventure-implementation-tasks.md</code>. Ask the developer to implement to activate engine-side effects.</p>
        <div class="ta-overlay-actions">
          <button class="ta-overlay-btn" id="ta-it-continue">CONTINUE</button>
        </div>
      </div>

      <!-- Level-up overlay -->
      <div class="ta-overlay level-up hidden" id="ta-overlay-levelup">
        <div class="ta-lu-badge">LEVEL UP</div>
        <h2 id="ta-lu-title">— LEVEL UP —</h2>
        <div class="ta-lu-narrative" id="ta-lu-narrative"></div>
        <div class="ta-lu-gains" id="ta-lu-gains"></div>
        <div class="ta-overlay-actions">
          <button class="ta-overlay-btn" id="ta-lu-continue">CONTINUE</button>
        </div>
      </div>

      <!-- GM chat overlay -->
      <div class="ta-overlay gm-chat hidden" id="ta-overlay-gm">
        <div class="ta-gm-header">
          <span class="ta-gm-title">// ASK THE GAMEMASTER</span>
          <button class="ta-gm-close" id="ta-gm-close">CLOSE</button>
        </div>
        <div class="ta-gm-scroll" id="ta-gm-scroll"></div>
        <div class="ta-gm-input-row">
          <textarea class="ta-gm-input" id="ta-gm-input" rows="2" maxlength="1000"
                    placeholder="Ask the GM anything — story choices, consequences, lore, what might happen next..."></textarea>
          <button class="ta-gm-send" id="ta-gm-send">SEND</button>
        </div>
      </div>

      <!-- Retry confirm overlay -->
      <div class="ta-overlay confirm hidden" id="ta-overlay-confirm">
        <div class="ta-confirm-badge">!! WARNING</div>
        <h2 id="ta-confirm-title">RETRY LAST TURN?</h2>
        <p id="ta-confirm-msg">This will undo the last gamemaster response and resend your action.</p>
        <div class="ta-overlay-actions">
          <button class="ta-overlay-btn" id="ta-confirm-ok">RETRY</button>
          <button class="ta-overlay-btn danger" id="ta-confirm-cancel">CANCEL</button>
        </div>
      </div>

      <!-- Drawer -->
      <div class="ta-drawer" id="ta-drawer">
        <div class="ta-drawer-tabs" id="ta-drawer-tabs"></div>
        <div class="ta-drawer-char-sel" id="ta-drawer-char-sel">
          <button class="ta-char-arrow" id="ta-char-prev" title="Previous character">&#9664;</button>
          <span class="ta-char-name" id="ta-char-name">TRIST</span>
          <button class="ta-char-arrow" id="ta-char-next" title="Next character">&#9654;</button>
        </div>
        <div class="ta-drawer-section" id="ta-drawer-section"></div>
        <button class="ta-drawer-close" id="ta-drawer-close">CLOSE</button>
      </div>
    `;

    // Cache refs
    scrollEl     = root.querySelector('#ta-scroll');
    inputEl      = root.querySelector('#ta-input');
    sendBtn      = root.querySelector('#ta-send');
    retryBtn     = root.querySelector('#ta-retry');
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
    overlayGmChat   = root.querySelector('#ta-overlay-gm');
    drawer       = root.querySelector('#ta-drawer');
    toneGrid     = root.querySelector('#ta-tone-grid');
    settingInput = root.querySelector('#ta-setting-input');
    startBtn     = root.querySelector('#ta-start-btn');
    deathCauseEl       = root.querySelector('#ta-death-cause');
    btnNewGameFromDeath = root.querySelector('#ta-newgame-from-death');
    btnExitFromDeath    = root.querySelector('#ta-exit-from-death');
    drawerTabs   = root.querySelector('#ta-drawer-tabs');
    drawerSections = root.querySelector('#ta-drawer-section');
    drawerCharSel  = root.querySelector('#ta-drawer-char-sel');
    scScroll     = root.querySelector('#ta-sc-scroll');
    scInput      = root.querySelector('#ta-sc-input');
    scSendBtn    = root.querySelector('#ta-sc-send');
    scResumeBtn  = root.querySelector('#ta-sc-resume');
    scClearBtn   = root.querySelector('#ta-sc-clear');
    partyPanelEl   = root.querySelector('#ta-party-panel');
    partyExtrasEl  = root.querySelector('#ta-party-extras');
    partyToggleBtn = root.querySelector('#ta-party-toggle');
    gmScrollEl  = root.querySelector('#ta-gm-scroll');
    gmInputEl   = root.querySelector('#ta-gm-input');
    gmSendBtn   = root.querySelector('#ta-gm-send');
    gmCloseBtn  = root.querySelector('#ta-gm-close');
    overlayLevelUp = root.querySelector('#ta-overlay-levelup');
    luTitleEl     = root.querySelector('#ta-lu-title');
    luNarrativeEl = root.querySelector('#ta-lu-narrative');
    luGainsEl     = root.querySelector('#ta-lu-gains');
    luContinueBtn = root.querySelector('#ta-lu-continue');
    luContinueBtn.addEventListener('click', _showNextLevelUp);
    overlayImplTask = root.querySelector('#ta-overlay-impltask');
    itTitleEl    = root.querySelector('#ta-it-title');
    itMetaEl     = root.querySelector('#ta-it-meta');
    itBodyEl     = root.querySelector('#ta-it-body');
    itContinueBtn = root.querySelector('#ta-it-continue');
    itContinueBtn.addEventListener('click', _showNextImplTask);
    overlayConfirm  = root.querySelector('#ta-overlay-confirm');
    confirmTitleEl  = root.querySelector('#ta-confirm-title');
    confirmMsgEl    = root.querySelector('#ta-confirm-msg');
    confirmOkBtn    = root.querySelector('#ta-confirm-ok');
    confirmCancelBtn = root.querySelector('#ta-confirm-cancel');
    confirmOkBtn.addEventListener('click',     () => _resolveConfirm(true));
    confirmCancelBtn.addEventListener('click', () => _resolveConfirm(false));

    _renderToneGrid();
    _renderDrawerTabs();
    _updateCharSelector();
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
  function _getCharRoster() {
    if (!_activeState) return [{ key: 'player', label: 'TRIST', data: {} }];
    const roster = [{ key: 'player', label: 'TRIST', data: _activeState.player || {} }];
    if (_activeState.aria) {
      roster.push({ key: 'aria', label: (_activeState.aria.name || 'Aria').toUpperCase(), data: _activeState.aria });
    }
    for (const m of (_activeState.party || [])) {
      roster.push({
        key: m.id || m.name || String(roster.length),
        label: String(m.name || m.id || '?').slice(0, 10).toUpperCase(),
        data: m,
      });
    }
    return roster;
  }

  function _updateCharSelector() {
    if (!drawerCharSel) return;
    const roster = _getCharRoster();
    if (_drawerCharTarget >= roster.length) _drawerCharTarget = 0;
    const nameEl = drawerCharSel.querySelector('#ta-char-name');
    if (nameEl) nameEl.textContent = roster[_drawerCharTarget]?.label || 'TRIST';
    const hasMult = roster.length > 1;
    drawerCharSel.style.display = _activeState ? 'flex' : 'none';
    const prevBtn = drawerCharSel.querySelector('#ta-char-prev');
    const nextBtn = drawerCharSel.querySelector('#ta-char-next');
    if (prevBtn) prevBtn.style.visibility = hasMult ? 'visible' : 'hidden';
    if (nextBtn) nextBtn.style.visibility = hasMult ? 'visible' : 'hidden';
  }

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
    _updateCharSelector();
    if (!_activeState) {
      drawerSections.innerHTML = '<div class="ta-list-empty">// no game in progress</div>';
      return;
    }
    const state = _activeState;
    const roster = _getCharRoster();
    if (_drawerCharTarget >= roster.length) _drawerCharTarget = 0;
    const char = roster[_drawerCharTarget] || { label: 'TRIST', data: state.player || {} };
    const cd = char.data;

    if (_drawerActiveTab === 'inventory') {
      _renderInventoryDrawer(cd.inventory || [], cd.equipment || {});
    } else if (_drawerActiveTab === 'equipment') {
      _renderEquipmentDrawer(cd.equipment || {});
    } else if (_drawerActiveTab === 'spells') {
      _renderSpellsDrawer(cd.spells || []);
    } else if (_drawerActiveTab === 'abilities') {
      // Filter out hidden abilities — companion's "true power" capabilities
      // exist in state and the engine respects them, but they're not shown
      // to the player. See docs/COMBAT_CALCULATIONS.md → Hidden abilities.
      const visible = (cd.abilities || []).filter((a) => !(a && a.hidden === true));
      _renderAbilitiesDrawer(visible);
    } else if (_drawerActiveTab === 'stats') {
      _renderStatsDrawer(cd, char.label);
    } else if (_drawerActiveTab === 'summons') {
      _renderSummonsDrawer(state.summons || []);
    } else if (_drawerActiveTab === 'story') {
      _renderStoryDrawer(state.memory || {});
    } else if (_drawerActiveTab === 'memory') {
      _renderWorldDrawer(state.memory || {});
    } else if (_drawerActiveTab === 'map') {
      _renderMapDrawer(state.positions, state, char);
    }
  }

  function _compassDesc(dx, dy, ft) {
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const dirs  = ['east','northeast','north','northwest','west','southwest','south','southeast'];
    const idx   = Math.round(((angle % 360) + 360) % 360 / 45) % 8;
    return `${ft} ft ${dirs[idx]}`;
  }

  function _renderMapDrawer(positions, state, char) {
    if (!positions || !Array.isArray(positions.entities) || !positions.entities.length) {
      drawerSections.innerHTML = '<div class="ta-list-empty">// no position data yet<br>// updates each story turn</div>';
      return;
    }
    const entities = positions.entities;
    const player = entities.find((e) => e.id === 'player') || { x: 0, y: 0 };

    // Character-specific blurb — match selected char to an entity by key/id
    const charKey = char && char.key;
    const charEnt = charKey ? entities.find((e) => e.id === charKey) : null;
    let charBlurb = '';
    if (charEnt) {
      if (charKey === 'player') {
        charBlurb = `at (${charEnt.x}, ${charEnt.y}) — reference point`;
      } else {
        const dx = charEnt.x - player.x, dy = charEnt.y - player.y;
        const ft = Math.round(Math.sqrt(dx * dx + dy * dy) * 5);
        charBlurb = ft === 0
          ? `at (${charEnt.x}, ${charEnt.y}) — beside you`
          : `at (${charEnt.x}, ${charEnt.y}) — ${_compassDesc(dx, dy, ft)} from you`;
      }
    }

    // Fixed-scale viewport: 1 grid cell = 1 coordinate unit.
    // Center viewport on midpoint of all entities, then expand to fixed grid size.
    const GRID_W = 21, GRID_H = 13;
    const xs = entities.map((e) => e.x);
    const ys = entities.map((e) => e.y);
    const midX = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
    const midY = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
    const halfW = Math.floor(GRID_W / 2);
    const halfH = Math.floor(GRID_H / 2);
    const viewMinX = midX - halfW;
    const viewMinY = midY - halfH;

    const SYMBOLS = ['@', 'A', 'V', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const grid = Array.from({ length: GRID_H }, () => Array(GRID_W).fill('·'));

    const placed = entities.map((e, i) => {
      const sym = SYMBOLS[i % SYMBOLS.length];
      const gx  = e.x - viewMinX;
      const gy  = GRID_H - 1 - (e.y - viewMinY); // flip y: positive = up
      const onGrid = gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H;
      if (onGrid) {
        if (grid[gy][gx] !== '·') {
          // Nudge one cell to avoid overlap
          for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = gx + ox, ny = gy + oy;
            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && grid[ny][nx] === '·') {
              grid[ny][nx] = sym; break;
            }
          }
        } else {
          grid[gy][gx] = sym;
        }
      }
      return { ...e, sym, onGrid };
    });

    const gridHtml = grid.map((row) => row.join('')).join('\n');

    const rows = placed.map((e) => {
      const dx = e.x - player.x, dy = e.y - player.y;
      const ft  = Math.round(Math.sqrt(dx * dx + dy * dy) * 5);
      const distStr = e.id === 'player' ? '— here —' : `${ft} ft`;
      const offNote = !e.onGrid ? '<span style="opacity:.5"> ⟨off grid⟩</span>' : '';
      return `<div class="ta-map-row">
        <span class="ta-map-sym">${e.sym}</span>
        <span class="ta-map-label">${_escape(e.label || e.id)}${offNote}</span>
        <span class="ta-map-coord">(${e.x}, ${e.y})</span>
        <span class="ta-map-dist">${distStr}</span>
      </div>`;
    }).join('');

    const charLine = charBlurb
      ? `<div class="ta-map-char-blurb">${_escape(char.label)} — ${charBlurb}</div>`
      : '';

    drawerSections.innerHTML = `
      <div class="ta-section-title">// POSITIONS</div>
      ${charLine}
      <pre class="ta-map-grid">${gridHtml}</pre>
      <div class="ta-map-legend">${rows}</div>
    `;
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

  function _renderSpellsDrawer(spells) {
    if (!spells || !spells.length) {
      drawerSections.innerHTML = '<div class="ta-list-empty">// no spells known</div>';
      return;
    }
    drawerSections.innerHTML = '<div class="ta-section-title">// SPELLS</div>' +
      spells.map((s) => `<div class="ta-list-row">
        <span class="name">${_escape(s.name || s.id)}</span>
        ${typeof s.cost === 'number' ? `<span class="qty">${s.cost} MP</span>` : ''}
        ${s.desc ? `<div class="desc">${_escape(s.desc)}</div>` : ''}
      </div>`).join('');
  }

  function _renderAbilitiesDrawer(abilities) {
    if (!abilities || !abilities.length) {
      drawerSections.innerHTML = '<div class="ta-list-empty">// no abilities learned</div>';
      return;
    }
    drawerSections.innerHTML = '<div class="ta-section-title">// ABILITIES</div>' +
      abilities.map((a) => `<div class="ta-list-row">
        <span class="name">${_escape(a.name || a.id)}</span>
        ${a.cost ? `<span class="qty">${_escape(a.cost)}</span>` : ''}
        ${a.desc ? `<div class="desc">${_escape(a.desc)}</div>` : ''}
      </div>`).join('');
  }

  function _renderSummonsDrawer(summons) {
    if (!summons || !summons.length) {
      drawerSections.innerHTML = '<div class="ta-list-empty">// no bound entities</div>';
      return;
    }
    drawerSections.innerHTML = '<div class="ta-section-title">// BOUND ENTITIES</div>' +
      summons.map((s) => {
        const incap  = (typeof s.hp === 'number' && s.hp === 0);
        const hpLine = (typeof s.hp === 'number' && typeof s.maxHp === 'number')
          ? `<div class="ta-stat-row"><span class="label">HP</span><span class="val">${s.hp}/${s.maxHp}</span></div>`
          : '';
        const boundTo = s.boundTo
          ? `<div class="desc"><span style="color:#ffea88">Bound to:</span> ${_escape(s.boundTo)}</div>`
          : '';
        const cans = Array.isArray(s.abilities) && s.abilities.length
          ? `<div class="desc"><span style="color:#ffea88">Can:</span> ${s.abilities.map(_escape).join(', ')}</div>`
          : '';
        const notes = s.notes ? `<div class="desc" style="opacity:0.6">${_escape(s.notes)}</div>` : '';
        return `<div class="ta-list-row"${incap ? ' style="opacity:0.45"' : ''}>
          <span class="name">${_escape(s.name || s.id)}${incap ? ' <span style="color:#ff5577">[INCAPACITATED]</span>' : ''}</span>
          ${hpLine}
          ${s.desc ? `<div class="desc">${_escape(s.desc)}</div>` : ''}
          ${boundTo}
          ${cans}
          ${notes}
        </div>`;
      }).join('');
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
    // Filter hidden abilities — see docs/COMBAT_CALCULATIONS.md → Hidden abilities.
    const visibleAbilities = (aria.abilities || []).filter((a) => !(a && a.hidden === true));
    const abilitiesHtml = visibleAbilities.length
      ? visibleAbilities.map((a) => `<div class="ta-list-row">
          <span class="name">${_escape(a.name || a.id)}</span>
          ${a.cost ? `<span class="qty">${_escape(a.cost)}</span>` : ''}
          ${a.desc ? `<div class="desc">${_escape(a.desc)}</div>` : ''}
        </div>`).join('')
      : '';

    drawerSections.innerHTML = `
      <div class="ta-section-title pink">// ${_escape((aria.name || 'ARIA').toUpperCase())} — STATS</div>
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
      ${abilitiesHtml ? '<div class="ta-section-title pink">// ABILITIES</div>' + abilitiesHtml : ''}
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
    retryBtn.addEventListener('click', async () => {
      if (_busy) return;
      const confirmed = await _showConfirm(
        'RETRY LAST TURN?',
        'This will undo the last gamemaster response and resend your action.',
        'RETRY',
        'CANCEL'
      );
      if (confirmed) _retryLastAction();
    });
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
    partyToggleBtn.addEventListener('click', _togglePartyPanel);
    root.querySelector('#ta-btn-askgm').addEventListener('click', _openGmChat);

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
    root.querySelector('#ta-char-prev').addEventListener('click', () => {
      const roster = _getCharRoster();
      if (roster.length <= 1) return;
      _drawerCharTarget = (_drawerCharTarget - 1 + roster.length) % roster.length;
      _updateCharSelector();
      _renderDrawerContent();
    });
    root.querySelector('#ta-char-next').addEventListener('click', () => {
      const roster = _getCharRoster();
      if (roster.length <= 1) return;
      _drawerCharTarget = (_drawerCharTarget + 1) % roster.length;
      _updateCharSelector();
      _renderDrawerContent();
    });

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

    // GM chat events
    gmSendBtn.addEventListener('click', _gmChatSend);
    gmInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _gmChatSend();
      }
    });
    gmCloseBtn.addEventListener('click', _closeGmChat);
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
      sendBtn.disabled = true; retryBtn.disabled = true;
      _addThinkingEntry();
      await window.adventureAPI.takeAction(
        '(BEGIN ADVENTURE — set the opening scene, introduce Aria as my party member, and describe where we are)'
      );
    } catch (e) {
      console.error('[TextAdventure] start failed:', e);
      _busy = false;
      sendBtn.disabled = false; retryBtn.disabled = false;
      _removeThinkingEntry();
    }
  }

  async function _confirmReset() {
    const ok = await window.adventureAPI.confirm(
      'Reset Adventure?',
      'All progress, memory, and side-chat will be wiped.',
      'Reset', 'Cancel'
    );
    if (!ok) return;
    await window.adventureAPI.resetGame();
    _activeState = null;
    _renderLog([]);
    _hideOverlays();
    _showNewGameOverlay();
  }

  async function _exportGame() {
    try {
      const result = await window.adventureAPI.exportGame();
      if (result.ok) {
        _addEntry('system', `Story exported → ${result.filePath}`);
      } else if (!result.cancelled) {
        _addEntry('system', 'ERROR — Export failed: ' + (result.error || 'unknown'));
      }
    } catch (e) {
      _addEntry('system', 'ERROR — Export failed: ' + e.message);
    }
  }

  async function _importGame() {
    if (!confirm('Import a saved adventure?\nThis will replace your current run. This cannot be undone.')) return;
    let result;
    try {
      result = await window.adventureAPI.importGame();
    } catch (e) {
      _addEntry('system', 'ERROR — Import failed: ' + e.message);
      return;
    }
    if (result.ok) {
      _activeState = result.state;
      _renderHud(result.state);
      _renderEnemy(result.state.enemy);
      _renderLog(result.log || []);
      if (!result.state.alive) {
        _showDeathOverlay(result.state.deathCause || 'Fallen.', result.state.deathOf);
      } else {
        _hideOverlays();
      }
      _addEntry('system', 'Story imported. Welcome back.');
    } else if (!result.cancelled) {
      _addEntry('system', 'ERROR — Import failed: ' + (result.error || 'unknown'));
    }
  }

  // Safety net: if adventure:update never arrives (main process crash, silent
  // error, etc.) unfreeze the UI after 150 s so the user isn't stuck forever.
  const _ACTION_TIMEOUT_MS = 150_000;
  let _actionTimeoutId = null;

  function _clearActionTimeout() {
    if (_actionTimeoutId !== null) {
      clearTimeout(_actionTimeoutId);
      _actionTimeoutId = null;
    }
  }

  function _armActionTimeout() {
    _clearActionTimeout();
    _actionTimeoutId = setTimeout(() => {
      _actionTimeoutId = null;
      if (!_busy) return;
      _removeThinkingEntry();
      _addEntry('system', 'ERROR — No response after 150 s. The turn may have timed out — try again.');
      _busy = false;
      sendBtn.disabled = false; retryBtn.disabled = false;
      _focusInput();
    }, _ACTION_TIMEOUT_MS);
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
    sendBtn.disabled = true; retryBtn.disabled = true;
    _addThinkingEntry();
    _armActionTimeout();
    try {
      await window.adventureAPI.takeAction(text);
    } catch (e) {
      _clearActionTimeout();
      console.error('[TextAdventure] action failed:', e);
      _removeThinkingEntry();
      _addEntry('system', 'ERROR — ' + (e.message || 'unknown'));
      _busy = false;
      sendBtn.disabled = false; retryBtn.disabled = false;
      _focusInput();
    }
  }

  // ── Update handler ───────────────────────────────────────────────────────
  function _handleUpdate(payload) {
    _clearActionTimeout();
    _removeThinkingEntry();
    _busy = false;
    sendBtn.disabled = false; retryBtn.disabled = false;
    if (!payload) return;
    const { state, turnResponse } = payload;
    _activeState = state;

    // Surface explicit errors from the IPC handler. Without this the user
    // would see the spinner stop with no other feedback.
    if (payload.success === false && payload.error) {
      _addEntry('system', 'ERROR — ' + payload.error);
    }

    if (turnResponse) {
      if (turnResponse.narrator) {
        _addEntryAnimated('narrator', turnResponse.narrator);
      }
      // Aria meta-commentary is no longer surfaced — it was just summarizing
      // what the narrator already said. The portrait emotion still flows
      // through (see [ARIA_EMOTION] in text-adventure-rules.js).
      const pe = turnResponse.portraitEmotion
              || (turnResponse.aria && turnResponse.aria.emotion);
      if (pe && window.CompanionDisplay && typeof window.CompanionDisplay.setEmotion === 'function') {
        window.CompanionDisplay.setEmotion(pe);
      }
    }

    // Warning case: Phase 2 succeeded structurally but returned no narrator
    // block. The system entry that explains this was already appended to the
    // log by the IPC handler (and is part of `state.log` if the renderer
    // re-renders) — but the user is looking at the live terminal right now,
    // so surface it visibly. Without this the user just sees the portrait
    // swap with no story and assumes the app froze.
    if (payload.warning) {
      _addNarratorErrorEntry(payload.warning);
    }

    _renderHud(state);
    _renderEnemy(state.enemy);
    if (_partyPanelOpen) _renderPartyExtras(state.party || []);
    if (drawer.classList.contains('open')) _renderDrawerContent();

    if (!state.alive) {
      _showDeathOverlay(state.deathCause || 'You have fallen.', state.deathOf);
    } else {
      if (turnResponse && Array.isArray(turnResponse.levelUps) && turnResponse.levelUps.length > 0) {
        _enqueueLevelUps(turnResponse.levelUps);
      }
      if (turnResponse && Array.isArray(turnResponse.implementationTasks) && turnResponse.implementationTasks.length > 0) {
        _enqueueImplTasks(turnResponse.implementationTasks);
      }
      if ((!turnResponse || !((turnResponse.levelUps && turnResponse.levelUps.length) || (turnResponse.implementationTasks && turnResponse.implementationTasks.length)))) {
        _focusInput();
      }
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
    const companionName = a.name || 'Aria';
    hudSceneEl.textContent = state.scene && state.scene.name ? state.scene.name : '— SCENE —';

    // Update all companion/player name labels — 4-char max for HUD row
    const pNameEl = root.querySelector('#ta-p-name');
    if (pNameEl) pNameEl.textContent = (p.name || 'Trist').slice(0, 4).toUpperCase();
    const aNameEl = root.querySelector('#ta-a-name');
    if (aNameEl) aNameEl.textContent = companionName.slice(0, 4).toUpperCase();
    const scTitleEl = root.querySelector('#ta-sc-title');
    if (scTitleEl) scTitleEl.textContent = `// SIDE-CHAT WITH ${companionName.toUpperCase()}`;
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

  // ── Copy helper ───────────────────────────────────────────────────────────
  function _makeCopyBtn(text) {
    const btn = document.createElement('button');
    btn.className = 'ta-copy-btn';
    btn.title = 'Copy to clipboard';
    btn.textContent = '⊡';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text || '').then(() => {
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '⊡'; }, 1200);
      }).catch(() => {});
    });
    return btn;
  }

  // ── Log / scroll ─────────────────────────────────────────────────────────
  function _renderLog(log) {
    scrollEl.innerHTML = '';
    // Skip legacy aria meta-commentary entries — that channel was removed
    // because it was just re-summarizing the narrator. Past entries stay in
    // the file but don't render anymore.
    for (const e of log) {
      if (e && e.kind === 'aria') continue;
      _appendEntryDom(e.kind, e.text);
    }
    _scrollToBottom();
  }

  function _addEntry(kind, text) {
    _appendEntryDom(kind, text);
    _scrollToBottom();
  }

  function _appendEntryDom(kind, text) {
    const div = document.createElement('div');
    div.className = 'ta-entry ' + (kind || 'narrator');
    if (kind === 'aria') div.dataset.label = _activeState?.aria?.name || 'Aria';
    div.textContent = text;
    if (kind === 'system' && text.startsWith('ERROR — The gamemaster returned no [NARRATOR]')) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'ta-retry-btn';
      retryBtn.textContent = '↺ RETRY';
      retryBtn.title = 'Re-send your last action';
      retryBtn.addEventListener('click', (e) => { e.stopPropagation(); _retryLastAction(); });
      div.appendChild(retryBtn);
    }
    div.appendChild(_makeCopyBtn(text));
    scrollEl.appendChild(div);
  }

  function _addNarratorErrorEntry(text) {
    _appendEntryDom('system', text);
    _scrollToBottom();
  }

  async function _retryLastAction() {
    if (_busy) return;
    const result = await window.adventureAPI.retryAction();
    if (!result.ok) {
      _addEntry('system', 'RETRY failed — ' + (result.error || 'unknown'));
      return;
    }
    _renderLog(result.log || []);
    if (result.state) {
      _activeState = result.state;
      _renderHud(result.state);
      _renderEnemy(result.state.enemy);
    }
    inputEl.value = result.actionText;
    _submitAction();
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
        job.el.appendChild(_makeCopyBtn(job.text));
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
      _typing.el.appendChild(_makeCopyBtn(_typing.text));
      _typing = null;
    }
    for (const job of _typeQueue) {
      if (job.timer) clearTimeout(job.timer);
      job.el.textContent = job.text;
      job.el.classList.remove('ta-typing');
      job.el.appendChild(_makeCopyBtn(job.text));
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
    overlayGmChat.classList.add('hidden');
    if (overlayLevelUp)  overlayLevelUp.classList.add('hidden');
    if (overlayImplTask) overlayImplTask.classList.add('hidden');
  }

  // ── Implementation-task overlay ──────────────────────────────────────────
  // Fires when the GM grants a unique ability/spell/equipment/item via the
  // [IMPLEMENTATION_TASK] tag. Each task is queued and shown in sequence;
  // the player clicks CONTINUE to advance. The grant is logged to
  // text-adventure-implementation-tasks.md regardless of whether the
  // popup was acknowledged.

  function _enqueueImplTasks(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) return;
    for (const t of tasks) _implTaskQueue.push(t);
    if (overlayImplTask && overlayImplTask.classList.contains('hidden')) {
      _showNextImplTask();
    }
  }

  // ── In-game confirm dialog ────────────────────────────────────────────────
  function _showConfirm(title, msg, okLabel = 'OK', cancelLabel = 'CANCEL') {
    return new Promise((resolve) => {
      _confirmResolve = resolve;
      confirmTitleEl.textContent   = title;
      confirmMsgEl.textContent     = msg;
      confirmOkBtn.textContent     = okLabel;
      confirmCancelBtn.textContent = cancelLabel;
      overlayConfirm.classList.remove('hidden');
    });
  }

  function _resolveConfirm(result) {
    overlayConfirm.classList.add('hidden');
    if (_confirmResolve) {
      const cb = _confirmResolve;
      _confirmResolve = null;
      cb(result);
    }
  }

  function _showNextImplTask() {
    if (!overlayImplTask) return;
    if (_implTaskQueue.length === 0) {
      overlayImplTask.classList.add('hidden');
      _focusInput();
      return;
    }
    const t = _implTaskQueue.shift();
    const name = t.name || t.id || '(unnamed)';
    const kindBadge = (t.kind || 'grant').toUpperCase();
    itTitleEl.textContent = `${name.toUpperCase()} — ${kindBadge}`;
    const metaBits = [];
    if (t.owner)      metaBits.push(`<span class="ta-it-meta-pill">owner: ${_escapeHtml(t.owner)}</span>`);
    if (t.id)         metaBits.push(`<span class="ta-it-meta-pill">id: <code>${_escapeHtml(t.id)}</code></span>`);
    if (t.complexity) metaBits.push(`<span class="ta-it-meta-pill complexity-${_escapeHtml(t.complexity)}">complexity: ${_escapeHtml(t.complexity)}</span>`);
    itMetaEl.innerHTML = metaBits.join(' ');
    const bodyParts = [];
    if (t.summary)              bodyParts.push(`<p class="ta-it-summary">${_escapeHtml(t.summary)}</p>`);
    if (t.description)          bodyParts.push(`<div class="ta-it-section"><h4>Description</h4><p>${_escapeHtml(t.description)}</p></div>`);
    if (t.intended_mechanic)    bodyParts.push(`<div class="ta-it-section"><h4>Intended Mechanic</h4><p>${_escapeHtml(t.intended_mechanic)}</p></div>`);
    if (t.implementation_notes) bodyParts.push(`<div class="ta-it-section"><h4>Implementation Notes (for the dev)</h4><p>${_escapeHtml(t.implementation_notes)}</p></div>`);
    itBodyEl.innerHTML = bodyParts.join('\n');
    overlayDeath.classList.add('hidden');
    overlaySideChat.classList.add('hidden');
    if (overlayLevelUp) overlayLevelUp.classList.add('hidden');
    overlayImplTask.classList.remove('hidden');
    setTimeout(() => itContinueBtn.focus(), 50);
  }

  // ── Level-up overlay ─────────────────────────────────────────────────────
  // Each level-up event is rendered in sequence — click CONTINUE to advance.
  // The renderer is dumb about the structure of `body` (the GM-authored gain
  // summary); we just show it as-is with light formatting.

  function _escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _formatLevelUpBody(body) {
    // Split on lines. Lines starting with "-" or "•" become bullets; others
    // become plain paragraphs. Empty lines become spacing.
    const lines = String(body || '').split(/\r?\n/);
    const out = [];
    let inList = false;
    const flushList = () => { if (inList) { out.push('</ul>'); inList = false; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flushList(); continue; }
      if (/^[-•]\s+/.test(line)) {
        if (!inList) { out.push('<ul class="ta-lu-bullets">'); inList = true; }
        out.push(`<li>${_escapeHtml(line.replace(/^[-•]\s+/, ''))}</li>`);
      } else {
        flushList();
        out.push(`<p>${_escapeHtml(line)}</p>`);
      }
    }
    flushList();
    return out.join('\n');
  }

  function _enqueueLevelUps(levelUps) {
    if (!Array.isArray(levelUps) || levelUps.length === 0) return;
    for (const lu of levelUps) _levelUpQueue.push(lu);
    // If no overlay is currently displaying a level-up, kick off the queue.
    if (overlayLevelUp && overlayLevelUp.classList.contains('hidden')) {
      _showNextLevelUp();
    }
  }

  function _showNextLevelUp() {
    if (!overlayLevelUp) return;
    if (_levelUpQueue.length === 0) {
      overlayLevelUp.classList.add('hidden');
      _focusInput();
      return;
    }
    const lu = _levelUpQueue.shift();
    const displayName = (lu.name || lu.who || '???').toString();
    const levelText = (typeof lu.newLevel === 'number')
      ? `Level ${lu.newLevel}`
      : (lu.header || '');
    luTitleEl.textContent = `${displayName.toUpperCase()} — ${levelText}`;
    // Narrative is the first paragraph (non-bullet text) — already part of body.
    // For visual hierarchy we don't try to split here; we just render the
    // whole body via _formatLevelUpBody.
    luNarrativeEl.innerHTML = '';
    luGainsEl.innerHTML = _formatLevelUpBody(lu.body || '');
    overlayDeath.classList.add('hidden');
    overlaySideChat.classList.add('hidden');
    overlayLevelUp.classList.remove('hidden');
    setTimeout(() => luContinueBtn.focus(), 50);
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

  // ── Party panel ──────────────────────────────────────────────────────────
  function _togglePartyPanel() {
    _partyPanelOpen = !_partyPanelOpen;
    partyPanelEl.classList.toggle('open', _partyPanelOpen);
    partyToggleBtn.classList.toggle('pty-active', _partyPanelOpen);
    if (_partyPanelOpen && _activeState) {
      _renderPartyExtras(_activeState.party || []);
    }
  }

  function _renderPartyExtras(party) {
    if (!partyExtrasEl) return;
    if (!party || !party.length) {
      partyExtrasEl.innerHTML = '';
      return;
    }
    partyExtrasEl.innerHTML = party.map((m) => {
      const maxHp = m.maxHp || 1;
      const maxMp = m.maxMp || 1;
      const hpFrac = maxHp > 0 ? Math.max(0, Math.min(1, (m.hp || 0) / maxHp)) : 0;
      const mpFrac = maxMp > 0 ? Math.max(0, Math.min(1, (m.mp || 0) / maxMp)) : 0;
      const dead  = m.alive === false;
      const nameTag = String(m.name || m.id || '?').slice(0, 4).toUpperCase();
      return `<div class="ta-hud-row ta-party-row" style="${dead ? 'opacity:0.45' : ''}">
        <span class="ta-hud-name" style="color:#cfead8;width:44px" title="${_escape(m.name || '')}">${_escape(nameTag)}</span>
        <span class="ta-hud-stat" title="HP">HP <div class="ta-hud-bar"><span style="transform:scaleX(${hpFrac.toFixed(3)})"></span></div><span>${m.hp ?? 0}/${m.maxHp ?? 0}</span></span>
        <span class="ta-hud-stat" title="MP">MP <div class="ta-hud-bar mp"><span style="transform:scaleX(${mpFrac.toFixed(3)})"></span></div><span>${m.mp ?? 0}/${m.maxMp ?? 0}</span></span>
        <span class="ta-hud-stat" title="Level">LV <span>${m.level ?? 1}</span></span>
        ${dead ? '<span style="color:#ff5577;font-size:7px">INCAP</span>' : ''}
      </div>`;
    }).join('');
  }

  // ── GM chat ──────────────────────────────────────────────────────────────
  function _openGmChat() {
    if (!_activeState) {
      _showNewGameOverlay();
      return;
    }
    overlayGmChat.classList.remove('hidden');
    if (!_gmHistory.length) {
      gmScrollEl.innerHTML = '<div class="ta-gm-empty">// Ask the GM anything — story, lore, consequences, what might happen next...<br/>// The story does not advance here.</div>';
    }
    setTimeout(() => gmInputEl && gmInputEl.focus(), 60);
  }

  function _closeGmChat() {
    if (overlayGmChat) overlayGmChat.classList.add('hidden');
    _focusInput();
  }

  function _appendGmMsg(role, content, thoughts) {
    if (!content) return;
    const div = document.createElement('div');
    div.className = 'ta-gm-msg ' + (role === 'gm' ? 'gm' : 'user');
    const main = document.createElement('div');
    main.textContent = content;
    div.appendChild(main);
    if (role === 'gm' && thoughts) {
      const th = document.createElement('span');
      th.className = 'thoughts';
      th.textContent = '(' + thoughts + ')';
      div.appendChild(th);
    }
    div.appendChild(_makeCopyBtn(content + (thoughts ? '\n(' + thoughts + ')' : '')));
    // Remove empty placeholder on first real message
    const empty = gmScrollEl.querySelector('.ta-gm-empty');
    if (empty) empty.remove();
    gmScrollEl.appendChild(div);
    gmScrollEl.scrollTop = gmScrollEl.scrollHeight;
  }

  async function _gmChatSend() {
    if (_gmBusy) return;
    const text = gmInputEl.value.trim();
    if (!text) return;
    gmInputEl.value = '';

    _appendGmMsg('user', text);
    _gmHistory.push({ role: 'user', content: text });

    const thinking = document.createElement('div');
    thinking.className = 'ta-gm-msg gm ta-gm-thinking';
    thinking.textContent = '... consulting the lore ...';
    gmScrollEl.appendChild(thinking);
    gmScrollEl.scrollTop = gmScrollEl.scrollHeight;

    _gmBusy = true;
    gmSendBtn.disabled = true;
    try {
      const res = await window.adventureAPI.askGm(text);
      thinking.remove();
      if (res && res.success && res.reply) {
        _appendGmMsg('gm', res.reply.dialogue, res.reply.thoughts);
        _gmHistory.push({ role: 'gm', content: res.reply.dialogue });
        if (res.reply.emotion && window.CompanionDisplay && typeof window.CompanionDisplay.setEmotion === 'function') {
          window.CompanionDisplay.setEmotion(res.reply.emotion);
        }
        if (res.stateChanged) {
          const notice = document.createElement('div');
          notice.className = 'ta-gm-notice';
          notice.textContent = '// game state updated';
          gmScrollEl.appendChild(notice);
        }
      } else {
        _appendGmMsg('gm', 'ERROR — ' + ((res && res.error) || 'unknown error'));
      }
    } catch (err) {
      thinking.remove();
      _appendGmMsg('gm', 'ERROR — ' + (err.message || 'unknown'));
    } finally {
      _gmBusy = false;
      gmSendBtn.disabled = false;
      gmScrollEl.scrollTop = gmScrollEl.scrollHeight;
    }
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
    if (m.role === 'companion') div.dataset.label = _activeState?.aria?.name || 'Aria';
    const main = document.createElement('div');
    main.textContent = m.content || '';
    div.appendChild(main);
    if (m.role === 'companion' && m.thoughts) {
      const th = document.createElement('span');
      th.className = 'thoughts';
      th.textContent = '(' + m.thoughts + ')';
      div.appendChild(th);
    }
    const copyText = (m.content || '') + (m.thoughts ? '\n(' + m.thoughts + ')' : '');
    div.appendChild(_makeCopyBtn(copyText));
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
    thinking.dataset.label = _activeState?.aria?.name || 'Aria';
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

  return { init, toggle, setTypeSettings, exportGame: _exportGame, importGame: _importGame };
})();

window.TextAdventure = TextAdventure;
