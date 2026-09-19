'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import { vibrateTick } from '@/lib/haptics';
import { useFavorites } from '@/hooks/useFavorites';
import { useSettings } from '@/hooks/useSettings';
import { HeartIcon } from '@/components/ui/Icon';

interface FavoriteButtonProps {
  azkarId: string;
  title: string;
  className?: string;
}

/** Сердечко «в избранное». Состояние появляется только после гидрации. */
export function FavoriteButton({ azkarId, title, className }: FavoriteButtonProps) {
  const { isFavorite, toggle, hydrated } = useFavorites();
  const { settings } = useSettings();
  const active = hydrated && isFavorite(azkarId);

  const onClick = useCallback(() => {
    toggle(azkarId);
    vibrateTick(settings.vibration);
  }, [toggle, azkarId, settings.vibration]);

  return (
    <button
      type="button"
      data-custom-focus
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Убрать «${title}» из избранного` : `Добавить «${title}» в избранное`}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
        'transition-[color,background-color,transform] duration-150 active:scale-90',
        active ? 'text-danger hover:bg-danger-soft' : 'text-ink-subtle hover:bg-surface-2 hover:text-ink-muted',
        className,
      )}
    >
      <HeartIcon filled={active} className="size-[1.375rem]" />
    </button>
  );
}
