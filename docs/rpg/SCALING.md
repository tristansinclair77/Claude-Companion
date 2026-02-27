# Aria's Adventure — Infinite Scaling Formulas

Last updated: 2026-02-27
Status: Design / Pre-Implementation

---

## Design Goal

All scaling formulas must satisfy:
1. **Infinite** — there is no zone level or character level that breaks the formulas
2. **Smooth** — each step feels roughly proportional to the one before
3. **Gear-gated** — advancing to the next zone tier requires new gear, not just more levels
4. **Fair** — optimal-gear player in zone tier N should succeed at ~70% efficiency
5. **Math-visible** — every number the engine needs can be derived from zone_level + character_stats

---

## XP Curves

### XP Required Per Level (character leveling)

```js
function xpRequired(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// Sample values:
// Level 1  → 2:   100 XP
// Level 5  → 6:   559 XP
// Level 10 → 11:  1,581 XP
// Level 25 → 26:  6,250 XP
// Level 50 → 51:  17,678 XP
// Level 100 → 101: 100,000 XP
// Level 200 → 201: 565,685 XP (prestige threshold)
```

### XP Gained from Combat

```js
function xpReward(zoneLevel, bracketMult, isShiny = false, isBoss = false) {
  const base     = Math.floor(zoneLevel * bracketMult * 10);
  const shinyMod = isShiny ? 5 : 1;
  const bossMod  = isBoss  ? 10 : 1;
  return base * shinyMod * bossMod;
}

// Bracket multipliers:
// Minion:   1.0
// Scout:    1.5
// Soldier:  2.0
// Elite:    3.0
// Champion: 5.0
// Legend:   8.0
// Apex:     12.0
// God-Tier: 20.0
// Boss:     (base bracket × 10)

// Sample XP rewards (zone level 10, Soldier bracket):
// Normal:  10 * 2.0 * 10 = 200 XP
// Shiny:   200 * 5 = 1,000 XP
// Boss:    200 * 10 = 2,000 XP
```

---

## Enemy Stat Scaling

### Base Stat Budget

Each enemy has a "stat budget" that is allocated according to their archetype.
Budget scales by zone level:

```js
function enemyStatBudget(zoneLevel, bracketBaseBudget) {
  // bracketBaseBudget is the base from difficulty bracket table
  const scalingFactor = Math.pow(zoneLevel, 1.3);
  return Math.floor(bracketBaseBudget * scalingFactor);
}

// Bracket base budgets (at zone level 1):
// Minion:   25
// Scout:    50
// Soldier:  90
// Elite:    150
// Champion: 250
// Legend:   400
// Apex:     650
// God-Tier: 1000

// Sample budgets (Scout bracket):
// Zone 1:  50
// Zone 5:  146
// Zone 10: 316
// Zone 25: 975
// Zone 50: 3,071
// Zone 100: 9,677
// Zone 200: 30,500
// Zone 500: 116,000
```

### Stat Allocation by Archetype

Given budget B and archetype, allocate stats as:

```js
function allocateStats(budget, archetype) {
  const pct = ARCHETYPE_DISTRIBUTIONS[archetype];
  return {
    hp:  Math.floor(budget * pct.hp),
    atk: Math.floor(budget * pct.atk),
    def: Math.floor(budget * pct.def),
    agi: Math.floor(budget * pct.agi),
  };
}

// Sample distributions (from ENEMIES.md):
// Tank:         { hp: 0.45, atk: 0.15, def: 0.30, agi: 0.05, special: 0.05 }
// Glass Cannon: { hp: 0.15, atk: 0.55, def: 0.05, agi: 0.20, special: 0.05 }
// Balanced:     { hp: 0.25, atk: 0.25, def: 0.20, agi: 0.20, special: 0.10 }
// Assassin:     { hp: 0.15, atk: 0.40, def: 0.05, agi: 0.35, special: 0.05 }
// Fortress:     { hp: 0.50, atk: 0.10, def: 0.35, agi: 0.00, special: 0.05 }
```

### Boss Stat Budget

Boss gets 3× the bracket budget for the zone level:

```js
function bossBudget(zoneLevel, bracketBaseBudget) {
  return enemyStatBudget(zoneLevel, bracketBaseBudget) * 3;
}
```

### Shiny Enemy Modifiers

```js
function applyShinyModifiers(stats) {
  return {
    hp:  Math.floor(stats.hp  * 2.5),
    atk: Math.floor(stats.atk * 2.0),
    def: Math.floor(stats.def * 1.5),
    agi: stats.agi, // speed unchanged
  };
}
```

---

## Gear Stat Scaling

### Base Stat Range Per Item Slot and Rarity

```js
const RARITY_MULT = {
  common:    1.0,
  uncommon:  1.5,
  rare:      2.2,
  epic:      3.5,
  legendary: 6.0,
};

function gearStatRange(zoneLevel, rarity) {
  const mult = RARITY_MULT[rarity];
  const base  = zoneLevel * 0.8;
  const min   = Math.floor(base * mult * 0.5);
  const max   = Math.floor(base * mult * 1.2);
  return { min, max };
}

// Sample gear stat ranges:
// Zone 10, Common:    min=4,   max=9
// Zone 10, Rare:      min=8,   max=21
// Zone 10, Legendary: min=24,  max=57
// Zone 50, Common:    min=20,  max=48
// Zone 50, Rare:      min=44,  max=105
// Zone 50, Legendary: min=120, max=288
// Zone 100, Legendary: min=240, max=576
// Zone 200, Legendary: min=480, max=1152
```

### Stat Count by Rarity

```js
const STAT_COUNT = {
  common:    { min: 1, max: 2 },
  uncommon:  { min: 2, max: 3 },
  rare:      { min: 3, max: 4 },
  epic:      { min: 4, max: 5 },
  legendary: { min: 5, max: 6 },
};
```

### Stat Selection

Stats are randomly selected without replacement from the valid pool for the item's slot.
Each stat rolls a value in `[min, max]` uniformly.

---

## Combat Damage Formula

### Player Effective ATK

```js
function playerEffectiveATK(stats, gear) {
  const baseATK = stats.str + gear.totalATKBonus;
  const gearSTR = gear.totalSTRBonus;
  return baseATK + Math.floor(gearSTR * 0.5);
}
```

### Player Effective DEF

```js
function playerEffectiveDEF(stats, gear) {
  return Math.floor(stats.vit / 2) + gear.totalDEFBonus + gear.totalVITBonus * 0.2;
}
```

### Hit Chance

```js
function hitChance(attackerAGI, defenderAGI) {
  const diff = attackerAGI - defenderAGI;
  return Math.max(0.05, Math.min(0.95, 0.5 + diff * 0.02));
}
// 50% base, ±2% per AGI point difference, clamped [5%, 95%]
```

### Crit Chance

```js
function critChance(lck, weaponCritBonus = 0) {
  return Math.min(0.95, (lck * 0.005) + weaponCritBonus);
}
// 0.5% per LCK point, weapon may add bonus, capped at 95%
```

### Damage Per Hit

```js
function calcDamage(effectiveATK, effectiveDEF, isCrit) {
  const raw    = Math.max(1, effectiveATK - effectiveDEF);
  const varied = raw + Math.floor(Math.random() * (raw * 0.2)) - Math.floor(raw * 0.1);
  // ±10% variance
  return isCrit ? Math.floor(varied * 2) : varied;
}
```

---

## Gold Drop Scaling

```js
function goldDrop(zoneLevel, bracketMult, isShiny = false, isBoss = false) {
  const base    = Math.floor(zoneLevel * 2.5 + Math.random() * zoneLevel * 5);
  const bracket = Math.floor(base * bracketMult);
  const shiny   = isShiny ? 3 : 1;
  const boss    = isBoss  ? 10 : 1;
  return bracket * shiny * boss;
}

// Bracket multipliers for gold:
// Minion: 1×, Scout: 1.2×, Soldier: 1.5×, Elite: 2×,
// Champion: 3×, Legend: 5×, Apex: 8×, God-Tier: 15×

// Sample drops:
// Zone 1,  Minion:          1–37 gold
// Zone 10, Soldier:         37–187 gold
// Zone 10, Shiny Soldier:   112–562 gold
// Zone 50, Elite:           250–1,250 gold
// Zone 100, Boss:           2,500–12,500 gold
// Zone 200, God-Tier Boss:  37,500–187,500 gold
```

---

## Zone Level to Character Level Guidelines

To ensure zones feel appropriate for the character, zones have recommended character level ranges:

```js
function recommendedCharLevel(zoneLevel) {
  return Math.floor(zoneLevel * 1.8);
}

// Zone 1  → recommended char level 1–2
// Zone 10 → recommended char level 18
// Zone 25 → recommended char level 45
// Zone 50 → recommended char level 90
// Zone 100 → recommended char level 180
// Zone 200 → recommended char level 360 (prestige territory)
```

Zones don't lock based on character level — only on "zone tier unlock" which requires
minimum character level. The player is warned if they enter a zone significantly above
their level, but it's allowed.

---

## Loot Drop Rate by Zone Level

Higher zone levels skew the rarity table upward:

```js
function rarityWeights(zoneLevel, lck) {
  const lckShift = Math.floor(lck / 10); // 1 shift per 10 LCK

  // Base weights at zone 1:
  let w = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };

  // Each 10 zone levels shifts 1% from common to rare, 0.1% from rare to epic
  const zoneShift = Math.floor(zoneLevel / 10);
  w.common    -= (zoneShift + lckShift) * 1.0;
  w.rare      += (zoneShift + lckShift) * 0.9;
  w.epic      += (zoneShift + lckShift) * 0.09;
  w.legendary += (zoneShift + lckShift) * 0.01;

  // Clamp all to reasonable bounds
  w.common    = Math.max(10, w.common);
  w.legendary = Math.min(15, w.legendary);

  return w;
}

// Sample at zone level 50, LCK 50:
// zoneShift = 5, lckShift = 5, combined = 10
// common: 50, uncommon: 25, rare: 19, epic: 4.9, legendary: 1.1

// Sample at zone level 200, LCK 100:
// zoneShift = 20, lckShift = 10, combined = 30
// common: 10 (clamped), uncommon: 25, rare: 37, epic: 16.7, legendary: 1.3 (not yet clamped)
```

---

## Set Piece Drop Rate

Set pieces only drop when:
1. The item's rarity roll matches the set's rarity (Rare or Epic)
2. The player's character level is within the set's level bracket ±20
3. A secondary roll succeeds: 1 in 8 chance (12.5%)

```js
function isSetPiece(charLevel, setLevelRange, itemRarity, setRarity) {
  if (itemRarity !== setRarity) return false;
  const [min, max] = setLevelRange;
  if (charLevel < min - 20 || charLevel > max + 20) return false;
  return Math.random() < (1/8);
}
```

If a set piece is determined to drop, the specific set is chosen weighted toward
sets closest to the player's current character level.

---

## Shiny Spawn Rate

```js
function shinyChance(lck) {
  const base = 1 / 512;
  const lckBonus = lck * 0.0001; // 0.01% per LCK point
  return Math.min(1/64, base + lckBonus);
}

// LCK 0:   ~0.195% (1 in 512)
// LCK 50:  ~0.695% (1 in 144)
// LCK 100: ~1.19%  (1 in 84)
// LCK 200: ~2.15%  (near 1/64 cap = 1.5625%)
```

---

## Prestige Scaling

After Prestige N, the character starts with:

```js
function prestigeStartingBonuses(prestigeCount) {
  return {
    allStatBonus:  prestigeCount * 5,     // +5 to all stats per prestige
    goldMultiplier: 1 + prestigeCount * 0.05, // +5% gold per prestige
  };
}

// Prestige 1:  +5 all stats, 1.05× gold
// Prestige 5:  +25 all stats, 1.25× gold (Ascendant Mode unlocks)
// Prestige 10: +50 all stats, 1.50× gold
// Prestige 20: +100 all stats, 2.0× gold
```

After Prestige 5 (Ascendant Mode):
- Enemy HP ×1.5
- Gear stat ranges ×1.5
- XP rewards ×2.0

---

## Daily Bonus

```js
function dailyBonus(streakDays) {
  const xpBonus   = 0.5 + Math.min(1.5, streakDays * 0.1); // caps at +150% at 15-day streak
  const goldBonus = 1.0 + Math.min(2.0, streakDays * 0.1); // caps at 2× gold at 20-day streak
  return { xpBonus, goldBonus };
}

// Day 1:  +50% XP, ×1.0 gold (normal)
// Day 3:  +80% XP, ×1.3 gold
// Day 7:  +120% XP, ×1.7 gold
// Day 15+: +150% XP, ×2.0 gold (max)
```

---

## HP Regeneration Between Floors

Players do NOT auto-heal between floors. HP regeneration comes only from:
- Rest rooms (25% max HP)
- Healing items (consumables)
- Armor passives (Regen passive: X HP per turn in combat)
- Set bonuses (Recovery Rig belt: +2% max HP after each combat)
- Certain legendary item effects

This ensures HP management is a meaningful resource across a full run.

---

## Infinite Zone Scaling Proof

For any zone level Z:

```
Enemy Budget(Z)  = bracket_base × Z^1.3  → grows polynomially, never plateaus
Gear Stats(Z)    = Z × 0.8 × rarity_mult  → grows linearly with zone level
Player ATK(Z)    = sum of gear ATK bonuses → grows linearly with gear upgrades
Damage(Z)        = max(1, PlayerATK(Z) - EnemyDEF(Z))  → always positive (min 1)
```

A player with max-rarity gear for zone Z will always be able to deal positive damage.
A player with previous-tier gear will struggle but not be mathematically blocked (min 1 damage).
A player with same-tier optimal gear will clear at roughly 70% efficiency.

This guarantees:
- The game never becomes mathematically impossible
- Gear upgrades always matter
- Infinite progression is always available
