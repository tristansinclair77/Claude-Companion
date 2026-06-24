#!/usr/bin/env node
// Splits a .adventure export into focused plain-text files so you can
// share just the parts you care about with Claude or any reader.
//
// Usage:  node scripts/split-adventure.js <file.adventure> [output-dir]
// The batch wrapper COMMANDS/SPLIT_ADVENTURE.bat handles the UI.

'use strict';
const fs   = require('fs');
const path = require('path');

// ── Args ─────────────────────────────────────────────────────────────────────
const [,, inFile, outDir] = process.argv;
if (!inFile) {
  console.error('Usage: node split-adventure.js <file.adventure> [output-dir]');
  process.exit(1);
}
if (!fs.existsSync(inFile)) {
  console.error('File not found:', inFile);
  process.exit(1);
}

const bundle = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const { state, log = [], sideChat = [] } = bundle;

if (!state) {
  console.error('Invalid .adventure file: no state found.');
  process.exit(1);
}

const dest = outDir || path.join(path.dirname(inFile), path.basename(inFile, '.adventure') + '_split');
fs.mkdirSync(dest, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────
function w(filename, text) {
  const p = path.join(dest, filename);
  fs.writeFileSync(p, text.trimEnd() + '\n', 'utf8');
  console.log('  wrote', filename);
}

function header(title) {
  const bar = '='.repeat(60);
  return `${bar}\n  ${title}\n${bar}\n`;
}

function statBlock(c) {
  if (!c) return '(none)\n';
  const equip = c.equipment || {};
  const slots = ['weapon','offhand','head','body','feet','accessory'];
  const equipped = slots.map(s => equip[s] ? `  ${s.padEnd(9)}: ${equip[s].name || equip[s]}` : null).filter(Boolean);

  return [
    `Name   : ${c.name || '?'}`,
    `Level  : ${c.level}   XP: ${c.xp}/${c.xpToNext}`,
    `HP     : ${c.hp}/${c.maxHp}   MP: ${c.mp}/${c.maxMp}   Gold: ${c.gold ?? 0}`,
    `STR ${c.str}  DEX ${c.dex}  INT ${c.int}  WIS ${c.wis}  CON ${c.con}  LUK ${c.luck}`,
    c.illness ? `Illness: ${c.illness}` : null,
    c.buffs?.length  ? `Buffs  : ${c.buffs.map(b => b.name || b).join(', ')}`   : null,
    c.debuffs?.length? `Debuffs: ${c.debuffs.map(b => b.name || b).join(', ')}` : null,
    equipped.length  ? `Equipped:\n${equipped.join('\n')}` : null,
  ].filter(Boolean).join('\n');
}

function itemList(items = []) {
  if (!items.length) return '(empty)';
  return items.map(it => {
    const base = `  - ${it.name || it.id || '?'}`;
    const qty  = it.qty > 1 ? ` x${it.qty}` : '';
    const desc = it.desc ? `\n      ${it.desc}` : '';
    return base + qty + desc;
  }).join('\n');
}

function abilityList(items = [], label = 'Ability') {
  if (!items.length) return `(no ${label.toLowerCase()}s)`;
  return items.map(it => {
    const cost = it.cost != null ? `  [cost ${it.cost}]` : '';
    const desc = it.desc ? `\n    ${it.desc}` : '';
    return `  - ${it.name || it.id}${cost}${desc}`;
  }).join('\n');
}

// ── 1. META ──────────────────────────────────────────────────────────────────
{
  const s = state;
  const p = s.player || {};
  const mem = s.memory || {};
  let out = header('ADVENTURE META');
  out += `Exported : ${bundle.exportedAt || '?'}\n`;
  out += `Character: ${bundle.character || '?'}\n`;
  out += `Tone     : ${s.tone || '?'}\n`;
  if (s.setting) out += `Setting  : ${s.setting}\n`;
  out += `Turn     : ${s.turnCount}   Day: ${s.time?.label || '?'}\n`;
  out += `Scene    : ${s.scene?.name || '?'}${s.scene?.area ? ' / ' + s.scene.area : ''}\n`;
  out += `Alive    : ${s.alive ? 'yes' : 'NO — ' + (s.deathCause || '?')}\n`;
  if (mem.currentSituation) out += `\nCurrent situation:\n${mem.currentSituation}\n`;
  if (mem.immediateGoal)    out += `\nImmediate goal:\n${mem.immediateGoal}\n`;
  w('1_meta.txt', out);
}

// ── 2. CHARACTERS ────────────────────────────────────────────────────────────
{
  let out = header('PLAYER — TRIST');
  out += statBlock(state.player) + '\n';

  out += '\n' + header('COMPANION — ARIA');
  out += statBlock(state.aria) + '\n';

  const party = state.party || [];
  if (party.length) {
    out += '\n' + header('PARTY MEMBERS');
    for (const m of party) {
      out += `\n--- ${m.name || '?'} ---\n`;
      out += statBlock(m) + '\n';
    }
  }

  const summons = state.summons || [];
  if (summons.length) {
    out += '\n' + header('SUMMONS / BOUND ENTITIES');
    for (const s of summons) {
      out += `\n--- ${s.name || '?'} (${s.type || 'summon'}) ---\n`;
      if (s.desc) out += s.desc + '\n';
      if (s.hp != null) out += `HP: ${s.hp}/${s.maxHp || '?'}  MP: ${s.mp || 0}/${s.maxMp || '?'}\n`;
    }
  }

  if (state.enemy) {
    const e = state.enemy;
    out += '\n' + header('CURRENT ENEMY');
    out += `Name  : ${e.name}\n`;
    out += `HP    : ${e.hp}/${e.maxHp}\n`;
    if (e.desc) out += `Desc  : ${e.desc}\n`;
    if (e.buffs?.length)  out += `Buffs : ${e.buffs.map(b => b.name || b).join(', ')}\n`;
    if (e.debuffs?.length)out += `Debuff: ${e.debuffs.map(b => b.name || b).join(', ')}\n`;
  }

  w('2_characters.txt', out);
}

// ── 3. INVENTORY & EQUIPMENT ─────────────────────────────────────────────────
{
  const p = state.player || {};
  const a = state.aria   || {};
  let out = header('TRIST — INVENTORY');
  out += itemList(p.inventory) + '\n';
  out += `\nGold: ${p.gold ?? 0}\n`;

  out += '\n' + header('TRIST — EQUIPMENT');
  const slots = ['weapon','offhand','head','body','feet','accessory'];
  const eq = p.equipment || {};
  for (const s of slots) {
    const item = eq[s];
    out += `${s.padEnd(9)}: ${item ? (item.name || item) : '—'}\n`;
    if (item?.desc) out += `          ${item.desc}\n`;
  }

  out += '\n' + header('ARIA — INVENTORY');
  out += itemList(a.inventory) + '\n';
  out += `\nGold: ${a.gold ?? 0}\n`;

  out += '\n' + header('ARIA — EQUIPMENT');
  const aeq = a.equipment || {};
  for (const s of slots) {
    const item = aeq[s];
    out += `${s.padEnd(9)}: ${item ? (item.name || item) : '—'}\n`;
    if (item?.desc) out += `          ${item.desc}\n`;
  }

  w('3_inventory_equipment.txt', out);
}

// ── 4. ABILITIES & SPELLS ────────────────────────────────────────────────────
{
  const p = state.player || {};
  const a = state.aria   || {};
  let out = header('TRIST — SPELLS');
  out += abilityList(p.spells, 'Spell') + '\n';

  out += '\n' + header('TRIST — ABILITIES');
  out += abilityList(p.abilities, 'Ability') + '\n';

  out += '\n' + header('ARIA — SPELLS');
  out += abilityList(a.spells, 'Spell') + '\n';

  out += '\n' + header('ARIA — ABILITIES');
  out += abilityList(a.abilities, 'Ability') + '\n';

  w('4_abilities_spells.txt', out);
}

// ── 5. WORLD — QUESTS, NPCS, LORE ───────────────────────────────────────────
{
  const mem = state.memory || {};
  let out = header('STORY SUMMARY');
  out += (mem.storySummary || '(none yet)') + '\n';

  if (mem.quests?.length) {
    out += '\n' + header('QUESTS');
    for (const q of mem.quests) {
      const status = q.status === 'done' ? '[DONE]' : q.status === 'failed' ? '[FAILED]' : '[active]';
      out += `\n${status} ${q.name || q.id}\n`;
      if (q.desc)  out += `  ${q.desc}\n`;
      if (q.notes) out += `  Notes: ${q.notes}\n`;
    }
  }

  if (mem.npcs?.length) {
    out += '\n' + header('KNOWN NPCS');
    for (const n of mem.npcs) {
      out += `\n${n.name}${n.location ? ' @ ' + n.location : ''}  [${n.status || 'unknown'}]\n`;
      if (n.desc)  out += `  ${n.desc}\n`;
      if (n.notes) out += `  Notes: ${n.notes}\n`;
    }
  }

  if (mem.locations?.length) {
    out += '\n' + header('KNOWN LOCATIONS');
    for (const l of mem.locations) {
      out += `\n${l.name}\n`;
      if (l.desc)     out += `  ${l.desc}\n`;
      if (l.notable)  out += `  Notable: ${l.notable}\n`;
    }
  }

  if (mem.events?.length) {
    out += '\n' + header('KEY EVENTS');
    for (const e of mem.events) {
      out += `  [Turn ${e.turn}] ${e.desc}\n`;
    }
  }

  if (mem.lore?.length) {
    out += '\n' + header('LORE');
    for (const l of mem.lore) out += `  - ${l}\n`;
  }

  w('5_world.txt', out);
}

// ── 6. STORY LOG ─────────────────────────────────────────────────────────────
{
  let out = header(`STORY LOG  (${log.length} entries)`);
  for (const entry of log) {
    const ts   = entry.t ? new Date(entry.t).toLocaleString() : '';
    const role = (entry.role || entry.type || '').toUpperCase();
    const text = entry.text || entry.content || '';
    const sep  = ts ? `\n[${role}${ts ? ' — ' + ts : ''}]\n` : `\n[${role}]\n`;
    out += sep + text + '\n';
  }
  w('6_story_log.txt', out);
}

// ── 7. ARIA SIDE-CHAT ─────────────────────────────────────────────────────────
if (sideChat.length) {
  let out = header(`ARIA SIDE-CHAT  (${sideChat.length} messages)`);
  for (const msg of sideChat) {
    const who  = msg.role === 'user' ? 'TRIST' : 'ARIA';
    const ts   = msg.t ? new Date(msg.t).toLocaleString() : '';
    const text = msg.content || msg.text || '';
    out += `\n[${who}${ts ? ' — ' + ts : ''}]\n${text}\n`;
  }
  w('7_sidechat.txt', out);
}

// ── Done ─────────────────────────────────────────────────────────────────────
console.log(`\nDone — ${dest}`);
