import { createHash } from 'node:crypto';

import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { extractOfficialPageDescription } from '@/features/import/adapters/extractors/official-page-description';
import { extractBootshausGenresFromHtml } from '@/features/import/adapters/extractors/official-page-genres';
import { decodeHtmlEntities, normalizeText } from '@/features/import/normalization/text-normalizer';

export interface OfficialWebsitePublicTruth {
  source: 'bootshaus.tv' | 'affenkaefig.info';
  title?: string;
  subtitle?: string;
  description?: string;
  flyer?: string;
  gallery?: string[];
  dateTime?: string;
  venue?: string;
  location?: string;
  city?: string;
  coordinates?: string;
  organizer?: string;
  promoter?: string;
  genres?: string[];
  outboundTicketLinks?: string[];
  descriptionSource?: string;
}

function skipHtmlWhitespace(source: string, index: number): number {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor]!)) {
    cursor += 1;
  }
  return cursor;
}

/** Quote-aware attribute parser for isolated tag attribute strings. */
export function parseHtmlAttributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>();
  let index = 0;

  const readName = (): string | undefined => {
    index = skipHtmlWhitespace(source, index);
    const start = index;
    while (index < source.length && /[^\s="'/>]/.test(source[index]!)) {
      index += 1;
    }
    if (start === index) {
      return undefined;
    }
    return source.slice(start, index).toLowerCase();
  };

  const readValue = (): string | undefined => {
    index = skipHtmlWhitespace(source, index);
    if (index >= source.length) {
      return undefined;
    }
    const quote = source[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      let value = '';
      while (index < source.length) {
        if (source[index] === quote) {
          index += 1;
          return value;
        }
        value += source[index];
        index += 1;
      }
      return value;
    }
    const start = index;
    while (index < source.length && !/\s/.test(source[index]!)) {
      index += 1;
    }
    return source.slice(start, index);
  };

  while (index < source.length) {
    const name = readName();
    if (!name) {
      break;
    }
    index = skipHtmlWhitespace(source, index);
    if (source[index] !== '=') {
      continue;
    }
    index += 1;
    const value = readValue();
    if (value !== undefined) {
      attrs.set(name, value);
    }
  }

  return attrs;
}

function extractMetaTagAttributes(html: string): Map<string, string>[] {
  const tags: Map<string, string>[] = [];
  for (const match of html.matchAll(/<meta\b([^>]*?)>/gi)) {
    const attrs = parseHtmlAttributes(match[1] ?? '');
    if (attrs.size > 0) {
      tags.push(attrs);
    }
  }
  return tags;
}

function readMeta(html: string, property: string): string | undefined {
  const target = property.toLowerCase();
  for (const attrs of extractMetaTagAttributes(html)) {
    const key = attrs.get('property') ?? attrs.get('name');
    if (!key || key.toLowerCase() !== target) {
      continue;
    }
    const content = attrs.get('content');
    if (content?.trim()) {
      return decodeHtmlEntities(content).trim();
    }
  }
  return undefined;
}

function extractOutboundTicketLinks(html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1] ?? '';
    if (/\.ticket\.io\/[A-Za-z0-9]+/i.test(href) || /ticketkings\.de\/event\//i.test(href)) {
      try {
        links.add(new URL(href, 'https://bootshaus.tv').href.replace(/\/$/, '') + '/');
      } catch {
        links.add(href);
      }
    }
  }
  return [...links];
}

export function extractOfficialWebsitePublicTruth(html: string, url: string): OfficialWebsitePublicTruth {
  const source = url.includes('affenkaefig.info') ? 'affenkaefig.info' : 'bootshaus.tv';
  let jsonLdFields: Record<string, unknown> | null = null;
  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      jsonLdFields = parseJsonLdEvent(node, url).fields;
      break;
    }
    if (jsonLdFields) break;
  }

  const pageDescription = extractOfficialPageDescription(html);
  const genres = source === 'bootshaus.tv' ? extractBootshausGenresFromHtml(html) : [];

  const title =
    decodeHtmlEntities(readMeta(html, 'og:title') ?? '') ||
    (jsonLdFields?.title ? String(jsonLdFields.title) : undefined);
  const imageUrl = readMeta(html, 'og:image') ?? (jsonLdFields?.imageUrl ? String(jsonLdFields.imageUrl) : undefined);

  return {
    source,
    title: title ? normalizeText(title, 500) : undefined,
    description: pageDescription.description,
    descriptionSource: pageDescription.source,
    flyer: imageUrl,
    gallery: imageUrl ? [imageUrl] : undefined,
    dateTime: jsonLdFields?.startDate ? String(jsonLdFields.startDate) : undefined,
    venue: jsonLdFields?.venueName ? String(jsonLdFields.venueName) : undefined,
    location: jsonLdFields?.venueAddress ? String(jsonLdFields.venueAddress) : undefined,
    city: jsonLdFields?.cityName ? String(jsonLdFields.cityName) : undefined,
    coordinates:
      jsonLdFields?.latitude && jsonLdFields?.longitude
        ? `${jsonLdFields.latitude},${jsonLdFields.longitude}`
        : undefined,
    organizer: source === 'affenkaefig.info' ? 'Affenkäfig' : undefined,
    genres: genres.length > 0 ? genres : undefined,
    outboundTicketLinks: extractOutboundTicketLinks(html),
  };
}

export function hashPublicHtml(html: string): string {
  return createHash('sha256').update(html).digest('hex');
}

export function normalizeCompareValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => normalizeCompareValue(v)).filter(Boolean).join('|').toLowerCase();
  return normalizeText(String(value), 50_000)?.toLowerCase() ?? String(value).trim().toLowerCase();
}

export function valuesSemanticallyEqual(a: unknown, b: unknown): boolean {
  const na = normalizeCompareValue(a);
  const nb = normalizeCompareValue(b);
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 40 && nb.length > 40 && (na.includes(nb.slice(0, 80)) || nb.includes(na.slice(0, 80)))) return true;
  return false;
}
