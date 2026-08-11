import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import { analyzeEventTitleCore } from '@/features/import/matching/event-title-core';
import type {
  CreateImportRecordInput,
  ImportRecord,
} from '@/features/import/models/types';
import type { ImportRecordStatus } from '@/features/import/models/statuses';

import { isConcreteEventUrl, normalizePublicUrl } from './cross-source-event-resolver';
import type { ImportDraft } from './import-draft';

export const UNIFIED_DRAFT_PAYLOAD_VERSION = 1 as const;

export type PersistedDraftDecision =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'deferred';

export interface PersistedDraftAction {
  fingerprint: string;
  type: string;
  actorId?: string;
  at: string;
  targetEventId?: string;
}

export interface PersistedDraftReviewState {
  decision: PersistedDraftDecision;
  resolution?: 'merge_into_existing' | 'create_new';
  selectedDuplicateEventId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  actionHistory: PersistedDraftAction[];
}

export interface PersistedImportDraftEnvelope {
  recordType: 'unified_import_draft';
  schemaVersion: typeof UNIFIED_DRAFT_PAYLOAD_VERSION;
  idempotencyKey: string;
  draft: ImportDraft;
  reviewState: PersistedDraftReviewState;
  urlRoles: {
    websiteUrl?: string;
    ticketUrl?: string;
    sourceUrls: string[];
  };
}

export interface ImportDraftRecordContext {
  importJobId: string;
  /** Must reference an existing sources row. */
  sourceId: string;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function localCalendarDay(value: string | undefined): string {
  return value?.trim().slice(0, 10) ?? '';
}

function normalizedVenue(draft: ImportDraft): string {
  const event = draft.proposedCanonicalEvent;
  return normalizeMatchText(event?.venueName ?? event?.locationText ?? '');
}

function concreteIdentityUrl(draft: ImportDraft): string | undefined {
  const candidates = [
    draft.proposedCanonicalEvent?.websiteUrl,
    ...draft.sources.map((source) => source.sourceUrl),
    draft.proposedCanonicalEvent?.ticketUrl,
  ];
  for (const candidate of candidates) {
    if (candidate && isConcreteEventUrl(candidate)) {
      return normalizePublicUrl(candidate);
    }
  }
  return undefined;
}

/**
 * Stable public identity only. Existing event IDs are deliberately excluded.
 * Date and venue remain part of URL/external identities so incompatible
 * occurrences cannot silently overwrite one another.
 */
export function deriveImportDraftIdempotencyKey(
  draft: ImportDraft,
  sourceId: string,
): string {
  const event = draft.proposedCanonicalEvent;
  const day = localCalendarDay(event?.startDate);
  const venue = normalizedVenue(draft);
  const titleCore = event?.title
    ? analyzeEventTitleCore(event.title, {
        venueName: event.venueName ?? event.locationText,
      }).coreTokens.join(' ')
    : '';

  if (draft.sourceExternalId?.trim()) {
    return [
      'source_external',
      sourceId,
      draft.sourceExternalId.trim(),
      day,
      venue,
    ].join('|');
  }

  const publicUrl = concreteIdentityUrl(draft);
  if (publicUrl) {
    return ['public_url', sourceId, publicUrl, day, venue].join('|');
  }

  return [
    'identity',
    sourceId,
    titleCore || normalizeMatchText(event?.title ?? ''),
    day,
    venue,
  ].join('|');
}

export function stableDraftId(idempotencyKey: string): string {
  return `draft:${stableHash(idempotencyKey)}`;
}

function recordStatusForDraft(draft: ImportDraft): ImportRecordStatus {
  const hasRealDuplicate = draft.duplicates.some(
    (duplicate) => duplicate.reason !== 'community_correction_target',
  );
  return draft.reviewTrack === 'conflict_review' && hasRealDuplicate
    ? 'duplicate'
    : 'needs_review';
}

function initialReviewState(): PersistedDraftReviewState {
  return {
    decision: 'pending',
    actionHistory: [],
  };
}

export function createImportDraftEnvelope(
  draft: ImportDraft,
  sourceId: string,
  previous?: PersistedImportDraftEnvelope,
): PersistedImportDraftEnvelope {
  const idempotencyKey = deriveImportDraftIdempotencyKey(draft, sourceId);
  const stableDraft = {
    ...draft,
    id: stableDraftId(idempotencyKey),
  };
  return {
    recordType: 'unified_import_draft',
    schemaVersion: UNIFIED_DRAFT_PAYLOAD_VERSION,
    idempotencyKey,
    draft: stableDraft,
    reviewState: previous?.reviewState ?? initialReviewState(),
    urlRoles: {
      websiteUrl: stableDraft.proposedCanonicalEvent?.websiteUrl,
      ticketUrl: stableDraft.proposedCanonicalEvent?.ticketUrl,
      sourceUrls: stableDraft.sources.map((source) => source.sourceUrl),
    },
  };
}

export function mapImportDraftToRecordInput(
  draft: ImportDraft,
  context: ImportDraftRecordContext,
  previous?: PersistedImportDraftEnvelope,
): CreateImportRecordInput {
  if (!context.importJobId.trim() || !context.sourceId.trim()) {
    throw new Error('import_draft_requires_existing_job_and_source');
  }
  const envelope = createImportDraftEnvelope(draft, context.sourceId, previous);
  const event = envelope.draft.proposedCanonicalEvent;
  const primaryDuplicate = envelope.draft.duplicates.find(
    (duplicate) => duplicate.reason !== 'community_correction_target',
  );

  return {
    importJobId: context.importJobId,
    sourceId: context.sourceId,
    externalId: envelope.idempotencyKey,
    sourceUrl: envelope.draft.sources[0]?.sourceUrl,
    sourceType: envelope.draft.submissionKind,
    originalUrl: envelope.draft.sources[0]?.sourceUrl,
    retrievedAt: envelope.draft.verifiedAt,
    rawPayload: envelope as unknown as Record<string, unknown>,
    normalizedPayload: {
      title: event?.title,
      description: event?.description,
      startDate: event?.startDate,
      endDate: event?.endDate,
      venueName: event?.venueName,
      locationText: event?.locationText,
      genreNames: envelope.draft.genres.normalizedLabels,
      artistNames: event?.lineup?.map((entry) => entry.displayName),
      ticketUrl: event?.ticketUrl,
      eventUrl: event?.websiteUrl,
      imageUrl: envelope.draft.imageUrl,
      admissionPrice: event?.admissionPrice,
      ticketStatus: event?.ticketStatus,
      reviewTrack: envelope.draft.reviewTrack,
      reviewReasons: envelope.draft.reviewReasons,
      fieldGroupConfidence: envelope.draft.fieldGroupConfidence,
      missingFields: envelope.draft.missingFields,
      verifiedAt: envelope.draft.verifiedAt,
      submissionKind: envelope.draft.submissionKind,
      idempotencyKey: envelope.idempotencyKey,
    },
    duplicateEventId: primaryDuplicate?.eventId,
    duplicateScore: primaryDuplicate?.score,
    matchingWarnings: envelope.draft.reviewReasons,
    status: recordStatusForDraft(envelope.draft),
  };
}

export function isPersistedImportDraftEnvelope(
  value: unknown,
): value is PersistedImportDraftEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistedImportDraftEnvelope>;
  return (
    candidate.recordType === 'unified_import_draft' &&
    candidate.schemaVersion === UNIFIED_DRAFT_PAYLOAD_VERSION &&
    typeof candidate.idempotencyKey === 'string' &&
    Boolean(candidate.draft) &&
    Boolean(candidate.reviewState)
  );
}

export function readImportDraftEnvelope(
  record: ImportRecord,
): PersistedImportDraftEnvelope | null {
  return isPersistedImportDraftEnvelope(record.rawPayload)
    ? record.rawPayload
    : null;
}

export function mapImportRecordToDraft(record: ImportRecord): ImportDraft | null {
  const envelope = readImportDraftEnvelope(record);
  if (!envelope) return null;
  return {
    ...envelope.draft,
    persistenceRecordId: record.id,
  };
}

export function replaceImportDraftEnvelope(
  record: ImportRecord,
  envelope: PersistedImportDraftEnvelope,
): ImportRecord {
  const event = envelope.draft.proposedCanonicalEvent;
  return {
    ...record,
    rawPayload: envelope as unknown as Record<string, unknown>,
    normalizedPayload: {
      ...(record.normalizedPayload ?? {}),
      title: event?.title,
      description: event?.description,
      startDate: event?.startDate,
      endDate: event?.endDate,
      venueName: event?.venueName,
      locationText: event?.locationText,
      genreNames: envelope.draft.genres.normalizedLabels,
      artistNames: event?.lineup?.map((entry) => entry.displayName),
      ticketUrl: event?.ticketUrl,
      eventUrl: event?.websiteUrl,
      imageUrl: envelope.draft.imageUrl,
      admissionPrice: event?.admissionPrice,
      ticketStatus: event?.ticketStatus,
      reviewTrack: envelope.draft.reviewTrack,
      reviewReasons: envelope.draft.reviewReasons,
      fieldGroupConfidence: envelope.draft.fieldGroupConfidence,
      missingFields: envelope.draft.missingFields,
      verifiedAt: envelope.draft.verifiedAt,
      submissionKind: envelope.draft.submissionKind,
      idempotencyKey: envelope.idempotencyKey,
    },
  };
}
