import { describe, expect, it, vi, beforeEach } from 'vitest';

import type {
  EntityIdentityAliasRow,
  EntityResolutionDecisionRow,
  SupabaseEntityAliasDatasource,
} from '@/data/datasources/supabase/supabase-entity-alias-datasource';
import { SupabaseEntityAliasStore } from '@/features/entity-resolution/supabase-entity-alias-store';
import { EntityAliasStoreError } from '@/features/entity-resolution/entity-alias-store-error';

function aliasRow(overrides: Partial<EntityIdentityAliasRow> = {}): EntityIdentityAliasRow {
  return {
    id: 'alias-1',
    entity_type: 'organizer',
    canonical_id: 'org-1',
    alias_type: 'external_id',
    alias_value: 'ext-1',
    source_id: 'source-a',
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: 'admin',
    original_alias: null,
    locale: null,
    metadata: { note: 'seed' },
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function decisionRow(overrides: Partial<EntityResolutionDecisionRow> = {}): EntityResolutionDecisionRow {
  return {
    id: 'decision-1',
    entity_type: 'venue',
    candidate_key: 'name=bootshaus',
    decision: 'keep_separate',
    canonical_id: null,
    decided_by: 'admin',
    decided_at: '2026-01-01T00:00:00.000Z',
    reason: 'distinct profile',
    source_id: 'source-a',
    source_external_id: null,
    candidate_entity_id: null,
    confidence: null,
    normalized_input: 'name=bootshaus',
    metadata: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('SupabaseEntityAliasStore', () => {
  let datasource: SupabaseEntityAliasDatasource;

  beforeEach(() => {
    datasource = {
      listAliases: vi.fn(async () => [aliasRow()]),
      listDecisions: vi.fn(async () => [decisionRow()]),
      findAliasByUniqueKey: vi.fn(async () => null),
      upsertAlias: vi.fn(async (row) => row),
      upsertDecision: vi.fn(async (row) => row),
    } as unknown as SupabaseEntityAliasDatasource;
  });

  it('hydrates cache on initialize and serves reads synchronously', async () => {
    const store = new SupabaseEntityAliasStore(datasource);
    await store.initialize();

    expect(store.isInitialized()).toBe(true);
    expect(store.findCanonicalId('organizer', 'external_id', 'ext-1', 'source-a')).toBe('org-1');
    expect(store.getDecision('venue', 'name=bootshaus')?.decision).toBe('keep_separate');
  });

  it('persists alias writes via flush', async () => {
    const store = new SupabaseEntityAliasStore(datasource);
    await store.initialize();

    store.saveAlias({
      entityType: 'artist',
      canonicalId: 'artist-1',
      aliasType: 'normalized_name',
      aliasValue: 'dj alias',
      createdAt: '2026-01-02T00:00:00.000Z',
      metadata: { source: 'test' },
    });
    await store.flush();

    expect(datasource.upsertAlias).toHaveBeenCalledTimes(1);
    expect(store.findCanonicalId('artist', 'normalized_name', 'dj alias')).toBe('artist-1');
  });

  it('survives re-instantiation when datasource returns persisted rows', async () => {
    const rows: EntityIdentityAliasRow[] = [];
    datasource.listAliases = vi.fn(async () => rows);
    datasource.upsertAlias = vi.fn(async (row) => {
      rows.push(row);
      return row;
    });

    const first = new SupabaseEntityAliasStore(datasource);
    await first.initialize();
    first.saveAlias({
      entityType: 'organizer',
      canonicalId: 'org-persisted',
      aliasType: 'external_id',
      aliasValue: 'persisted-ext',
      sourceId: 'source-a',
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    await first.flush();

    const second = new SupabaseEntityAliasStore(datasource);
    await second.initialize();

    expect(second.findCanonicalId('organizer', 'external_id', 'persisted-ext', 'source-a')).toBe(
      'org-persisted',
    );
  });

  it('throws database_unavailable when initialize fails', async () => {
    datasource.listAliases = vi.fn(async () => {
      throw new Error('network down');
    });
    const store = new SupabaseEntityAliasStore(datasource);

    await expect(store.initialize()).rejects.toMatchObject({
      code: 'database_unavailable',
    });
  });

  it('rejects reads before initialize', () => {
    const store = new SupabaseEntityAliasStore(datasource);
    expect(() => store.findCanonicalId('organizer', 'external_id', 'ext-1')).toThrow(
      EntityAliasStoreError,
    );
  });
});
