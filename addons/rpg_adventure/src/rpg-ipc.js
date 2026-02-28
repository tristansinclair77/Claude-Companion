'use strict';

// ── RPG IPC — Phase 2 ─────────────────────────────────────────────────────────
// Registers all IPC handlers for the RPG addon.
// Full implementation begins Phase 2.

const path  = require('path');
const RpgDB = require('./rpg-db');

let rpgDb = null;

/**
 * Called by the addon loader in main.js.
 * @param {object} ctx
 * @param {Electron.IpcMain} ctx.ipcMain
 * @param {string} ctx.characterDir — path to active character directory
 */
function register({ ipcMain, characterDir }) {
  const dbPath = path.join(characterDir, 'rpg.db');
  rpgDb = new RpgDB(dbPath).open();
  console.log('[RPG] IPC registered. DB at:', dbPath);

  // ── State ──────────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-state', () => {
    const character = rpgDb.getCharacter();
    const equipped  = rpgDb.getEquipped();
    return { character, equipped };
  });

  // ── Inventory ──────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-inventory', () => {
    return rpgDb.getInventory();
  });

  ipcMain.handle('rpg:equip-item', (_e, { slot, inventoryId }) => {
    rpgDb.equipItem(slot, inventoryId);
    return { ok: true };
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
    const { ZONES, CHALLENGE_ZONES } = require('./rpg-constants');
    return { zones: ZONES, challengeZones: CHALLENGE_ZONES };
  });

  // ── Stat allocation ────────────────────────────────────────────────────────

  ipcMain.handle('rpg:allocate-stat', (_e, { stat }) => {
    const char = rpgDb.getCharacter();
    if (char.stat_points < 1) return { ok: false, error: 'No stat points available' };
    const validStats = ['str', 'int', 'agi', 'vit', 'lck', 'cha'];
    if (!validStats.includes(stat)) return { ok: false, error: 'Invalid stat' };
    rpgDb.updateCharacter({
      [stat]: char[stat] + 1,
      stat_points: char.stat_points - 1,
    });
    return { ok: true };
  });

  // ── Run History ────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-run-history', (_e, { limit } = {}) => {
    return rpgDb.getRunHistory(limit || 20);
  });

  // ── Achievements ───────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-achievements', () => {
    return rpgDb.getAllAchievements();
  });

  // ── Prestige ───────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:prestige', () => {
    const char = rpgDb.getCharacter();
    if (char.level < 200) {
      return { ok: false, error: 'Must reach level 200 to prestige' };
    }
    const totalStats = char.str + char.int + char.agi + char.vit + char.lck + char.cha;
    // Reset level + XP + stat points; refund all stat points; keep gold, gear, kills
    rpgDb.updateCharacter({
      level:          1,
      xp:             0,
      stat_points:    totalStats - 30, // starting 5×6=30 are free
      str: 5, int: 5, agi: 5, vit: 5, lck: 5, cha: 5,
      prestige_count: char.prestige_count + 1,
    });
    return { ok: true, prestigeCount: char.prestige_count + 1 };
  });

  // ── Responses ──────────────────────────────────────────────────────────────

  ipcMain.handle('rpg:get-responses', (_e, { scenarioKey }) => {
    return rpgDb.getResponses(scenarioKey);
  });

  ipcMain.handle('rpg:refresh-responses', (_e, { scenarioKey }) => {
    rpgDb.wipeResponses(scenarioKey);
    return { ok: true };
  });

  // ── Adventure / Run (Phase 2 placeholder) ─────────────────────────────────

  ipcMain.handle('rpg:start-adventure', (_e, { zoneId }) => {
    // TODO Phase 2: generate run state (floors, enemies, etc.)
    return { ok: false, error: 'Phase 2 not yet implemented' };
  });

  ipcMain.handle('rpg:take-action', (_e, { action, payload }) => {
    // TODO Phase 2: process combat/room actions
    return { ok: false, error: 'Phase 2 not yet implemented' };
  });

  ipcMain.handle('rpg:end-run', (_e, { result }) => {
    // TODO Phase 2: finalize run, save history
    return { ok: false, error: 'Phase 2 not yet implemented' };
  });
}

module.exports = { register };
