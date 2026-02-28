# RPG Adventure — Enemy Database

Last updated: 2026-02-27
Status: Phase 0 — Design Complete

Classic fantasy enemies organized by archetype.
~60 named enemy types covering all Enemy Theme pools referenced in ZONES.md.

---

## Difficulty Bracket System

Every enemy belongs to a difficulty bracket. The bracket determines their STAT BUDGET —
total points distributed across HP, ATK, DEF, AGI, and SPECIAL.
Stat budget scales with zone level on top of bracket baseline. See SCALING.md.

| Bracket   | Zone Tier | Base Stat Budget | XP Mult | Gold Mult |
|-----------|-----------|------------------|---------|-----------|
| Minion    | T1        | 25               | 1×      | 1×        |
| Scout     | T2        | 50               | 1.5×    | 1.2×      |
| Soldier   | T3        | 90               | 2×      | 1.5×      |
| Elite     | T4–T5     | 150              | 3×      | 2×        |
| Champion  | T5–T6     | 250              | 5×      | 3×        |
| Legend    | T6–T8     | 400              | 8×      | 5×        |
| Apex      | T8–T9     | 650              | 12×     | 8×        |
| God-Tier  | T9–T10    | 1000             | 20×     | 15×       |
| Boss      | Any tier  | 3× bracket base  | 15×     | 10×       |

---

## Stat Distribution Archetypes

Each enemy has a stat distribution pattern that shapes its combat personality.
Budget is split across: HP, ATK, DEF, AGI, and SPECIAL (special ability power).

| Archetype    | HP%  | ATK% | DEF% | AGI% | SPECIAL% |
|--------------|------|------|------|------|----------|
| Tank         | 45   | 15   | 30   | 5    | 5        |
| Glass Cannon | 15   | 55   | 5    | 20   | 5        |
| Balanced     | 25   | 25   | 20   | 20   | 10       |
| Assassin     | 15   | 40   | 5    | 35   | 5        |
| Support      | 35   | 10   | 20   | 10   | 25       |
| Summoner     | 20   | 15   | 15   | 15   | 35       |
| Berserker    | 20   | 45   | 5    | 25   | 5        |
| Fortress     | 50   | 10   | 35   | 0    | 5        |
| Trickster    | 10   | 20   | 10   | 45   | 15       |
| Caster       | 20   | 35   | 10   | 10   | 25       |

---

## SPECIAL Budget → Ability Slots

The SPECIAL% budget controls how many ability slots an enemy has.

| SPECIAL Budget | Ability Slots                          |
|----------------|----------------------------------------|
| 0.05 (5%)      | 1 slot — minor passive only            |
| 0.15 (15%)     | 2 slots — mini-elite behavior          |
| 0.25 (25%)     | 3 slots — Summoner core ability        |

Abilities from the Boss Ability List may be assigned to non-boss enemies at reduced power.
Non-boss enemies never use Execute or Final Transformation.

---

## Shiny Variant Rules

Any non-boss enemy can spawn as a Shiny variant (see SCALING.md for spawn rate).

- **Appearance**: Distinctive golden shimmer border on the enemy card in the UI
- **HP**: ×2.5 base
- **ATK**: ×2.0 base
- **DEF**: ×1.5 base
- **XP**: ×5 base
- **Gold**: ×3 base
- **Loot**: Guaranteed Rare+ drop
- **Companion**: Triggers `shiny_enemy_appear` scenario key response
- **Name prefix**: "✦ " prepended to enemy name (e.g., "✦ Shiny Cave Wyrm")

---

## Universal Boss Ability Rules

These rules apply to all boss special abilities, always:

- **Trigger**: Once per fight unless the ability description says "per turn"
- **Duration**: Stat debuffs last until fight end unless "X turns" is stated
- **Stacking**: Max 2 active abilities at once; a third replaces the oldest
- **Priority**: Player survival effects resolve before boss execute effects — player survives at 1 HP minimum
- **Cooldown**: 3 turns after any ability fires before it can fire again
- **Enrage**: Triggers once at HP threshold; does not re-trigger if HP rises above threshold

---

## Boss Special Abilities

Bosses always have 1–2 special abilities assigned from this list based on zone theme.

1.  **Enrage** — At 50% HP, ATK permanently doubles for the rest of the fight.
2.  **Shield of Ages** — At 75% HP, immune to all damage for 2 turns.
3.  **Summon Minions** — Calls 2 minion-bracket enemies at fight start. Does not repeat.
4.  **Regeneration** — Restores 5% max HP per turn until slain.
5.  **Curse of Weakness** — Reduces player's ATK by 30% for 5 turns on trigger.
6.  **Arcane Veil** — Every 3 turns, alternates between immunity to physical and magical damage.
7.  **Cleave** — Once per fight, attacks with true damage (ignores all DEF).
8.  **Life Drain** — Each attack steals 10% of player's current HP (heals boss).
9.  **Blood Rage** — Gains +5 ATK each turn it survives (cumulative, no cap).
10. **Thorned Hide** — Returns 25% of damage dealt back to the attacker.
11. **Ancient Ward** — Player can only act every other turn for 3 turns.
12. **Divine Smite** — Every 5 turns, deals true damage equal to 20% of boss max HP.
13. **Execute** — If player HP falls below 20%, boss attempts instant kill (25% chance). Player survives at 1 HP minimum.
14. **Petrify** — After hitting the same target 3 consecutive turns, target is stunned for 2 turns.
15. **Death Rattle** — On death, triggers one final attack using a random ability from this list.
16. **Overload** — Winds up for 1 turn, then deals 3× normal ATK damage the following turn.
17. **Ancient Resilience** — Each time the same attack type lands twice in a row, gains +10 DEF against that type.
18. **Earth Binding** — All AGI-based bonuses (dodge, flee, crit from AGI) are reduced to 0 for the fight.
19. **Soul Brand** — Permanently reduces one equipped item's bonus stats by 50% until the run ends.
20. **Final Transformation** — At 25% HP, HP fully restores but all DEF is permanently reduced to 0.

---

## Enemy Roster

Organized by fantasy archetype. Enemies appear in zones where their type is listed
as an Enemy Theme. Bracket ranges indicate where they commonly appear; zone level
scaling adjusts their actual stat values within the bracket.

---

### Humanoid / Bandit Archetype
*Appears in: T1–T4 zones. Human or near-human enemies using conventional weapons.*

1.  **Roadside Bandit**
    Archetype: Balanced | Bracket: Minion
    Description: Opportunistic highwayman. Hits hard for his tier, folds quickly.
    Special: None
    Drop: Common gear, small gold

2.  **Brigand Captain**
    Archetype: Berserker | Bracket: Scout–Soldier
    Description: The one who gives the orders. Fights with controlled anger.
    Special: Rally — On taking damage below 50% HP, gains +15 ATK for 3 turns.
    Drop: Common–Uncommon gear, moderate gold

3.  **Hired Thug**
    Archetype: Tank | Bracket: Scout
    Description: Paid muscle. Absorbs damage and grinds the player down.
    Special: None
    Drop: Common gear, small gold

4.  **Sellsword**
    Archetype: Balanced | Bracket: Soldier
    Description: Professional mercenary. Adaptive and disciplined.
    Special: Combat Veteran — Takes 15% less damage when HP is above 50%.
    Drop: Uncommon gear, good gold

5.  **Smuggler**
    Archetype: Trickster | Bracket: Scout
    Description: Fleet-footed and evasive. Would rather run than die.
    Special: Feint — 25% chance to dodge any single attack per turn.
    Drop: Common gear, coin pouch (bonus gold)

6.  **Grave Robber**
    Archetype: Trickster | Bracket: Scout
    Description: Disrespectful and well-armed. Knows which tombs to avoid.
    Special: Filch — If they flee successfully, takes 10% of player's current gold.
    Drop: Common–Uncommon gear, old trinket

7.  **Dungeon Warden**
    Archetype: Fortress | Bracket: Soldier–Elite
    Description: Career guard who never left. The dungeon is all he knows.
    Special: Fortified Post — First 2 attacks deal 0 damage (heavy fortification).
    Drop: Uncommon–Rare armor

---

### Goblinoid Archetype
*Appears in: T1–T3 zones. Small, numerous, and nastier than they look.*

8.  **Goblin Scrapper**
    Archetype: Glass Cannon | Bracket: Minion
    Description: Frantic and dangerous. Hits hard for something so small.
    Special: Frenzied Strike — First attack deals double damage (reckless opener).
    Drop: Common gear, small gold

9.  **Goblin Shaman**
    Archetype: Caster | Bracket: Scout–Soldier
    Description: Tribal magic user. Applies curses and buffs its allies.
    Special: Hex — Applies one of: −15% player ATK, −15% player DEF, or −10% player AGI for 3 turns.
    Drop: Common–Uncommon gear, shaman trinket

10. **Goblin Chieftain**
    Archetype: Berserker | Bracket: Soldier
    Description: Largest and meanest goblin in the warren. Wears rival skulls.
    Special: War Cry — At fight start, all Goblin allies gain +10 ATK for 3 turns.
    Drop: Uncommon gear, chieftain's token (trinket)

11. **Kobold Pack Runner**
    Archetype: Balanced | Bracket: Minion
    Description: Rarely alone. Loses morale when outnumbered.
    Special: Pack Tactics — Each living Kobold ally grants +5 ATK to all Kobolds in the fight.
    Drop: Common gear, small gold

12. **Bog Imp**
    Archetype: Trickster | Bracket: Scout
    Description: Swamp-dwelling trickster. Inflicts poison and vanishes into the marsh.
    Special: Mire — On hit, applies Slow: player Flee chance −20% for 2 turns.
    Drop: Common gear, swamp component

---

### Beast Archetype
*Appears in: T1–T4 zones. Natural predators and animals, mundane and giant.*

13. **Timber Wolf**
    Archetype: Assassin | Bracket: Minion–Scout
    Description: Hunts in silence. Faster than it looks.
    Special: Pounce — First attack ignores DEF entirely.
    Drop: Common gear, wolf pelt (trinket material)

14. **Dire Wolf**
    Archetype: Berserker | Bracket: Scout
    Description: Twice the size of a normal wolf and twice as angry.
    Special: Pack Hunger — Gains +10 ATK when any ally has been killed this fight.
    Drop: Common–Uncommon gear, dire fang (trinket)

15. **Giant Rat**
    Archetype: Glass Cannon | Bracket: Minion
    Description: Diseased, fast, and expendable. The swarms are the real threat.
    Special: Disease Bite — 20% chance on hit to apply Poison (5 true damage per turn for 3 turns).
    Drop: Common gear, rat tail

16. **Wild Boar**
    Archetype: Berserker | Bracket: Scout
    Description: Thick-skulled and short-tempered. Charges first, thinks never.
    Special: Charge — First attack deals 2× damage (cannot be dodged).
    Drop: Common gear, boar tusk (trinket)

17. **Giant Spider**
    Archetype: Caster | Bracket: Scout
    Description: Web-spinner and ambush predator. Patient. Very patient.
    Special: Web — On hit, applies Entangle: player AGI halved for 2 turns.
    Drop: Common–Uncommon gear, spider silk (trinket)

18. **Giant Frog**
    Archetype: Balanced | Bracket: Scout
    Description: Swamp bullfrog the size of a cart horse. Tongue attack has surprising range.
    Special: Tongue Lash — Once per fight, pulls player into melee range, preventing flee for 2 turns.
    Drop: Common gear, frog leg (trinket)

19. **Giant Crab**
    Archetype: Tank | Bracket: Scout
    Description: Coastal armored beast. Claws through steel. Shell through arrows.
    Special: Shell Lock — When HP falls below 50%, retreats into shell: DEF +30 for 2 turns.
    Drop: Common–Uncommon gear, crab shell (armor material)

20. **Cave Bat Swarm**
    Archetype: Summoner | Bracket: Scout
    Description: Not one bat — hundreds of them, acting as a single entity.
    Special: Scatter — When hit, splits into two half-health swarms (once per fight).
    Drop: Common gear, guano residue

21. **Giant Beetle**
    Archetype: Fortress | Bracket: Scout
    Description: Chitinous shell harder than iron. Slow and relentless.
    Special: Carapace — Takes half damage from the first 3 attacks of any fight.
    Drop: Common–Uncommon gear, beetle carapace (trinket)

22. **Giant Serpent**
    Archetype: Berserker | Bracket: Soldier
    Description: Jungle constrictor the length of a longship. Constriction kills slowly.
    Special: Constrict — On hit, applies Squeeze: player takes 8 true damage at the start of each turn for 3 turns.
    Drop: Uncommon gear, serpent scale (trinket)

---

### Undead Archetype
*Appears in: T2–T8 zones. Dead things that refuse to stay that way.*

23. **Skeleton Warrior**
    Archetype: Balanced | Bracket: Scout
    Description: Animated bones in battered armor. No pain, no fear.
    Special: None
    Drop: Common gear, bone shard

24. **Skeleton Knight**
    Archetype: Fortress | Bracket: Soldier
    Description: Heavy plate, rusted sword, hollow eyes. Died defending something.
    Special: Unyielding — Cannot be reduced below 1 HP until at least 3 turns have passed.
    Drop: Uncommon armor, old helm

25. **Zombie**
    Archetype: Tank | Bracket: Minion–Scout
    Description: Shambling remnant. Slow, tireless, and it keeps coming.
    Special: Relentless — Resurrects once with 25% HP (if not killed with fire or holy damage).
    Drop: Common gear, rotten trinket

26. **Plague Zombie**
    Archetype: Caster | Bracket: Scout–Soldier
    Description: Bloated with disease. Getting hit by one is itself a hazard.
    Special: Plague Touch — On hit, 35% chance to apply Poison (6 true damage per turn for 4 turns).
    Drop: Common–Uncommon gear, plague sample

27. **Ghost**
    Archetype: Trickster | Bracket: Scout–Soldier
    Description: A lingering soul too angry to leave. Walls are not an obstacle.
    Special: Incorporeal — 30% chance to dodge any physical attack (cannot be reduced).
    Drop: Common–Uncommon gear, ectoplasm (trinket)

28. **Poltergeist**
    Archetype: Caster | Bracket: Scout
    Description: Invisible presence that hurls objects. No body to hit back.
    Special: Unseen — Cannot be targeted directly on the first turn; strikes first.
    Drop: Common gear, haunted object

29. **Wraith**
    Archetype: Assassin | Bracket: Soldier–Elite
    Description: Shadow and malice given shape. Drains warmth from the air.
    Special: Chill Touch — On hit, reduces player ATK by 20% for 3 turns.
    Drop: Uncommon–Rare gear, wraith essence

30. **Banshee**
    Archetype: Caster | Bracket: Elite
    Description: Death herald. The scream alone has killed.
    Special: Wail — At fight start, applies Fear to player: cannot use items for 3 turns.
    Drop: Rare gear, banshee tear (trinket)

31. **Armored Undead**
    Archetype: Balanced | Bracket: Elite
    Description: A paladin or knight who refused to die. Still fights with discipline.
    Special: Death's Resolve — At 25% HP, gains +20 ATK and +10 DEF for the remainder of the fight.
    Drop: Rare gear, tarnished holy symbol

32. **Drowned Knight**
    Archetype: Fortress | Bracket: Elite
    Description: Fortress-thick armor filled with black water. Sank ages ago. Still here.
    Special: Waterlogged — Cannot be knocked back; immune to Flee attempts while alive.
    Drop: Rare armor, drowned signet

33. **Lich Servant**
    Archetype: Caster | Bracket: Champion
    Description: A lesser undead mage in service to a lich. Still terrifyingly powerful.
    Special: Necrotic Bolt — Every 3 turns, deals 15% of player max HP as true damage.
    Drop: Epic gear, necrotic essence

34. **Lich Noble**
    Archetype: Summoner | Bracket: Legend
    Description: A dead aristocrat who mastered phylactery magic before the end.
    Special: Phylactery — On death, fully restores HP once (unless phylactery was destroyed). Phylactery destroyed by dealing 50+ damage in a single hit while below 25% HP.
    Drop: Epic–Legendary gear, phylactery shard

---

### Orc, Troll, and Giant Archetype
*Appears in: T2–T7 zones. Large, organized, and stronger than they look.*

35. **Orc Warrior**
    Archetype: Berserker | Bracket: Soldier
    Description: Front-line soldier. Fights with reckless violence and surprising discipline.
    Special: Battle Lust — Gains +8 ATK each consecutive turn it has dealt damage.
    Drop: Uncommon gear, orcish iron

36. **Orc Shaman**
    Archetype: Caster | Bracket: Soldier
    Description: Tribal spiritual leader. Buffs warriors and curses enemies.
    Special: War Totem — At fight start, all Orc allies gain +10 ATK for the full fight.
    Drop: Uncommon gear, shaman fetish (trinket)

37. **Orc Warlord**
    Archetype: Balanced | Bracket: Elite
    Description: Commander of the warcamp. Tactical, dangerous, and experienced.
    Special: Veteran's Eye — After taking 3 hits from the same attack type, gains +15 DEF against it.
    Drop: Rare gear, warlord's seal

38. **Bog Troll**
    Archetype: Tank | Bracket: Scout–Soldier
    Description: Swamp troll. Loses arms, grows them back. This takes a moment.
    Special: Regeneration — Restores 8% max HP at the start of each turn.
    Drop: Uncommon gear, troll hide

39. **Glacier Troll**
    Archetype: Fortress | Bracket: Soldier–Elite
    Description: Ice-adapted troll with hide as hard as frozen stone.
    Special: Permafrost — First 3 hits against it deal 0 damage (frozen outer layer).
    Drop: Uncommon–Rare gear, frost gland (trinket)

40. **War Troll**
    Archetype: Berserker | Bracket: Elite
    Description: Battlefield troll bred for combat. Larger, meaner, and trained.
    Special: Crushing Blow — Every 4 turns, lands a guaranteed hit dealing 2× ATK damage.
    Drop: Rare gear, war troll fang

41. **Mountain Ogre**
    Archetype: Tank | Bracket: Soldier
    Description: Enormous boulder-hurler. Dumb as stone and twice as hard.
    Special: Boulder Throw — First attack hits before AGI check (cannot be dodged).
    Drop: Uncommon gear, ogre club

42. **Stone Giant**
    Archetype: Fortress | Bracket: Champion
    Description: Living granite. Barely notices being hit. Eventually it notices.
    Special: Earthshake — Every 5 turns, stomps and stuns the player for 1 turn.
    Drop: Rare–Epic gear, giant's ring

43. **Ettin**
    Archetype: Balanced | Bracket: Champion
    Description: Two-headed giant. Each head argues about strategy but both attack.
    Special: Twin Strike — Attacks twice per turn (two separate rolls, each at 60% normal ATK).
    Drop: Rare–Epic gear

44. **Frost Giant**
    Archetype: Tank | Bracket: Champion
    Description: Arctic giant wrapped in ice and old grievances. Slow. Inexorable.
    Special: Blizzard Breath — Every 4 turns, deals 20 true damage and reduces player AGI by 15 for 2 turns.
    Drop: Epic gear, frost giant's crown

45. **Storm Giant**
    Archetype: Berserker | Bracket: Legend
    Description: Titan of the storm. Fights with lightning-charged fists.
    Special: Lightning Call — Each turn, 20% chance to summon a lightning bolt dealing 25 true damage to the player.
    Drop: Epic–Legendary gear, stormstone (trinket)

---

### Dragon and Dragonkin Archetype
*Appears in: T4–T10 zones. The apex predators of the fantasy world.*

46. **Wyvern**
    Archetype: Assassin | Bracket: Elite
    Description: Two-legged cousin of the dragon. Venomous tail, aerial attacker.
    Special: Death Dive — First attack ignores DEF and applies Venom: 8 true damage per turn for 3 turns.
    Drop: Rare gear, wyvern venom sac

47. **Dragon Cultist**
    Archetype: Caster | Bracket: Soldier–Elite
    Description: Fanatic who has breathed dragon fumes long enough to partially transform.
    Special: Draconic Infusion — Every 3 turns, gains +20 ATK from a surge of draconic power.
    Drop: Uncommon–Rare gear, cult medallion

48. **Young Dragon**
    Archetype: Berserker | Bracket: Elite
    Description: Not fully grown but already devastating. Breath weapon still developing.
    Special: Flame Burst — Every 4 turns, deals 20 true damage to player (ignores DEF).
    Drop: Rare gear, young dragon scale

49. **Cave Wyrm**
    Archetype: Tank | Bracket: Champion
    Description: Blind, subterranean dragon relative. Hunts by vibration. Massive and slow.
    Special: Burrow — Once per fight, retreats underground and resurfaces the next turn with full DEF restored.
    Drop: Rare–Epic gear, wyrm hide

50. **Fire Drake**
    Archetype: Glass Cannon | Bracket: Champion
    Description: Aerial fire-breather. Nearly all offense, very little defense.
    Special: Incinerate — Every 3 turns, deals fire breath: 30% of player max HP as true damage.
    Drop: Epic gear, fire drake scale

51. **Elder Drake**
    Archetype: Berserker | Bracket: Legend–Apex
    Description: Ancient dragonkin, centuries old. Fought a hundred wars. Won them all.
    Special: Ancient Fire — Once per fight, breath weapon deals 50% of player max HP as true damage.
                           Cannot kill player (minimum 1 HP remains).
    Drop: Epic–Legendary gear, elder scale

---

### Elemental and Nature Archetype
*Appears in: T3–T8 zones. Creatures of primal magical forces.*

52. **Slime**
    Archetype: Tank | Bracket: Minion–Scout
    Description: Gelatinous, patient, absorbs hits that would shatter stone.
    Special: Split — On death, spawns 2 smaller Slimes at 40% current stats (once per fight).
    Drop: Common gear, slime core (trinket)

53. **Water Elemental**
    Archetype: Balanced | Bracket: Soldier
    Description: Animated water given direction and malice. Floods chambers.
    Special: Soak — On hit, applies Wet: player AGI reduced by 10 for 3 turns.
    Drop: Uncommon gear, water essence

54. **Ice Elemental**
    Archetype: Fortress | Bracket: Soldier–Elite
    Description: Solidified cold. Hits with the weight of a glacier moving.
    Special: Freeze — On hit, 25% chance to freeze player: skip next turn.
    Drop: Uncommon–Rare gear, ice core

55. **Lava Imp**
    Archetype: Glass Cannon | Bracket: Scout–Soldier
    Description: Mischievous fire creature. Burns what it touches. Wants to touch everything.
    Special: Combustion — On death, deals 15 true damage to player (heat release).
    Drop: Common–Uncommon gear, flame shard

56. **Magma Golem**
    Archetype: Fortress | Bracket: Elite
    Description: Constructed from hardened lava and old anger. Slow. Very slow.
    Special: Molten Fist — Every 5 turns, lands a guaranteed hit dealing 2× ATK as fire damage (true damage).
    Drop: Rare gear, magma core

57. **Wind Elemental**
    Archetype: Trickster | Bracket: Soldier
    Description: Formless and fast. Hard to hit. Harder to hold.
    Special: Gust — 30% base dodge chance; immune to Entangle and Slow effects.
    Drop: Uncommon gear, wind essence

58. **Stone Golem**
    Archetype: Fortress | Bracket: Soldier–Elite
    Description: Magically animated stone guardian. Built to hold a doorway forever.
    Special: Fortify — Takes half damage until it has attacked twice (slow to activate).
    Drop: Uncommon–Rare gear, golem core

59. **Cursed Treant**
    Archetype: Tank | Bracket: Soldier–Elite
    Description: Ancient tree driven to violence by dark magic. Every branch is a weapon.
    Special: Overgrowth — At fight start, doubles its DEF. Effect wears off after 3 turns.
    Drop: Uncommon–Rare gear, cursed heartwood

---

### Fey, Arcane, and Dark Magic Archetype
*Appears in: T3–T7 zones. Magic practitioners and supernatural beings.*

60. **Dark Fey**
    Archetype: Trickster | Bracket: Soldier
    Description: Mischievous fey creature that has crossed into cruelty. Glamour and spite.
    Special: Glamour — Appears as an ally type until first attacked (no damage on that attack).
    Drop: Uncommon gear, fey dust (trinket)

61. **Thorn Sprite**
    Archetype: Caster | Bracket: Scout–Soldier
    Description: Tiny fey made of thorns and malice. The group is the danger.
    Special: Thorn Volley — Every 2 turns, deals 8 true damage (ignores DEF; thorns are unavoidable).
    Drop: Common–Uncommon gear, thornwood shard

62. **Swamp Witch**
    Archetype: Caster | Bracket: Elite
    Description: Hedge witch gone deep into dark craft. The swamp obeys her.
    Special: Hex Barrage — Every 2 turns, applies a random debuff: −20% ATK, −20% DEF, or −10% AGI.
    Drop: Rare gear, witch's grimoire (trinket)

63. **Vampire**
    Archetype: Balanced | Bracket: Elite
    Description: Undead predator with a facade of civilization. Charming until feeding.
    Special: Life Drain — Each attack heals the vampire for 15% of damage dealt.
    Drop: Rare gear, vampiric signet

64. **Vampire Thrall**
    Archetype: Berserker | Bracket: Soldier
    Description: A person under vampiric influence. Half alive, all dangerous.
    Special: Thrall Bond — Heals 20 HP whenever its vampire master is also alive in the fight.
    Drop: Uncommon gear, thrall collar (trinket)

65. **Death Knight**
    Archetype: Tank | Bracket: Champion
    Description: A paladin who made the wrong deal. Kept the power; lost the purpose.
    Special: Death Aura — All healing effects on the player are reduced by 50% while this enemy lives.
    Drop: Epic gear, fallen knight's oath (trinket)

---

### Demonic Archetype
*Appears in: T7–T10 zones. Creatures of pure malice from the lower planes.*

66. **Bound Demon**
    Archetype: Berserker | Bracket: Champion
    Description: A demon constrained to a summoner's will. The leash slipped. Now it's just angry.
    Special: Binding Snap — Every 4 turns, attacks twice in one turn (the leash breaks momentarily).
    Drop: Epic gear, demon binding

67. **Arch-Fiend**
    Archetype: Caster | Bracket: Legend
    Description: Senior demon. Has been killing things since before this kingdom existed.
    Special: Hellfire — Every 3 turns, deals 25 true damage to player; cannot be resisted or reduced.
    Drop: Epic–Legendary gear, arch-fiend's seal

68. **Demon Lord**
    Archetype: Balanced | Bracket: Apex
    Description: A true lord of the lower planes. The room gets hotter when it enters.
    Special: Dominion — Player's companion assists are suppressed while this enemy is alive.
    Drop: Legendary gear, demon lord's crest

---

### Void and Cosmic Archetype
*Appears in: T7–T10 zones. Ancient, incomprehensible, and deeply hostile to existence.*

69. **Void Elemental**
    Archetype: Glass Cannon | Bracket: Legend
    Description: A shard of unmade space given hunger. Damages everything near it by existing.
    Special: Void Aura — All damage from this enemy is true damage (ignores all DEF).
    Drop: Epic–Legendary gear, void shard

70. **Fallen Angel**
    Archetype: Balanced | Bracket: Apex
    Description: A divine being that chose the wrong side. The grace remains. The mercy does not.
    Special: Divine Judgment — At 50% HP, cleanses all player buffs and deals 30 true damage.
    Drop: Legendary gear, broken halo (trinket)

---

## Random Boss Generator

Every 3rd boss encounter is a randomly generated boss with a unique name.

```
1. Select archetype randomly from all archetypes
2. Generate name: [Honorific] + [Name] + [Title]

   Honorifics:
     Ancient, Cursed, Fallen, Undying, Dread, Elder, Forsaken, Hollow,
     Vile, Corrupted, Grim, The Last, Blood-Soaked, Iron, Pale

   Names:
     Gorrath, Malvek, Skareth, Vargos, Thraxis, Keldros, Morven, Ashrak,
     Zervian, Caldrath, Vexis, Korroth, Sindrak, Dravos, Relthar, Vorath,
     Grimbane, Phareth, Caldor, Morvex, Therin, Elrath, Durash, Zareth,
     Hexan, Valkor, Skallen, Morten, Umbral, Draeven

   Titles:
     the Unyielding, the Betrayer, Blood-Drinker, of the Deep, the Forgotten,
     Iron-Bone, Grave-Walker, Soul-Eater, the Corrupted, the Undying,
     Stone-Heart, of the Abyss, the Shattered, the Ancient, of Eternal Night,
     the Relentless, Pale-King, Ash-Born, Storm-Caller, the Forsaken

3. Assign 1–2 boss special abilities from the Boss Ability List (zone-theme-appropriate)
4. Apply zone-level stat scaling to Boss bracket budget
5. Loot table: Rare+ guaranteed; Epic at 30%+ chance in high tiers
```

---

## Enemy Naming Conventions

For zone-themed enemy variants generated at runtime:

```
[Tier Prefix] + [Archetype Word] + [Optional Suffix]

Tier Prefixes by zone tier:
  T1–T2: Forest, Hill, Cave, Wild, Marsh, Beach, Shore, Hollow, Ancient
  T3–T4: Cursed, Darkling, Fell, Blood, Dire, Iron, Stone, Plague, Bog
  T5–T6: Shadow, Void-Touched, Wrath, Dread, Vile, Bone, Spectral, Ruined
  T7–T8: Elder, Forsaken, Corrupted, Eternal, Grim, Lost, Pale, Sunken
  T9–T10: Undying, Primordial, God-Touched, Abyssal, Ascendant, True, Final

Archetype Words:
  Knight, Warrior, Hunter, Walker, Stalker, Shade, Warden, Guardian,
  Ravager, Slayer, Reaper, Specter, Spawn, Golem, Horror, Beast,
  Wraith, Brute, Drake, Fiend, Broodling, Sentinel, Marauder, Revenant

Suffixes (optional, ~30% chance):
  the Ancient, the Fallen, the Forsaken, the Unyielding, the Eternal,
  Bonecrusher, Ironside, Skullcleave, Darkbane, Doomhide, the Cursed,
  Ashborn, the Relentless, the Hollow
```

---

*See docs/rpg/CLAUDE.md for theme rules and canonical formulas.*
*See docs/rpg/ZONES.md for zone-specific enemy pool assignments.*
*See docs/rpg/SCALING.md for stat budget scaling formulas by zone level.*
*See docs/rpg/UNIQUE_ZONE_MECHANICS.md for zone mechanics referenced by enemies.*
