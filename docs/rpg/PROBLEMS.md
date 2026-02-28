# RPG Design — Known Problems

Last updated: 2026-02-28
Status: Design / Pre-Implementation

---

## Severity Legend

- **CRITICAL** — Breaks the game or is impossible to implement as written
- **MAJOR** — Significant design problem that will cause bugs or balance collapse
- **MINOR** — Small inconsistency or missing definition
- **IMPL** — Implementation concern (technically risky or underestimated)
- **SCOPE** — Feature bloat / disproportionate complexity

Status markers: `[OPEN]` `[PARTIAL]`

---

## Partially Resolved Problems

---

### M5 — Legendary Acquisition Conditions Are Vague `[PARTIAL]`

**Documents:** LEGENDARIES.md, MASTER_DESIGN.md

**Partial Resolution:** MASTER_DESIGN.md now defines: *"max CHA" always means base CHA from stat points only (cap = 50), not gear-boosted.* `[CHARACTER]'S CORE` now carries an explicit `Condition: base CHA = 50 at time of kill` and its hardcoded character name has been replaced with the `[CHARACTER]` placeholder.

**Still Open:** Most other legendaries with implicit conditions (e.g., Ring of Everything having no tier restriction, Memory Palace growing from unique enemy kill history) do not have explicit `Condition:` fields. These need to be added to LEGENDARIES.md — either `Condition: null` (standard drop) or a specific condition — before the loot generator (Phase 2) is implemented.

---

### S1 — Zone Mechanics Implementation Scope `[PARTIAL]`

**Documents:** ZONES.md, UNIQUE_ZONE_MECHANICS.md

**Partial Resolution:** ZONES.md was rewritten to define 70 zones across 10 tiers (plus special/challenge/questline zones), down from 170+. `UNIQUE_ZONE_MECHANICS.md` defines 31 named zone mechanics with implementation notes and zone cross-references — these are shared mechanic templates, not 70 unique implementations. Zone count and mechanic count are now reasonable.

**Still Open:** The 31 named mechanics still represent significant per-mechanic implementation work. Each mechanic must be coded, tested for edge cases, and verified against the zone list. Implementation effort is real — it is just no longer scope-breaking.

---

### S5 — Infinite Scaling Is Untestable as Designed `[PARTIAL]`

**Documents:** SCALING.md

**Partial Resolution:** SCALING.md now defines a Tested Range:
- Zone: 1–400 (tested), 401+ (BEYOND ENDGAME — supported, untested)
- Character: 1–200 (tested), 201+ (BEYOND ENDGAME)
- Prestige: 0–20 (tested), 21+ (BEYOND ENDGAME)

**Still Open:** Automated combat simulation tooling to validate balance across the full range has not been designed. Manual testing of zones 1–400 remains a significant Phase 8 effort.

---

*See SUGGESTED_FIXES.md for implementation strategies for open items.*
*See docs/rpg/CLAUDE.md for canonical rules that supersede any fix listed here.*
