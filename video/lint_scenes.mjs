/* ============================================================
   Static guard against two bugs already hit once in this project:

   1. `kinetic(ctx, str, x, y, size, { p: clamp(expr), ... })` -
      kinetic() staggers each glyph's reveal internally and needs
      headroom past 1.0 to finish revealing a long string before the
      caller's time window ends; pre-clamping the outer `p` to [0,1]
      caps that headroom and leaves trailing letters stuck mid-flight
      (previously left "ТОВАР ПРОДАЁТСЯ ОТЛИЧН" hanging on screen).

   2. `chip(...)`/`text(...)` calls whose string is built from a
      variable (template literal or a `.label`/`.text` property, so
      the width is not eyeballed at write time) without a `maxW` -
      those are the ones most likely to run long and bleed off the
      canvas edge (previously the unit-economics funnel's category
      labels did exactly that). chip() now derives a safe default
      itself, but text()/kinetic() do not, so this still flags them.

   Run before every render: `node lint_scenes.mjs render/*.js`
   Exits non-zero (and build.sh stops) if either pattern is found.
   ============================================================ */
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node lint_scenes.mjs <file.js> ...'); process.exit(2); }

let hits = 0;

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    if (/\bkinetic\s*\([^)]*$/.test(line) || /\bkinetic\s*\(/.test(line)) {
      /* look at this line plus the next couple for a `p: clamp(` */
      const window = lines.slice(i, i + 3).join(' ');
      if (/\bp:\s*clamp\(/.test(window)) {
        console.error(`${f}:${i + 1}: kinetic() progress is wrapped in clamp() - this caps the`);
        console.error('  stagger headroom and can leave trailing glyphs stuck mid-reveal.');
        console.error('  Pass the raw multiplied progress (e.g. `p: p0 * 2.4`) instead - kinetic()');
        console.error('  already clamps per-glyph internally.');
        hits++;
      }
    }
  });

  const dynLabel = /\b(text|kinetic)\s*\(\s*ctx\s*,\s*[a-zA-Z_$][\w.]*\s*,/g;
  let m;
  while ((m = dynLabel.exec(src))) {
    const start = src.slice(0, m.index).split('\n').length;
    const callTail = src.slice(m.index, m.index + 260);
    if (!/maxW/.test(callTail)) {
      console.error(`${f}:${start}: ${m[1]}() draws a variable string with no maxW - if it runs`);
      console.error('  long at render time it can overflow the frame. Add a maxW.');
      hits++;
    }
  }
}

if (hits) {
  console.error(`\n${hits} issue(s) found.`);
  process.exit(1);
}
console.log(`lint clean: ${files.length} file(s), 0 issues.`);
