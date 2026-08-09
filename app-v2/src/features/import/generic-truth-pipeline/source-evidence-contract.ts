import type { EvidenceType, SourceRole } from '@/features/import/contracts/evidence-types';
import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';

export const GENERIC_TRUTH_PIPELINE_VERSION = 'phase4866-v1';

export interface SourceEvidenceIdentity {
  pageTitle?: string;
  listRowTitle?: string;
  eventDate?: string;
  endDate?: string;
  venueName?: string;
  organizerName?: string;
  officialOutboundRelationship?: 'linked' | 'same_host' | 'cross_host' | 'unknown';
}

export interface SourceEvidenceTickets {
  publicCtaCandidateUrl?: string;
  checkoutEvidenceUrl?: string;
  admissionProducts?: { name: string; priceCents?: number; mandatory?: boolean }[];
  excludedProducts?: string[];
  priceText?: string;
  availability?: string;
  phases?: CanonicalTicketPhase[];
}

export interface SourceEvidenceContent {
  description?: string;
  genreLabels?: string[];
  structuredLineup?: LineupEvidenceEntry[];
  minimumAge?: number;
  venueEnvironment?: string;
}

export interface SourceEvidenceProvenance {
  extractionStrategy: string;
  evidenceType: EvidenceType;
  importerVersion?: string;
  confidence?: number;
  reliability?: number;
}

export interface SourceEvidenceContamination {
  detected: boolean;
  reasons: string[];
  collisionWithEventId?: string;
}

/**
 * Generic evidence bundle — connectors map fetch/parse output here.
 * Central publish logic consumes bundles; connectors do not decide merges.
 */
export interface SourceEvidenceBundle {
  sourceId: string;
  sourceRole: SourceRole;
  sourceUrl: string;
  observedAt: string;
  verifiedAt: string;
  identity: SourceEvidenceIdentity;
  tickets?: SourceEvidenceTickets;
  content?: SourceEvidenceContent;
  provenance?: SourceEvidenceProvenance;
  contamination?: SourceEvidenceContamination;
  diagnostics?: string[];
  evidenceOrigin: string;
  identityEvidenceOrigin: string;
  sourceNativeEvidence: boolean;
  legacyFallbackUsed: boolean;
  criticalIdentitySelfDerived: boolean;
}

export interface SourceEvidenceFetchInput {
  sourceUrl: string;
  externalId?: string;
  observedAt?: string;
}

/**
 * Connector boundary: fetch, parse, map to SourceEvidenceBundle only.
 */
export interface SourceEvidenceAdapter {
  readonly adapterId: string;
  readonly supportedSourceRoles: readonly SourceRole[];
  fetchAndParse(input: SourceEvidenceFetchInput): Promise<SourceEvidenceBundle | null>;
}

export type GenericTruthFieldGroup =
  | 'identity_schedule_venue'
  | 'tickets'
  | 'description'
  | 'genres'
  | 'lineup'
  | 'age_environment'
  | 'cta_checkout';

export const ALL_GENERIC_TRUTH_FIELD_GROUPS: readonly GenericTruthFieldGroup[] = [
  'identity_schedule_venue',
  'tickets',
  'description',
  'genres',
  'lineup',
  'age_environment',
  'cta_checkout',
];
