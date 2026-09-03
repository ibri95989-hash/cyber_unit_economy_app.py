import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLOR} from '../lib/theme';
import {rand} from '../lib/motion';

/**
 * Deterministic particle burst. Every particle's path is a closed-form function
 * of its index and the frame, so there is no simulation state to drift and two
 * renders are bit-identical.
 */
export const Burst: React.FC<{
  start: number;
  count?: number;
  x?: number;
  y?: number;
  spread?: number;
  life?: number;
  gravity?: number;
  size?: number;
  color?: string;
  seed?: number;
}> = ({
  start,
  count = 90,
  x = 540,
  y = 860,
  spread = 620,
  life = 46,
  gravity = 420,
  size = 4,
  color = COLOR.accent,
  seed = 3,
}) => {
  const frame = useCurrentFrame();
  const age = frame - start;
  if (age < 0 || age > life) return null;
  const p = age / life;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {new Array(count).fill(0).map((_, i) => {
        const a = rand(seed * 31 + i) * Math.PI * 2;
        const speed = 0.25 + rand(seed * 57 + i) * 0.75;
        const drag = 1 - Math.pow(1 - p, 3); // ease-out travel
        const px = x + Math.cos(a) * spread * speed * drag;
        const py = y + Math.sin(a) * spread * 0.6 * speed * drag + gravity * p * p;
        const s = size * (0.5 + rand(seed * 91 + i));
        const o = Math.min(1, p * 6) * Math.pow(1 - p, 1.6);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: s,
              height: s,
              borderRadius: s,
              background: i % 5 === 0 ? COLOR.accent2 : color,
              opacity: o,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Slow drifting dust. Gives the frame depth so flat panels don't feel pasted on.
 */
export const Dust: React.FC<{count?: number; seed?: number; opacity?: number}> = ({
  count = 46,
  seed = 9,
  opacity = 0.32,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      {new Array(count).fill(0).map((_, i) => {
        const sx = rand(seed + i) * 1080;
        const sy = rand(seed * 3 + i) * 1920;
        const sp = 0.12 + rand(seed * 7 + i) * 0.5;
        const y = (sy - frame * sp + 1920) % 1920;
        const x = sx + Math.sin((frame + i * 20) * 0.008) * 22;
        const s = 1.5 + rand(seed * 11 + i) * 2.5;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: s,
              height: s,
              borderRadius: s,
              background: '#fff',
              opacity: 0.25 + rand(seed * 13 + i) * 0.5,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
