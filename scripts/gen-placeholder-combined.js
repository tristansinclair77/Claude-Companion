#!/usr/bin/env node
// Generates placeholder PNGs for all 27 combined/blended emotion pairs.
// Colors are the averaged hex of the two constituent emotion colors.
// Real blended artwork replaces these later.

const fs = require('fs');
const path = require('path');

// All single emotion colors (must match constants.js)
const EMOTION_COLORS = {
  neutral:             [136, 136, 136],
  happy:               [255, 221,   0],
  soft_smile:          [255, 204,  68],
  laughing:            [255, 153,   0],
  confident:           [  0, 204, 255],
  smug:                [170,  68, 255],
  surprised:           [255, 170,   0],
  shocked:             [255,  68,  68],
  confused:            [170, 136,   0],
  thinking:            [ 68, 136, 255],
  concerned:           [255, 136,  68],
  sad:                 [ 68, 136, 187],
  angry:               [255,  34,  34],
  determined:          [255, 102,   0],
  embarrassed:         [255, 136, 170],
  exhausted:           [102, 102, 136],
  pout:                [221, 102,   0],
  crying:              [102, 136, 204],
  lustful_desire:      [255,  68, 170],
  excited:             [255, 170,   0],
  loving:              [255, 102, 136],
  nervous:             [170, 170,  68],
  longing:             [136, 153, 204],
  curious:             [ 68, 170, 255],
  disappointed:        [136, 136, 153],
  relieved:            [102, 204, 136],
  playful:             [255, 204,   0],
  proud:               [255, 170,  68],
  apologetic:          [170, 170, 170],
  content:             [136, 204, 136],
  flirty:              [255, 102, 170],
  flustered:           [255, 136, 153],
  in_awe:              [136, 170, 255],
  in_pleasure:         [255, 136, 204],
  sleepy:              [136, 136, 170],
  sickly:              [136, 170,  68],
  wheezing_laughter:   [255, 136,   0],
  frantic_desperation: [255,  68,   0],
};

// Combined emotion pairs (id: [emotionA, emotionB])
const COMBINED_PAIRS = [
  // Tier 1
  ['happy_confused',              'happy',              'confused'           ],
  ['nervous_excited',             'nervous',            'excited'            ],
  ['sad_angry',                   'sad',                'angry'              ],
  ['concerned_thinking',          'concerned',          'thinking'           ],
  ['embarrassed_laughing',        'embarrassed',        'laughing'           ],
  ['loving_sad',                  'loving',             'sad'                ],
  ['confident_smug',              'confident',          'smug'               ],
  ['exhausted_sad',               'exhausted',          'sad'                ],
  ['flustered_nervous',           'flustered',          'nervous'            ],
  ['curious_confused',            'curious',            'confused'           ],
  // Tier 2
  ['sickly_sad',                  'sickly',             'sad'                ],
  ['sickly_exhausted',            'sickly',             'exhausted'          ],
  ['relieved_exhausted',          'relieved',           'exhausted'          ],
  ['proud_loving',                'proud',              'loving'             ],
  ['playful_confident',           'playful',            'confident'          ],
  ['shocked_confused',            'shocked',            'confused'           ],
  ['longing_sad',                 'longing',            'sad'                ],
  ['content_loving',              'content',            'loving'             ],
  ['embarrassed_apologetic',      'embarrassed',        'apologetic'         ],
  ['frantic_desperation_crying',  'frantic_desperation','crying'             ],
  // Tier 3
  ['laughing_crying',             'laughing',           'crying'             ],
  ['smug_angry',                  'smug',               'angry'              ],
  ['thinking_concerned',          'thinking',           'concerned'          ],
  ['excited_nervous',             'excited',            'nervous'            ],
  ['in_pleasure_embarrassed',     'in_pleasure',        'embarrassed'        ],
  ['flirty_nervous',              'flirty',             'nervous'            ],
  ['wheezing_laughter_exhausted', 'wheezing_laughter',  'exhausted'          ],
];

const W = 300;
const H = 400;
const outputDir = path.join(__dirname, '../characters/default/emotions/combined');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('  Created directory:', outputDir);
}

// ── PNG generation (same approach as gen-placeholder-emotions.js) ─────────────

const zlib = require('zlib');

// Polyfill zlib.crc32 for older Node versions
if (typeof zlib.crc32 !== 'function') {
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

function makeChunk(type, data) {
  const crc = zlib.crc32(Buffer.concat([Buffer.from(type), data]));
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, Buffer.from(type), data, crcBuf]);
}

function createSolidColorPNG(width, height, r, g, b) {
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      rawData[rowOffset + 1 + x * 3    ] = r;
      rawData[rowOffset + 1 + x * 3 + 1] = g;
      rawData[rowOffset + 1 + x * 3 + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(rawData, { level: 1 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; ihdrData[9] = 2;
  return Buffer.concat([sig, makeChunk('IHDR', ihdrData), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);
}

// ── Generate all combined placeholders ───────────────────────────────────────

let created = 0;
let skipped = 0;

for (const [id, a, b] of COMBINED_PAIRS) {
  const cA = EMOTION_COLORS[a];
  const cB = EMOTION_COLORS[b];
  if (!cA || !cB) {
    console.warn(`  WARN: Missing color for ${a} or ${b}, skipping ${id}`);
    continue;
  }
  const r = Math.round((cA[0] + cB[0]) / 2);
  const g = Math.round((cA[1] + cB[1]) / 2);
  const bv = Math.round((cA[2] + cB[2]) / 2);

  const outPath = path.join(outputDir, `${id}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`  Skipped (exists): ${id}.png`);
    skipped++;
    continue;
  }

  const png = createSolidColorPNG(W, H, r, g, bv);
  fs.writeFileSync(outPath, png);
  console.log(`  Created: ${id}.png  [#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}]`);
  created++;
}

console.log(`\nDone! ${created} created, ${skipped} skipped. Output: ${outputDir}`);
