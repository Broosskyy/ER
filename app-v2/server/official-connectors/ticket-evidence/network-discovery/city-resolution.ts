import { inferCityFromGermanText, normalizeGermanCity } from './germany-geography';
import { inferCityFromText } from './event-candidate';

const VENUE_CITY_MAP: Record<string, string> = {
  bootshaus: 'Köln',
  gewölbe: 'Köln',
  gewoelbe: 'Köln',
  stadtgarten: 'Köln',
  jaki: 'Köln',
  odonien: 'Köln',
  fi: 'Köln',
  'bootshaus club': 'Köln',
};

function normalizeVenueKey(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveCityFromEvidence(input: {
  title?: string;
  description?: string;
  address?: string;
  venueName?: string;
  outboundLinks?: string[];
}): { city?: string; source?: string } {
  const fromText =
    inferCityFromGermanText(input.title, input.description, input.address, ...(input.outboundLinks ?? [])) ??
    inferCityFromText(input.title, input.description, input.address, ...(input.outboundLinks ?? []));
  if (fromText) {
    const normalized = normalizeGermanCity(fromText);
    return { city: normalized?.canonical ?? fromText, source: 'text_or_address' };
  }

  const venueKey = normalizeVenueKey(input.venueName ?? '');
  for (const [venue, city] of Object.entries(VENUE_CITY_MAP)) {
    if (venueKey === venue || venueKey.includes(venue)) {
      return { city, source: 'verified_venue_identity' };
    }
  }

  return {};
}
