import {
  getRawSupabaseClient,
  resultOrThrow,
} from '@/data/supabase/supabase-query-client';
import type {
  EventLifecycleChangeRecord,
  EventLifecycleHistoryEntry,
} from '../domain/lifecycle-engine-types';
import type {
  EventLifecycleChangeRepository,
  EventLifecycleHistoryRepository,
} from '../domain/lifecycle-engine-types';

function mapHistoryRow(row: Record<string, unknown>): EventLifecycleHistoryEntry {
  return {
    id: String(row.id),
    canonicalEventId: String(row.canonical_event_id),
    lifecycleEventType: row.lifecycle_event_type as EventLifecycleHistoryEntry['lifecycleEventType'],
    decision: row.decision as EventLifecycleHistoryEntry['decision'],
    sourceId: row.source_id ? String(row.source_id) : undefined,
    importJobId: row.import_job_id ? String(row.import_job_id) : undefined,
    importRecordId: row.import_record_id ? String(row.import_record_id) : undefined,
    confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : undefined,
    lifecycleStatusBefore: row.lifecycle_status_before
      ? String(row.lifecycle_status_before)
      : undefined,
    lifecycleStatusAfter: row.lifecycle_status_after
      ? String(row.lifecycle_status_after)
      : undefined,
    changeCount: Number(row.change_count ?? 0),
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
    createdAt: String(row.created_at),
  };
}

function mapChangeRow(row: Record<string, unknown>): EventLifecycleChangeRecord {
  return {
    id: String(row.id),
    historyId: String(row.history_id),
    canonicalEventId: String(row.canonical_event_id),
    fieldPath: String(row.field_path),
    oldValue: row.old_value,
    newValue: row.new_value,
    severity: row.severity as EventLifecycleChangeRecord['severity'],
    provenanceSourceId: row.provenance_source_id ? String(row.provenance_source_id) : undefined,
    createdAt: String(row.created_at),
  };
}

export class SupabaseEventLifecycleHistoryRepository implements EventLifecycleHistoryRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async create(entry: EventLifecycleHistoryEntry): Promise<EventLifecycleHistoryEntry> {
    const result = await this.client()
      .from('event_lifecycle_history')
      .upsert(
        {
          id: entry.id,
          canonical_event_id: entry.canonicalEventId,
          lifecycle_event_type: entry.lifecycleEventType,
          decision: entry.decision,
          source_id: entry.sourceId ?? null,
          import_job_id: entry.importJobId ?? null,
          import_record_id: entry.importRecordId ?? null,
          confidence_score: entry.confidenceScore ?? null,
          lifecycle_status_before: entry.lifecycleStatusBefore ?? null,
          lifecycle_status_after: entry.lifecycleStatusAfter ?? null,
          change_count: entry.changeCount,
          metadata: entry.metadata ?? {},
          created_at: entry.createdAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapHistoryRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async listByCanonicalEventId(
    canonicalEventId: string,
    limit = 100,
  ): Promise<EventLifecycleHistoryEntry[]> {
    const result = await this.client()
      .from('event_lifecycle_history')
      .select('*')
      .eq('canonical_event_id', canonicalEventId)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapHistoryRow);
  }

  async listBySourceId(sourceId: string, limit = 100): Promise<EventLifecycleHistoryEntry[]> {
    const result = await this.client()
      .from('event_lifecycle_history')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapHistoryRow);
  }

  async listRecent(limit = 100): Promise<EventLifecycleHistoryEntry[]> {
    const result = await this.client()
      .from('event_lifecycle_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapHistoryRow);
  }
}

export class SupabaseEventLifecycleChangeRepository implements EventLifecycleChangeRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async createMany(changes: EventLifecycleChangeRecord[]): Promise<EventLifecycleChangeRecord[]> {
    if (changes.length === 0) {
      return [];
    }
    const result = await this.client()
      .from('event_lifecycle_changes')
      .upsert(
        changes.map((change) => ({
          id: change.id,
          history_id: change.historyId,
          canonical_event_id: change.canonicalEventId,
          field_path: change.fieldPath,
          old_value: change.oldValue ?? null,
          new_value: change.newValue ?? null,
          severity: change.severity,
          provenance_source_id: change.provenanceSourceId ?? null,
          created_at: change.createdAt,
        })),
        { onConflict: 'id' },
      )
      .select('*');
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapChangeRow);
  }

  async listByCanonicalEventId(
    canonicalEventId: string,
    limit = 200,
  ): Promise<EventLifecycleChangeRecord[]> {
    const result = await this.client()
      .from('event_lifecycle_changes')
      .select('*')
      .eq('canonical_event_id', canonicalEventId)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapChangeRow);
  }

  async listByHistoryId(historyId: string): Promise<EventLifecycleChangeRecord[]> {
    const result = await this.client()
      .from('event_lifecycle_changes')
      .select('*')
      .eq('history_id', historyId);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapChangeRow);
  }
}
