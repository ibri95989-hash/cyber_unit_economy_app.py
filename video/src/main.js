/* ============================================================
   main.js — таймлайн, переходы, покадровый рендер
   Хронометраж собран под озвучку 35,2 c: границы сцен поставлены
   в паузы между фразами, чтобы кадр менялся на вдохе, а не посреди слова.
   ============================================================ */

const FPS = 60;
const TOTAL = 2112;            // 35.2 c × 60 fps
const DUR = TOTAL / FPS;

/* Склейки стоят в паузах между фразами, за 0,12 c до следующей — новая сцена
   успевает встать на место ровно к началу речи. `authored` — длительность,
   под которую сцена изначально свёрстана; из отношения к реальной берётся
   масштаб, а моменты появления элементов притягиваются к речевым атакам. */
const TL = [
  { fn: scene1, start: 0,     dur: 4.74, authored: 2 },
  { fn: scene2, start: 4.74,  dur: 2.35, authored: 3 },
  { fn: scene3, start: 7.09,  dur: 6.54, authored: 4 },
  { fn: scene4, start: 13.63, dur: 5.30, authored: 4 },
  { fn: scene5, start: 18.93, dur: 4.23, authored: 4 },
  { fn: scene6, start: 23.16, dur: 5.66, authored: 4 },
  { fn: scene7, start: 28.82, dur: 6.38, authored: 4 },
];

/* Притяжка к речи: запланированный момент масштабируется под новую длину
   сцены и сдвигается на ближайшую атаку голоса, если та рядом. Короткие
   длительности раскрытий не растягиваем — иначе появления станут вялыми;
   длинные (проезды камеры на всю сцену) масштабируем. */
function makeSnapper(startAbs, dur, authored) {
  const scale = dur / authored;
  const win = clamp(0.18 * scale, 0.14, 0.45);
  const local = (typeof CUES === 'undefined' ? [] : CUES.onsets)
    .map(o => o - startAbs)
    .filter(v => v >= -0.06 && v <= dur + 0.05);
  const f = (x) => {
    const target = x * scale;
    let best = target, bd = win;
    for (const v of local) {
      const d = Math.abs(v - target);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  };
  f.d = (d) => (d <= 1.2 ? d : d * scale);
  return f;
}
for (const sc of TL) sc.S = makeSnapper(sc.start, sc.dur, sc.authored);

const TR = [
  { at: 4.74,  type: 'glitch', pre: .12, post: .20 },
  { at: 7.09,  type: 'whipL',  pre: .10, post: .26 },
  { at: 13.63, type: 'zoom',   pre: .12, post: .30 },
  { at: 18.93, type: 'split',  pre: .12, post: .32 },
  { at: 23.16, type: 'whipU',  pre: .10, post: .28 },
  { at: 28.82, type: 'glitch', pre: .12, post: .22 },
];

/* ---------- холсты ---------- */
let MAIN, OA, OB;
function initCanvases() {
  MAIN = document.getElementById('stage').getContext('2d', { alpha: false });
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  OA = mk(); OB = mk();
}

function sceneAt(t) {
  for (let i = TL.length - 1; i >= 0; i--) if (t >= TL[i].start) return i;
  return 0;
}

/** wallLocal — экранное время от начала сцены (может выходить за её длительность) */
function drawScene(ctx, i, wallLocal) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  TL[i].fn(ctx, wallLocal, wallLocal, TL[i].S);
  ctx.restore();
}

/* ---------- композиция переходов ---------- */
function drawImgT(ctx, img, scale, dx, dy, alpha, cx = W / 2, cy = H / 2) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx + dx, cy + dy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function composeTransition(ctx, type, k, iA, tA, iB, tB) {
  drawScene(OA.getContext('2d'), iA, tA);
  drawScene(OB.getContext('2d'), iB, tB);
  const a = OA, b = OB;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const vel = Math.sin(Math.PI * clamp(k));   // «скорость» в середине перехода

  if (type === 'whipL') {
    const e = E.inOutExpo(k);
    drawImgT(ctx, a, 1 + vel * .06, -e * W * 1.05, 0, 1);
    drawImgT(ctx, b, 1 + vel * .06, (1 - e) * W * 1.05, 0, 1);
    motionBlur(ctx, vel * 92, 0, 11, .85);
    rgbSplit(ctx, vel * 12);
    flash(ctx, vel * .12, '#BFD8FF');
  } else if (type === 'whipU') {
    const e = E.inOutExpo(k);
    drawImgT(ctx, a, 1 + vel * .06, 0, -e * H * 1.02, 1);
    drawImgT(ctx, b, 1 + vel * .06, 0, (1 - e) * H * 1.02, 1);
    motionBlur(ctx, 0, vel * 115, 11, .85);
    rgbSplit(ctx, vel * 10, Math.PI / 2);
    flash(ctx, vel * .12, '#FFD8E4');
  } else if (type === 'zoom') {
    drawImgT(ctx, a, 1 + E.inCubic(k) * .95, 0, 0, 1 - E.inQuad(k));
    if (k > .18) drawImgT(ctx, b, lerp(1.75, 1, E.outExpo(inv(k, .18, 1))), 0, 0, inv(k, .18, .62));
    blurFrame(ctx, vel * 9);
    rgbSplit(ctx, vel * 11);
    flash(ctx, vel * .18, '#CFE4FF');
  } else if (type === 'split') {
    ctx.drawImage(b, 0, 0);
    const e = E.inOutExpo(k);
    const off = e * (W / 2 + 40);
    ctx.drawImage(a, 0, 0, W / 2, H, -off, 0, W / 2, H);
    ctx.drawImage(a, W / 2, 0, W / 2, H, W / 2 + off, 0, W / 2, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.sin(Math.PI * clamp(k)) * .95;
    ctx.fillStyle = lg(ctx, W / 2 - 80, 0, W / 2 + 80, 0,
      [[0, 'rgba(120,200,255,0)'], [.5, 'rgba(220,240,255,.95)'], [1, 'rgba(120,200,255,0)']]);
    ctx.fillRect(W / 2 - 80, 0, 160, H);
    ctx.restore();
    motionBlur(ctx, vel * 22, 0, 8, .55);
    rgbSplit(ctx, vel * 8);
  }
}

/* ---------- главный кадр ---------- */
function render(t, frame) {
  const ctx = MAIN;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';

  let cross = null;
  for (let bi = 0; bi < TR.length; bi++) {
    const tr = TR[bi];
    if (tr.type === 'glitch') continue;
    if (t >= tr.at - tr.pre && t <= tr.at + tr.post) {
      cross = { tr, bi, k: inv(t, tr.at - tr.pre, tr.at + tr.post) };
      break;
    }
  }

  if (cross) {
    const iA = cross.bi, iB = cross.bi + 1;
    composeTransition(ctx, cross.tr.type, cross.k,
      iA, t - TL[iA].start, iB, t - TL[iB].start);
  } else {
    const i = sceneAt(t);
    drawScene(ctx, i, t - TL[i].start);
    for (const tr of TR) {
      if (tr.type !== 'glitch') continue;
      const d = t - tr.at;
      if (d < -tr.pre || d > tr.post) continue;
      const amt = d < 0
        ? E.inQuad(inv(t, tr.at - tr.pre, tr.at))
        : 1 - E.outQuad(inv(t, tr.at, tr.at + tr.post));
      sliceGlitch(ctx, amt * .55, Math.floor(t * 60), 14);
      rgbSplit(ctx, amt * 11);
      if (d >= 0) flash(ctx, (1 - inv(t, tr.at, tr.at + .09)) * .5, '#FFFFFF');
      transformFrame(ctx, 1 + amt * .05);
    }
  }

  grain(ctx, frame, .045);
  const fadeIn = 1 - inv(t, 0, .12);
  const fadeOut = inv(t, DUR - .18, DUR);
  if (fadeIn > 0) flash(ctx, fadeIn, '#000000', 'source-over');
  if (fadeOut > 0) flash(ctx, fadeOut * .85, '#000000', 'source-over');
}

/* ---------- API для рендерера ---------- */
window.__meta = { W, H, FPS, DUR, TOTAL };
window.__ready = false;

async function boot() {
  initCanvases();
  const probes = [
    '900 100px Inter', '800 100px Inter', '700 100px Inter', '500 40px Inter',
    '700 100px JetBrainsMono', '800 100px JetBrainsMono',
  ];
  await Promise.all(probes.map(p => document.fonts.load(p, 'АБВЁ0123₽—?')));
  await document.fonts.ready;
  render(0, 0);
  window.__ready = true;
}

window.__frame = (i) => { render(i / FPS, i); return true; };
window.__seek = (t) => { render(t, Math.round(t * FPS)); return true; };

boot();
