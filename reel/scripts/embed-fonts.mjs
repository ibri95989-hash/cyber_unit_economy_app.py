// Embeds the font subsets into src/lib/fontData.json as data URIs.
//
// Fetching 36 woff2 files over Remotion's asset server was intermittently
// hanging a freshly-opened render page, which stalls delayRender and kills the
// render hundreds of frames in. Data URIs remove the network from the path
// entirely, so a face can never be slow to arrive.
//
// Only the `latin` and `cyrillic` subsets are embedded — the reel's copy uses
// no extended-range glyphs.
//
// Usage: node scripts/embed-fonts.mjs   (from the reel/ directory)

import fs from 'node:fs/promises';

const faces = JSON.parse(
  (await fs.readFile('src/lib/fontFaces.ts', 'utf8')).match(/=\s*(\[[\s\S]*\]);/)[1]
);

const KEEP = /-(latin|cyrillic)\.woff2$/;
const out = [];
let bytes = 0;

for (const f of faces) {
  if (!KEEP.test(f.file)) continue;
  const buf = await fs.readFile(`public/fonts/${f.file}`);
  bytes += buf.length;
  out.push({
    family: f.family,
    weight: f.weight,
    unicodeRange: f.unicodeRange,
    data: `data:font/woff2;base64,${buf.toString('base64')}`,
  });
}

await fs.writeFile('src/lib/fontData.json', JSON.stringify({faces: out}));
console.log(`embedded ${out.length} faces, ${(bytes / 1024).toFixed(0)} KB raw`);
