import { normalizeOfficialGenreLabel } from '../normalize-genre';
import { getArtistIdentityKey, normalizeArtistDisplayName } from './artist-identity';
import type { ArtistGenreEvidence } from './types';

const USER_AGENT = 'EternalRave/0.2.0 (m9.3b.2e-artist-intelligence; contact@eternal-rave.local)';
const GENRE_TERMS =
  /\b(?:techno|hard techno|house|tech house|deep house|trance|hard trance|psytrance|hardstyle|hardcore|gabber|drum(?:\s|&|and|n)?\s*bass|dnb|jungle|electro|edm|minimal(?:\s+techno)?|melodic techno)\b/gi;

const ALLOWED_HOSTS = [
  'chrisstussy.com',
  'bandcamp.com',
  'soundcloud.com',
  'residentadvisor.net',
  'ra.co',
];

function isAllowedOfficialUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function extractGenreLabels(text: string): string[] {
  const labels = new Set<string>();
  for (const match of text.matchAll(GENRE_TERMS)) {
    labels.add(match[0]);
  }
  return [...labels];
}

export async function fetchOfficialArtistWebEvidence(input: {
  artistName: string;
  officialUrls: string[];
}): Promise<ArtistGenreEvidence[]> {
  const identity = getArtistIdentityKey(input.artistName);
  const records: ArtistGenreEvidence[] = [];
  const seen = new Set<string>();

  for (const url of input.officialUrls) {
    if (!isAllowedOfficialUrl(url)) {
      continue;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let html = '';
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        signal: controller.signal,
        redirect: 'follow',
      });
      if (!response.ok) {
        continue;
      }
      html = await response.text();
      if (html.length > 500_000) {
        continue;
      }
    } catch {
      continue;
    } finally {
      clearTimeout(timeout);
    }
    const labels = extractGenreLabels(html);
    for (const label of labels) {
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
        sourceType: 'STRUCTURED_SOURCE',
        sourceReference: url,
        evidenceStrength: 'STRONG',
        confidence: 'HIGH',
        observedAt: new Date().toISOString(),
        rawLabel: label,
        classificationReason: 'official_artist_web_page_genre_terms',
      });
    }
    if (records.length > 0) {
      break;
    }
  }

  return records;
}

export async function fetchDiscogsOfficialUrls(artistName: string): Promise<string[]> {
  const response = await fetch(
    `https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=3`,
    { headers: { 'User-Agent': USER_AGENT } },
  );
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { results?: Array<{ id: number; title: string }> };
  const match =
    payload.results?.find((result) => result.title.toLowerCase() === artistName.toLowerCase()) ??
    payload.results?.[0];
  if (!match) {
    return [];
  }
  const artistResponse = await fetch(`https://api.discogs.com/artists/${match.id}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!artistResponse.ok) {
    return [];
  }
  const artist = (await artistResponse.json()) as { urls?: string[] };
  return (artist.urls ?? []).filter((url) => url.startsWith('http'));
}
