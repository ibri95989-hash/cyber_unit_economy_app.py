import { cn } from '@/lib/cn';
import { verificationStatus } from '@/types/azkar';
import { AlertIcon, CheckIcon } from './Icon';

interface VerificationBadgeProps {
  verified: boolean;
  className?: string;
  /** Компактный вид — только иконка и короткое слово. */
  compact?: boolean;
}

/**
 * «✓ Проверено» показывается ТОЛЬКО для записей с verified: true.
 * Всё остальное честно помечается как требующее проверки — это принципиально.
 */
export function VerificationBadge({ verified, className, compact }: VerificationBadgeProps) {
  const status = verificationStatus({ verified });

  if (status === 'verified') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1',
          'text-[0.75rem] font-bold tracking-tight text-accent',
          className,
        )}
      >
        <CheckIcon className="size-3.5" />
        {compact ? 'Проверено' : 'Источник проверен'}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1',
        'text-[0.75rem] font-bold tracking-tight text-warning',
        className,
      )}
      title="Текст приведён, но точная ссылка на источник ещё не выверена редактором"
    >
      <AlertIcon className="size-3.5" />
      {compact ? 'На проверке' : 'Требует проверки'}
    </span>
  );
}
