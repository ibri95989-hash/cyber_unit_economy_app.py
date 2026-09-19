import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Noto_Naskh_Arabic } from 'next/font/google';
import { AppShell } from '@/components/navigation/AppShell';
import { SITE } from '@/lib/constants';
import { STORAGE_KEYS } from '@/lib/constants';
import { Providers } from './providers';
import '@/styles/globals.css';

/**
 * Три вариативных шрифта, все самохостятся через next/font:
 * без запросов к сторонним доменам и без скачка вёрстки при загрузке.
 */
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
  preload: true,
});

const naskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  variable: '--font-naskh',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    locale: SITE.locale,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f5f1' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d0c' },
  ],
};

/**
 * Тема и размеры шрифта применяются ДО первой отрисовки.
 * Иначе пользователь тёмной темы видит вспышку светлого фона.
 *
 * Скрипт статический, без пользовательских данных — это единственное
 * оправданное место для dangerouslySetInnerHTML в проекте.
 */
const themeBootstrap = `
(function () {
  try {
    var raw = localStorage.getItem('${STORAGE_KEYS.settings}');
    var s = raw ? JSON.parse(raw) : null;
    var pref = s && s.theme ? s.theme : 'auto';
    var dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
    var A = { '-2': '1.625rem', '-1': '1.8125rem', '0': '2rem', '1': '2.25rem', '2': '2.5rem', '3': '2.75rem' };
    var L = { '-2': '2.05', '-1': '2.1', '0': '2.15', '1': '2.15', '2': '2.2', '3': '2.2' };
    var T = { '-2': '1rem', '-1': '1.0625rem', '0': '1.1875rem', '1': '1.3125rem', '2': '1.4375rem', '3': '1.5625rem' };
    if (s && A[s.arabicFontStep]) {
      root.style.setProperty('--az-arabic-size', A[s.arabicFontStep]);
      root.style.setProperty('--az-arabic-leading', L[s.arabicFontStep]);
    }
    if (s && T[s.translationFontStep]) {
      root.style.setProperty('--az-translation-size', T[s.translationFontStep]);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${naskh.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
