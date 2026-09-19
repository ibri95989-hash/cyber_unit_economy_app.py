import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategories, getCategoryWithAzkar } from '@/data';
import { SITE } from '@/lib/constants';
import { AzkarReader } from '@/components/azkar/AzkarReader';
import { JsonLd } from '@/components/seo/JsonLd';

interface PageProps {
  params: Promise<{ category: string }>;
}

/** Все разделы известны заранее — страницы полностью статические. */
export function generateStaticParams() {
  return getCategories().map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryWithAzkar(slug);
  if (!category) return { title: 'Раздел не найден' };

  const url = `/${category.slug}`;
  return {
    title: category.seo.title,
    description: category.seo.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      locale: SITE.locale,
      siteName: SITE.name,
      title: category.seo.title,
      description: category.seo.description,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: category.seo.title,
      description: category.seo.description,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  const category = getCategoryWithAzkar(slug);
  if (!category) notFound();

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: category.title,
          description: category.description,
          url: `${SITE.url}/${category.slug}`,
          inLanguage: 'ru',
          isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: category.azkar.length,
            itemListElement: category.azkar.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.title,
            })),
          },
        }}
      />

      {/* Заголовок нужен поисковикам и скринридерам, визуально его роль играет ProgressHeader. */}
      <h1 className="sr-only">{category.seo.title}</h1>

      <AzkarReader category={category} azkar={category.azkar} />
    </>
  );
}
