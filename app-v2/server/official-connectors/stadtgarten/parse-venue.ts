import type { ParsedVenue } from '../bootshaus/parse-venue';

const STADTGARTEN_VENUE_ADDRESS = {
  name: 'Stadtgarten',
  address: 'Venloer Str. 40',
  postalCode: '50672',
  city: 'Köln',
  countryCode: 'DE',
} as const;

export function parseStadtgartenVenueFromRoom(roomLabel: string | undefined): ParsedVenue {
  const room = roomLabel?.trim();
  if (!room) {
    return { ...STADTGARTEN_VENUE_ADDRESS };
  }
  return {
    ...STADTGARTEN_VENUE_ADDRESS,
    name: `Stadtgarten — ${room}`,
  };
}
