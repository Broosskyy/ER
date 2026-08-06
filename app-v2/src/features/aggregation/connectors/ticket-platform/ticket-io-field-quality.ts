import { isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';

const PLACEHOLDER_DESCRIPTIONS = new Set([
  'n/a',
  'na',
  'n.a.',
  'n.a',
  'none',
  'null',
  '-',
  '—',
  'tba',
  'tbd',
]);

const PLACEHOLDER_ARTISTS = new Set([
  'unbekannt',
  'unknown',
  'tba',
  'tbd',
  'n/a',
  'various',
  'various artists',
  'diverse',
]);

export function isTicketIoPlaceholderDescription(value: string | undefined): boolean {
  if (!value) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_DESCRIPTIONS.has(normalized);
}

export function isTicketIoPlaceholderArtist(value: string | undefined): boolean {
  return isLineupPlaceholderArtist(value);
}

export function sanitizeTicketIoDescription(value: string | undefined): string | undefined {
  if (!value || isTicketIoPlaceholderDescription(value)) {
    return undefined;
  }
  return value.trim();
}

export function sanitizeTicketIoArtistNames(names: string[] | undefined): string[] | undefined {
  if (!names?.length) {
    return undefined;
  }
  const cleaned = names
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && !isTicketIoPlaceholderArtist(name));
  return cleaned.length > 0 ? [...new Set(cleaned)] : undefined;
}

export function isTicketIoPowChallengePage(html: string): boolean {
  return (
    /<title>\s*Security check/i.test(html) ||
    /altcha/i.test(html) ||
    /x-waitio-location:\s*pow/i.test(html)
  );
}
