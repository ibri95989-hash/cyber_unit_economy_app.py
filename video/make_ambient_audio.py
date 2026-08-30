#!/usr/bin/env python3
"""Procedural ambient bed for a video that has no voice-over yet: a soft
drone plus a tick on every caption line and a whoosh on every scene cut.
Everything is synthesized from scratch with ffmpeg's own oscillators/noise
sources in a single filter graph - no sampled/licensed sound library
involved (see NEXT_VIDEO.md's SFX plan). This is a placeholder bed, not
narration - swap it out once a real voice-over exists.
"""
import argparse, json, subprocess, sys


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('captions', help='captions.json - reads dur + card starts for ticks')
    ap.add_argument('-o', '--out', default='build/ambient.wav')
    ap.add_argument('--cuts', default='', help='comma separated scene-cut seconds for whooshes')
    args = ap.parse_args()

    cfg = json.load(open(args.captions, encoding='utf-8'))
    dur = cfg['dur']
    ticks = [c['start'] for c in cfg['cards']]
    cuts = [float(x) for x in args.cuts.split(',') if x.strip()]
    SR = 48000

    inputs = []
    filters = []
    mix_labels = []

    def add_input(src):
        inputs.extend(['-f', 'lavfi', '-i', src])
        return len(inputs) // 4 - 1   # index of this -i among all inputs, 0-based

    # drone: two detuned low sines, slow tremolo, gentle lowpass
    i0 = add_input(f'sine=f=55:d={dur}:sample_rate={SR}')
    i1 = add_input(f'sine=f=82.5:d={dur}:sample_rate={SR}')
    filters.append(f'[{i0}:a]volume=0.5[dr0]')
    filters.append(f'[{i1}:a][dr0]amix=inputs=2:weights=0.7 1,'
                    f'tremolo=f=0.12:d=0.35,lowpass=f=340,volume=0.18[drone]')
    mix_labels.append('[drone]')

    # one short tick per caption line
    for k, t in enumerate(ticks):
        idx = add_input(f'sine=f=1200:d=0.08:sample_rate={SR}')
        ms = int(round(t * 1000))
        filters.append(f'[{idx}:a]afade=t=out:st=0.02:d=0.05,bandpass=f=1200:width_type=h:w=600,'
                        f'volume=0.10,adelay={ms}|{ms}[tk{k}]')
        mix_labels.append(f'[tk{k}]')

    # one whoosh (filtered noise burst) per scene cut
    for k, t in enumerate(cuts):
        idx = add_input(f'anoisesrc=d=0.34:c=pink:r={SR}')
        ms = int(round(t * 1000))
        filters.append(f'[{idx}:a]afade=t=in:st=0:d=0.09,afade=t=out:st=0.15:d=0.19,'
                        f'bandpass=f=1500:width_type=h:w=2200,volume=0.13,'
                        f'adelay={ms}|{ms}[wh{k}]')
        mix_labels.append(f'[wh{k}]')

    filters.append(f'{"".join(mix_labels)}amix=inputs={len(mix_labels)}:normalize=0,'
                    f'alimiter=limit=0.9,volume=1.7[mixed]')

    cmd = [ffmpeg(), '-y', '-hide_banner', '-loglevel', 'error'] + inputs + [
        '-filter_complex', ';'.join(filters), '-map', '[mixed]',
        '-t', str(dur), '-ar', '48000', '-ac', '2', args.out,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        sys.exit(1)
    print(f'-> {args.out} ({dur:.2f}s, {len(ticks)} ticks, {len(cuts)} whooshes)')


if __name__ == '__main__':
    main()
