import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const DIR = path.join(ROOT, 'render');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  const f = path.join(DIR, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(await readFile(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const cfg = JSON.parse(await readFile(path.join(ROOT, 'build/audio.json'), 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
await page.evaluate(() => window.fontsReady);
await page.evaluate(c => window.configure(c), cfg);
const out = await page.evaluate(() => {
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const flush = () => ctx.getImageData(0, 0, 1, 1);
  const time = (label, fn, n = 8) => {
    fn(); flush();
    const a = performance.now();
    for (let i = 0; i < n; i++) { fn(); flush(); }
    return `${label}: ${((performance.now() - a) / n).toFixed(1)} ms`;
  };
  const res = [];
  const t = 88, lt = 5, A = 0.5;
  res.push(time('clear', () => { ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#000'; ctx.fillRect(0,0,1080,1920); }));
  res.push(time('backdrop', () => backdrop(ctx, t, { energy: 0.7, hueA: C.violet, hueB: C.gold, grid: false })));
  res.push(time('streaks', () => streaks(ctx, lt, { count: 40, color: C.gold, speed: 1700, alpha: 0.5, seed: 21, len: 520, thick: 7 })));
  res.push(time('moneyDust', () => moneyDust(ctx, 540, 1440, 1000, lt, 1, C.gold, 70, 12, 1)));
  res.push(time('kinetic x3', () => { for (let i=0;i<3;i++) kinetic(ctx, 'МИЛЛИОН ОБОРОТА', 540, 800+i*160, 128, { p: 1, color:'#fff', glow: 'rgba(255,196,107,0.6)', glowSize: 55, maxW: 940 }); }));
  res.push(time('vignette', () => vignette(ctx, 0.92)));
  res.push(time('grain', () => grain(ctx, 100, 0.055)));
  res.push(time('glowBig', () => glow(ctx, 540, 960, 1100, '#7aa2ff', 0.2)));
  res.push(time('scene9 full', () => scene9(ctx, 0.4, 5, 88, 0.5), 6));
  res.push(time('scene7 full', () => scene7(ctx, 0.4, 5, 60, 0.5), 6));
  res.push(time('scene4 full', () => scene4(ctx, 0.4, 5, 24, 0.5), 6));
  res.push(time('toJPEG', () => cv.toDataURL('image/jpeg', 0.96), 6));
  return res;
});
console.log(out.join('\n'));
await browser.close(); srv.close();
