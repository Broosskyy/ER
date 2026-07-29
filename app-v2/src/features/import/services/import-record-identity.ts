import { createHash } from 'node:crypto';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';

export function buildSourceExternalIdentity(sourceId: string, externalId: string): string {
  return `${sourceId}::${externalId.trim()}`;
}

export interface SourceRecordKeyInput {
  sourceId: string;
  title?: string;
  startDate?: string;
  venueName?: string;
  cityName?: string;
  eventUrl?: string;
  sourceUrl?: string;
}

export function buildFallbackSourceRecordKey(input: SourceRecordKeyInput): string {
  const title = normalizeMatchText(input.title ?? '');
  const startDate = (input.startDate ?? '').trim();
  const venue = normalizeMatchText(input.venueName ?? '');
  const city = normalizeMatchText(input.cityName ?? '');
  const url = (input.eventUrl ?? input.sourceUrl ?? '').trim().toLowerCase();
  const payload = [input.sourceId, title, startDate, venue, city, url].join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function resolveImportExternalId(
  externalId: string,
  candidate: Pick<
    CanonicalImportEvent,
    'title' | 'startDate' | 'venueName' | 'cityName' | 'eventUrl' | 'originalLink' | 'sourceUrl'
  >,
  sourceId: string,
): string {
  const trimmed = externalId?.trim();
  if (trimmed) {
    return trimmed;
  }
  return `fallback:${buildFallbackSourceRecordKey({
    sourceId,
    title: candidate.title,
    startDate: candidate.startDate,
    venueName: candidate.venueName,
    cityName: candidate.cityName,
    eventUrl: candidate.eventUrl ?? candidate.originalLink,
    sourceUrl: candidate.sourceUrl,
  })}`;
}

export function candidatesEquivalent(
  left: CanonicalImportEvent,
  right: CanonicalImportEvent,
): boolean {
  return (
    normalizeMatchText(left.title) === normalizeMatchText(right.title) &&
    (left.startDate ?? '') === (right.startDate ?? '') &&
    normalizeMatchText(left.venueName ?? '') === normalizeMatchText(right.venueName ?? '') &&
    normalizeMatchText(left.cityName ?? '') === normalizeMatchText(right.cityName ?? '') &&
    (left.eventUrl ?? left.originalLink ?? '') === (right.eventUrl ?? right.originalLink ?? '')
  );
}

export function recordCandidateEquivalent(record: ImportRecord, candidate: CanonicalImportEvent): boolean {
  const existing = getEffectiveCandidate(record);
  return candidatesEquivalent(
    {
      title: existing.title ?? '',
      startDate: existing.startDate,
      venueName: existing.venueName,
      cityName: existing.cityName,
      eventUrl: existing.eventUrl ?? existing.originalLink,
      originalLink: existing.originalLink,
      sourceUrl: existing.sourceUrl,
    } as CanonicalImportEvent,
    candidate,
  );
}
