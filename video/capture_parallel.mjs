/* ============================================================
   Parallel frame capture: splits the timeline into N contiguous
   chunks, renders each chunk in its own Chromium page (Playwright
   gives every page its own OS renderer process, so this is real
   multi-core parallelism, not just concurrency) and its own ffmpeg
   encoder, then stitches the video-only segments back together
   with a lossless concat (-c copy) before muxing in the audio once.

   On a 4-core box this cuts wall-clock render time roughly in half
   to two-thirds versus the single-stream capture.mjs, because the
   JPEG encode inside each page and the libx264 encode of each
   segment both get to run on their own core instead of competing
   for one.
   ============================================================ */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };

const ROOT    = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const DIR     = path.join(ROOT, 'render');
const CFG     = arg('config', path.join(ROOT, 'build/audio.json'));
const OUT     = arg('out', path.join(ROOT, 'build/video.mp4'));
const AUDIO   = arg('audio', path.join(ROOT, 'build/voice.wav'));
const ENTRY   = arg('entry', 'index.html');
const FPS     = parseInt(arg('fps', '60'), 10);
const QUAL    = parseFloat(arg('quality', '0.96'));
const FFMPEG  = arg('ffmpeg', process.env.FFMPEG || 'ffmpeg');
const PRESET  = arg('preset', 'veryfast');
const CRF     = arg('crf', '18');
const WORKERS = parseInt(arg('workers', String(Math.max(1, Math.floor(os.cpus().length / 2)))), 10);
const TMP     = arg('tmp', path.join(ROOT, 'build/segments'));
const KEEP    = argv.includes('--keep-temp');

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

function chunks(total, n) {
  const size = Math.ceil(total / n);
  const out = [];
  for (let s = 0; s < total; s += size) out.push([s, Math.min(total, s + size)]);
  return out;
}

async function renderChunk(browser, port, seg, idx, cfg, progress) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  let errored = false;
  page.on('pageerror', e => { console.error(`\n[worker ${idx}] PAGE ERROR: ${e.message}`); errored = true; });
  await page.goto(`http://127.0.0.1:${port}/${ENTRY}`);
  await page.evaluate(() => window.fontsReady);
  await page.evaluate(c => window.configure(c), cfg);

  const outFile = path.join(TMP, `seg_${String(idx).padStart(3, '0')}.mp4`);
  const ff = spawn(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-profile:v', 'high', '-level', '4.2',
    '-pix_fmt', 'yuv420p', outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const [from, to] = seg;
  for (let i = from; i < to; i++) {
    const t = i / FPS;
    const b64 = await page.evaluate(([t, i, q]) => {
      window.renderFrame(t, i);
      return document.getElementById('cv').toDataURL('image/jpeg', q).slice(23);
    }, [t, i, QUAL]);
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    progress.done++;
    progress.report();
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error(`ffmpeg segment ${idx} exit ${c}`))));
  await page.close();
  if (errored) throw new Error(`worker ${idx} hit a page error - see log above`);
  return outFile;
}

async function main() {
  const cfg = JSON.parse(await readFile(CFG, 'utf8'));
  const total = Math.round(cfg.dur * FPS);
  await mkdir(TMP, { recursive: true });
  await mkdir(path.dirname(OUT), { recursive: true });

  const { srv, port } = await serve();
  const browser = await chromium.launch({
    args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none',
           '--enable-font-antialiasing', '--hide-scrollbars'],
  });

  const segs = chunks(total, WORKERS);
  console.log(`rendering ${total} frames across ${segs.length} workers (${segs.map(s => s[1] - s[0]).join('+')} frames each)`);

  const progress = { done: 0, t0: Date.now(), report() {
    if (this.done % 30 !== 0 && this.done !== total) return;
    const el = (Date.now() - this.t0) / 1000;
    const fps = this.done / el;
    const eta = (total - this.done) / Math.max(0.01, fps);
    process.stdout.write(`\rframes ${this.done}/${total}  ${fps.toFixed(1)} fps combined  eta ${(eta / 60).toFixed(1)} min   `);
  } };

  const files = await Promise.all(segs.map((seg, i) => renderChunk(browser, port, seg, i, cfg, progress)));
  console.log('\nall segments rendered, concatenating...');

  await browser.close();
  srv.close();

  const listPath = path.join(TMP, 'list.txt');
  await writeFile(listPath, files.map(f => `file '${path.resolve(f)}'`).join('\n'));
  const joined = path.join(TMP, 'joined.mp4');
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
    '-i', listPath, '-c', 'copy', joined]);

  console.log('muxing audio...');
  await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', joined, '-i', AUDIO,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-ar', '48000', '-ac', '2', '-movflags', '+faststart', '-shortest', OUT]);

  if (!KEEP) await rm(TMP, { recursive: true, force: true });

  const total_s = (Date.now() - progress.t0) / 1000;
  console.log(`done -> ${OUT} in ${(total_s / 60).toFixed(1)} min (${(total / total_s).toFixed(1)} fps combined)`);
}

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('close', c => c === 0 ? res() : rej(new Error(`${cmd} exit ${c}`)));
  });
}

main().catch(e => { console.error(e); process.exit(1); });
