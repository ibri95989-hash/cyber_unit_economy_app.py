#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Разовая установка: библиотеки, Chromium, шрифты и модель распознавания.

    python install.py

Работает на Windows, macOS и Linux. Нужен только Python 3.9+.
"""
import os, subprocess, sys, urllib.request

import sys
if hasattr(sys.stdout, 'reconfigure'):        # консоль Windows по умолчанию не в utf-8
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')

FONTS = {
    'Montserrat.ttf':    'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf',
    'Inter.ttf':         'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf',
    'JetBrainsMono.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf',
}


def step(n, total, msg):
    print('\n[%d/%d] %s' % (n, total, msg), flush=True)


def run(cmd):
    print('     $ ' + ' '.join(cmd), flush=True)
    return subprocess.call(cmd)


def main():
    total = 4
    step(1, total, 'Библиотеки Python')
    if run([sys.executable, '-m', 'pip', 'install', '-r',
            os.path.join(HERE, 'requirements.txt')]):
        sys.exit('не удалось поставить зависимости')

    step(2, total, 'Chromium для рендера')
    if run([sys.executable, '-m', 'playwright', 'install', 'chromium']):
        print('     ! Chromium не поставился. Попробуйте вручную:')
        print('       %s -m playwright install chromium' % sys.executable)

    step(3, total, 'Шрифты (Montserrat, Inter, JetBrains Mono — лицензия OFL)')
    os.makedirs(SRC, exist_ok=True)
    sys.path.insert(0, HERE)
    from pipeline.checks import font_problem
    for name, url in FONTS.items():
        dst = os.path.join(SRC, name)
        if font_problem(dst) is None:
            print('     уже есть: ' + name); continue
        ok = False
        for attempt in range(1, 4):
            print('     скачиваю %s%s' % (name, '' if attempt == 1 else ' (попытка %d)' % attempt),
                  flush=True)
            try:
                urllib.request.urlretrieve(url, dst)
            except Exception as e:
                print('       не вышло: %s' % e); continue
            # проверяем содержимое: вместо шрифта могла прийти страница ошибки
            problem = font_problem(dst)
            if problem is None:
                ok = True; break
            print('       файл повреждён (%s), пробую снова' % problem)
        if not ok:
            try: os.remove(dst)
            except OSError: pass
            sys.exit('Не удалось скачать шрифт %s.\nБез него ролик получится кривым. '
                     'Проверьте интернет и запустите установку снова.' % name)

    step(4, total, 'Модель распознавания русской речи (~170 МБ, один раз)')
    sys.path.insert(0, HERE)
    try:
        from pipeline.asr import ensure_model
        mdir, vad = ensure_model()
        print('     модель: ' + mdir)
    except Exception as e:
        print('     ! не удалось скачать модель: %s' % e)
        print('       она догрузится при первом запуске make_reel.py')

    print('\nГотово. Соберите ролик:\n    %s make_reel.py ваша_озвучка.mp3\n' % sys.executable)


if __name__ == '__main__':
    main()
