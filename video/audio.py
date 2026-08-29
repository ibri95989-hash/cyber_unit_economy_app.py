# -*- coding: utf-8 -*-
"""
audio.py — процедурный саунд-дизайн для ролика (35,2 c, 44.1 кГц, стерео).
Всё синтезируется кодом: суб-бас, удары, whoosh-переходы, тиканье
с замедлением, ризер и финальный пэд. Сторонние музыкальные файлы
не используются — вопросов по правам нет.

Это подложка под дикторскую озвучку, поэтому середина спектра нарочно
разрежена: акценты стоят на стыках сцен и в ключевых точках анимации,
а в паузах между фразами дорожка не мешает голосу.

Запуск:  python3 audio.py out/audio.wav
"""
import math
import random
import struct
import sys
import wave
from array import array

SR = 44100
DUR = 35.2
N = int(SR * DUR)

L = [0.0] * N
R = [0.0] * N

RND = random.Random(20260828)


# ----------------------------------------------------------------- helpers
def add(buf_l, buf_r, start_t, mono, gain=1.0, pan=0.0):
    """Подмешать моно-сегмент в стерео-шину. pan: -1 левее, +1 правее."""
    i0 = int(start_t * SR)
    gl = gain * math.sqrt(max(0.0, (1.0 - pan) * 0.5)) * 1.4142
    gr = gain * math.sqrt(max(0.0, (1.0 + pan) * 0.5)) * 1.4142
    for k, v in enumerate(mono):
        i = i0 + k
        if 0 <= i < N:
            buf_l[i] += v * gl
            buf_r[i] += v * gr


def env_exp(n, tau, attack=0.004):
    """Перкуссионная огибающая: быстрый вход, экспоненциальный спад."""
    a = max(1, int(attack * SR))
    out = []
    for i in range(n):
        e = (i / a) if i < a else math.exp(-(i - a) / (tau * SR))
        out.append(e)
    return out


def lowpass(sig, cutoff_start, cutoff_end=None):
    """Однополюсный ФНЧ с разверткой частоты среза."""
    if cutoff_end is None:
        cutoff_end = cutoff_start
    y = 0.0
    out = []
    n = len(sig)
    for i, x in enumerate(sig):
        fc = cutoff_start + (cutoff_end - cutoff_start) * (i / max(1, n - 1))
        a = 1.0 - math.exp(-2.0 * math.pi * fc / SR)
        y += a * (x - y)
        out.append(y)
    return out


def highpass(sig, cutoff):
    y = 0.0
    out = []
    a = 1.0 - math.exp(-2.0 * math.pi * cutoff / SR)
    for x in sig:
        y += a * (x - y)
        out.append(x - y)
    return out


def noise(n):
    return [RND.uniform(-1.0, 1.0) for _ in range(n)]


def sweep(dur, f0, f1, tau, curve=2.0, shape='sine'):
    """Тональный свип с перкуссионной огибающей."""
    n = int(dur * SR)
    e = env_exp(n, tau)
    out = []
    ph = 0.0
    for i in range(n):
        k = i / max(1, n - 1)
        f = f0 + (f1 - f0) * (k ** curve)
        ph += 2 * math.pi * f / SR
        if shape == 'sine':
            v = math.sin(ph)
        elif shape == 'tri':
            v = 2 / math.pi * math.asin(math.sin(ph))
        else:  # saw
            v = 2 * ((ph / (2 * math.pi)) % 1.0) - 1
        out.append(v * e[i])
    return out


def tone(dur, freq, tau=None, sustain=False, shape='sine', detune=0.0):
    n = int(dur * SR)
    out = []
    ph = 0.0
    ph2 = 0.0
    for i in range(n):
        ph += 2 * math.pi * freq / SR
        ph2 += 2 * math.pi * (freq * (1 + detune)) / SR
        if shape == 'saw':
            v = (2 * ((ph / (2 * math.pi)) % 1.0) - 1)
            if detune:
                v = 0.6 * v + 0.4 * (2 * ((ph2 / (2 * math.pi)) % 1.0) - 1)
        else:
            v = math.sin(ph)
            if detune:
                v = 0.6 * v + 0.4 * math.sin(ph2)
        out.append(v)
    if not sustain:
        e = env_exp(n, tau if tau else dur / 4)
        out = [v * e[i] for i, v in enumerate(out)]
    return out


def ramp_env(n, attack, release):
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    out = []
    for i in range(n):
        if i < a:
            e = i / a
        elif i > n - r:
            e = (n - i) / r
        else:
            e = 1.0
        out.append(e * e * (3 - 2 * e))
    return out


# ----------------------------------------------------------------- элементы
def boom(t, gain=1.0, pan=0.0, f0=150, f1=38, tau=0.55):
    """Низкочастотный удар."""
    s = sweep(1.2, f0, f1, tau, curve=1.6)
    # добавляем «щелчок» атаки
    cl = lowpass(noise(int(0.05 * SR)), 3000, 300)
    e = env_exp(len(cl), 0.012)
    cl = [v * e[i] * 0.5 for i, v in enumerate(cl)]
    add(L, R, t, s, gain, pan)
    add(L, R, t, cl, gain * 0.5, pan)


def whoosh(t, dur=0.5, gain=0.5, direction=1, pan=0.0):
    """Переходный whoosh: шум со сверткой полосы."""
    n = int(dur * SR)
    nz = noise(n)
    if direction > 0:
        nz = lowpass(nz, 500, 7000)
    else:
        nz = lowpass(nz, 7000, 500)
    nz = highpass(nz, 220)
    e = ramp_env(n, dur * 0.45, dur * 0.5)
    # лёгкая панорама-развёртка
    for i in range(n):
        nz[i] *= e[i]
    add(L, R, t, nz, gain, pan)


def tick(t, gain=0.35, freq=2100, pan=0.0, tau=0.02):
    n = int(0.09 * SR)
    e = env_exp(n, tau, attack=0.0008)
    s = [math.sin(2 * math.pi * freq * i / SR) * e[i] for i in range(n)]
    nz = lowpass(noise(n), 6000, 2000)
    s = [s[i] * 0.7 + nz[i] * e[i] * 0.3 for i in range(n)]
    add(L, R, t, s, gain, pan)


def blip(t, freq, dur=0.11, gain=0.3, pan=0.0):
    n = int(dur * SR)
    e = env_exp(n, dur / 3.2, attack=0.002)
    s = [(math.sin(2 * math.pi * freq * i / SR) * 0.75 +
          math.sin(4 * math.pi * freq * i / SR) * 0.25) * e[i] for i in range(n)]
    add(L, R, t, s, gain, pan)


def drone(t0, dur, freq, gain=0.22, detune=0.006, pan=0.0):
    n = int(dur * SR)
    e = ramp_env(n, 0.6, 0.8)
    out = []
    ph1 = ph2 = ph3 = 0.0
    for i in range(n):
        lfo = 1.0 + 0.0015 * math.sin(2 * math.pi * 0.13 * i / SR)
        ph1 += 2 * math.pi * freq * lfo / SR
        ph2 += 2 * math.pi * freq * (1 + detune) / SR
        ph3 += 2 * math.pi * freq * 2 / SR
        v = math.sin(ph1) * 0.6 + math.sin(ph2) * 0.3 + math.sin(ph3) * 0.12
        out.append(v * e[i])
    add(L, R, t0, out, gain, pan)


def pad(t0, dur, freqs, gain=0.12, pan=0.0):
    n = int(dur * SR)
    e = ramp_env(n, 0.5, 1.2)
    out = [0.0] * n
    for fi, f in enumerate(freqs):
        ph = 0.0
        d = 1 + 0.004 * (fi - len(freqs) / 2)
        for i in range(n):
            ph += 2 * math.pi * f * d / SR
            out[i] += math.sin(ph)
    k = 1.0 / len(freqs)
    out = [v * k * e[i] for i, v in enumerate(out)]
    out = lowpass(out, 1800)
    add(L, R, t0, out, gain, pan)


def riser(t0, dur, gain=0.3):
    """Нарастающее напряжение: шум + поднимающийся тон."""
    n = int(dur * SR)
    nz = lowpass(noise(n), 300, 6500)
    ph = 0.0
    out = []
    for i in range(n):
        k = i / n
        f = 180 * math.pow(2, k * 2.4)
        ph += 2 * math.pi * f / SR
        e = k ** 2.1
        out.append((math.sin(ph) * 0.45 + nz[i] * 0.55) * e)
    add(L, R, t0, out, gain, 0.0)


# ----------------------------------------------------------------- партитура
# Стыки сцен — они же паузы между фразами озвучки.
BOUNDS = [4.58, 7.07, 13.55, 18.83, 22.87, 28.78]

# 1. непрерывный суб-бас, меняющий высоту по сценам
drone(0.00, 4.80, 55.00, 0.26)           # A1  — хук
drone(4.58, 2.75, 58.27, 0.24)           # Bb1 — дата
drone(7.07, 6.75, 55.00, 0.26)           # A1  — поток
drone(13.55, 5.55, 58.27, 0.24)          # Bb1 — вопрос
drone(18.83, 4.30, 61.74, 0.24)          # B1  — сплит
drone(22.87, 6.20, 51.91, 0.30)          # Ab1 — напряжение
drone(28.78, 6.42, 55.00, 0.24)          # A1  — финал

# 2. удары и whoosh на стыках
boom(0.02, 1.00, f0=190, f1=40, tau=0.62)
for i, b in enumerate(BOUNDS):
    boom(b - 0.01, 0.85 + 0.04 * i, f0=170, f1=38, tau=0.5)
    whoosh(b - 0.26, 0.46, 0.40, direction=1, pan=(-0.5 if i % 2 else 0.5))
    whoosh(b - 0.02, 0.34, 0.28, direction=-1, pan=(0.5 if i % 2 else -0.5))

# 3. HOOK 0–4.58: блипы уведомления, сердцебиение, глитч-шум под вспышки в кадре
blip(0.10, 1180, 0.10, 0.24)
blip(0.24, 880, 0.14, 0.20)
for gt in (0.90, 2.35, 3.75):            # совпадает с глитчами на экране
    n = int(0.13 * SR)
    nz = highpass(noise(n), 900)
    e = env_exp(n, 0.05, attack=0.001)
    add(L, R, gt, [nz[i] * e[i] for i in range(n)], 0.26, 0.0)
for i in range(6):
    boom(0.30 + i * 0.72, 0.26, f0=95, f1=45, tau=0.16)

# 4. ДАТА 4.58–7.07: удар «стоп» ровно на красной линии в кадре
boom(6.00, 0.95, f0=220, f1=44, tau=0.4)
whoosh(5.88, 0.24, 0.32, direction=1)
blip(6.02, 320, 0.30, 0.26)

# 5. ПОТОК 7.07–13.55: ритм вязнет, затор отмечен глухим ударом
t = 7.20
step = 0.25
while t < 12.9:
    k = (t - 7.20) / 5.7
    tick(t, 0.18 * (1 - 0.6 * k), 2400 - 700 * k,
         pan=(-0.35 if int(t / step) % 2 else 0.35))
    t += step + 0.10 * k                 # шаг растёт — поток замедляется
boom(9.20, 0.42, f0=120, f1=42, tau=0.3)   # монеты упираются в барьер

# 6. ВОПРОС 13.55–18.83: ровный пульс, акцент на выезде вопроса
for i in range(8):
    boom(13.55 + i * 0.62, 0.30, f0=110, f1=44, tau=0.2)
boom(15.17, 0.55, f0=150, f1=40, tau=0.34)  # вопрос выбивается на экран
blip(15.20, 660, 0.18, 0.20, -0.3)
blip(15.42, 990, 0.30, 0.20, 0.3)

# 7. СПЛИТ 18.83–22.87: слева редкий «ожидающий» пульс, справа быстрый поток
for i in range(7):
    tick(18.90 + i * 0.55, 0.15, 1250, pan=-0.75, tau=0.05)
arp = [440.0, 523.25, 659.25, 880.0]
for i in range(16):
    blip(18.95 + i * 0.24, arp[i % 4] * (2 if (i // 4) % 2 else 1), 0.09, 0.10, 0.75)

# 8. НАПРЯЖЕНИЕ 22.87–28.78: ризер, часы замедляются, суб-дроп на замирании
riser(22.87, 2.70, 0.32)
tt, gap = 22.95, 0.20
while tt < 25.55:
    tick(tt, 0.28, 2600, pan=0.0, tau=0.035)
    gap *= 1.22
    tt += gap
boom(25.62, 1.15, f0=240, f1=32, tau=1.0)   # кадр замирает
n = int(0.5 * SR)
nz = lowpass(noise(n), 4000, 200)
e = env_exp(n, 0.22, attack=0.002)
add(L, R, 25.62, [nz[i] * e[i] for i in range(n)], 0.26, 0.0)
pad(25.80, 2.60, [103.83, 123.47, 155.56], 0.09)

# 9. ФИНАЛ 28.78–35.20: пэд, акцент на выезде CTA, пульс под стрелками
pad(28.78, 6.42, [110.0, 130.81, 164.81, 220.0], 0.15)
pad(28.78, 6.42, [329.63, 415.30], 0.045)
boom(28.78, 1.00, f0=200, f1=40, tau=0.7)
for i in range(5):
    blip(28.95 + i * 0.30, [880, 1174, 1318, 1760, 1318][i], 0.13, 0.09, -0.5 + 0.25 * i)
blip(30.55, 1568, 0.50, 0.22, 0.0)          # «динь» на появлении CTA
boom(30.55, 0.50, f0=140, f1=46, tau=0.3)
for i in range(6):
    boom(31.20 + i * 0.62, 0.20, f0=95, f1=44, tau=0.16)


# ----------------------------------------------------------------- мастеринг
def master(buf):
    # мягкое насыщение + общий фейд
    out = array('h')
    fi = int(0.05 * SR)
    fo = int(0.35 * SR)
    for i, v in enumerate(buf):
        g = 1.0
        if i < fi:
            g *= i / fi
        if i > N - fo:
            g *= (N - i) / fo
        x = v * 0.62 * g
        x = math.tanh(x * 1.25) * 0.9      # лимитер
        out.append(int(max(-32767, min(32767, x * 32767))))
    return out


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else 'out/audio.wav'
    ml, mr = master(L), master(R)
    frames = array('h')
    for i in range(N):
        frames.append(ml[i])
        frames.append(mr[i])
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames.tobytes())
    peak = max(max(ml), abs(min(ml)), max(mr), abs(min(mr))) / 32767.0
    print(f'записано {path}: {DUR:.1f} c, пик {peak:.2f}')


if __name__ == '__main__':
    main()
