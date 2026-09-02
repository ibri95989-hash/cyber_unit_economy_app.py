import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { COLORS } from "../constants";

/**
 * A drawn arrow/connector line used to show cause-and-effect between UI
 * elements (flow diagrams, comparisons). The line draws on with a
 * stroke-dashoffset animation, then an arrowhead pops.
 */
export const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay?: number;
  color?: string;
  strokeWidth?: number;
}> = ({ x1, y1, x2, y2, delay = 0, color = COLORS.accent, strokeWidth = 4 }) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);

  const len = Math.hypot(x2 - x1, y2 - y1);
  const progress = interpolate(local, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const headScale = interpolate(local, [16, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });

  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

  return (
    <svg
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      width={1}
      height={1}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - progress)}
        opacity={0.9}
      />
      <g
        transform={`translate(${x2}, ${y2}) rotate(${angle}) scale(${headScale})`}
      >
        <polygon points="0,0 -18,-9 -18,9" fill={color} />
      </g>
    </svg>
  );
};
