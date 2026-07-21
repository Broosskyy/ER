import type { VenueRecord } from '@/data/types/records';
import {
  normalizeVenueAddressKey,
  normalizeVenueNameForComparison,
} from '@/features/venues/domain/venue-validation';

export interface VenueDuplicateMatch {
  venue: VenueRecord;
  reason: 'name_and_address' | 'name_and_city';
}

export function findDuplicateVenue(
  input: {
    name: string;
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city: string;
    country: string;
  },
  venues: VenueRecord[],
  excludeId?: string,
): VenueDuplicateMatch | null {
  const normalizedName = normalizeVenueNameForComparison(input.name);
  const addressKey = normalizeVenueAddressKey(input);

  for (const venue of venues) {
    if (excludeId && venue.id === excludeId) {
      continue;
    }

    if (normalizeVenueAddressKey(venue) === addressKey && addressKey !== '|||') {
      return { venue, reason: 'name_and_address' };
    }

    if (
      normalizeVenueNameForComparison(venue.name) === normalizedName &&
      venue.city.trim().toLowerCase() === input.city.trim().toLowerCase() &&
      venue.country.trim().toLowerCase() === input.country.trim().toLowerCase() &&
      Boolean(input.street?.trim() || input.houseNumber?.trim() || input.postalCode?.trim())
    ) {
      return { venue, reason: 'name_and_city' };
    }
  }

  return null;
}

export function formatVenueAddressSummary(venue: Pick<VenueRecord, 'street' | 'houseNumber' | 'postalCode' | 'city' | 'country' | 'address'>): string {
  const streetLine = [venue.street, venue.houseNumber].filter(Boolean).join(' ').trim();
  const locality = [venue.postalCode, venue.city].filter(Boolean).join(' ').trim();
  const parts = [streetLine || venue.address, locality, venue.country].filter(Boolean);
  return parts.join(', ');
}

export function formatVenuePickerLabel(venue: VenueRecord): string {
  const locality = [venue.city, venue.country].filter(Boolean).join(', ');
  const street = [venue.street, venue.houseNumber].filter(Boolean).join(' ').trim();
  if (street) {
    return `${venue.name}\n${locality}\n${street}`;
  }
  return `${venue.name}\n${locality}`;
}
