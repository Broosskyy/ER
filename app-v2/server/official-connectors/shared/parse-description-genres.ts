import { normalizedGenresToExplicitLabels, normalizeOfficialGenreLabels } from './normalize-genre';

const DESCRIPTION_GENRE_SPANNING_PATTERN =
  /\b(?:spanning|including|featuring|covering|across)\s+([^.!\n]+?)(?:\s+in all its forms)?[.!\n]/i;

const DESCRIPTION_GENRE_PHRASE_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
  rejectWindow?: RegExp;
}> = [
  { pattern: /\bhard[\s-]?techno\b/i, label: 'Hard Techno' },
  { pattern: /\btech[\s-]?house\b/i, label: 'Tech House' },
  { pattern: /\bdeep[\s-]?house\b/i, label: 'Deep House' },
  { pattern: /\bprogressive[\s-]?house\b/i, label: 'Progressive House' },
  { pattern: /\bdrum(?:\s*(?:and|n|&)\s*bass|['\u2019]?n['\u2019]?bass)\b/i, label: "Drum'n'Bass" },
  { pattern: /\bhardstyle\b/i, label: 'Hardstyle' },
  { pattern: /\bhard[\s-]?dance\b/i, label: 'Hard Dance' },
  { pattern: /\bpsytrance\b/i, label: 'Psytrance' },
  { pattern: /\btrance\b/i, label: 'Trance' },
  { pattern: /\btechno\b/i, label: 'Techno' },
  {
    pattern: /\bhouse\b/i,
    label: 'House',
    rejectWindow: /\bfull\s+house\b/i,
  },
  { pattern: /\belectro\b/i, label: 'Electro' },
  { pattern: /\bdubstep\b/i, label: 'Dubstep' },
  { pattern: /\bhip[\s-]?hop\b/i, label: 'Hip Hop' },
];

function matchesGenrePhrase(description: string, entry: (typeof DESCRIPTION_GENRE_PHRASE_PATTERNS)[number]): boolean {
  const match = entry.pattern.exec(description);
  if (!match || match.index == null) {
    return false;
  }
  if (entry.rejectWindow) {
    const window = description.slice(Math.max(0, match.index - 8), match.index + match[0].length + 8);
    if (entry.rejectWindow.test(window)) {
      return false;
    }
  }
  return true;
}

export function parseDescriptionExplicitGenres(description: string | undefined): string[] {
  if (!description) {
    return [];
  }

  const labels: string[] = [];

  const spanningMatch = description.match(DESCRIPTION_GENRE_SPANNING_PATTERN);
  if (spanningMatch?.[1]) {
    labels.push(
      ...spanningMatch[1]
        .split(/\s*,\s*|\s+and\s+/i)
        .map((label) => label.replace(/\s+in all its forms\.?$/i, '').replace(/[.!]+$/, '').trim())
        .filter((label) => label.length > 0 && !/^once$/i.test(label)),
    );
  }

  for (const entry of DESCRIPTION_GENRE_PHRASE_PATTERNS) {
    if (matchesGenrePhrase(description, entry)) {
      labels.push(entry.label);
    }
  }

  const { normalized } = normalizeOfficialGenreLabels(labels);
  return normalizedGenresToExplicitLabels(normalized);
}
