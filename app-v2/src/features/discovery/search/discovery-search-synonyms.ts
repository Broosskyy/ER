import type { DiscoverySearchLocale } from '../domain/discovery-search-types';
import { normalizeDiscoverySearchText } from './discovery-search-normalizer';

type SynonymMap = Record<string, string[]>;

const GERMAN_SYNONYMS: SynonymMap = {
  techno: ['tekno', 'techno'],
  house: ['house music', 'deep house'],
  trance: ['psytrance', 'goa'],
  festival: ['fest', 'open air'],
  kostenlos: ['free', 'gratis', 'eintritt frei'],
  club: ['disco', 'location'],
};

const ENGLISH_SYNONYMS: SynonymMap = {
  techno: ['tekno', 'techno'],
  house: ['house music'],
  trance: ['psytrance'],
  festival: ['fest', 'open air'],
  free: ['gratis', 'no cover'],
  club: ['venue', 'nightclub'],
};

export function expandDiscoverySearchTerms(
  terms: string[],
  locale: DiscoverySearchLocale = 'de',
): string[] {
  const synonymMap = locale === 'en' ? ENGLISH_SYNONYMS : GERMAN_SYNONYMS;
  const expanded = new Set<string>();

  for (const term of terms) {
    const normalized = normalizeDiscoverySearchText(term, locale);
    expanded.add(normalized);
    const synonyms = synonymMap[normalized];
    if (synonyms) {
      for (const synonym of synonyms) {
        expanded.add(normalizeDiscoverySearchText(synonym, locale));
      }
    }
  }

  return [...expanded];
}
