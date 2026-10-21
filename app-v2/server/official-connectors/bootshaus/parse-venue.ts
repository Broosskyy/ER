export interface ParsedVenue {
  name: string;
  address?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
}

export function parseBootshausVenueBlock(rawHtml: string): ParsedVenue | undefined {
  const text = rawHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

  if (!text) {
    return undefined;
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  const name = lines[0] ?? '';
  const addressLine = lines.slice(1).join(', ');
  // Bootshaus also promotes shows outside Germany (e.g. Koepelkerk in
  // Amsterdam). The Netherlands use a four-digit postal prefix, optionally
  // followed by two letters. Never default an unrecognized foreign venue
  // to Germany merely because the promoting club is based in Cologne.
  const nlPostalMatch = addressLine.match(/(?:^|,\s*)(\d{4})(?:\s*[A-Z]{2})?\s+([\p{L}][\p{L}\s.\-]+)$/iu);
  const dePostalMatch = nlPostalMatch ? null : addressLine.match(/(\d{5})\s+(.+)$/);
  const postalMatch = nlPostalMatch ?? dePostalMatch;
  const countryCode = nlPostalMatch ? 'NL' : dePostalMatch ? 'DE' : undefined;

  return {
    name,
    address: postalMatch ? addressLine.replace(postalMatch[0], '').replace(/,\s*$/, '') : addressLine || undefined,
    postalCode: postalMatch?.[1],
    city: postalMatch?.[2]?.trim(),
    countryCode,
  };
}
