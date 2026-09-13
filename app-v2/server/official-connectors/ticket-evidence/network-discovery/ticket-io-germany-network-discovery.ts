import { classifyDomainFromRelevance } from '../../shared/discovery-genre-fusion/domain-classification';
import { classifyRelevanceEvidence } from './relevance-evidence';
import {
  buildCoverageByState,
  bundeslandForCity,
  classifyShopGeography,
  identifyCoverageGaps,
  type GeographyConfidence,
  type ShopGeographyClassification,
} from './germany-geography';
import { buildGermanyShopSeeds } from './germany-shop-seeds';
import type { StagingCatalogEvent } from './match-staging-catalog';
import {
  GERMANY_MAX_DISCOVERED_SHOPS,
  runTicketIoNetworkDiscovery,
  type DiscoveryRoundSummary,
  type TicketIoNetworkDiscoveryOptions,
  type TicketIoNetworkDiscoveryResult,
} from './ticket-io-network-discovery';
import type { TicketIoEventDiscoveryCandidate, TicketIoShopCandidate } from './types';

export interface GermanTicketIoShop extends TicketIoShopCandidate {
  country?: 'DE';
  bundesland?: string;
  stateCode?: string;
  geographyConfidence: GeographyConfidence;
  geographyEvidence: string[];
  isGermanShop: boolean;
}

export interface GermanyNetworkDiscoverySummary {
  initialSeeds: number;
  networkNodesDiscovered: number;
  uniqueShopsDiscovered: number;
  germanShops: number;
  activeGermanShops: number;
  inactiveGermanShops: number;
  inaccessibleGermanShops: number;
  federalStatesRepresented: number;
  citiesRepresented: number;
  totalUpcomingEvents: number;
  electronicHigh: number;
  electronicMedium: number;
  ambiguous: number;
  nonElectronic: number;
  existingMatches: number;
  netNewCandidates: number;
  reviewRequired: number;
  discoveryRounds: DiscoveryRoundSummary[];
  coverageByState: Record<string, { shops: number; upcomingEvents: number; electronicCandidates: number; netNewCandidates: number }>;
  coverageByCity: Record<string, { shops: number; upcomingEvents: number; electronicCandidates: number; netNewCandidates: number }>;
  coverageGaps: Array<{ bundesland: string; gapType: string; detail: string }>;
}

export interface GermanyNetworkDiscoveryResult extends TicketIoNetworkDiscoveryResult {
  germanShops: GermanTicketIoShop[];
  germanySummary: GermanyNetworkDiscoverySummary;
}

function isRelevantEvent(event: TicketIoEventDiscoveryCandidate): boolean {
  return (
    event.lifecycle !== 'ENDED' &&
    (event.relevance === 'HIGH_RELEVANCE' || event.relevance === 'LIKELY_RELEVANT')
  );
}

function domainClassificationForEvent(event: TicketIoEventDiscoveryCandidate): string {
  const evidence = classifyRelevanceEvidence({
    title: event.title,
    description: event.description,
    genreHints: event.genreHints,
    lineupHints: event.lineupHints,
    venueName: event.venueName,
    organizerName: event.organizerName,
  });
  return classifyDomainFromRelevance(evidence);
}

export function enrichShopWithGeography(
  shop: TicketIoShopCandidate,
  shopEvents: TicketIoEventDiscoveryCandidate[],
): GermanTicketIoShop {
  const upcoming = shopEvents.filter((event) => event.lifecycle !== 'ENDED');
  const geography = classifyShopGeography({
    seedCity: shop.city,
    seedRegion: shop.region,
    venueNames: upcoming.map((event) => event.venueName).filter(Boolean) as string[],
    eventCities: upcoming.map((event) => event.city).filter(Boolean) as string[],
    addresses: upcoming.map((event) => event.address).filter(Boolean) as string[],
  });

  const seedBundesland = shop.region && shop.region !== 'Germany' ? bundeslandForCity(shop.city) : {};
  const bundesland = geography.bundesland ?? seedBundesland.bundesland;
  const stateCode = geography.stateCode ?? seedBundesland.stateCode;

  return {
    ...shop,
    country: geography.country,
    bundesland,
    stateCode,
    city: geography.city ?? shop.city,
    geographyConfidence: geography.confidence,
    geographyEvidence: geography.evidenceSources,
    isGermanShop: geography.country === 'DE' || Boolean(bundesland),
  };
}

export async function runTicketIoGermanyNetworkDiscovery(
  options: Omit<TicketIoNetworkDiscoveryOptions, 'shopSeeds' | 'maxDiscoveredShops' | 'trackDiscoveryRounds'> & {
    maxDiscoveredShops?: number;
  } = {},
): Promise<GermanyNetworkDiscoveryResult> {
  const seeds = buildGermanyShopSeeds();
  const discovery = await runTicketIoNetworkDiscovery({
    ...options,
    shopSeeds: seeds,
    maxDiscoveredShops: options.maxDiscoveredShops ?? GERMANY_MAX_DISCOVERED_SHOPS,
    trackDiscoveryRounds: true,
    sampleDetailCountPerShop: options.sampleDetailCountPerShop ?? 0,
  });

  const germanShops = discovery.shops.map((shop) =>
    enrichShopWithGeography(
      shop,
      discovery.events.filter((event) => event.shopSlug === shop.slug),
    ),
  );

  const germanShopSet = germanShops.filter((shop) => shop.isGermanShop);
  const activeGerman = germanShopSet.filter((shop) => shop.status === 'ACTIVE');
  const inactiveGerman = germanShopSet.filter((shop) => shop.status === 'INACTIVE');
  const inaccessibleGerman = germanShopSet.filter((shop) => shop.status === 'UNREACHABLE');

  const upcomingEvents = discovery.events.filter((event) => event.lifecycle !== 'ENDED');
  const domainCounts = { electronicHigh: 0, electronicMedium: 0, ambiguous: 0, nonElectronic: 0 };
  for (const event of upcomingEvents) {
    const domain = domainClassificationForEvent(event);
    if (domain === 'ELECTRONIC_HIGH') domainCounts.electronicHigh += 1;
    else if (domain === 'ELECTRONIC_MEDIUM') domainCounts.electronicMedium += 1;
    else if (domain === 'AMBIGUOUS') domainCounts.ambiguous += 1;
    else domainCounts.nonElectronic += 1;
  }

  const stateEntries = germanShopSet.map((shop) => {
    const shopEvents = upcomingEvents.filter((event) => event.shopSlug === shop.slug);
    const electronic = shopEvents.filter(isRelevantEvent);
    const netNew = electronic.filter((event) => event.matchClassification === 'NET_NEW');
    return {
      bundesland: shop.bundesland ?? 'Unknown',
      shopCount: 1,
      upcomingEvents: shopEvents.length,
      electronicCandidates: electronic.length,
      netNewCandidates: netNew.length,
    };
  });

  const coverageByState = buildCoverageByState(stateEntries);
  const coverageByCity: Record<string, { shops: number; upcomingEvents: number; electronicCandidates: number; netNewCandidates: number }> = {};
  for (const shop of germanShopSet) {
    const city = shop.city ?? 'Unknown';
    if (!coverageByCity[city]) {
      coverageByCity[city] = { shops: 0, upcomingEvents: 0, electronicCandidates: 0, netNewCandidates: 0 };
    }
    coverageByCity[city].shops += 1;
    const shopEvents = upcomingEvents.filter((event) => event.shopSlug === shop.slug);
    coverageByCity[city].upcomingEvents += shopEvents.length;
    coverageByCity[city].electronicCandidates += shopEvents.filter(isRelevantEvent).length;
    coverageByCity[city].netNewCandidates += shopEvents.filter(
      (event) => isRelevantEvent(event) && event.matchClassification === 'NET_NEW',
    ).length;
  }

  const citiesRepresented = new Set(germanShopSet.map((shop) => shop.city).filter(Boolean)).size;
  const federalStatesRepresented = new Set(germanShopSet.map((shop) => shop.bundesland).filter(Boolean)).size;

  const germanySummary: GermanyNetworkDiscoverySummary = {
    initialSeeds: seeds.length,
    networkNodesDiscovered: discovery.shops.length,
    uniqueShopsDiscovered: discovery.shops.length,
    germanShops: germanShopSet.length,
    activeGermanShops: activeGerman.length,
    inactiveGermanShops: inactiveGerman.length,
    inaccessibleGermanShops: inaccessibleGerman.length,
    federalStatesRepresented,
    citiesRepresented,
    totalUpcomingEvents: upcomingEvents.length,
    electronicHigh: domainCounts.electronicHigh,
    electronicMedium: domainCounts.electronicMedium,
    ambiguous: domainCounts.ambiguous,
    nonElectronic: domainCounts.nonElectronic,
    existingMatches:
      discovery.summary.existingExact +
      discovery.summary.existingStrongMatch +
      discovery.summary.possibleMatch,
    netNewCandidates: discovery.summary.netNewRelevantEvents,
    reviewRequired: discovery.summary.reviewRequired,
    discoveryRounds: discovery.discoveryRounds,
    coverageByState,
    coverageByCity,
    coverageGaps: identifyCoverageGaps(coverageByState),
  };

  return {
    ...discovery,
    germanShops,
    germanySummary,
  };
}

export type { StagingCatalogEvent, ShopGeographyClassification };
