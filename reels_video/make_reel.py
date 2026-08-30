#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка вертикального Reels 9:16 из одной аудиоозвучки.

    python make_reel.py voice.mp3

Что происходит:
  1. озвучка распознаётся офлайн, с тайм-кодом каждого слова;
  2. речь раскладывается на сцены по смыслу, тайм-коды всех движений
     привязываются к конкретным словам;
  3. сцена рисуется покадрово в headless Chromium и кодируется в H.264;
  4. озвучка нормализуется по громкости и подкладывается под видео.

Тексты, цифры и цвета правятся в brand.json — без единой строки кода.
"""
import argparse, json, os, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pipeline import asr, plan as planner, render as renderer, mux as muxer
from pipeline.ffmpeg import ffmpeg_exe


def load_json(p, dflt=None):
    if p and os.path.exists(p):
        with open(p, encoding='utf-8') as f: return json.load(f)
    return dflt if dflt is not None else {}


def parse_times(s):
    out = []
    for part in s.replace(';', ',').split(','):
        part = part.strip()
        if part: out.append(float(part))
    return out


def main():
    ap = argparse.ArgumentParser(
        description='Reels 9:16 из аудиоозвучки',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='примеры:\n'
               '  python make_reel.py voice.mp3\n'
               '  python make_reel.py voice.mp3 -o out/promo.mp4 --brand my_brand.json\n'
               '  python make_reel.py voice.mp3 --preview 0.4,17.2,40.1\n'
               '  python make_reel.py voice.mp3 --dump-plan plan.json   # план для ручной правки\n'
               '  python make_reel.py voice.mp3 --plan plan.json        # рендер по готовому плану\n')
    ap.add_argument('audio', help='файл озвучки (mp3, wav, m4a…)')
    ap.add_argument('-o', '--out', default=None, help='куда сохранить ролик (по умолчанию out/<имя>.mp4)')
    ap.add_argument('-b', '--brand', default=os.path.join(HERE, 'brand.json'), help='файл с текстами и цифрами')
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--crf', type=int, default=16, help='качество: меньше — лучше и тяжелее (16 мастер, 22 для мессенджеров)')
    ap.add_argument('--preset', default='slow', help='пресет x264: ultrafast…veryslow')
    ap.add_argument('--tail', type=float, default=2.05, help='сколько секунд держать финальный кадр после речи')
    ap.add_argument('--transcript', default=None, help='готовая расшифровка вместо распознавания')
    ap.add_argument('--plan', default=None, help='готовый план сцен вместо автоматического')
    ap.add_argument('--dump-plan', default=None, help='сохранить сгенерированный план в файл')
    ap.add_argument('--preview', default=None, help='вместо рендера снять кадры в указанные секунды: 1.2,15.4')
    ap.add_argument('--keep', action='store_true', help='не удалять промежуточные файлы')
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()

    if not os.path.exists(a.audio): raise SystemExit('нет файла: ' + a.audio)
    src = os.path.join(HERE, 'src')
    for need in ('index.html', 'reel.js'):
        if not os.path.exists(os.path.join(src, need)):
            raise SystemExit('нет файла src/%s' % need)
    if not os.path.exists(os.path.join(src, 'Montserrat.ttf')):
        raise SystemExit('нет шрифтов. Выполните: python install.py')

    base = os.path.splitext(os.path.basename(a.audio))[0]
    out = a.out or os.path.join(HERE, 'out', base + '.mp4')
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    work = os.path.join(os.path.dirname(os.path.abspath(out)), '.work_' + base)
    os.makedirs(work, exist_ok=True)
    brand = load_json(a.brand)
    t_start = time.time()

    # 1 — расшифровка
    if a.transcript:
        tr = load_json(a.transcript)
        words = tr['words'] if isinstance(tr, dict) else [w for s in tr for w in s['words']]
        if not a.quiet: print('1/4  расшифровка взята из %s (%d слов)' % (a.transcript, len(words)))
    else:
        if not a.quiet: print('1/4  распознаю озвучку…')
        wav = os.path.join(work, 'voice16k.wav')
        asr.to_wav16k(a.audio, wav, ffmpeg_exe())
        tr = asr.transcribe(wav, quiet=a.quiet)
        words = tr['words']
        json.dump(tr, open(os.path.join(work, 'transcript.json'), 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
        if not words: raise SystemExit('в аудио не нашлось речи')

    # 2 — план сцен
    if a.plan:
        pl = load_json(a.plan); subs = pl.pop('subs', None)
        if subs is None: _, subs = planner.build(words, brand, a.tail, a.fps)
        if not a.quiet: print('2/4  план взят из %s' % a.plan)
    else:
        pl, subs = planner.build(words, brand, a.tail, a.fps)
        if not a.quiet:
            print('2/4  раскладка сцен:')
            for s in pl['scenes']:
                print('       %-8s %6.2f – %6.2f  %s' % (s['n'], s['s'], s['e'], s.get('tr', '')))
    if a.dump_plan:
        d = dict(pl); d['subs'] = subs
        json.dump(d, open(a.dump_plan, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('     план сохранён: %s' % a.dump_plan)

    with open(os.path.join(src, 'plan.js'), 'w', encoding='utf-8') as f:
        f.write('const PLAN=' + json.dumps(pl, ensure_ascii=False) + ';\n')
        f.write('const SUBS=' + json.dumps(subs, ensure_ascii=False) + ';\n')

    url = 'file:///' + os.path.join(src, 'index.html').replace('\\', '/').lstrip('/')

    # превью вместо рендера
    if a.preview:
        d = os.path.join(os.path.dirname(os.path.abspath(out)), 'preview')
        made = renderer.preview(url, parse_times(a.preview), d)
        print('кадры сохранены:'); [print('  ' + m) for m in made]
        return

    # 3 — рендер
    if not a.quiet:
        print('3/4  рендер %d кадров (%.2f с при %d fps)…'
              % (int(round(pl['duration'] * a.fps)), pl['duration'], a.fps))
    raw = os.path.join(work, 'video.mp4')
    renderer.render(url, raw, pl['duration'], fps=a.fps, crf=a.crf,
                    preset=a.preset, quiet=a.quiet)

    # 4 — звук
    if not a.quiet: print('4/4  накладываю озвучку…')
    muxer.mux(raw, a.audio, out)
    if not a.keep: shutil.rmtree(work, ignore_errors=True)

    mb = os.path.getsize(out) / 1048576.0
    print('\nготово: %s  (%.2f с, %.1f МБ, собрано за %.0f с)'
          % (out, pl['duration'], mb, time.time() - t_start))


if __name__ == '__main__':
    main()
