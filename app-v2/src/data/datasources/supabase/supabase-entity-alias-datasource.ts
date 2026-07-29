import { EntityAliasStoreError } from '@/features/entity-resolution/entity-alias-store-error';
import type {
  EntityIdentityAlias,
  EntityResolutionDecisionRecord,
  EntityType,
} from '@/features/entity-resolution/types';
import { getSupabaseClient } from '@/services/supabase/client';

export interface EntityIdentityAliasRow {
  id: string;
  entity_type: EntityType;
  canonical_id: string;
  alias_type: EntityIdentityAlias['aliasType'];
  alias_value: string;
  source_id: string | null;
  created_at: string;
  created_by: string | null;
  original_alias: string | null;
  locale: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

export interface EntityResolutionDecisionRow {
  id: string;
  entity_type: EntityType;
  candidate_key: string;
  decision: string;
  canonical_id: string | null;
  decided_by: string;
  decided_at: string;
  reason: string;
  source_id: string | null;
  source_external_id: string | null;
  candidate_entity_id: string | null;
  confidence: number | null;
  normalized_input: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

type RawResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

interface RawQuery extends PromiseLike<RawResult> {
  select(columns?: string): RawQuery;
  eq(column: string, value: unknown): RawQuery;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): RawQuery;
  insert(values: Record<string, unknown>): RawQuery;
  update(values: Record<string, unknown>): RawQuery;
  maybeSingle(): Promise<RawResult>;
}

type RawClient = { from(table: string): RawQuery };

function createEntityAliasId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `entity-alias-${crypto.randomUUID()}`;
  }
  return `entity-alias-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEntityDecisionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `entity-decision-${crypto.randomUUID()}`;
  }
  return `entity-decision-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function mapSupabaseError(error: { message: string; code?: string }, fallback: string): EntityAliasStoreError {
  const message = error.message || fallback;
  if (error.code === 'PGRST301' || error.code === '42501') {
    return new EntityAliasStoreError(message, { code: 'unauthorized', cause: error });
  }
  if (error.code === '23505') {
    return new EntityAliasStoreError(message, { code: 'conflict', cause: error });
  }
  if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
    return new EntityAliasStoreError(message, { code: 'database_unavailable', cause: error, retryable: true });
  }
  return new EntityAliasStoreError(message, { code: 'persistence_failed', cause: error });
}

function throwOnError(result: RawResult, fallback: string): void {
  if (result.error) {
    throw mapSupabaseError(result.error, fallback);
  }
}

export function mapAliasRowToDomain(row: EntityIdentityAliasRow): EntityIdentityAlias {
  return {
    entityType: row.entity_type,
    canonicalId: row.canonical_id,
    aliasType: row.alias_type,
    aliasValue: row.alias_value,
    sourceId: row.source_id ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    originalAlias: row.original_alias ?? undefined,
    locale: row.locale ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

export function mapDecisionRowToDomain(row: EntityResolutionDecisionRow): EntityResolutionDecisionRecord {
  const decision =
    row.decision === 'manual_match' || row.decision === 'match' || row.decision === 'alias_added'
      ? 'manual_override'
      : 'keep_separate';

  return {
    entityType: row.entity_type,
    candidateKey: row.candidate_key,
    decision,
    canonicalId: row.canonical_id ?? undefined,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    reason: row.reason,
    sourceId: row.source_id ?? undefined,
    sourceExternalId: row.source_external_id ?? undefined,
    candidateEntityId: row.candidate_entity_id ?? undefined,
    confidence: row.confidence ?? undefined,
    normalizedInput: row.normalized_input ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

export function mapAliasDomainToRow(alias: EntityIdentityAlias, id?: string): EntityIdentityAliasRow {
  const now = new Date().toISOString();
  return {
    id: id ?? createEntityAliasId(),
    entity_type: alias.entityType,
    canonical_id: alias.canonicalId,
    alias_type: alias.aliasType,
    alias_value: alias.aliasValue,
    source_id: alias.sourceId ?? null,
    created_at: alias.createdAt || now,
    created_by: alias.createdBy ?? null,
    original_alias: alias.originalAlias ?? null,
    locale: alias.locale ?? null,
    metadata: alias.metadata ?? {},
    updated_at: now,
  };
}

export function mapDecisionDomainToRow(
  record: EntityResolutionDecisionRecord,
  id?: string,
): EntityResolutionDecisionRow {
  const now = new Date().toISOString();
  const decision = record.decision === 'manual_override' ? 'manual_match' : 'keep_separate';

  return {
    id: id ?? createEntityDecisionId(),
    entity_type: record.entityType,
    candidate_key: record.candidateKey,
    decision,
    canonical_id: record.canonicalId ?? null,
    decided_by: record.decidedBy,
    decided_at: record.decidedAt || now,
    reason: record.reason,
    source_id: record.sourceId ?? null,
    source_external_id: record.sourceExternalId ?? null,
    candidate_entity_id: record.candidateEntityId ?? null,
    confidence: record.confidence ?? null,
    normalized_input: record.normalizedInput ?? record.candidateKey,
    metadata: record.metadata ?? null,
    updated_at: now,
  };
}

export class SupabaseEntityAliasDatasource {
  constructor(private readonly clientFactory: () => RawClient = () => getSupabaseClient() as unknown as RawClient) {}

  private client(): RawClient {
    return this.clientFactory();
  }

  async listAliases(): Promise<EntityIdentityAliasRow[]> {
    const result = await this.client().from('entity_identity_aliases').select('*');
    throwOnError(result, 'Failed to load entity identity aliases.');
    return (result.data ?? []) as EntityIdentityAliasRow[];
  }

  async listDecisions(): Promise<EntityResolutionDecisionRow[]> {
    const result = await this.client().from('entity_resolution_decisions').select('*');
    throwOnError(result, 'Failed to load entity resolution decisions.');
    return (result.data ?? []) as EntityResolutionDecisionRow[];
  }

  async findAliasByUniqueKey(
    entityType: EntityType,
    aliasType: EntityIdentityAlias['aliasType'],
    aliasValue: string,
    sourceId?: string,
  ): Promise<EntityIdentityAliasRow | null> {
    let query = this.client()
      .from('entity_identity_aliases')
      .select('*')
      .eq('entity_type', entityType)
      .eq('alias_type', aliasType)
      .eq('alias_value', aliasValue);

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    } else {
      query = query.eq('source_id', null);
    }

    const result = await query.maybeSingle();
    throwOnError(result, 'Failed to find entity alias.');
    return (result.data as EntityIdentityAliasRow | null) ?? null;
  }

  async upsertAlias(row: EntityIdentityAliasRow): Promise<EntityIdentityAliasRow> {
    const existing = await this.findAliasByUniqueKey(
      row.entity_type,
      row.alias_type,
      row.alias_value,
      row.source_id ?? undefined,
    );

    if (existing) {
      const result = await this.client()
        .from('entity_identity_aliases')
        .update({
          canonical_id: row.canonical_id,
          original_alias: row.original_alias,
          locale: row.locale,
          metadata: row.metadata ?? {},
          updated_at: row.updated_at,
          created_by: row.created_by,
        } as Record<string, unknown>)
        .eq('id', existing.id);
      throwOnError(result, 'Failed to update entity alias.');
      return {
        ...existing,
        canonical_id: row.canonical_id,
        original_alias: row.original_alias,
        locale: row.locale,
        metadata: row.metadata,
        updated_at: row.updated_at,
        created_by: row.created_by,
      };
    }

    const result = await this.client()
      .from('entity_identity_aliases')
      .insert(row as unknown as Record<string, unknown>);
    throwOnError(result, 'Failed to insert entity alias.');
    return row;
  }

  async upsertDecision(row: EntityResolutionDecisionRow): Promise<EntityResolutionDecisionRow> {
    const existingResult = await this.client()
      .from('entity_resolution_decisions')
      .select('*')
      .eq('entity_type', row.entity_type)
      .eq('candidate_key', row.candidate_key)
      .maybeSingle();
    throwOnError(existingResult, 'Failed to load existing entity decision.');

    const existing = (existingResult.data as EntityResolutionDecisionRow | null) ?? null;
    if (existing) {
      const result = await this.client()
        .from('entity_resolution_decisions')
        .update({
          decision: row.decision,
          canonical_id: row.canonical_id,
          decided_by: row.decided_by,
          decided_at: row.decided_at,
          reason: row.reason,
          source_id: row.source_id,
          source_external_id: row.source_external_id,
          candidate_entity_id: row.candidate_entity_id,
          confidence: row.confidence,
          normalized_input: row.normalized_input,
          metadata: row.metadata ?? {},
          updated_at: row.updated_at,
        } as Record<string, unknown>)
        .eq('id', existing.id);
      throwOnError(result, 'Failed to update entity decision.');
      return { ...existing, ...row, id: existing.id };
    }

    const result = await this.client()
      .from('entity_resolution_decisions')
      .insert(row as unknown as Record<string, unknown>);
    throwOnError(result, 'Failed to insert entity decision.');
    return row;
  }
}
