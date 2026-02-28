# RPG Adventure — Gear Sets

Last updated: 2026-02-27
Status: Phase 0 — Design Complete

25 sets total: 15 Rare + 10 Epic.
All piece names use classic fantasy adventure language — swords, armor, robes, no tech.

---

## Rules

- All pieces in a set MUST be the same rarity (no Rare/Epic mixing)
- Sets only exist at Rare and Epic rarity
- Legendary items are NOT part of sets — they have individual unique bonuses
- Set pieces are substantially rarer than normal drops (~1/8 chance when a qualifying drop occurs)
- Sets are bound to level brackets — you will not find a high-level set in a low-level zone
- Sets of 4 pieces have: 2pc and 4pc bonuses
- Sets of 5 pieces have: 2pc, 4pc, and 5pc bonuses
- Sets of 6 pieces have: 2pc, 4pc, and 6pc bonuses
- 6-Piece hard rules: no literal invincibility, no formula-breaking effects, must have a meaningful trade-off

## [UNIQUE] Tag

Five sets are marked [UNIQUE]. These have genuinely build-defining effects beyond the generic
bonus pool. All other sets draw from the generic pool (stat boosts, lifesteal, multi-hit
chance, crit chance, dodge bonus, armor penetration, HP regen, gold find, XP bonus,
companion assist frequency).

## Set Notation

```
SET NAME  (Rarity | Pieces | Level Bracket)  [UNIQUE]?
Pieces: Slot — Name, Slot — Name, ...

2pc: ...
4pc: ...
5pc/6pc: ...

Playstyle: ...
```

Gear slots: Weapon, Helm, Chest, Gloves, Boots, Belt, Ring, Amulet, Trinket

---

## RARE SETS — 15 Total (Level Brackets 10–120)

---

### THORNSTRIDER'S MANTLE  (Rare | 4-Piece | Levels 10–25)
Pieces: Helm — Thornstrider Hood, Chest — Thornstrider Jerkin,
        Gloves — Thornstrider Gauntlets, Boots — Thornstrider Boots

2pc: +25 AGI, +10% base dodge chance
4pc: Each successful dodge increases your ATK by 10% for 2 turns (stacks up to 3×, max
     +30% ATK). Stack expires when you take a hit.

Playstyle: Evasion-aggressor. Dodge to build power, then strike before the stack falls.

---

### IRONWALL GUARD  (Rare | 6-Piece | Levels 15–35)
Pieces: Helm — Ironwall Helm, Chest — Ironwall Plate, Gloves — Ironwall Gauntlets,
        Boots — Ironwall Greaves, Belt — Ironwall Belt, Ring — Ironwall Ring

2pc: +50 VIT, +20 DEF
4pc: Once per run, survive a killing blow at 1 HP instead of dying.
6pc: Immediately after surviving a killing blow, gain ATK +50% for 5 turns.

Playstyle: Tank with a comeback window. Survive the worst and retaliate.
Note: The 6pc is conditional — you only get the ATK spike if the 4pc fires.

---

### STORMSTEEL DUELIST  (Rare | 4-Piece | Levels 20–40)
Pieces: Weapon — Stormsteel Blade, Helm — Stormsteel Helm,
        Gloves — Stormsteel Bracers, Belt — Stormsteel Belt

2pc: +25 STR, every 3rd attack applies Stun (enemy loses its next action)
4pc: While the enemy is stunned, your ATK is +50% and attacks cannot miss.

Playstyle: Control fighter. Interrupt enemy rhythm; burst during the stun window.

---

### WANDERER'S FORTUNE  (Rare | 4-Piece | Levels 10–30)
Pieces: Helm — Wanderer's Cap, Chest — Wanderer's Coat,
        Belt — Wanderer's Belt, Boots — Wanderer's Boots

2pc: +30 LCK, gold found from all sources +35%
4pc: After each combat, restore HP equal to 5% of the gold you currently carry.

Playstyle: Gold-farming sustain. The richer you are, the better you heal.

---

### BLOODTHORN BERSERKER  (Rare | 5-Piece | Levels 50–75)
Pieces: Helm — Bloodthorn Helm, Chest — Bloodthorn Coat, Gloves — Bloodthorn Gauntlets,
        Boots — Bloodthorn Boots, Amulet — Bloodthorn Amulet

2pc: +30 STR, all attacks have 10% lifesteal
4pc: When lifesteal heals you to full HP, the overflow applies as bonus damage to the enemy.
5pc: Lifesteal rate doubles (20%) when you are below 40% HP.

Playstyle: Aggressive sustain. Get low, become nearly unkillable.

---

### SHADOWVEIL STALKER  (Rare | 4-Piece | Levels 55–80)
Pieces: Helm — Shadowveil Mask, Chest — Shadowveil Robe,
        Gloves — Shadowveil Wraps, Ring — Shadowveil Ring

2pc: +25 AGI, +25 INT — when you successfully dodge, release a shadow bolt dealing
     INT / 2 as magic damage.
4pc: Shadow bolts can crit and trigger companion assist procs.

Playstyle: Dodge-caster hybrid. React to attacks with magical punishment.

---

### IRONWOOD SENTINEL  (Rare | 6-Piece | Levels 20–40)
Pieces: Helm — Ironwood Helm, Chest — Ironwood Plate, Gloves — Ironwood Gauntlets,
        Boots — Ironwood Greaves, Belt — Ironwood Belt, Amulet — Ironwood Amulet

2pc: +45 VIT, HP regenerates 3 HP per turn even during combat.
4pc: Enemies below 30% HP deal 40% less damage to you.
6pc: Once per floor, you may pass through a combat room without fighting. Those enemies
     drop no loot and award no XP.

Playstyle: Unstoppable tank. Outlast enemies, regen through damage, bypass fights when needed.
Note: 6pc is a tactical tool, not a power fantasy — no loot means real trade-offs.

---

### VIPER'S COIL  (Rare | 5-Piece | Levels 40–65)
Pieces: Helm — Viper's Hood, Chest — Viper's Jerkin, Gloves — Viper's Gauntlets,
        Boots — Viper's Boots, Ring — Viper's Ring

2pc: +25 AGI, attacks apply Venom (3 true damage per turn, stacks to 5)
4pc: Each active Venom stack reduces the enemy's ATK by 5%.
5pc: When an enemy dies with 5 Venom stacks, the Venom explodes onto the next enemy for
     5 damage per stack (25 true damage total, immediate).

Playstyle: Attrition / DOT build. Poison kills and weakens — then spreads.

---

### EMBER KNIGHT  (Rare | 4-Piece | Levels 40–60)
Pieces: Helm — Ember Crown, Chest — Ember Plate,
        Gloves — Ember Gloves, Ring — Ember Ring

2pc: +30 INT, attacks have 20% chance to deal bonus fire damage equal to INT × 0.4.
4pc: After a fire hit, the enemy burns: takes 5 true damage at the start of its next turn.

Playstyle: Fire-stacking mage. Consistent chip damage from a distance.

---

### AMBUSHER'S KIT  (Rare | 5-Piece | Levels 45–65)
Pieces: Helm — Ambusher's Hood, Chest — Ambusher's Jerkin, Gloves — Ambusher's Grips,
        Boots — Ambusher's Boots, Belt — Ambusher's Belt

2pc: +30 AGI, +15 LCK — first attack each combat deals 2× damage.
4pc: If the first attack is also a crit, gain one free turn before the enemy can act.
5pc: First-strike bonus resets every 3 floors (not just once per fight).

Playstyle: Predator mindset. Strike before they can react.

---

### BERSERKER'S DEBT  (Rare | 5-Piece | Levels 20–40)
Pieces: Helm — Debt Crown, Chest — Debt Coat, Gloves — Debt Grips,
        Boots — Debt Boots, Amulet — Debt Amulet

2pc: +35 STR — each hit you take adds +5 ATK (stacks to a maximum of +50 ATK).
4pc: At max stacks, your attacks deal 2× damage and stacks drain slowly (−5 per turn) instead
     of resetting on a single hit.
5pc: When stacks fall to 0, deal damage equal to your full accumulated ATK bonus to the enemy.

Playstyle: Masochistic berserker. Take hits to build fury; cash it in.

---

### ARCANE SCHOLAR'S VESTMENTS  (Rare | 4-Piece | Levels 45–70)
Pieces: Helm — Scholar's Circlet, Chest — Scholar's Robe,
        Gloves — Scholar's Gloves, Ring — Scholar's Ring

2pc: +35 INT, +15 LCK — INT contributes to crit chance at a rate of INT / 10 added as
     bonus crit percentage (e.g., INT 80 → +8% crit chance).
4pc: When you land a critical hit, all active stat buffs on you extend by 2 turns.

Playstyle: Crit-fishing mage. Land crits to sustain your own empowerment windows.

---

### SKELETON KING'S REGALIA  (Rare | 6-Piece | Levels 80–100)
Pieces: Helm — Skeleton King's Crown, Chest — Skeleton King's Plate,
        Gloves — Skeleton King's Gauntlets, Boots — Skeleton King's Greaves,
        Ring — Skeleton King's Ring, Belt — Skeleton King's Belt

2pc: +50 STR, +35 DEF
4pc: Each kill restores HP equal to 15% of the HP you lost during that combat.
6pc: At the start of each new floor, restore 25% of your max HP.

Playstyle: Kill-momentum tank. Win quickly; recover between battles.

---

### GOLDFORGED GAMBLER  (Rare | 4-Piece | Levels 70–95)
Pieces: Ring — Goldforged Ring, Amulet — Goldforged Amulet,
        Belt — Goldforged Belt, Boots — Goldforged Boots

2pc: +40 LCK, +40 gold per kill
4pc: On death: drop all gold collected this run. The next run begins with triple that
     amount added to your starting gold.

Playstyle: High-stakes gold farming. Death is the reload state, not the end.
Note: The death trade-off is the entire design — this is intentionally all-in.

---

### CRUSADER'S HOLY ARMS  (Rare | 4-Piece | Levels 95–120)
Pieces: Helm — Crusader's Helm, Chest — Crusader's Plate,
        Gloves — Crusader's Gauntlets, Ring — Crusader's Ring

2pc: +45 STR, all attacks deal bonus holy damage equal to INT / 4 (flat, not percent).
4pc: Holy damage bypasses DEF entirely and heals you for 10% of holy damage dealt.

Playstyle: Hybrid STR/INT with built-in sustain. Holy damage rewards investing in INT.

---

## EPIC SETS — 10 Total (Level Brackets 60–400)

---

### OATHBREAKER'S RAIMENT  (Epic | 6-Piece | Levels 60–100)
Pieces: Helm — Oathbreaker's Crown, Chest — Oathbreaker's Coat,
        Gloves — Oathbreaker's Gauntlets, Boots — Oathbreaker's Sabatons,
        Ring — Oathbreaker's Ring, Amulet — Oathbreaker's Amulet

2pc: +50 to ALL stats, enemies deal 5% less damage per floor cleared this run.
4pc: You also deal 5% more damage per floor cleared this run.
6pc: Both floor-scaling effects have no cap for the duration of the run.

Playstyle: Long-run scaling build. Gets dramatically better the deeper you push.
Note: Effects reset when the run ends. Efficient in long runs, weaker in short ones.

---

### RUNEBOUND COMPANION  (Epic | 5-Piece | Levels 70–100)  [UNIQUE]
Pieces: Helm — Runebound Circlet, Chest — Runebound Coat, Gloves — Runebound Bracers,
        Boots — Runebound Boots, Amulet — Runebound Pendant

2pc: +55 CHA, companion assists fire on every other player turn regardless of CHA threshold.
4pc: Companion's assists set scalingMult = 2.5 (companion deals 125% of effective ATK).
     At CHA 50 base + this 4pc: companion deals 125% ATK per turn.
     Combined with [CHARACTER]'s Core legendary (baseMult = 1.0): companion deals 250% ATK.
5pc: Once per run, the companion intercepts a killing blow on your behalf. You survive at 1 HP.
     After intercepting, the companion is staggered for 3 turns (assist frequency reduced by 50%).

Playstyle: Bond-focused build. Treat the companion as a full combat partner.

See CLAUDE.md → Canonical Formulas → Companion Assist Damage for how scalingMult integrates.
This set was previously named "Synthetic Soul" in early design documents.

---

### CHAMPION'S LEGACY  (Epic | 6-Piece | Levels 80–115)  [UNIQUE]
Pieces: Helm — Champion's Crown, Chest — Champion's Cuirass, Gloves — Champion's Gauntlets,
        Boots — Champion's Sabatons, Ring — Champion's Ring, Belt — Champion's Belt

2pc: +65 STR, +35 flat ATK
4pc: Attacks have 30% chance to trigger a Chain Strike — strike a second time at 70% damage.
6pc: Chain Strikes can themselves chain (30% chance per link, maximum 4 links total).
[UNIQUE]: Your STR score counts double for all Chain Strike damage calculations (not base attacks).

Playstyle: Melee chain-combo burst. High variance; absurdly high ceiling.

---

### STONEHIDE COLOSSUS  (Epic | 4-Piece | Levels 105–145)  [UNIQUE]
Pieces: Helm — Stonehide Crown, Chest — Stonehide Plate,
        Ring — Stonehide Ring, Amulet — Stonehide Pendant

2pc: +90 VIT, all incoming damage reduced by 20% (after all other calculations).
4pc: Each hit you take stores 5% of the damage dealt as Rage (no per-combat cap).
     Your next attack releases all stored Rage as bonus true damage, then resets to 0.
[UNIQUE]: Rage carries between floors — it does not reset after a combat ends.
          It only resets when you spend it (by attacking) or when the run ends.

Playstyle: Damage-sponge colossus. Let enemies build your offense across many fights.

---

### DRAGON-FORGED SOVEREIGN  (Epic | 6-Piece | Levels 85–130)  [UNIQUE]
Pieces: Helm — Dragon-Forged Crown, Chest — Dragon-Forged Plate,
        Gloves — Dragon-Forged Gauntlets, Boots — Dragon-Forged Greaves,
        Ring — Dragon-Forged Ring, Amulet — Dragon-Forged Amulet

2pc: +75 STR, all attacks deal bonus fire damage equal to STR × 0.35.
4pc: Fire stacks on enemies persist between fights within a zone run — a burning enemy
     who flees or dies carries its stacks to the next enemy you face.
6pc: When an enemy dies, its fire stacks transfer to the next enemy you enter combat with.
[UNIQUE]: Fire stacks applied by this set last for the entire zone run. They do not fade
          between floors or combats. Stack maximum remains 5.

Playstyle: Long-burn fire build. Your first fight fuels every fight afterward.

---

### CRIMSON TIDE  (Epic | 6-Piece | Levels 105–155)
Pieces: Helm — Crimson Tide Crown, Chest — Crimson Tide Plate,
        Gloves — Crimson Tide Gauntlets, Boots — Crimson Tide Greaves,
        Ring — Crimson Tide Ring, Belt — Crimson Tide Belt

2pc: +85 STR, all attacks have 18% lifesteal.
4pc: Lifesteal can overheal up to 200% of your max HP. The excess becomes a HP shield.
6pc: The HP shield from overheal carries between fights (it does not reset after combat).

Playstyle: Aggressive sustain. Farm a shield across multiple fights, then push hard zones.

---

### DAWNBREAKER'S RESOLVE  (Epic | 6-Piece | Levels 120–165)
Pieces: Helm — Dawnbreaker's Helm, Chest — Dawnbreaker's Plate,
        Gloves — Dawnbreaker's Gauntlets, Boots — Dawnbreaker's Greaves,
        Ring — Dawnbreaker's Ring, Amulet — Dawnbreaker's Amulet

2pc: +80 LCK, +80 INT
4pc: Each enemy killed during this run grants +4 to ALL stats (run-scoped, maximum 100 kills
     = +400 to all stats). Resets when the run ends.
6pc: At maximum kill-stacks (100 kills), your next attack triggers Dawnburst: deal damage
     equal to 2× your total run-accumulated stat bonus as true damage (once per run).

Playstyle: Kill-everything-to-become-unstoppable. The payoff is enormous but earned.

---

### RUNEMASTER'S CASCADE  (Epic | 6-Piece | Levels 120–170)
Pieces: Helm — Runemaster's Circlet, Chest — Runemaster's Robe,
        Gloves — Runemaster's Gloves, Boots — Runemaster's Boots,
        Ring — Runemaster's Ring, Trinket — Runemaster's Idol

2pc: +85 INT, spells have 20% chance to echo — trigger a free second cast at 60% power.
4pc: Echoes can themselves echo (25% chance per link, max 4 links). Each echo triggers
     at 60% of the previous echo's damage.
6pc: Each link deeper in the echo chain deals +20% bonus damage above the 60% base.

Playstyle: Exponential spell scaling. Low chance to start, enormous ceiling.
Note: Maximum chain (4 links): 60% → 72% → 86.4% → 103.7% of original cast.

---

### LAST STAND  (Epic | 6-Piece | Levels 160–200)  [UNIQUE]
Pieces: Helm — Last Stand Crown, Chest — Last Stand Plate,
        Gloves — Last Stand Gauntlets, Boots — Last Stand Greaves,
        Ring — Last Stand Ring, Belt — Last Stand Belt

2pc: +95 VIT, +60 DEF
4pc: Cannot be reduced below 25% of your max HP by any single attack.
6pc: Once per floor, when you would be reduced to 0 HP, survive at 1 HP instead and
     gain 60% damage reduction for 3 turns. Cannot trigger again until you exit and
     re-enter the zone (complete the floor and move on).
[UNIQUE]: The 6pc trigger does not stack with other survive-a-kill effects. Only one
          can apply per lethal hit.

Playstyle: True endgame survival build. Multiple layers of protection stack into a fortress.
Note: This set replaces the "Zeroth Protocol" from early design documents (renamed, balanced).
      The 6pc is NOT invincibility — it's survive-at-1-HP once per floor, with a limited
      damage reduction window. You can still die if additional hits land in those 3 turns.

---

### CONQUEROR'S THRONE  (Epic | 6-Piece | Levels 300+)
Pieces: Helm — Conqueror's Crown, Chest — Conqueror's Plate,
        Gloves — Conqueror's Gauntlets, Boots — Conqueror's Greaves,
        Ring — Conqueror's Ring, Amulet — Conqueror's Amulet

2pc: +110 to ALL stats
4pc: Each floor cleared this run grants +2% to all stats (maximum 100 floors = +200% all stats).
     Resets when the run ends.
6pc: At 100 floor-stacks, all your attacks deal bonus true damage equal to 10% of the
     enemy's max HP per hit.

Playstyle: Prestige-tier scaling. Designed for T10 zones and players who have run for hours.
Note: This set replaces "Recursive Throne" from early design documents. The infinite scaling
      and no-cap formula-breaking 6pc of the original have been removed. This version caps at
      100 stacks and requires time investment, not a formula exploit.

---

## Design Notes

### Generic Bonus Pool
Most set bonuses draw from this pool. These effects are balanced across all sets.
Unique-pool effects are reserved for the 5 [UNIQUE]-tagged sets.

Generic effects: stat boosts (any of the 6 stats), lifesteal (flat %), multi-hit chance,
crit chance bonus, dodge chance bonus, armor penetration (DEF bypass %), HP regen (per-turn),
gold find %, XP bonus %, companion assist frequency modifier.

### Set Acquisition
- A full 4-piece Rare set: ~8–15 hours of play in the correct zone tier
- A full 6-piece Rare set: ~15–25 hours
- A full 4-piece Epic set: ~20–35 hours
- A full 6-piece Epic set: ~40–70 hours
- Pieces have distinct visual appearance in UI (name glow, rarity color, set-tag indicator)

### Balance Philosophy
- Rare sets: clearing one zone tier above their intended level range
- Epic sets: clearing two zone tiers above their intended level range
- A full set (with active bonuses) should never lose to a random mix of same-rarity pieces
  of identical average item level

### Companion Assist Formula Reference
Runebound Companion 4pc sets `scalingMult = 2.5` in the canonical assist formula.
See docs/rpg/CLAUDE.md → Companion Assist Damage for the full formula.
Default scalingMult = 1.0. Only this set changes it.

---

*See docs/rpg/CLAUDE.md for theme rules and locked decisions.*
*See docs/rpg/LEGENDARIES.md for legendary items (not part of sets).*
*See docs/rpg/GEAR_NAMES.md for fantasy prefix/suffix name banks.*
