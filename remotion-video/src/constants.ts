export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const TOTAL_FRAMES = 1306; // 43.5s

// Design system
export const COLORS = {
  bg: "#0A0B10",
  bgSoft: "#12141C",
  panel: "rgba(255,255,255,0.06)",
  panelBorder: "rgba(255,255,255,0.12)",
  text: "#F5F6FA",
  textDim: "rgba(245,246,250,0.62)",
  accent: "#7C5CFF", // single premium accent (electric violet)
  accentSoft: "rgba(124,92,255,0.22)",
  danger: "#FF5C6C",
  glow: "#9C8CFF",
};

export const FONT_FAMILY =
  "'Inter', 'Helvetica Neue', Arial, sans-serif";

// Safe zone for 9:16 reels UI (avoid platform overlays)
export const SAFE_TOP = 220;
export const SAFE_BOTTOM = 340;
export const SAFE_SIDE = 64;

// Scene boundaries (in frames), derived from voiceover timing.
export const SCENES = {
  hook: { from: 0, durationInFrames: 110 },
  problem: { from: 110, durationInFrames: 341 },
  process: { from: 451, durationInFrames: 329 },
  relief: { from: 780, durationInFrames: 123 },
  proof: { from: 903, durationInFrames: 160 },
  payoff: { from: 1063, durationInFrames: 243 },
};
