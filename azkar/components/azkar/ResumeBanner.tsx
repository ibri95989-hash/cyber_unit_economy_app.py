'use client';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { ArrowRightIcon } from '@/components/ui/Icon';

interface ResumeBannerProps {
  /** Человеческий номер азкара (с 1). */
  number: number;
  onResume: () => void;
  onDismiss: () => void;
  className?: string;
}

/** «Продолжить с 8-го азкара» — появляется, если чтение было прервано. */
export function ResumeBanner({ number, onResume, onDismiss, className }: ResumeBannerProps) {
  return (
    <div
      className={cn(
        'animate-fade-up flex flex-wrap items-center gap-3 rounded-card-lg',
        'border border-accent-soft-strong bg-accent-soft px-4 py-3.5',
        className,
      )}
    >
      <p className="min-w-[10rem] flex-1 text-[0.9375rem] leading-snug font-bold text-ink">
        Продолжить с {number}-го азкара?
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Не сейчас
        </Button>
        <Button variant="primary" size="sm" onClick={onResume}>
          Продолжить
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
