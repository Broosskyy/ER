export const ELECTRONIC_RELEVANCE_VALUES = ['relevant', 'irrelevant', 'uncertain'] as const;
export type ElectronicRelevance = (typeof ELECTRONIC_RELEVANCE_VALUES)[number];

export interface ElectronicMusicRelevanceInput {
  title?: string;
  description?: string;
  venueName?: string;
  organizerName?: string;
  artistNames?: string[];
  genreNames?: string[];
  tags?: string[];
}

export interface ElectronicMusicRelevanceConfig {
  allowedVenues?: string[];
  allowedOrganizers?: string[];
  requireElectronicSignal?: boolean;
}

const ELECTRONIC_KEYWORDS = [
  'techno', 'house', 'hard techno', 'hardstyle', 'trance', 'goa', 'psytrance', 'psy',
  'drum and bass', 'drum & bass', 'dnb', 'edm', 'electro', 'minimal', 'melodic techno',
  'progressive', 'acid', 'hardcore', 'hardtechno', 'uptempo', 'electronic', 'rave',
  'club night', 'open air', 'open-air', 'gabber', 'dubstep',
];
const WEAK_HINTS = ['party', 'night', 'session', 'festival', 'club', 'dj ', 'live set', 'afterparty', 'dayrave'];
const EXCLUDED_KEYWORDS = ['comedy', 'komödie', 'theater', 'theatre', 'musical', 'sport', 'fußball', 'football', 'schlager', 'klassik', 'classical', 'oper', 'opera', 'firmenveranstaltung', 'corporate event', 'kinder', 'children', 'kabarett'];
const KNOWN_ELECTRONIC_VENUES = ['bootshaus', 'affenkaefig', 'affenkäfig', 'essigfabrik', 'elektroküche', 'elektrokueche', 'artheater', 'berghain', 'tresor', 'about blank', 'renate', 'watergate', 'lehmann', 'proton', 'schlachthof', 'stromwerk'];
const KNOWN_ELECTRONIC_ORGANIZERS = ['bootshaus', 'affenkaefig', 'affenkäfig', 'rheinaudio', 'mdma', 'loonyland', 'techno dampfer', 'area51', 'hmg'];

function normalize(value: string | undefined): string {
  return (value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function containsKeyword(haystack: string, keywords: readonly string[]): boolean {
  const words = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));
  return keywords.some((keyword) => {
    const normalized = normalize(keyword);
    return normalized.includes(' ') ? haystack.includes(normalized) : words.has(normalized);
  });
}

function isKnownEntity(value: string | undefined, knownValues: string[]): boolean {
  const normalized = normalize(value);
  return Boolean(normalized) && knownValues.some((known) => normalized.includes(known) || known.includes(normalized));
}

export function classifyElectronicMusicRelevance(
  event: ElectronicMusicRelevanceInput,
  config: ElectronicMusicRelevanceConfig = {},
): { relevance: ElectronicRelevance; reason?: string } {
  const searchable = [
    event.title, event.description, event.venueName, event.organizerName,
    ...(event.artistNames ?? []), ...(event.genreNames ?? []), ...(event.tags ?? []),
  ].filter(Boolean).map((value) => normalize(String(value))).join(' ');

  if (containsKeyword(searchable, EXCLUDED_KEYWORDS)) return { relevance: 'irrelevant', reason: 'excluded_category' };
  if (isKnownEntity(event.venueName, [...KNOWN_ELECTRONIC_VENUES, ...(config.allowedVenues ?? [])].map(normalize))) return { relevance: 'relevant', reason: 'known_venue' };
  if (isKnownEntity(event.organizerName, [...KNOWN_ELECTRONIC_ORGANIZERS, ...(config.allowedOrganizers ?? [])].map(normalize))) return { relevance: 'relevant', reason: 'known_organizer' };
  if (containsKeyword(searchable, ELECTRONIC_KEYWORDS)) return { relevance: 'relevant', reason: 'electronic_genre_signal' };
  if (config.requireElectronicSignal === false) return { relevance: 'relevant', reason: 'scope_disabled' };
  if (containsKeyword(searchable, WEAK_HINTS)) return { relevance: 'uncertain', reason: 'weak_electronic_hint' };
  return { relevance: 'irrelevant', reason: 'no_electronic_signal' };
}

export function isElectronicRelevance(value: unknown): value is ElectronicRelevance {
  return typeof value === 'string' && (ELECTRONIC_RELEVANCE_VALUES as readonly string[]).includes(value);
}
