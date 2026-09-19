/**
 * Сборка демо-версии в один самодостаточный HTML-файл.
 *
 * Запуск: npm run demo:build
 *
 * Тексты берутся из data/*.ts — второго набора контента не существует,
 * демо всегда собирается из того же источника, что и основное приложение.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, getAzkarByCategory, getVerificationStats } from '../data';
import type { Azkar } from '../types/azkar';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** В демо не нужны поля, которые оно не показывает (audioUrl, reviewNote для редактора). */
function slim(azkar: Azkar) {
  return {
    id: azkar.id,
    category: azkar.category,
    order: azkar.order,
    title: azkar.title,
    arabic: azkar.arabic,
    translation: azkar.translation,
    transliteration: azkar.transliteration,
    repetitions: azkar.repetitions,
    source: azkar.source,
    ...(azkar.sourceDetails ? { sourceDetails: azkar.sourceDetails } : {}),
    tags: azkar.tags,
    verified: azkar.verified,
  };
}

const payload = {
  categories: categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    title: category.title,
    shortTitle: category.shortTitle,
    emoji: category.emoji,
    accent: category.accent,
    count: getAzkarByCategory(category.id).length,
  })),
  azkar: Object.fromEntries(
    categories.map((category) => [category.id, getAzkarByCategory(category.id).map(slim)]),
  ),
  stats: getVerificationStats(),
};

const template = readFileSync(resolve(ROOT, 'demo/template.html'), 'utf8');

// Экранируем `<`, чтобы строка из данных не могла закрыть тег <script>.
const json = JSON.stringify(payload).replace(/</g, '\\u003c');

if (!template.includes('__AZKAR_DATA__')) {
  throw new Error('В шаблоне нет плейсхолдера __AZKAR_DATA__');
}

const out = template.replace('__AZKAR_DATA__', json);
const target = resolve(ROOT, 'demo/index.html');
writeFileSync(target, out);

const kb = (out.length / 1024).toFixed(0);
console.log(`✓ demo/index.html — ${kb} KB, ${payload.stats.total} записей в ${payload.categories.length} разделах`);
