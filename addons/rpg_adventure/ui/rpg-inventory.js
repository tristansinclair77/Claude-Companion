'use strict';
/* global window, document */

// ── RPG Inventory UI — Phase 5 ────────────────────────────────────────────────
// Renders the equipped gear slots and inventory item list.
// Defines window.RPGInventory (global IIFE — browser renderer script).

const RPGInventory = (() => {

  const RARITY_CLASS = {
    common:    'rarity-common',
    uncommon:  'rarity-uncommon',
    rare:      'rarity-rare',
    epic:      'rarity-epic',
    legendary: 'rarity-legendary',
  };

  const SLOT_LABELS = {
    weapon:  'Weapon',
    head:    'Head',
    chest:   'Chest',
    hands:   'Hands',
    feet:    'Feet',
    belt:    'Belt',
    ring:    'Ring',
    amulet:  'Amulet',
    trinket: 'Trinket',
  };

  const SLOTS = ['weapon', 'head', 'chest', 'hands', 'feet', 'belt', 'ring', 'amulet', 'trinket'];

  let _cbs      = {};   // callbacks: { onEquip, onUnequip, onSell, onDrop }
  let _allItems = [];   // all inventory rows
  let _equipped = [];   // equipped slot rows from getState

  /**
   * Render the full inventory panel into `container`.
   * @param {HTMLElement} container
   * @param {object}      char      - character DB row (for future stat comparison)
   * @param {Array}       equipped  - equipped rows from rpg:get-state
   * @param {Array}       items     - all rpg:get-inventory rows
   * @param {object}      callbacks - { onEquip, onUnequip, onSell, onDrop }
   */
  function render(container, char, equipped, items, callbacks) {
    _cbs      = callbacks || {};
    _equipped = equipped  || [];
    _allItems = items     || [];

    // Build slot → equipped item lookup
    const slotMap = {};
    for (const row of _equipped) {
      if (row && row.slot && row.id) slotMap[row.slot] = row;
    }

    let html = '';

    // ── Equipped slots grid ───────────────────────────────────────────────
    html += '<div class="rpg-section-label">EQUIPPED</div>';
    html += '<div class="rpg-gear-grid">';
    for (const slot of SLOTS) {
      const item = slotMap[slot];
      const rc   = item ? (RARITY_CLASS[(item.rarity || '').toLowerCase()] || 'rarity-common') : '';
      html += `<div class="rpg-gear-slot${item ? '' : ' empty'}" data-slot="${slot}"
                    onclick="RPGInventory._clickSlot('${slot}')">
        <div class="rpg-gear-slot-label">${SLOT_LABELS[slot] || slot}</div>
        <div class="rpg-gear-slot-item ${rc}">${item ? _short(item.name) : '—'}</div>
      </div>`;
    }
    html += '</div>';

    // ── Inventory bag (unequipped items) ──────────────────────────────────
    html += '<div class="rpg-section-label">INVENTORY</div>';

    const bag = _allItems.filter(i => !i.is_equipped);

    if (!bag.length) {
      html += '<div class="rpg-empty-note">Bag is empty.</div>';
    } else {
      html += bag.map(item => {
        const rc        = RARITY_CLASS[(item.rarity || '').toLowerCase()] || 'rarity-common';
        const stats     = _parseStats(item.stats);
        const statStr   = Object.entries(stats)
          .filter(([, v]) => typeof v === 'number' && v !== 0)
          .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k.toUpperCase()}`)
          .join(' ');
        const passives   = _parsePassives(item.passives);
        const passiveStr = passives.length ? passives.slice(0, 2).join(', ') : '';
        const setTag     = item.set_id       ? ` [Set]` : '';
        const legTag     = item.legendary_id ? ' ★' : '';

        return `<div class="rpg-item-card" id="rpg-inv-${item.id}"
                     onclick="RPGInventory._clickItem(${item.id})">
          <div class="rpg-item-name ${rc}">${_esc(item.name)}${legTag ? `<span style="color:var(--orange)">${legTag}</span>` : ''}</div>
          <div class="rpg-item-meta">${_esc(item.slot)} · ${_esc(item.rarity)} · iLvl ${item.zone_level || 1}${statStr ? ' · ' + statStr : ''}${_esc(setTag)}</div>
          ${passiveStr ? `<div class="rpg-item-meta" style="color:#aa44ff88;font-style:italic">${_esc(passiveStr)}</div>` : ''}
          <div class="rpg-item-actions" id="rpg-inv-act-${item.id}">
            <button class="rpg-btn"
              onclick="event.stopPropagation();RPGInventory._equip(${item.id},'${item.slot}')">EQUIP</button>
            <button class="rpg-btn danger"
              onclick="event.stopPropagation();RPGInventory._sell(${item.id})">SELL</button>
            <button class="rpg-btn danger"
              onclick="event.stopPropagation();RPGInventory._drop(${item.id})">DROP</button>
          </div>
        </div>`;
      }).join('');
    }

    container.innerHTML = html;
  }

  // ── Slot click — unequip ─────────────────────────────────────────────────

  function _clickSlot(slot) {
    const row = _equipped.find(e => e.slot === slot);
    if (!row || !row.id) return; // slot already empty
    if (_cbs.onUnequip) _cbs.onUnequip(slot);
  }

  // ── Item click — expand / collapse action row + comparison ──────────────

  function _clickItem(id) {
    // Remove any existing comparison panel
    document.querySelectorAll('.rpg-inv-compare').forEach(el => el.remove());

    // Deselect everything
    document.querySelectorAll('#rpg-inventory-content .rpg-item-card').forEach(c => {
      c.classList.remove('selected');
      const a = c.querySelector('.rpg-item-actions');
      if (a) a.style.display = 'none';
    });

    const card    = document.getElementById(`rpg-inv-${id}`);
    const actions = document.getElementById(`rpg-inv-act-${id}`);
    if (card)    card.classList.add('selected');
    if (actions) actions.style.display = 'flex';

    // Build comparison with currently equipped item in the same slot
    const item = _allItems.find(i => i.id === id);
    if (!item || !card) return;

    const equippedItem = _equipped.find(e => e.slot === item.slot && e.id);
    const newTotal     = _statTotal(item);
    const eqTotal      = equippedItem ? _statTotal(equippedItem) : 0;

    let glowColor, deltaLabel;
    if (!equippedItem) {
      glowColor  = 'var(--green)';
      deltaLabel = 'Nothing equipped in this slot';
    } else if (newTotal > eqTotal) {
      glowColor  = 'var(--green)';
      deltaLabel = `▲ +${newTotal - eqTotal} total stats vs equipped`;
    } else if (newTotal < eqTotal) {
      glowColor  = 'var(--red)';
      deltaLabel = `▼ ${newTotal - eqTotal} total stats vs equipped`;
    } else {
      glowColor  = 'var(--yellow)';
      deltaLabel = '= Same total stats as equipped';
    }

    const cmp = document.createElement('div');
    cmp.className = 'rpg-inv-compare';
    cmp.style.cssText = `border:1px solid ${glowColor};box-shadow:0 0 10px ${glowColor}55;margin:3px 0 0 0;padding:6px 8px;border-radius:2px;background:#05050f`;

    if (!equippedItem) {
      cmp.innerHTML = `
        <div class="rpg-inv-compare-label" style="color:${glowColor}">${_esc(deltaLabel)}</div>`;
    } else {
      const rc      = RARITY_CLASS[(equippedItem.rarity || '').toLowerCase()] || 'rarity-common';
      const stats   = _parseStats(equippedItem.stats);
      const statStr = Object.entries(stats)
        .filter(([, v]) => typeof v === 'number' && v !== 0)
        .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k.toUpperCase()}`)
        .join(' ');
      cmp.innerHTML = `
        <div class="rpg-inv-compare-label" style="color:${glowColor}">${_esc(deltaLabel)}</div>
        <div class="rpg-item-name ${rc}" style="font-size:10px;margin-top:4px">${_esc(equippedItem.name)}</div>
        <div class="rpg-item-meta">${_esc(equippedItem.slot)} · ${_esc(equippedItem.rarity)} · iLvl ${equippedItem.zone_level || 1}${statStr ? ' · ' + statStr : ''}</div>`;
    }

    card.after(cmp);
  }

  // ── Equip / sell / drop ──────────────────────────────────────────────────

  function _equip(id, slot) {
    if (_cbs.onEquip) _cbs.onEquip(slot, id);
  }

  function _sell(id) {
    const item = _allItems.find(i => i.id === id);
    if (item && _cbs.onSell) _cbs.onSell(id, item);
  }

  function _drop(id) {
    if (_cbs.onDrop) _cbs.onDrop(id);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _short(name) {
    return (name && name.length > 18) ? name.slice(0, 16) + '…' : (name || '?');
  }

  function _parseStats(raw) {
    if (!raw) return {};
    try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); }
    catch { return {}; }
  }

  function _parsePassives(raw) {
    if (!raw) return [];
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
      if (!Array.isArray(arr)) return [];
      return arr.map(p => (typeof p === 'string' ? p : (p.name || p.id || '')));
    } catch { return []; }
  }

  function _statTotal(item) {
    const stats = _parseStats(item.stats);
    return Object.values(stats)
      .filter(v => typeof v === 'number')
      .reduce((sum, v) => sum + v, 0);
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
    render,
    // Exposed for inline onclick handlers in injected HTML
    _clickSlot,
    _clickItem,
    _equip,
    _sell,
    _drop,
  };

})();
