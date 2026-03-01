# Resume Instructions for Claude

Read `CLAUDE.md` first, then this file.

---

## Phase 0 Progress

### Completed
- [x] `docs/rpg/CLAUDE.md` — Canonical rules and locked decisions
- [x] `docs/rpg/GAMEPLAN.md` — Full phased implementation plan
- [x] `docs/rpg/SUGGESTED_FIXES.md` — Updated per user's 16 design decisions
- [x] `docs/rpg/ZONES.md` — Rewritten: 70 classic fantasy zones across 10 tiers + special/challenge/questline zones
- [x] `docs/rpg/ENEMIES.md` — Rewritten: 70 fantasy enemies across 10 archetypes + boss rules + random generator
- [x] `docs/rpg/UNIQUE_ZONE_MECHANICS.md` — 31 named zone mechanics, full IDs, descriptions, impl notes, zone cross-refs
- [x] `docs/rpg/GEAR_SETS.md` — Rewritten: 25 fantasy sets (15 Rare + 10 Epic), 5 [UNIQUE] sets, Last Stand (fixed Zeroth Protocol), Conqueror's Throne (fixed Recursive Throne), Runebound Companion (replaces Synthetic Soul, references scalingMult per Fix M7)
- [x] `docs/rpg/GEAR_NAMES.md` — Rewritten: 18 prefixes + 18 suffixes per rarity tier (Common/Uncommon/Rare/Epic), fantasy weapon/armor type lists, name generation rules, format examples
- [x] `docs/rpg/ACHIEVEMENTS.md` — Rewritten: 60 achievements (20 Easy / 20 Mid / 20 Hard), zero rewards, count-based tiers, all cyberpunk refs removed, UI section cleaned
- [x] `docs/rpg/SCALING.md` — Updated: prestige = counter only (removed prestigeStartingBonuses + Ascendant Mode), added Tested Range note (Scope S5), Fix C4 (zone tier min char level formula + reference table), Fix C5 (rarityWeights renormalization note), Fix M6 (shiny hard cap 1/100, no fatigue), Fix M8 (maxHP VIT soft cap formula), Fix m2 (merchant price formula), Fix m3 (trap damage formula)
- [x] `docs/rpg/RESPONSES.md` — Updated: tiered response counts (HIGH=40/MED=20/LOW=10, ~2,640 total), wipe-to-regenerate policy (no auto-expiry), removed sci-fi keys (quantum_dice, time_crystal, battle_void_banish duplicate), removed prestige_5_ascendant (Ascendant Mode gone), updated force_claude list

- [x] `docs/rpg/MASTER_DESIGN.md` — Updated: fantasy theme throughout, fixed shiny formula (1/100 cap), fixed prestige section (counter only, all gear/gold retained, no Ascendant Mode), fixed zone count (70/10 tiers), fixed set count (25), replaced cyberpunk prefix/suffix list with fantasy examples + ref GEAR_NAMES.md, fixed UI mockup (fantasy zone/enemy/items), fixed questline chapter IDs

- [x] Cyberpunk/tech scan + cleanup — EFFECTS.md, GEAR.md, LEGENDARIES.md, PROBLEMS.md all updated:
  - EFFECTS.md: removed neon/pistol/Ascendant Mode/Synthetic Soul refs; renamed level-up sweep to Golden Vertical Sweep; Floating Data Particles section removed
  - GEAR.md: removed Pistol/Shotgun/SMG/Sniper Rifle/Railgun/Energy Blade weapon types; renamed all tech-named core passives to fantasy equivalents; extended pools replaced with Phase 5 placeholder
  - LEGENDARIES.md: converted 9 sci-fi weapons (Pistol→Crossbow/Dagger, SMG→Claws rename, Railgun→Staff rename, Energy Blade→Greatsword, Sniper Rifle→Longbow rename, Shotgun→Wand rename); fixed Heartless Chassis + Eternal Circuit prestige mechanics; all passive names updated to match GEAR.md renames; Prestige and Legendaries section rewritten
  - PROBLEMS.md: marked FIXED (C2, C4, C5, C6, M4, M6, M7, M8, m1, m2, m3, m8, m10, I5, S2, S3, S4); marked PARTIAL (S1, S5); all OPEN issues remain open

- [x] `docs/rpg/GAMEPLAN.md` — Phase 0 all checkboxes marked complete; status updated to "Phase 0 COMPLETE"

- [x] **Problem/Fix doc cleanup** (2026-02-28) — All remaining open problems corrected and removed from PROBLEMS.md + SUGGESTED_FIXES.md:
  - C1: MASTER_DESIGN.md Section 5 DEF formula updated to canonical `floor(VIT/2) + gear.totalDEFBonus + gear.totalVITBonus × 0.2`
  - C3: CHA 15/30/50 system replaced with canonical CHA table (0–9/10–24/25–49/50/75+ breakpoints) in MASTER_DESIGN.md
  - M1: Companion zone fallback note added to MASTER_DESIGN.md Section 8; ZONES.md already had [COMPANION-ZONE] tags
  - M2/M3: Marked FIXED — SPECIAL budget and boss ability rules already existed in ENEMIES.md
  - M5 (partial): max CHA definition added to MASTER_DESIGN.md; Condition: fields per legendary remain for Phase 2
  - m4: Marked FIXED — rest room 25% HP already in MASTER_DESIGN.md room weights table
  - m5: Secret room definition added to MASTER_DESIGN.md (3% per non-boss floor, 2–4 items one rarity above average)
  - m6: Flee priority order added to MASTER_DESIGN.md Section 5
  - m7: snake_case naming convention note added to MASTER_DESIGN.md Section 6
  - m9: LEGENDARIES.md "ARIA'S CORE" renamed to "[CHARACTER]'S CORE" with runtime display name note
  - I1/I3: Marked resolved (user decisions — visual effects deferred to Phase 9, local-first IPC)
  - I2: RESPONSES.md index updated to composite `(scenario_key, use_count)`
  - I4: Companion emotion state machine table added to MASTER_DESIGN.md Section 6
  - PROBLEMS.md: Stripped to only 3 PARTIAL items (M5, S1, S5)
  - SUGGESTED_FIXES.md: Stripped to only 3 remaining fixes (M5, S1, S5)

## ✅ PHASE 0 COMPLETE

All design documents finalized. Classic fantasy theme applied throughout. All fixable problems resolved. Ready for Phase 1 (Addon Foundation).

### Remaining Design Issues (not blocking Phase 1)
- **M5 [PARTIAL]**: Legendary `Condition:` fields — defer to Phase 2 when loot generator is built
- **S1 [PARTIAL]**: 31 zone mechanics need per-mechanic implementation — stub as "None" in Phase 1–3, implement in Phase 7+
- **S5 [PARTIAL]**: Balance simulation tooling — Phase 8 task

## ✅ PHASE 1 COMPLETE

**Phase 1: Addon Foundation** — all files written and patches applied.

### Files Created
- `addons/rpg_adventure/manifest.json` — addon metadata, IPC handler list
- `addons/rpg_adventure/character_defaults.json` — RPG context injected into system prompt
- `addons/rpg_adventure/src/rpg-db.js` — SQLite schema + migration (7 tables + composite index)
- `addons/rpg_adventure/src/rpg-constants.js` — 70 zones, brackets, archetypes, gear slots, rarity, stat defs, 125 scenario keys, 20 boss abilities
- `addons/rpg_adventure/src/rpg-ipc.js` — IPC handlers (state/inventory/equip/prestige; Phase 2 stubs for combat)
- `addons/rpg_adventure/src/rpg-engine.js` — all scaling formulas from SCALING.md (Phase 2 fills in combat loop)
- `addons/rpg_adventure/src/rpg-narrator.js` — stub (Phase 4)
- `addons/rpg_adventure/src/rpg-achievements.js` — stub (Phase 6)
- `addons/rpg_adventure/ui/` — all stubs (Phase 5)

### Files Patched
- `src/main/main.js` — `loadAddons()` added; scans `addons/*/manifest.json`; registers IPC; loads context into `_addonContexts`; called after `initBrain()`
- `src/main/local-brain.js` — `route()` accepts + forwards `addonContexts`
- `src/main/claude-bridge.js` — `sendToClaude()` accepts + forwards `addonContexts`
- `src/shared/system-prompt.js` — `buildSystemPrompt()` accepts `addonContexts`; injects as `=== ADDON CONTEXT ===` section

## ✅ PHASE 2 + 3 COMPLETE

**Phase 2: Combat Engine + Phase 3: IPC Surface** — implemented together.

### Files Written/Modified
- `addons/rpg_adventure/src/rpg-constants.js` — APPENDED: SLOT_STAT_POOLS, NAME_BANKS, BOSS_NAME_PARTS, ENEMY_NAME_DATA
- `addons/rpg_adventure/src/rpg-engine.js` — REWRITTEN: full combat engine, loot generator, run state machine, all formulas
- `addons/rpg_adventure/src/rpg-ipc.js` — REWRITTEN: full run state machine, all IPC handlers
- `src/preload/preload.js` — PATCHED: `rpgAPI` contextBridge with all rpg:* handlers

### Architecture (locked)
- **Run state**: in-memory `activeRun` in rpg-ipc.js. DB commit at run end.
- **Level-ups**: applied to DB mid-run (persist across crashes).
- **Loot/gold**: accumulate in run bag, committed only on success/extract (lost on death).
- **Phase model**: `combat` | `floor_complete` | `merchant` | `run_complete`
- **Actions**: `fight` | `flee` | `use_item` | `continue` | `extract` | `buy_item`
- **Gear totals**: computed at run start from equipped items, fixed for run duration.
- **IPC surface**: `window.rpgAPI.*` in renderer — all rpg:* handlers exposed.

### Key engine functions
- `startRun(char, zone, equipped, bonusData)` → run state + first-room events
- `resolveFloorRoom(runState)` → room resolution events (combat/treasure/rest/trap/merchant/etc.)
- `runCombatTurn(runState, action)` → { runState, events, levelUps }
- `generateEnemy(zone, zoneLevel, bracketId, isShiny, isMini)`
- `generateBoss(zone, zoneLevel, bossCount)`
- `generateGearItem(zoneLevel, rarity, slot)` / `rollLootDrop(...)`
- `computeGearTotals(equippedRows)` — sums gear bonuses

## ✅ PHASE 4 COMPLETE

**Phase 4: Companion Narrative** — rpg-narrator.js fully implemented.

### Files Written/Modified
- `addons/rpg_adventure/src/rpg-narrator.js` — REWRITTEN: full response system
- `addons/rpg_adventure/src/rpg-ipc.js` — PATCHED: narrator init + 2 new IPC handlers
- `src/preload/preload.js` — PATCHED: `getScenarioResponse` + `generateResponsePool` added to rpgAPI

### Architecture (locked)
- **Pool-first**: Claude only called when pool empty (first trigger per key) or for Force-Claude keys
- **Force-Claude keys**: 8 keys always get real-time generation (`companion_comments_legendary`, `companion_comments_boss_death`, `companion_debrief_success`, `companion_debrief_death`, `first_legendary`, `prestige_1`, `level_milestone_100`, `level_milestone_200`)
- **Tier targets**: HIGH=40, MED=20, LOW=10 responses per pool
- **Fallback**: 5 hardcoded responses per category (battle/loot/zone/level/companion) ship with app
- **Response rotation**: picks from pool avoiding 5 most-recently-used
- **Wipe-to-regenerate**: `rpg:refresh-responses` wipes pool; next trigger regenerates cleanly

### Key API
- `narrator.init(db, charDir)` — called in `register()`, sets DB + character dir references
- `narrator.getResponse(scenarioKey, gameState)` — main entry point; returns `{ dialogue, emotion, thoughts }`
- `narrator.generateResponsePool(scenarioKey, gameState)` — bulk Claude generation, stores to DB
- `window.rpgAPI.getScenarioResponse(key, gameState)` — renderer entry point
- `window.rpgAPI.generateResponsePool(key, gameState)` — explicit pool pre-generation

## ✅ PHASE 5 COMPLETE

**Phase 5: UI** — RPG Adventure drawer panel fully implemented.

### Files Written/Modified
- `addons/rpg_adventure/ui/rpg.css` — REWRITTEN: full panel stylesheet (~350 lines). Slide drawer, 7 screens, zone/enemy cards, combat log, action buttons, rarity colours, gear slot grid, stat grid, achievement tabs, run-end summary.
- `addons/rpg_adventure/ui/rpg-panel.html` — REWRITTEN: reference HTML documentation (not loaded by browser; documents DOM built by rpg-panel.js).
- `addons/rpg_adventure/ui/rpg-panel.js` — REWRITTEN: browser IIFE defining `window.RPGPanel` (~500 lines). Full panel controller.
- `addons/rpg_adventure/ui/rpg-inventory.js` — REWRITTEN: browser IIFE defining `window.RPGInventory` (~190 lines). Gear slot grid + inventory bag sub-module.
- `src/renderer/index.html` — PATCHED: CSS link added, `<button id="btn-adventure">⚔ ADVENTURE</button>` added, `<div id="rpg-panel"></div>` container added, both scripts added before `app.js`.
- `src/renderer/js/app.js` — PATCHED: `RPGPanel.init()` call + `btn-adventure` click handler added.

### Architecture (locked)
- **Browser IIFEs**: Both JS files define globals (`RPGPanel`, `RPGInventory`); no `require`/`import`. Loaded as plain `<script>` tags.
- **CSS slide drawer**: `#rpg-panel` fixed at `right: -348px`, transitions to `right: 0` on `.open` class — same pattern as `#settings-panel`.
- **DOM injection**: `rpg-panel.js` builds all 7 screens via `container.innerHTML = _HTML` template string on `init()`. No external HTML fetch.
- **Inline onclick**: Injected HTML uses `RPGPanel._merchantBuy(idx)`, `RPGPanel._allocateStat('str')`, `RPGPanel._doPrestige()`, `RPGInventory._clickSlot('slot')`, `RPGInventory._clickItem(id)`, `RPGInventory._equip(id,slot)`, `RPGInventory._sell(id)`, `RPGInventory._drop(id)` — all exposed in module return objects.
- **Run-end commit flow**: Extract action auto-commits (returns `run: null, runDone: true`). Boss kill/death returns `run: { result }` — explicit `endRun()` call needed. UI checks `result.run !== null` to decide.
- **Achievement metadata**: None in DB (only `achievement_id, unlocked, progress`). `_formatAchId()` converts snake_case IDs to display names. Phase 6 adds proper metadata.
- **Script load order**: `rpg-inventory.js` → `rpg-panel.js` → `app.js`.
- **`_setBusy(busy)`**: Disables all `.rpg-btn` elements during async IPC calls; re-enables on completion.
- **Formulas**: `_xpRequired(lv) = floor(100 × lv^1.5)`, `_maxHp(vit) = 40 + min(vit,300)×8 + max(0,vit-300)×2`.

## ✅ PHASE 6 COMPLETE

**Phase 6: Achievements** — fully implemented.

### Files Written/Modified
- `addons/rpg_adventure/src/rpg-achievements.js` — REWRITTEN: full achievement engine (~330 lines)
- `addons/rpg_adventure/src/rpg-ipc.js` — PATCHED: achievements wired at all 7 hook points
- `addons/rpg_adventure/src/rpg-engine.js` — PATCHED: `archetype` added to `enemy_died` event

### Architecture (locked)
- **60 achievements embedded in JS** (not DB): name, bracket, icon, desc, hidden, target
- **DB stores**: `achievement_id, unlocked, progress (raw count), unlocked_at`
- **`getAll()`** merges metadata + DB rows, returns progress as 0–100% for UI
- **`processEvents(events, runState, char)`** — called after every combat turn and floor advance
- **`onRunEnd(result, runState, char, committedIds)`** — called in `_commitRun` after DB commit
- **`onEquip(equipped, char)`** — called after equip-item IPC (set bonus checks)
- **`onPrestige(newCount)`** — called after prestige IPC
- **`onStatAllocate(char)`** — called after allocate-stat IPC
- **In-run tracker** (`_rt`) reset each `resetRun()` call: tracks tookAnyDamage, fled, consecutive perfect kills, companion killing blows, 1HP survival state
- **`achievementsUnlocked: [{id,name,bracket}]`** returned from every relevant IPC response

### Hook Points in rpg-ipc.js
- `rpg:start-adventure` → `resetRun()` + `processEvents(startEvents)`
- `rpg:take-action` (combat) → `processEvents(events)` after turn
- `_doAdvanceFloor()` → `processEvents(events)` after floor advance
- `_doBuyItem()` → `processEvents([item_purchased])` (H08 naked run tracking)
- `_commitRun()` → `onRunEnd()` after history insert
- `rpg:equip-item` → `onEquip()`
- `rpg:prestige` → `onPrestige()`
- `rpg:allocate-stat` → `onStatAllocate()`

## ✅ PHASE 7 COMPLETE

**Phase 7: Zone Map & Suggestions** — fully implemented.

### Files Written/Modified
- `addons/rpg_adventure/src/rpg-db.js` — PATCHED: `getClearedZoneIds()` added
- `addons/rpg_adventure/src/rpg-narrator.js` — PATCHED: `suggestZone(char, availableZones)` added; `_parseJsonResponses` updated to preserve `zone_id` field; exported `suggestZone`
- `addons/rpg_adventure/src/rpg-ipc.js` — PATCHED: `rpg:get-zones` now includes `clearedZoneIds`; new `rpg:suggest-zone` handler
- `src/preload/preload.js` — PATCHED: `suggestZone` exposed on `window.rpgAPI`
- `addons/rpg_adventure/ui/rpg-panel.js` — PATCHED: zone select revamped with first-clear stars, suggestion banner, "ASK COMPANION" button, `_doSuggestZone()`, `_suggestedZoneId` state; achievement screen fixed (bracket filtering, proper name/icon/desc/hidden display)
- `addons/rpg_adventure/ui/rpg.css` — PATCHED: `.rpg-zone-select-actions`, `.rpg-zone-clear-star`, `.rpg-zone-card.suggested`, `.rpg-zone-suggestion-banner`, `.rpg-suggest-dialogue`, `.rpg-suggest-actions`, `.rpg-ach-header`, `.rpg-ach-icon`, `.rpg-ach-card.hidden-locked`

### Architecture (locked)
- **First-clear stars**: `rpg:get-zones` now returns `clearedZoneIds[]`; zone select renders a ★ on cards for zones with at least one `result='success'` in run history
- **"ASK COMPANION" button**: In zone select screen. Calls `rpg:suggest-zone` IPC → narrator.`suggestZone()` → Claude (real-time, no pool). Returns `{ zoneId, dialogue, emotion, thoughts }`. Banner shows dialogue + GO THERE / DISMISS buttons. Suggested zone card highlighted with green glow.
- **suggestZone flow**: Filters to unlocked zones (charLevel >= charLevelReq), passes zone list + player level to Claude (haiku), asks for `{ zone_id, dialogue, emotion, thoughts }` JSON. `_parseJsonResponses` now preserves `zone_id` if present.
- **Achievement bracket filtering**: `_renderAchievements` now filters by `_achBracket` (easy/mid/hard). Shows icon, name, desc, progress bar with raw counts. Hidden+locked achievements render as "???".

### Next Step
**Phase 8: Balance & Polish** — manual gameplay testing, XP curve, drop rate verification.
OR commission specific bug fixes identified during testing.

---

## Project Background

Claude Companion is an Electron desktop AI companion app.
The RPG system ("Aria's Adventure" or character-equivalent name) is a **standalone addon**
living in `addons/rpg_adventure/`. It must be loadable/unloadable without touching base code.

**Theme**: Classic fantasy adventure. Dungeons, forests, goblins, dragons. NOT cyberpunk.

See `docs/rpg/CLAUDE.md` — canonical design rules and locked decisions.
See `docs/rpg/GAMEPLAN.md` — full implementation plan with checkboxes.

---

## App Status (Pre-RPG)

App is fully functional. TTS upgraded to VITS Anime + Kokoro. All phases 1–9 complete.
VITS server auto-starts on launch. See prior RESUME_INSTRUCTIONS for TTS setup details.
