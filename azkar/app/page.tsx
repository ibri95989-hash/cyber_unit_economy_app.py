import type { Metadata } from 'next';
import { getCategories, getCategoryCount } from '@/data';
import { SITE } from '@/lib/constants';
import { HomeScreen } from '@/components/home/HomeScreen';

export const metadata: Metadata = {
  title: `${SITE.name} — утренние и вечерние азкары с переводом и счётчиком`,
  description: SITE.description,
  alternates: { canonical: '/' },
};

/**
 * Серверный компонент: список разделов и счётчики считаются на сервере
 * и уходят в разметку. Клиенту остаётся только прогресс из localStorage.
 */
export default function HomePage() {
  const categories = [...getCategories()];
  const counts = Object.fromEntries(
    categories.map((category) => [category.id, getCategoryCount(category.id)]),
  );

  return <HomeScreen categories={categories} counts={counts} />;
}
