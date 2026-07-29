import type { Event } from '@/features/events/types/event';

import type { DiscoverySearchMatchOptions } from '../domain/discovery-search-types';
import { expandDiscoverySearchTerms } from './discovery-search-synonyms';
import {
  isFuzzyMatch,
  normalizeDiscoverySearchText,
  tokenizeDiscoverySearchText,
} from './discovery-search-normalizer';
import { buildDiscoveryTextIndexFromEvent } from './discovery-text-index';

export function matchesDiscoverySearch(
  event: Event,
  queryText: string,
  options: DiscoverySearchMatchOptions = {},
): boolean {
  const locale = options.locale ?? 'de';
  const mode = options.mode ?? 'exact';
  const terms = expandDiscoverySearchTerms(tokenizeDiscoverySearchText(queryText, locale), locale);

  if (terms.length === 0) {
    return true;
  }

  const haystack = buildDiscoveryTextIndexFromEvent(event);
  const tokens = haystack.split(/\s+/).filter(Boolean);

  return terms.every((term) => {
    if (mode === 'prefix') {
      return tokens.some((token) => token.startsWith(term)) || haystack.includes(term);
    }
    if (mode === 'fuzzy') {
      const threshold = options.fuzzyThreshold ?? 2;
      return (
        haystack.includes(term) ||
        tokens.some((token) => isFuzzyMatch(term, token, threshold))
      );
    }
    return haystack.includes(normalizeDiscoverySearchText(term, locale));
  });
}
