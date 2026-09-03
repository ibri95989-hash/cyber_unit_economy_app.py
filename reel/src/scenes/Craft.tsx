import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {KineticLine, Label, Mono} from '../components/Type';
import {COLOR, GRADIENT, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp, tween, rand} from '../lib/motion';
import {SCENE} from '../lib/timing';

const LEN = SCENE.craft.to - SCENE.craft.from;
const STAGE2 = 44;

const COLS = 4;
const ROWS = 3;
const CW = 196;
const CH = 128;
const GAP = 18;
const GRID_LEFT = (1080 - (COLS * CW + (COLS - 1) * GAP)) / 2;
const GRID_TOP = 640;

/** Scattered elements snapping onto the grid — "nothing here is accidental". */
const SnapGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const dim = ramp(frame, STAGE2 - 10, 16, EASE.inOut) * 0.72;

  return (
    <AbsoluteFill style={{opacity: 1 - dim}}>
      {new Array(COLS * ROWS).fill(0).map((_, i) => {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        const t = ramp(frame, 2 + i * 1.5, 28, EASE.out);
        const ox = (rand(i) - 0.5) * 420 * (1 - t);
        const oy = (rand(i + 40) - 0.5) * 300 * (1 - t);
        const rot = (rand(i + 80) - 0.5) * 18 * (1 - t);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: GRID_LEFT + c * (CW + GAP) + ox,
              top: GRID_TOP + r * (CH + GAP) + oy,
              width: CW,
              height: CH,
              borderRadius: 10,
              border: `1px solid ${COLOR.line}`,
              background: i === 5 ? 'rgba(77,225,255,0.10)' : 'rgba(255,255,255,0.03)',
              transform: `rotate(${rot}deg)`,
              opacity: t,
              filter: (1 - t) * 8 > 0.4 ? `blur(${(1 - t) * 8}px)` : undefined,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: 3,
                width: `${30 + rand(i * 3) * 50}%`,
                margin: '18px 0 0 16px',
                background: i === 5 ? COLOR.accent : COLOR.dim,
                borderRadius: 3,
              }}
            />
            <div
              style={{
                height: 3,
                width: `${20 + rand(i * 5) * 30}%`,
                margin: '10px 0 0 16px',
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

/** Idea → result, as a single line that fills. */
const Pipeline: React.FC = () => {
  const frame = useCurrentFrame();
  const t = ramp(frame, STAGE2 + 2, 40, EASE.out);
  const steps = ['Идея', 'Сценарий', 'Монтаж', 'Графика', 'Результат'];
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE,
        right: SAFE,
        top: 1270,
        opacity: ramp(frame, STAGE2, 14, EASE.out),
      }}
    >
      <div style={{position: 'relative', height: 3, background: COLOR.line, borderRadius: 3}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: GRADIENT,
            borderRadius: 3,
            transform: `scaleX(${t})`,
            transformOrigin: 'left center',
          }}
        />
        {steps.map((s, i) => {
          const p = i / (steps.length - 1);
          const on = t > p - 0.02;
          const last = i === steps.length - 1;
          return (
            <div key={s} style={{position: 'absolute', left: `${p * 100}%`, top: -7}}>
              <div
                style={{
                  width: 17,
                  height: 17,
                  marginLeft: -8,
                  borderRadius: 17,
                  background: on ? COLOR.accent : COLOR.panelHi,
                  border: `2px solid ${on ? COLOR.accent : COLOR.line}`,
                  boxShadow: on ? `0 0 20px ${COLOR.accent}88` : undefined,
                }}
              />
              <div
                style={{
                  ...TYPE.label,
                  fontSize: 17,
                  marginTop: 20,
                  color: on ? COLOR.text : COLOR.dim,
                  whiteSpace: 'nowrap',
                  position: 'absolute',
                  left: last ? 'auto' : i === 0 ? -8 : '50%',
                  right: last ? 0 : 'auto',
                  transform: last || i === 0 ? undefined : 'translateX(-50%)',
                }}
              >
                {s}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Craft: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = tween(frame, [0, LEN], [1.04, 1.0], EASE.inOut);

  return (
    <Stage aurora={0.5} grid={0.6} grain={0.05} vignette={0.85} seed={16}>
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        <SnapGrid />
        <Pipeline />
      </AbsoluteFill>

      <AbsoluteFill style={{padding: SAFE, justifyContent: 'flex-start', paddingTop: 200}}>
        <Label start={0} color={COLOR.accent}>
          Каждый кадр — решение
        </Label>
        <KineticLine
          text="НИЧЕГО"
          start={6}
          style={{...TYPE.hero, fontSize: 78, flexWrap: 'nowrap', marginTop: 24}}
        />
        <KineticLine
          text="СЛУЧАЙНОГО."
          start={12}
          style={{...TYPE.hero, fontSize: 78, flexWrap: 'nowrap'}}
          gradientWords={[0]}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{padding: SAFE, justifyContent: 'flex-end'}}>
        <Mono style={{opacity: ramp(frame, STAGE2 + 12, 20)}}>
          IDEA → SCRIPT → EDIT → MOTION → DELIVERY
        </Mono>
      </AbsoluteFill>
    </Stage>
  );
};
