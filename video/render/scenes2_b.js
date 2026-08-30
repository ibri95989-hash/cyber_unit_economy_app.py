/* ============================================================
   Beats V6-V10: recap gauge -> accelerating risk -> redirect ->
   per-unit breakdown -> ending.
   ============================================================ */

/* ---------------- V6: card8  ("каждый расход забирает часть...") - */
function beatGauge(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.4 + A * 0.35, hueA: '#7a1030', hueB: C.violet });

  ctx.save();
  ctx.globalAlpha = clamp(p * 2.4);
  const gy = 980;
  glassPanel(ctx, 200, gy - 300, W - 400, 460, 46, { glow: rgba(C.red, 0.2) });
  text(ctx, 'РЕАЛЬНАЯ ПРИБЫЛЬ', W / 2, gy - 220, 30,
    { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 6 });
  const val = lerp(0.55, 0.09, easeInOutCubic(clamp(p * 1.3)));
  gauge(ctx, W / 2, gy - 20, 195, val, { color: C.red, pulse: 0.5 + 0.5 * Math.sin(lt * 4) });
  text(ctx, Math.round(val * 100) + '%', W / 2, gy - 118, 90,
    { weight: 900, color: C.red, glow: rgba(C.red, 0.8), glowSize: 40 });
  ctx.restore();

  moneyDust(ctx, W / 2, 1450, 900, lt, clamp(p * 2), C.gold, 40, 71, 1);
  vignette(ctx, 0.9);
}

/* ---------------- V7: card9  (more sales, more risk) -------------- */
function beatRisk(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.5 + A * 0.4, hueA: C.violet, hueB: '#7a1030' });

  const speed = 1 + easeInCubic(clamp(p * 1.2)) * 4.5;
  const rot = lt * speed * 0.5;

  ctx.save();
  ctx.globalAlpha = 0.7;
  gear(ctx, 210, 1520, 140, 12, rot, C.violet, { lw: 12, alpha: 0.55 });
  gear(ctx, 900, 1560, 120, 11, -rot * 1.2, C.red, { lw: 11, alpha: 0.5 });
  ctx.restore();

  /* orders climbing */
  ctx.save();
  const tA = win(p, 0.0, 0.25);
  ctx.globalAlpha = clamp(tA * 3);
  glassPanel(ctx, 100, 320, W - 200, 240, 40, { glow: rgba(C.cyan, 0.18) });
  text(ctx, 'ЗАКАЗОВ СЕГОДНЯ', 150, 392, 28,
    { align: 'left', weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 5 });
  const orders = Math.round(lerp(60, 640, easeOutCubic(clamp(p * 1.3))));
  text(ctx, orders.toString(), 150, 490, 92,
    { align: 'left', weight: 900, color: '#fff', glow: rgba(C.cyan, 0.6), glowSize: 34 });
  arrowUpRight(ctx, W - 190, 400, 60, C.red);
  ctx.restore();

  /* risk pulse growing with speed */
  const riskR = 200 + (speed - 1) * 46;
  ctx.save();
  ctx.globalAlpha = 0.55;
  glow(ctx, W / 2, 980, riskR + 60, C.red, 0.28 + (speed - 1) * 0.03);
  ctx.strokeStyle = rgba(C.red, 0.55); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(W / 2, 980, riskR, 0, 7); ctx.stroke();
  ctx.restore();
  notEqual(ctx, W / 2, 980, 150, C.red);

  const tags = [
    { s: 'БОЛЬШЕ ПРОДАЖ', at: 0.32, y: 1300, color: '#fff' },
    { s: 'БОЛЬШЕ РИСК ПОТЕРЬ', at: 0.58, y: 1440, color: C.red },
  ];
  tags.forEach(tg => {
    const tp = win(p, tg.at, 1);
    if (tp <= 0) return;
    kinetic(ctx, tg.s, W / 2, tg.y, 78, {
      p: tp * 3, color: tg.color, spacing: 1, maxW: 880,
      glow: rgba(tg.color === '#fff' ? C.violet : C.red, 0.5), glowSize: 34,
    });
  });

  vignette(ctx, 0.9);
}

/* ---------------- V8: card10  ("не смотри только на выручку") ----- */
function beatRedirect(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.35 + A * 0.3, hueA: '#2a3f8f', hueB: C.violet });

  const fade = 1 - easeInOutCubic(clamp(p * 1.4));
  ctx.save();
  ctx.globalAlpha = 0.5 * fade;
  text(ctx, 'ВЫРУЧКА', W / 2, 860, 130, { weight: 900, color: 'rgba(255,255,255,0.5)', spacing: 2, maxW: 900 });
  ctx.restore();

  const e = easeOutCubic(clamp(p * 1.6));
  ctx.save();
  ctx.translate(0, lerp(0, 260, e));
  ctx.globalAlpha = clamp(p * 2.4);
  glow(ctx, W / 2, 1180, 420, C.green, 0.24);
  kinetic(ctx, 'СМОТРИ НА ПРИБЫЛЬ', W / 2, 1180, 108, {
    p: p * 2.4, color: '#fff', spacing: 1, maxW: 900, glow: rgba(C.green, 0.7), glowSize: 44,
  });
  ctx.restore();

  vignette(ctx, 0.88);
}

/* ---------------- V9: cards 11-12  (per-sale breakdown) ----------- */
const UNIT_PRICE = 2400;
const UNIT_SEGS = [
  { label: 'СЕБЕСТОИМОСТЬ', pct: 0.35, color: '#4b5fd6' },
  { label: 'КОМИССИЯ И ЛОГИСТИКА', pct: 0.27, color: '#ff2e93' },
  { label: 'РЕКЛАМА И СКИДКИ', pct: 0.17, color: '#35e0f5' },
  { label: 'ХРАНЕНИЕ, ВОЗВРАТЫ, НАЛОГИ', pct: 0.12, color: '#ff7a45' },
];
const UNIT_PROFIT = 1 - UNIT_SEGS.reduce((a, s) => a + s.pct, 0);

function beatUnit(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.4 + A * 0.35, hueA: C.violet, hueB: '#0e7f5a' });

  const { c: c11, p: p11 } = cardWin(11, gt);
  const { p: p12 } = cardWin(12, gt);

  if (p11 > 0 && p11 < 1) {
    ctx.save();
    ctx.globalAlpha = clamp(p11 * 3) * (1 - clamp((p11 - 0.6) / 0.4));
    text(ctx, 'ГЛАВНЫЙ ВОПРОС', W / 2, 330, 34,
      { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 8 });
    ctx.restore();
  }

  const pf = clamp(p12 * 1.15);
  const topY = 560, botY = 1280, fw = 420;   /* stays clear of the caption bar below */
  const stages = [{ f: 1 }];
  let acc = 0;
  UNIT_SEGS.forEach(s => { acc += s.pct; stages.push({ f: 1 - acc }); });

  ctx.save();
  ctx.globalAlpha = clamp(pf * 2.2);
  /* funnel: single tapering shape, one stop per cost category */
  const yAt = i => lerp(topY, botY, i / (stages.length - 1));
  ctx.beginPath();
  ctx.moveTo(W / 2 - fw * stages[0].f / 2, yAt(0));
  stages.forEach((s, i) => ctx.lineTo(W / 2 - s.f * fw / 2, yAt(i)));
  for (let i = stages.length - 1; i >= 0; i--) ctx.lineTo(W / 2 + stages[i].f * fw / 2, yAt(i));
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, topY, 0, botY);
  fg.addColorStop(0, rgba(C.violet, 0.85));
  fg.addColorStop(1, rgba(C.green, 0.9));
  ctx.fillStyle = fg;
  ctx.shadowColor = rgba(C.green, 0.4); ctx.shadowBlur = 40;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2.5; ctx.stroke();

  /* category ticks */
  UNIT_SEGS.forEach((s, i) => {
    const rowP = win(pf, 0.12 + i * 0.16, 0.12 + i * 0.16 + 0.3);
    if (rowP <= 0) return;
    const y = (yAt(i) + yAt(i + 1)) / 2;
    const side = i % 2 ? 1 : -1;
    ctx.save();
    ctx.globalAlpha *= clamp(rowP * 2);
    chip(ctx, s.label, W / 2 + side * 320, y, {
      size: 27, color: '#fff', bg: rgba(s.color, 0.18), border: rgba(s.color, 0.5),
      glowC: rgba(s.color, 0.4), padX: 22, padY: 15, maxW: 380,
    });
    text(ctx, '−' + Math.round(s.pct * 100) + '%', W / 2 + side * 320, y + 44, 26,
      { weight: 800, color: s.color });
    ctx.restore();
  });
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = clamp(pf * 2.6);
  text(ctx, 'ЦЕНА ТОВАРА', W / 2, topY - 96, 26,
    { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 5 });
  text(ctx, money(UNIT_PRICE), W / 2, topY - 40, 62, { weight: 900, color: '#fff', maxW: 500 });
  ctx.restore();

  const pEnd = clamp((pf - 0.75) * 4);
  if (pEnd > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(pEnd * 2);
    glow(ctx, W / 2, botY + 62, 240, C.green, 0.3);
    text(ctx, 'ОСТАЁТСЯ ТЕБЕ', W / 2, botY + 30, 27,
      { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.6)', spacing: 5 });
    text(ctx, money(Math.round(UNIT_PRICE * UNIT_PROFIT)), W / 2, botY + 94, 78,
      { weight: 900, color: C.green, glow: rgba(C.green, 0.85), glowSize: 40, maxW: 600 });
    ctx.restore();
  }

  vignette(ctx, 0.9);
}

/* ---------------- V10: cards 13-14  (ending) ----------------------- */
function beatEnding(ctx, p, lt, gt, A) {
  ctx.fillStyle = '#020307'; ctx.fillRect(0, 0, W, H);
  glow(ctx, W / 2, H * 0.4, 900, C.red, 0.12 + 0.04 * Math.sin(lt * 1.4));
  ctx.save();
  ctx.globalAlpha = 0.4;
  const r = rng(555);
  for (let i = 0; i < 30; i++) {
    const x = r() * W, y = (r() * H - lt * 22 * (0.4 + r())) % H;
    dot(ctx, x, y < 0 ? y + H : y, 1.6 + r() * 3.2, '#cfe4ff', 0.1 + r() * 0.24);
  }
  ctx.restore();

  const { p: p13 } = cardWin(13, gt);
  const { p: p14 } = cardWin(14, gt);

  if (p13 > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(p13 * 3) * (1 - clamp((p13 - 0.7) / 0.3) * 0.4);
    kinetic(ctx, 'ТОВАР ПРОДАЁТСЯ ОТЛИЧНО…', W / 2, 780, 84,
      { p: p13 * 2.6, color: 'rgba(255,255,255,0.85)', spacing: 1, maxW: 940 });
    ctx.restore();
  }

  if (p14 > 0) {
    const e = easeOutQuint(clamp(p14 * 2.6));
    ctx.save();
    ctx.translate(W / 2, 1000);
    ctx.scale(lerp(1.22, 1, e), lerp(1.22, 1, e));
    glow(ctx, 0, 0, 640, C.red, 0.3 * clamp(p14 * 3));
    chromatic(ctx, (c, col) => {
      kinetic(c, 'НО РАБОТАЕТ', 0, -80, 128, { p: p14 * 2.6, color: col, spacing: 1, maxW: 900,
        glow: col === '#fff' ? rgba(C.red, 0.8) : null, glowSize: 55 });
      kinetic(c, 'ПРОТИВ ТЕБЯ', 0, 80, 128, { p: p14 * 2.6 - 0.18, color: col, spacing: 1, maxW: 900,
        glow: col === '#fff' ? rgba(C.red, 0.8) : null, glowSize: 55 });
    }, Math.exp(-p14 * 6) * 18);
    ctx.restore();
    if (p14 < 0.2) flash(ctx, Math.exp(-p14 * 18) * 0.5, 'rgba(255,60,90,');
  }

  vignette(ctx, 0.95);
}
