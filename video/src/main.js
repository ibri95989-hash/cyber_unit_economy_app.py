/* ============================================================
   main.js — таймлайн, переходы, покадровый рендер
   ============================================================ */

const FPS = 60;
const DUR = 25;                       // общая длительность, с
const TOTAL = Math.round(FPS * DUR);  // 1500 кадров

const TL = [
  { fn: scene1, start: 0,  dur: 2 },   // HOOK
  { fn: scene2, start: 2,  dur: 3 },   // ДАТА
  { fn: scene3, start: 5,  dur: 4 },   // ПОТОК
  { fn: scene4, start: 9,  dur: 4 },   // ВОПРОС
  { fn: scene5, start: 13, dur: 4 },   // СПЛИТ
  { fn: scene6, start: 17, dur: 4 },   // ТАЙМЕР
  { fn: scene7, start: 21, dur: 4 },   // ФИНАЛ
];

/* Переходы на стыках. type:
   glitch  — жёсткая склейка с глитчем (без кросс-рендера)
   whipL   — быстрый горизонтальный whip-pan
   whipU   — вертикальный whip-pan
   zoom    — zoom punch «сквозь» кадр
   split   — экран расходится створками                          */
const TR = [
  { at: 2,  type: 'glitch', pre: .12, post: .20 },
  { at: 5,  type: 'whipL',  pre: .10, post: .26 },
  { at: 9,  type: 'zoom',   pre: .12, post: .30 },
  { at: 13, type: 'split',  pre: .12, post: .32 },
  { at: 17, type: 'whipU',  pre: .10, post: .28 },
  { at: 21, type: 'glitch', pre: .12, post: .22 },
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

function drawScene(ctx, i, localT) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  TL[i].fn(ctx, localT);
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
    const e = E.inOutQuad(k);
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
    // светящийся шов
    ctx.save();
    const seamA = Math.sin(Math.PI * clamp(k)) * .95;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = seamA;
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

  // ищем активный кросс-переход
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
    // жёсткие склейки с глитчем
    for (const tr of TR) {
      if (tr.type !== 'glitch') continue;
      const d = t - tr.at;
      if (d < -tr.pre || d > tr.post) continue;
      const amt = d < 0
        ? E.inQuad(inv(t, tr.at - tr.pre, tr.at))         // разгон перед склейкой
        : 1 - E.outQuad(inv(t, tr.at, tr.at + tr.post));  // затухание после
      sliceGlitch(ctx, amt * .55, Math.floor(t * 60), 14);
      rgbSplit(ctx, amt * 11);
      if (d >= 0) flash(ctx, (1 - inv(t, tr.at, tr.at + .09)) * .5, '#FFFFFF');
      transformFrame(ctx, 1 + amt * .05);
    }
  }

  // единый финальный пас: зерно + лёгкий блик
  grain(ctx, frame, .045);
  // затемнение первых и последних кадров для чистого входа/выхода
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
  // прогрев: кэш зерна и временных холстов
  render(0, 0);
  window.__ready = true;
}

window.__frame = (i) => { render(i / FPS, i); return true; };
window.__seek = (t) => { render(t, Math.round(t * FPS)); return true; };

boot();
