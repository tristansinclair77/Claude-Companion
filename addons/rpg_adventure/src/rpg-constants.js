'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// RPG Constants — all canonical data tables
// Source of truth: docs/rpg/SCALING.md, ZONES.md, ENEMIES.md, RESPONSES.md
// ─────────────────────────────────────────────────────────────────────────────

// ── Difficulty Brackets ───────────────────────────────────────────────────────
// baseBudget = stat budget at zone level 1; scales by Math.pow(zoneLevel, 1.3)
const BRACKETS = {
  minion:   { id: 'minion',   baseBudget:    8, xpMult:  1.0, goldMult:  1.0, tier: [1]       },
  scout:    { id: 'scout',    baseBudget:   50, xpMult:  1.5, goldMult:  1.2, tier: [2]       },
  soldier:  { id: 'soldier',  baseBudget:   90, xpMult:  2.0, goldMult:  1.5, tier: [3]       },
  elite:    { id: 'elite',    baseBudget:  150, xpMult:  3.0, goldMult:  2.0, tier: [4, 5]    },
  champion: { id: 'champion', baseBudget:  250, xpMult:  5.0, goldMult:  3.0, tier: [5, 6]    },
  legend:   { id: 'legend',   baseBudget:  400, xpMult:  8.0, goldMult:  5.0, tier: [6, 7, 8] },
  apex:     { id: 'apex',     baseBudget:  650, xpMult: 12.0, goldMult:  8.0, tier: [8, 9]    },
  god_tier: { id: 'god_tier', baseBudget: 1000, xpMult: 20.0, goldMult: 15.0, tier: [9, 10]   },
  boss:     { id: 'boss',     baseBudget:    0, xpMult: 15.0, goldMult: 10.0, tier: 'any',
              note: 'boss budget = 3× bracket base for zone' },
};

// ── Archetype Stat Distributions ──────────────────────────────────────────────
// Percentages of total stat budget allocated to each combat stat.
// SPECIAL% controls ability slot count (5%=1 slot, 15%=2 slots, 25%=3 slots).
const ARCHETYPE_DISTRIBUTIONS = {
  tank:         { hp: 0.45, atk: 0.15, def: 0.30, agi: 0.05, special: 0.05 },
  glass_cannon: { hp: 0.15, atk: 0.55, def: 0.05, agi: 0.20, special: 0.05 },
  balanced:     { hp: 0.25, atk: 0.25, def: 0.20, agi: 0.20, special: 0.10 },
  assassin:     { hp: 0.15, atk: 0.40, def: 0.05, agi: 0.35, special: 0.05 },
  support:      { hp: 0.35, atk: 0.10, def: 0.20, agi: 0.10, special: 0.25 },
  summoner:     { hp: 0.20, atk: 0.15, def: 0.15, agi: 0.15, special: 0.35 },
  berserker:    { hp: 0.20, atk: 0.45, def: 0.05, agi: 0.25, special: 0.05 },
  fortress:     { hp: 0.50, atk: 0.10, def: 0.35, agi: 0.00, special: 0.05 },
  trickster:    { hp: 0.10, atk: 0.20, def: 0.10, agi: 0.45, special: 0.15 },
  caster:       { hp: 0.20, atk: 0.35, def: 0.10, agi: 0.10, special: 0.25 },
};

// ── Gear Slots ────────────────────────────────────────────────────────────────
const GEAR_SLOTS = [
  'weapon', 'head', 'chest', 'hands', 'feet', 'belt', 'ring', 'amulet', 'trinket',
];

// ── Rarity Weights (base at zone level 1, LCK 0) ─────────────────────────────
// See SCALING.md rarityWeights() — these are BASE weights before shift.
// Always renormalize before use: divide each by sum of all weights.
const RARITY_BASE_WEIGHTS = {
  common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1,
};

// ── Rarity Multipliers for gear stat ranges ───────────────────────────────────
const RARITY_MULT = {
  common:    1.0,
  uncommon:  1.5,
  rare:      2.2,
  epic:      3.5,
  legendary: 6.0,
};

// ── Stat count (per roll) by rarity ──────────────────────────────────────────
const RARITY_STAT_COUNT = {
  common:    { min: 1, max: 2 },
  uncommon:  { min: 2, max: 3 },
  rare:      { min: 3, max: 4 },
  epic:      { min: 4, max: 5 },
  legendary: { min: 5, max: 6 },
};

// ── Merchant base item values (multiplied by zone level for final price) ──────
const RARITY_BASE_VALUE = {
  common:    5,
  uncommon:  15,
  rare:      45,
  epic:      135,
  legendary: 400,
};

// ── Stat Definitions ──────────────────────────────────────────────────────────
const STAT_DEFINITIONS = {
  str: {
    id: 'str', label: 'STR', color: '#e74c3c',
    primaryEffect: 'Melee weapon damage scaling',
    secondaryEffect: 'Unlocks Strength-gated gear',
  },
  int: {
    id: 'int', label: 'INT', color: '#3498db',
    primaryEffect: 'Magic/ranged damage scaling',
    secondaryEffect: 'Spell slot count (+1 per 5 INT)',
  },
  agi: {
    id: 'agi', label: 'AGI', color: '#2ecc71',
    primaryEffect: 'Dodge chance (AGI × 0.8%)',
    secondaryEffect: 'Determines attack order (higher AGI goes first)',
  },
  vit: {
    id: 'vit', label: 'VIT', color: '#27ae60',
    primaryEffect: 'Max HP (+8 per point, soft cap at VIT 300 → +2/point above)',
    secondaryEffect: 'Damage reduction (VIT × 0.2%)',
  },
  lck: {
    id: 'lck', label: 'LCK', color: '#f39c12',
    primaryEffect: 'Crit chance (LCK × 0.5%)',
    secondaryEffect: 'Loot rarity bias (see rarityWeights)',
  },
  cha: {
    id: 'cha', label: 'CHA', color: '#e91e8c',
    primaryEffect: 'Companion assist chance (see CHA breakpoints)',
    secondaryEffect: 'Max base CHA = 50; gear can exceed this',
    breakpoints: [
      { range: [0, 9],   effect: 'No companion assists' },
      { range: [10, 24], effect: 'CHA × 2% chance of assist per player turn' },
      { range: [25, 49], effect: 'Guaranteed 1 assist at the start of each fight' },
      { range: [50, 50], effect: 'Guaranteed 1 assist per player turn (at 50% ATK)' },
      { range: [75, Infinity], effect: 'Assist fires twice per player turn (gear-boosted only)' },
    ],
  },
};

// ── Zone Tier Access Table ────────────────────────────────────────────────────
// minCharLevel = floor(zoneLevelMin * 0.5), min 1
const TIER_TABLE = [
  { tier: 1,  zoneLevelMin:   1, zoneLevelMax:  40, minCharLevel:   1 },
  { tier: 2,  zoneLevelMin:  41, zoneLevelMax:  80, minCharLevel:  20 },
  { tier: 3,  zoneLevelMin:  81, zoneLevelMax: 120, minCharLevel:  40 },
  { tier: 4,  zoneLevelMin: 121, zoneLevelMax: 160, minCharLevel:  60 },
  { tier: 5,  zoneLevelMin: 161, zoneLevelMax: 200, minCharLevel:  80 },
  { tier: 6,  zoneLevelMin: 201, zoneLevelMax: 240, minCharLevel: 100 },
  { tier: 7,  zoneLevelMin: 241, zoneLevelMax: 280, minCharLevel: 120 },
  { tier: 8,  zoneLevelMin: 281, zoneLevelMax: 320, minCharLevel: 140 },
  { tier: 9,  zoneLevelMin: 321, zoneLevelMax: 360, minCharLevel: 160 },
  { tier: 10, zoneLevelMin: 361, zoneLevelMax: 400, minCharLevel: 180 },
];

// ── Zone Database (70 main zones) ────────────────────────────────────────────
// mechanic: zone mechanic ID from UNIQUE_ZONE_MECHANICS.md (null = None)
// isCompanionZone: only available if active character pack includes questline.json
const ZONES = [

  // ── Tier 1 — The Frontier (Zone Level 1–40, Char Level 1–5) ──────────────
  {
    id: 'greenwood_hollow', name: 'Greenwood Hollow', tier: 1,
    zoneLevelMin: 1, zoneLevelMax: 4, charLevelReq: 1,
    enemyTheme: ['Goblins', 'Giant Rats', 'Timber Wolves'],
    mechanic: null,
  },
  {
    id: 'saltwind_cove', name: 'Saltwind Cove', tier: 1,
    zoneLevelMin: 1, zoneLevelMax: 3, charLevelReq: 1,
    enemyTheme: ['Giant Crabs', 'Beach Bandits', 'Merfolk Scouts'],
    mechanic: null,
  },
  {
    id: 'the_muddy_fen', name: 'The Muddy Fen', tier: 1,
    zoneLevelMin: 2, zoneLevelMax: 5, charLevelReq: 1,
    enemyTheme: ['Giant Frogs', 'Slimes', 'Bog Imps'],
    mechanic: 'slick_ground',
  },
  {
    id: 'goblin_warren', name: 'Goblin Warren', tier: 1,
    zoneLevelMin: 2, zoneLevelMax: 4, charLevelReq: 1,
    enemyTheme: ['Goblins', 'Goblin Shamans', 'Goblin Chieftains'],
    mechanic: 'ambush',
  },
  {
    id: 'crumbling_watchtower', name: 'Crumbling Watchtower', tier: 1,
    zoneLevelMin: 2, zoneLevelMax: 5, charLevelReq: 2,
    enemyTheme: ['Skeleton Soldiers', 'Giant Spiders', 'Carrion Crows'],
    mechanic: null,
  },
  {
    id: 'shepherds_heath', name: "Shepherd's Heath", tier: 1,
    zoneLevelMin: 1, zoneLevelMax: 3, charLevelReq: 1,
    enemyTheme: ['Bandits', 'Wild Boars', 'Dire Wolves'],
    mechanic: 'open_terrain',
  },
  {
    id: 'the_dusty_mine', name: 'The Dusty Mine', tier: 1,
    zoneLevelMin: 3, zoneLevelMax: 6, charLevelReq: 2,
    enemyTheme: ['Cave Bats', 'Giant Beetles', 'Kobolds'],
    mechanic: null,
  },

  // ── Tier 2 — The Wilds (Zone Level 11–25) ────────────────────────────────
  {
    id: 'darkwood_forest', name: 'Darkwood Forest', tier: 2,
    zoneLevelMin: 11, zoneLevelMax: 18, charLevelReq: 5,
    enemyTheme: ['Forest Bandits', 'Werewolves', 'Dryad Shades'],
    mechanic: null,
  },
  {
    id: 'the_marshlands', name: 'The Marshlands', tier: 2,
    zoneLevelMin: 14, zoneLevelMax: 22, charLevelReq: 7,
    enemyTheme: ['Bog Trolls', 'Giant Leeches', 'Marsh Hags'],
    mechanic: 'quicksand_trap',
  },
  {
    id: 'seaside_cliffs', name: 'Seaside Cliffs', tier: 2,
    zoneLevelMin: 11, zoneLevelMax: 17, charLevelReq: 5,
    enemyTheme: ['Harpies', 'Smugglers', 'Sea Serpent Hatchlings'],
    mechanic: null,
  },
  {
    id: 'hillside_ruins', name: 'Hillside Ruins', tier: 2,
    zoneLevelMin: 15, zoneLevelMax: 25, charLevelReq: 7,
    enemyTheme: ['Skeletons', 'Grave Robbers', 'Cursed Statues'],
    mechanic: 'hidden_cache',
  },
  {
    id: 'the_haunted_mill', name: 'The Haunted Mill', tier: 2,
    zoneLevelMin: 12, zoneLevelMax: 20, charLevelReq: 6,
    enemyTheme: ['Ghosts', 'Poltergeists', 'Skeleton Workers'],
    mechanic: null,
  },
  {
    id: 'bandits_crossing', name: "Bandit's Crossing", tier: 2,
    zoneLevelMin: 13, zoneLevelMax: 22, charLevelReq: 6,
    enemyTheme: ['Bandits', 'Brigand Captains', 'Hired Thugs'],
    mechanic: 'reinforcements',
  },
  {
    id: 'the_rat_warrens', name: 'The Rat Warrens', tier: 2,
    zoneLevelMin: 17, zoneLevelMax: 25, charLevelReq: 8,
    enemyTheme: ['Giant Rats', 'Rat Swarms', 'Plagued Rats'],
    mechanic: null,
  },

  // ── Tier 3 — The Depths (Zone Level 26–50) ────────────────────────────────
  {
    id: 'thornwood_forest', name: 'Thornwood Forest', tier: 3,
    zoneLevelMin: 26, zoneLevelMax: 38, charLevelReq: 13,
    enemyTheme: ['Dark Fey', 'Thorn Sprites', 'Cursed Treants'],
    mechanic: null,
  },
  {
    id: 'the_sunken_temple', name: 'The Sunken Temple', tier: 3,
    zoneLevelMin: 30, zoneLevelMax: 45, charLevelReq: 15,
    enemyTheme: ['Temple Guardians', 'Undead Priests', 'Water Elementals'],
    mechanic: 'rising_water',
  },
  {
    id: 'stoneridge_pass', name: 'Stoneridge Pass', tier: 3,
    zoneLevelMin: 26, zoneLevelMax: 35, charLevelReq: 13,
    enemyTheme: ['Mountain Ogres', 'Stone Golems', 'Snow Eagles'],
    mechanic: null,
  },
  {
    id: 'the_boglands', name: 'The Boglands', tier: 3,
    zoneLevelMin: 32, zoneLevelMax: 48, charLevelReq: 16,
    enemyTheme: ['Bog Wraiths', 'Giant Toads', 'Swamp Witches'],
    mechanic: 'fog',
  },
  {
    id: 'cursed_village', name: 'Cursed Village', tier: 3,
    zoneLevelMin: 28, zoneLevelMax: 42, charLevelReq: 14,
    enemyTheme: ['Zombies', 'Cursed Villagers', 'Village Warlocks'],
    mechanic: null,
  },
  {
    id: 'the_old_dungeon', name: 'The Old Dungeon', tier: 3,
    zoneLevelMin: 38, zoneLevelMax: 50, charLevelReq: 19,
    enemyTheme: ['Dungeon Crawlers', 'Mimics', 'Dungeon Wardens'],
    mechanic: 'trap_heavy',
  },
  {
    id: 'sandblown_wastes', name: 'Sandblown Wastes', tier: 3,
    zoneLevelMin: 30, zoneLevelMax: 50, charLevelReq: 15,
    enemyTheme: ['Desert Bandits', 'Sand Scorpions', 'Mummies'],
    mechanic: null,
  },

  // ── Tier 4 — The Contested Lands (Zone Level 51–80) ──────────────────────
  {
    id: 'the_whispering_jungle', name: 'The Whispering Jungle', tier: 4,
    zoneLevelMin: 51, zoneLevelMax: 65, charLevelReq: 25,
    enemyTheme: ['Jungle Stalkers', 'Giant Serpents', 'Lizardmen'],
    mechanic: 'predator',
  },
  {
    id: 'stonegate_keep', name: 'Stonegate Keep', tier: 4,
    zoneLevelMin: 55, zoneLevelMax: 72, charLevelReq: 27,
    enemyTheme: ['Orcs', 'Orc Warlords', 'Ogre Guards'],
    mechanic: null,
  },
  {
    id: 'icemaw_caverns', name: 'Icemaw Caverns', tier: 4,
    zoneLevelMin: 58, zoneLevelMax: 75, charLevelReq: 29,
    enemyTheme: ['Frost Wolves', 'Ice Elementals', 'Glacier Trolls'],
    mechanic: 'bitter_cold',
  },
  {
    id: 'ember_ridge', name: 'Ember Ridge', tier: 4,
    zoneLevelMin: 60, zoneLevelMax: 80, charLevelReq: 30,
    enemyTheme: ['Lava Imps', 'Fire Drakes', 'Magma Golems'],
    mechanic: null,
  },
  {
    id: 'the_undying_crypts', name: 'The Undying Crypts', tier: 4,
    zoneLevelMin: 52, zoneLevelMax: 68, charLevelReq: 26,
    enemyTheme: ['Skeletons', 'Wraiths', 'Undead Knights'],
    mechanic: 'undying',
  },
  {
    id: 'orc_warcamp', name: 'Orc Warcamp', tier: 4,
    zoneLevelMin: 56, zoneLevelMax: 75, charLevelReq: 28,
    enemyTheme: ['Orc Warriors', 'Orc Shamans', 'War Trolls'],
    mechanic: null,
  },
  {
    id: 'the_screaming_desert', name: 'The Screaming Desert', tier: 4,
    zoneLevelMin: 65, zoneLevelMax: 80, charLevelReq: 32,
    enemyTheme: ['Dust Wraiths', 'Scorpion Lords', 'Sand Elementals'],
    mechanic: 'sandstorm',
  },

  // ── Tier 5 — The Forgotten Lands (Zone Level 81–120) ─────────────────────
  {
    id: 'the_ancient_colosseum', name: 'The Ancient Colosseum', tier: 5,
    zoneLevelMin: 81, zoneLevelMax: 100, charLevelReq: 40,
    enemyTheme: ['Gladiator Shades', 'Champion Undead', 'Arena Beasts'],
    mechanic: null,
  },
  {
    id: 'wraithwood', name: 'Wraithwood', tier: 5,
    zoneLevelMin: 85, zoneLevelMax: 108, charLevelReq: 42,
    enemyTheme: ['Wraiths', 'Banshees', 'Soul Hunters'],
    mechanic: 'ethereal_enemies',
  },
  {
    id: 'deepstone_mines', name: 'Deepstone Mines', tier: 5,
    zoneLevelMin: 88, zoneLevelMax: 115, charLevelReq: 44,
    enemyTheme: ['Stone Golems', 'Deep Dwarves', 'Rock Horrors'],
    mechanic: null,
  },
  {
    id: 'the_sunken_citadel', name: 'The Sunken Citadel', tier: 5,
    zoneLevelMin: 92, zoneLevelMax: 120, charLevelReq: 46,
    enemyTheme: ['Armored Undead', 'Drowned Knights', 'Siege Wraiths'],
    mechanic: null,
  },
  {
    id: 'dragons_approach', name: "Dragon's Approach", tier: 5,
    zoneLevelMin: 96, zoneLevelMax: 120, charLevelReq: 48,
    enemyTheme: ['Wyverns', 'Dragon Cultists', 'Young Dragons'],
    mechanic: 'dragons_shadow',
  },
  {
    id: 'the_shattered_peaks', name: 'The Shattered Peaks', tier: 5,
    zoneLevelMin: 82, zoneLevelMax: 105, charLevelReq: 41,
    enemyTheme: ['Stone Giants', 'Runic Golems', 'Wind Elementals'],
    mechanic: null,
  },
  {
    id: 'verdant_labyrinth', name: 'Verdant Labyrinth', tier: 5,
    zoneLevelMin: 100, zoneLevelMax: 120, charLevelReq: 50,
    enemyTheme: ['Lizardmen', 'Serpent Priests', 'Jungle Hydras'],
    mechanic: 'labyrinth',
  },

  // ── Tier 6 — The Elemental Reaches (Zone Level 121–160) ──────────────────
  {
    id: 'the_lava_fields', name: 'The Lava Fields', tier: 6,
    zoneLevelMin: 121, zoneLevelMax: 138, charLevelReq: 60,
    enemyTheme: ['Fire Giants', 'Lava Elementals', 'Flame Drakes'],
    mechanic: 'scorching_ground',
  },
  {
    id: 'frostbitten_tundra', name: 'Frostbitten Tundra', tier: 6,
    zoneLevelMin: 124, zoneLevelMax: 145, charLevelReq: 62,
    enemyTheme: ['Frost Giants', 'Ice Wraiths', 'Tundra Wolves'],
    mechanic: null,
  },
  {
    id: 'the_wyrms_lair', name: "The Wyrm's Lair", tier: 6,
    zoneLevelMin: 135, zoneLevelMax: 158, charLevelReq: 67,
    enemyTheme: ['Cave Wyrms', 'Dragon Cultists', 'Treasure Golems'],
    mechanic: null,
  },
  {
    id: 'sea_witchs_grotto', name: "Sea Witch's Grotto", tier: 6,
    zoneLevelMin: 122, zoneLevelMax: 140, charLevelReq: 61,
    enemyTheme: ['Sea Spirits', 'Bound Merfolk', 'Coral Constructs'],
    mechanic: 'tidal_hazard',
  },
  {
    id: 'the_black_marshes', name: 'The Black Marshes', tier: 6,
    zoneLevelMin: 130, zoneLevelMax: 150, charLevelReq: 65,
    enemyTheme: ['Lich Servants', 'Plague Zombies', 'Death Elementals'],
    mechanic: 'undying',
  },
  {
    id: 'twilight_castle', name: 'Twilight Castle', tier: 6,
    zoneLevelMin: 138, zoneLevelMax: 160, charLevelReq: 69,
    enemyTheme: ['Vampires', 'Vampire Thralls', 'Death Knights'],
    mechanic: null,
  },
  {
    id: 'the_giants_stairway', name: "The Giant's Stairway", tier: 6,
    zoneLevelMin: 128, zoneLevelMax: 155, charLevelReq: 64,
    enemyTheme: ['Stone Giants', 'Ettins', 'Giant Shamans'],
    mechanic: null,
  },

  // ── Tier 7 — The Ancient Domains (Zone Level 161–200) ────────────────────
  {
    id: 'the_abyssal_depths', name: 'The Abyssal Depths', tier: 7,
    zoneLevelMin: 161, zoneLevelMax: 180, charLevelReq: 80,
    enemyTheme: ['Deep Horrors', 'Abyssal Crawlers', 'Eye Tyrants'],
    mechanic: 'darkness',
  },
  {
    id: 'volcanic_caldera', name: 'Volcanic Caldera', tier: 7,
    zoneLevelMin: 165, zoneLevelMax: 185, charLevelReq: 82,
    enemyTheme: ['Efreet', 'Magma Titans', 'Volcanic Wyrms'],
    mechanic: null,
  },
  {
    id: 'the_moonlit_wastes', name: 'The Moonlit Wastes', tier: 7,
    zoneLevelMin: 162, zoneLevelMax: 178, charLevelReq: 81,
    enemyTheme: ['Werewolves', 'Moon Spirits', 'Cursed Wanderers'],
    mechanic: 'full_moon_rage',
  },
  {
    id: 'storm_giants_keep', name: "Storm Giant's Keep", tier: 7,
    zoneLevelMin: 170, zoneLevelMax: 192, charLevelReq: 85,
    enemyTheme: ['Storm Giants', 'Thunder Hawks', 'Lightning Elementals'],
    mechanic: 'lightning',
  },
  {
    id: 'the_forbidden_sanctum', name: 'The Forbidden Sanctum', tier: 7,
    zoneLevelMin: 175, zoneLevelMax: 200, charLevelReq: 87,
    enemyTheme: ['Arcane Constructs', 'Spell Shades', 'Bound Demons'],
    mechanic: null,
  },
  {
    id: 'necropolis_of_the_ancients', name: 'Necropolis of the Ancients', tier: 7,
    zoneLevelMin: 168, zoneLevelMax: 195, charLevelReq: 84,
    enemyTheme: ['Ancient Undead', 'Lich Nobles', 'Death Paladins'],
    mechanic: null,
  },
  {
    id: 'the_feywild_crossing', name: 'The Feywild Crossing', tier: 7,
    zoneLevelMin: 163, zoneLevelMax: 183, charLevelReq: 81,
    enemyTheme: ['Dark Fey', 'Fey Hunters', 'Corrupted Sprites'],
    mechanic: 'fey_glamour',
    isCompanionZone: true,
  },

  // ── Tier 8 — The Shattered Kingdoms (Zone Level 201–250) ─────────────────
  {
    id: 'the_bone_throne', name: 'The Bone Throne', tier: 8,
    zoneLevelMin: 201, zoneLevelMax: 220, charLevelReq: 100,
    enemyTheme: ['God-Lich Servants', 'Bone Constructs', 'Elite Undead'],
    mechanic: null,
  },
  {
    id: 'ashfall_wastes', name: 'Ashfall Wastes', tier: 8,
    zoneLevelMin: 205, zoneLevelMax: 228, charLevelReq: 102,
    enemyTheme: ['Ash Wraiths', 'Buried Golems', 'Flame Remnants'],
    mechanic: 'ashfall',
  },
  {
    id: 'the_eternal_forest', name: 'The Eternal Forest', tier: 8,
    zoneLevelMin: 210, zoneLevelMax: 235, charLevelReq: 105,
    enemyTheme: ['Ancient Treants', 'Corrupted Dryads', 'Forest Leviathans'],
    mechanic: null,
  },
  {
    id: 'sea_of_storms', name: 'Sea of Storms', tier: 8,
    zoneLevelMin: 202, zoneLevelMax: 222, charLevelReq: 101,
    enemyTheme: ['Storm Wraiths', 'Shipwreck Undead', 'Sea Serpents'],
    mechanic: 'stormy_conditions',
  },
  {
    id: 'the_iron_fortress', name: 'The Iron Fortress', tier: 8,
    zoneLevelMin: 218, zoneLevelMax: 245, charLevelReq: 109,
    enemyTheme: ['Iron Golems', 'Mad Paladins', 'Siege Constructs'],
    mechanic: null,
  },
  {
    id: 'drakenspire_summit', name: 'Drakenspire Summit', tier: 8,
    zoneLevelMin: 225, zoneLevelMax: 250, charLevelReq: 112,
    enemyTheme: ['Elder Drakes', 'Dragon Kin', 'Ancient Dragon Cultists'],
    mechanic: 'dragons_domain',
  },
  {
    id: 'the_sunless_sea', name: 'The Sunless Sea', tier: 8,
    zoneLevelMin: 212, zoneLevelMax: 240, charLevelReq: 106,
    enemyTheme: ['Deep Sea Horrors', 'Abyssal Merfolk', 'Kraken Spawn'],
    mechanic: null,
  },

  // ── Tier 9 — The Edge of the World (Zone Level 251–320) ──────────────────
  {
    id: 'the_void_cathedral', name: 'The Void Cathedral', tier: 9,
    zoneLevelMin: 251, zoneLevelMax: 275, charLevelReq: 125,
    enemyTheme: ['Void Cultists', 'Void Elementals', 'Void-Touched Paladins'],
    mechanic: null,
  },
  {
    id: 'frostfire_tundra', name: 'Frostfire Tundra', tier: 9,
    zoneLevelMin: 258, zoneLevelMax: 285, charLevelReq: 129,
    enemyTheme: ['Frostfire Elementals', 'Dualborn Giants', 'Chaos Beasts'],
    mechanic: 'elemental_conflict',
  },
  {
    id: 'the_world_serpents_pass', name: "The World Serpent's Pass", tier: 9,
    zoneLevelMin: 265, zoneLevelMax: 295, charLevelReq: 132,
    enemyTheme: ['Serpent Cultists', 'Scale Beasts', 'Venom Hydras'],
    mechanic: null,
  },
  {
    id: 'ruins_of_the_first_kingdom', name: 'Ruins of the First Kingdom', tier: 9,
    zoneLevelMin: 270, zoneLevelMax: 305, charLevelReq: 135,
    enemyTheme: ['Ancient Constructs', 'First Mages (undead)', 'Primordial Beasts'],
    mechanic: 'unstable_magic',
  },
  {
    id: 'the_bleeding_jungle', name: 'The Bleeding Jungle', tier: 9,
    zoneLevelMin: 260, zoneLevelMax: 290, charLevelReq: 130,
    enemyTheme: ['Carnivorous Treants', 'Vine Horrors', 'Jungle Fiends'],
    mechanic: null,
  },
  {
    id: 'godstone_peaks', name: 'Godstone Peaks', tier: 9,
    zoneLevelMin: 282, zoneLevelMax: 320, charLevelReq: 141,
    enemyTheme: ['Divine Constructs', "God-Touched Beasts", 'Fallen Angels'],
    mechanic: 'divine_ground',
  },
  {
    id: 'the_wailing_crypts', name: 'The Wailing Crypts', tier: 9,
    zoneLevelMin: 255, zoneLevelMax: 280, charLevelReq: 127,
    enemyTheme: ['Ancient Shades', 'Memory Constructs', 'Identity Wraiths'],
    mechanic: null,
    isCompanionZone: true,
  },

  // ── Tier 10 — The Final Frontier (Zone Level 321–400) ─────────────────────
  {
    id: 'the_dragon_emperors_throne', name: "The Dragon Emperor's Throne", tier: 10,
    zoneLevelMin: 321, zoneLevelMax: 350, charLevelReq: 160,
    enemyTheme: ["Dragon Emperor's Guard", 'Elder Dragons', 'Dragon Demigods'],
    mechanic: null,
  },
  {
    id: 'the_demon_lords_citadel', name: "The Demon Lord's Citadel", tier: 10,
    zoneLevelMin: 330, zoneLevelMax: 360, charLevelReq: 165,
    enemyTheme: ['Demon Lords', 'Arch-Fiends', 'Demon Warlords'],
    mechanic: 'hellfire',
  },
  {
    id: 'the_ancient_gods_rest', name: "The Ancient God's Rest", tier: 10,
    zoneLevelMin: 340, zoneLevelMax: 375, charLevelReq: 170,
    enemyTheme: ['Divine Remnants', "Sleeping God's Avatars", 'Faith Constructs'],
    mechanic: null,
  },
  {
    id: 'the_shattered_realm', name: 'The Shattered Realm', tier: 10,
    zoneLevelMin: 345, zoneLevelMax: 380, charLevelReq: 172,
    enemyTheme: ['Realm Shards', 'Fractured Titans', 'Reality Wardens'],
    mechanic: 'broken_physics',
  },
  {
    id: 'the_final_dungeon', name: 'The Final Dungeon', tier: 10,
    zoneLevelMin: 360, zoneLevelMax: 395, charLevelReq: 180,
    enemyTheme: ['Final Guardians', 'Legendary Undead', 'Chosen Enemies'],
    mechanic: null,
  },
  {
    id: 'the_worlds_edge', name: "The World's Edge", tier: 10,
    zoneLevelMin: 370, zoneLevelMax: 400, charLevelReq: 185,
    enemyTheme: ['Void Leviathans', 'Edge Walkers', 'World-Shards'],
    mechanic: 'void_exposure',
  },
  {
    id: 'the_undying_kings_domain', name: "The Undying King's Domain", tier: 10,
    zoneLevelMin: 325, zoneLevelMax: 355, charLevelReq: 162,
    enemyTheme: ["Undying King's Champions", 'Reaper Guards', 'Soul Wardens'],
    mechanic: null,
  },
];

// ── Challenge Zones (non-tiered, unlockable) ──────────────────────────────────
const CHALLENGE_ZONES = [
  {
    id: 'the_gauntlet', name: 'The Gauntlet', type: 'challenge',
    unlock: 'Reach character level 50',
    mechanic: 'all_elite_budget',
  },
  {
    id: 'the_proving_grounds', name: 'The Proving Grounds', type: 'challenge',
    unlock: 'Collect one full gear set',
    mechanic: 'no_gear_no_loot',
  },
  {
    id: 'one_hit_wonder', name: 'One Hit Wonder', type: 'challenge',
    unlock: 'Survive a fight at 1 HP',
    mechanic: 'both_1hp',
  },
  {
    id: 'the_attrition_run', name: 'The Attrition Run', type: 'challenge',
    unlock: 'Complete 10 full zone runs',
    mechanic: 'no_healing_25_floors',
  },
  {
    id: 'the_arena', name: 'The Arena', type: 'challenge',
    unlock: 'Win 100 combats',
    mechanic: 'wave_survival_50',
  },
];

// ── Companion Questline Zones ──────────────────────────────────────────────────
const QUESTLINE_ZONES = [
  {
    id: 'q1_sunhaven_meadows', name: 'Sunhaven Meadows', chapter: 1,
    zoneLevelMin: 5, zoneLevelMax: 12, charLevelReq: 5,
    enemyTheme: ['Bandits', 'Corrupted Scouts', 'A Familiar Face'],
  },
  {
    id: 'q2_the_broken_road', name: 'The Broken Road', chapter: 2,
    zoneLevelMin: 55, zoneLevelMax: 68, charLevelReq: 27,
    enemyTheme: ['Pursuers', 'Oath-Breakers', 'Memory Shades'],
  },
  {
    id: 'q3_starfall_crater', name: 'Starfall Crater', chapter: 3,
    zoneLevelMin: 115, zoneLevelMax: 128, charLevelReq: 57,
    enemyTheme: ['Celestial Remnants', 'Bound Guardians', 'A Truth Made Manifest'],
  },
  {
    id: 'q4_the_last_light', name: 'The Last Light', chapter: 4,
    zoneLevelMin: 200, zoneLevelMax: 218, charLevelReq: 100,
    enemyTheme: ['Corrupted Companions', 'The Weight of Choices'],
  },
  {
    id: 'q5_the_promise_fulfilled', name: 'The Promise Fulfilled', chapter: 5,
    zoneLevelMin: 295, zoneLevelMax: 320, charLevelReq: 147,
    enemyTheme: ['The Final Obstacle', 'Memory of the Beginning', 'The Answer'],
  },
];

// ── Room Weights ──────────────────────────────────────────────────────────────
// Weights are percentages (must sum to 100). Secret room is 3% per non-boss floor.
const ROOM_WEIGHTS = {
  monster:   45,
  treasure:  15,
  rest:      10,
  mini_boss: 10,
  merchant:   8,
  trap:       7,
  empty:      2,
  secret:     3,
};

// ── Boss Special Abilities ────────────────────────────────────────────────────
// 1–2 assigned per boss based on zone theme. See ENEMIES.md for rules.
const BOSS_ABILITIES = [
  { id: 'enrage',              name: 'Enrage',              description: 'At 50% HP, ATK permanently doubles.' },
  { id: 'shield_of_ages',      name: 'Shield of Ages',      description: 'At 75% HP, immune to all damage for 2 turns.' },
  { id: 'summon_minions',      name: 'Summon Minions',      description: 'Calls 2 minion-bracket enemies at fight start.' },
  { id: 'regeneration',        name: 'Regeneration',        description: 'Restores 5% max HP per turn.' },
  { id: 'curse_of_weakness',   name: 'Curse of Weakness',   description: 'Reduces player ATK by 30% for 5 turns.' },
  { id: 'arcane_veil',         name: 'Arcane Veil',         description: 'Every 3 turns, alternates physical/magical immunity.' },
  { id: 'cleave',              name: 'Cleave',              description: 'Once per fight, true damage (ignores all DEF).' },
  { id: 'life_drain',          name: 'Life Drain',          description: 'Each attack steals 10% of player current HP.' },
  { id: 'blood_rage',          name: 'Blood Rage',          description: 'Gains +5 ATK each turn it survives (no cap).' },
  { id: 'thorned_hide',        name: 'Thorned Hide',        description: 'Returns 25% of damage dealt back to attacker.' },
  { id: 'ancient_ward',        name: 'Ancient Ward',        description: 'Player can only act every other turn for 3 turns.' },
  { id: 'divine_smite',        name: 'Divine Smite',        description: 'Every 5 turns, 20% of boss max HP as true damage.' },
  { id: 'execute',             name: 'Execute',             description: 'If player HP < 20%, 25% chance instant kill. Player survives at 1 HP min.' },
  { id: 'petrify',             name: 'Petrify',             description: 'After hitting same target 3 consecutive turns, stun 2 turns.' },
  { id: 'death_rattle',        name: 'Death Rattle',        description: 'On death, triggers one final random ability.' },
  { id: 'overload',            name: 'Overload',            description: 'Winds up 1 turn, then 3× normal ATK next turn.' },
  { id: 'ancient_resilience',  name: 'Ancient Resilience',  description: 'Same attack type twice in a row: +10 DEF against it.' },
  { id: 'earth_binding',       name: 'Earth Binding',       description: 'All AGI-based bonuses reduced to 0 for the fight.' },
  { id: 'soul_brand',          name: 'Soul Brand',          description: "Reduces one equipped item's bonus stats by 50% until run ends." },
  { id: 'final_transformation',name: 'Final Transformation',description: 'At 25% HP, HP fully restores but all DEF set to 0.' },
];

// ── Scenario Keys ─────────────────────────────────────────────────────────────
// tier: 'high' = 40 responses, 'med' = 20 responses, 'low' = 10 responses
const SCENARIO_KEYS = {
  // COMBAT
  battle_start_minion:          { tier: 'high', description: 'Encounter begins vs Minion-tier enemy' },
  battle_start_soldier:         { tier: 'high', description: 'Encounter begins vs Soldier-tier enemy' },
  battle_start_elite:           { tier: 'high', description: 'Encounter begins vs Elite-tier enemy' },
  battle_start_champion:        { tier: 'high', description: 'Encounter begins vs Champion-tier enemy' },
  battle_start_boss:            { tier: 'high', description: 'Boss encounter begins' },
  battle_win:                   { tier: 'high', description: 'Standard enemy defeated' },
  battle_win_boss:              { tier: 'high', description: 'Boss defeated' },
  battle_win_shiny:             { tier: 'high', description: 'Shiny enemy defeated' },
  battle_win_streak_3:          { tier: 'high', description: 'Third consecutive kill without taking damage' },
  battle_win_streak_5:          { tier: 'high', description: 'Fifth consecutive kill without taking damage' },
  battle_win_perfect:           { tier: 'high', description: 'Enemy defeated without player taking any damage' },
  battle_lose:                  { tier: 'high', description: 'Player is defeated (HP reaches 0)' },
  battle_flee_success:          { tier: 'high', description: 'Player successfully flees' },
  battle_flee_fail:             { tier: 'high', description: "Player's flee attempt fails" },
  battle_crit_player:           { tier: 'high', description: 'Player lands a critical hit' },
  battle_crit_enemy:            { tier: 'high', description: 'Enemy lands a critical hit on player' },
  battle_companion_assist:      { tier: 'high', description: 'Companion assist fires' },
  battle_companion_assist_kill: { tier: 'high', description: 'Companion assist delivers the killing blow' },
  battle_companion_triple:      { tier: 'high', description: 'Companion assist fires on consecutive turns (CHA 50+)' },
  battle_near_death:            { tier: 'high', description: 'Player HP drops below 20%' },
  battle_iron_will_trigger:     { tier: 'high', description: 'Iron Will passive saves the player from death' },
  battle_status_bleed_applied:  { tier: 'high', description: 'Bleed status applied to enemy' },
  battle_status_stun_applied:   { tier: 'high', description: 'Enemy stunned' },
  battle_enemy_special_fires:   { tier: 'high', description: 'Enemy uses a special ability' },
  battle_first_hit_of_run:      { tier: 'high', description: 'Very first attack of a new run' },

  // LOOT
  loot_common:                    { tier: 'high', description: 'Common item drops' },
  loot_uncommon:                  { tier: 'high', description: 'Uncommon item drops' },
  loot_rare:                      { tier: 'med',  description: 'Rare item drops' },
  loot_epic:                      { tier: 'med',  description: 'Epic item drops' },
  loot_legendary:                 { tier: 'med',  description: 'Legendary item drops' },
  loot_set_piece_first:           { tier: 'med',  description: 'First-ever set piece found (any set)' },
  loot_set_piece_completing_2pc:  { tier: 'med',  description: 'Set piece that activates 2pc bonus' },
  loot_set_piece_completing_4pc:  { tier: 'med',  description: 'Set piece that activates 4pc bonus' },
  loot_set_piece_completing_6pc:  { tier: 'med',  description: 'Set piece that completes full set' },
  loot_shiny_drop:                { tier: 'med',  description: 'Drop from a shiny enemy' },
  chest_found_common:             { tier: 'med',  description: 'Treasure chest opens with common loot' },
  chest_found_uncommon:           { tier: 'med',  description: 'Treasure chest opens with uncommon loot' },
  chest_found_rare:               { tier: 'med',  description: 'Treasure chest opens with rare loot' },
  chest_found_epic:               { tier: 'med',  description: 'Treasure chest opens with epic loot' },
  chest_found_legendary:          { tier: 'med',  description: 'Treasure chest opens with legendary loot' },
  gold_found_small:               { tier: 'med',  description: 'Small gold pickup (< 100g)' },
  gold_found_medium:              { tier: 'med',  description: 'Medium gold pickup (100–500g)' },
  gold_found_large:               { tier: 'med',  description: 'Large gold pickup (500g+)' },
  inventory_full:                 { tier: 'med',  description: 'Player inventory is at max capacity' },
  item_sold:                      { tier: 'med',  description: 'Player sells an item at a merchant' },
  item_equipped_upgrade:          { tier: 'med',  description: 'New item equipped that is better than current' },
  item_identified:                { tier: 'med',  description: 'Unidentified item is identified' },

  // EXPLORATION
  zone_enter_tier1:             { tier: 'med', description: 'Entering a Tier 1 zone' },
  zone_enter_tier2:             { tier: 'med', description: 'Entering a Tier 2 zone' },
  zone_enter_tier3:             { tier: 'med', description: 'Entering a Tier 3 zone' },
  zone_enter_tier4:             { tier: 'med', description: 'Entering a Tier 4 zone' },
  zone_enter_tier5:             { tier: 'med', description: 'Entering a Tier 5 zone' },
  zone_enter_tier6:             { tier: 'med', description: 'Entering a Tier 6 zone' },
  zone_enter_tier7:             { tier: 'med', description: 'Entering a Tier 7 zone' },
  zone_enter_tier8:             { tier: 'med', description: 'Entering a Tier 8 zone' },
  zone_enter_tier9:             { tier: 'med', description: 'Entering a Tier 9 zone' },
  zone_enter_tier10:            { tier: 'med', description: 'Entering a Tier 10 zone' },
  zone_clear:                   { tier: 'med', description: 'Zone fully cleared (boss defeated)' },
  zone_first_clear:             { tier: 'med', description: 'Very first time this zone is cleared' },
  floor_advance:                { tier: 'high', description: 'Moving to the next floor' },
  floor_boss_imminent:          { tier: 'med', description: 'One floor before the boss' },
  floor_complete_no_damage:     { tier: 'med', description: 'Floor cleared without taking any damage' },
  room_rest:                    { tier: 'med', description: 'Rest room entered' },
  room_treasure:                { tier: 'med', description: 'Treasure room entered' },
  room_merchant:                { tier: 'med', description: 'Merchant room entered' },
  room_trap_triggered:          { tier: 'med', description: 'Trap fires' },
  room_trap_dodged:             { tier: 'med', description: 'Trap is successfully avoided' },
  room_empty:                   { tier: 'high', description: 'Empty room — nothing happens' },
  room_secret_found:            { tier: 'med', description: 'Secret room discovered' },
  run_start:                    { tier: 'med', description: 'Adventure run begins' },
  run_extract_success:          { tier: 'med', description: 'Player extracts from run with loot' },
  run_complete_boss:            { tier: 'med', description: 'Run completes by defeating the boss' },
  run_failed_death:             { tier: 'med', description: 'Run ends in player death' },
  shiny_enemy_appear:           { tier: 'med', description: 'Shiny enemy variant encountered' },

  // PROGRESSION
  level_up_1_10:       { tier: 'med', description: 'Leveling up in the 1–10 range' },
  level_up_11_25:      { tier: 'med', description: 'Leveling up in the 11–25 range' },
  level_up_26_50:      { tier: 'med', description: 'Leveling up in the 26–50 range' },
  level_up_51_75:      { tier: 'med', description: 'Leveling up in the 51–75 range' },
  level_up_76_100:     { tier: 'med', description: 'Leveling up in the 76–100 range' },
  level_up_101_150:    { tier: 'med', description: 'Leveling up in the 101–150 range' },
  level_up_151_200:    { tier: 'med', description: 'Leveling up in the 151–200 range (near cap)' },
  level_milestone_50:  { tier: 'low', description: 'Reaching level 50 exactly' },
  level_milestone_100: { tier: 'low', description: 'Reaching level 100 exactly' },
  level_milestone_200: { tier: 'low', description: 'Reaching level cap 200' },
  stat_point_str:      { tier: 'low', description: 'STR stat point allocated' },
  stat_point_int:      { tier: 'low', description: 'INT stat point allocated' },
  stat_point_agi:      { tier: 'low', description: 'AGI stat point allocated' },
  stat_point_vit:      { tier: 'low', description: 'VIT stat point allocated' },
  stat_point_lck:      { tier: 'low', description: 'LCK stat point allocated' },
  stat_point_cha:      { tier: 'low', description: 'CHA stat point allocated' },
  prestige_1:          { tier: 'low', description: 'First prestige achieved' },
  prestige_2:          { tier: 'low', description: 'Second prestige achieved' },
  prestige_3_plus:     { tier: 'low', description: 'Third or higher prestige' },
  first_legendary:     { tier: 'low', description: 'Very first legendary drop ever' },
  first_rare:          { tier: 'low', description: 'Very first rare drop ever' },
  first_epic:          { tier: 'low', description: 'Very first epic drop ever' },
  first_boss_kill:     { tier: 'low', description: 'Very first boss defeated' },
  first_shiny_kill:    { tier: 'low', description: 'Very first shiny enemy killed' },
  achievement_unlocked:{ tier: 'low', description: 'Achievement triggered' },

  // COMPANION
  bond_level_increase:          { tier: 'low', description: 'CHA/bond milestone reached' },
  bond_level_max:               { tier: 'low', description: 'Maximum bond level reached' },
  companion_assist_miss:        { tier: 'low', description: 'Companion assist attempted but missed' },
  companion_tanks_hit:          { tier: 'low', description: 'Companion intercepts a hit for the player' },
  companion_low_bond_warning:   { tier: 'low', description: 'Bond warning (future mechanic)' },
  zone_suggestion_offer:        { tier: 'low', description: 'Companion suggests a zone' },
  zone_suggestion_accepted:     { tier: 'low', description: "Player accepts companion's zone suggestion" },
  zone_suggestion_declined:     { tier: 'low', description: "Player declines companion's zone suggestion" },
  companion_comments_shiny:     { tier: 'low', description: 'Companion reacts to seeing a shiny enemy' },
  companion_comments_legendary: { tier: 'low', description: 'Companion reacts to a legendary drop' },
  companion_comments_boss_death:{ tier: 'low', description: 'Companion reacts to boss being killed' },
  companion_debrief_success:    { tier: 'low', description: 'End-of-run debrief after success' },
  companion_debrief_death:      { tier: 'low', description: 'End-of-run debrief after player death' },
  companion_debrief_extract:    { tier: 'low', description: 'End-of-run debrief after extraction' },
  daily_bonus_activated:        { tier: 'low', description: 'Daily first-run bonus fires' },
  long_absence_return:          { tier: 'low', description: 'Player returns after not playing for 3+ days' },

  // SPECIAL
  set_bonus_2pc:             { tier: 'low', description: '2-piece set bonus activates for first time this run' },
  set_bonus_4pc:             { tier: 'low', description: '4-piece set bonus activates' },
  set_bonus_6pc:             { tier: 'low', description: 'Full set bonus activates' },
  chaos_orb_fires:           { tier: 'low', description: 'Chaos Orb trinket triggers a random effect' },
  void_rune_banish:          { tier: 'low', description: 'Void Rune banishes an enemy instantly' },
  run_streak_3:              { tier: 'low', description: 'Third consecutive successful run' },
  run_streak_7:              { tier: 'low', description: 'Seventh consecutive successful run' },
  new_zone_tier_unlocked:    { tier: 'low', description: 'New zone tier becomes available' },
  challenge_zone_enter:      { tier: 'low', description: 'Player enters a challenge zone' },
  challenge_zone_clear:      { tier: 'low', description: 'Player clears a challenge zone' },
};

// Tier target response counts
const TIER_COUNTS = { high: 40, med: 20, low: 10 };

// Keys that bypass the stored pool and always call Claude fresh
const FORCE_CLAUDE_KEYS = new Set([
  'battle_win_boss',
  'loot_legendary',
  'first_legendary',
  'first_boss_kill',
  'prestige_1',
  'prestige_2',
  'prestige_3_plus',
  'level_milestone_200',
  'bond_level_max',
  'challenge_zone_clear',
]);

// ── Slot Stat Pools (which stats can roll on each slot) ───────────────────────
// Used by the loot generator to pick stats for a generated item.
const SLOT_STAT_POOLS = {
  weapon:  ['atk', 'str', 'int', 'lck', 'agi'],
  head:    ['int', 'agi', 'lck', 'str'],
  chest:   ['vit', 'def', 'str', 'int'],
  hands:   ['str', 'atk', 'lck', 'agi'],
  feet:    ['agi', 'vit', 'lck'],
  belt:    ['vit', 'str', 'lck', 'agi'],
  ring:    ['str', 'int', 'agi', 'vit', 'lck', 'cha'],
  amulet:  ['str', 'int', 'agi', 'vit', 'lck', 'cha'],
  trinket: ['str', 'int', 'agi', 'vit', 'lck', 'cha'],
};

// ── Item Name Generation Banks ────────────────────────────────────────────────
// Source: docs/rpg/GEAR_NAMES.md
const NAME_BANKS = {
  prefixes: {
    common:   ['Iron', 'Copper', 'Bronze', 'Wooden', 'Bone', 'Leather', 'Stone', 'Crude', 'Worn',
               'Sturdy', 'Sharp', 'Heavy', 'Light', 'Cracked', 'Weathered', 'Polished', 'Rough', 'Plain'],
    uncommon: ['Steel', 'Silver', 'Gilded', 'Runed', 'Carved', 'Blessed', 'Enchanted', 'Ancient', 'Cursed',
               'Shadow', 'Storm', 'Ember', 'Frost', "Veteran's", 'Thorned', 'Barbed', 'Hollow', 'Tempered'],
    rare:     ['Dragon-Forged', 'Void-Touched', 'Sacred', 'Arcane', 'Dread', 'Infernal', 'Seraphic', 'Runic',
               'Ancestral', 'Mystic', 'Dark', 'Crimson', 'Obsidian', 'Bone-Carved', 'Eldritch', "Warden's",
               'Death-Touched', 'Consecrated'],
    epic:     ['God-Forged', 'Primordial', 'Celestial', 'Eternal', 'Undying', 'World-Shatter',
               'Divine', 'Abyssal', 'Sovereign', 'Conquest', 'Last', 'Forsaken', 'Fallen',
               "Dragon-Emperor's", 'Void-Sovereign', "Godslayer's", 'First-Age', 'Tomb-Risen'],
  },
  suffixes: {
    common:   ['of the Wolf', 'of the Bear', 'of the Boar', 'of Strength', 'of the Hunt', 'of the Blade',
               'of the Road', 'of Endurance', 'of the Forest', 'of Stone', 'of Blood', 'of the Wanderer',
               'of the Frontier', 'of Iron', 'of Speed', 'of the Soldier', 'of the Watchman', 'of Ruin'],
    uncommon: ['of the Champion', 'of the Fallen', 'of the Wilds', 'of Valor', 'of Courage',
               'of Flame', 'of Frost', 'of Thunder', 'of the Depths', 'of the Night',
               'of the Mountains', 'of the Knight', 'of the Exile', 'of the Forsaken',
               'of the Ruin', 'of Ash', 'of the Blade-Saint', 'of the Old Kingdom'],
    rare:     ['of the Dragon', 'of the Abyss', 'of the Undying', 'of Ancient Kings', 'of Eternity',
               'of the Demon', 'of Sacred Flame', 'of the Warlord', 'of Twilight', 'of the Void',
               'of Slaughter', 'of the Pact', 'of the Elder Gods', 'of Lost Kingdoms', 'of Corruption',
               'of the Bound', 'of the Lich', 'of the Sunken King'],
    epic:     ["of the Ages", "of the World's End", 'of Transcendence', 'of the Final Frontier',
               "of Dragon's Wrath", 'of the Dying God', 'of the Undying King', 'of the Breaking World',
               'of the Eternal Flame', "of Creation's End", 'of the Conqueror', "of Dawn's Reckoning",
               'of the Last Stand', 'of the Elder World', 'of Infinite Sorrow', 'of the Shattered Realm',
               "of the God's Rest", 'of Oblivion'],
  },
  // Item types per gear slot — pulled from GEAR_NAMES.md
  itemTypes: {
    weapon:  ['Sword', 'Greatsword', 'Longsword', 'Dagger', 'Dirk', 'Axe', 'Greataxe', 'Hammer', 'Warhammer',
              'Spear', 'Halberd', 'Glaive', 'Staff', 'Wand', 'Tome', 'Grimoire', 'Bow', 'Longbow',
              'Crossbow', 'Scythe', 'Mace', 'Morningstar', 'Claws', 'Rapier', 'Falchion'],
    head:    ['Helm', 'Helmet', 'Crown', 'Circlet', 'Hood', 'Coif', 'Visor', 'Cap', 'Great Helm'],
    chest:   ['Plate Armor', 'Chainmail', 'Breastplate', 'Cuirass', 'Scale Mail', 'Brigandine',
              'Leather Jerkin', 'Robe', 'Vestment', 'Hauberk', 'Coat'],
    hands:   ['Gauntlets', 'Bracers', 'Gloves', 'Grips', 'Wraps', 'Vambraces'],
    feet:    ['Boots', 'Greaves', 'Sabatons', 'Treads', 'War Boots', 'Iron Boots'],
    belt:    ['Belt', 'Girdle', 'Sash', 'War Belt', 'Studded Belt'],
    ring:    ['Ring', 'Band', 'Signet Ring', 'Seal Ring', 'Carved Ring'],
    amulet:  ['Amulet', 'Pendant', 'Necklace', 'Torc', 'Talisman', 'Medallion'],
    trinket: ['Trinket', 'Charm', 'Relic', 'Fetish', 'Sigil Stone', 'Focus Crystal', 'Ancient Coin', 'Runed Token'],
  },
};

// ── Random Boss Name Parts (every 3rd boss is procedurally named) ─────────────
// Source: docs/rpg/ENEMIES.md "Random Boss Generator"
const BOSS_NAME_PARTS = {
  honorifics: ['Ancient', 'Cursed', 'Fallen', 'Undying', 'Dread', 'Elder', 'Forsaken', 'Hollow',
               'Vile', 'Corrupted', 'Grim', 'The Last', 'Blood-Soaked', 'Iron', 'Pale'],
  names:      ['Gorrath', 'Malvek', 'Skareth', 'Vargos', 'Thraxis', 'Keldros', 'Morven', 'Ashrak',
               'Zervian', 'Caldrath', 'Vexis', 'Korroth', 'Sindrak', 'Dravos', 'Relthar', 'Vorath',
               'Grimbane', 'Phareth', 'Caldor', 'Morvex', 'Therin', 'Elrath', 'Durash', 'Zareth',
               'Hexan', 'Valkor', 'Skallen', 'Morten', 'Umbral', 'Draeven'],
  titles:     ['the Unyielding', 'the Betrayer', 'Blood-Drinker', 'of the Deep', 'the Forgotten',
               'Iron-Bone', 'Grave-Walker', 'Soul-Eater', 'the Corrupted', 'the Undying',
               'Stone-Heart', 'of the Abyss', 'the Shattered', 'the Ancient', 'of Eternal Night',
               'the Relentless', 'Pale-King', 'Ash-Born', 'Storm-Caller', 'the Forsaken'],
};

// ── Runtime Enemy Name Generation Data ───────────────────────────────────────
// Source: docs/rpg/ENEMIES.md "Enemy Naming Conventions"
const ENEMY_NAME_DATA = {
  tierPrefixes: {
    1:  ['Forest', 'Hill', 'Cave', 'Wild', 'Marsh', 'Beach', 'Shore', 'Hollow'],
    2:  ['Cursed', 'Darkling', 'Fell', 'Blood', 'Dire', 'Iron', 'Stone', 'Bog'],
    3:  ['Shadow', 'Void-Touched', 'Wrath', 'Dread', 'Vile', 'Bone', 'Spectral'],
    4:  ['Shadow', 'Dread', 'Vile', 'Bone', 'Spectral', 'Ruined', 'Forsaken'],
    5:  ['Elder', 'Forsaken', 'Corrupted', 'Eternal', 'Grim', 'Lost', 'Pale'],
    6:  ['Elder', 'Forsaken', 'Corrupted', 'Eternal', 'Grim', 'Sunken'],
    7:  ['Elder', 'Forsaken', 'Corrupted', 'Eternal', 'Grim', 'Lost', 'Pale', 'Sunken'],
    8:  ['Undying', 'Primordial', 'Abyssal', 'Elder', 'God-Touched'],
    9:  ['Undying', 'Primordial', 'Abyssal', 'God-Touched', 'True', 'Final'],
    10: ['Undying', 'Primordial', 'Abyssal', 'God-Touched', 'Ascendant', 'True', 'Final'],
  },
  archetypeWords: ['Knight', 'Warrior', 'Hunter', 'Walker', 'Stalker', 'Shade', 'Warden', 'Guardian',
                   'Ravager', 'Slayer', 'Reaper', 'Specter', 'Spawn', 'Golem', 'Horror', 'Beast',
                   'Wraith', 'Brute', 'Drake', 'Fiend', 'Broodling', 'Sentinel', 'Marauder', 'Revenant'],
  suffixes: ['the Ancient', 'the Fallen', 'the Forsaken', 'the Unyielding', 'the Eternal',
             'Bonecrusher', 'Ironside', 'Skullcleave', 'Darkbane', 'Doomhide', 'the Cursed',
             'Ashborn', 'the Relentless', 'the Hollow'],
};

module.exports = {
  BRACKETS,
  ARCHETYPE_DISTRIBUTIONS,
  GEAR_SLOTS,
  RARITY_BASE_WEIGHTS,
  RARITY_MULT,
  RARITY_STAT_COUNT,
  RARITY_BASE_VALUE,
  STAT_DEFINITIONS,
  TIER_TABLE,
  ZONES,
  CHALLENGE_ZONES,
  QUESTLINE_ZONES,
  ROOM_WEIGHTS,
  BOSS_ABILITIES,
  SCENARIO_KEYS,
  TIER_COUNTS,
  FORCE_CLAUDE_KEYS,
  SLOT_STAT_POOLS,
  NAME_BANKS,
  BOSS_NAME_PARTS,
  ENEMY_NAME_DATA,
};
