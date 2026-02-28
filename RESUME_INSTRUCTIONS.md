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

## ✅ PHASE 0 COMPLETE

All design documents finalized. Classic fantasy theme applied throughout. Ready for Phase 1 (Addon Foundation).

### Next Step
**Begin Phase 1: Addon Foundation**
See `docs/rpg/GAMEPLAN.md` Phase 1 for task list.
Start with: directory structure + `manifest.json` + addon loader hook in `src/main/main.js`.

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
