import type { VenueRecord } from '@/data/types/records';
import { diagnoseVenueConsistency } from '@/features/import/controlled-identity-corrections/venue-consistency';
import { tokenSimilarity } from '@/features/import/matching/matching-utils';

/** Minimum token overlap to treat a linked venue entity as the same place as the event venue label. */
export const EVENT_VENUE_IDENTITY_MATCH_THRESHOLD = 70;

export type EventVenueIdentityReason =
  | 'no_linked_venue'
  | 'identity_match'
  | 'identity_mismatch'
  | 'organizer_as_venue';

export interface EventVenueIdentityEvaluation {
  linkedVenueTrusted: boolean;
  reason: EventVenueIdentityReason;
  /** Inline address on the event row is inconsistent with the canonical venue label. */
  staleInlineAddress: boolean;
  similarityScore: number;
}

function normalizeOrganizerName(name?: string | null): string {
  return name?.trim().toLowerCase() ?? '';
}

export function eventVenueNamesMatch(canonicalVenueName: string, linkedVenueName: string): boolean {
  return tokenSimilarity(canonicalVenueName, linkedVenueName) >= EVENT_VENUE_IDENTITY_MATCH_THRESHOLD;
}

export function isStaleInlineVenueAddress(
  canonicalVenueName: string,
  inlineAddress?: string | null,
  linkedVenueName?: string | null,
): boolean {
  const address = inlineAddress?.trim();
  if (!address) {
    return false;
  }

  const nameNorm = canonicalVenueName.trim().toLowerCase();
  const addressNorm = address.toLowerCase();
  const linkedNorm = linkedVenueName?.trim().toLowerCase() ?? '';

  if (nameNorm.includes('moxy') && addressNorm.includes('auenweg')) {
    return true;
  }

  if (nameNorm.includes('moxy') && linkedNorm.includes('bootshaus')) {
    return true;
  }

  const consistency = diagnoseVenueConsistency({
    venueName: canonicalVenueName,
    venueAddress: address,
  });
  if (!consistency.consistent) {
    return true;
  }

  if (linkedVenueName && !eventVenueNamesMatch(canonicalVenueName, linkedVenueName)) {
    const addressToLinked = tokenSimilarity(address, linkedVenueName);
    if (addressToLinked >= 50) {
      return true;
    }
  }

  return false;
}

export function isOrganizerPresentedAsVenue(
  canonicalVenueName: string,
  organizerName?: string | null,
  linkedVenueName?: string | null,
): boolean {
  const organizer = normalizeOrganizerName(organizerName);
  const venue = canonicalVenueName.trim().toLowerCase();
  if (!organizer || !venue || organizer !== venue) {
    return false;
  }
  if (venue.includes('club')) {
    return false;
  }
  if (linkedVenueName && eventVenueNamesMatch(canonicalVenueName, linkedVenueName)) {
    return false;
  }
  return true;
}

export function evaluateEventVenueIdentity(input: {
  canonicalVenueName: string;
  linkedVenue?: Pick<VenueRecord, 'name'> | null;
  inlineAddress?: string | null;
  organizerName?: string | null;
}): EventVenueIdentityEvaluation {
  const canonicalVenueName = input.canonicalVenueName.trim();
  const linkedVenueName = input.linkedVenue?.name?.trim();

  if (isOrganizerPresentedAsVenue(canonicalVenueName, input.organizerName, linkedVenueName)) {
    return {
      linkedVenueTrusted: false,
      reason: 'organizer_as_venue',
      staleInlineAddress: isStaleInlineVenueAddress(
        canonicalVenueName,
        input.inlineAddress,
        linkedVenueName,
      ),
      similarityScore: 0,
    };
  }

  if (!linkedVenueName) {
    return {
      linkedVenueTrusted: false,
      reason: 'no_linked_venue',
      staleInlineAddress: isStaleInlineVenueAddress(canonicalVenueName, input.inlineAddress),
      similarityScore: 0,
    };
  }

  const similarityScore = tokenSimilarity(canonicalVenueName, linkedVenueName);
  const linkedVenueTrusted = similarityScore >= EVENT_VENUE_IDENTITY_MATCH_THRESHOLD;

  return {
    linkedVenueTrusted,
    reason: linkedVenueTrusted ? 'identity_match' : 'identity_mismatch',
    staleInlineAddress: isStaleInlineVenueAddress(
      canonicalVenueName,
      input.inlineAddress,
      linkedVenueName,
    ),
    similarityScore,
  };
}

export function resolveTrustedLinkedVenue(
  evaluation: EventVenueIdentityEvaluation,
  linkedVenue?: VenueRecord | null,
): VenueRecord | null {
  return evaluation.linkedVenueTrusted ? linkedVenue ?? null : null;
}
