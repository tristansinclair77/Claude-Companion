'use strict';
/* global window, document, RPGInventory */

// ── RPG Adventure Panel — Phase 5 UI ─────────────────────────────────────────
// Main controller for the RPG drawer panel.
// Defines window.RPGPanel (global IIFE — browser renderer script, not Node module).

const RPGPanel = (() => {

  // ── Constants ─────────────────────────────────────────────────────────────

  const RARITY_CLASS = {
    common:    'rarity-common',
    uncommon:  'rarity-uncommon',
    rare:      'rarity-rare',
    epic:      'rarity-epic',
    legendary: 'rarity-legendary',
  };

  const ROOM_LABELS = {
    monster:   'Monster Encounter',
    mini_boss: 'Mini-Boss',
    boss:      '☠ BOSS FIGHT',
    treasure:  'Treasure Chamber',
    rest:      'Rest Area',
    merchant:  'Traveling Merchant',
    trap:      'Trapped Corridor',
    empty:     'Empty Chamber',
    secret:    '★ Secret Room',
  };

  // ── State ─────────────────────────────────────────────────────────────────

  let _isOpen          = false;
  let _busy            = false;
  let _char            = null;      // character DB row
  let _equipped        = [];        // equipped gear rows
  let _currentRun      = null;      // serialized run state or null
  let _screen          = 'zone-select';
  let _achBracket      = 'easy';
  let _suggestedZoneId = null;      // zone_id suggested by companion (or null)

  // ── HTML template ─────────────────────────────────────────────────────────

  const _HTML = `
<div class="rpg-header">
  <span class="rpg-title">⚔ ADVENTURE</span>
  <div class="rpg-nav-tabs">
    <button class="rpg-tab" data-tab="zone-select">ZONES</button>
    <button class="rpg-tab" data-tab="character">CHAR</button>
    <button class="rpg-tab" data-tab="inventory">GEAR</button>
    <button class="rpg-tab" data-tab="achievements">ACH</button>
  </div>
  <div class="rpg-popout-btns">
    <button class="rpg-popout-btn" data-win="char" title="Pop out Character">↗</button>
    <button class="rpg-popout-btn" data-win="gear" title="Pop out Gear">↗</button>
    <button class="rpg-popout-btn" data-win="ach"  title="Pop out Achievements">↗</button>
  </div>
  <button id="rpg-panel-close">✕</button>
</div>

<div id="rpg-status-bar">
  <span>LV <span id="rpg-lv">1</span></span>
  <div class="rpg-bar-wrap"><div class="rpg-bar-fill xp" id="rpg-xp-fill" style="width:0%"></div></div>
  <span>HP</span>
  <div class="rpg-bar-wrap"><div class="rpg-bar-fill hp" id="rpg-hp-fill" style="width:100%"></div></div>
  <span id="rpg-gold">◆ 0</span>
</div>

<div class="rpg-screen active" id="rpg-screen-zone-select">
  <div class="rpg-screen-title">// SELECT ZONE</div>
  <div id="rpg-zone-suggestion-banner" class="rpg-zone-suggestion-banner" style="display:none"></div>
  <div class="rpg-zone-select-actions">
    <button class="rpg-btn" id="rpg-btn-suggest-zone">ASK COMPANION</button>
    <button class="rpg-btn primary" id="rpg-btn-rest">REST (HEAL FULL)</button>
  </div>
  <div class="rpg-scroll" id="rpg-zone-list"><div class="rpg-empty-note">Loading zones...</div></div>
</div>

<div class="rpg-screen" id="rpg-screen-combat">
  <div class="rpg-floor-header">
    <span id="rpg-zone-name-lbl">—</span>
    <span id="rpg-floor-lbl">Floor —/—</span>
  </div>
  <div id="rpg-enemy-card" class="rpg-enemy-card" style="display:none">
    <div class="rpg-enemy-name" id="rpg-enemy-name">—</div>
    <div class="rpg-enemy-hp-row">
      <span class="rpg-enemy-hp-text">HP</span>
      <div class="rpg-enemy-hp-bar">
        <div class="rpg-enemy-hp-fill" id="rpg-enemy-hp-fill" style="width:100%"></div>
      </div>
      <span id="rpg-enemy-hp-text" style="font-size:9px;color:#ff224466;white-space:nowrap">—/—</span>
    </div>
  </div>
  <div id="rpg-combat-log"></div>
  <div class="rpg-actions">
    <button class="rpg-btn"         id="rpg-btn-fight"   style="display:none">FIGHT</button>
    <button class="rpg-btn danger"  id="rpg-btn-flee"    style="display:none">FLEE</button>
    <button class="rpg-btn"         id="rpg-btn-item"    style="display:none">ITEM</button>
    <button class="rpg-btn primary" id="rpg-btn-next"    style="display:none">NEXT FLOOR</button>
    <button class="rpg-btn"         id="rpg-btn-extract" style="display:none">EXTRACT</button>
  </div>
</div>

<div class="rpg-screen" id="rpg-screen-merchant">
  <div class="rpg-screen-title">// TRAVELING MERCHANT</div>
  <p class="rpg-merchant-intro">The merchant eyes your equipment with interest...</p>
  <div class="rpg-scroll" id="rpg-merchant-list"></div>
  <div class="rpg-actions">
    <button class="rpg-btn primary" id="rpg-btn-merchant-leave">LEAVE</button>
  </div>
</div>

<div class="rpg-screen" id="rpg-screen-run-end">
  <div class="rpg-scroll" id="rpg-run-end-content"></div>
  <div class="rpg-actions">
    <button class="rpg-btn primary" id="rpg-btn-run-end-close">RETURN TO TOWN</button>
  </div>
</div>

<div class="rpg-screen" id="rpg-screen-character">
  <div class="rpg-screen-title">// CHARACTER</div>
  <div class="rpg-scroll" id="rpg-char-content"></div>
</div>

<div class="rpg-screen" id="rpg-screen-inventory">
  <div class="rpg-screen-title">// GEAR</div>
  <div class="rpg-scroll" id="rpg-inventory-content"></div>
</div>

<div class="rpg-screen" id="rpg-screen-achievements">
  <div class="rpg-ach-tabs">
    <button class="rpg-ach-tab active" data-bracket="easy">EASY</button>
    <button class="rpg-ach-tab"        data-bracket="mid">MID</button>
    <button class="rpg-ach-tab"        data-bracket="hard">HARD</button>
  </div>
  <div class="rpg-scroll" id="rpg-ach-list"></div>
</div>
`;

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    if (!window.rpgAPI) {
      console.warn('[RPGPanel] window.rpgAPI not available — addon not loaded');
      return;
    }
    const container = document.getElementById('rpg-panel');
    if (!container) {
      console.warn('[RPGPanel] #rpg-panel container not found in DOM');
      return;
    }
    container.innerHTML = _HTML;
    _bindStaticEvents();
    console.log('[RPGPanel] initialized');
  }

  // ── Open / Close ──────────────────────────────────────────────────────────

  async function open() {
    if (!window.rpgAPI) return;
    _isOpen = true;
    const panel = document.getElementById('rpg-panel');
    if (panel) {
      panel.classList.add('open');
      const btn = document.getElementById('btn-adventure');
      if (btn) btn.classList.add('active');
    }
    await _refresh();
  }

  function close() {
    _isOpen = false;
    const panel = document.getElementById('rpg-panel');
    if (panel) panel.classList.remove('open');
    const btn = document.getElementById('btn-adventure');
    if (btn) btn.classList.remove('active');
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async function _refresh() {
    try {
      const data = await window.rpgAPI.getState();
      _char     = data.character;
      _equipped = data.equipped || [];
      _currentRun = data.activeRun;
      _updateStatusBar();
      if (_currentRun) {
        _autoRoute();
      } else if (_screen === 'combat' || _screen === 'merchant' || _screen === 'run-end') {
        _showScreen('zone-select');
      }
      _renderCurrentScreen();
    } catch (err) {
      console.error('[RPGPanel] refresh error:', err);
    }
  }

  function _autoRoute() {
    if (!_currentRun) return;
    const phase = _currentRun.phase;
    if (phase === 'merchant')      _showScreen('merchant');
    else if (phase === 'run_complete') _showScreen('run-end');
    else                           _showScreen('combat');
  }

  // ── Status bar ────────────────────────────────────────────────────────────

  function _updateStatusBar() {
    if (!_char) return;
    const lv   = document.getElementById('rpg-lv');
    const gold = document.getElementById('rpg-gold');
    const xp   = document.getElementById('rpg-xp-fill');
    const hp   = document.getElementById('rpg-hp-fill');
    if (lv)   lv.textContent   = _char.level;
    if (gold) gold.textContent = `◆ ${(_char.gold || 0).toLocaleString()}`;

    const xpReq = _xpRequired(_char.level);
    const xpPct = xpReq > 0 ? Math.min(100, Math.round((_char.xp || 0) / xpReq * 100)) : 0;
    if (xp) xp.style.width = xpPct + '%';

    const maxHp = _maxHp(_char.vit);
    const curHp = _currentRun ? (_currentRun.playerHp || _char.hp_current) : _char.hp_current;
    const hpPct = Math.max(0, Math.min(100, Math.round(curHp / maxHp * 100)));
    if (hp) {
      hp.style.width = hpPct + '%';
      hp.classList.toggle('danger', hpPct < 20);
    }
  }

  // ── Screen routing ────────────────────────────────────────────────────────

  function _showScreen(name) {
    _screen = name;
    document.querySelectorAll('#rpg-panel .rpg-screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('#rpg-panel .rpg-tab').forEach(t => t.classList.remove('active'));
    const el  = document.getElementById('rpg-screen-' + name);
    const tab = document.querySelector(`#rpg-panel .rpg-tab[data-tab="${name}"]`);
    if (el)  el.classList.add('active');
    if (tab) tab.classList.add('active');
    _renderCurrentScreen();
  }

  function _renderCurrentScreen() {
    switch (_screen) {
      case 'zone-select':   _renderZoneSelect();  break;
      case 'combat':        _renderCombat();       break;
      case 'merchant':      _renderMerchant();     break;
      case 'character':     _renderCharacter();    break;
      case 'inventory':     _renderInventory();    break;
      case 'achievements':  _renderAchievements(); break;
      default: break;
    }
  }

  // ── Zone Select ───────────────────────────────────────────────────────────

  async function _renderZoneSelect() {
    const el = document.getElementById('rpg-zone-list');
    if (!el || !_char) return;
    el.innerHTML = '<div class="rpg-empty-note">Loading zones...</div>';

    try {
      const data       = await window.rpgAPI.getZones();
      const zones      = data.zones || [];
      const challenge  = data.challengeZones || [];
      const cleared    = new Set(data.clearedZoneIds || []);
      const charLevel  = _char.level;

      // Group by tier
      const byTier = {};
      for (const z of zones) {
        const t = z.tier || 1;
        if (!byTier[t]) byTier[t] = [];
        byTier[t].push(z);
      }

      const _zoneCard = (z, extraCls = '') => {
        const locked      = charLevel < (z.charLevelReq || 1);
        const isSuggested = z.id === _suggestedZoneId;
        const isCleared   = cleared.has(z.id);
        const lockTag     = locked ? ` [Req Lv ${z.charLevelReq}]` : '';
        const clearStar   = isCleared ? '<span class="rpg-zone-clear-star"> ★</span>' : '';
        const lr          = Array.isArray(z.levelRange)
          ? `Lv ${z.levelRange[0]}–${z.levelRange[1]}`
          : '';
        const mechNote    = z.mechanic ? ` · ${z.mechanic}` : '';
        const cls         = ['rpg-zone-card',
          locked      ? 'locked'    : '',
          isSuggested ? 'suggested' : '',
          extraCls,
        ].filter(Boolean).join(' ');
        return `<div class="${cls}" data-zone-id="${z.id}">
          <div class="rpg-zone-name">${_esc(z.name)}${clearStar}${_esc(lockTag)}</div>
          <div class="rpg-zone-meta">${lr}${_esc(mechNote)}</div>
        </div>`;
      };

      let html = '';
      for (let t = 1; t <= 10; t++) {
        const tier = byTier[t] || [];
        if (!tier.length) continue;
        html += `<div class="rpg-tier-heading">Tier ${t}</div>`;
        for (const z of tier) html += _zoneCard(z);
      }

      if (challenge.length) {
        html += '<div class="rpg-tier-heading">⚔ Challenge</div>';
        for (const z of challenge) html += _zoneCard(z, 'rarity-epic');
      }

      el.innerHTML = html;

      // Bind clicks on unlocked zones
      el.querySelectorAll('.rpg-zone-card:not(.locked)').forEach(card => {
        card.addEventListener('click', () => _startAdventure(card.dataset.zoneId));
      });
    } catch (err) {
      console.error('[RPGPanel] getZones error:', err);
      el.innerHTML = '<div class="rpg-empty-note">Error loading zones.</div>';
    }
  }

  async function _doRest() {
    if (_busy || _currentRun) return;
    _setBusy(true);
    try {
      const result = await window.rpgAPI.rest();
      if (result && result.ok) {
        await _refresh();
      }
    } catch (err) {
      console.error('[RPGPanel] rest error:', err);
    }
    _setBusy(false);
  }

  async function _doSuggestZone() {
    if (_busy) return;
    const banner = document.getElementById('rpg-zone-suggestion-banner');
    if (banner) {
      banner.style.display = 'block';
      banner.innerHTML = '<em style="color:#667;font-size:11px">Asking companion...</em>';
    }
    _setBusy(true);
    try {
      const result = await window.rpgAPI.suggestZone();
      if (!result || !result.ok) {
        if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }
        return;
      }
      _suggestedZoneId = result.zoneId;
      if (banner) {
        banner.innerHTML = `
          <div class="rpg-suggest-dialogue">"${_esc(result.dialogue)}"</div>
          <div class="rpg-suggest-actions">
            <button class="rpg-btn primary" id="rpg-btn-go-suggested">GO THERE</button>
            <button class="rpg-btn" id="rpg-btn-dismiss-suggest">DISMISS</button>
          </div>`;
        document.getElementById('rpg-btn-go-suggested').addEventListener('click', () => {
          if (_suggestedZoneId) _startAdventure(_suggestedZoneId);
        });
        document.getElementById('rpg-btn-dismiss-suggest').addEventListener('click', () => {
          _suggestedZoneId = null;
          if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }
          _renderZoneSelect();
        });
      }
      _renderZoneSelect(); // Re-render to highlight suggested zone
    } catch (err) {
      console.error('[RPGPanel] suggestZone error:', err);
      if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }
    }
    _setBusy(false);
  }

  async function _startAdventure(zoneId) {
    _setBusy(true);
    try {
      const result = await window.rpgAPI.startAdventure(zoneId);
      if (!result || !result.ok) {
        console.error('[RPGPanel] startAdventure failed:', result?.error);
        _setBusy(false);
        return;
      }
      _currentRun      = result.run;
      _suggestedZoneId = null; // clear suggestion once run starts
      _clearLog();
      _appendEvents(result.events || []);
      if (result.dailyBonus) {
        const xpMult  = result.dailyBonus.xpBonus  != null ? (1 + result.dailyBonus.xpBonus).toFixed(1)  : '?';
        const goldMult = result.dailyBonus.goldBonus != null ? result.dailyBonus.goldBonus.toFixed(1) : '?';
        _appendLog(`★ DAILY BONUS: XP ×${xpMult}  Gold ×${goldMult}`, 'level');
      }
      _updateStatusBar();
      _showScreen('combat');
      _renderCombat();
    } catch (err) {
      console.error('[RPGPanel] startAdventure error:', err);
    }
    _setBusy(false);
  }

  // ── Combat rendering ──────────────────────────────────────────────────────

  function _renderCombat() {
    if (!_currentRun) return;
    const run   = _currentRun;
    const floor = run.currentFloor;
    const phase = run.phase;

    const zoneLbl  = document.getElementById('rpg-zone-name-lbl');
    const floorLbl = document.getElementById('rpg-floor-lbl');
    if (zoneLbl)  zoneLbl.textContent  = run.zoneName || '—';
    if (floorLbl) floorLbl.textContent = floor
      ? `Floor ${floor.floorNum}/${run.totalFloors}`
      : `Floor ?/${run.totalFloors}`;

    const enemyCard = document.getElementById('rpg-enemy-card');
    const hasEnemy  = phase === 'combat' && floor && floor.enemy;
    if (enemyCard) enemyCard.style.display = hasEnemy ? '' : 'none';

    if (hasEnemy && enemyCard) {
      const e      = floor.enemy;
      const nameEl = document.getElementById('rpg-enemy-name');
      const hpFill = document.getElementById('rpg-enemy-hp-fill');
      const hpText = document.getElementById('rpg-enemy-hp-text');

      if (nameEl) {
        nameEl.textContent = (e.isShiny ? '★ ' : '') + (e.name || '?');
        nameEl.className   = 'rpg-enemy-name' +
          (e.isShiny ? ' shiny' : '') +
          (e.isBoss  ? ' boss'  : '');
      }
      const pct = e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp * 100) : 0;
      if (hpFill) hpFill.style.width    = pct + '%';
      if (hpText) hpText.textContent    = `${e.hp}/${e.maxHp}`;
    }

    _updateActionButtons(phase);
  }

  function _updateActionButtons(phase) {
    const ids = ['rpg-btn-fight', 'rpg-btn-flee', 'rpg-btn-item', 'rpg-btn-next', 'rpg-btn-extract'];
    for (const id of ids) {
      const b = document.getElementById(id);
      if (b) { b.style.display = 'none'; b.disabled = false; }
    }
    if (phase === 'combat') {
      _show('rpg-btn-fight');
      _show('rpg-btn-flee');
      _show('rpg-btn-item');
    } else if (phase === 'floor_complete') {
      _show('rpg-btn-next');
      _show('rpg-btn-extract');
    }
    // merchant phase: handled by merchant screen
  }

  function _show(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function _takeAction(action, payload = {}) {
    if (_busy) return;
    _setBusy(true);

    try {
      const result = await window.rpgAPI.takeAction(action, payload);

      if (!result || !result.ok) {
        console.error('[RPGPanel] takeAction failed:', result?.error);
        _setBusy(false);
        return;
      }

      _appendEvents(result.events || []);

      // Log level-ups
      if (result.levelUps && result.levelUps.length) {
        for (const lu of result.levelUps) {
          _appendLog(
            `★ LEVEL UP → Level ${lu.newLevel}! (+${lu.statPointsGained || 3} stat points)`,
            'level'
          );
        }
      }

      if (result.runDone) {
        // Run is complete — determine if already committed (extract) or needs commit (boss/death)
        if (result.run !== null && result.run !== undefined) {
          // Still in memory — commit it
          const runResult  = result.run.result || 'success';
          const endResult  = await window.rpgAPI.endRun(runResult);
          _currentRun = null;
          const state  = await window.rpgAPI.getState();
          _char        = state.character;
          _equipped    = state.equipped || [];
          _showRunEndScreen(result.run, endResult);
        } else {
          // Already committed (extract path)
          _currentRun = null;
          const state  = await window.rpgAPI.getState();
          _char        = state.character;
          _equipped    = state.equipped || [];
          _showRunEndScreen(null, result);
        }
        _updateStatusBar();
      } else if (result.run) {
        _currentRun = result.run;
        _updateStatusBar();
        const phase = result.run.phase;
        if (phase === 'merchant') {
          _renderMerchant();
          _showScreen('merchant');
        } else {
          _renderCombat();
          if (_screen !== 'combat') _showScreen('combat');
        }
      }
    } catch (err) {
      console.error('[RPGPanel] takeAction error:', err);
    }

    _setBusy(false);
  }

  // ── Combat log ────────────────────────────────────────────────────────────

  function _clearLog() {
    const el = document.getElementById('rpg-combat-log');
    if (el) el.innerHTML = '';
  }

  function _appendEvents(events) {
    if (!Array.isArray(events)) return;
    for (const ev of events) _processEvent(ev);
    _scrollLog();
  }

  function _processEvent(ev) {
    if (!ev || !ev.type) return;
    const { type } = ev;

    // Loot drop — use rarity colour
    if (type === 'loot_drop') {
      const rarCls   = _rarityLogClass(ev.rarity);
      const itemName = (ev.loot && ev.loot.item && ev.loot.item.name) || '?';
      _appendLog(`▶ [${(ev.rarity || '').toUpperCase()}] ${itemName}`, rarCls);
      return;
    }

    const msgFn  = LOG_MSG[type];
    const cls    = LOG_CLS[type] || 'system';
    if (msgFn) _appendLog(msgFn(ev), cls);
    else if (ev.message) _appendLog(`▶ ${ev.message}`, 'system');
  }

  // Maps for event → log text and CSS class
  const LOG_MSG = {
    zone_entered:    (e) => `▶ Entered ${e.zoneName} — ${e.totalFloors} floors`,
    floor_generated: (e) => `▶ Floor ${e.floorNum}: ${ROOM_LABELS[e.roomType] || e.roomType}`,
    floor_advanced:  (e) => `▶ Advancing to floor ${e.floorNum}...`,
    boss_imminent:   ()  => '▶ ☠ The boss awaits on the next floor!',
    enemy_generated: (e) => `▶ ${e.isShiny ? '★ SHINY ' : ''}${e.isBoss ? '☠ BOSS: ' : ''}${e.name} appears!`,
    player_attack:   (e) => `▶ You strike for ${e.damage} dmg${e.isCrit ? ' [CRIT!]' : ''}`,
    companion_assist:(e) => `▶ [Companion] assists — ${e.damage} dmg!`,
    enemy_attack:    (e) => `▶ ${e.enemyName || 'Enemy'} hits for ${e.damage} dmg${e.isCrit ? ' [CRIT!]' : ''}`,
    player_missed:   ()  => '▶ Your attack missed!',
    enemy_missed:    ()  => '▶ Enemy missed!',
    player_fled:     ()  => '▶ You escaped!',
    flee_failed:     ()  => '▶ Couldn\'t flee!',
    enemy_fled:      ()  => '▶ The enemy fled!',
    enemy_died:      (e) => `▶ ☠ ${e.name || 'Enemy'} defeated!  +${e.xp || 0} XP  ◆${e.gold || 0}`,
    level_up:        (e) => `★ LEVEL UP → ${e.newLevel}! (+${e.statPointsGained || 3} pts)`,
    player_died:     ()  => '☠ YOU HAVE FALLEN',
    rest_taken:      (e) => `▶ You rest and recover ${e.healAmount} HP.`,
    trap_triggered:  (e) => `▶ ⚠ Trap! ${e.damage} true damage.`,
    trap_avoided:    ()  => '▶ You avoided the trap!',
    treasure_found:  ()  => '▶ Found a treasure chest!',
    boss_floor:      ()  => '☠ BOSS FLOOR!',
    run_complete:    ()  => '★ RUN COMPLETE',
    extract:         ()  => '▶ You extract safely with your loot.',
    floor_complete:  ()  => '▶ Floor cleared. Continue or extract?',
    status_effect:   (e) => `▶ ${e.target || '?'}: ${e.effect || ''} (${e.damage || 0} dmg)`,
    item_purchased:  (e) => `▶ Purchased: ${e.item ? e.item.name : '?'} for ◆${e.price || 0}`,
  };

  const LOG_CLS = {
    zone_entered: 'system',  floor_generated: 'system', floor_advanced: 'system',
    boss_imminent:'crit',    enemy_generated: 'system', player_attack:  'player',
    companion_assist:'assist',enemy_attack:   'enemy',  player_missed:  'system',
    enemy_missed: 'system',  player_fled:     'system', flee_failed:    'enemy',
    enemy_fled:   'system',  enemy_died:      'player', level_up:       'level',
    player_died:  'enemy',   rest_taken:      'loot',   trap_triggered: 'enemy',
    trap_avoided: 'player',  treasure_found:  'loot',   boss_floor:     'crit',
    run_complete: 'level',   extract:         'system', floor_complete: 'system',
    status_effect:'enemy',   item_purchased:  'loot',
  };

  function _rarityLogClass(rarity) {
    const r = (rarity || '').toLowerCase();
    if (r === 'legendary') return 'crit';
    if (r === 'epic')      return 'level';
    if (r === 'rare')      return 'loot';
    return 'loot';
  }

  function _appendLog(text, cls) {
    const el = document.getElementById('rpg-combat-log');
    if (!el) return;
    const div = document.createElement('div');
    div.className   = 'log-entry ' + (cls || 'system');
    div.textContent = text;
    el.appendChild(div);
    // Keep log bounded
    while (el.children.length > 120) el.removeChild(el.firstChild);
  }

  function _scrollLog() {
    const el = document.getElementById('rpg-combat-log');
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }

  // ── Merchant ──────────────────────────────────────────────────────────────

  function _renderMerchant() {
    const el = document.getElementById('rpg-merchant-list');
    if (!el || !_currentRun) return;
    const items = (_currentRun.currentFloor && _currentRun.currentFloor.merchant)
      ? (_currentRun.currentFloor.merchant.items || [])
      : [];

    if (!items.length) {
      el.innerHTML = '<div class="rpg-empty-note">The merchant has nothing for sale.</div>';
      return;
    }

    el.innerHTML = items.map((item, idx) => {
      const rc        = RARITY_CLASS[(item.rarity || '').toLowerCase()] || 'rarity-common';
      const price     = item.buyPrice || 0;
      const canAfford = _char && (_char.gold || 0) >= price;
      return `<div class="rpg-item-card">
        <div class="rpg-item-name ${rc}">${_esc(item.name)}</div>
        <div class="rpg-item-meta">${_esc(item.slot)} · ${_esc(item.rarity)} · ◆ ${price}</div>
        <div class="rpg-item-actions" style="display:flex">
          <button class="rpg-btn" onclick="RPGPanel._merchantBuy(${idx})" ${canAfford ? '' : 'disabled'}>
            BUY ◆${price}
          </button>
        </div>
      </div>`;
    }).join('');

    // Click to expand/collapse actions
    el.querySelectorAll('.rpg-item-card').forEach(card => {
      card.addEventListener('click', () => card.classList.toggle('selected'));
    });
  }

  function _merchantBuy(idx) {
    _takeAction('buy_item', { itemIndex: idx });
  }

  // ── Run end ───────────────────────────────────────────────────────────────

  function _showRunEndScreen(runState, commitResult) {
    const el = document.getElementById('rpg-run-end-content');
    if (!el) return;

    const result    = (runState && runState.result) || commitResult?.result || 'extract';
    const isDeath   = result === 'death';
    const isSuccess = result === 'success';
    const zoneName  = (runState && runState.zoneName) || '—';
    const floors    = commitResult?.floorsCleared || 0;
    const kills     = commitResult?.kills || 0;
    const xpGained  = commitResult?.xpGained  || 0;
    const gold      = commitResult?.goldEarned || 0;
    const items     = commitResult?.itemsCommitted || 0;

    const label = isDeath ? '☠ FALLEN ☠' : isSuccess ? '★ VICTORY ★' : '✦ EXTRACTED ✦';
    const cls   = isDeath ? 'death' : 'victory';

    el.innerHTML = `
      <div class="rpg-run-result ${cls}">${label}</div>
      <div style="padding:0 0 8px">
        <div class="rpg-run-row"><span class="rpg-run-label">ZONE</span><span class="rpg-run-val">${_esc(zoneName)}</span></div>
        <div class="rpg-run-row"><span class="rpg-run-label">FLOORS</span><span class="rpg-run-val">${floors}</span></div>
        <div class="rpg-run-row"><span class="rpg-run-label">KILLS</span><span class="rpg-run-val">${kills}</span></div>
        <div class="rpg-run-row"><span class="rpg-run-label">XP GAINED</span><span class="rpg-run-val">+${xpGained.toLocaleString()}</span></div>
        <div class="rpg-run-row"><span class="rpg-run-label">GOLD EARNED</span><span class="rpg-run-val">◆ +${gold.toLocaleString()}</span></div>
        <div class="rpg-run-row">
          <span class="rpg-run-label">ITEMS</span>
          <span class="rpg-run-val" ${isDeath ? 'style="color:var(--red)"' : ''}>
            ${items} ${isDeath ? '(lost)' : 'committed'}
          </span>
        </div>
        ${isDeath ? '<div class="rpg-run-row"><span class="rpg-run-label" style="color:var(--red)">LOOT</span><span class="rpg-run-val" style="color:var(--red)">All forfeited</span></div>' : ''}
      </div>`;

    _showScreen('run-end');
  }

  function _onRunEndClose() {
    _currentRun = null;
    _clearLog();
    _showScreen('zone-select');
    _refresh();
  }

  // ── Character screen ──────────────────────────────────────────────────────

  function _renderCharacter() {
    const el = document.getElementById('rpg-char-content');
    if (!el || !_char) { if (el) el.innerHTML = '<div class="rpg-empty-note">No character data.</div>'; return; }

    const c     = _char;
    const maxHp = _maxHp(c.vit);
    const xpReq = _xpRequired(c.level);
    const pts   = c.stat_points || 0;

    const stats = [
      { k: 'str', l: 'STR', d: 'Melee damage scaling' },
      { k: 'int', l: 'INT', d: 'Magic/ranged damage'  },
      { k: 'agi', l: 'AGI', d: 'Dodge + turn order'   },
      { k: 'vit', l: 'VIT', d: `Max HP: ${maxHp}`     },
      { k: 'lck', l: 'LCK', d: 'Crit + loot rarity'  },
      { k: 'cha', l: 'CHA', d: 'Companion assist'     },
    ];

    let html = `
      <div style="padding:6px 0 4px">
        <div class="rpg-info-row"><span class="rpg-info-label">LEVEL</span>
          <span>${c.level}${c.prestige_count > 0 ? ` ✦ P${c.prestige_count}` : ''}</span></div>
        <div class="rpg-info-row"><span class="rpg-info-label">XP</span>
          <span>${(c.xp || 0).toLocaleString()} / ${xpReq.toLocaleString()}</span></div>
        <div class="rpg-info-row"><span class="rpg-info-label">HP</span>
          <span>${c.hp_current} / ${maxHp}</span></div>
        <div class="rpg-info-row"><span class="rpg-info-label">GOLD</span>
          <span>◆ ${(c.gold || 0).toLocaleString()}</span></div>
      </div>
      ${pts > 0 ? `<div class="rpg-pts-available">★ ${pts} stat point${pts !== 1 ? 's' : ''} to spend</div>` : ''}
      <div class="rpg-stat-grid">`;

    for (const s of stats) {
      const gearBonus = _equipped.reduce((sum, row) => {
        if (!row || !row.stats) return sum;
        try {
          const st = typeof row.stats === 'string' ? JSON.parse(row.stats) : (row.stats || {});
          return sum + (st[s.k] || 0);
        } catch { return sum; }
      }, 0);
      const base = c[s.k] || 0;
      const valText = gearBonus > 0 ? `${base}<span style="color:#00ff8866">+${gearBonus}</span>` : `${base}`;
      html += `
        <div class="rpg-stat-row" title="${s.d}">
          <span class="rpg-stat-label">${s.l}</span>
          <span class="rpg-stat-val">${valText}</span>
          <button class="rpg-stat-plus" onclick="RPGPanel._allocateStat('${s.k}')"
            ${pts > 0 ? '' : 'disabled'} title="Spend stat point on ${s.l}: ${s.d}">+</button>
        </div>`;
    }

    html += '</div>';

    const canPrestige = c.level >= 200;
    html += `
      <div class="rpg-prestige-section">
        <div class="rpg-section-label">PRESTIGE</div>
        <div style="font-size:9px;color:#00ffcc44;margin-bottom:6px">
          Resets level to 1 &amp; refunds all stat points. Gear and gold are kept.
        </div>
        <button class="rpg-btn primary" onclick="RPGPanel._doPrestige()" ${canPrestige ? '' : 'disabled'}>
          ${canPrestige ? 'PRESTIGE NOW' : `PRESTIGE (Need Lv 200)`}
        </button>
      </div>`;

    el.innerHTML = html;
  }

  function _allocateStat(stat) {
    if (_busy) return;
    _setBusy(true);
    window.rpgAPI.allocateStat(stat).then(result => {
      if (result && result.ok !== false) {
        return window.rpgAPI.getState().then(data => {
          _char     = data.character;
          _equipped = data.equipped || [];
          _renderCharacter();
          _updateStatusBar();
        });
      }
    }).catch(err => {
      console.error('[RPGPanel] allocateStat:', err);
    }).finally(() => { _setBusy(false); });
  }

  function _doPrestige() {
    if (_busy) return;
    if (!confirm('Prestige? Level resets to 1. All stat points refunded. Gear and gold kept.')) return;
    _setBusy(true);
    window.rpgAPI.prestige().then(result => {
      if (result && result.ok) {
        return window.rpgAPI.getState().then(data => {
          _char     = data.character;
          _equipped = data.equipped || [];
          _renderCharacter();
          _updateStatusBar();
        });
      } else {
        alert((result && result.error) || 'Prestige failed.');
      }
    }).catch(err => {
      console.error('[RPGPanel] prestige:', err);
    }).finally(() => { _setBusy(false); });
  }

  // ── Inventory screen ──────────────────────────────────────────────────────

  function _renderInventory() {
    const el = document.getElementById('rpg-inventory-content');
    if (!el) return;
    el.innerHTML = '<div class="rpg-empty-note">Loading gear...</div>';
    window.rpgAPI.getInventory().then(items => {
      RPGInventory.render(el, _char, _equipped, items || [], {
        onEquip:   (slot, id)  => _doEquip(slot, id),
        onUnequip: (slot)      => _doUnequip(slot),
        onSell:    (id, item)  => _doSell(id, item),
        onDrop:    (id)        => _doDrop(id),
      });
    }).catch(err => {
      console.error('[RPGPanel] getInventory:', err);
      el.innerHTML = '<div class="rpg-empty-note">Error loading gear.</div>';
    });
  }

  function _doEquip(slot, inventoryId) {
    window.rpgAPI.equipItem(slot, inventoryId).then(() => {
      return window.rpgAPI.getState();
    }).then(data => {
      _equipped = data.equipped || [];
      _renderInventory();
    }).catch(err => console.error('[RPGPanel] equip:', err));
  }

  function _doUnequip(slot) {
    window.rpgAPI.unequipSlot(slot).then(() => {
      return window.rpgAPI.getState();
    }).then(data => {
      _equipped = data.equipped || [];
      _renderInventory();
    }).catch(err => console.error('[RPGPanel] unequip:', err));
  }

  function _doSell(inventoryId, item) {
    const price = _sellPrice(item);
    if (!confirm(`Sell "${item.name}" for ◆${price} gold?`)) return;
    window.rpgAPI.sellItem(inventoryId, price).then(() => {
      return window.rpgAPI.getState();
    }).then(data => {
      _char     = data.character;
      _equipped = data.equipped || [];
      _updateStatusBar();
      _renderInventory();
    }).catch(err => console.error('[RPGPanel] sell:', err));
  }

  function _doDrop(inventoryId) {
    if (!confirm('Permanently destroy this item?')) return;
    window.rpgAPI.dropItem(inventoryId).then(() => {
      return window.rpgAPI.getState();
    }).then(data => {
      _equipped = data.equipped || [];
      _renderInventory();
    }).catch(err => console.error('[RPGPanel] drop:', err));
  }

  function _sellPrice(item) {
    const zl   = item.zone_level || 1;
    const mult = { common: 1, uncommon: 1.5, rare: 2.2, epic: 3.5, legendary: 6 };
    const m    = mult[(item.rarity || 'common').toLowerCase()] || 1;
    return Math.max(1, Math.floor(zl * m * 5 * 0.25));
  }

  // ── Achievements ──────────────────────────────────────────────────────────

  function _renderAchievements() {
    const el = document.getElementById('rpg-ach-list');
    if (!el) return;

    // Update tab highlights
    document.querySelectorAll('#rpg-panel .rpg-ach-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.bracket === _achBracket);
    });

    window.rpgAPI.getAchievements().then(rows => {
      const all      = Array.isArray(rows) ? rows : [];
      const filtered = all.filter(a => a.bracket === _achBracket);
      if (!filtered.length) {
        el.innerHTML = '<div class="rpg-empty-note">No achievements in this bracket.</div>';
        return;
      }
      // Unlocked first, then by order (hidden+locked last)
      const sorted = [...filtered].sort((a, b) => {
        if (a.unlocked !== b.unlocked) return b.unlocked - a.unlocked;
        if (a.hidden  !== b.hidden)   return a.hidden  ? 1 : -1;
        return 0;
      });
      el.innerHTML = sorted.map(a => {
        const isHiddenLocked = a.hidden && !a.unlocked;
        const icon = isHiddenLocked ? '?' : _esc(a.icon || '⚔');
        const name = isHiddenLocked ? '???' : _esc(a.name || _formatAchId(a.achievement_id));
        const desc = isHiddenLocked
          ? 'This achievement is hidden. Discover it through exploration.'
          : _esc(a.desc || '');
        const showProgress = !a.unlocked && (a.target || 1) > 1 && (a.progressRaw || 0) > 0;
        const progPct      = showProgress ? Math.min(100, a.progress || 0) : 0;
        const progText     = showProgress
          ? `${(a.progressRaw || 0).toLocaleString()} / ${(a.target || 1).toLocaleString()}`
          : '';
        return `<div class="rpg-ach-card ${a.unlocked ? 'unlocked' : ''} ${isHiddenLocked ? 'hidden-locked' : ''}">
          <div class="rpg-ach-header">
            <span class="rpg-ach-icon">${icon}</span>
            <span class="rpg-ach-name">${a.unlocked ? '★ ' : ''}${name}</span>
          </div>
          <div class="rpg-ach-desc">${desc}</div>
          ${showProgress ? `
            <div class="rpg-ach-progress">
              <div class="rpg-ach-progress-fill" style="width:${progPct}%"></div>
            </div>
            <div class="rpg-ach-prog-text">${progText}</div>` : ''}
          ${a.unlocked && a.unlocked_at
            ? `<div class="rpg-ach-prog-text">Unlocked: ${String(a.unlocked_at).split(' ')[0]}</div>`
            : ''}
        </div>`;
      }).join('');
    }).catch(() => {
      el.innerHTML = '<div class="rpg-empty-note">Error loading achievements.</div>';
    });
  }

  function _formatAchId(id) {
    return (id || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // ── Event bindings ────────────────────────────────────────────────────────

  function _bindStaticEvents() {
    document.getElementById('rpg-panel-close').addEventListener('click', close);

    // Nav tabs
    document.querySelectorAll('#rpg-panel .rpg-tab').forEach(btn => {
      btn.addEventListener('click', () => _showScreen(btn.dataset.tab));
    });

    // Achievement bracket tabs
    document.querySelectorAll('#rpg-panel .rpg-ach-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _achBracket = btn.dataset.bracket;
        _renderAchievements();
      });
    });

    // Pop-out windows
    document.querySelectorAll('#rpg-panel .rpg-popout-btn').forEach(btn => {
      btn.addEventListener('click', () => window.rpgAPI.openWindow(btn.dataset.win));
    });

    // Zone suggestion
    document.getElementById('rpg-btn-suggest-zone').addEventListener('click', _doSuggestZone);

    // Rest / heal outside of run
    document.getElementById('rpg-btn-rest').addEventListener('click', _doRest);

    // Combat action buttons
    document.getElementById('rpg-btn-fight').addEventListener('click',   () => _takeAction('fight'));
    document.getElementById('rpg-btn-flee').addEventListener('click',    () => _takeAction('flee'));
    document.getElementById('rpg-btn-item').addEventListener('click',    _noItems);
    document.getElementById('rpg-btn-next').addEventListener('click',    () => _takeAction('continue'));
    document.getElementById('rpg-btn-extract').addEventListener('click', () => _takeAction('extract'));

    // Merchant / run-end
    document.getElementById('rpg-btn-merchant-leave').addEventListener('click', () => _takeAction('continue'));
    document.getElementById('rpg-btn-run-end-close').addEventListener('click',  _onRunEndClose);
  }

  function _noItems() {
    _appendLog('▶ No usable items in bag.', 'system');
    _scrollLog();
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  function _setBusy(busy) {
    _busy = busy;
    document.querySelectorAll('#rpg-panel .rpg-btn').forEach(b => { b.disabled = busy; });
    // Re-show the correct combat buttons after un-busy
    if (!busy && _currentRun) _updateActionButtons(_currentRun.phase);
  }

  function _xpRequired(level) {
    return Math.floor(100 * Math.pow(level || 1, 1.5));
  }

  function _maxHp(vit) {
    const v = vit || 5;
    return 40 + Math.min(v, 300) * 8 + Math.max(0, v - 300) * 2;
  }

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    init,
    open,
    close,
    // Exposed for inline onclick handlers
    _allocateStat,
    _doPrestige,
    _merchantBuy,
  };

})();
