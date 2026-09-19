/**
 * Модель контента приложения AZKAR.
 *
 * Принцип: контент никогда не «зашивается» в компоненты. Все азкары живут
 * в data/azkar/*.ts и типизируются здесь.
 */

/** Идентификаторы разделов. Совпадают с URL-сегментами (/morning, /evening, ...). */
export const CATEGORY_IDS = [
  'morning',
  'evening',
  'after-prayer',
  'sleep',
  'waking',
  'protection',
  'quran-duas',
  'prophet-duas',
  'situations',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Статус проверки записи. Показывается пользователю. */
export type VerificationStatus = 'verified' | 'needs_review';

/** Откуда взят текст. */
export type SourceKind = 'quran' | 'hadith' | 'unknown';

export interface AzkarSource {
  kind: SourceKind;
  /** Основной сборник: «Коран», «Сахих Муслим», «Сунан Абу Дауда». */
  collection: string;
  /**
   * Точная ссылка: «2:255» для Корана, номер хадиса для сунны.
   * Оставляем пустым, если номер достоверно не установлен — выдумывать нельзя.
   */
  reference?: string;
}

export interface Azkar {
  /** Стабильный идентификатор вида `morning-01`. Используется в прогрессе и избранном. */
  id: string;
  category: CategoryId;
  /** Порядок внутри раздела, начиная с 1. */
  order: number;
  /** Короткое название для поиска, «Поделиться» и списков. */
  title: string;
  /** Арабский текст с огласовками. */
  arabic: string;
  /** Смысловой перевод на русский. */
  translation: string;
  /** Транскрипция кириллицей. */
  transliteration: string;
  /** Сколько раз читается. */
  repetitions: number;
  source: AzkarSource;
  /** Свободное уточнение источника для пользователя. */
  sourceDetails?: string;
  /** Путь к аудио. Пусто = аудио ещё не записано. */
  audioUrl?: string;
  /** Теги для поиска: «защита», «утро», «прощение». */
  tags: string[];
  /**
   * true — текст и источник выверены вручную.
   * false — запись требует проверки, интерфейс честно это показывает.
   */
  verified: boolean;
  /** Что именно нужно проверить. Видно редактору, не пользователю. */
  reviewNote?: string;
}

/** Визуальный акцент карточки раздела. */
export type CategoryAccent = 'emerald' | 'indigo' | 'amber' | 'violet' | 'rose' | 'teal' | 'slate';

export interface Category {
  id: CategoryId;
  /** URL-сегмент: /morning */
  slug: string;
  title: string;
  /** Короткое имя для навигации и чипов. */
  shortTitle: string;
  description: string;
  emoji: string;
  accent: CategoryAccent;
  /** Показывать ли раздел на главной крупной карточкой. */
  featured: boolean;
  /** Привязка к времени суток для умного приветствия. */
  timeOfDay?: 'morning' | 'evening' | 'night';
  seo: {
    title: string;
    description: string;
  };
}

export interface CategoryWithAzkar extends Category {
  azkar: Azkar[];
}

/** Результат глобального поиска. */
export interface SearchResult {
  azkar: Azkar;
  category: Category;
  /** Чем именно совпало — для подсветки причины. */
  matchedOn: 'title' | 'translation' | 'source' | 'tag' | 'category' | 'transliteration';
  score: number;
}

/** Производный статус проверки. Единственный источник правды — поле `verified`. */
export function verificationStatus(azkar: Pick<Azkar, 'verified'>): VerificationStatus {
  return azkar.verified ? 'verified' : 'needs_review';
}
