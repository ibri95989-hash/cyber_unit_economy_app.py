import envelope from './voiceEnvelope.json';
import {VO_PARTS, FPS} from './timing';

const ENV = envelope as number[];

/**
 * Loudness of the voice at a timeline frame, 0..1, accounting for how the take
 * was re-spaced. Lets type and geometry react to the actual voice rather than
 * to an arbitrary sine.
 */
export const voiceAt = (frame: number): number => {
  for (const p of VO_PARTS) {
    const len = p.trimAfter - p.trimBefore;
    if (frame >= p.at && frame < p.at + len) {
      return ENV[p.trimBefore + (frame - p.at)] ?? 0;
    }
  }
  return 0;
};

/** Smoothed voice level — better for driving scale than the raw envelope. */
export const voiceSmooth = (frame: number, window = 3): number => {
  let sum = 0;
  let n = 0;
  for (let i = -window; i <= window; i++) {
    sum += voiceAt(frame + i);
    n++;
  }
  return sum / n;
};

export const SECOND = FPS;
