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

### Next Step (awaiting user go-ahead)
**Update `docs/rpg/RESPONSES.md`** — Wipe-to-regenerate policy, tiered response counts.

### Remaining After RESPONSES.md (in order, pause between each)
- [ ] Update `docs/rpg/MASTER_DESIGN.md` — Fantasy theme, locked decisions applied
- [ ] Scan all docs for cyberpunk/tech references and clean up
- [ ] Final `docs/rpg/GAMEPLAN.md` update with full Phase 0 checkboxes

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
