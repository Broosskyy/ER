export const DISCOVERY_SEARCH_MODES = ['exact', 'prefix', 'fuzzy'] as const;
export type DiscoverySearchMode = (typeof DISCOVERY_SEARCH_MODES)[number];

export const DISCOVERY_SEARCH_LOCALES = ['de', 'en'] as const;
export type DiscoverySearchLocale = (typeof DISCOVERY_SEARCH_LOCALES)[number];

export interface DiscoverySearchQuery {
  text: string;
  mode?: DiscoverySearchMode;
  locale?: DiscoverySearchLocale;
  fuzzyThreshold?: number;
}

export interface DiscoverySearchMatchOptions {
  mode?: DiscoverySearchMode;
  locale?: DiscoverySearchLocale;
  fuzzyThreshold?: number;
}
