import type { TicketPlatformId } from '@/features/aggregation/connectors/ticket-platform/types';
import type { TicketPlatformScopeStats } from '@/features/aggregation/connectors/ticket-platform/types';
import type { ImportSourceConfig } from '@/features/import/models/source-config';

export const PLATFORM_DISCOVERY_RUN_STATUSES = ['running', 'completed', 'failed'] as const;
export type PlatformDiscoveryRunStatus = (typeof PLATFORM_DISCOVERY_RUN_STATUSES)[number];

export const PLATFORM_DISCOVERY_CANDIDATE_STATUSES = [
  'discovered',
  'review',
  'approved',
  'rejected',
  'activated',
] as const;
export type PlatformDiscoveryCandidateStatus = (typeof PLATFORM_DISCOVERY_CANDIDATE_STATUSES)[number];

export const PLATFORM_DISCOVERY_CANDIDATE_TYPES = [
  'platform_list',
  'shop',
  'organizer',
  'venue',
] as const;
export type PlatformDiscoveryCandidateType = (typeof PLATFORM_DISCOVERY_CANDIDATE_TYPES)[number];

export interface PlatformDiscoveryRejectionStat {
  reason: string;
  count: number;
}

export interface PlatformDiscoveryRunSummary {
  platform: TicketPlatformId;
  pagesCrawled: number;
  rawEventsDiscovered: number;
  electronicEventsAccepted: number;
  electronicEventsRejected: number;
  rejectionReasons: PlatformDiscoveryRejectionStat[];
  uniqueOrganizers: number;
  uniqueVenues: number;
  newShopCandidates: number;
  existingSourceMatches: number;
  limitations: string[];
}

export interface PlatformDiscoveryRun {
  id: string;
  platform: TicketPlatformId;
  status: PlatformDiscoveryRunStatus;
  summary: PlatformDiscoveryRunSummary;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformDiscoveryCandidate {
  id: string;
  runId: string;
  platform: TicketPlatformId;
  candidateType: PlatformDiscoveryCandidateType;
  identifier: string;
  displayName: string;
  listUrl?: string;
  proposedSourceConfig?: ImportSourceConfig;
  discoveryStats?: TicketPlatformScopeStats & { eventCount?: number };
  status: PlatformDiscoveryCandidateStatus;
  duplicateSourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformDiscoveryReport {
  run: PlatformDiscoveryRun;
  candidates: PlatformDiscoveryCandidate[];
}
