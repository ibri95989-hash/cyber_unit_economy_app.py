/**
 * The edit is driven by the voiceover, not the other way round.
 *
 * The recorded VO is one continuous 44.53s take. Its speech runs were measured
 * from the audio itself (see scripts/analyze-voice.mjs), then the take was split
 * at three of those silences into parts that get re-spaced across 60s, so the
 * closing line lands on the logo reveal instead of 14s early. Every cut below
 * sits inside a measured silence — the edit never lands mid-word.
 */

export const FPS = 30;
export const DURATION = 1800; // 60s
export const WIDTH = 1080;
export const HEIGHT = 1920;

const s = (sec: number) => Math.round(sec * FPS);

/** Scene boundaries, in frames. */
export const SCENE = {
  hook: {from: 0, to: 270},
  editing: {from: 270, to: 402},
  motion: {from: 402, to: 618},
  rawPro: {from: 618, to: 804},
  ads: {from: 804, to: 963},
  craft: {from: 963, to: 1053},
  audience: {from: 1053, to: 1206},
  showreel: {from: 1206, to: 1530},
  philosophy: {from: 1530, to: 1680},
  final: {from: 1680, to: 1800},
} as const;

export const dur = (k: keyof typeof SCENE) => SCENE[k].to - SCENE[k].from;

/**
 * Voiceover parts: `trim` is the span taken from the source take, `at` is where
 * that span starts on the timeline. The three gaps let the showreel and the
 * philosophy beat run on score alone.
 */
export const VO_PARTS = [
  {at: s(1.10), trimBefore: s(0), trimAfter: s(18.60)}, // hook → services
  {at: s(21.00), trimBefore: s(18.60), trimAfter: s(37.50)}, // dynamics → audience
  {at: s(52.30), trimBefore: s(37.50), trimAfter: s(44.53)}, // closing line
] as const;

/**
 * Word/phrase cues on the final timeline, in frames. Typography is keyed to
 * these so text lands with the voice.
 */
export const CUE = {
  line1: s(1.17), // «Сегодня недостаточно просто снять хорошее видео.»
  line2: s(4.03), // «Важно то, как оно выглядит после монтажа.»
  iAm: s(6.73), // «Я —»
  name: s(7.9), // «Хайрула.»
  transform: s(8.9), // «Я превращаю обычные кадры…»

  svc1: s(13.5), // «Монтаж.»
  svc2: s(14.6), // «Моушн-графика.»
  svc3: s(16.3), // «Дизайн.»
  svc4: s(17.2), // «Рекламные ролики.»

  dynamics: s(21.37), // «Я создаю динамику…»
  graphics: s(27.13), // «Графику, которая объясняет…»
  everyFrame: s(32.4), // «Каждый переход, каждый элемент…»

  aud1: s(35.3), // «Для бизнеса.»
  aud2: s(36.53), // «Для брендов.»
  aud3: s(37.53), // «Для социальных сетей.»
  aud4: s(39.03), // «Для рекламы.»

  newLevel: s(52.63), // «Если твоему контенту нужен новый уровень.»
  nameFinal: s(55.77), // «Хайрула.»
  taglineA: s(56.87), // «Монтаж,»
  taglineB: s(57.83), // «который работает на тебя.»
} as const;

/** Score hits, so visual accents can land with the audio. */
export const HIT = Object.values(SCENE).map((x) => x.from);
