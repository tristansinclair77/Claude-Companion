# RPG Adventure — TODO & Planned Features

---

## Item Passives & Effects System

**Current state:** Infrastructure exists but is almost entirely unimplemented.
- `passives` column in `rpg_inventory` DB — stored as JSON string array
- `computeGearTotals()` already collects passives from all equipped items into a flat array
- `iron_will` is the only passive actually implemented (survive a killing blow at 1 HP, once per run)
- `legendary_id` and `set_id` DB columns exist but are never populated by item generation
- Set bonus scenario keys exist (`set_bonus_2pc/4pc/6pc`) for companion dialogue — no gameplay effect
- `generateGearItem()` always writes `passives: []` — nothing ever rolls a passive

**Rarity rules (finalized design):**

- **Common / Uncommon:** No passives.
- **Rare:** Low chance (~15%) to roll 1 passive from the **Rare passive pool**.
- **Epic:** Decent-to-high chance (~60%) to roll 1 passive, small chance (~20%) of 2, from the **Epic passive pool**.
- **Legendary:** Always has **1 passive from the Epic pool** + **1 legendary-unique effect** specific
  to that named legendary item (pulled by `legendary_id`). The legendary effect is not shared with
  any other item — it is exclusive to that item's definition.

**Three separate passive libraries** in `rpg-constants.js`:

1. **`RARE_PASSIVES`** — moderate utility effects, nothing game-breaking:
   - Examples: `second_wind` (heal 8% max HP on kill), `quick_reflexes` (10% chance to dodge),
     `iron_grip` (+5% crit chance), `steady_footing` (reduce incoming crits by 20%),
     `bloodletter` (attacks apply a small bleed), `focus` (+10% XP gain)

2. **`EPIC_PASSIVES`** — powerful, run-shaping effects:
   - Examples: `vampiric_strike` (heal 15% of damage dealt), `shadow_step` (30% flee always
     succeeds), `death_ward` (survive one killing blow at 1 HP — the `iron_will` upgrade),
     `berserker` (ATK +2% per 10% HP missing), `arcane_shield` (block first hit of every combat),
     `executioner` (deal +50% damage to enemies below 25% HP)

3. **`LEGENDARY_EFFECTS`** — one per named legendary item, attached by `legendary_id`:
   - Each legendary in the pool has a fixed `id`, `name`, `slot`, `effect` object, and `description`
   - Examples: `conquest_longbow` → "Headshot: 20% chance on hit to deal 3× damage and stun for
     1 turn"; `worldbreaker_axe` → "Cleave: hits all enemies (splash 50% damage to floor)";
     `veilwalker_cloak` → "Phase: first attack against you each floor always misses"
   - Legendary items should be pulled from this pool by `legendary_id`, not randomly generated —
     they are fixed, named, collectible items

**What needs to be built:**

1. **Define the three libraries** in `rpg-constants.js` (`RARE_PASSIVES`, `EPIC_PASSIVES`,
   `LEGENDARY_EFFECTS`) with full effect definitions

2. **Rarity-gated passive rolling** in `generateGearItem()`:
   - Rare: 15% → roll 1 from `RARE_PASSIVES`
   - Epic: roll 1 from `EPIC_PASSIVES` (60% chance), possibly 2 (20% chance)
   - Legendary: always roll 1 from `EPIC_PASSIVES` + always attach 1 from `LEGENDARY_EFFECTS`
     (matched by `legendary_id`)

3. **Legendary item generation** — legendaries should pull from a fixed named-item pool
   rather than using the generic `generateGearItem()` name/stat logic

4. **Set bonus effects** — actual stat multipliers at 2/4/6 pieces equipped,
   applied in `computeGearTotals()` and reflected in the character sheet

5. **Wire passives into combat** in `rpg-engine.js`:
   - `on_hit` procs during `runCombatTurn` player attack
   - `on_defend` procs during enemy attack
   - `on_kill` procs on enemy death
   - `on_crit` procs alongside crit damage
   - `passive_stat` effects applied at gear-total time (already flows through naturally)

6. **UI display** — passive names + descriptions shown in:
   - Inventory item cards (already renders `passiveStr` if present)
   - Merchant item cards (already renders comparison — needs passive list too)
   - Equipped slot info panel

---

## Name-to-Stat Affinity Mapping

**Current state:** Item names (prefix + suffix) are pure flavor text drawn from rarity-bucketed
name pools. Stats are rolled completely independently. "Boots of the Sacred Flame" has no
connection to fire, INT, or any specific stat — the name only signals rarity (Rare suffix pool).

**What needs to be built:**

1. **Suffix stat affinities** — map each suffix to a weighted stat bias applied during `generateGearItem()`:
   - e.g. `'of the Wolf'` → bias toward STR + AGI
   - e.g. `'of Sacred Flame'` → bias toward INT + CHA
   - e.g. `'of the Bear'` → bias toward VIT + STR
   - e.g. `'of Thunder'` → bias toward AGI + CHA
   - etc. for all ~60 suffixes across all rarity tiers

2. **Prefix stat affinities** — similarly, prefix biases the secondary stats:
   - e.g. `'Iron'` → STR, VIT
   - e.g. `'Shadow'` → AGI, LCK
   - e.g. `'Sacred'` → CHA, INT

3. **Stat rolling uses affinity** — `generateGearItem()` weighs stat pool picks by
   the combined prefix + suffix affinity rather than pure random selection

4. **In-game tooltip** — show a short flavor line in the item card hinting at the affinity
   (e.g. "Imbued with sacred fire — grants power and presence")

---

## Other Planned Features

_(add future items here)_

---

*Last updated: 2026-03-01*
