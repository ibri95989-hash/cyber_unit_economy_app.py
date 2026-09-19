'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { ChevronDownIcon } from '@/components/ui/Icon';

interface TransliterationProps {
  children: string;
  /** Раскрыта ли по умолчанию (настройка пользователя). */
  defaultExpanded?: boolean;
}

/** Транскрипция. По умолчанию свёрнута, чтобы не перегружать карточку. */
export function Transliteration({ children, defaultExpanded = false }: TransliterationProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <div className="mt-4">
      <button
        type="button"
        data-custom-focus
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 -mx-2',
          'text-[0.875rem] font-bold text-ink-muted transition-colors hover:text-ink',
        )}
      >
        {expanded ? 'Скрыть транскрипцию' : 'Показать транскрипцию'}
        <ChevronDownIcon
          className={cn('size-4 transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>

      {expanded ? (
        <p
          id={contentId}
          className="animate-fade-in mt-1 rounded-2xl bg-surface-inset px-4 py-3 text-[1rem] leading-relaxed font-medium text-ink-muted"
        >
          {children}
        </p>
      ) : null}
    </div>
  );
}
