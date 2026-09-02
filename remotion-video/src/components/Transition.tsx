import React from "react";
import { interpolate, Easing } from "remotion";

export type TransitionKind =
  | "whip-left"
  | "whip-right"
  | "zoom-punch"
  | "shutter"
  | "glitch-cut";

const IN_LEN = 16;
const OUT_LEN = 14;

/**
 * Wraps a scene and animates it in/out with a distinct, meaning-linked
 * transition so no two scene changes feel the same.
 */
export const Transition: React.FC<{
  kind: TransitionKind;
  localFrame: number;
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ kind, localFrame, durationInFrames, children }) => {
  const inP = interpolate(localFrame, [0, IN_LEN], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const outP = interpolate(
    localFrame,
    [durationInFrames - OUT_LEN, durationInFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    }
  );

  let transform = "";
  let opacity = 1;
  let filter = "";

  if (kind === "whip-left" || kind === "whip-right") {
    const dir = kind === "whip-left" ? 1 : -1;
    const inX = interpolate(inP, [0, 1], [dir * 420, 0]);
    const outX = interpolate(outP, [0, 1], [0, -dir * 420]);
    const blur = interpolate(inP, [0, 1], [26, 0]) + interpolate(outP, [0, 1], [0, 26]);
    transform = `translateX(${inX + outX}px) scale(${interpolate(inP, [0, 1], [1.15, 1])})`;
    filter = `blur(${blur}px)`;
    opacity = interpolate(inP, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  } else if (kind === "zoom-punch") {
    const inScale = interpolate(inP, [0, 1], [0.55, 1], {
      easing: Easing.out(Easing.back(1.6)),
    });
    const outScale = interpolate(outP, [0, 1], [1, 1.4]);
    const blur = interpolate(inP, [0, 1], [10, 0]) + interpolate(outP, [0, 1], [0, 18]);
    transform = `scale(${kind === "zoom-punch" ? inScale * (1 + (outScale - 1)) : 1})`;
    filter = `blur(${blur}px)`;
    opacity = interpolate(inP, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }) *
      interpolate(outP, [0, 1], [1, 0.15]);
  } else if (kind === "shutter") {
    const inY = interpolate(inP, [0, 1], [90, 0], {
      easing: Easing.out(Easing.cubic),
    });
    const outY = interpolate(outP, [0, 1], [0, -60]);
    const rot = interpolate(inP, [0, 1], [3, 0]);
    transform = `translateY(${inY + outY}px) rotate(${rot}deg)`;
    opacity = interpolate(inP, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }) *
      interpolate(outP, [0, 1], [1, 0]);
  } else if (kind === "glitch-cut") {
    const jitter = inP < 1 ? Math.sin(localFrame * 9) * (1 - inP) * 14 : 0;
    const outJitter = outP > 0 ? Math.sin(localFrame * 11) * outP * 10 : 0;
    transform = `translateX(${jitter + outJitter}px) scale(${interpolate(inP, [0, 1], [1.04, 1])})`;
    opacity = interpolate(inP, [0, 0.15], [0, 1], { extrapolateRight: "clamp" }) *
      interpolate(outP, [0, 1], [1, 0]);
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform,
        filter: filter || undefined,
        opacity,
      }}
    >
      {children}
    </div>
  );
};
