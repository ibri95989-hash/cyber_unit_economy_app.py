import type { MetadataRoute } from 'next';
import { getFeaturedCategories } from '@/data';
import { SITE } from '@/lib/constants';

/**
 * Манифест PWA. Генерируется из тех же данных, что и навигация,
 * поэтому ярлыки не разъезжаются с реальными разделами.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    lang: 'ru',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f5f1',
    theme_color: '#0d7a56',
    categories: ['books', 'lifestyle', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: getFeaturedCategories()
      .slice(0, 4)
      .map((category) => ({
        name: category.title,
        short_name: category.shortTitle,
        url: `/${category.slug}`,
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      })),
  };
}
