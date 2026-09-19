'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';
import { CloseIcon } from './Icon';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Описание под заголовком. */
  description?: string;
}

/**
 * Нижняя «шторка» — привычный мобильный паттерн.
 * На десктопе превращается в центрированное модальное окно.
 *
 * Фокус запирается внутри, Escape закрывает, фон не скроллится.
 */
export function Sheet({ open, onClose, title, children, description }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // Переносим фокус внутрь шторки, иначе скринридер останется на странице.
    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('button, [href], input')?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Закрыть"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(description ? { 'aria-describedby': descriptionId } : {})}
        className={cn(
          'relative flex max-h-[88dvh] w-full flex-col overflow-hidden bg-bg-elevated',
          'rounded-t-[1.75rem] shadow-float animate-fade-up',
          'sm:max-w-lg sm:rounded-[1.75rem]',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-4 pb-4">
          <div className="min-w-0 flex-1">
            <div
              aria-hidden="true"
              className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-3 sm:hidden"
            />
            <h2 id={titleId} className="text-xl font-extrabold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm font-medium text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton aria-label="Закрыть" onClick={onClose} variant="secondary" className="mt-3">
            <CloseIcon className="size-5" />
          </IconButton>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3',
            'pb-[max(1rem,env(safe-area-inset-bottom))]',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
