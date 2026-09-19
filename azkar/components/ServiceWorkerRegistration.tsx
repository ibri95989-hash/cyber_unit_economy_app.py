'use client';

import { useEffect } from 'react';

/**
 * Регистрация service worker для офлайн-режима.
 *
 * В разработке не регистрируем: кеш мешает видеть свежие правки.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* Офлайн-режим — улучшение, а не обязательное условие работы. */
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
