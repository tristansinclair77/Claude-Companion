#!/usr/bin/env node
// Generates simple placeholder PNG files for all 19 emotions.
// Each is a 300x400 colored rectangle with the emotion name.
// Real artwork goes here later.

const fs = require('fs');
const path = require('path');

const EMOTIONS = [
  { id: 'neutral',        color: [136, 136, 136], label: 'NEUTRAL' },
  { id: 'happy',          color: [255, 221, 0],   label: 'HAPPY' },
  { id: 'soft_smile',     color: [255, 204, 68],  label: 'SOFT SMILE' },
  { id: 'laughing',       color: [255, 153, 0],   label: 'LAUGHING' },
  { id: 'confident',      color: [0, 204, 255],   label: 'CONFIDENT' },
  { id: 'smug',           color: [170, 68, 255],  label: 'SMUG' },
  { id: 'surprised',      color: [255, 170, 0],   label: 'SURPRISED' },
  { id: 'shocked',        color: [255, 68, 68],   label: 'SHOCKED' },
  { id: 'confused',       color: [170, 136, 0],   label: 'CONFUSED' },
  { id: 'thinking',       color: [68, 136, 255],  label: 'THINKING' },
  { id: 'concerned',      color: [255, 136, 68],  label: 'CONCERNED' },
  { id: 'sad',            color: [68, 136, 187],  label: 'SAD' },
  { id: 'angry',          color: [255, 34, 34],   label: 'ANGRY' },
  { id: 'determined',     color: [255, 102, 0],   label: 'DETERMINED' },
  { id: 'embarrassed',    color: [255, 136, 170], label: 'EMBARRASSED' },
  { id: 'exhausted',      color: [102, 102, 136], label: 'EXHAUSTED' },
  { id: 'pout',           color: [221, 102, 0],   label: 'POUT' },
  { id: 'crying',         color: [102, 136, 204], label: 'CRYING' },
  { id: 'lustful_desire', color: [255, 68, 170],  label: 'LUSTFUL DESIRE' },
];

const W = 300;
const H = 400;
const outputDir = path.join(__dirname, '../characters/default/emotions');

// Create minimal valid PNG:
// PNG signature + IHDR + IDAT (solid color) + IEND

function createSolidColorPNG(width, height, r, g, b) {
  // We'll generate a raw bitmap: each row is a filter byte (0) + RGB pixels
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      rawData[rowOffset + 1 + x * 3] = r;
      rawData[rowOffset + 1 + x * 3 + 1] = g;
      rawData[rowOffset + 1 + x * 3 + 2] = b;
    }
  }

  // Deflate compress (Node built-in zlib)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData, { level: 1 });

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width, height, bit depth=8, color type=2 (RGB), etc.
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const crc = require('zlib').crc32(Buffer.concat([Buffer.from(type), data]));
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, Buffer.from(type), data, crcBuf]);
}

// Check if zlib.crc32 is available (Node 22+)
const zlib = require('zlib');
if (typeof zlib.crc32 !== 'function') {
  // Fallback CRC32 implementation
  const CRC32_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  zlib.crc32 = function(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
}

for (const { id, color, label } of EMOTIONS) {
  const [r, g, b] = color;
  const pngBuf = createSolidColorPNG(W, H, r, g, b);
  const outPath = path.join(outputDir, `${id}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`  Created: ${id}.png (${color})`);
}

console.log(`\nDone! ${EMOTIONS.length} placeholder emotion images created.`);
