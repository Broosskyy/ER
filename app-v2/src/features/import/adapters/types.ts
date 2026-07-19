import type { ImportSource } from '@/features/import/models/types';

export interface ImportFetchedRecord {
  externalId: string;
  rawPayload: Record<string, unknown>;
}

export interface ImportSourceAdapter {
  readonly adapterKey: string;
  fetchRecords(source: ImportSource): Promise<ImportFetchedRecord[]>;
}
