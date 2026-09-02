import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, WIDTH } from "../constants";
import { KineticText } from "../components/KineticText";
import { Camera } from "../components/Camera";

/**
 * RELIEF (780-903f): tension releases. A camera icon gets struck through
 * and a clock stops ticking — visual proof that shooting/thinking-up
 * content is no longer the user's job.
 */
export const ReliefScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const strike = interpolate(frame, [8, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const iconPop = spring({ frame, fps, config: { damping: 10, stiffness: 200 } });
  const iconScale = interpolate(iconPop, [0, 1], [0.3, 1]);

  return (
    <Camera localFrame={frame} durationInFrames={123} direction="in">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", marginBottom: 70 }}>
          <div
            style={{
              width: 190,
              height: 190,
              borderRadius: 40,
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${iconScale})`,
            }}
          >
            <CameraIcon />
          </div>
          <div
            style={{
              position: "absolute",
              left: -10,
              top: 95,
              width: 210 * strike,
              height: 8,
              borderRadius: 8,
              background: COLORS.danger,
              boxShadow: `0 0 24px ${COLORS.danger}`,
              transform: "rotate(-38deg)",
              transformOrigin: "left center",
            }}
          />
        </div>

        <KineticText
          text="Вам не нужно тратить время"
          fontSize={54}
          delay={26}
        />
        <div style={{ height: 8 }} />
        <KineticText
          text="на съёмки и контент."
          fontSize={54}
          delay={46}
          accentWords={[1]}
        />
      </AbsoluteFill>
    </Camera>
  );
};

const CameraIcon: React.FC = () => (
  <svg width="90" height="90" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="7" width="20" height="14" rx="3" stroke={COLORS.text} strokeWidth="1.6" />
    <circle cx="12" cy="14" r="4" stroke={COLORS.accent} strokeWidth="1.6" />
    <path d="M8 7l1.5-2.5h5L16 7" stroke={COLORS.text} strokeWidth="1.6" />
  </svg>
);
