/* ============================================================
   Director for the "опасная ситуация" script: beats keyed to the
   real card timestamps from build/captions.json, plus the always-on
   caption bar drawn after every scene/transition.
   ============================================================ */
const BEATS = [
  { f: beatHook,      from: 0,  to: 2,  tr: 'none'   },
  { f: beatDashboard, from: 3,  to: 3,  tr: 'soft'   },
  { f: beatCollapse,  from: 4,  to: 6,  tr: 'zoomIn' },
  { f: beatGates,     from: 7,  to: 7,  tr: 'whipL'  },
  { f: beatGauge,     from: 8,  to: 8,  tr: 'soft'   },
  { f: beatRisk,      from: 9,  to: 9,  tr: 'whipR'  },
  { f: beatRedirect,  from: 10, to: 10, tr: 'soft'   },
  { f: beatUnit,      from: 11, to: 12, tr: 'zoomIn' },
  { f: beatEnding,    from: 13, to: 14, tr: 'whipU'  },
];

let MARKS2 = null, DUR2 = 0, ENV2 = null, TR2 = 0.22;

function configure2(cfg) {
  setCaptions(cfg);
  const cards = cfg.cards;
  MARKS2 = BEATS.map(b => cards[b.from].start);
  MARKS2.push(cfg.dur);
  DUR2 = cfg.dur;
}

const cv2 = document.getElementById('cv');
const ctx2 = cv2.getContext('2d', { alpha: false });
const bufA2 = document.createElement('canvas'); bufA2.width = W; bufA2.height = H;
const bufB2 = document.createElement('canvas'); bufB2.width = W; bufB2.height = H;
const cA2 = bufA2.getContext('2d', { alpha: false });
const cB2 = bufB2.getContext('2d', { alpha: false });

function beatAt(t) {
  for (let i = BEATS.length - 1; i >= 0; i--) if (t >= MARKS2[i]) return i;
  return 0;
}

function drawBeat(target, i, t) {
  const b = BEATS[i];
  const a = MARKS2[i], z = MARKS2[i + 1];
  const p = clamp((t - a) / (z - a), 0, 1);
  const lt = t - a;
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  b.f(target, p, lt, t, 0);
  target.restore();
}

function composite2(type, k) {
  const e = easeInOutCubic(k);
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.fillStyle = '#000'; ctx2.fillRect(0, 0, W, H);
  const blur = Math.sin(Math.PI * k);
  const put = (img, { sc = 1, dx = 0, dy = 0, alpha = 1, bl = 0 }) => {
    ctx2.save();
    ctx2.globalAlpha = clamp(alpha);
    if (bl > 1.5) ctx2.filter = `blur(${Math.min(bl, 14).toFixed(2)}px)`;
    ctx2.translate(W / 2 + dx, H / 2 + dy);
    ctx2.scale(sc, sc);
    ctx2.drawImage(img, -W / 2, -H / 2);
    ctx2.restore();
  };
  switch (type) {
    case 'zoomIn':
      put(bufA2, { sc: 1 + e * 0.7, alpha: 1 - e * 1.25, bl: e * 18 });
      put(bufB2, { sc: lerp(0.82, 1, e), alpha: e * 1.5, bl: (1 - e) * 14 });
      flash(ctx2, Math.sin(Math.PI * k) * 0.18);
      break;
    case 'whipL':
      put(bufA2, { dx: -e * W * 1.05, bl: blur * 22 });
      put(bufB2, { dx: (1 - e) * W * 1.05, bl: blur * 22 });
      break;
    case 'whipR':
      put(bufA2, { dx: e * W * 1.05, bl: blur * 22 });
      put(bufB2, { dx: -(1 - e) * W * 1.05, bl: blur * 22 });
      break;
    case 'whipU':
      put(bufA2, { dy: -e * H * 0.9, bl: blur * 22 });
      put(bufB2, { dy: (1 - e) * H * 0.9, bl: blur * 22 });
      break;
    case 'soft':
      put(bufA2, { sc: 1 + e * 0.06, alpha: 1 - e });
      put(bufB2, { sc: lerp(0.97, 1, e), alpha: e });
      break;
    default:
      put(bufA2, { alpha: 1 - e });
      put(bufB2, { alpha: e });
  }
}

function renderFrame2(t, frame) {
  const i = beatAt(t);
  const k = (t - MARKS2[i]) / TR2;

  if (i > 0 && k < 1) {
    drawBeat(cA2, i - 1, t);
    drawBeat(cB2, i, t);
    composite2(BEATS[i].tr, clamp(k));
  } else {
    ctx2.setTransform(1, 0, 0, 1, 0, 0);
    drawBeat(ctx2, i, t);
  }

  captionBar(ctx2, t);

  grain(ctx2, frame, 0.05);
  const fin = clamp(t / 0.3), fout = clamp((DUR2 - t) / 0.6);
  const f = Math.min(fin, fout);
  if (f < 1) { ctx2.fillStyle = `rgba(0,0,0,${1 - f})`; ctx2.fillRect(0, 0, W, H); }
}

window.renderFrame = renderFrame2;
window.configure = configure2;
window.TOTAL = () => DUR2;
