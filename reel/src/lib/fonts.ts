import {continueRender, delayRender} from 'remotion';
import fontData from './fontData.json';

type Face = {
  family: string;
  weight: number;
  unicodeRange: string;
  data: string;
};

let started = false;

/**
 * Loads the display faces and blocks the first frame until they are ready — a
 * frame rendered with a fallback face would ship crooked type, which is exactly
 * what this reel cannot have.
 *
 * The faces are embedded as data URIs (scripts/embed-fonts.mjs), so loading
 * never touches the network: fetching them over the asset server intermittently
 * stalled a freshly-opened render page, and a stalled delayRender kills the
 * render hundreds of frames in. A setTimeout guard is not an option either —
 * Remotion drives the page clock, so timers do not advance while a delayRender
 * is outstanding. Removing the network is the only fix that actually holds.
 */
export const loadFonts = () => {
  if (typeof document === 'undefined' || started) return;
  started = true;

  const handle = delayRender('Loading fonts', {timeoutInMilliseconds: 120000});

  const loads = (fontData.faces as Face[]).map((f) => {
    const face = new FontFace(f.family, `url(${f.data})`, {
      weight: String(f.weight),
      style: 'normal',
      unicodeRange: f.unicodeRange,
      display: 'block',
    });
    return face
      .load()
      .then((loaded) => {
        // FontFaceSet.add is missing from the DOM lib this project targets.
        (document.fonts as unknown as {add: (face: FontFace) => void}).add(loaded);
      })
      .catch(() => undefined);
  });

  Promise.all(loads).then(() => continueRender(handle));
};
