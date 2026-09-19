'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { settingsStore } from '@/lib/stores/settings';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { useHydrated } from './useHydrated';
import { useMediaQuery } from './useMediaQuery';
import type { Settings } from '@/types/settings';

export interface UseSettings {
  settings: Settings;
  /** false во время серверного рендера и гидрации. */
  hydrated: boolean;
  resolvedTheme: 'light' | 'dark';
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

/**
 * Настройки приложения.
 *
 * Провайдер не нужен: хранилище живёт на уровне модуля, а React подписывается
 * на него напрямую. Меньше контекстов — меньше лишних ререндеров.
 */
export function useSettings(): UseSettings {
  const settings = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
    settingsStore.getServerSnapshot,
  );

  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const hydrated = useHydrated();

  const resolvedTheme: 'light' | 'dark' =
    settings.theme === 'auto' ? (systemDark ? 'dark' : 'light') : settings.theme;

  const setSetting = useCallback<UseSettings['setSetting']>((key, value) => {
    settingsStore.set((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    settingsStore.set((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    settingsStore.set({ ...DEFAULT_SETTINGS });
  }, []);

  return useMemo(
    () => ({ settings, hydrated, resolvedTheme, setSetting, update, reset }),
    [settings, hydrated, resolvedTheme, setSetting, update, reset],
  );
}
