# RPG Balance — Implementation Checklist

Source of truth: `docs/RPG_BALANCE_DESIGN.md`
Engine: `addons/rpg_adventure/src/rpg-engine.js`
Constants: `addons/rpg_adventure/src/rpg-constants.js`

---

## PHASE 1 — Constants Overhaul (rpg-constants.js) ✅

- [x] Add `TIER_MULTIPLIERS` lookup array `[1.0, 1.5, 3, 6, 10, 15, 25, 38, 54, 80]`
- [x] Add `LEGS` to `GEAR_SLOTS` ← MISSING from current code
- [x] Add `BASE_ACCURACY = 0.70` and `BASE_DODGE = 0.02` constants
- [x] Rewrite `STAT_DEFINITIONS` (STR/AGI/INT/VIT only, updated descriptions)
- [x] Add `SECONDARY_STAT_DEFINITIONS` for Pierce, Impact, Dodge, Accuracy, Speed, Luck
- [x] Add `CHA_DEFINITION` (gear-only, formula-based)
- [x] Add `WEAPON_ARCHETYPES` table with STR/AGI/INT weight profiles (23 weapon types)
- [x] Rewrite `SLOT_STAT_POOLS` to new identity system (all 10 slots)
- [x] Add `SLOT_BIAS_WEIGHTS` — per-slot bias multipliers (2.0 for biased stats)
- [x] Add `SLOT_BUDGET_MODIFIERS` — per-slot budget scaling
- [x] Add `ARMOR_SLOTS` constant (chest, head, legs, hands, feet)
- [x] Remove `stat_point_lck` and `stat_point_cha` from `SCENARIO_KEYS`

---

## PHASE 2 — Core Formulas (rpg-engine.js) ✅

- [x] Add `softCapStat(stat)` — piecewise (0–300 full, 300–450 50%, 450+ 15%)
- [x] Update `maxHP(vit, level)` — uses softCap, level multiplier
- [x] Replace `playerEffectiveATK` with `calcPlayerDamage(char, gear)` — weapon archetype weights
- [x] Update `playerEffectiveDEF` — DEF% only, VIT removed
- [x] Rewrite `hitChance` — uses Accuracy/Dodge secondary stats + base values
- [x] Rewrite `critChance` — uses Pierce: `Pierce / (Pierce + 400)`
- [x] Add `critMultiplier(impact)` — `1.5 + impact / 500`
- [x] Update `calcDamage` — DEF% then ARM flat, crit uses Impact multiplier
- [x] Update `xpRequired` — `50 * level^1.5` (was 100)
- [x] Add `companionAssistChance(effCHA)` and update `companionAssistDamage`
- [x] Update `_checkCHAAssist` — formula-based (removed breakpoint table)

---

## PHASE 3 — Gear Generator Overhaul (rpg-engine.js) ✅

- [x] Rewrite `generateGearItem(zoneLevel, rarity, slot, tier)` — full budget system
- [x] Bias-weighted secondary stat selection and distribution (`_pickBiasedStats`, `_distributeByBias`)
- [x] Armor slots always get DEF% + ARM flat from tier-scaled range
- [x] Weapon slots always get `weapon_damage` + `weapon_archetype`
- [x] Trinket: one random primary or secondary boost
- [x] Sacrifice variant: common armor only, 15% chance, inflated DEF/ARM, reduced other stats
- [x] Update `computeGearTotals` — all new stat keys, legacy `atk` field compat
- [x] Update `rarityWeights` — Luck multiplier on non-common tiers

---

## PHASE 4 — Reward System ✅

- [x] Add `calcPlayerPower(char, gear)` — sqrt(OffenseScore × DefenseScore)
- [x] Add `calcZonePower(tier, zoneDifficulty)` — TierMultipliers lookup
- [x] Add `rewardMultiplier(playerPower, zonePower)` — 0 below floor, up to 1.5× bonus
- [x] Wire into `_handleEnemyDeath` — XP, gold both scaled by reward multiplier
- [x] Luck gold bonus applied on top (`1 + Luck × 0.002`)

---

## PHASE 5 — Combat System Updates ✅

- [x] Turn order: `Speed + Random(0,20)` for both sides — replaces AGI comparison
- [x] `_resolvePlayerAttack` — uses `calcPlayerDamage`, Pierce for crit, Impact for multiplier
- [x] `_resolveEnemyAttack` — uses player Dodge stat, enemy accuracy stat, DEF%+ARM reduction
- [x] `fleeChance` — uses Speed instead of AGI
- [x] `trapDamage` — uses ARM flat instead of DEF stat
- [x] Trap dodge in `resolveFloorRoom` — uses Dodge secondary stat formula

---

## PHASE 6 — Cleanup & Validation ✅

- [x] Remove AGI-as-dodge references in trap dodge calc — trap dodge already uses `gear.totalDodge` (fixed in Phase 5)
- [x] Remove VIT-as-DEF from all damage calculation paths — `playerEffectiveDEF` returns DEF% only (fixed in Phase 2)
- [x] Verify `RARITY_STAT_COUNT` — controls primary stat count only; updated comment + capped epic/legendary at max 4 (pool size)
- [x] Add `legs` to all loot drop slot arrays — done in Phase 5; `rollLootDrop` and merchant both use full 10-slot array
- [x] Update DB schema — v2 migration: adds `legs` row to `rpg_equipped`, adds `is_sacrifice` column to `rpg_inventory`; `addItem()` updated to persist `is_sacrifice`
- [x] Remove `atk` standalone stat — new generator never emits `atk`; legacy compat kept in `computeGearTotals` for old DB items
- [x] Enemy secondary stats — decided to keep `atk/def/agi` as internal budget model; derive `accuracy`, `dodge`, `speed` from `agi` at enemy generation time (`accuracy=agi`, `dodge=agi×0.5`, `speed=agi×0.5`)

---

## KNOWN ISSUES TO FIX DURING IMPLEMENTATION

- `stat_point_lck` and `stat_point_cha` scenario keys exist — players currently can allocate
  LCK/CHA as primary stats. These need to be removed from the stat allocation UI.
- `xpRequired` uses `100 * level^1.5` — should be `50 * level^1.5` per design.
- Enemy `agi` stat currently used for both hit chance AND flee chance — needs split with Speed.
- CHA breakpoints in both constants.js AND engine.js — engine is source of truth, remove from constants.
- `hitChance` currently floors at 15% — new system handles floor via base accuracy (70%), review needed.
