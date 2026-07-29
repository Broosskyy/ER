import {
  getRawSupabaseClient,
  resultOrThrow,
} from '@/data/supabase/supabase-query-client';
import type {
  EventBlockingKeyEntry,
  EventBlockingKeyRepository,
  EventMatchEvaluationRepository,
  EventMergeCandidate,
  EventMergeCandidateRepository,
  MultiSourceMatchEvaluation,
} from '../domain/matching-types';

function mapBlockingKeyRow(row: Record<string, unknown>): EventBlockingKeyEntry {
  return {
    id: String(row.id),
    canonicalEventId: String(row.canonical_event_id),
    blockingKey: String(row.blocking_key),
    createdAt: String(row.created_at),
  };
}

function mapEvaluationRow(row: Record<string, unknown>): MultiSourceMatchEvaluation {
  return {
    id: String(row.id),
    importRecordId: row.import_record_id ? String(row.import_record_id) : undefined,
    importJobId: row.import_job_id ? String(row.import_job_id) : undefined,
    sourceId: String(row.source_id),
    externalEventId: String(row.external_event_id),
    canonicalEventId: row.canonical_event_id ? String(row.canonical_event_id) : undefined,
    confidenceScore: Number(row.confidence_score ?? 0),
    confidenceTier: row.confidence_tier as MultiSourceMatchEvaluation['confidenceTier'],
    decision: row.decision as MultiSourceMatchEvaluation['decision'],
    reasons: (row.match_reasons as string[] | undefined) ?? [],
    signals: (row.match_signals as MultiSourceMatchEvaluation['signals'] | undefined) ?? [],
    fieldDifferences:
      (row.field_differences as MultiSourceMatchEvaluation['fieldDifferences'] | undefined) ?? [],
    involvedSourceIds: (row.involved_source_ids as string[] | undefined) ?? [],
    fingerprintSnapshot:
      (row.fingerprint_snapshot as Record<string, string> | undefined) ?? {},
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
    createdAt: String(row.created_at),
  };
}

function mapMergeCandidateRow(row: Record<string, unknown>): EventMergeCandidate {
  return {
    id: String(row.id),
    evaluationId: String(row.evaluation_id),
    canonicalEventId: String(row.canonical_event_id),
    sourceId: String(row.source_id),
    externalEventId: String(row.external_event_id),
    confidenceScore: Number(row.confidence_score ?? 0),
    status: row.status as EventMergeCandidate['status'],
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SupabaseEventBlockingKeyRepository implements EventBlockingKeyRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async indexKeys(canonicalEventId: string, blockingKeys: string[]): Promise<EventBlockingKeyEntry[]> {
    const now = new Date().toISOString();
    const created: EventBlockingKeyEntry[] = [];
    for (const blockingKey of blockingKeys) {
      if (!blockingKey || blockingKey.endsWith(':')) {
        continue;
      }
      const id = `bk-${canonicalEventId}-${blockingKey}`;
      const result = await this.client()
        .from('event_blocking_keys')
        .upsert(
          {
            id,
            canonical_event_id: canonicalEventId,
            blocking_key: blockingKey,
            created_at: now,
          },
          { onConflict: 'id' },
        )
        .select('*')
        .single();
      created.push(mapBlockingKeyRow(resultOrThrow(result) as Record<string, unknown>));
    }
    return created;
  }

  async findCanonicalEventIdsByKeys(blockingKeys: string[]): Promise<string[]> {
    const keys = blockingKeys.filter((key) => key && !key.endsWith(':'));
    if (keys.length === 0) {
      return [];
    }
    const result = await this.client()
      .from('event_blocking_keys')
      .select('canonical_event_id')
      .in('blocking_key', keys);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return [...new Set(rows.map((row) => String(row.canonical_event_id)))];
  }

  async listByCanonicalEventId(canonicalEventId: string): Promise<EventBlockingKeyEntry[]> {
    const result = await this.client()
      .from('event_blocking_keys')
      .select('*')
      .eq('canonical_event_id', canonicalEventId);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapBlockingKeyRow);
  }
}

export class SupabaseEventMatchEvaluationRepository implements EventMatchEvaluationRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async create(evaluation: MultiSourceMatchEvaluation): Promise<MultiSourceMatchEvaluation> {
    const result = await this.client()
      .from('event_match_evaluations')
      .upsert(
        {
          id: evaluation.id,
          import_record_id: evaluation.importRecordId ?? null,
          import_job_id: evaluation.importJobId ?? null,
          source_id: evaluation.sourceId,
          external_event_id: evaluation.externalEventId,
          canonical_event_id: evaluation.canonicalEventId ?? null,
          confidence_score: evaluation.confidenceScore,
          confidence_tier: evaluation.confidenceTier,
          decision: evaluation.decision,
          match_reasons: evaluation.reasons,
          match_signals: evaluation.signals,
          field_differences: evaluation.fieldDifferences,
          involved_source_ids: evaluation.involvedSourceIds,
          fingerprint_snapshot: evaluation.fingerprintSnapshot,
          metadata: evaluation.metadata ?? {},
          created_at: evaluation.createdAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapEvaluationRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async findByImportRecordId(importRecordId: string): Promise<MultiSourceMatchEvaluation | null> {
    const result = await this.client()
      .from('event_match_evaluations')
      .select('*')
      .eq('import_record_id', importRecordId)
      .maybeSingle();
    const row = resultOrThrow(result) as Record<string, unknown> | null;
    return row ? mapEvaluationRow(row) : null;
  }

  async listByCanonicalEventId(
    canonicalEventId: string,
    limit = 50,
  ): Promise<MultiSourceMatchEvaluation[]> {
    const result = await this.client()
      .from('event_match_evaluations')
      .select('*')
      .eq('canonical_event_id', canonicalEventId)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapEvaluationRow);
  }

  async listBySourceId(sourceId: string, limit = 50): Promise<MultiSourceMatchEvaluation[]> {
    const result = await this.client()
      .from('event_match_evaluations')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapEvaluationRow);
  }

  async listRecent(limit = 100): Promise<MultiSourceMatchEvaluation[]> {
    const result = await this.client()
      .from('event_match_evaluations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapEvaluationRow);
  }
}

export class SupabaseEventMergeCandidateRepository implements EventMergeCandidateRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async upsert(candidate: EventMergeCandidate): Promise<EventMergeCandidate> {
    const result = await this.client()
      .from('event_merge_candidates')
      .upsert(
        {
          id: candidate.id,
          evaluation_id: candidate.evaluationId,
          canonical_event_id: candidate.canonicalEventId,
          source_id: candidate.sourceId,
          external_event_id: candidate.externalEventId,
          confidence_score: candidate.confidenceScore,
          status: candidate.status,
          metadata: candidate.metadata ?? {},
          created_at: candidate.createdAt,
          updated_at: candidate.updatedAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapMergeCandidateRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async listByCanonicalEventId(
    canonicalEventId: string,
    limit = 50,
  ): Promise<EventMergeCandidate[]> {
    const result = await this.client()
      .from('event_merge_candidates')
      .select('*')
      .eq('canonical_event_id', canonicalEventId)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapMergeCandidateRow);
  }

  async listPending(limit = 100): Promise<EventMergeCandidate[]> {
    const result = await this.client()
      .from('event_merge_candidates')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapMergeCandidateRow);
  }
}
