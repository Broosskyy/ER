import type { ParsedVenue } from '../bootshaus/parse-venue';

const ZAKK_VENUE = {
  name: 'zakk',
  address: 'Fichtenstr. 40',
  postalCode: '40233',
  city: 'Düsseldorf',
  countryCode: 'DE',
} as const;

export function parseZakkVenueFromRoom(roomLabel: string | undefined): ParsedVenue {
  const room = roomLabel?.trim();
  if (!room) {
    return { ...ZAKK_VENUE };
  }
  return {
    ...ZAKK_VENUE,
    name: `zakk — ${room}`,
  };
}

export function parseZakkVenueFromJsonLd(location?: {
  name?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    postalCode?: string;
    addressCountry?: string;
  };
}): ParsedVenue {
  if (!location?.name) {
    return { ...ZAKK_VENUE };
  }

  return {
    name: location.name.trim(),
    address: location.address?.streetAddress?.trim() || ZAKK_VENUE.address,
    postalCode: location.address?.postalCode?.trim() || ZAKK_VENUE.postalCode,
    city: location.address?.addressLocality?.trim() || ZAKK_VENUE.city,
    countryCode: location.address?.addressCountry?.trim() || ZAKK_VENUE.countryCode,
  };
}
