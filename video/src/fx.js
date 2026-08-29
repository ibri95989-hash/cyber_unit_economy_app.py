/* ============================================================
   fx.js — фон, атмосфера, пост-обработка, переходы
   ============================================================ */

/* ---------- слоистый фон ---------- */
/**
 * opts: { hue: 'red'|'blue'|'violet'|'amber'|'mixed', energy: 0..1, grid: 0..1,
 *         drift: px, warp: 0..1 }
 */
function drawBackground(ctx, t, o = {}) {
  const energy = o.energy === undefined ? .5 : o.energy;
  const acc = o.accent || C.violet;
  const acc2 = o.accent2 || C.blue;

  // базовая вертикальная заливка
  ctx.fillStyle = lg(ctx, 0, 0, 0, H, [
    [0, C.bg0], [.35, C.bg1], [.62, o.mid || C.bg2], [1, C.bg0],
  ]);
  ctx.fillRect(0, 0, W, H);

  // крупные «дышащие» световые пятна
  const b1x = W * .22 + Math.sin(t * .34) * 90;
  const b1y = H * .26 + Math.cos(t * .27) * 120;
  const b2x = W * .82 + Math.cos(t * .31 + 2) * 100;
  const b2y = H * .72 + Math.sin(t * .23 + 1) * 130;
  glowBlob(ctx, b1x, b1y, 720, acc, .55 * (.6 + energy * .7));
  glowBlob(ctx, b2x, b2y, 640, acc2, .42 * (.6 + energy * .7));
  if (o.accent3) glowBlob(ctx, W * .5, H * .5, 900, o.accent3, .25 * energy);

  // сетка перспективная
  const gridA = (o.grid === undefined ? .5 : o.grid);
  if (gridA > 0) {
    ctx.save();
    ctx.globalAlpha = .10 * gridA;
    ctx.strokeStyle = A(C.cyan, .55);
    ctx.lineWidth = 1.4;
    const off = (t * (o.gridSpeed || 26)) % 90;
    ctx.beginPath();
    for (let y = -90 + off; y < H + 90; y += 90) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    for (let x = 0; x <= W; x += 90) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    ctx.stroke();
    ctx.restore();
  }

  // тонкие «данные»-полосы по краям
  if (o.ticks !== false) {
    ctx.save();
    ctx.globalAlpha = .5;
    const rng = new Rng(7);
    for (let i = 0; i < 26; i++) {
      const y = ((i * 137 + t * (18 + i % 5 * 9)) % (H + 200)) - 100;
      const left = i % 2 === 0;
      const x = left ? 26 : W - 26 - 10;
      const h = 30 + (i % 4) * 26;
      ctx.fillStyle = A(i % 3 === 0 ? acc : C.dim2, .18 + .12 * ((i * 7) % 3));
      ctx.fillRect(x, y, 4, h);
    }
    ctx.restore();
  }
}

/* ---------- виньетка / края ---------- */
function vignette(ctx, strength = .8, color = '#000000') {
  ctx.save();
  ctx.fillStyle = rg(ctx, W / 2, H / 2, H * .28, H * .78, [
    [0, A(color, 0)], [.6, A(color, .28 * strength)], [1, A(color, .92 * strength)],
  ]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ---------- плёночное зерно (детерминированное) ---------- */
let _grainCanvases = null;
function grain(ctx, frame, amount = .05) {
  if (!_grainCanvases) {
    _grainCanvases = [];
    for (let k = 0; k < 8; k++) {
      const c = document.createElement('canvas');
      c.width = 270; c.height = 480;
      const g = c.getContext('2d');
      const img = g.createImageData(c.width, c.height);
      const rng = new Rng(1000 + k * 77);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (rng.next() - .5) * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      _grainCanvases.push(c);
    }
  }
  const c = _grainCanvases[frame % 8];
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, W, H);
  ctx.restore();
}

/* ---------- горизонтальные scanline ---------- */
function scanlines(ctx, alpha = .05, period = 5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  for (let y = 0; y < H; y += period) ctx.fillRect(0, y, W, 1.6);
  ctx.restore();
}

/* ---------- вспышка ---------- */
function flash(ctx, alpha, color = '#FFFFFF', mode = 'lighter') {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ============================================================
   Пост-эффекты, работающие с готовым кадром
   ============================================================ */
const _tmp = [];
function tmpCanvas(i) {
  if (!_tmp[i]) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    _tmp[i] = { c, x: c.getContext('2d') };
  }
  return _tmp[i];
}

/** RGB-сдвиг (хроматическая аберрация / глитч) */
function rgbSplit(ctx, amount, angle = 0) {
  if (amount < .2) return;
  const src = tmpCanvas(0);
  src.x.clearRect(0, 0, W, H);
  src.x.drawImage(ctx.canvas, 0, 0);

  const dx = Math.cos(angle) * amount, dy = Math.sin(angle) * amount;
  const chans = [
    ['rgb(255,0,0)', -dx, -dy],
    ['rgb(0,255,0)', 0, 0],
    ['rgb(0,0,255)', dx, dy],
  ];
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (const [col, ox, oy] of chans) {
    const t1 = tmpCanvas(1);
    t1.x.globalCompositeOperation = 'source-over';
    t1.x.clearRect(0, 0, W, H);
    t1.x.drawImage(src.c, 0, 0);
    t1.x.globalCompositeOperation = 'multiply';
    t1.x.fillStyle = col;
    t1.x.fillRect(0, 0, W, H);
    ctx.drawImage(t1.c, ox, oy);
  }
  ctx.restore();
}

/** горизонтальные срезы со сдвигом */
function sliceGlitch(ctx, amount, seed = 1, sliceCount = 14) {
  if (amount <= 0) return;
  const src = tmpCanvas(2);
  src.x.clearRect(0, 0, W, H);
  src.x.drawImage(ctx.canvas, 0, 0);
  const rng = new Rng(seed * 9781 + 13);
  ctx.save();
  for (let i = 0; i < sliceCount; i++) {
    const y = rng.next() * H;
    const h = rng.range(8, 90);
    const dx = (rng.next() - .5) * 200 * amount;
    ctx.clearRect(0, y, W, h);
    ctx.drawImage(src.c, 0, y, W, h, dx, y + (rng.next() - .5) * 6 * amount, W, h);
    if (rng.next() < .3) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .25 * amount;
      ctx.fillStyle = rng.next() < .5 ? C.magenta : C.cyan;
      ctx.fillRect(0, y, W, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}

/** направленный motion blur (дешёвая аппроксимация многократной отрисовкой) */
function motionBlur(ctx, dx, dy, steps = 10, strength = 1) {
  if (Math.abs(dx) + Math.abs(dy) < .5) return;
  const src = tmpCanvas(3);
  src.x.clearRect(0, 0, W, H);
  src.x.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.globalAlpha = 1;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    ctx.globalAlpha = (1 - k) * .55 * strength;
    ctx.drawImage(src.c, dx * k, dy * k);
    ctx.drawImage(src.c, -dx * k * .5, -dy * k * .5);
  }
  ctx.restore();
}

/** лёгкое размытие всего кадра через filter */
function blurFrame(ctx, px) {
  if (px <= .2) return;
  const src = tmpCanvas(4);
  src.x.clearRect(0, 0, W, H);
  src.x.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(src.c, 0, 0);
  ctx.filter = 'none';
  ctx.restore();
}

/** bloom: светлые области размываются и складываются */
function bloom(ctx, amount = .35, blurPx = 26, threshold = .55) {
  if (amount <= 0) return;
  const src = tmpCanvas(5);
  src.x.globalCompositeOperation = 'source-over';
  src.x.clearRect(0, 0, W, H);
  src.x.drawImage(ctx.canvas, 0, 0);
  // грубый порог: усиливаем контраст и гасим тени
  src.x.globalCompositeOperation = 'multiply';
  src.x.fillStyle = `rgba(255,255,255,1)`;
  src.x.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = amount;
  ctx.filter = `blur(${blurPx}px) brightness(${1 + threshold})`;
  ctx.drawImage(src.c, 0, 0);
  ctx.filter = 'none';
  ctx.restore();
}

/** зум/поворот всего кадра вокруг точки */
function transformFrame(ctx, scale, cx = W / 2, cy = H / 2, rot = 0, ox = 0, oy = 0) {
  if (scale === 1 && rot === 0 && ox === 0 && oy === 0) return;
  const src = tmpCanvas(6);
  src.x.clearRect(0, 0, W, H);
  src.x.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(cx + ox, cy + oy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.drawImage(src.c, 0, 0);
  ctx.restore();
}
