/* ============================================================
   Reusable infographic parts: charts, chips, gauges, streams.
   ============================================================ */

/* animated area chart. pts: [0..1] values. prog: 0..1 draw progress */
function areaChart(ctx, x, y, w, h, pts, prog, color, opts = {}) {
  const { fillTop = 0.42, lineW = 7, head = true, glowA = 0.9, baseline = 1 } = opts;
  const n = pts.length;
  const px = i => x + (i / (n - 1)) * w;
  const py = i => y + h - pts[i] * h;
  const last = clamp(prog) * (n - 1);
  const li = Math.floor(last), lf = last - li;
  const cutX = lerp(px(li), px(Math.min(li + 1, n - 1)), lf);
  const cutY = lerp(py(li), py(Math.min(li + 1, n - 1)), lf);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px(0), py(0));
  for (let i = 1; i <= li; i++) {
    const cx = (px(i - 1) + px(i)) / 2;
    ctx.bezierCurveTo(cx, py(i - 1), cx, py(i), px(i), py(i));
  }
  if (li < n - 1) ctx.lineTo(cutX, cutY);

  /* fill */
  ctx.save();
  ctx.lineTo(cutX, y + h * baseline);
  ctx.lineTo(px(0), y + h * baseline);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, rgba(color, fillTop));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();

  /* stroke */
  ctx.beginPath();
  ctx.moveTo(px(0), py(0));
  for (let i = 1; i <= li; i++) {
    const cx = (px(i - 1) + px(i)) / 2;
    ctx.bezierCurveTo(cx, py(i - 1), cx, py(i), px(i), py(i));
  }
  if (li < n - 1) ctx.lineTo(cutX, cutY);
  ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.shadowColor = rgba(color, glowA); ctx.shadowBlur = 34;
  ctx.stroke();
  ctx.restore();

  if (head && prog > 0.02) {
    ctx.save();
    glow(ctx, cutX, cutY, 90, color, 0.55);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = color; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(cutX, cutY, 12, 0, 7); ctx.fill();
    ctx.restore();
  }
  return { x: cutX, y: cutY };
}

function chartGrid(ctx, x, y, w, h, rows = 4, a = 0.10) {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${a})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 12]);
  for (let i = 0; i <= rows; i++) {
    const yy = y + (i / rows) * h;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
  }
  ctx.restore();
}

/* label chip: pill with text (and optional value) */
function chip(ctx, str, cx, cy, opts = {}) {
  const { size = 46, color = '#fff', bg = 'rgba(255,255,255,0.07)', border = 'rgba(255,255,255,0.16)',
          padX = 40, padY = 24, glowC = null, alpha = 1, weight = 800, family = 'Montserrat',
          spacing = 2, scale = 1 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy); ctx.scale(scale, scale);
  ctx.letterSpacing = `${spacing}px`;
  font(ctx, weight, size, family);
  const w = ctx.measureText(str).width + padX * 2, h = size + padY * 2;
  if (glowC) { ctx.shadowColor = glowC; ctx.shadowBlur = 45; }
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.4; ctx.strokeStyle = border; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, 0, 2);
  ctx.restore();
  ctx.letterSpacing = '0px';
  return w;
}

/* small stat tile used in dashboards */
function statTile(ctx, x, y, w, h, label, value, color, opts = {}) {
  const { alpha = 1, spark = null } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  glassPanel(ctx, x, y, w, h, 26);
  text(ctx, label, x + 26, y + 40, 26, { align: 'left', weight: 700, family: 'Inter',
        color: 'rgba(255,255,255,0.5)', spacing: 2 });
  text(ctx, value, x + 26, y + h - 46, 46, { align: 'left', weight: 800, color, maxW: w - 52 });
  if (spark) {
    ctx.save();
    ctx.globalAlpha *= 0.9;
    areaChart(ctx, x + w - 150, y + h - 92, 120, 56, spark, 1, color, { lineW: 3.5, head: false, fillTop: 0.3 });
    ctx.restore();
  }
  ctx.restore();
}

/* gear wheel */
function gear(ctx, x, y, r, teeth, rot, color, opts = {}) {
  const { lw = 10, alpha = 1, glowA = 0.5 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.shadowColor = rgba(color, glowA); ctx.shadowBlur = 30;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, a1 = ((i + 0.5) / teeth) * Math.PI * 2, a2 = ((i + 1) / teeth) * Math.PI * 2;
    const R = r * 1.16;
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos(a0 + 0.06) * R, Math.sin(a0 + 0.06) * R);
    ctx.lineTo(Math.cos(a1 - 0.06) * R, Math.sin(a1 - 0.06) * R);
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
  }
  ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, 7); ctx.stroke();
  ctx.restore();
}

/* isometric parcel box */
function isoBox(ctx, x, y, s, opts = {}) {
  const { alpha = 1, tint = '#c9d6f0', accent = C.violet, rot = 0 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(rot);
  const w = s, h = s * 0.56;
  /* top */
  ctx.beginPath();
  ctx.moveTo(0, -h); ctx.lineTo(w * 0.5, -h * 0.5); ctx.lineTo(0, 0); ctx.lineTo(-w * 0.5, -h * 0.5);
  ctx.closePath();
  ctx.fillStyle = rgba(tint, 0.30); ctx.fill();
  ctx.strokeStyle = rgba(tint, 0.55); ctx.lineWidth = 3; ctx.stroke();
  /* left */
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.5); ctx.lineTo(0, 0); ctx.lineTo(0, h); ctx.lineTo(-w * 0.5, h * 0.5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill(); ctx.stroke();
  /* right */
  ctx.beginPath();
  ctx.moveTo(w * 0.5, -h * 0.5); ctx.lineTo(0, 0); ctx.lineTo(0, h); ctx.lineTo(w * 0.5, h * 0.5);
  ctx.closePath();
  ctx.fillStyle = rgba(accent, 0.22); ctx.fill(); ctx.stroke();
  /* tape */
  ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.5); ctx.lineTo(w * 0.5, -h * 0.5);
  ctx.strokeStyle = rgba(accent, 0.8); ctx.lineWidth = 4;
  ctx.shadowColor = rgba(accent, 0.9); ctx.shadowBlur = 18; ctx.stroke();
  ctx.restore();
}

/* donut segment */
function donutSeg(ctx, cx, cy, rOut, rIn, a0, a1, color, opts = {}) {
  const { alpha = 1, glowA = 0.55, push = 0 } = opts;
  if (a1 - a0 < 0.0008) return;
  const mid = (a0 + a1) / 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx + Math.cos(mid) * push, cy + Math.sin(mid) * push);
  ctx.beginPath();
  ctx.arc(0, 0, rOut, a0, a1);
  ctx.arc(0, 0, rIn, a1, a0, true);
  ctx.closePath();
  ctx.fillStyle = rgba(color, 0.9);
  ctx.shadowColor = rgba(color, glowA); ctx.shadowBlur = 34;
  ctx.fill();
  ctx.restore();
}

/* half-circle gauge with a needle */
function gauge(ctx, cx, cy, r, value, opts = {}) {
  const { color = C.red, track = 'rgba(255,255,255,0.10)', lw = 26, alpha = 1, pulse = 0 } = opts;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.strokeStyle = track; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
  const a = lerp(a0, a1, clamp(value));
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.shadowColor = rgba(color, 0.85); ctx.shadowBlur = 26 + pulse * 30;
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a); ctx.stroke();
  /* needle */
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(a);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.moveTo(-r * 0.12, 0); ctx.lineTo(r * 0.92, 0); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
  ctx.restore();
}

const _streakCache = new Map();
function streakSprite(color) {
  let s = _streakCache.get(color);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = 16; s.height = 256;
  const g = s.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, rgba(color, 0));
  grd.addColorStop(0.5, rgba(color, 1));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
  _streakCache.set(color, s);
  return s;
}

/* stream of light streaks (money moving) */
function streaks(ctx, t, opts = {}) {
  const { count = 34, color = C.gold, speed = 1200, alpha = 0.8, dir = 1, seed = 7, len = 260, thick = 6 } = opts;
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const x = r() * W, sp = speed * (0.5 + r()), l = len * (0.4 + r() * 1.4), th = thick * (0.4 + r());
    const y0 = ((r() * (H + 600) + t * sp * dir) % (H + 600)) - 300;
    const y = dir > 0 ? y0 : H - y0;
    ctx.globalAlpha = alpha * (0.35 + r() * 0.65);
    ctx.drawImage(streakSprite(color), x, y - l / 2, th, l);
  }
  ctx.restore();
}

/* expanding shockwave ring */
function shockwave(ctx, cx, cy, p, color = '#fff', maxR = 1200) {
  if (p <= 0 || p >= 1) return;
  const r = easeOutExpo(p) * maxR;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, (1 - p) * 0.55);
  ctx.lineWidth = 26 * (1 - p) + 2;
  ctx.shadowColor = color; ctx.shadowBlur = 60;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  ctx.restore();
}

/* falling / evaporating money particles */
function moneyDust(ctx, cx, cy, spread, t, p, color = C.gold, n = 46, seed = 31, up = 1) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ph = (t * (0.35 + r() * 0.8) + r()) % 1;
    const a = (1 - ph) * 0.85 * clamp(p * 2);
    if (a <= 0.01) continue;
    const x = cx + (r() - 0.5) * spread + Math.sin(t * 2 + i) * 22;
    const y = cy - up * ph * 420 + (1 - up) * ph * 380;
    dot(ctx, x, y, 3 + r() * 7, color, a);
  }
  ctx.restore();
}
