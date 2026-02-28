# Aria's Adventure — Gear System

Last updated: 2026-02-27
Status: Design / Pre-Implementation

---

## Gear Slot Overview

```
Slot        Count   Primary Stats          Unique Passive Pool
──────────────────────────────────────────────────────────────
Weapon      1       ATK, STR, INT, LCK     Weapon-only passives
Head        1       INT, AGI               Head-only passives
Chest       1       VIT, DEF               Chest-only passives
Hands       1       STR, ATK, LCK          Hand-only passives
Feet        1       AGI, dodge             Feet-only passives
Ring        2       Any stat               Ring-only passives
Amulet      1       Any stat               Amulet-only passives
Belt        1       Utility                Belt-only passives
Trinket     1       Exotic/unique          Trinket-only (all unique)
──────────────────────────────────────────────────────────────
Total       10 items equipped at once
```

---

## Weapon Types

Each weapon type has a primary scaling stat and a damage style.
Certain builds prefer certain weapon types.

| Weapon Type | Primary Stat | Style | Notes |
|-------------|-------------|-------|-------|
| Sword | STR | Balanced melee | 1H, reliable |
| Greatsword | STR | Slow, heavy | 2H, high damage, +10% crit mult |
| Dagger | AGI | Fast melee | 1H, dual-wield eligible |
| Dual Blades | AGI + STR | Very fast | 2H slot used, attacks twice per turn |
| Katana | STR + AGI | Precise | 1H, high crit chance inherently |
| Scythe | STR | AOE sweep | 2H, cleave (damages DEF directly) |
| Axe | STR | Armor shred | 2H, reduces enemy DEF by 10% per hit |
| Hammer | STR | Stun | 2H, 20% stun chance inherently |
| Spear | STR | Reach | 2H, always attacks before enemy |
| Claws | AGI | Rapid | 2H, 3 weak hits per turn instead of 1 |
| Whip | AGI | Control | 1H, applies debuffs on hit (random) |
| Staff | INT | Magic | 1H or 2H, scales INT attacks |
| Wand | INT | Fast magic | 1H, lower power but rapid |
| Tome | INT | Buffing | 1H, grants ability to apply one buff/debuff |
| Grimoire | INT | Summon | 2H, small chance to summon a combat ally |
| Bow | AGI + LCK | Ranged | 2H, ignores dodge check (ranged) |
| Crossbow | STR + LCK | Heavy ranged | 2H, high per-shot but slow reload (every 2 turns) |
| Naginata | STR + INT | Hybrid | 2H, hybrid scaling between STR and INT |
| Chakram | AGI + LCK | Returning | 1H, always hits (ignores dodge), moderate damage |

---

## Armor Types

### Head (Helmet / Visor / Cowl / Crown / Mask / Hood)

Head gear offers INT and AGI stat bonuses plus head-specific passives.

**Head-only Passive Pool (20 options):**

1.  **Focus** — +15% critical hit chance
2.  **Clarity** — Reduce enemy accuracy by 10%
3.  **Mindshield** — Immune to Confused and Fear status effects
4.  **Prescience** — See enemy HP total before battle starts
5.  **Arcane Attunement** — +10% XP gain from all sources
6.  **Warrior's Insight** — Reveal all enemy special abilities at fight start
7.  **Eagle Eye** — +20% dodge chance (enhanced threat perception)
8.  **Cascade Memory** — After killing an enemy, next attack is guaranteed to hit
9.  **Spirit Ward** — Immune to INT/psionic drain effects
10. **Threat Assessment** — Know exactly how much damage enemy will deal each turn
11. **Echo Sense** — Can sense shiny enemies one room in advance
12. **Reflex Buffer** — Once per fight, automatically dodge a killing blow
13. **Bond Boost** — Companion assist messages have 20% bonus effectiveness
14. **Counter-Intel** — When enemy uses a special ability, gain +5 to all stats for 1 turn
15. **Adaptive Targeting** — Each miss increases hit chance by 10% (stacks, resets on hit)
16. **Pain Filter** — Damage over 30% of max HP in one hit is reduced by 25%
17. **Mark of the Hunt** — Gain 1 LCK per floor cleared (resets on run end)
18. **Life Drain** — On kill, restore 5% max HP
19. **Resonant Frequency** — Attacks against stunned enemies deal 2× damage
20. **Phantom Veil** — 10% chance per turn to become untargetable for 1 turn

---

### Chest (Plate / Vest / Coat / Cuirass / Robe / Shroud)

Chest gear offers VIT and DEF stat bonuses plus chest-specific passives.

**Chest-only Passive Pool (20 options):**

1.  **Iron Will** — Survive one killing blow per run at 1 HP (once)
2.  **Thorns** — Return 15% of all damage received to the attacker
3.  **Regeneration** — Restore (VIT × 0.1) HP at the start of each player turn
4.  **Resistance** — Choose one damage type at equip time; take -30% from it
5.  **Fortitude** — +12% max HP (calculated from base VIT)
6.  **Barrier** — At fight start, a barrier absorbs the first X damage (X = DEF score)
7.  **Second Wind** — Once per fight, at 25% HP, heal 30% max HP
8.  **Stoneskin** — Minimum damage received per hit is 1 (cap of 0 doesn't apply)
9.  **Wrath of the Wounded** — Each time you're hit, gain +2 ATK (stacks to 10)
10. **Bulwark** — Reduce all incoming damage by a flat 5 points (after other calculations)
11. **Phantom Mantle** — 20% chance any physical attack passes through you (no damage)
12. **Battle Endurance** — Damage taken in the last 3 turns is reduced by 15%
13. **Surge of Survival** — After taking damage that drops you below 20% HP, heal 20% max HP (once per fight)
14. **Runic Ward** — Immune to the first status effect applied in any fight
15. **Forged Resilience** — Each time same attack type hits you twice, gain +5 DEF vs. that type
16. **Iron Shell** — Attacks that deal more than 20% max HP in one hit trigger a damage refund of 10%
17. **Life Buffer** — Max HP increased by 50% of VIT score as a bonus (multiplicative)
18. **Martyrdom** — On death (if Iron Will triggers), deal damage equal to 50% of your max HP to enemy
19. **Sacrifice** — If companion is about to take a killing blow, intercept it (prevent the assist fail)
20. **Defensive Stance** — If you don't attack for 1 turn (defensive stance), gain +50% DEF next turn

---

### Hands (Gauntlets / Gloves / Bracers / Claws / Grips)

Hands gear offers STR, ATK, and LCK bonuses plus hand-specific passives.

**Hands-only Passive Pool (20 options):**

1.  **Quick Draw** — Attack twice at 60% damage each instead of once per turn
2.  **Heavy Grip** — +20% damage with 2-handed weapons
3.  **Tactician** — Once per fight, skip enemy's turn entirely (tactical override)
4.  **Battle Fury** — Critical hit chance doubles for the first attack of each combat
5.  **Enchant Touch** — Imbue weapon with +10 bonus magic damage per hit
6.  **Juggernaut** — Each consecutive attack on same enemy deals +5% more damage (stacks)
7.  **Iron Fist** — When your weapon is disabled/stolen, unarmed attacks deal 50% of normal weapon ATK
8.  **Finisher** — Attacks on enemies below 25% HP deal 2× damage
9.  **Haymaker** — Once per fight, sacrifice all crit chance for a guaranteed 3× damage hit
10. **Featherweight** — AGI score also contributes 50% to ATK damage calculation
11. **Swift Execution** — Killing an enemy with a crit refunds the action (attack again immediately)
12. **Spirit Strike** — 10% of attacks deal bonus damage equal to 20% of enemy max HP (soul-based)
13. **Chain Reaction** — Crits have 30% chance to trigger a free bonus attack at 50% damage
14. **Unstable Fist** — Damage range is dramatically wider (very high or very low, random)
15. **Weapon Mastery** — Equipped weapon type gains +15% damage bonus (specific to weapon class)
16. **Dismantle** — Each hit reduces enemy DEF by 3 permanently for the fight (stacks)
17. **Arcane Might** — INT score also contributes 50% to physical ATK calculation
18. **Battle Sense** — Record enemy's DEF value after first hit; subsequent hits ignore that DEF amount
19. **Iron Maiden** — Thorns from chest piece deal double damage when these gloves are equipped
20. **Deadly Precision** — Eliminates minimum damage cap variance; you always deal near-max damage

---

### Feet (Boots / Greaves / Treads / Sabatons / Steps)

Feet gear offers AGI and dodge bonuses plus feet-specific passives.

**Feet-only Passive Pool (20 options):**

1.  **Fleet Foot** — Automatically dodge the first attack in any combat
2.  **Pursuit** — Enemies that flee drop all their loot (you catch them)
3.  **Ghost Step** — 15% chance each turn to fully dodge ALL attacks that turn
4.  **Rush** — First attack of any combat deals +35% damage (closing burst)
5.  **Explorer** — +15% gold and XP gained in unexplored zones
6.  **Lightning Stride** — Always act first in combat regardless of AGI comparison
7.  **Grounded** — Cannot be knocked, stunned, or immobilized
8.  **Momentum Runner** — Each floor cleared without taking damage grants stacking +2 AGI (resets on hit)
9.  **Shadow Step** — Once per floor, bypass a trap room entirely (ignore it)
10. **Scatter Dodge** — When you dodge an attack, enemy is Disoriented for 1 turn
11. **Ambush Ready** — If enemy gets first turn, your first attack deals 2× damage (retaliation)
12. **Slip Away** — Flee success rate +30%
13. **Pressure Plates** — Traps no longer deal damage to you (you sense them)
14. **Predator Stance** — Each turn you don't take damage, gain +5 ATK (stacks, resets on damage)
15. **Surge of Speed** — After using a healing item, immediately attack for free
16. **Momentum Strike** — When you dodge an attack, next attack deals bonus damage equal to avoided damage
17. **Swift Retreat** — When HP drops below 30%, automatically dodge one attack per turn
18. **Pathfinder** — See the next 2 upcoming room types before entering each floor
19. **Sure Footing** — Immune to knockback and displacement effects from boss abilities
20. **Swift Strides** — If you haven't attacked this turn, double your dodge chance

---

### Ring (Signet / Band / Loop / Ring)

Rings are flexible — can boost any stat combination. Two ring slots allow mix-and-match.

**Ring-only Passive Pool (20 options):**

1.  **Amplification** — +8 flat bonus damage to all attacks
2.  **Elemental Affinity** — Magical attacks cost 20% less INT (allows more INT-dependent builds)
3.  **Blood Ring** — Kills restore (kills × 8) HP at end of combat
4.  **Fortune Ring** — +25% gold from all sources
5.  **Twin Strength** — If wearing two rings, each ring's stat bonuses are doubled
6.  **Resonance** — Each equipped set piece increases all ring stat bonuses by 10%
7.  **Life Tap** — Spend 10% current HP to deal 20% bonus damage on next attack
8.  **Void Mark** — Enemies you've damaged take +10% damage from all other sources
9.  **Luck Amplifier** — +1% crit chance per 10 LCK (bonus on top of base formula)
10. **Arcane Ring** — INT-based attacks trigger twice with 50% damage on second hit (10% chance)
11. **Stability** — Immune to stat drain/steal effects
12. **Recovery** — Healing items heal 30% more HP when this ring is equipped
13. **Signature Strike** — Pick one attack type at equip; that type gets +20% damage permanently
14. **Drain Ring** — 8% lifesteal on all attacks
15. **Chain Kill** — After a kill, the next attack in the same combat has +25% crit chance
16. **Aggression Loop** — Each turn without dodging, gain +3 ATK (offensive focus)
17. **Temporal Band** — Once per run, rewind last enemy attack (undo one hit taken)
18. **Nullification** — One enemy passive effect is disabled for the duration of any fight
19. **Feedback** — When damaged, gain +5% ATK for 2 turns
20. **Overflow** — When a buff would expire, 20% chance it refreshes automatically

---

### Amulet (Pendant / Charm / Locket / Chain / Talisman / Medallion)

**Amulet-only Passive Pool (20 options):**

1.  **Guardian's Ward** — Once per run, automatically block a lethal hit entirely
2.  **Companion's Grace** — Companion assist chance +20%
3.  **Charm Aura** — Enemy attacks have 10% chance to miss due to being overwhelmed
4.  **Philosopher's Stone** — Convert 5% of gold gained per run into bonus XP at run end
5.  **Soulbound** — Dying in a run retains one random Uncommon+ item instead of losing all loot
6.  **Martyr's Cry** — When HP drops below 15%, gain +40% ATK and +25% crit chance
7.  **Empathy Link** — Each companion assist restores 5 HP to the player
8.  **Focused Mind** — INT score contributes 25% to crit calculation as well
9.  **Luck Charm** — Loot rarity is always rolled twice; take the better result
10. **Amplify Aura** — All gear passives are 15% more effective
11. **Bond Pendant** — Gain +1 CHA permanently per zone tier cleared (stacks forever)
12. **Null Charm** — Immune to Void-type attacks and abilities
13. **Arcane Reservoir** — Gain 1 free magic attack per fight that deals INT × 2 damage
14. **Echo Pendant** — Last enemy ability used against you cannot be used again this fight
15. **Temporal Grace** — Once per fight, if you would die, skip that turn entirely (time pause)
16. **Resonant Core** — Each equipped item from the same zone tier grants +5 to all stats
17. **Soul Mirror** — Enemy stats are mirrored — any buff they gain, you gain half
18. **Arcane Conduit** — Stat bonuses from all rings doubled while this amulet is equipped
19. **Vow of Strength** — If you never use healing items in a run, all damage +25% for the run
20. **Judgment** — Final boss fights: player ATK ×1.5 (designed for endgame push)

---

### Belt (Sash / Strap / Band / Harness)

**Belt-only Passive Pool (20 options):**

1.  **Pack Rat** — Inventory holds 4 more items before it's "full"
2.  **Quick Pocket** — Use items without spending an action (free action)
3.  **Scavenger** — After clearing a floor, find 1 bonus item with 25% chance
4.  **Tactical Pouch** — Carry 2 extra healing items beyond normal inventory limit
5.  **Salvager** — Selling items returns 80% of value instead of 50%
6.  **Overloaded** — Carry 2 extra trinket slots (active only if equipped)
7.  **Merchant's Eye** — Items in the shop are 20% cheaper
8.  **Dungeon Provisioner** — Find one free healing item after every boss kill
9.  **Endurance Rig** — Reduces damage from trap rooms by 75%
10. **Equipment Buff** — The first item used in each combat is 50% more potent
11. **Hoarder** — At run end, randomly keep 1 item that would otherwise be lost
12. **Efficient Load** — Carrying fewer than 5 items in inventory grants +5% to all stats
13. **Stockpile** — Gold found in treasure rooms is doubled
14. **Loot Sense** — Treasure room loot is always one rarity tier above normal drop table
15. **Recovery Rig** — After each combat, restore 2% max HP passively
16. **Combat Medic** — Using a healing item during combat has 25% chance to not consume it
17. **Scout's Foresight** — See merchant inventory one room before reaching them
18. **Utility Expert** — Trinket effects are 25% more powerful while this belt is equipped
19. **Momentum Belt** — Starting a run with 0 deaths grants +10% to all stats for the full run
20. **Quick Swap** — Once per run, swap one equipped item for one in inventory as a free action

---

### Trinket (Orb / Crystal / Rune / Idol / Shard / Core)

Trinkets are wildly unique. Each has a distinct exotic effect not available on any other slot.

**Trinket Passive Pool (30 options — all unique):**

1.  **Chaos Orb** — Each turn, apply a completely random buff or debuff to either party
2.  **Luck Crystal** — Every 10th item found is automatically promoted to the next rarity tier
3.  **Mirror Shard** — Copy enemy's highest stat at combat start and use it for the whole fight
4.  **Rune of Memory** — After each combat, "record" your highest damage hit; deal it for free next fight
5.  **Void Rune** — 4% chance per turn to banish an enemy (instant kill, no loot, no XP)
6.  **Oracle's Shard** — Once per run, undo the last hit you received (remove the damage)
7.  **Companion's Talisman** — Companion assists every 3rd turn regardless of CHA stat
8.  **Fortune Idol** — The next treasure chest found contains triple items
9.  **Battle Rune** — +60% ATK for first 3 turns of each combat, then returns to normal
10. **Resonance Gem** — Each piece of gear from the same zone tier as you grants +3 all stats
11. **Death Mark** — When you kill an enemy, mark them; ghost form deals 50% ATK to next enemy for free
12. **Ward of Negation** — Cannot die to the same damage type twice in one run
13. **Shatter Crystal** — 20% chance any attack reflects onto a random adjacent target
14. **Volatile Rune** — Each kill makes next attack 10% stronger (stacks, resets on failed hit)
15. **Veil Shifter** — Every 5 turns, phase out of reality for 1 turn (immune to all damage)
16. **Soul Jar** — Captures essence of defeated enemies; spend essence to boost a stat by 5 temporarily
17. **Echo Stone** — The first enemy ability used against you is recorded; it cannot be used again this run
18. **Storm Rune** — Deals 5 lightning damage to attacking enemy each time they hit you
19. **Null Crystal** — Once per floor, make one enemy unable to use special abilities this fight
20. **Fate Dice** — At the start of each fight, all your stats are randomized (±20% from base)
21. **Stone of Binding** — Enemies with more than 2× your ATK have their ATK halved
22. **Ward of Silence** — Enemy "call backup" abilities are disabled entirely
23. **Echo Shard** — Crits recursively trigger additional crits at 50% damage (30% chain chance)
24. **Nullstone** — Once per run, completely negate a boss special ability
25. **Aria's Tear** — Companion assists deal 3× normal damage for the rest of the run (one-time activate)
26. **Entropy Idol** — Both you and enemy take -2 to all stats each turn — you start ahead, you win
27. **Focus Crystal** — Every 5 levels, gain a stacking +10 to all stats permanently per prestige
28. **Boss Hunter's Rune** — +50% damage to boss-tier enemies (no effect on regular enemies)
29. **Shiny Magnet** — Shiny enemy spawn rate doubled for the run
30. **Prestige Rune** — After each prestige, trinket grants +5 to all stat bonuses (cumulative)

---

## Rarity Rules Summary

### Common
- 1–2 stat bonuses (low range)
- No passive
- Gray name

### Uncommon
- 2–3 stat bonuses (moderate range)
- 0–1 passives (50% chance of 1 passive)
- Green name

### Rare
- 3–4 stat bonuses (solid range)
- 1–2 passives
- Blue name
- May be a set piece (1 in 8 chance when conditions met)
- All set pieces at Rare rarity form Rare Sets

### Epic
- 4–5 stat bonuses (high range)
- 2–3 passives
- Purple name
- May be a set piece (1 in 8 chance when conditions met)
- All set pieces at Epic rarity form Epic Sets
- Set bonuses on Epic items are dramatically more powerful than Rare sets

### Legendary
- 5–6 stat bonuses (very high range)
- 2–4 passives (including at least one unique-to-item passive)
- Unique named item with personal flavor text
- Orange name with animated glow
- NOT part of any set — has its own unique legendary bonus
- See LEGENDARIES.md for full roster

---

## Identification System (Optional Feature)

Higher-tier zones may drop **Unidentified** items. These appear as:
- "Unidentified Rare Sword" (tier and slot known, stats hidden)
- Cost gold at a merchant to identify, OR
- Identified automatically by a Head gear passive (Warrior's Insight)
- Unidentified items can be "gambled" at a merchant for a potential upgrade in rarity

---

## Item Destruction

Players can destroy items for crafting components (future feature):
- Common → Scrap Material
- Uncommon → Bone Fragment
- Rare → Refined Essence
- Epic → Essence Crystal
- Legendary → Divine Fragment

These materials are reserved for Phase 2+ crafting system implementation.

---

## Extended Passive Pools

> **Phase 5 Placeholder**
>
> The 20 core passives per slot listed above are sufficient for Phase 0–4 implementation.
> Extended pools (80+ additional passives per slot, 170+ additional trinkets) will be
> designed in Phase 5 when the generation engine is built and the core passive set has
> been playtested. All names in the extended pools will follow the fantasy theme of this
> document. No tech/cyberpunk naming will be used.
>
> Entries in the extended pool will be tagged [T3+], [T5+], [T7+] etc. to restrict them
> to appropriate zone tiers, preventing early-game encounters with end-game effects.

---

*See GEAR_SETS.md for named set pieces and set bonus rules.*
*See LEGENDARIES.md for unique legendary item roster.*
*See GEAR_NAMES.md for procedural name generation.*
*See CLAUDE.md for theme rules and canonical decisions.*
