import type { CategoryId } from './azkar';

/** Прогресс по одному азкару внутри одной сессии чтения. */
export interface AzkarCounterState {
  /** Сколько повторов уже сделано. */
  count: number;
  /** Завершён ли азкар. */
  done: boolean;
}

/** Прогресс по одному разделу за текущий день. */
export interface CategoryProgress {
  categoryId: CategoryId;
  /** Дата в формате YYYY-MM-DD по локальному времени пользователя. */
  date: string;
  counters: Record<string, AzkarCounterState>;
  /** id последнего азкара, с которым работал пользователь. */
  lastAzkarId?: string;
  /** Время последнего изменения (ms epoch) — для «Продолжить». */
  updatedAt: number;
  /** Отмечен ли раздел как полностью завершённый сегодня. */
  completedAt?: number;
}

export type ProgressState = Record<string, CategoryProgress>;

/** Сводка для прогресс-бара. */
export interface ProgressSummary {
  completed: number;
  total: number;
  /** 0…1 */
  ratio: number;
  isComplete: boolean;
  lastAzkarId?: string;
  /** Индекс азкара, с которого логично продолжить (0-based). */
  resumeIndex: number;
}

/** История завершений по дням — для серии («7 дней подряд»). */
export interface DailyHistoryEntry {
  /** YYYY-MM-DD */
  date: string;
  /** Разделы, полностью завершённые в этот день. */
  completed: CategoryId[];
}

export interface StreakInfo {
  /** Текущая серия в днях. */
  current: number;
  /** Лучшая серия. */
  best: number;
  /** Засчитан ли сегодняшний день. */
  todayCounted: boolean;
}
