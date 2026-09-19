'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/cn';
import { shareAzkar } from '@/lib/share';
import { useToast } from '@/components/ui/Toast';
import { ShareIcon } from '@/components/ui/Icon';
import type { Azkar } from '@/types/azkar';

interface ShareButtonProps {
  azkar: Azkar;
  categorySlug: string;
  className?: string;
}

/**
 * «Поделиться».
 * По умолчанию отправляется название, перевод, источник и ссылка —
 * большой арабский текст в чужой чат без спроса не улетает.
 */
export function ShareButton({ azkar, categorySlug, className }: ShareButtonProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const outcome = await shareAzkar(azkar, { categorySlug });
    if (outcome === 'copied') toast.show('Текст скопирован');
    if (outcome === 'failed') toast.show('Не удалось поделиться');
    setBusy(false);
  }, [azkar, categorySlug, busy, toast]);

  return (
    <button
      type="button"
      data-custom-focus
      onClick={onClick}
      disabled={busy}
      aria-label={`Поделиться: ${azkar.title}`}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
        'text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink-muted active:scale-90',
        className,
      )}
    >
      <ShareIcon className="size-[1.25rem]" />
    </button>
  );
}
