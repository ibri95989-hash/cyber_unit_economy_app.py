import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLOR} from '../lib/theme';
import {rand} from '../lib/motion';

/**
 * Soft drifting light behind the content. Built from radial gradients rather
 * than blurred layers — same depth, a fraction of the render cost, and no
 * banding at 1080x1920.
 */
export const Aurora: React.FC<{
  intensity?: number;
  hueShift?: number;
  seed?: number;
}> = ({intensity = 1, hueShift = 0, seed = 1}) => {
  const frame = useCurrentFrame();
  const blobs = [
    {c: COLOR.accent, x: 22, y: 26, r: 58, sp: 0.0042, amp: 9},
    {c: COLOR.accent2, x: 78, y: 62, r: 62, sp: -0.0031, amp: 11},
    {c: COLOR.accent, x: 50, y: 92, r: 48, sp: 0.0025, amp: 7},
  ];
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {blobs.map((b, i) => {
        const p = frame * b.sp + rand(seed * 7 + i) * 6.28;
        const x = b.x + Math.sin(p) * b.amp + hueShift;
        const y = b.y + Math.cos(p * 0.83) * b.amp * 0.7;
        return (
          <AbsoluteFill
            key={i}
            style={{
              background: `radial-gradient(${b.r}% ${b.r * 0.8}% at ${x}% ${y}%, ${b.c} 0%, transparent 62%)`,
              opacity: 0.16 * intensity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Film grain. feTurbulence is reseeded per frame so the grain moves, but every
 * frame is a pure function of its index — re-rendering gives identical output.
 */
export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.055}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{opacity, mixBlendMode: 'overlay', pointerEvents: 'none'}}>
      <svg width="100%" height="100%">
        <filter id={`grain-${frame % 8}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves={2}
            seed={frame % 8}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${frame % 8})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.75}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(130% 88% at 50% 42%, transparent 38%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

/** Faint technical grid — reads as "workspace" without becoming decoration. */
export const Grid: React.FC<{opacity?: number; cell?: number; offset?: number}> = ({
  opacity = 0.5,
  cell = 90,
  offset = 0,
}) => (
  <AbsoluteFill
    style={{
      opacity,
      backgroundImage: `linear-gradient(${COLOR.lineSoft} 1px, transparent 1px), linear-gradient(90deg, ${COLOR.lineSoft} 1px, transparent 1px)`,
      backgroundSize: `${cell}px ${cell}px`,
      backgroundPosition: `${offset}px ${offset}px`,
    }}
  />
);

/** Background every scene sits on, so the whole film shares one ground. */
export const Stage: React.FC<{
  children?: React.ReactNode;
  aurora?: number;
  grid?: number;
  grain?: number;
  vignette?: number;
  seed?: number;
}> = ({children, aurora = 1, grid = 0, grain = 0.055, vignette = 0.75, seed = 1}) => (
  <AbsoluteFill style={{backgroundColor: COLOR.base, overflow: 'hidden'}}>
    {aurora > 0 ? <Aurora intensity={aurora} seed={seed} /> : null}
    {grid > 0 ? <Grid opacity={grid} /> : null}
    {children}
    {vignette > 0 ? <Vignette strength={vignette} /> : null}
    {grain > 0 ? <Grain opacity={grain} /> : null}
  </AbsoluteFill>
);
