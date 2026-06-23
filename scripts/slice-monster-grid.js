// One-shot slicer: cuts each ref/monster grid*.png into 16 transparent PNG
// tiles under assets/monsters/. Run once; commit the output. Re-run if the
// source grid art changes or new grids are added.

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const REF = path.join(__dirname, '..', 'ref');
const OUT = path.join(__dirname, '..', 'assets', 'monsters');

// Each entry: { src: <png filename in ref/>, labels: 16 slugs reading left-to-right,
// top-to-bottom, matching the source art layout. }
const GRIDS = [
  {
    src: 'monster grid.png',
    labels: [
      'goblin',     'giant_bug',   'ogre',        'bandit',
      'living_tree','mimic_chest', 'skeleton',    'slime',
      'wolf',       'harpy',       'dark_mage',   'wraith',
      'minotaur',   'gargoyle',    'zombie',      'kobold',
    ],
  },
  {
    src: 'monster grid (1).png',
    labels: [
      'orc',            'troll',     'witch',       'vampire',
      'werewolf',       'dark_knight','necromancer','assassin',
      'giant_scorpion', 'dire_bear', 'giant_bat',   'basilisk',
      'manticore',      'chimera',   'giant_crab',  'giant_rat',
    ],
  },
  {
    src: 'monster grid (2).png',
    labels: [
      'giant_mushroom', 'venus_flytrap',  'vine_creature', 'thorn_beast',
      'spore_pod',      'sea_serpent',    'giant_jellyfish','merfolk',
      'giant_eel',      'piranha_swarm',  'crab_warrior',  'kappa',
      'scarecrow',      'possessed_doll', 'animated_sword','stone_statue',
    ],
  },
  {
    src: 'monster grid (3).png',
    labels: [
      'giant_frog',     'giant_lizard',  'giant_snail',  'giant_wasp',
      'giant_moth',     'giant_leech',   'bat_swarm',    'rat_swarm',
      'skeleton_archer','zombie_horde',  'imp',          'cultist',
      'pirate',         'poacher',       'mercenary',    'cave_dweller',
    ],
  },
  {
    src: 'monster grid (4).png',
    labels: [
      'lich',           'ghoul',         'revenant',     'bone_dragon',
      'mummy',          'phantom',       'fire_elemental','ice_elemental',
      'storm_elemental','earth_golem',   'shadow_demon', 'griffin',
      'medusa',         'cyclops',       'hydra',        'wyvern',
    ],
  },
];

async function sliceGrid({ src, labels }) {
  const srcPath = path.join(REF, src);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[slicer] skipping missing source: ${src}`);
    return 0;
  }
  if (labels.length !== 16) {
    throw new Error(`[slicer] grid ${src} has ${labels.length} labels (expected 16)`);
  }

  const meta = await sharp(srcPath).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log(`[slicer] ${src}: ${W} x ${H}`);

  // Cells are width/4 wide and height/4 tall. Distribute residual pixels by
  // rounding edges so the whole image is covered without overlap or gaps.
  const edgeX = [0, 1, 2, 3, 4].map((i) => Math.round((i * W) / 4));
  const edgeY = [0, 1, 2, 3, 4].map((i) => Math.round((i * H) / 4));

  let written = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const slug = labels[row * 4 + col];
      const x = edgeX[col];
      const y = edgeY[row];
      const w = edgeX[col + 1] - x;
      const h = edgeY[row + 1] - y;
      const dst = path.join(OUT, `${slug}.png`);
      await sharp(srcPath).extract({ left: x, top: y, width: w, height: h }).png().toFile(dst);
      console.log(`[slicer]   ${slug.padEnd(16)} ${w}x${h} -> ${path.relative(process.cwd(), dst)}`);
      written++;
    }
  }
  return written;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // Sanity: every slug must be unique across all grids.
  const seen = new Map();
  for (const g of GRIDS) {
    for (const s of g.labels) {
      if (seen.has(s)) {
        throw new Error(`[slicer] duplicate slug "${s}" in ${g.src} and ${seen.get(s)}`);
      }
      seen.set(s, g.src);
    }
  }

  let total = 0;
  for (const g of GRIDS) {
    total += await sliceGrid(g);
  }
  console.log(`[slicer] done — ${total} tiles written to ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
