import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, WIDTH, FONT_FAMILY } from "../constants";
import { KineticText } from "../components/KineticText";
import { Camera } from "../components/Camera";

/**
 * FINAL PUNCH (1063-1306f): direct call to action. The button arrives
 * with maximum visual payoff — burst particles, glow, overshoot scale —
 * because this is the one moment the viewer must act on.
 */
export const PayoffScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const btnDelay = 150;
  const btnSpring = spring({
    frame: frame - btnDelay,
    fps,
    config: { damping: 9, mass: 0.6, stiffness: 200 },
  });
  const btnScale = interpolate(btnSpring, [0, 1], [0.3, 1]);
  const btnOpacity = interpolate(btnSpring, [0, 1], [0, 1], { extrapolateRight: "clamp" });

  const pulse = 1 + Math.sin(Math.max(0, frame - btnDelay - 20) / 8) * 0.03;

  return (
    <Camera localFrame={frame} durationInFrames={243} direction="in">
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ padding: "0 80px", marginBottom: 64 }}>
          <KineticText
            text="Хотите контент,"
            fontSize={58}
            delay={4}
          />
          <div style={{ height: 6 }} />
          <KineticText
            text="который ЦЕПЛЯЕТ людей?"
            fontSize={58}
            delay={22}
            accentWords={[1]}
          />
        </div>

        <Burst frame={frame} delay={btnDelay} />

        <div
          style={{
            position: "relative",
            padding: "30px 56px",
            borderRadius: 100,
            background: `linear-gradient(120deg, ${COLORS.accent}, ${COLORS.glow})`,
            transform: `scale(${btnScale * pulse})`,
            opacity: btnOpacity,
            boxShadow: `0 0 80px ${COLORS.accentSoft}, 0 20px 60px rgba(0,0,0,0.5)`,
          }}
        >
          <span
            style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 800,
              fontSize: 42,
              color: "#0A0B10",
            }}
          >
            Напишите мне →
          </span>
        </div>

        <div style={{ marginTop: 46 }}>
          <KineticText
            text="создадим ваш вирусный ролик"
            fontSize={34}
            delay={190}
            color={COLORS.textDim}
            weight={600}
          />
        </div>
      </AbsoluteFill>
    </Camera>
  );
};

const Burst: React.FC<{ frame: number; delay: number }> = ({ frame, delay }) => {
  const local = frame - delay;
  if (local < 0 || local > 40) return null;
  const particles = new Array(16).fill(0).map((_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    const dist = interpolate(local, [0, 30], [0, 260], { extrapolateRight: "clamp" });
    const opacity = interpolate(local, [0, 6, 30], [0, 1, 0]);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity };
  });
  return (
    <div style={{ position: "absolute", width: 1, height: 1, top: "58%", left: "50%" }}>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: COLORS.glow,
            opacity: p.opacity,
            transform: `translate(${p.x}px, ${p.y}px)`,
            boxShadow: `0 0 12px ${COLORS.glow}`,
          }}
        />
      ))}
    </div>
  );
};
