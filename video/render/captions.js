/* ============================================================
   Burned-in captions: word-by-word karaoke, synced to CAPTIONS.cards.
   Drawn last, every frame, over whatever scene/transition is on screen -
   so the reader always has "what's being said right now" anchored to
   the same place, regardless of what the visuals underneath are doing.
   ============================================================ */
let CAPTIONS = null;                 /* set by configure() */

function setCaptions(json) { CAPTIONS = json; }

function findCard(t) {
  if (!CAPTIONS) return null;
  const cs = CAPTIONS.cards;
  /* binary-search would be overkill for 15-40 cards */
  for (let i = 0; i < cs.length; i++) if (t >= cs[i].start && t < cs[i].end) return { card: cs[i], i };
  return null;
}

const _capWrapCache = new Map();
function wrapCard(ctx, text, maxW, maxLines = 2, weight = 800, family = 'Montserrat') {
  const key = `${text}|${maxW}|${maxLines}`;
  const hit = _capWrapCache.get(key);
  if (hit) return hit;
  let size = 62;
  let lines = null;
  for (; size >= 32; size -= 2) {
    font(ctx, weight, size, family);
    const words = text.split(' ');
    const built = [[]];
    for (const w of words) {
      const cur = built[built.length - 1];
      const trial = [...cur, w].join(' ');
      if (cur.length && ctx.measureText(trial).width > maxW) built.push([w]);
      else cur.push(w);
    }
    if (built.length <= maxLines && built.every(l => ctx.measureText(l.join(' ')).width <= maxW)) {
      lines = built.map(l => l.join(' '));
      break;
    }
  }
  if (!lines) { lines = [text]; size = 32; }
  const res = { lines, size };
  _capWrapCache.set(key, res);
  return res;
}

/* offsets of each word within the wrapped lines, by matching word order */
function wrapWordSlots(lines, words) {
  const slots = [];
  let wi = 0;
  lines.forEach((line, li) => {
    const n = line.split(' ').length;
    for (let k = 0; k < n; k++) slots.push({ line: li, word: words[wi++] });
  });
  return slots;
}

let _capPlate = null;
function capPlateSprite() {
  if (_capPlate) return _capPlate;
  _capPlate = document.createElement('canvas');
  _capPlate.width = 270; _capPlate.height = 190;
  const g = _capPlate.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 190);
  grd.addColorStop(0, 'rgba(2,3,7,0)');
  grd.addColorStop(0.55, 'rgba(2,3,7,0.62)');
  grd.addColorStop(1, 'rgba(2,3,7,0.86)');
  g.fillStyle = grd; g.fillRect(0, 0, 270, 190);
  return _capPlate;
}

const CAP_Y = 1618;                  /* baseline of the caption block */
const CAP_MAXW = 950;

function captionBar(ctx, t) {
  const found = findCard(t);
  if (!found) return;
  const { card } = found;
  const local = t - card.start;
  const fadeIn = clamp(local / 0.14);
  const fadeOut = clamp((card.end - t) / 0.16);
  const a = Math.min(fadeIn, fadeOut);
  if (a <= 0.01) return;

  const { lines, size } = wrapCard(ctx, card.text, CAP_MAXW, 2);
  const lh = size * 1.28;
  const blockH = lh * lines.length + 70;
  const top = CAP_Y - blockH * 0.62;

  ctx.save();
  ctx.globalAlpha *= a;
  ctx.drawImage(capPlateSprite(), 0, top - 30, W, blockH + 90);

  const words = card.words;
  const slots = wrapWordSlots(lines, words);
  let wi = 0;
  const slide = (1 - easeOutCubic(fadeIn)) * 14;

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((line, li) => {
    const parts = line.split(' ');
    font(ctx, 800, size, 'Montserrat');
    const widths = parts.map(p => ctx.measureText(p + ' ').width);
    const total = widths.reduce((s, w) => s + w, 0) - (ctx.measureText(' ').width);
    let x = W / 2 - total / 2;
    const y = top + li * lh + lh / 2 + slide;
    parts.forEach((p, pi) => {
      const word = words[wi++];
      const spoken = t >= word.end;
      const active = t >= word.start && t < word.end;
      const upcoming = t < word.start;
      let color = 'rgba(255,255,255,0.94)', glowC = null, sc = 1;
      if (active) { color = C.gold; glowC = rgba(C.gold, 0.85); sc = 1.07; }
      else if (upcoming) { color = 'rgba(255,255,255,0.42)'; }
      const w = widths[pi];
      ctx.save();
      ctx.translate(x + w / 2 - ctx.measureText(' ').width / 2, y);
      ctx.scale(sc, sc);
      if (glowC) { ctx.shadowColor = glowC; ctx.shadowBlur = 26; }
      else { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3; }
      ctx.fillStyle = color;
      ctx.fillText(p, 0, 0);
      ctx.restore();
      x += w;
    });
  });
  ctx.restore();
}

window.setCaptions = setCaptions;
