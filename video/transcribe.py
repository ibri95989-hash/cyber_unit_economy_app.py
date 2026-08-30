#!/usr/bin/env python3
"""Transcribe the voice-over with word-level timestamps.

Writes build/words.json: every word with its start/end in seconds, plus the
phrase segmentation Whisper produced. The scene timeline is then pinned to
these times instead of being stretched proportionally.
"""
import argparse, json, os, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio')
    ap.add_argument('-o', '--out', default='build/words.json')
    ap.add_argument('--model', default='small')
    ap.add_argument('--lang', default='ru')
    a = ap.parse_args()

    from faster_whisper import WhisperModel
    model = WhisperModel(a.model, device='cpu', compute_type='int8')
    segments, info = model.transcribe(a.audio, language=a.lang, word_timestamps=True,
                                      vad_filter=True, beam_size=5)
    segs, words = [], []
    for s in segments:
        segs.append({'start': round(s.start, 3), 'end': round(s.end, 3), 'text': s.text.strip()})
        for w in (s.words or []):
            words.append({'w': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3)})
        print(f'[{s.start:7.2f} - {s.end:7.2f}] {s.text.strip()}', flush=True)
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    json.dump({'duration': round(info.duration, 3), 'segments': segs, 'words': words},
              open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\n{len(words)} words -> {a.out}')

if __name__ == '__main__':
    main()
