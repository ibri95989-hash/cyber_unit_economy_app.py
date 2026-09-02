import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, WIDTH, HEIGHT } from "../constants";

/**
 * Deep premium background: radial glow + slow-drifting grid + parallax
 * particles. Runs for the whole video underneath every scene.
 */
export const Background: React.FC<{ intensity?: number }> = ({
  intensity = 1,
}) => {
  const frame = useCurrentFrame();

  const drift = interpolate(frame, [0, 1306], [0, -160]);
  const glowPulse = 0.55 + Math.sin(frame / 26) * 0.12;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: "hidden" }}>
      {/* radial accent glow, slowly breathing */}
      <div
        style={{
          position: "absolute",
          width: WIDTH * 1.6,
          height: WIDTH * 1.6,
          left: WIDTH / 2 - (WIDTH * 1.6) / 2,
          top: HEIGHT * 0.28 - (WIDTH * 1.6) / 2,
          background: `radial-gradient(circle, ${COLORS.accentSoft} 0%, rgba(124,92,255,0) 62%)`,
          opacity: glowPulse * intensity,
          filter: "blur(2px)",
        }}
      />

      {/* drifting perspective grid for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "90px 90px",
          transform: `translateY(${drift}px)`,
          maskImage:
            "radial-gradient(ellipse at 50% 35%, black 10%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 35%, black 10%, transparent 72%)",
          opacity: 0.7 * intensity,
        }}
      />

      {/* vignette for premium depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <Particles frame={frame} />
    </AbsoluteFill>
  );
};

const Particles: React.FC<{ frame: number }> = ({ frame }) => {
  const seeds = React.useMemo(
    () =>
      new Array(22).fill(0).map((_, i) => ({
        x: (i * 137.5) % WIDTH,
        y: (i * 71.3) % HEIGHT,
        r: 1.4 + (i % 5) * 0.6,
        speed: 0.25 + (i % 4) * 0.12,
        phase: i * 12.9,
      })),
    []
  );

  return (
    <>
      {seeds.map((s, i) => {
        const y = ((s.y - frame * s.speed) % (HEIGHT + 100) + HEIGHT + 100) % (HEIGHT + 100) - 50;
        const twinkle = 0.25 + Math.abs(Math.sin((frame + s.phase) / 20)) * 0.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: y,
              width: s.r * 2,
              height: s.r * 2,
              borderRadius: "50%",
              background: COLORS.glow,
              opacity: twinkle * 0.5,
              boxShadow: `0 0 ${8 + s.r * 3}px ${COLORS.glow}`,
            }}
          />
        );
      })}
    </>
  );
};
