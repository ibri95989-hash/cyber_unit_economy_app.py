import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {Label} from '../components/Type';
import {COLOR, GRADIENT, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp} from '../lib/motion';
import {CUE, SCENE} from '../lib/timing';

const F = (abs: number) => abs - SCENE.audience.from;

const ROW_TOP = 640;
const ROW_H = 200;
const ROW_GAP = 22;

const CARDS = [
  {ru: 'Для бизнеса', en: 'CORPORATE', at: F(CUE.aud1), tint: COLOR.accent},
  {ru: 'Для брендов', en: 'BRANDING', at: F(CUE.aud2), tint: COLOR.accent2},
  {ru: 'Для социальных сетей', en: 'SOCIAL MEDIA', at: F(CUE.aud3), tint: COLOR.good},
  {ru: 'Для рекламы', en: 'ADVERTISING', at: F(CUE.aud4), tint: COLOR.warm},
];

/** Abstract mark per row — geometry, not clip art. */
const Mark: React.FC<{i: number; tint: string}> = ({i, tint}) => (
  <svg width={84} height={84} viewBox="0 0 92 92" style={{flexShrink: 0}}>
    <g stroke={tint} strokeWidth={2.5} fill="none">
      {i === 0 ? (
        <>
          <rect x={14} y={30} width={22} height={48} rx={3} />
          <rect x={42} y={14} width={22} height={64} rx={3} />
          <rect x={70} y={44} width={12} height={34} rx={3} />
        </>
      ) : i === 1 ? (
        <>
          <circle cx={46} cy={46} r={26} />
          <circle cx={46} cy={46} r={11} fill={tint} stroke="none" />
        </>
      ) : i === 2 ? (
        <>
          <rect x={16} y={16} width={60} height={48} rx={8} />
          <path d="M 30 64 L 30 80 L 46 64" />
        </>
      ) : (
        <>
          <path d="M 16 60 L 40 36 L 56 52 L 78 24" />
          <path d="M 62 24 L 78 24 L 78 40" />
        </>
      )}
    </g>
  </svg>
);

export const Audience: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Stage aurora={0.75} grain={0.05} vignette={0.85} seed={18}>
      <AbsoluteFill style={{padding: SAFE, paddingTop: 200}}>
        <Label start={0} color={COLOR.accent}>
          Для кого я работаю
        </Label>
        <div
          style={{
            ...TYPE.display,
            fontSize: 80,
            marginTop: 18,
            opacity: ramp(frame, 2, 18, EASE.out),
            transform: `translate3d(0, ${(1 - ramp(frame, 2, 18)) * 28}px, 0)`,
          }}
        >
          Задачи, которые
          <br />я закрываю
        </div>
      </AbsoluteFill>

      {/* One row per line of voiceover — each lands exactly on its phrase. */}
      {CARDS.map((c, i) => {
        const t = ramp(frame, c.at, 18, EASE.out);
        // The newest row stays bright; the ones above settle back.
        const newer = CARDS.filter((o, j) => j > i && frame >= o.at).length;
        const settle = Math.min(1, newer * 0.34);
        return (
          <div
            key={c.en}
            style={{
              position: 'absolute',
              left: SAFE,
              right: SAFE,
              top: ROW_TOP + i * (ROW_H + ROW_GAP),
              height: ROW_H,
              borderRadius: 20,
              border: `1px solid ${COLOR.line}`,
              background: `linear-gradient(120deg, rgba(255,255,255,${0.06 - settle * 0.035}), rgba(255,255,255,0.015))`,
              opacity: t * (1 - settle * 0.45),
              transform: `translate3d(${(1 - t) * 70}px, 0, 0) scale(${0.97 + t * 0.03})`,
              boxShadow: newer === 0 && t > 0.9 ? `0 24px 70px rgba(0,0,0,0.45)` : undefined,
              padding: '0 34px',
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: c.tint,
                opacity: 1 - settle * 0.5,
              }}
            />
            <Mark i={i} tint={c.tint} />
            <div>
              <div style={{...TYPE.label, fontSize: 17, color: c.tint}}>{c.en}</div>
              <div style={{...TYPE.title, fontSize: 48, marginTop: 10}}>{c.ru}</div>
            </div>
          </div>
        );
      })}

      <AbsoluteFill style={{padding: SAFE, justifyContent: 'flex-end'}}>
        <div style={{display: 'flex', gap: 10}}>
          {CARDS.map((c, i) => (
            <div
              key={i}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 4,
                background: frame >= c.at ? GRADIENT : COLOR.line,
                opacity: frame >= c.at ? 1 : 0.5,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
