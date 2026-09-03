import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {AssembleWord} from '../components/Type';
import {Burst} from '../components/Particles';
import {COLOR, GRADIENT, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp, tween, rand} from '../lib/motion';
import {CUE, SCENE} from '../lib/timing';

const F = (abs: number) => abs - SCENE.final.from;
const LEN = SCENE.final.to - SCENE.final.from;

const TAG_A = F(CUE.taglineA);
const TAG_B = F(CUE.taglineB);

/** Fragments from the earlier scenes fly in and lock into the lockup. */
const Converge: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {new Array(22).fill(0).map((_, i) => {
        const t = ramp(frame, i * 0.8, 30, EASE.out);
        const a = rand(i) * Math.PI * 2;
        const dist = 420 + rand(i + 30) * 620;
        const x = 540 + Math.cos(a) * dist * (1 - t);
        const y = 830 + Math.sin(a) * dist * 0.8 * (1 - t);
        const s = 6 + rand(i + 60) * 16;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: s,
              height: 3,
              borderRadius: 3,
              background: i % 3 === 0 ? COLOR.accent : COLOR.line,
              opacity: (1 - t) * 0.9,
              filter: `blur(${(1 - t) * 3}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Final: React.FC = () => {
  const frame = useCurrentFrame();

  const nameIn = ramp(frame, 0, 22, EASE.out);
  const glow = ramp(frame, 4, 26, EASE.out);
  const disciplines = ramp(frame, 22, 22, EASE.out);
  const tagA = ramp(frame, TAG_A, 20, EASE.out);
  const tagB = ramp(frame, TAG_B, 20, EASE.out);

  // Freeze on the last beat, then a clean fade to black.
  const freeze = LEN - 26;
  const settle = tween(frame, [0, freeze], [1.05, 1.0], EASE.out);
  const fade = tween(frame, [LEN - 18, LEN - 2], [0, 1], EASE.inOut);

  return (
    <Stage aurora={0.9} grain={0.05} vignette={0.82} seed={24}>
      <Converge />
      <Burst start={2} count={80} y={840} spread={560} life={44} gravity={-60} seed={26} />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${settle})`,
        }}
      >
        <AssembleWord
          text="ХАЙРУЛА"
          start={0}
          duration={22}
          stagger={1.4}
          spread={150}
          style={{
            ...TYPE.hero,
            fontSize: 128,
            letterSpacing: '0.012em',
            textShadow: `0 0 ${70 * glow}px ${COLOR.accent}55`,
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: 18,
            marginTop: 30,
            ...TYPE.label,
            fontSize: 20,
            color: COLOR.muted,
            opacity: disciplines,
            transform: `translate3d(0, ${(1 - disciplines) * 18}px, 0)`,
          }}
        >
          <span>Video editing</span>
          <span style={{color: COLOR.accent}}>•</span>
          <span>Motion design</span>
          <span style={{color: COLOR.accent}}>•</span>
          <span>Advertising</span>
        </div>

        <div
          style={{
            width: 260,
            height: 2,
            background: GRADIENT,
            marginTop: 46,
            transform: `scaleX(${disciplines})`,
          }}
        />

        <div
          style={{
            marginTop: 46,
            padding: `0 ${SAFE}px`,
            textAlign: 'center',
            ...TYPE.title,
            fontSize: 46,
            lineHeight: 1.25,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              opacity: tagA,
              transform: `translate3d(0, ${(1 - tagA) * 22}px, 0)`,
            }}
          >
            Превращаю видео в контент,
          </span>
          <br />
          <span
            style={{
              display: 'inline-block',
              opacity: tagB,
              transform: `translate3d(0, ${(1 - tagB) * 22}px, 0)`,
              backgroundImage: GRADIENT,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            который запоминают.
          </span>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{background: COLOR.base, opacity: fade}} />
    </Stage>
  );
};
