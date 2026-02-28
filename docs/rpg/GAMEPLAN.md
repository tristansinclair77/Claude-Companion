# RPG Adventure — Implementation Gameplan

Last updated: 2026-02-27
Status: Phase 0 COMPLETE — ready for Phase 1

---

## GOLDEN RULE

> **PAUSE after every chunk. Check what was done. User confirms. Commit. Move on.**
> `RESUME_INSTRUCTIONS.md` is wiped and rewritten before every task batch.

---

## PHASE 0: Design Documents

All design documents must be finalized before any game code is written.
This phase locks in the fantasy theme and all major design decisions.

### 0.1 — Planning & Rules
- [x] `docs/rpg/CLAUDE.md` — Canonical rules and goals document
- [x] `docs/rpg/GAMEPLAN.md` — This document
- [x] `docs/rpg/SUGGESTED_FIXES.md` — Updated per user decisions

### 0.2 — World & Enemy Rewrites
- [x] Redo `docs/rpg/ZONES.md` — 70 classic fantasy zones across 10 tiers + special/challenge/questline zones
- [x] Redo `docs/rpg/ENEMIES.md` — 70 fantasy enemies across 10 archetypes + boss rules + random generator
- [x] Create `docs/rpg/UNIQUE_ZONE_MECHANICS.md` — 31 named zone mechanics, full IDs, impl notes, zone cross-refs

### 0.3 — Gear Rewrites
- [x] Redo `docs/rpg/GEAR_SETS.md` — 25 fantasy sets (15 Rare + 10 Epic, 5 [UNIQUE]); Runebound Companion replaces Synthetic Soul
- [x] Redo `docs/rpg/GEAR_NAMES.md` — 18 prefixes + 18 suffixes per rarity tier; fantasy weapon/armor type lists
- [x] Update `docs/rpg/GEAR.md` — Removed sci-fi weapons; renamed tech-named core passives; extended pools → Phase 5 placeholder
- [x] Update `docs/rpg/LEGENDARIES.md` — Converted sci-fi weapon legendaries; fixed prestige mechanics; updated passive names

### 0.4 — System Document Updates
- [x] Update `docs/rpg/ACHIEVEMENTS.md` — 60 achievements (20/20/20), zero rewards, count-based tiers
- [x] Update `docs/rpg/SCALING.md` — Prestige = counter only; stat reallocation on prestige; all canonical formulas added
- [x] Update `docs/rpg/RESPONSES.md` — Wipe-to-regenerate; tiered counts (~2,640 total); sci-fi keys removed
- [x] Update `docs/rpg/MASTER_DESIGN.md` — Fantasy theme throughout; all locked decisions applied

### 0.5 — Cleanup & Finalize
- [x] Scan all docs for cyberpunk/tech references → EFFECTS.md, GEAR.md, LEGENDARIES.md, PROBLEMS.md cleaned
- [x] Update `docs/rpg/PROBLEMS.md` — All fixed/partially-fixed issues marked; open issues remain open
- [x] Final GAMEPLAN.md update with full Phase 0 completed checkboxes (this entry)

---

## PHASE 1: Addon Foundation

Set up the addon structure and SQLite database. No game logic yet.

### 1.1 — Directory Structure
```
addons/
  rpg_adventure/
    manifest.json           ← addon metadata + IPC handler registration list
    character_defaults.json ← default companion context for RPG scenarios
    src/
      rpg-db.js             ← SQLite schema + migration
      rpg-constants.js      ← all zone/enemy/gear/stat data tables
      rpg-engine.js         ← combat math (Phase 2)
      rpg-narrator.js       ← companion response system (Phase 4)
      rpg-achievements.js   ← achievement tracking (Phase 6)
    ui/
      rpg-panel.js          ← main UI controller (Phase 5)
      rpg-inventory.js      ← inventory + gear UI (Phase 5)
      rpg-panel.html        ← panel HTML structure (Phase 5)
      rpg.css               ← styles (Phase 5)
```

### 1.2 — Manifest + Base App Hooks (Minimal Changes to Base)
- [ ] `manifest.json` — name, version, ipcHandlers[], contextFile
- [ ] Update `src/main/main.js` — Addon loader: scans `addons/*/manifest.json`, dynamically `require()`s each addon's IPC module
- [ ] Update `src/shared/system-prompt.js` — Context assembler globs `characters/<active>/addons/*.json` and appends to system prompt
- [ ] Ensure `characters/<name>/addons/` directory created on first launch per character

### 1.3 — Database Schema (`rpg-db.js`)

Tables:
- `rpg_character` — level, XP, stats, stat_points, gold, prestige_count
- `rpg_inventory` — all held items (gear + consumables)
- `rpg_equipped` — what's in each of the 9 gear slots
- `rpg_achievements` — unlocked + progress per achievement
- `rpg_run_history` — past run summaries (zone, result, loot earned)
- `rpg_responses` — companion dialogue pool (scenario_key + dialogue + emotion + thoughts)
- `rpg_response_generation_log` — which keys have been generated

### 1.4 — Constants (`rpg-constants.js`)
- [ ] ZONES[] — id, name, tier, levelRange, charLevelReq, enemyPool, mechanic (optional)
- [ ] ENEMIES[] — id, name, archetype, bracket, statDist, specials, dropTable
- [ ] GEAR_SLOTS[] — weapon, helm, chest, gloves, boots, belt, ring, amulet, trinket
- [ ] RARITY_WEIGHTS — base probability table
- [ ] BRACKETS — Minion through God-Tier + Boss (budget, XP mult, gold mult)
- [ ] STAT_DEFINITIONS — STR, INT, AGI, VIT, LCK, CHA with primary + secondary effects
- [ ] SCENARIO_KEYS — all ~130 scenario key constants

---

## PHASE 2: Combat Engine

Pure JavaScript math. Zero network calls. Fully testable offline.

### 2.1 — Scaling Formulas (`rpg-engine.js`)
- [ ] `xpRequired(level)` — XP to next level
- [ ] `xpReward(zoneLevel, bracket, isShiny, isBoss)` — XP from combat
- [ ] `enemyStatBudget(zoneLevel, bracket)` — total stat points for enemy
- [ ] `allocateStats(budget, archetype)` — distribute HP/ATK/DEF/AGI per archetype
- [ ] `applyShinyModifiers(stats)` — ×2.5 HP, ×2 ATK, ×1.5 DEF
- [ ] `playerEffectiveATK(stats, gear)` — player attack
- [ ] `playerEffectiveDEF(stats, gear)` — player defense (VIT/2 + gear.DEF + gear.VIT×0.2)
- [ ] `maxHP(vit)` — soft cap at VIT 300: `40 + min(VIT,300)×8 + max(0,VIT-300)×2`
- [ ] `hitChance(attackerAGI, defenderAGI)` — clamped [5%, 95%]
- [ ] `critChance(lck, weaponBonus)` — 0.5% per LCK, capped 95%
- [ ] `calcDamage(effectiveATK, effectiveDEF, isCrit)` — ±10% variance, ×2 on crit
- [ ] `companionAssistDamage(effectiveATK, baseMult, scalingMult)` — canonical formula
- [ ] `goldDrop(zoneLevel, bracket, isShiny, isBoss)` — gold reward
- [ ] `rarityWeights(zoneLevel, lck)` — rarity table WITH renormalization (sums to 100)
- [ ] `shinyChance(lck)` — base 1/512, capped 1/100
- [ ] `trapDamage(zoneLevel)` — `floor(zoneLevel × 1.5)`, true damage
- [ ] `merchantPrice(item, zoneLevel)` — buy price; sell = 25% of buy
- [ ] `fleeChance(playerAGI, enemyAGI)` — base 50% ± AGI diff

### 2.2 — CHA / Companion Assist (Canonical Table)

| CHA Range | Effect |
|-----------|--------|
| 0–9 | No assists |
| 10–24 | CHA × 2% chance per player turn |
| 25–49 | Guaranteed 1 assist at fight start |
| 50 | Guaranteed 1 assist per player turn (50% ATK) |
| 75+ (gear) | Assist fires twice per player turn |

### 2.3 — Loot Generator
- [ ] `generateGearItem(zoneLevel, rarity, slot)` — full item with stats + name + set check
- [ ] `rollLootDrop(zoneLevel, lck, bracket)` — rarity roll → item or gold
- [ ] `isSetPiece(charLevel, setRange, rarity)` — 1-in-8 chance if eligible
- [ ] Legendary eligibility check (zone tier + optional conditions)

### 2.4 — Combat Loop
- [ ] `runCombatTurn(playerState, enemyState, action)` — single turn
  - Player action (attack / flee / use item)
  - Enemy action + special ability check (cooldown-aware)
  - Status effect ticks (bleed, poison, burn, regen, stun)
  - Companion assist check
  - Return: updated states + event list (for scenario key triggers)
- [ ] `generateEnemy(zoneLevel, bracket, isShiny)` — build enemy from constants
- [ ] `generateBoss(zoneLevel, tier)` — boss with 1–2 special abilities
- [ ] Boss ability rules (once-per-fight unless "per turn", 3-turn cooldown, max 2 active, player survival resolves first)

### 2.5 — Zone & Run Management
- [ ] `startRun(characterId, zoneId)` — init run state
- [ ] `generateFloor(zoneId, floorNum, charLevel)` — room sequence
  - Base room type weights; apply zone-specific modifiers
  - Boss room always last
- [ ] `extractFromRun(runState)` — keep loot, end run
- [ ] `completeRun(runState)` — boss killed, full rewards
- [ ] `failRun(runState)` — player died, loot lost

---

## PHASE 3: IPC Surface

Connect the engine to the renderer via Electron IPC.

### 3.1 — Core IPC Handlers
- [ ] `rpg:get-state` → full character + current run state
- [ ] `rpg:start-adventure` → begin run in zone
- [ ] `rpg:take-action` → submit combat action, get result
- [ ] `rpg:manage-gear` → equip / unequip / sell
- [ ] `rpg:get-inventory` → inventory contents
- [ ] `rpg:allocate-stat` → spend stat point
- [ ] `rpg:get-achievements` → achievement list + progress
- [ ] `rpg:get-run-history` → past run summaries
- [ ] `rpg:prestige` → execute prestige reset (returns stat points, keeps legendaries)

### 3.2 — Batch IPC (Reduce Round-Trips)
- [ ] `rpg:level-up-bundle` → `{ newLevel, statPointsGained, xpToNext, scenarioKey, achievements[] }`
- [ ] `rpg:run-end-bundle` → `{ xpAwarded, goldAwarded, lootDrops[], achievements[], levelUps[] }`

### 3.3 — Preload
- [ ] Expose all `rpg:*` handlers via contextBridge in `src/preload/preload.js`

---

## PHASE 4: Companion Narrative

How the companion reacts to RPG events. Local-first, Claude only for generation.

### 4.1 — Response System (`rpg-narrator.js`)
- [ ] `getResponse(scenarioKey, characterData, gameState)` — main entry
  - Query pool size for key
  - If pool empty → call Claude to generate, store all responses, return one
  - If pool exists → pick weighted-random (avoid last 5 used)
  - Update use_count + last_used_at
- [ ] `generateResponsePool(scenarioKey, characterData)` — Claude generation call
  - Build prompt from character.json + rules.json + scenario description
  - Request JSON array of `{ dialogue, emotion, thoughts }`
  - Parse + store all responses
  - Log to `rpg_response_generation_log`
- [ ] Force-Claude scenarios (always real-time, bypass pool):
  - `companion_comments_legendary`, `companion_comments_boss_death`
  - `companion_debrief_success`, `companion_debrief_death`
  - `first_legendary`, `prestige_1`, `level_milestone_100`, `level_milestone_200`
- [ ] Fallback: 5 hardcoded generic responses per category (battle, loot, zone, level, companion)

### 4.2 — Scenario Integration
- [ ] Every event in the combat loop emits the appropriate scenario key
- [ ] scenario key → `getResponse()` → companion dialogue displayed

---

## PHASE 5: UI

### 5.1 — RPG Panel (Drawer)
- [ ] `rpg-panel.html` — drawer panel HTML
- [ ] `rpg-panel.js` — screen router: zone select → combat → floor map → run summary
- [ ] Zone selection screen: tier list, zone cards with name/theme/level range
- [ ] Combat screen: enemy card (name, HP bar, stats if known), player stats, action buttons
- [ ] Run summary screen: floors cleared, loot found, XP/gold gained

### 5.2 — Inventory & Gear
- [ ] `rpg-inventory.js` — inventory grid, 9 gear slot display
- [ ] Gear item card: name with rarity color, stat block, passives, set indicator
- [ ] Comparison tooltip (new item vs. equipped)

### 5.3 — Character Screen
- [ ] Stat display: base + gear bonus, each stat with primary effect description
- [ ] Stat allocation: spend point buttons (grayed if no points)
- [ ] Prestige button + confirmation dialog

### 5.4 — Achievement Screen
- [ ] Three tabs: Easy / Mid / Hard
- [ ] Achievement cards: name, description, progress bar (for count-based), unlocked indicator
- [ ] No rewards shown (there are none)

### 5.5 — Styling (`rpg.css`)
- [ ] Panel layout + transitions
- [ ] Rarity colors (gray / green / blue / purple / gold)
- [ ] Enemy card, item card components
- [ ] Integrate with existing CRT aesthetic

---

## PHASE 6: Achievements & Daily Systems

### 6.1 — Achievement Engine (`rpg-achievements.js`)
- [ ] Check achievement conditions after every meaningful event
- [ ] Count-based achievements: update progress in SQLite after each qualifying event
- [ ] Unlock notification: in-UI toast (no reward, just unlock)
- [ ] Three brackets: Easy / Mid / Hard (purely cosmetic distinction)

### 6.2 — Daily Bonus
- [ ] Detect first run of the day (compare last_run_date)
- [ ] Apply XP + gold multiplier for that run
- [ ] Streak tracking (consecutive days)

---

## PHASE 7: Zone Map & Suggestions

### 7.1 — Zone Selection UI
- [ ] Zone list sorted by tier
- [ ] Locked (char level too low) vs. available vs. completed first clear
- [ ] Zone info card: theme, level range, mechanic (if any)

### 7.2 — Zone Suggestion System
- [ ] Trigger on player asking "where should we go?" or similar
- [ ] Query all unlocked zones within char level range
- [ ] Pass metadata to Claude → in-character suggestion
- [ ] Player accepts/declines → companion reacts

---

## PHASE 8: Balance & Polish

- [ ] Manually play zones 1–10, adjust enemy scaling
- [ ] Verify XP curve feels appropriate (not too fast, not too slow)
- [ ] Verify gear drop rates feel satisfying at each tier
- [ ] Shiny frequency check (should feel special, not routine)
- [ ] All companion scenario keys fire correctly
- [ ] Edge cases: flee both sides same turn, boss execute + Iron Will, status stacking

---

## PHASE 9: Visual Effects (Last — One at a Time)

No effects are implemented until Phase 8 is complete.
Each effect is defined, reviewed, approved, then implemented individually.

- [ ] Decide which effects are worth implementing (rank by player impact)
- [ ] Implement Effect 1 — TBD
- [ ] Implement Effect 2 — TBD
- [ ] (continue one by one, with user review each time)

---

## SCOPE TARGETS

| System | Target Count | Notes |
|--------|-------------|-------|
| Zones | ~70 (7 per tier) | Non-linear level ranges |
| Enemies | ~60 | Fantasy archetypes |
| Gear Sets | ~25 | Generic pool + ~5 unique |
| Named Legendaries | ~80–100 | Fantasy themed |
| Scenario Keys | ~130 | Tiered response counts |
| Achievements | ~60 | 20 Easy / 20 Mid / 20 Hard |
| Effects | TBD | Phase 9, one at a time |

---

*See `docs/rpg/CLAUDE.md` for design rules and locked decisions.*
*See `RESUME_INSTRUCTIONS.md` for current task status.*
