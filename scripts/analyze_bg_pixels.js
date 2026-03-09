const fs = require('fs');
const path = require('path');

const FILE = 'd:/Visual Studio Code Projects/Claude-Companion/tools/pixel-art-editor/saves/bg_mountain.json';

// --- Load JSON ---
const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const { width, height, frames } = raw;
const frameData = frames[0];

console.log(`Loaded: ${width}x${height}, ${Object.keys(frameData).length} pixels in frame 0\n`);

// --- Build 2D grid ---
// grid[y][x] = '#rrggbb' or null
const grid = [];
for (let y = 0; y < height; y++) {
  grid.push(new Array(width).fill(null));
}

for (const [key, color] of Object.entries(frameData)) {
  const [x, y] = key.split(',').map(Number);
  if (x >= 0 && x < width && y >= 0 && y < height) {
    grid[y][x] = color.toLowerCase();
  }
}

// --- Color parsing helpers ---
function hexToRgb(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0]+h[0], 16),
      parseInt(h[1]+h[1], 16),
      parseInt(h[2]+h[2], 16)
    ];
  }
  return [
    parseInt(h.slice(0,2), 16),
    parseInt(h.slice(2,4), 16),
    parseInt(h.slice(4,6), 16)
  ];
}

function euclidean(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}

// --- Compute outliers ---
const THRESHOLD = 60;
const outlierPixels = []; // { x, y, color }
const neighborDirs = [
  [-1,-1],[-1,0],[-1,1],
  [ 0,-1],       [ 0,1],
  [ 1,-1],[ 1,0],[ 1,1]
];

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const color = grid[y][x];
    if (!color) continue;
    const rgb = hexToRgb(color);
    if (!rgb) continue;

    // Gather neighbor colors
    const neighborRgbs = [];
    for (const [dy, dx] of neighborDirs) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
      const nc = grid[ny][nx];
      if (!nc) continue;
      const nrgb = hexToRgb(nc);
      if (nrgb) neighborRgbs.push(nrgb);
    }

    if (neighborRgbs.length === 0) continue;

    // Average neighbor color
    const avg = [0, 0, 0];
    for (const n of neighborRgbs) {
      avg[0] += n[0];
      avg[1] += n[1];
      avg[2] += n[2];
    }
    avg[0] /= neighborRgbs.length;
    avg[1] /= neighborRgbs.length;
    avg[2] /= neighborRgbs.length;

    const dist = euclidean(rgb, avg);
    if (dist > THRESHOLD) {
      outlierPixels.push({ x, y, color });
    }
  }
}

console.log(`Total outlier pixels (distance > ${THRESHOLD}): ${outlierPixels.length}\n`);

// --- Group outliers by color ---
const outlierByColor = new Map();
for (const { x, y, color } of outlierPixels) {
  if (!outlierByColor.has(color)) {
    outlierByColor.set(color, { count: 0, minX: x, maxX: x, minY: y, maxY: y });
  }
  const entry = outlierByColor.get(color);
  entry.count++;
  if (x < entry.minX) entry.minX = x;
  if (x > entry.maxX) entry.maxX = x;
  if (y < entry.minY) entry.minY = y;
  if (y > entry.maxY) entry.maxY = y;
}

// --- Total pixels by color ---
const totalByColor = new Map();
for (const color of Object.values(frameData)) {
  const c = color.toLowerCase();
  totalByColor.set(c, (totalByColor.get(c) || 0) + 1);
}

// --- Sort outlier groups by count descending ---
const sortedOutliers = [...outlierByColor.entries()].sort((a, b) => b[1].count - a[1].count);

console.log('=== OUTLIER COLOR CLUSTERS (sorted by outlier pixel count) ===');
console.log('Color       | Outlier# | Total#  | BBox (x0,y0)-(x1,y1)      | W x H');
console.log('------------|----------|---------|---------------------------|-------');
for (const [color, e] of sortedOutliers) {
  const total = totalByColor.get(color) || 0;
  const bw = e.maxX - e.minX + 1;
  const bh = e.maxY - e.minY + 1;
  const rgb = hexToRgb(color);
  const rgbStr = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : '';
  console.log(
    `${color.padEnd(11)} | ${String(e.count).padStart(8) } | ${String(total).padStart(7)} | (${e.minX},${e.minY})-(${e.maxX},${e.maxY}) bbox ${bw}x${bh} | ${rgbStr}`
  );
}

// --- Top 20 most common colors overall ---
const sortedTotal = [...totalByColor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

console.log('\n=== TOP 20 MOST COMMON COLORS OVERALL ===');
console.log('Rank | Color       | Count   | rgb()');
console.log('-----|-------------|---------|------');
for (let i = 0; i < sortedTotal.length; i++) {
  const [color, count] = sortedTotal[i];
  const rgb = hexToRgb(color);
  const rgbStr = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : '';
  console.log(`${String(i+1).padStart(4)} | ${color.padEnd(11)} | ${String(count).padStart(7)} | ${rgbStr}`);
}
