import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, WIDTH, HEIGHT } from "../constants";
import { UIElement } from "../components/UIElement";
import { ProgressBar } from "../components/ProgressBar";
import { Arrow } from "../components/Arrow";
import { Camera } from "../components/Camera";

/**
 * PROBLEM -> ESCALATION (110-451f): split-screen. Left = competitors,
 * rising engagement chart + tech chips flying in. Right = "you", a flat
 * line and a thumb swiping away. The visual tension mirrors the line
 * "конкуренты цепляют внимание ... ваши клиенты листают дальше".
 */
export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const midX = WIDTH / 2;

  const dividerGrow = interpolate(frame, [0, 20], [0, HEIGHT], {
    extrapolateRight: "clamp",
  });

  const swipeX = interpolate(frame % 90, [0, 45, 90], [0, -140, 0]);

  return (
    <Camera localFrame={frame} durationInFrames={341} direction="out">
      <AbsoluteFill>
        {/* vertical divider drawing down the middle */}
        <div
          style={{
            position: "absolute",
            left: midX - 1,
            top: 0,
            width: 2,
            height: dividerGrow,
            background:
              "linear-gradient(180deg, transparent, rgba(255,255,255,0.35), transparent)",
          }}
        />

        {/* LEFT: competitors winning */}
        <UIElement x={64} y={300} delay={2} from="left" style={{ width: 380 }}>
          <div style={{ fontSize: 24, color: COLORS.textDim, marginBottom: 14 }}>
            Конкуренты
          </div>
          <ProgressBar widthPx={340} delay={10} label="Вовлечённость" />
        </UIElement>

        <UIElement x={70} y={470} delay={30} from="left" style={{ width: 300 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["Графика", "Динамика", "AI"].map((t, i) => (
              <span
                key={t}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: COLORS.accentSoft,
                  color: COLORS.accent,
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </UIElement>

        {/* rising bar chart, left side, appears mid-scene */}
        <ChartRise frame={frame} baseX={110} baseY={1180} delay={90} />

        {/* RIGHT: you, losing attention */}
        <UIElement x={WIDTH - 64 - 380} y={300} delay={140} from="right" style={{ width: 380 }}>
          <div style={{ fontSize: 24, color: COLORS.textDim, marginBottom: 14 }}>
            Ваш бизнес
          </div>
          <ProgressBar widthPx={70} delay={150} color={COLORS.danger} label="Вовлечённость" />
        </UIElement>

        {/* phone with thumb swiping away, right lower area */}
        <div
          style={{
            position: "absolute",
            right: 90,
            top: 760,
            width: 300,
            height: 520,
            borderRadius: 34,
            border: `2px solid ${COLORS.panelBorder}`,
            background: "rgba(255,255,255,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 40 + swipeX,
              height: 220,
              margin: "0 16px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 300 + swipeX,
              height: 220,
              margin: "0 16px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.08)",
            }}
          />
        </div>

        <Arrow
          x1={WIDTH - 210}
          y1={720}
          x2={WIDTH - 130}
          y2={800}
          delay={170}
          color={COLORS.danger}
        />
      </AbsoluteFill>
    </Camera>
  );
};

const ChartRise: React.FC<{ frame: number; baseX: number; baseY: number; delay: number }> = ({
  frame,
  baseX,
  baseY,
  delay,
}) => {
  const bars = [40, 70, 110, 160, 220];
  const local = Math.max(0, frame - delay);
  return (
    <div style={{ position: "absolute", left: baseX, top: baseY - 220, display: "flex", gap: 14, alignItems: "flex-end", height: 220 }}>
      {bars.map((h, i) => {
        const grown = interpolate(local, [i * 5, i * 5 + 18], [0, h], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              width: 26,
              height: grown,
              borderRadius: 8,
              background: `linear-gradient(180deg, ${COLORS.accent}, ${COLORS.accentSoft})`,
              boxShadow: `0 0 20px ${COLORS.accentSoft}`,
              alignSelf: "flex-end",
            }}
          />
        );
      })}
    </div>
  );
};
