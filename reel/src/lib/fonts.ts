import {staticFile, continueRender, delayRender} from 'remotion';
import {FONT_FACES} from './fontFaces';

let started = false;

/**
 * Loads the self-hosted faces and blocks the first frame until they are ready —
 * a frame rendered with a fallback face would ship crooked type, which is
 * exactly what this reel cannot have.
 *
 * Each face is constructed explicitly through the FontFace API rather than left
 * to the CSS font loader: every promise here resolves or rejects on its own, so
 * one slow face cannot leave the render waiting. (A setTimeout guard would not
 * help — Remotion drives the page clock, so timers do not advance while a
 * delayRender is outstanding.)
 */
export const loadFonts = () => {
  if (typeof document === 'undefined' || started) return;
  started = true;

  const handle = delayRender('Loading fonts', {timeoutInMilliseconds: 120000});

  const loads = FONT_FACES.map((f) => {
    const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)})`, {
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
