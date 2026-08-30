# -*- coding: utf-8 -*-
"""Покадровый рендер сцены в MP4 через headless Chromium + ffmpeg."""
import os, subprocess, sys, time
from .ffmpeg import ffmpeg_exe

CHROME_ARGS = ['--no-sandbox', '--disable-lcd-text', '--force-color-profile=srgb',
               '--hide-scrollbars', '--allow-file-access-from-files',
               '--disable-dev-shm-usage']


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


def render(page_url, out_mp4, duration, fps=30, crf=16, preset='slow',
           width=1080, height=1920, quiet=False, log=None):
    from playwright.sync_api import sync_playwright
    n = int(round(duration * fps))
    os.makedirs(os.path.dirname(os.path.abspath(out_mp4)), exist_ok=True)
    logf = open(log or os.path.join(os.path.dirname(os.path.abspath(out_mp4)), 'ffmpeg.log'), 'wb')
    cmd = [ffmpeg_exe(), '-y', '-f', 'image2pipe', '-vcodec', 'png', '-r', str(fps),
           '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', preset, '-crf', str(crf),
           '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
           '-movflags', '+faststart', out_mp4]
    # stderr обязательно в файл: незачитываемый PIPE переполняется и вешает ffmpeg
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=logf)

    t0 = time.time()
    errors = []
    with sync_playwright() as pw:
        b = _browser(pw)
        pg = b.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(page_url)
        _wait_ready(pg)
        for i in range(n):
            pg.evaluate('t=>window.render(t)', i / fps)
            proc.stdin.write(pg.screenshot(type='png'))
            if errors:
                raise SystemExit('ошибка в сцене: ' + errors[0])
            if not quiet and (i % 30 == 0 or i == n - 1):
                el = time.time() - t0
                eta = el / (i + 1) * (n - i - 1)
                sys.stdout.write('\r  кадр %d/%d  %4.1f%%  прошло %3.0f с  осталось ~%3.0f с   '
                                 % (i + 1, n, 100 * (i + 1) / n, el, eta))
                sys.stdout.flush()
        b.close()
    proc.stdin.close()
    rc = proc.wait(); logf.close()
    if not quiet: print()
    if rc:
        raise SystemExit('ffmpeg завершился с кодом %d, подробности в %s' % (rc, logf.name))
    return out_mp4


def preview(page_url, times, out_dir, width=1080, height=1920):
    from playwright.sync_api import sync_playwright
    os.makedirs(out_dir, exist_ok=True)
    made = []
    with sync_playwright() as pw:
        b = _browser(pw)
        pg = b.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(page_url)
        _wait_ready(pg)
        for t in times:
            pg.evaluate('t=>window.render(t)', t)
            p = os.path.join(out_dir, 'frame_%07.2f.png' % t)
            pg.screenshot(path=p); made.append(p)
        b.close()
    if errors: raise SystemExit('ошибка в сцене: ' + errors[0])
    return made
