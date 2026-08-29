/* ============================================================
   render.mjs — покадровый рендер сцены в Chromium и упаковка
   потоком в ffmpeg (H.264). Кадры не пишутся на диск.
   Запуск:
     node render.mjs                      # полный рендер
     node render.mjs --preview 0,2.3,6.5  # PNG-превью моментов
   ============================================================ */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

/* playwright может быть установлен глобально — резолвим и локально, и глобально */
async function loadPlaywright() {
  try { return (await import('playwright')).chromium; } catch {}
  const req = createRequire(import.meta.url);
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    resolve(dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'),
    '/usr/lib/node_modules/playwright',
    '/usr/local/lib/node_modules/playwright',
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return req(c).chromium;
  throw new Error('playwright не найден: установите `npm i -D playwright` или задайте PLAYWRIGHT_PATH');
}
const OUT = resolve(ROOT, 'out');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ttf': 'font/ttf',
};

function serve(dir) {
  return new Promise((res) => {
    const srv = createServer(async (req, rq) => {
      try {
        const p = join(dir, decodeURIComponent(req.url.split('?')[0]));
        const body = await readFile(p);
        rq.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
        rq.end(body);
      } catch { rq.writeHead(404); rq.end('nf'); }
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

const args = process.argv.slice(2);
const previewArg = args.includes('--preview') ? args[args.indexOf('--preview') + 1] : null;

(async () => {
  const chromium = await loadPlaywright();
  await mkdir(OUT, { recursive: true });
  const { srv, port } = await serve(ROOT);
  const browser = await chromium.launch({
    args: [
      '--force-color-profile=srgb',
      '--disable-lcd-text',
      '--font-render-hinting=none',
      '--disable-gpu-vsync',
      '--hide-scrollbars',
      '--enable-font-antialiasing',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  const meta = await page.evaluate('window.__meta');
  console.log('meta:', meta);

  const canvas = await page.$('#stage');

  if (previewArg) {
    const times = previewArg.split(',').map(Number);
    for (const t of times) {
      await page.evaluate((tt) => window.__seek(tt), t);
      const buf = await canvas.screenshot({ type: 'png' });
      const name = `preview_${String(t).replace('.', '_')}s.png`;
      await writeFile(join(OUT, name), buf);
      console.log('saved', name, (buf.length / 1024).toFixed(0) + 'KB');
    }
    await browser.close(); srv.close();
    return;
  }

  /* ---------- полный рендер потоком в ffmpeg ---------- */
  const outFile = join(OUT, 'video_silent.mp4');
  const ff = spawn(FFMPEG, [
    '-y',
    '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(meta.FPS), '-i', '-',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'slow',
    // tune=animation + aq-mode=3 держат плоскую векторную графику и тёмные
    // градиенты чистыми, а плёночное зерно не раздувает битрейт
    '-crf', '19',
    '-tune', 'animation',
    '-profile:v', 'high', '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    '-x264-params', 'aq-mode=3:keyint=120:min-keyint=60:scenecut=0:ref=4:bframes=3',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-movflags', '+faststart',
    '-r', String(meta.FPS),
    outFile,
  ], { stdio: ['pipe', 'inherit', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', d => { ffErr += d.toString().slice(-2000); });
  const done = new Promise((res, rej) => {
    ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + '\n' + ffErr.slice(-1500)))));
  });

  const t0 = Date.now();
  for (let i = 0; i < meta.TOTAL; i++) {
    await page.evaluate((n) => window.__frame(n), i);
    const buf = await canvas.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0 || i === meta.TOTAL - 1) {
      const el = (Date.now() - t0) / 1000;
      const eta = el / Math.max(1, i + 1) * (meta.TOTAL - i - 1);
      process.stdout.write(
        `\rкадр ${i + 1}/${meta.TOTAL}  ${((i + 1) / meta.TOTAL * 100).toFixed(1)}%  ` +
        `${(el).toFixed(0)}c прошло, ~${eta.toFixed(0)}c осталось   `);
    }
  }
  ff.stdin.end();
  console.log('\nждём ffmpeg...');
  await done;
  console.log('готово:', outFile);

  await browser.close();
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
