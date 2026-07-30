import type { ParsedTicketPlatformEvent, TicketPlatformScopeConfig, TicketPlatformScopeStats } from './types';

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
  'uptempo',
  'electronic',
  'rave',
  'club night',
  'open air',
  'open-air',
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
];

const DEFAULT_ALLOWED_ORGANIZERS = [
  'bootshaus',
  'affenkaefig',
  'affenkäfig',
  'rheinaudio',
  'mdma',
  'loonyland',
];

function normalize(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function containsKeyword(haystack: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

export function createEmptyScopeStats(): TicketPlatformScopeStats {
  return { discovered: 0, accepted: 0, rejected: 0, rejectionReasons: {} };
}

function recordRejection(stats: TicketPlatformScopeStats, reason: string): void {
  stats.rejected += 1;
  stats.rejectionReasons[reason] = (stats.rejectionReasons[reason] ?? 0) + 1;
}

export function isElectronicMusicEvent(
  event: ParsedTicketPlatformEvent,
  config: TicketPlatformScopeConfig = {},
): { accepted: boolean; reason?: string } {
  const searchable = [
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

  if (containsKeyword(searchable, EXCLUDED_KEYWORDS)) {
    return { accepted: false, reason: 'excluded_category' };
  }

  const allowedVenues = [...DEFAULT_ALLOWED_VENUES, ...(config.allowedVenues ?? [])].map(normalize);
  const allowedOrganizers = [...DEFAULT_ALLOWED_ORGANIZERS, ...(config.allowedOrganizers ?? [])].map(normalize);

  const venue = normalize(event.venueName);
  const organizer = normalize(event.organizerName);

  if (venue && allowedVenues.some((entry) => venue.includes(entry) || entry.includes(venue))) {
    return { accepted: true };
  }

  if (organizer && allowedOrganizers.some((entry) => organizer.includes(entry) || entry.includes(organizer))) {
    return { accepted: true };
  }

  if (containsKeyword(searchable, ELECTRONIC_GENRE_KEYWORDS)) {
    return { accepted: true };
  }

  if (config.requireElectronicSignal === false) {
    return { accepted: true };
  }

  return { accepted: false, reason: 'no_electronic_signal' };
}

export function filterElectronicMusicEvents(
  events: ParsedTicketPlatformEvent[],
  config: TicketPlatformScopeConfig = {},
): { events: ParsedTicketPlatformEvent[]; stats: TicketPlatformScopeStats } {
  const stats = createEmptyScopeStats();
  stats.discovered = events.length;
  const accepted: ParsedTicketPlatformEvent[] = [];

  for (const event of events) {
    const result = isElectronicMusicEvent(event, config);
    if (result.accepted) {
      accepted.push(event);
      stats.accepted += 1;
    } else {
      recordRejection(stats, result.reason ?? 'rejected');
    }
  }

  return { events: accepted, stats };
}
