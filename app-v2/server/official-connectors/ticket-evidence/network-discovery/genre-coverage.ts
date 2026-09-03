const GENRE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Hard Techno', pattern: /\bhard\s*techno\b/i },
  { label: 'Techno', pattern: /\btechno\b/i },
  { label: 'House', pattern: /\bhouse\b/i },
  { label: 'Trance', pattern: /\btrance\b/i },
  { label: 'EDM', pattern: /\bedm\b/i },
  { label: 'Hardstyle', pattern: /\bhardstyle\b/i },
  { label: 'Hardcore', pattern: /\bhardcore\b/i },
  { label: 'Drum & Bass', pattern: /\b(?:drum\s*(?:&|and|n)?\s*bass|dnb)\b/i },
  { label: 'Electronic Festival', pattern: /\b(?:festival|open\s*air)\b/i },
  { label: 'Other Electronic', pattern: /\b(?:electronic|electro|psytrance|minimal|industrial|schranz|breakbeat|bass)\b/i },
];

export function inferGenreLabels(...parts: Array<string | undefined>): string[] {
  const corpus = parts.filter(Boolean).join(' ');
  const labels = GENRE_PATTERNS.filter(({ pattern }) => pattern.test(corpus)).map(({ label }) => label);
  if (labels.length === 0) {
    return ['Ambiguous'];
  }
  if (labels.includes('Hard Techno') && labels.includes('Techno')) {
    return labels.filter((label) => label !== 'Techno');
  }
  return labels;
}

export function buildGenreCoverageCounts(
  events: Array<{ genreHints: string[]; title: string; relevance: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (event.relevance === 'IRRELEVANT') {
      continue;
    }
    const labels = event.genreHints.length > 0 ? event.genreHints : inferGenreLabels(event.title);
    for (const label of labels) {
      counts[label] = (counts[label] ?? 0) + 1;
    }
  }
  return counts;
}
