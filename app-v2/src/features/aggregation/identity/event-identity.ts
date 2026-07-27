import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

export interface SourceReference {
  sourceId: string;
  externalEventId: string;
  canonicalEventId?: string;
  originalUrl?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastChangedAt?: string;
  active: boolean;
  sourcePriority: number;
  sourceQuality?: number;
  rawRecordId?: string;
  importJobId?: string;
}

export interface EventIdentity {
  canonicalEventId: string;
  sourceReferences: SourceReference[];
  externalIds: string[];
  canonicalFingerprint: string;
  titleFingerprint: string;
  venueFingerprint?: string;
  dateFingerprint: string;
  organizerFingerprint?: string;
  normalizedLocation?: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

function normalizeText(value?: string): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildEventIdentityFingerprint(event: CanonicalImportEvent): {
  canonicalFingerprint: string;
  titleFingerprint: string;
  venueFingerprint?: string;
  dateFingerprint: string;
  organizerFingerprint?: string;
  normalizedLocation?: string;
} {
  const titleFingerprint = normalizeText(event.title);
  const venueFingerprint = normalizeText(event.venueName) || undefined;
  const organizerFingerprint = normalizeText(event.organizerName) || undefined;
  const dateFingerprint = event.startDate.slice(0, 10);
  const normalizedLocation = [normalizeText(event.cityName), normalizeText(event.countryCode)]
    .filter(Boolean)
    .join(':') || undefined;

  return {
    canonicalFingerprint: [titleFingerprint, dateFingerprint, venueFingerprint ?? normalizedLocation ?? '']
      .filter(Boolean)
      .join('|'),
    titleFingerprint,
    venueFingerprint,
    dateFingerprint,
    organizerFingerprint,
    normalizedLocation,
  };
}

export function createEventIdentity(
  canonicalEventId: string,
  event: CanonicalImportEvent,
  reference: SourceReference,
): EventIdentity {
  const now = reference.firstSeenAt;
  const fingerprints = buildEventIdentityFingerprint(event);
  return {
    canonicalEventId,
    sourceReferences: [reference],
    externalIds: [`${reference.sourceId}:${reference.externalEventId}`],
    ...fingerprints,
    confidence: 0.5,
    createdAt: now,
    updatedAt: now,
  };
}

export function addSourceReference(
  identity: EventIdentity,
  reference: SourceReference,
  confidence: number,
): EventIdentity {
  const existingIndex = identity.sourceReferences.findIndex(
    (entry) =>
      entry.sourceId === reference.sourceId && entry.externalEventId === reference.externalEventId,
  );
  const sourceReferences = [...identity.sourceReferences];
  if (existingIndex >= 0) {
    sourceReferences[existingIndex] = {
      ...sourceReferences[existingIndex],
      ...reference,
      firstSeenAt: sourceReferences[existingIndex]?.firstSeenAt ?? reference.firstSeenAt,
    };
  } else {
    sourceReferences.push(reference);
  }

  return {
    ...identity,
    sourceReferences,
    externalIds: sourceReferences.map((entry) => `${entry.sourceId}:${entry.externalEventId}`),
    confidence: Math.max(identity.confidence, confidence),
    updatedAt: reference.lastSeenAt,
  };
}
