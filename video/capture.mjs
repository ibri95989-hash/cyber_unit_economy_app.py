/* ============================================================
   Render every frame in headless Chromium and pipe it to ffmpeg.
   ============================================================ */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const has = k => argv.includes('--' + k);

const ROOT   = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const DIR    = path.join(ROOT, 'render');
const CFG    = arg('config', path.join(ROOT, 'build/audio.json'));
const OUT    = arg('out', path.join(ROOT, 'build/video.mp4'));
const FPS    = parseInt(arg('fps', '60'), 10);
const QUAL   = parseFloat(arg('quality', '0.96'));
const FFMPEG = arg('ffmpeg', process.env.FFMPEG || 'ffmpeg');
const STILLS = arg('stills', null);          /* comma separated seconds -> png files */

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

async function serve() {
  const srv = createServer(async (req, res) => {
    const f = path.join(DIR, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!existsSync(f)) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(await readFile(f));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, port: srv.address().port };
}

const cfg = JSON.parse(await readFile(CFG, 'utf8'));
const { srv, port } = await serve();

const browser = await chromium.launch({
  args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none',
         '--enable-font-antialiasing', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.evaluate(() => window.fontsReady);
await page.evaluate(c => window.configure(c), cfg);

const frameB64 = async (t, i, q) => page.evaluate(([t, i, q]) => {
  window.renderFrame(t, i);
  return document.getElementById('cv').toDataURL('image/jpeg', q).slice(23);
}, [t, i, q]);

if (STILLS) {                                   /* QA mode: a few PNG stills */
  await mkdir(path.dirname(arg('stills-out', path.join(ROOT, 'build/stills/x.png'))), { recursive: true });
  for (const s of STILLS.split(',')) {
    const t = parseFloat(s);
    const b64 = await page.evaluate(([t, i]) => {
      window.renderFrame(t, i);
      return document.getElementById('cv').toDataURL('image/png').slice(22);
    }, [t, Math.round(t * FPS)]);
    const f = path.join(ROOT, 'build/stills', `t${s.replace('.', '_')}.png`);
    await writeFile(f, Buffer.from(b64, 'base64'));
    console.log('still', f);
  }
  await browser.close(); srv.close(); process.exit(0);
}

const startF = Math.round(parseFloat(arg('start', '0')) * FPS);
const limit = parseInt(arg('limit', '0'), 10);
const total = limit ? startF + limit : Math.round(cfg.dur * FPS);
await mkdir(path.dirname(OUT), { recursive: true });

const ff = spawn(FFMPEG, [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-i', arg('audio', path.join(ROOT, 'build/voice.wav')),
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-level', '4.2',
  '-pix_fmt', 'yuv420p', '-x264-params', 'keyint=120:min-keyint=60:scenecut=0',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
  '-movflags', '+faststart', '-shortest', OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
for (let i = startF; i < total; i++) {
  const t = i / FPS;
  const b64 = await frameB64(t, i, QUAL);
  const buf = Buffer.from(b64, 'base64');
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 60 === 0 || i === total - 1) {
    const el = (Date.now() - t0) / 1000;
    const eta = el / Math.max(1, i - startF) * (total - i);
    process.stdout.write(`\rframe ${i + 1}/${total}  ${((i - startF) / el).toFixed(2)} fps  eta ${(eta / 60).toFixed(1)} min   `);
  }
}
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
console.log(`\ndone -> ${OUT} in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
await browser.close();
srv.close();
