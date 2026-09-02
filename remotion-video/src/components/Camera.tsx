import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";

type CameraProps = {
  /** local frame offset within the scene, used for the drift */
  localFrame: number;
  durationInFrames: number;
  /** overall zoom direction for this scene: in = starts wide ends tight */
  direction?: "in" | "out" | "pan-left" | "pan-right" | "static";
  children: React.ReactNode;
};

/**
 * Simulates physical camera movement in 2D: slow zoom + micro-pan,
 * giving every scene a sense of a lens rather than a static frame.
 */
export const Camera: React.FC<CameraProps> = ({
  localFrame,
  durationInFrames,
  direction = "in",
  children,
}) => {
  let scale = 1;
  let x = 0;
  let y = 0;

  const progress = interpolate(localFrame, [0, durationInFrames], [0, 1], {
    easing: Easing.bezier(0.33, 0, 0.2, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (direction === "in") {
    scale = interpolate(progress, [0, 1], [1, 1.08]);
    y = interpolate(progress, [0, 1], [6, -6]);
  } else if (direction === "out") {
    scale = interpolate(progress, [0, 1], [1.1, 1]);
    y = interpolate(progress, [0, 1], [-6, 6]);
  } else if (direction === "pan-left") {
    scale = 1.06;
    x = interpolate(progress, [0, 1], [22, -22]);
  } else if (direction === "pan-right") {
    scale = 1.06;
    x = interpolate(progress, [0, 1], [-22, 22]);
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform: `scale(${scale}) translate(${x}px, ${y}px)`,
        transformOrigin: "50% 45%",
      }}
    >
      {children}
    </div>
  );
};
