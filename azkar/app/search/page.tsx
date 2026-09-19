import type { Metadata } from 'next';
import { Search } from '@/components/search/Search';

export const metadata: Metadata = {
  title: 'Поиск по азкарам и дуа',
  description:
    'Найдите нужную дуа по русскому тексту, названию, источнику или разделу: защита, тревога, прощение, дорога, болезнь.',
  alternates: { canonical: '/search' },
  // Страница поиска не должна попадать в индекс: полезного контента на ней нет.
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return <Search />;
}
