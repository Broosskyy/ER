import { createHash } from 'node:crypto';

import type { AdminEventRecord } from '@/data/types/records';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';

import type { GenericTruthPublishEvaluation } from './publish-evaluation';
import { isEventInCanary, type GenericTruthRolloutConfig } from './rollout';
import { resolveServerGenericTruthRollout } from './server-rollout-config';
import {
  ALL_GENERIC_TRUTH_FIELD_GROUPS,
  type GenericTruthFieldGroup,
} from './source-evidence-contract';

export const RESTRICTED_CANARY_SOURCE_ID = 'source-bootshaus-ticket-io';
export const RESTRICTED_CANARY_FIELD_GROUPS: readonly GenericTruthFieldGroup[] = [
  'tickets',
  'cta_checkout',
];
export const RESTRICTED_CANARY_PERCENT = 10;
export const RESTRICTED_CANARY_MAX_EVENTS = 3;

const TICKET_LOCK_FIELDS = ['ticketUrl', 'websiteUrl', 'priceText', 'ticketPhases', 'ticketStatus'];

export function buildRestrictedCanaryRollout(
  sourceId: string = RESTRICTED_CANARY_SOURCE_ID,
): GenericTruthRolloutConfig {
  return resolveServerGenericTruthRollout({
    enabled: true,
    mode: 'controlled',
    canaryPercent: RESTRICTED_CANARY_PERCENT,
    writesSuppressed: true,
    sourceAllowlist: [sourceId],
    fieldGroups: [...RESTRICTED_CANARY_FIELD_GROUPS],
  });
}

export function selectDeterministicCanaryEventIds(
  sourceId: string,
  eventIds: readonly string[],
  canaryPercent: number = RESTRICTED_CANARY_PERCENT,
  maxCount: number = RESTRICTED_CANARY_MAX_EVENTS,
  rollout: GenericTruthRolloutConfig = buildRestrictedCanaryRollout(sourceId),
): string[] {
  return [...eventIds]
    .sort((left, right) => left.localeCompare(right))
    .filter((eventId) => isEventInCanary(sourceId, eventId, rollout))
    .slice(0, maxCount);
}

export function buildRowFingerprint(event: AdminEventRecord): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        title: event.title,
        startDate: event.startDate,
        ticketUrl: event.ticketUrl,
        websiteUrl: event.websiteUrl,
        priceText: event.priceText,
        ticketStatus: event.ticketStatus,
        ticketPhases: event.ticketPhases,
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

export function buildRollbackPayload(event: AdminEventRecord): Record<string, unknown> {
  return {
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  };
}

export interface RestrictedCanaryEligibilityResult {
  eligible: boolean;
  skipReasons: string[];
}

export function assessRestrictedCanaryCandidate(input: {
  evaluation: GenericTruthPublishEvaluation;
  manualLocks: readonly string[];
  allowedFieldGroups?: readonly GenericTruthFieldGroup[];
}): RestrictedCanaryEligibilityResult {
  const allowed = input.allowedFieldGroups ?? RESTRICTED_CANARY_FIELD_GROUPS;
  const skipReasons: string[] = [];

  if (!input.evaluation.sourceNativeEvidence) {
    skipReasons.push('missing_native_source_identity');
  }
  if (!['exact', 'corroborated'].includes(input.evaluation.identityVerdict)) {
    skipReasons.push(`identity_verdict_${input.evaluation.identityVerdict}`);
  }
  if (!input.evaluation.evidenceCoverage.verifiedAt) {
    skipReasons.push('verified_at_missing');
  }
  if (input.evaluation.collision) {
    skipReasons.push('collision_or_contamination');
  }
  if (input.manualLocks.length > 0) {
    skipReasons.push('manual_locks_present');
  }
  for (const field of TICKET_LOCK_FIELDS) {
    if (input.manualLocks.includes(field)) {
      skipReasons.push(`manual_lock_${field}`);
    }
  }

  const allowedWouldChange = input.evaluation.fieldGroupDeltas.some(
    (delta) => allowed.includes(delta.group) && delta.wouldChange && !delta.blockReason,
  );
  if (!allowedWouldChange) {
    skipReasons.push('no_allowed_field_delta');
  }

  const blockedAllowedGroup = allowed.some((group) =>
    input.evaluation.fieldGroupEligibility.blockedFieldGroups.includes(group),
  );
  const policyAllowed = allowed.some((group) =>
    input.evaluation.fieldGroupEligibility.policyEligibleFieldGroups.includes(group),
  );
  if (blockedAllowedGroup && !policyAllowed) {
    skipReasons.push('allowed_field_group_blocked');
  }

  return {
    eligible: skipReasons.length === 0 && policyAllowed,
    skipReasons: [...new Set(skipReasons)],
  };
}

export interface StableCanaryManifestInput {
  sourceId: string;
  canaryPercent: number;
  maxEvents: number;
  allowedFieldGroups: readonly GenericTruthFieldGroup[];
  candidates: {
    eventId: string;
    beforeFingerprint: string;
    expectedPatches: Record<string, unknown>;
    rollbackPayload: Record<string, unknown>;
  }[];
}

export function buildStableCanaryManifestHash(input: StableCanaryManifestInput): string {
  const payload = {
    sourceId: input.sourceId,
    canaryRule: {
      percent: input.canaryPercent,
      maxEvents: input.maxEvents,
      selection: 'stable_hash_source_event_id',
    },
    allowedFieldGroups: [...input.allowedFieldGroups].sort(),
    excludedFieldGroups: ALL_GENERIC_TRUTH_FIELD_GROUPS.filter(
      (group) => !input.allowedFieldGroups.includes(group),
    ).sort(),
    candidates: input.candidates
      .map((candidate) => ({
        eventId: candidate.eventId,
        beforeFingerprint: candidate.beforeFingerprint,
        expectedPatches: candidate.expectedPatches,
        rollbackPayload: candidate.rollbackPayload,
      }))
      .sort((left, right) => left.eventId.localeCompare(right.eventId)),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function summarizeTicketRoles(event: AdminEventRecord): {
  publicCtaUrl?: string;
  checkoutEvidenceUrl?: string;
} {
  const canonical = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  return {
    publicCtaUrl: canonical.publicCtaUrl,
    checkoutEvidenceUrl: canonical.checkoutEvidenceUrl,
  };
}
