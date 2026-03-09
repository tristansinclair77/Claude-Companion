'use strict';
const fs = require('fs');
const path = require('path');

const FILE_PATH = path.resolve(
  __dirname,
  '../tools/pixel-art-editor/saves/bg_mountain.json'
);

// --- helpers ----------------------------------------------------------------

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function isLetterPixel(r, g, b, x, y) {
  if (y < 60 || y > 165) return false;
  return r > 200 && (r - b) > 30 && r > (g - 40);
}

// --- load -------------------------------------------------------------------

const raw = fs.readFileSync(FILE_PATH, 'utf8');
const data = JSON.parse(raw);
const frame = data.frames[0];

// Build coord map: key -> [r,g,b]  (kept as mutable array for filling)
const pixelMap = new Map();
for (const [key, hex] of Object.entries(frame)) {
  pixelMap.set(key, hexToRgb(hex));
}

// --- identify holes ---------------------------------------------------------

const holes = new Set();
for (const [key, [r, g, b]] of pixelMap) {
  const [x, y] = key.split(',').map(Number);
  if (isLetterPixel(r, g, b, x, y)) {
    holes.add(key);
  }
}

const totalLetterPixels = holes.size;
console.log(`Letter pixels found: ${totalLetterPixels}`);

if (totalLetterPixels === 0) {
  console.log('Nothing to inpaint.');
  process.exit(0);
}

// --- iterative inpainting ---------------------------------------------------

const DELTAS_8 = [
  [-1,-1],[ 0,-1],[1,-1],
  [-1, 0],        [1, 0],
  [-1, 1],[ 0, 1],[1, 1],
];

// Extended radius-3 neighbours (all offsets within Chebyshev distance 3)
const DELTAS_R3 = [];
for (let dy = -3; dy <= 3; dy++) {
  for (let dx = -3; dx <= 3; dx++) {
    if (dx === 0 && dy === 0) continue;
    DELTAS_R3.push([dx, dy]);
  }
}

let remainingHoles = new Set(holes);
let passesNeeded = 0;
let totalFilled = 0;

for (let pass = 0; pass < 50 && remainingHoles.size > 0; pass++) {
  passesNeeded++;
  const filledThisPass = new Map(); // key -> [r,g,b]

  for (const key of remainingHoles) {
    const [x, y] = key.split(',').map(Number);

    // Try 8-neighbors first, then radius-3 if none found
    let neighbors = [];
    for (const [dx, dy] of DELTAS_8) {
      const nk = `${x + dx},${y + dy}`;
      if (!remainingHoles.has(nk) && pixelMap.has(nk)) {
        neighbors.push(pixelMap.get(nk));
      }
    }

    if (neighbors.length === 0) {
      for (const [dx, dy] of DELTAS_R3) {
        const nk = `${x + dx},${y + dy}`;
        if (!remainingHoles.has(nk) && pixelMap.has(nk)) {
          neighbors.push(pixelMap.get(nk));
        }
      }
    }

    if (neighbors.length > 0) {
      const avgR = neighbors.reduce((s, c) => s + c[0], 0) / neighbors.length;
      const avgG = neighbors.reduce((s, c) => s + c[1], 0) / neighbors.length;
      const avgB = neighbors.reduce((s, c) => s + c[2], 0) / neighbors.length;
      filledThisPass.set(key, [avgR, avgG, avgB]);
    }
  }

  // Commit fills
  for (const [key, color] of filledThisPass) {
    pixelMap.set(key, color);
    remainingHoles.delete(key);
    totalFilled++;
  }

  console.log(`  Pass ${passesNeeded}: filled ${filledThisPass.size} pixels (${remainingHoles.size} remaining)`);
}

if (remainingHoles.size > 0) {
  console.warn(`WARNING: ${remainingHoles.size} holes could not be filled after 50 passes.`);
}

// --- rebuild frame ----------------------------------------------------------

const newFrame = {};
for (const [key, hex] of Object.entries(frame)) {
  if (pixelMap.has(key)) {
    const [r, g, b] = pixelMap.get(key);
    newFrame[key] = rgbToHex(r, g, b);
  } else {
    newFrame[key] = hex;
  }
}

data.frames[0] = newFrame;

// --- write ------------------------------------------------------------------

fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');

console.log(`\nDone.`);
console.log(`  Letter pixels found : ${totalLetterPixels}`);
console.log(`  Passes needed       : ${passesNeeded}`);
console.log(`  Pixels filled       : ${totalFilled}`);
console.log(`  Unfilled remaining  : ${remainingHoles.size}`);
console.log(`  Written to          : ${FILE_PATH}`);
