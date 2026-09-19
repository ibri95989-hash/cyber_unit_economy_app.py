import { cn } from '@/lib/cn';

interface ArabicTextProps {
  children: string;
  className?: string;
}

/**
 * Арабский текст.
 *
 * `dir="rtl"` + `lang="ar"` обязательны: без них браузер ломает порядок
 * знаков препинания и скобок, а скринридер читает текст не тем голосом.
 * Размер и межстрочный интервал берутся из CSS-переменных, которыми
 * управляют настройки пользователя.
 */
export function ArabicText({ children, className }: ArabicTextProps) {
  return (
    <p dir="rtl" lang="ar" className={cn('arabic-text text-ink', className)}>
      {children}
    </p>
  );
}
