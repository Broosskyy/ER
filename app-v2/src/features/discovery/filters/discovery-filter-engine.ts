import type { DiscoveryFilterPredicate } from '../domain/discovery-filter-types';

export class DiscoveryFilterEngine<TItem> {
  constructor(private readonly predicates: DiscoveryFilterPredicate<TItem>[] = []) {}

  withPredicates(predicates: DiscoveryFilterPredicate<TItem>[]): DiscoveryFilterEngine<TItem> {
    return new DiscoveryFilterEngine([...this.predicates, ...predicates]);
  }

  apply(items: TItem[]): TItem[] {
    if (this.predicates.length === 0) {
      return items;
    }
    return items.filter((item) => this.predicates.every((predicate) => predicate.applies(item)));
  }

  count(items: TItem[]): number {
    return this.apply(items).length;
  }
}

export function createDiscoveryFilterEngine<TItem>(
  predicates: DiscoveryFilterPredicate<TItem>[] = [],
): DiscoveryFilterEngine<TItem> {
  return new DiscoveryFilterEngine(predicates);
}
