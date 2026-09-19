'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useUi } from '@/hooks/useUi';
import { BeadsIcon, HeartIcon, HomeIcon, SettingsIcon } from '@/components/ui/Icon';

const LINKS = [
  { href: '/', label: 'Главная', Icon: HomeIcon, exact: true },
  { href: '/azkar', label: 'Азкары', Icon: BeadsIcon, exact: false },
  { href: '/favorites', label: 'Избранное', Icon: HeartIcon, exact: false },
] as const;

/**
 * Нижняя навигация — основной способ перемещения на телефоне.
 * Фиксирована, но контент под ней не прячется: страницы добавляют
 * отступ через утилиту `safe-bottom`.
 */
export function BottomNavigation() {
  const pathname = usePathname();
  const { openSettings, settingsOpen } = useUi();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Основная навигация"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 backdrop-blur-lg',
        'lg:hidden',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {LINKS.map(({ href, label, Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                data-custom-focus
                className={cn(
                  'flex h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl',
                  'text-[0.6875rem] font-bold transition-colors',
                  active ? 'text-accent' : 'text-ink-subtle hover:text-ink-muted',
                )}
              >
                {href === '/favorites' ? (
                  <HeartIcon className="size-[1.375rem]" filled={active} />
                ) : (
                  <Icon className="size-[1.375rem]" />
                )}
                {label}
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={openSettings}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            data-custom-focus
            className={cn(
              'flex h-[4.25rem] w-full flex-col items-center justify-center gap-1 rounded-2xl',
              'text-[0.6875rem] font-bold transition-colors',
              settingsOpen ? 'text-accent' : 'text-ink-subtle hover:text-ink-muted',
            )}
          >
            <SettingsIcon className="size-[1.375rem]" />
            Настройки
          </button>
        </li>
      </ul>
    </nav>
  );
}
