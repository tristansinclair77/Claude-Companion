# RPG Adventure — Item Name Generation Database

Last updated: 2026-02-27
Status: Phase 0 — Design Complete

Prefix and suffix word banks for procedural item name generation.
Organized by rarity tier. Legendary item names are unique per item (see LEGENDARIES.md).

---

## Name Format

```
[Prefix] [Item Type] of [Suffix]       ← full form
[Prefix] [Item Type]                   ← prefix only (short form)
[Item Type] of [Suffix]                ← suffix only (rare, named drops)
```

Examples:
- "Iron Sword of the Wolf"             (Common)
- "Runed Staff of the Fallen"          (Uncommon)
- "Dragon-Forged Blade of Ancient Kings" (Rare)
- "God-Forged Warhammer of the World's End" (Epic)

Prefixes and suffixes at each tier can also be used at the tier below (upward only).
A Rare prefix can appear on an Epic item. A Common prefix never appears on an Epic item.

---

## COMMON TIER — Prefixes & Suffixes

Items found in T1–T2 zones. Simple material and quality descriptors.
No magic. No mystery. Just steel and leather and effort.

### Common Prefixes (18)
Iron, Copper, Bronze, Wooden, Bone, Leather, Stone, Crude, Worn,
Sturdy, Sharp, Heavy, Light, Cracked, Weathered, Polished, Rough, Plain

### Common Suffixes (18)
of the Wolf, of the Bear, of the Boar, of Strength, of the Hunt, of the Blade,
of the Road, of Endurance, of the Forest, of Stone, of Blood, of the Wanderer,
of the Frontier, of Iron, of Speed, of the Soldier, of the Watchman, of Ruin

---

## UNCOMMON TIER — Prefixes & Suffixes

Items found in T2–T4 zones. Better materials, light enchantments, named origins.

### Uncommon Prefixes (18)
Steel, Silver, Gilded, Runed, Carved, Blessed, Enchanted, Ancient, Cursed,
Shadow, Storm, Ember, Frost, Veteran's, Thorned, Barbed, Hollow, Tempered

### Uncommon Suffixes (18)
of the Champion, of the Fallen, of the Wilds, of Valor, of Courage,
of Flame, of Frost, of Thunder, of the Depths, of the Night,
of the Mountains, of the Knight, of the Exile, of the Forsaken,
of the Ruin, of Ash, of the Blade-Saint, of the Old Kingdom

---

## RARE TIER — Prefixes & Suffixes

Items found in T4–T7 zones. Named magic, legendary materials, mythic origins.

### Rare Prefixes (18)
Dragon-Forged, Void-Touched, Sacred, Arcane, Dread, Infernal, Seraphic, Runic,
Ancestral, Mystic, Dark, Crimson, Obsidian, Bone-Carved, Eldritch, Warden's,
Death-Touched, Consecrated

### Rare Suffixes (18)
of the Dragon, of the Abyss, of the Undying, of Ancient Kings, of Eternity,
of the Demon, of Sacred Flame, of the Warlord, of Twilight, of the Void,
of Slaughter, of the Pact, of the Elder Gods, of Lost Kingdoms, of Corruption,
of the Bound, of the Lich, of the Sunken King

---

## EPIC TIER — Prefixes & Suffixes

Items found in T7–T10 zones. World-altering power. Divine or cosmic language.

### Epic Prefixes (18)
God-Forged, Primordial, Celestial, Eternal, Undying, World-Shatter,
Divine, Abyssal, Sovereign, Conquest, Last, Forsaken, Fallen,
Dragon-Emperor's, Void-Sovereign, Godslayer's, First-Age, Tomb-Risen

### Epic Suffixes (18)
of the Ages, of the World's End, of Transcendence, of the Final Frontier,
of Dragon's Wrath, of the Dying God, of the Undying King, of the Breaking World,
of the Eternal Flame, of Creation's End, of the Conqueror, of Dawn's Reckoning,
of the Last Stand, of the Elder World, of Infinite Sorrow, of the Shattered Realm,
of the God's Rest, of Oblivion

---

## Item Types — Weapons

Used in the `[Item Type]` slot. All fantasy — no firearms, no tech.

### Swords & Blades
Sword, Greatsword, Longsword, Shortsword, Broadsword, Falchion, Sabre, Scimitar,
Rapier, Gladius, Claymore, Bastard Sword, Blade, War Blade

### Daggers & Short Blades
Dagger, Dirk, Stiletto, Tanto, Kris, Rondel, Shiv, Seax

### Polearms & Reach
Spear, Halberd, Glaive, Lance, Pike, Ranseur, Poleaxe

### Axes
Axe, Greataxe, Hatchet, Bardiche, War Axe, Battle Axe, Splitting Axe

### Hammers & Blunt
Hammer, Warhammer, Maul, Mace, Morningstar, Flail, Scepter, Club, Great Maul

### Scythes & Curved
Scythe, War Scythe, Sickle, Hook, Falx

### Staves & Arcane Foci
Staff, Wand, Rod, Orb, Crystal Focus, Bone Staff, Living Staff, Runestone Staff

### Tomes & Grimoires
Tome, Grimoire, Codex, Spellbook, Rune-Etched Scroll

### Bows
Bow, Longbow, Shortbow, Hunting Bow, Recurve Bow, Crossbow

### Claws & Fist Weapons
Claws, Talon Grips, Knuckle Blades, Bone Knuckles, Fist Spikes

---

## Item Types — Armor & Accessories

Used in the `[Item Type]` slot for non-weapon slots.

### Helms
Helm, Helmet, Crown, Circlet, Hood, Coif, Visor, Cap, Skull Cap, Great Helm

### Chest
Plate Armor, Chainmail, Brigandine, Scale Mail, Breastplate, Cuirass, Hauberk,
Leather Jerkin, Robe, Vestment, Coat, Surcoat, Tabard

### Gloves / Bracers
Gauntlets, Bracers, Gloves, Grips, Wraps, Armguards, Vambraces

### Boots
Boots, Greaves, Sabatons, Sandals, Treads, Shoes, War Boots, Iron Boots

### Belt
Belt, Girdle, Sash, War Belt, Studded Belt

### Ring
Ring, Band, Signet Ring, Seal Ring, Carved Ring

### Amulet / Necklace
Amulet, Pendant, Necklace, Torc, Talisman, Locket, Medallion

### Trinket / Offhand
Trinket, Charm, Relic, Fetish, Idol, Carved Bone, Sigil Stone, Runed Token,
Focus Crystal, Ancient Coin, Blessed Effigy

---

## Name Generation Rules

### Rarity-Appropriate Prefix Selection
- Common  : pick 1 prefix from Common pool only
- Uncommon: pick 1 prefix from Common or Uncommon pool (70% Uncommon)
- Rare    : pick 1 prefix from Uncommon or Rare pool (75% Rare)
- Epic    : pick 1 prefix from Rare or Epic pool (80% Epic)

### Rarity-Appropriate Suffix Selection
- Same distribution as prefix selection above, applied independently.

### Format Selection
- 60% chance: `[Prefix] [ItemType] of [Suffix]`  — full form
- 25% chance: `[Prefix] [ItemType]`               — prefix only
- 15% chance: `[ItemType] of [Suffix]`            — suffix only (feels like a proper name)

### Set Piece Names
Set pieces use their set-specific name (e.g., "Ironwall Helm") instead of the random
generator. The generator is only for non-set drops.

### Legendary Names
Legendary item names are fixed per item and never generated procedurally.
See LEGENDARIES.md for all named legendary items.

---

## Examples by Rarity

```
Common    — Iron Sword of the Wolf
            Rough Gloves of Endurance
            Cracked Staff of Ruin

Uncommon  — Runed Longsword of the Fallen
            Storm Bracers of Thunder
            Carved Amulet of the Old Kingdom

Rare      — Dragon-Forged Greatsword of Ancient Kings
            Void-Touched Tome of the Abyss
            Ancestral Helm of the Lich
            Eldritch Pendant of Lost Kingdoms

Epic      — God-Forged Warhammer of the World's End
            Primordial Robe of the Dying God
            Eternal Blade of Creation's End
            Fallen Crown of the Undying King
```

---

*See docs/rpg/GEAR_SETS.md for named set piece names.*
*See docs/rpg/LEGENDARIES.md for unique legendary item names.*
*See docs/rpg/CLAUDE.md for theme rules.*
