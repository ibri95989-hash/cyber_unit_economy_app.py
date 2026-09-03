import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {Label} from '../components/Type';
import {COLOR, GRADIENT, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp, tween} from '../lib/motion';
import {SCENE} from '../lib/timing';
import {voiceSmooth} from '../lib/voice';

const LEN = SCENE.ads.to - SCENE.ads.from;

const PRODUCT = {x: 540, y: 880};

type Callout = {
  key: string;
  title: string;
  value: string;
  x: number;
  y: number;
  at: number;
  anchor: [number, number];
  accent?: boolean;
};

const CALLOUTS: Callout[] = [
  {key: 'title', title: 'TITLE', value: 'Название', x: 96, y: 470, at: 20, anchor: [430, 730]},
  {key: 'price', title: 'PRICE', value: 'Оффер', x: 726, y: 620, at: 32, anchor: [640, 800]},
  {key: 'features', title: 'FEATURES', value: '4 пункта', x: 80, y: 1160, at: 46, anchor: [428, 1010]},
  {key: 'benefits', title: 'BENEFITS', value: 'Выгоды', x: 700, y: 1270, at: 58, anchor: [648, 1030]},
];

const Product: React.FC<{voice: number}> = ({voice}) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, 0, 30, EASE.out);
  const float = Math.sin(frame * 0.045) * 12;
  const spin = tween(frame, [0, LEN], [-14, 12], EASE.inOut);
  return (
    <div
      style={{
        position: 'absolute',
        left: PRODUCT.x - 110,
        top: PRODUCT.y - 190 + float,
        width: 220,
        height: 380,
        transformStyle: 'preserve-3d',
        transform: `perspective(1200px) rotateY(${spin}deg) rotateX(4deg) scale(${(0.86 + t * 0.14) * (1 + voice * 0.014)})`,
        opacity: t,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 26,
          background: 'linear-gradient(150deg, #1B2436 0%, #0A0F1A 60%, #070A12 100%)',
          border: `1px solid ${COLOR.line}`,
          boxShadow: `0 40px 120px ${COLOR.accent}22, inset 0 1px 0 rgba(255,255,255,0.14)`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(115deg, transparent 32%, rgba(255,255,255,0.13) 48%, transparent 60%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 28,
            top: 34,
            width: 58,
            height: 58,
            borderRadius: 16,
            background: GRADIENT,
            opacity: 0.9,
          }}
        />
        <div style={{position: 'absolute', left: 28, bottom: 40}}>
          <div style={{...TYPE.label, fontSize: 15, color: COLOR.muted}}>PRODUCT</div>
          <div style={{...TYPE.title, fontSize: 34, marginTop: 8}}>Твой бренд</div>
        </div>
      </div>
      {/* reflection */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 392,
          height: 130,
          borderRadius: 26,
          background: 'linear-gradient(180deg, rgba(77,225,255,0.16), transparent 70%)',
          transform: 'scaleY(-1)',
          filter: 'blur(6px)',
          opacity: 0.6,
        }}
      />
    </div>
  );
};

export const Advertising: React.FC = () => {
  const frame = useCurrentFrame();
  const voice = voiceSmooth(frame + SCENE.ads.from);
  const ctaIn = ramp(frame, 74, 22, EASE.out);
  const ctaPulse = 1 + Math.max(0, Math.sin((frame - 74) * 0.16)) * 0.03 * ctaIn;

  return (
    <Stage aurora={0.7} grid={0.5} grain={0.05} vignette={0.85} seed={14}>
      {/* connectors */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {CALLOUTS.map((c, i) => {
          const t = ramp(frame, c.at + 4, 24, EASE.out);
          const sx = c.x < 540 ? c.x + 250 : c.x - 10;
          const sy = c.y + 46;
          const [ax, ay] = c.anchor;
          const d = `M ${sx} ${sy} L ${(sx + ax) / 2} ${sy} L ${ax} ${ay}`;
          return (
            <g key={i} opacity={0.75 * t}>
              <path
                d={d}
                fill="none"
                stroke={COLOR.accent}
                strokeWidth={1.5}
                strokeDasharray={600}
                strokeDashoffset={600 * (1 - t)}
              />
              <circle cx={ax} cy={ay} r={4.5 * t} fill={COLOR.accent} />
            </g>
          );
        })}
      </svg>

      <Product voice={voice} />

      {/* callouts, each on its own speed */}
      {CALLOUTS.map((c, i) => {
        const t = ramp(frame, c.at, 20, EASE.out);
        const dir = c.x < 540 ? -1 : 1;
        return (
          <div
            key={c.key}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y,
              width: 250,
              opacity: t,
              transform: `translate3d(${(1 - t) * 60 * dir}px, ${(1 - t) * 18}px, 0)`,
              borderLeft: `2px solid ${COLOR.accent}`,
              paddingLeft: 18,
            }}
          >
            <div style={{...TYPE.label, fontSize: 19, color: COLOR.accent}}>{c.title}</div>
            <div style={{...TYPE.title, fontSize: 38, marginTop: 8}}>{c.value}</div>
          </div>
        );
      })}

      {/* CTA */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 1480,
          display: 'flex',
          justifyContent: 'center',
          opacity: ctaIn,
          transform: `translate3d(0, ${(1 - ctaIn) * 40}px, 0) scale(${ctaPulse})`,
        }}
      >
        <div
          style={{
            padding: '24px 54px',
            borderRadius: 100,
            background: GRADIENT,
            color: COLOR.base,
            ...TYPE.label,
            fontSize: 26,
            boxShadow: `0 20px 70px ${COLOR.accent}44`,
          }}
        >
          CTA · Заказать ролик
        </div>
      </div>

      <AbsoluteFill style={{padding: SAFE, justifyContent: 'flex-start'}}>
        <Label start={4} color={COLOR.accent}>
          Рекламные ролики
        </Label>
        <div
          style={{
            ...TYPE.display,
            fontSize: 76,
            marginTop: 14,
            opacity: ramp(frame, 8, 20, EASE.out),
            transform: `translate3d(0, ${(1 - ramp(frame, 8, 20)) * 30}px, 0)`,
          }}
        >
          Графика,
          <br />
          которая объясняет
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
