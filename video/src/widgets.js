/* ============================================================
   widgets.js — векторные иконки, карточки, графики, монеты
   Все элементы рисуются кодом: никаких растровых логотипов,
   никаких искажённых шрифтовых артефактов.
   ============================================================ */

/* ---------- служебное ---------- */
function strokePath(ctx, color, w, glow) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = w * 4; }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/* ---------- иконки (рисуются в квадрате size x size вокруг x,y) ---------- */

function iconCalendar(ctx, x, y, s, color, glow, prog = 1) {
  const w = s, h = s * .9;
  ctx.save();
  ctx.translate(x - w / 2, y - h / 2);
  rr(ctx, 0, s * .12, w, h - s * .12, s * .12);
  strokePath(ctx, color, s * .065, glow);
  ctx.beginPath();
  ctx.moveTo(w * .24, 0); ctx.lineTo(w * .24, s * .24);
  ctx.moveTo(w * .76, 0); ctx.lineTo(w * .76, s * .24);
  strokePath(ctx, color, s * .065, glow);
  ctx.beginPath();
  ctx.moveTo(0, s * .36); ctx.lineTo(w, s * .36);
  strokePath(ctx, color, s * .05, null);
  // точки-дни
  ctx.fillStyle = A(color, .55);
  let k = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    k++;
    if (k / 12 > prog) continue;
    ctx.beginPath();
    ctx.arc(w * (.18 + c * .215), s * .5 + r * s * .155, s * .034, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

function iconBanknote(ctx, x, y, s, color, glow) {
  const w = s * 1.15, h = s * .72;
  ctx.save();
  ctx.translate(x - w / 2, y - h / 2);
  rr(ctx, 0, 0, w, h, s * .1);
  strokePath(ctx, color, s * .065, glow);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * .26, 0, 7);
  strokePath(ctx, color, s * .05, null);
  ctx.beginPath();
  ctx.moveTo(w * .1, h * .2); ctx.lineTo(w * .1, h * .8);
  ctx.moveTo(w * .9, h * .2); ctx.lineTo(w * .9, h * .8);
  strokePath(ctx, A(color, .6), s * .045, null);
  ctx.restore();
}

function iconHourglass(ctx, x, y, s, color, glow, fill = .5) {
  const w = s * .74, h = s * .95;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2);
  ctx.lineTo(w * .1, 0); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2);
  ctx.lineTo(-w * .1, 0); ctx.closePath();
  strokePath(ctx, color, s * .065, glow);
  // «песок»
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2);
  ctx.lineTo(w * .1, 0); ctx.lineTo(-w * .1, 0); ctx.closePath();
  ctx.clip();
  ctx.fillStyle = A(color, .45);
  ctx.fillRect(-w, -h / 2 + h * .5 * fill, w * 2, h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-w * .1, 0); ctx.lineTo(w * .1, 0);
  ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath();
  ctx.clip();
  ctx.fillStyle = A(color, .45);
  ctx.fillRect(-w, h / 2 - h * .5 * (1 - fill), w * 2, h);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(0, -h * .05); ctx.lineTo(0, h * .18);
  strokePath(ctx, A(color, .8), s * .03, null);
  ctx.restore();
}

function iconAlert(ctx, x, y, s, color, glow) {
  const r = s * .5;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * .94, r * .62);
  ctx.lineTo(-r * .94, r * .62);
  ctx.closePath();
  strokePath(ctx, color, s * .075, glow);
  ctx.beginPath();
  ctx.moveTo(0, -r * .28); ctx.lineTo(0, r * .16);
  strokePath(ctx, color, s * .085, glow);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, r * .38, s * .045, 0, 7); ctx.fill();
  ctx.restore();
}

function iconClock(ctx, x, y, s, color, glow, hh = 0, mm = 0) {
  const r = s * .48;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7);
  strokePath(ctx, color, s * .065, glow);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hh - Math.PI / 2) * r * .5, Math.sin(hh - Math.PI / 2) * r * .5);
  strokePath(ctx, color, s * .07, null);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(Math.cos(mm - Math.PI / 2) * r * .78, Math.sin(mm - Math.PI / 2) * r * .78);
  strokePath(ctx, color, s * .05, null);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * .84, Math.sin(a) * r * .84);
    ctx.lineTo(Math.cos(a) * r * .93, Math.sin(a) * r * .93);
    strokePath(ctx, A(color, .5), s * .022, null);
  }
  ctx.restore();
}

function iconArrowDown(ctx, x, y, s, color, glow, w = .07) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -s * .5); ctx.lineTo(0, s * .42);
  strokePath(ctx, color, s * w, glow);
  ctx.beginPath();
  ctx.moveTo(-s * .3, s * .12); ctx.lineTo(0, s * .48); ctx.lineTo(s * .3, s * .12);
  strokePath(ctx, color, s * w, glow);
  ctx.restore();
}

function iconChevron(ctx, x, y, s, color, alpha, glow) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x - s * .5, y - s * .2);
  ctx.lineTo(x, y + s * .22);
  ctx.lineTo(x + s * .5, y - s * .2);
  strokePath(ctx, color, s * .16, glow);
  ctx.restore();
}

/** монета с символом рубля */
function coin(ctx, x, y, r, color, alpha = 1, glow = true, squash = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(1, squash);
  const g = rg(ctx, -r * .3, -r * .35, r * .1, r * 1.25, [
    [0, '#FFFFFF'], [.25, A(color, .95)], [1, A(color, .35)],
  ]);
  if (glow) { ctx.shadowColor = A(color, .9); ctx.shadowBlur = r * 1.5; }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = A('#FFFFFF', .55); ctx.lineWidth = Math.max(1, r * .09);
  ctx.beginPath(); ctx.arc(0, 0, r * .93, 0, 7); ctx.stroke();
  if (r > 9) {
    ctx.fillStyle = A('#0A0714', .85);
    setFont(ctx, r * 1.28, 800, FONT, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('₽', 0, r * .06);
  }
  ctx.restore();
}

/* ---------- карточки, чипы ---------- */

/** стеклянная панель */
function panel(ctx, x, y, w, h, o = {}) {
  const r = o.r === undefined ? 34 : o.r;
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = o.fill || lg(ctx, x, y, x, y + h, [
    [0, 'rgba(28,34,54,0.92)'], [1, 'rgba(12,16,28,0.92)'],
  ]);
  if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 44; ctx.shadowOffsetY = 14; }
  ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  rr(ctx, x + .75, y + .75, w - 1.5, h - 1.5, r);
  ctx.strokeStyle = o.border || 'rgba(255,255,255,0.13)';
  ctx.lineWidth = o.borderW || 2;
  ctx.stroke();
  if (o.accent) { // светящаяся левая грань
    ctx.save();
    rr(ctx, x, y, w, h, r); ctx.clip();
    ctx.fillStyle = o.accent;
    ctx.shadowColor = o.accent; ctx.shadowBlur = 30;
    ctx.fillRect(x, y, 8, h);
    ctx.restore();
  }
  if (o.topLine) {
    ctx.save();
    rr(ctx, x, y, w, h, r); ctx.clip();
    ctx.fillStyle = lg(ctx, x, 0, x + w, 0, [[0, A(o.topLine, 0)], [.5, A(o.topLine, .9)], [1, A(o.topLine, 0)]]);
    ctx.fillRect(x, y, w, 3);
    ctx.restore();
  }
  ctx.restore();
}

/** чип-статус */
function chip(ctx, x, y, label, color, o = {}) {
  const size = o.size || 34;
  const padX = o.padX || 26;
  const h = o.h || 60;
  setFont(ctx, size, 700, MONO, 2);
  const w = ctx.measureText(label).width + padX * 2 + (o.dot === false ? 0 : 26);
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  const ax = o.align === 'center' ? x - w / 2 : x;
  rr(ctx, ax, y - h / 2, w, h, h / 2);
  ctx.fillStyle = A(color, .14);
  ctx.fill();
  ctx.strokeStyle = A(color, .65);
  ctx.lineWidth = 2;
  ctx.stroke();
  let tx = ax + padX;
  if (o.dot !== false) {
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(tx + 5, y, 9 * (o.dotScale || 1), 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    tx += 26;
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  setFont(ctx, size, 700, MONO, 2);
  ctx.fillText(label, tx, y + 1);
  ctx.restore();
  return w;
}

/** прогресс-бар */
function progressBar(ctx, x, y, w, h, p, color, o = {}) {
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fill();
  const pw = Math.max(h, w * clamp(p));
  rr(ctx, x, y, pw, h, h / 2);
  ctx.fillStyle = lg(ctx, x, 0, x + pw, 0, [[0, A(color, .55)], [1, color]]);
  ctx.shadowColor = A(color, .8); ctx.shadowBlur = 22;
  ctx.fill();
  ctx.shadowBlur = 0;
  if (o.head !== false) {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * .9;
    ctx.beginPath(); ctx.arc(x + pw, y + h / 2, h * .62, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/** круговой индикатор */
function ring(ctx, x, y, r, p, color, o = {}) {
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  ctx.lineWidth = o.w || 14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = o.track || 'rgba(255,255,255,.08)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.shadowColor = A(color, .9); ctx.shadowBlur = 26;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(p));
  ctx.stroke();
  ctx.restore();
}

/* ---------- графики ---------- */

/** линейный график с заливкой; pts: [0..1] значения */
function lineChart(ctx, x, y, w, h, pts, color, o = {}) {
  const reveal = o.reveal === undefined ? 1 : clamp(o.reveal);
  const n = pts.length;
  const px = i => x + (w * i) / (n - 1);
  const py = v => y + h - h * clamp(v);
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  // сетка
  if (o.grid !== false) {
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) { const gy = y + (h * i) / 4; ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
    ctx.stroke();
  }
  const last = 1 + (n - 2) * reveal;
  const build = () => {
    ctx.beginPath();
    ctx.moveTo(px(0), py(pts[0]));
    for (let i = 1; i < n; i++) {
      if (i > last) {
        const f = last - Math.floor(last);
        const i0 = Math.floor(last);
        if (i0 >= 1 && i0 < n) {
          ctx.lineTo(lerp(px(i0 - 1), px(i0), f), lerp(py(pts[i0 - 1]), py(pts[i0]), f));
        }
        break;
      }
      const cx = (px(i - 1) + px(i)) / 2;
      ctx.bezierCurveTo(cx, py(pts[i - 1]), cx, py(pts[i]), px(i), py(pts[i]));
    }
  };
  // заливка
  build();
  const endX = px(Math.min(n - 1, last));
  ctx.lineTo(endX, y + h);
  ctx.lineTo(px(0), y + h);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, 0, y, 0, y + h, [[0, A(color, .42)], [1, A(color, 0)]]);
  ctx.fill();
  // линия
  build();
  ctx.strokeStyle = color;
  ctx.lineWidth = o.w || 5;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.shadowColor = A(color, .9); ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // головная точка
  if (reveal < 1 || o.head) {
    const i0 = Math.min(n - 1, Math.max(1, Math.floor(last)));
    const f = last - Math.floor(last);
    const hx = lerp(px(i0 - 1), px(i0), f), hy = lerp(py(pts[i0 - 1]), py(pts[i0]), f);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = color; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(hx, hy, 10, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/** столбцы */
function barChart(ctx, x, y, w, h, vals, color, o = {}) {
  const n = vals.length;
  const gap = o.gap === undefined ? 12 : o.gap;
  const bw = (w - gap * (n - 1)) / n;
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  for (let i = 0; i < n; i++) {
    const k = clamp((o.reveal === undefined ? 1 : o.reveal) * n - i);
    const bh = Math.max(4, h * clamp(vals[i]) * E.outCubic(k));
    const bx = x + i * (bw + gap);
    const c = (o.colors && o.colors[i]) || color;
    rr(ctx, bx, y + h - bh, bw, bh, Math.min(bw / 2, 10));
    ctx.fillStyle = lg(ctx, 0, y + h - bh, 0, y + h, [[0, c], [1, A(c, .22)]]);
    ctx.shadowColor = A(c, .6); ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/** «поток денег» вдоль кривой Безье */
function flowPath(ctx, p0, p1, p2, p3, color, o = {}) {
  const seg = 60;
  const pt = (t) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  };
  const reveal = o.reveal === undefined ? 1 : clamp(o.reveal);
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  ctx.beginPath();
  ctx.moveTo(...pt(0));
  for (let i = 1; i <= seg * reveal; i++) ctx.lineTo(...pt(i / seg));
  ctx.strokeStyle = o.track || A(color, .28);
  ctx.lineWidth = o.w || 6;
  ctx.setLineDash(o.dash || []);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  return pt;
}

/** большая цифровая ячейка (для таймера) */
function digitCell(ctx, x, y, w, h, str, color, o = {}) {
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  rr(ctx, x - w / 2, y - h / 2, w, h, 22);
  ctx.fillStyle = o.fill || 'rgba(255,255,255,.05)';
  ctx.fill();
  ctx.strokeStyle = o.border || A(color, .35);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // блик сверху
  ctx.save();
  rr(ctx, x - w / 2, y - h / 2, w, h, 22); ctx.clip();
  ctx.fillStyle = lg(ctx, 0, y - h / 2, 0, y + h / 2, [[0, 'rgba(255,255,255,.10)'], [.5, 'rgba(255,255,255,0)']]);
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.restore();
  text(ctx, str, x, y + (o.size || 96) * .36, {
    size: o.size || 96, weight: 800, family: MONO, color: o.textColor || C.ink,
    align: 'center', glow: { color: A(color, .85), blur: 30 },
  });
  ctx.restore();
}
