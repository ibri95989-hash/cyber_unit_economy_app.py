import Link from 'next/link';
import { getFeaturedCategories } from '@/data';

export const metadata = {
  title: 'Нет соединения',
  robots: { index: false, follow: false },
};

/** Запасная страница, которую service worker отдаёт при полном отсутствии сети. */
export default function OfflinePage() {
  const categories = getFeaturedCategories().slice(0, 4);

  return (
    <div className="container-az py-12 text-center safe-bottom">
      <p aria-hidden="true" className="text-4xl">
        📡
      </p>
      <h1 className="mt-4 text-[1.5rem] font-extrabold text-ink">Нет соединения</h1>
      <p className="mx-auto mt-2 max-w-sm text-[1rem] leading-relaxed font-medium text-ink-muted">
        Разделы, которые вы уже открывали, доступны и без интернета. Аудио потребует соединения.
      </p>

      <ul className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/${category.slug}`}
              className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-card-lg border border-line bg-surface px-3 py-4 shadow-soft"
            >
              <span aria-hidden="true" className="text-2xl">
                {category.emoji}
              </span>
              <span className="text-[0.875rem] font-extrabold text-ink">{category.shortTitle}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
