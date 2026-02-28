# RPG Adventure — Unique Zone Mechanics

Last updated: 2026-02-27
Status: Phase 0 — Design Complete

Shared pool of named zone mechanics. Zones in ZONES.md reference these by their snake_case ID.
Not every zone uses a mechanic — vanilla zones (no mechanic) are common and valid.
Mechanics can be reused across multiple zones in the same or adjacent tiers.

---

## Mechanic Entry Format

```
ID          : snake_case identifier (used as the reference key in ZONES.md)
Name        : Human-readable display name
Description : What the player experiences
Impl Note   : How to implement in the game engine
Zones       : Which ZONES.md zones use this mechanic
```

---

## Environmental Damage — Per Turn

These mechanics deal passive true damage every turn of every combat. Stacks if somehow two
apply, but that should never happen in a single zone.

---

### `ashfall`
Name        : Ashfall
Description : Volcanic ash chokes the air. All combatants take 2 true damage at the start
              of each turn. No immunity is possible — ash gets into everything.
Impl Note   : Apply 2 true damage to both player and enemy at start of each turn. True damage
              bypasses DEF. No resist, no cancel. Show small ash particle effect on tick.
Zones       : Ashfall Wastes (Zone #51, T8)

---

### `scorching_ground`
Name        : Scorching Ground
Description : The earth beneath your feet is hot enough to cook meat. All combatants take
              3 true damage per turn. Even the enemies feel it — it just slows them less.
Impl Note   : Apply 3 true damage to both combatants at turn start. True damage. Show heat
              shimmer text indicator.
Zones       : The Lava Fields (Zone #36, T6)

---

### `elemental_conflict`
Name        : Elemental Conflict
Description : Two opposing elemental forces war constantly in this zone — arctic cold meets
              volcanic fire. Neither is safe. All combatants take 5 true damage per turn.
Impl Note   : Apply 5 true damage to both combatants each turn. True damage. Display a
              dual-element flavor tag on the turn summary.
Zones       : Frostfire Tundra (Zone #58, T9)

---

### `tidal_hazard`
Name        : Tidal Hazard
Description : Seawater surges through every 5 floors as the tide rises. When it hits, all
              combatants take 8 true damage. The sea does not care who you are.
Impl Note   : Track floor count within the zone run. Every 5th floor cleared, trigger before
              the next combat begins: deal 8 true damage to both player and enemy. True
              damage, no prevention. Show tide-rise notification.
Zones       : Sea Witch's Grotto (Zone #39, T6)

---

### `rising_water`
Name        : Rising Water
Description : Floodwater seeps through the temple floor. Every 5 floors, the rising tide
              deals 5 true damage to all combatants. The water is rising. Keep moving.
Impl Note   : Same trigger as `tidal_hazard` but 5 true damage instead of 8. Track floor
              count per run; every 5th floor, apply before next combat. True damage.
Zones       : The Sunken Temple (Zone #16, T3)

---

### `hellfire`
Name        : Hellfire
Description : The very air here is hostile to mortal life. Every turn, non-demon combatants
              take 8 true damage from the ambient demonic atmosphere.
Impl Note   : Apply 8 true damage to the player each turn. If the enemy is classified as
              a demon type, do NOT apply to them. True damage. Show hellfire border effect.
Zones       : The Demon Lord's Citadel (Zone #65, T10)

---

### `void_exposure`
Name        : Void Exposure
Description : The void at the world's edge eats life. All combatants take 10 true damage per
              turn. The creatures here are used to it. You are not.
Impl Note   : Apply 10 true damage to both combatants each turn. True damage. Highest
              per-turn damage of all environmental hazards. Show void-border effect.
Zones       : The World's Edge (Zone #69, T10)

---

## Environmental Damage — Random/Positional

These mechanics trigger on chance or under specific conditions, rather than every turn.

---

### `lightning_strike`
Name        : Lightning Strike
Description : Storm clouds crackle overhead. Each turn, there is a 15% chance a lightning
              bolt strikes a random combatant for 20 true damage. Luck, not tactics.
Impl Note   : At the end of each turn, roll 15% chance. On success, pick target at random
              (50/50 player/enemy). Deal 20 true damage to that target. Show lightning
              animation. Announce target ("Lightning strikes you!" / "Lightning strikes
              the enemy!").
Zones       : Storm Giant's Keep (Zone #46, T7)

---

## Flee Chance Modifiers

These mechanics adjust the player's flee success chance for the entire zone run.
The base flee formula applies first; then these modifiers are applied additively.

---

### `slick_ground`
Name        : Slick Ground
Description : Mud, ice, or wet stone underfoot. When you try to flee, you slip. Flee
              success chance is reduced by 10%.
Impl Note   : Subtract 10 percentage points from the flee success roll for every combat in
              the zone. Cannot reduce flee chance below 0%. Stacks with other flee modifiers.
Zones       : The Muddy Fen (Zone #3, T1)

---

### `bitter_cold`
Name        : Bitter Cold
Description : The cold seizes muscles and slows legs. Flee success chance is reduced by 15%.
              Enemies are adapted to these temperatures. You are not.
Impl Note   : Subtract 15 percentage points from the flee success roll. Cannot reduce below
              0%. Stronger version of `slick_ground`.
Zones       : Icemaw Caverns (Zone #24, T4)

---

### `open_terrain`
Name        : Open Terrain
Description : Rolling open land with plenty of room to run. Flee success chance is increased
              by 15%. If you want out, the exit is visible.
Impl Note   : Add 15 percentage points to flee success roll. Cannot increase above 95%
              (some flee chance is never guaranteed).
Zones       : Shepherd's Heath (Zone #6, T1)

---

## Hidden Information

These mechanics obscure enemy information from the player, forcing decisions with
incomplete data.

---

### `fog`
Name        : Fog
Description : Thick fog masks the enemy until they make their move. Enemy HP, ATK, and
              DEF are hidden until the enemy attacks for the first time.
Impl Note   : At combat start, display "???" for all enemy stats. After the enemy's first
              attack action resolves, reveal actual HP, ATK, and DEF values. Stats stay
              visible for the rest of the fight.
Zones       : The Boglands (Zone #18, T3)

---

### `darkness`
Name        : Darkness
Description : In the lightless deep, enemies are invisible until struck. Enemy HP and stats
              are hidden until the player lands a hit.
Impl Note   : At combat start, display "???" for enemy HP, ATK, DEF. After the player's
              first successful hit lands, reveal all stats. Stats stay visible for the rest
              of the fight. Missed player attacks do not trigger reveal.
Zones       : The Abyssal Depths (Zone #43, T7)

---

### `fey_glamour`
Name        : Fey Glamour
Description : Fey magic disguises enemies as a different creature type until they are
              first attacked. The illusion shatters on first contact.
Impl Note   : At combat start, replace the displayed enemy name and type with a randomly
              chosen incorrect type from the same tier. Keep HP/stats accurate but hidden
              under the glamour name. On the player's first successful attack, reveal the
              true name and type. Use correct enemy art after reveal.
Zones       : The Feywild Crossing (Zone #49, T7)

---

## Enemy Behavior Modifiers

These mechanics alter how enemies act during combat.

---

### `undying`
Name        : Undying
Description : When a basic enemy is reduced to 0 HP, it rises again with 25% of its
              maximum HP. It can only be killed once per combat.
Impl Note   : On an enemy reaching 0 HP: check if it has already used its undying revival.
              If not: restore HP to 25% of max, show "The creature rises again!" message,
              mark it as having used its revival. Second time it reaches 0 HP: normal death.
              Boss enemies are NOT affected by this mechanic.
Zones       : The Undying Crypts (Zone #26, T4), The Black Marshes (Zone #40, T6)

---

### `predator`
Name        : Predator Initiative
Description : Jungle predators move before prey. Each enemy has a 20% chance to act first
              regardless of the AGI comparison.
Impl Note   : During initiative resolution: for each enemy, roll 20%. On success, override
              the normal AGI-based order and place this enemy at the start of the turn.
              If multiple enemies trigger predator in a multi-enemy scenario, resolve them
              in order among themselves normally. Player AGI is still used in all other
              calculations.
Zones       : The Whispering Jungle (Zone #22, T4)

---

### `ambush`
Name        : Ambush
Description : Goblins call for help. Each floor, there is a 10% chance an additional enemy
              appears mid-combat, joining the fight at the start of a new turn.
Impl Note   : At the start of each new combat turn (after the first turn), roll 10%. On
              success, spawn one additional enemy from the zone's enemy table at the Scout
              or Soldier bracket (cap: 1 extra enemy per combat, same combat only).
              Show "A [enemy] jumps out!" message.
Zones       : Goblin Warren (Zone #4, T1)

---

### `reinforcements`
Name        : Reinforcements
Description : Enemy combatants call allies. Each turn, enemy has a 10% chance to summon
              one additional enemy of the same type.
Impl Note   : At the start of each enemy turn after the first, roll 10% per active enemy.
              On success, add one ally of the same type at Scout bracket. Hard cap: maximum
              3 enemies in combat at once (including the original). No new enemy spawns if
              already at cap. Show "[Enemy] signals for backup!" message.
Zones       : Bandit's Crossing (Zone #13, T2)

---

### `full_moon_rage`
Name        : Full Moon Rage
Description : Lycanthropes are empowered. All lycanthrope-type enemies deal +30% damage.
              They are faster, stronger, and harder to flee from under the moon.
Impl Note   : When an enemy is flagged as type: lycanthrope, multiply their ATK by 1.30
              for all damage calculations. Apply this before all other damage modifiers.
              Flee chance is also reduced by 10% when fighting a lycanthrope (stacks with
              zone flee modifiers).
Zones       : The Moonlit Wastes (Zone #45, T7)

---

## Player Stat Modifiers — Conditional

These mechanics alter player stats conditionally during specific combats.

---

### `quicksand`
Name        : Quicksand Trap
Description : 15% chance per combat of encountering hidden quicksand. When triggered,
              the player's AGI is treated as 10 lower for flee and dodge calculations
              for that fight only.
Impl Note   : At combat start, roll 15%. On success: apply AGI −10 (floored at 0) for flee
              and dodge rolls only — not for attack order. Apply for the full fight. Show
              "The ground shifts under your feet!" message at combat start on trigger.
Zones       : The Marshlands (Zone #9, T2)

---

### `ethereal_enemies`
Name        : Ethereal Enemies
Description : Spirits and wraiths deflect physical blows. STR-based physical attacks deal
              20% less damage against ethereal enemies. INT-based (magical) attacks are
              unaffected.
Impl Note   : For all enemies flagged type: ethereal or type: undead-spirit in this zone,
              multiply damage from STR-based attacks by 0.80 before applying DEF. Leave
              INT-based attack damage untouched. Do not apply to boss enemies unless boss
              is also flagged ethereal.
Zones       : Wraithwood (Zone #30, T5)

---

## Visibility / Hit Chance Modifiers

These mechanics apply blanket hit chance penalties to both combatants during specific combats.

---

### `sandstorm`
Name        : Sandstorm
Description : A savage desert sandstorm hits at random. When it rolls in, neither side
              can see clearly. Both combatants suffer −15% hit chance for that fight.
Impl Note   : At combat start, roll 20%. On success, subtract 15 percentage points from
              hit chance for both player and enemy for the entire fight. Show "A sandstorm
              sweeps in!" notification. Hit chance cannot drop below 5%.
Zones       : The Screaming Desert (Zone #28, T4)

---

### `sea_storm`
Name        : Sea Storm
Description : Perpetual magical storms batter the coast. The wind and waves make every
              fight harder to see through. Both sides have −20% hit chance at all times.
Impl Note   : Subtract 20 percentage points from hit chance for both player and enemy in
              every combat in this zone. Persistent (not rolled per fight). Hit chance
              cannot drop below 5%.
Zones       : Sea of Storms (Zone #53, T8)

---

## Loot / Room Modifiers

These mechanics alter the contents of non-combat rooms or loot drop rates.

---

### `hidden_cache`
Name        : Hidden Cache
Description : Old ruins hide buried treasure. 15% chance per non-boss floor of a hidden
              loot stash appearing — a bonus item with no combat required.
Impl Note   : After each non-boss floor generates its room, roll 15%. On success, append
              a bonus loot event before the floor advance. Generate one item using the
              standard loot table for the zone's level, weighted +1 rarity tier. No combat,
              no cost, just the item. Show "You spot something buried under the rubble!"
Zones       : Hillside Ruins (Zone #11, T2)

---

### `trap_heavy`
Name        : Trap Heavy
Description : This dungeon was built with defensive traps in mind. Trap rooms appear twice
              as frequently as normal.
Impl Note   : Multiply the base trap room spawn chance by 2.0 for this zone. Trap damage
              uses the standard `trapDamage(zoneLevel)` formula. AGI 50+ still grants 30%
              dodge chance on trap rooms.
Zones       : The Old Dungeon (Zone #20, T3)

---

### `labyrinth`
Name        : Labyrinth
Description : The maze shifts with each venture. The boss room's position within the floor
              count is randomized each run — the player never knows how many floors remain.
Impl Note   : At run start, set boss floor to a random position within the zone's normal
              floor range (±5 floors from the median). Do not display floor count to the
              player while the zone is active. Display "The path winds unpredictably..."
              in zone description.
Zones       : Verdant Labyrinth (Zone #35, T5)

---

## Boss Fight Modifiers

These mechanics specifically alter boss combat behavior.

---

### `dragon_shadow`
Name        : Dragon's Shadow
Description : The dragon itself looms over every boss fight in this zone. During boss
              combat, there is a 20% chance per turn of the dragon adding one bonus
              attack to the boss's action.
Impl Note   : During boss fights only: at the start of each boss turn, roll 20%. On success,
              the boss deals one additional attack at 50% of its normal ATK damage (this is
              the dragon's strike, not the boss's). Show "The shadow of the dragon strikes!"
              message. Cannot trigger the same turn as the boss's Enrage ability.
Zones       : Dragon's Approach (Zone #33, T5)

---

### `dragon_domain`
Name        : Dragon's Domain
Description : The elder dragon's presence transforms every major encounter. All floor bosses
              in this zone are Elder Dragon variants with enhanced base stats.
Impl Note   : Override normal boss selection for this zone: always use an Elder Dragon entry
              from the boss table, with base stats multiplied by 1.25. Use the standard boss
              ability system on top of the enhanced stats. Flavor text acknowledges the
              dragon's domain.
Zones       : Drakenspire Summit (Zone #55, T8)

---

## Reality / Magic Modifiers

These mechanics alter fundamental game rules in unusual ways.

---

### `unstable_magic`
Name        : Unstable Magic
Description : Raw, pre-civilized magic saturates the ruins. 20% chance at combat start for
              a random magical effect to trigger on either combatant — positive or negative,
              equal probability.
Impl Note   : At combat start, roll 20%. On success, select one effect at random from the
              Unstable Magic table (8 entries, 4 positive / 4 negative), and apply to
              either player or enemy (50/50). Show "Wild magic surges!" message.
              Unstable Magic Table:
              Positive: +20% ATK this fight | +20% DEF this fight | +25% HP restored |
                        +10% hit chance this fight
              Negative: −20% ATK this fight | −20% DEF this fight | −10 max HP this fight |
                        −10% hit chance this fight
Zones       : Ruins of the First Kingdom (Zone #60, T9)

---

### `divine_ground`
Name        : Divine Ground
Description : The residual power of a god fills this place. True damage dealt by enemies
              cannot be reduced by any means. DEF is still applied to non-true damage.
Impl Note   : Flag all enemy true damage in this zone as "divine true damage." Divine true
              damage bypasses all damage reduction effects, including zone mechanics,
              gear effects (e.g., damage reduction set bonuses), and legendary effects
              that reduce incoming true damage. Normal DEF still applies to standard
              enemy attacks.
Zones       : Godstone Peaks (Zone #62, T9)

---

### `broken_physics`
Name        : Broken Physics
Description : Reality is still bleeding here. Once per combat, ATK and DEF values swap
              between player and enemy for 3 turns. Only happens once per fight.
Impl Note   : Trigger at a random point in the combat (earliest: turn 3; latest: 80% of
              expected fight duration). Swap effective ATK and effective DEF values for
              both combatants simultaneously for exactly 3 turns, then revert. Can only
              trigger once per combat. Show "Reality shifts — your strengths have swapped!"
              Display a combat-wide status tag during the swap. During the swap, the
              player uses the enemy's effective ATK and effective DEF, and vice versa.
Zones       : The Shattered Realm (Zone #67, T10)

---

## Summary Table

| ID                  | Name                | Tier Range | Type              | Zones                   |
|---------------------|---------------------|------------|-------------------|-------------------------|
| `ashfall`           | Ashfall             | T8         | Env damage/turn   | #51                     |
| `scorching_ground`  | Scorching Ground    | T6         | Env damage/turn   | #36                     |
| `elemental_conflict`| Elemental Conflict  | T9         | Env damage/turn   | #58                     |
| `tidal_hazard`      | Tidal Hazard        | T6         | Periodic damage   | #39                     |
| `rising_water`      | Rising Water        | T3         | Periodic damage   | #16                     |
| `hellfire`          | Hellfire            | T10        | Env damage/turn   | #65                     |
| `void_exposure`     | Void Exposure       | T10        | Env damage/turn   | #69                     |
| `lightning_strike`  | Lightning Strike    | T7         | Random damage     | #46                     |
| `slick_ground`      | Slick Ground        | T1         | Flee modifier     | #3                      |
| `bitter_cold`       | Bitter Cold         | T4         | Flee modifier     | #24                     |
| `open_terrain`      | Open Terrain        | T1         | Flee modifier     | #6                      |
| `fog`               | Fog                 | T3         | Hidden info       | #18                     |
| `darkness`          | Darkness            | T7         | Hidden info       | #43                     |
| `fey_glamour`       | Fey Glamour         | T7         | Hidden info       | #49                     |
| `undying`           | Undying             | T4, T6     | Enemy behavior    | #26, #40                |
| `predator`          | Predator Initiative | T4         | Enemy behavior    | #22                     |
| `ambush`            | Ambush              | T1         | Enemy behavior    | #4                      |
| `reinforcements`    | Reinforcements      | T2         | Enemy behavior    | #13                     |
| `full_moon_rage`    | Full Moon Rage      | T7         | Enemy behavior    | #45                     |
| `quicksand`         | Quicksand Trap      | T2         | Stat modifier     | #9                      |
| `ethereal_enemies`  | Ethereal Enemies    | T5         | Stat modifier     | #30                     |
| `sandstorm`         | Sandstorm           | T4         | Hit chance        | #28                     |
| `sea_storm`         | Sea Storm           | T8         | Hit chance        | #53                     |
| `hidden_cache`      | Hidden Cache        | T2         | Loot modifier     | #11                     |
| `trap_heavy`        | Trap Heavy          | T3         | Room modifier     | #20                     |
| `labyrinth`         | Labyrinth           | T5         | Room modifier     | #35                     |
| `dragon_shadow`     | Dragon's Shadow     | T5         | Boss modifier     | #33                     |
| `dragon_domain`     | Dragon's Domain     | T8         | Boss modifier     | #55                     |
| `unstable_magic`    | Unstable Magic      | T9         | Reality modifier  | #60                     |
| `divine_ground`     | Divine Ground       | T9         | Reality modifier  | #62                     |
| `broken_physics`    | Broken Physics      | T10        | Reality modifier  | #67                     |

**Total: 31 mechanics in the shared pool.**

---

## Implementation Notes

- All zone mechanics are applied per-zone for the duration of a run in that zone.
- Mechanics are read from the zone's `mechanic` field (the mechanic ID string).
- If mechanic is `null` or `"none"`, no mechanic logic is applied for that zone.
- Multiple zones can share the same mechanic ID (e.g., `undying` applies to T4 and T6 zones).
- Mechanic logic should live in `addons/rpg_adventure/mechanics/zone-mechanics.js`.
- Each mechanic ID maps to a handler function exported from that module.
- Challenge zones use their own special rule logic, not from this pool.

---

*See docs/rpg/ZONES.md for which zones use each mechanic.*
*See docs/rpg/CLAUDE.md for theme rules and locked decisions.*
*See docs/rpg/GAMEPLAN.md for implementation phases.*
