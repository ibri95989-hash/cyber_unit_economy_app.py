/* ============================================================
   scenes.js — семь сцен ролика (9:16, 25 c)
   Все тексты — осторожные формулировки: «сообщают», «ожидают»,
   «что происходит?». Никаких утверждений о причинах.
   ============================================================ */

const M = 84;                 // боковые поля
const CW = W - M * 2;         // рабочая ширина 912
const CX = W / 2;

/* ------------------------------------------------------------------
   Общие помощники сцен
   ------------------------------------------------------------------ */

/** камера: масштаб вокруг точки + смещение (применять до отрисовки) */
function camera(ctx, scale, ox = 0, oy = 0, cx = CX, cy = H / 2, rot = 0) {
  ctx.translate(cx + ox, cy + oy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
}

/** строка с маскированным выездом снизу вверх */
function revealLine(ctx, str, x, y, size, o = {}) {
  const p = clamp(o.p === undefined ? 1 : o.p);
  if (p <= 0) return;
  const e = E.outExpo(p);
  const pad = size * .34;
  clipRect(ctx, 0, y - size - pad, W, size + pad * 2, () => {
    text(ctx, str, x, y + (1 - e) * size * 1.15, Object.assign({ size }, o, { p: undefined }));
  });
}

/** пульсирующее тревожное кольцо */
function alarmRing(ctx, t, start, x, y, r0, r1, color, dur = 1.1, w = 6) {
  const k = inv(t, start, start + dur);
  if (k <= 0 || k >= 1) return;
  const e = E.outQuart(k);
  ctx.save();
  ctx.globalAlpha = (1 - k) * .85;
  ctx.strokeStyle = color;
  ctx.lineWidth = w * (1 - k * .6);
  ctx.shadowColor = color; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(x, y, lerp(r0, r1, e), 0, 7); ctx.stroke();
  ctx.restore();
}

/** восходящие частицы-искры */
function embers(ctx, t, count, color, alpha = .5, seed = 5, speed = 60) {
  const rng = new Rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const x0 = rng.range(0, W), ph = rng.range(0, 40), sp = rng.range(.5, 1.6) * speed;
    const r = rng.range(1.6, 4.4);
    const y = H + 60 - (((t + ph) * sp) % (H + 220));
    const x = x0 + Math.sin((t + ph) * .8) * 26;
    ctx.globalAlpha = alpha * (.35 + .65 * hash11(i * 3.7));
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* ==================================================================
   СЦЕНА 1 — HOOK (0.0 – 2.0)
   ================================================================== */
function scene1(ctx, t, w, S) {
  const camScale = 1 + E.outExpo(inv(t, S(.18), S(.18) + S.d(0.82))) * .06 + inv(w, 1.5, 4.58) * .07;
  const [sx, sy] = shake(t, S(.22), .45, 16, 2);
  const [sx2, sy2] = shake(t, S(1.02), .3, 9, 8);

  ctx.save();
  camera(ctx, camScale, sx + sx2, sy + sy2);

  drawBackground(ctx, w, {
    accent: '#7A0B2B', accent2: '#31063F', mid: '#150713',
    grid: .45, energy: .35 + .3 * pulse(w, .9), gridSpeed: 44,
  });

  // красная пульсация тревоги
  const alarm = .35 + .65 * Math.pow(pulse(w, 1.6), 2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = .5 * alarm * inv(t, S(.05), S(.05) + S.d(0.45));
  ctx.fillStyle = rg(ctx, CX, H * .5, H * .1, H * .62,
    [[0, A(C.red, .0)], [.55, A(C.red, .10)], [1, A(C.red, .34)]]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  for (const [rt, rc, rw] of [[.24, C.red, 8], [1.5, C.magenta, 6],
                              [2.7, C.red, 7], [3.9, C.magenta, 6]]) {
    alarmRing(ctx, w, rt, CX, H * .52, 120, 900, A(rc, .85), 1.2, rw);
  }

  embers(ctx, w, 26, C.red, .35, 11, 70);

  /* --- карточка уведомления --- */
  const np = inv(t, S(.06), S(.06) + S.d(0.4));
  if (np > 0) {
    const ny = lerp(-240, 236, E.outExpo(np));
    const ph = 200;
    ctx.save();
    ctx.globalAlpha = clamp(np * 2);
    panel(ctx, M, ny, CW, ph, {
      r: 30,
      fill: lg(ctx, M, ny, M, ny + ph, [[0, 'rgba(48,14,26,.96)'], [1, 'rgba(18,8,14,.96)']]),
      border: A(C.red, .45), accent: C.red, topLine: C.red,
    });
    // иконка
    const ix = M + 96, iy = ny + ph / 2;
    ctx.save();
    rr(ctx, ix - 56, iy - 56, 112, 112, 28);
    ctx.fillStyle = A(C.red, .16); ctx.fill();
    ctx.strokeStyle = A(C.red, .5); ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    iconAlert(ctx, ix, iy + 4, 68, C.red, A(C.red, .9));
    // текст
    text(ctx, 'УВЕДОМЛЕНИЕ · 28.08', M + 178, ny + 82, {
      size: 32, weight: 700, family: MONO, ls: 6, color: A(C.red, .95), align: 'left',
    });
    text(ctx, 'СТАТУС ВЫПЛАТЫ: ОЖИДАНИЕ', M + 178, ny + 148, {
      size: 50, weight: 800, color: C.ink, align: 'left', maxWidth: CW - 230,
    });
    // мигающая точка
    ctx.save();
    ctx.globalAlpha = .4 + .6 * pulse(w, 2.4);
    ctx.fillStyle = C.red; ctx.shadowColor = C.red; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(W - M - 48, ny + 52, 12, 0, 7); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* --- главный заголовок --- */
  const blockY = 940;
  const punch = inv(t, S(.20), S(.20) + S.d(0.58));
  const bs = lerp(1.34, 1, E.outExpo(punch));
  ctx.save();
  ctx.translate(CX, blockY);
  ctx.scale(bs, bs);
  ctx.translate(-CX, -blockY);

  const s1 = fitSize(ctx, 'WILDBERRIES', 158, CW, 900);
  const s2 = fitSize(ctx, 'ЗАДЕРЖИВАЕТ', 158, CW, 900);
  const s3 = fitSize(ctx, 'ВЫПЛАТЫ?', 190, CW, 900);
  const y1 = blockY - 150, y2 = blockY + 10, y3 = blockY + 196;

  revealLine(ctx, 'WILDBERRIES', CX, y1, s1, {
    p: inv(t, S(.20), S(.20) + S.d(0.4)), weight: 900, ls: -2, color: C.ink,
    glow: { color: 'rgba(255,255,255,.25)', blur: 40 },
  });
  revealLine(ctx, 'ЗАДЕРЖИВАЕТ', CX, y2, s2, {
    p: inv(t, S(.32), S(.32) + S.d(0.4)), weight: 900, ls: -2, color: C.ink,
    glow: { color: 'rgba(255,255,255,.2)', blur: 36 },
  });
  // третья строка — акцент
  const p3 = inv(t, S(.44), S(.44) + S.d(0.42));
  if (p3 > 0) {
    ctx.save();
    const grad = lg(ctx, CX - CW / 2, y3 - s3, CX + CW / 2, y3,
      [[0, '#FF4D6D'], [.5, '#FF2D55'], [1, '#E7239B']]);
    revealLine(ctx, 'ВЫПЛАТЫ?', CX, y3, s3, {
      p: p3, weight: 900, ls: -2, color: grad,
      glow: { color: A(C.red, .75), blur: 60, passes: 2 },
    });
    ctx.restore();
  }
  ctx.restore();

  /* --- подпись-плашка --- */
  const cp = inv(t, S(.95), S(.95) + S.d(0.4));
  if (cp > 0) {
    ctx.save();
    ctx.globalAlpha = E.outCubic(cp);
    ctx.translate(0, (1 - E.outExpo(cp)) * 40);
    chip(ctx, CX, 1330, 'ПРОДАВЦЫ СООБЩАЮТ О ЗАДЕРЖКАХ', C.amber, {
      align: 'center', size: 33, h: 72, padX: 34, dotScale: .9 + .25 * pulse(w, 2),
    });
    ctx.restore();
  }

  ctx.restore();

  vignette(ctx, .95, '#170007');
  scanlines(ctx, .05, 6);

  // глитч-всплески
  let gg = 0;
  for (const gt of [.9, 2.35, 3.75]) {
    gg = Math.max(gg, inv(w, gt, gt + .09) * (1 - inv(w, gt + .09, gt + .2)));
  }
  if (gg > .01) {
    sliceGlitch(ctx, gg * .3, Math.floor(w * 60), 10);
    rgbSplit(ctx, gg * 7);
  }
  rgbSplit(ctx, 1.1);
  flash(ctx, inv(t, S(0), S(0) + S.d(0.06)) > 0 ? (1 - inv(t, S(0), S(0) + S.d(0.12))) * .55 : 0, '#FFDCE4');
}

/* ==================================================================
   СЦЕНА 2 — ДАТА (2.0 – 5.0), длительность 3.0
   ================================================================== */
function scene2(ctx, t, w, S) {
  const [sx, sy] = shake(t, S(1.42), .5, 20, 4);
  ctx.save();
  camera(ctx, 1 + inv(t, S(0), S(0) + S.d(3.0)) * .05, sx, sy);

  drawBackground(ctx, w, {
    accent: '#2B1370', accent2: '#0E3A6B', mid: '#0A1024',
    grid: .55, energy: .45, gridSpeed: 30,
  });

  /* --- дата --- */
  const dp = inv(t, S(.05), S(.05) + S.d(0.45));
  const rollSeq = ['06', '13', '19', '23', '26', '27', '28'];
  const idx = Math.min(rollSeq.length - 1, Math.floor(E.outQuart(inv(t, S(.05), S(.05) + S.d(0.57))) * rollSeq.length));
  const day = rollSeq[idx];
  const locked = t > .62;
  const dayScale = locked ? 1 + Math.pow(1 - inv(t, S(.62), S(.62) + S.d(0.2)), 2) * .12 : 1;

  ctx.save();
  ctx.globalAlpha = E.outCubic(dp);
  ctx.translate(CX, 540);
  ctx.scale(dayScale, dayScale);
  text(ctx, day, 0, 0, {
    size: 300, weight: 900, ls: -8, color: C.ink, align: 'center',
    glow: { color: A(C.blue, .55), blur: 60 },
  });
  ctx.restore();

  const ap = inv(t, S(.3), S(.3) + S.d(0.4));
  ctx.save();
  ctx.globalAlpha = E.outCubic(ap);
  text(ctx, 'А В Г У С Т А', CX, 660, {
    size: 84, weight: 800, ls: 4, color: C.amber, align: 'center',
    maxWidth: CW * .92, glow: { color: A(C.amber, .5), blur: 34 },
  });
  ctx.restore();

  // разделительная линия
  const lp = E.outExpo(inv(t, S(.5), S(.5) + S.d(0.45)));
  ctx.save();
  ctx.globalAlpha = .8;
  ctx.strokeStyle = lg(ctx, CX - CW / 2, 0, CX + CW / 2, 0,
    [[0, A(C.blue, 0)], [.5, A(C.cyan, .9)], [1, A(C.blue, 0)]]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CX - CW / 2 * lp, 740); ctx.lineTo(CX + CW / 2 * lp, 740);
  ctx.stroke();
  ctx.restore();

  /* --- цепочка: календарь → деньги → задержка --- */
  const rowY = 1010;
  const xs = [214, 470, 880];
  const chainP = inv(t, S(.62), S(.62) + S.d(0.63));

  // соединительная линия
  ctx.save();
  ctx.globalAlpha = .9;
  ctx.setLineDash([14, 16]);
  ctx.lineDashOffset = -w * 90;
  ctx.strokeStyle = A(C.cyan, .5);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(xs[0] + 86, rowY);
  ctx.lineTo(xs[0] + 86 + (xs[2] - xs[0] - 172) * E.outCubic(chainP), rowY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  const stopX = 706;                       // положение красной линии
  const barrier = inv(t, S(1.40), S(1.40) + S.d(0.12));      // момент удара

  // монеты, идущие по цепочке
  const rng = new Rng(21);
  for (let i = 0; i < 7; i++) {
    const te = .8 + i * .13;
    const tau = t - te;
    if (tau < 0) continue;
    let u = 1 - Math.exp(-tau * 1.5);           // движение с замедлением
    const startX = xs[0] + 86, endX = xs[2] - 86;
    let x = lerp(startX, endX, u);
    // упор в красную линию
    const stackX = stopX - 36 - i * 48;
    if (barrier > 0 && x > stackX) x = stackX;
    const y = rowY + Math.sin(tau * 5 + i) * 5;
    const a = clamp(tau * 4) * (barrier > 0 && x >= stackX - 1 ? .85 : 1);
    coin(ctx, x, y, 27, barrier > 0 && x >= stackX - 1 ? C.amber : C.green, a, true);
  }

  // иконки
  const ip = [inv(t, S(.62), S(.62) + S.d(0.33)), inv(t, S(.78), S(.78) + S.d(0.32)), inv(t, S(.95), S(.95) + S.d(0.35))];
  const iconWrap = (i, fn, color) => {
    if (ip[i] <= 0) return;
    ctx.save();
    ctx.globalAlpha = E.outCubic(ip[i]);
    const s = lerp(.6, 1, E.outBack(ip[i]));
    ctx.translate(xs[i], rowY); ctx.scale(s, s); ctx.translate(-xs[i], -rowY);
    ctx.save();
    rr(ctx, xs[i] - 88, rowY - 88, 176, 176, 42);
    ctx.fillStyle = 'rgba(9,13,24,.94)'; ctx.fill();
    ctx.fillStyle = A(color, .13); ctx.fill();
    ctx.strokeStyle = A(color, .5); ctx.lineWidth = 2.5;
    ctx.shadowColor = A(color, .35); ctx.shadowBlur = 26;
    ctx.stroke();
    ctx.restore();
    fn();
    ctx.restore();
  };
  iconWrap(0, () => iconCalendar(ctx, xs[0], rowY, 100, C.cyan, A(C.cyan, .8), clamp(inv(t, S(.7), S(.7) + S.d(0.5)))), C.cyan);
  iconWrap(1, () => iconBanknote(ctx, xs[1], rowY, 104, C.green, A(C.green, .8)), C.green);
  iconWrap(2, () => {
    const red = barrier > 0;
    iconClock(ctx, xs[2], rowY, 114, red ? C.red : C.dim, red ? A(C.red, .9) : null,
      w * 1.7, w * 7.5);
  }, barrier > 0 ? C.red : C.dim2);

  /* --- красная линия останавливает поток --- */
  if (barrier > 0) {
    const drop = E.outExpo(barrier);
    const y0 = rowY - 296, y1 = rowY + 250;
    const yEnd = y0 + (y1 - y0) * drop;
    ctx.save();
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 9;
    ctx.shadowColor = C.red; ctx.shadowBlur = 44;
    ctx.beginPath();
    ctx.moveTo(stopX, y0);
    ctx.lineTo(stopX, yEnd);
    ctx.stroke();
    // засечки
    ctx.globalAlpha = .55 + .45 * pulse(w, 3);
    ctx.lineWidth = 4;
    for (const yy of [y0 + 40, rowY, y1 - 40]) {
      if (yy > yEnd) continue;
      ctx.beginPath(); ctx.moveTo(stopX - 26, yy); ctx.lineTo(stopX + 26, yy); ctx.stroke();
    }
    ctx.restore();
    // вспышка удара
    flash(ctx, Math.max(0, .5 - inv(t, S(1.42), S(1.42) + S.d(0.2)) * .5), A(C.red, .8));
  }

  /* --- нижний текст --- */
  const tp1 = inv(t, S(1.30), S(1.30) + S.d(0.44)), tp2 = inv(t, S(1.46), S(1.46) + S.d(0.44));
  const ty = 1404;
  revealLine(ctx, 'ПРОДАВЦЫ СООБЩАЮТ', CX, ty, fitSize(ctx, 'ПРОДАВЦЫ СООБЩАЮТ', 88, CW, 800), {
    p: tp1, weight: 800, ls: -1, color: C.ink, align: 'center',
  });
  revealLine(ctx, 'О ЗАДЕРЖКАХ ВЫПЛАТ', CX, ty + 104, fitSize(ctx, 'О ЗАДЕРЖКАХ ВЫПЛАТ', 88, CW, 800), {
    p: tp2, weight: 800, ls: -1, color: C.amber, align: 'center',
    glow: { color: A(C.amber, .45), blur: 36 },
  });

  ctx.restore();
  vignette(ctx, .88, '#04060F');
  scanlines(ctx, .04, 6);
  rgbSplit(ctx, 1.0);
}

/* ==================================================================
   СЦЕНА 3 — ПОТОК ВЫПЛАТЫ (5.0 – 9.0), длительность 4.0
   ================================================================== */
function scene3(ctx, t, w, S) {
  ctx.save();
  camera(ctx, 1 + inv(t, S(0), S(0) + S.d(4.0)) * .07, 0, -inv(t, S(0), S(0) + S.d(4.0)) * 26);

  drawBackground(ctx, w, {
    accent: '#12275E', accent2: '#3A0E52', mid: '#080C1A',
    grid: .5, energy: .4, gridSpeed: 22,
  });

  // верхний кикер
  ctx.save();
  ctx.globalAlpha = E.outCubic(inv(t, S(.05), S(.05) + S.d(0.35)));
  chip(ctx, CX, 322, 'ЦЕПОЧКА ВЫПЛАТЫ', C.cyan, { align: 'center', size: 33, h: 70, padX: 32 });
  ctx.restore();

  const railX = 148;
  const cardX = 236, cardW = W - cardX - M, cardH = 262;
  const cardY = [468, 806, 1144];
  const barrierY = 1356;

  /* --- вертикальный «канал» потока --- */
  ctx.save();
  const railP = E.outCubic(inv(t, S(.1), S(.1) + S.d(0.7)));
  ctx.strokeStyle = A(C.cyan, .22);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(railX, 392);
  ctx.lineTo(railX, lerp(392, barrierY, railP));
  ctx.stroke();
  ctx.setLineDash([10, 18]);
  ctx.lineDashOffset = -w * 120;
  ctx.strokeStyle = A(C.cyan, .5);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  /* --- монеты в потоке: разгон, замедление, затор --- */
  for (let i = 0; i < 14; i++) {
    const te = .35 + i * .19;
    const tau = t - te;
    if (tau < 0) continue;
    const stackTarget = 1 - i * .052;               // место в «пробке»
    let u = 1 - Math.exp(-tau * .78);               // плавное затухание скорости
    u = Math.min(u, Math.max(.12, stackTarget));
    const y = lerp(392, barrierY - 30, u);
    const jam = u >= stackTarget - .004 && tau > 1.2;
    const wob = jam ? Math.sin(w * 9 + i * 1.7) * 2.2 : 0;
    const col = y > cardY[2] ? C.red : y > cardY[1] ? C.amber : C.green;
    coin(ctx, railX + wob, y, 21, col, clamp(tau * 3) * .96, true);
  }

  /* --- барьер --- */
  const bp = E.outExpo(inv(t, S(2.0), S(2.0) + S.d(0.2)));
  if (bp > 0) {
    ctx.save();
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 11;
    ctx.shadowColor = C.red; ctx.shadowBlur = 42;
    ctx.globalAlpha = .8 + .2 * pulse(w, 2.6);
    ctx.beginPath();
    ctx.moveTo(railX - 78 * bp, barrierY); ctx.lineTo(railX + 78 * bp, barrierY);
    ctx.stroke();
    ctx.restore();
  }

  /* --- три карточки --- */
  const cards = [
    { title: 'ВЫПЛАТА ДОЛЖНА ПРИЙТИ', chipTxt: 'ПО ГРАФИКУ', col: C.green, icon: 'note' },
    { title: 'СТАТУС: ОЖИДАНИЕ', chipTxt: 'В ОБРАБОТКЕ', col: C.amber, icon: 'glass' },
    { title: 'ЗАДЕРЖКА', chipTxt: 'ЗАЧИСЛЕНИЯ НЕТ', col: C.red, icon: 'alert' },
  ];
  cards.forEach((cd, i) => {
    const p = inv(t, S(.25 + i * .26), S(.25 + i * .26) + S.d(0.6));
    if (p <= 0) return;
    const e = E.outExpo(p);
    const y = cardY[i];
    ctx.save();
    ctx.globalAlpha = clamp(p * 1.8);
    ctx.translate((1 - e) * 320, 0);
    const hot = i === 2 && t > 2.0;
    panel(ctx, cardX, y, cardW, cardH, {
      r: 32,
      fill: lg(ctx, cardX, y, cardX, y + cardH,
        [[0, 'rgba(24,30,50,.94)'], [1, 'rgba(11,15,26,.94)']]),
      border: A(cd.col, hot ? .3 + .35 * pulse(w, 2.4) : .28),
      accent: cd.col, topLine: cd.col,
    });
    // иконка
    const ix = cardX + 92, iy = y + cardH / 2;
    ctx.save();
    rr(ctx, ix - 58, iy - 58, 116, 116, 30);
    ctx.fillStyle = A(cd.col, .12); ctx.fill();
    ctx.strokeStyle = A(cd.col, .4); ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    if (cd.icon === 'note') iconBanknote(ctx, ix, iy, 76, cd.col, A(cd.col, .8));
    if (cd.icon === 'glass') iconHourglass(ctx, ix, iy, 76, cd.col, A(cd.col, .8),
      clamp(.15 + inv(t, S(.8), S(.8) + S.d(2.6)) * .8));
    if (cd.icon === 'alert') iconAlert(ctx, ix, iy + 4, 74, cd.col, A(cd.col, .9));

    // тексты
    const tx = cardX + 178;
    text(ctx, cd.title, tx, y + 96, {
      size: 56, weight: 800, color: C.ink, align: 'left', maxWidth: cardW - 210,
    });
    chip(ctx, tx, y + 162, cd.chipTxt, cd.col, { size: 31, h: 58, padX: 24 });

    // прогресс во второй карточке — застревает
    if (i === 1) {
      const raw = inv(t, S(.9), S(.9) + S.d(1.4));
      const stall = .68 + Math.sin(t * 3.4) * .006;
      const pr = Math.min(E.outCubic(raw) * .95, stall);
      progressBar(ctx, tx, y + cardH - 34, cardW - 240, 12, pr, C.amber, { head: false });
    }
    ctx.restore();
  });

  // нижний вопрос-хук
  ctx.save();
  ctx.globalAlpha = E.outCubic(inv(t, S(2.5), S(2.5) + S.d(0.5)));
  ctx.translate(0, (1 - E.outExpo(inv(t, S(2.5), S(2.5) + S.d(0.5)))) * 34);
  text(ctx, 'ЧТО ПРОИСХОДИТ С ВЫПЛАТОЙ?', CX, 1520, {
    size: fitSize(ctx, 'ЧТО ПРОИСХОДИТ С ВЫПЛАТОЙ?', 68, CW, 800),
    weight: 800, color: C.dim, align: 'center',
  });
  ctx.restore();

  ctx.restore();
  vignette(ctx, .85, '#04060E');
  scanlines(ctx, .04, 6);
  rgbSplit(ctx, 1.0);
}

/* ==================================================================
   СЦЕНА 4 — ВОПРОС + АНАЛИТИКА (9.0 – 13.0), длительность 4.0
   ================================================================== */
function scene4(ctx, t, w, S) {
  /* ---------- слой 1: интерфейс аналитики с наездом камеры ---------- */
  ctx.save();
  const cam = 1 + E.inOutCubic(inv(t, S(0), S(0) + S.d(3.6))) * .18;
  camera(ctx, cam, 0, -inv(t, S(0), S(0) + S.d(3.6)) * 40, CX, 980);

  drawBackground(ctx, w, {
    accent: '#0C2E66', accent2: '#4A1060', mid: '#070B18',
    grid: .6, energy: .5, gridSpeed: 34,
  });

  const pp = E.outExpo(inv(t, S(.0), S(.0) + S.d(0.6)));
  const px = M, py = 560, pw = CW, ph = 800;
  ctx.save();
  ctx.globalAlpha = clamp(pp * 1.4);
  ctx.translate(0, (1 - pp) * 70);
  panel(ctx, px, py, pw, ph, {
    r: 38,
    fill: lg(ctx, px, py, px, py + ph, [[0, 'rgba(20,27,46,.95)'], [1, 'rgba(10,14,25,.95)']]),
    border: 'rgba(120,160,255,.22)', topLine: C.cyan,
  });

  text(ctx, 'АНАЛИТИКА · ВЫПЛАТЫ', px + 44, py + 84, {
    size: 34, weight: 700, family: MONO, ls: 5, color: A(C.cyan, .95), align: 'left',
  });
  chip(ctx, px + pw - 44 - 226, py + 66, 'ОЖИДАНИЕ', C.amber,
    { size: 30, h: 54, padX: 22, dotScale: .8 + .35 * pulse(w, 2.2) });

  const pts = [.42, .55, .5, .66, .74, .62, .70, .52, .34, .22, .18, .16];
  lineChart(ctx, px + 44, py + 140, pw - 88, 320, pts, C.cyan,
    { reveal: E.outCubic(inv(t, S(.35), S(.35) + S.d(1.25))), w: 6 });

  barChart(ctx, px + 44, py + 500, pw - 88, 150,
    [.85, .72, .64, .5, .38, .3, .22, .16], C.violet, {
      reveal: inv(t, S(.8), S(.8) + S.d(1.1)), gap: 16,
      colors: ['#4F86F7', '#4F86F7', '#5B7BF0', '#6B6AE8', '#8355DF', '#A03FCB', '#C42FA8', '#FF2D55'],
    });

  ctx.save();
  ctx.globalAlpha = E.outCubic(inv(t, S(1.2), S(1.2) + S.d(0.6)));
  iconHourglass(ctx, px + 74, py + ph - 66, 52, C.amber, A(C.amber, .7), .35 + .3 * pulse(w, .5));
  text(ctx, 'СТАТУС НЕ ОБНОВЛЁН', px + 116, py + ph - 48, {
    size: 40, weight: 700, color: C.dim, align: 'left',
  });
  ctx.restore();
  ctx.restore();

  // всплывающие метки-уведомления (в границах кадра при максимальном зуме)
  const toasts = [
    { x: 104, y: 452, txt: 'ОЖИДАНИЕ', col: C.amber, at: .7, rot: -.05 },
    { x: 636, y: 408, txt: 'ПРОВЕРКА', col: C.cyan, at: .95, rot: .06 },
    { x: 588, y: 1478, txt: 'НЕТ ДАННЫХ', col: C.red, at: 1.25, rot: .04 },
    { x: 112, y: 1534, txt: 'В ОЧЕРЕДИ', col: C.violet, at: 1.5, rot: -.04 },
  ];
  for (const to of toasts) {
    const p = inv(t, S(to.at), S(to.at) + S.d(.45));
    if (p <= 0) continue;
    const e = E.outBack(p);
    ctx.save();
    ctx.globalAlpha = clamp(p * 2) * (1 - inv(t, S(2.6), S(2.6) + S.d(0.9)) * .6);
    ctx.translate(to.x + 130, to.y);
    ctx.rotate(to.rot);
    ctx.scale(lerp(.7, 1, e), lerp(.7, 1, e));
    ctx.translate(-(to.x + 130), -to.y);
    chip(ctx, to.x, to.y, to.txt, to.col, { size: 32, h: 66, padX: 28 });
    ctx.restore();
  }
  ctx.restore();

  /* ---------- слой 2: вопрос поверх, без камеры ---------- */
  const qp = inv(t, S(1.55), S(1.55) + S.d(0.23));
  if (qp > 0) {
    ctx.save();
    ctx.globalAlpha = E.outCubic(qp) * .8;
    ctx.fillStyle = rg(ctx, CX, 980, 120, 1180,
      [[0, 'rgba(4,6,14,.95)'], [1, 'rgba(4,6,14,.70)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const qq = inv(t, S(1.62), S(1.62) + S.d(0.68));
  if (qq > 0) {
    ctx.save();
    ctx.globalAlpha = .045 * E.outCubic(qq);
    text(ctx, '?', CX, 1330, { size: 1080, weight: 900, color: C.ink, align: 'center' });
    ctx.restore();

    const L = ['ТЕХНИЧЕСКИЙ', 'СБОЙ', 'ИЛИ ЧТО-ТО', 'БОЛЬШЕ?'];
    const sz = Math.min(...L.map(s => fitSize(ctx, s, 144, CW, 900)));
    const lh = sz * 1.10;
    const by = 980 + lh * .5;
    const punch = lerp(1.18, 1, E.outExpo(inv(t, S(1.62), S(1.62) + S.d(0.68))));
    ctx.save();
    ctx.translate(CX, 980); ctx.scale(punch, punch); ctx.translate(-CX, -980);
    L.forEach((s, i) => {
      revealLine(ctx, s, CX, by - lh * 2 + i * lh, sz, {
        p: inv(t, S(1.62 + i * .09), S(1.62 + i * .09) + S.d(0.44)),
        weight: 900, ls: -2, align: 'center',
        color: i === 3 ? lg(ctx, CX - CW / 2, 0, CX + CW / 2, 0,
          [[0, '#FF4D6D'], [1, '#E7239B']]) : C.ink,
        glow: { color: i === 3 ? A(C.red, .6) : 'rgba(255,255,255,.22)', blur: i === 3 ? 54 : 34 },
      });
    });
    ctx.restore();
  }

  vignette(ctx, .9, '#03050D');
  scanlines(ctx, .04, 6);
  const g = Math.max(inv(t, S(1.6), S(1.6) + S.d(0.06)) * (1 - inv(t, S(1.66), S(1.66) + S.d(0.12))), 0);
  if (g > .01) { sliceGlitch(ctx, g * .4, Math.floor(t * 60) + 3, 10); rgbSplit(ctx, g * 7); }
  rgbSplit(ctx, 1.1);
}

/* ==================================================================
   СЦЕНА 5 — РАЗДЕЛЕНИЕ ЭКРАНА (13.0 – 17.0), длительность 4.0
   ================================================================== */
function scene5(ctx, t, w, S) {
  ctx.save();
  camera(ctx, 1 + inv(t, S(0), S(0) + S.d(4.0)) * .03);

  // общий тёмный низ
  ctx.fillStyle = C.bg0;
  ctx.fillRect(0, 0, W, H);

  const tilt = 46;                       // наклон разделителя
  const divX = (y) => CX + lerp(tilt, -tilt, y / H);
  const inL = E.outExpo(inv(t, S(.0), S(.0) + S.d(0.62)));
  const inR = E.outExpo(inv(t, S(.08), S(.08) + S.d(0.62)));

  /* ---------- ЛЕВАЯ ПОЛОВИНА ---------- */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(divX(0), 0); ctx.lineTo(divX(H), H); ctx.lineTo(0, H);
  ctx.closePath(); ctx.clip();
  ctx.translate((1 - inL) * -W * .5, 0);

  drawBackground(ctx, w, {
    accent: '#0B2E63', accent2: '#123A72', mid: '#08111F',
    grid: .5, energy: .35, gridSpeed: 14, ticks: false,
  });
  ctx.fillStyle = 'rgba(8,20,42,.45)';
  ctx.fillRect(0, 0, W, H);

  const LX = 268;                        // центр левой колонки
  const LW = 400;
  ['ПРОДАВЦЫ', 'ЖДУТ', 'ВЫПЛАТЫ'].forEach((s, i) => {
    revealLine(ctx, s, LX, 560 + i * 96, fitSize(ctx, s, 92, LW, 900), {
      p: inv(t, S(.35 + i * .09), S(.35 + i * .09) + S.d(0.5)),
      weight: 900, ls: -1, color: i === 2 ? C.cyan : C.ink, align: 'center',
      glow: { color: i === 2 ? A(C.cyan, .5) : 'rgba(255,255,255,.2)', blur: 30 },
    });
  });

  // очередь ожидающих строк
  for (let i = 0; i < 5; i++) {
    const p = inv(t, S(.8 + i * .12), S(.8 + i * .12) + S.d(0.45));
    if (p <= 0) continue;
    const e = E.outExpo(p);
    const ry = 900 + i * 96;
    ctx.save();
    ctx.globalAlpha = clamp(p * 2) * (1 - i * .11);
    ctx.translate((1 - e) * -180, 0);
    rr(ctx, 64, ry, 408, 74, 20);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fill();
    ctx.strokeStyle = A(C.cyan, .22); ctx.lineWidth = 2; ctx.stroke();
    iconHourglass(ctx, 108, ry + 37, 42, C.amber, null, .3 + .4 * pulse(w + i * .3, .6));
    // «полоса ожидания», ползущая почти на месте
    progressBar(ctx, 148, ry + 30, 288, 14, .12 + .18 * pulse(w + i, .35), C.amber,
      { head: false, alpha: .9 });
    ctx.restore();
  }

  // затухающий график
  ctx.save();
  ctx.globalAlpha = E.outCubic(inv(t, S(1.5), S(1.5) + S.d(0.7))) * .95;
  lineChart(ctx, 82, 1400, 386, 190,
    [.6, .58, .55, .5, .44, .36, .3, .26, .24, .23], C.blue,
    { reveal: E.outCubic(inv(t, S(1.5), S(1.5) + S.d(1.3))), w: 5, grid: true });
  ctx.restore();
  ctx.restore();

  /* ---------- ПРАВАЯ ПОЛОВИНА ---------- */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(divX(0), 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(divX(H), H);
  ctx.closePath(); ctx.clip();
  ctx.translate((1 - inR) * W * .5, 0);

  drawBackground(ctx, w, {
    accent: '#59105F', accent2: '#8A1160', mid: '#170920',
    grid: .5, energy: .55, gridSpeed: 40, ticks: false,
  });
  ctx.fillStyle = 'rgba(30,8,34,.4)';
  ctx.fillRect(0, 0, W, H);

  const RX = 812, RW = 400;
  ['ДЕНЬГИ', 'В ОБОРОТЕ'].forEach((s, i) => {
    revealLine(ctx, s, RX, 560 + i * 100, fitSize(ctx, s, 96, RW, 900), {
      p: inv(t, S(.42 + i * .09), S(.42 + i * .09) + S.d(0.5)),
      weight: 900, ls: -1, color: i === 1 ? C.magenta : C.ink, align: 'center',
      glow: { color: i === 1 ? A(C.magenta, .55) : 'rgba(255,255,255,.2)', blur: 34 },
    });
  });

  // орбита денежного потока
  const ocx = RX, ocy = 1090, orx = 178, ory = 118;
  ctx.save();
  ctx.globalAlpha = E.outCubic(inv(t, S(.8), S(.8) + S.d(0.6))) * .5;
  ctx.strokeStyle = A(C.magenta, .45);
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.ellipse(ocx, ocy, orx - k * 44, ory - k * 30, 0, 0, 7);
    ctx.stroke();
  }
  ctx.restore();
  const orbP = inv(t, S(.8), S(.8) + S.d(0.6));
  if (orbP > 0) {
    for (let i = 0; i < 12; i++) {
      const k = i / 12;
      const ringIdx = i % 3;
      const rr_ = orx - ringIdx * 44, ry_ = ory - ringIdx * 30;
      const a = (w * (1.5 + ringIdx * .5) + k * Math.PI * 2 * 3) % (Math.PI * 2);
      const x = ocx + Math.cos(a) * rr_;
      const y = ocy + Math.sin(a) * ry_;
      const depth = .5 + .5 * Math.sin(a);
      coin(ctx, x, y, 15 + depth * 7, ringIdx === 0 ? C.magenta : ringIdx === 1 ? C.violet : C.amber,
        E.outCubic(orbP) * (.45 + depth * .55), true);
    }
  }

  // растущие столбцы
  ctx.save();
  ctx.globalAlpha = E.outCubic(inv(t, S(1.4), S(1.4) + S.d(0.7)));
  const bv = [.35, .5, .42, .66, .58, .8, .72, .95];
  barChart(ctx, 620, 1400, 368, 190, bv.map((v, i) =>
    clamp(v * (.8 + .2 * pulse(w + i * .2, .8)))), C.magenta,
    { reveal: inv(t, S(1.4), S(1.4) + S.d(1.0)), gap: 12 });
  ctx.restore();

  // летящие «стримы» денег
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const ph = hash11(i * 5.3) * 10;
    const y = 300 + hash11(i * 2.1) * 1400;
    const x = ((w * (280 + hash11(i) * 260) + ph * 300) % (W * .75)) + CX;
    const len = 60 + hash11(i * 7.7) * 120;
    ctx.globalAlpha = .18 + .2 * hash11(i * 3.3);
    ctx.strokeStyle = i % 2 ? C.magenta : C.amber;
    ctx.lineWidth = 2 + hash11(i * 9.1) * 3;
    ctx.beginPath(); ctx.moveTo(x - len, y); ctx.lineTo(x, y); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  /* ---------- разделитель ---------- */
  const dp = E.outExpo(inv(t, S(.05), S(.05) + S.d(0.5)));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(divX(0), 0);
  ctx.lineTo(divX(H * dp), H * dp);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.shadowColor = C.cyan; ctx.shadowBlur = 40;
  ctx.stroke();
  ctx.strokeStyle = A(C.magenta, .7);
  ctx.lineWidth = 12;
  ctx.globalAlpha = .35;
  ctx.stroke();
  // бегущий блик
  if (dp >= 1) {
    const sy = ((w - .55) * 900) % (H + 400) - 200;
    const g = ctx.createLinearGradient(0, sy - 180, 0, sy + 180);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(.5, 'rgba(255,255,255,.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = .8;
    ctx.strokeStyle = g; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(divX(0), 0); ctx.lineTo(divX(H), H); ctx.stroke();
  }
  // головная точка при отрисовке
  if (dp < 1) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(divX(H * dp), H * dp, 9, 0, 7); ctx.fill();
  }
  ctx.restore();

  ctx.restore();
  vignette(ctx, .92, '#03050C');
  scanlines(ctx, .04, 6);
  rgbSplit(ctx, 1.1);
}

/* ==================================================================
   СЦЕНА 6 — НАПРЯЖЕНИЕ / ТАЙМЕР (17.0 – 21.0), длительность 4.0
   ================================================================== */
function scene6(ctx, t, w, S) {
  // «замедление»: скорость счётчика падает почти до нуля
  const speed = Math.exp(-t * 1.15);
  const spin = (1 - Math.exp(-t * 1.15)) / 1.15;   // интеграл скорости
  const frozen = t > 2.75;

  const [sx, sy] = shake(t, S(2.72), .5, 14, 6);
  ctx.save();
  camera(ctx, 1 + inv(t, S(0), S(0) + S.d(4.0)) * .05 + inv(t, S(2.75), S(2.75) + S.d(0.35)) * .05, sx, sy, CX, 1150);

  drawBackground(ctx, w, {
    accent: '#5A0C24', accent2: '#2A0A46', mid: '#0B0710',
    grid: .35, energy: .35 + .35 * pulse(w, .55), gridSpeed: 12,
  });

  // сжимающаяся тревожная виньетка
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = .16 + .22 * pulse(w, 1.1) + inv(t, S(2.4), S(2.4) + S.d(1.6)) * .2;
  ctx.fillStyle = rg(ctx, CX, 1150, H * .12, H * .55,
    [[0, A(C.red, 0)], [1, A(C.red, .55)]]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  embers(ctx, w, 22, C.red, .3, 33, 46);

  /* --- текст --- */
  ctx.save();
  ctx.globalAlpha = E.outCubic(inv(t, S(.05), S(.05) + S.d(0.35)));
  chip(ctx, CX, 404, 'ГЛАВНЫЙ ВОПРОС', C.red, { align: 'center', size: 33, h: 70, padX: 32 });
  ctx.restore();

  const L = ['КОГДА ПРИДУТ', 'ДЕНЬГИ?'];
  const sz = Math.min(...L.map(s => fitSize(ctx, s, 132, CW, 900)));
  L.forEach((s, i) => {
    revealLine(ctx, s, CX, 560 + i * (sz * 1.06), sz, {
      p: inv(t, S(.2 + i * .12), S(.2 + i * .12) + S.d(0.55)),
      weight: 900, ls: -2, align: 'center',
      color: i === 1 ? lg(ctx, CX - CW / 2, 0, CX + CW / 2, 0, [[0, '#FF4D6D'], [1, '#FF9A3D']]) : C.ink,
      glow: { color: i === 1 ? A(C.red, .65) : 'rgba(255,255,255,.2)', blur: i === 1 ? 56 : 32 },
    });
  });

  /* --- большое кольцо ожидания --- */
  const cy = 1150, R = 392;
  const ringP = clamp(spin * .95);
  ctx.save();
  ctx.globalAlpha = E.outCubic(inv(t, S(.3), S(.3) + S.d(0.6)));
  // засечки
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const big = i % 5 === 0;
    const r0 = R + 22, r1 = R + (big ? 46 : 34);
    ctx.strokeStyle = A(i / 60 < ringP ? C.red : C.dim2, big ? .75 : .38);
    ctx.lineWidth = big ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(CX + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  ring(ctx, CX, cy, R, ringP, C.red, { w: 14 });
  // головной маркер
  const ha = -Math.PI / 2 + Math.PI * 2 * ringP;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = C.red; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(CX + Math.cos(ha) * R, cy + Math.sin(ha) * R, 13, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  // внутреннее вращающееся кольцо
  ctx.globalAlpha *= .35;
  ctx.strokeStyle = A(C.amber, .5);
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 26]);
  ctx.lineDashOffset = -spin * 220;
  ctx.beginPath(); ctx.arc(CX, cy, R - 46, 0, 7); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  /* --- цифры таймера --- */
  const cellW = 104, cellH = 168, gap = 10, grpGap = 42;
  const groups = 3;
  const totalW = groups * (cellW * 2 + gap) + (groups - 1) * grpGap;
  let x0 = CX - totalW / 2 + cellW / 2;
  const appear = E.outCubic(inv(t, S(.45), S(.45) + S.d(0.55)));
  ctx.save();
  ctx.globalAlpha = appear;
  for (let g = 0; g < groups; g++) {
    for (let d = 0; d < 2; d++) {
      const idx = g * 2 + d;
      const cx = x0 + g * (cellW * 2 + gap + grpGap) + d * (cellW + gap);
      // момент, когда разряд «сдаётся» и превращается в прочерк
      const giveUp = 2.05 + idx * .10;
      let str;
      let col = C.red;
      if (t > giveUp) { str = '—'; col = C.dim2; }
      else {
        const rate = 14 * Math.exp(-t * .95) + .7;
        str = String(Math.floor(Math.abs(spin * 1000 + idx * 3.1) * rate + hash11(idx) * 7) % 10);
      }
      const flip = clamp(1 - Math.abs(t - giveUp) * 7);
      const sc = 1 - flip * .5;
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(1, sc); ctx.translate(-cx, -cy);
      digitCell(ctx, cx, cy, cellW, cellH, str, col, {
        size: 112, textColor: t > giveUp ? C.dim : C.ink,
        border: A(t > giveUp ? C.dim2 : C.red, .4),
        fill: t > giveUp ? 'rgba(255,255,255,.03)' : A(C.red, .07),
      });
      ctx.restore();
    }
    if (g < groups - 1) {
      const colX = x0 + g * (cellW * 2 + gap + grpGap) + cellW * 1.5 + gap + grpGap / 2;
      ctx.fillStyle = A(C.red, .55 + .45 * pulse(w, frozen ? .5 : 2.2));
      ctx.shadowColor = C.red; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(colX, cy - 30, 10, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(colX, cy + 30, 10, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();

  /* --- подпись под таймером --- */
  ctx.save();
  ctx.globalAlpha = E.outCubic(inv(t, S(2.5), S(2.5) + S.d(0.5)));
  chip(ctx, CX, 1420, 'ТОЧНОЕ ВРЕМЯ НЕИЗВЕСТНО', C.amber,
    { align: 'center', size: 32, h: 68, padX: 30, dotScale: .8 + .3 * pulse(w, 1.2) });
  ctx.restore();

  ctx.restore();
  vignette(ctx, .98, '#0D0004');
  scanlines(ctx, .05, 6);
  const g = Math.max(inv(t, S(2.72), S(2.72) + S.d(0.06)) * (1 - inv(t, S(2.78), S(2.78) + S.d(0.17))), 0);
  if (g > .01) { sliceGlitch(ctx, g * .3, Math.floor(t * 60) + 9, 9); }
  rgbSplit(ctx, 1.1 + g * 6);
  flash(ctx, Math.max(0, .35 - inv(t, S(2.72), S(2.72) + S.d(0.23)) * .35), A(C.red, .7));
}

/* ==================================================================
   СЦЕНА 7 — ФИНАЛ + CTA (21.0 – 25.0), длительность 4.0
   ================================================================== */
function scene7(ctx, t, w, S) {
  ctx.save();
  camera(ctx, 1 + inv(t, S(0), S(0) + S.d(4.0)) * .03);

  drawBackground(ctx, w, {
    accent: '#48138C', accent2: '#96125F', mid: '#0D0A1C',
    grid: .5, energy: .62 + .2 * pulse(w, .7), gridSpeed: 26,
  });
  embers(ctx, w, 34, C.magenta, .45, 77, 58);

  /* --- вопрос: по центру, затем поднимается --- */
  const shift = E.inOutCubic(inv(t, S(1.45), S(1.45) + S.d(0.6)));
  const baseY = lerp(940, 700, shift);
  const scale = lerp(1, .86, shift);
  const L = ['ЭТО ПРОБЛЕМА', 'ОДНОГО ДНЯ', 'ИЛИ НОВАЯ', 'ТЕНДЕНЦИЯ?'];
  const sz = Math.min(...L.map(s => fitSize(ctx, s, 138, CW, 900)));
  const lh = sz * 1.08;

  ctx.save();
  ctx.translate(CX, baseY); ctx.scale(scale, scale); ctx.translate(-CX, -baseY);
  L.forEach((s, i) => {
    const accent = i >= 2;
    revealLine(ctx, s, CX, baseY - lh * 1.5 + i * lh, sz, {
      p: inv(t, S(.12 + i * .12), S(.12 + i * .12) + S.d(0.54)),
      weight: 900, ls: -2, align: 'center',
      color: accent ? lg(ctx, CX - CW / 2, 0, CX + CW / 2, 0,
        [[0, '#FF3B7B'], [.5, '#E7239B'], [1, '#A855F7']]) : C.ink,
      glow: { color: accent ? A(C.magenta, .6) : 'rgba(255,255,255,.22)', blur: accent ? 52 : 32 },
    });
  });
  ctx.restore();

  /* --- CTA --- */
  const cp = inv(t, S(1.75), S(1.75) + S.d(0.65));
  if (cp > 0) {
    const e = E.outExpo(cp);
    const py = lerp(1560, 1070, e);
    const ph = 290;
    ctx.save();
    ctx.globalAlpha = clamp(cp * 2);

    glowBlob(ctx, CX, py + ph / 2, 500, C.magenta, .55 * (.6 + .4 * pulse(w, 1.1)));

    panel(ctx, M, py, CW, ph, {
      r: 44,
      fill: lg(ctx, M, py, M + CW, py + ph,
        [[0, 'rgba(66,16,84,.96)'], [1, 'rgba(24,11,40,.96)']]),
      border: A(C.magenta, .55 + .25 * pulse(w, 1.6)), topLine: C.magenta,
    });
    // бегущий блик по рамке
    ctx.save();
    rr(ctx, M + 3, py + 3, CW - 6, ph - 6, 41);
    ctx.clip();
    const ang = w * 1.7;
    const gx = CX + Math.cos(ang) * CW, gy = py + ph / 2 + Math.sin(ang) * ph;
    ctx.strokeStyle = rg(ctx, gx, gy, 0, 440,
      [[0, 'rgba(255,255,255,.95)'], [1, 'rgba(255,255,255,0)']]);
    ctx.lineWidth = 5;
    rr(ctx, M + 3, py + 3, CW - 6, ph - 6, 41);
    ctx.stroke();
    ctx.restore();

    const cs = fitSize(ctx, 'ПРОВЕРЬ СВОЮ', 104, CW - 130, 900);
    text(ctx, 'ПРОВЕРЬ СВОЮ', CX, py + 122, {
      size: cs, weight: 900, ls: -1, color: C.ink, align: 'center',
      glow: { color: 'rgba(255,255,255,.28)', blur: 30 },
    });
    text(ctx, 'ВЫПЛАТУ', CX, py + 238, {
      size: cs * 1.02, weight: 900, ls: -1, align: 'center',
      color: lg(ctx, CX - 280, 0, CX + 280, 0, [[0, '#FFC24D'], [1, '#FF4D6D']]),
      glow: { color: A(C.amber, .6), blur: 46 },
    });
    ctx.restore();

    // каскад стрелок вниз
    for (let i = 0; i < 3; i++) {
      const ph2 = (w * 1.45 + i * .3) % 1;
      const a = clamp(cp * 2) * clamp(1.25 - ph2) * .95;
      iconChevron(ctx, CX, 1442 + i * 66 + ph2 * 22, 100, i === 2 ? C.amber : C.magenta, a,
        A(i === 2 ? C.amber : C.magenta, .8));
    }
  }

  ctx.restore();
  vignette(ctx, .9, '#05030E');
  scanlines(ctx, .04, 6);
  rgbSplit(ctx, 1.1);
  flash(ctx, Math.max(0, .45 - inv(t, S(0), S(0) + S.d(0.25)) * .45), '#FFE6F4');
}
