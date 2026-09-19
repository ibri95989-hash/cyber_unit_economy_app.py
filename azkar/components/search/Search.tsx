'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { allAzkar, getCategoryById } from '@/data';
import { buildSearchIndex, searchIndex } from '@/lib/search';
import { pluralizeRu } from '@/lib/time';
import { AzkarListItem } from '@/components/azkar/AzkarListItem';
import { IconButton } from '@/components/ui/Button';
import { CloseIcon, SearchIcon } from '@/components/ui/Icon';

const SUGGESTIONS = ['защита', 'тревога', 'прощение', 'сон', 'дорога', 'дети', 'болезнь', 'коран'];

/**
 * Глобальный поиск по названию, переводу, транскрипции, источнику,
 * тегам и названию раздела.
 *
 * Индекс строится один раз на монтирование — данные статические,
 * а 122 записи обходятся быстрее, чем инициализируется любой внешний движок.
 */
export function Search() {
  const [query, setQuery] = useState('');
  // Ввод не должен «залипать» на медленных телефонах.
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildSearchIndex(allAzkar, getCategoryById), []);
  const results = useMemo(() => searchIndex(index, deferredQuery), [index, deferredQuery]);

  useEffect(() => {
    // Фокус на поле — пользователь пришёл сюда именно искать.
    inputRef.current?.focus();
  }, []);

  const hasQuery = deferredQuery.trim().length >= 2;

  return (
    <div className="container-az pt-2 pb-6 safe-bottom lg:px-0">
      <h1 className="text-[1.75rem] leading-tight font-extrabold text-ink">Поиск</h1>

      <div className="relative mt-4">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-subtle" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Например: защита, тревога, Муслим"
          aria-label="Поиск по азкарам"
          enterKeyHint="search"
          autoComplete="off"
          data-custom-focus
          className="h-14 w-full rounded-2xl border border-line bg-surface ps-12 pe-12 text-[1rem] font-semibold text-ink placeholder:font-medium placeholder:text-ink-subtle"
        />
        {query ? (
          <IconButton
            aria-label="Очистить поиск"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2"
          >
            <CloseIcon className="size-4" />
          </IconButton>
        ) : null}
      </div>

      {!hasQuery ? (
        <div className="mt-6">
          <p className="text-[0.6875rem] font-extrabold tracking-wider text-ink-subtle uppercase">
            Попробуйте
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  data-custom-focus
                  onClick={() => setQuery(suggestion)}
                  className="min-h-11 rounded-full border border-line bg-surface-2 px-4 text-[0.9375rem] font-bold text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p aria-live="polite" className="mt-4 text-[0.875rem] font-semibold text-ink-muted">
            {results.length === 0
              ? 'Ничего не найдено'
              : `${results.length} ${pluralizeRu(results.length, ['результат', 'результата', 'результатов'])}`}
          </p>

          {results.length === 0 ? (
            <p className="mt-2 text-[0.9375rem] leading-relaxed font-medium text-ink-subtle">
              Попробуйте другое слово — например, «защита», «прощение» или название сборника.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {results.map((result) => (
                <AzkarListItem
                  key={result.azkar.id}
                  azkar={result.azkar}
                  category={result.category}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
