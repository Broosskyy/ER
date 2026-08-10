import type { AdminEventRecord } from '@/data/types/records';

import type {
  BulkRebuildDisposition,
  IdPreservationDecision,
  RebuiltCanonicalEvent,
  SourceEvidenceContribution,
} from './types';

function stableEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

export function buildChangeSet(
  existing: AdminEventRecord | undefined,
  rebuilt: RebuiltCanonicalEvent,
): Record<string, { before: unknown; after: unknown }> {
  const fields: Array<{
    key: string;
    existingKey?: keyof AdminEventRecord;
    rebuiltKey: keyof RebuiltCanonicalEvent;
  }> = [
    { key: 'title', existingKey: 'title', rebuiltKey: 'title' },
    { key: 'startDate', existingKey: 'startDate', rebuiltKey: 'startDate' },
    { key: 'endDate', existingKey: 'endDate', rebuiltKey: 'endDate' },
    { key: 'venueName', existingKey: 'venueName', rebuiltKey: 'venueName' },
    { key: 'organizerName', existingKey: 'organizerName', rebuiltKey: 'organizerName' },
    { key: 'websiteUrl', existingKey: 'websiteUrl', rebuiltKey: 'websiteUrl' },
    { key: 'ticketUrl', existingKey: 'ticketUrl', rebuiltKey: 'ticketUrl' },
    { key: 'priceText', existingKey: 'priceText', rebuiltKey: 'priceText' },
    { key: 'ticketStatus', existingKey: 'ticketStatus', rebuiltKey: 'ticketStatus' },
    { key: 'description', existingKey: 'description', rebuiltKey: 'description' },
    { key: 'genreLabels', existingKey: 'genreLabels', rebuiltKey: 'genreLabels' },
  ];

  const changeSet: Record<string, { before: unknown; after: unknown }> = {};
  for (const field of fields) {
    const before = existing && field.existingKey ? existing[field.existingKey] : undefined;
    const after = rebuilt[field.rebuiltKey];
    if (!stableEqual(before, after)) {
      changeSet[field.key] = { before, after };
    }
  }
  return changeSet;
}

export interface PublishCoreAssessment {
  secure: boolean;
  missingOptional: string[];
  fieldGroupReadiness: RebuiltCanonicalEvent['fieldGroupReadiness'];
}

export function assessPublishCore(
  rebuilt: RebuiltCanonicalEvent,
  contributions: SourceEvidenceContribution[],
): PublishCoreAssessment {
  const missingOptional: string[] = [];
  const fieldGroupReadiness: RebuiltCanonicalEvent['fieldGroupReadiness'] = {};

  const hasNativeIdentity = contributions.some(
    (entry) => entry.bundle.sourceNativeEvidence && !entry.bundle.criticalIdentitySelfDerived,
  );
  const hasVerifiedAt = Boolean(rebuilt.verifiedAt);
  const hasTitle = Boolean(rebuilt.title?.trim());
  const hasStartDate = Boolean(rebuilt.startDate);
  const hasVenueOrCity = Boolean(rebuilt.venueName?.trim() || rebuilt.cityName?.trim() || rebuilt.venueCity?.trim());
  const hasSourceRelationship = contributions.length > 0;

  fieldGroupReadiness.identity = {
    ready: hasNativeIdentity && hasTitle && hasStartDate && hasVenueOrCity && hasVerifiedAt,
  };
  fieldGroupReadiness.content = {
    ready: Boolean(rebuilt.description),
    missing: !rebuilt.description,
  };
  fieldGroupReadiness.genres = {
    ready: (rebuilt.genreLabels?.length ?? 0) > 0,
    missing: (rebuilt.genreLabels?.length ?? 0) === 0,
  };
  fieldGroupReadiness.lineup = {
    ready: (rebuilt.lineupArtistNames?.length ?? 0) > 0,
    missing: (rebuilt.lineupArtistNames?.length ?? 0) === 0,
  };
  fieldGroupReadiness.tickets = {
    ready: Boolean(rebuilt.ticketUrl || rebuilt.priceText),
    missing: !rebuilt.ticketUrl && !rebuilt.priceText,
  };

  if (!rebuilt.description) missingOptional.push('description');
  if ((rebuilt.genreLabels?.length ?? 0) === 0) missingOptional.push('genres');
  if ((rebuilt.lineupArtistNames?.length ?? 0) === 0) missingOptional.push('lineup');
  if (!rebuilt.priceText) missingOptional.push('priceText');
  if (!rebuilt.ticketPhases?.length) missingOptional.push('ticketPhases');
  if (!rebuilt.ageRestriction) missingOptional.push('ageRestriction');
  if (!rebuilt.endDate) missingOptional.push('endDate');
  if (!rebuilt.imageUrl) missingOptional.push('imageUrl');

  const secure =
    hasNativeIdentity &&
    hasTitle &&
    hasStartDate &&
    hasVenueOrCity &&
    hasSourceRelationship &&
    hasVerifiedAt;

  return { secure, missingOptional, fieldGroupReadiness };
}

export function classifyDisposition(input: {
  existing?: AdminEventRecord;
  rebuilt: RebuiltCanonicalEvent;
  changeSet: Record<string, { before: unknown; after: unknown }>;
  hasCollision: boolean;
  hasContamination: boolean;
  publishCore: PublishCoreAssessment;
  identityVerdicts: string[];
  manualLocks: string[];
  hasContributions: boolean;
}): BulkRebuildDisposition {
  if (input.hasContamination) {
    return 'blocked_contamination';
  }
  if (input.hasCollision) {
    return 'review_collision';
  }
  if (!input.hasContributions) {
    return 'review_core_missing';
  }
  if (!input.publishCore.secure) {
    return 'review_core_missing';
  }
  if (
    input.identityVerdicts.some(
      (verdict) => verdict === 'mismatch' || verdict === 'unverifiable' || verdict === 'partial_review_only',
    )
  ) {
    return 'review_identity';
  }

  const hasOptionalMissing = input.publishCore.missingOptional.length > 0;
  const partialReady = hasOptionalMissing;

  if (!input.existing) {
    return partialReady ? 'ready_partial' : 'ready_new';
  }

  const now = new Date().toISOString();
  if (
    input.existing.endDate &&
    input.existing.endDate < now &&
    Object.keys(input.changeSet).length === 0
  ) {
    return 'archive_stale';
  }

  if (Object.keys(input.changeSet).length === 0) {
    return partialReady ? 'ready_partial' : 'ready_unchanged';
  }

  const lockedOnly = Object.keys(input.changeSet).every((field) =>
    input.manualLocks.includes(field),
  );
  if (lockedOnly) {
    return partialReady ? 'ready_partial' : 'ready_unchanged';
  }

  return partialReady ? 'ready_partial' : 'ready_update';
}

export function resolveIdPreservation(input: {
  existing?: AdminEventRecord;
  hasCollision: boolean;
  identityVerdicts: string[];
  duplicateClusterIds?: string[];
  publishCoreSecure: boolean;
}): IdPreservationDecision {
  if (input.hasCollision || (input.duplicateClusterIds?.length ?? 0) > 1) {
    return 'no_safe_mapping';
  }
  if (!input.existing) {
    return 'new_event_id_required';
  }
  if (!input.publishCoreSecure) {
    return 'preserve_existing_id';
  }
  const strong = input.identityVerdicts.some(
    (verdict) => verdict === 'exact' || verdict === 'corroborated',
  );
  if (strong || input.publishCoreSecure) {
    return 'preserve_existing_id';
  }
  return 'preserve_existing_id';
}

export function hasSufficientRebuildEvidence(rebuilt: RebuiltCanonicalEvent): boolean {
  return Boolean(rebuilt.publishCoreSecure);
}

export function detectContamination(
  contributions: Array<{ bundle: { contamination?: { detected: boolean } } }>,
): boolean {
  return contributions.some((entry) => entry.bundle.contamination?.detected === true);
}
