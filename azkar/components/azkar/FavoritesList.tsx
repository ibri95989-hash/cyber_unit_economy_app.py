'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { getAzkarById, getCategoryById } from '@/data';
import { pluralizeRu } from '@/lib/time';
import { useFavorites } from '@/hooks/useFavorites';
import { AzkarListItem } from './AzkarListItem';
import { AzkarCardSkeleton } from '@/components/ui/Skeleton';
import type { Azkar, Category } from '@/types/azkar';

/** Страница избранного. Порядок — как добавляли, новые сверху. */
export function FavoritesList() {
  const { ids, hydrated } = useFavorites();

  const items = useMemo(() => {
    const result: Array<{ azkar: Azkar; category: Category }> = [];
    // Новые добавления показываем первыми.
    for (const id of [...ids].reverse()) {
      const azkar = getAzkarById(id);
      if (!azkar) continue;
      const category = getCategoryById(azkar.category);
      if (!category) continue;
      result.push({ azkar, category });
    }
    return result;
  }, [ids]);

  if (!hydrated) {
    return (
      <div className="container-az pt-2 pb-6 safe-bottom lg:px-0">
        <h1 className="text-[1.75rem] leading-tight font-extrabold text-ink">Избранное</h1>
        <div className="mt-5 flex flex-col gap-3">
          <AzkarCardSkeleton />
          <AzkarCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="container-az pt-2 pb-6 safe-bottom lg:px-0">
      <h1 className="text-[1.75rem] leading-tight font-extrabold text-ink">Избранное</h1>

      {items.length === 0 ? (
        <div className="mt-6 rounded-card-lg border border-dashed border-line-strong px-5 py-10 text-center">
          <p aria-hidden="true" className="text-3xl">
            ❤️
          </p>
          <p className="mt-3 text-[1.0625rem] font-bold text-ink">Здесь пока пусто</p>
          <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] leading-relaxed font-medium text-ink-muted">
            Нажмите на сердечко у любого азкара — и он появится здесь, чтобы всегда быть под рукой.
          </p>
          <Link
            href="/azkar"
            data-custom-focus
            className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-accent px-5 font-bold text-accent-contrast"
          >
            Выбрать раздел
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[0.9375rem] font-medium text-ink-muted">
            {items.length} {pluralizeRu(items.length, ['запись', 'записи', 'записей'])}
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {items.map(({ azkar, category }) => (
              <AzkarListItem key={azkar.id} azkar={azkar} category={category} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
