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

### Next Step (awaiting user go-ahead)
**Redo `docs/rpg/GEAR_NAMES.md`** — Fantasy prefix/suffix name banks.

Requirements:
- Prefix bank and suffix bank for generating random gear names
- Prefixes should reflect material, origin, or quality (e.g., "Ancient", "Runed", "Blessed", "Void-touched")
- Suffixes should reflect the item's effect or story (e.g., "of the Bear", "of Flame", "of the Fallen")
- Organized by rarity tier (Common, Uncommon, Rare, Epic — Legendary names are unique per item)
- ~15–20 prefixes per rarity tier, ~15–20 suffixes per rarity tier
- All names must use classic fantasy language — no tech/sci-fi terms

### Remaining After GEAR_NAMES.md (in order, pause between each)
- [ ] Redo `docs/rpg/GEAR_NAMES.md` — Fantasy prefix/suffix name banks
- [ ] Update `docs/rpg/ACHIEVEMENTS.md` — Easy/Mid/Hard brackets, zero rewards, count-based tiers
- [ ] Update `docs/rpg/SCALING.md` — Prestige as counter, remove prestige bonus formulas, stat realloc note
- [ ] Update `docs/rpg/RESPONSES.md` — Wipe-to-regenerate policy, tiered response counts
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
