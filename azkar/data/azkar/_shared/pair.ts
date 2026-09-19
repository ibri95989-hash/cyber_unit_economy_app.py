import type { Azkar, AzkarSource, CategoryId } from '@/types/azkar';

/**
 * Утренние и вечерние азкары почти полностью совпадают: меняется
 * «أَصْبَحْنَا» на «أَمْسَيْنَا» и «этот день» на «эту ночь».
 *
 * Чтобы тексты не разъезжались при редактировании, общая часть живёт здесь,
 * а data/azkar/morning.ts и data/azkar/evening.ts только разворачивают её.
 */

export type Slot = 'morning' | 'evening';

/** Значение либо одинаковое для обоих времён, либо своё для каждого. */
export type SlotValue<T> = T | Record<Slot, T>;

export interface MorningEveningPair {
  /** Часть будущего id: `morning-<key>`. Меняя key, вы сбросите прогресс у пользователей. */
  key: string;
  title: SlotValue<string>;
  arabic: SlotValue<string>;
  transliteration: SlotValue<string>;
  translation: SlotValue<string>;
  repetitions: SlotValue<number>;
  source: AzkarSource;
  sourceDetails?: string;
  tags: string[];
  verified: boolean;
  reviewNote?: string;
  /** Ограничить запись одним временем суток. По умолчанию — оба. */
  only?: Slot;
}

function resolve<T>(value: SlotValue<T>, slot: Slot): T {
  if (value !== null && typeof value === 'object' && slot in (value as Record<string, unknown>)) {
    return (value as Record<Slot, T>)[slot];
  }
  return value as T;
}

/** Разворачивает список пар в готовые записи для одного времени суток. */
export function expandPairs(
  pairs: readonly MorningEveningPair[],
  slot: Slot,
  category: CategoryId,
  startOrder = 1,
): Azkar[] {
  return pairs
    .filter((pair) => !pair.only || pair.only === slot)
    .map((pair, index) => ({
      id: `${category}-${pair.key}`,
      category,
      order: startOrder + index,
      title: resolve(pair.title, slot),
      arabic: resolve(pair.arabic, slot),
      transliteration: resolve(pair.transliteration, slot),
      translation: resolve(pair.translation, slot),
      repetitions: resolve(pair.repetitions, slot),
      source: pair.source,
      ...(pair.sourceDetails ? { sourceDetails: pair.sourceDetails } : {}),
      tags: [...pair.tags, slot === 'morning' ? 'утро' : 'вечер'],
      verified: pair.verified,
      ...(pair.reviewNote ? { reviewNote: pair.reviewNote } : {}),
    }));
}
