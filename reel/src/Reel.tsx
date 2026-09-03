import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {COLOR} from './lib/theme';
import {EASE, tween} from './lib/motion';
import {SCENE, VO_PARTS, HIT} from './lib/timing';
import {Hook} from './scenes/Hook';
import {Editing} from './scenes/Editing';
import {Motion} from './scenes/Motion';
import {RawPro} from './scenes/RawPro';
import {Advertising} from './scenes/Advertising';
import {Craft} from './scenes/Craft';
import {Audience} from './scenes/Audience';
import {Showreel} from './scenes/Showreel';
import {Philosophy} from './scenes/Philosophy';
import {Final} from './scenes/Final';

const SCENES = [
  {key: 'hook', C: Hook},
  {key: 'editing', C: Editing},
  {key: 'motion', C: Motion},
  {key: 'rawPro', C: RawPro},
  {key: 'ads', C: Advertising},
  {key: 'craft', C: Craft},
  {key: 'audience', C: Audience},
  {key: 'showreel', C: Showreel},
  {key: 'philosophy', C: Philosophy},
  {key: 'final', C: Final},
] as const;

/**
 * A short light sweep on every cut. Enough to bind two scenes together without
 * resorting to a canned wipe.
 */
const CutAccent: React.FC = () => {
  const frame = useCurrentFrame();
  const hit = HIT.find((h) => frame >= h && frame < h + 9);
  if (hit === undefined || hit === 0) return null;
  const p = (frame - hit) / 9;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill
        style={{
          background: '#fff',
          opacity: (1 - p) * 0.16,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(${100 + p * 20}deg, transparent ${p * 100 - 22}%, ${COLOR.accent}22 ${p * 100}%, transparent ${p * 100 + 22}%)`,
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};

export const Reel: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: COLOR.base, color: COLOR.text}}>
      {SCENES.map(({key, C}) => {
        const s = SCENE[key];
        return (
          <Sequence key={key} from={s.from} durationInFrames={s.to - s.from} layout="none">
            <C />
          </Sequence>
        );
      })}

      <CutAccent />

      {/* Score runs the whole way; the voice sits on top of it. */}
      <Audio
        src={staticFile('score.mp3')}
        volume={(f) =>
          tween(f, [0, 14], [0, 0.62], EASE.out) * tween(f, [1770, 1798], [1, 0], EASE.inOut)
        }
      />

      {VO_PARTS.map((p, i) => {
        const len = p.trimAfter - p.trimBefore;
        return (
          <Sequence key={i} from={p.at} durationInFrames={len} layout="none">
            <Audio
              src={staticFile('voiceover.mp3')}
              trimBefore={p.trimBefore}
              trimAfter={p.trimAfter}
              volume={(f) =>
                tween(f, [0, 4], [0, 1], EASE.linear) *
                tween(f, [len - 5, len - 1], [1, 0], EASE.linear)
              }
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
