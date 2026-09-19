'use client';

import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Расшифровка для скринридера, если label слишком короткий. */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Подпись группы для скринридеров. */
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}

/** Переключатель «Список | По одному», размеров шрифта и темы. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex w-full items-center gap-1 rounded-2xl bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel ?? option.label}
            data-custom-focus
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-xl font-semibold transition-all duration-200',
              size === 'md' ? 'h-10 text-[0.9375rem]' : 'h-9 text-sm',
              active
                ? 'bg-surface text-ink shadow-soft'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
