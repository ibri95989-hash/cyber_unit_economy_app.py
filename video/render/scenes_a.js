/* ============================================================
   Scenes 1-5
   ============================================================ */

/* ---------- data model (one consistent unit economy) ---------- */
const REVENUE = 1000000;
const GATES = [                      /* scene 4 - marketplace costs, % of revenue */
  { label: 'КОМИССИЯ',  pct: 0.17, color: '#ff2e93' },
  { label: 'ЛОГИСТИКА', pct: 0.10, color: '#8b5cf6' },
  { label: 'ХРАНЕНИЕ',  pct: 0.02, color: '#6b8cff' },
  { label: 'РЕКЛАМА',   pct: 0.12, color: '#35e0f5' },
  { label: 'СКИДКИ',    pct: 0.05, color: '#ffc46b' },
  { label: 'ВОЗВРАТЫ',  pct: 0.04, color: '#ff7a45' },
  { label: 'НАЛОГИ',    pct: 0.06, color: '#ff3b5c' },
];
const COGS = { label: 'ЗАКУПКА', pct: 0.35, color: '#4b5fd6' };
const PROFIT = 0.09;                 /* 90 000 ₽ */

function gateRemain(k) {             /* fraction left after k gates (fractional ok) */
  let r = 1;
  for (let i = 0; i < GATES.length; i++) {
    const w = clamp(k - i);
    r -= GATES[i].pct * w;
  }
  return Math.max(0.02, r);
}

/* ============================================================
   SCENE 1 - HOOK: growing revenue -> "but there may be no profit"
   ============================================================ */
function scene1(ctx, p, lt, gt, A) {
  const hookAt = 0.56;
  const hp = win(p, hookAt, 1);
  const shake = hp > 0 && hp < 0.5 ? Math.exp(-hp * 14) * 26 : 0;

  ctx.save();
  ctx.translate(Math.sin(lt * 61) * shake, Math.cos(lt * 47) * shake * 0.7);

  backdrop(ctx, gt, { energy: 0.5 + A * 0.5, hueA: hp > 0 ? C.red : C.violet, hueB: C.magenta });

  /* rising bar silhouette at the bottom */
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 11; i++) {
    const k = i / 10;
    const grow = clamp((p * 1.5 - k * 0.35) * 1.4);
    const h = (70 + Math.pow(k, 1.7) * 720) * easeOutCubic(grow) * (1 + A * 0.05);
    const x = 60 + i * 92;
    const g = ctx.createLinearGradient(0, H - 320 - h, 0, H - 320);
    g.addColorStop(0, rgba(hp > 0 ? C.red : C.violet, 0.55));
    g.addColorStop(1, rgba(C.violetDeep, 0.05));
    ctx.fillStyle = g;
    rr(ctx, x, H - 320 - h, 62, h, 16); ctx.fill();
  }
  ctx.restore();

  /* ----- growing numbers ----- */
  const steps = [
    { t0: 0.015, v0: 0,      v1: 100000  },
    { t0: 0.20,  v0: 100000, v1: 500000  },
    { t0: 0.375, v0: 500000, v1: 1000000 },
  ];
  let val = 0, since = 9, idx = 0;
  steps.forEach((s, i) => {
    if (p >= s.t0) {
      val = lerp(s.v0, s.v1, easeOutExpo(clamp((p - s.t0) / 0.105)));
      since = (p - s.t0) / 0.105; idx = i;
    }
  });
  const numOut = win(p, hookAt - 0.05, hookAt + 0.06);
  if (numOut < 1) {
    const pop = 1 + 0.17 * Math.exp(-since * 5) + A * 0.012;
    ctx.save();
    ctx.globalAlpha = 1 - numOut;
    if (numOut > 0.02) ctx.filter = `blur(${numOut * 26}px)`;
    ctx.translate(W / 2, 880);
    ctx.scale(pop * (1 + numOut * 0.4), pop * (1 + numOut * 0.4));

    text(ctx, 'ОБОРОТ НА МАРКЕТПЛЕЙСЕ', 0, -230, 34,
      { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.62)', spacing: 9 });

    const str = money(val);
    const sz = fitSize(ctx, str, 940, 200, 900);
    ctx.save();
    ctx.shadowColor = rgba(C.cyan, 0.75); ctx.shadowBlur = 70;
    text(ctx, str, 0, -50, sz, { weight: 900, color: '#ffffff' });
    ctx.restore();

    /* step ticks */
    for (let i = 0; i < 3; i++) {
      const on = idx >= i ? 1 : 0.18;
      ctx.fillStyle = rgba(i === idx ? C.cyan : C.violet, on);
      ctx.shadowColor = rgba(C.cyan, on * 0.8); ctx.shadowBlur = 18;
      rr(ctx, -180 + i * 130, 80, 100, 10, 5); ctx.fill();
    }
    ctx.shadowBlur = 0;
    chip(ctx, '+248% К ПРОШЛОМУ МЕСЯЦУ', 0, 190,
      { size: 34, color: C.green, bg: rgba(C.green, 0.10), border: rgba(C.green, 0.35), glowC: rgba(C.green, 0.5) });
    ctx.restore();
  }

  /* ----- the hook line ----- */
  if (hp > 0) {
    const e = easeOutQuint(clamp(hp * 3.2));
    const sc = lerp(1.35, 1, e) + Math.exp(-hp * 9) * 0.05;
    const ab = Math.exp(-hp * 7) * 26;
    ctx.save();
    ctx.translate(W / 2, 900); ctx.scale(sc, sc);
    glow(ctx, 0, 0, 700, C.red, 0.30 * clamp(hp * 4));

    chromatic(ctx, (c, col) => {
      c.save();
      kinetic(c, 'НО ПРИБЫЛИ', 0, -110, 150, { p: hp * 2.4, color: col, spacing: 2, stagger: 0.03,
        glow: col === '#fff' ? rgba(C.red, 0.8) : null, glowSize: 60, maxW: 880 });
      kinetic(c, 'МОЖЕТ НЕ БЫТЬ', 0, 70, 150, { p: hp * 2.4 - 0.18, color: col, spacing: 2, stagger: 0.03,
        glow: col === '#fff' ? rgba(C.red, 0.8) : null, glowSize: 60, maxW: 880 });
      c.restore();
    }, ab);

    /* underline sweep */
    const uw = easeOutExpo(clamp((hp - 0.12) * 3)) * 760;
    ctx.fillStyle = C.red; ctx.shadowColor = C.red; ctx.shadowBlur = 40;
    rr(ctx, -uw / 2, 178, uw, 12, 6); ctx.fill();
    ctx.restore();

    shockwave(ctx, W / 2, 900, clamp(hp * 2.2), C.red, 1500);
    flash(ctx, Math.exp(-hp * 16) * 0.85);
  }

  vignette(ctx, 0.9);
  ctx.restore();
}

/* ============================================================
   SCENE 2 - revenue analytics is booming
   ============================================================ */
function dashboardPanel(ctx, p, lt, opts = {}) {
  const { title = 'АНАЛИТИКА ПРОДАЖ', color = C.green, pts, prog, chartAlpha = 1, label = 'ВЫРУЧКА, 30 ДНЕЙ' } = opts;
  const px = 80, py = 380, pw = W - 160, ph = 800;
  glassPanel(ctx, px, py, pw, ph, 44, { glow: rgba(color, 0.22) });

  /* header */
  text(ctx, title, px + 46, py + 74, 40, { align: 'left', weight: 800, color: '#fff', spacing: 3 });
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(lt * 6);
  ctx.fillStyle = rgba(color, 0.9); ctx.shadowColor = color; ctx.shadowBlur = 20 + pulse * 22;
  ctx.beginPath(); ctx.arc(px + pw - 76, py + 72, 12, 0, 7); ctx.fill();
  ctx.restore();
  text(ctx, 'LIVE', px + pw - 104, py + 74, 26,
    { align: 'right', weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 4 });

  text(ctx, label, px + 46, py + 132, 28,
    { align: 'left', weight: 600, family: 'Inter', color: 'rgba(255,255,255,0.45)', spacing: 3 });

  const cx = px + 46, cy = py + 186, cw = pw - 92, ch = 430;
  chartGrid(ctx, cx, cy, cw, ch, 4);
  ctx.save();
  ctx.globalAlpha *= chartAlpha;
  const head = areaChart(ctx, cx, cy, cw, ch, pts, prog, color, { lineW: 8 });
  ctx.restore();

  /* bottom axis labels */
  ctx.save();
  ctx.globalAlpha = 0.42;
  ['01', '08', '15', '22', '30'].forEach((d, i) => {
    text(ctx, d, cx + (i / 4) * cw, cy + ch + 46, 24, { weight: 600, family: 'Inter', color: '#fff', spacing: 2 });
  });
  ctx.restore();
  return { px, py, pw, ph, head, cx, cy, cw, ch };
}

const RISE_PTS = [0.06, 0.10, 0.09, 0.16, 0.21, 0.19, 0.28, 0.34, 0.31, 0.42, 0.5, 0.47, 0.58, 0.67, 0.72, 0.82, 0.88, 0.97];

function scene2(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.45 + A * 0.4, hueA: C.violet, hueB: '#1b8f6a' });

  const zoom = lerp(1.01, 1.075, easeInOutCubic(clamp(p * 1.05)));
  ctx.save();
  ctx.translate(W / 2, H * 0.52);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H * 0.52);

  const D = dashboardPanel(ctx, p, lt, { pts: RISE_PTS, prog: easeOutCubic(clamp(p * 1.5)), color: C.green });

  /* KPI tiles */
  const tA = win(p, 0.22, 0.42), tB = win(p, 0.30, 0.5);
  statTile(ctx, 80, 1225, 430, 200, 'ЗАКАЗЫ', Math.round(lerp(0, 1248, easeOutExpo(tA))).toString(), '#fff',
    { alpha: tA, spark: [0.2, 0.4, 0.3, 0.6, 0.7, 0.9] });
  statTile(ctx, 570, 1225, 430, 200, 'СРЕДНИЙ ЧЕК', money(lerp(0, 2190, easeOutExpo(tB))), '#fff',
    { alpha: tB, spark: [0.4, 0.5, 0.45, 0.6, 0.55, 0.7] });

  /* the big revenue number */
  const tv = win(p, 0.34, 0.86);
  if (tv > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(tv * 3);
    text(ctx, 'ВЫРУЧКА ЗА МЕСЯЦ', W / 2, 1490, 30,
      { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 8 });
    const v = lerp(0, REVENUE, easeOutExpo(tv));
    text(ctx, money(v), W / 2, 1580, 112,
      { weight: 900, color: '#fff', glow: rgba(C.green, 0.8), glowSize: 55, maxW: 900 });
    ctx.restore();
  }
  ctx.restore();

  /* headline */
  const th = win(p, 0.42, 1);
  if (th > 0) {
    ctx.save();
    const yy = 300;
    kinetic(ctx, 'ВЫРУЧКА РАСТЁТ', W / 2 - 60, yy, 118,
      { p: th * 2.6, color: '#fff', spacing: 1, glow: rgba(C.green, 0.65), glowSize: 46, maxW: 780 });
    const ar = easeOutBack(clamp((th - 0.16) * 4));
    if (ar > 0) {
      ctx.save();
      ctx.translate(W - 175, yy - 8 - (1 - ar) * 40);
      ctx.scale(ar, ar);
      arrowUpRight(ctx, 0, 0, 96, C.green);
      ctx.restore();
    }
    ctx.restore();
  }
  vignette(ctx, 0.88);
}

/* ============================================================
   SCENE 3 - profit is collapsing: "where is the money?"
   ============================================================ */
const FALL_PTS = [0.95, 0.9, 0.93, 0.8, 0.72, 0.75, 0.6, 0.48, 0.5, 0.36, 0.28, 0.3, 0.19, 0.13, 0.14, 0.08, 0.05, 0.04];

function scene3(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.6 + A * 0.4, hueA: '#7a1030', hueB: C.red });

  const qz = win(p, 0.3, 1);
  const zoom = lerp(1.1, 1.0, easeOutCubic(clamp(p * 2))) * lerp(1, 1.16, easeInCubic(clamp(qz * 1.1)));
  ctx.save();
  ctx.translate(W / 2, H * 0.5); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * 0.5);
  ctx.globalAlpha = 1 - qz * 0.55;

  const D = dashboardPanel(ctx, p, lt, {
    title: 'ЧИСТАЯ ПРИБЫЛЬ', label: 'ПРИБЫЛЬ, 30 ДНЕЙ',
    pts: FALL_PTS, prog: easeOutCubic(clamp(p * 2.1)), color: C.red,
  });

  /* money evaporating out of the chart */
  moneyDust(ctx, W / 2, D.cy + D.ch * 0.5, 820, lt, clamp(p * 2), C.gold, 54, 91, 1);

  ctx.save();
  ctx.globalAlpha = clamp(p * 3) * 0.9;
  chip(ctx, '−92% ЗА МЕСЯЦ', W / 2, 1275,
    { size: 40, color: C.red, bg: rgba(C.red, 0.12), border: rgba(C.red, 0.4), glowC: rgba(C.red, 0.55) });
  ctx.restore();
  ctx.restore();

  /* question */
  if (qz > 0) {
    const e = easeOutQuint(clamp(qz * 2.4));
    ctx.save();
    ctx.translate(W / 2, 980);
    ctx.scale(lerp(1.5, 1, e), lerp(1.5, 1, e));
    glow(ctx, 0, 0, 640, C.red, 0.34 * clamp(qz * 3));
    chromatic(ctx, (c, col) => {
      kinetic(c, 'А ГДЕ ДЕНЬГИ?', 0, 0, 168, {
        p: qz * 2.6, color: col, spacing: 2, stagger: 0.028, maxW: 900,
        glow: col === '#fff' ? rgba(C.red, 0.85) : null, glowSize: 60,
      });
    }, Math.exp(-qz * 6) * 24);
    ctx.restore();
    if (qz < 0.35) glitch(ctx, ctx.canvas, (0.35 - qz) * 1.6, 17 + Math.floor(lt * 60));
    flash(ctx, Math.exp(-qz * 20) * 0.7, 'rgba(255,70,100,');
  }
  vignette(ctx, 0.9);
}

/* ============================================================
   SCENE 4 - the cost conveyor: money flows through 7 gates
   ============================================================ */
function scene4(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.55 + A * 0.35, hueA: C.violet, hueB: '#b3126b', pan: p * 400, grid: true });

  const n = GATES.length;
  const gap = 430, focus = 1010;
  const k = clamp(p * 1.12 - 0.06) * n;      /* how many gates have been passed */
  ctx.save();

  /* --- the money ribbon --- */
  const cx = W / 2, baseW = 330;
  const yTop = -200, yBot = H + 200;
  const gy = i => focus + (i - k) * gap;

  /* build width profile top->bottom */
  const stops = [{ y: yTop, w: baseW }];
  for (let i = 0; i < n; i++) {
    const y = gy(i);
    stops.push({ y: y - 6, w: baseW * gateRemain(i) });
    stops.push({ y: y + 6, w: baseW * gateRemain(i + 1) });
  }
  stops.push({ y: yBot, w: baseW * gateRemain(n) });
  stops.sort((a, b) => a.y - b.y);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - stops[0].w / 2, stops[0].y);
  stops.forEach(s => ctx.lineTo(cx - s.w / 2, s.y));
  for (let i = stops.length - 1; i >= 0; i--) ctx.lineTo(cx + stops[i].w / 2, stops[i].y);
  ctx.closePath();
  const rg = ctx.createLinearGradient(cx - baseW / 2, 0, cx + baseW / 2, 0);
  rg.addColorStop(0, rgba('#7a5310', 0.55));
  rg.addColorStop(0.34, rgba(C.gold, 0.60));
  rg.addColorStop(0.5, rgba('#fff2cf', 0.72));
  rg.addColorStop(0.66, rgba(C.gold, 0.60));
  rg.addColorStop(1, rgba('#7a5310', 0.55));
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.strokeStyle = rgba('#ffe6a8', 0.75); ctx.lineWidth = 3; ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) glow(ctx, cx, (i + 0.5) * (H / 5), 320, C.gold, 0.13);
  ctx.restore();

  /* flowing energy inside the ribbon */
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const r = rng(1201);
  for (let i = 0; i < 48; i++) {
    const x = cx + (r() - 0.5) * baseW * 0.9;
    const sp = 620 + r() * 900;
    const y = ((r() * H + lt * sp) % (H + 500)) - 250;
    const l = 60 + r() * 200;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(streakSprite('#fff9e0'), x, y - l, 5 + r() * 7, l * 2);
  }
  ctx.restore();

  /* --- gates --- */
  for (let i = 0; i < n; i++) {
    const G = GATES[i];
    const y = gy(i);
    if (y < -260 || y > H + 260) continue;
    const act = clamp((k - i) * 3.2);            /* 0 -> approaching, 1 -> passed */
    const hit = Math.exp(-Math.abs(k - i) * 9);
    const side = i % 2 ? 1 : -1;
    const wIn = baseW * gateRemain(i);

    /* gate bar */
    ctx.save();
    ctx.globalAlpha *= 1;
    ctx.fillStyle = 'rgba(4,6,13,0.85)';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 40;
    rr(ctx, cx - 300, y - 30, 600, 60, 30); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = clamp(1.15 - Math.abs(y - focus) / 1400) * clamp((y - 520) / 220);
    ctx.shadowColor = rgba(G.color, 0.8); ctx.shadowBlur = 30 + hit * 60;
    ctx.fillStyle = rgba(G.color, 0.9);
    const outW = baseW * gateRemain(i + 1);      /* the slot money squeezes through */
    rr(ctx, cx - 268, y - 11, 268 - outW / 2, 22, 11); ctx.fill();
    rr(ctx, cx + outW / 2, y - 11, 268 - outW / 2, 22, 11); ctx.fill();
    ctx.shadowBlur = 0;

    /* siphoned money flying to the side */
    if (hit > 0.05) {
      const rr2 = rng(700 + i);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 26; j++) {
        const ph = (lt * 1.6 + rr2()) % 1;
        const d = ph * (260 + rr2() * 260);
        dot(ctx, cx + side * (wIn / 2 + d), y - 10 + (rr2() - 0.5) * 60 - ph * 90,
            3 + rr2() * 7, G.color, hit * (1 - ph) * 0.9);
      }
      ctx.restore();
    }

    /* label */
    const lx = cx + side * 330;
    ctx.save();
    ctx.globalAlpha *= clamp(act * 1.6 + hit) * clamp((y - 700) / 200);
    const sc = lerp(0.86, 1, easeOutBack(clamp(act * 1.4))) + hit * 0.06;
    chip(ctx, G.label, lx, y - 34, {
      size: 44, color: '#fff', bg: rgba(G.color, 0.16), border: rgba(G.color, 0.55),
      glowC: rgba(G.color, 0.5 + hit * 0.5), scale: sc, spacing: 2,
    });
    text(ctx, '−' + Math.round(G.pct * 100) + '%', lx, y + 46, 52,
      { weight: 900, color: G.color, glow: rgba(G.color, 0.7), glowSize: 30 });
    ctx.restore();
    ctx.restore();
  }
  ctx.restore();

  /* --- running total at the top --- */
  const left = REVENUE * gateRemain(k);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 60;
  rr(ctx, 150, 250, W - 300, 230, 40);
  ctx.fillStyle = 'rgba(6,9,17,0.94)'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(C.gold, 0.35); ctx.stroke();
  text(ctx, 'ОСТАЁТСЯ ОТ ВЫРУЧКИ', W / 2, 320, 30,
    { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 7 });
  text(ctx, money(left), W / 2, 410, 108,
    { weight: 900, color: left / REVENUE > 0.6 ? '#fff' : C.gold, glow: rgba(C.gold, 0.75), glowSize: 45, maxW: 700 });
  ctx.restore();

  /* progress rail */
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  rr(ctx, 150, 520, W - 300, 8, 4); ctx.fill();
  ctx.fillStyle = C.gold; ctx.shadowColor = C.gold; ctx.shadowBlur = 24;
  rr(ctx, 150, 520, (W - 300) * clamp(k / n), 8, 4); ctx.fill();
  ctx.restore();

  vignette(ctx, 0.92);
}

/* ============================================================
   SCENE 5 - 1 000 000 breakdown -> what is left for you?
   ============================================================ */
const SEGS = [COGS, ...GATES, { label: 'ПРИБЫЛЬ', pct: PROFIT, color: C.green }];

function scene5(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.5 + A * 0.4, hueA: C.violet, hueB: '#0e7f5a' });

  /* headline */
  const th = win(p, 0, 0.18);
  ctx.save();
  ctx.globalAlpha = clamp(th * 2);
  text(ctx, money(REVENUE) + ' ВЫРУЧКИ', W / 2, 400, 96,
    { weight: 900, color: '#fff', glow: rgba(C.cyan, 0.6), glowSize: 44, maxW: 900 });
  ctx.restore();

  /* donut */
  const cx = W / 2, cy = 1010, rOut = 340, rIn = 218;
  const draw = clamp((p - 0.08) / 0.52);       /* segments appear one by one */
  const total = SEGS.reduce((a, s) => a + s.pct, 0);
  let a0 = -Math.PI / 2;
  const focusP = win(p, 0.62, 0.8);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(lerp(0.9, 1, easeOutCubic(clamp(p * 4))), lerp(0.9, 1, easeOutCubic(clamp(p * 4))));
  ctx.translate(-cx, -cy);

  /* track */
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = rOut - rIn;
  ctx.beginPath(); ctx.arc(cx, cy, (rOut + rIn) / 2, 0, 7); ctx.stroke();
  ctx.restore();

  let acc = 0;
  SEGS.forEach((s, i) => {
    const start = acc / total, end = (acc + s.pct) / total;
    acc += s.pct;
    const local = clamp((draw - start * 0.9) / Math.max(0.04, (end - start) * 1.25));
    if (local <= 0) return;
    const isProfit = s.label === 'ПРИБЫЛЬ';
    const A0 = a0 + start * Math.PI * 2, A1 = a0 + lerp(start, end, easeOutCubic(local)) * Math.PI * 2;
    const dim = isProfit ? 1 : 1 - focusP * 0.72;
    donutSeg(ctx, cx, cy, rOut, rIn, A0, A1, s.color, {
      alpha: dim, glowA: isProfit ? 0.9 : 0.4,
      push: isProfit ? focusP * 26 : 0,
    });
    /* leader label for the big slices */
    if (s.pct >= 0.09 && local > 0.6 && !isProfit) {
      const mid = (A0 + A1) / 2;
      const lx = cx + Math.cos(mid) * (rOut + 78), ly = cy + Math.sin(mid) * (rOut + 78);
      ctx.save();
      ctx.globalAlpha = clamp((local - 0.6) * 3) * (1 - focusP * 0.8);
      text(ctx, s.label, lx, ly - 16, 34, { weight: 800, color: '#fff' });
      text(ctx, '−' + Math.round(s.pct * 100) + '%', lx, ly + 26, 34, { weight: 800, color: s.color });
      ctx.restore();
    }
  });

  /* centre readout: money draining away */
  const remain = lerp(REVENUE, REVENUE * PROFIT, easeInOutCubic(clamp((p - 0.1) / 0.55)));
  ctx.save();
  glow(ctx, cx, cy, 250, focusP > 0.2 ? C.green : C.gold, 0.22 + focusP * 0.2);
  text(ctx, 'ОСТАЛОСЬ', cx, cy - 74, 28,
    { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 6 });
  const col = remain / REVENUE < 0.25 ? C.green : '#fff';
  text(ctx, money(remain), cx, cy + 10, 84, { weight: 900, color: col, maxW: 350,
    glow: rgba(col === '#fff' ? C.gold : C.green, 0.8), glowSize: 40 });
  text(ctx, Math.round((remain / REVENUE) * 100) + '% ОТ ВЫРУЧКИ', cx, cy + 82, 30,
    { weight: 700, family: 'Inter', spacing: 3,
      color: remain / REVENUE < 0.25 ? rgba(C.green, 0.85) : 'rgba(255,255,255,0.5)' });
  ctx.restore();
  ctx.restore();

  /* money leaving through the channels */
  moneyDust(ctx, W / 2, cy, 900, lt, clamp((p - 0.1) * 3) * (1 - focusP), C.gold, 60, 55, 1);

  /* the question */
  const tq = win(p, 0.66, 1);
  if (tq > 0) {
    ctx.save();
    kinetic(ctx, 'А СКОЛЬКО', W / 2, 1520, 122, { p: tq * 2.8, color: '#fff', spacing: 1, maxW: 860,
      glow: rgba(C.green, 0.5), glowSize: 40 });
    kinetic(ctx, 'ОСТАЛОСЬ ТЕБЕ?', W / 2, 1650, 122, { p: tq * 2.8 - 0.2, color: C.green, spacing: 1, maxW: 900,
      glow: rgba(C.green, 0.75), glowSize: 50 });
    ctx.restore();
  }
  vignette(ctx, 0.9);
}
