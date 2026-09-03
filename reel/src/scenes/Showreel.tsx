import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {COLOR, GRADIENT, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp, tween, rand} from '../lib/motion';
import {SCENE} from '../lib/timing';

const LEN = SCENE.showreel.to - SCENE.showreel.from;
const BOARD = 36; // 1.2s — one whoosh per cut in the score
const COUNT = 9;

/** Every board enters on a whip and leaves on one, so cuts feel driven. */
const Whip: React.FC<{children: React.ReactNode; dir?: number}> = ({children, dir = 1}) => {
  const frame = useCurrentFrame();
  const inT = ramp(frame, 0, 8, EASE.out);
  const outT = ramp(frame, BOARD - 7, 7, EASE.in);
  const x = (1 - inT) * 320 * dir - outT * 320 * dir;
  const blur = Math.min(18, (Math.abs(1 - inT) + outT) * 26);
  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${x}px, 0, 0)`,
        filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
        opacity: Math.min(inT * 1.4, 1) * (1 - outT),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ru: string; en: string}> = ({ru, en}) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, 4, 14, EASE.out);
  return (
    <AbsoluteFill style={{padding: SAFE, justifyContent: 'flex-end', paddingBottom: 260}}>
      <div style={{...TYPE.label, fontSize: 19, color: COLOR.accent, opacity: t}}>{en}</div>
      <div
        style={{
          ...TYPE.display,
          fontSize: 82,
          marginTop: 12,
          opacity: t,
          transform: `translate3d(0, ${(1 - t) * 26}px, 0)`,
        }}
      >
        {ru}
      </div>
    </AbsoluteFill>
  );
};

const B_Timeline: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = frame * 26;
  return (
    <AbsoluteFill style={{justifyContent: 'center'}}>
      {new Array(5).fill(0).map((_, r) => (
        <div key={r} style={{display: 'flex', gap: 12, marginBottom: 14, height: 78}}>
          {new Array(10).fill(0).map((_, i) => {
            const w = 150 + rand(r * 10 + i) * 220;
            const x = ((i * 300 - scroll * (0.6 + r * 0.14)) % 3000) - 300;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x,
                  width: w,
                  height: 78,
                  marginTop: r * 92,
                  borderRadius: 8,
                  background: [COLOR.accent, COLOR.accent2, '#2C6E8E', COLOR.warm, COLOR.good][r],
                  opacity: 0.5,
                }}
              />
            );
          })}
        </div>
      ))}
      <Caption ru="Монтаж" en="EDITING" />
    </AbsoluteFill>
  );
};

const B_Typography: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = ['КИНЕТИКА', 'ТИПОГРАФИКА', 'РИТМ', 'АКЦЕНТ'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', overflow: 'hidden'}}>
      {rows.map((r, i) => {
        const dir = i % 2 ? -1 : 1;
        const x = tween(frame, [0, BOARD], [260 * dir, -260 * dir], EASE.inOut);
        return (
          <div
            key={i}
            style={{
              ...TYPE.hero,
              fontSize: 116,
              color: i === 1 ? COLOR.text : 'transparent',
              WebkitTextStroke: i === 1 ? undefined : `2px ${COLOR.line}`,
              transform: `translate3d(${x}px, 0, 0)`,
              whiteSpace: 'nowrap',
            }}
          >
            {r}
          </div>
        );
      })}
      <Caption ru="Типографика" en="KINETIC TYPE" />
    </AbsoluteFill>
  );
};

const B_ThreeD: React.FC = () => {
  const frame = useCurrentFrame();
  const rot = frame * 3.4;
  const faces = [
    {t: 'translateZ(190px)'},
    {t: 'translateZ(-190px)'},
    {t: 'rotateY(90deg) translateZ(190px)'},
    {t: 'rotateY(-90deg) translateZ(190px)'},
    {t: 'rotateX(90deg) translateZ(190px)'},
    {t: 'rotateX(-90deg) translateZ(190px)'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', perspective: 1400}}>
      <div
        style={{
          width: 380,
          height: 380,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rot * 0.6}deg) rotateY(${rot}deg)`,
        }}
      >
        {faces.map((f, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              border: `2px solid ${i % 2 ? COLOR.accent : COLOR.accent2}`,
              background: 'rgba(77,225,255,0.05)',
              transform: f.t,
            }}
          />
        ))}
      </div>
      <Caption ru="3D и объём" en="3D TRANSFORMS" />
    </AbsoluteFill>
  );
};

const B_Graphs: React.FC = () => {
  const frame = useCurrentFrame();
  const t = ramp(frame, 2, 26, EASE.out);
  const pts = [0.2, 0.45, 0.35, 0.68, 0.55, 0.86, 0.95];
  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${120 + i * 140} ${1180 - p * 620 * t}`)
    .join(' ');
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920}>
        <path d={path} fill="none" stroke={COLOR.accent} strokeWidth={4} />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={120 + i * 140}
            cy={1180 - p * 620 * t}
            r={7}
            fill={COLOR.base}
            stroke={COLOR.accent}
            strokeWidth={3}
            opacity={t}
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={100}
            y1={1200 - i * 180}
            x2={980}
            y2={1200 - i * 180}
            stroke={COLOR.lineSoft}
          />
        ))}
      </svg>
      <Caption ru="Инфографика" en="DATA & CHARTS" />
    </AbsoluteFill>
  );
};

const B_Ad: React.FC = () => {
  const frame = useCurrentFrame();
  const t = ramp(frame, 2, 20, EASE.out);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 520,
          height: 640,
          borderRadius: 26,
          background: 'linear-gradient(150deg, #16203047, #05080F)',
          border: `1px solid ${COLOR.line}`,
          transform: `scale(${0.9 + t * 0.1})`,
          opacity: t,
          padding: 40,
        }}
      >
        <div style={{width: 74, height: 74, borderRadius: 20, background: GRADIENT}} />
        <div style={{...TYPE.title, fontSize: 46, marginTop: 34}}>Продукт</div>
        <div style={{...TYPE.body, color: COLOR.muted, marginTop: 14}}>
          Преимущества · Цена · Оффер
        </div>
        <div
          style={{
            marginTop: 42,
            padding: '18px 30px',
            borderRadius: 100,
            background: GRADIENT,
            color: COLOR.base,
            ...TYPE.label,
            fontSize: 20,
            display: 'inline-block',
          }}
        >
          Купить
        </div>
      </div>
      <Caption ru="Реклама" en="ADVERTISING" />
    </AbsoluteFill>
  );
};

const B_Transitions: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {new Array(7).fill(0).map((_, i) => {
        const t = ramp(frame, i * 3, 22, EASE.out);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: i * 274,
              height: 274,
              background: i % 2 ? COLOR.accent : COLOR.accent2,
              opacity: 0.16,
              transform: `translateX(${(1 - t) * (i % 2 ? 1080 : -1080)}px)`,
            }}
          />
        );
      })}
      <Caption ru="Переходы" en="TRANSITIONS" />
    </AbsoluteFill>
  );
};

const B_Motion: React.FC = () => {
  const frame = useCurrentFrame();
  const x = tween(frame, [0, BOARD], [-140, 140], EASE.inOut);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...TYPE.hero,
            fontSize: 150,
            color: 'transparent',
            WebkitTextStroke: `2px ${COLOR.accent}`,
            opacity: 0.16 + i * 0.02,
            transform: `translate3d(${x - i * 26}px, 0, 0)`,
          }}
        >
          MOTION
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          ...TYPE.hero,
          fontSize: 150,
          transform: `translate3d(${x}px, 0, 0)`,
        }}
      >
        MOTION
      </div>
      <Caption ru="Движение" en="MOTION" />
    </AbsoluteFill>
  );
};

const B_Design: React.FC = () => {
  const frame = useCurrentFrame();
  const tiles = [COLOR.accent, COLOR.accent2, COLOR.good, COLOR.warm, '#2C6E8E', '#B36BFF'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 240px)', gap: 22}}>
        {tiles.map((c, i) => {
          const t = ramp(frame, i * 2.5, 20, EASE.out);
          return (
            <div
              key={i}
              style={{
                width: 240,
                height: 190,
                borderRadius: 16,
                background: `linear-gradient(150deg, ${c}, ${c}22)`,
                opacity: t,
                transform: `scale(${0.86 + t * 0.14}) rotate(${(1 - t) * (i % 2 ? 6 : -6)}deg)`,
              }}
            />
          );
        })}
      </div>
      <Caption ru="Дизайн" en="VISUAL DESIGN" />
    </AbsoluteFill>
  );
};

const B_Grade: React.FC = () => {
  const frame = useCurrentFrame();
  const cut = tween(frame, [2, BOARD - 4], [10, 92], EASE.inOut);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{background: 'linear-gradient(170deg, #43484D, #6B7075)', filter: 'saturate(0.3)'}}
      />
      <AbsoluteFill
        style={{
          clipPath: `inset(0 0 0 ${100 - cut}%)`,
          background: 'linear-gradient(170deg, #0B2233, #2B6478 55%, #E8A25E)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${100 - cut}%`,
          top: 0,
          bottom: 0,
          width: 3,
          background: '#fff',
          boxShadow: `0 0 50px 10px ${COLOR.accent}88`,
        }}
      />
      <Caption ru="Цветокоррекция" en="COLOR GRADE" />
    </AbsoluteFill>
  );
};

const BOARDS = [
  B_Timeline,
  B_Typography,
  B_ThreeD,
  B_Graphs,
  B_Ad,
  B_Transitions,
  B_Motion,
  B_Design,
  B_Grade,
];

export const Showreel: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = Math.min(COUNT - 1, Math.floor(frame / BOARD));

  return (
    <Stage aurora={0.5} grain={0.055} vignette={0.88} seed={20}>
      {BOARDS.map((B, i) => (
        <Sequence key={i} from={i * BOARD} durationInFrames={BOARD} layout="none">
          <Whip dir={i % 2 ? -1 : 1}>
            <B />
          </Whip>
        </Sequence>
      ))}

      {/* Persistent HUD so the rapid cuts still read as one reel */}
      <AbsoluteFill style={{padding: SAFE, justifyContent: 'flex-start'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{...TYPE.label, fontSize: 20, color: COLOR.accent}}>Showreel</div>
          <div style={{...TYPE.mono, color: COLOR.dim}}>
            {String(idx + 1).padStart(2, '0')} / {COUNT}
          </div>
        </div>
        <div style={{display: 'flex', gap: 6, marginTop: 16}}>
          {new Array(COUNT).fill(0).map((_, i) => (
            <div
              key={i}
              style={{
                height: 3,
                flex: 1,
                borderRadius: 3,
                background: i <= idx ? COLOR.accent : COLOR.line,
                opacity: i <= idx ? 1 : 0.6,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>

      {/* final flash into the philosophy beat */}
      <AbsoluteFill
        style={{
          background: '#fff',
          opacity: tween(frame, [LEN - 8, LEN - 2], [0, 0.5], EASE.in),
          mixBlendMode: 'screen',
        }}
      />
    </Stage>
  );
};
