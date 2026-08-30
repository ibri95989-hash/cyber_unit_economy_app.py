# -*- coding: utf-8 -*-
"""Звук ролика: озвучка, эффекты по тайм-кодам плана и сведение с видео."""
import os, subprocess, tempfile, shutil, wave
import numpy as np
from .ffmpeg import ffmpeg_exe, duration_of

LUFS = -14      # целевой уровень Instagram / TikTok / YouTube
SR = 48000


def _decode(path, dur, ff):
    """Озвучка -> нормализованный по громкости моно-массив нужной длины."""
    raw = subprocess.run(
        [ff, '-v', 'error', '-i', path,
         '-af', 'loudnorm=I=%d:TP=-1.5:LRA=11,aresample=%d' % (LUFS, SR),
         '-t', '%.3f' % dur, '-ac', '1', '-f', 'f32le', '-'],
        stdout=subprocess.PIPE, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    need = int(dur * SR)
    if len(a) < need: a = np.concatenate([a, np.zeros(need - len(a), dtype=np.float32)])
    return a[:need]


def _write_wav(path, data):
    d = np.clip(data, -1.0, 1.0)
    with wave.open(path, 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((d * 32767).astype('<i2').tobytes())


def mux(video, audio, out, plan=None, words=None, sfx_level=0.55, abitrate='192k'):
    """Складывает видео и звук. Если передан plan — добавляет эффекты."""
    ff = ffmpeg_exe()
    dur = duration_of(video)
    tmp = tempfile.mkdtemp()
    try:
        voice = _decode(audio, dur, ff)
        if plan is not None and sfx_level > 0:
            from . import sfx as sfxmod
            track = sfxmod.build_track(plan, dur)
            mixed = sfxmod.mix(voice, track, words or [], level=sfx_level)
        else:
            mixed = voice
        wav = os.path.join(tmp, 'audio.wav')
        _write_wav(wav, mixed)
        a = os.path.join(tmp, 'audio.m4a')
        subprocess.run([ff, '-y', '-v', 'error', '-i', wav,
                        '-c:a', 'aac', '-b:a', abitrate, '-ar', str(SR), a], check=True)
        subprocess.run([ff, '-y', '-v', 'error', '-i', video, '-i', a,
                        '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy',
                        '-movflags', '+faststart', out], check=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return out
