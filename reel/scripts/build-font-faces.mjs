// Converts src/fonts.css (written by fetch-fonts.mjs) into src/lib/fontFaces.ts,
// so the bundler never has to resolve /fonts/* URLs at build time.
// Usage: node scripts/build-font-faces.mjs   (from the reel/ directory)

import fs from 'node:fs/promises';
const css = await fs.readFile('src/fonts.css', 'utf8');
const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, b]) => ({
  family: /font-family:\s*'([^']+)'/.exec(b)[1],
  weight: Number(/font-weight:\s*(\d+)/.exec(b)[1]),
  file: /url\(\/fonts\/([^)]+)\)/.exec(b)[1],
  unicodeRange: /unicode-range:\s*([^;]+);/.exec(b)[1].trim(),
}));
const out = `/**
 * Font faces, generated from the Google Fonts CSS by scripts/fetch-fonts.mjs.
 * The woff2 files live in public/fonts and are resolved through staticFile(),
 * so the bundler never has to resolve them and the render stays offline-safe.
 */
export type FontFace = {
  family: string;
  weight: number;
  file: string;
  unicodeRange: string;
};

export const FONT_FACES: FontFace[] = ${JSON.stringify(faces, null, 2)};
`;
await fs.writeFile('src/lib/fontFaces.ts', out);
console.log(`${faces.length} faces`);
