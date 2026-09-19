import type { Azkar } from '@/types/azkar';
import { morningEveningPairs } from './_shared/morning-evening';
import { expandPairs } from './_shared/pair';

/**
 * ВЕЧЕРНИЕ АЗКАРЫ.
 *
 * Зеркальны утренним: см. комментарий в `morning.ts`.
 * Записи только для вечера помечены `only: 'evening'`.
 */
export const eveningAzkar: Azkar[] = expandPairs(morningEveningPairs, 'evening', 'evening');

export default eveningAzkar;
