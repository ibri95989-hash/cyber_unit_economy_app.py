# -*- coding: utf-8 -*-
"""Покадровый рендер сцены в MP4 через headless Chromium + ffmpeg.

Про скорость. Кадр рисуется быстро — window.render(t) укладывается в 70 мс.
Почти всё время съедал снимок экрана: playwright отдаёт PNG с максимальным
сжатием, и один кадр 1080×1920 обходился в полторы секунды. Здесь снимок
берётся напрямую через CDP с optimizeForSpeed: тот же PNG, то же изображение
до пикселя, но втрое быстрее.

Второй множитель — процессы. render(t) зависит только от t, поэтому ролик
режется на равные куски, каждый рендерится своим браузером в свой сегмент,
и сегменты склеиваются без перекодирования.
"""
import base64, os, subprocess, sys, time
from .ffmpeg import ffmpeg_exe

CHROME_ARGS = ['--no-sandbox', '--disable-lcd-text', '--force-color-profile=srgb',
               '--hide-scrollbars', '--allow-file-access-from-files',
               '--disable-dev-shm-usage']
MIN_CHUNK = 90          # меньше трёх секунд на процесс — накладные расходы съедят выигрыш


def _browser(pw, headed=False):
    """Chromium из playwright; если версия не совпала — ищем бинарь вручную."""
    try:
        return pw.chromium.launch(args=CHROME_ARGS)
    except Exception:
        import glob
        pats = [os.path.join(os.environ.get('PLAYWRIGHT_BROWSERS_PATH', ''), 'chromium-*/chrome-linux/chrome'),
                os.path.expanduser('~/.cache/ms-playwright/chromium-*/chrome-linux/chrome'),
                os.path.expanduser('~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
                os.path.expandvars(r'%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win\chrome.exe')]
        for p in pats:
            hits = sorted(glob.glob(p))
            if hits:
                return pw.chromium.launch(executable_path=hits[-1], args=CHROME_ARGS)
        raise


def _apply_bg(pg, bg):
    if bg:
        pg.evaluate('q=>window.setBgQuality && window.setBgQuality(q)', bg)


def _wait_ready(pg):
    """Ждёт готовности сцены и проверяет, что шрифты действительно применились."""
    try:
        pg.wait_for_function("window.__ready===true && typeof window.render==='function'",
                             timeout=45000)
    except Exception:
        raise SystemExit(
            'Сцена не запустилась за 45 секунд.\n'
            'Чаще всего это повреждённые шрифты в папке src.\n'
            'Запустите проверку:  python make_reel.py --check')
    err = pg.evaluate('window.__fontError')
    if err:
        raise SystemExit(
            'Рендер остановлен: %s.\n'
            'Без них текст рисуется системным шрифтом и вся вёрстка разъезжается.\n'
            'Запустите установку заново (СТАРТ или install.py), затем проверку:\n'
            '  python make_reel.py --check' % err)


def _shooter(pg):
    """Быстрый снимок кадра. PNG без потерь, просто без долгого сжатия."""
    try:
        cdp = pg.context.new_cdp_session(pg)
        cdp.send('Page.captureScreenshot', {'format': 'png', 'optimizeForSpeed': True})
        return lambda: base64.b64decode(
            cdp.send('Page.captureScreenshot', {'format': 'png', 'optimizeForSpeed': True})['data'])
    except Exception:
        return lambda: pg.screenshot(type='png')      # старый Chromium — работаем как раньше


def _encoder(out_mp4, fps, crf, preset, log_path):
    cmd = [ffmpeg_exe(), '-y', '-f', 'image2pipe', '-vcodec', 'png', '-r', str(fps),
           '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', preset, '-crf', str(crf),
           '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
           '-movflags', '+faststart', out_mp4]
    logf = open(log_path, 'wb')
    # stderr обязательно в файл: незачитываемый PIPE переполняется и вешает ffmpeg
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=logf), logf


def _render_range(page_url, out_mp4, i0, i1, fps, crf, preset, width, height, bg,
                  log_path, progress=None):
    """Кадры [i0, i1) в отдельный mp4. Отдельный процесс — отдельный браузер."""
    from playwright.sync_api import sync_playwright
    proc, logf = _encoder(out_mp4, fps, crf, preset, log_path)
    errors = []
    with sync_playwright() as pw:
        b = _browser(pw)
        pg = b.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(page_url)
        _apply_bg(pg, bg)
        _wait_ready(pg)
        shot = _shooter(pg)
        for i in range(i0, i1):
            pg.evaluate('t=>window.render(t)', i / fps)
            proc.stdin.write(shot())
            if errors:
                proc.stdin.close(); proc.kill(); logf.close()
                raise SystemExit('ошибка в сцене: ' + errors[0])
            if progress is not None and (i - i0) % 10 == 9:
                progress(10)
        b.close()
    if progress is not None and (i1 - i0) % 10:
        progress((i1 - i0) % 10)
    proc.stdin.close()
    rc = proc.wait(); logf.close()
    if rc:
        raise SystemExit('ffmpeg завершился с кодом %d, подробности в %s' % (rc, log_path))
    return out_mp4


def resolve_jobs(jobs, n_frames):
    """Сколько процессов запускать: явное число, либо по числу ядер."""
    if jobs is None or jobs <= 0:
        jobs = min(os.cpu_count() or 1, 8)
    return max(1, min(jobs, max(1, n_frames // MIN_CHUNK)))


def _concat(parts, out_mp4, log_path):
    """Склейка сегментов без перекодирования: каждый начинается с ключевого кадра."""
    lst = out_mp4 + '.parts.txt'
    with open(lst, 'w', encoding='utf-8') as f:
        for p in parts:
            f.write("file '%s'\n" % os.path.abspath(p).replace("'", r"'\''"))
    with open(log_path, 'ab') as logf:
        rc = subprocess.call([ffmpeg_exe(), '-y', '-v', 'error', '-f', 'concat', '-safe', '0',
                              '-i', lst, '-c', 'copy', '-movflags', '+faststart', out_mp4],
                             stdout=subprocess.DEVNULL, stderr=logf)
    os.remove(lst)
    if rc:
        raise SystemExit('не удалось склеить сегменты, подробности в %s' % log_path)
    for p in parts:
        try: os.remove(p)
        except OSError: pass


def _tick(done, n, t0):
    el = time.time() - t0
    eta = el / max(1, done) * (n - done)
    sys.stdout.write('\r  кадр %d/%d  %4.1f%%  прошло %3.0f с  осталось ~%3.0f с   '
                     % (done, n, 100.0 * done / n, el, eta))
    sys.stdout.flush()


def render(page_url, out_mp4, duration, fps=30, crf=16, preset='slow',
           width=1080, height=1920, quiet=False, log=None, bg='medium', jobs=None):
    n = int(round(duration * fps))
    out_dir = os.path.dirname(os.path.abspath(out_mp4))
    os.makedirs(out_dir, exist_ok=True)
    log_path = log or os.path.join(out_dir, 'ffmpeg.log')
    jobs = resolve_jobs(jobs, n)
    t0 = time.time()

    if jobs == 1:
        state = {'done': 0}
        def tick(k):
            state['done'] += k
            _tick(min(state['done'], n), n, t0)
        _render_range(page_url, out_mp4, 0, n, fps, crf, preset, width, height, bg,
                      log_path, progress=None if quiet else tick)
        if not quiet:
            _tick(n, n, t0); print()
        return out_mp4

    import multiprocessing as mp
    ctx = mp.get_context('spawn')          # одинаково на Windows, macOS и Linux
    q = ctx.Queue()
    bounds = [n * k // jobs for k in range(jobs + 1)]
    parts, procs = [], []
    for k in range(jobs):
        part = os.path.join(out_dir, 'seg%03d.mp4' % k)
        parts.append(part)
        p = ctx.Process(target=_seg, args=(page_url, part, bounds[k], bounds[k + 1], fps, crf,
                                           preset, width, height, bg,
                                           log_path + '.%d' % k, q))
        p.start(); procs.append(p)

    done, fails = 0, []
    if not quiet:
        print('     %d процесса(ов) параллельно' % jobs)
    while any(p.is_alive() for p in procs) or not q.empty():
        try:
            msg = q.get(timeout=0.5)
        except Exception:
            continue
        if isinstance(msg, str):
            fails.append(msg)
        else:
            done += msg
            if not quiet:
                _tick(min(done, n), n, t0)
    for p in procs:
        p.join()
        if p.exitcode:
            fails.append('процесс рендера завершился с кодом %d' % p.exitcode)
    if not quiet:
        _tick(n, n, t0); print()
    if fails:
        raise SystemExit(fails[0])
    _concat(parts, out_mp4, log_path)
    return out_mp4


def _seg(page_url, out_mp4, i0, i1, fps, crf, preset, width, height, bg, log_path, q):
    """Дочерний процесс: свой кусок кадров, свой ffmpeg, отчёт о прогрессе в очередь."""
    try:
        _render_range(page_url, out_mp4, i0, i1, fps, crf, preset, width, height, bg,
                      log_path, progress=q.put)
    except SystemExit as e:
        q.put(str(e))
    except Exception as e:
        q.put('%s: %s' % (type(e).__name__, e))


def preview(page_url, times, out_dir, width=1080, height=1920, bg='medium'):
    from playwright.sync_api import sync_playwright
    os.makedirs(out_dir, exist_ok=True)
    made = []
    with sync_playwright() as pw:
        b = _browser(pw)
        pg = b.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(page_url)
        _apply_bg(pg, bg)
        _wait_ready(pg)
        for t in times:
            pg.evaluate('t=>window.render(t)', t)
            p = os.path.join(out_dir, 'frame_%07.2f.png' % t)
            pg.screenshot(path=p); made.append(p)
        b.close()
    if errors: raise SystemExit('ошибка в сцене: ' + errors[0])
    return made
