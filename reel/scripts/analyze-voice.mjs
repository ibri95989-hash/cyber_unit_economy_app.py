// Measures the voiceover: prints its speech runs (used to place the cuts in
// src/lib/timing.ts) and writes the per-frame loudness envelope that drives
// type and geometry.
//
// Decode first, then analyse:
//   npx remotion ffmpeg -i public/voiceover.mp3 -ac 1 -ar 16000 -c:a pcm_s16le /tmp/vo.wav
//   node scripts/analyze-voice.mjs /tmp/vo.wav src/lib/voiceEnvelope.json

import fs from 'node:fs';

const FPS = 30;
const SR = 16000;
const buf = fs.readFileSync(process.argv[2]);

// Locate the 'data' chunk of the WAV rather than assuming a 44-byte header.
let off = 12;
let dataOff = -1, dataLen = 0;
while (off + 8 <= buf.length) {
  const id = buf.toString('ascii', off, off + 4);
  const size = buf.readUInt32LE(off + 4);
  if (id === 'data') { dataOff = off + 8; dataLen = size; break; }
  off += 8 + size + (size % 2);
}
if (dataOff < 0) throw new Error('no data chunk');

const n = Math.min(dataLen, buf.length - dataOff) / 2;
const samplesPerFrame = SR / FPS;
const frames = Math.floor(n / samplesPerFrame);

const rms = [];
for (let f = 0; f < frames; f++) {
  let sum = 0;
  const start = Math.floor(f * samplesPerFrame);
  const end = Math.floor((f + 1) * samplesPerFrame);
  for (let i = start; i < end; i++) {
    const s = buf.readInt16LE(dataOff + i * 2) / 32768;
    sum += s * s;
  }
  rms.push(Math.sqrt(sum / (end - start)));
}

const peak = Math.max(...rms);
const norm = rms.map((v) => +(v / peak).toFixed(4));

// Speech runs: frames above a gate, with hysteresis and a minimum gap.
const gate = 0.055;
const minGapFrames = Math.round(0.26 * FPS);
const runs = [];
let cur = null;
let quiet = 0;
norm.forEach((v, i) => {
  if (v > gate) {
    if (!cur) cur = {start: i, end: i};
    cur.end = i;
    quiet = 0;
  } else if (cur) {
    quiet++;
    if (quiet >= minGapFrames) { runs.push(cur); cur = null; }
  }
});
if (cur) runs.push(cur);

const merged = runs.filter((r) => r.end - r.start >= 2);

console.log(`audio frames: ${frames} (${(frames / FPS).toFixed(2)}s), peak rms ${peak.toFixed(4)}`);
console.log(`speech runs: ${merged.length}`);
merged.forEach((r, i) => {
  console.log(
    `  r${String(i + 1).padStart(2)}  ${(r.start / FPS).toFixed(3)}s – ${((r.end + 1) / FPS).toFixed(3)}s   dur ${(((r.end + 1) - r.start) / FPS).toFixed(3)}s`
  );
});

fs.writeFileSync(process.argv[3], JSON.stringify(norm));
console.log(`\nwrote envelope: ${norm.length} frames`);
