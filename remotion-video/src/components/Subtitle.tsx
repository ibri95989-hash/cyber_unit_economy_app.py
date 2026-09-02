import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT_FAMILY, HEIGHT, SAFE_BOTTOM, SAFE_SIDE } from "../constants";
import { SUBTITLES } from "../subtitleData";

/**
 * Professional kinetic subtitles: one short phrase on screen at a time,
 * large, high-contrast, with the key word picked out in the accent color.
 * Positioned inside the Reels safe zone.
 */
export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = SUBTITLES.find((s) => frame >= s.from && frame < s.to);
  if (!active) return null;

  const local = frame - active.from;
  const total = active.to - active.from;

  const s = spring({ frame: local, fps, config: { damping: 14, stiffness: 180 } });
  const outStart = total - 6;
  const outP = interpolate(local, [outStart, total], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity =
    interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" }) *
    interpolate(outP, [0, 1], [1, 0]);
  const y = interpolate(s, [0, 1], [24, 0]) + interpolate(outP, [0, 1], [0, -14]);
  const scale = interpolate(s, [0, 1], [0.92, 1]);

  const words = active.text.split(" ");

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: SAFE_BOTTOM,
        paddingLeft: SAFE_SIDE,
        paddingRight: SAFE_SIDE,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 16px",
          opacity,
          transform: `translateY(${y}px) scale(${scale})`,
          maxWidth: 940,
        }}
      >
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 800,
              fontSize: 56,
              lineHeight: 1.15,
              color: i === active.emphasisIndex ? COLORS.accent : COLORS.text,
              textShadow:
                i === active.emphasisIndex
                  ? `0 0 30px ${COLORS.accentSoft}, 0 4px 18px rgba(0,0,0,0.6)`
                  : "0 4px 18px rgba(0,0,0,0.6)",
              WebkitTextStroke:
                i === active.emphasisIndex ? "none" : "0px transparent",
            }}
          >
            {w}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
