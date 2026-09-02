import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { COLORS, FONT_FAMILY } from "../constants";

/**
 * Number counter with scale-overshoot impact on arrival — used whenever a
 * key stat/metric needs to feel like an event, not printed text.
 */
export const Counter: React.FC<{
  from: number;
  to: number;
  delay?: number;
  durationInFrames?: number;
  suffix?: string;
  prefix?: string;
  fontSize?: number;
  color?: string;
}> = ({
  from,
  to,
  delay = 0,
  durationInFrames = 36,
  suffix = "",
  prefix = "",
  fontSize = 120,
  color = COLORS.text,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;

  const value = interpolate(local, [0, durationInFrames], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const impact = spring({
    frame: local - durationInFrames,
    fps,
    config: { damping: 8, mass: 0.5, stiffness: 220 },
  });
  const overshoot = interpolate(impact, [0, 1], [1, 1]) + Math.max(0, 1 - impact) * 0.18;

  const entrance = spring({ frame: local, fps, config: { damping: 14 } });
  const opacity = interpolate(entrance, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const blur = interpolate(entrance, [0, 1], [14, 0]);

  return (
    <div
      style={{
        fontFamily: FONT_FAMILY,
        fontWeight: 900,
        fontSize,
        color,
        opacity,
        filter: `blur(${blur}px)`,
        transform: `scale(${overshoot})`,
        letterSpacing: -2,
        textShadow: `0 0 60px ${COLORS.accentSoft}`,
      }}
    >
      {prefix}
      {Math.round(value).toLocaleString("ru-RU")}
      {suffix}
    </div>
  );
};
