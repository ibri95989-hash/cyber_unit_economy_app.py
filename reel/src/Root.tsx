import React from 'react';
import {Composition} from 'remotion';
import {Reel} from './Reel';
import {loadFonts} from './lib/fonts';
import {DURATION, FPS, HEIGHT, WIDTH} from './lib/timing';

loadFonts();

export const RemotionRoot: React.FC = () => (
  <Composition
    id="HairulaReel"
    component={Reel}
    durationInFrames={DURATION}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
