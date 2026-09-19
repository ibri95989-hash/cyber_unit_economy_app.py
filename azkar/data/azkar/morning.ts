import type { Azkar } from '@/types/azkar';
import { morningEveningPairs } from './_shared/morning-evening';
import { expandPairs } from './_shared/pair';

/**
 * УТРЕННИЕ АЗКАРЫ.
 *
 * Общая с вечерними часть живёт в `_shared/morning-evening.ts`, чтобы
 * два списка не разъезжались. Специфичные только для утра записи
 * помечены там через `only: 'morning'`.
 *
 * Чтобы добавить новый утренний азкар:
 *  • если он читается и вечером — добавьте пару в `_shared/morning-evening.ts`;
 *  • если только утром — добавьте пару туда же с `only: 'morning'`.
 */
export const morningAzkar: Azkar[] = expandPairs(morningEveningPairs, 'morning', 'morning');

export default morningAzkar;
