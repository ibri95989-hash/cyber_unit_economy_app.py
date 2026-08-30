#!/usr/bin/env python3
"""Derive the video timeline from the voice-over.

Produces build/audio.json:
  dur   - audio duration in seconds
  env   - per-frame (60 fps) loudness envelope, 0..1, used for audio-reactive glow
  marks - 11 scene boundaries, scaled from the 60s storyboard to the real
          duration and nudged onto the nearest pause in the narration so that
          every cut lands between phrases.
"""
import argparse, array, json, math, os, re, subprocess, sys

STORYBOARD = [0.0, 3.0, 7.0, 10.0, 18.0, 25.0, 33.0, 40.0, 48.0, 54.5, 60.0]
FPS = 60


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def duration(path):
    out = subprocess.run([ffmpeg(), '-hide_banner', '-i', path], capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', out)
    h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + float(s)


def silences(path, noise='-40dB', d=0.30):
    out = subprocess.run([ffmpeg(), '-hide_banner', '-i', path, '-af',
                          f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    return list(zip(starts, ends))


def envelope(path, dur):
    sr = 8000
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr),
                          '-f', 's16le', '-'], capture_output=True).stdout
    a = array.array('h'); a.frombytes(raw[:len(raw) // 2 * 2])
    hop = sr // FPS
    env = []
    for i in range(0, max(0, len(a) - hop + 1), hop):
        s = 0
        for v in a[i:i + hop]:
            s += v * v
        env.append(math.sqrt(s / hop) / 32768.0)
    mx = max(env) if env else 1.0
    env = [min(1.0, e / (mx or 1)) for e in env]
    out, prev = [], 0.0
    for e in env:                      # fast attack, slow release
        prev = e if e > prev else prev * 0.86 + e * 0.14
        out.append(round(prev, 4))
    need = int(dur * FPS) + 2
    out += [0.0] * max(0, need - len(out))
    return out[:need]


def snap(marks, gaps, window=1.1):
    """Move each internal cut onto the middle of the nearest pause."""
    snapped = [marks[0]]
    for m in marks[1:-1]:
        best, bd = m, window
        for (s, e) in gaps:
            c = (s + e) / 2
            if abs(c - m) < bd:
                best, bd = c, abs(c - m)
        snapped.append(best)
        
    snapped.append(marks[-1])
    for i in range(1, len(snapped)):   # keep the sequence strictly increasing
        snapped[i] = max(snapped[i], snapped[i - 1] + 0.9)
    snapped[-1] = marks[-1]
    if snapped[-2] > snapped[-1] - 1.5:
        snapped[-2] = snapped[-1] - 1.5
    return [round(x, 3) for x in snapped]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio')
    ap.add_argument('-o', '--out', default='build/audio.json')
    ap.add_argument('--target', type=float, default=None,
                    help='force a video duration (s); audio is cut/faded to match')
    args = ap.parse_args()

    dur = duration(args.audio)
    total = args.target or dur
    gaps = silences(args.audio)
    marks = [t / STORYBOARD[-1] * total for t in STORYBOARD]
    marks = snap(marks, gaps)
    env = envelope(args.audio, total)

    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    json.dump({'dur': round(total, 3), 'audioDur': round(dur, 3), 'marks': marks, 'env': env},
              open(args.out, 'w'))
    print(f'audio {dur:.2f}s -> video {total:.2f}s')
    print('cuts:', ', '.join(f'{m:.2f}' for m in marks))


if __name__ == '__main__':
    main()
