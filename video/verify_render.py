#!/usr/bin/env python3
"""Sanity-check a rendered .mp4 against its timeline config before calling
the build done. Catches the failure modes actually seen while building this
pipeline: a truncated encode, silent audio, or a duration that drifted from
what the scene timeline was rendered for (usually a sign the wrong config
or audio file was passed to capture*.mjs).
"""
import argparse, json, subprocess, sys


def ffprobe():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def probe(path):
    out = subprocess.run([ffprobe(), '-hide_banner', '-i', path], capture_output=True, text=True).stderr
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('config')
    ap.add_argument('--tolerance', type=float, default=0.15, help='allowed duration drift, seconds')
    args = ap.parse_args()

    cfg = json.load(open(args.config, encoding='utf-8'))
    expected = cfg.get('dur') or cfg.get('duration')
    if expected is None:
        print('config has no dur/duration field - nothing to check against', file=sys.stderr)
        sys.exit(2)

    info = probe(args.video)
    problems = []

    import re
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', info)
    if not m:
        problems.append('could not read a Duration from ffprobe output - file may be broken')
    else:
        h, mi, s = m.groups()
        actual = int(h) * 3600 + int(mi) * 60 + float(s)
        drift = abs(actual - expected)
        if drift > args.tolerance:
            problems.append(f'duration drift {drift:.2f}s (expected {expected:.2f}s, got {actual:.2f}s)')

    if 'Video:' not in info:
        problems.append('no video stream found')
    if 'Audio:' not in info:
        problems.append('no audio stream found')
    if not re.search(r'Video:.*yuv420p', info):
        problems.append('video is not yuv420p - may not play on some phones/apps')

    if problems:
        print(f'VERIFY FAILED: {args.video}', file=sys.stderr)
        for p in problems:
            print(f'  - {p}', file=sys.stderr)
        sys.exit(1)

    print(f'verify OK: {args.video} matches {args.config} ({expected:.2f}s)')


if __name__ == '__main__':
    main()
