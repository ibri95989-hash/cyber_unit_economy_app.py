'use client';

import type { ReactNode } from 'react';
import { UiProvider } from '@/hooks/useUi';
import { ToastProvider } from '@/components/ui/Toast';

/**
 * Клиентские провайдеры.
 *
 * Настройки, избранное и прогресс живут во внешних хранилищах
 * (lib/stores/*) и подключаются через useSyncExternalStore — контекст
 * для них не нужен. Здесь остаётся только UI-состояние.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <UiProvider>
      <ToastProvider>{children}</ToastProvider>
    </UiProvider>
  );
}
