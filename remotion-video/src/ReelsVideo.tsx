import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Background } from "./components/Background";
import { Subtitles } from "./components/Subtitle";
import { Transition, TransitionKind } from "./components/Transition";
import { SCENES } from "./constants";
import { HookScene } from "./scenes/HookScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { ProcessScene } from "./scenes/ProcessScene";
import { ReliefScene } from "./scenes/ReliefScene";
import { ProofScene } from "./scenes/ProofScene";
import { PayoffScene } from "./scenes/PayoffScene";

const SCENE_LIST: {
  key: keyof typeof SCENES;
  transition: TransitionKind;
  Component: React.FC;
}[] = [
  { key: "hook", transition: "zoom-punch", Component: HookScene },
  { key: "problem", transition: "whip-left", Component: ProblemScene },
  { key: "process", transition: "shutter", Component: ProcessScene },
  { key: "relief", transition: "glitch-cut", Component: ReliefScene },
  { key: "proof", transition: "whip-right", Component: ProofScene },
  { key: "payoff", transition: "zoom-punch", Component: PayoffScene },
];

export const ReelsVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />

      {SCENE_LIST.map(({ key, transition, Component }) => {
        const { from, durationInFrames } = SCENES[key];
        return (
          <Sequence key={key} from={from} durationInFrames={durationInFrames}>
            <SceneFrame transition={transition} durationInFrames={durationInFrames}>
              <Component />
            </SceneFrame>
          </Sequence>
        );
      })}

      <Subtitles />

      <Audio src={staticFile("voiceover.mp3")} />
    </AbsoluteFill>
  );
};

const SceneFrame: React.FC<{
  transition: TransitionKind;
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ transition, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  return (
    <Transition kind={transition} localFrame={frame} durationInFrames={durationInFrames}>
      {children}
    </Transition>
  );
};
