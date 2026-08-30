# -*- coding: utf-8 -*-
"""Звуковое оформление ролика.

Все звуки синтезируются кодом: ничего не скачивается, нет вопросов
с лицензиями, и звук всегда попадает ровно в тайм-код из плана —
удар совпадает с появлением слова, свист с переходом.
"""
import numpy as np

SR = 48000


# ------------------------------------------------------------ примитивы
def _env(n, attack=0.004, decay=0.25, power=2.0):
    a = max(1, int(SR * attack))
    e = np.ones(n, dtype=np.float32)
    e[:a] = np.linspace(0, 1, a, dtype=np.float32)
    d = np.linspace(1, 0, max(1, n - a), dtype=np.float32) ** power
    e[a:] = d
    return e


def _noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n).astype(np.float32)


def _lowpass(x, cutoff):
    """Однополюсный фильтр — дёшево и достаточно для шумовых текстур."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):                      # цикл по массиву: длины здесь короткие
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def _sweep_noise(dur, f0, f1, seed, curve=1.0):
    """Шум с плавно едущим фильтром — основа свистов и подъёмов."""
    n = int(SR * dur)
    x = _noise(n, seed)
    t = (np.arange(n, dtype=np.float32) / n) ** curve
    cut = f0 + (f1 - f0) * t
    a = np.exp(-2 * np.pi * cut / SR).astype(np.float32)
    y = np.empty(n, dtype=np.float32)
    acc = 0.0
    for i in range(n):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def whoosh(dur=0.45, seed=1, up=True):
    n = int(SR * dur)
    y = _sweep_noise(dur, 400, 5200, seed) if up else _sweep_noise(dur, 5200, 400, seed)
    y *= _env(n, 0.05, dur, 1.6)
    y *= np.hanning(n).astype(np.float32) ** 0.5
    return y * 0.9


def impact(dur=0.55, f0=110, f1=42, seed=2, click=0.6):
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    f = f0 * np.exp(np.log(f1 / f0) * (t / dur) ** 0.55)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR).astype(np.float32) * _env(n, 0.002, dur, 2.4)
    cn = int(SR * 0.035)
    cl = _noise(cn, seed) * _env(cn, 0.0005, 0.035, 3.0) * click
    out = body
    out[:cn] += cl
    return out * 0.95


def sub_drop(dur=0.9, f0=70, f1=28, seed=3):
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    f = f0 * np.exp(np.log(f1 / f0) * (t / dur))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR).astype(np.float32)
            * _env(n, 0.01, dur, 1.8) * 0.9)


def riser(dur=1.0, seed=4):
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / n
    nz = _sweep_noise(dur, 300, 7000, seed, curve=1.8) * (t ** 2)
    f = 220 * np.exp(np.log(6.0) * t)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR).astype(np.float32) * (t ** 3) * 0.35
    return (nz * 0.8 + tone) * 0.8


def tick(dur=0.09, freq=2100, seed=5):
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    y = (np.sin(2 * np.pi * freq * t) * 0.6 + _noise(n, seed) * 0.25).astype(np.float32)
    return y * _env(n, 0.001, dur, 3.5) * 0.7


def sparkle(dur=0.5, seed=6):
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    y = np.zeros(n, dtype=np.float32)
    rng = np.random.default_rng(seed)
    for k in range(5):
        f = 2600 + rng.random() * 4200
        ph = rng.random() * 0.2
        seg = np.sin(2 * np.pi * f * t).astype(np.float32)
        e = _env(n, 0.002 + ph, dur - ph, 3.0)
        y += seg * e * (0.25 - k * 0.03)
    return y


def swipe(dur=0.28, seed=7):
    n = int(SR * dur)
    y = _sweep_noise(dur, 1800, 6500, seed, curve=0.7) * _env(n, 0.006, dur, 2.2)
    return y * 0.7


# ------------------------------------------------------- расстановка по плану
def _add(track, y, at, gain=1.0):
    i = int(at * SR)
    if i < 0:
        y = y[-i:]; i = 0
    if i >= len(track) or len(y) == 0: return
    m = min(len(y), len(track) - i)
    track[i:i + m] += y[:m] * gain


def build_track(plan, duration, seed=11, ambient=True):
    """Собирает дорожку эффектов по тайм-кодам плана."""
    n = int(duration * SR) + SR
    tr = np.zeros(n, dtype=np.float32)
    k = seed

    def s_(name, **kw):
        nonlocal k
        k += 1
        return {'whoosh': whoosh, 'impact': impact, 'sub': sub_drop, 'riser': riser,
                'tick': tick, 'sparkle': sparkle, 'swipe': swipe}[name](seed=k, **kw)

    scenes = plan['scenes']
    for i, sc in enumerate(scenes):
        b = sc.get('b', {})
        tr_kind = sc.get('tr', 'none')

        # переход между сценами
        if i > 0:
            _add(tr, s_('whoosh', dur=0.5), sc['s'] - 0.16, 0.85)
            if tr_kind in ('punch', 'glitch', 'match'):
                _add(tr, s_('impact', dur=0.6), sc['s'], 0.9)
            if tr_kind in ('ramp', 'iris', 'streak'):
                _add(tr, s_('riser', dur=0.85), sc['s'] - 0.85, 0.55)

        nm = sc['n']
        if nm == 'hook':
            for j, key in enumerate(('w1', 'w2', 'w3')):
                if key in b:
                    _add(tr, s_('impact', dur=0.55 + j * 0.1), b[key], 0.75 + j * 0.12)
                    if j: _add(tr, s_('sub', dur=0.8), b[key], 0.5)
        elif nm == 'boring':
            if 'dupes' in b: _add(tr, s_('tick'), b['dupes'], 0.5)
            if 'stamp' in b: _add(tr, s_('impact', dur=0.7), b['stamp'], 0.85)
            if 'flick' in b: _add(tr, s_('swipe', dur=0.34), b['flick'], 0.8)
            if 'outro' in b: _add(tr, s_('impact', dur=0.5), b['outro'], 0.6)
        elif nm == 'comp':
            for key in ('split', 'timer', 'graphics', 'dynamic', 'ai'):
                if key in b: _add(tr, s_('tick'), b[key], 0.55)
            if 'attention' in b: _add(tr, s_('sparkle'), b['attention'], 0.5)
        elif nm == 'scroll':
            if 'away' in b: _add(tr, s_('swipe', dur=0.4), b['away'], 0.85)
            if 'verdict' in b: _add(tr, s_('impact', dur=0.65), b['verdict'], 0.8)
        elif nm == 'pipe':
            for j, st in enumerate(sc['p'].get('steps', [])):
                last = j == len(sc['p'].get('steps', [])) - 1
                _add(tr, s_('tick'), st['t'], 0.5)
                if last:
                    _add(tr, s_('sparkle', dur=0.6), st['t'], 0.6)
                    _add(tr, s_('impact', dur=0.6), st['t'], 0.6)
        elif nm == 'noeff':
            for it in sc['p'].get('items', []):
                _add(tr, s_('swipe', dur=0.26), it['t'] + 0.22, 0.6)
            if 'badge' in b: _add(tr, s_('impact', dur=0.55), b['badge'], 0.65)
        elif nm == 'offer':
            for it in sc['p'].get('items', []):
                _add(tr, s_('tick'), it['t'], 0.55)
                _add(tr, s_('sparkle', dur=0.35), it['t'] + 0.2, 0.35)
            if 'badge' in b: _add(tr, s_('impact', dur=0.55), b['badge'], 0.65)
        elif nm == 'result':
            if 'hero' in b: _add(tr, s_('sparkle', dur=0.7), b['hero'], 0.6)
            if 'rise' in b: _add(tr, s_('impact', dur=0.6), b['rise'], 0.7)
            if 'metrics' in b:
                _add(tr, s_('whoosh', dur=0.4), b['metrics'] - 0.12, 0.5)
                _add(tr, s_('tick'), b['metrics'] + 0.15, 0.5)
        elif nm == 'kinetic':
            for ln in sc['p'].get('lines', []):
                _add(tr, s_('impact', dur=0.5), ln['t'], 0.7)
        elif nm == 'cta':
            for key, g in (('q1', 0.7), ('q2', 0.9), ('q3', 0.75)):
                if key in b: _add(tr, s_('impact', dur=0.6), b[key], g)
            if 'q2' in b: _add(tr, s_('sub', dur=0.9), b['q2'], 0.55)
            if 'write1' in b:
                _add(tr, s_('whoosh', dur=0.45), b['write1'] - 0.14, 0.8)
                _add(tr, s_('impact', dur=0.7), b['write1'], 0.95)
            if 'write2' in b:
                _add(tr, s_('impact', dur=0.7), b['write2'], 0.85)
                _add(tr, s_('sub', dur=0.95), b['write2'], 0.6)
            for key in ('msg1', 'msg2', 'msg3'):
                if key in b and b[key] < duration: _add(tr, s_('tick', freq=1650), b[key], 0.5)
            if 'viral' in b:
                _add(tr, s_('riser', dur=0.8), b['viral'] - 0.8, 0.5)
                _add(tr, s_('impact', dur=0.75), b['viral'] + 0.16, 0.9)
                _add(tr, s_('sparkle', dur=0.8), b['viral'] + 0.16, 0.6)
            if 'lockup' in b:
                _add(tr, s_('impact', dur=0.8), b['lockup'] + 0.06, 0.9)
                _add(tr, s_('sub', dur=1.1), b['lockup'] + 0.06, 0.7)

    if ambient:
        tr += _ambient(len(tr), scenes, seed)
    return tr[:int(duration * SR)]


def _ambient(n, scenes, seed):
    """Тихая подложка: низкий гул и воздух, чтобы тишина не была мёртвой."""
    t = np.arange(n, dtype=np.float32) / SR
    drone = (np.sin(2 * np.pi * 55 * t) * 0.5 + np.sin(2 * np.pi * 82.5 * t) * 0.3
             + np.sin(2 * np.pi * 110 * t) * 0.2).astype(np.float32)
    lfo = (0.6 + 0.4 * np.sin(2 * np.pi * 0.12 * t)).astype(np.float32)
    air = _noise(n, seed + 99)
    air = _lowpass(air, 900) * 0.0
    out = drone * lfo * 0.05
    # мягкий вход и выход
    f = int(SR * 1.2)
    out[:f] *= np.linspace(0, 1, f, dtype=np.float32)
    out[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
    return out


# ------------------------------------------------------------------ микс
def voice_envelope(words, n, sr=SR, attack=0.05, release=0.35):
    """1 там, где звучит голос — по этому конверту приглушаются эффекты."""
    env = np.zeros(n, dtype=np.float32)
    for w in words:
        a, b = int(w['s'] * sr), int(min(w['e'] + 0.06, n / sr) * sr)
        if a < n: env[a:min(b, n)] = 1.0
    # сглаживание, чтобы приглушение не щёлкало
    ka = max(1, int(sr * attack)); kr = max(1, int(sr * release))
    ker = np.concatenate([np.linspace(0, 1, ka), np.linspace(1, 0, kr)]).astype(np.float32)
    ker /= ker.sum()
    return np.clip(np.convolve(env, ker, mode='same'), 0, 1).astype(np.float32)


def mix(voice, track, words, level=0.55, duck=0.45):
    """Голос + эффекты с приглушением эффектов под речь и мягким лимитером."""
    n = min(len(voice), len(track))
    voice, track = voice[:n], track[:n]
    env = voice_envelope(words, n)
    gain = (1.0 - duck * env).astype(np.float32)
    peak = float(np.abs(track).max()) or 1.0
    out = voice + track * (gain * level / peak)
    m = float(np.abs(out).max())
    if m > 0.97:                                  # мягкий лимитер, без клиппинга
        out = np.tanh(out * (0.97 / m) * 1.05) * 0.97
    return out.astype(np.float32)
