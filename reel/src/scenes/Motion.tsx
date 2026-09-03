import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {Label} from '../components/Type';
import {COLOR, GRADIENT, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp, tween, rand} from '../lib/motion';
import {CUE, SCENE} from '../lib/timing';
import {voiceSmooth} from '../lib/voice';

const F = (abs: number) => abs - SCENE.motion.from;
const LEN = SCENE.motion.to - SCENE.motion.from;

const SERVICES = [
  {text: 'Монтаж', at: F(CUE.svc1)},
  {text: 'Моушн-графика', at: F(CUE.svc2)},
  {text: 'Дизайн', at: F(CUE.svc3)},
  {text: 'Рекламные ролики', at: F(CUE.svc4)},
];

/** Word built from individual letters so each can carry its own depth. */
const DepthWord: React.FC<{
  text: string;
  start: number;
  voice: number;
  outline?: boolean;
}> = ({text, start, voice, outline}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex', transformStyle: 'preserve-3d'}}>
      {text.split('').map((c, i) => {
        const t = ramp(frame, start + i * 2.2, 24, EASE.out);
        const z = voice * 46 * (0.6 + rand(i) * 0.8);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translate3d(0, ${(1 - t) * 90}px, ${z}px)`,
              opacity: t,
              ...(outline
                ? {
                    color: 'transparent',
                    WebkitTextStroke: `2px rgba(255,255,255,0.22)`,
                  }
                : {
                    backgroundImage: GRADIENT,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }),
            }}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
};

/** Lines → dots → arrows → a small graph, assembling behind the type. */
const Geometry: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = ramp(frame, 24, 54, EASE.out);
  const dots = ramp(frame, 48, 40, EASE.out);
  const graph = ramp(frame, 96, 46, EASE.out);

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <g stroke={COLOR.accent} strokeWidth={1.5} fill="none" opacity={0.5}>
          <path
            d="M 90 470 L 420 470 L 470 420 L 830 420"
            strokeDasharray={800}
            strokeDashoffset={800 * (1 - draw)}
          />
          <path
            d="M 990 690 L 700 690 L 650 640 L 190 640"
            strokeDasharray={900}
            strokeDashoffset={900 * (1 - draw)}
          />
        </g>
        <g stroke={COLOR.accent2} strokeWidth={1.5} fill="none" opacity={0.45}>
          <path
            d="M 860 1180 L 960 1180 L 990 1140"
            strokeDasharray={280}
            strokeDashoffset={280 * (1 - draw)}
          />
          <path d="M 990 1140 l -15 2 M 990 1140 l 3 15" strokeOpacity={draw} />
        </g>

        {/* dots */}
        {new Array(16).fill(0).map((_, i) => {
          const x = 110 + rand(i * 5) * 860;
          const y = 300 + rand(i * 7 + 3) * 780;
          const d = Math.max(0, Math.min(1, dots * 3 - i * 0.14));
          return <circle key={i} cx={x} cy={y} r={3.5 * d} fill={COLOR.text} opacity={0.55 * d} />;
        })}

        {/* bar graph */}
        <g transform="translate(770, 1320)">
          {[38, 66, 52, 92, 74].map((h, i) => {
            const g = Math.max(0, Math.min(1, graph * 2.2 - i * 0.2));
            return (
              <rect
                key={i}
                x={i * 34}
                y={-h * g}
                width={18}
                height={h * g}
                rx={3}
                fill={i === 3 ? COLOR.accent : COLOR.dim}
                opacity={0.85}
              />
            );
          })}
          <line x1={-8} y1={2} x2={180} y2={2} stroke={COLOR.line} strokeWidth={1} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const Motion: React.FC = () => {
  const frame = useCurrentFrame();
  const voice = voiceSmooth(frame + SCENE.motion.from);

  // Slow parallax camera across the 3D type.
  const spin = tween(frame, [0, LEN], [-19, 9], EASE.inOut);
  const rise = tween(frame, [0, LEN], [26, -18], EASE.inOut);
  const exit = ramp(frame, LEN - 16, 16, EASE.in);

  return (
    <Stage aurora={0.85} grain={0.05} vignette={0.8} seed={6}>
      <Geometry />

      <AbsoluteFill
        style={{
          perspective: 1500,
          perspectiveOrigin: '50% 45%',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: 1 - exit,
        }}
      >
        <div
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${spin}deg) rotateX(${rise * 0.25}deg) translateY(${rise}px) scale(${1 + voice * 0.02})`,
            ...TYPE.hero,
            fontSize: 172,
            lineHeight: 0.88,
          }}
        >
          <DepthWord text="MOTION" start={4} voice={voice} />
          <DepthWord text="DESIGN" start={16} voice={voice} outline />
        </div>
      </AbsoluteFill>

      {/* Services, each landing exactly on the voice */}
      <AbsoluteFill style={{padding: SAFE, justifyContent: 'flex-end', paddingBottom: 250}}>
        <Label start={2} color={COLOR.accent} style={{marginBottom: 26}}>
          Что я делаю
        </Label>
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
          {SERVICES.map((sv, i) => {
            const t = ramp(frame, sv.at, 14, EASE.out);
            const live = ramp(frame, sv.at, 8) - ramp(frame, sv.at + 26, 22);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  opacity: t,
                  transform: `translate3d(${(1 - t) * -50}px, 0, 0)`,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 10,
                    background: COLOR.accent,
                    opacity: 0.4 + live * 0.6,
                    boxShadow: `0 0 ${18 * live}px ${COLOR.accent}`,
                  }}
                />
                <div
                  style={{
                    ...TYPE.title,
                    fontSize: 52,
                    color: `rgba(255,255,255,${0.55 + live * 0.45})`,
                  }}
                >
                  {sv.text}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
