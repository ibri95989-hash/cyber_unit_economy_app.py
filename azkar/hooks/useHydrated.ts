'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * true после гидрации, false на сервере.
 *
 * useSyncExternalStore вместо useState+useEffect: React сам подставляет
 * серверный снимок во время гидрации, без каскадного ререндера.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, clientSnapshot, serverSnapshot);
}
