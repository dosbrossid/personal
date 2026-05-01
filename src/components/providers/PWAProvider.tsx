'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const INSTALL_TOAST_ID = 'pwa-install-prompt';
const INSTALL_PROMPT_SESSION_KEY = 'zmaula:pwa-install-helper-v2-shown';

function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isPublicBlogSurface(pathname: string) {
  const hostname = window.location.hostname;

  return (
    hostname === 'zmaula.web.id' ||
    pathname.startsWith('/public-blog') ||
    (hostname !== 'app.zmaula.web.id' && pathname.startsWith('/blog'))
  );
}

export function PWAProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (isPublicBlogSurface(pathname)) {
      const suppressInstallPrompt = (event: Event) => {
        event.preventDefault();
      };

      window.addEventListener('beforeinstallprompt', suppressInstallPrompt);

      return () => {
        window.removeEventListener('beforeinstallprompt', suppressInstallPrompt);
      };
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
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || isRunningStandalone() || !window.isSecureContext) {
      return;
    }

    if (isPublicBlogSurface(pathname)) {
      return;
    }

    let nativePromptWasShown = false;

    const showInstallFallback = () => {
      if (nativePromptWasShown || isRunningStandalone()) {
        return;
      }

      if (sessionStorage.getItem(INSTALL_PROMPT_SESSION_KEY) === '1') {
        return;
      }

      sessionStorage.setItem(INSTALL_PROMPT_SESSION_KEY, '1');

      const description = isIOSDevice()
        ? 'Di iPhone/iPad: buka Share, lalu pilih Add to Home Screen.'
        : 'Kalau tombol native tidak muncul: di Chrome buka menu ⋮, lalu pilih Install app atau Add to Home screen.';

      toast('Install Zmaula Dashboard', {
        id: INSTALL_TOAST_ID,
        description,
        duration: 20000,
        action: {
          label: 'Mengerti',
          onClick: () => toast.dismiss(INSTALL_TOAST_ID),
        },
      });
    };

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      nativePromptWasShown = true;

      const installPrompt = event as BeforeInstallPromptEvent;

      toast('Install Zmaula Dashboard?', {
        id: INSTALL_TOAST_ID,
        description: 'Buka lebih cepat dari home screen, terasa seperti app native.',
        duration: 15000,
        action: {
          label: 'Install',
          onClick: async () => {
            toast.dismiss(INSTALL_TOAST_ID);
            await installPrompt.prompt();
            await installPrompt.userChoice.catch(() => undefined);
          },
        },
      });
    };

    const handleAppInstalled = () => {
      sessionStorage.setItem(INSTALL_PROMPT_SESSION_KEY, '1');
      toast.success('Zmaula Dashboard berhasil diinstall.', {
        id: INSTALL_TOAST_ID,
      });
    };

    const fallbackTimer = window.setTimeout(showInstallFallback, 3000);

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [pathname]);

  return null;
}
