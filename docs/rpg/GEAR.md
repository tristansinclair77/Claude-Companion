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
| Pistol | AGI | Fast ranged | 1H, fires twice per turn at 60% damage each |
| Shotgun | STR | Spread | 2H, damages enemy and reduces DEF for 2 turns |
| Sniper Rifle | LCK + AGI | Precision | 2H, charges 1 turn then deals 4× damage |
| SMG | AGI | Burst | 2H, 5 weak hits per turn |
| Naginata | STR + INT | Hybrid | 2H, hybrid scaling between STR and INT |
| Chakram | AGI + LCK | Returning | 1H, always hits (ignores dodge), moderate damage |
| Energy Blade | INT + STR | Hybrid | 1H, deals bonus magic damage equal to INT/2 |
| Railgun | STR + INT | Charging | 2H, charges 2 turns, then pierces DEF entirely |

---

## Armor Types

### Head (Helmet / Visor / Cowl / Crown / Interface / Mask / Hood)

Head gear offers INT and AGI stat bonuses plus head-specific passives.

**Head-only Passive Pool (20 options):**

1.  **Focus** — +15% critical hit chance
2.  **Clarity** — Reduce enemy accuracy by 10%
3.  **Mindshield** — Immune to Confused and Fear status effects
4.  **Prescience** — See enemy HP total before battle starts
5.  **Neural Interface** — +10% XP gain from all sources
6.  **Battle Scan** — Reveal all enemy special abilities at fight start
7.  **Overclock Vision** — +20% dodge chance (enhanced threat perception)
8.  **Cascade Memory** — After killing an enemy, next attack is guaranteed to hit
9.  **Psychic Ward** — Immune to INT/psionic drain effects
10. **Threat Assessment** — Know exactly how much damage enemy will deal each turn
11. **Echo Sense** — Can sense shiny enemies one room in advance
12. **Reflex Buffer** — Once per fight, automatically dodge a killing blow
13. **Signal Boost** — Companion assist messages have 20% bonus effectiveness
14. **Counter-Intel** — When enemy uses a special ability, gain +5 to all stats for 1 turn
15. **Adaptive Targeting** — Each miss increases hit chance by 10% (stacks, resets on hit)
16. **Pain Filter** — Damage over 30% of max HP in one hit is reduced by 25%
17. **Memory Leak (passive)** — Gain 1 LCK per floor cleared (resets on run end)
18. **Data Drain** — On kill, restore 5% max HP
19. **Resonant Frequency** — Attacks against stunned enemies deal 2× damage
20. **Ghost Signal** — 10% chance per turn to become untargetable for 1 turn

---

### Chest (Plate / Vest / Coat / Cuirass / Jacket / Robe / Shroud)

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
9.  **Retaliation Matrix** — Each time you're hit, gain +2 ATK (stacks to 10)
10. **Bulwark** — Reduce all incoming damage by a flat 5 points (after other calculations)
11. **Phase Vest** — 20% chance any physical attack passes through you (no damage)
12. **Endurance Protocol** — Damage taken in the last 3 turns is reduced by 15%
13. **Emergency Repair** — After taking damage that would drop you below 20% HP, heal 20% max HP (once per fight)
14. **Void Shroud** — Immune to the first status effect applied in any fight
15. **Adaptive Plating** — Each time same attack type hits you twice, gain +5 DEF vs. that type
16. **Carbon Shell** — Attacks that deal more than 20% max HP in one hit trigger a damage refund of 10%
17. **Life Buffer** — Max HP increased by 50% of VIT score as a bonus (multiplicative)
18. **Martyrdom** — On death (if Iron Will triggers), deal damage equal to 50% of your max HP to enemy
19. **Sacrifice** — If companion is about to take a killing blow, intercept it (prevent the assist fail)
20. **Sentinel Mode** — If you don't attack for 1 turn (defensive stance), gain +50% DEF next turn

---

### Hands (Gauntlets / Gloves / Bracers / Claws / Interface / Grips)

Hands gear offers STR, ATK, and LCK bonuses plus hand-specific passives.

**Hands-only Passive Pool (20 options):**

1.  **Quick Draw** — Attack twice at 60% damage each instead of once per turn
2.  **Heavy Grip** — +20% damage with 2-handed weapons
3.  **Tactician** — Once per fight, skip enemy's turn entirely (tactical override)
4.  **Overclock Strike** — Critical hit chance doubles for the first attack of each combat
5.  **Enchant Touch** — Imbue weapon with +10 bonus magic damage per hit
6.  **Juggernaut** — Each consecutive attack on same enemy deals +5% more damage (stacks)
7.  **Iron Fist** — When your weapon is disabled/stolen, unarmed attacks deal 50% of normal weapon ATK
8.  **Finisher** — Attacks on enemies below 25% HP deal 2× damage
9.  **Haymaker** — Once per fight, sacrifice all crit chance for a guaranteed 3× damage hit
10. **Featherweight** — AGI score also contributes 50% to ATK damage calculation
11. **Execution Protocol** — Killing an enemy with a crit refunds the action (attack again immediately)
12. **Soul Strike** — 10% of attacks deal bonus damage equal to 20% of enemy max HP (soul-based)
13. **Chain Reaction** — Crits have 30% chance to trigger a free bonus attack at 50% damage
14. **Unstable Fist** — Damage range is dramatically wider (very high or very low, random)
15. **Weapon Mastery** — Equipped weapon type gains +15% damage bonus (specific to weapon class)
16. **Dismantle** — Each hit reduces enemy DEF by 3 permanently for the fight (stacks)
17. **Amp Circuit** — INT score also contributes 50% to physical ATK calculation
18. **Combat Data** — Record enemy's DEF value after first hit; subsequent hits ignore that DEF amount
19. **Iron Maiden** — Thorns from chest piece deal double damage when these gloves are equipped
20. **Precision Protocol** — Eliminates minimum damage cap variance; you always deal near-max damage

---

### Feet (Boots / Greaves / Treads / Sabatons / Steps / Runners)

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
9.  **Phase Step** — Once per floor, teleport past a trap room (ignore it)
10. **Scatter Dodge** — When you dodge an attack, enemy is Disoriented for 1 turn
11. **Ambush Ready** — If enemy gets first turn, your first attack deals 2× damage (retaliation)
12. **Slip Away** — Flee success rate +30%
13. **Pressure Plates** — Traps no longer deal damage to you (you sense them)
14. **Predator Stance** — Each turn you don't take damage, gain +5 ATK (stacks, resets on damage)
15. **Afterburner** — After using a healing item, immediately attack for free
16. **Kinetic Charge** — When you dodge an attack, next attack deals bonus damage equal to avoided damage
17. **Swift Retreat** — When HP drops below 30%, automatically dodge one attack per turn
18. **Overland Map** — See the next 2 upcoming room types before entering each floor
19. **Magnetic Soles** — Immune to knockback and displacement effects from boss abilities
20. **Sprint Protocol** — If you haven't attacked this turn, double your dodge chance

---

### Ring (Signet / Band / Loop / Circuit / Coil / Ring)

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
10. **Mana Ring** — INT-based attacks trigger twice with 50% damage on second hit (10% chance)
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

### Amulet (Pendant / Charm / Locket / Chain / Talisman / Core / Medallion)

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
18. **Power Conduit** — Stat bonuses from all rings doubled while this amulet is equipped
19. **Vow of Strength** — If you never use healing items in a run, all damage +25% for the run
20. **Judgment** — Final boss fights: player ATK ×1.5 (designed for endgame push)

---

### Belt (Sash / Strap / Webbing / Band / Utility Rig / Harness)

**Belt-only Passive Pool (20 options):**

1.  **Pack Rat** — Inventory holds 4 more items before it's "full"
2.  **Quick Pocket** — Use items without spending an action (free action)
3.  **Scavenger** — After clearing a floor, find 1 bonus item with 25% chance
4.  **Tactical Pouch** — Carry 2 extra healing items beyond normal inventory limit
5.  **Salvager** — Selling items returns 80% of value instead of 50%
6.  **Overloaded** — Carry 2 extra trinket slots (active only if equipped)
7.  **Merchant's Eye** — Items in the shop are 20% cheaper
8.  **Supply Chain** — Find one free healing item after every boss kill
9.  **Endurance Rig** — Reduces damage from trap rooms by 75%
10. **Equipment Buff** — The first item used in each combat is 50% more potent
11. **Hoarder** — At run end, randomly keep 1 item that would otherwise be lost
12. **Efficient Load** — Carrying fewer than 5 items in inventory grants +5% to all stats
13. **Stockpile** — Gold found in treasure rooms is doubled
14. **Loot Sense** — Treasure room loot is always one rarity tier above normal drop table
15. **Recovery Rig** — After each combat, restore 2% max HP passively
16. **Combat Medic** — Using a healing item during combat has 25% chance to not consume it
17. **Blueprint Reader** — See merchant inventory one room before reaching them
18. **Utility Expert** — Trinket effects are 25% more powerful while this belt is equipped
19. **Momentum Belt** — Starting a run with 0 deaths grants +10% to all stats for the full run
20. **Adaptive Loadout** — Once per run, swap one equipped item for one in inventory as a free action

---

### Trinket (Orb / Crystal / Chip / Module / Rune / Idol / Shard / Core)

Trinkets are wildly unique. Each has a distinct exotic effect not available on any other slot.

**Trinket Passive Pool (30 options — all unique):**

1.  **Chaos Orb** — Each turn, apply a completely random buff or debuff to either party
2.  **Luck Crystal** — Every 10th item found is automatically promoted to the next rarity tier
3.  **Mirror Shard** — Copy enemy's highest stat at combat start and use it for the whole fight
4.  **Memory Module** — After each combat, "record" your highest damage hit; deal it for free next fight
5.  **Void Rune** — 4% chance per turn to banish an enemy (instant kill, no loot, no XP)
6.  **Time Crystal** — Once per run, undo the last hit you received (remove the damage)
7.  **Companion Core Shard** — Companion assists every 3rd turn regardless of CHA stat
8.  **Fortune Idol** — The next treasure chest found contains triple items
9.  **Power Chip** — +60% ATK for first 3 turns of each combat, then returns to normal
10. **Resonance Gem** — Each piece of gear from the same zone tier as you grants +3 all stats
11. **Death Mark** — When you kill an enemy, mark them; ghost form deals 50% ATK to next enemy for free
12. **Paradox Core** — Cannot die to the same damage type twice in one run
13. **Glitch Prism** — 20% chance any attack reflects onto a random adjacent target
14. **Volatile Module** — Each kill makes next attack 10% stronger (stacks, resets on failed hit)
15. **Phase Shifter** — Every 5 turns, phase out of reality for 1 turn (immune to all damage)
16. **Soul Jar** — Captures essence of defeated enemies; spend essence to boost a stat by 5 temporarily
17. **Echo Stone** — The first enemy ability used against you is recorded; it cannot be used again this run
18. **Static Generator** — Deals 5 lightning damage to attacking enemy each time they hit you
19. **Null Crystal** — Once per floor, make one enemy unable to use special abilities this fight
20. **Quantum Dice** — At the start of each fight, all your stats are randomized (±20% from base)
21. **Gravity Core** — Enemies with more than 2× your ATK have their ATK halved
22. **Signal Jammer** — Enemy "call backup" abilities are disabled entirely
23. **Recursive Shard** — Crits recursively trigger additional crits at 50% damage (30% chain chance)
24. **Override Module** — Once per run, completely negate a boss special ability
25. **Aria's Tear** — Companion assists deal 3× normal damage for the rest of the run (one-time activate)
26. **Entropy Idol** — Both you and enemy take -2 to all stats each turn — you start ahead, you win
27. **Convergence Crystal** — Every 5 levels, gain a stacking +10 to all stats permanently per prestige
28. **Boss Hunter's Rune** — +50% damage to boss-tier enemies (no effect on regular enemies)
29. **Shiny Magnet** — Shiny enemy spawn rate doubled for the run
30. **Prestige Token** — After each prestige, trinket gains +5 to all stat grants (cumulative bonus)

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
- Identified automatically by a Head gear passive (Battle Scan)
- Unidentified items can be "gambled" at a merchant for a potential upgrade in rarity

---

## Item Destruction

Players can destroy items for crafting components (future feature):
- Common → Scrap Material
- Uncommon → Alloy Fragment
- Rare → Refined Component
- Epic → Essence Crystal
- Legendary → Divine Fragment

These materials are reserved for Phase 2+ crafting system implementation.

---

## Extended Passive Pools

The 20 passives per slot listed above are the "core" pool — the most common and
well-defined effects. This section expands each pool to 100+ options, providing
variety at scale. During generation, the engine picks from the full pool.

Entries marked with [T3+], [T5+], [T7+] only appear on items from those zone tiers onward.

---

### HEAD — Extended Passives (80 additional)

21.  **Threat Matrix** — At fight start, receive a 3-turn warning before boss special abilities fire
22.  **Deflect Field** — 8% chance any ranged attack is reflected back at attacker
23.  **Peripheral Sense** — Traps in the current floor are always revealed before entering the room
24.  **Memory Leak Sense** — Can detect if an enemy has a regeneration passive before attacking
25.  **Tactical HUD** — Enemy DEF value is always visible (no scan required)
26.  **Sonar Pulse** — First attack each combat hits even through invisibility/stealth
27.  **Signal Boost** — Companion assists grant +5 HP to player when they land
28.  **Feedback Inhibitor** — Thorns/reflect effects deal 0 damage to you
29.  **Psionic Ward** — Immune to INT/psionic drain effects from enemies
30.  **Holographic Decoy** — 1/run: spawn a decoy that absorbs one enemy attack (auto-trigger)
31.  **Encrypted Memory** — Enemies cannot "read" your highest stat (counters Predict abilities)
32.  **Spectral Sight** — Invisible enemies are always visible (counters stealth spawns)
33.  **Cascade Warning** — If next enemy attack would one-shot you, auto-dodge it (once/fight)
34.  **Resonance Map** — Show loot rarity of treasure room before entering
35.  **Neurological Filter** — Blind, Confused, and Fear statuses last 1 fewer turn
36.  **Pattern Recognition** — After same enemy attacks you twice, +15% dodge vs. that attack type
37.  **Crowd Analysis** — Pack/swarm enemies deal 20% less damage per unit beyond the first
38.  **Exploit Scanner** — 10% chance any enemy special ability fails to fire each turn
39.  **Data Vampire Sense** — Immune to stat-steal effects (Data Vampire etc.)
40.  **Last Frame Analysis** — Once per combat, see exactly which attack killed you (if you die, respawn once)  [T5+]
41.  **Cortex Buffer** — First hit of each combat always deals minimum damage
42.  **Optic Calibration** — Critical hit damage increased to 2.5× (from 2×)
43.  **Emergency Scan** — When HP drops below 10%, immediately reveal all enemy remaining HP
44.  **Interrupt Protocol** — 15% chance to interrupt enemy special ability before it fires
45.  **Subliminal Defense** — At start of each floor, gain a 1-hit shield (DEF/2 absorption)
46.  **Archive Access** — After a run ends, retrieve one item from the last run's loot list [T4+]
47.  **Neural Dampener** — Reduce psychic/emotional enemy damage by 30%
48.  **Rogue AI Sense** — AI-type enemies cannot call backup while this passive is active
49.  **Probability Forecast** — At start of combat, know whether enemy will crit this fight
50.  **Linked Awareness** — If companion would fail an assist, convert it to a dodge instead
51.  **Predictive Dodge** — Dodge chance applies to boss special abilities (normally unavoidable)  [T6+]
52.  **Live Feed** — See next floor's room type before committing to enter
53.  **Override Uplink** — Once/run: force enemy to skip one turn (hacking the zone systems)
54.  **Targeting Reticle** — First attack each combat is always a critical hit
55.  **Heat Map** — Gold amounts in treasure rooms are visible before opening chests
56.  **Memory Consolidation** — XP gain +5% per consecutive run without dying (stacks to +50%)
57.  **Battlefield Analytics** — Every 5 kills in a run, gain a free stat point (resets at run end)
58.  **Load Balancer** — If any stat is at 0 (stripped), temporarily borrow +15 from another stat
59.  **Cache Prefetch** — Healing items' effect is doubled for the first use of each floor
60.  **Wide Scan** — Companion assist range expanded — assists can now fire on defense turns too
61.  **Cortical Override** [T7+] — Once/run: become immune to all damage for exactly 1 turn
62.  **Predictive Algorithm** [T7+] — Each miss you suffer charges a guaranteed hit (after 3 misses, next always hits)
63.  **Neural Uplink** [T8+] — Gain 1 permanent INT per floor cleared (persists run-to-run up to +50)
64.  **Omniscience Protocol** [T9+] — At fight start, see enemy's entire move list for the combat
65.  **Quantum Prescience** [T9+] — Receive a 1-turn advance warning of every enemy attack
66.  **Last Known Position** — After fleeing a combat, you retain 50% of XP that would have been earned
67.  **Tactical Memory** — Remember and resist the last 3 special abilities used against you (+30% resistance)
68.  **Signal Intercept** — Intercept enemy "call backup" attempts 50% of the time
69.  **Neural Accelerant** — INT stat contributes to initiative calculation (act earlier)
70.  **Optimized Routing** — Merchant room visits cost 10% less gold
71.  **Counter-Surveillance** — Enemies that "watch" you (Overseer types) deal 25% less damage
72.  **Parallel Processing** — Companion and player can both act in the same turn, once per fight
73.  **Adaptive AI** — Gain a specific bonus (+10 to the stat most effective vs. this enemy) at fight start
74.  **Persistent Memory** — If you die in a run, the next run starts with +20 to all stats (rage)
75.  **Hardened Uplink** — Immune to "hack" effects that disable gear passives
76.  **Optics Overclock** [T5+] — Crits deal 3× damage (up from 2×) while above 50% HP
77.  **Feedback Loop Detection** — When an enemy gains a stack-based buff, you gain +5 ATK per stack they have
78.  **Temporal Cache** — XP from last 3 kills is saved; if you die, it's banked for next run
79.  **Mind Mirror** — Reflect INT-based damage back at caster (25% of it)
80.  **Biometric Override** — Once per run: fully restore HP to max (emergency protocol)
81.  **Strategic Reserve** — Stat points unspent count as +2 to each stat they're not in [T3+]
82.  **Algorithm Bias** — 15% chance enemy loot drops one tier higher
83.  **Zero-Knowledge Proof** — Unidentified items equipped immediately identify themselves for free
84.  **Crisis Protocol** [T6+] — When you'd take lethal damage, companion intervenes (blocks it once)
85.  **Ghost Protocol** — While below 30% HP, enemies have 15% miss chance
86.  **Cognitive Reserve** — Each enemy type you've killed before grants +1 INT (soft cap: +50)
87.  **Hash Collision** — 5% chance all your attacks this turn deal double damage (random proc)
88.  **Exception Handler** — First debuff each combat is automatically cleared
89.  **Stack Trace** — See exactly how much damage each passive contributed last combat
90.  **Buffer Overflow Guard** — Cap the maximum damage one attack can deal to 40% of your max HP  [T4+]
91.  **Interrupt Vector** — 20% chance to act before any enemy, even if AGI is lower
92.  **Deep Scan** [T8+] — Reveal ALL stats of every enemy before the fight begins
93.  **Overwatch Mode** — If an enemy attacks an ally (companion), you auto-retaliate for 50% ATK
94.  **Null Pointer Ward** — Immune to insta-kill effects entirely
95.  **Kernel Patch** — Each run, pick one enemy type; they deal 20% less damage to you this run
96.  **Root Access Sense** [T9+] — Immune to all environmental zone effects (traps, floor hazards)
97.  **Logic Bomb Detection** — Immune to "explode on death" enemy abilities
98.  **Execution Path** — After a kill, +5% crit chance for 3 turns
99.  **Async Dodge** — Dodge calculations happen asynchronously — dodge chance applies even off-turn
100. **Compile Error Ward** [T7+] — Immune to "compile" buffs enemies use to strengthen themselves

---

### CHEST — Extended Passives (80 additional)

21.  **Reactive Plating** — Each hit received in a fight makes subsequent hits 2% weaker (stacks)
22.  **Static Discharge** — When Thorns damage fires, it also Stuns the attacker (5% chance)
23.  **Overflow Tank** — Healing above max HP converts to temporary shield (excess HP absorbed)
24.  **Kinetic Absorber** — Reduce critical hit damage by 30%
25.  **Void Shell** — While below 25% HP, all damage reduced by 40%
26.  **Reinforced Frame** — STR-based attacks deal 20% less damage to you
27.  **EMP Coating** — INT-based attacks deal 20% less damage to you
28.  **Ablative Armor** — First 5 hits each combat deal -5 damage (ablative layer)
29.  **Distributed Load** — Damage is calculated 3 times; you take the lowest result
30.  **Sentry Protocol** — Auto-dodge the last attack in any combat (the killing blow)
31.  **Fault Tolerant** — Can take 3 hits before any effect applies in the current fight
32.  **Overload Shunt** — Any damage over 50 in one hit is reduced by 20
33.  **Self-Repair Nanites** — Restore 2% max HP per floor traversed (passive between rooms)
34.  **Combat Chassis** — Gain +1 DEF permanently for each boss killed across all runs (up to +50)
35.  **Adrenaline Reserve** — When hit below 30% HP, gain +20 ATK for 3 turns
36.  **Sacrifice Protocol** — Take 10 self-damage to negate an enemy special ability (active)
37.  **Pressure Resistance** — In zones with "environmental damage per turn" effects, take 0
38.  **Panic Mode** — At 5% HP, ATK doubles and AGI doubles for 2 turns
39.  **Payload Dump** — On death (Iron Will), deal area damage equal to your max HP ÷ 3
40.  **Adaptive Mesh** — After taking 3 hits of the same type, that type deals 15% less damage
41.  **Stasis Field** — Pause regen countdown when below 20% HP (regen fires immediately instead)
42.  **Inverted Polarity** — 10% chance: incoming damage heals you instead
43.  **Sentinel Stance** — If you skip attacking this turn, gain a full DEF-score barrier next turn
44.  **Thermal Shielding** — Burn/fire-based damage reduced by 50%
45.  **Cryo Buffer** — Slow/freeze-based attacks have 0% effect (anti-stasis)
46.  **Magnetic Plating** — Ranged attacks have 15% chance to be deflected
47.  **Phase Inversion** — When enemy crits you, it instead deals minimum damage
48.  **Continuity Protocol** — Bleed and DoT effects deal 50% reduced damage to you
49.  **Overclock Core** — When below 50% HP, your attacks gain +15% damage
50.  **Last Rite** — If you die with Thorns active, all stacks fire simultaneously on killer
51.  **Biometric Lock** — Status effects applied to you can only stack to 1 (no multi-stack)
52.  **Emergency Beacon** — Once/run: companion appears and blocks the next 3 attacks for you
53.  **Neural Mesh** — Immune to Confusion and Identity-swap effects
54.  **Cascade Defense** — Each turn you survive a hit, the next hit deals 3% less damage (stacks)
55.  **Living Armor** [T5+] — Armor passives regenerate after each fight (start each combat fresh)
56.  **Absorb Matrix** — Convert 15% of damage taken into gold (pain becomes profit)
57.  **Hardpoint** — Equipped items cannot be disabled, stolen, or removed by enemy abilities
58.  **Deep Buffer** — Can store up to 3 "second wind" healing charges (one triggers at each 25% HP loss)
59.  **Redundant Systems** — If one armor passive is disabled, another random one activates to replace it
60.  **Kinetic Battery** — Each hit absorbed charges a battery; at full charge (10 hits), deal 1× max HP damage
61.  **Void Carapace** [T6+] — Void and psionic damage reduced by 50%
62.  **Fractal Defense** — DEF score fractally scales: +1 DEF for every 5 DEF you already have
63.  **Load Distribution** — When below 40% HP, reroute 20% of incoming damage to gold loss instead
64.  **Hollow Core** — Immune to damage from constructs and mechanical enemies
65.  **Crystalline Matrix** [T7+] — When damaged, 5% chance to become fully immune for 1 turn
66.  **Sentinel Web** — Companion assist chance increases by 5% per hit you take in a combat
67.  **Static Field** — Enemies that attack you have 10% chance to be Stunned
68.  **Redundant Heartbeat** — Survive death twice per run (not once)  [T8+]
69.  **Absolute Zero Shell** [T9+] — All damage reduced by 50% when above 75% HP
70.  **Phantom Armor** — Armor passives remain active even if the chest piece is disabled
71.  **Shield of the Fallen** — If companion dies in the run (takes a hit for you), gain +50 DEF permanently this run
72.  **Neural Scaffold** — INT contributes 25% of its value to DEF calculation
73.  **Combat Medic Protocol** — First use of a healing item per combat heals 2×
74.  **Wound Memory** — Each type of damage that has hit you this run deals 5% less from now on
75.  **Temporal Shielding** [T6+] — Once per fight: negate the very last damage instance (retroactive)
76.  **Gravity Well Plating** — Forced movement effects (knock, throw, etc.) are ignored
77.  **Entropy Weave** — The longer you survive in a single fight, the higher your DEF gets (+2/turn, cap +30)
78.  **Echo Defense** — Copy the DEF value of the enemy you're fighting (if theirs is higher)  [T7+]
79.  **Phase Shift Armor** — Every 3rd hit you receive has 0 damage (phased out momentarily)
80.  **Collapse Protocol** [T9+] — On death (with Iron Will), reduce all enemies in the fight to 1 HP

---

### HANDS — Extended Passives (80 additional)

21.  **Serrated Grip** — Bleed chance on all attacks +10%
22.  **Magnetic Fingers** — Weapon cannot be stolen or disabled by enemy abilities
23.  **Resonance Transfer** — Critical hits also apply a random debuff (Slow, Weaken, or Blind)
24.  **Micro-Actuators** — +15% chance to land a bonus hit after a dodge
25.  **Overclock Punch** — Once per fight: a free unarmed attack dealing 2× your STR score
26.  **Combo Memory** — Track and replay the best 3-hit combo from the previous fight, once
27.  **Exploit Strike** — First attack ignores 50% of enemy DEF
28.  **Weighted Knuckles** — Unarmed attacks deal 100% of weapon ATK (if weapon is disabled)
29.  **Feedback Loop** — After each crit, gain +3 LCK for the fight (stacks to +30)
30.  **Viral Strike** — 8% chance each hit spreads Bleed to enemy's backup (if they summon one)
31.  **Anti-Armor** — Each consecutive hit on the same enemy reduces their DEF by 5 (stacks)
32.  **Chain Lightning** [T4+] — Crits send an arc to an unsummoned backup, preventing it
33.  **Power Transfer** — Unused AGI points (above a threshold) convert to bonus ATK
34.  **Kinetic Feedback** — When you block/dodge an attack, next hit deals +20% damage
35.  **Gravity Fist** — Attacks that hit for 10+ damage also knock enemy back (stun for 1 turn)
36.  **Strike Pattern** — Every 4th attack in a combat is automatically a critical hit
37.  **Recall Strike** — After using an item, immediately attack for free
38.  **Shieldbreaker** — Each attack permanently strips 3 DEF from the enemy (floor-persistent)
39.  **Pressure Point** — 15% chance attack applies "Exposed" — enemy takes 30% more damage for 1 turn
40.  **Arc Discharge** [T3+] — 12% chance attack sends an electrical arc: both enemy and you take 10 damage
41.  **Compound Force** — STR stat contributes 150% to damage calculation (instead of 100%)  [T6+]
42.  **Leech Gauntlets** — 15% of all damage dealt is healed back
43.  **Execution Readiness** — After dodging, next attack has +100% crit chance
44.  **Marked Target** — First hit on any enemy marks them: they take +10% damage from all sources
45.  **Dual Tempo** — Alternate between ATK and AGI as the primary damage stat each turn
46.  **Feedback Fist** — When blocked (attack negated), immediately re-attack at 75% damage
47.  **Absorb Strike** — Once per fight: convert one incoming attack into bonus ATK instead of damage
48.  **Iron Maiden Synergy** — If Thorns (chest) passive is active, attacks also trigger a Thorns proc
49.  **Overclock Burst** [T5+] — Every 5th attack deals 5× damage (no crit, just raw multiplier)
50.  **Critical Chain** — Landing crits reduces cooldown of Overclock Burst by 1 attack
51.  **Psi-Amplified Strike** [T6+] — INT contributes 100% alongside STR to one attack per fight
52.  **Null Punch** [T7+] — Once per fight: deal damage that cannot be reduced by any means
53.  **Blood Frenzy** — After killing an enemy, next attack is always a critical hit
54.  **Reaper's Mark** — Killing blow damage is stored; next enemy starts combat pre-wounded by that amount
55.  **Tendon Sever** — 20% chance each hit reduces enemy AGI by 5 permanently (this fight)
56.  **Static Knuckles** — 10% chance each attack: enemy is Stunned for 1 turn
57.  **Phantom Limb** — After equipping new gloves, old gloves' passive persists for 3 runs
58.  **Aggressor** — Each turn you attack without dodging, gain +5 ATK (stacks, resets on dodge)
59.  **Calculated Blows** — Every 10 INT you have grants +1 bonus ATK permanently
60.  **Grip of the Void** [T7+] — Attacks pierce all shield and barrier effects
61.  **Biometric Calibration** — Adjust weapon type preference each run; chosen type deals +15% damage
62.  **Wound Memory** — Each hit type used this fight gains +2% effectiveness per subsequent use
63.  **Heat Sink Strike** — Attacks cool down enemy enrage stacks (each hit removes 1 enrage stack)
64.  **Joint Lock** — Attacks that stun extend the stun by 1 additional turn
65.  **Weight Transfer** — If you deal 0 damage (DEF negation), convert full ATK to status damage
66.  **Quantum Strike** [T8+] — Attack simultaneously hits enemy in this turn AND next turn
67.  **Entropy Fist** [T8+] — Each hit permanently reduces enemy max HP by 2%
68.  **Momentum Gloves** — Moving to a new floor grants +10 ATK for the first fight on that floor
69.  **Micro-Frag** — 5% chance each hit deals bonus area damage (hits backups too)
70.  **Cortex Punch** [T7+] — 15% chance each hit permanently removes one enemy passive
71.  **Override Strike** — Attacks always deal at least 10% of enemy max HP as damage  [T9+]
72.  **Anti-Regen** — Hits apply "Suppressed" — enemy regen is halved for 3 turns
73.  **Execution Algorithm** — When you predict a kill, +30% damage bonus fires automatically
74.  **Null Cancel** — If enemy has a "null physical damage" effect, your attacks bypass it  [T6+]
75.  **Temporal Fist** [T9+] — Once/run: hit an enemy in the past — deal damage to an already-dead enemy, the XP counts twice
76.  **Charged Knuckle** — Passively charge while not attacking; release for 3× damage (2 turn charge)
77.  **Reactive Strike** — When companion assist fires, your next attack deals +30% damage
78.  **Death Grip** — If enemy attempts to flee, auto-attack them for free before they escape
79.  **Bone Crush** — Attacks that exceed enemy DEF by 10+ deal double excess damage
80.  **Final Act** — If this is your last attack before death, it deals 3× damage

---

### FEET — Extended Passives (80 additional)

21.  **Afterburner** — After any successful dodge, immediately attack for free at 60% power
22.  **Evasion Training** — Each dodge this combat improves next dodge chance by +3% (stacks, resets)
23.  **Silent Step** — Cannot trigger "call backup" ability passively through movement
24.  **Vault** — Once per combat: jump over any attack (guaranteed dodge, no roll required)
25.  **Ground Control** — Cannot be knocked prone, thrown, or displaced from position
26.  **Counter Step** — When you dodge, deal 25% ATK as a counter-strike automatically
27.  **Marathon Runner** — After 5+ floors without resting, gain +10% to all stats (fatigue tolerance)
28.  **Zone Mastery** — +5% to all stats in zones you've cleared before
29.  **First Floor Bonus** — +20 ATK on the first fight of each floor
30.  **Evasion Arc** — Dodge generates an arc of energy: 8% chance to damage enemies around you
31.  **Sprint Recovery** — After fleeing a combat, restore 10% max HP
32.  **Terrain Expert** — Trap damage reduced to 0
33.  **Phase Stride** — Pass through objects on the map (reach rooms out of sequence) [T5+]
34.  **Quick Escape** — Flee attempt is always successful (1/run)
35.  **Bound Leap** — Start each floor with a free attack against the first enemy (surprise round)
36.  **Reactive Footwork** — Each miss in a row increases dodge chance by 5% (resets on hit)
37.  **Featherfall** — Trap rooms deal 0 damage and apply 0 status effects
38.  **Pursuit Protocol** — Cannot be fled from by enemies
39.  **Overland Speed** — Move through extra floors (unlock 1 bonus floor in each run) [T4+]
40.  **Adaptive Gait** — Each zone tier above the recommended level, gain +5 AGI
41.  **Phantom Stride** [T6+] — Once per fight: teleport past an enemy attack (not a dodge, unconditional)
42.  **Land and Strike** — When entering a new floor, first attack deals 50% bonus damage
43.  **Breakfall** — Reduce falling/environment damage by 100% (zone-specific hazards)
44.  **Escape Artist** — Flee cooldown doesn't apply (can attempt flee every turn)
45.  **Quick Pocket Feet** — Items used mid-combat grant a free step (don't waste a turn)
46.  **Kinetic Surge** — After 3 consecutive dodges, gain +40% ATK for 2 turns
47.  **Predator's Gait** — Each floor you enter without being hit, gain +2% damage (stacks)
48.  **Reversal** — After a failed dodge, next attack is guaranteed to hit
49.  **Shockwave Step** — Entering a rest room deals 10 damage to all enemies in current zone (lore: you stomped)
50.  **Dead Sprint** [T5+] — At below 20% HP: dodge chance +30%, flee chance +50%
51.  **Bounce** — After taking a hit, move reactively; next attack gets +15% damage
52.  **Gravity Step** — Gravity-type enemy abilities have no effect on you
53.  **Mirror Walk** [T7+] — Enter the "mirror room" — face a copy of yourself at 50% stats; winning gives +20 to all stats
54.  **Proximity Alarm** — Know if an elite or boss is in the next room before entering
55.  **Haste** — Each turn, AGI score increases by 1 (stacks, resets at fight end)
56.  **Vanish** — Once per fight: become invisible for 1 turn (skip enemy attack, your attack counts)
57.  **Retreat Protocol** — Flee always succeeds on the first attempt (no reroll)
58.  **Sweeping Kick** — On dodge: 20% chance to knock enemy prone (Stunned for 1 turn)
59.  **Momentum Transfer** — When enemy misses you, they lose 5 ATK for 1 turn
60.  **Route Memorization** — Floors you've cleared before show their room types in advance
61.  **Displacement Field** — After each dodge, teleport to a new position (enemy loses track; -20% ATK next hit)
62.  **Speed Break** [T8+] — AGI over 100 converts each excess point to +0.5 ATK
63.  **Ghost Shoes** [T7+] — 3 times per run: walk through a monster encounter without fighting
64.  **Seismic Step** — On landing after a jump/vault: deal small AOE damage (equal to VIT score)
65.  **Slip Through** — Enemy "area of effect" attacks have 30% chance to miss you
66.  **Backstep Mastery** — Each combat, start with 1 free dodge already "banked"
67.  **Chase Protocol** — Enemies that flee cannot escape; you always get a free attack
68.  **Step of the Void** [T9+] — 5% chance per turn to step into the void (skip damage entirely)
69.  **Reflex Override** [T6+] — Dodge happens before attack resolution (true pre-emptive dodge)
70.  **Tactical Retreat** — When HP drops below 15%, gain 3 free turns to act before enemy can respond
71.  **Scramble** — After a crit against you, immediately counterattack for 40% ATK
72.  **Evasion Mastery** — At 100+ AGI, dodge chance has no cap (can exceed 95%)  [T9+]
73.  **Perpetual Motion** — Each turn you dodge, gain +2 to all stats (resets at fight end)
74.  **Zero-G Step** — Ignore gravity-based zone modifiers; always dodge at full chance
75.  **Quick Stand** — Recover from Knockdown/Stun status 1 turn earlier than normal
76.  **Escape Vector** — Flee attempts can never be "failed flee" penalized (enemy doesn't get free attack)
77.  **Phase Walk** [T8+] — Walk through one enemy encounter per floor completely (auto-succeed, no loot)
78.  **Last Step** — If this would be your last conscious turn, dodge it automatically once
79.  **Resonance Step** — Each floor you clear adds +1 to your permanent AGI stat (up to +25 total)
80.  **Omega Stride** [T10+] — Movement is instantaneous; AGI contributes 200% to dodge calculation

---

### RING — Extended Passives (80 additional)

21.  **Catalyst** — Each equipped item that shares a stat focus with this ring grants +3 to that stat
22.  **Soul Leech** — 5% chance each kill permanently grants +1 to a random stat
23.  **Empowering Aura** — All stat bonuses from rings are increased by 10%
24.  **Void Loop** — Once per run: the run's first death is negated (treat ring like Iron Will for 1 run)
25.  **Compounding Interest** — Each run you complete, this ring's main stat bonus grows by +1
26.  **Exploit Ring** — 10% chance any attack deals 3× damage (random, no crit animation)
27.  **Bond Amplifier** — Companion assist chance +5% per ring equipped (both slots)
28.  **Crystal Resonance** — Trinket effects are 15% more potent while this ring is worn
29.  **Elemental Bridge** — If you deal elemental damage, add 10% of that as a secondary element
30.  **Lucky Break** — Once per run: turn one failure (missed attack, failed dodge) into a success
31.  **Stat Arbitrage** — At the start of each fight, swap two of your stats temporarily (+/-)
32.  **Passive Collector** — Each passive you have active grants +1 to all stats
33.  **Anti-Gravity Field** — All falling damage, environmental damage, and zone hazards deal 0
34.  **Echo Chamber** — Your last used passive effect fires again (once per fight)
35.  **Stacking Overflow** — Stack-based passives (Juggernaut, etc.) can stack 2× as high
36.  **Run Accumulator** — Each successful run completed grants this ring +2 to its primary stat
37.  **Mirror Logic** — If enemy has higher ATK than you, your DEF equals their ATK
38.  **Null Resistance** — Immune to resistances and immunities that normally block your damage type
39.  **Sync Bonus** — If both ring slots have the same passive type, its effect is doubled
40.  **Fragility Exploit** — Deal +30% damage to enemies below 50% HP
41.  **Phase Lock** — Status effects you apply last 1 additional turn
42.  **Dissonance** — When debuffed, deal 15% bonus damage (using the chaos as fuel)
43.  **Execution Ring** — At 5% or less HP, all attacks have +50% crit chance
44.  **Field Amplifier** — Each floor cleared raises this ring's bonus by +1 (resets each run)
45.  **Interrupt** — 10% chance to stop an enemy's attack before it fires (complete prevention)
46.  **Circuit Board** — INT gains from gear count double toward companion assist calculations
47.  **Phasic Resonance** [T5+] — While in a Void or Psychic zone, all stats +20%
48.  **Temporal Ring** — Time-based enemy abilities (time slow, etc.) have 0 effect
49.  **Anomaly Amplifier** — Random/chaotic effects (Chaos Orb, Quantum Dice) are biased positive
50.  **Force Multiplier** [T6+] — Each point of STR above 50 grants 2 ATK instead of 1
51.  **Karma Loop** — Thorns damage you deal heals you for half the amount
52.  **Feedback Ring** — When you take damage, your next hit deals bonus damage equal to damage received
53.  **Overflow Ring** [T7+] — Stats above the soft cap (100) contribute double to calculations
54.  **Null Void** — Void-type enemies cannot apply their special abilities to you
55.  **Recursive Bonus** — Each time this ring's passive fires, it charges the next proc (caps at 3×)
56.  **Singularity** [T9+] — When all 6 stats are above 100, deal +50% damage
57.  **Quantum Entanglement** — If wearing a set piece, that set piece's bonuses are applied twice
58.  **Attunement** — If this ring is from the same zone you're exploring, its bonus is doubled
59.  **Resistance Pierce** — Your attacks ignore elemental resistances and immunities
60.  **Inversion Field** [T6+] — Enemy debuffs applied to you are converted to buffs instead
61.  **Static Build** — Each turn you don't take damage, gain +5 ATK (stacks to +50)
62.  **Pressure Point Ring** — 15% chance each hit applies "Weakened" status to enemy
63.  **Conviction** — If you've cleared 3+ floors this run without fleeing, gain +15% damage
64.  **Gravity Well** — Enemies with more than 2× your HP deal 25% less damage to you
65.  **Void Absorption** [T7+] — 15% of void damage dealt to you is converted to VIT
66.  **Recursive Loop** — At 100+ LCK, each crit has 50% chance to proc a free second crit
67.  **Data Syphon** — At fight start, steal 5% of enemy's primary stat temporarily
68.  **Eternal Bond** — Each permanent stat gain from achievements increases this ring's bonus by +0.5
69.  **Resonant Frequency Ring** — If companion and player attack on the same turn, +30% damage to both
70.  **Overflow Protection** — HP above max (from overflow healing) is permanent until end of floor
71.  **Hard Cap Breaker** [T9+] — All soft stat caps are removed while this ring is equipped
72.  **Convergence Aura** — Each equipped item within 5 levels of each other grants +5 to shared stat
73.  **Paradox Ring** [T8+] — If you roll a miss and a hit simultaneously, deal 2× damage
74.  **Perfect Circuit** — If all gear slots are filled, gain +15 to all stats
75.  **Inheritance Ring** — On prestige, this ring retains +10 bonus stat from the previous character
76.  **Amplified Luck** [T7+] — LCK above 100 contributes 1% per excess point to legendary drop chance
77.  **Phase Shift Ring** — Every 5 turns, your damage type randomly changes (physical/magical)
78.  **Combo Keeper** — Combo attack chains continue even if one attack misses
79.  **Zero-Day Ring** [T8+] — First attack of each run ignores ALL enemy defenses
80.  **Singularity Loop** [T10+] — When all stats exceed 200, gain a combat loop: each fight turn grants +5 all stats permanently (up to +50/run)

---

### AMULET — Extended Passives (80 additional)

21.  **Patron's Blessing** — Random stat increases by +5 each time you pick it (random per run)
22.  **Sigil of Survival** — Max HP increases by 2% each floor you survive without death
23.  **Aetheric Conduit** — INT and LCK both contribute 50% to critical calculations
24.  **Death Ward** — Once per zone: on death, teleport back to the zone's entry floor
25.  **Echo Amulet** — The last passive you activated repeats at end of each fight (single proc)
26.  **Ancestral Blessing** — Companion assists also grant +5 HP to the companion (extending their "lives")
27.  **Soul Collector** — Each enemy type killed for the first time grants +2 to a random stat permanently
28.  **Divine Intervention** — Once per run: a random powerful buff is applied at the start of a boss fight
29.  **Mind Over Matter** — INT reduces incoming physical damage by 0.1 per point
30.  **Vow of Silence** — Cannot use items in combat; in exchange, all stats +25%
31.  **Battle Hymn** — Each floor cleared without resting adds +2% to all damage for the run
32.  **Warrior's Soul** — After taking lethal damage and surviving, gain +30 to all stats for 3 turns
33.  **Chains of Memory** — Permanent memories in the companion's memory bank grant +1 all stats each
34.  **Enduring Spirit** — Status effects applied to you have 25% reduced duration
35.  **Beacon** — Companion assist range doubles; assists can fire even when HP is full
36.  **Pact of Iron** — If you never use a healing item in a run, gain +20 to all stats at run end
37.  **Awakened Core** [T5+] — Passive effects from all equipped gear are 20% more potent
38.  **Ascendant Will** — Each prestige adds +5 to this amulet's primary stat permanently
39.  **Sigil of Seeking** — Rare+ items have a 15% chance to appear in normal enemy drops
40.  **Pain Conduit** — Convert 5% of damage taken into bonus ATK for the fight
41.  **Mercy Clause** — Enemies at 1 HP will not attack you (they've given up; you can execute freely)
42.  **Knowledge is Power** — Each unique zone visited grants +1 INT permanently (up to +50)
43.  **Empathy Weave** — Companion's CHA bonuses also apply to your damage calculations
44.  **Resonant Soul** — Set bonuses are 15% more effective while this amulet is equipped
45.  **Predatory Amulet** — When enemy is Stunned, Blinded, or Weakened: +30% damage to them
46.  **Sacrifice Chain** — Can spend 25% HP to guarantee the next attack is a critical hit
47.  **Lucky Star** — LCK contributes to all calculations (not just crit) at 25% rate
48.  **Spirit Link** [T6+] — Companion HP (survival tokens) transfers to player as bonus VIT
49.  **Void Conduit** [T7+] — 10% of all damage dealt converts to a permanent stat increase
50.  **Bloodbound** — HP max increases by 1% for each enemy killed in the current run
51.  **Signal Amulet** — Companion generates useful information (enemy weakness, room type ahead)
52.  **Persistence** — Buff durations last twice as long
53.  **Iron Conviction** — If you haven't fled a combat in 10+ floors, gain +25% damage
54.  **Cosmic Alignment** — Random bonuses from trinkets are always positive
55.  **Heart of the Run** — First kill of each run triggers a cascade: next 3 attacks have +50% damage
56.  **Dual Focus** — Two stats of your choice share bonuses (each point to one also adds to the other)  [T7+]
57.  **Resonant Memory** — The best run you've ever had is "remembered"; its highest stat boost applies passively
58.  **Aura of Power** [T8+] — All stat bonuses from all sources are increased by 15%
59.  **The Final Law** [T9+] — Once per zone: declare a rule (e.g., "no enemies can crit") that lasts 3 floors
60.  **Fractured Sigil** — Split bonuses: +30 to two stats chosen at equip, -10 to another two (net positive)
61.  **Temporal Anchor** — Status effects don't tick while you're above 75% HP
62.  **Golden Ratio** — All gear from the same zone tier as this amulet grants +5% bonus stats
63.  **Nullifier's Charm** — Enemy "immune to X" effects are removed at the start of each fight
64.  **Wanderer's Path** — +10 to all stats per unique zone type explored this run
65.  **Relic of Resolve** — If you've survived 3+ near-death moments this run, all stats +20%
66.  **Anti-Entropy** — Stats cannot be reduced below their base value by enemy effects
67.  **Soul of the Fallen** — Each ally defeated (companion takes a hit) grants +10 permanent ATK
68.  **Endless Potential** [T8+] — Stat caps for this character are doubled while this amulet is equipped
69.  **Weight of History** — Each run completed (ever) adds +0.1 to this amulet's stat bonuses
70.  **Network Node** — Each equipped item from a different rarity tier adds +5 to all stats
71.  **Signal Clarity** — False positives from RNG effects are removed; all procs are meaningful
72.  **Deep Memory** — Permanent memories stored in companion's DB grant +2 all stats each  [T5+]
73.  **Final Protocol** [T10+] — At max level: gain immunity to all damage from your most-killed enemy type
74.  **Prism Soul** — Each damage type you've taken this run: +5% resistance to it permanently
75.  **Archivist's Pendant** — Discovering a new enemy type grants +10 to a random stat
76.  **Broken Cycle** — Die and survive (Iron Will) enough times: each Iron Will trigger grants +5 all stats permanently
77.  **Convergent Path** — After 7 consecutive floors without resting, gain a full HP restore
78.  **System Override** [T9+] — Ignore all zone-specific debuffs and modifiers
79.  **Eternal Covenant** — Companion assists never miss; they always land
80.  **Beyond the Source** [T10+] — All stats gain +1 for every minute of cumulative play time (up to +100 total)

---

### BELT — Extended Passives (80 additional)

21.  **Ration Expert** — Healing items restore an additional flat 15 HP on top of normal value
22.  **Looting Protocol** — After clearing a floor, search it for a bonus 5–15 gold
23.  **Merchant's Mark** — Merchant rooms always have at least one item one tier above zone level
24.  **Combat Preparation** — At fight start, one random item in inventory is "primed" (+50% effectiveness if used)
25.  **Scrap Budget** — Each item you sell refunds 1 random crafting material
26.  **Triage** — Using a healing item automatically applies Regen for 2 turns as a bonus
27.  **Cache Dump** — Once per run: convert all inventory items into gold at 75% value instantly
28.  **Relic Hunter** — +10% chance to find Set pieces in treasure rooms
29.  **Inventory Sorter** — Items of the same rarity stack their bonuses by 2% each
30.  **Greedy Bastard** — Each enemy you choose not to fight (flee/avoid) adds 5 gold to next chest
31.  **Weight Optimization** — Carrying fewer than 3 items: +15% to all stats
32.  **Fixer** — Identify unidentified items for free (no merchant needed)
33.  **Reuse Protocol** — Consumable items have 10% chance to not be consumed when used
34.  **Cost Reduction** — Merchant prices decrease by 2% per floor cleared (stacks to -40%)
35.  **Black Market Connect** — 15% chance merchant has a legendary item available each visit
36.  **Emergency Cache** — A hidden item is placed at the start of each floor (findable with 25% chance)
37.  **Durable Goods** — Items you equip last longer; passives don't degrade from enemy effects
38.  **Arbitrage** — Buy items and sell them for 110% of purchase price (resale bonus)
39.  **Liquidation** — When inventory is full, auto-sell lowest-value item for 90% price
40.  **Supply Line** — After each boss kill, spawn a free merchant room on the next floor
41.  **Weapon Swap Ready** — Swapping equipped weapons doesn't consume an action
42.  **Inventory Mastery** — Having exactly 10 items: +20% to all stats (full kit bonus)
43.  **Reagent Pouch** — Crafting materials from destroyed items always yield one bonus material
44.  **Pack Mule** — Inventory size increases by 2 for each prestige level
45.  **Tinkerer** — Unidentified items can be used immediately without identifying (random effects)
46.  **Quick Fix** — Using a healing item triggers a free attack afterward
47.  **Strategic Reserve** — Keep 2 "emergency use" item slots that can't be consumed by enemy "destroy item" effects
48.  **Bulk Discount** — Buying 3+ items from same merchant: 25% off all
49.  **Find the Angle** — Once per run: receive an item for free from a merchant (it's a gift)
50.  **Surplus Stock** — Merchants restock with 1 additional item after buying from them
51.  **Lucky Dip** — Once per floor: pay 50 gold to get a random item (any rarity, any type)
52.  **Deep Pockets** — Gold cap doubled (can carry more gold than normal without overflow)
53.  **Fence Protocol** — Items sold to merchants are buyable back at the same price for 3 floors
54.  **Combat Medic Belt** — When companion is blocked (saves you), automatically apply a heal
55.  **Resource Map** — Know exactly which room type each remaining floor contains before entering
56.  **Prestige Allowance** — On prestige, carry forward 1,000 gold to the new run
57.  **Dungeon Tax** — At zone entry: pay 100g for a guaranteed Rare+ item from the first room
58.  **Gold Memory** — Each run you earn 5,000+ gold: this belt's gold bonus increases by +2% permanently
59.  **Barter Master** — Trade items directly with merchant (swap, no gold needed)
60.  **Combat Finance** — Each kill earns +5 bonus gold (flat, always active)
61.  **Overflow Bag** — If inventory is full, next 3 drops are held in a "temporary slot" for 1 floor
62.  **Pawn Protocol** — Pawned items (sold) can be reclaimed for free if not enough floors pass
63.  **Set Detector** — When a set piece drops, the UI highlights other set pieces in inventory
64.  **Rarity Magnet** — Common items never drop while this belt is equipped (minimum Uncommon)  [T5+]
65.  **Wealth Accumulation** — Each 10,000 gold earned grants +1 permanent LCK
66.  **Infinite Pockets** [T7+] — Inventory size is unlimited
67.  **Vendor's Eye** — Items in merchant shop show their passive effects without purchasing
68.  **Investment** — At run start: spend gold to boost a stat for the run (+1 per 50g, up to +20)
69.  **Lucky Strike** — Every 100 gold earned: 1% chance a legendary item spawns in the next room
70.  **Recycle Protocol** — Destroyed items are automatically converted to the highest-value material
71.  **Logistical Expert** — Using an item does not trigger enemy reactions (stealth use)
72.  **Emergency Fund** — When you'd die, spend gold equal to 10% of current amount to survive at 1 HP
73.  **Windfall** — Once per run: double all gold earned on next floor
74.  **Item Memory** — Items you've owned before get a +5 bonus stat when found again
75.  **Clearance Sale** — All items in merchant shop discounted 50% on your last floor of the run
76.  **Pack Rat's Luck** — Each item in inventory grants +1 LCK (diminishing above 10 items)
77.  **Supply Drop** [T8+] — Once per run: call in a drop of 3 random items (any rarity)
78.  **Economic Warfare** — Enemies drop 50% more gold but there are 10% more of them per floor
79.  **Merchant Bond** [T9+] — All merchant items are permanently at 50% off after clearing 50 zones
80.  **Infinite Capital** [T10+] — Gold total never resets on prestige; carries forward forever

---

### TRINKET — Extended Pool (170 additional, total 200)

31.  **Probability Engine** — At start of each fight, reroll all enemy stats (could go up or down)
32.  **Soul Trap** — When killing an enemy, 5% chance trap its soul; each soul grants +5 ATK for the run
33.  **Spectral Dice** — Once per floor: roll a d6; 1-2: lose 20% HP; 3-4: nothing; 5: +30 all stats; 6: full heal
34.  **Infinite Regress** — Each time you use this trinket's ability, it gains a new random ability
35.  **Zero Point Module** — At 0 HP (before death), restore to full HP (once; trinket breaks after)
36.  **Temporal Rewind** — Once per run: undo the entire current combat and skip it
37.  **Quantum Superposition** — Your stats are both their current values AND +50% simultaneously; attacks pick the better result
38.  **The Gambler's Chip** — Each hit you land: 50/50 chance it deals 0 or 3× damage
39.  **System Exploit** — Once per zone: enemy loses all its passive abilities for the fight
40.  **Heist Module** — At start of merchant room: 10% chance to "rob" the shop (free item, then merchant hostile)
41.  **Narrative Control** — Once per run: choose the next room type (cannot pick Boss unless it's the boss floor)
42.  **Recursion Token** — At death, respawn with half stats; can recurse up to 3 times before permanent death
43.  **Broken Mirror** — Copy your own stats into the enemy; both fight with identical stats (pure skill test)
44.  **Blood Diamond** — Each kill: 1% chance this trinket upgrades in rarity permanently
45.  **Null Device** — Once per run: completely remove one enemy from a floor without fighting it
46.  **Paradox Engine** — On death: respawn enemy with your current HP; you keep their gear drop
47.  **Reality Fork** — Once per run: branch into two outcomes; choose the better one
48.  **Cosmic Lottery** — At start of each run: randomly get one of 30 different powerful buffs for the whole run
49.  **Feedback Amplifier** — Each passive you have above 5 contributes +1 to all stats
50.  **Memory Wipe** — Once per fight: enemy "forgets" all adaptations/buffs it has built this fight
51.  **Anchor Point** — All RNG effects involving you are seeded from your LCK stat (more LCK = better luck)
52.  **Phase Crystal Alpha** — Every 3rd floor: enter phase — immune to all damage for that floor
53.  **Temporal Grenade** — Throw into a fight: rewind both combatants to fight start, but you keep last turn's damage dealt
54.  **Echo Resonator** — All companion assists this combat echo once for 30% damage (auto)
55.  **Volatile Core** — This trinket's power increases with each enemy killed; resets each run
56.  **Quantum Knife** — Attacks simultaneously apply all possible status effects (random one actually activates)
57.  **Displacement Orb** — On hit: 20% chance to swap positions with the enemy (their back is exposed: +20% damage)
58.  **Mending Crystal** — At end of each floor: restore 10% max HP passively
59.  **Infinite Mirror** — Reflect the last ability used on you back at the user, at 150% power (once/fight)
60.  **Null Prism** — Refracts all incoming damage across 5 types, each taking 20% (reduces spikes)
61.  **Dread Module** — Your name/stats are hidden from enemies (they can't use "predict" or "adapt" abilities)
62.  **Architect's Key** — Unlock a secret room on any floor at will (once per run, even floors without one)
63.  **Contingency Plan** — If the run fails, this trinket carries one random item to the next run
64.  **Corruption Seed** — Enemies periodically take corruption damage just from your presence (+5/turn)
65.  **Exploit Framework** — Once per fight: all damage you deal this turn is true damage
66.  **Signal Flare** — Companion assists deal 2× damage for the next 2 turns after it's activated
67.  **Cascade Bomb** — On kill: AOE damage equal to 20% of the enemy's max HP hits the next enemy
68.  **Gear Ghost** — The last gear set you wore persists as ghost bonuses (+50% of its stats)  [T6+]
69.  **Binary Switch** — Alternate between ATK mode (+30% ATK, -15% DEF) and DEF mode each turn automatically
70.  **Deep Archive** — Once per prestige: access the item shop from any previous playthrough [T7+]
71.  **World Seed** — Reroll the current zone's floor layout (change room types) once per run
72.  **Rune of Binding** — Enemy special abilities require one additional turn to charge
73.  **System Interrupt** — 5% chance each turn: enemy's turn is skipped entirely (interrupt)
74.  **Probability Collapse** — Once per fight: all future RNG for this combat is forced to best-case
75.  **Gravity Orb** — Pull all in-room items to you without entering treasure rooms (remote collection)
76.  **Kill Switch** — Activate once: next enemy to hit 1 HP is instantly killed regardless of any effects
77.  **Entropy Seed** — Each turn, both stats increase AND decrease randomly (+/-5 to random stats)
78.  **Debug Crystal** — At start of each fight: see a preview of exactly what will happen turn 1
79.  **Override Key** — Once per zone: override one zone-specific rule that's negatively affecting you
80.  **Void Lens** — Void-type enemies drop 3× their normal loot
81.  **Code Injection** — Add one custom stat boost (+25 to chosen stat) that persists for 5 floors [T5+]
82.  **System Log** — At run end, see exactly which passive saved you the most times
83.  **Stack Trace Shard** — Reveals enemy's hidden buff stacks before they reach full power
84.  **Access Token** — Once per run: unlock a merchant's hidden inventory (has Epic+ items always)
85.  **The Last Patch** — At zone entry, one enemy type in the zone is permanently weakened (-20% stats)
86.  **Crash Report** — On any game-ending death: recover 25% of that run's XP for the next run
87.  **Runtime Object** — This trinket creates a random object at the start of each fight (buff, weapon, or item)
88.  **Heap Fragment** — Destroyed items' power is partially absorbed by this trinket (+1 to stats/item)
89.  **Reference Counter** — Each time you re-equip a piece of gear, it gains +2 to all its stats
90.  **Allocator** — Manually redistribute bonus stats from all gear at the start of each floor [T6+]
91.  **Thread Spawner** — Creates a "thread" version of you that takes one hit for you per combat
92.  **Interrupt Handler** — Convert any incoming status effect into +10 ATK for 2 turns instead
93.  **Pointer Arithmetic** — Stats are calculated differently: max 5 stats contribute, minimum 1 is excluded
94.  **Scope Expander** — Ring passive pool now applies to trinket slot as well
95.  **Event Listener** — Register for one enemy event per fight; when it happens, auto-counter it
96.  **Lambda Module** — Create a one-time function: program one future attack to deal 3× damage [T7+]
97.  **Garbage Collected** — At fight end, all debuffs and negative effects are cleared automatically
98.  **Weak Reference** — Hold onto a "weak" version of a previous legendary you've owned (+30% of its stats)  [T6+]
99.  **Strong Reference** — Like weak reference but full stats; the legendary you reference is "gone" from inventory [T8+]
100. **Null Object** — When you would take 0 damage (negated), convert the "0" into actual 0 — always true [T6+]
101. **Iterator** — Each enemy you kill cycles through a list of buffs (crit/dodge/regen/etc.) gaining each one
102. **Recursion Limit** — Enemy recursion abilities (split on death, etc.) are limited to 1 recursion
103. **Dead Letter Queue** — Failed flee attempts are stored; at 5 stored: next flee is instant success
104. **Circuit Breaker** — When you receive 3+ status effects simultaneously, all are cleared and you gain immunity for 2 turns
105. **Async Handler** — Trinket procs happen at end of turn rather than mid-turn (can prevent death)
106. **Magic Number** — Choose a number 1-20; whenever that number appears in damage rolls, add +100 damage
107. **The Chosen Path** — At run start: choose a zone; this run's loot is biased toward that zone's gear
108. **Zero Trust Model** — All enemy buffs are treated as threats; they generate +5 ATK on you each turn they're active
109. **Immutable Record** — Your highest-stat run's numbers are permanently stored; can reference them for a +10% boost once/run
110. **Abstract Factory** — Spawn one random item at the start of each floor (quality scales with zone level)
111. **Singleton Core** — Can only be affected by one status effect at a time; new ones overwrite the old
112. **Observer Pattern** — Watch what enemies do for 3 turns without attacking; gain immunity to those exact move types  [T5+]
113. **Decorator Module** — Adds +1 passive to any equipped item that has fewer than 3 passives [T6+]
114. **Facade Layer** — Present as an enemy of the same type; 20% chance enemies don't attack you first turn
115. **Proxy Object** — This trinket "pretends" to be another trinket from your history (+30% of that trinket's effects) [T7+]
116. **Chain of Responsibility** — Pass damage through a chain: 1st hit → 2nd → 3rd → you, each absorbing 25%
117. **Command Pattern** — Queue 3 actions in advance; they execute in order with +20% effectiveness each
118. **Strategy Object** — Switch combat strategies each fight: aggressive (+30% ATK, -20% DEF) or defensive (+30% DEF, -20% ATK)
119. **Prototype Clone** — Clone your current stats once; if you take lethal damage, clone version takes it instead
120. **Flyweight Core** — Identical gear bonuses stack (normally they don't); two of same passive = 2× effect  [T7+]
121. **Template Method** — Pre-set one attack pattern; execute it automatically every 3 turns with +25% damage
122. **Builder Pattern** — Incrementally "build" a bonus each floor: +2/floor; collect at run end as permanent stat
123. **Visitor Module** — "Visit" enemies before fighting them: reveal stats, choose to engage or skip at no cost
124. **Component System** — Each trinket ability can be broken into components and reassembled differently  [T8+]
125. **Event Bus** — All passive procs broadcast to companion: 15% chance each proc triggers a companion assist
126. **State Machine** — Cycle through 5 states each turn: ATK+, DEF+, AGI+, VIT+, LCK+; gain that state's +30 bonus
127. **Pipeline Module** — Attacks flow through a pipeline: each passive adds +5% damage before final hit
128. **Cache Hit** — If you've fought this enemy type before, start with +20 to all stats vs. them
129. **Cache Miss** — If you haven't fought this enemy type before, +50% XP from the fight
130. **Hotspot Analyzer** — Track which stat contributes most to damage; that stat grows +1/kill
131. **Profiling Crystal** — Runs where you die early: next run gains bonus stats based on how far you made it
132. **Branch Predictor** — 70% accurate prediction of whether next attack will hit; if correct, +20% damage
133. **Speculative Module** [T8+] — Execute your next 3 attacks now; if they all hit, bonus damage; if any miss, they all miss
134. **Out-of-Order Engine** [T9+] — Sometimes attacks resolve before the enemy's defensive roll (temporal advantage)
135. **Register File** — Store up to 5 buffs in "registers"; manually apply them to any future fight
136. **Instruction Cache** — Repeat the last successful attack pattern automatically (if it won a fight) next fight
137. **TLB Module** — Address translation: stats from one slot count toward a different slot's calculations
138. **Paging System** — Store run stats in "pages"; if you run out of HP, page to a stored state (respawn) [T7+]
139. **Segmentation Fault** — Enemy with highest stats takes 25% more damage from you (target the strong)
140. **Bus Architecture** — All stat bonuses from gear flow through the trinket first; gain 5% of each
141. **Interrupt Latency Reducer** — Companion assists now fire with zero delay (same turn you take damage)
142. **Quantum Tunneling** [T9+] — 3% chance each turn to bypass all enemy defenses entirely
143. **Coherent Cache** — If same passive fires twice in one combat, second proc deals 2× effect
144. **Write-Back Buffer** — Stat gains this fight are "written back" as permanent at 25% of their value
145. **NUMA Node** — Stats are partitioned: STR/INT on one node, AGI/VIT on another; each node buffs the other
146. **Hot Reload** — Change one equipped item mid-run without returning to shop [T6+]
147. **Static Analysis** — Before entering a new floor: receive a report on potential threats
148. **Fuzz Crystal** — Enemy attacks have ±20% variance (could be much weaker or stronger)
149. **Mutation Shard** — Each run, this trinket mutates into a new random trinket passive
150. **Permadeath Shard** — You deal 2× damage but if you die, that legendary item is permanently destroyed [T7+]
151. **Chaos Seed** — Randomize enemy stat distribution at fight start (same budget, different allocation)
152. **Entropy Crystal** — All stats decay 1/turn, but damage output increases 2% per decayed point
153. **Null Safety Module** — All "null" or "void" effects that would negate your actions are ignored
154. **Type Safety Rune** — Immune to "type change" effects (identity swap, mirroring, etc.)
155. **Memory Safety Gem** — Immune to "stat steal" and "attribute drain" effects permanently
156. **Race Condition Chip** — 15% chance each turn to act twice (race the clock)
157. **Deadlock Breaker** — When two forces are in stalemate (both defending), automatically win initiative
158. **Starvation Shard** — Low-priority enemy attacks (weak hits) are delayed and combined; you face one big hit instead of many small ones
159. **Banker's Algorithm** — Hold resources in reserve; spend them all at once for a massive turn
160. **Spinlock Module** — For 3 turns: both you and enemy are locked in place; only attack matters
161. **Semaphore Crystal** — Control access to treasure rooms; skip one and get it later at +25% quality
162. **Monitor Rune** — Once per fight: observe without acting; enemy uses all abilities, you dodge them all
163. **Condition Variable** — Wait for a specific condition (enemy below 50% HP, etc.); when met, act twice
164. **Atomic Transaction** — Treat entire combat as one transaction; if you win, get all loot; lose, keep nothing but gain double next run
165. **Memory Order Crystal** — Choose attack resolution order: before or after defense roll
166. **Volatile Register** — Your highest stat shifts to a different stat each fight (keeps enemies guessing)
167. **ABA Module** — If an enemy was buffed, debuffed, and buffed again: the net effect is 3× the buff
168. **Lock-Free Orb** — All passive abilities fire simultaneously rather than one at a time (synergy bonus)
169. **Relaxed Ordering** — Stat contributions are "relaxed" — AGI can contribute to damage, STR to dodge, etc.
170. **Sequential Consistency** [T10+] — The universe guarantees consistency: all your attacks hit, all your defenses work, once per run
