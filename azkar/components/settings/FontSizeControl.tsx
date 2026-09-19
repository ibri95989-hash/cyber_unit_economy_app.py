'use client';

import { cn } from '@/lib/cn';
import { clampStep } from '@/lib/settings';
import type { FontScaleStep } from '@/types/settings';

interface FontSizeControlProps {
  label: string;
  value: FontScaleStep;
  onChange: (step: FontScaleStep) => void;
  /** Пример текста, который меняется вместе с размером. */
  preview?: string;
  previewClassName?: string;
  previewStyle?: React.CSSProperties;
}

/** Управление размером текста: A− / A / A+. Кнопки крупные, промахнуться сложно. */
export function FontSizeControl({
  label,
  value,
  onChange,
  preview,
  previewClassName,
  previewStyle,
}: FontSizeControlProps) {
  const atMin = value <= -2;
  const atMax = value >= 3;

  const buttonClass = cn(
    'inline-flex size-12 items-center justify-center rounded-xl border border-line bg-surface',
    'font-extrabold text-ink transition-colors hover:bg-surface-2',
    'disabled:pointer-events-none disabled:opacity-40 active:scale-95',
  );

  return (
    <div className="rounded-2xl px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[0.9375rem] font-semibold text-ink">{label}</span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-custom-focus
            className={buttonClass}
            disabled={atMin}
            onClick={() => onChange(clampStep(value - 1))}
            aria-label={`Уменьшить: ${label}`}
          >
            <span aria-hidden="true" className="text-sm">
              A−
            </span>
          </button>

          <span
            aria-live="polite"
            className="w-9 text-center text-[0.875rem] font-bold tabular-nums text-ink-muted"
          >
            {value > 0 ? `+${value}` : value}
          </span>

          <button
            type="button"
            data-custom-focus
            className={buttonClass}
            disabled={atMax}
            onClick={() => onChange(clampStep(value + 1))}
            aria-label={`Увеличить: ${label}`}
          >
            <span aria-hidden="true" className="text-lg">
              A+
            </span>
          </button>
        </div>
      </div>

      {preview ? (
        <p
          className={cn('mt-3 rounded-xl bg-surface-inset px-3 py-2.5 text-ink', previewClassName)}
          style={previewStyle}
        >
          {preview}
        </p>
      ) : null}
    </div>
  );
}
