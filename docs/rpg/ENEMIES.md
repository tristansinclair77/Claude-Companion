# Aria's Adventure — Enemy Database

Last updated: 2026-02-27
Status: Design / Pre-Implementation

---

## Difficulty Bracket System

Every enemy belongs to a difficulty bracket. The bracket determines their STAT BUDGET —
the total points distributed across their stats. The distribution PATTERN determines
what kind of fighter they are (tank, glass cannon, assassin, etc.).

### Difficulty Brackets

| Bracket | Zone Tier | Stat Budget | XP Mult | Gold Mult |
|---------|-----------|-------------|---------|-----------|
| Minion | T1 | 25 | 1× | 1× |
| Scout | T2 | 50 | 1.5× | 1.2× |
| Soldier | T3 | 90 | 2× | 1.5× |
| Elite | T4 | 150 | 3× | 2× |
| Champion | T5 | 250 | 5× | 3× |
| Legend | T6+ | 400 | 8× | 5× |
| Apex | T8+ | 650 | 12× | 8× |
| God-Tier | T9+ | 1000 | 20× | 15× |
| Boss (any) | Any | 3× bracket budget | 15× | 10× |

Stat budget scales by zone level on top of bracket multiplier. See SCALING.md.

---

## Stat Distribution Archetypes

Each enemy type has a stat distribution pattern that determines personality.
Budget is split across: HP, ATK, DEF, AGI, and SPECIAL (special ability power).

| Archetype | HP% | ATK% | DEF% | AGI% | SPECIAL% |
|-----------|-----|------|------|------|----------|
| Tank | 45 | 15 | 30 | 5 | 5 |
| Glass Cannon | 15 | 55 | 5 | 20 | 5 |
| Balanced | 25 | 25 | 20 | 20 | 10 |
| Assassin | 15 | 40 | 5 | 35 | 5 |
| Support | 35 | 10 | 20 | 10 | 25 |
| Summoner | 20 | 15 | 15 | 15 | 35 |
| Berserker | 20 | 45 | 5 | 25 | 5 |
| Fortress | 50 | 10 | 35 | 0 | 5 |
| Trickster | 10 | 20 | 10 | 45 | 15 |
| Caster | 20 | 35 | 10 | 10 | 25 |

---

## Shiny (Rare) Variant Rules

Any non-boss enemy has a chance to spawn as a Shiny variant.
- **Visual**: Purple vignette overlay + electric static border animation on the UI
- **HP**: ×2.5 base
- **ATK**: ×2.0 base
- **DEF**: ×1.5 base
- **XP**: ×5 base
- **Gold**: ×3 base
- **Loot**: Guaranteed Rare+ drop (rarity table still applies above Rare)
- **Scenario**: Triggers `shiny_enemy_appear` response from companion

Shiny enemies display a distinctive name prefix (e.g., "✦ Shiny Cyborg Thug")
and have a unique color shift on their enemy entry card in the UI.

---

## Boss Rules

- Every zone's final floor has a boss encounter
- Bosses use the Boss bracket (3× the normal bracket stat budget for the zone tier)
- Bosses have at least one SPECIAL ABILITY that changes the fight (see ability list)
- Bosses always drop guaranteed loot (minimum Uncommon, higher in higher tiers)
- Bosses trigger a Claude narration call (high-value moment)
- Random Boss Enemies: Every 3rd regular boss slot is filled by a randomly generated
  boss (name + archetype + stats generated from zone tier, no fixed identity)

### Boss Special Abilities (Assigned to bosses based on zone theme)

1. Enrage — At 50% HP, ATK doubles
2. Shield Phase — At 75% HP, immune to damage for 2 turns
3. Summon Minions — Summons 2 Minion-bracket enemies at fight start
4. Regeneration — Restores 5% max HP each turn
5. Curse — Reduces player's highest stat by 30% for 5 turns
6. Phase Shift — Every 3 turns, becomes immune to physical or magical (alternating)
7. Cleave — Attacks deal bonus damage that ignores DEF
8. Life Drain — Each attack steals 10% of player's current HP
9. Berserker Rage — Gains +5 ATK each turn (cumulative)
10. Mirror Shield — Returns 20% of damage dealt to attacker
11. Time Slow — Player can only act every other turn (for 3 turns)
12. Void Pulse — Every 5 turns, deals AOE damage equal to 20% of boss max HP
13. Execute — If player HP falls below 20%, boss attempts an instant kill roll (25% chance)
14. Petrify — If boss hits same spot 3 turns in a row, player is stunned for 2 turns
15. Necro Pulse — On death, resurects one previously killed minion at 50% stats
16. Overcharge — Winds up for 1 turn, then deals 3× normal ATK damage
17. Adaptive Armor — Each time player uses same attack twice, DEF +10 vs that attack
18. Gravity Well — All AGI-based bonuses reduced to 0 for the boss fight
19. Soul Shatter — Permanently reduces one of player's equipped item bonuses until run ends
20. Final Form — At 25% HP, fully restores HP but permanently loses all DEF

---

## Enemy Roster by Zone Archetype

### Street / Scavenger Archetype
These enemies appear in Tier 1 zones (Rusted Outskirts, Sewer Network, etc.)
All are human or near-human combatants using improvised weapons.

1.  **Street Thug**
    Archetype: Balanced | Bracket: Minion
    Description: Opportunistic brawler. Telegraphed attacks, easy to dodge.
    Special: None
    Drop: Common gear, small gold

2.  **Desperate Scavenger**
    Archetype: Glass Cannon | Bracket: Minion
    Description: Starving and dangerous. High burst, no endurance.
    Special: Flee — 15% chance to flee if HP falls below 30%, losing all loot
    Drop: Common gear, small gold, small chance of a healing item

3.  **Gang Grunt**
    Archetype: Balanced | Bracket: Minion
    Description: Mid-level gang enforcer. Organized but not dangerous alone.
    Special: Backup Call — 10% per turn chance to summon a second Gang Grunt
    Drop: Common gear, moderate gold

4.  **Junkyard Dog (Cyborg)**
    Archetype: Assassin | Bracket: Minion-Scout
    Description: Feral animal with cyber-grafted attack limbs. Fast and brutal.
    Special: Pounce — First attack ignores DEF
    Drop: Common gear, small gold, animal part trinkets

5.  **Corrupt Beat Cop**
    Archetype: Balanced | Bracket: Scout
    Description: Law enforcement gone crooked. Heavy armor, shock baton.
    Special: Arrest — Stun chance 20% per hit (baton shock)
    Drop: Common-Uncommon gear, good gold

6.  **Graffiti Golem**
    Archetype: Tank | Bracket: Scout
    Description: Animated street art given hostile form. Slow and nearly impenetrable.
    Special: Wall Slam — Every 4 turns, AOE damage to player for guaranteed 10 dmg
    Drop: Common gear, pigment reagents (trinket crafting material - future)

7.  **Junk Knight**
    Archetype: Fortress | Bracket: Scout
    Description: A person wearing so much salvaged armor they can barely move.
    Special: Immovable — Cannot be moved or repositioned; very high DEF
    Drop: Uncommon armor guaranteed

8.  **Pack Runner**
    Archetype: Balanced | Bracket: Minion
    Description: Never alone. Summons 2 additional Pack Runners on spawn.
    Special: Pack Tactics — Each alive ally grants +5 ATK to all Pack Runners
    Drop: Common gear split across the pack

9.  **Spray Can Saboteur**
    Archetype: Trickster | Bracket: Scout
    Description: Uses aerosol weapons to disorient and confuse.
    Special: Blind — 30% chance to apply Blind status (player -40% hit chance for 2 turns)
    Drop: Common gear, craft materials

10. **Rogue Medic**
    Archetype: Support | Bracket: Scout
    Description: A paramedic gone feral. Heals themselves mid-combat.
    Special: Field Patch — Heals 15% max HP at 50% HP threshold (once per fight)
    Drop: Uncommon gear, healing items

11. **Hooded Informant**
    Archetype: Trickster | Bracket: Scout
    Description: Tries to flee every turn. If caught before escaping, drops massive loot.
    Special: Always Flee — Attempts flee every turn with 80% success rate
    Drop: Rare gear guaranteed (if caught) — represents intel value

12. **Alley Witch**
    Archetype: Caster | Bracket: Scout
    Description: Street-level magic user. Applies debuffs and status effects.
    Special: Hex — Randomly applies one of: Weaken, Blind, Curse
    Drop: Common-Uncommon gear, trinket components

13. **Shakedown Artist**
    Archetype: Balanced | Bracket: Scout
    Description: Threatens the player. Steals gold if not killed within 3 turns.
    Special: Mug — Steals 5% of player gold per turn they survive
    Drop: All stolen gold returned + normal drop

14. **Sewer Rat King**
    Archetype: Summoner | Bracket: Scout-Soldier (Boss tier for T1)
    Description: Massive cyborg rat directing a swarm.
    Special: Swarm — Starts fight with 3 Feral Rats (Minion bracket)
    Drop: Guaranteed Uncommon gear + boss gold cache

15. **Beat Cop Drone**
    Archetype: Assassin | Bracket: Scout
    Description: Autonomous law enforcement unit. Ranged attack, hover capable.
    Special: Taser Shot — 25% stun chance on ranged attacks; immune to Knock effects
    Drop: Common-Uncommon gear, tech components

16. **The Enforcer**
    Archetype: Balanced | Bracket: Soldier
    Description: Professional corporate hitman. Methodical and efficient.
    Special: Target Mark — First turn marks player, gaining +25% accuracy all fight
    Drop: Uncommon-Rare gear, high gold

17. **Wrecker**
    Archetype: Berserker | Bracket: Soldier
    Description: Pure destruction. Gets faster and stronger with each hit landed.
    Special: Momentum — Each landed attack grants +8 ATK (stacks to ×3)
    Drop: Uncommon gear, high gold

---

### Corporate / Security Archetype
Appears in Tier 2–3 zones. Professional, organized, using corporate tech.

18. **Corporate Security Guard**
    Archetype: Balanced | Bracket: Scout
    Description: Standard issue guard. Follows protocol to a fault.
    Special: Call Backup — Once per fight, radios for a second Guard after 3 turns
    Drop: Common-Uncommon gear, corporate ID trinket

19. **Tactical AI**
    Archetype: Caster | Bracket: Soldier
    Description: Combat AI with predictive algorithms.
    Special: Predict — Knows player's next attack and pre-dodges it (50% miss chance vs. Tactical AI)
    Drop: Uncommon-Rare gear, AI chip (trinket)

20. **Combat Drone Mk.II**
    Archetype: Assassin | Bracket: Scout-Soldier
    Description: Fast aerial unit. Hard to hit, devastating when it connects.
    Special: Evasion Protocol — 30% dodge chance base; cannot be stunned
    Drop: Common-Uncommon gear, drone parts

21. **Security Mech**
    Archetype: Fortress | Bracket: Soldier-Elite
    Description: Heavy exosuit. Takes a team to bring down.
    Special: Fortified — First 3 attacks deal 0 damage (armor dampening)
    Drop: Rare gear, mech component (high value)

22. **Overclocked Soldier**
    Archetype: Berserker | Bracket: Soldier
    Description: Soldier with performance-enhancement implants. Burning out.
    Special: Overclock — Every 2 turns, ATK ×2 but takes 10 self-damage (burning out)
    Drop: Uncommon gear, stimulant trinkets

23. **Sniper Unit**
    Archetype: Glass Cannon | Bracket: Scout-Soldier
    Description: Long-range specialist. Deals massive damage but very fragile.
    Special: Scope — First attack always hits and crits (then becomes normal)
    Drop: Uncommon-Rare weapon focused

24. **Executive Bodyguard**
    Archetype: Tank | Bracket: Elite
    Description: Elite personal protection. Trained to absorb damage.
    Special: Take the Bullet — 30% chance to negate a hit entirely (bodyguard reflex)
    Drop: Rare gear, high gold

25. **Corporate Assassin**
    Archetype: Assassin | Bracket: Elite
    Description: Kills silently and efficiently. Concealed approach.
    Special: First Blood — First attack deals 3× damage (ambush)
    Drop: Rare weapon, rare trinket

26. **Black Ops Operative**
    Archetype: Balanced | Bracket: Elite
    Description: Special forces with adaptive combat training.
    Special: Adapt — After taking 3 hits of the same type, gains immunity to that type for 3 turns
    Drop: Rare gear, classified data (lore item)

27. **Nano-Swarm**
    Archetype: Summoner | Bracket: Soldier
    Description: Cloud of microscopic machines. Individually harmless, collectively lethal.
    Special: Reintegrate — Depleted swarms regenerate 10% every turn
    Drop: Uncommon gear, nano components

---

### Tech / AI Archetype
Appears in Tier 3–5 zones. Mechanical or digital in nature.

28. **Rogue Loader Bot**
    Archetype: Tank | Bracket: Soldier
    Description: Industrial robot repurposed for combat. Slow but impossibly durable.
    Special: Hydraulic Fist — Every 4 turns, guaranteed hit dealing 2× ATK damage
    Drop: Uncommon-Rare gear

29. **Memory Leak Entity**
    Archetype: Berserker | Bracket: Soldier
    Description: A digital entity consuming everything around it.
    Special: Leak — Gains +5 to all stats each turn (exponential threat)
    Drop: Rare gear, memory shard trinket

30. **Firewall Guardian**
    Archetype: Fortress | Bracket: Soldier-Elite
    Description: Defensive AI program. Nearly impenetrable barrier.
    Special: Reflect — Returns 30% of magical damage to attacker
    Drop: Uncommon-Rare armor

31. **Recursive Bug**
    Archetype: Summoner | Bracket: Scout-Soldier
    Description: Splits in two when killed.
    Special: Fork — On death, spawns 2 child bugs at 50% current stats (max 1 fork depth)
    Drop: Split drop — each fork drops separately

32. **Logic Bomb**
    Archetype: Glass Cannon | Bracket: Scout-Soldier
    Description: Lives to explode. Deals massive damage on death.
    Special: Detonation — On death, deals 30% of max HP to player as AOE
    Drop: Common gear, explosive component

33. **Ransomware**
    Archetype: Trickster | Bracket: Soldier
    Description: Demands payment or it'll destroy something valuable.
    Special: Hostage — Takes player's equipped weapon out of play for 3 turns unless paid 100 gold
    Drop: Returns hostage + normal drop on death

34. **DDoS Swarm**
    Archetype: Balanced | Bracket: Minion
    Description: 5 identical weak entities attacking simultaneously.
    Special: Volume Attack — All 5 attack every turn; each deals low damage but cumulative total is high
    Drop: Common gear shared across the swarm

35. **Zero Day Exploit**
    Archetype: Assassin | Bracket: Elite
    Description: A newly discovered vulnerability given form.
    Special: Bypass — All attacks ignore DEF entirely (unpatched vulnerability)
    Drop: Rare-Epic gear

36. **The Patcher**
    Archetype: Support | Bracket: Soldier
    Description: Heals and buffs other AI entities in the zone.
    Special: Emergency Patch — Heals target ally for 40% max HP (can target self)
    Drop: Uncommon gear, patch notes (lore item)

37. **Compiler Beast**
    Archetype: Tank | Bracket: Champion
    Description: Massive compiled construct. The largest non-boss enemy.
    Special: Compile — Spends first 2 turns compiling (+30 to all stats after)
    Drop: Rare-Epic gear, compiler fragment

38. **The Debugger**
    Archetype: Trickster | Bracket: Elite
    Description: Finds and removes your advantages.
    Special: Debug — Removes one random buff/passive effect from the player per turn
    Drop: Rare gear, debugging tool (trinket)

39. **Root Kit**
    Archetype: Assassin | Bracket: Soldier-Elite
    Description: Hidden until the moment it strikes.
    Special: Hidden — Invisible for first turn; first attack always crits; then reveals
    Drop: Rare gear, rootkit module (trinket)

40. **BSOD Entity**
    Archetype: Caster | Bracket: Elite
    Description: A literal Blue Screen of Death given hostile intelligence.
    Special: System Crash — Every 5 turns, briefly crashes one of the player's passive effects
    Drop: Rare gear, crash dump (lore item)

---

### Psychic / Psionic Archetype
Appears in Tier 5–7 zones. Operates on mental and emotional levels.

41. **Thought Echo**
    Archetype: Varies | Bracket: Varies
    Description: A copy of the player from a previous version. Uses same stats as player did 3 levels ago.
    Special: Mirror Build — Uses exact copies of player's previous stat distribution
    Drop: Rare gear

42. **Nightmare Fragment**
    Archetype: Caster | Bracket: Soldier-Elite
    Description: A piece of someone's nightmare given form.
    Special: Fear Touch — On hit, applies Fear: player cannot use items for 2 turns
    Drop: Rare gear, nightmare shard

43. **Void Stalker**
    Archetype: Assassin | Bracket: Elite
    Description: Predator from the void. Invisible until it attacks.
    Special: Stalk — Invisible for 3 turns; first attack from stealth deals 4× damage
    Drop: Rare-Epic gear

44. **Mind Leech**
    Archetype: Caster | Bracket: Soldier
    Description: Drains mental resources.
    Special: Drain — Steals 10 from player's INT stat (temporary, returns after fight)
    Drop: Rare gear, leech component

45. **Psionic Wraith**
    Archetype: Glass Cannon | Bracket: Elite
    Description: Pure psychic energy. Flies, hard to hit.
    Special: Phase — 35% dodge chance; immune to physical damage
    Drop: Epic gear, psionic crystal

46. **Identity Thief**
    Archetype: Trickster | Bracket: Elite
    Description: Steals your identity mid-fight.
    Special: Steal Identity — On hit, copies player's highest stat and uses it as its own for 3 turns
    Drop: Epic gear

47. **Existential Horror**
    Archetype: Fortress | Bracket: Champion
    Description: Causes paralyzing fear through its existence alone.
    Special: Dread Aura — Player ATK reduced by 20% while this enemy is alive; very high HP
    Drop: Epic gear, dread essence

48. **Recursion Wraith**
    Archetype: Summoner | Bracket: Elite-Champion
    Description: Clones itself across time.
    Special: Clone — Creates 1 clone every 3 turns at 50% stats (max 3 clones)
    Drop: Epic gear, recursion fragment

49. **The Anti-Companion**
    Archetype: Balanced | Bracket: Elite
    Description: Specifically designed to counter companion-bond builds.
    Special: Bond Break — Nullifies companion assist for 5 turns on hit
    Drop: Epic gear

50. **Quantum Observer**
    Archetype: Trickster | Bracket: Champion
    Description: Its stats change based on whether it's being "looked at" (targeted or not).
    Special: Observation Effect — Stats are higher when not targeted; lower when targeted
    Drop: Epic gear, quantum lens

51. **True Nothingness**
    Archetype: Fortress | Bracket: Champion-Legend
    Description: Cannot be damaged by physical means at all.
    Special: Negate Physical — Immune to all STR-based damage; only INT-based works
    Drop: Epic-Legendary gear

---

### Void / Cosmic Archetype
Appears in Tier 7–10 zones. Ancient, alien, incomprehensible.

52. **Void Walker**
    Archetype: Balanced | Bracket: Legend
    Description: A resident of the void. Has seen things that cannot be described.
    Special: Void Aura — All damage dealt here ignores DEF (true damage)
    Drop: Epic-Legendary gear

53. **Ancient Void Spawn**
    Archetype: Summoner | Bracket: Legend-Apex
    Description: Spawns lesser void entities constantly.
    Special: Endless Spawn — Summons 1 Void Scout every 2 turns (no cap)
    Drop: Legendary gear

54. **The Forgotten**
    Archetype: Tank | Bracket: Legend
    Description: Something removed from existence that clings on anyway.
    Special: Persist — At 0 HP, survives for 1 additional turn and attacks (then dies)
    Drop: Legendary gear, forgotten fragment

55. **Probability Phantom**
    Archetype: Trickster | Bracket: Apex
    Description: Exists in multiple states simultaneously.
    Special: Quantum — Each turn, one random stat is doubled, one is halved
    Drop: Legendary gear

56. **The Paradox**
    Archetype: Caster | Bracket: Apex
    Description: A logical impossibility made real.
    Special: Contradiction — Taking damage below 50% HP heals it instead; must be killed from above 50%
    Drop: Legendary gear, paradox core

57. **God Process**
    Archetype: Balanced | Bracket: God-Tier
    Description: A process running at the divine level of the system.
    Special: Omnipresence — Cannot be targeted directly; must be hit via splash effects
    Drop: Legendary gear, divine fragment

58. **Reality Seed**
    Archetype: Summoner | Bracket: God-Tier
    Description: Will become a new universe if not stopped.
    Special: Gestate — Gains +50 to all stats per turn it survives
    Drop: Legendary gear, reality seed trinket

59. **The Eternal Process**
    Archetype: Fortress | Bracket: God-Tier
    Description: Cannot actually die. Survive 20 turns for victory.
    Special: Immortal — Cannot be reduced below 1 HP; win by lasting 20 turns
    Drop: Legendary gear, eternal fragment (enables Prestige)

60. **Bootstrap Paradox**
    Archetype: Caster | Bracket: God-Tier
    Description: It created itself. You cannot prevent something that already happened.
    Special: Inevitable — If the player flees this fight, they loop back to fight it again
    Drop: Legendary gear set piece

---

## Random Boss Generator

When a "random boss" slot fires (every 3rd boss encounter), the system generates a boss with:

```
1. Select archetype randomly from all archetypes
2. Select a zone-appropriate name from:
   [Honorific] + [Name] + [Title]

   Honorifics: Grand, Dire, Ancient, Cursed, The Shattered, Supreme, Void-Touched,
               Binary, Neon, The Last, Infinite, Zero, Prime, Fallen, Ascendant

   Names: Xeth, Korrath, Malvon, Thresh, Vexa, Nullan, Grimthar, Syndra, Vorak,
          Ellith, Crux, Davan, Phorix, Zerith, Ombra, Calix, Vorn, Soleth, Draxis,
          Nekrath, Syvian, Therax, Ulven, Pharos, Cendis, Wrath, Elris, Morath

   Titles: of the Void, the Unyielding, the Broken, Ender, the Compiler, of Zero,
           the Recursive, the Null, the Shard, of Entropy, Unbound, the Root,
           of the Abyss, the Forgotten, First of Last, the Inverse, of Static,
           the Encrypted, Protocol Seven, the Override, Zero-Day

3. Assign 2 random boss special abilities from the Boss Ability List
4. Apply zone-level stat scaling to Boss bracket
5. Generate loot table (Rare+ guaranteed)
```

---

## Enemy Naming Conventions

Non-generic enemies in high-tier zones get generated names using:

```
[Zone-Tier Prefix] + [Archetype Word] + [Optional Suffix]

T1–T2:  Street, Gang, Rusted, Broken, Shadow, Slum, Feral
T3–T4:  Cyber, Neural, Quantum, Chrome, Static, Digital, Binary
T5–T6:  Void, Psionic, Fractured, Echo, Mirror, Phantom, Ghost
T7–T8:  Ancient, Omega, Root, Kernel, Supreme, Admin, Prime
T9–T10: God, Absolute, Final, Ultimate, Eternal, Zero, Null, True

Archetype Words: Guard, Wraith, Stalker, Hunter, Drone, Construct, Entity,
  Specter, Daemon, Fragment, Echo, Spawn, Core, Shell, Phantom, Walker, Runner,
  Leech, Golem, Bomber, Assassin, Reaper, Void, Null, Ghost, Shadow, Pulse

Suffixes (optional, 30% chance): MK-II, v2.0, [REDACTED], (Shattered), (Corrupted),
  (Ascendant), [ALPHA], [BETA], Protocol-7, Unit-Zero, The Last
```
