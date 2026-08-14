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
  'techhouse': { genreKey: 'tech-house', displayName: 'Tech House' },
  'progressive house': { genreKey: 'progressive-house', displayName: 'Progressive House' },
  trance: { genreKey: 'trance', displayName: 'Trance' },
  hardstyle: { genreKey: 'hardstyle', displayName: 'Hardstyle' },
  hardtechno: { genreKey: 'hardtechno', displayName: 'Hard Techno' },
  'hard techno': { genreKey: 'hardtechno', displayName: 'Hard Techno' },
  dubstep: { genreKey: 'dubstep', displayName: 'Dubstep' },
  dnb: { genreKey: 'drum-and-bass', displayName: "Drum'n'Bass" },
  "drum'n'bass": { genreKey: 'drum-and-bass', displayName: "Drum'n'Bass" },
  'drum and bass': { genreKey: 'drum-and-bass', displayName: "Drum'n'Bass" },
  'drum n bass': { genreKey: 'drum-and-bass', displayName: "Drum'n'Bass" },
  basshouse: { genreKey: 'bass-house', displayName: 'Bass House' },
  'bass house': { genreKey: 'bass-house', displayName: 'Bass House' },
  electro: { genreKey: 'electro', displayName: 'Electro' },
  edm: { genreKey: 'edm', displayName: 'EDM' },
  dance: { genreKey: 'dance', displayName: 'Dance' },
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
    return trimmed.split(/\s+vs\.?\s+/i).map((part) => part.trim()).filter(Boolean);
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
};

export function canonicalGenreKey(genreKey: string): string {
  const normalized = genreKey.trim().toLowerCase();
  return GENRE_KEY_ALIASES[normalized] ?? normalized;
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
