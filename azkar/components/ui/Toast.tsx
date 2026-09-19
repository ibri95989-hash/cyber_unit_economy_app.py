'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Одно короткое сообщение внизу экрана — для «Скопировано», ошибок аудио и т. п. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((next: string) => {
    setMessage(next);
    window.setTimeout(() => setMessage((current) => (current === next ? null : current)), 2600);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--az-bottom-nav-h) + 0.75rem)' }}
      >
        {message ? (
          <div className="animate-fade-up rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-bg shadow-float">
            {message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  // Тост — не критичная функция: без провайдера просто ничего не показываем.
  return ctx ?? { show: () => {} };
}
