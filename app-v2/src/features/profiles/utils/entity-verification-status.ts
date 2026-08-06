import type { VerificationStatus } from '@/components/profiles/view-models';
import { isInternalEntityId } from '@/features/events/discovery/internal-event-eligibility';

const OFFICIAL_IMPORTED_ID_MARKERS = [
  'bootshaus',
  'affenkaefig',
  'technodampfer',
  'lehmann',
  'proton',
  'play',
  'ticket-io',
  'source-',
] as const;

function isOfficialImportedEntityId(id: string): boolean {
  const normalized = id.toLowerCase();
  if (isInternalEntityId(id)) {
    return false;
  }

  return OFFICIAL_IMPORTED_ID_MARKERS.some((marker) => normalized.includes(marker));
}

export function resolveVenueVerificationStatus(venueId: string): VerificationStatus {
  if (isOfficialImportedEntityId(venueId)) {
    return 'official_source';
  }
  return 'profile_not_claimed';
}

export function resolveOrganizerVerificationStatus(organizerId: string): VerificationStatus {
  if (isOfficialImportedEntityId(organizerId)) {
    return 'official_source';
  }
  return 'profile_not_claimed';
}
