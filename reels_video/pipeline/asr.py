import sherpa_onnx, numpy as np, wave, json

def read_wave(p):
    with wave.open(p) as f:
        n=f.getnframes(); d=f.readframes(n)
        a=np.frombuffer(d,dtype=np.int16).astype(np.float32)/32768.0
        return a, f.getframerate()

samples, sr = read_wave("voice16k.wav")
print("dur", len(samples)/sr)

rec = sherpa_onnx.OfflineRecognizer.from_nemo_ctc(
    model="sherpa-onnx-nemo-ctc-giga-am-v2-russian-2025-04-19/model.int8.onnx",
    tokens="sherpa-onnx-nemo-ctc-giga-am-v2-russian-2025-04-19/tokens.txt",
    num_threads=4, debug=False)

vcfg = sherpa_onnx.VadModelConfig()
vcfg.silero_vad.model="silero_vad.onnx"
vcfg.silero_vad.threshold=0.4
vcfg.silero_vad.min_silence_duration=0.20
vcfg.silero_vad.min_speech_duration=0.15
vcfg.silero_vad.max_speech_duration=12
vcfg.sample_rate=16000
vad = sherpa_onnx.VoiceActivityDetector(vcfg, buffer_size_in_seconds=60)

segments=[]
win=512
i=0
while i < len(samples):
    vad.accept_waveform(samples[i:i+win]); i+=win
    while not vad.empty():
        s=vad.front; vad.pop()
        segments.append((s.start/sr, np.array(s.samples,dtype=np.float32,copy=True)))
vad.flush()
while not vad.empty():
    s=vad.front; vad.pop(); segments.append((s.start/sr, np.array(s.samples,dtype=np.float32,copy=True)))

out=[]
for off, chunk in segments:
    st=rec.create_stream(); st.accept_waveform(16000, chunk); rec.decode_stream(st)
    r=st.result
    toks=list(r.tokens); tss=list(r.timestamps)
    words=[]; cur=""; curs=None; lastt=None
    for t,ts in zip(toks,tss):
        if t.strip()=="":
            if cur:
                words.append({"w":cur,"s":round(curs+off,3),"e":round(lastt+off+0.06,3)}); cur=""; curs=None
            continue
        if curs is None: curs=ts
        cur+=t; lastt=ts
    if cur: words.append({"w":cur,"s":round(curs+off,3),"e":round(off+len(chunk)/sr,3)})
    out.append({"start":round(off,3),"end":round(off+len(chunk)/sr,3),"text":r.text,"words":words})
    print(f"[{off:6.2f} - {off+len(chunk)/sr:6.2f}] {r.text}")

json.dump(out, open("transcript.json","w"), ensure_ascii=False, indent=1)
