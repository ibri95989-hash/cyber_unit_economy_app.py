# -*- coding: utf-8 -*-
"""
analyze.py — разбор дикторской озвучки для монтажа «под звук».

Находит:
  * фразы      — участки речи между паузами (по огибающей громкости);
  * атаки      — начала слов и слогов (пик спектрального потока);
  * акценты    — самые сильные атаки, под них ставятся удары и глитчи.

Результат кладётся в src/cues.js — таймлайн ролика берёт моменты появления
элементов оттуда, поэтому текст и графика выходят ровно на речь.

Запуск:  python3 analyze.py assets/voiceover.mp3
"""
import json
import subprocess
import sys
import os

import numpy as np

SR = 16000
HOP = 128          # 8 мс
WIN = 512          # 32 мс


def ffmpeg_bin():
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    from shutil import which
    if which('ffmpeg'):
        return 'ffmpeg'
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def load(path):
    raw = subprocess.run(
        [ffmpeg_bin(), '-v', 'error', '-i', path,
         '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def stft_mag(x):
    n = 1 + (len(x) - WIN) // HOP
    idx = np.arange(WIN)[None, :] + HOP * np.arange(n)[:, None]
    frames = x[idx] * np.hanning(WIN)[None, :]
    return np.abs(np.fft.rfft(frames, axis=1))


def phrases(x, mag):
    """Участки речи: порог по огибающей с гистерезисом."""
    rms = np.sqrt((mag ** 2).sum(axis=1) / mag.shape[1])
    db = 20 * np.log10(rms + 1e-9)
    hi = np.percentile(db, 95)
    on_th, off_th = hi - 26, hi - 34          # гистерезис
    out, start, speaking = [], None, False
    for i, v in enumerate(db):
        t = i * HOP / SR
        if not speaking and v > on_th:
            speaking, start = True, t
        elif speaking and v < off_th:
            if t - start > 0.15:
                out.append([round(start, 3), round(t, 3)])
            speaking = False
    if speaking:
        out.append([round(start, 3), round(len(x) / SR, 3)])
    # склеиваем куски, разделённые паузой короче 0.18 c
    merged = []
    for seg in out:
        if merged and seg[0] - merged[-1][1] < 0.18:
            merged[-1][1] = seg[1]
        else:
            merged.append(seg)
    return merged


def onsets(mag, spans):
    """Атаки: полуволновой спектральный поток с адаптивным порогом."""
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
    flux = np.concatenate([[0.0], flux])
    # сглаживание скользящим средним по 3 кадрам
    k = np.ones(3) / 3
    flux = np.convolve(flux, k, mode='same')
    flux /= flux.max() + 1e-9

    # адаптивный порог: медиана по окну ±0.2 c
    w = int(0.2 * SR / HOP)
    pad = np.pad(flux, w, mode='edge')
    med = np.array([np.median(pad[i:i + 2 * w + 1]) for i in range(len(flux))])
    th = med + 0.06

    peaks = []
    for i in range(1, len(flux) - 1):
        if flux[i] > th[i] and flux[i] >= flux[i - 1] and flux[i] > flux[i + 1]:
            peaks.append((i * HOP / SR, float(flux[i])))

    # атаки только внутри речи; не ближе 0.12 c друг к другу
    inside = []
    for t, s in peaks:
        if any(a - 0.05 <= t <= b for a, b in spans):
            if not inside or t - inside[-1][0] >= 0.12:
                inside.append((t, s))
            elif s > inside[-1][1]:
                inside[-1] = (t, s)
    # начало каждой фразы — всегда атака
    for a, _b in spans:
        if not any(abs(a - t) < 0.10 for t, _ in inside):
            inside.append((a, 1.0))
    inside.sort()
    return inside


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'assets/voiceover.mp3'
    x = load(src)
    dur = len(x) / SR
    mag = stft_mag(x)
    sp = phrases(x, mag)
    on = onsets(mag, sp)

    times = [round(t, 3) for t, _ in on]
    strength = [round(s, 4) for _, s in on]
    # акценты — треть самых сильных атак
    if strength:
        cut = float(np.percentile(strength, 67))
        accents = [t for t, s in on if s >= cut]
    else:
        accents = []

    data = {
        'duration': round(dur, 3),
        'phrases': sp,
        'onsets': times,
        'strength': strength,
        'accents': [round(t, 3) for t in accents],
    }
    with open('src/cues.js', 'w', encoding='utf-8') as f:
        f.write('/* Сгенерировано analyze.py — тайминги речи для монтажа под звук. */\n')
        f.write('const CUES = ' + json.dumps(data, ensure_ascii=False) + ';\n')
    print(f'озвучка {dur:.2f} c: фраз {len(sp)}, атак {len(times)}, акцентов {len(accents)}')
    print('фразы:', ', '.join(f'{a:.2f}-{b:.2f}' for a, b in sp))
    print('атаки:', ', '.join(f'{t:.2f}' for t in times))


if __name__ == '__main__':
    main()
