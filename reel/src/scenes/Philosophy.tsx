import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {KineticLine} from '../components/Type';
import {Dust} from '../components/Particles';
import {COLOR, SAFE, TYPE} from '../lib/theme';
import {EASE, ramp, tween} from '../lib/motion';
import {SCENE} from '../lib/timing';

const LEN = SCENE.philosophy.to - SCENE.philosophy.from;
const SECOND = 74;

/**
 * The quiet beat. Almost nothing moves; the restraint is the point, and it
 * gives the closing line somewhere to land.
 */
export const Philosophy: React.FC = () => {
  const frame = useCurrentFrame();

  const one = ramp(frame, 6, 24, EASE.out) * (1 - ramp(frame, SECOND - 12, 16, EASE.in));
  const twoIn = ramp(frame, SECOND, 24, EASE.out);
  const drift = tween(frame, [0, LEN], [0, -26], EASE.linear);

  return (
    <Stage aurora={0.34} grain={0.045} vignette={0.9} seed={22}>
      <Dust count={30} opacity={0.16} seed={23} />

      <AbsoluteFill style={{padding: SAFE, justifyContent: 'center'}}>
        <div
          style={{
            width: 90,
            height: 2,
            background: COLOR.accent,
            marginBottom: 48,
            transform: `scaleX(${ramp(frame, 2, 26, EASE.out)})`,
            transformOrigin: 'left center',
          }}
        />

        <div style={{position: 'relative', height: 420}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: one,
              transform: `translate3d(0, ${drift}px, 0)`,
            }}
          >
            <KineticLine
              text="КАЖДЫЙ КАДР"
              start={6}
              stagger={4}
              style={{...TYPE.hero, fontSize: 100, lineHeight: 0.98}}
            />
            <KineticLine
              text="ИМЕЕТ ЗНАЧЕНИЕ."
              start={12}
              stagger={4}
              style={{...TYPE.hero, fontSize: 100, lineHeight: 0.98}}
              gradientWords={[1]}
            />
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: twoIn,
              transform: `translate3d(0, ${drift + (1 - twoIn) * 34}px, 0)`,
            }}
          >
            <KineticLine
              text="КАЖДАЯ АНИМАЦИЯ"
              start={SECOND}
              stagger={4}
              style={{...TYPE.hero, fontSize: 100, lineHeight: 0.98}}
            />
            <KineticLine
              text="РАБОТАЕТ НА ИДЕЮ."
              start={SECOND + 6}
              stagger={4}
              style={{...TYPE.hero, fontSize: 100, lineHeight: 0.98}}
              gradientWords={[2]}
            />
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
