export const ANALYTICS_CONFIG = {
  measurementIdEnv: 'EXPO_PUBLIC_GA4_MEASUREMENT_ID',
  debugEnv: 'EXPO_PUBLIC_GA4_DEBUG',
  enabledEnv: 'EXPO_PUBLIC_ANALYTICS_ENABLED',
} as const;

export function getGa4MeasurementId(): string | null {
  const id = process.env.EXPO_PUBLIC_GA4_MEASUREMENT_ID?.trim();
  return id && id.startsWith('G-') ? id : null;
}

export function isAnalyticsFeatureEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === 'true';
}

export function isGa4DebugMode(): boolean {
  return process.env.EXPO_PUBLIC_GA4_DEBUG === 'true';
}

export function shouldLoadAnalytics(consentGranted: boolean): boolean {
  if (!isAnalyticsFeatureEnabled()) {
    return false;
  }
  if (!getGa4MeasurementId()) {
    return false;
  }
  return consentGranted;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function updateGtagConsent(consent: Record<string, 'granted' | 'denied'>): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  window.gtag('consent', 'update', consent);
}

export function setDefaultGtagConsent(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
}

export function loadGa4Script(measurementId: string): void {
  if (typeof document === 'undefined' || document.getElementById('ga4-script')) {
    return;
  }

  const script = document.createElement('script');
  script.id = 'ga4-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.gtag?.('js', new Date());
  window.gtag?.('config', measurementId, {
    anonymize_ip: true,
    send_page_view: false,
    debug_mode: isGa4DebugMode(),
  });
}

export function trackGa4PageView(path: string, title: string): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
  });
}

export function trackGa4Event(name: string, params?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  window.gtag('event', name, params ?? {});
}
