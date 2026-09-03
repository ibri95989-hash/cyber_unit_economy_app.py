import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {Burst, Dust} from '../components/Particles';
import {AssembleWord, KineticLine, Label} from '../components/Type';
import {COLOR, FONT, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp, tween, rand} from '../lib/motion';
import {CUE, SCENE} from '../lib/timing';

const F = (abs: number) => abs - SCENE.hook.from;

const IMPULSE = 8;
const DISPERSE = F(CUE.iAm) - 8;
const NAME = F(CUE.name);

/** Interface fragments that fly in from the edges during the impulse. */
const Fragments: React.FC = () => {
  const frame = useCurrentFrame();
  const items = [
    {x: -420, y: 250, w: 300, h: 84, d: 12, side: -1},
    {x: 1180, y: 400, w: 240, h: 64, d: 16, side: 1},
    {x: -380, y: 1470, w: 340, h: 72, d: 20, side: -1},
    {x: 1200, y: 1620, w: 260, h: 92, d: 24, side: 1},
    {x: 1160, y: 176, w: 180, h: 48, d: 28, side: 1},
    {x: -300, y: 1360, w: 200, h: 48, d: 32, side: -1},
  ];
  return (
    <AbsoluteFill>
      {items.map((it, i) => {
        const t = ramp(frame, IMPULSE + it.d, 30, EASE.out);
        const out = ramp(frame, DISPERSE, 20, EASE.in);
        const restX = it.side < 0 ? SAFE - 30 : 1080 - SAFE - it.w + 30;
        const x = it.x + (restX - it.x) * t;
        const blur = (1 - t) * 12;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: it.y,
              width: it.w,
              height: it.h,
              borderRadius: 12,
              border: `1px solid ${COLOR.line}`,
              background: 'rgba(255,255,255,0.03)',
              opacity: t * (1 - out) * 0.9,
              filter: blur > 0.4 ? `blur(${blur}px)` : undefined,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: 3,
                width: `${40 + rand(i) * 45}%`,
                margin: '16px 0 0 16px',
                background: i % 3 === 0 ? COLOR.accent : COLOR.dim,
                borderRadius: 3,
              }}
            />
            <div
              style={{
                height: 3,
                width: `${25 + rand(i + 9) * 35}%`,
                margin: '12px 0 0 16px',
                background: COLOR.lineSoft,
                borderRadius: 3,
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();

  // Hard light impulse out of black.
  const bar = tween(frame, [IMPULSE, IMPULSE + 12], [0, 1], EASE.out);
  const barFade = tween(frame, [IMPULSE + 10, IMPULSE + 26], [1, 0], EASE.in);
  const flash = tween(frame, [IMPULSE, IMPULSE + 4, IMPULSE + 18], [0, 0.85, 0]);

  // Headline leaves as the name arrives.
  const heroOut = ramp(frame, DISPERSE, 16, EASE.in);
  const heroScale = 1 - heroOut * 0.12;
  const heroBlur = heroOut * 16;

  const nameGlow = ramp(frame, NAME, 20, EASE.out);

  return (
    <Stage aurora={ramp(frame, IMPULSE, 40)} grain={0.05} vignette={0.8} seed={2}>
      <Dust opacity={0.22 * ramp(frame, IMPULSE + 10, 40)} />
      <Fragments />

      {/* Impulse */}
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <div
          style={{
            width: 1080,
            height: 6,
            background: `linear-gradient(90deg, transparent, ${COLOR.text}, transparent)`,
            transform: `scaleX(${bar}) scaleY(${1 + (1 - bar) * 6})`,
            opacity: barFade,
            boxShadow: `0 0 80px 20px ${COLOR.accent}66`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#fff', opacity: flash, mixBlendMode: 'screen'}} />

      {/* Headline */}
      <AbsoluteFill
        style={{
          padding: SAFE,
          justifyContent: 'center',
          opacity: 1 - heroOut,
          transform: `scale(${heroScale})`,
          filter: heroBlur > 0.4 ? `blur(${heroBlur}px)` : undefined,
        }}
      >
        <Label start={F(CUE.line1) - 8} color={COLOR.accent} style={{marginBottom: 34}}>
          Хайрула · Видеомонтаж
        </Label>
        <KineticLine
          text="ТВОЙ КОНТЕНТ"
          start={F(CUE.line1)}
          style={{...TYPE.hero, fontSize: 84, flexWrap: 'nowrap'}}
        />
        <KineticLine
          text="МОЖЕТ БЫТЬ"
          start={F(CUE.line1) + 7}
          style={{...TYPE.hero, fontSize: 84, flexWrap: 'nowrap'}}
        />
        <KineticLine
          text="СИЛЬНЕЕ."
          start={F(CUE.line1) + 14}
          style={{...TYPE.hero, fontSize: 84, flexWrap: 'nowrap'}}
          gradientWords={[0]}
        />
        <div
          style={{
            marginTop: 44,
            maxWidth: 760,
            ...TYPE.body,
            color: COLOR.muted,
            opacity: ramp(frame, F(CUE.line2), 18, EASE.out),
            transform: `translate3d(0, ${(1 - ramp(frame, F(CUE.line2), 18)) * 22}px, 0)`,
          }}
        >
          Важно не только то, что снято.
          <br />
          Важно, как это выглядит после монтажа.
        </div>
      </AbsoluteFill>

      {/* Headline breaks apart, the name assembles out of it */}
      <Burst start={DISPERSE + 4} count={120} y={900} spread={720} life={54} seed={5} />

      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <div style={{opacity: ramp(frame, NAME, 12)}}>
          <AssembleWord
            text="ХАЙРУЛА"
            start={NAME}
            duration={18}
            stagger={1.3}
            spread={170}
            style={{
              ...TYPE.hero,
              fontSize: 122,
              letterSpacing: '0.01em',
              textShadow: `0 0 ${60 * nameGlow}px ${COLOR.accent}55`,
            }}
          />
          <div
            style={{
              marginTop: 30,
              display: 'flex',
              justifyContent: 'center',
              gap: 22,
              ...TYPE.label,
              fontSize: 21,
              color: COLOR.muted,
              opacity: ramp(frame, NAME + 14, 12),
            }}
          >
            <span>Монтаж</span>
            <span style={{color: COLOR.accent}}>·</span>
            <span>Моушн-дизайн</span>
            <span style={{color: COLOR.accent}}>·</span>
            <span>Реклама</span>
          </div>
        </div>
      </AbsoluteFill>

      {/* Black hold before the impulse */}
      <AbsoluteFill
        style={{
          background: COLOR.base,
          opacity: tween(frame, [0, IMPULSE], [1, 0], EASE.linear),
        }}
      />
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE, fontFamily: FONT.mono}} />
    </Stage>
  );
};
