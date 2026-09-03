import { classifyConsumerEventLifecycle } from '../../../ingestion/consumer-event-cutoff';
import { calendarDayKey, titleSimilarity } from '../../../../shared/match-normalizers';
import { canonicalizeTicketIoUrl } from '../url-policy';
import type { TicketIoShopListEntry } from '../parse-ticket-io-shop-list';
import { classifyElectronicRelevance } from './relevance-classifier';
import { shopSlugFromUrl } from './shop-seeds';
import type { TicketIoEventDiscoveryCandidate, TicketIoLifecycleStatus } from './types';

export function normalizeTicketIoEventUrl(url: string): string | null {
  return canonicalizeTicketIoUrl(url) ?? null;
}

export function classifyTicketIoEventLifecycle(
  startsAt: string | undefined,
  endsAt: string | undefined | null,
  referenceInstant: Date,
): TicketIoLifecycleStatus {
  if (!startsAt) {
    return 'UPCOMING';
  }
  const lifecycle = classifyConsumerEventLifecycle({
    startsAt,
    endsAt,
    status: 'published',
    referenceInstant,
  });
  if (lifecycle === 'ENDED') {
    return 'ENDED';
  }
  if (lifecycle === 'ONGOING') {
    return 'ONGOING';
  }
  return 'UPCOMING';
}

export function buildEventIdentityKey(shopSlug: string, providerEventId: string): string {
  return `ticket_io:${shopSlug}:${providerEventId.toLowerCase()}`;
}

export function listEntryToDiscoveryCandidate(
  entry: TicketIoShopListEntry,
  shopUrl: string,
  shopSlug: string,
  referenceInstant: Date,
  surface: string,
): TicketIoEventDiscoveryCandidate {
  const lifecycle = classifyTicketIoEventLifecycle(entry.startAt, null, referenceInstant);
  const { relevance, reasons } = classifyElectronicRelevance({
    title: entry.eventName,
    venueName: entry.venueName,
    organizerName: shopSlug,
  });

  return {
    identityKey: buildEventIdentityKey(shopSlug, entry.providerEventId),
    ticketIoEventId: entry.providerEventId,
    shopId: shopSlug,
    shopSlug,
    title: entry.eventName,
    startsAt: entry.startAt,
    endsAt: undefined,
    lifecycle,
    venueName: entry.venueName,
    city: undefined,
    ticketUrl: entry.eventUrl,
    canonicalUrl: entry.eventUrl,
    lineupHints: [],
    genreHints: [],
    outboundLinks: [],
    imageUrls: [],
    listRawPrice: entry.rawPrice,
    listAmountMinor: entry.amountMinor,
    listCurrency: entry.currency,
    listTicketStatus: entry.ticketStatus,
    visibleProducts: entry.rawPrice
      ? [
          {
            productName: 'list_minimum',
            rawPrice: entry.rawPrice,
            amountMinor: entry.amountMinor,
            currency: entry.currency,
            availability: entry.ticketStatus,
          },
        ]
      : [],
    relevance,
    relevanceReasons: reasons,
    matchClassification: 'REVIEW_REQUIRED',
    matchReasons: [],
    mediaRoles: [],
    discoveredFromSurfaces: [surface],
  };
}

export function dedupeNetworkDiscoveryCandidates(
  candidates: TicketIoEventDiscoveryCandidate[],
): TicketIoEventDiscoveryCandidate[] {
  const merged: TicketIoEventDiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const existingIndex = merged.findIndex((entry) => isSameDiscoveryEvent(entry, candidate));
    if (existingIndex < 0) {
      merged.push(candidate);
      continue;
    }

    const existing = merged[existingIndex]!;
    merged[existingIndex] = mergeDiscoveryCandidates(existing, candidate);
  }

  return merged;
}

function isSameDiscoveryEvent(
  left: TicketIoEventDiscoveryCandidate,
  right: TicketIoEventDiscoveryCandidate,
): boolean {
  const leftUrl = normalizeTicketIoEventUrl(left.ticketUrl);
  const rightUrl = normalizeTicketIoEventUrl(right.ticketUrl);
  if (leftUrl && rightUrl && leftUrl === rightUrl) {
    return true;
  }

  if (!left.startsAt || !right.startsAt) {
    return false;
  }

  const sameDay =
    calendarDayKey(left.startsAt, 'Europe/Berlin') === calendarDayKey(right.startsAt, 'Europe/Berlin');
  if (!sameDay) {
    return false;
  }

  const sameVenue =
    left.venueName &&
    right.venueName &&
    left.venueName.toLowerCase() === right.venueName.toLowerCase();
  if (!sameVenue) {
    return false;
  }

  const sim = titleSimilarity(left.title, right.title);
  const normalizedLeft = left.title.toLowerCase();
  const normalizedRight = right.title.toLowerCase();
  const titleCoreMatch =
    normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
  return sim >= 0.72 || titleCoreMatch;
}

function mergeDiscoveryCandidates(
  existing: TicketIoEventDiscoveryCandidate,
  candidate: TicketIoEventDiscoveryCandidate,
): TicketIoEventDiscoveryCandidate {
  const mergedSurfaces = [...new Set([...existing.discoveredFromSurfaces, ...candidate.discoveredFromSurfaces])];
  const richer =
    (candidate.listAmountMinor != null && existing.listAmountMinor == null) ||
    candidate.title.length > existing.title.length
      ? { ...existing, ...candidate }
      : existing;

  return {
    ...richer,
    discoveredFromSurfaces: mergedSurfaces,
  };
}

export function extractOutboundLinksFromHtml(html: string): string[] {
  const links = new Set<string>();
  const hrefPattern = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1]?.trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
      continue;
    }
    try {
      const absolute = href.startsWith('http') ? href : undefined;
      if (absolute) {
        links.add(absolute);
      }
    } catch {
      // ignore
    }
  }
  return [...links];
}

export function extractImageUrlsFromHtml(html: string): string[] {
  const urls = new Set<string>();
  const imgPattern = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = imgPattern.exec(html)) !== null) {
    const src = match[1]?.trim();
    if (src?.startsWith('http')) {
      urls.add(src);
    }
  }
  const cdnPattern = /https:\/\/cdn\.ticket\.io\/[^\s"'<>]+/gi;
  for (const cdn of html.match(cdnPattern) ?? []) {
    urls.add(cdn);
  }
  return [...urls];
}

export function inferCityFromText(...parts: Array<string | undefined>): string | undefined {
  const cities = [
    'Köln',
    'Cologne',
    'Düsseldorf',
    'Duesseldorf',
    'Bonn',
    'Dortmund',
    'Essen',
    'Bochum',
    'Münster',
    'Muenster',
    'Aachen',
    'Oberhausen',
    'Saarbrücken',
    'Hagen',
    'Palma',
  ];
  const corpus = parts.filter(Boolean).join(' ');
  return cities.find((city) => new RegExp(`\\b${city}\\b`, 'i').test(corpus));
}

export function shopSlugFromEventCandidate(candidate: TicketIoEventDiscoveryCandidate): string | null {
  return shopSlugFromUrl(candidate.canonicalUrl) ?? candidate.shopSlug;
}
