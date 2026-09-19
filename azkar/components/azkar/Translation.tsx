import { cn } from '@/lib/cn';

interface TranslationProps {
  children: string;
  className?: string;
}

/** Русский перевод. Крупный и достаточно жирный — это основной читаемый текст. */
export function Translation({ children, className }: TranslationProps) {
  return (
    <p lang="ru" className={cn('translation-text text-ink', className)}>
      {children}
    </p>
  );
}
