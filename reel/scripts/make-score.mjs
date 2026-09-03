// Synthesises the score bed (drone, pad, cut impacts, whooshes, showreel pulse,
// riser) as a WAV. Fully deterministic, so re-running gives the same audio.
//
//   node scripts/make-score.mjs /tmp/score.wav
//   npx remotion ffmpeg -i /tmp/score.wav -c:a libmp3lame -b:a 192k -y public/score.mp3

import fs from 'node:fs';

const SR = 44100;
const DUR = 60.2;
const N = Math.floor(SR * DUR);
const L = new Float64Array(N);
const R = new Float64Array(N);

// Deterministic noise so every render of the score is identical.
let seed = 0x2f6e2b1;
const rnd = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return (seed / 0xffffffff) * 2 - 1;
};

const add = (i, l, r) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };

// ---- Low drone: root + fifth, slowly breathing. Sits under everything. ----
const droneFreqs = [41.2, 61.7, 82.4, 123.5];
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const breathe = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.045 * t);
  const fade = Math.min(1, t / 2.5) * Math.min(1, Math.max(0, (DUR - 1.0 - t) / 2.0));
  let v = 0;
  for (let k = 0; k < droneFreqs.length; k++) {
    const f = droneFreqs[k];
    const amp = [0.55, 0.3, 0.18, 0.08][k];
    v += amp * Math.sin(2 * Math.PI * f * t + k * 0.7);
  }
  v *= 0.055 * fade * (0.7 + 0.3 * breathe);
  // Slight stereo spread from a detuned twin.
  const v2 = 0.045 * fade * (0.7 + 0.3 * breathe) * Math.sin(2 * Math.PI * 41.5 * t);
  add(i, v + v2 * 0.5, v - v2 * 0.5);
}

// ---- Airy pad, very quiet, gives the bed some height. ----
const padFreqs = [329.6, 493.9, 659.3];
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 4) * Math.min(1, Math.max(0, (DUR - 1.5 - t) / 3));
  let v = 0;
  for (let k = 0; k < padFreqs.length; k++) {
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * (0.07 + k * 0.013) * t + k);
    v += Math.sin(2 * Math.PI * padFreqs[k] * t) * lfo * [0.5, 0.32, 0.2][k];
  }
  v *= 0.012 * fade;
  add(i, v, v * 0.85);
}

// ---- Sub impact: pitch-dropping sine with a short click. ----
const impact = (tSec, gain = 1, decay = 0.55) => {
  const start = Math.floor(tSec * SR);
  const len = Math.floor(decay * 2.2 * SR);
  let phase = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const env = Math.exp(-t / decay);
    const f = 42 + 78 * Math.exp(-t / 0.07);
    phase += (2 * Math.PI * f) / SR;
    let v = Math.sin(phase) * env * 0.5 * gain;
    if (t < 0.006) v += rnd() * 0.22 * gain * (1 - t / 0.006);
    add(start + n, v, v);
  }
};

// ---- Whoosh: filtered noise swelling into the cut. ----
const whoosh = (tSec, dur = 0.7, gain = 1, pan = 0) => {
  const start = Math.floor((tSec - dur * 0.8) * SR);
  const len = Math.floor(dur * SR);
  let lp = 0, hp = 0, prev = 0;
  for (let n = 0; n < len; n++) {
    const p = n / len;
    const env = Math.pow(Math.sin(Math.PI * p), 1.7);
    const a = 0.02 + 0.5 * p;              // opens up as it approaches the cut
    const x = rnd();
    lp += a * (x - lp);
    hp = 0.92 * (hp + lp - prev);           // remove rumble so it stays airy
    prev = lp;
    const v = hp * env * 0.16 * gain;
    add(start + n, v * (1 - Math.max(0, pan)), v * (1 + Math.min(0, pan)));
  }
};

// ---- Riser: noise + rising tone into the final reveal. ----
const riser = (tSec, dur, gain = 1) => {
  const start = Math.floor(tSec * SR);
  const len = Math.floor(dur * SR);
  let lp = 0;
  let phase = 0;
  for (let n = 0; n < len; n++) {
    const p = n / len;
    const env = Math.pow(p, 2.2);
    lp += (0.05 + 0.35 * p) * (rnd() - lp);
    const f = 180 * Math.pow(2, p * 2.4);
    phase += (2 * Math.PI * f) / SR;
    const v = (lp * 0.55 + Math.sin(phase) * 0.18) * env * 0.13 * gain;
    add(start + n, v, v);
  }
};

// ---- Soft pulse for the showreel: muted kick + tick, 120 BPM. ----
const tick = (tSec, gain) => {
  const start = Math.floor(tSec * SR);
  const len = Math.floor(0.05 * SR);
  let hp = 0, prev = 0, lp = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const env = Math.exp(-t / 0.012);
    const x = rnd();
    lp += 0.7 * (x - lp);
    hp = 0.85 * (hp + lp - prev);
    prev = lp;
    const v = hp * env * 0.05 * gain;
    add(start + n, v * 0.8, v);
  }
};

const CUTS = [0, 9.0, 13.4, 20.6, 26.8, 32.1, 35.1, 40.2, 51.0, 56.0];
CUTS.forEach((t, i) => {
  impact(t, i === 0 ? 1.15 : i === 9 ? 1.35 : 0.8, i === 9 ? 1.1 : 0.5);
  if (i > 0) whoosh(t, 0.75, i === 9 ? 1.2 : 0.85, i % 2 ? 0.35 : -0.35);
});

// Showreel: fast visual cuts every 1.2s ride a 120 BPM pulse.
for (let t = 40.2; t < 51.0; t += 0.5) {
  const beat = Math.round((t - 40.2) / 0.5);
  impact(t, beat % 2 === 0 ? 0.42 : 0.2, 0.22);
  tick(t + 0.25, 0.9);
}
for (let t = 41.4; t < 51.0; t += 1.2) whoosh(t, 0.42, 0.6, ((t * 7) % 2) - 1);

riser(54.4, 1.6, 1.0);

// Philosophy beat breathes: pull the bed down, then let the final land.
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let duck = 1;
  if (t > 51.0 && t < 55.9) duck = 0.55;
  if (t >= 55.9) duck = 1.0;
  L[i] *= duck;
  R[i] *= duck;
}

// ---- Normalise with a soft limiter, then write a 16-bit WAV. ----
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const target = 0.5 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);

const soft = (v) => Math.tanh(v * target * 1.6) * 0.62;
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(soft(L[i]) * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(soft(R[i]) * 32767))), 44 + i * 4 + 2);
}
fs.writeFileSync(process.argv[2], buf);
console.log(`score written: ${(N / SR).toFixed(2)}s, raw peak ${peak.toFixed(3)}`);
