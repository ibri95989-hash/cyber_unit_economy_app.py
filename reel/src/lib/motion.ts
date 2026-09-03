import {interpolate, Easing} from 'remotion';

/**
 * Motion curves. Entrances decelerate hard (expo-out), exits accelerate away,
 * and anything that reverses uses inOut so it never snaps.
 */
export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  outSoft: Easing.bezier(0.22, 1, 0.36, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  linear: Easing.linear,
} as const;

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0 → 1 over [start, start+duration), eased. */
export const ramp = (
  frame: number,
  start: number,
  duration: number,
  easing = EASE.out
) => interpolate(frame, [start, start + duration], [0, 1], {easing, ...CLAMP});

/** Eased interpolation across a keyframe list, with clamped ends. */
export const tween = (
  frame: number,
  range: readonly number[],
  out: readonly number[],
  easing = EASE.out
) => interpolate(frame, [...range], [...out], {easing, ...CLAMP});

/** Rises in, holds, falls out — for elements that appear and leave. */
export const pulse = (
  frame: number,
  start: number,
  inDur: number,
  hold: number,
  outDur: number
) =>
  interpolate(
    frame,
    [start, start + inDur, start + inDur + hold, start + inDur + hold + outDur],
    [0, 1, 1, 0],
    {easing: EASE.inOut, ...CLAMP}
  );

/**
 * Fake motion blur: blur radius follows how fast a value is changing, so fast
 * moves smear and settled elements stay perfectly sharp.
 */
export const velocityBlur = (
  frame: number,
  sample: (f: number) => number,
  scale = 0.18,
  max = 14
) => {
  const v = Math.abs(sample(frame + 0.5) - sample(frame - 0.5));
  return Math.min(max, v * scale);
};

/** Deterministic pseudo-random in [0,1) — never Math.random() in a render. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Deterministic value in [min,max). */
export const randRange = (seed: number, min: number, max: number) =>
  min + rand(seed) * (max - min);
