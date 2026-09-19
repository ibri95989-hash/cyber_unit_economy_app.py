'use client';

import { cn } from '@/lib/cn';
import { pluralizeRu } from '@/lib/time';
import { FlameIcon } from '@/components/ui/Icon';
import type { Category } from '@/types/azkar';
import type { ProgressSummary, StreakInfo } from '@/types/progress';

interface TodayStatsProps {
  items: Array<{ category: Category; summary: ProgressSummary }>;
  streak: StreakInfo;
  hydrated: boolean;
  className?: string;
}

/**
 * «Сегодня выполнено» + серия дней.
 *
 * Сознательно без агрессивной геймификации: никаких очков, уровней
 * и давящих напоминаний — только спокойная сводка.
 */
export function TodayStats({ items, streak, hydrated, className }: TodayStatsProps) {
  if (!hydrated) {
    return <div className={cn('h-[4.5rem] rounded-card-lg skeleton', className)} />;
  }

  return (
    <section
      aria-label="Сводка за сегодня"
      className={cn('rounded-card-lg border border-line bg-surface p-4 shadow-soft', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.6875rem] font-extrabold tracking-wider text-ink-subtle uppercase">
          Сегодня
        </h2>

        {streak.current > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[0.75rem] font-extrabold text-warning">
            <FlameIcon className="size-3.5" />
            {streak.current} {pluralizeRu(streak.current, ['день', 'дня', 'дней'])} подряд
          </span>
        ) : null}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {items.map(({ category, summary }) => (
          <li key={category.id} className="flex items-center gap-2 text-[0.9375rem] font-bold">
            <span aria-hidden="true">{category.emoji}</span>
            <span className="text-ink">{category.shortTitle}</span>
            {summary.isComplete ? (
              <span className="text-accent" aria-label="выполнено">
                ✅
              </span>
            ) : (
              <span className="tabular-nums text-ink-subtle">
                {summary.completed}/{summary.total}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
