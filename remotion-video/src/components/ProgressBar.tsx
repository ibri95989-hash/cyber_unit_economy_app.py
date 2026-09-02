import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS } from "../constants";

/** Horizontal bar-chart bar that grows from 0, with a glowing tip. */
export const ProgressBar: React.FC<{
  widthPx: number;
  heightPx?: number;
  delay?: number;
  color?: string;
  label?: string;
}> = ({ widthPx, heightPx = 18, delay = 0, color = COLORS.accent, label }) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const w = interpolate(local, [0, 26], [0, widthPx], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          width: widthPx,
          height: heightPx,
          borderRadius: heightPx,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: w,
            height: "100%",
            borderRadius: heightPx,
            background: `linear-gradient(90deg, ${color}, ${COLORS.glow})`,
            boxShadow: `0 0 24px ${color}`,
          }}
        />
      </div>
      {label ? (
        <div style={{ color: COLORS.textDim, fontSize: 22, fontFamily: "Inter" }}>
          {label}
        </div>
      ) : null}
    </div>
  );
};
