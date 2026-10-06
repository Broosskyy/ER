import type { ElectronicRelevance, EternalRaveMatchClassification } from '../ticket-evidence/network-discovery/types';

export type RegionCoverageClass = 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE' | 'UNKNOWN';

export type DiscoveryMode = 'FULL_ENUMERATION' | 'STRATIFIED_SAMPLE';

export interface RausgegangenRegion {
  slug: string;
  displayName: string;
  bundesland?: string;
  stateCode?: string;
  listingSurface: string;
  reachable: boolean;
  listingEventCount: number;
  paginationDepth: number;
  electronicCandidateEstimate?: number;
  coverageClass: RegionCoverageClass;
  notes: string[];
}

export interface RausgegangenListingEntry {
  eventUrl: string;
  eventSlug: string;
  regionSlug: string;
  listingSurface: string;
  listingTitleHint?: string;
}

export interface RausgegangenDetailEvidence {
  eventUrl: string;
  eventSlug: string;
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  venueName?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  organizerName?: string;
  organizerUrl?: string;
  imageUrls: string[];
  ticketUrl?: string;
  ticketPriceRaw?: string;
  ticketPriceMinor?: number;
  ticketCurrency?: string;
  ticketAvailability?: string;
  categoryHints: string[];
  tagHints: string[];
  lineupHints: string[];
  genreHints: string[];
  outboundLinks: string[];
  breadcrumbs: Array<{ name: string; url?: string }>;
  jsonLdPresent: boolean;
  parseNotes: string[];
}

export interface RausgegangenDiscoveryCandidate {
  identityKey: string;
  eventSlug: string;
  regionSlug: string;
  title: string;
  startsAt?: string;
  endsAt?: string;
  lifecycle: 'UPCOMING' | 'ONGOING' | 'ENDED' | 'UNKNOWN';
  venueName?: string;
  city?: string;
  address?: string;
  organizerName?: string;
  description?: string;
  lineupHints: string[];
  genreHints: string[];
  imageUrls: string[];
  ticketUrl?: string;
  ticketPriceMinor?: number;
  ticketCurrency?: string;
  canonicalUrl: string;
  listingSurfaces: string[];
  relevance: ElectronicRelevance;
  relevanceReasons: string[];
  matchClassification: EternalRaveMatchClassification;
  matchedEventId?: string;
  matchedEventTitle?: string;
  matchReasons: string[];
  detailFetched: boolean;
  detailAccess: 'DETAIL_ACCESSIBLE' | 'PARTIAL_DETAIL' | 'DETAIL_NOT_FOUND' | 'BLOCKED' | 'NOT_FETCHED';
}

export interface RausgegangenDiscoverySummary {
  generatedAt: string;
  referenceInstant: string;
  discoveryMode: DiscoveryMode;
  regionsDiscovered: number;
  regionsReachable: number;
  rawListingEntries: number;
  uniqueEventUrls: number;
  duplicateListingEntries: number;
  regionsCovered: number;
  detailFetched: number;
  lifecycle: {
    upcoming: number;
    ongoing: number;
    ended: number;
    unknown: number;
  };
  relevance: {
    high: number;
    likely: number;
    ambiguous: number;
    irrelevant: number;
  };
  identity: {
    existingExact: number;
    existingStrong: number;
    possibleMatch: number;
    netNew: number;
    reviewRequired: number;
  };
}
