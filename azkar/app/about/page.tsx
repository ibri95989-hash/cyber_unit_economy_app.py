import type { Metadata } from 'next';
import Link from 'next/link';
import { allAzkar, getCategoryById, getVerificationStats } from '@/data';
import { SITE } from '@/lib/constants';
import { VerificationBadge } from '@/components/ui/VerificationBadge';

export const metadata: Metadata = {
  title: 'О проекте и достоверности текстов',
  description:
    'Как устроен AZKAR: откуда берутся тексты, что означает пометка «Требует проверки» и как сообщить об ошибке.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  const stats = getVerificationStats();

  // Разделы, где есть записи без выверенной ссылки — чтобы это было видно, а не спрятано.
  const byCategory = new Map<string, number>();
  for (const azkar of allAzkar) {
    if (azkar.verified) continue;
    byCategory.set(azkar.category, (byCategory.get(azkar.category) ?? 0) + 1);
  }

  return (
    <div className="container-az pt-2 pb-6 safe-bottom lg:px-0">
      <h1 className="text-[1.75rem] leading-tight font-extrabold text-ink">О проекте</h1>

      <p className="mt-3 text-[1rem] leading-relaxed font-medium text-ink-muted">
        {SITE.name} — это приложение для ежедневного чтения азкаров: арабский текст, русский
        перевод, транскрипция, счётчик повторов и сохранение прогресса. Всё работает без интернета
        и без регистрации.
      </p>

      <h2 className="mt-8 text-[1.25rem] font-extrabold text-ink">Откуда тексты</h2>
      <p className="mt-2 text-[1rem] leading-relaxed font-medium text-ink-muted">
        Коранические аяты приводятся с точной ссылкой «сура: аят» — такие записи помечены как
        проверенные. Переводы на русский сделаны для этого проекта и являются смысловыми: они не
        заменяют тафсир и не копируют чужие издания.
      </p>

      <h2 className="mt-8 text-[1.25rem] font-extrabold text-ink">Что означают пометки</h2>
      <div className="mt-3 space-y-3">
        <div className="rounded-card-lg border border-line bg-surface p-4">
          <VerificationBadge verified />
          <p className="mt-2 text-[0.9375rem] leading-relaxed font-medium text-ink-muted">
            Текст и ссылка выверены. Сейчас это {stats.verified} из {stats.total} записей —
            в основном аяты Корана, где ссылка однозначна.
          </p>
        </div>
        <div className="rounded-card-lg border border-line bg-surface p-4">
          <VerificationBadge verified={false} />
          <p className="mt-2 text-[0.9375rem] leading-relaxed font-medium text-ink-muted">
            Текст приведён и название сборника указано, но точный номер хадиса намеренно не
            проставлен: выдуманная ссылка хуже отсутствующей. Таких записей {stats.needsReview}.
            Перед тем как опираться на них, сверьтесь с печатным изданием или спросите знающего
            человека.
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-[1.25rem] font-extrabold text-ink">Что требует проверки</h2>
      <ul className="mt-3 space-y-1.5">
        {[...byCategory.entries()].map(([categoryId, count]) => {
          const category = getCategoryById(categoryId as never);
          if (!category) return null;
          return (
            <li
              key={categoryId}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-inset px-4 py-2.5"
            >
              <Link
                href={`/${category.slug}`}
                className="text-[0.9375rem] font-bold text-ink hover:text-accent"
              >
                {category.emoji} {category.title}
              </Link>
              <span className="shrink-0 text-[0.875rem] font-bold tabular-nums text-warning">
                {count}
              </span>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 text-[1.25rem] font-extrabold text-ink">Нашли ошибку?</h2>
      <p className="mt-2 text-[1rem] leading-relaxed font-medium text-ink-muted">
        Сообщите — текст поправят. Достоверность здесь важнее скорости наполнения: лучше меньше
        записей, но выверенных.
      </p>
    </div>
  );
}
