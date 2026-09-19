import type { ReactNode } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { DesktopSidebar } from './DesktopSidebar';
import { TopBar } from './TopBar';
import { SettingsSheet } from '@/components/settings/SettingsSheet';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

/**
 * Каркас приложения: боковая панель на десктопе, верхняя панель
 * и фиксированная нижняя навигация на мобильном.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="lg:flex lg:items-start">
      {/* Первый элемент в DOM — иначе с клавиатуры пришлось бы проходить всю боковую панель. */}
      <a
        href="#main"
        className="sr-only-focusable absolute top-2 left-2 z-50 rounded-xl bg-accent px-4 py-2 font-bold text-accent-contrast"
      >
        Перейти к содержимому
      </a>

      <DesktopSidebar />

      <div className="min-w-0 flex-1">
        <TopBar />

        <main id="main" className="lg:mx-auto lg:max-w-3xl lg:px-4 lg:pt-6 lg:pb-16">
          {children}
        </main>
      </div>

      <BottomNavigation />
      <SettingsSheet />
      <ServiceWorkerRegistration />
    </div>
  );
}
