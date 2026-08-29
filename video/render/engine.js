/* ============================================================
   Motion-graphics engine: helpers for a 1080x1920 canvas.
   All drawing is a pure function of time -> deterministic frames.
   ============================================================ */
const W = 1080, H = 1920;

const C = {
  bg:        '#04060d',
  bg2:       '#070c1a',
  ink:       '#ffffff',
  dim:       'rgba(255,255,255,0.55)',
  violet:    '#8b5cf6',
  violetDeep:'#5b21b6',
  magenta:   '#ff2e93',
  cyan:      '#35e0f5',
  green:     '#23e68a',
  red:       '#ff3b5c',
  gold:      '#ffc46b',
};

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const mix   = (a, b, t) => a + (b - a) * clamp(t);
/* normalized progress of [a,b] window */
const win   = (t, a, b) => clamp((t - a) / (b - a));

const easeOutCubic  = t => 1 - Math.pow(1 - t, 3);
const easeOutQuint  = t => 1 - Math.pow(1 - t, 5);
const easeOutExpo   = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeInCubic   = t => t * t * t;
const easeInOutCubic= t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack   = (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const easeOutElastic= t => t === 0 ? 0 : t === 1 ? 1 :
  Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
/* fast in, settle out - the "punch" curve used for headline pops */
const punch = t => t <= 0 ? 0 : t >= 1 ? 1 : easeOutQuint(t);

/* deterministic PRNG */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}
const hash = (i) => {
  let x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------- colour ---------- */
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- primitives ---------- */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glassPanel(ctx, x, y, w, h, r, opts = {}) {
  const { alpha = 1, tint = 'rgba(255,255,255,0.045)', border = 'rgba(255,255,255,0.11)', glow = null } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 70; }
  rr(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.075)');
  g.addColorStop(1, 'rgba(255,255,255,0.022)');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = tint; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke();
  ctx.restore();
}

/* ---------- text ---------- */
function font(ctx, weight, size, family = 'Montserrat') {
  ctx.font = `${weight} ${size}px "${family}", "Inter", sans-serif`;
}

const _fitCache = new Map();
function fitSize(ctx, text, maxW, size, weight, family = 'Montserrat', spacing = 0) {
  const key = `${text}|${maxW}|${size}|${weight}|${family}|${spacing}`;
  const hit = _fitCache.get(key);
  if (hit !== undefined) return hit;
  let s = size;
  for (let i = 0; i < 40; i++) {
    font(ctx, weight, s, family);
    const w = ctx.measureText(text).width + spacing * (text.length - 1);
    if (w <= maxW) break;
    s *= Math.max(0.86, maxW / w);
  }
  _fitCache.set(key, s);
  return s;
}

/* layout a string as individual glyphs so each can be animated */
const _layoutCache = new Map();
function layout(ctx, text, size, weight, spacing, family = 'Montserrat') {
  const key = `${text}|${size}|${weight}|${spacing}|${family}`;
  const hit = _layoutCache.get(key);
  if (hit) return hit;
  font(ctx, weight, size, family);
  const chars = [...text];
  const ws = chars.map(c => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  const out = []; let x = -total / 2;
  chars.forEach((c, i) => { out.push({ c, x: x + ws[i] / 2, w: ws[i] }); x += ws[i] + spacing; });
  const res = { chars: out, width: total };
  _layoutCache.set(key, res);
  return res;
}

/* kinetic headline: per-glyph stagger, blur-in, y-slide */
function kinetic(ctx, text, cx, cy, size, opts = {}) {
  const {
    weight = 900, spacing = 0, p = 1, color = '#fff', glow = null, glowSize = 44,
    align = 'center', stagger = 0.045, dur = 0.34, dir = 1, maxW = W - 120,
    family = 'Montserrat', alpha = 1, blurIn = 14, scale = 1, shadow = true,
  } = opts;
  const s = fitSize(ctx, text, maxW, size, weight, family, spacing);
  const L = layout(ctx, text, s, weight, spacing, family);
  const n = L.chars.length;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  font(ctx, weight, s, family);
  const ox = align === 'left' ? L.width / 2 : align === 'right' ? -L.width / 2 : 0;
  for (let i = 0; i < n; i++) {
    const st = clamp((p - i * stagger) / dur);
    if (st <= 0) continue;
    const e = easeOutQuint(st);
    const g = L.chars[i];
    ctx.save();
    ctx.globalAlpha = alpha * clamp(st * 1.6);
    ctx.translate(g.x + ox, (1 - e) * 46 * dir);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = Math.min(glowSize, 22); }
    else if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 6; }
    ctx.fillStyle = color;
    /* soft focus while the glyph flies in - three offset copies instead of a
       per-glyph canvas filter, which would allocate a full-size layer */
    const off = (1 - st) * blurIn * 0.5;
    if (off > 0.6) {
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * 0.34;
      ctx.fillText(g.c, -off, -off * 0.5);
      ctx.fillText(g.c, off, off * 0.5);
      ctx.globalAlpha = a0 * 0.55;
    }
    ctx.fillText(g.c, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  return { size: s, width: L.width };
}

/* simple centred text with optional glow */
function text(ctx, str, x, y, size, opts = {}) {
  const { weight = 800, color = '#fff', align = 'center', baseline = 'middle',
          family = 'Montserrat', spacing = 0, glow = null, glowSize = 40,
          alpha = 1, maxW = null } = opts;
  ctx.save();
  let s = size;
  if (maxW) s = fitSize(ctx, str, maxW, size, weight, family, spacing);
  font(ctx, weight, s, family);
  ctx.letterSpacing = `${spacing}px`;
  font(ctx, weight, s, family);
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.globalAlpha *= alpha;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = Math.min(glowSize, 30); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
  ctx.letterSpacing = '0px';
  return s;
}

/* chromatic-aberration copy of a text draw (used on impacts) */
function chromatic(ctx, drawFn, amount) {
  if (amount < 0.4) { drawFn(ctx, '#fff'); return; }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.save(); ctx.translate(-amount, 0); drawFn(ctx, 'rgba(255,40,90,0.9)'); ctx.restore();
  ctx.save(); ctx.translate(amount, 0);  drawFn(ctx, 'rgba(60,220,255,0.9)'); ctx.restore();
  ctx.restore();
  drawFn(ctx, '#fff');
}

/* ---------- numbers ---------- */
const NBSP = ' ';
function money(v, cur = true) {
  const s = Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return cur ? s + NBSP + '₽' : s;
}

/* ---------- vector glyphs (drawn, never font-dependent) ---------- */
function arrowUpRight(ctx, x, y, s, color, lw = 0.16) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = s * lw;
  ctx.shadowColor = color; ctx.shadowBlur = s * 0.5;
  ctx.beginPath();
  ctx.moveTo(-s * 0.38, s * 0.38); ctx.lineTo(s * 0.36, -s * 0.36);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.02, -s * 0.36); ctx.lineTo(s * 0.36, -s * 0.36); ctx.lineTo(s * 0.36, s * 0.02);
  ctx.stroke();
  ctx.restore();
}

function notEqual(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.13;
  ctx.shadowColor = color; ctx.shadowBlur = s * 0.7;
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, -s * 0.17); ctx.lineTo(s * 0.42, -s * 0.17);
  ctx.moveTo(-s * 0.42,  s * 0.17); ctx.lineTo(s * 0.42,  s * 0.17);
  ctx.stroke();
  ctx.lineWidth = s * 0.115;
  ctx.beginPath();
  ctx.moveTo(-s * 0.24, s * 0.44); ctx.lineTo(s * 0.24, -s * 0.44);
  ctx.stroke();
  ctx.restore();
}

/* soft radial glow blob - drawn from a cached sprite (much cheaper than a
   full-size radial gradient fill on every frame) */
const _glowCache = new Map();
function glowSprite(color) {
  let s = _glowCache.get(color);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 256;
  const g = s.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, rgba(color, 1));
  grd.addColorStop(0.5, rgba(color, 0.32));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  _glowCache.set(color, s);
  return s;
}
function glow(ctx, x, y, r, color, a = 0.5) {
  if (a <= 0.004 || r <= 1) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/* small round particle sprite (no per-dot shadowBlur) */
const _dotCache = new Map();
function dotSprite(color) {
  let s = _dotCache.get(color);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 64;
  const g = s.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, rgba(color, 1));
  grd.addColorStop(0.35, rgba(color, 0.85));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  _dotCache.set(color, s);
  return s;
}
function dot(ctx, x, y, r, color, a = 1) {
  if (a <= 0.004) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.drawImage(dotSprite(color), x - r * 2, y - r * 2, r * 4, r * 4);
  ctx.restore();
}

/* ---------- backgrounds ---------- */
let grainTile = null;
function makeGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const img = g.createImageData(512, 512);
  const r = rng(9137);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

let _wash = null;
function washLayer() {
  if (_wash) return _wash;
  _wash = document.createElement('canvas');
  _wash.width = 360; _wash.height = 640;
  const g = _wash.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, 640);
  lg.addColorStop(0, '#070d1c');
  lg.addColorStop(0.55, '#04070f');
  lg.addColorStop(1, '#02040a');
  g.fillStyle = lg; g.fillRect(0, 0, 360, 640);
  return _wash;
}

function backdrop(ctx, t, opts = {}) {
  const { hueA = C.violet, hueB = C.magenta, energy = 0.5, grid = true, particles = true, pan = 0 } = opts;
  ctx.drawImage(washLayer(), 0, 0, W, H);

  /* two slow drifting light blooms */
  glow(ctx, W * (0.28 + 0.1 * Math.sin(t * 0.31)), H * (0.3 + 0.05 * Math.cos(t * 0.24)) + pan * 0.3,
       860, hueA, 0.20 + 0.06 * energy);
  glow(ctx, W * (0.78 + 0.09 * Math.cos(t * 0.27)), H * (0.72 + 0.05 * Math.sin(t * 0.21)) + pan * 0.3,
       780, hueB, 0.15 + 0.05 * energy);

  if (grid) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = 'rgba(150,190,255,0.20)';
    ctx.lineWidth = 1.4;
    const step = 96, off = ((t * 26 + pan) % step);
    for (let x = -step; x < W + step; x += step) {
      ctx.beginPath(); ctx.moveTo(x + off * 0.25, 0); ctx.lineTo(x + off * 0.25, H); ctx.stroke();
    }
    for (let y = -step; y < H + step; y += step) {
      const yy = y + off;
      ctx.globalAlpha = 0.16 * (0.35 + 0.65 * Math.abs(Math.sin((yy / H) * Math.PI)));
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }
    ctx.restore();
  }

  if (particles) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = rng(4242);
    for (let i = 0; i < 34; i++) {
      const bx = r() * W, by = r() * H, sp = 0.25 + r() * 0.9, sz = 1.6 + r() * 4.2;
      const y = (by - t * sp * 34 - pan * 0.6) % H;
      const yy = y < 0 ? y + H : y;
      dot(ctx, bx + Math.sin(t * 0.4 + i) * 16, yy, sz, '#b7d4ff', 0.10 + 0.28 * r());
    }
    ctx.restore();
  }
}

let _vig = null;
function vignette(ctx, strength = 0.85) {
  if (!_vig) {
    _vig = document.createElement('canvas');
    _vig.width = 270; _vig.height = 480;
    const g = _vig.getContext('2d');
    const grd = g.createRadialGradient(135, 480 * 0.48, 480 * 0.22, 135, 240, 480 * 0.78);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grd; g.fillRect(0, 0, 270, 480);
  }
  ctx.save();
  ctx.globalAlpha *= strength;
  ctx.drawImage(_vig, 0, 0, W, H);
  ctx.restore();
}

function grain(ctx, frame, amount = 0.05) {
  if (!grainTile) grainTile = makeGrain();
  ctx.save();
  ctx.globalAlpha = amount;
  const ox = hash(frame) * 512, oy = hash(frame + 77) * 512;
  /* one stretched pass - cheap, and the film texture survives H.264 */
  ctx.drawImage(grainTile, -ox, -oy, W + 512, H + 512);
  ctx.restore();
}

/* pre-blurred dark plate behind headlines - cached, so the expensive
   blur pass runs once instead of on every frame */
const _plateCache = new Map();
function plate(ctx, x, y, w, h, r, color = 'rgba(3,5,12,0.9)', blurPx = 34, alpha = 1) {
  const key = `${w | 0}|${h | 0}|${r | 0}|${color}|${blurPx | 0}`;
  let c = _plateCache.get(key);
  if (!c) {
    const pad = blurPx * 2;
    c = document.createElement('canvas');
    c.width = (w + pad * 2) | 0; c.height = (h + pad * 2) | 0;
    const g = c.getContext('2d');
    g.filter = `blur(${blurPx}px)`;
    g.fillStyle = color;
    rr(g, pad, pad, w, h, r);
    g.fill();
    _plateCache.set(key, c);
  }
  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  ctx.drawImage(c, x - blurPx * 2, y - blurPx * 2);
  ctx.restore();
}

/* screen-wide flash */
function flash(ctx, a, color = 'rgba(255,255,255,') {
  if (a <= 0.001) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color + a.toFixed(3) + ')';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* horizontal glitch slices */
function glitch(ctx, src, amt, seed) {
  if (amt <= 0.01) return;
  const r = rng(seed | 0 || 3);
  const n = 6 + (amt * 10 | 0);
  for (let i = 0; i < n; i++) {
    const y = r() * H, h = 12 + r() * 90, dx = (r() - 0.5) * 200 * amt;
    ctx.drawImage(src, 0, y, W, h, dx, y, W, h);
  }
}
