import { PWA_CONFIG } from '@/platform/pwa/pwa-config';
import { isWebProductionBuild } from '@/platform/pwa/is-web-production';

type ServiceWorkerUpdateListener = () => void;

let updateListener: ServiceWorkerUpdateListener | null = null;

export function onServiceWorkerUpdate(listener: ServiceWorkerUpdateListener): () => void {
  updateListener = listener;
  return () => {
    if (updateListener === listener) {
      updateListener = null;
    }
  };
}

export function activateWaitingServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  void navigator.serviceWorker.getRegistration().then((registration) => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });
}

export async function registerServiceWorker(): Promise<void> {
  if (!isWebProductionBuild() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(PWA_CONFIG.serviceWorkerPath, {
      scope: PWA_CONFIG.scope,
    });

    registration.addEventListener('updatefound', () => {
      const nextWorker = registration.installing;
      if (!nextWorker) {
        return;
      }

      nextWorker.addEventListener('statechange', () => {
        if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
          updateListener?.();
        }
      });
    });
  } catch {
    // Service worker is optional; installability may be limited without it.
  }
}
