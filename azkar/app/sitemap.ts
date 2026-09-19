import type { MetadataRoute } from 'next';
import { getCategories } from '@/data';
import { SITE } from '@/lib/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: SITE.url, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/azkar`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE.url}/about`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    ...getCategories().map((category) => ({
      url: `${SITE.url}/${category.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: category.featured ? 0.9 : 0.7,
    })),
  ];
}
