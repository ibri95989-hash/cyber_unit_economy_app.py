'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { favoritesStore } from '@/lib/stores/favorites';
import { useHydrated } from './useHydrated';

export interface UseFavorites {
  ids: string[];
  hydrated: boolean;
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export function useFavorites(): UseFavorites {
  const ids = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.getSnapshot,
    favoritesStore.getServerSnapshot,
  );
  const hydrated = useHydrated();

  const idSet = useMemo(() => new Set(ids), [ids]);
  const isFavorite = useCallback((id: string) => idSet.has(id), [idSet]);

  const add = useCallback((id: string) => {
    favoritesStore.set((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const remove = useCallback((id: string) => {
    favoritesStore.set((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : prev));
  }, []);

  const toggle = useCallback((id: string) => {
    favoritesStore.set((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }, []);

  const clear = useCallback(() => favoritesStore.set([]), []);

  return useMemo(
    () => ({ ids, hydrated, isFavorite, toggle, add, remove, clear }),
    [ids, hydrated, isFavorite, toggle, add, remove, clear],
  );
}
