// Post-processing for assets/monsters/*.png.
//
// For each sprite tile produced by slice-monster-grid.js, this script:
//   1. Detects and blanks any perfectly-horizontal/vertical white gridline
//      pixels at the image edges (a stray fragment of the source grid).
//   2. Finds the bottom name-label block (e.g. "GOBLIN", "17. LICH") by
//      locating the bottommost contiguous content rows that are separated
//      from the monster art above by a gap of empty rows, and blanks it.
//   3. Computes the bounding box of the remaining white line-art and
//      re-centers it inside the original frame (same WxH, black background).
//
// Idempotent: a second run on already-cleaned output is a no-op (no
// gridlines on the edges, no label block satisfying the size+position guard).
//
// Usage: node scripts/clean-monster-sprites.js [file ...]
//   With no args, processes every PNG in assets/monsters/.
//   With one or more paths, processes just those files.

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const MON_DIR = path.join(__dirname, '..', 'assets', 'monsters');

// Tunables
const BRIGHT_THRESH         = 50;   // pixel max(r,g,b) > this => "content" (line-art)
const EDGE_LINE_SCAN_FRAC   = 0.10; // scan outer 10% of W/H from each edge for thin lines
const EDGE_LINE_FILL_FRAC   = 0.85; // a thin gridline row/col must be >=85% content
const GRIDLINE_BLANK_RADIUS = 2;    // blank ±2 cols/rows around each detected gridline (catches AA)
const EMPTY_ROW_MAX_CONTENT = 3;    // strict empty-row threshold (pass 1)
const EMPTY_ROW_MAX_CONTENT_LENIENT = 15; // lenient threshold (pass 2 fallback)
const LABEL_GAP_MIN_ROWS    = 3;    // pass 1 requires >=3 empty rows above label
const LABEL_TOP_MIN_FRAC          = 0.78; // label block's top edge must be at >=78% down
const LABEL_BOT_MIN_FRAC_STRICT   = 0.85; // strict pass: label bottom must be at >=85% down
const LABEL_BOT_MIN_FRAC_LENIENT  = 0.92; // lenient pass: label bottom must be at >=92% down (tighter, to reject false positives on already-centered bodies)
const LABEL_MAX_BLOCK_FRAC        = 0.20; // label block height <=20% of image height

async function cleanSprite(filePath) {
  const meta = await sharp(filePath).metadata();
  const W = meta.width;
  const H = meta.height;
  const C = 4;

  const { data } = await sharp(filePath).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const buf = Buffer.from(data); // mutable working copy

  const idxOf = (x, y) => (y * W + x) * C;
  const brightAt = (x, y) => {
    const i = idxOf(x, y);
    return Math.max(buf[i], buf[i + 1], buf[i + 2]);
  };
  const blank = (x, y) => {
    const i = idxOf(x, y);
    buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 255;
  };

  const rowCount = (y) => {
    let c = 0;
    for (let x = 0; x < W; x++) if (brightAt(x, y) > BRIGHT_THRESH) c++;
    return c;
  };
  const colCount = (x) => {
    let c = 0;
    for (let y = 0; y < H; y++) if (brightAt(x, y) > BRIGHT_THRESH) c++;
    return c;
  };

  // ── Step 1: Blank edge gridlines ───────────────────────────────────────
  // Scan the outer ~10% of each side for thin near-full horizontal/vertical
  // lines (gridline fragments left over from the source grid — these can land
  // a few pixels inside the edge depending on how the slicer rounded). Use a
  // high fill threshold so monster strokes don't get mistaken for gridlines,
  // then blank ±GRIDLINE_BLANK_RADIUS around each detected line to mop up AA.
  const xBand = Math.max(2, Math.ceil(W * EDGE_LINE_SCAN_FRAC));
  const yBand = Math.max(2, Math.ceil(H * EDGE_LINE_SCAN_FRAC));

  const gridCols = new Set();
  for (let x = 0; x < xBand; x++) {
    if (colCount(x) >= H * EDGE_LINE_FILL_FRAC) gridCols.add(x);
  }
  for (let x = W - xBand; x < W; x++) {
    if (colCount(x) >= H * EDGE_LINE_FILL_FRAC) gridCols.add(x);
  }
  const gridRows = new Set();
  for (let y = 0; y < yBand; y++) {
    if (rowCount(y) >= W * EDGE_LINE_FILL_FRAC) gridRows.add(y);
  }
  for (let y = H - yBand; y < H; y++) {
    if (rowCount(y) >= W * EDGE_LINE_FILL_FRAC) gridRows.add(y);
  }

  const blankCols = new Set();
  for (const x of gridCols) {
    for (let d = -GRIDLINE_BLANK_RADIUS; d <= GRIDLINE_BLANK_RADIUS; d++) {
      if (x + d >= 0 && x + d < W) blankCols.add(x + d);
    }
  }
  const blankRows = new Set();
  for (const y of gridRows) {
    for (let d = -GRIDLINE_BLANK_RADIUS; d <= GRIDLINE_BLANK_RADIUS; d++) {
      if (y + d >= 0 && y + d < H) blankRows.add(y + d);
    }
  }
  for (const x of blankCols) for (let y = 0; y < H; y++) blank(x, y);
  for (const y of blankRows) for (let x = 0; x < W; x++) blank(x, y);

  // ── Step 2: Detect and blank the bottom name-label ─────────────────────
  // Two passes: strict (empty=count<=3, gap>=3) handles the typical case where
  // the monster art has a clear gap above the label. Lenient fallback
  // (empty=count<=15, gap>=1) catches cases where a monster's club/limb is
  // touching the label with only a thin valley between them (e.g., ogre,
  // troll). The position+size constraints (label top in bottom 22%, block
  // height <=20% of H) prevent false positives on already-centered images
  // and on monsters whose body extends to the bottom edge.
  const rowCounts = new Int32Array(H);
  for (let y = 0; y < H; y++) rowCounts[y] = rowCount(y);

  let labelBlanked = false;
  let labelPass = null;
  for (const pass of [
    { name: 'strict',  emptyMax: EMPTY_ROW_MAX_CONTENT,        gapMin: LABEL_GAP_MIN_ROWS, botMinFrac: LABEL_BOT_MIN_FRAC_STRICT  },
    { name: 'lenient', emptyMax: EMPTY_ROW_MAX_CONTENT_LENIENT, gapMin: 1,                   botMinFrac: LABEL_BOT_MIN_FRAC_LENIENT },
  ]) {
    if (labelBlanked) break;
    const isEmpty = (y) => rowCounts[y] <= pass.emptyMax;

    let bottomRow = H - 1;
    while (bottomRow >= 0 && isEmpty(bottomRow)) bottomRow--;
    if (bottomRow < 0) continue;

    let topOfBlock = bottomRow;
    while (topOfBlock > 0 && !isEmpty(topOfBlock - 1)) topOfBlock--;

    let gapSize = 0;
    let k = topOfBlock - 1;
    while (k >= 0 && isEmpty(k)) { gapSize++; k--; }

    const blockHeight = bottomRow - topOfBlock + 1;
    if (gapSize >= pass.gapMin &&
        topOfBlock >= H * LABEL_TOP_MIN_FRAC &&
        bottomRow >= H * pass.botMinFrac &&
        blockHeight <= H * LABEL_MAX_BLOCK_FRAC) {
      // Blank from the top of the label block all the way to the bottom edge —
      // anything in that region is either label text or sub-threshold AA tails
      // from letter descenders/baselines, neither of which we want to keep.
      for (let y = topOfBlock; y < H; y++) {
        for (let x = 0; x < W; x++) blank(x, y);
        rowCounts[y] = 0;
      }
      labelBlanked = true;
      labelPass = pass.name;
    }
  }

  // ── Step 3: Bounding box of what's left ────────────────────────────────
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (brightAt(x, y) > BRIGHT_THRESH) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    return { ok: false, reason: 'no content after cleanup' };
  }

  // ── Step 4: Centered output ────────────────────────────────────────────
  const bbW = maxX - minX + 1;
  const bbH = maxY - minY + 1;
  const offX = Math.floor((W - bbW) / 2);
  const offY = Math.floor((H - bbH) / 2);

  const out = Buffer.alloc(W * H * C);
  for (let p = 0; p < W * H; p++) {
    out[p * C] = 0; out[p * C + 1] = 0; out[p * C + 2] = 0; out[p * C + 3] = 255;
  }
  for (let dy = 0; dy < bbH; dy++) {
    for (let dx = 0; dx < bbW; dx++) {
      const sI = ((minY + dy) * W + (minX + dx)) * C;
      const dI = ((offY + dy) * W + (offX + dx)) * C;
      out[dI] = buf[sI]; out[dI + 1] = buf[sI + 1];
      out[dI + 2] = buf[sI + 2]; out[dI + 3] = buf[sI + 3];
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: C } }).png().toFile(filePath);
  return {
    ok: true,
    grid: { cols: [...gridCols].sort((a, b) => a - b), rows: [...gridRows].sort((a, b) => a - b) },
    labelBlanked,
    labelPass,
    bbox: { w: bbW, h: bbH },
    offset: { x: offX, y: offY },
  };
}

async function cleanDirectory(files) {
  let okCount = 0;
  for (const p of files) {
    const name = path.basename(p);
    const r = await cleanSprite(p);
    if (r.ok) {
      okCount++;
      const g = r.grid;
      const gridNote = (g.cols.length + g.rows.length) > 0
        ? `grid(cols=[${g.cols.join(',')}] rows=[${g.rows.join(',')}])`
        : 'grid(clean)';
      const labelNote = r.labelBlanked ? `label(${r.labelPass})` : 'no-label';
      console.log(`[cleaner] ${name.padEnd(20)} ${gridNote.padEnd(40)} ${labelNote.padEnd(13)} bbox=${r.bbox.w}x${r.bbox.h} off=(${r.offset.x},${r.offset.y})`);
    } else {
      console.warn(`[cleaner] ${name}: ${r.reason}`);
    }
  }
  return okCount;
}

async function main() {
  const argFiles = process.argv.slice(2);
  let files;
  if (argFiles.length > 0) {
    files = argFiles.map((f) => path.isAbsolute(f) ? f : path.join(process.cwd(), f));
  } else {
    files = fs.readdirSync(MON_DIR)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => path.join(MON_DIR, f));
  }

  const okCount = await cleanDirectory(files);
  console.log(`[cleaner] done — ${okCount}/${files.length} sprites processed`);
}

module.exports = { cleanSprite, cleanDirectory };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
