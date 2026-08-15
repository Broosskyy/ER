import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalActKey } from './lineup-normalization';
import { normalizeOfficialGenreLabel } from './normalize-genre';

export type ArtistIdentityStatus =
  | 'corroborated'
  | 'ambiguous'
  | 'name_only'
  | 'unresolved';

export type GenreProjectionDecision = 'published' | 'rejected';

export interface ArtistCorroborationRecord {
  artistName: string;
  identityKey: string;
  identityStatus: ArtistIdentityStatus;
  musicBrainzId?: string;
  discogsId?: string;
  corroboratingSource?: 'musicbrainz+discogs';
  identitySignals: string[];
  rawGenreLabels: {
    musicbrainz: string[];
    discogs: string[];
  };
  normalizedGenres: Array<{ genreKey: string; displayName: string }>;
  projectionDecision: GenreProjectionDecision;
  rejectionReason?: string;
}

export interface ArtistGenreCorroborationReport {
  genreMetadataPassPerformed: boolean;
  genreEvidenceProviders: string[];
  corroborationPassPerformed: boolean;
  artistsQueried: number;
  artistIdentitiesResolved: number;
  artistIdentitiesCorroborated: number;
  eventsEnrichedFromArtistMetadata: number;
  genreCoverageBefore: number;
  genreCoverageAfter: number;
  remainingGenreEmptyEvents: string[];
  providerStatus: 'musicbrainz+discogs' | 'GENRE_EVIDENCE_PROVIDER_MISSING';
  derivedGenresByEvent: Record<string, Array<{ genreKey: string; displayName: string }>>;
  identityRecords: ArtistCorroborationRecord[];
  artistIdentityResolvedByNameOnly: number;
  artistGenreSingleSourcePublished: number;
  singleMinorActGenreOvergeneralized: number;
  artistGenreConsensusNotMet: number;
  ambiguousArtistGenrePublished: number;
}

const USER_AGENT = 'EternalRave/0.2.0 (bootshaus-m5.3-corroboration; contact@eternal-rave.local)';
const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const DISCOGS_BASE_URL = 'https://api.discogs.com';
const CACHE_DIR = '.tmp/m5-3-artist-corroboration-cache';
const CACHE_FILE = join(CACHE_DIR, 'artist-corroboration.json');
const FETCH_TIMEOUT_MS = 15_000;
const MAX_JSON_BYTES = 512_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function cacheKey(artistName: string): string {
  return createHash('sha256').update(canonicalActKey(artistName)).digest('hex');
}

function loadCache(): Map<string, ArtistCorroborationRecord> {
  if (!existsSync(CACHE_FILE)) {
    return new Map();
  }
  try {
    const payload = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as {
      records?: ArtistCorroborationRecord[];
    };
    return new Map((payload.records ?? []).map((record) => [record.identityKey, record]));
  } catch {
    return new Map();
  }
}

function saveCache(records: Map<string, ArtistCorroborationRecord>): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(
    CACHE_FILE,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), records: [...records.values()] }, null, 2)}\n`,
  );
}

async function safeFetchJson<T>(url: string): Promise<T | undefined> {
  if (!url.startsWith('https://')) {
    return undefined;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) {
      return undefined;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return undefined;
    }
    const text = await response.text();
    if (text.length > MAX_JSON_BYTES) {
      return undefined;
    }
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

interface MusicBrainzArtistMatch {
  id: string;
  name: string;
  score?: number;
  country?: string;
  disambiguation?: string;
}

async function searchMusicBrainzArtists(artistName: string): Promise<MusicBrainzArtistMatch[]> {
  const url = `${MUSICBRAINZ_BASE_URL}/artist?query=${encodeURIComponent(`artist:"${artistName}"`)}&fmt=json&limit=5`;
  const payload = await safeFetchJson<{ artists?: MusicBrainzArtistMatch[] }>(url);
  return payload?.artists ?? [];
}

async function loadMusicBrainzArtistTags(artistId: string): Promise<string[]> {
  const url = `${MUSICBRAINZ_BASE_URL}/artist/${artistId}?inc=tags&fmt=json`;
  const payload = await safeFetchJson<{ tags?: Array<{ name: string; count?: number }> }>(url);
  return (payload?.tags ?? [])
    .filter((tag) => (tag.count ?? 0) >= 1)
    .sort((left, right) => (right.count ?? 0) - (left.count ?? 0))
    .map((tag) => tag.name)
    .slice(0, 8);
}

interface DiscogsSearchResult {
  id: number;
  title: string;
  type?: string;
}

async function searchDiscogsArtist(artistName: string): Promise<DiscogsSearchResult | undefined> {
  const url = `${DISCOGS_BASE_URL}/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=5`;
  const payload = await safeFetchJson<{ results?: DiscogsSearchResult[] }>(url);
  const exact = payload?.results?.find(
    (result) => result.title.toLowerCase() === artistName.toLowerCase(),
  );
  return exact ?? payload?.results?.[0];
}

async function loadDiscogsArtistGenres(artistId: number): Promise<string[]> {
  const url = `${DISCOGS_BASE_URL}/artists/${artistId}`;
  const payload = await safeFetchJson<{
    name?: string;
    profile?: string;
    members?: unknown[];
  }>(url);
  if (!payload) {
    return [];
  }
  const labels: string[] = [];
  const profile = payload.profile ?? '';
  for (const match of profile.matchAll(/\b(?:techno|house|trance|hardstyle|hard techno|hip hop|hip-hop|edm|electro|drum and bass|dubstep)\b/gi)) {
    labels.push(match[0]);
  }
  return labels;
}

function normalizeGenreLabels(labels: string[]): Array<{ genreKey: string; displayName: string }> {
  const seen = new Set<string>();
  const normalized: Array<{ genreKey: string; displayName: string }> = [];
  for (const label of labels) {
    const entry = normalizeOfficialGenreLabel(label);
    if (entry.status !== 'normalized' || seen.has(entry.genreKey)) {
      continue;
    }
    seen.add(entry.genreKey);
    normalized.push({ genreKey: entry.genreKey, displayName: entry.displayName });
  }
  return normalized;
}

function intersectGenres(
  left: Array<{ genreKey: string; displayName: string }>,
  right: Array<{ genreKey: string; displayName: string }>,
): Array<{ genreKey: string; displayName: string }> {
  const rightKeys = new Set(right.map((genre) => genre.genreKey));
  return left.filter((genre) => rightKeys.has(genre.genreKey));
}

function isAmbiguousName(artistName: string, mbMatches: MusicBrainzArtistMatch[]): boolean {
  const key = canonicalActKey(artistName);
  const words = key.split(/\s+/);
  if (words.length >= 3 && mbMatches.length > 1) {
    return true;
  }
  const exactMatches = mbMatches.filter(
    (match) => match.name.toLowerCase() === artistName.toLowerCase(),
  );
  if (exactMatches.length > 1) {
    return true;
  }
  const highScoreMatches = mbMatches.filter((match) => (match.score ?? 0) >= 90);
  if (highScoreMatches.length > 1 && !exactMatches.length) {
    return true;
  }
  if (/\b(?:clark|future|angel|hero|star|love|peace)\b/.test(key) && mbMatches.length > 1) {
    return true;
  }
  return false;
}

async function resolveArtistIdentity(
  artistName: string,
  cache: Map<string, ArtistCorroborationRecord>,
): Promise<ArtistCorroborationRecord> {
  const identityKey = canonicalActKey(artistName);
  const cached = cache.get(identityKey);
  if (cached) {
    return cached;
  }

  const mbMatches = await searchMusicBrainzArtists(artistName);
  await sleep(1100);

  if (mbMatches.length === 0) {
    const unresolved: ArtistCorroborationRecord = {
      artistName,
      identityKey,
      identityStatus: 'unresolved',
      identitySignals: [],
      rawGenreLabels: { musicbrainz: [], discogs: [] },
      normalizedGenres: [],
      projectionDecision: 'rejected',
      rejectionReason: 'artist_identity_unresolved',
    };
    cache.set(identityKey, unresolved);
    return unresolved;
  }

  if (isAmbiguousName(artistName, mbMatches)) {
    const ambiguous: ArtistCorroborationRecord = {
      artistName,
      identityKey,
      identityStatus: 'ambiguous',
      musicBrainzId: mbMatches[0]?.id,
      identitySignals: ['multiple_musicbrainz_candidates'],
      rawGenreLabels: { musicbrainz: [], discogs: [] },
      normalizedGenres: [],
      projectionDecision: 'rejected',
      rejectionReason: 'artist_identity_ambiguous',
    };
    cache.set(identityKey, ambiguous);
    return ambiguous;
  }

  const mbMatch =
    mbMatches.find((match) => match.name.toLowerCase() === artistName.toLowerCase()) ??
    ((mbMatches[0]?.score ?? 0) >= 95 ? mbMatches[0] : undefined);

  if (!mbMatch) {
    const nameOnly: ArtistCorroborationRecord = {
      artistName,
      identityKey,
      identityStatus: 'name_only',
      identitySignals: ['musicbrainz_low_confidence'],
      rawGenreLabels: { musicbrainz: [], discogs: [] },
      normalizedGenres: [],
      projectionDecision: 'rejected',
      rejectionReason: 'artist_identity_name_only',
    };
    cache.set(identityKey, nameOnly);
    return nameOnly;
  }

  const discogsMatch = await searchDiscogsArtist(artistName);
  await sleep(1100);

  if (!discogsMatch || discogsMatch.title.toLowerCase() !== artistName.toLowerCase()) {
    const nameOnly: ArtistCorroborationRecord = {
      artistName,
      identityKey,
      identityStatus: 'name_only',
      musicBrainzId: mbMatch.id,
      identitySignals: ['musicbrainz_without_discogs_match'],
      rawGenreLabels: { musicbrainz: [], discogs: [] },
      normalizedGenres: [],
      projectionDecision: 'rejected',
      rejectionReason: 'artist_identity_name_only',
    };
    cache.set(identityKey, nameOnly);
    return nameOnly;
  }

  const mbTags = await loadMusicBrainzArtistTags(mbMatch.id);
  await sleep(1100);
  const discogsGenres = await loadDiscogsArtistGenres(discogsMatch.id);
  await sleep(1100);

  const mbNormalized = normalizeGenreLabels(mbTags);
  const discogsNormalized = normalizeGenreLabels(discogsGenres);
  const corroboratedGenres = intersectGenres(mbNormalized, discogsNormalized);

  const identitySignals = [
    `musicbrainz_id:${mbMatch.id}`,
    `discogs_id:${discogsMatch.id}`,
    'exact_name_match_both_sources',
  ];
  if (mbMatch.country) {
    identitySignals.push(`musicbrainz_country:${mbMatch.country}`);
  }

  const record: ArtistCorroborationRecord = {
    artistName,
    identityKey,
    identityStatus: 'corroborated',
    musicBrainzId: mbMatch.id,
    discogsId: String(discogsMatch.id),
    corroboratingSource: 'musicbrainz+discogs',
    identitySignals,
    rawGenreLabels: { musicbrainz: mbTags, discogs: discogsGenres },
    normalizedGenres: corroboratedGenres,
    projectionDecision: corroboratedGenres.length > 0 ? 'published' : 'rejected',
    rejectionReason:
      corroboratedGenres.length > 0 ? undefined : 'genre_sources_disagree_or_empty',
  };
  cache.set(identityKey, record);
  return record;
}

export function projectEventGenres(input: {
  sourceEventKey: string;
  lineup: string[];
  officialGenres: string[];
  identities: Map<string, ArtistCorroborationRecord>;
}): {
  genres: Array<{ genreKey: string; displayName: string }>;
  rejectionReasons: string[];
} {
  if (input.officialGenres.length > 0) {
    return {
      genres: normalizeGenreLabels(input.officialGenres),
      rejectionReasons: [],
    };
  }

  if (input.lineup.length === 0) {
    return { genres: [], rejectionReasons: [] };
  }

  const lineupIdentities = input.lineup.map(
    (act) => input.identities.get(canonicalActKey(act)) ?? input.identities.get(act),
  );
  const corroborated = lineupIdentities.filter(
    (identity): identity is ArtistCorroborationRecord =>
      Boolean(identity && identity.identityStatus === 'corroborated'),
  );

  if (input.lineup.length === 1) {
    const single = corroborated[0];
    if (!single || single.projectionDecision !== 'published') {
      return {
        genres: [],
        rejectionReasons: [single?.rejectionReason ?? 'single_artist_not_corroborated'],
      };
    }
    return { genres: single.normalizedGenres.slice(0, 3), rejectionReasons: [] };
  }

  const genreVotes = new Map<string, { genreKey: string; displayName: string; votes: number }>();
  for (const identity of corroborated) {
    if (identity.projectionDecision !== 'published') {
      continue;
    }
    for (const genre of identity.normalizedGenres) {
      const current = genreVotes.get(genre.genreKey);
      if (current) {
        current.votes += 1;
      } else {
        genreVotes.set(genre.genreKey, { ...genre, votes: 1 });
      }
    }
  }

  const threshold = Math.max(2, Math.ceil(corroborated.length * 0.5));
  const consensusGenres = [...genreVotes.values()]
    .filter((entry) => entry.votes >= threshold)
    .sort((left, right) => right.votes - left.votes)
    .slice(0, 3)
    .map((entry) => ({ genreKey: entry.genreKey, displayName: entry.displayName }));

  if (consensusGenres.length === 0) {
    return { genres: [], rejectionReasons: ['artist_genre_consensus_not_met'] };
  }

  return { genres: consensusGenres, rejectionReasons: [] };
}

export async function runArtistGenreCorroborationPass(input: {
  events: Array<{
    sourceEventKey: string;
    lineup: string[];
    genres: string[];
  }>;
  enabled?: boolean;
  useCache?: boolean;
}): Promise<ArtistGenreCorroborationReport> {
  const genreCoverageBefore = input.events.filter((event) => event.genres.length > 0).length;
  const emptyCounters = {
    artistIdentityResolvedByNameOnly: 0,
    artistGenreSingleSourcePublished: 0,
    singleMinorActGenreOvergeneralized: 0,
    artistGenreConsensusNotMet: 0,
    ambiguousArtistGenrePublished: 0,
  };

  if (input.enabled === false) {
    return {
      genreMetadataPassPerformed: false,
      genreEvidenceProviders: [],
      corroborationPassPerformed: false,
      artistsQueried: 0,
      artistIdentitiesResolved: 0,
      artistIdentitiesCorroborated: 0,
      eventsEnrichedFromArtistMetadata: 0,
      genreCoverageBefore,
      genreCoverageAfter: genreCoverageBefore,
      remainingGenreEmptyEvents: input.events
        .filter((event) => event.genres.length === 0)
        .map((event) => event.sourceEventKey),
      providerStatus: 'GENRE_EVIDENCE_PROVIDER_MISSING',
      derivedGenresByEvent: {},
      identityRecords: [],
      ...emptyCounters,
    };
  }

  const cache = input.useCache === false ? new Map<string, ArtistCorroborationRecord>() : loadCache();
  const artistNames = new Set<string>();
  for (const event of input.events) {
    for (const act of event.lineup) {
      artistNames.add(act);
    }
  }

  const identityRecords: ArtistCorroborationRecord[] = [];
  for (const artistName of artistNames) {
    const record = await resolveArtistIdentity(artistName, cache);
    identityRecords.push(record);
    if (record.identityStatus === 'name_only') {
      emptyCounters.artistIdentityResolvedByNameOnly += 1;
    }
    if (record.identityStatus === 'ambiguous') {
      emptyCounters.ambiguousArtistGenrePublished += 1;
    }
  }

  if (input.useCache !== false) {
    saveCache(cache);
  }

  const identities = new Map(identityRecords.map((record) => [record.identityKey, record]));
  const derivedGenresByEvent: Record<string, Array<{ genreKey: string; displayName: string }>> = {};
  const enrichedEvents = new Set<string>();

  for (const event of input.events) {
    if (event.genres.length > 0) {
      continue;
    }
    const projection = projectEventGenres({
      sourceEventKey: event.sourceEventKey,
      lineup: event.lineup,
      officialGenres: event.genres,
      identities,
    });
    if (projection.rejectionReasons.includes('artist_genre_consensus_not_met')) {
      emptyCounters.artistGenreConsensusNotMet += 1;
    }
    if (projection.genres.length > 0) {
      derivedGenresByEvent[event.sourceEventKey] = projection.genres;
      enrichedEvents.add(event.sourceEventKey);
    }
  }

  const genreCoverageAfter =
    genreCoverageBefore +
    input.events.filter((event) => event.genres.length === 0 && enrichedEvents.has(event.sourceEventKey))
      .length;

  return {
    genreMetadataPassPerformed: true,
    genreEvidenceProviders: ['musicbrainz', 'discogs'],
    corroborationPassPerformed: true,
    artistsQueried: artistNames.size,
    artistIdentitiesResolved: identityRecords.filter((record) => record.identityStatus !== 'unresolved')
      .length,
    artistIdentitiesCorroborated: identityRecords.filter(
      (record) => record.identityStatus === 'corroborated',
    ).length,
    eventsEnrichedFromArtistMetadata: enrichedEvents.size,
    genreCoverageBefore,
    genreCoverageAfter,
    remainingGenreEmptyEvents: input.events
      .filter((event) => event.genres.length === 0 && !enrichedEvents.has(event.sourceEventKey))
      .map((event) => event.sourceEventKey),
    providerStatus: 'musicbrainz+discogs',
    derivedGenresByEvent,
    identityRecords,
    ...emptyCounters,
  };
}
