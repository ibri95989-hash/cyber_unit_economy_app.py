# -*- coding: utf-8 -*-
"""Самопроверка: что установлено, что сломано и что делать.

Битый или недокачанный шрифт — самая частая причина «ролик получился кривой»:
браузер молча подставляет системный шрифт, вся вёрстка разъезжается.
Поэтому шрифты проверяются не по факту наличия файла, а по содержимому.
"""
import os, sys

FONTS = ('Montserrat.ttf', 'Inter.ttf', 'JetBrainsMono.ttf')
# настоящий шрифт начинается с одной из этих сигнатур
MAGIC = (b'\x00\x01\x00\x00', b'true', b'ttcf', b'OTTO', b'wOFF', b'wOF2')
MIN_SIZE = 50 * 1024


def font_problem(path):
    """-> None, если шрифт цел; иначе текст проблемы."""
    if not os.path.exists(path):
        return 'файла нет'
    size = os.path.getsize(path)
    if size < MIN_SIZE:
        return 'файл повреждён (всего %d байт вместо сотен килобайт)' % size
    with open(path, 'rb') as f:
        head = f.read(4)
    if not any(head.startswith(m) for m in MAGIC):
        return 'это не шрифт — скорее всего, вместо него скачалась страница ошибки'
    return None


def check_fonts(src_dir):
    bad = []
    for name in FONTS:
        p = font_problem(os.path.join(src_dir, name))
        if p: bad.append((name, p))
    return bad


def run(here, verbose=True):
    """Полная проверка окружения. -> список проблем."""
    problems = []
    say = print if verbose else (lambda *a, **k: None)
    say('\nПроверка установки\n' + '─' * 46)

    say('Python           %d.%d.%d' % sys.version_info[:3])
    if sys.version_info < (3, 9):
        problems.append('Нужен Python 3.9 или новее.')

    for mod, hint in (('playwright', 'pip install playwright'),
                      ('numpy', 'pip install numpy'),
                      ('sherpa_onnx', 'pip install sherpa-onnx')):
        try:
            __import__(mod); say('%-16s есть' % mod)
        except ImportError:
            say('%-16s НЕТ' % mod)
            problems.append('Не установлен модуль %s. Запустите установку заново.' % mod)

    try:
        from .ffmpeg import ffmpeg_exe
        say('ffmpeg           %s' % ffmpeg_exe())
    except SystemExit as e:
        say('ffmpeg           НЕТ'); problems.append(str(e))

    src = os.path.join(here, 'src')
    bad = check_fonts(src)
    for name in FONTS:
        p = font_problem(os.path.join(src, name))
        say('%-16s %s' % (name, 'ок' if p is None else 'ПРОБЛЕМА: ' + p))
    if bad:
        problems.append('Шрифты не в порядке (' +
                        '; '.join('%s — %s' % b for b in bad) +
                        '). Это и делает ролик кривым. Запустите установку заново.')

    try:
        from .asr import cache_dir, MODEL
        m = os.path.join(cache_dir(), MODEL)
        ok = os.path.isdir(m)
        say('модель речи      %s' % ('есть' if ok else 'нет — скачается при первом запуске'))
    except Exception:
        pass

    try:
        from playwright.sync_api import sync_playwright
        from .render import _browser
        with sync_playwright() as pw:
            b = _browser(pw); b.close()
        say('Chromium         запускается')
    except Exception as e:
        say('Chromium         НЕ ЗАПУСКАЕТСЯ')
        problems.append('Chromium не запускается (%s). Выполните: '
                        '%s -m playwright install chromium' % (str(e)[:90], sys.executable))

    say('─' * 46)
    if problems:
        say('\nНайдены проблемы:\n')
        for i, p in enumerate(problems, 1): say('  %d. %s' % (i, p))
    else:
        say('\nВсё на месте — можно собирать ролик.')
    return problems
