import type { Href } from 'expo-router';

/** Minimal router surface needed for safe contextual back navigation. */
export interface SafeBackRouter {
  canGoBack(): boolean;
  back(): void;
  replace(href: Href): void;
}

export const DEFAULT_SAFE_BACK_FALLBACK: Href = '/(tabs)';

/**
 * Prefer in-app history when available; otherwise replace with a contextual
 * fallback so deep-linked / refreshed detail screens never emit GO_BACK warnings.
 */
export function navigateBackSafely(
  router: SafeBackRouter,
  fallbackHref: Href = DEFAULT_SAFE_BACK_FALLBACK,
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackHref);
}
