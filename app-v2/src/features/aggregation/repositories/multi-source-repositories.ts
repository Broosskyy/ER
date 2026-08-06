import { AppError } from '@/core/errors/app-error';
import type { SourceReference } from '@/features/aggregation/identity/event-identity';
import type {
  DuplicateDecision,
  EventConflict,
  FieldProvenance,
} from '@/features/aggregation/merge/event-conflict';
import { getSupabaseClient } from '@/services/supabase/client';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EventSourceReferenceRepository {
  create(reference: SourceReference & { id: string; canonicalEventId: string }): Promise<SourceReference>;
  createMany(references: (SourceReference & { id: string; canonicalEventId: string })[]): Promise<SourceReference[]>;
  findByCanonicalEventId(canonicalEventId: string): Promise<SourceReference[]>;
  findBySourceId(sourceId: string): Promise<SourceReference[]>;
  findByExternalEventId(sourceId: string, externalEventId: string): Promise<SourceReference | null>;
  upsert(reference: SourceReference & { id: string; canonicalEventId: string }): Promise<SourceReference>;
  markInactive(sourceId: string, externalEventId: string): Promise<void>;
  updateLastSeen(sourceId: string, externalEventId: string, lastSeenAt: string): Promise<void>;
  listPaginated(page: number, pageSize: number): Promise<Page<SourceReference>>;
}

export interface FieldProvenanceRepository {
  upsertFieldSelection(provenance: FieldProvenance & { id: string; canonicalEventId: string; fieldPath: string }): Promise<FieldProvenance>;
  findByCanonicalEventId(canonicalEventId: string): Promise<FieldProvenance[]>;
  findByFieldPath(canonicalEventId: string, fieldPath: string): Promise<FieldProvenance | null>;
  listAlternatives(canonicalEventId: string, fieldPath: string): Promise<FieldProvenance['alternatives']>;
  setManualOverride(canonicalEventId: string, fieldPath: string, value: unknown, selectedAt: string): Promise<FieldProvenance>;
  clearManualOverride(canonicalEventId: string, fieldPath: string): Promise<void>;
}

export interface DuplicateDecisionRepository {
  createDecision(decision: DuplicateDecision): Promise<DuplicateDecision>;
  findByCandidateIds(candidateIds: string[]): Promise<DuplicateDecision | null>;
  findByCanonicalEventId(canonicalEventId: string): Promise<DuplicateDecision[]>;
  listPaginated(page: number, pageSize: number): Promise<Page<DuplicateDecision>>;
  reverseDecision(id: string, reversedAt: string): Promise<void>;
  findActiveKeptSeparateDecision(candidateIds: string[]): Promise<DuplicateDecision | null>;
}

export interface EventConflictRepository {
  create(conflict: EventConflict): Promise<EventConflict>;
  createMany(conflicts: EventConflict[]): Promise<EventConflict[]>;
  findById(id: string): Promise<EventConflict | null>;
  findByCanonicalEventId(canonicalEventId: string): Promise<EventConflict[]>;
  listUnresolved(canonicalEventId?: string): Promise<EventConflict[]>;
  resolve(id: string, resolution: string, resolvedAt: string): Promise<void>;
  reopen(id: string): Promise<void>;
  listPaginated(page: number, pageSize: number): Promise<Page<EventConflict>>;
}

type RawResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

interface RawQuery extends PromiseLike<RawResult> {
  select(columns?: string, options?: { count?: 'exact' }): RawQuery;
  eq(column: string, value: unknown): RawQuery;
  in(column: string, values: unknown[]): RawQuery;
  order(column: string, options?: { ascending?: boolean }): RawQuery;
  range(from: number, to: number): RawQuery;
  update(values: Record<string, unknown>): RawQuery;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): RawQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): RawQuery;
  maybeSingle(): Promise<RawResult>;
  single(): Promise<RawResult>;
}

type RawClient = { from(table: string): RawQuery };

function resultOrThrow(result: RawResult): unknown {
  if (result.error) {
    throw new AppError(result.error.message, {
      code: 'NETWORK',
      retryable: true,
      cause: result.error,
    });
  }
  return result.data;
}

function pageBounds(page: number, pageSize: number): { page: number; pageSize: number; from: number; to: number } {
  const normalizedPage = Math.max(1, page);
  const normalizedPageSize = Math.max(1, Math.min(100, pageSize));
  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    from: (normalizedPage - 1) * normalizedPageSize,
    to: normalizedPage * normalizedPageSize - 1,
  };
}

function referenceFromRow(row: Record<string, unknown>): SourceReference {
  const metadata = row.metadata;
  return {
    sourceId: String(row.source_id),
    externalEventId: String(row.external_event_id),
    canonicalEventId: row.canonical_event_id ? String(row.canonical_event_id) : undefined,
    originalUrl: row.original_url ? String(row.original_url) : undefined,
    rawRecordId: row.raw_record_id ? String(row.raw_record_id) : undefined,
    importJobId: row.import_job_id ? String(row.import_job_id) : undefined,
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
    lastChangedAt: row.last_changed_at ? String(row.last_changed_at) : undefined,
    active: Boolean(row.active),
    sourcePriority: Number(row.source_priority),
    sourceQuality: row.source_quality_score === null ? undefined : Number(row.source_quality_score),
    metadata:
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : undefined,
  };
}

function provenanceFromRow(row: Record<string, unknown>): FieldProvenance {
  return {
    value: row.selected_value,
    selectedSourceId: String(row.selected_source_id ?? ''),
    selectionReason: String(row.selection_reason),
    alternatives: Array.isArray(row.alternatives) ? row.alternatives as FieldProvenance['alternatives'] : [],
    lastChangedAt: String(row.updated_at),
    confidence: row.confidence != null ? Number(row.confidence) : undefined,
    freshnessAt: row.freshness_at ? String(row.freshness_at) : undefined,
    originExternalId: row.origin_external_id ? String(row.origin_external_id) : undefined,
    mergeDecision: row.merge_decision ? String(row.merge_decision) : undefined,
    selectedTier: row.selected_tier ? String(row.selected_tier) as FieldProvenance['selectedTier'] : undefined,
  };
}

function decisionFromRow(row: Record<string, unknown>): DuplicateDecision {
  return {
    id: String(row.id),
    candidateIds: Array.isArray(row.candidate_ids) ? row.candidate_ids.map(String) : [],
    sourceIds: Array.isArray(row.source_ids) ? row.source_ids.map(String) : [],
    canonicalEventId: row.canonical_event_id ? String(row.canonical_event_id) : undefined,
    decision: row.decision as DuplicateDecision['decision'],
    confidence: Number(row.confidence),
    reason: String(row.reason),
    decidedBy: row.decided_by ? String(row.decided_by) : undefined,
    decidedAt: String(row.decided_at),
    fingerprintSnapshot: (row.fingerprint_snapshot ?? {}) as Record<string, string>,
    reversible: Boolean(row.reversible),
    reversedAt: row.reversed_at ? String(row.reversed_at) : undefined,
  };
}

function conflictFromRow(row: Record<string, unknown>): EventConflict {
  return {
    id: String(row.id),
    canonicalEventId: String(row.canonical_event_id),
    field: String(row.field),
    values: Array.isArray(row.values) ? row.values as EventConflict['values'] : [],
    sourceIds: Array.isArray(row.source_ids) ? row.source_ids.map(String) : [],
    severity: row.severity as EventConflict['severity'],
    detectedAt: String(row.detected_at),
    resolved: Boolean(row.resolved),
    resolution: row.resolution ? String(row.resolution) : undefined,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
  };
}

export class SupabaseMultiSourceRepositories {
  private client(): RawClient {
    return getSupabaseClient() as unknown as RawClient;
  }

  readonly sourceReferences: EventSourceReferenceRepository = {
    create: (reference) => this.upsertReference(reference),
    createMany: async (references) => Promise.all(references.map((reference) => this.upsertReference(reference))),
    findByCanonicalEventId: (id) => this.listReferences('canonical_event_id', id),
    findBySourceId: (id) => this.listReferences('source_id', id),
    findByExternalEventId: async (sourceId, externalEventId) => {
      const result = await this.client().from('event_source_references').select('*')
        .eq('source_id', sourceId).eq('external_event_id', externalEventId).maybeSingle();
      const data = resultOrThrow(result);
      return data ? referenceFromRow(data as Record<string, unknown>) : null;
    },
    upsert: (reference) => this.upsertReference(reference),
    markInactive: async (sourceId, externalEventId) => {
      resultOrThrow(await this.client().from('event_source_references').update({ active: false })
        .eq('source_id', sourceId).eq('external_event_id', externalEventId));
    },
    updateLastSeen: async (sourceId, externalEventId, lastSeenAt) => {
      resultOrThrow(await this.client().from('event_source_references').update({ last_seen_at: lastSeenAt, active: true })
        .eq('source_id', sourceId).eq('external_event_id', externalEventId));
    },
    listPaginated: (page, pageSize) => this.pageReferences(page, pageSize),
  };

  readonly fieldProvenance: FieldProvenanceRepository = {
    upsertFieldSelection: (value) => this.upsertProvenance(value),
    findByCanonicalEventId: (id) => this.listProvenance(id),
    findByFieldPath: async (id, path) => {
      const result = await this.client().from('event_field_provenance').select('*')
        .eq('canonical_event_id', id).eq('field_path', path).maybeSingle();
      const data = resultOrThrow(result);
      return data ? provenanceFromRow(data as Record<string, unknown>) : null;
    },
    listAlternatives: async (id, path) => (await this.fieldProvenance.findByFieldPath(id, path))?.alternatives ?? [],
    setManualOverride: async (id, path, value, selectedAt) => this.upsertProvenance({
      id: `provenance-${id}-${path}`, canonicalEventId: id, fieldPath: path, value,
      selectedSourceId: 'manual_override', selectionReason: 'manual_override', alternatives: [],
      lastChangedAt: selectedAt,
    }, true),
    clearManualOverride: async (id, path) => {
      resultOrThrow(await this.client().from('event_field_provenance').update({ manually_overridden: false })
        .eq('canonical_event_id', id).eq('field_path', path));
    },
  };

  readonly duplicateDecisions: DuplicateDecisionRepository = {
    createDecision: (decision) => this.insertDecision(decision),
    findByCandidateIds: (ids) => this.findDecision(ids),
    findByCanonicalEventId: async (id) => this.listDecisionRows(this.client().from('duplicate_decisions').select('*').eq('canonical_event_id', id)),
    listPaginated: (page, pageSize) => this.pageDecisions(page, pageSize),
    reverseDecision: async (id, reversedAt) => {
      resultOrThrow(await this.client().from('duplicate_decisions').update({ reversed_at: reversedAt }).eq('id', id));
    },
    findActiveKeptSeparateDecision: async (ids) => {
      const decision = await this.findDecision(ids);
      return decision?.decision === 'kept_separate' && !decision.reversedAt ? decision : null;
    },
  };

  readonly conflicts: EventConflictRepository = {
    create: (conflict) => this.upsertConflict(conflict),
    createMany: async (conflicts) => Promise.all(conflicts.map((conflict) => this.upsertConflict(conflict))),
    findById: async (id) => {
      const result = await this.client().from('event_conflicts').select('*').eq('id', id).maybeSingle();
      const data = resultOrThrow(result);
      return data ? conflictFromRow(data as Record<string, unknown>) : null;
    },
    findByCanonicalEventId: async (id) => this.listConflictRows(this.client().from('event_conflicts').select('*').eq('canonical_event_id', id)),
    listUnresolved: async (id) => this.listConflictRows(
      id ? this.client().from('event_conflicts').select('*').eq('canonical_event_id', id).eq('resolved', false)
        : this.client().from('event_conflicts').select('*').eq('resolved', false),
    ),
    resolve: async (id, resolution, resolvedAt) => {
      resultOrThrow(await this.client().from('event_conflicts').update({ resolved: true, resolution, resolved_at: resolvedAt }).eq('id', id));
    },
    reopen: async (id) => {
      resultOrThrow(await this.client().from('event_conflicts').update({ resolved: false, resolution: null, resolved_at: null }).eq('id', id));
    },
    listPaginated: (page, pageSize) => this.pageConflicts(page, pageSize),
  };

  private async upsertReference(
    reference: SourceReference & { id: string; canonicalEventId: string },
  ): Promise<SourceReference> {
    const result = await this.client().from('event_source_references').upsert({
      id: reference.id, canonical_event_id: reference.canonicalEventId, source_id: reference.sourceId,
      external_event_id: reference.externalEventId, original_url: reference.originalUrl ?? null,
      raw_record_id: reference.rawRecordId ?? null, import_job_id: reference.importJobId ?? null,
      first_seen_at: reference.firstSeenAt, last_seen_at: reference.lastSeenAt,
      last_changed_at: reference.lastChangedAt ?? null, active: reference.active,
      source_priority: reference.sourcePriority, source_quality_score: reference.sourceQuality ?? null,
      metadata: reference.metadata ?? {},
    }, { onConflict: 'source_id,external_event_id' }).select('*').single();
    return referenceFromRow(resultOrThrow(result) as Record<string, unknown>);
  }

  private async listReferences(column: string, value: string): Promise<SourceReference[]> {
    const result = await this.client().from('event_source_references').select('*').eq(column, value);
    const data = resultOrThrow(result) as Record<string, unknown>[] | null;
    return (data ?? []).map(referenceFromRow);
  }

  private async pageReferences(page: number, pageSize: number): Promise<Page<SourceReference>> {
    const bounds = pageBounds(page, pageSize);
    const result = await this.client().from('event_source_references').select('*', { count: 'exact' })
      .order('last_seen_at', { ascending: false }).range(bounds.from, bounds.to);
    const data = resultOrThrow(result) as Record<string, unknown>[] | null;
    return { items: (data ?? []).map(referenceFromRow), total: result.count ?? 0, page: bounds.page, pageSize: bounds.pageSize };
  }

  private async upsertProvenance(
    provenance: FieldProvenance & { id: string; canonicalEventId: string; fieldPath: string },
    manuallyOverridden = false,
  ): Promise<FieldProvenance> {
    const result = await this.client().from('event_field_provenance').upsert({
      id: provenance.id, canonical_event_id: provenance.canonicalEventId, field_path: provenance.fieldPath,
      selected_value: provenance.value, selected_source_id: provenance.selectedSourceId || null,
      selected_at: provenance.lastChangedAt, selection_reason: provenance.selectionReason,
      alternatives: provenance.alternatives, manually_overridden: manuallyOverridden, updated_at: provenance.lastChangedAt,
      confidence: provenance.confidence ?? null,
      freshness_at: provenance.freshnessAt ?? null,
      origin_external_id: provenance.originExternalId ?? null,
      merge_decision: provenance.mergeDecision ?? null,
      selected_tier: provenance.selectedTier ?? null,
    }, { onConflict: 'canonical_event_id,field_path' }).select('*').single();
    return provenanceFromRow(resultOrThrow(result) as Record<string, unknown>);
  }

  private async listProvenance(canonicalEventId: string): Promise<FieldProvenance[]> {
    const result = await this.client().from('event_field_provenance').select('*').eq('canonical_event_id', canonicalEventId);
    const data = resultOrThrow(result) as Record<string, unknown>[] | null;
    return (data ?? []).map(provenanceFromRow);
  }

  private async insertDecision(decision: DuplicateDecision): Promise<DuplicateDecision> {
    const existing = await this.findDecision(decision.candidateIds);
    if (existing && !existing.reversedAt) return existing;
    const result = await this.client().from('duplicate_decisions').insert({
      id: decision.id, candidate_ids: decision.candidateIds, source_ids: decision.sourceIds,
      canonical_event_id: decision.canonicalEventId ?? null, decision: decision.decision,
      confidence: decision.confidence, reason: decision.reason, decided_by: decision.decidedBy ?? null,
      decided_at: decision.decidedAt, fingerprint_snapshot: decision.fingerprintSnapshot,
      reversible: decision.reversible, metadata: {},
    }).select('*').single();
    return decisionFromRow(resultOrThrow(result) as Record<string, unknown>);
  }

  private async findDecision(candidateIds: string[]): Promise<DuplicateDecision | null> {
    const result = await this.client().from('duplicate_decisions').select('*').in('candidate_ids', candidateIds)
      .order('decided_at', { ascending: false }).range(0, 0);
    const data = resultOrThrow(result) as Record<string, unknown>[] | null;
    const match = (data ?? []).map(decisionFromRow).find((decision) =>
      decision.candidateIds.length === candidateIds.length && candidateIds.every((id) => decision.candidateIds.includes(id)),
    );
    return match ?? null;
  }

  private async listDecisionRows(query: RawQuery): Promise<DuplicateDecision[]> {
    const result = await query;
    const data = resultOrThrow(result) as Record<string, unknown>[] | null;
    return (data ?? []).map(decisionFromRow);
  }

  private async pageDecisions(page: number, pageSize: number): Promise<Page<DuplicateDecision>> {
    const bounds = pageBounds(page, pageSize);
    const result = await this.client().from('duplicate_decisions').select('*', { count: 'exact' })
      .order('decided_at', { ascending: false }).range(bounds.from, bounds.to);
    const data = resultOrThrow(result) as Record<string, unknown>[] | null;
    return { items: (data ?? []).map(decisionFromRow), total: result.count ?? 0, page: bounds.page, pageSize: bounds.pageSize };
  }

  private async upsertConflict(conflict: EventConflict): Promise<EventConflict> {
    const result = await this.client().from('event_conflicts').upsert({
      id: conflict.id, canonical_event_id: conflict.canonicalEventId, field: conflict.field,
      values: conflict.values, source_ids: conflict.sourceIds, severity: conflict.severity,
      detected_at: conflict.detectedAt, resolved: conflict.resolved,
      resolution: conflict.resolution ?? null, resolved_at: conflict.resolvedAt ?? null,
    }, { onConflict: 'id' }).select('*').single();
    return conflictFromRow(resultOrThrow(result) as Record<string, unknown>);
  }

  private async listConflictRows(query: RawQuery): Promise<EventConflict[]> {
    const result = await query;
    const data = resultOrThrow(result) as Record<string, unknown>[] | null;
    return (data ?? []).map(conflictFromRow);
  }

  private async pageConflicts(page: number, pageSize: number): Promise<Page<EventConflict>> {
    const bounds = pageBounds(page, pageSize);
    const result = await this.client().from('event_conflicts').select('*', { count: 'exact' })
      .order('detected_at', { ascending: false }).range(bounds.from, bounds.to);
    const data = resultOrThrow(result) as Record<string, unknown>[] | null;
    return { items: (data ?? []).map(conflictFromRow), total: result.count ?? 0, page: bounds.page, pageSize: bounds.pageSize };
  }

  async loadEventIdAliases(): Promise<Map<string, string>> {
    const result = await this.client().from('duplicate_decisions').select('*').eq('decision', 'merged');
    const data = resultOrThrow(result) as Record<string, unknown>[] | null;
    const aliases = new Map<string, string>();
    for (const row of data ?? []) {
      const canonicalId = row.canonical_event_id ? String(row.canonical_event_id) : undefined;
      if (!canonicalId) {
        continue;
      }
      const candidateIds = Array.isArray(row.candidate_ids) ? row.candidate_ids.map(String) : [];
      for (const candidateId of candidateIds) {
        if (candidateId !== canonicalId) {
          aliases.set(candidateId, canonicalId);
        }
      }
    }
    return aliases;
  }
}

