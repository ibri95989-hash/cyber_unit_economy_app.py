'use client';

import { useDayPart } from '@/hooks/useClock';
import type { DayPart } from '@/lib/time';

const GREETINGS: Record<DayPart, string> = {
  morning: 'Доброе утро',
  day: 'Добрый день',
  evening: 'Добрый вечер',
  night: 'Доброй ночи',
};

/**
 * Приветственный блок.
 *
 * Время суток берётся из «часов» как из внешнего источника: серверный рендер
 * не знает часовой пояс, поэтому строка приветствия появляется после гидрации.
 * Высота зарезервирована — вёрстка не скачет.
 */
export function WelcomeBlock() {
  const dayPart = useDayPart();

  return (
    <div className="pt-2 pb-1">
      <p
        lang="ar"
        dir="rtl"
        className="text-[0.9375rem] font-semibold text-ink-subtle"
        style={{ fontFamily: 'var(--font-arabic)' }}
      >
        السلام عليكم
      </p>
      <h1 className="mt-1 text-[2rem] leading-[1.15] font-extrabold text-ink sm:text-[2.25rem]">
        Ассаляму алейкум
      </h1>
      <p className="mt-2 min-h-6 text-[1rem] font-semibold text-ink-muted">
        {dayPart ? GREETINGS[dayPart] : ' '}
      </p>
    </div>
  );
}
