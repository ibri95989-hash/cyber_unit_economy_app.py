'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { COUNTER_TAP_COOLDOWN_MS } from '@/lib/constants';
import { vibrateComplete, vibrateTick } from '@/lib/haptics';
import { useSettings } from '@/hooks/useSettings';
import { CheckIcon, RefreshIcon } from '@/components/ui/Icon';

interface CounterButtonProps {
  count: number;
  total: number;
  done: boolean;
  /** Должен вернуть новое состояние счётчика — от него зависит анимация завершения. */
  onIncrement: () => { count: number; done: boolean };
  onReset: () => void;
  /** Вызывается один раз в момент достижения нужного числа повторов. */
  onComplete?: () => void;
  /** Подпись для скринридера: «Счётчик повторов, азкар 4». */
  ariaLabel: string;
  className?: string;
}

/**
 * ГЛАВНАЯ КНОПКА ПРИЛОЖЕНИЯ.
 *
 * Требования: высота не меньше 64px, вибрация, микроанимация и защита
 * от случайного двойного тапа. Последнее важнее всего: при быстром
 * повторном касании (< 220 мс) счётчик не увеличивается, иначе пользователь
 * незаметно «проскакивает» повторы.
 */
export function CounterButton({
  count,
  total,
  done,
  onIncrement,
  onReset,
  onComplete,
  ariaLabel,
  className,
}: CounterButtonProps) {
  const { settings } = useSettings();
  const lastTapRef = useRef(0);
  const [pulse, setPulse] = useState(0);

  const handleClick = useCallback(() => {
    if (done) return;

    const now = Date.now();
    if (now - lastTapRef.current < COUNTER_TAP_COOLDOWN_MS) return;
    lastTapRef.current = now;

    const next = onIncrement();
    setPulse((value) => value + 1);

    if (next.done) {
      vibrateComplete(settings.vibration);
      onComplete?.();
    } else {
      vibrateTick(settings.vibration);
    }
  }, [done, onIncrement, onComplete, settings.vibration]);

  const percent = total === 0 ? 0 : Math.min(100, (count / total) * 100);

  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      <button
        type="button"
        data-custom-focus
        onClick={handleClick}
        disabled={done}
        aria-label={ariaLabel}
        className={cn(
          'relative min-h-16 flex-1 overflow-hidden rounded-2xl px-5 select-none',
          'font-extrabold tabular-nums transition-[transform,background-color] duration-150',
          'active:scale-[0.985] disabled:active:scale-100',
          done
            ? 'cursor-default bg-accent-soft text-accent'
            : 'bg-accent text-accent-contrast shadow-soft hover:bg-accent-hover',
        )}
      >
        {/* Заливка прогресса внутри кнопки — видно, сколько осталось. */}
        {!done && total > 1 ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-black/10 transition-[width] duration-300 ease-out dark:bg-white/10"
            style={{ width: `${percent}%` }}
          />
        ) : null}

        <span className="relative flex items-center justify-center gap-2.5 text-2xl">
          {done ? (
            <>
              <CheckIcon className="animate-check size-6" />
              <span>
                {total} / {total}
              </span>
            </>
          ) : (
            <span key={pulse} className="animate-pop inline-block">
              {count} / {total}
            </span>
          )}
        </span>

      </button>

      {/* Живой регион вне кнопки: иначе скринридер переобъявляет саму кнопку при каждом тапе. */}
      <span className="sr-only" role="status" aria-live="polite">
        {done ? `Выполнено ${total} из ${total}` : `Выполнено ${count} из ${total}`}
      </span>

      {count > 0 ? (
        <button
          type="button"
          data-custom-focus
          onClick={onReset}
          aria-label="Сбросить счётчик этого азкара"
          className={cn(
            'inline-flex min-h-16 w-14 shrink-0 items-center justify-center rounded-2xl',
            'border border-line bg-surface-2 text-ink-muted transition-colors',
            'hover:bg-surface-3 hover:text-ink active:scale-95',
          )}
        >
          <RefreshIcon className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
