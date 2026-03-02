'use strict';

// ── RPG IPC — Phase 2 + Phase 3 ───────────────────────────────────────────────
// Registers all IPC handlers for the RPG addon.
// Manages the in-memory run state machine. DB writes happen at run end.

const path               = require('path');
const fs                 = require('fs');
const { BrowserWindow }  = require('electron');
const RpgDB              = require('./rpg-db');
const engine       = require('./rpg-engine');
const narrator     = require('./rpg-narrator');
const achievements = require('./rpg-achievements');
const { ZONES, CHALLENGE_ZONES, SCENARIO_KEYS, TIER_COUNTS } = require('./rpg-constants');

let rpgDb     = null;
let activeRun = null; // In-memory run state (null when no run in progress)

/**
 * Called by the addon loader in main.js.
 * @param {object} ctx
 * @param {Electron.IpcMain} ctx.ipcMain
 * @param {string} ctx.characterDir
 */
function register({ ipcMain, characterDir }) {
  const dbPath = path.join(characterDir, 'rpg.db');
  rpgDb = new RpgDB(dbPath).open();
  narrator.init(rpgDb, characterDir);
  achievements.init(rpgDb);
  console.log('[RPG] IPC registered. DB at:', dbPath);

  // ── State ──────────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-state', () => {
    const character = rpgDb.getCharacter();
    const equipped  = rpgDb.getEquipped();
    return {
      character,
      equipped,
      activeRun: activeRun ? _serializeRun(activeRun) : null,
    };
  });

  // ── Inventory ──────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-inventory', () => {
    return rpgDb.getInventory();
  });

  ipcMain.handle('rpg:equip-item', (_e, { slot, inventoryId }) => {
    try {
      rpgDb.equipItem(slot, inventoryId);
      const char    = rpgDb.getCharacter();
      const equipped = rpgDb.getEquipped();
      const achEquip = achievements.onEquip(equipped, char);
      return { ok: true, achievementsUnlocked: achEquip };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('rpg:unequip-slot', (_e, { slot }) => {
    rpgDb.unequipSlot(slot);
    return { ok: true };
  });

  ipcMain.handle('rpg:sell-item', (_e, { inventoryId, gold }) => {
    rpgDb.removeItem(inventoryId);
    const char = rpgDb.getCharacter();
    rpgDb.updateCharacter({ gold: char.gold + (gold || 0) });
    return { ok: true };
  });

  ipcMain.handle('rpg:drop-item', (_e, { inventoryId }) => {
    rpgDb.removeItem(inventoryId);
    return { ok: true };
  });

  // ── Zones ──────────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-zones', () => {
    const clearedZoneIds = rpgDb.getClearedZoneIds();
    return { zones: ZONES, challengeZones: CHALLENGE_ZONES, clearedZoneIds };
  });

  ipcMain.handle('rpg:suggest-zone', async () => {
    try {
      const char     = rpgDb.getCharacter();
      // Only offer zones the player can actually enter
      const available = [...ZONES, ...CHALLENGE_ZONES].filter(
        z => char.level >= (z.charLevelReq || 1)
      );
      if (!available.length) return { ok: false, error: 'No zones available at your level' };

      const suggestion = await narrator.suggestZone(char, available);
      return { ok: true, ...suggestion };
    } catch (err) {
      console.error('[RPG] suggest-zone error:', err);
      return { ok: false, error: err.message };
    }
  });

  // ── Stat allocation ────────────────────────────────────────────────────────

  ipcMain.handle('rpg:allocate-stat', (_e, { stat }) => {
    const char = rpgDb.getCharacter();
    if (char.stat_points < 1) return { ok: false, error: 'No stat points available' };
    const validStats = ['str', 'int', 'agi', 'vit', 'lck', 'cha'];
    if (!validStats.includes(stat)) return { ok: false, error: 'Invalid stat' };
    rpgDb.updateCharacter({
      [stat]:      char[stat] + 1,
      stat_points: char.stat_points - 1,
    });
    const updatedChar = rpgDb.getCharacter();
    const achStat = achievements.onStatAllocate(updatedChar);
    return { ok: true, achievementsUnlocked: achStat };
  });

  // ── Run History ────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-run-history', (_e, { limit } = {}) => {
    return rpgDb.getRunHistory(limit || 20);
  });

  // ── Achievements ───────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-achievements', () => {
    return achievements.getAll();
  });

  // ── DevTools ───────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:open-devtools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.webContents.openDevTools({ mode: 'detach' });
    return { ok: true };
  });

  // ── Pop-out windows ────────────────────────────────────────────────────────

  ipcMain.handle('rpg:open-window', (_e, { type }) => {
    const FILES = {
      adventure: path.join(__dirname, '../ui/windows/rpg-adventure.html'),
      char:      path.join(__dirname, '../ui/windows/rpg-char.html'),
      gear:      path.join(__dirname, '../ui/windows/rpg-gear.html'),
      ach:       path.join(__dirname, '../ui/windows/rpg-ach.html'),
    };
    if (!FILES[type]) return { ok: false, error: 'Unknown window type' };
    _openRpgWindow(type, FILES[type]);
    return { ok: true };
  });

  // ── Rest (heal to full outside of run) ────────────────────────────────────

  ipcMain.handle('rpg:rest', () => {
    if (activeRun) return { ok: false, error: 'Cannot rest during an active run' };
    const char  = rpgDb.getCharacter();
    const maxHp = engine.maxHP(char.vit);
    rpgDb.updateCharacter({ hp_current: maxHp });
    return { ok: true, newHp: maxHp };
  });

  // ── Prestige ───────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:prestige', () => {
    const char = rpgDb.getCharacter();
    if (char.level < 200) {
      return { ok: false, error: 'Must reach level 200 to prestige' };
    }
    const totalStats = char.str + char.int + char.agi + char.vit + char.lck + char.cha;
    const newPrestigeCount = char.prestige_count + 1;
    rpgDb.updateCharacter({
      level:          1,
      xp:             0,
      stat_points:    totalStats - 30, // base 5×6 = 30 are free, refund the rest
      str: 5, int: 5, agi: 5, vit: 5, lck: 5, cha: 5,
      prestige_count: newPrestigeCount,
      hp_current:     80, // reset to base starting HP
    });
    const achPrestige = achievements.onPrestige(newPrestigeCount);
    return { ok: true, prestigeCount: newPrestigeCount, achievementsUnlocked: achPrestige };
  });

  // ── Responses ──────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-responses', (_e, { scenarioKey }) => {
    return rpgDb.getResponses(scenarioKey);
  });

  ipcMain.handle('rpg:refresh-responses', (_e, { scenarioKey }) => {
    rpgDb.wipeResponses(scenarioKey);
    return { ok: true };
  });

  // ── Narrator: get companion response for a scenario key ────────────────────
  // Generates pool via Claude if empty, then picks from pool.
  // Force-Claude keys always generate fresh real-time responses.

  ipcMain.handle('rpg:get-scenario-response', async (_e, { key, gameState } = {}) => {
    try {
      const response = await narrator.getResponse(key || '', gameState || {});
      return { ok: true, response };
    } catch (err) {
      console.error('[RPG] get-scenario-response error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('rpg:generate-response-pool', async (_e, { key, gameState } = {}) => {
    try {
      const responses = await narrator.generateResponsePool(key || '', gameState || {});
      return { ok: true, count: responses.length };
    } catch (err) {
      console.error('[RPG] generate-response-pool error:', err);
      return { ok: false, error: err.message };
    }
  });

  // ── Adventure: Start Run ───────────────────────────────────────────────────

  ipcMain.handle('rpg:start-adventure', (_e, { zoneId }) => {
    try {
      // Find zone
      const zone = ZONES.find(z => z.id === zoneId) ||
                   CHALLENGE_ZONES.find(z => z.id === zoneId);
      if (!zone) return { ok: false, error: `Unknown zone: ${zoneId}` };

      // Load character + equipped gear
      const char     = rpgDb.getCharacter();
      const equipped = rpgDb.getEquipped();

      // Check char level requirement
      if (char.level < zone.charLevelReq) {
        return { ok: false, error: `Need character level ${zone.charLevelReq} for this zone.` };
      }

      // Check daily bonus (first run of the day)
      const bonusData = _checkDailyBonus(char);
      if (bonusData.isNewDay) {
        rpgDb.updateCharacter({
          daily_streak:   char.daily_streak + 1,
          last_play_date: new Date().toISOString().split('T')[0],
        });
      }

      // Start run
      const equippedWithGear  = equipped.filter(e => e.inventory_id);
      const startedWithNoGear = equippedWithGear.length === 0;
      const isFirstRun        = char.total_runs === 0;

      achievements.resetRun({ startedWithNoGear, isFirstRun });

      const { runState, events } = engine.startRun(char, zone, equipped, bonusData.bonus);
      activeRun = runState;

      // Track in DB: increment total_runs
      rpgDb.updateCharacter({ total_runs: char.total_runs + 1 });

      // Achievement checks for run-start events
      const achUnlocked = achievements.processEvents(events, activeRun, char);

      return {
        ok:         true,
        run:        _serializeRun(activeRun),
        events,
        dailyBonus: bonusData.isNewDay ? bonusData.bonus : null,
        scenario:   `zone_enter_tier${zone.tier}`,
        achievementsUnlocked: achUnlocked,
      };
    } catch (err) {
      console.error('[RPG] start-adventure error:', err);
      return { ok: false, error: err.message };
    }
  });

  // ── Adventure: Take Action ─────────────────────────────────────────────────

  ipcMain.handle('rpg:take-action', (_e, { action, payload = {} }) => {
    try {
      if (!activeRun) return { ok: false, error: 'No active run' };

      const phase = activeRun.phase;

      // ── Combat actions ────────────────────────────────────────────────────
      if (phase === 'combat') {
        if (action !== 'fight' && action !== 'flee' && action !== 'use_item') {
          return { ok: false, error: `Invalid action in combat: ${action}` };
        }

        if (action === 'use_item') {
          return { ok: false, error: 'Consumable items not yet implemented' };
        }

        const { runState, events, levelUps } = engine.runCombatTurn(activeRun, action);
        activeRun = runState;

        // Apply level-ups to DB immediately
        const levelUpResults = [];
        if (levelUps.length > 0) {
          const char     = rpgDb.getCharacter();
          let   newLevel = char.level;
          let   totalPts = char.stat_points;

          for (const lu of levelUps) {
            if (lu.newLevel > newLevel) {
              newLevel = lu.newLevel;
              totalPts += lu.statPointsGained;
              levelUpResults.push(lu);
            }
          }

          rpgDb.updateCharacter({
            level:       newLevel,
            stat_points: totalPts,
          });

          // Update char snapshot in run
          activeRun.charSnapshot.level = newLevel;
        }

        // Achievement checks after combat turn
        const char2 = rpgDb.getCharacter();
        const achUnlocked2 = achievements.processEvents(events, activeRun, char2);

        return {
          ok:         true,
          run:        _serializeRun(activeRun),
          events,
          levelUps:   levelUpResults,
          runDone:    activeRun.phase === 'run_complete',
          achievementsUnlocked: achUnlocked2,
        };
      }

      // ── Floor-complete actions ─────────────────────────────────────────────
      if (phase === 'floor_complete') {
        if (action === 'extract') {
          return _doExtract();
        }
        if (action === 'continue') {
          return _doAdvanceFloor();
        }
        return { ok: false, error: `Invalid action in floor_complete: ${action}` };
      }

      // ── Merchant actions ───────────────────────────────────────────────────
      if (phase === 'merchant') {
        if (action === 'buy_item') {
          return _doBuyItem(payload);
        }
        if (action === 'continue') {
          const floor = activeRun.floors[activeRun.currentFloorIdx];
          floor.completed  = true;
          activeRun.phase  = 'floor_complete';
          return _doAdvanceFloor();
        }
        return { ok: false, error: `Invalid action in merchant: ${action}` };
      }

      // ── Run-complete ───────────────────────────────────────────────────────
      if (phase === 'run_complete') {
        return { ok: false, error: 'Run is complete — call rpg:end-run to commit.' };
      }

      return { ok: false, error: `Unknown phase: ${phase}` };
    } catch (err) {
      console.error('[RPG] take-action error:', err);
      return { ok: false, error: err.message };
    }
  });

  // ── Adventure: End Run ─────────────────────────────────────────────────────

  ipcMain.handle('rpg:end-run', (_e, { result } = {}) => {
    try {
      if (!activeRun) return { ok: false, error: 'No active run to end' };

      const finalResult = result || activeRun.result || 'extract';
      const runResult   = _commitRun(finalResult);
      activeRun         = null;
      return { ok: true, ...runResult };
    } catch (err) {
      console.error('[RPG] end-run error:', err);
      return { ok: false, error: err.message };
    }
  });

  // ── Batch: Run-end bundle ──────────────────────────────────────────────────
  // Returns all pending run rewards without committing — used by UI to display summary.

  ipcMain.handle('rpg:run-end-bundle', () => {
    if (!activeRun) return { ok: false, error: 'No active run' };
    return {
      ok:           true,
      result:       activeRun.result,
      xpBag:        activeRun.xpBag,
      goldBag:      activeRun.goldBag,
      lootBag:      activeRun.lootBag,
      kills:        activeRun.kills,
      floorsCleared: activeRun.currentFloorIdx + 1,
      zoneId:       activeRun.zoneId,
      zoneName:     activeRun.zone.name,
      zoneLevel:    activeRun.zoneLevel,
    };
  });

  // ── Level-up bundle ────────────────────────────────────────────────────────
  // Returns post-level-up stat snapshot (called by UI after receiving level_up event).

  ipcMain.handle('rpg:level-up-bundle', () => {
    const char = rpgDb.getCharacter();
    const nextXP = engine.xpRequired(char.level);
    return {
      ok:           true,
      newLevel:     char.level,
      statPoints:   char.stat_points,
      xpToNext:     nextXP,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function _doAdvanceFloor() {
  const nextIdx = activeRun.currentFloorIdx + 1;
  if (nextIdx >= activeRun.floors.length) {
    // Already at last floor — run should be done
    return { ok: false, error: 'No more floors' };
  }

  activeRun.currentFloorIdx = nextIdx;
  activeRun.phase = 'floor_start';

  // One floor before boss
  const isBossNext = activeRun.floors[nextIdx].isBossFloor;
  const isPreBoss  = !isBossNext && nextIdx === activeRun.floors.length - 2;

  const { events } = engine.resolveFloorRoom(activeRun);
  const allEvents  = events;

  if (isPreBoss) {
    allEvents.push({ type: 'boss_imminent', scenario: 'floor_boss_imminent' });
  }
  allEvents.push({ type: 'floor_advanced', floorNum: activeRun.floors[nextIdx].floorNum,
                   scenario: 'floor_advance' });

  const char3 = rpgDb.getCharacter();
  const achUnlocked3 = achievements.processEvents(allEvents, activeRun, char3);

  return {
    ok:     true,
    run:    _serializeRun(activeRun),
    events: allEvents,
    runDone: activeRun.phase === 'run_complete',
    achievementsUnlocked: achUnlocked3,
  };
}

function _doExtract() {
  activeRun.result = 'extract';
  activeRun.phase  = 'run_complete';
  const runResult  = _commitRun('extract');
  activeRun        = null;
  return {
    ok:       true,
    run:      null,
    events:   [{ type: 'run_complete', result: 'extract', scenario: 'run_extract_success' }],
    runDone:  true,
    ...runResult,
  };
}

function _doBuyItem({ itemIndex }) {
  const floor = activeRun.floors[activeRun.currentFloorIdx];
  if (!floor.merchant || !floor.merchant.items) {
    return { ok: false, error: 'No merchant in this room' };
  }
  const item = floor.merchant.items[itemIndex];
  if (!item) return { ok: false, error: 'Item not found' };

  const char = rpgDb.getCharacter();
  const price = item.buyPrice || 0;
  if (char.gold < price) {
    return { ok: false, error: `Not enough gold (need ${price}, have ${char.gold})` };
  }

  // Deduct gold and add item to inventory
  rpgDb.updateCharacter({ gold: char.gold - price });
  const invId = rpgDb.addItem({
    item_id:      item.item_id,
    name:         item.name,
    slot:         item.slot,
    rarity:       item.rarity,
    zone_level:   item.zone_level,
    stats:        item.stats,
    passives:     item.passives || '[]',
    set_id:       item.set_id || null,
    legendary_id: item.legendary_id || null,
  });

  // Remove from merchant stock
  floor.merchant.items.splice(itemIndex, 1);

  // Naked run: buying gear counts as gaining gear mid-run
  const purchaseEvents = [{ type: 'item_purchased', item, price, scenario: 'item_sold' }];
  const char4 = rpgDb.getCharacter();
  const achPurchase = achievements.processEvents(purchaseEvents, activeRun, char4);

  return {
    ok:       true,
    inventoryId: invId,
    goldSpent:   price,
    newGold:     char4.gold,
    run:         _serializeRun(activeRun),
    events:      purchaseEvents,
    achievementsUnlocked: achPurchase,
  };
}

/**
 * Commit run rewards to the DB.
 * On death: XP/gold/loot lost. On extract/success: everything committed.
 */
function _commitRun(result) {
  if (!activeRun) return {};

  const char    = rpgDb.getCharacter();
  const isDeath = result === 'death';

  const committedItems = [];
  let   goldEarned     = 0;

  if (!isDeath) {
    // Add loot to DB inventory
    for (const item of activeRun.lootBag) {
      const id = rpgDb.addItem({
        item_id:      item.item_id,
        name:         item.name,
        slot:         item.slot,
        rarity:       item.rarity,
        zone_level:   item.zone_level,
        stats:        item.stats,
        passives:     item.passives || '[]',
        set_id:       item.set_id || null,
        legendary_id: item.legendary_id || null,
      });
      committedItems.push({ ...item, id });
    }

    // Add gold
    goldEarned = activeRun.goldBag;
    rpgDb.updateCharacter({ gold: char.gold + goldEarned });
  }

  // XP commit: recompute from run-start snapshot to avoid double-counting.
  // Mid-run level-up writes already updated `level` + `stat_points` but never `xp`,
  // so we must loop from the original level to correctly subtract XP costs.
  if (!isDeath) {
    const origLevel = activeRun.charSnapshot.level;
    const origXP    = activeRun.charSnapshot.xp;
    let   xpPool    = origXP + activeRun.xpBag;
    let   lv        = origLevel;
    while (lv < 200 && xpPool >= engine.xpRequired(lv)) {
      xpPool -= engine.xpRequired(lv);
      lv++;
    }
    rpgDb.updateCharacter({ xp: xpPool, level: lv });
  }

  // Update kill counts and restore HP to full (auto-rest after every run)
  rpgDb.updateCharacter({
    total_kills: char.total_kills + activeRun.kills,
    hp_current:  engine.maxHP(char.vit),
  });

  // Save run to history
  const floorsCleared = activeRun.floors.filter(f => f.completed).length;
  rpgDb.addRunHistory({
    zone_id:         activeRun.zoneId,
    zone_name:       activeRun.zone.name,
    zone_level:      activeRun.zoneLevel,
    result,
    floors_cleared:  floorsCleared,
    kills:           activeRun.kills,
    gold_earned:     goldEarned,
    loot_ids:        JSON.stringify(committedItems.map(i => i.id)),
    character_level: char.level,
    prestige_count:  char.prestige_count,
    duration_ms:     Date.now() - (activeRun.startedAt || Date.now()),
  });

  // Notify gear pop-out to refresh if it's open and items were committed
  if (!isDeath && committedItems.length > 0) {
    const gearWin = _openWindows.gear;
    if (gearWin && !gearWin.isDestroyed()) {
      gearWin.webContents.send('rpg:inventory-changed');
    }
  }

  // Achievement end-of-run checks (after DB commit so run_history queries work)
  const freshChar = rpgDb.getCharacter();
  const committedIds = committedItems.map(i => i.id);
  const achEnd = achievements.onRunEnd(result, activeRun, freshChar, committedIds);

  return {
    result,
    goldEarned,
    itemsCommitted:  committedItems.length,
    xpGained:        isDeath ? 0 : activeRun.xpBag,
    kills:           activeRun.kills,
    floorsCleared,
    scenario: result === 'success' ? 'companion_debrief_success' :
              result === 'death'   ? 'companion_debrief_death'   :
                                    'companion_debrief_extract',
    achievementsUnlocked: achEnd,
  };
}

function _checkDailyBonus(char) {
  const today     = new Date().toISOString().split('T')[0];
  const lastDate  = char.last_play_date;
  const isNewDay  = lastDate !== today;
  const streak    = isNewDay ? (char.daily_streak || 0) : 0;
  const bonus     = isNewDay ? engine.dailyBonus(streak + 1) : null;
  return { isNewDay, bonus };
}

/** Serialize run state for IPC (omit large data, keep essentials). */
function _serializeRun(run) {
  if (!run) return null;
  const floor = run.floors[run.currentFloorIdx];
  return {
    zoneId:      run.zoneId,
    zoneName:    run.zone.name,
    zoneTier:    run.zone.tier,
    zoneLevel:   run.zoneLevel,
    phase:       run.phase,
    result:      run.result,
    playerHp:    run.playerHp,
    playerMaxHp: run.playerMaxHp,
    playerStatusEffects: run.playerStatusEffects,
    combatTurn:  run.combatTurn,
    currentFloor: floor ? {
      floorNum:    floor.floorNum,
      roomType:    floor.roomType,
      isBossFloor: floor.isBossFloor,
      completed:   floor.completed,
      enemy:       floor.enemy ? {
        id:       floor.enemy.id,
        name:     floor.enemy.name,
        hp:       floor.enemy.hp,
        maxHp:    floor.enemy.maxHp,
        atk:      floor.enemy.atk,
        def:      floor.enemy.def,
        agi:      floor.enemy.agi,
        isShiny:  floor.enemy.isShiny,
        isBoss:   floor.enemy.isBoss,
        abilities: floor.enemy.abilities || [],
        statusEffects: floor.enemy.statusEffects || [],
      } : null,
      merchant: floor.merchant || null,
      loot:     floor.loot || null,
      trap:     floor.trap || null,
      rest:     floor.rest || null,
    } : null,
    totalFloors:    run.floors.length,
    floorsComplete: run.floors.filter(f => f.completed).length,
    kills:          run.kills,
    xpBag:          run.xpBag,
    goldBag:        run.goldBag,
    lootBagCount:   run.lootBag.length,
    dailyBonus:     run.dailyBonus,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pop-out window helpers
// ─────────────────────────────────────────────────────────────────────────────

const _openWindows = {};

function _openRpgWindow(type, htmlFile) {
  if (_openWindows[type]) {
    _openWindows[type].focus();
    return;
  }
  const bounds = _loadWinBounds(type);
  const win = new BrowserWindow({
    ...bounds,
    minWidth:  340,
    minHeight: 480,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../../../src/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: `RPG — ${type}`,
  });
  win.setMenu(null);
  win.loadFile(htmlFile);
  // F12 opens DevTools in frameless pop-out windows (no menu bar shortcut)
  win.webContents.on('before-input-event', (_ev, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });
  win.webContents.on('did-finish-load', () => {
    try {
      const cfg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config.json'), 'utf8'));
      const zoom = cfg.zoom || 100;
      win.webContents.setZoomFactor(zoom / 100);
    } catch { /* ignore */ }
  });
  _openWindows[type] = win;
  win.on('closed', () => { delete _openWindows[type]; });
  win.on('close', () => _saveWinBounds(type, win));
  win.on('closed', () => { delete _openWindows[type]; });
}

function _loadWinBounds(type) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config.json'), 'utf8'));
    const saved = (cfg.rpgWinBounds || {})[type];
    if (saved) return saved;
  } catch {}
  return type === 'adventure' ? { width: 480, height: 720 } : { width: 400, height: 600 };
}

function _saveWinBounds(type, win) {
  try {
    const cfgPath = path.join(__dirname, '../../../config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (!cfg.rpgWinBounds) cfg.rpgWinBounds = {};
    cfg.rpgWinBounds[type] = win.getBounds();
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  } catch {}
}

module.exports = { register };
