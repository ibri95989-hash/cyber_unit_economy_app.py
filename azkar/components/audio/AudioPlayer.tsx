'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useSettings } from '@/hooks/useSettings';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PauseIcon, PlayIcon, SpeakerIcon } from '@/components/ui/Icon';
import type { PlaybackRate } from '@/types/settings';

interface AudioPlayerProps {
  src?: string | undefined;
  title: string;
  /**
   * Запустить сразу при монтировании. Ставится только тогда, когда
   * пользователь сам включил «Включать следующее аудио».
   */
  autoPlay?: boolean;
  /** Вызывается по окончании — родитель решает, что делать дальше. */
  onEnded?: () => void;
  className?: string;
}

const RATE_OPTIONS = [
  { value: '0.75', label: '0.75×', ariaLabel: 'Скорость 0,75' },
  { value: '1', label: '1×', ariaLabel: 'Обычная скорость' },
  { value: '1.25', label: '1.25×', ariaLabel: 'Скорость 1,25' },
] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Плеер азкара.
 *
 * Аудио не грузится, пока пользователь не нажал «Прослушать»: сам тег <audio>
 * появляется в DOM только после этого, плюс preload="none". Это принципиально —
 * иначе страница с двумя десятками записей утянет мегабайты мобильного трафика.
 */
export function AudioPlayer({ src, title, autoPlay = false, onEnded, className }: AudioPlayerProps) {
  const { settings, setSetting } = useSettings();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [userStarted, setUserStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState(false);

  // Плеер «развёрнут», если его открыл пользователь или включён автопереход.
  const active = userStarted || autoPlay;

  // Запуск воспроизведения. Единственная точка — и для клика, и для автозапуска.
  useEffect(() => {
    if (!active) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = settings.playbackRate;
    // Браузер может отказать в автозапуске — тогда останется кнопка ▶.
    audio.play().catch(() => setPlaying(false));
    // Намеренно без playbackRate в зависимостях: смена скорости не должна
    // перезапускать трек, за это отвечает эффект ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = settings.playbackRate;
  }, [settings.playbackRate, active]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      setUserStarted(true);
      return;
    }
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setError(true);
      }
    } else {
      audio.pause();
    }
  }, []);

  const onSeek = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setPosition(value);
  }, []);

  if (!src) {
    return (
      <p
        className={cn(
          'flex items-center gap-2 rounded-2xl bg-surface-inset px-4 py-3',
          'text-[0.8125rem] font-semibold text-ink-subtle',
          className,
        )}
      >
        <SpeakerIcon className="size-4 shrink-0" />
        Аудио для этой записи пока не добавлено
      </p>
    );
  }

  if (!active) {
    return (
      <button
        type="button"
        data-custom-focus
        onClick={() => setUserStarted(true)}
        aria-label={`Прослушать: ${title}`}
        className={cn(
          'inline-flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4',
          'text-[0.9375rem] font-bold text-ink transition-colors hover:bg-surface-3 active:scale-[0.98]',
          className,
        )}
      >
        <SpeakerIcon className="size-[1.125rem]" />
        Прослушать
      </button>
    );
  }

  return (
    <div className={cn('rounded-2xl border border-line bg-surface-2 p-3', className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true);
          setError(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
        onError={() => {
          setError(true);
          setPlaying(false);
        }}
      />

      {error ? (
        <p className="px-1 pb-2 text-[0.8125rem] leading-snug font-semibold text-warning">
          Не удалось загрузить аудио. Проверьте соединение — текст доступен и без него.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          data-custom-focus
          onClick={toggle}
          aria-label={playing ? 'Пауза' : 'Воспроизвести'}
          className={cn(
            'inline-flex size-12 shrink-0 items-center justify-center rounded-full',
            'bg-accent text-accent-contrast transition-transform active:scale-95',
          )}
        >
          {playing ? <PauseIcon className="size-5" /> : <PlayIcon className="size-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.1}
            value={position}
            onChange={(event) => onSeek(Number(event.target.value))}
            aria-label="Перемотка"
            className="h-6 w-full cursor-pointer accent-[var(--az-accent)]"
          />
          <div className="flex justify-between px-0.5 text-[0.75rem] font-semibold tabular-nums text-ink-subtle">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <SegmentedControl
        className="mt-3"
        size="sm"
        label="Скорость воспроизведения"
        value={String(settings.playbackRate)}
        options={RATE_OPTIONS}
        onChange={(value) => setSetting('playbackRate', Number(value) as PlaybackRate)}
      />
    </div>
  );
}
