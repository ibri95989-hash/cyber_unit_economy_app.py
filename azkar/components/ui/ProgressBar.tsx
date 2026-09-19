import { cn } from '@/lib/cn';

interface ProgressBarProps {
  /** 0…1 */
  value: number;
  className?: string;
  /** Крупная полоса для шапки раздела. */
  size?: 'sm' | 'md';
  label?: string;
}

/**
 * Полоса прогресса. Это индикатор, а не интерактивный элемент,
 * поэтому role="progressbar" с aria-значениями.
 */
export function ProgressBar({ value, className, size = 'md', label }: ProgressBarProps) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      {...(label ? { 'aria-label': label } : {})}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-3',
        size === 'md' ? 'h-2' : 'h-1.5',
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
