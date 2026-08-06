import { sanitizeTicketIoArtistNames } from './ticket-io-field-quality';

const TITLE_ARTIST_PATTERNS: RegExp[] = [
  /\bpresents\s+(?!by\s)(.+)$/i,
  /\bpres\.?\s+(.+)$/i,
  /\bpresented by\s+(.+)$/i,
  /\bw\/\s+(.+)$/i,
  /\bwith\s+(.+)$/i,
  /\bft\.?\s+(.+)$/i,
  /\bfeat\.?\s+(.+)$/i,
  /\bfeaturing\s+(.+)$/i,
  /\bx\s+(.+)$/i,
  /\bvs\.?\s+(.+)$/i,
  /\bb2b\s+(.+)$/i,
];

const SPLIT_SEPARATORS = /\s*(?:,|&|\+|\/|\||;)\s*/;

function splitArtistSegment(segment: string): string[] {
  return segment
    .split(SPLIT_SEPARATORS)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function cleanArtistToken(token: string): string {
  return token
    .replace(/^\(+|\)+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TITLE_INFERENCE_REJECT_PATTERNS: RegExp[] = [
  /\bweekender\b/i,
  /\bpre-party\b/i,
  /\bfestival\b/i,
  /\bclub\s+night\b/i,
  /\bedition\b/i,
  /\bbootshaus\b/i,
  /\bkitkat(?:\s*club)?\b/i,
  /\bairport\s+session\b/i,
  /\binto\s+the\s+madness\b/i,
  /\(let'?s\s+get\s+loco\)/i,
];

function isRejectedTitleInferenceToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > 80) {
    return true;
  }
  return TITLE_INFERENCE_REJECT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function extractArtistsFromEventTitle(title: string): string[] | undefined {
  const trimmed = title.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/\bpres\.?\s+by\s+/i.test(trimmed)) {
    return undefined;
  }

  const artists: string[] = [];

  for (const pattern of TITLE_ARTIST_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    for (const segment of splitArtistSegment(match[1])) {
      const cleaned = cleanArtistToken(segment);
      if (cleaned && !isRejectedTitleInferenceToken(cleaned)) {
        artists.push(cleaned);
      }
    }
  }

  if (artists.length === 0 && /\s&\s/.test(trimmed)) {
    const parts = trimmed
      .split(/\s&\s/)
      .map(cleanArtistToken)
      .filter((part) => part && !isRejectedTitleInferenceToken(part));
    if (parts.length >= 2) {
      artists.push(...parts);
    }
  }

  return sanitizeTicketIoArtistNames(artists);
}
