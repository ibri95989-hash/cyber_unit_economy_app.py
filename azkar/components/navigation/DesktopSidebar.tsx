'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { SITE } from '@/lib/constants';
import { categories } from '@/data/categories';
import { useUi } from '@/hooks/useUi';
import { HeartIcon, HomeIcon, SearchIcon, SettingsIcon } from '@/components/ui/Icon';

/**
 * Боковая панель для больших экранов.
 * Мобильная версия остаётся главной — здесь только удобство навигации.
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  const { openSettings } = useUi();

  const linkClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[0.9375rem] font-bold transition-colors',
      active ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
    );

  return (
    <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-line lg:px-4 lg:py-6">
      <Link
        href="/"
        data-custom-focus
        className="mb-6 block rounded-xl px-3 text-[1.375rem] leading-none font-extrabold tracking-[0.14em] text-ink"
      >
        {SITE.name}
      </Link>

      <nav aria-label="Разделы">
        <ul className="space-y-0.5">
          <li>
            <Link href="/" className={linkClass(pathname === '/')}>
              <HomeIcon className="size-[1.125rem]" />
              Главная
            </Link>
          </li>
          <li>
            <Link href="/search" className={linkClass(pathname === '/search')}>
              <SearchIcon className="size-[1.125rem]" />
              Поиск
            </Link>
          </li>
        </ul>

        <p className="mt-6 mb-1.5 px-3 text-[0.6875rem] font-extrabold tracking-wider text-ink-subtle uppercase">
          Разделы
        </p>
        <ul className="space-y-0.5">
          {categories.map((category) => (
            <li key={category.id}>
              <Link href={`/${category.slug}`} className={linkClass(pathname === `/${category.slug}`)}>
                <span aria-hidden="true" className="w-[1.125rem] text-center text-base">
                  {category.emoji}
                </span>
                {category.shortTitle}
              </Link>
            </li>
          ))}
        </ul>

        <ul className="mt-6 space-y-0.5 border-t border-line pt-4">
          <li>
            <Link href="/favorites" className={linkClass(pathname === '/favorites')}>
              <HeartIcon className="size-[1.125rem]" filled={pathname === '/favorites'} />
              Избранное
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={openSettings}
              aria-haspopup="dialog"
              className={cn(linkClass(false), 'w-full')}
            >
              <SettingsIcon className="size-[1.125rem]" />
              Настройки
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
