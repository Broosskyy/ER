export interface NormalizedGenreLabel {
  rawLabel: string;
  genreKey: string;
  displayName: string;
  status: 'normalized' | 'unmapped';
}

const GENRE_CANONICAL: Record<string, { genreKey: string; displayName: string }> = {
  goa: { genreKey: 'goa', displayName: 'Goa' },
  groove: { genreKey: 'groove', displayName: 'Groove' },
  techno: { genreKey: 'techno', displayName: 'Techno' },
  house: { genreKey: 'house', displayName: 'House' },
  'tech house': { genreKey: 'tech-house', displayName: 'Tech House' },
  'deep house': { genreKey: 'deep-house', displayName: 'Deep House' },
  'deep/techhouse': { genreKey: 'deep-tech-house', displayName: 'Deep/Tech House' },
  'deep tech house': { genreKey: 'deep-tech-house', displayName: 'Deep/Tech House' },
  'deep techhouse': { genreKey: 'deep-tech-house', displayName: 'Deep/Tech House' },
  techhouse: { genreKey: 'tech-house', displayName: 'Tech House' },
  'progressive house': { genreKey: 'progressive-house', displayName: 'Progressive House' },
  trance: { genreKey: 'trance', displayName: 'Trance' },
  hardstyle: { genreKey: 'hardstyle', displayName: 'Hardstyle' },
  hardtechno: { genreKey: 'hardtechno', displayName: 'Hard Techno' },
  'hard techno': { genreKey: 'hardtechno', displayName: 'Hard Techno' },
  'industrial techno': { genreKey: 'industrial-techno', displayName: 'Industrial Techno' },
  'melodic techno': { genreKey: 'melodic-techno', displayName: 'Melodic Techno' },
  'minimal techno': { genreKey: 'minimal-techno', displayName: 'Minimal Techno' },
  'acid techno': { genreKey: 'acid-techno', displayName: 'Acid Techno' },
  'peak time techno': { genreKey: 'peak-time-techno', displayName: 'Peak Time Techno' },
  'peak-time techno': { genreKey: 'peak-time-techno', displayName: 'Peak Time Techno' },
  'melodic house': { genreKey: 'melodic-house', displayName: 'Melodic House' },
  'afro house': { genreKey: 'afro-house', displayName: 'Afro House' },
  'hard trance': { genreKey: 'hard-trance', displayName: 'Hard Trance' },
  rawstyle: { genreKey: 'rawstyle', displayName: 'Rawstyle' },
  hardcore: { genreKey: 'hardcore', displayName: 'Hardcore' },
  gabber: { genreKey: 'gabber', displayName: 'Gabber' },
  jungle: { genreKey: 'jungle', displayName: 'Jungle' },
  breakbeat: { genreKey: 'breakbeat', displayName: 'Breakbeat' },
  disco: { genreKey: 'disco', displayName: 'Disco' },
  'uk garage': { genreKey: 'uk-garage', displayName: 'UK Garage' },
  ukg: { genreKey: 'uk-garage', displayName: 'UK Garage' },
  electronic: { genreKey: 'electronic', displayName: 'Electronic' },
  psytrance: { genreKey: 'psytrance', displayName: 'Psytrance' },
  bounce: { genreKey: 'bounce', displayName: 'Bounce' },
  hardbounce: { genreKey: 'hard-bounce', displayName: 'Hard Bounce' },
  'hard bounce': { genreKey: 'hard-bounce', displayName: 'Hard Bounce' },
  'hard-bounce': { genreKey: 'hard-bounce', displayName: 'Hard Bounce' },
  dubstep: { genreKey: 'dubstep', displayName: 'Dubstep' },
  dnb: { genreKey: 'drum-and-bass', displayName: "Drum'n'Bass" },
  "drum'n'bass": { genreKey: 'drum-and-bass', displayName: "Drum'n'Bass" },
  'drum and bass': { genreKey: 'drum-and-bass', displayName: 'Drum & Bass' },
  'drum & bass': { genreKey: 'drum-and-bass', displayName: 'Drum & Bass' },
  'drum n bass': { genreKey: 'drum-and-bass', displayName: "Drum'n'Bass" },
  basshouse: { genreKey: 'bass-house', displayName: 'Bass House' },
  'bass house': { genreKey: 'bass-house', displayName: 'Bass House' },
  electro: { genreKey: 'electro', displayName: 'Electro' },
  edm: { genreKey: 'edm', displayName: 'EDM' },
  dance: { genreKey: 'electronic', displayName: 'Electronic' },
  trap: { genreKey: 'trap', displayName: 'Trap' },
  'hip hop': { genreKey: 'hip-hop', displayName: 'Hip Hop' },
  'hip-hop': { genreKey: 'hip-hop', displayName: 'Hip Hop' },
  'hard dance': { genreKey: 'hard-dance', displayName: 'Hard Dance' },
  harddance: { genreKey: 'hard-dance', displayName: 'Hard Dance' },
};

function normalizeGenreLookupKey(label: string): string {
  return label
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function splitCompoundGenreLabel(label: string): string[] {
  const trimmed = label.trim();
  if (!trimmed) {
    return [];
  }

  if (/\s+vs\.?\s+/i.test(trimmed)) {
    return trimmed
      .split(/\s+vs\.?\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((part, index) => {
        if (index === 0 && parts.length === 2 && /^[a-z]/i.test(parts[1]!)) {
          return `${part}/${parts[1]}`;
        }
        return part;
      });
    }
  }

  return [trimmed];
}

export function normalizeOfficialGenreLabel(rawLabel: string): NormalizedGenreLabel {
  const lookup = normalizeGenreLookupKey(rawLabel);
  const canonical = GENRE_CANONICAL[lookup];
  if (canonical) {
    return {
      rawLabel,
      genreKey: canonical.genreKey,
      displayName: canonical.displayName,
      status: 'normalized',
    };
  }

  return {
    rawLabel,
    genreKey: '',
    displayName: rawLabel.trim(),
    status: 'unmapped',
  };
}

const GENRE_KEY_ALIASES: Record<string, string> = {
  basshouse: 'bass-house',
  "drum'n'bass": 'drum-and-bass',
  'drum and bass': 'drum-and-bass',
  dance: 'electronic',
  edm: 'electronic',
};

export function canonicalGenreKey(genreKey: string): string {
  const normalized = genreKey.trim().toLowerCase();
  return GENRE_KEY_ALIASES[normalized] ?? normalized;
}

/** Generic umbrella label that should not block stronger evidence-backed upgrades. */
export function isWeakOnlyGenericGenre(genres: string[]): boolean {
  if (genres.length === 0) {
    return false;
  }
  const keys = genres.map((genre) => canonicalGenreKey(genre));
  return keys.every((key) => key === 'electronic');
}

export function normalizeOfficialGenreLabels(rawLabels: string[]): {
  normalized: NormalizedGenreLabel[];
  unmapped: NormalizedGenreLabel[];
} {
  const normalized: NormalizedGenreLabel[] = [];
  const unmapped: NormalizedGenreLabel[] = [];
  const seen = new Set<string>();

  for (const rawLabel of rawLabels) {
    for (const part of splitCompoundGenreLabel(rawLabel)) {
      const result = normalizeOfficialGenreLabel(part);
      const dedupeKey = result.genreKey || result.displayName.toLowerCase();
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      if (result.status === 'unmapped') {
        unmapped.push(result);
      } else {
        normalized.push(result);
      }
    }
  }

  return { normalized, unmapped };
}

export function normalizedGenresToExplicitLabels(results: NormalizedGenreLabel[]): string[] {
  return results.filter((entry) => entry.status === 'normalized').map((entry) => entry.displayName);
}
