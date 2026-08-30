# -*- coding: utf-8 -*-
"""Распознавание русской речи с пословными тайм-кодами (офлайн).

Модель: GigaAM v2 CTC (sherpa-onnx), нарезка на фразы — Silero VAD.
Работает без интернета после первой загрузки модели.
"""
import json, os, sys, wave
import numpy as np

MODEL = 'sherpa-onnx-nemo-ctc-giga-am-v2-russian-2025-04-19'
BASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models'


def cache_dir():
    d = os.environ.get('REELS_KIT_HOME') or os.path.join(
        os.path.expanduser('~'), '.cache', 'reels-kit')
    os.makedirs(d, exist_ok=True)
    return d


def ensure_model(quiet=False):
    """Скачивает модель распознавания при первом запуске (~170 МБ)."""
    import tarfile, urllib.request
    d = cache_dir()
    mdir = os.path.join(d, MODEL)
    vad = os.path.join(d, 'silero_vad.onnx')
    if not os.path.isdir(mdir):
        tgz = os.path.join(d, MODEL + '.tar.bz2')
        if not quiet: print('Скачиваю модель распознавания (~170 МБ, один раз)…', flush=True)
        urllib.request.urlretrieve(BASE + '/' + MODEL + '.tar.bz2', tgz)
        with tarfile.open(tgz) as tf: tf.extractall(d)
        os.remove(tgz)
    if not os.path.exists(vad):
        if not quiet: print('Скачиваю модель определения речи…', flush=True)
        urllib.request.urlretrieve(BASE + '/silero_vad.onnx', vad)
    return mdir, vad


def to_wav16k(src, dst, ffmpeg):
    import subprocess
    subprocess.run([ffmpeg, '-y', '-v', 'error', '-i', src,
                    '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', dst], check=True)
    return dst


def _read(path):
    with wave.open(path) as f:
        n = f.getnframes()
        a = np.frombuffer(f.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
        return a, f.getframerate()


def transcribe(wav16k, threads=4, quiet=False):
    """-> {'words':[{w,s,e}], 'text': str, 'duration': float}"""
    import sherpa_onnx
    mdir, vadpath = ensure_model(quiet)
    samples, sr = _read(wav16k)

    rec = sherpa_onnx.OfflineRecognizer.from_nemo_ctc(
        model=os.path.join(mdir, 'model.int8.onnx'),
        tokens=os.path.join(mdir, 'tokens.txt'),
        num_threads=threads, debug=False)

    cfg = sherpa_onnx.VadModelConfig()
    cfg.silero_vad.model = vadpath
    cfg.silero_vad.threshold = 0.4
    cfg.silero_vad.min_silence_duration = 0.20
    cfg.silero_vad.min_speech_duration = 0.15
    cfg.silero_vad.max_speech_duration = 12
    cfg.sample_rate = 16000
    vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=60)

    # VAD отдаёт только границы фраз; звук режем из исходного массива —
    # так надёжнее, чем читать буфер детектора.
    spans, i, win = [], 0, 512
    while i < len(samples):
        vad.accept_waveform(samples[i:i + win]); i += win
        while not vad.empty():
            sg = vad.front; vad.pop()
            spans.append((sg.start / sr, (sg.start + len(sg.samples)) / sr))
    vad.flush()
    while not vad.empty():
        sg = vad.front; vad.pop()
        spans.append((sg.start / sr, (sg.start + len(sg.samples)) / sr))
    if not spans:
        spans = [(0.0, len(samples) / sr)]

    words, texts = [], []
    for a, b in spans:
        a = max(0.0, a - 0.06); b = min(len(samples) / sr, b + 0.10)
        chunk = np.ascontiguousarray(samples[int(a * sr):int(b * sr)])
        if len(chunk) < sr * 0.12: continue
        st = rec.create_stream(); st.accept_waveform(16000, chunk); rec.decode_stream(st)
        r = st.result
        if not r.text.strip(): continue
        texts.append(r.text.strip())
        cur, curs, lastt = '', None, None
        for tok, ts in zip(list(r.tokens), list(r.timestamps)):
            if tok.strip() == '':
                if cur:
                    words.append({'w': cur, 's': round(curs + a, 3), 'e': round(lastt + a + 0.06, 3)})
                cur, curs = '', None
                continue
            if curs is None: curs = ts
            cur += tok; lastt = ts
        if cur:
            words.append({'w': cur, 's': round(curs + a, 3), 'e': round(lastt + a + 0.12, 3)})
        if not quiet:
            print('  [%6.2f–%6.2f] %s' % (a, b, r.text.strip()), flush=True)

    words.sort(key=lambda w: w['s'])
    return {'words': words, 'text': ' '.join(texts),
            'duration': round(len(samples) / sr, 3)}


def main():
    import argparse
    from .ffmpeg import ffmpeg_exe
    ap = argparse.ArgumentParser(description='Распознавание озвучки с тайм-кодами слов')
    ap.add_argument('audio'); ap.add_argument('-o', '--out', default='transcript.json')
    a = ap.parse_args()
    tmp = a.out + '.16k.wav'
    to_wav16k(a.audio, tmp, ffmpeg_exe())
    tr = transcribe(tmp)
    os.remove(tmp)
    json.dump(tr, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('слов: %d -> %s' % (len(tr['words']), a.out))


if __name__ == '__main__':
    main()
