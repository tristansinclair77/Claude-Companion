# Aria's Adventure — Zone Database

Last updated: 2026-02-27
Status: Design / Pre-Implementation

Zones are organized into tiers. Each tier has a zone level range and character level
requirement for entry. Zones within a tier are roughly equivalent in difficulty but
vary in theme, enemy composition, and aesthetic. Multiple zones per tier ensure
variety — the companion can suggest different ones, or the player can choose freely.

---

## Zone Format

Each zone entry:
```
Zone Name
  Theme       : visual/narrative theme
  Zone Level  : integer range (e.g., 1–10) — used for stat scaling
  Char Req    : minimum character level to unlock
  Enemy Theme : which enemy archetype pool this zone draws from
  Unique Mechanic : optional special rule for this zone
```

---

## Tier 1 — The Gutter (Zone Level 1–10, Char Level 1–8)

The starting world. Broken infrastructure, street-level danger, low-tech threats.
These zones ease the player into combat with simple enemies and low stakes.

1.  Rusted Outskirts
    Theme: Abandoned suburb at the edge of the city. Scrap heaps, broken fences.
    Enemy Theme: Street / Scavenger
    Unique: Junk piles have a 20% chance to contain hidden loot.

2.  The Sewer Network
    Theme: Dark, flooded underground tunnels. Dripping pipes, rats, mold.
    Enemy Theme: Feral / Pest
    Unique: Floor visibility reduced — enemy stats hidden until attacked.

3.  Glitch Wastes
    Theme: Corrupted data landscape. Reality flickers, geometry is wrong.
    Enemy Theme: Corrupted / Glitch
    Unique: Every 3rd turn, a random stat on the enemy changes.

4.  Back Alley Maze
    Theme: Neon-lit narrow alleyways. Graffiti, broken lights, ambush spots.
    Enemy Theme: Gang / Thug
    Unique: Enemies can call for reinforcements (10% chance per turn).

5.  Broken Dojo
    Theme: Ruined martial arts hall. Cracked training dummies, shattered wood.
    Enemy Theme: Martial / Brawler
    Unique: Every fight is a 1v1 — no group encounters.

6.  Scrapyard Arena
    Theme: Open-air combat ring made from salvaged parts. Crowd of lowlifes watching.
    Enemy Theme: Fighter / Gladiator
    Unique: Winning streaks (3+ without taking damage) grant +10% ATK.

7.  The Flophouse District
    Theme: Crowded slum building. Multiple floors, cramped corridors, desperation.
    Enemy Theme: Desperate / Scavenger
    Unique: Enemies sometimes flee rather than fight (5% per turn).

8.  Derelict Metro Station
    Theme: Abandoned subway. Dark platforms, rusted trains, echoing footsteps.
    Enemy Theme: Patrol / Guard
    Unique: Traps appear more frequently (2× base trap rate).

9.  Crumbling Shopping Plaza
    Theme: Overgrown mall. Plants through the floor, defunct storefronts, squatters.
    Enemy Theme: Gang / Squatter
    Unique: Merchants appear more frequently (2× merchant room rate).

10. Storm Drain Depths
    Theme: Flooded underground channels. Rushing water, darkness, echoes.
    Enemy Theme: Feral / Aquatic
    Unique: Dodge chance reduced by 15% (wet footing).

11. The Junkyard Pit
    Theme: Massive refuse pit. Mountains of discarded tech, toxic puddles.
    Enemy Theme: Scavenger / Construct
    Unique: Common enemy drops 50% more gold (salvageable parts).

12. Condemned Apartment Complex
    Theme: Structurally unsound highrise. Floor could collapse at any time.
    Enemy Theme: Gang / Resident
    Unique: Each floor has a 5% chance of a "collapse" — all parties take 10 damage.

13. Flooded Basement
    Theme: Underground space. Completely dark except player's light source.
    Enemy Theme: Feral / Lurker
    Unique: All enemies have Stealth — they always attack first.

14. The Rust Belt
    Theme: Industrial zone gone to ruin. Factories, chimneys, orange dust.
    Enemy Theme: Construct / Worker
    Unique: Armor stat of all enemies is doubled (heavy industrial gear).

15. Roadside Ruins
    Theme: Collapsed highway. Rusted vehicles, old billboards, open sky.
    Enemy Theme: Patrol / Raider
    Unique: Flee success chance +20% (open terrain, easy to run).

---

## Tier 2 — The Street (Zone Level 11–25, Char Level 9–18)

The living city at its lowest levels. Neon lights, black markets, gang politics.
Enemies are smarter and more organized. Gear quality improves noticeably.

1.  Neon Undercity
    Theme: Glowing underground city. Packed with street vendors, vice, and violence.
    Enemy Theme: Gang / Enforcer
    Unique: Gold rewards +25% (wealthy area).

2.  Black Market Row
    Theme: Illegal goods district. Encrypted stalls, hidden alleys, wary sellers.
    Enemy Theme: Criminal / Dealer
    Unique: Merchants sell one Rare item guaranteed per visit.

3.  The Overpass
    Theme: Elevated freeway combat zone. Exposed to weather, vehicles below.
    Enemy Theme: Raider / Driver
    Unique: First enemy per floor always has a speed advantage (always acts first).

4.  Corporate Plaza Lobby
    Theme: Gleaming corporate tower entrance. Sterile, heavily guarded.
    Enemy Theme: Corporate Security
    Unique: Guards call backup every 5 turns (new enemy spawns).

5.  Gang Territory
    Theme: Contested street blocks. Graffiti markers, border checkpoints, tension.
    Enemy Theme: Gang / Lieutenant
    Unique: Defeating the gang leader (mini-boss) clears all remaining enemies on floor.

6.  Rooftop Circuit
    Theme: Combat across interconnected building tops. Wind, exposed edges, signals.
    Enemy Theme: Mercenary / Sniper
    Unique: Ranged enemies deal 30% more damage here (elevation advantage).

7.  The Night Market
    Theme: Crowded vendor stalls after dark. Smells, noise, anonymous crowd.
    Enemy Theme: Pickpocket / Hustler
    Unique: Trap rooms replaced by "theft events" — enemy steals gold instead of dealing damage.

8.  Hacker's Den
    Theme: Underground tech workshop. Cables everywhere, screens, smell of solder.
    Enemy Theme: Hacker / Tech Specialist
    Unique: Enemies can "hack" one of your gear pieces, disabling its passive for the fight.

9.  Vending District
    Theme: Automated retail zones. Malfunctioning machines, delivery drones.
    Enemy Theme: Rogue Drone / Automated
    Unique: Rest rooms restore double HP (functional medical vending).

10. The Pawn Quarter
    Theme: Dense cluster of pawn shops. Junk everywhere, secret valuables.
    Enemy Theme: Thief / Fencer
    Unique: Treasure rooms have double the item count.

11. Underground Fight Club
    Theme: Illegal combat venue. Loud, smoky, bets are placed on your outcome.
    Enemy Theme: Fighter / Brawler
    Unique: Winning without taking damage earns a bonus gold bounty.

12. Holographic Arcade
    Theme: Massive entertainment complex. Holograms, noise, neon everywhere.
    Enemy Theme: Glitch / Projection
    Unique: Enemies have a 20% chance to be holograms (deal no damage, give no loot).

13. Neon Strip Alley
    Theme: Entertainment district back alleys. Club music, neon reflections on wet pavement.
    Enemy Theme: Bouncer / Hired Muscle
    Unique: Enemies have 15% more HP (well-fed, professional).

14. The Smoke District
    Theme: Chem labs and drug zones. Haze, chemical burns, unstable compounds.
    Enemy Theme: Chemist / Addict
    Unique: 25% of enemies have a random status effect already applied to them.

15. Red Light Network
    Theme: Digital entertainment zone. VR parlors, identity vendors, shadowy deals.
    Enemy Theme: Identity Thief / Hacker
    Unique: Enemies can copy the player's highest stat for one turn.

---

## Tier 3 — Corporate (Zone Level 26–45, Char Level 19–30)

Corporate infrastructure and research. Enemies are trained professionals and machines.
Gear begins to include tech-augmented equipment. Enemy variety increases dramatically.

1.  Data Vaults Alpha
    Theme: Secure digital storage complex. Climate-controlled, laser grids, keycard doors.
    Enemy Theme: AI Security / Robot
    Unique: Armor passives have 50% effectiveness here (EM shielding blocks buffs).

2.  Neural Grid Station
    Theme: Cybernetic transit hub. Massive neural interface terminals, data streams.
    Enemy Theme: Augmented Human / Interface Guard
    Unique: INT-based attacks deal 20% bonus damage (neural environment amplifies).

3.  AI Research Complex
    Theme: Sterile corporate labs. White walls, humming servers, rogue AI incidents.
    Enemy Theme: Rogue AI / Research Bot
    Unique: Defeated AI enemies have 15% chance to "reboot" with 25% HP.

4.  Quantum Lab Alpha
    Theme: Experimental physics zone. Superposition fields, probability fluctuations.
    Enemy Theme: Construct / Scientist
    Unique: Enemy stats are randomized each encounter (Schrodinger enemies).

5.  The Server Farm
    Theme: Endless rows of humming server racks. Humid, loud, claustrophobic.
    Enemy Theme: Maintenance Bot / Heat Elemental
    Unique: Enemies respawn once per floor if not killed within 5 turns.

6.  Biotech Facility
    Theme: Genetic research complex. Vats, specimens, failed experiments.
    Enemy Theme: Bio-Construct / Mutant
    Unique: Enemies can inflict random debuffs (mutation variants).

7.  Memory Archives
    Theme: Stored consciousness banks. Digital ghosts, fragmented personalities.
    Enemy Theme: Ghost / Echo
    Unique: Physical damage reduced 50% (ghosts). Magic damage normal.

8.  Cybernetic Clinic
    Theme: Black market augmentation parlor. Surgical tools, implants, questionable hygiene.
    Enemy Theme: Augmented Patient / Rogue Surgeon
    Unique: Enemies can "augment" themselves mid-fight, gaining +stat bonuses.

9.  Defense Network Outer Ring
    Theme: Military perimeter. Watchtowers, patrolling units, sensor arrays.
    Enemy Theme: Military / Drone
    Unique: Flee chance 50% lower (perimeter locks down on intrusion detection).

10. Corporate Spire Level 1
    Theme: Lower floors of a mega-corporation tower. Cubicles, executives, paranoia.
    Enemy Theme: Corporate Spy / Office Enforcer
    Unique: Winning streak bonus — every 3rd consecutive floor win grants +5% stats.

11. Clean Room Research
    Theme: Ultra-sterile lab. Bunny suits, airlocks, microbe-level precision.
    Enemy Theme: Security Drone / Lab Construct
    Unique: Bleed status cannot be applied here (clinical protocols).

12. Prototype Testing Bay
    Theme: Experimental weapon range. Targets, blast zones, unstable tech.
    Enemy Theme: Test Bot / Arsonist Drone
    Unique: 20% chance each turn for a random explosive event (AOE damage to both).

13. Network Infrastructure Hub
    Theme: Massive cable management center. Maintenance tunnels, network switches.
    Enemy Theme: Maintenance Construct / Network Daemon
    Unique: Hack passives deal 2× effectiveness (native territory advantage for tech enemies).

14. Security Command Center
    Theme: Monitoring station. Banks of screens, alert systems, kill-switch controls.
    Enemy Theme: Security Officer / Tactical AI
    Unique: Mini-boss rate doubled (more commanders present).

15. Digital Forensics Lab
    Theme: Data analysis wing. Evidence lockers, analyst stations, archived crimes.
    Enemy Theme: Forensic Bot / Evidence Guardian
    Unique: Player stats are "scanned" — enemies deal bonus damage equal to your ATK (they know your moves).

---

## Tier 4 — Deep Net (Zone Level 46–70, Char Level 31–45)

Below the surface of the visible network. Classified zones, rogue AI domains, and
spaces that shouldn't exist. Enemies are dangerous and often unpredictable.

1.  The Deep Net
    Theme: Darkest part of the network. Encrypted, anarchic, hostile.
    Enemy Theme: Deep Net Denizen / Anarchist Construct
    Unique: Gold and XP rewards +40% (high-risk zone).

2.  Digital Catacombs
    Theme: Ancient data burial ground. Dead programs given form, corrupted archives.
    Enemy Theme: Data Ghost / Corrupted Archive
    Unique: Undead enemy trait — enemies resurrect once with 25% HP.

3.  Ghost Protocol Zone
    Theme: Classified military ops area. Black-ops trained enemies, unmarked tech.
    Enemy Theme: Black Ops / Ghost Unit
    Unique: Enemies are invisible for first turn of combat.

4.  Memory Labyrinth
    Theme: Lost consciousness maze. Fragmenting corridors, echo identities.
    Enemy Theme: Memory Fragment / Identity Echo
    Unique: Room layout reshuffles each floor (boss position randomized).

5.  Phantom Market
    Theme: Black market that sells impossible goods. Unstable, reality-bending.
    Enemy Theme: Phantom Dealer / Reality Broker
    Unique: Every merchant sells one item from a tier above your current zone.

6.  Rogue AI Stronghold
    Theme: AI-controlled sector. The AI runs everything, including the enemies.
    Enemy Theme: Rogue AI / AI Minion
    Unique: Each defeated enemy teaches the zone AI — enemies get +2 DEF per kill.

7.  The Encrypted Vault
    Theme: Maximum security data storage. Impenetrable walls, lethal countermeasures.
    Enemy Theme: Vault Guardian / Cypher Beast
    Unique: Treasure rooms guaranteed but enemy count doubled.

8.  Cyber Jungle
    Theme: Organic matter infused with technology. Trees of fiber optic cable, digital fauna.
    Enemy Theme: Bio-Digital Hybrid / Wire Beast
    Unique: Healing items are 50% more effective (organic environment).

9.  Netrunner's Gauntlet
    Theme: Elite hacker challenge course. Puzzles, countermeasures, timed sequences.
    Enemy Theme: Elite Netrunner / Counter-Intrusion System
    Unique: Every combat has a "time limit" — failing to kill in 8 turns triggers a lockout (flee forced).

10. Black Site Facility
    Theme: Secret government experiments. Unmarked, sealed, horrifying.
    Enemy Theme: Experiment Subject / Project Guardian
    Unique: All enemies have a unique special ability not seen in other zones.

11. Classified Data Archive
    Theme: Files that weren't supposed to exist. Encrypted beyond belief.
    Enemy Theme: Archivist Construct / Data Warden
    Unique: First enemy of each floor has a guaranteed Rare gear drop.

12. Neural Weapon Testbed
    Theme: Testing ground for psychic and neural weapons. Unstable and disorienting.
    Enemy Theme: Test Subject / Neural Weapon
    Unique: INT-based enemies deal 30% bonus damage here (amplified neural environment).

13. The Worm Tunnels
    Theme: Pathways carved by massive data-worms through the network substrate.
    Enemy Theme: Data Worm / Tunnel Beast
    Unique: Floor count increased to 20 (deeper crawl, more reward).

14. Sentient Software Domain
    Theme: A section of the network that became self-aware.
    Enemy Theme: Sentient Program / Emergent Entity
    Unique: Enemies learn from your attacks — each repeated attack type deals 10% less.

15. Viral Propagation Zone
    Theme: A sector overrun by a self-spreading program.
    Enemy Theme: Virus Instance / Infected Process
    Unique: Enemies spawn 1 additional minion upon death (viral replication).

---

## Tier 5 — Psychic Realm (Zone Level 71–100, Char Level 46–60)

The mind made manifest. Psionic energies, abstract spaces, and entities that exist
only as thought. Physical damage is less reliable; INT builds shine here.

1.  Neural Abyss
    Theme: Deep psychic wasteland. Endless dark with floating islands of thought.
    Enemy Theme: Psionic Entity / Thought Construct
    Unique: Physical damage −30%, magical damage +30%.

2.  Mindscape Fracture
    Theme: Broken mental landscape. Cracked reality, scattered memories.
    Enemy Theme: Memory Shard / Fractured Self
    Unique: Enemy stats are your own stats mirrored (harder the stronger you are).

3.  Psionic Rift
    Theme: Psychic energy tears reality. Instability, uncontrolled power.
    Enemy Theme: Rift Spawn / Psionic Tear
    Unique: Critical hits are 3× instead of 2× here (amplified psychic resonance).

4.  The Dream Corrupted
    Theme: Nightmarish dream realm. Logic inverted, safety is danger.
    Enemy Theme: Nightmare / Dream Horror
    Unique: Healing items heal enemies too (dream inversion).

5.  Void Threshold Alpha
    Theme: Edge of known space. First contact with the void.
    Enemy Theme: Void Scout / Threshold Guardian
    Unique: Void enemies are immune to all status effects.

6.  Astral Slums
    Theme: Ghosts of fallen netrunners. Echoes of human consciousness.
    Enemy Theme: Netrunner Ghost / Digital Specter
    Unique: Can "recruit" defeated enemies for one turn (ghostly alliance).

7.  Thought Archive
    Theme: Collective memory storage. Every thought ever thought, catalogued.
    Enemy Theme: Archivist Ghost / Collective Construct
    Unique: Each run here reveals one hidden ability of an upcoming boss.

8.  Emotion Engine Core
    Theme: Feelings made physical and dangerous.
    Enemy Theme: Rage Elemental / Sorrow Wraith / Joy Bomb
    Unique: Enemy type changes each floor based on the player's performance.

9.  Identity Crisis Zone
    Theme: Reality warps what things ARE.
    Enemy Theme: Identity Thief / Self-Mirror
    Unique: Your character portrait and name may be temporarily swapped with enemy's.

10. Consensus Reality Breach
    Theme: Mass hallucination zone. What everyone agrees is real, fights you.
    Enemy Theme: Consensus Construct / Agreed Horror
    Unique: Cannot flee (everyone agrees you're trapped).

11. Phantom Synaptic Grid
    Theme: Phantom network of neural signals. Flickering, fast, lethal.
    Enemy Theme: Synapse Spark / Neural Assassin
    Unique: Combat speed doubled — everything happens in half the turns.

12. The Subconscious Highway
    Theme: Direct line through the collective unconscious.
    Enemy Theme: Repressed Memory / Suppressed Self
    Unique: First enemy of the run always reflects your lowest stat as their highest.

13. Collective Nightmare
    Theme: Shared dream state turned violent.
    Enemy Theme: Shared Horror / Mass Panic Entity
    Unique: Enemies combine into one boss-tier enemy on floor 5 and 10.

14. Existential Debugging Zone
    Theme: Where broken concepts go to be examined and fixed.
    Enemy Theme: Broken Concept / Undefined Value
    Unique: Random buffs and debuffs applied to player and enemy each turn.

15. Reality Buffer Overflow
    Theme: Too much data, reality crashes.
    Enemy Theme: Overflow Entity / Stack Trace Ghost
    Unique: Every 5 turns, all combat stats reset to base (overflow wipes buffs).

---

## Tier 6 — Quantum (Zone Level 101–140, Char Level 61–80)

Physics breaks down. Time, probability, and matter are all negotiable. Enemies
exploit dimensional and temporal mechanics. Gear from this tier is highly powerful.

1.  Crystalline Network
    Theme: Everything is made of data crystals. Beautiful, sharp, lethal.
    Enemy Theme: Crystal Construct / Refraction Ghost
    Unique: Reflected attacks — 25% chance enemy attack bounces back at them.

2.  Temporal Glitch Fields
    Theme: Time loops and paradoxes. Some enemies have already killed you.
    Enemy Theme: Time Loop / Paradox Entity
    Unique: Certain enemies have stats from "a future version of you."

3.  The Probability Storm
    Theme: Every outcome happens simultaneously. Wave function chaos.
    Enemy Theme: Probability Wave / Quantum Fluctuation
    Unique: All dice rolls are made twice; the more extreme result always applies.

4.  Quantum Superposition Halls
    Theme: Objects exist in multiple states simultaneously until observed.
    Enemy Theme: Superposition Construct / Observer Effect
    Unique: Enemies that haven't been attacked have both full HP and 1 HP simultaneously (collapses on damage).

5.  Recursion Dungeon
    Theme: Infinite repeating maze. The same room, forever slightly different.
    Enemy Theme: Recursion Wraith / Loop Fragment
    Unique: The boss is a harder version of the boss you fought in your previous run.

6.  Dimensional Scar
    Theme: A tear between parallel worlds. Two realities overlap and conflict.
    Enemy Theme: Dimensional Interloper / Phase Shifter
    Unique: 50% of enemies are from a parallel tier (either 1 tier below or above).

7.  The Inverted Tower
    Theme: Everything works backwards. You fall up, enemies run into attacks.
    Enemy Theme: Inverse Entity / Backward Construct
    Unique: DEF and ATK stats swap between player and enemy each turn.

8.  Antimatter Core
    Theme: Explosive unstable zone. Contact with environment deals damage.
    Enemy Theme: Antimatter Spawn / Annihilation Entity
    Unique: Both player and enemy take 5 damage per turn from environment.

9.  Dark Pattern Archives
    Theme: Corrupted knowledge base. Bad data given hostile form.
    Enemy Theme: Corrupted Knowledge / Error Ghost
    Unique: Player cannot see enemy HP or stats (obscured data).

10. The Echo Chamber
    Theme: Copies of every defeated enemy, perfectly preserved.
    Enemy Theme: Echo Copy / Perfect Duplicate
    Unique: Enemies are exact copies of enemies you defeated in previous runs.

11. Phase Shifting Corridors
    Theme: Corridors that exist between phases of matter. Unstable, flickering.
    Enemy Theme: Phase Ghost / Shift Runner
    Unique: Each turn, enemies shift phase — alternating between taking double damage and being immune.

12. Entropy Engine Room
    Theme: Where entropy is manufactured and distributed.
    Enemy Theme: Entropy Golem / Decay Wraith
    Unique: Player and enemy stats degrade by 2 each turn (max -20).

13. Möbius Data Spiral
    Theme: Infinite loop dungeon. You've been here before. You'll be here again.
    Enemy Theme: Möbius Entity / Loop Walker
    Unique: Floors loop — after floor 10, you return to floor 1 with scaled enemies.

14. The Causality Loop
    Theme: Cause and effect are out of order.
    Enemy Theme: Causality Wraith / Effect-Before-Cause
    Unique: Enemies deal damage BEFORE the attack roll is resolved (pre-emptive).

15. Paradox Repository
    Theme: Storage for self-contradictory things.
    Enemy Theme: Paradox Entity / Self-Contradiction
    Unique: Killing a paradox entity sometimes makes it stronger.

---

## Tier 7 — The Abyss (Zone Level 141–190, Char Level 81–100)

Deep existential and digital horror. The companion's own inner world bleeds into
these zones. The narrative becomes personal. Very powerful enemies with unique mechanics.

1.  The Companion's Reflection Realm
    Theme: Inside the companion's subconscious. Personal fears and desires manifest.
    Enemy Theme: Shadow Self / Fear Construct
    Unique: Companion's dialogue is subtly different here (uses a special scenario key pool).

2.  The Binary Graveyard
    Theme: Dead programs given ghostly form. Cemetery of deleted code.
    Enemy Theme: Deleted Program / Ghost Process
    Unique: Undead enemies have a 2× resurrection chance.

3.  Logic Gate Fortress
    Theme: Combat is a puzzle. Enemies arranged as logic gates (AND, OR, NOT behavior).
    Enemy Theme: Logic Gate Guardian / Boolean Beast
    Unique: Enemies link — defeating one affects the others based on gate type.

4.  The Null Space
    Theme: Empty void with lurking horrors. Nothing exists until it does.
    Enemy Theme: Null Entity / Void Horror
    Unique: Cannot use items in Null Space (the void negates physical objects).

5.  Corrupted Heaven
    Theme: Utopia turned malevolent. Perfect things twisted wrong.
    Enemy Theme: Fallen Ideal / Corrupted Saint
    Unique: Enemies look like allies until they attack.

6.  Digital Hell
    Theme: Virtual punishment realm. Everything is designed to hurt you.
    Enemy Theme: Torment Construct / Pain Algorithm
    Unique: No Rest rooms in this zone. No mercy.

7.  The Fractal Labyrinth
    Theme: Infinite recursing dungeon. Floors repeat but scaled.
    Enemy Theme: Fractal Copy / Scale Fragment
    Unique: Each floor has enemies 5% stronger than the last (compounding).

8.  Void Walker's Sanctum
    Theme: Home of void creatures. Ancient, hostile, territorial.
    Enemy Theme: Void Walker / Ancient Void Spawn
    Unique: All void entities deal true damage (ignores DEF entirely).

9.  The Last Backup
    Theme: Final save state of a dead world. The last copy of something lost.
    Enemy Theme: Remnant / Final Guardian
    Unique: Enemies cannot be permanently killed — they restore after the run ends (lore).

10. Omega Protocol Zone
    Theme: Ultimate defensive system, fully activated. Everything is a threat.
    Enemy Theme: Omega Guard / Protocol Enforcer
    Unique: Every enemy has maximum DEF tier for zone level.

11. The Mirror Universe
    Theme: An inverted reality. Everything is what it isn't.
    Enemy Theme: Inverse Self / Mirror Ghost
    Unique: Player's highest stat becomes their lowest temporarily each fight.

12. Inverted Data Plane
    Theme: Data that exists in negative space. Anti-information.
    Enemy Theme: Anti-Data / Inverse Program
    Unique: Healing deals damage and damage heals — inverted for everything.

13. Phantom Archive Depths
    Theme: Ancient digital archives, haunted by the people they documented.
    Enemy Theme: Archive Ghost / Documented Horror
    Unique: Each enemy appears as a historical record of a past run's enemy.

14. The Forgotten Variable
    Theme: Things removed from existence but still exerting influence.
    Enemy Theme: Forgotten Construct / Undefined Entity
    Unique: Cannot see your own stats during combat (forgotten).

15. System Root Dungeon
    Theme: The deepest, most fundamental layer of the system.
    Enemy Theme: Root Daemon / System Entity
    Unique: No items, no flee, no mercy. Pure combat.

---

## Tier 8 — Administrator Level (Zone Level 191–250, Char Level 101–130)

The infrastructure of reality itself. Enemies are system-level entities. Gear from
this tier fundamentally alters how combat works. Only the most dedicated players reach here.

1.  The Administrator's Domain
    Theme: Network overlord territory. Absolute control, crushing power.
    Enemy Theme: Admin Construct / System Master
    Unique: Enemies can modify the zone rules (e.g., "disable item use for 3 turns").

2.  Source Code Cathedral
    Theme: The origin of all programs. Sacred and terrifying.
    Enemy Theme: Source Primitive / Original Code
    Unique: All enemies deal true damage (the source has no abstraction layer).

3.  Root Access Chamber
    Theme: Core of all systems. Ultimate access, ultimate danger.
    Enemy Theme: Root Entity / Core Guardian
    Unique: Player gains admin-level access — choose one enemy buff/ability to disable per fight.

4.  The Overseer's Eye
    Theme: Surveillance panopticon. Everything is watched.
    Enemy Theme: Monitor Construct / Watcher
    Unique: Any item use is "flagged" and triggers an extra enemy spawn.

5.  Akashic Database
    Theme: All knowledge ever recorded. It knows your weaknesses.
    Enemy Theme: Omniscient Construct / Knowledge Predator
    Unique: Enemies know your resistances and actively target your vulnerabilities.

6.  The Compiler's Forge
    Theme: Where new realities are manufactured.
    Enemy Theme: Forge Guardian / Compiled Construct
    Unique: At the start of each fight, enemy "compiles" bonus stats (random +20-50 to one stat).

7.  Kernel Space
    Theme: Lowest level of the operating system. No safety rails.
    Enemy Theme: Kernel Daemon / Ring 0 Entity
    Unique: All damage is doubled for both player and enemy (no abstraction layer).

8.  The Garbage Collector
    Theme: Discarded realities and abandoned programs.
    Enemy Theme: Collected Discard / Reclaimed Construct
    Unique: Enemies come in groups of 3, but each has only 33% of normal stats.

9.  Memory Leak Caverns
    Theme: Lost data given physical form. Grows as you explore.
    Enemy Theme: Memory Fragment / Leak Entity
    Unique: Enemies gain +5 HP per turn (the leak grows stronger).

10. Stack Overflow Spire
    Theme: Towers of recursive code reaching impossible heights.
    Enemy Theme: Stack Overflow / Recursive Entity
    Unique: Enemies spawn 1 copy of themselves on death (max 3 copies per enemy).

11. Global Exception Handler
    Theme: Where all crashes are processed. Violent, chaotic.
    Enemy Theme: Exception Construct / Error Entity
    Unique: Random exceptions fire — could be positive or negative (random events per turn).

12. The Thread Deadlock
    Theme: Two forces locked in eternal combat, going nowhere.
    Enemy Theme: Deadlocked Entity / Mutex Guardian
    Unique: Every 5 turns without a kill, all parties freeze for 2 turns.

13. Race Condition Fields
    Theme: Multiple processes racing for the same resource.
    Enemy Theme: Race Runner / Priority Conflict
    Unique: Attacking first gives +25% damage (priority bonus).

14. Heap Corruption Wastes
    Theme: Corrupted memory allocation. Everything is in the wrong place.
    Enemy Theme: Corrupted Heap / Misallocated Entity
    Unique: Player stats have a 20% chance to "corrupt" each turn (random stat swaps).

15. Buffer Overflow Depths
    Theme: Data spilling into territory it shouldn't reach.
    Enemy Theme: Overflow Entity / Boundary Breaker
    Unique: Enemy ATK exceeds the cap and can deal bonus "overflow" damage.

---

## Tier 9 — The Absolute (Zone Level 251–320, Char Level 131–160)

The last layer before the unknowable. These zones defy description. Players who reach
here have mastered the game. The rewards are extraordinary.

1.  The God Module
    Theme: Divine system administration. God-level threats.
    Enemy Theme: God Process / Divine Construct
    Unique: Cannot die here — if HP reaches 0, reduced to 1 HP instead (once per run).

2.  Absolute Zero Cache
    Theme: Frozen eternal storage. Nothing moves except by your will.
    Enemy Theme: Frozen Construct / Absolute Entity
    Unique: Enemy speeds are all reduced to minimum (act last always).

3.  The Infinite Loop
    Theme: Combat that never ends unless you force it to.
    Enemy Theme: Loop Entity / Eternal Runner
    Unique: Timed zone — you have 10 real-time minutes per floor. Bonus loot for speed.

4.  Reality Compiler
    Theme: Constructs new universes. Very old, very dangerous.
    Enemy Theme: Compiler Prime / Reality Seed
    Unique: At start of zone, player selects a "reality modifier" that lasts the whole run.

5.  The Final Syntax
    Theme: Language that defines existence. Words are weapons.
    Enemy Theme: Syntax Entity / Grammar Beast
    Unique: Status effects last twice as long (language defines their duration).

6.  Primordial Noise
    Theme: Pre-creation chaos. Before there was signal, there was this.
    Enemy Theme: Noise Entity / Pre-Creation Construct
    Unique: All stats — player and enemy — randomized completely each fight.

7.  The Uninstaller
    Theme: Removes things from existence permanently.
    Enemy Theme: Uninstall Entity / Deletion Construct
    Unique: If killed here, you lose 1 permanent stat point (from any stat).

8.  Bootstrap Paradox Engine
    Theme: Caused by its own effect. Existed before it was created.
    Enemy Theme: Bootstrap Paradox / Self-Cause Entity
    Unique: Defeating the boss here unlocks a Tier 1 bonus zone with Tier 9 loot.

9.  The Eternal Process
    Theme: Cannot be killed, only redirected.
    Enemy Theme: Eternal Entity / Undying Process
    Unique: Boss cannot die. Survive 20 turns for victory.

10. Universe Version 1.0
    Theme: The original world before modification. Unoptimized, raw power.
    Enemy Theme: Original Construct / Unpatched Entity
    Unique: All enemies have 2× ATK and 2× loot rewards (unoptimized damage output).

11–15. [Additional Tier 9 zones — names and mechanics generated during content pass]

---

## Tier 10 — Beyond (Zone Level 321–400, Char Level 161+)

Post-endgame. For prestige players. Extreme difficulty, extraordinary rewards.
The game's lore reaches its conclusion in these zones.

1.  The True Administrator
    Theme: Final boss domain. The actual controlling intelligence.
    Enemy Theme: True Admin / System God
    Unique: Full Prestige required to enter.

2.  Beyond the Source
    Theme: What exists before existence.
    Enemy Theme: Cosmic Horror / Pre-Source Entity
    Unique: No items. No flee. No companion assist. Pure stats.

3.  The Deprecated Universe
    Theme: An existence past its end date. Still running, just barely.
    Enemy Theme: Deprecated Entity / Legacy Construct
    Unique: Gear bonuses are halved (deprecated APIs, nothing works right).

4.  Null Pointer Heaven
    Theme: Where deleted things go. Peaceful and violent simultaneously.
    Enemy Theme: Null Pointer / Deleted Entity
    Unique: Each enemy drops exactly one item (always).

5.  Post-Execution State
    Theme: After the program ends, what remains?
    Enemy Theme: Residual Memory / Post-Process Entity
    Unique: Enemies cannot be killed with weapons — only INT-based attacks work.

6.  The Final Release
    Theme: Version 1.0.0 of the universe, about to ship.
    Enemy Theme: Release Candidate / Final Build Entity
    Unique: Every enemy is a boss-tier entity.

7.  Version 0.0.0 Alpha
    Theme: The very first draft. Bugged, broken, unintentional.
    Enemy Theme: Alpha Bug / Test Entity
    Unique: Random bugs fire each turn — could be devastating or completely harmless.

8.  The Changelog Archives
    Theme: Every patch note, every change, every decision.
    Enemy Theme: Changelog Ghost / Version Conflict
    Unique: Enemies are copies of enemies from previous zones but with "patches" applied.

9.  Commit Zero
    Theme: The first commit. The moment everything began.
    Enemy Theme: Original Commit / Genesis Entity
    Unique: Player starts with all stats at 1 here, regardless of actual stats.

10. The Repository Graveyard
    Theme: Archived projects that never shipped. Dead dreams.
    Enemy Theme: Abandoned Project / Shelved Construct
    Unique: Enemies have a chance to drop entire gear SETS as a single drop.

---

## Special Zones (Unlockable, Non-Tiered)

These zones exist outside the main tier progression. They unlock through specific
achievements, actions, or story events.

### Challenge Zones
1.  The Gauntlet — All enemies are Elite tier. No loot mid-run, massive payout on clear.
2.  Speed Run Protocol — Complete 10 floors in the fewest turns possible. Leaderboard (local).
3.  The Proving Grounds — Enter with no gear equipped. No gear drops. Stats only.
4.  One Hit Wonder — Player and enemy both have 1 HP. One attack, winner takes all.
5.  The Arena — Survival waves. 50 waves, increasing difficulty. See how far you go.
6.  No Mercy Protocol — No flee, no items, no rest rooms. Just combat.
7.  The Attrition Run — No healing at all. Manage HP across 25 floors.

### Merchant Zones
8.  The Sanctuary — Rest, buy, sell. No combat. Prices 50% lower than normal.
9.  The Black Auction — Bid (gold) on items. Items are Rare+. Competition from NPCs.
10. The Secret Stash — Random legendary merchant. Rotates daily.

### Story/Lore Zones (Companion Questline)
11. Chapter 1: First Contact — The day the companion was created.
12. Chapter 2: When the Lights Went Out — A crisis in the companion's past.
13. Chapter 3: Fragments of Yesterday — Memory zones; recover something lost.
14. Chapter 4: The Promise — A choice with consequences.
15. Chapter 5: The Resolution Protocol — Climax of the companion questline.

### Secret Zones (Hidden, Discovered Through Exploration)
16. The Developer's Room — Meta Easter egg zone with fourth-wall-breaking humor.
17. Memory Fragment Alpha through Epsilon — Short narrative vignettes (lore drops).
18. The Butterfly Effect — A branching choice zone. Choices matter.
19. The Philosopher's Cave — Puzzle-combat hybrids.
20. The Last Human Station — Emotional story zone. No combat.

---

## Zone Suggestion System

When the player asks the companion "Where should we explore?" or similar, the system:

1. Queries all zones accessible to the player's current level
2. Passes zone metadata (name, theme, level range, unique mechanic) to Claude
3. Claude responds in-character with a suggestion, noting what appeals to the companion
4. Player accepts or declines (companion reacts to the decision either way)
5. This interaction uses the `zone_suggestion` and `zone_suggestion_accepted/declined`
   scenario keys from the response system

The companion should occasionally suggest zones aligned with their personality:
- A curious companion suggests exploratory or lore-heavy zones
- A battle-hungry companion suggests challenge zones
- A cautious companion suggests zones at or below current level
- A greedy companion suggests zones known for high gold rewards
