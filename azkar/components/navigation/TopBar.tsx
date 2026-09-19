'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { SITE } from '@/lib/constants';
import { useUi } from '@/hooks/useUi';
import { IconButton } from '@/components/ui/Button';
import { ArrowLeftIcon, SearchIcon, SettingsIcon } from '@/components/ui/Icon';

/**
 * Верхняя панель. На главной — логотип, на внутренних страницах — кнопка «Назад».
 */
export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { openSettings, settingsOpen } = useUi();

  const isHome = pathname === '/';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md',
      // На десктопе навигация полностью в боковой панели — дублировать её незачем.
      'lg:hidden',
      )}
    >
      <div className="container-az flex h-14 items-center gap-1">
        {isHome ? (
          <Link
            href="/"
            data-custom-focus
            className="rounded-xl text-[1.375rem] leading-none font-extrabold tracking-[0.14em] text-ink"
          >
            {SITE.name}
          </Link>
        ) : (
          <IconButton
            aria-label="Назад"
            variant="ghost"
            onClick={() => router.back()}
            className="-ms-2"
          >
            <ArrowLeftIcon className="size-5" />
          </IconButton>
        )}

        <div className="ms-auto flex items-center gap-1">
          <Link
            href="/search"
            aria-label="Поиск по азкарам"
            data-custom-focus
            className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <SearchIcon className="size-5" />
          </Link>
          <IconButton
            aria-label="Настройки"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            variant="ghost"
            onClick={openSettings}
            className="-me-2"
          >
            <SettingsIcon className="size-5" />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
