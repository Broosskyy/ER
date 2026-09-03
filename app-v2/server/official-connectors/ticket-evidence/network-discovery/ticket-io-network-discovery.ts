import { parseTicketIoShopListHtml } from '../parse-ticket-io-shop-list';
import { parseTicketIoDetailDom } from '../parse-ticket-io-detail-dom';
import { extractVisibleAdmissionPriceFromTicketIoBody } from '../extract-visible-admission-price';
import { classifyTicketOffer, isAdmissionOfferRole } from '../ticket-offer-role';
import {
  dedupeNetworkDiscoveryCandidates,
  extractImageUrlsFromHtml,
  extractOutboundLinksFromHtml,
  inferCityFromText,
  listEntryToDiscoveryCandidate,
} from './event-candidate';
import { inferGenreLabels } from './genre-coverage';
import { classifyMediaUrls } from './media-classifier';
import {
  buildMatchCatalogFromStaging,
  matchDiscoveryCandidateAgainstCatalog,
  type StagingCatalogEvent,
} from './match-staging-catalog';
import { buildOutboundSourceGraph, extractTicketIoShopUrlsFromLinks } from './outbound-sources';
import { classifyElectronicRelevance } from './relevance-classifier';
import { scoreTicketIoShops } from './shop-scorer';
import {
  mergeShopSeeds,
  normalizeTicketIoShopUrl,
  TICKET_IO_SHOP_SEEDS,
  type TicketIoShopSeed,
} from './shop-seeds';
import type {
  TicketIoEventDiscoveryCandidate,
  TicketIoNetworkDiscoverySummary,
  TicketIoShopCandidate,
  TicketIoShopValueScore,
} from './types';

export const TICKET_IO_DISCOVERY_USER_AGENT =
  'EternalRave-M9.3B.1-Discovery/1.0 (+research; read-only; no-automation)';

const MAX_DISCOVERED_SHOPS = 25;

export interface TicketIoNetworkDiscoveryOptions {
  referenceInstant?: Date;
  shopSeeds?: TicketIoShopSeed[];
  fetchHtml?: (url: string) => Promise<{ ok: boolean; status: number; html: string; finalUrl: string }>;
  sampleDetailCountPerShop?: number;
  stagingCatalog?: StagingCatalogEvent[];
  baselineHead?: string;
}

export interface TicketIoNetworkDiscoveryResult {
  shops: TicketIoShopCandidate[];
  events: TicketIoEventDiscoveryCandidate[];
  shopScores: TicketIoShopValueScore[];
  outboundGraph: Array<ReturnType<typeof buildOutboundSourceGraph>>;
  summary: TicketIoNetworkDiscoverySummary;
}

async function defaultFetchHtml(
  url: string,
): Promise<{ ok: boolean; status: number; html: string; finalUrl: string }> {
  const response = await fetch(url, {
    headers: { 'User-Agent': TICKET_IO_DISCOVERY_USER_AGENT, Accept: 'text/html,application/json' },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });
  const html = await response.text();
  return { ok: response.ok, status: response.status, html, finalUrl: response.url };
}

function localDateKey(referenceInstant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceInstant);
}

function enrichDetailEvidence(
  candidate: TicketIoEventDiscoveryCandidate,
  html: string,
): TicketIoEventDiscoveryCandidate {
  const dom = parseTicketIoDetailDom(html, { sourceUrl: candidate.ticketUrl });
  const visible = extractVisibleAdmissionPriceFromTicketIoBody(html, candidate.ticketUrl);
  const outboundLinks = extractOutboundLinksFromHtml(html);
  const imageUrls = [
    ...new Set([...candidate.imageUrls, ...extractImageUrlsFromHtml(html), dom?.imageUrl].filter(Boolean) as string[]),
  ];
  const genreHints = [
    ...new Set([...candidate.genreHints, ...(dom?.genreLabels ?? []), ...inferGenreLabels(candidate.title, dom?.descriptionClean)]),
  ];
  const lineupHints = dom?.lineupCandidates.map((entry) => entry.displayName) ?? candidate.lineupHints;
  const visibleProducts = dom
    ? dom.offers.map((offer) => {
        const classification = classifyTicketOffer({
          label: offer.rawLabel,
          category: offer.category,
          description: offer.description,
        });
        return {
          productName: offer.rawLabel,
          rawPrice: offer.rawPrice,
          amountMinor: offer.amountMinor,
          currency: offer.currency,
          availability: offer.soldOut ? 'sold_out' : offer.purchasable ? 'available' : 'unavailable_unknown',
          admissionClass: classification.role,
        };
      })
    : candidate.visibleProducts;

  const { relevance, reasons } = classifyElectronicRelevance({
    title: candidate.title,
    description: dom?.descriptionClean,
    genreHints,
    venueName: candidate.venueName ?? dom?.venueName,
    organizerName: candidate.organizerName,
  });

  return {
    ...candidate,
    description: dom?.descriptionClean ?? candidate.description,
    venueName: candidate.venueName ?? dom?.venueName,
    startsAt: candidate.startsAt ?? dom?.startAt,
    city: candidate.city ?? inferCityFromText(candidate.title, candidate.venueName, dom?.venueName),
    lineupHints,
    genreHints,
    outboundLinks: [...new Set([...candidate.outboundLinks, ...outboundLinks])],
    imageUrls,
    visibleProducts: visibleProducts.length > 0 ? visibleProducts : candidate.visibleProducts,
    listRawPrice: candidate.listRawPrice ?? visible.productLabel ?? undefined,
    listAmountMinor: candidate.listAmountMinor ?? visible.amountMinor ?? undefined,
    relevance,
    relevanceReasons: reasons,
    mediaRoles: classifyMediaUrls(imageUrls, { title: candidate.title }),
    contentFingerprint: dom?.contentFingerprint,
  };
}

export async function runTicketIoNetworkDiscovery(
  options: TicketIoNetworkDiscoveryOptions = {},
): Promise<TicketIoNetworkDiscoveryResult> {
  const referenceInstant = options.referenceInstant ?? new Date('2026-09-02T12:00:00+02:00');
  const timezone = 'Europe/Berlin';
  const fetchHtml = options.fetchHtml ?? defaultFetchHtml;
  const sampleDetailCountPerShop = options.sampleDetailCountPerShop ?? 2;

  let seeds = [...(options.shopSeeds ?? TICKET_IO_SHOP_SEEDS)];
  const shops: TicketIoShopCandidate[] = [];
  const rawCandidates: TicketIoEventDiscoveryCandidate[] = [];
  const visitedShopUrls = new Set<string>();

  while (seeds.length > 0 && visitedShopUrls.size < MAX_DISCOVERED_SHOPS) {
    const seed = seeds.shift()!;
    const normalizedUrl = normalizeTicketIoShopUrl(seed.canonicalUrl);
    if (!normalizedUrl || visitedShopUrls.has(normalizedUrl.toLowerCase())) {
      continue;
    }
    visitedShopUrls.add(normalizedUrl.toLowerCase());

    const lastSeenAt = referenceInstant.toISOString();
    try {
      const response = await fetchHtml(seed.canonicalUrl);
      if (!response.ok) {
        shops.push({
          shopId: seed.slug,
          slug: seed.slug,
          canonicalUrl: seed.canonicalUrl,
          organizerName: seed.organizerName,
          city: seed.city,
          region: seed.region,
          discoveryMethod: seed.discoveryMethod,
          discoveredFrom: seed.discoveredFrom,
          lastSeenAt,
          confidence: 0.4,
          status: response.status >= 500 ? 'UNREACHABLE' : 'INACTIVE',
          error: `http_${response.status}`,
        });
        continue;
      }

      const parsed = parseTicketIoShopListHtml(seed.canonicalUrl, response.html);
      const outboundLinks = extractOutboundLinksFromHtml(response.html);
      const discoveredShopUrls = extractTicketIoShopUrlsFromLinks(outboundLinks);
      const merged = mergeShopSeeds([], discoveredShopUrls, seed.slug, 'outbound_link');
      for (const discovered of merged) {
        const discoveredUrl = normalizeTicketIoShopUrl(discovered.canonicalUrl);
        if (discoveredUrl && !visitedShopUrls.has(discoveredUrl.toLowerCase())) {
          seeds.push(discovered);
        }
      }

      const candidates = parsed.entries.map((entry) =>
        listEntryToDiscoveryCandidate(entry, seed.canonicalUrl, seed.slug, referenceInstant, seed.canonicalUrl),
      );
      rawCandidates.push(...candidates);

      const upcomingCount = candidates.filter((event) => event.lifecycle !== 'ENDED').length;
      const shopCanonical = normalizeTicketIoShopUrl(response.finalUrl) ?? seed.canonicalUrl;
      const existingShopIndex = shops.findIndex(
        (entry) => normalizeTicketIoShopUrl(entry.canonicalUrl)?.toLowerCase() === shopCanonical.toLowerCase(),
      );
      const shopRecord: TicketIoShopCandidate = {
        shopId: seed.slug,
        slug: seed.slug,
        canonicalUrl: shopCanonical,
        organizerName: seed.organizerName,
        city: seed.city,
        region: seed.region,
        discoveryMethod: seed.discoveryMethod,
        discoveredFrom: seed.discoveredFrom,
        lastSeenAt,
        confidence: parsed.entries.length > 0 ? 0.95 : 0.6,
        status: parsed.entries.length > 0 ? 'ACTIVE' : 'INACTIVE',
        upcomingEventCount: upcomingCount,
      };
      if (existingShopIndex >= 0) {
        shops[existingShopIndex] = shopRecord;
      } else {
        shops.push(shopRecord);
      }
    } catch (error) {
      shops.push({
        shopId: seed.slug,
        slug: seed.slug,
        canonicalUrl: seed.canonicalUrl,
        organizerName: seed.organizerName,
        city: seed.city,
        region: seed.region,
        discoveryMethod: seed.discoveryMethod,
        discoveredFrom: seed.discoveredFrom,
        lastSeenAt,
        confidence: 0.2,
        status: 'UNREACHABLE',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let events = dedupeNetworkDiscoveryCandidates(rawCandidates);

  for (const shop of shops.filter((entry) => entry.status === 'ACTIVE')) {
    const shopEvents = events
      .filter((event) => event.shopSlug === shop.slug && event.lifecycle !== 'ENDED')
      .slice(0, sampleDetailCountPerShop);
    for (const event of shopEvents) {
      try {
        const response = await fetchHtml(event.ticketUrl);
        if (!response.ok) {
          continue;
        }
        const index = events.findIndex((entry) => entry.identityKey === event.identityKey);
        if (index >= 0) {
          events[index] = enrichDetailEvidence(events[index]!, response.html);
        }
      } catch {
        // detail sampling is best-effort
      }
    }
  }

  if (options.stagingCatalog && options.stagingCatalog.length > 0) {
    const catalog = buildMatchCatalogFromStaging(options.stagingCatalog);
    events = events.map((event) => matchDiscoveryCandidateAgainstCatalog(event, catalog));
  }

  const relevantEvents = events.filter(
    (event) => event.lifecycle !== 'ENDED' && event.relevance !== 'IRRELEVANT',
  );
  const coverageByCity: Record<string, number> = {};
  for (const event of relevantEvents) {
    const city = event.city ?? 'Unknown';
    coverageByCity[city] = (coverageByCity[city] ?? 0) + 1;
  }

  const coverageByGenre: Record<string, number> = {};
  for (const event of relevantEvents) {
    const labels = event.genreHints.length > 0 ? event.genreHints : inferGenreLabels(event.title);
    for (const label of labels) {
      coverageByGenre[label] = (coverageByGenre[label] ?? 0) + 1;
    }
  }

  const shopScores = scoreTicketIoShops(shops, events);
  const outboundGraph = relevantEvents.map((event) =>
    buildOutboundSourceGraph(event.ticketUrl, event.outboundLinks),
  );

  const summary: TicketIoNetworkDiscoverySummary = {
    generatedAt: new Date().toISOString(),
    referenceDateLocal: localDateKey(referenceInstant, timezone),
    timezone,
    baselineHead: options.baselineHead,
    totalShopsDiscovered: shops.length,
    reachableShops: shops.filter((shop) => shop.status !== 'UNREACHABLE').length,
    activeShops: shops.filter((shop) => shop.status === 'ACTIVE').length,
    totalUpcomingTicketIoEvents: events.filter((event) => event.lifecycle !== 'ENDED').length,
    highRelevanceEvents: events.filter((event) => event.relevance === 'HIGH_RELEVANCE' && event.lifecycle !== 'ENDED')
      .length,
    likelyRelevantEvents: events.filter(
      (event) => event.relevance === 'LIKELY_RELEVANT' && event.lifecycle !== 'ENDED',
    ).length,
    ambiguousEvents: events.filter((event) => event.relevance === 'AMBIGUOUS' && event.lifecycle !== 'ENDED').length,
    irrelevantEvents: events.filter((event) => event.relevance === 'IRRELEVANT').length,
    existingExact: events.filter((event) => event.matchClassification === 'EXISTING_EXACT').length,
    existingStrongMatch: events.filter((event) => event.matchClassification === 'EXISTING_STRONG_MATCH').length,
    possibleMatch: events.filter((event) => event.matchClassification === 'POSSIBLE_MATCH').length,
    netNewRelevantEvents: events.filter(
      (event) =>
        event.matchClassification === 'NET_NEW' &&
        event.lifecycle !== 'ENDED' &&
        (event.relevance === 'HIGH_RELEVANCE' || event.relevance === 'LIKELY_RELEVANT'),
    ).length,
    reviewRequired: events.filter((event) => event.matchClassification === 'REVIEW_REQUIRED').length,
    coverageByCity,
    coverageByGenre,
    newEventWrites: 0,
    eventUpdates: 0,
    ticketWrites: 0,
    mediaWrites: 0,
    productionMutations: 0,
  };

  return { shops, events, shopScores, outboundGraph, summary };
}

export function ticketEvidenceMetrics(events: TicketIoEventDiscoveryCandidate[]) {
  const relevant = events.filter(
    (event) => event.lifecycle !== 'ENDED' && event.relevance !== 'IRRELEVANT',
  );
  return {
    eventsWithTicketTarget: relevant.filter((event) => Boolean(event.ticketUrl)).length,
    eventsWithAdmissionPrice: relevant.filter((event) => event.listAmountMinor != null).length,
    eventsWithMultipleProducts: relevant.filter((event) => event.visibleProducts.length > 1).length,
    eventsWithSoldOutSignal: relevant.filter((event) =>
      event.visibleProducts.some((product) => product.availability === 'sold_out'),
    ).length,
    eventsWithAdmissionClass: relevant.filter((event) =>
      event.visibleProducts.some((product) => product.admissionClass && isAdmissionOfferRole(product.admissionClass)),
    ).length,
  };
}

export function mediaEvidenceMetrics(events: TicketIoEventDiscoveryCandidate[]) {
  const relevant = events.filter(
    (event) => event.lifecycle !== 'ENDED' && event.relevance !== 'IRRELEVANT',
  );
  return {
    eventsWithMedia: relevant.filter((event) => event.imageUrls.length > 0).length,
    eventsWithEventSpecificMedia: relevant.filter((event) =>
      event.mediaRoles.some((role) => role === 'event_flyer' || role === 'event_hero' || role === 'lineup_flyer'),
    ).length,
    eventsWithLineupFlyer: relevant.filter((event) => event.mediaRoles.includes('lineup_flyer')).length,
    eventsWithOnlyWeakMedia: relevant.filter(
      (event) =>
        event.imageUrls.length > 0 &&
        event.mediaRoles.every((role) =>
          ['organizer_branding', 'generic_shop_image', 'decorative', 'unknown', 'ticket_marketing'].includes(role),
        ),
    ).length,
  };
}
