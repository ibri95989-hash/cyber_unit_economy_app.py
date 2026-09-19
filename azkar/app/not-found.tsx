import Link from 'next/link';
import { getFeaturedCategories } from '@/data';

export const metadata = {
  title: 'Страница не найдена',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const suggestions = getFeaturedCategories().slice(0, 4);

  return (
    <div className="container-az py-12 text-center safe-bottom">
      <p
        aria-hidden="true"
        className="text-[3.5rem] leading-none font-extrabold tracking-tight text-accent-soft-strong"
      >
        404
      </p>
      <h1 className="mt-3 text-[1.5rem] font-extrabold text-ink">Такой страницы нет</h1>
      <p className="mx-auto mt-2 max-w-sm text-[1rem] leading-relaxed font-medium text-ink-muted">
        Возможно, ссылка устарела. Вот разделы, с которых обычно начинают.
      </p>

      <ul className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
        {suggestions.map((category) => (
          <li key={category.id}>
            <Link
              href={`/${category.slug}`}
              data-custom-focus
              className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-card-lg border border-line bg-surface px-3 py-4 shadow-soft transition-transform active:scale-[0.98]"
            >
              <span aria-hidden="true" className="text-2xl">
                {category.emoji}
              </span>
              <span className="text-[0.875rem] font-extrabold text-ink">{category.shortTitle}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        data-custom-focus
        className="mt-6 inline-flex min-h-12 items-center rounded-2xl px-5 font-bold text-accent"
      >
        Вернуться на главную
      </Link>
    </div>
  );
}
