/**
 * Phase 4.7.7.1 — Audit issue taxonomy.
 *
 * Classifies production defects by earliest proven blocker.
 * Missing canonical evidence must never be labeled a projection failure.
 */

export type RepairabilityClass =
  | 'repairable_now'
  | 'requires_external_source'
  | 'requires_OCR'
  | 'requires_connector'
  | 'requires_review'
  | 'blocked_by_missing_public_evidence';

export type RootCauseStage =
  | 'Source'
  | 'Import'
  | 'Normalization'
  | 'Matching'
  | 'Canonical Merge'
  | 'Persistence'
  | 'Canonical Read'
  | 'Projection'
  | 'API'
  | 'ViewModel'
  | 'Consumer UI'
  | 'Cache';

export interface TaxonomyIssue {
  domain: 'ticket' | 'lineup' | 'badge' | 'venue' | 'media' | 'consumer';
  code: string;
  message: string;
  rootCauseStage: RootCauseStage;
  repairability: RepairabilityClass;
  taxonomyVersion: 'phase4771-v1';
}

export interface VenueLabelGapInput {
  title: string;
  eventVenueName?: string;
  eventVenueCity?: string;
  projectedVenueLabel?: string;
  venueRowName?: string;
  organizerName?: string;
  importVenueName?: string;
}

export interface LineupDisplayGapInput {
  persistedArtistNames: string[];
  displayedArtistNames: string[];
  suspiciousArtistNames: string[];
  legacyArtifactNames: string[];
  structuredEntryCount: number;
}

export interface TicketBadgeGapInput {
  hasTicketBadge: boolean;
  availability: string;
  ticketStatus?: string;
  priceText?: string;
  ticketUrl?: string;
  websiteUrl?: string;
}

const MALLORCA_PATTERN = /mallorca|palma de mallorca/i;
const KITKAT_PATTERN = /kitkat/i;
const SHIP_PATTERN = /bootshaus\s+on\s+a\s+ship|ship\s+vol/i;
const EXTERNAL_BOOTSHAUS_PATTERN = /122\s+pres\./i;
const FESTIVAL_PATTERN = /festival/i;

function cohortLabel(title: string): string {
  if (MALLORCA_PATTERN.test(title)) return 'palma_mallorca';
  if (KITKAT_PATTERN.test(title)) return 'kitkat_external';
  if (SHIP_PATTERN.test(title)) return 'ship_event';
  if (EXTERNAL_BOOTSHAUS_PATTERN.test(title)) return 'external_bootshaus_promoted';
  if (FESTIVAL_PATTERN.test(title)) return 'festival_external';
  return 'generic';
}

/** Venue label absent from consumer — trace to earliest blocker, not projection by default. */
export function classifyVenueLabelGap(input: VenueLabelGapInput): TaxonomyIssue | null {
  const hasPersistedVenueName = Boolean(input.eventVenueName?.trim());
  const hasProjectedLabel = Boolean(input.projectedVenueLabel?.trim());
  const hasVenueRow = Boolean(input.venueRowName?.trim());
  const hasCity = Boolean(input.eventVenueCity?.trim());

  if (hasPersistedVenueName && !hasProjectedLabel) {
    return {
      domain: 'consumer',
      code: 'venue_label_projection_gap',
      message: 'Canonical venue name exists but consumer venueLabel is empty',
      rootCauseStage: 'Projection',
      repairability: 'repairable_now',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  if (hasPersistedVenueName && hasProjectedLabel) {
    return null;
  }

  if (
    input.organizerName &&
    input.eventVenueName?.toLowerCase() === input.organizerName.toLowerCase()
  ) {
    return {
      domain: 'venue',
      code: 'canonical_venue_evidence_gap',
      message: 'Promoter used as venue — not valid venue evidence',
      rootCauseStage: 'Canonical Merge',
      repairability: 'requires_review',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  if (
    input.importVenueName &&
    input.eventVenueName &&
    input.importVenueName.toLowerCase() !== input.eventVenueName.toLowerCase()
  ) {
    return {
      domain: 'venue',
      code: 'canonical_venue_evidence_gap',
      message: `Import venue "${input.importVenueName}" conflicts with canonical`,
      rootCauseStage: 'Canonical Merge',
      repairability: 'requires_review',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  const cohort = cohortLabel(input.title);
  if (cohort === 'palma_mallorca' || cohort === 'kitkat_external' || cohort === 'ship_event') {
    return {
      domain: 'venue',
      code: 'canonical_venue_evidence_gap',
      message: `External geography (${cohort}) — venue relationship ambiguous or absent`,
      rootCauseStage: 'Canonical Merge',
      repairability: 'requires_review',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  if (cohort === 'external_bootshaus_promoted' || cohort === 'festival_external') {
    return {
      domain: 'venue',
      code: 'canonical_venue_evidence_gap',
      message: `External promoted event (${cohort}) — explicit venue not in canonical record`,
      rootCauseStage: 'Source',
      repairability: cohort === 'festival_external' ? 'requires_review' : 'blocked_by_missing_public_evidence',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  if (hasVenueRow && !hasPersistedVenueName) {
    return {
      domain: 'venue',
      code: 'canonical_venue_evidence_gap',
      message: 'Venue row linked but event venue_name not populated',
      rootCauseStage: 'Persistence',
      repairability: 'requires_connector',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  if (hasCity && !hasPersistedVenueName) {
    return {
      domain: 'venue',
      code: 'canonical_venue_evidence_gap',
      message: 'City present but canonical venue name absent from public evidence',
      rootCauseStage: 'Source',
      repairability: 'blocked_by_missing_public_evidence',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  if (!hasCity && !hasPersistedVenueName) {
    return {
      domain: 'venue',
      code: 'canonical_venue_evidence_gap',
      message: 'No venue name or city in canonical record',
      rootCauseStage: 'Source',
      repairability: 'blocked_by_missing_public_evidence',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  return null;
}

/** Lineup hidden in UI — projection defect only when valid canonical lineup exists. */
export function classifyLineupDisplayGap(input: LineupDisplayGapInput): TaxonomyIssue | null {
  if (input.displayedArtistNames.length > 0) {
    return null;
  }
  if (input.persistedArtistNames.length === 0) {
    return null;
  }

  const allGarbage = input.persistedArtistNames.every(
    (name) =>
      input.suspiciousArtistNames.includes(name) ||
      input.legacyArtifactNames.includes(name) ||
      name.length > 80,
  );

  if (allGarbage) {
    return {
      domain: 'lineup',
      code: 'garbage_lineup_filtered',
      message: 'Persisted lineup contains invalid/garbage artists correctly hidden from consumer',
      rootCauseStage: 'Persistence',
      repairability: 'requires_review',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  const anyQualityRejected = input.persistedArtistNames.some((name) =>
    input.suspiciousArtistNames.includes(name),
  );
  if (anyQualityRejected && input.displayedArtistNames.length === 0) {
    return {
      domain: 'lineup',
      code: 'garbage_lineup_filtered',
      message: 'Persisted lineup contains invalid/garbage artists correctly hidden from consumer',
      rootCauseStage: 'Persistence',
      repairability: 'requires_review',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  const hasGarbageOnly =
    input.suspiciousArtistNames.length > 0 ||
    input.legacyArtifactNames.length > 0 ||
    input.structuredEntryCount > 0;

  if (hasGarbageOnly && input.displayedArtistNames.length === 0) {
    const garbageFiltered = input.persistedArtistNames.some(
      (name) => input.suspiciousArtistNames.includes(name) || input.legacyArtifactNames.includes(name),
    );
    if (garbageFiltered) {
      return {
        domain: 'lineup',
        code: 'garbage_lineup_filtered',
        message: 'Persisted lineup contains invalid/garbage artists correctly hidden from consumer',
        rootCauseStage: 'Persistence',
        repairability: 'requires_review',
        taxonomyVersion: 'phase4771-v1',
      };
    }
  }

  return {
    domain: 'lineup',
    code: 'lineup_projection_gap',
    message: 'Valid canonical lineup not projected to consumer display',
    rootCauseStage: 'Projection',
    repairability: 'repairable_now',
    taxonomyVersion: 'phase4771-v1',
  };
}

/** Ticket badge absent — defect only when explicit availability evidence exists. */
export function classifyTicketBadgeGap(input: TicketBadgeGapInput): TaxonomyIssue | null {
  if (input.hasTicketBadge) {
    return null;
  }

  const explicitAvailability =
    input.availability !== 'unknown' &&
    input.availability !== undefined &&
    input.availability !== '';

  const explicitStatus =
    input.ticketStatus === 'on_sale' ||
    input.ticketStatus === 'sold_out' ||
    input.ticketStatus === 'limited' ||
    input.ticketStatus === 'presale';

  if (explicitAvailability || explicitStatus) {
    return {
      domain: 'badge',
      code: 'ticket_badge_projection_gap',
      message: 'Explicit ticket availability exists but badge not projected',
      rootCauseStage: 'Projection',
      repairability: 'repairable_now',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  if (input.priceText || input.ticketUrl || input.websiteUrl) {
    return {
      domain: 'badge',
      code: 'missing_availability_evidence',
      message: 'No explicit availability evidence — badge correctly absent',
      rootCauseStage: 'Source',
      repairability: 'blocked_by_missing_public_evidence',
      taxonomyVersion: 'phase4771-v1',
    };
  }

  return null;
}

export function isTrueProjectionDefect(issue: Pick<TaxonomyIssue, 'code' | 'repairability'>): boolean {
  return (
    issue.repairability === 'repairable_now' &&
    (issue.code === 'venue_label_projection_gap' ||
      issue.code === 'lineup_projection_gap' ||
      issue.code === 'ticket_badge_projection_gap' ||
      issue.code === 'price_projection_gap' ||
      issue.code === 'price_display_mismatch' ||
      issue.code === 'cache_stale_projection')
  );
}

export function isCanonicalEvidenceGap(issue: Pick<TaxonomyIssue, 'code'>): boolean {
  return issue.code === 'canonical_venue_evidence_gap' || issue.code === 'missing_availability_evidence';
}

export const TAXONOMY_RULES_VERSION = 'phase4771-v1';

export const TAXONOMY_RULES = {
  version: TAXONOMY_RULES_VERSION,
  repairableNowRequires: [
    'valid canonical evidence already exists',
    'expected consumer value is known',
    'first failure is persistence, canonical read, API, ViewModel, UI or cache',
    'safe mutation possible without new evidence',
  ],
  neverRepairableFromEmptyConsumer: [
    'incomplete_projection on empty venue_label without canonical venue',
    'lineup_projection_gap when garbage artists are quality-filtered',
    'missing_ticket_badge when availability is unknown',
  ],
  cohorts: {
    palma_mallorca: 'requires_review',
    kitkat_external: 'requires_review',
    ship_event: 'requires_review',
    external_bootshaus_promoted: 'blocked_by_missing_public_evidence',
    festival_external: 'requires_review',
  },
} as const;
