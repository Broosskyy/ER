export const SOURCE_IMPORT_HISTORY_STATUSES = [
  'completed',
  'failed',
  'partial',
  'cancelled',
] as const;

export type SourceImportHistoryStatus = (typeof SOURCE_IMPORT_HISTORY_STATUSES)[number];

export interface SourceImportHistoryEntry {
  id: string;
  sourceId: string;
  startedAt: string;
  completedAt: string;
  status: SourceImportHistoryStatus;
  durationMs: number;
  eventCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
  errors: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  connectorKey?: string;
  connectorVersion?: string;
  testImport: boolean;
}

export interface SourceImportHistoryStore {
  listForSource(sourceId: string): SourceImportHistoryEntry[];
  append(entry: SourceImportHistoryEntry): void;
  getLatest(sourceId: string): SourceImportHistoryEntry | null;
  clear(sourceId?: string): void;
}

export class InMemorySourceImportHistoryStore implements SourceImportHistoryStore {
  private readonly entries = new Map<string, SourceImportHistoryEntry[]>();

  listForSource(sourceId: string): SourceImportHistoryEntry[] {
    return [...(this.entries.get(sourceId) ?? [])].sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt),
    );
  }

  append(entry: SourceImportHistoryEntry): void {
    const current = this.entries.get(entry.sourceId) ?? [];
    current.push(entry);
    this.entries.set(entry.sourceId, current);
  }

  getLatest(sourceId: string): SourceImportHistoryEntry | null {
    const items = this.listForSource(sourceId);
    return items[0] ?? null;
  }

  clear(sourceId?: string): void {
    if (sourceId) {
      this.entries.delete(sourceId);
      return;
    }
    this.entries.clear();
  }
}

export const sourceImportHistoryStore = new InMemorySourceImportHistoryStore();
