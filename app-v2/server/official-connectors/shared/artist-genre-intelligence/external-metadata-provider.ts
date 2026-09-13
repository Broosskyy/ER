import type { ArtistGenreEvidence } from './types';
import {
  artistSearchNameVariants,
  getArtistIdentityKey,
  normalizeArtistDisplayName,
  toArtistSearchName,
} from './artist-identity';
import { normalizeOfficialGenreLabel } from '../normalize-genre';
import { fetchProviderJson, PROVIDER_THROTTLE_MS } from './provider-fetch';
import type { ProviderOutcome } from './provider-negative-cache';

const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const DISCOGS_BASE_URL = 'https://api.discogs.com';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      normalizedName: toArtistSearchName(input.artistName),
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

function namesMatch(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export interface ExternalProviderAttempt {
  providerId: string;
  outcome: ProviderOutcome;
  detail?: string;
  genres: string[];
}

async function fetchMusicBrainzTags(
  artistName: string,
): Promise<{ result?: { id: string; name: string; tags: string[] }; attempt: ExternalProviderAttempt }> {
  for (const variant of artistSearchNameVariants(artistName)) {
    const mbUrl = `${MUSICBRAINZ_BASE_URL}/artist?query=${encodeURIComponent(`artist:"${variant}"`)}&fmt=json&limit=5`;
    const search = await fetchProviderJson<{ artists?: Array<{ id: string; name: string; score?: number }> }>(
      mbUrl,
    );
    await sleep(PROVIDER_THROTTLE_MS);
    if (search.status === 'rate_limited') {
      return { attempt: { providerId: 'musicbrainz', outcome: 'RATE_LIMITED', detail: 'search_429', genres: [] } };
    }
    if (search.status === 'timeout') {
      return { attempt: { providerId: 'musicbrainz', outcome: 'TIMEOUT', detail: 'search_timeout', genres: [] } };
    }
    if (search.status !== 'success') {
      continue;
    }
    const mbMatch =
      search.data?.artists?.find((artist) => namesMatch(artist.name, variant)) ??
      search.data?.artists?.find((artist) => (artist.score ?? 0) >= 92);
    if (!mbMatch) {
      continue;
    }
    const mbTagsUrl = `${MUSICBRAINZ_BASE_URL}/artist/${mbMatch.id}?inc=tags&fmt=json`;
    const tagsResponse = await fetchProviderJson<{ tags?: Array<{ name: string; count?: number }> }>(mbTagsUrl);
    await sleep(PROVIDER_THROTTLE_MS);
    if (tagsResponse.status === 'rate_limited') {
      return { attempt: { providerId: 'musicbrainz', outcome: 'RATE_LIMITED', detail: 'tags_429', genres: [] } };
    }
    const tags = (tagsResponse.data?.tags ?? [])
      .filter((tag) => (tag.count ?? 0) >= 1)
      .sort((left, right) => (right.count ?? 0) - (left.count ?? 0))
      .map((tag) => tag.name)
      .slice(0, 8);
    if (tags.length > 0) {
      return {
        result: { id: mbMatch.id, name: mbMatch.name, tags },
        attempt: { providerId: 'musicbrainz', outcome: 'EVIDENCE_FOUND', genres: tags },
      };
    }
  }
  return { attempt: { providerId: 'musicbrainz', outcome: 'NO_RESULT', genres: [] } };
}

const DISCOGS_RELEASE_SAMPLE_SIZE = 10;
const DISCOGS_RELEASE_STYLE_MIN_VOTES = 2;

async function fetchDiscogsReleaseStyleLabels(
  artistId: number,
): Promise<string[]> {
  const releasesResponse = await fetchProviderJson<{
    releases?: Array<{ title: string; type: string; main_release?: number; id: number }>;
  }>(`${DISCOGS_BASE_URL}/artists/${artistId}/releases?per_page=${DISCOGS_RELEASE_SAMPLE_SIZE}&sort=year&sort_order=desc`);
  await sleep(PROVIDER_THROTTLE_MS);
  if (releasesResponse.status !== 'success') {
    return [];
  }
  const styleVotes = new Map<string, number>();
  for (const release of releasesResponse.data?.releases ?? []) {
    const releaseId = release.main_release ?? release.id;
    const detailResponse = await fetchProviderJson<{ genres?: string[]; styles?: string[] }>(
      `${DISCOGS_BASE_URL}/releases/${releaseId}`,
    );
    await sleep(PROVIDER_THROTTLE_MS);
    if (detailResponse.status !== 'success') {
      continue;
    }
    for (const label of [...(detailResponse.data?.genres ?? []), ...(detailResponse.data?.styles ?? [])]) {
      styleVotes.set(label, (styleVotes.get(label) ?? 0) + 1);
    }
  }
  const ranked = [...styleVotes.entries()].sort((left, right) => right[1] - left[1]);
  const topVotes = ranked[0]?.[1] ?? 0;
  const threshold = Math.max(DISCOGS_RELEASE_STYLE_MIN_VOTES, Math.ceil(topVotes * 0.4));
  return ranked.filter(([, votes]) => votes >= threshold).map(([label]) => label).slice(0, 4);
}

async function fetchDiscogsLabels(
  artistName: string,
): Promise<{ result?: { id: number; title: string; labels: string[] }; attempt: ExternalProviderAttempt }> {
  for (const variant of artistSearchNameVariants(artistName)) {
    const discogsSearchUrl = `${DISCOGS_BASE_URL}/database/search?q=${encodeURIComponent(variant)}&type=artist&per_page=5`;
    const search = await fetchProviderJson<{ results?: Array<{ id: number; title: string }> }>(discogsSearchUrl);
    await sleep(PROVIDER_THROTTLE_MS);
    if (search.status === 'rate_limited') {
      return { attempt: { providerId: 'discogs', outcome: 'RATE_LIMITED', detail: 'search_429', genres: [] } };
    }
    const discogsMatch =
      search.data?.results?.find((result) => namesMatch(result.title, variant)) ??
      search.data?.results?.find((result) => namesMatch(result.title, artistName));
    if (!discogsMatch) {
      continue;
    }
    const artistResponse = await fetchProviderJson<{
      genres?: string[];
      styles?: string[];
      profile?: string;
    }>(`${DISCOGS_BASE_URL}/artists/${discogsMatch.id}`);
    await sleep(PROVIDER_THROTTLE_MS);
    const labels = [
      ...(artistResponse.data?.genres ?? []),
      ...(artistResponse.data?.styles ?? []),
    ];
    const profile = artistResponse.data?.profile ?? '';
    for (const match of profile.matchAll(
      /\b(?:techno|house|trance|hardstyle|hard techno|hip hop|hip-hop|edm|electro|drum and bass|dubstep|tech house|hard techno)\b/gi,
    )) {
      labels.push(match[0]);
    }
    if (labels.length > 0) {
      return {
        result: { id: discogsMatch.id, title: discogsMatch.title, labels },
        attempt: { providerId: 'discogs', outcome: 'EVIDENCE_FOUND', genres: labels },
      };
    }
    const releaseLabels = await fetchDiscogsReleaseStyleLabels(discogsMatch.id);
    if (releaseLabels.length > 0) {
      return {
        result: { id: discogsMatch.id, title: discogsMatch.title, labels: releaseLabels },
        attempt: {
          providerId: 'discogs',
          outcome: 'EVIDENCE_FOUND',
          detail: 'release_style_consensus',
          genres: releaseLabels,
        },
      };
    }
  }
  return { attempt: { providerId: 'discogs', outcome: 'NO_RESULT', genres: [] } };
}

export async function fetchExternalArtistGenreEvidence(
  artistName: string,
): Promise<{ evidence: ArtistGenreEvidence[]; attempts: ExternalProviderAttempt[] }> {
  const attempts: ExternalProviderAttempt[] = [];
  const mb = await fetchMusicBrainzTags(artistName);
  attempts.push(mb.attempt);
  if (mb.attempt.outcome === 'RATE_LIMITED' || mb.attempt.outcome === 'TIMEOUT') {
    return { evidence: [], attempts };
  }
  const discogs = await fetchDiscogsLabels(artistName);
  attempts.push(discogs.attempt);

  const mbEvidence = mb.result
    ? labelsToEvidence({
        artistName,
        labels: mb.result.tags,
        sourceType: 'MUSICBRAINZ',
        sourceReference: `musicbrainz:${mb.result.id}`,
        evidenceStrength: 'STRONG',
        confidence: 'HIGH',
        classificationReason: 'musicbrainz_artist_tags',
      })
    : [];
  const discogsEvidence = discogs.result
    ? labelsToEvidence({
        artistName,
        labels: discogs.result.labels,
        sourceType: 'DISCOGS',
        sourceReference: `discogs:${discogs.result.id}`,
        evidenceStrength: 'MODERATE',
        confidence: 'MEDIUM',
        classificationReason:
          discogs.attempt.detail === 'release_style_consensus'
            ? 'discogs_release_style_consensus'
            : 'discogs_artist_genres_styles',
      })
    : [];

  const mbKeys = new Set(mbEvidence.map((entry) => entry.genreKey));
  const agreed = discogsEvidence.filter((entry) => mbKeys.has(entry.genreKey));
  if (agreed.length > 0) {
    return {
      evidence: agreed.map((entry) => ({
        ...entry,
        confidence: 'HIGH' as const,
        evidenceStrength: 'STRONG' as const,
      })),
      attempts,
    };
  }
  if (mbEvidence.length > 0) {
    const exactMbMatch =
      mb.result &&
      (namesMatch(mb.result.name, artistName) || namesMatch(mb.result.name, toArtistSearchName(artistName)));
    const highConfidenceSingleSource = Boolean(exactMbMatch && mbEvidence.length >= 1);
    return {
      evidence: mbEvidence.map((entry) => ({
        ...entry,
        confidence: highConfidenceSingleSource ? ('HIGH' as const) : ('MEDIUM' as const),
        evidenceStrength: highConfidenceSingleSource ? ('STRONG' as const) : ('MODERATE' as const),
        classificationReason: highConfidenceSingleSource
          ? 'musicbrainz_exact_match_tags'
          : 'musicbrainz_single_source_tags',
      })),
      attempts,
    };
  }
  if (
    discogsEvidence.length > 0 &&
    discogs.result &&
    (namesMatch(discogs.result.title, artistName) || namesMatch(discogs.result.title, toArtistSearchName(artistName)))
  ) {
    return {
      evidence: discogsEvidence.map((entry) => ({
        ...entry,
        confidence: discogsEvidence.length >= 2 ? ('HIGH' as const) : ('MEDIUM' as const),
        evidenceStrength: discogsEvidence.length >= 2 ? ('STRONG' as const) : ('MODERATE' as const),
      })),
      attempts,
    };
  }
  return { evidence: [], attempts };
}
