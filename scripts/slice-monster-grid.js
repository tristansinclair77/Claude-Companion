// One-shot slicer: cuts ref/monster grid.png into 16 transparent PNG tiles
// under assets/monsters/. Run once; commit the output. Re-run if the source
// grid art changes.

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const SRC = path.join(__dirname, '..', 'ref', 'monster grid.png');
const OUT = path.join(__dirname, '..', 'assets', 'monsters');

// Reading order: left-to-right, top-to-bottom — matches the source art.
const LABELS = [
  'goblin',    'giant_bug',  'ogre',      'bandit',
  'living_tree','mimic_chest','skeleton',  'slime',
  'wolf',      'harpy',      'dark_mage', 'wraith',
  'minotaur',  'gargoyle',   'zombie',    'kobold',
];

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Source grid not found:', SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const meta = await sharp(SRC).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log(`[slicer] source: ${W} x ${H}`);

  // Cells are width/4 wide and height/4 tall. The source is 1254x1254, so the
  // cells are 313.5px — distribute the residual pixel by rounding edges so the
  // whole image is covered without overlap or gaps.
  const edgeX = [0, 1, 2, 3, 4].map((i) => Math.round((i * W) / 4));
  const edgeY = [0, 1, 2, 3, 4].map((i) => Math.round((i * H) / 4));

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const idx = row * 4 + col;
      const slug = LABELS[idx];
      const x = edgeX[col];
      const y = edgeY[row];
      const w = edgeX[col + 1] - x;
      const h = edgeY[row + 1] - y;
      const dst = path.join(OUT, `${slug}.png`);
      await sharp(SRC).extract({ left: x, top: y, width: w, height: h }).png().toFile(dst);
      console.log(`[slicer] ${slug.padEnd(12)} ${w}x${h} -> ${path.relative(process.cwd(), dst)}`);
    }
  }
  console.log('[slicer] done — 16 tiles written to', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
