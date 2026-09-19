import type { Azkar, CategoryId } from '@/types/azkar';
import type { QuranPassage } from './quran';

/** Входные данные записи: без id, category и order — их проставляет `defineAzkar`. */
export type AzkarInput = Omit<Azkar, 'id' | 'category' | 'order'> & {
  /** Часть будущего id: `<category>-<key>`. Менять нельзя — сбросит прогресс пользователей. */
  key: string;
};

/**
 * Проставляет id, категорию и порядок. Единственный способ создавать записи —
 * так порядок всегда соответствует положению в массиве.
 */
export function defineAzkar(category: CategoryId, entries: readonly AzkarInput[]): Azkar[] {
  return entries.map(({ key, ...rest }, index) => ({
    ...rest,
    id: `${category}-${key}`,
    category,
    order: index + 1,
  }));
}

/** Превращает коранический отрывок в запись раздела. Такие записи проверены по определению. */
export function fromQuran(
  passage: QuranPassage,
  options: { key: string; repetitions: number; tags: string[]; title?: string },
): AzkarInput {
  return {
    key: options.key,
    title: options.title ?? passage.title,
    arabic: passage.arabic,
    transliteration: passage.transliteration,
    translation: passage.translation,
    repetitions: options.repetitions,
    source: { kind: 'quran', collection: 'Коран', reference: passage.reference },
    sourceDetails: passage.sourceDetails,
    tags: options.tags,
    verified: true,
  };
}

/** Общая пометка: текст известен, номер хадиса не проставлен. */
export const REF_PENDING =
  'Номер хадиса не проставлен намеренно: сверьте его по печатному изданию сборника перед тем, как отмечать запись проверенной.';
