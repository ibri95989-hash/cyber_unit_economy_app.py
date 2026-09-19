'use client';

import { cn } from '@/lib/cn';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { ProgressSummary } from '@/types/progress';

interface ProgressHeaderProps {
  title: string;
  emoji: string;
  summary: ProgressSummary;
  /** Прогресс ещё не прочитан из localStorage — не показываем нули как факт. */
  hydrated: boolean;
  className?: string;
  /** Прилипает к верху при скролле. */
  sticky?: boolean;
}

/**
 * Шапка раздела с постоянно видимым прогрессом: «8 из 16» и полоса.
 */
export function ProgressHeader({
  title,
  emoji,
  summary,
  hydrated,
  className,
  sticky = true,
}: ProgressHeaderProps) {
  const completed = hydrated ? summary.completed : 0;

  return (
    <div
      className={cn(
        'border-b border-line bg-bg/85 backdrop-blur-md',
        sticky && 'sticky top-0 z-30',
        className,
      )}
    >
      <div className="container-az py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-[0.9375rem] font-extrabold text-ink">
            <span aria-hidden="true" className="text-base">
              {emoji}
            </span>
            <span className="truncate">{title}</span>
          </h2>
          <p className="shrink-0 text-[0.9375rem] font-bold tabular-nums text-ink-muted">
            {completed} <span className="text-ink-subtle">из</span> {summary.total}
          </p>
        </div>

        <ProgressBar
          className="mt-2"
          size="sm"
          value={hydrated ? summary.ratio : 0}
          label={`Прогресс раздела «${title}»: ${completed} из ${summary.total}`}
        />
      </div>
    </div>
  );
}
