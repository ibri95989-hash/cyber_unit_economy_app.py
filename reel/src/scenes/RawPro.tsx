import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {Label, Mono} from '../components/Type';
import {Burst, Dust} from '../components/Particles';
import {COLOR, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp, tween, rand} from '../lib/motion';
import {SCENE} from '../lib/timing';

const LEN = SCENE.rawPro.to - SCENE.rawPro.from;
const SPLIT = 34;
const SWEEP = 74;
const SWEEP_LEN = 30;

/**
 * One composed shot, rendered twice with different grades. Same geometry both
 * sides, so the cut reads as colour and craft rather than a different picture.
 */
const Shot: React.FC<{pro: boolean; drift: number}> = ({pro, drift}) => (
  <AbsoluteFill style={{overflow: 'hidden'}}>
    {/* sky */}
    <AbsoluteFill
      style={{
        background: pro
          ? 'linear-gradient(175deg, #0B2233 0%, #123C4E 42%, #2B6478 62%, #C97B4A 88%, #E8A25E 100%)'
          : 'linear-gradient(175deg, #3A3F44 0%, #4A5055 45%, #5C6268 68%, #6E7278 88%, #7A7E83 100%)',
      }}
    />
    {/* light source */}
    <AbsoluteFill
      style={{
        background: `radial-gradient(30% 16% at 62% 66%, ${pro ? '#FFD9A0' : '#9DA1A6'} 0%, transparent 70%)`,
        opacity: pro ? 0.95 : 0.5,
        transform: `translateY(${drift * -14}px)`,
      }}
    />
    {/* far ridge */}
    <div
      style={{
        position: 'absolute',
        left: -120,
        right: -120,
        top: 1160,
        height: 760,
        borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
        background: pro ? '#0C2430' : '#41464B',
        transform: `translateY(${drift * 10}px)`,
      }}
    />
    {/* near ridge */}
    <div
      style={{
        position: 'absolute',
        left: -220,
        right: -40,
        top: 1330,
        height: 590,
        borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
        background: pro ? '#06151E' : '#33383C',
        transform: `translateY(${drift * 20}px)`,
      }}
    />
    {/* subject */}
    <div
      style={{
        position: 'absolute',
        left: 470,
        top: 1090,
        width: 118,
        height: 330,
        borderRadius: '58px 58px 10px 10px',
        background: pro ? '#040D14' : '#2B3033',
        transform: `translateY(${drift * 26}px)`,
        boxShadow: pro ? `0 0 90px 10px #E8A25E22` : 'none',
      }}
    />
    {/* haze */}
    <AbsoluteFill
      style={{
        background: pro
          ? 'linear-gradient(0deg, rgba(232,162,94,0.16), transparent 42%)'
          : 'linear-gradient(0deg, rgba(160,165,170,0.16), transparent 42%)',
      }}
    />
    {pro ? (
      <>
        <AbsoluteFill
          style={{
            background: 'radial-gradient(120% 80% at 50% 50%, transparent 42%, rgba(0,0,0,0.72) 100%)',
          }}
        />
        <AbsoluteFill
          style={{
            background: 'linear-gradient(112deg, transparent 40%, rgba(255,214,160,0.16) 52%, transparent 62%)',
            mixBlendMode: 'screen',
          }}
        />
      </>
    ) : (
      <AbsoluteFill style={{background: 'rgba(120,124,128,0.22)'}} />
    )}
  </AbsoluteFill>
);

/** Overlays that only the graded side gets — the "after" of the comparison. */
const ProOverlays: React.FC<{start: number}> = ({start}) => {
  const frame = useCurrentFrame();
  const box = ramp(frame, start + 8, 22, EASE.out);
  const type = ramp(frame, start + 18, 20, EASE.out);
  return (
    <AbsoluteFill>
      {/* tracking box on the subject */}
      <div
        style={{
          position: 'absolute',
          left: 430,
          top: 1050,
          width: 200,
          height: 400,
          border: `2px solid ${COLOR.accent}`,
          borderRadius: 4,
          opacity: box * 0.9,
          clipPath: `inset(0 ${(1 - box) * 50}% 0 ${(1 - box) * 50}%)`,
        }}
      >
        {[
          {top: -1, left: -1},
          {top: -1, right: -1},
          {bottom: -1, left: -1},
          {bottom: -1, right: -1},
        ].map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...c,
              width: 18,
              height: 18,
              border: `3px solid ${COLOR.accent}`,
              borderRadius: 2,
            }}
          />
        ))}
      </div>
      <Mono
        style={{
          position: 'absolute',
          left: 646,
          top: 1052,
          color: COLOR.accent,
          opacity: box,
        }}
      >
        TRACK · LOCKED
      </Mono>

      {/* graded typography */}
      <div style={{position: 'absolute', left: SAFE, top: 620, opacity: type}}>
        <div
          style={{
            ...TYPE.display,
            fontSize: 86,
            transform: `translate3d(0, ${(1 - type) * 34}px, 0)`,
          }}
        >
          ДИНАМИКА,
        </div>
        <div
          style={{
            ...TYPE.display,
            fontSize: 86,
            color: COLOR.accent,
            transform: `translate3d(0, ${(1 - ramp(frame, start + 24, 20)) * 34}px, 0)`,
            opacity: ramp(frame, start + 24, 20),
          }}
        >
          КОТОРАЯ ДЕРЖИТ
        </div>
        <div
          style={{
            ...TYPE.display,
            fontSize: 86,
            transform: `translate3d(0, ${(1 - ramp(frame, start + 30, 20)) * 34}px, 0)`,
            opacity: ramp(frame, start + 30, 20),
          }}
        >
          ВНИМАНИЕ.
        </div>
      </div>

      {/* light streaks */}
      {new Array(5).fill(0).map((_, i) => {
        const t = ramp(frame, start + 10 + i * 4, 40, EASE.out);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 120 + rand(i) * 760,
              top: 900 + rand(i + 5) * 600,
              width: 2,
              height: 90 * t,
              background: `linear-gradient(180deg, transparent, ${COLOR.accent}, transparent)`,
              opacity: 0.5 * t,
              transform: 'rotate(18deg)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const RawPro: React.FC = () => {
  const frame = useCurrentFrame();

  // Divider: parks at the middle for the comparison, then sweeps the frame.
  const split = ramp(frame, SPLIT, 26, EASE.out) * 50;
  const sweep = tween(frame, [SWEEP, SWEEP + SWEEP_LEN], [0, 100], EASE.inOut);
  const cut = Math.max(split, sweep >= 0.001 ? 50 + sweep * 0.5 : 0);
  const drift = tween(frame, [0, LEN], [0, 1], EASE.linear);

  return (
    <Stage aurora={0} grain={0.045} vignette={0} seed={8}>
      {/* RAW underneath, PRO revealed over it */}
      <AbsoluteFill style={{filter: 'saturate(0.4) contrast(0.86) brightness(0.98)'}}>
        <Shot pro={false} drift={drift} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          clipPath: `inset(0 0 0 ${100 - cut}%)`,
          filter: 'saturate(1.12) contrast(1.12)',
        }}
      >
        <Shot pro drift={drift} />
      </AbsoluteFill>

      {/* Divider with a hot edge */}
      {cut > 0.5 && cut < 99.5 ? (
        <div
          style={{
            position: 'absolute',
            left: `${100 - cut}%`,
            top: 0,
            bottom: 0,
            width: 3,
            background: COLOR.text,
            boxShadow: `0 0 60px 12px ${COLOR.accent}aa`,
          }}
        />
      ) : null}

      <Burst
        start={SWEEP + 6}
        count={70}
        x={540}
        y={960}
        spread={520}
        life={40}
        gravity={120}
        seed={11}
      />
      <Dust opacity={0.2} seed={12} />

      {/* Labels */}
      <AbsoluteFill style={{padding: SAFE}}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            opacity: ramp(frame, SPLIT + 6, 16) * (1 - ramp(frame, SWEEP + 14, 14)),
          }}
        >
          <div
            style={{
              ...TYPE.label,
              fontSize: 30,
              color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.25)',
              padding: '10px 20px',
              borderRadius: 6,
            }}
          >
            RAW
          </div>
          <div
            style={{
              ...TYPE.label,
              fontSize: 30,
              color: COLOR.base,
              background: COLOR.accent,
              padding: '10px 20px',
              borderRadius: 6,
            }}
          >
            PRO
          </div>
        </div>
      </AbsoluteFill>

      <ProOverlays start={SWEEP + SWEEP_LEN - 8} />

      <AbsoluteFill style={{padding: SAFE, justifyContent: 'flex-end'}}>
        <Label start={SWEEP + 34} color={COLOR.accent}>
          Цвет · Свет · Типографика · Трекинг
        </Label>
      </AbsoluteFill>
    </Stage>
  );
};
