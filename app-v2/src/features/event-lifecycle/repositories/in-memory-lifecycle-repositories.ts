import type {
  EventLifecycleChangeRepository,
  EventLifecycleHistoryRepository,
} from '../domain/lifecycle-engine-types';
import type {
  EventLifecycleChangeRecord,
  EventLifecycleHistoryEntry,
} from '../domain/lifecycle-engine-types';

export class InMemoryEventLifecycleHistoryRepository implements EventLifecycleHistoryRepository {
  private readonly entries: EventLifecycleHistoryEntry[] = [];

  async create(entry: EventLifecycleHistoryEntry): Promise<EventLifecycleHistoryEntry> {
    this.entries.push({ ...entry });
    return entry;
  }

  async listByCanonicalEventId(canonicalEventId: string, limit = 100): Promise<EventLifecycleHistoryEntry[]> {
    return this.entries
      .filter((entry) => entry.canonicalEventId === canonicalEventId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async listBySourceId(sourceId: string, limit = 100): Promise<EventLifecycleHistoryEntry[]> {
    return this.entries
      .filter((entry) => entry.sourceId === sourceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async listRecent(limit = 100): Promise<EventLifecycleHistoryEntry[]> {
    return [...this.entries]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }
}

export class InMemoryEventLifecycleChangeRepository implements EventLifecycleChangeRepository {
  private readonly changes: EventLifecycleChangeRecord[] = [];

  async createMany(records: EventLifecycleChangeRecord[]): Promise<EventLifecycleChangeRecord[]> {
    for (const record of records) {
      this.changes.push({ ...record });
    }
    return records;
  }

  async listByCanonicalEventId(canonicalEventId: string, limit = 200): Promise<EventLifecycleChangeRecord[]> {
    return this.changes
      .filter((change) => change.canonicalEventId === canonicalEventId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async listByHistoryId(historyId: string): Promise<EventLifecycleChangeRecord[]> {
    return this.changes.filter((change) => change.historyId === historyId);
  }
}
