'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { accentStyle } from '@/lib/accents';
import { ArabicText } from './ArabicText';
import { FavoriteButton } from './FavoriteButton';
import { VerificationBadge } from '@/components/ui/VerificationBadge';
import type { Azkar, Category } from '@/types/azkar';

interface AzkarListItemProps {
  azkar: Azkar;
  category: Category;
  className?: string;
}

/**
 * Компактная запись для поиска и избранного: без счётчика,
 * со ссылкой на раздел и якорем на нужную карточку.
 */
export function AzkarListItem({ azkar, category, className }: AzkarListItemProps) {
  return (
    <article
      className={cn(
        'rounded-card-lg border border-line bg-surface p-4 shadow-soft',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/${category.slug}#azkar-${azkar.id}`}
            data-custom-focus
            className="inline-flex items-center gap-1.5 rounded-lg"
          >
            <span
              aria-hidden="true"
              style={accentStyle(category.accent)}
              className="accent-chip inline-flex size-5 items-center justify-center rounded-md text-[0.6875rem]"
            >
              {category.emoji}
            </span>
            <span className="text-[0.75rem] font-extrabold tracking-wide text-ink-subtle uppercase">
              {category.shortTitle}
            </span>
          </Link>
          <h3 className="mt-1.5 text-[1.0625rem] leading-snug font-bold text-ink">{azkar.title}</h3>
        </div>

        <FavoriteButton azkarId={azkar.id} title={azkar.title} className="-me-2 -mt-1" />
      </div>

      <ArabicText className="mt-3 line-clamp-2">{azkar.arabic}</ArabicText>

      <p className="mt-3 line-clamp-3 text-[0.9375rem] leading-relaxed font-semibold text-ink-muted">
        {azkar.translation}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-ink-subtle">
          {azkar.source.collection}
          {azkar.source.reference ? `, ${azkar.source.reference}` : ''}
        </p>
        <VerificationBadge verified={azkar.verified} compact />
      </div>

      <Link
        href={`/${category.slug}#azkar-${azkar.id}`}
        data-custom-focus
        className="mt-3 inline-flex min-h-11 items-center rounded-xl text-[0.9375rem] font-extrabold text-accent"
      >
        Открыть в разделе →
      </Link>
    </article>
  );
}
