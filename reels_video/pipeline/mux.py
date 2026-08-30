# -*- coding: utf-8 -*-
"""Наложение озвучки: нормализация громкости и склейка без перекодирования видео."""
import os, subprocess, tempfile, shutil
from .ffmpeg import ffmpeg_exe, duration_of

LUFS = -14      # целевой уровень Instagram / TikTok / YouTube


def mux(video, audio, out, lufs=LUFS, abitrate='192k'):
    ff = ffmpeg_exe()
    dur = duration_of(video)
    tmp = tempfile.mkdtemp()
    try:
        a = os.path.join(tmp, 'audio.m4a')
        # Отдельным шагом: apad вместе с -shortest и "-c:v copy" в одной команде
        # уводит ffmpeg в бесконечный цикл.
        subprocess.run([ff, '-y', '-v', 'error', '-i', audio,
                        '-af', 'loudnorm=I=%d:TP=-1.5:LRA=11,aresample=48000,apad=whole_dur=%.3f' % (lufs, dur),
                        '-t', '%.3f' % dur, '-c:a', 'aac', '-b:a', abitrate, '-ar', '48000', a], check=True)
        subprocess.run([ff, '-y', '-v', 'error', '-i', video, '-i', a,
                        '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy',
                        '-movflags', '+faststart', out], check=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return out
