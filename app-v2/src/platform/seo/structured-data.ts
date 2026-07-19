import { SEO_CONFIG, getWebBaseUrl } from '@/platform/seo/seo-config';

export function buildOrganizationJsonLd(): Record<string, unknown> {
  const url = getWebBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SEO_CONFIG.siteName,
    ...(url ? { url } : {}),
    logo: url ? `${url}${SEO_CONFIG.ogImagePath}` : SEO_CONFIG.ogImagePath,
  };
}

export function buildWebSiteJsonLd(): Record<string, unknown> {
  const url = getWebBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SEO_CONFIG.siteName,
    description: SEO_CONFIG.defaultDescription,
    inLanguage: SEO_CONFIG.language,
    ...(url ? { url } : {}),
  };
}

export function buildWebApplicationJsonLd(): Record<string, unknown> {
  const url = getWebBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SEO_CONFIG.siteName,
    applicationCategory: 'EntertainmentApplication',
    operatingSystem: 'Web, Android, iOS',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    ...(url ? { url } : {}),
  };
}

export interface EventStructuredDataInput {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  venueName?: string;
  city?: string;
  imageUrl?: string;
  ticketUrl?: string;
}

export function buildEventJsonLd(input: EventStructuredDataInput): Record<string, unknown> {
  const url = getWebBaseUrl();
  const eventUrl = url ? `${url}/event/${input.id}` : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.title,
    ...(input.description ? { description: input.description } : {}),
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    ...(eventUrl ? { url: eventUrl } : {}),
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    ...(input.ticketUrl
      ? {
          offers: {
            '@type': 'Offer',
            url: input.ticketUrl,
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
    ...(input.venueName || input.city
      ? {
          location: {
            '@type': 'Place',
            name: input.venueName ?? input.city,
            ...(input.city
              ? {
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: input.city,
                  },
                }
              : {}),
          },
        }
      : {}),
    organizer: {
      '@type': 'Organization',
      name: SEO_CONFIG.siteName,
    },
  };
}

export function buildBreadcrumbJsonLd(
  items: { name: string; path: string }[],
): Record<string, unknown> {
  const base = getWebBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(base ? { item: `${base}${item.path.startsWith('/') ? item.path : `/${item.path}`}` } : {}),
    })),
  };
}
