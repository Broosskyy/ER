import type { IngestionRunRecord, SourceHealthRecord, SyncRunCounters } from './types';
import type { IngestionSyncPersistence } from './run-persistence';
import type { LinkedQueryExecutor } from './linked-db';
import { loadJsonAgg } from './linked-db';

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function countersToColumns(counters: SyncRunCounters) {
  return {
    discovered_count: counters.discovered,
    fetched_count: counters.fetched,
    parsed_count: counters.parsed,
    candidate_count: counters.candidates,
    planned_count: counters.planned,
    exact_matches: counters.exactMatches,
    strong_matches: counters.strongMatches,
    review_required: counters.reviewRequired,
    new_events: counters.newEvents,
    safe_updates: counters.safeUpdates,
    noops: counters.noops,
    rejected: counters.rejected,
    failures: counters.failures,
    applied_writes: counters.appliedWrites,
  };
}

function rowToRunRecord(row: Record<string, unknown>): IngestionRunRecord {
  return {
    runId: String(row.id),
    connectorId: String(row.connector_id),
    mode: row.mode as IngestionRunRecord['mode'],
    triggerType: row.trigger_type as IngestionRunRecord['triggerType'],
    status: row.status as IngestionRunRecord['status'],
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : undefined,
    durationMs: row.duration_ms == null ? undefined : Number(row.duration_ms),
    counters: {
      discovered: Number(row.discovered_count ?? 0),
      fetched: Number(row.fetched_count ?? 0),
      parsed: Number(row.parsed_count ?? 0),
      candidates: Number(row.candidate_count ?? 0),
      planned: Number(row.planned_count ?? 0),
      exactMatches: Number(row.exact_matches ?? 0),
      strongMatches: Number(row.strong_matches ?? 0),
      reviewRequired: Number(row.review_required ?? 0),
      newEvents: Number(row.new_events ?? 0),
      safeUpdates: Number(row.safe_updates ?? 0),
      noops: Number(row.noops ?? 0),
      rejected: Number(row.rejected ?? 0),
      failures: Number(row.failures ?? 0),
      appliedWrites: Number(row.applied_writes ?? 0),
    },
    errorCategories: Array.isArray(row.error_categories)
      ? (row.error_categories as IngestionRunRecord['errorCategories'])
      : [],
    errorSummary: row.error_summary ? String(row.error_summary) : undefined,
    retryCount: Number(row.retry_count ?? 0),
  };
}

function rowToHealthRecord(row: Record<string, unknown>): SourceHealthRecord {
  return {
    connectorId: String(row.connector_id),
    enabled: Boolean(row.enabled),
    lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : undefined,
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : undefined,
    lastFailureAt: row.last_failure_at ? String(row.last_failure_at) : undefined,
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
    lastDurationMs: row.last_duration_ms == null ? undefined : Number(row.last_duration_ms),
    lastDiscoveredCount: Number(row.last_discovered_count ?? 0),
    lastParsedCount: Number(row.last_parsed_count ?? 0),
    lastAppliedCount: Number(row.last_applied_count ?? 0),
    lastErrorCategory: row.last_error_category
      ? (String(row.last_error_category) as SourceHealthRecord['lastErrorCategory'])
      : undefined,
    healthStatus: String(row.health_status) as SourceHealthRecord['healthStatus'],
  };
}

export class SqlIngestionSyncPersistence implements IngestionSyncPersistence {
  constructor(private readonly runQuery: LinkedQueryExecutor) {}

  async createRun(record: IngestionRunRecord): Promise<void> {
    const counters = countersToColumns(record.counters);
    this.runQuery(`
      INSERT INTO public.ingestion_runs (
        id, connector_id, mode, trigger_type, status, started_at, finished_at, duration_ms,
        discovered_count, fetched_count, parsed_count, candidate_count, planned_count,
        exact_matches, strong_matches, review_required, new_events, safe_updates, noops,
        rejected, failures, applied_writes, retry_count, error_categories, error_summary
      ) VALUES (
        ${sqlLiteral(record.runId)}::uuid,
        ${sqlLiteral(record.connectorId)},
        ${sqlLiteral(record.mode)},
        ${sqlLiteral(record.triggerType)},
        ${sqlLiteral(record.status)},
        ${sqlLiteral(record.startedAt)}::timestamptz,
        ${record.finishedAt ? `${sqlLiteral(record.finishedAt)}::timestamptz` : 'NULL'},
        ${record.durationMs ?? 'NULL'},
        ${counters.discovered_count},
        ${counters.fetched_count},
        ${counters.parsed_count},
        ${counters.candidate_count},
        ${counters.planned_count},
        ${counters.exact_matches},
        ${counters.strong_matches},
        ${counters.review_required},
        ${counters.new_events},
        ${counters.safe_updates},
        ${counters.noops},
        ${counters.rejected},
        ${counters.failures},
        ${counters.applied_writes},
        ${record.retryCount},
        ARRAY[${record.errorCategories.map((category) => sqlLiteral(category)).join(', ')}]::text[],
        ${record.errorSummary ? sqlLiteral(record.errorSummary) : 'NULL'}
      );
    `);
  }

  async completeRun(runId: string, update: Partial<IngestionRunRecord>): Promise<void> {
    const sets: string[] = [];
    if (update.status) sets.push(`status = ${sqlLiteral(update.status)}`);
    if (update.finishedAt) sets.push(`finished_at = ${sqlLiteral(update.finishedAt)}::timestamptz`);
    if (update.durationMs != null) sets.push(`duration_ms = ${update.durationMs}`);
    if (update.errorSummary !== undefined) {
      sets.push(`error_summary = ${update.errorSummary ? sqlLiteral(update.errorSummary) : 'NULL'}`);
    }
    if (update.retryCount != null) sets.push(`retry_count = ${update.retryCount}`);
    if (update.errorCategories) {
      sets.push(
        `error_categories = ARRAY[${update.errorCategories.map((category) => sqlLiteral(category)).join(', ')}]::text[]`,
      );
    }
    if (update.counters) {
      const counters = countersToColumns(update.counters);
      for (const [column, value] of Object.entries(counters)) {
        sets.push(`${column} = ${value}`);
      }
    }
    if (sets.length === 0) {
      return;
    }
    this.runQuery(`
      UPDATE public.ingestion_runs
      SET ${sets.join(', ')}
      WHERE id = ${sqlLiteral(runId)}::uuid;
    `);
  }

  async getRun(runId: string): Promise<IngestionRunRecord | undefined> {
    const rows = loadJsonAgg<Record<string, unknown>>(
      this.runQuery,
      `SELECT jsonb_agg(to_jsonb(r)) AS rows FROM public.ingestion_runs r WHERE r.id = ${sqlLiteral(runId)}::uuid;`,
    );
    return rows[0] ? rowToRunRecord(rows[0]) : undefined;
  }

  async upsertHealth(record: SourceHealthRecord): Promise<void> {
    this.runQuery(`
      INSERT INTO public.ingestion_source_health (
        connector_id, enabled, last_attempt_at, last_success_at, last_failure_at,
        consecutive_failures, last_duration_ms, last_discovered_count, last_parsed_count,
        last_applied_count, last_error_category, health_status, updated_at
      ) VALUES (
        ${sqlLiteral(record.connectorId)},
        ${record.enabled},
        ${record.lastAttemptAt ? `${sqlLiteral(record.lastAttemptAt)}::timestamptz` : 'NULL'},
        ${record.lastSuccessAt ? `${sqlLiteral(record.lastSuccessAt)}::timestamptz` : 'NULL'},
        ${record.lastFailureAt ? `${sqlLiteral(record.lastFailureAt)}::timestamptz` : 'NULL'},
        ${record.consecutiveFailures},
        ${record.lastDurationMs ?? 'NULL'},
        ${record.lastDiscoveredCount},
        ${record.lastParsedCount},
        ${record.lastAppliedCount},
        ${record.lastErrorCategory ? sqlLiteral(record.lastErrorCategory) : 'NULL'},
        ${sqlLiteral(record.healthStatus)},
        now()
      )
      ON CONFLICT (connector_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        last_attempt_at = EXCLUDED.last_attempt_at,
        last_success_at = EXCLUDED.last_success_at,
        last_failure_at = EXCLUDED.last_failure_at,
        consecutive_failures = EXCLUDED.consecutive_failures,
        last_duration_ms = EXCLUDED.last_duration_ms,
        last_discovered_count = EXCLUDED.last_discovered_count,
        last_parsed_count = EXCLUDED.last_parsed_count,
        last_applied_count = EXCLUDED.last_applied_count,
        last_error_category = EXCLUDED.last_error_category,
        health_status = EXCLUDED.health_status,
        updated_at = now();
    `);
  }

  async getHealth(connectorId: string): Promise<SourceHealthRecord | undefined> {
    const rows = loadJsonAgg<Record<string, unknown>>(
      this.runQuery,
      `SELECT jsonb_agg(to_jsonb(h)) AS rows FROM public.ingestion_source_health h WHERE h.connector_id = ${sqlLiteral(connectorId)};`,
    );
    return rows[0] ? rowToHealthRecord(rows[0]) : undefined;
  }

  async listRunsForConnector(connectorId: string): Promise<IngestionRunRecord[]> {
    const rows = loadJsonAgg<Record<string, unknown>>(
      this.runQuery,
      `
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.started_at) AS rows
      FROM public.ingestion_runs r
      WHERE r.connector_id = ${sqlLiteral(connectorId)};
    `,
    );
    return rows.map((row) => rowToRunRecord(row));
  }
}

export function createSqlIngestionSyncPersistence(runQuery: LinkedQueryExecutor): SqlIngestionSyncPersistence {
  return new SqlIngestionSyncPersistence(runQuery);
}
