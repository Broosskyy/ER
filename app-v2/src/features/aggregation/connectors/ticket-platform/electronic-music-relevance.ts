import type { ParsedTicketPlatformEvent, TicketPlatformScopeConfig } from './types';

export const ELECTRONIC_RELEVANCE_VALUES = ['relevant', 'irrelevant', 'uncertain'] as const;
export type ElectronicRelevance = (typeof ELECTRONIC_RELEVANCE_VALUES)[number];

const ELECTRONIC_GENRE_KEYWORDS = [
  'techno',
  'house',
  'hard techno',
  'hardstyle',
  'trance',
  'goa',
  'psytrance',
  'psy',
  'drum and bass',
  'drum & bass',
  'dnb',
  'edm',
  'electro',
  'minimal',
  'melodic techno',
  'progressive',
  'acid',
  'hardcore',
  'hardtechno',
  'uptempo',
  'electronic',
  'rave',
  'club night',
  'open air',
  'open-air',
  'gabber',
  'dubstep',
];

const WEAK_ELECTRONIC_HINTS = [
  'party',
  'night',
  'session',
  'festival',
  'club',
  'dj ',
  'live set',
  'afterparty',
  'dayrave',
];

const EXCLUDED_KEYWORDS = [
  'comedy',
  'komödie',
  'theater',
  'theatre',
  'musical',
  'sport',
  'fußball',
  'football',
  'schlager',
  'klassik',
  'classical',
  'oper',
  'opera',
  'firmenveranstaltung',
  'corporate event',
  'kinder',
  'children',
  'kabarett',
];

const DEFAULT_ALLOWED_VENUES = [
  'bootshaus',
  'affenkaefig',
  'affenkäfig',
  'essigfabrik',
  'elektroküche',
  'elektrokueche',
  'artheater',
  'berghain',
  'tresor',
  'about blank',
  'renate',
  'watergate',
  'lehmann',
  'proton',
  'schlachthof',
  'stromwerk',
];

const DEFAULT_ALLOWED_ORGANIZERS = [
  'bootshaus',
  'affenkaefig',
  'affenkäfig',
  'rheinaudio',
  'mdma',
  'loonyland',
  'techno dampfer',
  'area51',
  'hmg',
];

function normalize(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function containsKeyword(haystack: string, keywords: readonly string[]): boolean {
  const words = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));
  return keywords.some((keyword) => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (normalized.includes(' ')) {
      return haystack.includes(normalized);
    }
    return words.has(normalized);
  });
}

function buildSearchableText(event: ParsedTicketPlatformEvent): string {
  return [
    event.title,
    event.description,
    event.venueName,
    event.organizerName,
    ...(event.artistNames ?? []),
    ...(event.genreNames ?? []),
  ]
    .filter(Boolean)
    .map((value) => normalize(String(value)))
    .join(' ');
}

export function classifyElectronicMusicRelevance(
  event: ParsedTicketPlatformEvent,
  config: TicketPlatformScopeConfig = {},
): { relevance: ElectronicRelevance; reason?: string } {
  const searchable = buildSearchableText(event);

  if (containsKeyword(searchable, EXCLUDED_KEYWORDS)) {
    return { relevance: 'irrelevant', reason: 'excluded_category' };
  }

  const allowedVenues = [...DEFAULT_ALLOWED_VENUES, ...(config.allowedVenues ?? [])].map(normalize);
  const allowedOrganizers = [...DEFAULT_ALLOWED_ORGANIZERS, ...(config.allowedOrganizers ?? [])].map(normalize);
  const venue = normalize(event.venueName);
  const organizer = normalize(event.organizerName);

  if (venue && allowedVenues.some((entry) => venue.includes(entry) || entry.includes(venue))) {
    return { relevance: 'relevant', reason: 'known_venue' };
  }

  if (organizer && allowedOrganizers.some((entry) => organizer.includes(entry) || entry.includes(organizer))) {
    return { relevance: 'relevant', reason: 'known_organizer' };
  }

  if (containsKeyword(searchable, ELECTRONIC_GENRE_KEYWORDS)) {
    return { relevance: 'relevant', reason: 'electronic_genre_signal' };
  }

  if (containsKeyword(searchable, WEAK_ELECTRONIC_HINTS)) {
    return { relevance: 'uncertain', reason: 'weak_electronic_hint' };
  }

  if (config.requireElectronicSignal === false) {
    return { relevance: 'relevant', reason: 'scope_disabled' };
  }

  return { relevance: 'irrelevant', reason: 'no_electronic_signal' };
}

export function isElectronicRelevance(value: unknown): value is ElectronicRelevance {
  return typeof value === 'string' && (ELECTRONIC_RELEVANCE_VALUES as readonly string[]).includes(value);
}
