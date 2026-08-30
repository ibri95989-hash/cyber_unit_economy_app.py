/* ============================================================
   Director: timeline, transitions, per-frame composition.
   ============================================================ */
const BASE = [
  { f: scene1,  a: 0.0,  b: 3.0,  tr: 'none'   },
  { f: scene2,  a: 3.0,  b: 7.0,  tr: 'punch'  },
  { f: scene3,  a: 7.0,  b: 10.0, tr: 'whipL'  },
  { f: scene4,  a: 10.0, b: 18.0, tr: 'zoomIn' },
  { f: scene5,  a: 18.0, b: 25.0, tr: 'whipU'  },
  { f: scene6,  a: 25.0, b: 33.0, tr: 'zoomOut'},
  { f: scene7,  a: 33.0, b: 40.0, tr: 'whipL'  },
  { f: scene8,  a: 40.0, b: 48.0, tr: 'punch'  },
  { f: scene9,  a: 48.0, b: 54.5, tr: 'whipR'  },
  { f: scene10, a: 54.5, b: 60.0, tr: 'zoomIn' },
];

let MARKS = null, DUR = 60, ENV = null, TR = 0.30;

function configure(cfg) {
  MARKS = cfg.marks;                 /* MARKS.length === BASE.length + 1 */
  DUR = cfg.dur;
  ENV = cfg.env || null;
  TR = cfg.tr || 0.30;
}

/* main + two offscreen buffers (only used while cross-cutting) */
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d', { alpha: false });
const bufA = document.createElement('canvas'); bufA.width = W; bufA.height = H;
const bufB = document.createElement('canvas'); bufB.width = W; bufB.height = H;
const cA = bufA.getContext('2d', { alpha: false });
const cB = bufB.getContext('2d', { alpha: false });

function level(frame) {
  if (!ENV) return 0;
  return ENV[Math.min(ENV.length - 1, Math.max(0, frame))] || 0;
}

function sceneAt(t) {
  for (let i = BASE.length - 1; i >= 0; i--) if (t >= MARKS[i]) return i;
  return 0;
}

function drawScene(target, i, t, A) {
  const s = BASE[i];
  const a = MARKS[i], b = MARKS[i + 1];
  const p = clamp((t - a) / (b - a), 0, 1.0);
  const lt = t - a;
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  s.f(target, p, lt, t, A);
  target.restore();
}

/* --- transition compositors --- */
function composite(type, k, A) {
  const e = easeInOutCubic(k);   /* balanced cross-cut, both sides stay readable */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const blur = Math.sin(Math.PI * k);

  const put = (img, { sc = 1, dx = 0, dy = 0, alpha = 1, bl = 0 }) => {
    ctx.save();
    ctx.globalAlpha = clamp(alpha);
    if (bl > 1.5) ctx.filter = `blur(${Math.min(bl, 16).toFixed(2)}px)`;
    ctx.translate(W / 2 + dx, H / 2 + dy);
    ctx.scale(sc, sc);
    ctx.drawImage(img, -W / 2, -H / 2);
    ctx.restore();
  };

  switch (type) {
    case 'punch':
      put(bufA, { sc: 1 + e * 0.35, alpha: 1 - e, bl: e * 16 });
      put(bufB, { sc: lerp(0.84, 1, e), alpha: e * 1.6, bl: (1 - e) * 12 });
      flash(ctx, Math.sin(Math.PI * k) * 0.5);
      break;
    case 'whipL':
      put(bufA, { dx: -e * W * 1.15, bl: blur * 42 });
      put(bufB, { dx: (1 - e) * W * 1.15, bl: blur * 42 });
      break;
    case 'whipR':
      put(bufA, { dx: e * W * 1.15, bl: blur * 42 });
      put(bufB, { dx: -(1 - e) * W * 1.15, bl: blur * 42 });
      break;
    case 'whipU':
      put(bufA, { dy: -e * H * 1.1, bl: blur * 46 });
      put(bufB, { dy: (1 - e) * H * 1.1, bl: blur * 46 });
      break;
    case 'zoomIn':
      put(bufA, { sc: 1 + e * 1.1, alpha: 1 - e * 1.25, bl: e * 26 });
      put(bufB, { sc: lerp(0.7, 1, e), alpha: e * 1.5, bl: (1 - e) * 18 });
      flash(ctx, Math.sin(Math.PI * k) * 0.28);
      break;
    case 'zoomOut':
      put(bufA, { sc: lerp(1, 0.55, e), alpha: 1 - e * 1.2, bl: e * 20 });
      put(bufB, { sc: lerp(1.6, 1, e), alpha: e * 1.5, bl: (1 - e) * 20 });
      break;
    default:
      put(bufA, { alpha: 1 - e });
      put(bufB, { alpha: e });
  }
}

/* ---------- public API used by the capture script ---------- */
function renderFrame(t, frame) {
  const A = level(frame);
  const i = sceneAt(t);
  const k = (t - MARKS[i]) / TR;

  if (i > 0 && k < 1) {
    drawScene(cA, i - 1, t, A);        /* outgoing keeps running past its cut */
    drawScene(cB, i, t, A);
    composite(BASE[i].tr, clamp(k), A);
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawScene(ctx, i, t, A);
  }

  /* global finish: grain + edge falloff + gentle breathing highlight */
  grain(ctx, frame, 0.055);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.05 + A * 0.05;
  glow(ctx, W / 2, H * 0.5, 1100, '#7aa2ff', 0.2);
  ctx.restore();

  /* fade in / out at the very ends */
  const fin = clamp(t / 0.35), fout = clamp((DUR - t) / 0.6);
  const f = Math.min(fin, fout);
  if (f < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - f})`; ctx.fillRect(0, 0, W, H); }
}

window.renderFrame = renderFrame;
window.configure = configure;
window.TOTAL = () => DUR;
