# Aria's Adventure — Gear Sets

Last updated: 2026-02-27
Status: Design / Pre-Implementation

---

## Rules Recap

- All pieces in a set MUST be the same rarity (no Rare/Epic mixing)
- Sets only exist at Rare and Epic rarity
- Legendary items are NOT part of sets; they have unique individual bonuses
- Set pieces are substantially rarer than normal drops (~1/8 chance when a qualifying drop occurs)
- Sets are bound to level brackets — you won't find a high-level set in a low-level zone
- Sets of 4 pieces have: 2pc bonus and 4pc bonus
- Sets of 5 pieces have: 2pc, 4pc, and 5pc bonuses
- Sets of 6 pieces have: 2pc, 4pc, and 6pc bonuses
- All set bonuses are intentionally powerful — they define a playstyle, not just add stats

---

## Set Notation

```
[SET NAME]  (Rarity | Piece Count | Level Bracket)
Pieces: [Slot1], [Slot2], [Slot3], [Slot4], [Slot5?], [Slot6?]

2-Piece Bonus: ...
4-Piece Bonus: ...
6-Piece Bonus: ...

Playstyle Focus: ...
```

---

## RARE SETS (Level Brackets 10–100)

---

### GLITCH RUNNER SET  (Rare | 4-Piece | Levels 10–25)
Pieces: Glitch Visor, Glitch Vest, Glitch Gauntlets, Glitch Treads

2-Piece: +30 AGI, +12% base dodge chance
4-Piece: Every time you successfully dodge an attack, your next attack deals 3× damage

Playstyle: Evasion-based. Build high AGI, dodge constantly, unload massive crits.

---

### IRON PROTOCOL SET  (Rare | 6-Piece | Levels 15–35)
Pieces: Protocol Helm, Protocol Chest, Protocol Gloves, Protocol Boots, Protocol Belt, Protocol Ring

2-Piece: +55 VIT, +20 DEF
4-Piece: Once per run, a killing blow is negated — you are reduced to 1 HP instead
6-Piece: After surviving a killing blow, your ATK doubles and you cannot be stunned for 5 turns

Playstyle: Tank survivability. Survive lethal hits and retaliate with massive damage.

---

### STATIC BLADE SET  (Rare | 4-Piece | Levels 20–40)
Pieces: Static Katana, Static Helm, Static Bracers, Static Belt

2-Piece: +25 STR, every 3rd attack applies Shock (enemy stunned for 1 turn)
4-Piece: While an enemy is stunned, your ATK is doubled and your attacks cannot miss

Playstyle: Stun-lock melee. Control fights with stunning, then burst during windows.

---

### NEON PHANTOM SET  (Rare | 5-Piece | Levels 25–45)
Pieces: Phantom Visor, Phantom Shroud, Phantom Bands, Phantom Steps, Phantom Ring

2-Piece: +35 INT, spell-based attacks pierce 25% of enemy DEF
4-Piece: Killing an enemy with a magic attack spawns a shadow copy that attacks once for 60% of your INT score
5-Piece: Shadow copies have a 25% chance to chain-summon another copy on their kill

Playstyle: Magic assassination with summoned shadows.

---

### SCAVENGER'S PACT SET  (Rare | 4-Piece | Levels 10–30)
Pieces: Scavenger Helm, Scavenger Vest, Scavenger Belt, Scavenger Boots

2-Piece: +40 LCK, gold found from all sources +35%
4-Piece: After collecting gold, restore HP equal to 1% of gold collected (healing gold)

Playstyle: Gold-farming run. Maximize income while sustaining through healing gold.

---

### GANG LORD SET  (Rare | 4-Piece | Levels 15–30)
Pieces: Gang Crown, Gang Jacket, Gang Grips, Gang Boots

2-Piece: +30 STR, enemy ATK reduced by 10% while your HP is above 50%
4-Piece: Enemies that flee from you drop their entire loot pool as if killed

Playstyle: Dominant aggressor. Stay healthy, keep enemies on defense.

---

### OVERCLOCKED SET  (Rare | 5-Piece | Levels 30–50)
Pieces: Overclock Visor, Overclock Vest, Overclock Gloves, Overclock Boots, Overclock Module (Trinket)

2-Piece: +40 ATK (flat), +15% attack speed
4-Piece: Every 4th attack deals bonus damage equal to all ATK gained from the previous 3 attacks
5-Piece: The 4th attack also applies a burn (5 damage/turn for 3 turns) and cannot be dodged

Playstyle: Timing-based burst. Count to 4 every fight.

---

### VOID WHISPER SET  (Rare | 4-Piece | Levels 35–55)
Pieces: Void Mask, Void Robe, Void Wraps, Void Talisman (Amulet)

2-Piece: +25 INT, +20 AGI — your INT score contributes 25% to physical damage
4-Piece: Your attacks reduce enemy MAX HP by 5% per hit (stacks, enemies become permanently weaker this fight)

Playstyle: Hybrid INT-AGI build. Whittle down max HP while dealing consistent damage.

---

### MACHINE HEART SET  (Rare | 6-Piece | Levels 40–65)
Pieces: Machine Helm, Machine Chest, Machine Gauntlets, Machine Greaves, Machine Ring, Machine Core (Trinket)

2-Piece: +50 VIT, +30 DEF — immune to Bleed status
4-Piece: Every time you take damage, your next attack gains +8 flat damage (stacks up to 5 times, resets on attack)
6-Piece: You cannot take more than 20% of your max HP in a single hit

Playstyle: Damage sponge that returns punishment. Cap incoming damage, build stacks, burst.

---

### NEURAL NET SET  (Rare | 4-Piece | Levels 45–70)
Pieces: Neural Visor, Neural Coat, Neural Gloves, Neural Ring

2-Piece: +40 INT, +20 LCK — your INT contributes to crit chance calculation
4-Piece: When you land a critical hit, all your active stat buffs are extended by 2 turns

Playstyle: Crit-fishing mage build. Land crits to extend your own empowerment windows.

---

### BLOOD TIDE SET  (Rare | 5-Piece | Levels 50–75)
Pieces: Blood Helm, Blood Coat, Blood Gauntlets, Blood Boots, Blood Pendant (Amulet)

2-Piece: +35 STR, all attacks have 12% lifesteal
4-Piece: When lifesteal heals you to full HP, the overflow damage applies to the enemy as bonus damage
5-Piece: Lifesteal is doubled if you are below 40% HP

Playstyle: Aggressive self-sustain. Get low, become nearly unkillable.

---

### REFRACTION SET  (Rare | 4-Piece | Levels 55–80)
Pieces: Refraction Visor, Refraction Vest, Refraction Bands, Refraction Ring

2-Piece: +30 AGI, +30 INT — when you dodge, release a retaliatory magic pulse dealing INT/2 damage
4-Piece: Magic pulses can crit and trigger Companion assist procs

Playstyle: Dodge-caster hybrid. Weave between dodges and magic pulses.

---

### STORM CALLER SET  (Rare | 4-Piece | Levels 60–85)
Pieces: Storm Crown, Storm Vest, Storm Boots, Storm Ring

2-Piece: +35 AGI, after 3 consecutive dodges without attacking, next attack is guaranteed to hit and crit
4-Piece: Triple the crit multiplier (3× instead of 2×) when the guaranteed crit from 2pc triggers

Playstyle: Patience-based. Endure, dodge, then deliver a single devastating blow.

---

### ECHO CHAMBER SET  (Rare | 6-Piece | Levels 70–100)
Pieces: Echo Helm, Echo Chest, Echo Gauntlets, Echo Sabatons, Echo Ring, Echo Belt

2-Piece: +40 to any two stats of choice (choose at equip time)
4-Piece: At the start of each fight, copy the enemy's most powerful stat and add it to your own temporarily
6-Piece: Copied stats persist for the entire floor (not just one fight)

Playstyle: Adaptive stat mirroring. Become stronger by facing stronger enemies.

---

## EPIC SETS (Level Brackets 60–200+)

---

### VOID WALKER'S MANTLE  (Epic | 6-Piece | Levels 60–90)
Pieces: Void Walker Helm, Void Walker Vestment, Void Walker Gauntlets,
        Void Walker Greaves, Void Walker Ring, Void Walker Amulet

2-Piece: +50 to ALL stats simultaneously
4-Piece: Each kill has 10% chance to trigger a void pulse — deals damage equal to enemy's max HP ÷ 5 to ALL enemies
6-Piece: Gain +1 to ALL stats permanently per zone tier successfully cleared (persists between sessions)

Playstyle: Endgame all-rounder. Grows infinitely through play. The baseline Epic set.

---

### CRIMSON ALGORITHM  (Epic | 6-Piece | Levels 80–115)
Pieces: Algorithm Crown, Algorithm Cuirass, Algorithm Gauntlets, Algorithm Sabatons, Algorithm Ring ×2

2-Piece: +70 STR, +40 ATK
4-Piece: Attacks have 35% chance to trigger a combo — strike twice in one action (second at 75% damage)
6-Piece: Combo strikes can chain indefinitely (each combo hit has 35% chance to continue chaining)
FULL SET UNIQUE: Your STR score counts double for all damage calculations

Playstyle: Explosive melee chain combos. RNG-driven but massively high ceiling.

---

### SYNTHETIC SOUL  (Epic | 5-Piece | Levels 70–100)
Pieces: Soul Visor, Soul Coat, Soul Bracers, Soul Heels, Soul Pendant (Amulet)

2-Piece: +60 CHA, Companion assists every other turn
4-Piece: Companion's assists deal 250% of your ATK as damage
5-Piece: Companion can take one killing blow per run on your behalf (prevents death)

Playstyle: Bond-focused. Maximize CHA; treat companion as a second fighter.

---

### ARCHITECT'S BLUEPRINT  (Epic | 6-Piece | Levels 90–130)
Pieces: Blueprint Crown, Blueprint Plate, Blueprint Gauntlets, Blueprint Sabatons, Blueprint Ring, Blueprint Module (Trinket)

2-Piece: +60 INT, magic attacks deal bonus damage equal to 10% of enemy's max HP
4-Piece: INT-based attacks reduce enemy max HP permanently by 5% each hit
6-Piece: At 25% enemy HP, target their "core" — bypass all DEF for remaining damage

Playstyle: HP-reduction mage. Shrink enemy health pools while dealing damage.

---

### PHANTOM PROTOCOL  (Epic | 4-Piece | Levels 85–120)
Pieces: Protocol Shadow Mask, Protocol Cloak, Protocol Grips, Protocol Ghost-Boots

2-Piece: +80 AGI, dodge chance +25% — dodge triggers leave an afterimage (decoy)
4-Piece: Decoys can absorb one hit each. Up to 3 decoys active simultaneously.
FULL SET UNIQUE: While any decoy is active, your ATK is doubled

Playstyle: Battlefield control through decoys. Keep decoys alive, deal massive damage.

---

### ENTROPY REAPER  (Epic | 5-Piece | Levels 100–140)
Pieces: Reaper Crown, Reaper Coat, Reaper Gauntlets, Reaper Scythe (Weapon), Reaper Ring

2-Piece: +70 STR, attacks ignore 30% of enemy DEF
4-Piece: Each attack permanently reduces enemy's MAX HP by 3% (cumulative across the fight)
5-Piece: When enemy is reduced to below 20% max HP, all your attacks deal true damage (no DEF)

Playstyle: HP shredder. Make enemies weaker as the fight progresses.

---

### QUANTUM THREAD  (Epic | 6-Piece | Levels 110–150)
Pieces: Quantum Visor, Quantum Vest, Quantum Bracers, Quantum Treads, Quantum Ring ×2

2-Piece: +70 AGI, +70 INT — attacks randomly deal physical OR magical damage (better of two rolls)
4-Piece: Once per fight, pause time for 1 full turn — attack freely while enemy cannot act
6-Piece: Time pause activates automatically if HP would drop below 15% (once per fight)

Playstyle: Hybrid burst damage with clutch survival. Requires timing and awareness.

---

### BINARY DIVINITY  (Epic | 6-Piece | Levels 130–170)
Pieces: Divinity Crown, Divinity Plate, Divinity Gauntlets, Divinity Greaves, Divinity Amulet, Divinity Ring

2-Piece: +80 to ALL stats
4-Piece: All gear passives across all your equipment become 50% more effective
6-Piece: At the end of each run, permanently gain +2 to your highest stat (forever, stacks)

Playstyle: Passive amplifier. The longer you play, the more powerful all your gear becomes.

---

### OBSIDIAN CORE  (Epic | 4-Piece | Levels 140–180)
Pieces: Obsidian Crown, Obsidian Plate, Obsidian Ring, Obsidian Pendant (Amulet)

2-Piece: +100 VIT, Damage taken reduced by 20% flat after all calculations
4-Piece: Each time you take damage, store 5% of it as "rage." Deal all stored rage on next attack.
FULL SET UNIQUE: Rage storage has no cap and carries between floors (but resets at run end)

Playstyle: Damage absorption tank. Let enemies hit you, then unleash compounded fury.

---

### SIGNAL AND NOISE  (Epic | 5-Piece | Levels 150–190)
Pieces: Signal Helm, Signal Coat, Noise Bracers, Noise Boots, Signal-Noise Ring

2-Piece: +60 LCK, critical hits now deal 4× damage instead of 2×
4-Piece: After a critical hit, your next 3 attacks also critically hit
5-Piece: Starting a run, the first attack of the first fight always critically hits

Playstyle: Critical-chain build. Set up the first crit, then watch the cascade.

---

### LAST SENTINEL  (Epic | 6-Piece | Levels 160–200)
Pieces: Sentinel Crown, Sentinel Plate, Sentinel Gauntlets, Sentinel Greaves, Sentinel Belt, Sentinel Core (Trinket)

2-Piece: +100 DEF, immune to status effects
4-Piece: While above 50% HP, take 0 damage from any attack that would deal less than 10% of your max HP
6-Piece: Once per run, when you would die, instead heal to 100% HP, gain immunity for 2 turns, then continue

Playstyle: True immortality build. Near-invincible at high HP, godlike survival tool.

---

### FRACTAL DREAMER  (Epic | 6-Piece | Levels 180–220)
Pieces: Fractal Visor, Fractal Shroud, Fractal Gloves, Fractal Runners, Fractal Ring, Fractal Idol (Trinket)

2-Piece: +90 INT, spells have 20% chance to trigger "fractal cascade" — duplicate the spell for free
4-Piece: Fractal cascades can themselves cascade (30% per chain link, max 5 links)
6-Piece: Fractal cascades deal an additional 50% bonus damage each link they chain

Playstyle: Exponential spell scaling. Low floor, absurdly high ceiling.

---

### ZEROTH PROTOCOL  (Epic | 6-Piece | Levels 200+)
Pieces: Protocol-Zero Helm, Protocol-Zero Plate, Protocol-Zero Hands, Protocol-Zero Boots, Protocol-Zero Ring, Protocol-Zero Belt

2-Piece: +100 to ALL stats
4-Piece: All damage you deal is treated as TRUE damage (bypasses all DEF, resistances, immunities)
6-Piece: At the start of each floor, all enemies in that floor take 10% max HP as damage (pre-combat)
FULL SET UNIQUE: You cannot die while all 6 pieces are equipped. HP minimum is 1.

Playstyle: Absolute power. The final gear set in the game. Reserved for endgame completionists.

---

## Set Design Notes

### What Makes a Good Set Bonus
1. The 2pc bonus should be noticeable but not define the playstyle alone
2. The 4pc bonus should fundamentally change HOW you play — a new mechanic
3. The 6pc (if applicable) should be a defining, memorable power fantasy
4. Full-set unique effects (on 4pc sets) should be worth sacrificing gear flexibility

### Set Balance Philosophy
- Rare sets: Should let you clear zone tier +1 above their intended level range
- Epic sets: Should let you clear zone tier +2 above their intended level range
- A full Epic set should never feel like losing by comparison to mixing gear
- Full set bonus makes up for potentially weaker individual piece stats vs. curated drops

### Set Acquisition Rates
- A full 4-piece Rare set is expected to take 8–15 hours of play in the right zone tier
- A full 6-piece Epic set is expected to take 20–40 hours of play in the right zone tier
- Set pieces have their own distinct visual appearance in the UI (name glow + icon)

---

## EXTENDED RARE SETS — Continued (Level Brackets 10–100)

Sets use compact notation below. Full format: Name | Rarity | Pieces | Level Bracket
Bonuses listed as "2pc:" and "4pc:" (or "6pc:" for six-piece sets).

---

### CRYO LATTICE  (Rare | 4 | Levels 10–25)
Pieces: Cryo Helm, Cryo Coat, Cryo Gauntlets, Cryo Boots
2pc: +30 DEF, attacks have 10% chance to Slow enemy (AGI halved for 1 turn)
4pc: Slowed enemies take 3× damage from your next attack after the slow

---

### CIRCUIT BREAKER  (Rare | 4 | Levels 15–30)
Pieces: Circuit Visor, Circuit Vest, Circuit Bracers, Circuit Ring
2pc: +25 INT, +15 LCK — INT-based attacks have 15% chain chance (hit second enemy)
4pc: Chain attacks can chain again (30% chance per link, max 5 links)

---

### BERSERKER'S DEBT  (Rare | 5 | Levels 20–40)
Pieces: Debt Crown, Debt Coat, Debt Grips, Debt Boots, Debt Amulet
2pc: +40 STR — each hit taken buffs ATK by +5 (stacks to +60)
4pc: At max stacks, all attacks deal 2× damage and stacks drain slowly instead of resetting
5pc: When stacks reset, deal damage equal to all stacks' accumulated ATK to the enemy

---

### PHANTOM THREAD  (Rare | 4 | Levels 25–45)
Pieces: Thread Mask, Thread Cloak, Thread Bands, Thread Soles
2pc: +35 AGI — 20% chance any attack passes through you (phased out)
4pc: When phased, automatically counter-attack for 80% ATK damage

---

### BONE SIGIL  (Rare | 4 | Levels 30–50)
Pieces: Bone Crown, Bone Plate, Bone Gloves, Bone Ring
2pc: +30 VIT, +20 DEF — kill enemies quickly: each kill in under 3 turns grants a Bone Stack
4pc: At 5 Bone Stacks, all stats double for 3 turns (bone frenzy)

---

### CHROME MANTIS  (Rare | 4 | Levels 35–55)
Pieces: Mantis Visor, Mantis Coat, Mantis Claws (weapon), Mantis Ring
2pc: +40 AGI, attacks have 25% chance to hit twice (mantis speed)
4pc: Double-hits trigger companion assist procs at full power

---

### WARDEN'S PACT  (Rare | 6 | Levels 20–40)
Pieces: Warden Helm, Warden Plate, Warden Gauntlets, Warden Greaves, Warden Belt, Warden Amulet
2pc: +50 VIT, regen triggers even in combat (not just after)
4pc: Enemies below 30% HP deal 50% less damage (they know they've lost)
6pc: Once per floor: pacify an enemy without fighting (they drop loot anyway)

---

### STORMWEAVE  (Rare | 4 | Levels 40–60)
Pieces: Storm Crown, Storm Robe, Storm Gloves, Storm Ring
2pc: +35 INT, attacks have 20% chance to deal bonus lightning damage (INT×0.5)
4pc: Lightning hits chain to enemies within the current encounter for 25% of original damage

---

### PREDATOR PROTOCOL  (Rare | 5 | Levels 45–65)
Pieces: Predator Helm, Predator Vest, Predator Grips, Predator Boots, Predator Belt
2pc: +35 AGI, +20 LCK — first attack on any enemy deals 2× damage (ambush)
4pc: If ambush crits: gain stealth for 1 turn (enemy can't counter)
5pc: Ambush bonus resets every 3 floors (not just once per fight)

---

### HAUNTED STEEL  (Rare | 4 | Levels 50–70)
Pieces: Haunted Helm, Haunted Chest, Haunted Gauntlets, Haunted Amulet
2pc: +30 VIT, +30 INT — killed enemies have 10% chance to fight for you for 1 turn
4pc: Ghost allies have full stats of the original enemy (not 50%)

---

### CHROME DEITY  (Rare | 6 | Levels 55–80)
Pieces: Chrome Crown, Chrome Plate, Chrome Gauntlets, Chrome Greaves, Chrome Ring×2
2pc: +50 STR, +30 DEF
4pc: Attacks that deal over 50 damage also reduce enemy max HP by 5%
6pc: Reducing an enemy's max HP below their current HP doesn't kill them — it sets their current HP to the new max (no instakill, but makes them weaker overall)

---

### RIFTWALKER  (Rare | 4 | Levels 60–80)
Pieces: Rift Visor, Rift Coat, Rift Ring, Rift Module (Trinket)
2pc: +40 AGI, can visit any room type twice per floor (revisit mechanic)
4pc: Second visits always yield better loot/results than first

---

### CIRCUIT JURY  (Rare | 5 | Levels 65–85)
Pieces: Jury Crown, Jury Plate, Jury Bands, Jury Sabatons, Jury Ring
2pc: +40 LCK, crits trigger a "verdict" — enemy must make a save roll or be stunned
4pc: Failed save rolls deal extra damage equal to your LCK score
5pc: Verdict procs on ALL hits (not just crits)

---

### CURSED COIN  (Rare | 4 | Levels 70–95)
Pieces: Cursed Ring×2, Cursed Amulet, Cursed Belt
2pc: +45 LCK, +45 gold per kill
4pc: On death: drop all gold collected this run — but the next run starts with double that amount
FULL SET: Death is no longer feared; it's a strategic reset

---

### VENOM COIL  (Rare | 5 | Levels 40–65)
Pieces: Coil Helm, Coil Chest, Coil Gauntlets, Coil Boots, Coil Ring
2pc: +30 AGI, attacks apply Poison (5 dmg/turn, stacks to 5)
4pc: Each Poison stack on enemy reduces their ATK by 5% (weakens as they decay)
5pc: On enemy death with max stacks: their Poison explodes for AOE damage

---

### MIDNIGHT PROTOCOL  (Rare | 4 | Levels 50–70)
Pieces: Midnight Visor, Midnight Coat, Midnight Boots, Midnight Ring
2pc: +30 INT, +30 AGI — attacks deal bonus shadow damage equal to 10% of your max HP
4pc: Shadow damage ignores all resistances and immunities

---

### IRON DYNASTY  (Rare | 6 | Levels 80–100)
Pieces: Dynasty Crown, Dynasty Plate, Dynasty Gauntlets, Dynasty Greaves, Dynasty Ring, Dynasty Belt
2pc: +60 STR, +40 DEF
4pc: Killing an enemy refunds 20% of any HP lost in that fight
6pc: At the start of each new floor, fully restore HP (the dynasty never tires)

---

### SHATTERED MIRROR  (Rare | 4 | Levels 75–100)
Pieces: Mirror Visor, Mirror Coat, Mirror Ring×2
2pc: +40 INT — absorb enemy buffs: when enemy gains a buff, you gain half its value
4pc: Your INT score is mirrored as bonus DEF

---

### HOLLOW CROWN  (Rare | 4 | Levels 85–105)
Pieces: Hollow Crown, Hollow Robe, Hollow Ring, Hollow Amulet
2pc: +50 INT, spells have 25% chance to "hollow" enemy (reduce max HP by 10%)
4pc: Hollowed enemies take 50% more damage from all sources

---

### APEX PREDATOR  (Rare | 5 | Levels 90–115)
Pieces: Apex Helm, Apex Vest, Apex Claws (weapon), Apex Boots, Apex Pendant
2pc: +50 AGI, first attack each combat ALWAYS crits
4pc: If first attack kills enemy, gain full HP restore
5pc: "First attack" resets every 2 floors (not just per fight)

---

### BLADED FAITH  (Rare | 4 | Levels 95–120)
Pieces: Faith Helm, Faith Plate, Faith Gauntlets, Faith Ring
2pc: +55 STR, holy damage (INT/4) added to all attacks
4pc: Holy damage bypasses DEF entirely; also heals you for 10% of holy damage dealt

---

## EXTENDED EPIC SETS (Level Brackets 60–300+)

---

### NEON SOVEREIGN  (Epic | 6 | Levels 65–100)
Pieces: Sovereign Crown, Sovereign Coat, Sovereign Gauntlets, Sovereign Sabatons, Sovereign Ring, Sovereign Amulet
2pc: +60 to all stats — aura: enemies deal 10% less damage for each floor you've cleared this run
4pc: Aura stacks — additionally, you deal 5% more damage per floor cleared this run
6pc: Aura cap is removed; it stacks infinitely for the duration of the run

---

### ASHEN VEIL  (Epic | 5 | Levels 70–105)
Pieces: Ashen Visor, Ashen Robe, Ashen Bracers, Ashen Boots, Ashen Pendant
2pc: +70 INT, all attacks apply Ash (DOT 8 dmg/turn for 4 turns)
4pc: Ash stacks are permanent until enemy dies (normal DOTs fade; Ash doesn't)
5pc: When enemy dies with Ash, their ashes deal 30% of their max HP as AOE damage

---

### ABSOLUTE DEFENSE  (Epic | 6 | Levels 75–110)
Pieces: Absolute Helm, Absolute Plate, Absolute Gauntlets, Absolute Greaves, Absolute Ring, Absolute Belt
2pc: +80 VIT, +60 DEF
4pc: Cannot be reduced below 25% HP by any single attack
6pc: While above 50% HP, incoming damage is halved (the wall holds)

---

### DIGITAL GHOST  (Epic | 5 | Levels 80–115)
Pieces: Ghost Mask, Ghost Coat, Ghost Bands, Ghost Soles, Ghost Module (Trinket)
2pc: +80 AGI, +40 LCK — once per fight: become fully invisible for 2 turns
4pc: While invisible: all attacks deal 5× damage
5pc: Invisibility now lasts 3 turns and the trigger resets every other fight

---

### SOVEREIGN FLAME  (Epic | 6 | Levels 85–120)
Pieces: Flame Crown, Flame Plate, Flame Gauntlets, Flame Greaves, Flame Ring, Flame Amulet
2pc: +80 STR, all attacks deal bonus fire damage (STR × 0.4)
4pc: Fire damage stacks on enemies (+5/hit, enemies with 5+ stacks take 2× from all sources)
6pc: At 10 fire stacks: the enemy ignites — instant 50% max HP damage

---

### ECLIPSE PROTOCOL  (Epic | 6 | Levels 90–130)
Pieces: Eclipse Helm, Eclipse Chest, Eclipse Grips, Eclipse Boots, Eclipse Ring, Eclipse Pendant
2pc: +75 AGI, +75 INT — dual-stat scaling: attacks use higher of AGI or INT
4pc: When both stats exceed 100: attacks deal both physical AND magical damage simultaneously
6pc: Dual-stat attacks bypass all resistances (can't resist both at once)

---

### TITAN'S BARGAIN  (Epic | 4 | Levels 95–135)
Pieces: Titan Helm, Titan Plate, Titan Ring, Titan Core (Trinket)
2pc: +100 VIT, +80 STR — your attacks deal damage to yourself equal to 5% of what you deal enemies
4pc: Self-damage triggers Regen equal to 3× the self-damage amount (net positive)
FULL SET UNIQUE: You cannot die from self-damage (min 1 HP regardless)

---

### PHANTOM MATRIX  (Epic | 5 | Levels 100–140)
Pieces: Matrix Visor, Matrix Coat, Matrix Bracers, Matrix Heels, Matrix Module (Trinket)
2pc: +90 AGI — create one Phantom copy per fight that mirrors your attacks at 40% power
4pc: Phantom copies can crit and trigger companion assists
5pc: Up to 3 Phantom copies can exist simultaneously

---

### CRIMSON TIDE  (Epic | 6 | Levels 105–145)
Pieces: Tide Crown, Tide Coat, Tide Gauntlets, Tide Greaves, Tide Ring×2
2pc: +90 STR, all attacks have 20% lifesteal
4pc: Lifesteal heals up to 200% max HP (excess becomes a HP shield)
6pc: HP shield carries between fights (doesn't reset after combat)

---

### NEURAL THRONE  (Epic | 6 | Levels 110–155)
Pieces: Throne Crown, Throne Coat, Throne Gauntlets, Throne Greaves, Throne Ring, Throne Amulet
2pc: +100 INT, magic attacks pierce 40% of enemy DEF
4pc: Magic attacks have 25% chance to deal the damage again next turn (echo)
6pc: Echoes can echo (30% chain, max 3 deep); each echo deals 75% of the previous one

---

### GHOST DYNASTY  (Epic | 5 | Levels 115–160)
Pieces: Dynasty Visor, Dynasty Coat, Dynasty Bracers, Dynasty Boots, Dynasty Ring
2pc: +85 AGI, +85 VIT — when you take damage, create a ghost copy that absorbs the next hit
4pc: Ghost copies fight back after absorbing (attack for 60% of your ATK)
5pc: Up to 5 ghost copies active; they share your companion assist triggers

---

### DEAD STAR  (Epic | 6 | Levels 120–165)
Pieces: Dead Star Helm, Dead Star Plate, Dead Star Gauntlets, Dead Star Greaves, Dead Star Ring, Dead Star Amulet
2pc: +90 LCK, +90 INT
4pc: When you kill an enemy, their power is "collapsed" into you: +5 to all stats per enemy killed (run-scoped, max +100)
6pc: At max stacks, collapse yourself into a supernova — deal 2× your total accumulated bonus to all enemies (once per run)

---

### ZERO PROTOCOL  (Epic | 6 | Levels 125–170)
Pieces: Protocol-0 Helm, Protocol-0 Vest, Protocol-0 Grips, Protocol-0 Boots, Protocol-0 Ring×2
2pc: All damage dealt is treated as if enemy has 0 DEF (ignore DEF)
4pc: All damage received is treated as if you have +50 DEF beyond your actual score
6pc: Both effects stack additively — you hit hard and are hit softly

---

### RESONANT CORE  (Epic | 4 | Levels 130–175)
Pieces: Resonant Helm, Resonant Plate, Resonant Ring, Resonant Core (Trinket)
2pc: +100 STR, +100 INT — attacks resonate: deal 50% bonus damage of opposite type (STR→INT bonus and vice versa)
4pc: Resonance cascades — echoes twice at 25% power each
FULL SET UNIQUE: Both STR and INT contribute 100% (not 50/50 hybrid) — true dual scaling

---

### CIRCUIT DEITY  (Epic | 6 | Levels 140–185)
Pieces: Deity Crown, Deity Coat, Deity Gauntlets, Deity Treads, Deity Ring, Deity Pendant
2pc: +120 to chosen primary stat (chosen at equip time)
4pc: Chosen stat contributes to ALL damage calculations at 100%
6pc: Chosen stat also contributes to DEF and dodge calculations at 50%

---

### SINGULARITY GATE  (Epic | 6 | Levels 150–200)
Pieces: Gate Crown, Gate Plate, Gate Gauntlets, Gate Greaves, Gate Ring, Gate Module (Trinket)
2pc: +110 to all stats
4pc: At the start of each fight, enemy stats are reduced by 15% (gravitational pull)
6pc: Reduction increases by 5% each turn of the fight (enemies collapse toward you)

---

### VOID HEART  (Epic | 5 | Levels 160–210)
Pieces: Void Crown, Void Plate, Void Gauntlets, Void Ring, Void Pendant
2pc: +120 STR, +80 INT — 10% of all damage dealt is stored in the Void Heart
4pc: Release the Void Heart once per run: deal all stored damage in one attack
5pc: Stored damage carries between floors (it accumulates for the whole run)

---

### ETERNAL FLAME  (Epic | 6 | Levels 175–225)
Pieces: Eternal Helm, Eternal Coat, Eternal Bracers, Eternal Sabatons, Eternal Ring×2
2pc: +130 STR, fire damage (STR × 0.6) on all attacks
4pc: Fire stacks are permanent across fights (enemies from fight 1 still burning in fight 3)
6pc: Fire stacks on dead enemies transfer to new enemies when they enter (spread the flame)

---

### ABYSSAL SOVEREIGN  (Epic | 6 | Levels 190–240)
Pieces: Abyssal Crown, Abyssal Coat, Abyssal Gauntlets, Abyssal Greaves, Abyssal Ring, Abyssal Core (Trinket)
2pc: +140 to all stats
4pc: Enemies cannot regenerate HP while this set is equipped
6pc: Enemies' max HP decays by 3% per turn (they become weaker over a long fight)
FULL SET UNIQUE: At the start of each zone tier you enter, all enemies in the zone permanently lose 5% max HP

---

### OMEGA LATTICE  (Epic | 6 | Levels 210–260)
Pieces: Omega Crown, Omega Plate, Omega Gauntlets, Omega Greaves, Omega Ring, Omega Amulet
2pc: +150 to all stats
4pc: Each prestige you've completed adds +15 to all set bonuses (retroactive, permanent growth)
6pc: Set bonus effectiveness scales with prestige count — effectively infinite growth

---

### APEX PROTOCOL  (Epic | 6 | Levels 230–290)
Pieces: Apex-X Crown, Apex-X Plate, Apex-X Gauntlets, Apex-X Greaves, Apex-X Ring, Apex-X Amulet
2pc: +160 STR, +100 AGI — every 5th attack triggers an "Apex Strike" (guaranteed crit + true damage)
4pc: Apex Strikes can chain (40% chance, max 3)
6pc: Apex Strikes also trigger a companion assist at full power regardless of CHA

---

### THE LAST SET  (Epic | 6 | Levels 280–320)
Pieces: Last Crown, Last Plate, Last Gauntlets, Last Greaves, Last Ring, Last Pendant
2pc: +200 to all stats
4pc: All attacks are true damage (ignore DEF, resistances, immunities)
6pc: If you die while this full set is equipped, you don't die — the Last Set activates, instantly kills every enemy on the floor, then shatters (permanently destroyed)

---

### RECURSIVE THRONE  (Epic | 6 | Levels 300+)
Pieces: Recursive-R Crown, Recursive-R Plate, Recursive-R Gauntlets, Recursive-R Sabatons, Recursive-R Ring, Recursive-R Core (Trinket)
2pc: +220 to all stats
4pc: Each stat doubles if it exceeds 500 (the recursion kicks in)
6pc: No stat caps. All scaling is infinite. This is the highest-tier set in the game.
FULL SET UNIQUE: The Recursive Throne has no ceiling. The player can grow indefinitely.
