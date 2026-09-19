'use client';

import { useState } from 'react';
import { arabicSizeFor, translationSizeFor } from '@/lib/settings';
import { useAppSettingsActions } from './useAppSettingsActions';
import { useSettings } from '@/hooks/useSettings';
import { useUi } from '@/hooks/useUi';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { FontSizeControl } from './FontSizeControl';
import { ThemeToggle } from './ThemeToggle';
import type { PlaybackRate } from '@/types/settings';

const RATE_OPTIONS = [
  { value: '0.75', label: '0.75×', ariaLabel: 'Скорость 0,75' },
  { value: '1', label: '1×', ariaLabel: 'Обычная скорость' },
  { value: '1.25', label: '1.25×', ariaLabel: 'Скорость 1,25' },
];

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mt-4 mb-1 px-4 text-[0.6875rem] font-extrabold tracking-wider text-ink-subtle uppercase">
      {children}
    </h3>
  );
}

/** Шторка настроек. Все изменения применяются сразу и сохраняются автоматически. */
export function SettingsSheet() {
  const { settingsOpen, closeSettings } = useUi();
  const { settings, setSetting, reset } = useSettings();
  const { resetAllProgress, clearFavorites } = useAppSettingsActions();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Sheet
      open={settingsOpen}
      onClose={() => {
        setConfirmReset(false);
        closeSettings();
      }}
      title="Настройки"
      description="Сохраняются на этом устройстве"
    >
      <SectionTitle>Оформление</SectionTitle>
      <ThemeToggle value={settings.theme} onChange={(value) => setSetting('theme', value)} />

      <SectionTitle>Размер текста</SectionTitle>
      <FontSizeControl
        label="Арабский текст"
        value={settings.arabicFontStep}
        onChange={(step) => setSetting('arabicFontStep', step)}
        preview="بِسْمِ اللَّهِ"
        previewClassName="arabic-text"
        previewStyle={{ fontSize: arabicSizeFor(settings.arabicFontStep), lineHeight: 1.9 }}
      />
      <FontSizeControl
        label="Русский перевод"
        value={settings.translationFontStep}
        onChange={(step) => setSetting('translationFontStep', step)}
        preview="Хвала Аллаху, Господу миров."
        previewClassName="font-semibold leading-relaxed"
        previewStyle={{ fontSize: translationSizeFor(settings.translationFontStep) }}
      />

      <SectionTitle>Что показывать</SectionTitle>
      <Toggle
        label="Перевод"
        description="Русский текст под арабским"
        checked={settings.showTranslation}
        onChange={(value) => setSetting('showTranslation', value)}
      />
      <Toggle
        label="Транскрипция"
        description="Кириллическое чтение арабского текста"
        checked={settings.showTransliteration}
        onChange={(value) => setSetting('showTransliteration', value)}
      />
      <Toggle
        label="Раскрывать транскрипцию сразу"
        description="Без нажатия «Показать транскрипцию»"
        checked={settings.expandTransliterationByDefault}
        disabled={!settings.showTransliteration}
        onChange={(value) => setSetting('expandTransliterationByDefault', value)}
      />

      <SectionTitle>Чтение</SectionTitle>
      <Toggle
        label="Вибрация"
        description="Короткий отклик при нажатии счётчика"
        checked={settings.vibration}
        onChange={(value) => setSetting('vibration', value)}
      />
      <Toggle
        label="Автопереход"
        description="Переходить к следующему азкару после последнего повтора"
        checked={settings.autoAdvance}
        onChange={(value) => setSetting('autoAdvance', value)}
      />

      <SectionTitle>Аудио</SectionTitle>
      <div className="px-4 py-3.5">
        <p className="mb-2 text-[0.9375rem] font-semibold text-ink">Скорость воспроизведения</p>
        <SegmentedControl
          label="Скорость воспроизведения"
          value={String(settings.playbackRate)}
          options={RATE_OPTIONS}
          onChange={(value) => setSetting('playbackRate', Number(value) as PlaybackRate)}
        />
      </div>
      <Toggle
        label="Включать следующее аудио"
        description="По умолчанию выключено: аудио не продолжается само"
        checked={settings.audioAutoplayNext}
        onChange={(value) => setSetting('audioAutoplayNext', value)}
      />

      <SectionTitle>Данные</SectionTitle>
      <div className="flex flex-col gap-2 px-4 pt-1 pb-4">
        <Button variant="secondary" onClick={clearFavorites} fullWidth>
          Очистить избранное
        </Button>

        {confirmReset ? (
          <div className="rounded-2xl border border-line bg-surface-inset p-3">
            <p className="mb-2.5 text-[0.875rem] leading-snug font-semibold text-ink">
              Сбросить весь прогресс и серию дней? Это действие нельзя отменить.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" fullWidth onClick={() => setConfirmReset(false)}>
                Отмена
              </Button>
              <Button
                variant="danger"
                size="sm"
                fullWidth
                onClick={() => {
                  resetAllProgress();
                  setConfirmReset(false);
                }}
              >
                Сбросить
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmReset(true)} fullWidth>
            Сбросить весь прогресс
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={reset} fullWidth>
          Вернуть настройки по умолчанию
        </Button>
      </div>
    </Sheet>
  );
}
