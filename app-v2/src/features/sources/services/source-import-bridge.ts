import type { LocalImportStore } from '@/data/datasources/local/local-import-datasource';
import type { PaginatedResult, SourceListParams, SourceRecord } from '@/data/types/records';
import {
  applySourceListParams,
  mapImportSourceToSourceRecord,
  mapSourceRecordToImportSource,
} from '@/data/mappers/source-mapper';
import { SourceService } from '@/features/sources/services/source-service';

/** Test helper: wires SourceService to an isolated local import store. */
export function createSourceServiceFromImportStore(store: LocalImportStore): SourceService {
  const toRecords = () => store.sources.map((source) => mapImportSourceToSourceRecord(source));

  const readRecord = (id: string): SourceRecord | null => {
    const source = store.sources.find((entry) => entry.id === id);
    return source ? mapImportSourceToSourceRecord(source) : null;
  };

  const repository = {
    async list(params: SourceListParams): Promise<PaginatedResult<SourceRecord>> {
      return applySourceListParams(toRecords(), params);
    },
    async getById(id: string) {
      return readRecord(id);
    },
    async getBySlug(slug: string) {
      return toRecords().find((record) => record.slug === slug) ?? null;
    },
    async getAll() {
      return toRecords();
    },
    async save(record: SourceRecord) {
      const importSource = mapSourceRecordToImportSource(record);
      const index = store.sources.findIndex((entry) => entry.id === record.id);
      if (index >= 0) {
        store.sources[index] = importSource;
      } else {
        store.sources.push(importSource);
      }
      return record;
    },
    async archive(id: string) {
      const existing = readRecord(id);
      if (!existing) {
        return null;
      }
      const archived: SourceRecord = {
        ...existing,
        archived: true,
        enabled: false,
        updatedAt: new Date().toISOString(),
      };
      await repository.save(archived);
      return archived;
    },
    async restore(id: string) {
      const existing = readRecord(id);
      if (!existing) {
        return null;
      }
      const restored: SourceRecord = {
        ...existing,
        archived: false,
        updatedAt: new Date().toISOString(),
      };
      await repository.save(restored);
      return restored;
    },
    async countImportJobsForSource(sourceId: string) {
      return store.jobs.filter((job) => job.sourceId === sourceId).length;
    },
  };

  return new SourceService(repository);
}
