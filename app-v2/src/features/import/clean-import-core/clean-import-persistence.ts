import type { CleanImportRunResult } from './clean-multi-source-import-service';

export interface CleanImportPersistenceResult {
  databaseWriteOperations: number;
}

export interface CleanImportPersistence {
  persist(result: CleanImportRunResult): Promise<CleanImportPersistenceResult>;
}

/** Explicit read-only boundary used until a production writer is approved. */
export class NoopCleanImportPersistence implements CleanImportPersistence {
  async persist(_result: CleanImportRunResult): Promise<CleanImportPersistenceResult> {
    return { databaseWriteOperations: 0 };
  }
}
