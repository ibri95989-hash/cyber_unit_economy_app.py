/* ============================================================
   Scenes 6-10
   ============================================================ */

/* ============================================================
   SCENE 6 - the machine spins faster, real profit does not move
   ============================================================ */
function scene6(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.5 + A * 0.4, hueA: C.violet, hueB: '#0f6fb8' });

  const speed = 1 + easeInCubic(clamp(p * 1.15)) * 5.5;   /* everything accelerates */
  const th = win(p, 0.5, 1);                             /* headline ramp */
  const dim = 1 - clamp(th * 3) * 0.62;                  /* machine steps back for the line */
  ctx.save();
  ctx.globalAlpha *= dim;

  /* --- orders counter --- */
  ctx.save();
  const tA = win(p, 0.0, 0.10);
  ctx.globalAlpha *= clamp(tA * 3);
  glassPanel(ctx, 90, 300, W - 180, 250, 40, { glow: rgba(C.cyan, 0.2) });
  text(ctx, 'ЗАКАЗОВ ЗА МЕСЯЦ', 140, 372, 30,
    { align: 'left', weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 6 });
  const orders = Math.round(lerp(880, 4870, easeOutCubic(clamp(p * 1.4))) + Math.sin(lt * 30) * 3);
  text(ctx, orders.toLocaleString('ru-RU').replace(/ /g, ' '), 140, 470, 96,
    { align: 'left', weight: 900, color: '#fff', glow: rgba(C.cyan, 0.7), glowSize: 40 });
  ctx.save();
  ctx.globalAlpha *= 0.95;
  areaChart(ctx, W - 420, 380, 280, 130, RISE_PTS, clamp(p * 1.6), C.cyan, { lineW: 5, fillTop: 0.35 });
  ctx.restore();
  arrowUpRight(ctx, W - 175, 340, 54, C.green);
  ctx.restore();

  /* --- gears --- */
  ctx.save();
  ctx.globalAlpha *= 0.85;
  const rot = lt * speed * 0.55;
  gear(ctx, 205, 1000, 148, 12, rot, C.violet, { lw: 12, alpha: 0.6 });
  gear(ctx, 396, 880, 108, 10, -rot * 1.36 + 0.26, C.cyan, { lw: 10, alpha: 0.5 });
  gear(ctx, 895, 1035, 126, 11, -rot * 1.1, C.magenta, { lw: 11, alpha: 0.45 });
  ctx.restore();

  /* --- conveyor with parcels --- */
  const beltY = 930;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(60, beltY + 70); ctx.lineTo(W - 60, beltY + 70); ctx.stroke();
  ctx.setLineDash([26, 26]);
  ctx.lineDashOffset = -lt * speed * 130;
  ctx.strokeStyle = rgba(C.cyan, 0.5); ctx.lineWidth = 5;
  ctx.shadowColor = C.cyan; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.moveTo(60, beltY + 70); ctx.lineTo(W - 60, beltY + 70); ctx.stroke();
  ctx.restore();

  const rb = rng(88);
  for (let i = 0; i < 7; i++) {
    const off = rb();
    const x = ((off * (W + 300) + lt * speed * 210) % (W + 300)) - 150;
    const s = 92 + rb() * 46;
    ctx.save();
    const trail = Math.max(0, speed - 2.5) * 9;
    if (trail > 1) isoBox(ctx, x - trail, beltY + 20, s, { alpha: 0.26, accent: i % 2 ? C.violet : C.cyan });
    isoBox(ctx, x, beltY + 20, s, { alpha: 0.9, accent: i % 2 ? C.violet : C.cyan, rot: Math.sin(lt * 3 + i) * 0.03 });
    ctx.restore();
  }

  /* --- profit gauge that refuses to move --- */
  const tg = win(p, 0.24, 0.55);
  if (tg > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp(tg * 2.5);
    const gy = 1420;
    glassPanel(ctx, 210, gy - 250, W - 420, 420, 46, { glow: rgba(C.red, 0.22) });
    const jitter = Math.sin(lt * 22) * 0.004;
    gauge(ctx, W / 2, gy + 78, 175, 0.09 * easeOutCubic(clamp(tg * 2)) + jitter,
      { color: C.red, pulse: 0.5 + 0.5 * Math.sin(lt * 5) });
    text(ctx, 'РЕАЛЬНАЯ ПРИБЫЛЬ', W / 2, gy - 180, 30,
      { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 6 });
    text(ctx, '9%', W / 2, gy - 60, 92, { weight: 900, color: C.red, glow: rgba(C.red, 0.8), glowSize: 40 });
    ctx.restore();
  }

  ctx.restore();                                          /* end of the dimmed machine layer */

  /* --- headline --- */
  if (th > 0) {
    ctx.save();
    ctx.translate(0, -30);
    const bg = clamp(th * 3);
    plate(ctx, 20, 655, W - 40, 500, 70, 'rgba(3,5,12,0.9)', 34, bg);
    kinetic(ctx, 'БОЛЬШЕ ПРОДАЖ', W / 2, 790, 118,
      { p: th * 2.6, color: '#fff', spacing: 1, maxW: 900, glow: rgba(C.cyan, 0.45), glowSize: 40 });
    const ne = easeOutBack(clamp((th - 0.14) * 3.2));
    if (ne > 0) { ctx.save(); ctx.translate(W / 2, 930); ctx.scale(ne, ne); notEqual(ctx, 0, 0, 110, C.red); ctx.restore(); }
    kinetic(ctx, 'БОЛЬШЕ ДЕНЕГ', W / 2, 1060, 118,
      { p: th * 2.6 - 0.3, color: '#fff', spacing: 1, maxW: 900, glow: rgba(C.magenta, 0.5), glowSize: 40 });
    ctx.restore();
  }
  vignette(ctx, 0.9);
}

/* ============================================================
   SCENE 7 - working harder: the montage
   ============================================================ */
const CARDS = [
  { l: 'НОВАЯ ЗАКУПКА', v: '−400 000 ₽', c: '#8b5cf6' },
  { l: 'РЕКЛАМА',       v: '−120 000 ₽', c: '#35e0f5' },
  { l: 'ЗАКАЗЫ',        v: '+38%',       c: '#23e68a' },
  { l: 'ОБОРОТ',        v: '1 400 000 ₽',c: '#ffc46b' },
  { l: 'ХРАНЕНИЕ',      v: '−24 000 ₽',  c: '#ff7a45' },
  { l: 'ВОЗВРАТЫ',      v: '−56 000 ₽',  c: '#ff3b5c' },
];

function scene7(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.75 + A * 0.25, hueA: C.magenta, hueB: C.violet, pan: p * 900 });

  /* speed lines */
  streaks(ctx, lt, { count: 46, color: '#9fd0ff', speed: 2400, alpha: 0.30, seed: 5, len: 420, thick: 4 });

  /* flying cards */
  const rc = rng(303);
  for (let i = 0; i < 9; i++) {
    const card = CARDS[i % CARDS.length];
    const off = rc(), sp = 0.55 + rc() * 0.5;
    const ph = ((lt * sp * 0.85 + off) % 1);
    const y = 1300 - ph * 1450;   /* bottom bound accounts for the card's own ~90px
       half-height at max scale, so its edge - not just its centre - clears the caption bar */
    const x = 150 + rc() * (W - 300);
    const sc = 0.62 + rc() * 0.5;
    const a = Math.sin(ph * Math.PI) * 1.15;
    if (a <= 0.02) continue;
    const smear = (1 - Math.sin(ph * Math.PI)) * 26;     /* cheap vertical motion smear */
    const rot = ((i * 0.37) % 1 - 0.5) * 0.16;
    for (const [dy, al] of [[-smear, 0.3], [smear, 0.3], [0, 1]]) {
      if (al < 1 && smear < 9) continue;
      ctx.save();
      ctx.globalAlpha = clamp(a) * 0.95 * al;
      ctx.translate(x, y + dy);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      if (al === 1) glow(ctx, 0, 0, 230, card.c, 0.18);
      glassPanel(ctx, -230, -80, 460, 160, 34);
      text(ctx, card.l, 0, -22, 34, { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.62)', spacing: 3, maxW: 400 });
      text(ctx, card.v, 0, 34, 56, { weight: 900, color: card.c, maxW: 400 });
      ctx.restore();
    }
  }

  /* centre statements */
  const t1 = win(p, 0.06, 0.52), t2 = win(p, 0.54, 1);
  if (t2 <= 0 && t1 > 0) {
    ctx.save();
    const out = win(p, 0.44, 0.52);
    ctx.globalAlpha = 1 - out;
    ctx.translate(W / 2 - out * 700, 960);
    plate(ctx, -520, -180, 1040, 360, 60, 'rgba(3,5,12,0.78)', 30, 0.94);
    kinetic(ctx, 'ТЫ РАБОТАЕШЬ', 0, -70, 130, { p: t1 * 2.4, color: '#fff', spacing: 1, maxW: 900,
      glow: rgba(C.violet, 0.55), glowSize: 44 });
    kinetic(ctx, 'БОЛЬШЕ…', 0, 70, 130, { p: t1 * 2.4 - 0.18, color: '#fff', spacing: 1, maxW: 900,
      glow: rgba(C.violet, 0.55), glowSize: 44 });
    ctx.restore();
  }
  if (t2 > 0) {
    ctx.save();
    const e = easeOutQuint(clamp(t2 * 2.6));
    ctx.translate(W / 2 + (1 - e) * 640, 960);
    plate(ctx, -520, -220, 1040, 440, 60, 'rgba(3,5,12,0.8)', 30, 0.94);
    kinetic(ctx, 'НО ЗАРАБАТЫВАЕШЬ', 0, -100, 122, { p: t2 * 2.6, color: '#fff', spacing: 0, maxW: 940,
      glow: rgba(C.magenta, 0.6), glowSize: 46 });
    kinetic(ctx, 'ЛИ БОЛЬШЕ?', 0, 60, 148, { p: t2 * 2.6 - 0.22, color: C.magenta, spacing: 1, maxW: 900,
      glow: rgba(C.magenta, 0.85), glowSize: 60 });
    ctx.restore();
    flash(ctx, Math.exp(-t2 * 22) * 0.5);
  }
  vignette(ctx, 0.88);
}

/* ============================================================
   SCENE 8 - revenue vs profit, side by side
   ============================================================ */
function scene8(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.4 + A * 0.3, hueA: '#2a3f8f', hueB: '#0e7f5a', particles: true });

  const push = easeInOutCubic(win(p, 0.62, 1));
  ctx.save();
  const sc = lerp(1, 1.42, push);
  ctx.translate(W * 0.72, 1180);
  ctx.scale(sc, sc);
  ctx.translate(-W * 0.72, -1180);

  const baseY = 1240, maxH = 800;   /* lifted clear of the caption bar reserved below ~1450 */
  const grow = easeOutCubic(win(p, 0.05, 0.55));
  const cols = [
    { x: 200, w: 300, label: 'ВЫРУЧКА', val: REVENUE,          frac: 1,      color: C.violet, dim: push * 0.65 },
    { x: 620, w: 300, label: 'ПРИБЫЛЬ', val: REVENUE * PROFIT, frac: PROFIT, color: C.green,  dim: 0 },
  ];

  /* rail ticks */
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([8, 14]);
  for (let i = 0; i <= 5; i++) {
    const y = baseY - (i / 5) * maxH;
    ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(W - 120, y); ctx.stroke();
  }
  ctx.restore();

  cols.forEach((c, i) => {
    const h = maxH * c.frac * grow;
    ctx.save();
    ctx.globalAlpha = 1 - c.dim;
    /* bar */
    const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    g.addColorStop(0, rgba(c.color, 0.95));
    g.addColorStop(1, rgba(c.color, 0.28));
    ctx.fillStyle = g;
    ctx.shadowColor = rgba(c.color, 0.7); ctx.shadowBlur = 50;
    rr(ctx, c.x, baseY - h, c.w, Math.max(h, 6), 22); ctx.fill();
    ctx.shadowBlur = 0;
    /* top cap */
    ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.9;
    rr(ctx, c.x, baseY - h - 6, c.w, 10, 5); ctx.fill();
    ctx.restore();

    /* label + number */
    ctx.save();
    ctx.globalAlpha = 1 - c.dim * 0.8;
    text(ctx, c.label, c.x + c.w / 2, baseY + 66, 44, { weight: 800, color: '#fff', spacing: 3, maxW: c.w + 40 });
    const shown = lerp(0, c.val, easeOutExpo(win(p, 0.1 + i * 0.06, 0.62)));
    const ty = baseY - h - 70;
    ctx.globalAlpha *= clamp((win(p, 0.1, 0.28)) * 2);
    text(ctx, money(shown), c.x + c.w / 2, ty, i === 1 ? 62 : 66,
      { weight: 900, color: c.color, glow: rgba(c.color, 0.8), glowSize: 40, maxW: 460 });
    ctx.restore();
  });

  /* comparison bracket */
  const tb = win(p, 0.5, 0.75);
  if (tb > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(tb * 2) * (1 - push * 0.5);
    ctx.strokeStyle = rgba(C.green, 0.7); ctx.lineWidth = 4; ctx.setLineDash([12, 12]);
    const y = baseY - maxH * PROFIT * grow;
    ctx.beginPath(); ctx.moveTo(180, y); ctx.lineTo(W - 140, y); ctx.stroke();
    ctx.restore();
    chip(ctx, 'ЭТО 9% ОТ ВЫРУЧКИ', W / 2, baseY - maxH * PROFIT - 250, {
      size: 40, color: C.green, bg: rgba(C.green, 0.12), border: rgba(C.green, 0.45),
      glowC: rgba(C.green, 0.5), alpha: clamp(tb * 2),
    });
  }
  ctx.restore();

  /* heading */
  ctx.save();
  ctx.globalAlpha = clamp(win(p, 0, 0.12) * 2) * (1 - push * 0.7);
  text(ctx, 'ОДИН И ТОТ ЖЕ МЕСЯЦ', W / 2, 380, 40,
    { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.6)', spacing: 8 });
  ctx.restore();
  vignette(ctx, 0.9);
}

/* ============================================================
   SCENE 9 - emotional finale
   ============================================================ */
function scene9(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.7 + A * 0.3, hueA: C.violet, hueB: C.gold, grid: false });
  streaks(ctx, lt, { count: 40, color: C.gold, speed: 1700, alpha: 0.5, seed: 21, len: 520, thick: 7 });

  const lines = [
    { s: 'МИЛЛИОН ОБОРОТА',  at: 0.04, y: 800,  size: 128, color: '#fff',   glow: rgba(C.gold, 0.6) },
    { s: 'НЕ ВСЕГДА ОЗНАЧАЕТ', at: 0.36, y: 960,  size: 92,  color: 'rgba(255,255,255,0.72)', glow: null },
    { s: 'МИЛЛИОН УСПЕХА',  at: 0.66, y: 1140, size: 138, color: C.gold,  glow: rgba(C.gold, 0.9) },
  ];
  lines.forEach((L, i) => {
    const tp = win(p, L.at, 1);
    if (tp <= 0) return;
    ctx.save();
    const e = easeOutQuint(clamp(tp * 3.2));
    ctx.translate(W / 2, L.y);
    ctx.scale(lerp(1.14, 1, e), lerp(1.14, 1, e));
    kinetic(ctx, L.s, 0, 0, L.size, {
      p: tp * 3, color: L.color, spacing: 1, stagger: 0.03, maxW: 940,
      glow: L.glow, glowSize: 55,
    });
    ctx.restore();
    if (i === 2 && tp < 0.2) { flash(ctx, (0.2 - tp) * 2.4, 'rgba(255,210,140,'); shockwave(ctx, W / 2, L.y, tp * 5, C.gold, 1300); }
  });

  /* money rushing through the frame */
  moneyDust(ctx, W / 2, H * 0.75, 1000, lt, 1, C.gold, 70, 12, 1);
  vignette(ctx, 0.92);
}

/* ============================================================
   SCENE 10 - the payoff + CTA
   ============================================================ */
function scene10(ctx, p, lt, gt, A) {
  /* premium black */
  ctx.fillStyle = '#020307'; ctx.fillRect(0, 0, W, H);
  glow(ctx, W / 2, H * 0.42, 900, C.green, 0.13 + 0.04 * Math.sin(lt * 1.6));
  glow(ctx, W * 0.2, H * 0.8, 620, C.violet, 0.1);
  ctx.save();
  ctx.globalAlpha = 0.5;
  const r = rng(777);
  for (let i = 0; i < 34; i++) {
    const x = r() * W, y = (r() * H - lt * 26 * (0.4 + r())) % H;
    dot(ctx, x, y < 0 ? y + H : y, 1.6 + r() * 3.4, '#cfe4ff', 0.10 + r() * 0.28);
  }
  ctx.restore();

  /* line 1 - "don't count revenue" (struck through) */
  const t1 = win(p, 0.02, 0.34);
  if (t1 > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(t1 * 3);
    kinetic(ctx, 'СЧИТАЙ НЕ ВЫРУЧКУ', W / 2, 760, 108,
      { p: t1 * 2.8, color: 'rgba(255,255,255,0.82)', spacing: 1, maxW: 920 });
    /* strike */
    const sw = easeOutExpo(clamp((t1 - 0.35) * 2.4));
    if (sw > 0) {
      font(ctx, 900, fitSize(ctx, 'СЧИТАЙ НЕ ВЫРУЧКУ', 920, 108, 900), 'Montserrat');
      const w = Math.min(920, ctx.measureText('СЧИТАЙ НЕ ВЫРУЧКУ').width);
      ctx.strokeStyle = C.red; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.shadowColor = C.red; ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.moveTo(W / 2 - w / 2, 766);
      ctx.lineTo(W / 2 - w / 2 + w * sw, 766);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* line 2 - "count profit" */
  const t2 = win(p, 0.3, 0.62);
  if (t2 > 0) {
    ctx.save();
    const e = easeOutQuint(clamp(t2 * 3));
    ctx.translate(W / 2, 950);
    ctx.scale(lerp(1.2, 1, e), lerp(1.2, 1, e));
    glow(ctx, 0, 0, 620, C.green, 0.26 * clamp(t2 * 3));
    kinetic(ctx, 'СЧИТАЙ ПРИБЫЛЬ', 0, 0, 158,
      { p: t2 * 3, color: '#fff', spacing: 1, maxW: 940, glow: rgba(C.green, 0.95), glowSize: 70 });
    ctx.restore();
    if (t2 < 0.25) shockwave(ctx, W / 2, 950, t2 * 4, C.green, 1200);
  }

  /* CTA */
  const t3 = win(p, 0.56, 0.92);
  if (t3 > 0) {
    const e = easeOutBack(clamp(t3 * 2.4));
    const pulse = 0.5 + 0.5 * Math.sin(lt * 3.4);
    ctx.save();
    ctx.globalAlpha = clamp(t3 * 3);
    ctx.translate(W / 2, 1300);
    ctx.scale(e * (1 + pulse * 0.012), e * (1 + pulse * 0.012));
    chip(ctx, 'ПРОВЕРЬ СВОЮ ЮНИТ-ЭКОНОМИКУ', 0, 0, {
      size: 46, color: '#02110b', weight: 900, spacing: 2, padX: 56, padY: 40,
      bg: rgba(C.green, 0.92), border: rgba(C.green, 1), glowC: rgba(C.green, 0.45 + pulse * 0.45),
    });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = clamp((t3 - 0.3) * 3) * 0.72;
    text(ctx, 'СЧИТАЙ ЮНИТ-ЭКОНОМИКУ ДО ЗАКУПКИ, А НЕ ПОСЛЕ', W / 2, 1440, 30,
      { weight: 600, family: 'Inter', color: 'rgba(255,255,255,0.65)', spacing: 3, maxW: 900 });
    ctx.restore();
  }
  vignette(ctx, 0.95);
}
