#!/usr/bin/env python3
"""Align a script to its voice-over without ASR.

Whisper/forced-alignment models are unreachable from this sandbox (their
hosts are blocked by the egress policy), so instead: ffmpeg's silencedetect
gives real pause timestamps in the audio, and the script is split into
caption "cards" (one clause/sentence each) and words in reading order. Each
word gets a weight = its character count; cumulative weight is mapped onto
the concatenation of speech-only intervals (silences skipped), then mapped
back to real audio time through those same intervals. A short pause after a
word slightly extends its on-screen hold, which happens to match how a
calm narrator actually paces short declarative sentences.

Produces build/captions.json:
  dur      - audio duration
  cards    - [{text, start, end, words:[{w,start,end}]}]
  segments - the raw speech (non-silence) intervals, for debugging
"""
import argparse, json, os, re, subprocess


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def duration(path):
    out = subprocess.run([ffmpeg(), '-hide_banner', '-i', path], capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', out)
    h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + float(s)


def speech_segments(path, noise='-38dB', d=0.20):
    out = subprocess.run([ffmpeg(), '-hide_banner', '-i', path, '-af',
                          f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    dur = duration(path)
    bounds = [0.0]
    for s, e in zip(starts, ends):
        bounds += [s, e]
    bounds.append(dur)
    segs = []
    for i in range(0, len(bounds), 2):
        a, b = bounds[i], bounds[i + 1]
        if b - a > 0.03:
            segs.append((round(a, 3), round(b, 3)))
    return segs, dur


def load_cards(script_path):
    """One card per line of the script file; blank lines are separators."""
    raw = open(script_path, encoding='utf-8').read()
    lines = [l.strip() for l in raw.splitlines() if l.strip()]
    cards = []
    for line in lines:
        words = line.split(' ')
        cards.append({'text': line, 'words_raw': words})
    return cards


def align(cards, segs, total_dur):
    all_words = []                       # flat (card_idx, word_idx, text)
    for ci, c in enumerate(cards):
        for wi, w in enumerate(c['words_raw']):
            all_words.append((ci, wi, w))

    weights = [max(2, len(re.sub(r'[^\w]', '', w, flags=re.U))) + 1.6 for _, _, w in all_words]
    total_w = sum(weights)
    speech_total = sum(b - a for a, b in segs)

    def speechtime_to_walltime(st):
        acc = 0.0
        for a, b in segs:
            span = b - a
            if st <= acc + span or (a, b) == segs[-1]:
                return a + max(0.0, min(span, st - acc))
            acc += span
        return segs[-1][1]

    cum = 0.0
    bounds = []                          # speech-time [start, end] per word
    for w in weights:
        st0 = cum
        cum += speech_total * (w / total_w)
        bounds.append((st0, cum))

    out_cards = [{'text': c['text'], 'words': []} for c in cards]
    for (ci, wi, w), (st0, st1) in zip(all_words, bounds):
        t0, t1 = speechtime_to_walltime(st0), speechtime_to_walltime(st1)
        out_cards[ci]['words'].append({'w': w, 'start': round(t0, 3), 'end': round(max(t0 + 0.06, t1), 3)})

    for c in out_cards:
        c['start'] = c['words'][0]['start']
        c['end'] = c['words'][-1]['end']
    # let each card hold until the next one starts (covers trailing pause / breath)
    for i in range(len(out_cards) - 1):
        gap = out_cards[i + 1]['start'] - out_cards[i]['end']
        if 0 < gap < 0.9:
            out_cards[i]['end'] = out_cards[i + 1]['start']
    out_cards[-1]['end'] = min(out_cards[-1]['end'] + 0.5, total_dur)
    return out_cards


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio')
    ap.add_argument('script')
    ap.add_argument('-o', '--out', default='build/captions.json')
    args = ap.parse_args()

    segs, dur = speech_segments(args.audio)
    cards = load_cards(args.script)
    out_cards = align(cards, segs, dur)

    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    json.dump({'dur': round(dur, 3), 'cards': out_cards, 'segments': segs},
              open(args.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print(f'audio {dur:.2f}s, {len(segs)} speech segments, {len(out_cards)} cards')
    for c in out_cards:
        print(f'[{c["start"]:6.2f} - {c["end"]:6.2f}] {c["text"]}')


if __name__ == '__main__':
    main()
