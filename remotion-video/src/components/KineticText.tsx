import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT_FAMILY } from "../constants";

type Props = {
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  weight?: number;
  align?: "left" | "center" | "right";
  accentWords?: number[]; // word indices to highlight
  maxWidth?: number;
  lineHeight?: number;
};

/**
 * Word-by-word overshoot entrance: each word pops in with spring physics
 * and settles, instead of a flat fade — used for headline-level statements.
 */
export const KineticText: React.FC<Props> = ({
  text,
  delay = 0,
  fontSize = 64,
  color = COLORS.text,
  weight = 800,
  align = "center",
  accentWords = [],
  maxWidth,
  lineHeight = 1.08,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent:
          align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        textAlign: align,
        maxWidth,
        gap: `0 ${fontSize * 0.22}px`,
      }}
    >
      {words.map((w, i) => {
        const wordDelay = delay + i * 3;
        const s = spring({
          frame: frame - wordDelay,
          fps,
          config: { damping: 12, mass: 0.6, stiffness: 170 },
        });
        const opacity = interpolate(s, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
        });
        const y = interpolate(s, [0, 1], [46, 0]);
        const scale = interpolate(s, [0, 1], [0.6, 1]);
        const blur = interpolate(s, [0, 1], [8, 0], { extrapolateLeft: "clamp" });
        const isAccent = accentWords.includes(i);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `translateY(${y}px) scale(${scale})`,
              opacity,
              filter: `blur(${blur}px)`,
              fontFamily: FONT_FAMILY,
              fontWeight: weight,
              fontSize,
              lineHeight,
              color: isAccent ? COLORS.accent : color,
              letterSpacing: -0.5,
              textShadow: isAccent ? `0 0 34px ${COLORS.accentSoft}` : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
