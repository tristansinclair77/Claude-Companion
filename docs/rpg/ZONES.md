# RPG Adventure — Zone Database

Last updated: 2026-02-27
Status: Phase 0 — Design Complete

Classic fantasy adventure zones for all 10 tiers.
70 main zones (~7 per tier) plus special/challenge/questline zones.

Zone level ranges within each tier are non-linear — zones have varying useful spans.
Some zones cover a narrow band; others stretch across more of the tier.
Char Req is the minimum character level to enter the zone.
Char Req formula: `floor(zone_level_min × 0.5)`, minimum 1.

Mechanic notes are described inline here.
They will be formalized as named entries in UNIQUE_ZONE_MECHANICS.md.
Zones with no mechanic are valid and common — "None" is a fine entry.

[COMPANION-ZONE]: Only available if the active character pack includes `questline.json`.
If absent, replaced by a generic zone of the same tier.

---

## Zone Entry Format

```
Zone Name
  Theme       : visual/narrative description
  Zone Level  : X–Y
  Char Req    : minimum character level
  Enemy Theme : enemy types drawn from this zone
  Mechanic    : optional rule / None
```

---

## Tier 1 — The Frontier (Zone Level 1–10, Char Level 1–5)

The starting world. Rolling meadows, shallow caves, crumbling ruins, and coastal beaches.
Easy enemies, forgiving pacing. Designed to teach combat basics.

---

1.  Greenwood Hollow
    Theme       : A sun-dappled forest of tall oaks and shallow streams. Goblins and wild
                  animals roam the undergrowth. Mushroom rings mark the fey borders.
    Zone Level  : 1–8
    Char Req    : 1
    Enemy Theme : Goblins, Giant Rats, Timber Wolves
    Mechanic    : None

2.  Saltwind Cove
    Theme       : A rocky beach strewn with shipwreck timber, salt-crusted anchors, and
                  sailor's loot. The tide brings strange things to shore.
    Zone Level  : 1–6
    Char Req    : 1
    Enemy Theme : Giant Crabs, Beach Bandits, Merfolk Scouts
    Mechanic    : None

3.  The Muddy Fen
    Theme       : A shallow, fog-laced swamp. Croaking frogs the size of horses lurk in
                  the murk. The ground is treacherous; the water, cold.
    Zone Level  : 3–10
    Char Req    : 1
    Enemy Theme : Giant Frogs, Slimes, Bog Imps
    Mechanic    : Slick ground — Flee success chance reduced by 10%.

4.  Goblin Warren
    Theme       : A maze of shallow caves dug by an established goblin clan. Dark, smoky,
                  and smelling of cookfires. Goblins ambush in waves.
    Zone Level  : 2–8
    Char Req    : 1
    Enemy Theme : Goblins, Goblin Shamans, Goblin Chieftains
    Mechanic    : Ambush — 10% chance per floor for an additional enemy to appear mid-combat.

5.  Crumbling Watchtower
    Theme       : A collapsed stone watchtower on a wind-scoured hill. Ancient soldiers
                  haunt it. Their weapons still rust in the rubble.
    Zone Level  : 4–10
    Char Req    : 2
    Enemy Theme : Skeleton Soldiers, Giant Spiders, Carrion Crows
    Mechanic    : None

6.  Shepherd's Heath
    Theme       : Rolling open grassland dotted with shepherd huts. Bandits prey on
                  travelers; wild boars root through abandoned fields.
    Zone Level  : 1–5
    Char Req    : 1
    Enemy Theme : Bandits, Wild Boars, Dire Wolves
    Mechanic    : Open terrain — Flee success chance +15%.

7.  The Dusty Mine
    Theme       : An abandoned silver mine. Cave-ins sealed the worst creatures inside
                  years ago. Someone recently broke the seal.
    Zone Level  : 5–10
    Char Req    : 2
    Enemy Theme : Cave Bats, Giant Beetles, Kobolds
    Mechanic    : None

---

## Tier 2 — The Wilds (Zone Level 11–25, Char Level 5–12)

The land beyond settled roads. Forests grow darker; swamps grow deeper.
Enemies are more organized. Gear quality begins to matter.

---

8.  Darkwood Forest
    Theme       : A dense, lightless forest where the canopy blocks out the sun entirely.
                  Bandits and werewolves own these woods. Travelers disappear here.
    Zone Level  : 11–18
    Char Req    : 5
    Enemy Theme : Forest Bandits, Werewolves, Dryad Shades
    Mechanic    : None

9.  The Marshlands
    Theme       : Vast flooded wetlands stretching to the horizon. The ground shifts
                  underfoot. Bog trolls guard their territory aggressively.
    Zone Level  : 14–22
    Char Req    : 7
    Enemy Theme : Bog Trolls, Giant Leeches, Marsh Hags
    Mechanic    : Quicksand trap — 15% chance per combat that the player's AGI is treated
                  as 10 lower for flee and dodge calculations this fight.

10. Seaside Cliffs
    Theme       : High coastal cliffs with sea-cave networks below. Accessible at low tide.
                  Harpies nest in the clifftop rocks. Smugglers work the caves below.
    Zone Level  : 11–17
    Char Req    : 5
    Enemy Theme : Harpies, Smugglers, Sea Serpent Hatchlings
    Mechanic    : None

11. Hillside Ruins
    Theme       : Crumbled stone walls of a forgotten frontier settlement. Treasure hunters
                  and restless dead compete for what remains.
    Zone Level  : 15–25
    Char Req    : 7
    Enemy Theme : Skeletons, Grave Robbers, Cursed Statues
    Mechanic    : Hidden cache — 15% chance per floor for a buried loot stash (bonus item,
                  no combat required).

12. The Haunted Mill
    Theme       : A watermill that stopped turning a century ago. Something wails inside
                  at night. Poltergeists rattle its broken gears.
    Zone Level  : 12–20
    Char Req    : 6
    Enemy Theme : Ghosts, Poltergeists, Skeleton Workers
    Mechanic    : None

13. Bandit's Crossing
    Theme       : A mountain road ambush point, fortified with barricades and rope bridges.
                  Brigands control every approach. The toll is your life.
    Zone Level  : 13–22
    Char Req    : 6
    Enemy Theme : Bandits, Brigand Captains, Hired Thugs
    Mechanic    : Reinforcements — Bandit enemies have a 10% chance per turn to call one ally.

14. The Rat Warrens
    Theme       : A labyrinth of tunnels beneath an old trade city, long since overrun by
                  giant rats and the plague-things that follow them.
    Zone Level  : 17–25
    Char Req    : 8
    Enemy Theme : Giant Rats, Rat Swarms, Plagued Rats
    Mechanic    : None

---

## Tier 3 — The Depths (Zone Level 26–50, Char Level 13–25)

First real challenge. Dungeons, cursed villages, ancient temples.
Enemies use debuffs. Gear begins to define builds.

---

15. Thornwood Forest
    Theme       : A cursed forest where thorned vines reach for travelers and dark fey
                  play cruel tricks. The trees bleed black sap at night.
    Zone Level  : 26–38
    Char Req    : 13
    Enemy Theme : Dark Fey, Thorn Sprites, Cursed Treants
    Mechanic    : None

16. The Sunken Temple
    Theme       : A half-submerged ancient temple sinking into a flooded valley. Rising
                  water threatens between floors; treasure lies beyond the waterline.
    Zone Level  : 30–45
    Char Req    : 15
    Enemy Theme : Temple Guardians, Undead Priests, Water Elementals
    Mechanic    : Rising water — Every 5 floors, all combatants take 5 true damage.

17. Stoneridge Pass
    Theme       : A high mountain pass carved through granite peaks. Mountain ogres defend
                  their territory. The wind howls between the narrow walls.
    Zone Level  : 26–35
    Char Req    : 13
    Enemy Theme : Mountain Ogres, Stone Golems, Snow Eagles
    Mechanic    : None

18. The Boglands
    Theme       : Dense, fog-thick marshes that confuse travelers. Swamp witches use the
                  mist to mask their approach. Nothing is where it appears to be.
    Zone Level  : 32–48
    Char Req    : 16
    Enemy Theme : Bog Wraiths, Giant Toads, Swamp Witches
    Mechanic    : Fog — Enemy HP and stat values are hidden until the enemy attacks.

19. Cursed Village
    Theme       : A village that fell to dark magic two generations ago. The villagers
                  remain as hollow shells. Livestock wanders undirected. Smoke rises from
                  no fire.
    Zone Level  : 28–42
    Char Req    : 14
    Enemy Theme : Zombies, Cursed Villagers, Village Warlocks
    Mechanic    : None

20. The Old Dungeon
    Theme       : A classic stone dungeon full of iron doors, trapped corridors, and
                  monsters that have had years to settle comfortably into their rooms.
    Zone Level  : 38–50
    Char Req    : 19
    Enemy Theme : Dungeon Crawlers, Mimics, Dungeon Wardens
    Mechanic    : Trap-heavy — Trap room frequency is 2× the base rate.

21. Sandblown Wastes
    Theme       : A vast desert of sun-scorched sand and bleached bones. Desert nomads
                  and sand beasts wander the dunes. Ancient tombs lie half-buried.
    Zone Level  : 30–50
    Char Req    : 15
    Enemy Theme : Desert Bandits, Sand Scorpions, Mummies
    Mechanic    : None

---

## Tier 4 — The Contested Lands (Zone Level 51–80, Char Level 25–40)

Mid-game. Organized factions, harder combat, environments that actively threaten the player.
Build choices begin to matter significantly.

---

22. The Whispering Jungle
    Theme       : A dense tropical jungle where every shadow hides a predator. Ancient
                  ruins dot the canopy floor. The trees whisper in a language no one speaks.
    Zone Level  : 51–65
    Char Req    : 25
    Enemy Theme : Jungle Stalkers, Giant Serpents, Lizardmen
    Mechanic    : Predator — Each enemy has a 20% chance to act first regardless of AGI.

23. Stonegate Keep
    Theme       : A fortified keep that changed hands a dozen times. Orcs hold it now.
                  They've replaced every banner with skulls and every floor with straw.
    Zone Level  : 55–72
    Char Req    : 27
    Enemy Theme : Orcs, Orc Warlords, Ogre Guards
    Mechanic    : None

24. Icemaw Caverns
    Theme       : A glacial cave system carved by ancient water and sealed by colder winters.
                  Ice spirits drift through the tunnels. Frost wolves lope in packs.
    Zone Level  : 58–75
    Char Req    : 29
    Enemy Theme : Frost Wolves, Ice Elementals, Glacier Trolls
    Mechanic    : Bitter cold — Flee success chance reduced by 15%.

25. Ember Ridge
    Theme       : A volcanic ridge where the earth cracks and lava seeps through fissures.
                  Fire creatures nest in the vents. The air smells of sulfur and scorched rock.
    Zone Level  : 60–80
    Char Req    : 30
    Enemy Theme : Lava Imps, Fire Drakes, Magma Golems
    Mechanic    : None

26. The Undying Crypts
    Theme       : Catacombs beneath an old kingdom. The dead were laid to rest here, given
                  proper rites — they simply refused to stay down.
    Zone Level  : 52–68
    Char Req    : 26
    Enemy Theme : Skeletons, Wraiths, Undead Knights
    Mechanic    : Undying — Basic enemies resurrect once with 25% HP after being killed.

27. Orc Warcamp
    Theme       : An active orcish warcamp. Rough-built fortifications, war drums at all
                  hours, and soldiers that follow orders — unusual for orcs.
    Zone Level  : 56–75
    Char Req    : 28
    Enemy Theme : Orc Warriors, Orc Shamans, War Trolls
    Mechanic    : None

28. The Screaming Desert
    Theme       : An endless desert where the wind screams through rock formations. Ancient
                  ruins hide below the sand. Dust wraiths ride the storms.
    Zone Level  : 65–80
    Char Req    : 32
    Enemy Theme : Dust Wraiths, Scorpion Lords, Sand Elementals
    Mechanic    : Sandstorm — 20% chance each combat that visibility drops; both sides have
                  −15% hit chance for that fight.

---

## Tier 5 — The Forgotten Lands (Zone Level 81–120, Char Level 40–60)

Serious challenge. Ancient ruins of great civilizations. Creatures of real power.
The companion's reactions grow more personal.

---

29. The Ancient Colosseum
    Theme       : A ruined gladiatorial arena choked with weeds and old blood. The crowd
                  is long gone but the challengers never stopped coming.
    Zone Level  : 81–100
    Char Req    : 40
    Enemy Theme : Gladiator Shades, Champion Undead, Arena Beasts
    Mechanic    : None

30. Wraithwood
    Theme       : A forest where life has been leached away over centuries. The trees are
                  silver-grey and leafless. The wraiths here are old. Patient.
    Zone Level  : 85–108
    Char Req    : 42
    Enemy Theme : Wraiths, Banshees, Soul Hunters
    Mechanic    : Ethereal enemies — Physical damage reduced by 20% (STR-based). INT-based
                  damage is unaffected.

31. Deepstone Mines
    Theme       : Miles-deep mining tunnels cut through solid rock by a lost dwarven clan.
                  Whatever they found down here, it drove them mad. Then it drove them
                  into the walls.
    Zone Level  : 88–115
    Char Req    : 44
    Enemy Theme : Stone Golems, Deep Dwarves, Rock Horrors
    Mechanic    : None

32. The Sunken Citadel
    Theme       : An ancient fortress slowly sinking into a swamp. The defenders swore an
                  oath never to surrender. They never died either. They kept the oath.
    Zone Level  : 92–120
    Char Req    : 46
    Enemy Theme : Armored Undead, Drowned Knights, Siege Wraiths
    Mechanic    : None

33. Dragon's Approach
    Theme       : The barren foothills leading to a dragon's mountain stronghold. Even
                  the dragon's servants are a genuine threat. The mountain watches you.
    Zone Level  : 96–120
    Char Req    : 48
    Enemy Theme : Wyverns, Dragon Cultists, Young Dragons
    Mechanic    : Dragon's shadow — During boss combat, a 20% per turn chance of the
                  dragon adding one bonus attack to the boss's turn.

34. The Shattered Peaks
    Theme       : A mountain range shattered by an ancient magical war. The peaks float
                  at odd angles. Ruins cling to them. The wind carries old voices.
    Zone Level  : 82–105
    Char Req    : 41
    Enemy Theme : Stone Giants, Runic Golems, Wind Elementals
    Mechanic    : None

35. Verdant Labyrinth
    Theme       : A jungle so dense it became a living maze. Lizardmen tribes guard its
                  center. No traveler has mapped the same path twice.
    Zone Level  : 100–120
    Char Req    : 50
    Enemy Theme : Lizardmen, Serpent Priests, Jungle Hydras
    Mechanic    : Labyrinth — Boss room position is randomized each run.

---

## Tier 6 — The Elemental Reaches (Zone Level 121–160, Char Level 60–80)

Elemental-themed zones. The environment itself is dangerous.
DEF and VIT builds become critical. One wrong choice is very costly.

---

36. The Lava Fields
    Theme       : A vast plateau of cooling lava and erupting vents. Fire elementals
                  claim this land as sacred ground. They do not welcome visitors.
    Zone Level  : 121–138
    Char Req    : 60
    Enemy Theme : Fire Giants, Lava Elementals, Flame Drakes
    Mechanic    : Scorching ground — All combatants take 3 true damage per turn.

37. Frostbitten Tundra
    Theme       : A frozen wasteland at the top of the world. Frost giants patrol. The
                  cold kills what the giants don't bother with.
    Zone Level  : 124–145
    Char Req    : 62
    Enemy Theme : Frost Giants, Ice Wraiths, Tundra Wolves
    Mechanic    : None

38. The Wyrm's Lair
    Theme       : A deep cave carved out by a massive dragon over centuries of residence.
                  The dragon is still there. So are all its children.
    Zone Level  : 135–158
    Char Req    : 67
    Enemy Theme : Cave Wyrms, Dragon Cultists, Treasure Golems
    Mechanic    : None

39. Sea Witch's Grotto
    Theme       : A network of sea caves accessible only at low tide. The Sea Witch and
                  her bound spirits reside deep inside, surrounded by the drowned.
    Zone Level  : 122–140
    Char Req    : 61
    Enemy Theme : Sea Spirits, Bound Merfolk, Coral Constructs
    Mechanic    : Tidal hazard — Every 5 floors, the tide rises; all combatants take 8
                  true damage.

40. The Black Marshes
    Theme       : A cursed swamp where death magic runs like sap through the roots.
                  Nothing here dies cleanly. Everything festers and rises.
    Zone Level  : 130–150
    Char Req    : 65
    Enemy Theme : Lich Servants, Plague Zombies, Death Elementals
    Mechanic    : Undying — Enemies resurrect once with 25% HP after being killed.

41. Twilight Castle
    Theme       : A vampire lord's castle perched on a cliff above a dying village.
                  The battlements are always in shadow. The invitation is always open.
    Zone Level  : 138–160
    Char Req    : 69
    Enemy Theme : Vampires, Vampire Thralls, Death Knights
    Mechanic    : None

42. The Giant's Stairway
    Theme       : A mountain path made by giants in an age when they outnumbered men.
                  Each step is the height of a man. Stone giants still patrol it.
    Zone Level  : 128–155
    Char Req    : 64
    Enemy Theme : Stone Giants, Ettins, Giant Shamans
    Mechanic    : None

---

## Tier 7 — The Ancient Domains (Zone Level 161–200, Char Level 80–100)

Very hard. These zones contain the oldest evils in the world.
The companion's emotional reactions peak. Some zones are personal.

---

43. The Abyssal Depths
    Theme       : A subterranean realm so deep it has its own ecosystem and its own sun
                  — a pocket of bioluminescence. Ancient horrors evolved here in isolation.
    Zone Level  : 161–180
    Char Req    : 80
    Enemy Theme : Deep Horrors, Abyssal Crawlers, Eye Tyrants
    Mechanic    : Darkness — Enemy HP and stats cannot be seen until the enemy is hit.

44. Volcanic Caldera
    Theme       : The active crater of a massive volcano. Heat distorts the air. Lava
                  flows freely. The efreet consider this their home and you a trespasser.
    Zone Level  : 165–185
    Char Req    : 82
    Enemy Theme : Efreet, Magma Titans, Volcanic Wyrms
    Mechanic    : None

45. The Moonlit Wastes
    Theme       : A desert that transforms under the full moon. Lycanthropes and
                  moon-touched creatures rule the night. The dunes shift by moonrise.
    Zone Level  : 162–178
    Char Req    : 81
    Enemy Theme : Werewolves, Moon Spirits, Cursed Wanderers
    Mechanic    : Full moon rage — Lycanthrope enemies deal +30% damage.

46. Storm Giant's Keep
    Theme       : A fortress built into a storm cloud. Lightning strikes at random.
                  The giants that live here are too large to notice the thunder.
    Zone Level  : 170–192
    Char Req    : 85
    Enemy Theme : Storm Giants, Thunder Hawks, Lightning Elementals
    Mechanic    : Lightning — Each turn, 15% chance of a lightning bolt dealing 20 true
                  damage to a random combatant (player or enemy).

47. The Forbidden Sanctum
    Theme       : An ancient wizard's sanctum sealed for good reason. The seal broke.
                  Something got out. Something else got in. The two are now at war.
    Zone Level  : 175–200
    Char Req    : 87
    Enemy Theme : Arcane Constructs, Spell Shades, Bound Demons
    Mechanic    : None

48. Necropolis of the Ancients
    Theme       : A vast undead city ruled by an ancient lich. A kingdom that never
                  stopped functioning — it just changed its relationship with death.
    Zone Level  : 168–195
    Char Req    : 84
    Enemy Theme : Ancient Undead, Lich Nobles, Death Paladins
    Mechanic    : None

49. The Feywild Crossing [COMPANION-ZONE]
    Theme       : A shimmering gateway to the realm of the fey. The companion feels
                  a pull here — something resonates with their soul. The fey notice.
    Zone Level  : 163–183
    Char Req    : 81
    Enemy Theme : Dark Fey, Fey Hunters, Corrupted Sprites
    Mechanic    : Fey glamour — Enemies appear as a different type until first attacked.

---

## Tier 8 — The Shattered Kingdoms (Zone Level 201–250, Char Level 100–125)

Prestige-adjacent difficulty. Fallen civilizations and post-apocalyptic fantasy realms.
Only players who have mastered gear and builds can survive comfortably here.

---

50. The Bone Throne
    Theme       : A kingdom built entirely of bones and ruled by a god-lich. The throne
                  room spans what was once a city. The lich has had centuries to decorate.
    Zone Level  : 201–220
    Char Req    : 100
    Enemy Theme : God-Lich Servants, Bone Constructs, Elite Undead
    Mechanic    : None

51. Ashfall Wastes
    Theme       : A landscape buried under volcanic ash from an eruption a century ago.
                  Something still burns beneath the grey. It is not fire.
    Zone Level  : 205–228
    Char Req    : 102
    Enemy Theme : Ash Wraiths, Buried Golems, Flame Remnants
    Mechanic    : Ashfall — All combatants take 2 true damage per turn from falling ash.

52. The Eternal Forest
    Theme       : A forest untouched by time — ancient, massive, older than the kingdom
                  that claimed to own it. Something patient has corrupted its heart.
    Zone Level  : 210–235
    Char Req    : 105
    Enemy Theme : Ancient Treants, Corrupted Dryads, Forest Leviathans
    Mechanic    : None

53. Sea of Storms
    Theme       : A coastal zone battered by endless magical storms. Ships wreck here daily.
                  Their crews don't stay dead. The wrecks don't stay on the bottom.
    Zone Level  : 202–222
    Char Req    : 101
    Enemy Theme : Storm Wraiths, Shipwreck Undead, Sea Serpents
    Mechanic    : Stormy conditions — Both sides have −20% hit chance (wind interference).

54. The Iron Fortress
    Theme       : A fortress built to last until the end of the world. It likely will.
                  The defenders have gone mad from the wait. They are still extremely
                  competent.
    Zone Level  : 218–245
    Char Req    : 109
    Enemy Theme : Iron Golems, Mad Paladins, Siege Constructs
    Mechanic    : None

55. Drakenspire Summit
    Theme       : The peak of the world's tallest mountain. An elder dragon rests here.
                  The dragon tolerates nothing on the summit. Its children enforce this.
    Zone Level  : 225–250
    Char Req    : 112
    Enemy Theme : Elder Drakes, Dragon Kin, Ancient Dragon Cultists
    Mechanic    : Dragon's domain — The floor boss is always an Elder Dragon variant
                  with enhanced base stats.

56. The Sunless Sea
    Theme       : An underground ocean beneath the roots of the mountains. No light
                  has reached it since the mountains rose. Ancient things swim in the dark.
    Zone Level  : 212–240
    Char Req    : 106
    Enemy Theme : Deep Sea Horrors, Abyssal Merfolk, Kraken Spawn
    Mechanic    : None

---

## Tier 9 — The Edge of the World (Zone Level 251–320, Char Level 125–160)

Near-endgame. Legendary difficulty. The world begins to break down at its edges.
Reaching here requires multiple prestiges or extraordinary dedication.

---

57. The Void Cathedral
    Theme       : A cathedral built by a death cult to honor something that should not
                  exist. The building still prays on its own. The congregation answers.
    Zone Level  : 251–275
    Char Req    : 125
    Enemy Theme : Void Cultists, Void Elementals, Void-Touched Paladins
    Mechanic    : None

58. Frostfire Tundra
    Theme       : A wasteland where arctic cold and volcanic fire meet in constant war.
                  The creatures here have adapted to live in both extremes simultaneously.
    Zone Level  : 258–285
    Char Req    : 129
    Enemy Theme : Frostfire Elementals, Dualborn Giants, Chaos Beasts
    Mechanic    : Elemental conflict — All combatants take 5 true damage per turn.

59. The World Serpent's Pass
    Theme       : A mountain path that winds around the coils of a sleeping serpent the
                  size of a mountain range. Cultists worship it. Do not wake it.
    Zone Level  : 265–295
    Char Req    : 132
    Enemy Theme : Serpent Cultists, Scale Beasts, Venom Hydras
    Mechanic    : None

60. Ruins of the First Kingdom
    Theme       : The remains of the first human civilization. Magic here is raw and
                  original — the rules of enchantment were still being written when
                  this place stood.
    Zone Level  : 270–305
    Char Req    : 135
    Enemy Theme : Ancient Constructs, First Mages (undead), Primordial Beasts
    Mechanic    : Unstable magic — 20% chance each combat for a random effect to trigger
                  on either combatant (positive or negative with equal weight).

61. The Bleeding Jungle
    Theme       : A jungle where the flora is predatory and blood-red. Even the trees
                  hunt. The soil is saturated with something that was never water.
    Zone Level  : 260–290
    Char Req    : 130
    Enemy Theme : Carnivorous Treants, Vine Horrors, Jungle Fiends
    Mechanic    : None

62. Godstone Peaks
    Theme       : Mountains where the gods stood when they walked the earth. Their
                  footprints are still there, miles wide. Their power did not leave
                  when they did.
    Zone Level  : 282–320
    Char Req    : 141
    Enemy Theme : Divine Constructs, God-Touched Beasts, Fallen Angels
    Mechanic    : Divine ground — True damage from enemies cannot be reduced by any means.

63. The Wailing Crypts [COMPANION-ZONE]
    Theme       : An ancient burial complex built before the current age. Something here
                  knows the companion's name. It has been waiting a very long time.
    Zone Level  : 255–280
    Char Req    : 127
    Enemy Theme : Ancient Shades, Memory Constructs, Identity Wraiths
    Mechanic    : None

---

## Tier 10 — The Final Frontier (Zone Level 321–400, Char Level 160–200)

Post-endgame. For prestige players. Extreme difficulty; extraordinary rewards.
The world's ultimate threats reside here. Few reach this far.

---

64. The Dragon Emperor's Throne
    Theme       : A realm governed by the Dragon Emperor — the largest, oldest, most
                  powerful dragon in the world. His word is geological law.
                  His fire unmakes mountains. His patience is eternal.
    Zone Level  : 321–350
    Char Req    : 160
    Enemy Theme : Dragon Emperor's Guard, Elder Dragons, Dragon Demigods
    Mechanic    : None

65. The Demon Lord's Citadel
    Theme       : The physical fortress of a demon lord made manifest. It is hell made
                  into architecture. The walls are alive and hostile.
    Zone Level  : 330–360
    Char Req    : 165
    Enemy Theme : Demon Lords, Arch-Fiends, Demon Warlords
    Mechanic    : Hellfire — All non-demon combatants take 8 true damage per turn
                  (the air itself is hostile to mortal life).

66. The Ancient God's Rest
    Theme       : Where one of the old gods sleeps but cannot wake. The ambient power
                  from its dreaming is still enough to kill most things that breathe.
    Zone Level  : 340–375
    Char Req    : 170
    Enemy Theme : Divine Remnants, Sleeping God's Avatars, Faith Constructs
    Mechanic    : None

67. The Shattered Realm
    Theme       : A dimension torn apart by a war between two gods. Physics here is a
                  suggestion. Reality is still bleeding from the wounds.
    Zone Level  : 345–380
    Char Req    : 172
    Enemy Theme : Realm Shards, Fractured Titans, Reality Wardens
    Mechanic    : Broken physics — Once per combat, ATK and DEF values swap between
                  player and enemy for 3 turns.

68. The Final Dungeon
    Theme       : The dungeon that awaits at the end of every hero's story. It has
                  been here longer than the kingdom above it. It knows this player
                  was coming. It has prepared accordingly.
    Zone Level  : 360–395
    Char Req    : 180
    Enemy Theme : Final Guardians, Legendary Undead, Chosen Enemies
    Mechanic    : None

69. The World's Edge
    Theme       : The physical end of the known world — a cliff that drops into open
                  void. The things that live here have never seen anything but the edge.
                  They are very good at pushing things off it.
    Zone Level  : 370–400
    Char Req    : 185
    Enemy Theme : Void Leviathans, Edge Walkers, World-Shards
    Mechanic    : Void exposure — All combatants take 10 true damage per turn.

70. The Undying King's Domain
    Theme       : An undead monarch's realm spanning every afterlife. He rules all death
                  by right of conquest. His armies are, by definition, infinite.
    Zone Level  : 325–355
    Char Req    : 162
    Enemy Theme : Undying King's Champions, Reaper Guards, Soul Wardens
    Mechanic    : None

---

## Special Zones (Non-Tiered, Unlockable)

These zones exist outside the main tier progression.
They unlock through achievements, story events, or specific conditions.

---

### Challenge Zones

C1. The Gauntlet
    Theme       : All enemies are Elite tier. No loot mid-run; massive payout on clear.
    Unlock      : Reach character level 50.
    Mechanic    : All enemies use Elite stat budget. Boss uses God-Tier budget.

C2. The Proving Grounds
    Theme       : Enter with no gear equipped. No gear drops inside. Stats only.
    Unlock      : Collect one full gear set.
    Mechanic    : Gear is unequipped on entry. No loot drops of any kind.

C3. One Hit Wonder
    Theme       : Player and enemy both have 1 HP. One attack, winner takes all.
    Unlock      : Survive a fight at 1 HP.
    Mechanic    : Both combatants start at 1 HP. First hit wins.

C4. The Attrition Run
    Theme       : No healing at all. 25 floors. Manage your HP to the end.
    Unlock      : Complete 10 full zone runs.
    Mechanic    : No rest rooms, no healing items, no regen effects.

C5. The Arena
    Theme       : Survival waves. 50 waves of increasing difficulty. See how far you get.
    Unlock      : Win 100 combats.
    Mechanic    : Wave-based. Gold and XP rewards scale by wave reached.

---

### Merchant Zones

M1. The Wandering Bazaar
    Theme       : A travelling merchant camp. Rest, buy, sell. No combat. Prices 20%
                  lower than in-run merchants. Restocks every run.
    Unlock      : Always available.
    Mechanic    : No enemies. Merchant stock is 2 tiers above current zone.

---

### Companion Questline Zones [COMPANION-ZONE]

Only available if the active character pack includes questline.json.
These zones replace a standard zone of the same tier when flagged in questline.json.
Flavor text and dialogue are generated from questline.json at runtime.
Combat mechanics are static — only the narrative changes.

Q1. Chapter 1 — Sunhaven Meadows
    Theme       : The place where the companion's story begins. Bright and open now.
                  The companion knows something here. It shows in how she speaks.
    Zone Level  : 5–12  (replaces a T2 zone)
    Char Req    : 5
    Enemy Theme : Bandits, Corrupted Scouts, A Familiar Face (boss variant)

Q2. Chapter 2 — The Broken Road
    Theme       : A road that leads somewhere the companion does not want to go.
                  She won't explain why yet. The enemies know who she is.
    Zone Level  : 55–68  (replaces a T4 zone)
    Char Req    : 27
    Enemy Theme : Pursuers, Oath-Breakers, Memory Shades

Q3. Chapter 3 — Starfall Crater
    Theme       : Where something fell from the sky the night the companion was born.
                  The crater is still warm. The revelation zone.
    Zone Level  : 115–128  (replaces a T5/T6 zone)
    Char Req    : 57
    Enemy Theme : Celestial Remnants, Bound Guardians, A Truth Made Manifest (boss)

Q4. Chapter 4 — The Last Light
    Theme       : The place where the companion's story reaches its breaking point.
                  One of you will be changed after this.
    Zone Level  : 200–218  (replaces a T8 zone)
    Char Req    : 100
    Enemy Theme : Corrupted Companions (reflections), The Weight of Choices (boss)

Q5. Chapter 5 — The Promise Fulfilled
    Theme       : The conclusion. The companion knows what this place is.
                  So does the enemy. So, after this, will the player.
    Zone Level  : 295–320  (replaces a T9 zone)
    Char Req    : 147
    Enemy Theme : The Final Obstacle, Memory of the Beginning, The Answer (boss)

---

## Zone Suggestion System

When the player asks "Where should we explore?" or similar:

1. Query all zones accessible at the player's current character level.
2. Pass zone metadata (name, theme, level range, mechanic) to Claude.
3. Claude responds in character — the companion gives a suggestion.
4. Player accepts or declines; companion reacts to the choice.
5. Uses scenario keys: `zone_suggestion`, `zone_suggestion_accepted`, `zone_suggestion_declined`.

Companion personality shapes suggestions:
- Curious companion: suggests ruins, temples, story zones
- Battle-hungry companion: suggests challenge zones, high-difficulty tiers
- Cautious companion: suggests zones at or just below current level
- Greedy companion: suggests zones with high gold rewards or treasure mechanics

---

*See docs/rpg/CLAUDE.md for theme rules and locked decisions.*
*See docs/rpg/UNIQUE_ZONE_MECHANICS.md for formal mechanic definitions (created Phase 0.2).*
*See docs/rpg/GAMEPLAN.md for implementation phases.*
