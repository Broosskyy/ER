import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { buildEventIdentityFingerprint } from '@/features/aggregation/identity/event-identity';

export interface DuplicateCandidate {
  canonicalEventId: string;
  blockingKeys: string[];
  event: CanonicalImportEvent;
}

export interface DuplicateCandidateGenerator {
  generate(
    incoming: CanonicalImportEvent,
    candidates: DuplicateCandidate[],
  ): DuplicateCandidate[];
}

function eventBlockingKeys(event: CanonicalImportEvent): string[] {
  const fingerprint = buildEventIdentityFingerprint(event);
  const keys = [
    `url:${event.originalLink ?? event.eventUrl ?? ''}`,
    `url:${event.ticketUrl ?? ''}`,
    `external:${event.sourceId}:${event.externalId}`,
    `day-city:${fingerprint.dateFingerprint}:${fingerprint.normalizedLocation ?? ''}`,
    `day-venue:${fingerprint.dateFingerprint}:${fingerprint.venueFingerprint ?? ''}`,
    `title-city:${fingerprint.titleFingerprint}:${fingerprint.normalizedLocation ?? ''}`,
  ];
  return keys.filter((key) => !key.endsWith(':'));
}

export class BlockingKeyDuplicateCandidateGenerator implements DuplicateCandidateGenerator {
  generate(
    incoming: CanonicalImportEvent,
    candidates: DuplicateCandidate[],
  ): DuplicateCandidate[] {
    const incomingKeys = new Set(eventBlockingKeys(incoming));
    return candidates.filter((candidate) =>
      candidate.blockingKeys.some((key) => incomingKeys.has(key)),
    );
  }

  createCandidate(canonicalEventId: string, event: CanonicalImportEvent): DuplicateCandidate {
    return {
      canonicalEventId,
      event,
      blockingKeys: eventBlockingKeys(event),
    };
  }
}

export const blockingKeyDuplicateCandidateGenerator = new BlockingKeyDuplicateCandidateGenerator();
