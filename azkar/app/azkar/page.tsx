import type { Metadata } from 'next';
import { getCategories, getCategoryCount, getVerificationStats } from '@/data';
import { CategoryCard } from '@/components/home/CategoryCard';

export const metadata: Metadata = {
  title: 'Все разделы азкаров',
  description:
    'Полный список разделов: утренние и вечерние азкары, после намаза, перед сном, после пробуждения, защитные дуа, дуа из Корана и дуа Пророка ﷺ.',
  alternates: { canonical: '/azkar' },
};

export default function AzkarIndexPage() {
  const categories = getCategories();
  const stats = getVerificationStats();

  return (
    <div className="container-az pt-2 pb-6 safe-bottom lg:px-0">
      <h1 className="text-[1.75rem] leading-tight font-extrabold text-ink">Все разделы</h1>
      <p className="mt-2 text-[0.9375rem] font-medium text-ink-muted">
        {stats.total} записей. Из них {stats.verified} с точной ссылкой на источник.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            count={getCategoryCount(category.id)}
          />
        ))}
      </div>
    </div>
  );
}
