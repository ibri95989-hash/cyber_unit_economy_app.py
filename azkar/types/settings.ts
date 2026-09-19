/** Пользовательские настройки. Хранятся в localStorage, готовы к синхронизации с бэкендом. */

export type ThemePreference = 'auto' | 'light' | 'dark';

/** Шаг размера шрифта: -2 … +3 относительно базового. */
export type FontScaleStep = -2 | -1 | 0 | 1 | 2 | 3;

export type PlaybackRate = 0.75 | 1 | 1.25;

export type ReadingMode = 'list' | 'single';

export interface Settings {
  theme: ThemePreference;
  arabicFontStep: FontScaleStep;
  translationFontStep: FontScaleStep;
  showTranslation: boolean;
  showTransliteration: boolean;
  /** Транскрипция раскрыта сразу, а не под кнопкой «Показать транскрипцию». */
  expandTransliterationByDefault: boolean;
  vibration: boolean;
  /** Автопереход к следующему азкару после завершения повторов. */
  autoAdvance: boolean;
  /** Автозапуск следующего аудио. По умолчанию выключен — этого требует UX. */
  audioAutoplayNext: boolean;
  playbackRate: PlaybackRate;
  readingMode: ReadingMode;
  /** Язык интерфейса. Задел под i18n, сейчас всегда 'ru'. */
  locale: string;
}
