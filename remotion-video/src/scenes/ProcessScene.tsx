import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, WIDTH, FONT_FAMILY } from "../constants";
import { Arrow } from "../components/Arrow";
import { Camera } from "../components/Camera";

const STEPS = [
  { label: "Идея", sub: "цепляющая" },
  { label: "Сценарий", sub: "" },
  { label: "Визуал", sub: "с ИИ" },
  { label: "Озвучка", sub: "профессиональная" },
  { label: "Монтаж", sub: "" },
  { label: "Субтитры", sub: "" },
];

/**
 * INSIGHT (451-780f): the service turns into a visible pipeline — six
 * nodes connected by drawn arrows, each popping in as its keyword is
 * spoken, so process = one continuous causal chain, not a list.
 */
export const ProcessScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const nodeW = 300;
  const nodeH = 118;
  const gapY = 34;
  const startY = 210;
  const cx = WIDTH / 2;

  const perStep = 50;

  return (
    <Camera localFrame={frame} durationInFrames={329} direction="pan-right">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            top: 90,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: FONT_FAMILY,
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.textDim,
            letterSpacing: 2,
          }}
        >
          РИЛС ПОД КЛЮЧ
        </div>

        {STEPS.map((step, i) => {
          const delay = i * perStep;
          const y = startY + i * (nodeH + gapY);
          const s = spring({
            frame: frame - delay,
            fps,
            config: { damping: 11, mass: 0.7, stiffness: 190 },
          });
          const scale = interpolate(s, [0, 1], [0.4, 1]);
          const opacity = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
          const glow = interpolate(
            frame - delay,
            [0, 10, 26],
            [0, 1, 0.35],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <React.Fragment key={step.label}>
              {i > 0 && (
                <Arrow
                  x1={cx}
                  y1={y - gapY - 8}
                  x2={cx}
                  y2={y + 6}
                  delay={delay - 14}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  left: cx - nodeW / 2,
                  top: y,
                  width: nodeW,
                  height: nodeH,
                  borderRadius: 22,
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.panelBorder}`,
                  backdropFilter: "blur(16px)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${scale})`,
                  opacity,
                  boxShadow: `0 0 ${40 * glow}px ${COLORS.accentSoft}`,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 40,
                    fontWeight: 800,
                    color: COLORS.text,
                  }}
                >
                  {step.label}
                </div>
                {step.sub ? (
                  <div
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: 20,
                      color: COLORS.accent,
                      marginTop: 4,
                    }}
                  >
                    {step.sub}
                  </div>
                ) : null}
                <div
                  style={{
                    position: "absolute",
                    left: -18,
                    top: -18,
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: COLORS.accent,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 20,
                    fontFamily: FONT_FAMILY,
                    boxShadow: `0 0 20px ${COLORS.accentSoft}`,
                  }}
                >
                  {i + 1}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
    </Camera>
  );
};
