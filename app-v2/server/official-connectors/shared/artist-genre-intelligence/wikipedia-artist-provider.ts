import type { ArtistGenreEvidence } from './types';
import { getArtistIdentityKey, normalizeArtistDisplayName } from './artist-identity';
import { normalizeOfficialGenreLabel } from '../normalize-genre';

const USER_AGENT = 'EternalRave/0.2.0 (m9.3b.2e-artist-intelligence; contact@eternal-rave.local)';
const FETCH_TIMEOUT_MS = 12_000;

const GENRE_TERMS =
  /\b(?:techno|hard techno|house|tech house|deep house|trance|hard trance|psytrance|hardstyle|hardcore|gabber|drum(?:\s|&|and|n)?\s*bass|dnb|jungle|electro|edm|minimal(?:\s+techno)?|industrial(?:\s+techno)?|melodic techno)\b/gi;

async function fetchWikipediaSummary(artistName: string): Promise<{ title: string; extract: string } | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName.replace(/\s+/g, '_'))}`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return undefined;
    }
    const payload = (await response.json()) as { title?: string; extract?: string };
    if (!payload.title || !payload.extract) {
      return undefined;
    }
    return { title: payload.title, extract: payload.extract };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWikipediaArtistGenreEvidence(
  artistName: string,
): Promise<ArtistGenreEvidence[]> {
  const summary = await fetchWikipediaSummary(artistName);
  if (!summary) {
    return [];
  }
  if (summary.title.toLowerCase() !== artistName.toLowerCase()) {
    const normalizedTitle = summary.title.toLowerCase();
    const normalizedArtist = artistName.toLowerCase();
    if (!normalizedTitle.includes(normalizedArtist) && !normalizedArtist.includes(normalizedTitle)) {
      return [];
    }
  }

  const labels = new Set<string>();
  for (const match of summary.extract.matchAll(GENRE_TERMS)) {
    labels.add(match[0]);
  }
  if (labels.size === 0) {
    return [];
  }

  const identity = getArtistIdentityKey(artistName);
  const records: ArtistGenreEvidence[] = [];
  for (const label of labels) {
    const normalized = normalizeOfficialGenreLabel(label);
    if (normalized.status !== 'normalized') {
      continue;
    }
    records.push({
      artistIdentity: identity,
      normalizedName: normalizeArtistDisplayName(artistName),
      genreKey: normalized.genreKey,
      displayName: normalized.displayName,
      sourceType: 'STRUCTURED_SOURCE',
      sourceReference: `wikipedia:${summary.title.replace(/\s+/g, '_')}`,
      evidenceStrength: 'MODERATE',
      confidence: 'MEDIUM',
      observedAt: new Date().toISOString(),
      rawLabel: label,
      classificationReason: 'wikipedia_artist_summary_genre_terms',
    });
  }
  return records;
}
