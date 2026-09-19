'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getAzkarByCategory } from '@/data';
import {
  computeStreak,
  emptyProgress,
  getTodayProgress,
  recordCompletion,
  summarize,
} from '@/lib/progress';
import { historyStore, progressStore } from '@/lib/stores/progress';
import { toDateKey } from '@/lib/time';
import { useTodayKey } from './useClock';
import { useHydrated } from './useHydrated';
import type { Azkar, CategoryId } from '@/types/azkar';
import type {
  AzkarCounterState,
  CategoryProgress,
  DailyHistoryEntry,
  ProgressState,
  ProgressSummary,
  StreakInfo,
} from '@/types/progress';

/** Если раздел дочитан целиком — отмечаем день в истории (для серии). */
function markCategoryDoneIfComplete(
  categoryId: CategoryId,
  counters: CategoryProgress['counters'],
): void {
  const list = getAzkarByCategory(categoryId);
  if (list.length === 0) return;
  if (!list.every((item) => counters[item.id]?.done)) return;
  historyStore.set((prev) => recordCompletion(prev, categoryId, toDateKey()));
}

/** Применяет изменение к прогрессу раздела за сегодня. */
function mutateCategory(
  categoryId: CategoryId,
  mutator: (current: CategoryProgress) => CategoryProgress,
): CategoryProgress {
  const dateKey = toDateKey();
  const state = progressStore.get();
  const current = getTodayProgress(state, categoryId, dateKey);
  const next: CategoryProgress = {
    ...mutator(current),
    categoryId,
    date: dateKey,
    updatedAt: Date.now(),
  };
  progressStore.set({ ...state, [categoryId]: next });
  return next;
}

/** Действия над прогрессом. Живут вне React — их можно вызывать откуда угодно. */
export const progressActions = {
  increment(categoryId: CategoryId, azkarId: string, repetitions: number): AzkarCounterState {
    const target = Math.max(1, repetitions);
    let result: AzkarCounterState = { count: 0, done: false };

    const next = mutateCategory(categoryId, (current) => {
      const counter = current.counters[azkarId] ?? { count: 0, done: false };
      const count = Math.min(counter.count + 1, target);
      result = { count, done: count >= target };
      return { ...current, counters: { ...current.counters, [azkarId]: result }, lastAzkarId: azkarId };
    });

    if (result.done) markCategoryDoneIfComplete(categoryId, next.counters);
    return result;
  },

  complete(categoryId: CategoryId, azkarId: string, repetitions: number): void {
    const target = Math.max(1, repetitions);
    const next = mutateCategory(categoryId, (current) => ({
      ...current,
      counters: { ...current.counters, [azkarId]: { count: target, done: true } },
      lastAzkarId: azkarId,
    }));
    markCategoryDoneIfComplete(categoryId, next.counters);
  },

  resetAzkar(categoryId: CategoryId, azkarId: string): void {
    mutateCategory(categoryId, (current) => ({
      ...current,
      counters: { ...current.counters, [azkarId]: { count: 0, done: false } },
    }));
  },

  resetCategory(categoryId: CategoryId): void {
    progressStore.set((prev) => ({ ...prev, [categoryId]: emptyProgress(categoryId) }));
  },

  setLastAzkar(categoryId: CategoryId, azkarId: string): void {
    const current = getTodayProgress(progressStore.get(), categoryId, toDateKey());
    if (current.lastAzkarId === azkarId) return;
    mutateCategory(categoryId, (prev) => ({ ...prev, lastAzkarId: azkarId }));
  },

  resetAll(): void {
    progressStore.set({});
    historyStore.set([]);
  },
};

export interface UseProgressStore {
  state: ProgressState;
  history: DailyHistoryEntry[];
  streak: StreakInfo;
  hydrated: boolean;
  /** null во время серверного рендера. */
  today: string | null;
  getCategoryProgress: (categoryId: CategoryId) => CategoryProgress;
}

/** Глобальный прогресс: нужен главной странице и сводке «Сегодня». */
export function useProgressStore(): UseProgressStore {
  const state = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
    progressStore.getServerSnapshot,
  );
  const history = useSyncExternalStore(
    historyStore.subscribe,
    historyStore.getSnapshot,
    historyStore.getServerSnapshot,
  );
  const today = useTodayKey();
  const hydrated = useHydrated();

  const streak = useMemo(
    () => (today ? computeStreak(history, today) : { current: 0, best: 0, todayCounted: false }),
    [history, today],
  );

  const getCategoryProgress = useCallback(
    (categoryId: CategoryId) =>
      // Без даты (серверный рендер) прогресс всегда пустой — так разметка совпадает.
      today ? getTodayProgress(state, categoryId, today) : emptyProgress(categoryId, ''),
    [state, today],
  );

  return useMemo(
    () => ({ state, history, streak, hydrated, today, getCategoryProgress }),
    [state, history, streak, hydrated, today, getCategoryProgress],
  );
}

export interface UseAzkarProgress {
  progress: CategoryProgress;
  summary: ProgressSummary;
  hydrated: boolean;
  counterFor: (azkarId: string) => AzkarCounterState;
  /** +1 повтор. Возвращает новое состояние счётчика. */
  increment: (azkarId: string, repetitions: number) => AzkarCounterState;
  /** Отметить азкар выполненным целиком. */
  complete: (azkarId: string, repetitions: number) => void;
  /** Сбросить один азкар. */
  resetOne: (azkarId: string) => void;
  /** Начать раздел заново. */
  reset: () => void;
  getProgress: () => ProgressSummary;
  /** Индекс азкара, с которого логично продолжить. */
  continueFromLast: () => number;
  setLastAzkar: (azkarId: string) => void;
}

/**
 * Прогресс одного раздела.
 * Публичный интерфейс: increment / complete / reset / getProgress / continueFromLast.
 */
export function useAzkarProgress(categoryId: CategoryId, azkar: readonly Azkar[]): UseAzkarProgress {
  const store = useProgressStore();
  const progress = store.getCategoryProgress(categoryId);
  const summary = useMemo(() => summarize(azkar, progress), [azkar, progress]);

  const counterFor = useCallback(
    (azkarId: string): AzkarCounterState => progress.counters[azkarId] ?? { count: 0, done: false },
    [progress],
  );

  const increment = useCallback(
    (azkarId: string, repetitions: number) =>
      progressActions.increment(categoryId, azkarId, repetitions),
    [categoryId],
  );

  const complete = useCallback(
    (azkarId: string, repetitions: number) =>
      progressActions.complete(categoryId, azkarId, repetitions),
    [categoryId],
  );

  const resetOne = useCallback(
    (azkarId: string) => progressActions.resetAzkar(categoryId, azkarId),
    [categoryId],
  );

  const reset = useCallback(() => progressActions.resetCategory(categoryId), [categoryId]);

  const getProgress = useCallback(() => summary, [summary]);

  const continueFromLast = useCallback(() => summary.resumeIndex, [summary.resumeIndex]);

  const setLastAzkar = useCallback(
    (azkarId: string) => progressActions.setLastAzkar(categoryId, azkarId),
    [categoryId],
  );

  return {
    progress,
    summary,
    hydrated: store.hydrated,
    counterFor,
    increment,
    complete,
    resetOne,
    reset,
    getProgress,
    continueFromLast,
    setLastAzkar,
  };
}
