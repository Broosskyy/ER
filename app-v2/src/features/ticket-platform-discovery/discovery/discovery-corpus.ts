import type { SourceRecord } from '@/data/types/records';

export function collectDiscoveryCorpusFromSources(sources: SourceRecord[]): string[] {
  const texts: string[] = [];
  for (const source of sources) {
    const parts = [
      source.baseUrl,
      source.website,
      source.sourceUrl,
      source.description,
      source.displayName,
      JSON.stringify(source.metadata ?? {}),
      JSON.stringify(source.sourceConfig ?? {}),
    ].filter((value): value is string => Boolean(value));
    if (parts.length > 0) {
      texts.push(parts.join('\n'));
    }
  }
  return texts;
}
