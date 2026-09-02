import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT_FAMILY } from "../constants";

/**
 * Glass-morphism UI card/chip that "flies" into frame with spring physics.
 * Generic building block reused for tags, chips, mock UI panels.
 */
export const UIElement: React.FC<{
  children: React.ReactNode;
  x: number;
  y: number;
  delay?: number;
  from?: "left" | "right" | "top" | "bottom" | "scale";
  padding?: number;
  radius?: number;
  style?: React.CSSProperties;
}> = ({ children, x, y, delay = 0, from = "bottom", padding = 20, radius = 20, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 13, mass: 0.7, stiffness: 160 },
  });
  const opacity = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(s, [0, 1], [0.75, 1]);

  const offset = interpolate(s, [0, 1], [1, 0]);
  let tx = 0;
  let ty = 0;
  if (from === "left") tx = -80 * offset;
  if (from === "right") tx = 80 * offset;
  if (from === "top") ty = -80 * offset;
  if (from === "bottom") ty = 80 * offset;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        padding,
        borderRadius: radius,
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelBorder}`,
        backdropFilter: "blur(18px)",
        opacity,
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        fontFamily: FONT_FAMILY,
        color: COLORS.text,
        boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
