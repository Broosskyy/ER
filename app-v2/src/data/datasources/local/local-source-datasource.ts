import type { SourceRecord, SourceListParams, PaginatedResult } from '@/data/types/records';
import type { SourceDatasource } from '@/data/datasources/types';
import {
  applySourceListParams,
  createDefaultSourceRecord,
  mapSourceRecordToRow,
  mapSourceRowToRecord,
  type SourceRow,
} from '@/data/mappers/source-mapper';
import { buildSourceSlugBase } from '@/features/sources/domain/source-slug';

export function createLocalSourceDatasource(
  getItems: () => SourceRecord[],
  setItems: (items: SourceRecord[]) => void,
): SourceDatasource {
  return {
    async getAll() {
      return [...getItems()];
    },
    async getActive() {
      return getItems().filter((source) => source.enabled && !source.archived);
    },
    async getById(id) {
      return getItems().find((source) => source.id === id) ?? null;
    },
    async getBySlug(slug) {
      return getItems().find((source) => source.slug === slug) ?? null;
    },
    async list(params: SourceListParams): Promise<PaginatedResult<SourceRecord>> {
      return applySourceListParams(getItems(), params);
    },
    async save(item) {
      const items = getItems();
      const index = items.findIndex((source) => source.id === item.id);
      const next = {
        ...item,
        slug: item.slug || buildSourceSlugBase(item.displayName),
        updatedAt: new Date().toISOString(),
      };
      if (index >= 0) {
        items[index] = next;
      } else {
        items.push(next);
      }
      setItems([...items]);
      return next;
    },
    async archive(id) {
      const items = getItems();
      const index = items.findIndex((source) => source.id === id);
      if (index < 0) {
        return null;
      }
      const archived = {
        ...items[index]!,
        archived: true,
        enabled: false,
        updatedAt: new Date().toISOString(),
      };
      items[index] = archived;
      setItems([...items]);
      return archived;
    },
    async restore(id) {
      const items = getItems();
      const index = items.findIndex((source) => source.id === id);
      if (index < 0) {
        return null;
      }
      const restored = {
        ...items[index]!,
        archived: false,
        updatedAt: new Date().toISOString(),
      };
      items[index] = restored;
      setItems([...items]);
      return restored;
    },
    async countImportJobsForSource(_sourceId: string) {
      return 0;
    },
  };
}

export function buildLocalSeedSources(): SourceRecord[] {
  return [
    createDefaultSourceRecord('demo', 'Demo Source', {
      slug: 'demo-source',
      sourceType: 'manual',
      parserType: 'unknown',
      trustScore: 100,
      priority: 80,
    }),
    createDefaultSourceRecord('admin', 'Admin', {
      slug: 'admin',
      sourceType: 'manual',
      parserType: 'unknown',
      trustScore: 100,
      priority: 90,
    }),
  ];
}

export type { SourceRow };
