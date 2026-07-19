import {
  SEO_CONFIG,
  buildCanonicalUrl,
  isGlobalNoIndex,
  resolveOgImageUrl,
  type PageSeoInput,
} from '@/platform/seo/seo-config';

function upsertMeta(
  attribute: 'name' | 'property',
  key: string,
  content: string,
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  let element = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function removeJsonLd(id: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.getElementById(id)?.remove();
}

export function applyPageSeo(input: PageSeoInput): void {
  if (typeof document === 'undefined') {
    return;
  }

  const description = input.description ?? SEO_CONFIG.defaultDescription;
  const robots = isGlobalNoIndex() || input.noindex ? 'noindex, nofollow' : 'index, follow';
  const canonical = input.path ? buildCanonicalUrl(input.path) : buildCanonicalUrl('/');
  const ogImage = resolveOgImageUrl(input.imagePath);
  const ogType = input.ogType ?? SEO_CONFIG.ogType;

  document.title = input.title;
  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', robots);
  upsertMeta('property', 'og:title', input.title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:type', ogType);
  upsertMeta('property', 'og:site_name', SEO_CONFIG.siteName);
  upsertMeta('property', 'og:locale', SEO_CONFIG.locale);
  upsertMeta('property', 'og:image', ogImage);
  upsertMeta('name', 'twitter:card', SEO_CONFIG.twitterCard);
  upsertMeta('name', 'twitter:title', input.title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', ogImage);

  if (canonical) {
    upsertLink('canonical', canonical);
    upsertMeta('property', 'og:url', canonical);
  }
}

export function applyJsonLd(id: string, data: Record<string, unknown>): void {
  if (typeof document === 'undefined') {
    return;
  }

  removeJsonLd(id);
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export function clearJsonLd(id: string): void {
  removeJsonLd(id);
}
