#!/usr/bin/env python3
"""Build a captions.json timeline from script text ALONE, with no voice-over
to align to. Used only when there is no audio yet - timing is estimated from
a reading-speed rate calibrated against a real ElevenLabs take of a similar
calm narration (see build/captions.json from script_wb_leaks_profit.txt:
13.7 non-space chars/sec of actual speech, ~0.3-0.6s natural pause between
phrases). Whenever real audio exists, prefer analyze_captions.py instead -
this is a stand-in, not a substitute for real timing.
"""
import argparse, json, os, re

BASE_RATE = 13.7          # chars/sec, calibrated from real audio (see above)
BASE_GAP = 0.34            # seconds between phrases at normal pace
MIN_DWELL = 0.85           # a phrase never flashes by faster than this


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('script')
    ap.add_argument('-o', '--out', default='build/captions.json')
    ap.add_argument('--speed', type=float, default=1.0,
                    help='>1 = faster / snappier cut (e.g. 1.25 for "ускоренный монтаж")')
    ap.add_argument('--lead', type=float, default=0.4, help='seconds of black before the first line')
    args = ap.parse_args()

    rate = BASE_RATE * args.speed
    gap = BASE_GAP / args.speed

    lines = [l.strip() for l in open(args.script, encoding='utf-8').read().splitlines() if l.strip()]
    cards, t = [], args.lead
    for line in lines:
        words = line.split(' ')
        weights = [max(2, len(re.sub(r'[^\w]', '', w, flags=re.U))) + 1.6 for w in words]
        total_w = sum(weights)
        dwell = max(MIN_DWELL, total_w / rate)
        w_t, cur = [], t
        for w, wt in zip(words, weights):
            dur = dwell * (wt / total_w)
            w_t.append({'w': w, 'start': round(cur, 3), 'end': round(cur + dur, 3)})
            cur += dur
        cards.append({'text': line, 'start': round(t, 3), 'end': round(cur, 3), 'words': w_t})
        t = cur + gap

    dur = round(cards[-1]['end'] + 0.5, 3)
    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    json.dump({'dur': dur, 'cards': cards, 'segments': [], 'estimated': True},
              open(args.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print(f'estimated duration: {dur:.2f}s ({len(cards)} lines, speed x{args.speed})')
    for c in cards:
        print(f'[{c["start"]:6.2f} - {c["end"]:6.2f}] {c["text"]}')


if __name__ == '__main__':
    main()
