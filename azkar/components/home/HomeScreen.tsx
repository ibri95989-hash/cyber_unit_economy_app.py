'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { getAzkarByCategory } from '@/data';
import { summarize } from '@/lib/progress';
import { SUGGESTED_BY_DAY_PART } from '@/lib/time';
import { useDayPart } from '@/hooks/useClock';
import { useProgressStore } from '@/hooks/useAzkarProgress';
import { SearchIcon } from '@/components/ui/Icon';
import { CategoryCard } from './CategoryCard';
import { TodayStats } from './TodayStats';
import { WelcomeBlock } from './WelcomeBlock';
import type { Category, CategoryId } from '@/types/azkar';

interface HomeScreenProps {
  categories: Category[];
  counts: Record<string, number>;
}

/**
 * Главный экран.
 *
 * Иерархия сознательная: сначала один крупный блок под текущее время суток,
 * затем парный к нему, и только потом сетка остальных разделов.
 */
export function HomeScreen({ categories, counts }: HomeScreenProps) {
  const store = useProgressStore();
  const dayPart = useDayPart();
  // До гидрации показываем утренний порядок — он же используется в разметке сервера.
  const suggested: CategoryId = dayPart ? SUGGESTED_BY_DAY_PART[dayPart] : 'morning';

  const summaries = useMemo(() => {
    const result: Record<string, ReturnType<typeof summarize>> = {};
    for (const category of categories) {
      result[category.id] = summarize(
        getAzkarByCategory(category.id),
        store.getCategoryProgress(category.id),
      );
    }
    return result;
  }, [categories, store]);

  const heroIds: CategoryId[] = suggested === 'evening' ? ['evening', 'morning'] : ['morning', 'evening'];
  const heroes = heroIds
    .map((id) => categories.find((category) => category.id === id))
    .filter((category): category is Category => Boolean(category));
  const rest = categories.filter((category) => !heroIds.includes(category.id));

  const todayItems = heroes.map((category) => ({
    category,
    summary: summaries[category.id] ?? { completed: 0, total: 0, ratio: 0, isComplete: false, resumeIndex: 0 },
  }));

  return (
    <div className="container-az pt-1 pb-6 safe-bottom lg:px-0">
      <WelcomeBlock />

      <Link
        href="/search"
        data-custom-focus
        className="mt-4 flex min-h-12 w-full items-center gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 text-[0.9375rem] font-semibold text-ink-subtle transition-colors hover:bg-surface-3"
      >
        <SearchIcon className="size-[1.125rem] shrink-0" />
        Найти дуа — например, «защита»
      </Link>

      <TodayStats
        className="mt-4"
        items={todayItems}
        streak={store.streak}
        hydrated={store.hydrated}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
        {heroes.map((category, position) => (
          <CategoryCard
            key={category.id}
            category={category}
            count={counts[category.id] ?? 0}
            summary={summaries[category.id]}
            hydrated={store.hydrated}
            variant="hero"
            className={position === 0 ? 'sm:flex-1' : 'sm:flex-1'}
          />
        ))}
      </div>

      <h2 className="mt-7 mb-3 text-[0.6875rem] font-extrabold tracking-wider text-ink-subtle uppercase">
        Остальные разделы
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rest.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            count={counts[category.id] ?? 0}
            summary={summaries[category.id]}
            hydrated={store.hydrated}
          />
        ))}

        <Link
          href="/favorites"
          data-custom-focus
          className="group flex min-h-[6.5rem] flex-col justify-between rounded-card-lg border border-dashed border-line-strong bg-transparent p-4 transition-colors hover:bg-surface-2"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-10 items-center justify-center rounded-xl bg-danger-soft text-xl"
          >
            ❤️
          </span>
          <span className="mt-3 block">
            <span className="block text-[0.9375rem] leading-tight font-extrabold text-ink">
              Избранное
            </span>
            <span className="mt-0.5 block text-[0.75rem] font-semibold text-ink-subtle">
              Ваши закладки
            </span>
          </span>
        </Link>
      </div>

      <p className="mt-8 text-[0.8125rem] leading-relaxed font-medium text-ink-subtle">
        Прогресс сохраняется на этом устройстве и обнуляется каждый день.{' '}
        <Link href="/about" className="font-bold text-accent underline underline-offset-2">
          О достоверности текстов
        </Link>
      </p>
    </div>
  );
}
