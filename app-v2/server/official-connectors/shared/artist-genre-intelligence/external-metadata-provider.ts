import type { ArtistGenreEvidence } from './types';
import { getArtistIdentityKey, normalizeArtistDisplayName } from './artist-identity';
import { normalizeOfficialGenreLabel } from '../normalize-genre';

const USER_AGENT = 'EternalRave/0.2.0 (m9.3b.2d-artist-intelligence; contact@eternal-rave.local)';
const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const DISCOGS_BASE_URL = 'https://api.discogs.com';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_JSON_BYTES = 512_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeFetchJson<T>(url: string): Promise<T | undefined> {
  if (!url.startsWith('https://')) {
    return undefined;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
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

function labelsToEvidence(input: {
  artistName: string;
  labels: string[];
  sourceType: ArtistGenreEvidence['sourceType'];
  sourceReference: string;
  evidenceStrength: ArtistGenreEvidence['evidenceStrength'];
  confidence: ArtistGenreEvidence['confidence'];
  classificationReason: string;
}): ArtistGenreEvidence[] {
  const identity = getArtistIdentityKey(input.artistName);
  const records: ArtistGenreEvidence[] = [];
  const seen = new Set<string>();
  for (const label of input.labels) {
    const normalized = normalizeOfficialGenreLabel(label);
    if (normalized.status !== 'normalized' || seen.has(normalized.genreKey)) {
      continue;
    }
    seen.add(normalized.genreKey);
    records.push({
      artistIdentity: identity,
      normalizedName: normalizeArtistDisplayName(input.artistName),
      genreKey: normalized.genreKey,
      displayName: normalized.displayName,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference,
      evidenceStrength: input.evidenceStrength,
      confidence: input.confidence,
      observedAt: new Date().toISOString(),
      rawLabel: label,
      classificationReason: input.classificationReason,
    });
  }
  return records;
}

export async function fetchExternalArtistGenreEvidence(
  artistName: string,
): Promise<ArtistGenreEvidence[]> {
  const mbUrl = `${MUSICBRAINZ_BASE_URL}/artist?query=${encodeURIComponent(`artist:"${artistName}"`)}&fmt=json&limit=5`;
  const mbPayload = await safeFetchJson<{ artists?: Array<{ id: string; name: string; score?: number }> }>(
    mbUrl,
  );
  await sleep(1100);
  const mbMatch =
    mbPayload?.artists?.find((artist) => artist.name.toLowerCase() === artistName.toLowerCase()) ??
    mbPayload?.artists?.find((artist) => (artist.score ?? 0) >= 95);
  if (!mbMatch) {
    return [];
  }

  const mbTagsUrl = `${MUSICBRAINZ_BASE_URL}/artist/${mbMatch.id}?inc=tags&fmt=json`;
  const mbTagsPayload = await safeFetchJson<{ tags?: Array<{ name: string; count?: number }> }>(
    mbTagsUrl,
  );
  await sleep(1100);
  const mbTags = (mbTagsPayload?.tags ?? [])
    .filter((tag) => (tag.count ?? 0) >= 1)
    .sort((left, right) => (right.count ?? 0) - (left.count ?? 0))
    .map((tag) => tag.name)
    .slice(0, 8);

  const discogsSearchUrl = `${DISCOGS_BASE_URL}/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=5`;
  const discogsSearch = await safeFetchJson<{ results?: Array<{ id: number; title: string }> }>(
    discogsSearchUrl,
  );
  await sleep(1100);
  const discogsMatch =
    discogsSearch?.results?.find((result) => result.title.toLowerCase() === artistName.toLowerCase()) ??
    discogsSearch?.results?.[0];
  const discogsLabels: string[] = [];
  if (discogsMatch) {
    const discogsArtist = await safeFetchJson<{
      genres?: string[];
      styles?: string[];
      profile?: string;
    }>(`${DISCOGS_BASE_URL}/artists/${discogsMatch.id}`);
    await sleep(1100);
    discogsLabels.push(...(discogsArtist?.genres ?? []), ...(discogsArtist?.styles ?? []));
    const profile = discogsArtist?.profile ?? '';
    for (const match of profile.matchAll(
      /\b(?:techno|house|trance|hardstyle|hard techno|hip hop|hip-hop|edm|electro|drum and bass|dubstep|tech house|hard techno)\b/gi,
    )) {
      discogsLabels.push(match[0]);
    }
  }

  const mbEvidence = labelsToEvidence({
    artistName,
    labels: mbTags,
    sourceType: 'MUSICBRAINZ',
    sourceReference: `musicbrainz:${mbMatch.id}`,
    evidenceStrength: 'STRONG',
    confidence: 'HIGH',
    classificationReason: 'musicbrainz_artist_tags',
  });
  const discogsEvidence = labelsToEvidence({
    artistName,
    labels: discogsLabels,
    sourceType: 'DISCOGS',
    sourceReference: discogsMatch ? `discogs:${discogsMatch.id}` : 'discogs:none',
    evidenceStrength: 'MODERATE',
    confidence: 'MEDIUM',
    classificationReason: 'discogs_artist_genres_styles',
  });

  const mbKeys = new Set(mbEvidence.map((entry) => entry.genreKey));
  const agreed = discogsEvidence.filter((entry) => mbKeys.has(entry.genreKey));
  if (agreed.length > 0) {
    return [...agreed.map((entry) => ({ ...entry, confidence: 'HIGH' as const, evidenceStrength: 'STRONG' as const }))];
  }
  if (mbEvidence.length > 0) {
    return mbEvidence.map((entry) => ({
      ...entry,
      confidence: discogsMatch ? ('MEDIUM' as const) : ('LOW' as const),
      evidenceStrength: discogsMatch ? ('MODERATE' as const) : ('WEAK' as const),
      classificationReason: 'musicbrainz_single_source_tags',
    }));
  }
  if (discogsEvidence.length > 0 && discogsMatch?.title.toLowerCase() === artistName.toLowerCase()) {
    return discogsEvidence;
  }
  return [];
}
