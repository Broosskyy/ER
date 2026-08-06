import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import type { ImportRecord, ReviewerEdits } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import { matchingConfig } from '@/features/import/matching/matching-config';
import {
  isEnrichmentPublishBehavior,
  resolveSourcePublishBehavior,
} from '@/features/import/domain/publish-behavior';

export function getEffectiveCandidate(record: ImportRecord): NormalizedEventCandidate {
  const base = (record.normalizedPayload ?? {}) as Partial<NormalizedEventCandidate>;
  const edits = record.reviewerEdits ?? {};
  return {
    externalId: record.externalId,
    sourceUrl: record.sourceUrl ?? base.sourceUrl,
    title: edits.title ?? base.title ?? '',
    description: edits.description ?? base.description,
    startDate: edits.startDate ?? base.startDate ?? '',
    endDate: edits.endDate ?? base.endDate,
    timezone: edits.timezone ?? base.timezone,
    venueName: edits.venueName ?? base.venueName,
    venueAddress: edits.venueAddress ?? base.venueAddress,
    cityName: edits.cityName ?? base.cityName,
    countryCode: base.countryCode,
    latitude: edits.latitude ?? base.latitude,
    longitude: edits.longitude ?? base.longitude,
    artistNames: edits.artistNames ?? base.artistNames,
    genreNames: edits.genreNames ?? base.genreNames,
    ticketUrl: edits.ticketUrl ?? base.ticketUrl,
    eventUrl: edits.eventUrl ?? base.eventUrl,
    imageUrl: edits.imageUrl ?? base.imageUrl,
    priceAmount: base.priceAmount,
    priceCurrency: base.priceCurrency,
    priceText: base.priceText,
    subtitle: edits.subtitle ?? base.subtitle,
    originalLink: base.originalLink,
    sourceId: base.sourceId,
    sourceName: base.sourceName,
    minimumAge: edits.minimumAge ?? base.minimumAge,
    doorsOpenAt: base.doorsOpenAt,
    organizerName: edits.organizerName ?? base.organizerName,
    rawSourceType: base.rawSourceType ?? 'unknown',
    sourceMetadata: base.sourceMetadata,
  };
}

export function mergeReviewerEdits(
  record: ImportRecord,
  edits: ReviewerEdits,
): ReviewerEdits {
  return {
    ...(record.reviewerEdits ?? {}),
    ...edits,
  };
}

export function isReviewableStatus(status: ImportRecord['status']): boolean {
  return status === 'needs_review' || status === 'invalid';
}

export function isEnrichmentDuplicateApproval(
  record: ImportRecord,
  source?: Pick<SourceRecord, 'sourceType' | 'publishMode' | 'sourceConfig' | 'sourceRoles' | 'category'>,
): boolean {
  if (!source) {
    return false;
  }
  return (
    isEnrichmentPublishBehavior(resolveSourcePublishBehavior(source)) &&
    Boolean(record.duplicateEventId)
  );
}

/** @deprecated Use isEnrichmentDuplicateApproval with full source record. */
export function isTicketPlatformEnrichmentApproval(record: ImportRecord, sourceType?: string): boolean {
  if (sourceType !== 'ticket_platform') {
    return false;
  }
  return Boolean(record.duplicateEventId);
}

export function canApproveRecord(
  record: ImportRecord,
  options?: { allowMatchedDuplicate?: boolean },
): boolean {
  if (record.status === 'rejected' || record.status === 'imported' || record.status === 'duplicate') {
    return false;
  }
  if (
    !options?.allowMatchedDuplicate &&
    record.duplicateScore !== undefined &&
    record.duplicateScore >= matchingConfig.duplicateThreshold &&
    record.duplicateDecision !== 'dismissed'
  ) {
    return false;
  }
  return isReviewableStatus(record.status) || record.status === 'approved';
}

export function shortId(id: string, length = 8): string {
  return id.length <= length ? id : `${id.slice(0, length)}…`;
}

export function formatJobDuration(startedAt?: string, finishedAt?: string): string {
  if (!startedAt || !finishedAt) return '—';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}
