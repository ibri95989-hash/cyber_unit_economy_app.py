/**
 * Visual system for the reel. Everything on screen pulls from here so the ten
 * scenes read as one piece rather than ten unrelated boards.
 */

export const COLOR = {
  base: '#04050A',
  panel: '#0A0D15',
  panelHi: '#131826',
  line: 'rgba(255,255,255,0.10)',
  lineSoft: 'rgba(255,255,255,0.055)',
  text: '#FFFFFF',
  muted: '#8C96AB',
  dim: '#4C5464',
  accent: '#4DE1FF',
  accent2: '#7B61FF',
  warm: '#FF8A4C',
  good: '#5BF2A8',
} as const;

export const GRADIENT = `linear-gradient(118deg, ${COLOR.accent} 0%, ${COLOR.accent2} 100%)`;

export const FONT = {
  display: "'Unbounded', 'Inter', system-ui, sans-serif",
  ui: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** Canvas is 1080x1920; keep every element inside this margin. */
export const SAFE = 88;

export const TYPE = {
  hero: {
    fontFamily: FONT.display,
    fontWeight: 800,
    fontSize: 148,
    lineHeight: 0.92,
    letterSpacing: '-0.035em',
  },
  display: {
    fontFamily: FONT.display,
    fontWeight: 700,
    fontSize: 104,
    lineHeight: 1.0,
    letterSpacing: '-0.028em',
  },
  title: {
    fontFamily: FONT.display,
    fontWeight: 600,
    fontSize: 64,
    lineHeight: 1.08,
    letterSpacing: '-0.02em',
  },
  body: {
    fontFamily: FONT.ui,
    fontWeight: 500,
    fontSize: 36,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
  },
  label: {
    fontFamily: FONT.ui,
    fontWeight: 600,
    fontSize: 24,
    letterSpacing: '0.24em',
    textTransform: 'uppercase' as const,
  },
  mono: {
    fontFamily: FONT.mono,
    fontWeight: 500,
    fontSize: 21,
    letterSpacing: '0.04em',
  },
} as const;
