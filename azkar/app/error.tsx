'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { RefreshIcon } from '@/components/ui/Icon';

/**
 * Error Boundary уровня маршрута.
 * Показываем спокойное сообщение, а не стектрейс — и даём выйти из тупика.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Здесь позже будет отправка в систему мониторинга.
    console.error(error);
  }, [error]);

  return (
    <div className="container-az flex min-h-[60dvh] flex-col items-center justify-center py-10 text-center safe-bottom">
      <p aria-hidden="true" className="text-4xl">
        🌙
      </p>
      <h1 className="mt-4 text-[1.5rem] font-extrabold text-ink">Что-то пошло не так</h1>
      <p className="mt-2 max-w-sm text-[1rem] leading-relaxed font-medium text-ink-muted">
        Страница не открылась. Ваш прогресс и избранное сохранены на устройстве — они не потеряны.
      </p>
      <Button variant="primary" size="lg" className="mt-6" onClick={reset}>
        <RefreshIcon className="size-5" />
        Попробовать снова
      </Button>
    </div>
  );
}
