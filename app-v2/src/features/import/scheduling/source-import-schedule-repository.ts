import type { AdminSourceRepository } from '@/data/repositories/repositories';
import type { SourceRecord } from '@/data/types/records';
import { getSupabaseClient } from '@/services/supabase/client';
import type { ImportScheduleLock, ImportScheduleRepository, ImportScheduleState } from './import-schedule-types';
import {
  applyScheduleStateToSourceRecord,
  mapSourceRecordToScheduleState,
} from './source-schedule-mapper';

type RawResult = {
  data: unknown;
  error: { message: string } | null;
};

interface RawQuery extends PromiseLike<RawResult> {
  select(columns?: string): RawQuery;
  eq(column: string, value: unknown): RawQuery;
  lt(column: string, value: unknown): RawQuery;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): RawQuery;
  delete(): RawQuery;
  maybeSingle(): Promise<RawResult>;
}

type RawClient = { from(table: string): RawQuery };

function resultOrThrow(result: RawResult): unknown {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data;
}

export class SourceBackedImportScheduleRepository implements ImportScheduleRepository {
  constructor(private readonly sourceRepository: AdminSourceRepository) {}

  async getState(sourceId: string): Promise<ImportScheduleState | null> {
    const source = await this.sourceRepository.getById(sourceId);
    return source ? mapSourceRecordToScheduleState(source) : null;
  }

  async listStates(): Promise<ImportScheduleState[]> {
    const result = await this.sourceRepository.list({ page: 1, pageSize: 10_000 });
    return result.items
      .filter((source) => source.enabled && !source.archived)
      .map(mapSourceRecordToScheduleState);
  }

  async saveState(state: ImportScheduleState): Promise<void> {
    const source = await this.sourceRepository.getById(state.sourceId);
    if (!source) {
      throw new Error(`Source ${state.sourceId} not found.`);
    }
    await this.sourceRepository.save(applyScheduleStateToSourceRecord(source, state));
  }

  async tryAcquireLock(sourceId: string, leaseId: string, expiresAt: string): Promise<boolean> {
    const client = getSupabaseClient() as unknown as RawClient;
    const now = new Date().toISOString();
    const existing = await client
      .from('import_schedule_locks')
      .select('*')
      .eq('source_id', sourceId)
      .maybeSingle();
    const row = resultOrThrow(existing) as ImportScheduleLock | null;
    if (row && new Date(row.expiresAt).getTime() > Date.now()) {
      return false;
    }

    const upsert = await client.from('import_schedule_locks').upsert(
      {
        source_id: sourceId,
        lease_id: leaseId,
        acquired_at: now,
        expires_at: expiresAt,
      },
      { onConflict: 'source_id' },
    );
    resultOrThrow(upsert);
    return true;
  }

  async releaseLock(sourceId: string, leaseId: string): Promise<void> {
    const client = getSupabaseClient() as unknown as RawClient;
    const existing = await client
      .from('import_schedule_locks')
      .select('*')
      .eq('source_id', sourceId)
      .maybeSingle();
    const row = resultOrThrow(existing) as { lease_id?: string } | null;
    if (row?.lease_id !== leaseId) {
      return;
    }
    const removed = await client.from('import_schedule_locks').delete().eq('source_id', sourceId);
    resultOrThrow(removed);
  }

  async releaseExpiredLocks(now = new Date()): Promise<number> {
    const client = getSupabaseClient() as unknown as RawClient;
    const result = await client
      .from('import_schedule_locks')
      .select('source_id')
      .lt('expires_at', now.toISOString());
    const rows = (resultOrThrow(result) as Array<{ source_id: string }> | null) ?? [];
    for (const row of rows) {
      await client.from('import_schedule_locks').delete().eq('source_id', row.source_id);
    }
    return rows.length;
  }
}

export class InMemorySourceBackedImportScheduleRepository implements ImportScheduleRepository {
  private readonly locks = new Map<string, ImportScheduleLock>();

  constructor(private readonly sources: Map<string, SourceRecord>) {}

  async getState(sourceId: string): Promise<ImportScheduleState | null> {
    const source = this.sources.get(sourceId);
    return source ? mapSourceRecordToScheduleState(source) : null;
  }

  async listStates(): Promise<ImportScheduleState[]> {
    return [...this.sources.values()]
      .filter((source) => source.enabled && !source.archived)
      .map(mapSourceRecordToScheduleState);
  }

  async saveState(state: ImportScheduleState): Promise<void> {
    const source = this.sources.get(state.sourceId);
    if (!source) {
      throw new Error(`Source ${state.sourceId} not found.`);
    }
    this.sources.set(state.sourceId, applyScheduleStateToSourceRecord(source, state));
  }

  async tryAcquireLock(sourceId: string, leaseId: string, expiresAt: string): Promise<boolean> {
    const existing = this.locks.get(sourceId);
    if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
      return false;
    }
    this.locks.set(sourceId, {
      sourceId,
      leaseId,
      acquiredAt: new Date().toISOString(),
      expiresAt,
    });
    return true;
  }

  async releaseLock(sourceId: string, leaseId: string): Promise<void> {
    const existing = this.locks.get(sourceId);
    if (existing?.leaseId === leaseId) {
      this.locks.delete(sourceId);
    }
  }

  async releaseExpiredLocks(now = new Date()): Promise<number> {
    let released = 0;
    for (const [sourceId, lock] of this.locks.entries()) {
      if (new Date(lock.expiresAt).getTime() <= now.getTime()) {
        this.locks.delete(sourceId);
        released += 1;
      }
    }
    return released;
  }
}
