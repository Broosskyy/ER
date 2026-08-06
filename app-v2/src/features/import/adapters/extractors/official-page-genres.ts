import { resolveProviderAdapter } from '@/features/import/unified-website';

export function extractBootshausGenresFromHtml(html: string): string[] {
  const adapter = resolveProviderAdapter('https://bootshaus.tv/');
  return adapter?.extractGenres?.(html) ?? [];
}

export function extractOfficialPageGenres(html: string, url: string): string[] | undefined {
  const adapter = resolveProviderAdapter(url);
  const genres = adapter?.extractGenres?.(html);
  return genres && genres.length > 0 ? genres : undefined;
}
