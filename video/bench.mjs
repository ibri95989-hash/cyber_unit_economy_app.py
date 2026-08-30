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
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
await page.evaluate(() => window.fontsReady);
await page.evaluate(c => window.configure(c), cfg);
for (const [name, t0] of [['s1', 1], ['s2', 8], ['s4', 24], ['s5', 36], ['s6', 50], ['s7', 62], ['s9', 88], ['transition', 17.4]]) {
  const r = await page.evaluate(([t0]) => {
    const a = performance.now();
    for (let i = 0; i < 30; i++) window.renderFrame(t0 + i / 60, Math.round((t0 + i / 60) * 60));
    const draw = performance.now() - a;
    const b = performance.now();
    for (let i = 0; i < 10; i++) document.getElementById('cv').toDataURL('image/jpeg', 0.96);
    return { draw: draw / 30, enc: (performance.now() - b) / 10 };
  }, [t0]);
  console.log(name.padEnd(11), 'draw', r.draw.toFixed(1), 'ms   jpeg', r.enc.toFixed(1), 'ms');
}
await browser.close(); srv.close();
