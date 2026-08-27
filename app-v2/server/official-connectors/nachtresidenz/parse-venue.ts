const AT_VENUE_PATTERN = /@\s*([A-Za-z0-9äöüÄÖÜß\s&.-]+)/i;

export function parseNachtresidenzVenueFromTitle(title: string): {
  name: string;
  city?: string;
  countryCode: string;
} {
  const atMatch = title.match(AT_VENUE_PATTERN);
  if (atMatch?.[1]) {
    return {
      name: atMatch[1].trim(),
      countryCode: 'DE',
    };
  }

  return {
    name: 'Nachtresidenz',
    city: 'Düsseldorf',
    countryCode: 'DE',
  };
}
