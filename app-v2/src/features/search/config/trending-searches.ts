import type { TrendingSearchViewModel } from '@/components/search/view-models';

export const TRENDING_SEARCHES: TrendingSearchViewModel[] = [
  {
    id: 'trending-techno-koeln',
    title: 'Techno Köln',
    badgeLabel: 'Genre',
    trendLabel: 'Beliebt diese Woche',
    rank: 1,
    accessibilityLabel: 'Trending Suche Techno Köln',
  },
  {
    id: 'trending-weekend',
    title: 'Dieses Wochenende',
    badgeLabel: 'Zeitraum',
    trendLabel: 'Stark gestiegen',
    rank: 2,
    accessibilityLabel: 'Trending Suche Dieses Wochenende',
  },
  {
    id: 'trending-hard-techno',
    title: 'Hard Techno',
    badgeLabel: 'Genre',
    trendLabel: 'Top Genre',
    rank: 3,
    accessibilityLabel: 'Trending Suche Hard Techno',
  },
  {
    id: 'trending-warehouse',
    title: 'Warehouse',
    badgeLabel: 'Venue',
    trendLabel: 'Häufig gesucht',
    rank: 4,
    accessibilityLabel: 'Trending Suche Warehouse',
  },
  {
    id: 'trending-free',
    title: 'Kostenlos',
    badgeLabel: 'Preis',
    trendLabel: 'Beliebt',
    rank: 5,
    accessibilityLabel: 'Trending Suche Kostenlos',
  },
];

export function getTrendingSearches(): TrendingSearchViewModel[] {
  return TRENDING_SEARCHES;
}

export function resolveTrendingSearchQuery(item: TrendingSearchViewModel): string {
  return item.title;
}
