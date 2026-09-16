import { parseDescriptionExplicitGenres } from '../shared/parse-description-genres';
import { separateStructuredEventContent } from '../shared/structured-content-separation';
import type { RausgegangenDetailEvidence } from './types';
import { extractEventSlugFromUrl, normalizeRausgegangenEventUrl } from './rausgegangen-url';

interface JsonLdNode {
  '@type'?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: string | string[];
  location?: {
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      postalCode?: string;
      addressCountry?: string;
    };
  };
  offers?:
    | {
        url?: string;
        price?: string | number;
        priceCurrency?: string;
        availability?: string;
      }
    | Array<{
        url?: string;
        price?: string | number;
        priceCurrency?: string;
        availability?: string;
      }>;
  organizer?: { name?: string; url?: string };
}

function parsePriceMinor(raw?: string | number, currency = 'EUR'): number | undefined {
  if (raw == null) {
    return undefined;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.round(raw * 100);
  }
  const text = String(raw).trim();
  if (!text) {
    return undefined;
  }
  const normalized = text.replace(',', '.').replace(/[^\d.]/g, '');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value * 100);
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(match[1] ?? ''));
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return blocks;
}

function flattenJsonLd(nodes: unknown[]): JsonLdNode[] {
  const result: JsonLdNode[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      continue;
    }
    if (Array.isArray(node)) {
      result.push(...flattenJsonLd(node));
      continue;
    }
    const record = node as Record<string, unknown>;
    if (record['@graph'] && Array.isArray(record['@graph'])) {
      result.push(...flattenJsonLd(record['@graph'] as unknown[]));
    }
    result.push(record as JsonLdNode);
  }
  return result;
}

function isEventNode(node: JsonLdNode): boolean {
  const type = node['@type'];
  if (typeof type === 'string') {
    return type === 'Event';
  }
  if (Array.isArray(type)) {
    return type.includes('Event');
  }
  return false;
}

function extractBreadcrumbs(nodes: JsonLdNode[]): Array<{ name: string; url?: string }> {
  for (const node of nodes) {
    const type = node['@type'];
    if (type === 'BreadcrumbList' || (Array.isArray(type) && type.includes('BreadcrumbList'))) {
      const elements = (node as { itemListElement?: Array<{ name?: string; item?: string }> }).itemListElement ?? [];
      return elements
        .map((entry) => ({ name: entry.name ?? '', url: entry.item }))
        .filter((entry) => entry.name);
    }
  }
  return [];
}

/** Rausgegangen global nav/footer tag links are not event-specific — do not scrape page-wide. */
function extractTagHints(_html: string): string[] {
  return [];
}

function extractOutboundLinks(html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    const href = match[1] ?? '';
    if (/ticket\.io|eventim|paylogic|fourvenues|n8manager|zentrale\.events|t\.rausgegangen/i.test(href)) {
      links.add(href);
    }
  }
  return [...links];
}

export function parseRausgegangenEventDetail(html: string, sourceUrl: string): RausgegangenDetailEvidence {
  const eventUrl = normalizeRausgegangenEventUrl(sourceUrl) ?? sourceUrl;
  const eventSlug = extractEventSlugFromUrl(eventUrl) ?? 'unknown';
  const parseNotes: string[] = [];
  const nodes = flattenJsonLd(extractJsonLdBlocks(html));
  const eventNode = nodes.find(isEventNode);
  const breadcrumbs = extractBreadcrumbs(nodes);
  const tagHints = extractTagHints(html);
  const categoryHints = breadcrumbs
    .map((entry) => entry.name)
    .filter(
      (name) =>
        !/^(köln|cologne|berlin|hamburg|münchen|muenchen|bonn|dortmund|essen|party)$/i.test(name),
    );

  if (!eventNode) {
    parseNotes.push('missing_json_ld_event');
    return {
      eventUrl,
      eventSlug,
      imageUrls: [],
      categoryHints,
      tagHints,
      lineupHints: [],
      genreHints: [],
      outboundLinks: extractOutboundLinks(html),
      breadcrumbs,
      jsonLdPresent: false,
      parseNotes,
    };
  }

  const description = eventNode.description?.trim();
  const separated = description ? separateStructuredEventContent(description) : undefined;
  const lineupHints = separated?.lineupCandidates ?? [];
  const genreHints = [
    ...parseDescriptionExplicitGenres(description ?? ''),
    ...(separated?.genreCandidates ?? []),
    ...categoryHints.map((category) => category.toLowerCase()),
  ];

  const images = Array.isArray(eventNode.image)
    ? eventNode.image
    : eventNode.image
      ? [eventNode.image]
      : [];

  const offersNode = eventNode.offers;
  const offers = Array.isArray(offersNode) ? offersNode[0] : offersNode;
  const ticketPriceRaw = offers?.price;
  const ticketCurrency = offers?.priceCurrency ?? 'EUR';

  return {
    eventUrl,
    eventSlug,
    title: eventNode.name?.trim(),
    description,
    startsAt: eventNode.startDate,
    endsAt: eventNode.endDate,
    venueName: eventNode.location?.name?.trim(),
    city: eventNode.location?.address?.addressLocality?.trim(),
    address: eventNode.location?.address?.streetAddress?.trim(),
    postalCode: eventNode.location?.address?.postalCode?.trim(),
    organizerName: eventNode.organizer?.name?.trim(),
    organizerUrl: eventNode.organizer?.url,
    imageUrls: images.filter(Boolean),
    ticketUrl: offers?.url,
    ticketPriceRaw,
    ticketPriceMinor: parsePriceMinor(ticketPriceRaw, ticketCurrency),
    ticketCurrency,
    ticketAvailability: offers?.availability,
    categoryHints,
    tagHints,
    lineupHints,
    genreHints: [...new Set(genreHints.map((genre) => genre.trim()).filter(Boolean))],
    outboundLinks: extractOutboundLinks(html),
    breadcrumbs,
    jsonLdPresent: true,
    parseNotes,
  };
}
