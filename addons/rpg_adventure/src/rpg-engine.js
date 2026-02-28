'use strict';

// ── RPG Engine — Phase 2 ──────────────────────────────────────────────────────
// All combat math, stat scaling, and loot generation.
// Implemented in Phase 2. Stub only for Phase 1.

// TODO Phase 2: implement all functions below using formulas from SCALING.md

function xpRequired(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function xpReward(zoneLevel, bracketMult, isShiny = false, isBoss = false) {
  const base    = Math.floor(zoneLevel * bracketMult * 10);
  const shinyMod = isShiny ? 5 : 1;
  const bossMod  = isBoss  ? 10 : 1;
  return base * shinyMod * bossMod;
}

function enemyStatBudget(zoneLevel, bracketBaseBudget) {
  return Math.floor(bracketBaseBudget * Math.pow(zoneLevel, 1.3));
}

function applyShinyModifiers(stats) {
  return {
    hp:  Math.floor(stats.hp  * 2.5),
    atk: Math.floor(stats.atk * 2.0),
    def: Math.floor(stats.def * 1.5),
    agi: stats.agi,
  };
}

function maxHP(vit) {
  return 40 + Math.min(vit, 300) * 8 + Math.max(0, vit - 300) * 2;
}

function playerEffectiveATK(stats, gear) {
  const baseATK = stats.str + (gear.totalATKBonus || 0);
  const gearSTR = gear.totalSTRBonus || 0;
  return baseATK + Math.floor(gearSTR * 0.5);
}

function playerEffectiveDEF(stats, gear) {
  return Math.floor(stats.vit / 2)
    + (gear.totalDEFBonus || 0)
    + (gear.totalVITBonus || 0) * 0.2;
}

function hitChance(attackerAGI, defenderAGI) {
  const diff = attackerAGI - defenderAGI;
  return Math.max(0.05, Math.min(0.95, 0.5 + diff * 0.02));
}

function critChance(lck, weaponCritBonus = 0) {
  return Math.min(0.95, lck * 0.005 + weaponCritBonus);
}

function calcDamage(effectiveATK, effectiveDEF, isCrit) {
  const raw    = Math.max(1, effectiveATK - effectiveDEF);
  const varied = raw + Math.floor(Math.random() * (raw * 0.2)) - Math.floor(raw * 0.1);
  return isCrit ? Math.floor(varied * 2) : Math.max(1, varied);
}

function companionAssistDamage(effectiveATK, baseMult = 0.5, scalingMult = 1.0) {
  return Math.floor(effectiveATK * baseMult * scalingMult);
}

function goldDrop(zoneLevel, bracketMult, isShiny = false, isBoss = false) {
  const base    = Math.floor(zoneLevel * 2.5 + Math.random() * zoneLevel * 5);
  const bracket = Math.floor(base * bracketMult);
  const shiny   = isShiny ? 3 : 1;
  const boss    = isBoss  ? 10 : 1;
  return bracket * shiny * boss;
}

function shinyChance(lck) {
  const base     = 1 / 512;
  const lckBonus = lck * 0.0001;
  return Math.min(1 / 100, base + lckBonus);
}

function rarityWeights(zoneLevel, lck) {
  const lckShift  = Math.floor(lck / 10);
  const zoneShift = Math.floor(zoneLevel / 10);
  const shift     = zoneShift + lckShift;

  let w = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
  w.common    -= shift * 1.0;
  w.rare      += shift * 0.9;
  w.epic      += shift * 0.09;
  w.legendary += shift * 0.01;
  w.common    = Math.max(10, w.common);
  w.legendary = Math.min(15, w.legendary);
  return w;
}

function trapDamage(zoneLevel, playerDEF) {
  const base = Math.floor(zoneLevel * 3);
  return Math.max(1, base - Math.floor(playerDEF * 0.5));
}

function merchantBuyPrice(zoneLevel, rarity, lck = 0) {
  const RARITY_BASE = { common: 5, uncommon: 15, rare: 45, epic: 135, legendary: 400 };
  const base    = Math.floor(zoneLevel * (RARITY_BASE[rarity] || 5));
  const haggle  = Math.min(0.25, Math.floor(lck / 20) * 0.05);
  return Math.floor(base * (1.5 - haggle));
}

function merchantSellPrice(zoneLevel, rarity) {
  const RARITY_BASE = { common: 5, uncommon: 15, rare: 45, epic: 135, legendary: 400 };
  return Math.floor(zoneLevel * (RARITY_BASE[rarity] || 5) * 0.4);
}

function fleeChance(playerAGI, enemyAGI) {
  return Math.max(0.10, Math.min(0.90, 0.50 + (playerAGI - enemyAGI) * 0.03));
}

function dailyBonus(streakDays) {
  return {
    xpBonus:   0.5 + Math.min(1.5, streakDays * 0.1),
    goldBonus: 1.0 + Math.min(2.0, streakDays * 0.1),
  };
}

module.exports = {
  xpRequired,
  xpReward,
  enemyStatBudget,
  applyShinyModifiers,
  maxHP,
  playerEffectiveATK,
  playerEffectiveDEF,
  hitChance,
  critChance,
  calcDamage,
  companionAssistDamage,
  goldDrop,
  shinyChance,
  rarityWeights,
  trapDamage,
  merchantBuyPrice,
  merchantSellPrice,
  fleeChance,
  dailyBonus,
};
