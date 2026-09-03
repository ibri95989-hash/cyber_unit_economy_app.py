// Renders the finished 60.000s audio track: the score bed plus the three
// re-spaced voiceover parts, mixed exactly as src/Reel.tsx lays them out.
//
// Remotion's own audio pass is unavailable here (the project's CRF setting is
// rejected by audio-only codecs) and the bundled ffmpeg is a reduced build with
// no afade/atrim/volume filters, so the mix is assembled directly.
//
//   node scripts/build-mix.mjs <score.wav> <voiceover.wav> <out.wav>

import fs from 'node:fs';

const SR = 44100;
const FPS = 30;
const DURATION = 60.0;
const N = Math.round(SR * DURATION);

const readWav = (path) => {
  const buf = fs.readFileSync(path);
  let off = 12;
  let fmt = null;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      fmt = {channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12)};
    } else if (id === 'data') {
      dataOff = off + 8;
      dataLen = Math.min(size, buf.length - dataOff);
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (!fmt || dataOff < 0) throw new Error(`unreadable wav: ${path}`);
  if (fmt.rate !== SR) throw new Error(`${path}: expected ${SR} Hz, got ${fmt.rate}`);

  const frames = Math.floor(dataLen / (2 * fmt.channels));
  const L = new Float64Array(frames);
  const R = new Float64Array(frames);
  for (let i = 0; i < frames; i++) {
    const base = dataOff + i * 2 * fmt.channels;
    L[i] = buf.readInt16LE(base) / 32768;
    R[i] = fmt.channels > 1 ? buf.readInt16LE(base + 2) / 32768 : L[i];
  }
  return {L, R, frames};
};

const [, , scorePath, voPath, outPath] = process.argv;
const score = readWav(scorePath);
const vo = readWav(voPath);

const L = new Float64Array(N);
const R = new Float64Array(N);

const sec = (frame) => frame / FPS;

// --- Voiceover: three parts lifted from the take and re-spaced (see timing.ts).
const PARTS = [
  {at: sec(33), from: sec(0), to: sec(558)},
  {at: sec(630), from: sec(558), to: sec(1125)},
  {at: sec(1569), from: sec(1125), to: sec(1336)},
];
const VO_GAIN = 0.92;
const EDGE = Math.round(0.14 * SR); // short ramps so a cut can never click

for (const p of PARTS) {
  const start = Math.round(p.at * SR);
  const srcStart = Math.round(p.from * SR);
  const len = Math.round((p.to - p.from) * SR);
  for (let i = 0; i < len; i++) {
    const s = srcStart + i;
    const d = start + i;
    if (s >= vo.frames || d >= N) break;
    const edge = Math.min(1, i / EDGE, (len - i) / EDGE);
    L[d] += vo.L[s] * VO_GAIN * edge;
    R[d] += vo.R[s] * VO_GAIN * edge;
  }
}

// --- Score: sits under the voice, opens with the first impact, closes on the end.
const SCORE_GAIN = 0.62;
const fadeIn = Math.round(sec(14) * SR);
const fadeOutFrom = Math.round(sec(1770) * SR);
const fadeOutTo = Math.round(sec(1798) * SR);

for (let i = 0; i < N; i++) {
  if (i >= score.frames) break;
  let g = SCORE_GAIN;
  if (i < fadeIn) g *= i / fadeIn;
  if (i > fadeOutFrom) g *= Math.max(0, (fadeOutTo - i) / (fadeOutTo - fadeOutFrom));
  L[i] += score.L[i] * g;
  R[i] += score.R[i] * g;
}

// --- Soft ceiling: keeps the sum off the rails without pumping the voice.
const soft = (v) => (Math.abs(v) < 0.7 ? v : Math.sign(v) * (0.7 + Math.tanh((Math.abs(v) - 0.7) / 0.3) * 0.28));

let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = soft(L[i]);
  R[i] = soft(R[i]);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}

// The source voiceover is quiet; bring the finished mix up to broadcast level
// for social delivery. Scaling the whole mix keeps the voice-to-score balance.
const TARGET_PEAK = 0.89;
const gain = peak > 0 ? TARGET_PEAK / peak : 1;
for (let i = 0; i < N; i++) {
  L[i] *= gain;
  R[i] *= gain;
}
peak *= gain;

const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(L[i] * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * 32767), 44 + i * 4 + 2);
}
fs.writeFileSync(outPath, buf);
console.log(`mix: ${(N / SR).toFixed(3)}s, peak ${peak.toFixed(3)}`);
