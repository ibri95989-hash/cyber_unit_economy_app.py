'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { useSettings } from '@/hooks/useSettings';
import { AudioPlayer } from '@/components/audio/AudioPlayer';
import { pluralizeRu } from '@/lib/time';
import { ArabicText } from './ArabicText';
import { CounterButton } from './CounterButton';
import { FavoriteButton } from './FavoriteButton';
import { ShareButton } from './ShareButton';
import { SourceLine } from './SourceLine';
import { Translation } from './Translation';
import { Transliteration } from './Transliteration';
import type { Azkar } from '@/types/azkar';
import type { AzkarCounterState } from '@/types/progress';

export interface AzkarCardProps {
  azkar: Azkar;
  /** Номер в разделе, начиная с 1. */
  number: number;
  total: number;
  categorySlug: string;
  counter: AzkarCounterState;
  onIncrement: () => AzkarCounterState;
  onReset: () => void;
  onComplete?: () => void;
  /** Запустить аудио сразу — когда включён автопереход к следующему аудио. */
  autoPlayAudio?: boolean;
  /** Вызывается по окончании аудио. */
  onAudioEnded?: () => void;
  /** 'single' растягивает карточку на высоту экрана в режиме «по одному». */
  variant?: 'list' | 'single';
  className?: string;
}

/**
 * Карточка одного азкара.
 *
 * Порядок блоков продиктован тем, как читают: номер → арабский → перевод →
 * транскрипция → источник → счётчик. Счётчик всегда последний и самый крупный.
 */
export const AzkarCard = forwardRef<HTMLElement, AzkarCardProps>(function AzkarCard(
  {
    azkar,
    number,
    total,
    categorySlug,
    counter,
    onIncrement,
    onReset,
    onComplete,
    autoPlayAudio = false,
    onAudioEnded,
    variant = 'list',
    className,
  },
  ref,
) {
  const { settings } = useSettings();
  const done = counter.done;

  return (
    <article
      ref={ref}
      id={`azkar-${azkar.id}`}
      aria-label={`Азкар ${number} из ${total}: ${azkar.title}`}
      className={cn(
        'rounded-card-lg border bg-surface transition-[border-color,background-color] duration-300',
        done ? 'border-accent-soft-strong bg-accent-soft/40' : 'border-line shadow-soft',
        variant === 'single' ? 'p-5 sm:p-6' : 'p-5',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-extrabold tracking-wide text-ink-subtle uppercase">
            № {number}
            <span className="mx-1.5 opacity-40">·</span>
            <span className="normal-case">
              {azkar.repetitions} {pluralizeRu(azkar.repetitions, ['раз', 'раза', 'раз'])}
            </span>
          </p>
          <h3 className="mt-1 text-[1.0625rem] leading-snug font-bold text-ink">{azkar.title}</h3>
        </div>

        <div className="-me-2 flex shrink-0 items-center">
          <ShareButton azkar={azkar} categorySlug={categorySlug} />
          <FavoriteButton azkarId={azkar.id} title={azkar.title} />
        </div>
      </header>

      <ArabicText className="mt-5">{azkar.arabic}</ArabicText>

      {settings.showTranslation ? <Translation className="mt-5">{azkar.translation}</Translation> : null}

      {settings.showTransliteration ? (
        <Transliteration defaultExpanded={settings.expandTransliterationByDefault}>
          {azkar.transliteration}
        </Transliteration>
      ) : null}

      <SourceLine azkar={azkar} className="mt-4" />

      {/* В ленте не показываем заглушку отсутствующего аудио: одинаковая серая
          строка под каждой из двух десятков карточек — визуальный шум. */}
      {azkar.audioUrl || variant === 'single' ? (
        <AudioPlayer
          src={azkar.audioUrl}
          title={azkar.title}
          autoPlay={autoPlayAudio}
          {...(onAudioEnded ? { onEnded: onAudioEnded } : {})}
          className="mt-3 w-full"
        />
      ) : null}

      <CounterButton
        className="mt-4"
        count={counter.count}
        total={azkar.repetitions}
        done={done}
        onIncrement={onIncrement}
        onReset={onReset}
        {...(onComplete ? { onComplete } : {})}
        ariaLabel={`Счётчик повторов: ${azkar.title}`}
      />
    </article>
  );
});
