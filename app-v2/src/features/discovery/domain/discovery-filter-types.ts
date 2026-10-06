export interface DiscoveryFilterPredicate<TItem> {
  id: string;
  applies: (item: TItem) => boolean;
}

export interface DiscoveryFilterContext {
  now: Date;
  referenceDate?: Date;
}
