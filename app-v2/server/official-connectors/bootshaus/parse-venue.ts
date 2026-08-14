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
  const postalMatch = addressLine.match(/(\d{5})\s+(.+)$/);

  return {
    name,
    address: postalMatch ? addressLine.replace(postalMatch[0], '').replace(/,\s*$/, '') : addressLine || undefined,
    postalCode: postalMatch?.[1],
    city: postalMatch?.[2],
    countryCode: 'DE',
  };
}
