/* ============================================================
   Director for text-only scripts (no real voice-over yet): reuses
   the proven 10-scene storyboard from scenes_a.js/scenes_b.js,
   proportionally stretched onto an ESTIMATED duration (see
   estimate_captions.py), plus the accurate word-synced caption bar
   from captions.js drawn on top so the on-screen text always matches
   the script exactly, even where a scene's own built-in headline is
   a generic paraphrase rather than a literal quote.
   ============================================================ */
const STORYBOARD3 = [0.0, 3.0, 7.0, 10.0, 18.0, 25.0, 33.0, 40.0, 48.0, 54.5, 60.0];
const BASE3 = [
  { f: scene1,  tr: 'none'   },
  { f: scene2,  tr: 'punch'  },
  { f: scene3,  tr: 'whipL'  },
  { f: scene4,  tr: 'zoomIn' },
  { f: scene5,  tr: 'whipU'  },
  { f: scene6,  tr: 'zoomOut'},
  { f: scene7,  tr: 'whipL'  },
  { f: scene8,  tr: 'punch'  },
  { f: scene9,  tr: 'whipR'  },
  { f: scene10, tr: 'zoomIn' },
];

let MARKS3 = null, DUR3 = 0, TR3 = 0.20;   /* faster cut than the 0.30 baseline - "ускоренный монтаж" */

function configure3(cfg) {
  setCaptions(cfg);
  DUR3 = cfg.dur;
  MARKS3 = STORYBOARD3.map(t => t / STORYBOARD3[STORYBOARD3.length - 1] * DUR3);
}

const cv3 = document.getElementById('cv');
const ctx3 = cv3.getContext('2d', { alpha: false });
const bufA3 = document.createElement('canvas'); bufA3.width = W; bufA3.height = H;
const bufB3 = document.createElement('canvas'); bufB3.width = W; bufB3.height = H;
const cA3 = bufA3.getContext('2d', { alpha: false });
const cB3 = bufB3.getContext('2d', { alpha: false });

function sceneAt3(t) {
  for (let i = BASE3.length - 1; i >= 0; i--) if (t >= MARKS3[i]) return i;
  return 0;
}

function drawScene3(target, i, t) {
  const a = MARKS3[i], b = MARKS3[i + 1];
  const p = clamp((t - a) / (b - a), 0, 1);
  const lt = t - a;
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  BASE3[i].f(target, p, lt, t, 0);
  target.restore();
}

function composite3(type, k) {
  const e = easeInOutCubic(k);
  ctx3.setTransform(1, 0, 0, 1, 0, 0);
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, W, H);
  const blur = Math.sin(Math.PI * k);
  const put = (img, { sc = 1, dx = 0, dy = 0, alpha = 1, bl = 0 }) => {
    ctx3.save();
    ctx3.globalAlpha = clamp(alpha);
    if (bl > 1.5) ctx3.filter = `blur(${Math.min(bl, 16).toFixed(2)}px)`;
    ctx3.translate(W / 2 + dx, H / 2 + dy);
    ctx3.scale(sc, sc);
    ctx3.drawImage(img, -W / 2, -H / 2);
    ctx3.restore();
  };
  switch (type) {
    case 'punch':
      put(bufA3, { sc: 1 + e * 0.35, alpha: 1 - e, bl: e * 16 });
      put(bufB3, { sc: lerp(0.84, 1, e), alpha: e * 1.6, bl: (1 - e) * 12 });
      flash(ctx3, Math.sin(Math.PI * k) * 0.5);
      break;
    case 'whipL':
      put(bufA3, { dx: -e * W * 1.15, bl: blur * 30 });
      put(bufB3, { dx: (1 - e) * W * 1.15, bl: blur * 30 });
      break;
    case 'whipR':
      put(bufA3, { dx: e * W * 1.15, bl: blur * 30 });
      put(bufB3, { dx: -(1 - e) * W * 1.15, bl: blur * 30 });
      break;
    case 'whipU':
      put(bufA3, { dy: -e * H * 1.1, bl: blur * 32 });
      put(bufB3, { dy: (1 - e) * H * 1.1, bl: blur * 32 });
      break;
    case 'zoomIn':
      put(bufA3, { sc: 1 + e * 1.1, alpha: 1 - e * 1.25, bl: e * 20 });
      put(bufB3, { sc: lerp(0.7, 1, e), alpha: e * 1.5, bl: (1 - e) * 16 });
      flash(ctx3, Math.sin(Math.PI * k) * 0.28);
      break;
    case 'zoomOut':
      put(bufA3, { sc: lerp(1, 0.55, e), alpha: 1 - e * 1.2, bl: e * 18 });
      put(bufB3, { sc: lerp(1.6, 1, e), alpha: e * 1.5, bl: (1 - e) * 18 });
      break;
    default:
      put(bufA3, { alpha: 1 - e });
      put(bufB3, { alpha: e });
  }
}

function renderFrame3(t, frame) {
  const i = sceneAt3(t);
  const k = (t - MARKS3[i]) / TR3;

  if (i > 0 && k < 1) {
    drawScene3(cA3, i - 1, t);
    drawScene3(cB3, i, t);
    composite3(BASE3[i].tr, clamp(k));
  } else {
    ctx3.setTransform(1, 0, 0, 1, 0, 0);
    drawScene3(ctx3, i, t);
  }

  captionBar(ctx3, t);

  grain(ctx3, frame, 0.055);
  const fin = clamp(t / 0.3), fout = clamp((DUR3 - t) / 0.5);
  const f = Math.min(fin, fout);
  if (f < 1) { ctx3.fillStyle = `rgba(0,0,0,${1 - f})`; ctx3.fillRect(0, 0, W, H); }
}

window.renderFrame = renderFrame3;
window.configure = configure3;
window.TOTAL = () => DUR3;
