import { PWA_CONFIG } from '@/platform/pwa/pwa-config';

/** Maximum recommended lengths for SERP display. */
export const SEO_LIMITS = {
  title: 60,
  description: 160,
} as const;

export const SEO_CONFIG = {
  siteName: PWA_CONFIG.name,
  defaultTitle: PWA_CONFIG.name,
  defaultDescription: PWA_CONFIG.description,
  locale: 'de_DE',
  language: PWA_CONFIG.lang,
  themeColor: PWA_CONFIG.themeColor,
  twitterCard: 'summary_large_image' as const,
  ogImagePath: '/pwa/icon-512.png',
  ogImageWidth: 512,
  ogImageHeight: 512,
  ogType: 'website' as const,
  author: 'Eternal Rave',
  generator: 'Expo',
} as const;

/** Routes that must not be indexed (robots noindex). */
export const NOINDEX_ROUTE_PREFIXES = ['/admin'] as const;

/** Public indexable static routes for sitemap generation. */
export const INDEXABLE_STATIC_ROUTES = [
  { path: '/', priority: 1.0, changefreq: 'daily' as const },
  { path: '/search', priority: 0.9, changefreq: 'daily' as const },
  { path: '/saved', priority: 0.6, changefreq: 'weekly' as const },
  { path: '/notifications', priority: 0.5, changefreq: 'weekly' as const },
  { path: '/privacy', priority: 0.3, changefreq: 'monthly' as const },
  { path: '/terms', priority: 0.3, changefreq: 'monthly' as const },
  { path: '/impressum', priority: 0.3, changefreq: 'monthly' as const },
] as const;

export const COLLECTION_SITEMAP_TYPES = [
  'highlights',
  'tonight',
  'weekend',
  'upcoming',
  'techno',
  'house',
] as const;

export interface PageSeoInput {
  title: string;
  description?: string;
  path?: string;
  imagePath?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article';
}

export function getWebBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/\/$/, '');
}

export function isGlobalNoIndex(): boolean {
  return process.env.EXPO_PUBLIC_WEB_NOINDEX === 'true';
}

export function buildCanonicalUrl(path: string): string | null {
  const base = getWebBaseUrl();
  if (!base) {
    return null;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function resolveOgImageUrl(imagePath?: string): string {
  const path = imagePath ?? SEO_CONFIG.ogImagePath;
  const base = getWebBaseUrl();
  if (base && path.startsWith('/')) {
    return `${base}${path}`;
  }
  return path;
}
