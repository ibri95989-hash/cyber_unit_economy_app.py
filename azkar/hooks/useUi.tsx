'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface UiContextValue {
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const UiContext = createContext<UiContextValue | null>(null);

/** Состояние глобальных оверлеев. Пока это только шторка настроек. */
export function UiProvider({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const value = useMemo(
    () => ({ settingsOpen, openSettings, closeSettings }),
    [settingsOpen, openSettings, closeSettings],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi нужно вызывать внутри <UiProvider>');
  return ctx;
}
