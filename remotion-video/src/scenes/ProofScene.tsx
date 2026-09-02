import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, WIDTH } from "../constants";
import { Counter } from "../components/Counter";
import { UIElement } from "../components/UIElement";
import { ProgressBar } from "../components/ProgressBar";
import { Camera } from "../components/Camera";
import { useCurrentFrame } from "remotion";

/**
 * VISUAL PROOF / PAYOFF (903-1063f): the abstract promise becomes a hard
 * number. A count-up stat is the single visual event of this scene —
 * everything else steps back to let it land.
 */
export const ProofScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Camera localFrame={frame} durationInFrames={160} direction="out">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 26,
            color: COLORS.textDim,
            fontFamily: "Inter",
            marginBottom: 10,
            letterSpacing: 1,
          }}
        >
          ГОТОВЫЙ РИЛС, КОТОРЫЙ РАБОТАЕТ
        </div>

        <Counter from={0} to={247} suffix="%" delay={6} durationInFrames={38} fontSize={148} />

        <div
          style={{
            fontSize: 30,
            color: COLORS.text,
            fontFamily: "Inter",
            fontWeight: 700,
            marginTop: 6,
            marginBottom: 46,
          }}
        >
          рост удержания внимания
        </div>

        <UIElement x={WIDTH / 2 - 300} y={1220} delay={44} from="scale" style={{ width: 600 }}>
          <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
            <ProgressBar widthPx={210} delay={54} color={COLORS.danger} label="Обычное видео" />
            <ProgressBar widthPx={210} delay={70} color={COLORS.accent} label="Ваш рилс" />
          </div>
        </UIElement>
      </AbsoluteFill>
    </Camera>
  );
};
