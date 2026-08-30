# -*- coding: utf-8 -*-
"""Поиск ffmpeg: системный, иначе встроенный из imageio-ffmpeg."""
import shutil, subprocess, os


def ffmpeg_exe():
    p = shutil.which('ffmpeg')
    if p: return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        raise SystemExit('ffmpeg не найден. Установите его или выполните: pip install imageio-ffmpeg')


def duration_of(path):
    out = subprocess.run([ffmpeg_exe(), '-i', path], capture_output=True, text=True).stderr
    for line in out.splitlines():
        if 'Duration:' in line:
            t = line.split('Duration:')[1].split(',')[0].strip()
            h, m, s = t.split(':')
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise SystemExit('не удалось прочитать длительность: ' + path)
