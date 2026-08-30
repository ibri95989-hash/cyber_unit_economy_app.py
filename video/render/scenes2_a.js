/* ============================================================
   "Опасная ситуация" - beats V1, V2, V3, V5 (hook -> dashboard ->
   collapse -> cost gates). Card indices refer to CAPTIONS.cards,
   loaded globally via setCaptions() before renderFrame runs.
   ============================================================ */

function cardWin(idx, gt, padA = 0, padB = 0) {
  const c = CAPTIONS.cards[idx];
  return { c, p: win(gt, c.start - padA, c.end + padB) };
}

/* ---------------- V1: 0.00 - card2.end  (the hook) ---------------- */
function beatHook(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.35 + A * 0.35, hueA: C.violet, hueB: '#7a1030', particles: true });

  /* quiet rising bars in the background - sales climbing, unremarkable */
  ctx.save();
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 10; i++) {
    const k = i / 9;
    const grow = clamp((p * 1.3 - k * 0.3) * 1.3);
    const h = (60 + Math.pow(k, 1.6) * 560) * easeOutCubic(grow);
    const x = 70 + i * 96;
    const g = ctx.createLinearGradient(0, H - 300 - h, 0, H - 300);
    g.addColorStop(0, rgba(C.violet, 0.5));
    g.addColorStop(1, rgba(C.violetDeep, 0.04));
    ctx.fillStyle = g;
    rr(ctx, x, H - 300 - h, 60, h, 14); ctx.fill();
  }
  ctx.restore();

  const { c: c0, p: p0 } = cardWin(0, gt);
  const { c: c2, p: p2 } = cardWin(2, gt);

  /* card 0: "самая опасная ситуация" - a slow red pulse ring, quiet warning */
  if (p0 > 0 && p0 < 1) {
    const e = easeOutCubic(clamp(p0 * 2));
    ctx.save();
    ctx.globalAlpha = e * (1 - clamp((p0 - 0.7) / 0.3));
    glow(ctx, W / 2, 760, 520 + Math.sin(lt * 1.4) * 30, C.red, 0.22);
    kinetic(ctx, 'ОПАСНАЯ СИТУАЦИЯ', W / 2, 760, 92, {
      p: p0 * 2.2, color: 'rgba(255,255,255,0.88)', spacing: 2, maxW: 880,
      glow: rgba(C.red, 0.5), glowSize: 40,
    });
    ctx.restore();
  }

  /* card 2: "делает тебя беднее" - the twist, sharper red pulse + shake */
  if (p2 > 0) {
    const e = easeOutQuint(clamp(p2 * 3));
    const shake = p2 < 0.4 ? Math.exp(-p2 * 10) * 14 : 0;
    ctx.save();
    ctx.translate(Math.sin(lt * 50) * shake, 0);
    ctx.translate(W / 2, 1040);
    ctx.scale(lerp(1.3, 1, e), lerp(1.3, 1, e));
    glow(ctx, 0, 0, 620, C.red, 0.3 * clamp(p2 * 3));
    chromatic(ctx, (c, col) => {
      kinetic(c, 'ТЫ БЕДНЕЕШЬ', 0, 0, 148, {
        p: p2 * 2.6, color: col, spacing: 2, stagger: 0.03, maxW: 900,
        glow: col === '#fff' ? rgba(C.red, 0.8) : null, glowSize: 55,
      });
    }, Math.exp(-p2 * 8) * 20);
    ctx.restore();
    if (p2 < 0.25) flash(ctx, Math.exp(-p2 * 18) * 0.5, 'rgba(255,60,90,');
  }

  vignette(ctx, 0.88);
}

/* ---------------- V2: card3  (dashboard growth) ---------------- */
function beatDashboard(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.4 + A * 0.35, hueA: C.violet, hueB: '#1b8f6a' });

  const zoom = lerp(1.0, 1.05, easeInOutCubic(clamp(p * 1.1)));
  ctx.save();
  ctx.translate(W / 2, H * 0.48); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * 0.48);

  dashboardPanel(ctx, p, lt, { pts: RISE_PTS, prog: easeOutCubic(clamp(p * 1.5)), color: C.green });

  const tA = win(p, 0.1, 0.32), tB = win(p, 0.2, 0.42);
  statTile(ctx, 80, 1225, 430, 200, 'ЗАКАЗЫ', Math.round(lerp(0, 940, easeOutExpo(tA))).toString(), '#fff',
    { alpha: tA, spark: [0.2, 0.4, 0.3, 0.6, 0.7, 0.9] });
  statTile(ctx, 570, 1225, 430, 200, 'ОБОРОТ ЗА ДЕНЬ', money(lerp(0, 214000, easeOutExpo(tB))), '#fff',
    { alpha: tB, spark: [0.4, 0.5, 0.45, 0.6, 0.55, 0.7] });
  ctx.restore();

  vignette(ctx, 0.86);
}

/* ---------------- V3: cards 4-6  (profit collapses, "почему?") --- */
function beatCollapse(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.5 + A * 0.4, hueA: '#7a1030', hueB: C.red });

  const { c: c6, p: p6 } = cardWin(6, gt, 0.15, 0);
  const zoomOut = win(p, 0.75, 1);
  const zoom = lerp(1.08, 1.0, easeOutCubic(clamp(p * 2))) * lerp(1, 1.14, easeInCubic(clamp(zoomOut * 1.2)));
  ctx.save();
  ctx.translate(W / 2, H * 0.46); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * 0.46);
  ctx.globalAlpha = 1 - zoomOut * 0.5;

  const D = dashboardPanel(ctx, p, lt, {
    title: 'ЧИСТАЯ ПРИБЫЛЬ', label: 'ПРИБЫЛЬ, 30 ДНЕЙ',
    pts: FALL_PTS, prog: easeOutCubic(clamp(p * 1.8)), color: C.red,
  });
  moneyDust(ctx, W / 2, D.cy + D.ch * 0.5, 820, lt, clamp(p * 1.8), C.gold, 46, 91, 1);
  ctx.restore();

  if (p6 > 0) {
    const e = easeOutBack(clamp(p6 * 3));
    ctx.save();
    ctx.translate(W / 2, 1560);
    ctx.scale(e, e);
    glow(ctx, 0, 0, 420, C.red, 0.35 * clamp(p6 * 3));
    kinetic(ctx, 'ПОЧЕМУ?', 0, 0, 150, {
      p: p6 * 3, color: '#fff', spacing: 2, maxW: 700, glow: rgba(C.red, 0.85), glowSize: 55,
    });
    ctx.restore();
  }
  vignette(ctx, 0.9);
}

/* ---------------- V5: card7  (the seven cost gates) --------------- */
function beatGates(ctx, p, lt, gt, A) {
  backdrop(ctx, gt, { energy: 0.55 + A * 0.35, hueA: C.violet, hueB: '#b3126b', pan: p * 380 });

  const card = CAPTIONS.cards[7];
  const n = GATES.length;
  const gap = 400, focus = 980;
  /* drive the gate index by the ACTUAL word timestamps of this card, so
     each gate opens exactly when its name is spoken */
  let k = n;
  for (let i = 0; i < n; i++) {
    const w = card.words[i];
    if (!w) continue;
    const local = clamp((gt - w.start) / Math.max(0.05, w.end - w.start));
    if (gt < w.start) { k = i; break; }
    if (gt < w.end) { k = i + local; break; }
    k = i + 1;
  }

  const cx = W / 2, baseW = 320;
  const gy = i => focus + (i - k) * gap;
  const stops = [{ y: -200, w: baseW }];
  for (let i = 0; i < n; i++) {
    const y = gy(i);
    stops.push({ y: y - 6, w: baseW * gateRemain(i) });
    stops.push({ y: y + 6, w: baseW * gateRemain(i + 1) });
  }
  stops.push({ y: H + 200, w: baseW * gateRemain(n) });
  stops.sort((a, b) => a.y - b.y);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - stops[0].w / 2, stops[0].y);
  stops.forEach(s => ctx.lineTo(cx - s.w / 2, s.y));
  for (let i = stops.length - 1; i >= 0; i--) ctx.lineTo(cx + stops[i].w / 2, stops[i].y);
  ctx.closePath();
  const rg = ctx.createLinearGradient(cx - baseW / 2, 0, cx + baseW / 2, 0);
  rg.addColorStop(0, rgba('#7a5310', 0.5));
  rg.addColorStop(0.34, rgba(C.gold, 0.58));
  rg.addColorStop(0.5, rgba('#fff2cf', 0.7));
  rg.addColorStop(0.66, rgba(C.gold, 0.58));
  rg.addColorStop(1, rgba('#7a5310', 0.5));
  ctx.fillStyle = rg; ctx.fill();
  ctx.strokeStyle = rgba('#ffe6a8', 0.7); ctx.lineWidth = 3; ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) glow(ctx, cx, (i + 0.5) * (H / 5), 300, C.gold, 0.12);
  ctx.restore();

  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const r = rng(1201);
  for (let i = 0; i < 40; i++) {
    const x = cx + (r() - 0.5) * baseW * 0.9;
    const sp = 560 + r() * 800, y = ((r() * H + lt * sp) % (H + 500)) - 250, l = 60 + r() * 190;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(streakSprite('#fff9e0'), x, y - l, 5 + r() * 6, l * 2);
  }
  ctx.restore();

  for (let i = 0; i < n; i++) {
    const G = GATES[i];
    const y = gy(i);
    if (y < -240 || y > H + 240) continue;
    const w = card.words[i];
    const hitT = w ? clamp(1 - Math.abs(gt - (w.start + w.end) / 2) / 0.4) : 0;
    const act = clamp((k - i) * 3);
    const side = i % 2 ? 1 : -1;
    const wIn = baseW * gateRemain(i);
    const edge = clamp((y - 640) / 220);

    ctx.save();
    ctx.globalAlpha = edge;
    ctx.fillStyle = 'rgba(4,6,13,0.85)';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 36;
    rr(ctx, cx - 300, y - 30, 600, 60, 30); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = clamp(1.1 - Math.abs(y - focus) / 1300) * edge;
    ctx.fillStyle = rgba(G.color, 0.9);
    const outW = baseW * gateRemain(i + 1);
    rr(ctx, cx - 268, y - 11, 268 - outW / 2, 22, 11); ctx.fill();
    rr(ctx, cx + outW / 2, y - 11, 268 - outW / 2, 22, 11); ctx.fill();
    ctx.restore();

    if (hitT > 0.04) {
      const rr2 = rng(700 + i);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 24; j++) {
        const ph = (lt * 1.7 + rr2()) % 1;
        const d = ph * (240 + rr2() * 240);
        dot(ctx, cx + side * (wIn / 2 + d), y - 10 + (rr2() - 0.5) * 60 - ph * 90,
            3 + rr2() * 6, G.color, hitT * (1 - ph) * 0.9);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = clamp(act * 1.6 + hitT) * edge;
    const sc = lerp(0.85, 1, easeOutBack(clamp(act * 1.4))) + hitT * 0.08;
    chip(ctx, G.label, cx + side * 330, y - 34, {
      size: 46, color: '#fff', bg: rgba(G.color, 0.18), border: rgba(G.color, 0.55),
      glowC: rgba(G.color, 0.5 + hitT * 0.5), scale: sc, spacing: 2,
    });
    text(ctx, '−' + Math.round(G.pct * 100) + '%', cx + side * 330, y + 48, 52,
      { weight: 900, color: G.color, glow: rgba(G.color, 0.7), glowSize: 28 });
    ctx.restore();
  }
  ctx.restore();

  const left = REVENUE * gateRemain(k);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 55;
  rr(ctx, 150, 240, W - 300, 220, 40);
  ctx.fillStyle = 'rgba(6,9,17,0.94)'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(C.gold, 0.35); ctx.stroke();
  text(ctx, 'ОСТАЁТСЯ ОТ ВЫРУЧКИ', W / 2, 306, 28,
    { weight: 700, family: 'Inter', color: 'rgba(255,255,255,0.55)', spacing: 6 });
  text(ctx, money(left), W / 2, 392, 96,
    { weight: 900, color: left / REVENUE > 0.6 ? '#fff' : C.gold, glow: rgba(C.gold, 0.7), glowSize: 40, maxW: 700 });
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  rr(ctx, 150, 500, W - 300, 8, 4); ctx.fill();
  ctx.fillStyle = C.gold; ctx.shadowColor = C.gold; ctx.shadowBlur = 22;
  rr(ctx, 150, 500, (W - 300) * clamp(k / n), 8, 4); ctx.fill();
  ctx.restore();

  vignette(ctx, 0.92);
}
