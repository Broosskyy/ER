import type { AdminEventTicketStatus, CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import {
  deriveSummaryPriceTextFromPhases,
  deriveTicketStatusFromPhases,
  sortTicketPhases,
} from '@/features/import/domain/canonical-ticket-phase';
import type { IdentityPublishVerdict } from '@/features/import/domain/event-evidence-identity-gate';

const IDENTITY_VERDICT_RANK: Record<IdentityPublishVerdict, number> = {
  exact: 50,
  corroborated: 40,
  partial_review_only: 10,
  mismatch: 0,
  unverifiable: 0,
};

const SOURCE_ROLE_TRUST_RANK: Record<string, number> = {
  official_website_source: 30,
  organizer: 28,
  ticketing: 18,
  enrichment: 8,
};

export interface AdmissionEvidenceStrengthInput {
  sourceKey?: string;
  sourceRoles?: string[];
  identityVerdict?: IdentityPublishVerdict;
  verifiedAt?: string;
  trustScore?: number;
}

function parseVerifiedMs(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function scoreAdmissionEvidence(side: AdmissionEvidenceStrengthInput): number {
  let score = IDENTITY_VERDICT_RANK[side.identityVerdict ?? 'unverifiable'] ?? 0;
  const roles = side.sourceRoles ?? [];
  if (roles.length > 0) {
    score += Math.max(...roles.map((role) => SOURCE_ROLE_TRUST_RANK[role] ?? 0));
  }
  if (typeof side.trustScore === 'number' && Number.isFinite(side.trustScore)) {
    score += Math.min(25, Math.max(0, side.trustScore));
  }
  const verifiedMs = parseVerifiedMs(side.verifiedAt);
  if (verifiedMs !== undefined) {
    score += verifiedMs / 1e15;
  }
  return score;
}

/** True when incoming admission evidence dominates existing (identity, roles, trust, freshness). */
export function incomingAdmissionEvidenceDominates(input: {
  incoming: AdmissionEvidenceStrengthInput;
  existing: AdmissionEvidenceStrengthInput;
}): boolean {
  const incomingScore = scoreAdmissionEvidence(input.incoming);
  const existingScore = scoreAdmissionEvidence(input.existing);
  if (incomingScore !== existingScore) {
    return incomingScore > existingScore;
  }
  const incomingMs = parseVerifiedMs(input.incoming.verifiedAt);
  const existingMs = parseVerifiedMs(input.existing.verifiedAt);
  if (incomingMs !== undefined && existingMs !== undefined) {
    return incomingMs > existingMs;
  }
  return incomingMs !== undefined && existingMs === undefined;
}

export type FreshnessFallbackRule =
  | 'manual_lock'
  | 'incoming_newer_verified'
  | 'incoming_blocked_identity'
  | 'incoming_blocked_stale'
  | 'existing_untimestamped_not_preferred'
  | 'no_incoming_snapshot'
  | 'incoming_same_or_older';

export interface FreshnessMergeDecision {
  apply: boolean;
  reason: string;
  fallbackRule: FreshnessFallbackRule;
  existingVerifiedAt?: string;
  incomingVerifiedAt?: string;
}

export interface AtomicTicketAdmissionSnapshot {
  phases: CanonicalTicketPhase[];
  priceText?: string;
  ticketStatus?: AdminEventTicketStatus;
  verifiedAt?: string;
  sourceKey: string;
  checkoutEvidenceUrl?: string;
  publicCtaCandidateUrl?: string;
}

export function buildAtomicAdmissionSnapshot(input: {
  phases: CanonicalTicketPhase[];
  sourceKey: string;
  verifiedAt?: string;
  checkoutEvidenceUrl?: string;
  publicCtaCandidateUrl?: string;
  soldOut?: boolean;
  fallbackTicketStatus?: AdminEventTicketStatus;
}): AtomicTicketAdmissionSnapshot {
  const phases = sortTicketPhases(input.phases);
  const priceText = deriveSummaryPriceTextFromPhases(phases);
  const ticketStatus = deriveTicketStatusFromPhases(
    phases,
    input.soldOut ? 'sold_out' : input.fallbackTicketStatus,
  );
  return {
    phases,
    priceText,
    ticketStatus,
    verifiedAt: input.verifiedAt,
    sourceKey: input.sourceKey,
    checkoutEvidenceUrl: input.checkoutEvidenceUrl,
    publicCtaCandidateUrl: input.publicCtaCandidateUrl,
  };
}

function parseVerifiedInstant(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function evaluateTicketEvidenceFreshness(input: {
  existingVerifiedAt?: string;
  incomingVerifiedAt?: string;
  identityVerdict: IdentityPublishVerdict;
  manualLocked: boolean;
  hasIncomingSnapshot: boolean;
}): FreshnessMergeDecision {
  const base = {
    existingVerifiedAt: input.existingVerifiedAt,
    incomingVerifiedAt: input.incomingVerifiedAt,
  };

  if (input.manualLocked) {
    return {
      apply: false,
      reason: 'manual_lock_preserves_existing_value',
      fallbackRule: 'manual_lock',
      ...base,
    };
  }

  if (
    input.identityVerdict === 'mismatch' ||
    input.identityVerdict === 'unverifiable' ||
    input.identityVerdict === 'partial_review_only'
  ) {
    return {
      apply: false,
      reason: `identity_verdict_blocks_write:${input.identityVerdict}`,
      fallbackRule: 'incoming_blocked_identity',
      ...base,
    };
  }

  if (!input.hasIncomingSnapshot) {
    return {
      apply: false,
      reason: 'no_incoming_admission_snapshot',
      fallbackRule: 'no_incoming_snapshot',
      ...base,
    };
  }

  const incomingMs = parseVerifiedInstant(input.incomingVerifiedAt);
  const existingMs = parseVerifiedInstant(input.existingVerifiedAt);

  if (incomingMs !== undefined && existingMs !== undefined) {
    if (incomingMs > existingMs) {
      return {
        apply: true,
        reason: 'incoming_verified_at_is_newer',
        fallbackRule: 'incoming_newer_verified',
        ...base,
      };
    }
    if (incomingMs < existingMs) {
      return {
        apply: false,
        reason: 'incoming_verified_at_is_older',
        fallbackRule: 'incoming_blocked_stale',
        ...base,
      };
    }
    return {
      apply: true,
      reason: 'incoming_verified_at_equal_replaces_snapshot_atomically',
      fallbackRule: 'incoming_newer_verified',
      ...base,
    };
  }

  if (incomingMs !== undefined && existingMs === undefined) {
    return {
      apply: true,
      reason: 'incoming_has_verified_at_existing_untimestamped',
      fallbackRule: 'incoming_newer_verified',
      ...base,
    };
  }

  if (incomingMs === undefined && existingMs !== undefined) {
    return {
      apply: false,
      reason: 'existing_has_verified_at_incoming_untimestamped',
      fallbackRule: 'existing_untimestamped_not_preferred',
      ...base,
    };
  }

  // Neither side has verifiedAt — do not treat as freshly verified.
  return {
    apply: false,
    reason: 'both_untimestamped_no_verified_at',
    fallbackRule: 'existing_untimestamped_not_preferred',
    ...base,
  };
}

/**
 * Replaces the admission snapshot for a single ticket source atomically.
 * Phases from other sources are preserved only when the incoming source does not dominate.
 */
export function replaceAdmissionSnapshotForSource(input: {
  existingPhases?: CanonicalTicketPhase[];
  existingSourceKey?: string;
  incoming: AtomicTicketAdmissionSnapshot;
  decision: FreshnessMergeDecision;
  incomingDominatesExistingSource?: boolean;
}): CanonicalTicketPhase[] | undefined {
  if (!input.decision.apply) {
    return input.existingPhases;
  }

  if (!input.existingPhases?.length) {
    return input.incoming.phases;
  }

  if (!input.existingSourceKey || input.existingSourceKey === input.incoming.sourceKey) {
    return input.incoming.phases;
  }

  if (input.incomingDominatesExistingSource) {
    return input.incoming.phases;
  }

  return input.existingPhases;
}

/** @deprecated Use incomingAdmissionEvidenceDominates — provider names are not truth signals. */
export function resolveSourceRank(_sourceKey: string | undefined): number {
  return 0;
}
