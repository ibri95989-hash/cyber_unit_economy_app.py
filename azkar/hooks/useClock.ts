'use client';

import { useSyncExternalStore } from 'react';
import { dayPartStore, todayStore } from '@/lib/stores/clock';
import type { DayPart } from '@/lib/time';

/** Время суток. null до первого клиентского тика — так разметка сервера совпадает. */
export function useDayPart(): DayPart | null {
  return useSyncExternalStore(
    dayPartStore.subscribe,
    dayPartStore.getSnapshot,
    dayPartStore.getServerSnapshot,
  );
}

/** Текущая дата YYYY-MM-DD. null на сервере. */
export function useTodayKey(): string | null {
  return useSyncExternalStore(
    todayStore.subscribe,
    todayStore.getSnapshot,
    todayStore.getServerSnapshot,
  );
}
