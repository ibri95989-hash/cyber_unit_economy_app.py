import sherpa_onnx, numpy as np, wave, json
def read_wave(p):
    with wave.open(p) as f:
        n=f.getnframes(); d=f.readframes(n)
        return np.frombuffer(d,dtype=np.int16).astype(np.float32)/32768.0, f.getframerate()
samples,sr=read_wave("voice16k.wav")
rec = sherpa_onnx.OfflineRecognizer.from_nemo_ctc(
    model="sherpa-onnx-nemo-ctc-giga-am-v2-russian-2025-04-19/model.int8.onnx",
    tokens="sherpa-onnx-nemo-ctc-giga-am-v2-russian-2025-04-19/tokens.txt", num_threads=4)

def decode(a,b):
    chunk=np.ascontiguousarray(samples[int(a*sr):int(b*sr)])
    st=rec.create_stream(); st.accept_waveform(16000, chunk); rec.decode_stream(st); r=st.result
    words=[];cur="";curs=None;lastt=None
    for t,ts in zip(list(r.tokens),list(r.timestamps)):
        if t.strip()=="":
            if cur: words.append({"w":cur,"s":round(curs+a,3),"e":round(lastt+a+0.06,3)});cur="";curs=None
            continue
        if curs is None: curs=ts
        cur+=t; lastt=ts
    if cur: words.append({"w":cur,"s":round(curs+a,3),"e":round(lastt+a+0.12,3)})
    return {"start":a,"end":b,"text":r.text,"words":words}

d=json.load(open("transcript.json"))
d[0]=decode(0.05,3.85)
d[4]=decode(35.70,43.546)
for s in d: print(f"[{s['start']:6.2f}-{s['end']:6.2f}] {s['text']}")
print()
for s in (d[0],d[4]):
    print(' '.join(f"{w['w']}[{w['s']:.2f}-{w['e']:.2f}]" for w in s['words'])); print()
json.dump(d, open("transcript.json","w"), ensure_ascii=False, indent=1)
