import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, WIDTH, HEIGHT } from "../constants";
import { KineticText } from "../components/KineticText";
import { Camera } from "../components/Camera";

/**
 * HOOK (0-110f): a scroll of grey, lifeless "content" cards races past a
 * phone frame while a provocative question slams into center. This must
 * read as important within the first frame, silent or not.
 */
export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shake = Math.sin(frame * 1.4) * interpolate(frame, [0, 8], [6, 0], {
    extrapolateRight: "clamp",
  });

  const flashOpacity = interpolate(frame, [0, 3, 9], [1, 0.4, 0], {
    extrapolateRight: "clamp",
  });

  const cardScroll = frame * 9;

  return (
    <Camera localFrame={frame} durationInFrames={110} direction="in">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        {/* white flash impact on frame 0 to grab attention instantly */}
        <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flashOpacity }} />

        {/* dead scrolling feed, blurred background layer */}
        <AbsoluteFill style={{ opacity: 0.5, filter: "blur(1.5px)" }}>
          {new Array(6).fill(0).map((_, i) => {
            const y = ((i * 340 - cardScroll) % (HEIGHT + 340) + HEIGHT + 340) % (HEIGHT + 340) - 170;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: WIDTH / 2 - 260,
                  top: y,
                  width: 520,
                  height: 300,
                  borderRadius: 24,
                  background:
                    "linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
            );
          })}
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(10,11,16,0.2) 0%, rgba(10,11,16,0.92) 68%)",
          }}
        />

        <div
          style={{
            position: "relative",
            transform: `translateX(${shake}px)`,
            padding: "0 72px",
          }}
        >
          <KineticText
            text="Ваш бизнес всё ещё выкладывает"
            fontSize={64}
            delay={4}
            accentWords={[]}
          />
          <div style={{ height: 10 }} />
          <KineticText
            text="СКУЧНЫЕ видео?"
            fontSize={78}
            delay={18}
            accentWords={[0]}
          />
        </div>
      </AbsoluteFill>
    </Camera>
  );
};
