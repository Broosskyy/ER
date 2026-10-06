import { dirname, join } from 'node:path';

import { enrichCandidateWithDetail } from './detail-enrichment';
import { fetchTicketIoEventDetail } from './detail-fetch';
import { computeInventoryDelta, loadPreviousDiscoveryEvents } from './inventory-delta';
import { buildMatchCatalogFromStaging, type StagingCatalogEvent } from './match-staging-catalog';
import { scoreTicketIoShops } from './shop-scorer';
import { runTicketIoGermanyNetworkDiscovery } from './ticket-io-germany-network-discovery';
import { runTicketIoNetworkDiscovery } from './ticket-io-network-discovery';
import { buildFirstBatchPacket, selectFirstBatchCandidates } from './first-batch';
import { inferGenreLabels } from './genre-coverage';
import type {
  DetailQualificationSummary,
  EnrichedTicketIoEvent,
  FirstBatchReviewPacket,
  InventoryDelta,
} from './detail-types';
import type { TicketIoEventDiscoveryCandidate, TicketIoShopCandidate, TicketIoShopValueScore } from './types';

export interface DetailQualificationOptions {
  referenceInstant?: Date;
  repoRoot?: string;
  baselineHead?: string;
  stagingCatalog?: StagingCatalogEvent[];
  fetchDetail?: (url: string) => ReturnType<typeof fetchTicketIoEventDetail>;
  concurrency?: number;
  /** Use Germany-wide network discovery (M9.3B.3) instead of NRW sample. */
  germanyDiscovery?: boolean;
}

export interface DetailQualificationResult {
  inventory: TicketIoEventDiscoveryCandidate[];
  inventoryDelta: InventoryDelta;
  enrichedEvents: EnrichedTicketIoEvent[];
  shopScores: TicketIoShopValueScore[];
  firstBatch: FirstBatchReviewPacket[];
  summary: DetailQualificationSummary;
}

function shopListingUrl(candidate: TicketIoEventDiscoveryCandidate, shops: TicketIoShopCandidate[]): string {
  return shops.find((shop) => shop.slug === candidate.shopSlug)?.canonicalUrl ?? `https://${candidate.shopSlug}.ticket.io/`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]!, current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function localDateKey(referenceInstant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceInstant);
}

function mapEnrichedToDiscoveryCandidate(event: EnrichedTicketIoEvent): TicketIoEventDiscoveryCandidate {
  return {
    identityKey: event.identityKey,
    ticketIoEventId: event.ticketIoEventId,
    shopId: event.shopId,
    shopSlug: event.shopSlug,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    lifecycle: event.lifecycle,
    venueName: event.venueName,
    city: event.city,
    address: event.address,
    ticketUrl: event.eventUrl,
    canonicalUrl: event.canonicalUrl,
    description: event.description,
    lineupHints: event.lineupHints,
    genreHints: event.genreCandidates.map((genre) => genre.label),
    organizerName: event.organizerName,
    outboundLinks: event.outboundLinks,
    imageUrls: event.imageUrls,
    listRawPrice: event.currentAdmissionLabel,
    listAmountMinor: event.currentAdmissionPriceMinor,
    listTicketStatus: event.ticketAvailability.toLowerCase(),
    visibleProducts: event.products.map((product) => ({
      productName: product.label,
      rawPrice: product.rawPrice,
      amountMinor: product.amountMinor,
      currency: product.currency,
      availability: product.availability,
      admissionClass: product.category,
    })),
    relevance: event.relevance,
    relevanceReasons: event.relevanceReasons,
    matchClassification: event.matchClassification,
    matchedEventId: event.matchedEventId,
    matchedEventTitle: event.matchedEventTitle,
    matchReasons: event.matchReasons,
    mediaRoles: event.mediaRoles,
    discoveredFromSurfaces: [event.listingUrl],
    contentFingerprint: event.contentFingerprint,
  };
}

export async function runTicketIoDetailQualification(
  options: DetailQualificationOptions = {},
): Promise<DetailQualificationResult> {
  const referenceInstant = options.referenceInstant ?? new Date('2026-09-03T12:00:00+02:00');
  const timezone = 'Europe/Berlin';
  const repoRoot = options.repoRoot ?? process.cwd();
  const artifactRoot = repoRoot.endsWith('app-v2') ? dirname(repoRoot) : repoRoot;
  const fetchDetail = options.fetchDetail ?? fetchTicketIoEventDetail;
  const concurrency = options.concurrency ?? 4;

  const discovery = options.germanyDiscovery
    ? await runTicketIoGermanyNetworkDiscovery({
        referenceInstant,
        stagingCatalog: options.stagingCatalog,
        baselineHead: options.baselineHead,
        sampleDetailCountPerShop: 0,
      })
    : await runTicketIoNetworkDiscovery({
        referenceInstant,
        stagingCatalog: options.stagingCatalog,
        baselineHead: options.baselineHead,
        sampleDetailCountPerShop: 0,
      });

  const previous = loadPreviousDiscoveryEvents(artifactRoot);
  const inventoryDelta = computeInventoryDelta(previous, discovery.events);
  const catalog = options.stagingCatalog ? buildMatchCatalogFromStaging(options.stagingCatalog) : [];

  const upcoming = discovery.events.filter((event) => event.lifecycle !== 'ENDED');
  const enrichedEvents = await mapWithConcurrency(upcoming, concurrency, async (candidate, index) => {
    if (index % 10 === 0) {
      console.error(`[m9.3b.1a] enriching ${index + 1}/${upcoming.length}: ${candidate.title}`);
    }
    const fetchResult = await fetchDetail(candidate.ticketUrl);
    return enrichCandidateWithDetail(
      candidate,
      fetchResult,
      catalog,
      shopListingUrl(candidate, discovery.shops),
    );
  });

  const mappedForShopScore = enrichedEvents.map(mapEnrichedToDiscoveryCandidate);
  const shopScores = scoreTicketIoShops(discovery.shops, mappedForShopScore);

  const ambiguousBefore = previous.filter((event) => event.lifecycle !== 'ENDED' && event.relevance === 'AMBIGUOUS').length;
  const ambiguousAfter = enrichedEvents.filter((event) => event.relevance === 'AMBIGUOUS').length;
  const resolvedToRelevant = enrichedEvents.filter(
    (event) =>
      event.relevance !== 'AMBIGUOUS' &&
      event.relevance !== 'IRRELEVANT' &&
      previous.find((prior) => prior.identityKey === event.identityKey)?.relevance === 'AMBIGUOUS',
  ).length;
  const resolvedToIrrelevant = enrichedEvents.filter(
    (event) =>
      event.relevance === 'IRRELEVANT' &&
      previous.find((prior) => prior.identityKey === event.identityKey)?.relevance === 'AMBIGUOUS',
  ).length;

  const coverageByCity: Record<string, number> = {};
  const coverageByGenre: Record<string, number> = {};
  for (const event of enrichedEvents.filter((entry) => entry.relevance !== 'IRRELEVANT')) {
    const city = event.city ?? 'Unknown';
    coverageByCity[city] = (coverageByCity[city] ?? 0) + 1;
    const labels = event.genreCandidates.length > 0 ? event.genreCandidates.map((genre) => genre.label) : inferGenreLabels(event.title);
    for (const label of labels) {
      coverageByGenre[label] = (coverageByGenre[label] ?? 0) + 1;
    }
  }

  const firstBatchEvents = selectFirstBatchCandidates(enrichedEvents, 5);
  const firstBatch = firstBatchEvents.map((event) => buildFirstBatchPacket(event));

  const summary: DetailQualificationSummary = {
    generatedAt: new Date().toISOString(),
    referenceDateLocal: localDateKey(referenceInstant, timezone),
    timezone,
    baselineHead: options.baselineHead ?? 'unknown',
    parentMilestone: 'M9_3B_1_TICKETIO_NETWORK_DISCOVERY_DRY_RUN_VERIFIED',
    inventoryDelta,
    shopsDiscovered: discovery.shops.length,
    shopsReachable: discovery.shops.filter((shop) => shop.status !== 'UNREACHABLE').length,
    shopsActive: discovery.shops.filter((shop) => shop.status === 'ACTIVE').length,
    currentUpcomingEvents: upcoming.length,
    detailAccessible: enrichedEvents.filter((event) => event.detailAccess === 'DETAIL_ACCESSIBLE').length,
    partialDetail: enrichedEvents.filter((event) => event.detailAccess === 'PARTIAL_DETAIL').length,
    inaccessibleDetail: enrichedEvents.filter(
      (event) =>
        event.detailAccess === 'BLOCKED_BY_SECURITY' ||
        event.detailAccess === 'PROVIDER_ACCESS_UNAVAILABLE' ||
        event.detailAccess === 'DETAIL_NOT_FOUND',
    ).length,
    ambiguousBefore,
    ambiguousAfter,
    resolvedToRelevant,
    resolvedToIrrelevant,
    stillAmbiguous: enrichedEvents.filter((event) => event.relevance === 'AMBIGUOUS').length,
    inaccessible: enrichedEvents.filter((event) => event.qualification === 'INACCESSIBLE_REVIEW').length,
    highRelevant: enrichedEvents.filter((event) => event.relevance === 'HIGH_RELEVANCE').length,
    likelyRelevant: enrichedEvents.filter((event) => event.relevance === 'LIKELY_RELEVANT').length,
    ambiguous: enrichedEvents.filter((event) => event.relevance === 'AMBIGUOUS').length,
    irrelevant: enrichedEvents.filter((event) => event.relevance === 'IRRELEVANT').length,
    existing: enrichedEvents.filter((event) => event.qualification === 'EXISTING').length,
    possibleMatches: enrichedEvents.filter((event) => event.matchClassification === 'POSSIBLE_MATCH').length,
    netNew: enrichedEvents.filter((event) => event.matchClassification === 'NET_NEW').length,
    importCandidates: enrichedEvents.filter((event) => event.qualification === 'IMPORT_CANDIDATE').length,
    ambiguousReview: enrichedEvents.filter((event) => event.qualification === 'AMBIGUOUS_REVIEW').length,
    irrelevantQualified: enrichedEvents.filter((event) => event.qualification === 'IRRELEVANT').length,
    inaccessibleReview: enrichedEvents.filter((event) => event.qualification === 'INACCESSIBLE_REVIEW').length,
    eventsWithDescription: enrichedEvents.filter((event) => event.descriptionQualification !== 'NO_DESCRIPTION').length,
    eventsWithFullLineup: enrichedEvents.filter((event) => event.lineupQualification === 'FULL_LINEUP').length,
    eventsWithGenres: enrichedEvents.filter((event) => event.genreCandidates.length > 0).length,
    eventsWithEventSpecificMedia: enrichedEvents.filter((event) => Boolean(event.bestMediaUrl)).length,
    eventsWithCurrentAdmissionPrice: enrichedEvents.filter((event) => event.currentAdmissionPriceMinor != null).length,
    coverageByCity,
    coverageByGenre,
    newEventWrites: 0,
    eventUpdates: 0,
    ticketWrites: 0,
    mediaWrites: 0,
    sourceRegistryActivations: 0,
    schedulerChanges: 0,
    productionMutations: 0,
  };

  return {
    inventory: discovery.events,
    inventoryDelta,
    enrichedEvents,
    shopScores,
    firstBatch,
    summary,
  };
}
