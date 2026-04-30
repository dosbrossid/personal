'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PWAProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let isRefreshing = false;

    const handleControllerChange = () => {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        const promptForRefresh = (worker: ServiceWorker) => {
          toast('Versi baru aplikasi sudah siap.', {
            id: 'pwa-update-ready',
            description: 'Muat ulang agar dashboard memakai versi terbaru.',
            action: {
              label: 'Muat ulang',
              onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }),
            },
          });
        };

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          if (!newWorker) {
            return;
          }

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              promptForRefresh(newWorker);
            }
          });
        });

        if (registration.waiting && navigator.serviceWorker.controller) {
          promptForRefresh(registration.waiting);
        }

        registration.update().catch(() => undefined);
      } catch {
        // Keep PWA registration silent in production UX.
      }
    };

    registerServiceWorker();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();

      const installPrompt = event as BeforeInstallPromptEvent;

      toast('Install Zmaula Dashboard?', {
        id: 'pwa-install-prompt',
        description: 'Buka lebih cepat dari home screen, terasa seperti app native.',
        action: {
          label: 'Install',
          onClick: async () => {
            toast.dismiss('pwa-install-prompt');
            await installPrompt.prompt();
            await installPrompt.userChoice.catch(() => undefined);
          },
        },
      });
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  return null;
}
