'use client';

import { cn } from '@/lib/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Переключатель ON/OFF. Вся строка — одна кнопка,
 * чтобы не заставлять попадать пальцем в маленький ползунок.
 */
export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-custom-focus
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3.5 text-left',
        'transition-colors duration-150 hover:bg-surface-2 disabled:opacity-45',
        'min-h-[3.5rem]',
      )}
    >
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[0.8125rem] leading-snug font-medium text-ink-subtle">
            {description}
          </span>
        ) : null}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          'relative h-7 w-[3.25rem] shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-surface-3',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-6 rounded-full bg-white shadow-soft transition-[left] duration-200 ease-out',
            checked ? 'left-[1.625rem]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
