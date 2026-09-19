'use client';

import { useCallback } from 'react';
import { progressActions } from '@/hooks/useAzkarProgress';
import { useFavorites } from '@/hooks/useFavorites';

/** Опасные действия из настроек, собранные в одном месте. */
export function useAppSettingsActions() {
  const { clear } = useFavorites();

  const resetAllProgress = useCallback(() => progressActions.resetAll(), []);
  const clearFavorites = useCallback(() => clear(), [clear]);

  return { resetAllProgress, clearFavorites };
}
