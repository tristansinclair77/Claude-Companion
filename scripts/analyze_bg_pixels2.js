const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('d:/Visual Studio Code Projects/Claude-Companion/tools/pixel-art-editor/saves/bg_mountain.json','utf8'));
const { width, height, frames } = raw;
const frameData = frames[0];

function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// --- Warm/cream colors (potential text: R>200, G>180, 130<B<220) ---
const warmByColor = new Map();
for (const [key, color] of Object.entries(frameData)) {
  const c = color.toLowerCase();
  const rgb = hexToRgb(c);
  if (rgb[0] > 200 && rgb[1] > 180 && rgb[2] > 130 && rgb[2] < 220) {
    const [x, y] = key.split(',').map(Number);
    if (!warmByColor.has(c)) warmByColor.set(c, { count:0, minX:x, maxX:x, minY:y, maxY:y });
    const e = warmByColor.get(c);
    e.count++;
    if (x < e.minX) e.minX = x; if (x > e.maxX) e.maxX = x;
    if (y < e.minY) e.minY = y; if (y > e.maxY) e.maxY = y;
  }
}

console.log('=== WARM/CREAM COLORS (potential text, top 30 by count) ===');
const sortedWarm = [...warmByColor.entries()].sort((a,b) => b[1].count - a[1].count);
for (const [color, e] of sortedWarm.slice(0, 30)) {
  const rgb = hexToRgb(color);
  const bw = e.maxX - e.minX + 1, bh = e.maxY - e.minY + 1;
  console.log(color + ' | count=' + e.count + ' | bbox (' + e.minX + ',' + e.minY + ')-(' + e.maxX + ',' + e.maxY + ') ' + bw + 'x' + bh + ' | rgb(' + rgb.join(',') + ')');
}

// --- Y-row distribution of #fcf1d3 (rank 6 overall, 1888 pixels) ---
console.log('\n=== Y-ROW DISTRIBUTION of #fcf1d3 (1888 px) ===');
const rowCounts = new Map();
const xByRow = new Map();
for (const [key, color] of Object.entries(frameData)) {
  if (color.toLowerCase() === '#fcf1d3') {
    const [x, y] = key.split(',').map(Number);
    rowCounts.set(y, (rowCounts.get(y) || 0) + 1);
    if (!xByRow.has(y)) xByRow.set(y, []);
    xByRow.get(y).push(x);
  }
}
const rows = [...rowCounts.entries()].sort((a,b) => a[0] - b[0]);
for (const [y, count] of rows) {
  const xs = xByRow.get(y).sort((a,b) => a-b);
  console.log('  y=' + String(y).padStart(3) + ': ' + String(count).padStart(4) + ' px | x=[' + xs[0] + '..' + xs[xs.length-1] + '] | ' + '#'.repeat(Math.min(count, 60)));
}

// --- All pixels with total count > 50 in y range 100-200 (likely text zone) ---
console.log('\n=== COLORS with 50+ pixels in y=100..200 region ===');
const regionByColor = new Map();
for (const [key, color] of Object.entries(frameData)) {
  const [x, y] = key.split(',').map(Number);
  if (y >= 100 && y <= 200) {
    const c = color.toLowerCase();
    if (!regionByColor.has(c)) regionByColor.set(c, { count:0, minX:x, maxX:x, minY:y, maxY:y });
    const e = regionByColor.get(c);
    e.count++;
    if (x < e.minX) e.minX = x; if (x > e.maxX) e.maxX = x;
    if (y < e.minY) e.minY = y; if (y > e.maxY) e.maxY = y;
  }
}
const sorted = [...regionByColor.entries()].sort((a,b) => b[1].count - a[1].count);
console.log('Color       | Count  | bbox in region        | rgb()');
for (const [color, e] of sorted.slice(0, 30)) {
  const rgb = hexToRgb(color);
  console.log(color.padEnd(11) + ' | ' + String(e.count).padStart(6) + ' | (' + e.minX + ',' + e.minY + ')-(' + e.maxX + ',' + e.maxY + ') | rgb(' + rgb.join(',') + ')');
}
