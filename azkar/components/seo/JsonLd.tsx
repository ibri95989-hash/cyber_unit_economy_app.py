/**
 * Разметка Schema.org.
 *
 * Данные приходят только из наших статических файлов, но `<` всё равно
 * экранируется: это защищает от выхода из тега, если когда-нибудь
 * контент начнёт приходить из внешнего источника.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
