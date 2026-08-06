import { GENRE_SYNONYMS } from '@/features/import/matching/matching-config';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

const CANONICAL_GENRE_LABELS: Record<string, string> = {
  techno: 'Techno',
  'hard-techno': 'Hard Techno',
  house: 'House',
  trance: 'Trance',
  psy: 'Psy',
  industrial: 'Industrial',
  'drum-and-bass': 'DnB',
  'tech-house': 'Tech House',
  'melodic-techno': 'Melodic Techno',
  'deep-house': 'Deep House',
  hardstyle: 'Hardstyle',
};

const ALIAS_TO_CANONICAL = new Map<string, string>();

for (const [canonicalId, aliases] of Object.entries(GENRE_SYNONYMS)) {
  const label = CANONICAL_GENRE_LABELS[canonicalId] ?? canonicalId;
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(normalizeMatchText(alias), label);
  }
  ALIAS_TO_CANONICAL.set(normalizeMatchText(canonicalId), label);
}

export function normalizeCanonicalGenreLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  const normalized = normalizeMatchText(trimmed);
  return ALIAS_TO_CANONICAL.get(normalized) ?? trimmed;
}

export function normalizeCanonicalGenreLabels(genres: string[] | undefined): string[] {
  if (!genres?.length) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const genre of genres) {
    const label = normalizeCanonicalGenreLabel(genre);
    const key = normalizeMatchText(label);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(label);
  }

  return result;
}
