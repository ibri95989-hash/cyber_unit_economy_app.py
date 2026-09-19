'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useAzkarProgress } from '@/hooks/useAzkarProgress';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/Button';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, RefreshIcon } from '@/components/ui/Icon';
import { AzkarCard } from './AzkarCard';
import { ProgressHeader } from './ProgressHeader';
import { ReadingModeToggle } from './ReadingModeToggle';
import { ResumeBanner } from './ResumeBanner';
import type { Azkar, Category } from '@/types/azkar';

interface AzkarReaderProps {
  category: Category;
  azkar: Azkar[];
}

/**
 * Экран раздела: прогресс сверху, переключатель режимов, карточки.
 *
 * Режим «Список» — вертикальная лента, «По одному» — один азкар на экран.
 * Выбор режима сохраняется в настройках, поэтому переживает перезагрузку.
 */
export function AzkarReader({ category, azkar }: AzkarReaderProps) {
  const { settings, setSetting } = useSettings();
  const reduceMotion = usePrefersReducedMotion();
  const progress = useAzkarProgress(category.id, azkar);
  const { summary, hydrated } = progress;

  const [rawIndex, setIndex] = useState(0);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  // id азкара, аудио которого нужно запустить само. Ставится только при
  // включённой настройке «Включать следующее аудио».
  const [autoPlayId, setAutoPlayId] = useState<string | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  const mode = settings.readingMode;
  // Позиция выводится, а не синхронизируется эффектом: длина списка может
  // измениться при обновлении контента, и индекс не должен выходить за границы.
  const index = Math.min(rawIndex, Math.max(0, azkar.length - 1));
  const current = azkar[index];

  // Прогресс обнуляется каждый день, поэтому отдельная проверка «свежести» не нужна:
  // если есть незавершённые азкары при начатом чтении — предлагаем продолжить.
  const showResume =
    hydrated &&
    !resumeDismissed &&
    summary.completed > 0 &&
    !summary.isComplete &&
    summary.resumeIndex > 0;

  const scrollToIndex = useCallback(
    (next: number) => {
      const element = cardRefs.current[next];
      if (!element) return;
      element.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    },
    [reduceMotion],
  );

  const goTo = useCallback(
    (next: number, options: { scroll?: boolean } = {}) => {
      const clamped = Math.max(0, Math.min(azkar.length - 1, next));
      setIndex(clamped);
      const target = azkar[clamped];
      if (target) progress.setLastAzkar(target.id);
      if (options.scroll) window.requestAnimationFrame(() => scrollToIndex(clamped));
    },
    [azkar, progress, scrollToIndex],
  );

  // Автопереход после завершения повторов — только если пользователь его не выключил.
  const handleComplete = useCallback(
    (position: number) => {
      if (!settings.autoAdvance) return;
      const next = position + 1;
      if (next >= azkar.length) return;
      window.setTimeout(() => goTo(next, { scroll: mode === 'list' }), 480);
    },
    [settings.autoAdvance, azkar.length, goTo, mode],
  );

  // Аудио закончилось. Следующее включаем только если пользователь это разрешил.
  const handleAudioEnded = useCallback(
    (position: number) => {
      if (!settings.audioAutoplayNext) return;
      const next = azkar[position + 1];
      if (!next) return;
      setAutoPlayId(next.id);
      goTo(position + 1, { scroll: mode === 'list' });
    },
    [settings.audioAutoplayNext, azkar, goTo, mode],
  );

  const handleReset = useCallback(() => {
    progress.reset();
    setResumeDismissed(true);
    setIndex(0);
    if (mode === 'list') window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [progress, mode, reduceMotion]);

  const counters = useMemo(
    () => azkar.map((item) => progress.counterFor(item.id)),
    [azkar, progress],
  );

  return (
    <div>
      <ProgressHeader
        title={category.title}
        emoji={category.emoji}
        summary={summary}
        hydrated={hydrated}
      />

      <div className="container-az pt-4">
        <ReadingModeToggle value={mode} onChange={(next) => setSetting('readingMode', next)} />

        {showResume && current ? (
          <ResumeBanner
            className="mt-3"
            number={summary.resumeIndex + 1}
            onResume={() => {
              setResumeDismissed(true);
              goTo(summary.resumeIndex, { scroll: mode === 'list' });
            }}
            onDismiss={() => setResumeDismissed(true)}
          />
        ) : null}

        {hydrated && summary.isComplete ? (
          <div className="animate-fade-up mt-3 flex flex-wrap items-center gap-3 rounded-card-lg border border-accent-soft-strong bg-accent-soft px-4 py-3.5">
            <p className="flex min-w-[10rem] flex-1 items-center gap-2 text-[0.9375rem] font-bold text-ink">
              <CheckIcon className="size-5 shrink-0 text-accent" />
              Раздел прочитан полностью
            </p>
            <Button variant="secondary" size="sm" onClick={handleReset}>
              <RefreshIcon className="size-4" />
              Начать заново
            </Button>
          </div>
        ) : null}
      </div>

      {mode === 'list' ? (
        <div className="container-az flex flex-col gap-4 pt-4 safe-bottom">
          {azkar.map((item, position) => (
            <AzkarCard
              key={item.id}
              ref={(element) => {
                cardRefs.current[position] = element;
              }}
              azkar={item}
              number={position + 1}
              total={azkar.length}
              categorySlug={category.slug}
              counter={counters[position] ?? { count: 0, done: false }}
              onIncrement={() => progress.increment(item.id, item.repetitions)}
              onReset={() => progress.resetOne(item.id)}
              onComplete={() => handleComplete(position)}
              autoPlayAudio={autoPlayId === item.id}
              onAudioEnded={() => handleAudioEnded(position)}
            />
          ))}

          <div className="mt-2 flex justify-center pb-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RefreshIcon className="size-4" />
              Начать раздел заново
            </Button>
          </div>
        </div>
      ) : (
        <div className="container-az pt-4 safe-bottom">
          {current ? (
            <AzkarCard
              key={current.id}
              azkar={current}
              number={index + 1}
              total={azkar.length}
              categorySlug={category.slug}
              counter={counters[index] ?? { count: 0, done: false }}
              onIncrement={() => progress.increment(current.id, current.repetitions)}
              onReset={() => progress.resetOne(current.id)}
              onComplete={() => handleComplete(index)}
              autoPlayAudio={autoPlayId === current.id}
              onAudioEnded={() => handleAudioEnded(index)}
              variant="single"
            />
          ) : null}

          <nav
            aria-label="Навигация по азкарам"
            className={cn(
              'sticky z-20 mt-4 flex items-center gap-3 rounded-card-lg border border-line',
              'bg-surface p-2 shadow-float',
            )}
            style={{
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--az-bottom-nav-h) + 0.5rem)',
            }}
          >
            <Button
              variant="secondary"
              size="md"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Предыдущий азкар"
              className="flex-1"
            >
              <ArrowLeftIcon className="size-5" />
              Назад
            </Button>

            <span className="shrink-0 px-1 text-[0.9375rem] font-extrabold tabular-nums text-ink-muted">
              {index + 1} / {azkar.length}
            </span>

            <Button
              variant="secondary"
              size="md"
              onClick={() => goTo(index + 1)}
              disabled={index >= azkar.length - 1}
              aria-label="Следующий азкар"
              className="flex-1"
            >
              Далее
              <ArrowRightIcon className="size-5" />
            </Button>
          </nav>
        </div>
      )}
    </div>
  );
}
