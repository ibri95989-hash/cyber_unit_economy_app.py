'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { accentStyle } from '@/lib/accents';
import { pluralizeRu } from '@/lib/time';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ArrowRightIcon, CheckIcon } from '@/components/ui/Icon';
import type { Category } from '@/types/azkar';
import type { ProgressSummary } from '@/types/progress';

interface CategoryCardProps {
  category: Category;
  count: number;
  summary?: ProgressSummary | undefined;
  hydrated?: boolean;
  /** 'hero' — крупная карточка на главной, 'compact' — плитка в сетке. */
  variant?: 'hero' | 'compact';
  className?: string;
}

/**
 * Карточка раздела.
 *
 * Крупная — для двух главных разделов текущего времени суток,
 * компактная — для остальных. Иерархия важнее единообразия:
 * сетка из одинаковых плиток выглядит шаблонно.
 */
export function CategoryCard({
  category,
  count,
  summary,
  hydrated = false,
  variant = 'compact',
  className,
}: CategoryCardProps) {
  const started = hydrated && summary && summary.completed > 0;
  const complete = hydrated && summary?.isComplete;
  const actionLabel = complete ? 'Прочитано' : started ? 'Продолжить' : 'Начать';

  if (variant === 'hero') {
    return (
      <Link
        href={`/${category.slug}`}
        data-custom-focus
        className={cn(
          'group block rounded-card-xl border border-line bg-surface p-5 shadow-card',
          'transition-[transform,box-shadow] duration-200 hover:shadow-float active:scale-[0.99]',
          className,
        )}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            style={accentStyle(category.accent)}
            className="accent-chip inline-flex size-14 shrink-0 items-center justify-center rounded-2xl text-[1.75rem]"
          >
            {category.emoji}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="text-[1.25rem] leading-tight font-extrabold text-ink">
              {category.title}
            </h3>
            <p className="mt-1 text-[0.875rem] font-semibold text-ink-muted">
              {count} {pluralizeRu(count, ['азкар', 'азкара', 'азкаров'])}
            </p>
          </div>

          {complete ? (
            <span
              aria-hidden="true"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
            >
              <CheckIcon className="size-4" />
            </span>
          ) : null}
        </div>

        {started && summary ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[0.8125rem] font-bold text-ink-muted">
                {summary.completed} из {summary.total}
              </span>
              <span className="text-[0.8125rem] font-bold text-accent">
                {Math.round(summary.ratio * 100)}%
              </span>
            </div>
            <ProgressBar value={summary.ratio} size="sm" label={`Прогресс: ${category.title}`} />
          </div>
        ) : null}

        <span className="mt-4 inline-flex items-center gap-1.5 text-[0.9375rem] font-extrabold text-accent">
          {actionLabel}
          <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/${category.slug}`}
      data-custom-focus
      className={cn(
        'group flex min-h-[6.5rem] flex-col justify-between rounded-card-lg border border-line',
        'bg-surface p-4 shadow-soft transition-[transform,box-shadow] duration-200',
        'hover:shadow-card active:scale-[0.98]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          style={accentStyle(category.accent)}
          className="accent-chip inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-xl"
        >
          {category.emoji}
        </span>
        {complete ? (
          <span
            aria-hidden="true"
            className="inline-flex size-6 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <CheckIcon className="size-3.5" />
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        <h3 className="text-[0.9375rem] leading-tight font-extrabold text-ink">
          {category.shortTitle}
        </h3>
        <p className="mt-0.5 text-[0.75rem] font-semibold text-ink-subtle">
          {started && summary && !complete
            ? `${summary.completed} из ${summary.total}`
            : `${count} ${pluralizeRu(count, ['азкар', 'азкара', 'азкаров'])}`}
        </p>
      </div>
    </Link>
  );
}
