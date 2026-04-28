'use client';

import { useEffect } from 'react';

export function PWAProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        registration.update().catch(() => {});
      } catch {
        // Keep PWA registration silent in production UX.
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
