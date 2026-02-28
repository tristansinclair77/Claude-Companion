# Resume Instructions for Claude

Read `CLAUDE.md` first, then this file.

---

## Current Task

**Phase 0: Design Document Overhaul**

Converting the RPG system from cyberpunk/tech theme to **classic fantasy adventure**.
Applying all user design decisions to design documents.

---

## Completed This Session

- [x] `docs/rpg/CLAUDE.md` — Internal rules and goals (canonical)
- [x] `docs/rpg/GAMEPLAN.md` — Full implementation gameplan
- [x] `docs/rpg/SUGGESTED_FIXES.md` — Updated per user's 16 design decisions

---

## Pending (pause + user confirm between each)

- [ ] Redo `docs/rpg/ZONES.md` — Fantasy zones, non-linear level ranges
- [ ] Redo `docs/rpg/ENEMIES.md` — Fantasy enemies (goblins, trolls, harpies, etc.)
- [ ] Create `docs/rpg/UNIQUE_ZONE_MECHANICS.md` — Shared pool of zone mechanics
- [ ] Redo `docs/rpg/GEAR_SETS.md` — Fantasy gear sets
- [ ] Redo `docs/rpg/GEAR_NAMES.md` — Fantasy item name banks
- [ ] Update `docs/rpg/ACHIEVEMENTS.md` — Easy/Mid/Hard brackets, zero rewards
- [ ] Update `docs/rpg/SCALING.md` — Prestige as counter, stat realloc on prestige reset
- [ ] Update `docs/rpg/RESPONSES.md` — Wipe-to-regenerate policy
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
