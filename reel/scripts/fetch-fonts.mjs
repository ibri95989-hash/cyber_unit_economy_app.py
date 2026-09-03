// Downloads the latin + cyrillic woff2 subsets into public/fonts and writes
// src/fonts.css. Run scripts/build-font-faces.mjs afterwards to turn that CSS
// into src/lib/fontFaces.ts, then delete src/fonts.css.
// Usage: node scripts/fetch-fonts.mjs   (from the reel/ directory)

import fs from 'node:fs/promises';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const url = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=block';
const css = await (await fetch(url, {headers: {'User-Agent': UA}})).text();
const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
const keep = new Set(['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext']);
let out = '/* Self-hosted subsets so rendering never depends on the network. */\n\n';
for (const [, subset, block] of blocks) {
  if (!keep.has(subset)) continue;
  const family = /font-family:\s*'([^']+)'/.exec(block)[1];
  const weight = /font-weight:\s*(\d+)/.exec(block)[1];
  const file = `${family.replace(/\s+/g, '')}-${weight}-${subset}.woff2`;
  out += block.replace(/url\(https:[^)]+\)/, `url(/fonts/${file})`).replace(/font-display:\s*\w+/, 'font-display: block') + '\n\n';
}
await fs.writeFile('src/fonts.css', out);
console.log('src/fonts.css written');
