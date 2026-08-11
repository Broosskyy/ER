import type { ImportRecordRepository } from '@/data/repositories/import-repositories';
import type { ImportRecord } from '@/features/import/models/types';

import type { ImportDraft } from './import-draft';
import {
  mapImportDraftToRecordInput,
  mapImportRecordToDraft,
  readImportDraftEnvelope,
  type ImportDraftRecordContext,
} from './import-draft-record-mapper';

export type ImportDraftRecordPersistenceMode =
  | 'read_only'
  | 'import_records_only';

export interface ImportDraftRecordPersistenceResult {
  draft: ImportDraft;
  record?: ImportRecord;
  databaseWriteOperations: number;
  productionMutations: 0;
  wroteEventsTable: false;
  message: string;
}

export interface ImportDraftRecordPersistence {
  persist(
    draft: ImportDraft,
    context: ImportDraftRecordContext,
  ): Promise<ImportDraftRecordPersistenceResult>;
  readByRecordId(recordId: string): Promise<ImportDraft | null>;
  listLatestBySourceId(sourceId: string): Promise<ImportDraft[]>;
}

export class NoopImportDraftRecordPersistence
  implements ImportDraftRecordPersistence
{
  async persist(
    draft: ImportDraft,
    _context: ImportDraftRecordContext,
  ): Promise<ImportDraftRecordPersistenceResult> {
    return {
      draft,
      databaseWriteOperations: 0,
      productionMutations: 0,
      wroteEventsTable: false,
      message: 'dry_run_noop:persist_draft',
    };
  }

  async readByRecordId(_recordId: string): Promise<ImportDraft | null> {
    return null;
  }

  async listLatestBySourceId(_sourceId: string): Promise<ImportDraft[]> {
    return [];
  }
}

/**
 * Production-capable adapter constrained to import_records.
 * It has no event repository dependency and therefore cannot publish events.
 */
export class ImportRecordDraftPersistence
  implements ImportDraftRecordPersistence
{
  constructor(
    private readonly records: ImportRecordRepository,
    private readonly mode: ImportDraftRecordPersistenceMode = 'read_only',
  ) {}

  async persist(
    draft: ImportDraft,
    context: ImportDraftRecordContext,
  ): Promise<ImportDraftRecordPersistenceResult> {
    const initialInput = mapImportDraftToRecordInput(draft, context);
    const existing = await this.records.findLatestBySourceAndExternalId(
      context.sourceId,
      initialInput.externalId,
    );
    const previousEnvelope = existing
      ? readImportDraftEnvelope(existing) ?? undefined
      : undefined;
    const input = mapImportDraftToRecordInput(
      draft,
      context,
      previousEnvelope,
    );

    if (this.mode === 'read_only') {
      const mappedDraft = previousEnvelope?.draft ?? draft;
      return {
        draft: existing
          ? { ...mappedDraft, persistenceRecordId: existing.id }
          : mappedDraft,
        record: existing ?? undefined,
        databaseWriteOperations: 0,
        productionMutations: 0,
        wroteEventsTable: false,
        message: 'mutation_guard:import_records_read_only',
      };
    }

    const [record] = await this.records.upsertManyBySourceExternal([input]);
    if (!record) {
      throw new Error('import_draft_persistence_returned_no_record');
    }
    const persistedDraft = mapImportRecordToDraft(record);
    if (!persistedDraft) {
      throw new Error('persisted_import_draft_could_not_be_read');
    }
    return {
      draft: persistedDraft,
      record,
      databaseWriteOperations: 1,
      productionMutations: 0,
      wroteEventsTable: false,
      message: existing ? 'import_draft_updated' : 'import_draft_created',
    };
  }

  async readByRecordId(recordId: string): Promise<ImportDraft | null> {
    const record = await this.records.getById(recordId);
    return record ? mapImportRecordToDraft(record) : null;
  }

  async listLatestBySourceId(sourceId: string): Promise<ImportDraft[]> {
    return (await this.records.listLatestBySourceId(sourceId))
      .map(mapImportRecordToDraft)
      .filter((draft): draft is ImportDraft => draft !== null);
  }
}
