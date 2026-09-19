import type { Metadata } from 'next';
import { FavoritesList } from '@/components/azkar/FavoritesList';

export const metadata: Metadata = {
  title: 'Избранные дуа',
  description: 'Ваши сохранённые азкары и дуа — всегда под рукой, работают и без интернета.',
  alternates: { canonical: '/favorites' },
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return <FavoritesList />;
}
