# RPG Design — Suggested Fixes

Last updated: 2026-02-28
Status: All [FIXED] items removed. Only PARTIAL items remain.

Each fix references its corresponding problem in PROBLEMS.md.

---

## Fix M5 — Add Explicit Condition: Fields to Legendaries

**Problem:** Most legendaries with implicit conditions lack explicit `Condition:` fields. The loot generator cannot implement conditional drops without explicit declarations.

**Fix:** For every legendary in LEGENDARIES.md, add a `Condition:` field:
- `Condition: null` — standard drop (no special condition required)
- `Condition: <explicit rule>` — specific requirement that must be met

**Examples of implicit conditions to formalize:**
- **Ring of Everything** — no tier restriction currently stated; needs explicit `Condition: null` or a tier range
- **Memory Palace** — grows from unique kill history; no drop condition stated; likely `Condition: null`
- Any legendary that references character-specific lore should use the `[CHARACTER]` placeholder for the character name, and `Condition: base CHA = 50` if it references max bond

**Max CHA definition** (already in MASTER_DESIGN.md, reproduced for reference):
> "max CHA" = base CHA 50 (stat points only). Gear-boosted CHA does not satisfy "max CHA" conditions.

**Document to update:** LEGENDARIES.md — add `Condition:` field to every legendary entry.

---

## Scope S1 — Zone Mechanics Implementation Scope

**Partial Resolution:** 70 zones, 31 shared mechanics. Zone and mechanic counts are now reasonable.

**Remaining work:** Each of the 31 mechanics in UNIQUE_ZONE_MECHANICS.md must be implemented individually in the combat/dungeon engine. Prioritization:
1. Implement the most common mechanics first (those referenced by the most zones)
2. Skip complex mechanics for Phase 1–3; they can be stubbed as "None" temporarily
3. No mechanic requires another mechanic as a dependency — each can be implemented independently

---

## Scope S5 — Automated Balance Validation

**Partial Resolution:** Tested range defined (Zone 1–400, Char 1–200, Prestige 0–20).

**Remaining work:** Phase 8 should include a simulation script that:
- Runs 1,000 simulated combats per zone tier (auto-rolling without UI)
- Measures player win rate at each bracket level vs. optimal-gear player
- Flags any zone/bracket combinations where win rate falls below 20% or above 95%
- This validates the scaling formulas before manual playtesting

---

*See PROBLEMS.md for full problem descriptions.*
*See docs/rpg/CLAUDE.md for canonical rules that supersede any fix listed here.*
