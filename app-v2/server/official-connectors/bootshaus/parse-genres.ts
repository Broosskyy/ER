export function parseBootshausExplicitGenres(genresHtml: string): string[] {
  const labels = [...genresHtml.matchAll(/<[^>]+class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/[^>]+>/gi)]
    .map((match) => match[1]?.trim() ?? '')
    .filter(Boolean);

  if (labels.length > 0) {
    return [...new Set(labels)];
  }

  const text = genresHtml
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.toLowerCase() !== 'genres');

  return [...new Set(text)];
}
