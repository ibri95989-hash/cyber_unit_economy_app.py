/**
 * Аудит контента: что готово к публикации, а что ещё требует проверки.
 *
 * Запуск: npm run content:audit
 *
 * Скрипт намеренно строгий — он падает, если в данных появилось то,
 * чего в них быть не должно (дубли id, пустые поля, «проверенная» запись
 * без ссылки на источник).
 */
import { allAzkar, categories, getAzkarByCategory, getVerificationStats } from '../data';
import type { Azkar } from '../types/azkar';

const problems: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) problems.push(message);
}

// --- Целостность ---
const seen = new Set<string>();
for (const azkar of allAzkar) {
  check(!seen.has(azkar.id), `Дубликат id: ${azkar.id}`);
  seen.add(azkar.id);

  check(azkar.arabic.trim().length > 0, `${azkar.id}: пустой арабский текст`);
  check(azkar.translation.trim().length > 0, `${azkar.id}: пустой перевод`);
  check(azkar.transliteration.trim().length > 0, `${azkar.id}: пустая транскрипция`);
  check(azkar.title.trim().length > 0, `${azkar.id}: пустое название`);
  check(azkar.repetitions >= 1, `${azkar.id}: repetitions должен быть >= 1`);
  check(azkar.tags.length > 0, `${azkar.id}: нет тегов — запись не найдётся поиском`);
  check(
    azkar.source.collection.trim().length > 0,
    `${azkar.id}: не указан сборник или пометка о том, что источник неизвестен`,
  );

  // Главное правило проекта: «Проверено» без точной ссылки ставить нельзя.
  if (azkar.verified) {
    check(
      Boolean(azkar.source.reference?.trim()),
      `${azkar.id}: verified: true, но нет точной ссылки на источник`,
    );
    check(
      azkar.source.kind !== 'unknown',
      `${azkar.id}: verified: true при неизвестном типе источника`,
    );
  }

  // Арабский текст не должен содержать кириллицу — типичная опечатка при копировании.
  check(!/[а-яА-ЯёЁ]/.test(azkar.arabic), `${azkar.id}: в арабском тексте встретилась кириллица`);
}

// --- Порядок внутри разделов ---
for (const category of categories) {
  const list = getAzkarByCategory(category.id);
  check(list.length > 0, `Раздел «${category.title}» пуст`);
  list.forEach((azkar, index) => {
    check(
      azkar.order === index + 1,
      `${azkar.id}: order=${azkar.order}, а позиция в массиве ${index + 1}`,
    );
    check(
      azkar.category === category.id,
      `${azkar.id}: лежит в разделе ${category.id}, но помечен как ${azkar.category}`,
    );
  });
}

// --- Отчёт ---
const stats = getVerificationStats();

console.log('\n=== АУДИТ КОНТЕНТА AZKAR ===\n');
console.log(`Всего записей:        ${stats.total}`);
console.log(`Проверено:            ${stats.verified}`);
console.log(`Требует проверки:     ${stats.needsReview}\n`);

console.log('По разделам:');
for (const category of categories) {
  const list = getAzkarByCategory(category.id);
  const verified = list.filter((a) => a.verified).length;
  const label = `${category.emoji} ${category.title}`.padEnd(28, ' ');
  console.log(`  ${label} ${String(list.length).padStart(3)} записей, проверено ${verified}`);
}

const needsReview: Azkar[] = allAzkar.filter((a) => !a.verified);
if (needsReview.length > 0) {
  console.log('\nЗаписи без выверенной ссылки на источник:');
  for (const azkar of needsReview) {
    const ref = azkar.source.reference ? ` (${azkar.source.reference})` : '';
    console.log(`  • ${azkar.id.padEnd(34)} ${azkar.source.collection}${ref}`);
  }
  console.log('\nЧто делать: сверьте текст и проставьте точный номер хадиса в');
  console.log('source.reference, затем поменяйте verified на true.');
}

if (problems.length > 0) {
  console.error(`\n❌ Найдено проблем: ${problems.length}\n`);
  for (const problem of problems) console.error(`  • ${problem}`);
  process.exit(1);
}

console.log('\n✅ Структурных ошибок в данных нет.\n');
