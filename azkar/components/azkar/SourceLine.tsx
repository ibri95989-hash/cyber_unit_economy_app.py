import { cn } from '@/lib/cn';
import { BookIcon } from '@/components/ui/Icon';
import { VerificationBadge } from '@/components/ui/VerificationBadge';
import type { Azkar } from '@/types/azkar';

interface SourceLineProps {
  azkar: Azkar;
  className?: string;
}

/**
 * Блок источника.
 *
 * Номер хадиса показывается только если он реально заполнен в данных —
 * выдуманные ссылки недопустимы. Статус проверки всегда виден рядом.
 */
export function SourceLine({ azkar, className }: SourceLineProps) {
  const { source, sourceDetails, verified } = azkar;
  const reference = source.reference?.trim();

  return (
    <div className={cn('rounded-2xl bg-surface-inset px-4 py-3.5', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-bold tracking-wide text-ink-subtle uppercase">
          <BookIcon className="size-4" />
          Источник
        </span>
        <VerificationBadge verified={verified} compact className="ms-auto" />
      </div>

      <p className="mt-2 text-[0.9375rem] leading-snug font-semibold text-ink">
        {source.collection}
        {reference ? <span className="text-ink-muted">, {reference}</span> : null}
      </p>

      {sourceDetails ? (
        <p className="mt-1.5 text-[0.8125rem] leading-snug font-medium text-ink-subtle">
          {sourceDetails}
        </p>
      ) : null}

      {!verified ? (
        <p className="mt-2 text-[0.8125rem] leading-snug font-medium text-warning">
          Текст приведён, но точная ссылка ещё не выверена редактором. Не полагайтесь на неё как
          на подтверждённую.
        </p>
      ) : null}
    </div>
  );
}
