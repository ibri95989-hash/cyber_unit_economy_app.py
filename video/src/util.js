/* ============================================================
   util.js — базовая математика, тайминги, типографика
   ============================================================ */

const W = 1080;
const H = 1920;

/* ---------- math ---------- */
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = lerp;
/** нормализация t в диапазон [a,b] -> [0,1] c клампом */
const inv = (t, a, b) => clamp((t - a) / (b - a || 1e-6));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };

/* ---------- easings ---------- */
const E = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < .5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: t => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    const c = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * c) + 1;
  },
  outBounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
    return n * (t -= 2.625 / d) * t + .984375;
  },
};

/** удобный «анимационный слот»: e(t, from, to, easing) */
const ease = (t, a, b, fn = E.outCubic) => fn(inv(t, a, b));

/* ---------- детерминированный шум ---------- */
function hash11(n) {
  n = Math.sin(n * 127.1) * 43758.5453123;
  return n - Math.floor(n);
}
function hash21(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
/** плавный 1D-шум */
function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash11(i), hash11(i + 1), u) * 2 - 1;
}
function fbm1(x, oct = 3) {
  let v = 0, a = .5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * noise1(x * f + i * 17.3); f *= 2; a *= .5; }
  return v;
}
class Rng {
  constructor(seed = 1) { this.s = seed >>> 0 || 1; }
  next() { // xorshift32
    let x = this.s;
    x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
    this.s = x; return x / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
}

/* ---------- палитра ---------- */
const C = {
  bg0: '#04050A',
  bg1: '#080B14',
  bg2: '#0D1220',
  ink: '#FFFFFF',
  dim: '#98A4C0',
  dim2: '#5D6883',
  red: '#FF2D55',
  redDeep: '#B0102F',
  magenta: '#E7239B',
  violet: '#7C3AED',
  amber: '#FFB020',
  cyan: '#31E1F7',
  blue: '#3B82F6',
  green: '#25D07A',
};
/** hex + alpha -> rgba */
function A(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- типографика ---------- */
const FONT = 'Inter';
const MONO = 'JetBrainsMono';

function setFont(ctx, size, weight = 700, family = FONT, ls = 0) {
  ctx.font = `${weight} ${size}px "${family}", sans-serif`;
  ctx.letterSpacing = `${ls}px`;
}

/** измерить ширину строки при заданных параметрах */
function measure(ctx, str, size, weight, family, ls) {
  setFont(ctx, size, weight, family, ls);
  return ctx.measureText(str).width;
}

/**
 * Рисует строку. opts:
 *  size, weight, family, ls (letter-spacing), color, align, baseline,
 *  alpha, glow {color,blur}, maxWidth (ужимает кегль), stroke {color,width}
 */
function text(ctx, str, x, y, o = {}) {
  const size = o.size || 60;
  const weight = o.weight || 700;
  const family = o.family || FONT;
  const ls = o.ls || 0;
  ctx.save();
  setFont(ctx, size, weight, family, ls);
  let s = size;
  if (o.maxWidth) {
    const w = ctx.measureText(str).width;
    if (w > o.maxWidth) { s = size * (o.maxWidth / w); setFont(ctx, s, weight, family, ls * (s / size)); }
  }
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'alphabetic';
  if (o.alpha !== undefined) ctx.globalAlpha = clamp(o.alpha);
  if (o.glow) { ctx.shadowColor = o.glow.color; ctx.shadowBlur = o.glow.blur; }
  if (o.stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.stroke.width;
    ctx.strokeStyle = o.stroke.color;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color || C.ink;
  ctx.fillText(str, x, y);
  // второй проход для «плотного» свечения
  if (o.glow && o.glow.passes) for (let i = 1; i < o.glow.passes; i++) ctx.fillText(str, x, y);
  ctx.restore();
  return s;
}

/** подобрать кегль так, чтобы строка вписалась в maxWidth */
function fitSize(ctx, str, maxSize, maxWidth, weight = 800, family = FONT, ls = 0) {
  setFont(ctx, maxSize, weight, family, ls);
  const w = ctx.measureText(str).width;
  return w <= maxWidth ? maxSize : maxSize * (maxWidth / w);
}

/** обрезка по прямоугольнику */
function clipRect(ctx, x, y, w, h, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  fn();
  ctx.restore();
}

/** скруглённый прямоугольник (path) */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** линейный градиент по двум точкам */
function lg(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}
function rg(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}

/** мягкое радиальное пятно света */
function glowBlob(ctx, x, y, r, color, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rg(ctx, x, y, 0, r, [[0, A(color, .55)], [.45, A(color, .18)], [1, A(color, 0)]]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.restore();
}

/** ударная тряска камеры: возвращает [dx,dy] */
function shake(t, start, dur, amp, seed = 3) {
  const k = inv(t, start, start + dur);
  if (k <= 0 || k >= 1) return [0, 0];
  const decay = Math.pow(1 - k, 2.2);
  const f = (t - start) * 70;
  return [fbm1(f + seed) * amp * decay, fbm1(f + seed + 91.3) * amp * decay];
}

/** пульсация 0..1 */
const pulse = (t, hz = 1, phase = 0) => .5 + .5 * Math.sin((t * hz + phase) * Math.PI * 2);
