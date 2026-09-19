import type { Azkar, Category, CategoryId, CategoryWithAzkar } from '@/types/azkar';
import { categories } from './categories';
import { afterPrayerAzkar } from './azkar/after-prayer';
import { eveningAzkar } from './azkar/evening';
import { morningAzkar } from './azkar/morning';
import { prophetDuas } from './azkar/prophet-duas';
import { protectionAzkar } from './azkar/protection';
import { quranDuas } from './azkar/quran-duas';
import { situationsAzkar } from './azkar/situations';
import { sleepAzkar } from './azkar/sleep';
import { wakingAzkar } from './azkar/waking';

/**
 * ЕДИНЫЙ РЕЕСТР КОНТЕНТА.
 *
 * Чтобы добавить новый раздел:
 *  1. Создайте data/azkar/<slug>.ts по образцу существующих.
 *  2. Добавьте описание раздела в data/categories.ts.
 *  3. Добавьте id в CATEGORY_IDS (types/azkar.ts) и импорт в таблицу ниже.
 */
const azkarByCategory: Record<CategoryId, Azkar[]> = {
  morning: morningAzkar,
  evening: eveningAzkar,
  'after-prayer': afterPrayerAzkar,
  sleep: sleepAzkar,
  waking: wakingAzkar,
  protection: protectionAzkar,
  'quran-duas': quranDuas,
  'prophet-duas': prophetDuas,
  situations: situationsAzkar,
};

const categoryBySlug = new Map<string, Category>(categories.map((c) => [c.slug, c]));
const categoryById = new Map<CategoryId, Category>(categories.map((c) => [c.id, c]));

/** Все записи одним плоским списком — для поиска и статистики. */
export const allAzkar: Azkar[] = categories.flatMap((category) => azkarByCategory[category.id]);

const azkarById = new Map<string, Azkar>(allAzkar.map((a) => [a.id, a]));

export { categories, azkarByCategory };

export function getCategories(): readonly Category[] {
  return categories;
}

export function getFeaturedCategories(): Category[] {
  return categories.filter((c) => c.featured);
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return categoryBySlug.get(slug);
}

export function getCategoryById(id: CategoryId): Category | undefined {
  return categoryById.get(id);
}

export function getAzkarByCategory(id: CategoryId): Azkar[] {
  return azkarByCategory[id] ?? [];
}

export function getCategoryWithAzkar(slug: string): CategoryWithAzkar | undefined {
  const category = categoryBySlug.get(slug);
  if (!category) return undefined;
  return { ...category, azkar: azkarByCategory[category.id] };
}

export function getAzkarById(id: string): Azkar | undefined {
  return azkarById.get(id);
}

/** Сколько записей в разделе — используется на карточках главной. */
export function getCategoryCount(id: CategoryId): number {
  return azkarByCategory[id]?.length ?? 0;
}

/** Сводка по достоверности — для страницы «О проекте» и скрипта аудита. */
export function getVerificationStats(): { total: number; verified: number; needsReview: number } {
  const total = allAzkar.length;
  const verified = allAzkar.filter((a) => a.verified).length;
  return { total, verified, needsReview: total - verified };
}
