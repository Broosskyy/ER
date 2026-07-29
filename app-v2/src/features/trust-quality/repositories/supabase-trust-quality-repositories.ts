import {
  getRawSupabaseClient,
  resultOrThrow,
} from '@/data/supabase/supabase-query-client';
import type {
  ImportReviewQueueEntry,
  ImportReviewQueueRepository,
  SourceReputationEvent,
  SourceReputationRepository,
  TrustQualityRule,
  TrustQualityRuleRepository,
} from '../domain/trust-quality-types';

function mapRuleRow(row: Record<string, unknown>): TrustQualityRule {
  return {
    id: String(row.id),
    ruleKey: String(row.rule_key),
    category: row.category as TrustQualityRule['category'],
    severity: row.severity as TrustQualityRule['severity'],
    decisionImpact: row.decision_impact as TrustQualityRule['decisionImpact'],
    enabled: Boolean(row.enabled),
    weight: Number(row.weight ?? 1),
    config: (row.config as Record<string, unknown> | undefined) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapReviewRow(row: Record<string, unknown>): ImportReviewQueueEntry {
  return {
    id: String(row.id),
    importRecordId: String(row.import_record_id),
    importJobId: row.import_job_id ? String(row.import_job_id) : undefined,
    sourceId: String(row.source_id),
    externalEventId: String(row.external_event_id),
    status: row.status as ImportReviewQueueEntry['status'],
    decision: row.decision as ImportReviewQueueEntry['decision'],
    qualityScore: row.quality_score != null ? Number(row.quality_score) : undefined,
    trustScore: row.trust_score != null ? Number(row.trust_score) : undefined,
    reasons: (row.reasons as string[] | undefined) ?? [],
    affectedFields: (row.affected_fields as string[] | undefined) ?? [],
    ruleIds: (row.rule_ids as string[] | undefined) ?? [],
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapReputationRow(row: Record<string, unknown>): SourceReputationEvent {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    eventType: row.event_type as SourceReputationEvent['eventType'],
    delta: Number(row.delta ?? 0),
    previousTrustScore: Number(row.previous_trust_score ?? 0),
    newTrustScore: Number(row.new_trust_score ?? 0),
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
    createdAt: String(row.created_at),
  };
}

export class SupabaseTrustQualityRuleRepository implements TrustQualityRuleRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async listEnabled(): Promise<TrustQualityRule[]> {
    const result = await this.client()
      .from('trust_quality_rules')
      .select('*')
      .eq('enabled', true);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapRuleRow);
  }

  async listAll(): Promise<TrustQualityRule[]> {
    const result = await this.client().from('trust_quality_rules').select('*');
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapRuleRow);
  }
}

export class SupabaseImportReviewQueueRepository implements ImportReviewQueueRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async upsert(entry: ImportReviewQueueEntry): Promise<ImportReviewQueueEntry> {
    const result = await this.client()
      .from('import_review_queue')
      .upsert(
        {
          id: entry.id,
          import_record_id: entry.importRecordId,
          import_job_id: entry.importJobId ?? null,
          source_id: entry.sourceId,
          external_event_id: entry.externalEventId,
          status: entry.status,
          decision: entry.decision,
          quality_score: entry.qualityScore ?? null,
          trust_score: entry.trustScore ?? null,
          reasons: entry.reasons,
          affected_fields: entry.affectedFields,
          rule_ids: entry.ruleIds,
          metadata: entry.metadata ?? {},
          created_at: entry.createdAt,
          updated_at: entry.updatedAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapReviewRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async findByImportRecordId(importRecordId: string): Promise<ImportReviewQueueEntry | null> {
    const result = await this.client()
      .from('import_review_queue')
      .select('*')
      .eq('import_record_id', importRecordId)
      .maybeSingle();
    const row = resultOrThrow(result) as Record<string, unknown> | null;
    return row ? mapReviewRow(row) : null;
  }

  async findActiveBySourceAndExternalEventId(
    sourceId: string,
    externalEventId: string,
  ): Promise<ImportReviewQueueEntry | null> {
    const result = await this.client()
      .from('import_review_queue')
      .select('*')
      .eq('source_id', sourceId)
      .eq('external_event_id', externalEventId)
      .in('status', ['pending', 'on_hold'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = resultOrThrow(result) as Record<string, unknown> | null;
    return row ? mapReviewRow(row) : null;
  }

  async listBySourceId(sourceId: string, limit = 50): Promise<ImportReviewQueueEntry[]> {
    const result = await this.client()
      .from('import_review_queue')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapReviewRow);
  }

  async listPending(limit = 100): Promise<ImportReviewQueueEntry[]> {
    const result = await this.client()
      .from('import_review_queue')
      .select('*')
      .in('status', ['pending', 'on_hold'])
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapReviewRow);
  }
}

export class SupabaseSourceReputationRepository implements SourceReputationRepository {
  private client() {
    return getRawSupabaseClient();
  }

  async create(event: SourceReputationEvent): Promise<SourceReputationEvent> {
    const result = await this.client()
      .from('source_reputation_events')
      .upsert(
        {
          id: event.id,
          source_id: event.sourceId,
          event_type: event.eventType,
          delta: event.delta,
          previous_trust_score: event.previousTrustScore,
          new_trust_score: event.newTrustScore,
          metadata: event.metadata ?? {},
          created_at: event.createdAt,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    return mapReputationRow(resultOrThrow(result) as Record<string, unknown>);
  }

  async listBySourceId(sourceId: string, limit = 50): Promise<SourceReputationEvent[]> {
    const result = await this.client()
      .from('source_reputation_events')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    const rows = (resultOrThrow(result) as Record<string, unknown>[] | null) ?? [];
    return rows.map(mapReputationRow);
  }
}
