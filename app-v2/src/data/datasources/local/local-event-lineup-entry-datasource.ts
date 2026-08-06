import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
export function createLocalEventLineupEntryDatasource(
  getEntries: () => Map<string, ResolvedCanonicalLineupEntry[]>,
  setEntries: (entries: Map<string, ResolvedCanonicalLineupEntry[]>) => void,
) {
  return {
    async getEntriesForEvent(eventId: string): Promise<ResolvedCanonicalLineupEntry[]> {
      return [...(getEntries().get(eventId) ?? [])];
    },

    async getEntriesForEvents(eventIds: string[]): Promise<Map<string, ResolvedCanonicalLineupEntry[]>> {
      const result = new Map<string, ResolvedCanonicalLineupEntry[]>();
      const store = getEntries();
      for (const eventId of eventIds) {
        result.set(eventId, [...(store.get(eventId) ?? [])]);
      }
      return result;
    },

    async replaceEventLineupEntries(
      eventId: string,
      entries: ResolvedCanonicalLineupEntry[],
    ): Promise<ResolvedCanonicalLineupEntry[]> {
      const next = new Map(getEntries());
      next.set(
        eventId,
        entries.map((entry, index) => ({ ...entry, order: index })),
      );
      setEntries(next);
      return next.get(eventId) ?? [];
    },
  };
}

// Keep bundle import out of local module graph for tests.
export type EventLineupEntryDatasource = ReturnType<typeof createLocalEventLineupEntryDatasource>;
