import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLOR, GRADIENT, TYPE} from '../lib/theme';
import {EASE, ramp, tween} from '../lib/motion';

type Style = React.CSSProperties;

/**
 * A line of display type that assembles word by word. Words translate and fade
 * only — never scaled on one axis, never skewed — so letterforms stay exact.
 */
export const KineticLine: React.FC<{
  text: string;
  start: number;
  stagger?: number;
  rise?: number;
  style?: Style;
  wordStyle?: Style;
  align?: 'left' | 'center' | 'right';
  gradientWords?: number[];
}> = ({
  text,
  start,
  stagger = 3,
  rise = 46,
  style,
  wordStyle,
  align = 'left',
  gradientWords = [],
}) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0 0.28em',
        justifyContent:
          align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        ...TYPE.display,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const t = ramp(frame, start + i * stagger, 16, EASE.out);
        const grad = gradientWords.includes(i);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: t,
              transform: `translate3d(0, ${(1 - t) * rise}px, 0)`,
              ...(grad
                ? {
                    backgroundImage: GRADIENT,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }
                : null),
              ...wordStyle,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Letters converge from scattered positions into their final places. Positions
 * are deterministic and the end state is exact, so nothing lands crooked.
 */
export const AssembleWord: React.FC<{
  text: string;
  start: number;
  duration?: number;
  stagger?: number;
  style?: Style;
  spread?: number;
}> = ({text, start, duration = 26, stagger = 1.6, style, spread = 190}) => {
  const frame = useCurrentFrame();
  const chars = text.split('');
  return (
    <div style={{display: 'flex', justifyContent: 'center', ...TYPE.hero, ...style}}>
      {chars.map((c, i) => {
        const seed = i * 2.399;
        const t = ramp(frame, start + i * stagger, duration, EASE.out);
        const dx = Math.cos(seed) * spread * (1 - t);
        const dy = Math.sin(seed * 1.7) * spread * 0.55 * (1 - t);
        const blur = (1 - t) * 9;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: t,
              transform: `translate3d(${dx}px, ${dy}px, 0)`,
              filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
              whiteSpace: 'pre',
            }}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
};

/** Small tracked-out caption used as a section marker. */
export const Label: React.FC<{
  children: React.ReactNode;
  start?: number;
  color?: string;
  style?: Style;
}> = ({children, start = 0, color = COLOR.muted, style}) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, start, 14, EASE.out);
  return (
    <div
      style={{
        ...TYPE.label,
        color,
        opacity: t,
        transform: `translate3d(0, ${(1 - t) * 14}px, 0)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Thin rule that draws itself out from one edge. */
export const Rule: React.FC<{
  start: number;
  width: number | string;
  duration?: number;
  color?: string;
  thickness?: number;
  style?: Style;
}> = ({start, width, duration = 22, color = COLOR.line, thickness = 1, style}) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, start, duration, EASE.out);
  return (
    <div
      style={{
        width,
        height: thickness,
        background: color,
        transform: `scaleX(${t})`,
        transformOrigin: 'left center',
        ...style,
      }}
    />
  );
};

/** Monospaced technical readout (timecodes, counters). */
export const Mono: React.FC<{children: React.ReactNode; style?: Style}> = ({
  children,
  style,
}) => <div style={{...TYPE.mono, color: COLOR.dim, ...style}}>{children}</div>;

/**
 * Wipes a block in behind a moving mask. Used for the RAW → PRO reveal, where a
 * cross-fade would look cheap.
 */
export const MaskWipe: React.FC<{
  children: React.ReactNode;
  start: number;
  duration?: number;
  angle?: number;
  from?: 'left' | 'right';
}> = ({children, start, duration = 24, from = 'left'}) => {
  const frame = useCurrentFrame();
  const t = tween(frame, [start, start + duration], [0, 100], EASE.inOut);
  const grad =
    from === 'left'
      ? `linear-gradient(90deg, #000 ${t}%, transparent ${t + 6}%)`
      : `linear-gradient(270deg, #000 ${t}%, transparent ${t + 6}%)`;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        WebkitMaskImage: grad,
        maskImage: grad,
      }}
    >
      {children}
    </div>
  );
};
