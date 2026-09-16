export type RausgegangenDiscoverySurfaceType = 'CITY' | 'LOCATION';

export interface RausgegangenDiscoverySurface {
  surfaceType: RausgegangenDiscoverySurfaceType;
  surfaceUrl: string;
  surfaceId: string;
  discoveredAt: string;
  discoveryRunId: string;
  sourceEvidence?: string;
}

export interface EventDiscoveryProvenanceEntry {
  surfaceType: RausgegangenDiscoverySurfaceType;
  surfaceId: string;
  surfaceUrl: string;
  discoveredAt: string;
}

export interface UnionDiscoveredEvent {
  eventUrl: string;
  eventSlug: string;
  discoveredBy: EventDiscoveryProvenanceEntry[];
  listingTitleHint?: string;
  regionSlug?: string;
}

export type LocationQualificationState = 'HIGH_VALUE' | 'LIKELY_VALUE' | 'UNRESOLVED' | 'LOW_VALUE';

export interface LocationSurfaceCandidate {
  locationSlug: string;
  locationUrl: string;
  evidenceSources: string[];
  observedElectronicEvents: number;
  observedUpcomingEvents: number;
  qualification: LocationQualificationState;
  qualificationScore: number;
  qualificationReasons: string[];
}

export interface AcquisitionCoverageBounds {
  maxRegions: number;
  maxExpansionDepth: number;
  maxLocationSurfaces: number;
  maxLocationCandidates: number;
  maxGraphRequests: number;
  listingConcurrency: number;
  detailConcurrency: number;
  activeWindowDays: number;
  requestDelayMs: number;
  fetchTimeoutMs: number;
  maxRetries: number;
}

export const DEFAULT_ACQUISITION_COVERAGE_BOUNDS: AcquisitionCoverageBounds = {
  maxRegions: 45,
  maxExpansionDepth: 3,
  maxLocationSurfaces: 150,
  maxLocationCandidates: 500,
  maxGraphRequests: 12000,
  listingConcurrency: 2,
  detailConcurrency: 4,
  activeWindowDays: 90,
  requestDelayMs: 250,
  fetchTimeoutMs: 25000,
  maxRetries: 2,
};
