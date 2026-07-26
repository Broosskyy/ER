import { describe, expect, it } from 'vitest';

import {
  resolveDateFilterLabel,
  resolveSearchResultGroupTitle,
  resolveSortLabel,
  resolveSuggestionIcon,
} from '@/components/search/search-styles';
import type {
  ActiveFilterViewModel,
  RecentSearchViewModel,
  SearchSuggestionViewModel,
  SortViewModel,
  TrendingSearchViewModel,
} from '@/components/search/view-models';

describe('Phase 2E search and filter display contracts', () => {
  it('resolves suggestion icons for every supported kind', () => {
    const kinds = ['event', 'city', 'genre', 'organizer', 'club', 'artist', 'venue'] as const;
    for (const kind of kinds) {
      expect(resolveSuggestionIcon(kind)).toMatch(/-outline$/);
    }
  });

  it('resolves sort and date filter labels in German', () => {
    expect(resolveSortLabel('distance')).toBe('Entfernung');
    expect(resolveSortLabel('date')).toBe('Datum');
    expect(resolveSortLabel('popularity')).toBe('Beliebtheit');
    expect(resolveSortLabel('new')).toBe('Neu');
    expect(resolveDateFilterLabel('today')).toBe('Heute');
    expect(resolveDateFilterLabel('weekend')).toBe('Wochenende');
  });

  it('resolves search result group titles without domain data', () => {
    expect(resolveSearchResultGroupTitle('events')).toBe('Events');
    expect(resolveSearchResultGroupTitle('organizers')).toBe('Veranstalter');
    expect(resolveSearchResultGroupTitle('clubs')).toBe('Clubs');
  });

  it('keeps suggestion, recent, trending, sort, and active filter models presentation-only', () => {
    const suggestion: SearchSuggestionViewModel = {
      id: 's-1',
      kind: 'genre',
      title: 'Techno',
      accessibilityLabel: 'Genre Techno',
    };
    const recent: RecentSearchViewModel = {
      id: 'r-1',
      title: 'Techno Berlin',
      accessibilityLabel: 'Letzte Suche Techno Berlin',
    };
    const trending: TrendingSearchViewModel = {
      id: 't-1',
      title: 'Hard Techno',
      accessibilityLabel: 'Trending Hard Techno',
    };
    const sort: SortViewModel = { id: 'date', label: 'Datum', selected: true };
    const active: ActiveFilterViewModel = { id: 'genre-techno', label: 'Techno' };

    expect('onPress' in suggestion).toBe(false);
    expect('storedAt' in recent).toBe(false);
    expect('analytics' in trending).toBe(false);
    expect('direction' in sort).toBe(false);
    expect('filterType' in active).toBe(false);
  });
});
