/* ============================================================
   render.mjs — покадровый рендер сцены в Chromium и упаковка в H.264.

   Кадр — чистая функция времени, поэтому таймлайн режется на равные
   куски и считается несколькими браузерами параллельно: каждый воркер
   пишет свой сегмент, сегменты склеиваются без перекодирования.
   Кадры на диск не пишутся — идут потоком в ffmpeg.

   Запуск:
     node render.mjs                        # полный рендер
     node render.mjs --workers 2            # ограничить параллелизм
     node render.mjs --fps 30 --preset fast # быстрый черновик
     node render.mjs --limit 240            # только первые 240 кадров
     node render.mjs --preview 0,2.3,6.5    # PNG-превью моментов
   ============================================================ */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(ROOT, 'out');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

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

/* ---------- аргументы ---------- */
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const previewArg = arg('--preview', null);
const presetArg = arg('--preset', 'slow');
const crfArg = arg('--crf', '19');
const outArg = arg('--out', join(OUT, 'video_silent.mp4'));
const fpsArg = arg('--fps', null);
const limitArg = arg('--limit', null);   // отрендерить только первые N кадров (черновик)
// по одному воркеру на ядро, но одно оставляем ffmpeg-у и системе
const WORKERS = Math.max(1, parseInt(arg('--workers', String(Math.max(1, cpus().length - 1))), 10));

const CHROME_ARGS = [
  '--force-color-profile=srgb',
  '--disable-lcd-text',
  '--font-render-hinting=none',
  '--disable-gpu-vsync',
  '--hide-scrollbars',
  '--enable-font-antialiasing',
];

async function openPage(chromium, port) {
  const browser = await chromium.launch({ args: CHROME_ARGS });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  return { browser, page };
}

function encoder(target, fps) {
  const ff = spawn(FFMPEG, [
    '-y',
    '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', '-',
    '-an',
    '-c:v', 'libx264',
    '-preset', presetArg,
    // tune=animation + aq-mode=3 держат плоскую векторную графику и тёмные
    // градиенты чистыми, а плёночное зерно не раздувает битрейт
    '-crf', crfArg,
    '-tune', 'animation',
    '-profile:v', 'high', '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    // фиксированный GOP без сценовых врезок — обязателен, чтобы сегменты
    // склеивались побайтово, без перекодирования
    '-x264-params', 'aq-mode=3:keyint=60:min-keyint=60:scenecut=0:ref=4:bframes=3',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-movflags', '+faststart',
    '-r', String(fps),
    target,
  ], { stdio: ['pipe', 'inherit', 'pipe'] });
  let err = '';
  ff.stderr.on('data', d => { err += d.toString().slice(-2000); });
  const done = new Promise((res, rej) => {
    ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}\n${err.slice(-1500)}`))));
  });
  return { ff, done };
}

(async () => {
  const chromium = await loadPlaywright();
  await mkdir(OUT, { recursive: true });
  const { srv, port } = await serve(ROOT);

  const first = await openPage(chromium, port);
  const meta = await first.page.evaluate('window.__meta');
  console.log('meta:', meta);

  /* ---------- режим превью ---------- */
  if (previewArg) {
    const canvas = await first.page.$('#stage');
    for (const t of previewArg.split(',').map(Number)) {
      await first.page.evaluate((tt) => window.__seek(tt), t);
      const buf = await canvas.screenshot({ type: 'png' });
      const name = `preview_${String(t).replace('.', '_')}s.png`;
      await writeFile(join(OUT, name), buf);
      console.log('saved', name, (buf.length / 1024).toFixed(0) + 'KB');
    }
    await first.browser.close(); srv.close();
    return;
  }

  /* ---------- полный рендер ---------- */
  const fps = fpsArg ? Number(fpsArg) : meta.FPS;
  let total = fpsArg ? Math.round(meta.DUR * fps) : meta.TOTAL;
  if (limitArg) total = Math.min(total, parseInt(limitArg, 10));
  const nw = Math.min(WORKERS, total);
  // границы кусков выравниваем по GOP, чтобы склейка шла копированием
  const gop = 60;
  const per = Math.max(gop, Math.ceil(total / nw / gop) * gop);
  const slices = [];
  for (let s = 0; s < total; s += per) slices.push([s, Math.min(total, s + per)]);

  console.log(`кадров: ${total} @ ${fps} fps, воркеров: ${slices.length} (по ~${per} кадров)`);

  const t0 = Date.now();
  let doneFrames = 0;
  const tick = () => {
    doneFrames++;
    if (doneFrames % 40 !== 0 && doneFrames !== total) return;
    const el = (Date.now() - t0) / 1000;
    const eta = el / doneFrames * (total - doneFrames);
    process.stdout.write(
      `\rкадр ${doneFrames}/${total}  ${(doneFrames / total * 100).toFixed(1)}%  ` +
      `${el.toFixed(0)}c прошло, ~${eta.toFixed(0)}c осталось   `);
  };

  const segFiles = [];
  await Promise.all(slices.map(async ([from, to], idx) => {
    const ctxPage = idx === 0 ? first : await openPage(chromium, port);
    const canvas = await ctxPage.page.$('#stage');
    const seg = join(OUT, `seg_${String(idx).padStart(2, '0')}.mp4`);
    segFiles.push(seg);
    const { ff, done } = encoder(seg, fps);
    for (let i = from; i < to; i++) {
      await ctxPage.page.evaluate((t) => window.__seek(t), i / fps);
      const buf = await canvas.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      tick();
    }
    ff.stdin.end();
    await done;
    await ctxPage.browser.close();
  }));

  console.log('\nсклейка сегментов...');
  if (segFiles.length === 1) {
    await rm(outArg, { force: true });
    await (await import('node:fs/promises')).rename(segFiles[0], outArg);
  } else {
    const list = join(OUT, 'segments.txt');
    await writeFile(list, segFiles.map(f => `file '${f}'`).join('\n'));
    const cat = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
      '-i', list, '-c', 'copy', '-movflags', '+faststart', outArg], { stdio: 'inherit' });
    await new Promise((res, rej) => cat.on('close', c => c === 0 ? res() : rej(new Error('concat exit ' + c))));
    for (const f of segFiles) await rm(f, { force: true });
    await rm(list, { force: true });
  }
  console.log('готово:', outArg, `за ${((Date.now() - t0) / 1000).toFixed(0)} c`);

  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
