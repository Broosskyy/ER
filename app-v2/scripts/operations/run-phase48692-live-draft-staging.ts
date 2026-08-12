/**
 * @deprecated Retired — use run-bootshaus-source-pack-proof.ts / runSourcePackImport().
 * Phase 4.8.6.9.2c — fault-isolated unified draft staging whose only allowed
 * database mutations are idempotent import_records upserts.
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapImportRecordRowToDomain } from '@/data/mappers/import-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import { ImportAdminRepositoryImpl } from '@/data/repositories/import-admin-repository';
import { ImportRecordRepositoryImpl } from '@/data/repositories/import-repository-impl';
import type { SourceRecord } from '@/data/types/records';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import {
  AdminDraftReviewController,
  buildAdminDraftReviewQueueViewModel,
  buildCompactDraftReviewCard,
} from '@/features/import/clean-import-core/admin-draft-review';
import {
  CleanMultiSourceImportService,
  ProductionCleanImportSourceCollection,
  type CleanImportRunResult,
  type CleanImportSourceCollection,
} from '@/features/import/clean-import-core/clean-multi-source-import-service';
import {
  normalizePublicUrl,
} from '@/features/import/clean-import-core/cross-source-event-resolver';
import {
  applyDuplicateUrlReconciliationToDraft,
  isEventIdentityUrl,
  reconciledClusterToConnectorOutputs,
  reconcileDuplicateUrlClusters,
  type DuplicateUrlReconciliationResult,
} from '@/features/import/clean-import-core/duplicate-url-reconciliation';
import {
  ImportRecordDraftPersistence,
} from '@/features/import/clean-import-core/import-draft-record-persistence';
import {
  mapImportDraftToRecordInput,
  mapImportRecordToDraft,
  partitionFaultIsolatedDrafts,
  readImportDraftEnvelope,
  type ImportDraftRecordContext,
} from '@/features/import/clean-import-core/import-draft-record-mapper';
import type { ImportDraft } from '@/features/import/clean-import-core/import-draft';
import type { ImportSubmission } from '@/features/import/clean-import-core/import-submission';
import {
  assessLiveDraftQueuePreflight,
  type LiveDraftQueuePreflightResult,
  type LiveDraftQueueStateRow,
} from '@/features/import/clean-import-core/live-draft-staging-preflight';
import { UnifiedImportDraftService } from '@/features/import/clean-import-core/unified-import-draft-service';
import { importConfig } from '@/features/import/config/import-config';
import type { ImportRecord } from '@/features/import/models/types';
import { getSupabaseClient } from '@/services/supabase/client';

const EXPECTED_BRANCH = 'feature/phase-4868-clean-import-core';
const EXPECTED_HEAD = '1dc12fba4b82d1f7db1f908ca99b4f414c436e18';
const CONFIRMATION_TOKEN = 'exact:phase48692-live-draft-staging';
const LIVE_FETCH_LIMIT_MS = 10 * 60_000;
const HTTP_TIMEOUT_MS = 15_000;
const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO_ROOT = join(APP_ROOT, '..');
const CHECKPOINT_PATH = join(APP_ROOT, '.phase48692c-live-checkpoint.json');
const RESULT_PATH = join(APP_ROOT, '.phase48692c-result.json');

type JsonRow = Record<string, unknown>;
type OpsClient = ReturnType<typeof getSupabaseClient>;
type OpsTableClient = {
  from(table: string): {
    select(columns?: string): any;
    update(values: JsonRow): any;
    delete(): any;
  };
};

interface QueueObservation {
  queueRows: JsonRow[];
  importJobs: JsonRow[];
  workerRuns: JsonRow[];
  schedulerRuns: JsonRow[];
  scheduleLocks: JsonRow[];
  assessment: LiveDraftQueuePreflightResult;
  fingerprint: string;
}

interface EventBaseline {
  count: number;
  ids: string[];
  updatedAtById: Record<string, string | null>;
  fingerprint: string;
  rows: JsonRow[];
}

interface PreparedDraft {
  clusterId: string;
  draft: ImportDraft;
  context: ImportDraftRecordContext;
  existing?: ImportRecord;
  existingRow?: JsonRow;
  noChange: boolean;
}

interface MutationCounters {
  phase: 'preflight' | 'draft' | 'rollback' | 'readback';
  attemptedMutationRequests: number;
  successfulMutationRequests: number;
  eventWriteRequests: number;
  queueWriteRequests: number;
  otherBlockedWriteRequests: number;
  draftWriteRequests: number;
  rollbackWriteRequests: number;
}

interface RunCounters {
  attemptedDraftWrites: number;
  successfulDraftWrites: number;
  insertedDrafts: number;
  updatedDrafts: number;
  noChangeDrafts: number;
  failedDraftWrites: number;
  quarantinedDrafts: number;
  rollbackWriteRequests: number;
  deletedRollbackDrafts: number;
  eventWriteRequests: number;
  queueWriteRequests: number;
  totalProductionWriteOperations: number;
  productionMutationsInThisRun: number;
}

interface SerializedError {
  message: string;
  stack: string;
  draftKey?: string;
}

interface QuarantinedDraft {
  clusterId: string;
  draftKey?: string;
  reason: string;
  reasons: string[];
  sourceIds: string[];
  urls: string[];
}

interface LiveCheckpoint {
  schemaVersion: 1;
  createdAt: string;
  cleanResult: CleanImportRunResult;
  reconciliation: DuplicateUrlReconciliationResult;
  imageUrlsByRawKey: Record<string, string>;
}

const RESTORABLE_IMPORT_RECORD_FIELDS = [
  'import_job_id',
  'source_id',
  'external_id',
  'source_url',
  'source_type',
  'original_url',
  'retrieved_at',
  'raw_payload',
  'normalized_payload',
  'validation_errors',
  'validation_warnings',
  'matched_city_id',
  'matched_venue_id',
  'matched_organizer_id',
  'matched_artist_ids',
  'matched_genre_ids',
  'duplicate_event_id',
  'duplicate_score',
  'match_evaluation_id',
  'matching_warnings',
  'status',
  'resulting_event_id',
  'reviewed_by',
  'reviewed_at',
  'reject_reason',
  'reject_note',
  'reviewer_edits',
  'duplicate_decision',
  'created_at',
  'updated_at',
] as const;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as JsonRow)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function atomicWriteJson(path: string, value: unknown): void {
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporaryPath, path);
}

function serializeError(error: unknown, draftKey?: string): SerializedError {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return {
    message: normalized.message,
    stack: normalized.stack ?? normalized.message,
    draftKey,
  };
}

function readCompleteCheckpoint(): LiveCheckpoint | undefined {
  if (!existsSync(CHECKPOINT_PATH)) return undefined;
  const checkpoint = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8')) as LiveCheckpoint;
  const { cleanResult, reconciliation } = checkpoint;
  const originalClusterIds = reconciliation.draftInputs.flatMap(
    (entry) => entry.originalClusterIds,
  );
  const complete =
    checkpoint.schemaVersion === 1 &&
    Boolean(checkpoint.createdAt) &&
    cleanResult.sourceResults.length === 12 &&
    cleanResult.contributions.length === 108 &&
    cleanResult.clusters.length === 98 &&
    cleanResult.decisions.length === cleanResult.clusters.length &&
    reconciliation.draftInputs.length > 0 &&
    originalClusterIds.length === cleanResult.clusters.length &&
    new Set(originalClusterIds).size === cleanResult.clusters.length &&
    cleanResult.contributions.every(
      (entry) =>
        Boolean(entry.sourceId && entry.verifiedAt && entry.identity && entry.diagnostics),
    ) &&
    reconciliation.draftInputs.every(
      (entry) =>
        Boolean(
          entry.clusterId &&
            entry.originalClusterIds.length &&
            entry.contributions.length &&
            entry.contributions.every(
              (contribution) =>
                contribution.externalId &&
                contribution.evidence.sourceId &&
                contribution.evidence.verifiedAt,
            ),
        ),
    );
  return complete ? checkpoint : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function assertGitAndConfirmation(): void {
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim();
  if (branch !== EXPECTED_BRANCH) {
    throw new Error(`preflight_branch_mismatch:${branch}`);
  }
  if (head !== EXPECTED_HEAD) {
    throw new Error(`preflight_head_mismatch:${head}`);
  }
  if (process.env.CONFIRM_PRODUCTION_MUTATION !== CONFIRMATION_TOKEN) {
    throw new Error('preflight_confirmation_token_mismatch');
  }
}

function installMutationGuard(baseUrl: string, counters: MutationCounters) {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const base = new URL(baseUrl);
  const guardedFetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const isDatabaseRequest =
      url.origin === base.origin && url.pathname.startsWith('/rest/v1/');
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
    if (!isDatabaseRequest || !isMutation) {
      return originalFetch(request);
    }

    counters.attemptedMutationRequests += 1;
    const table = decodeURIComponent(url.pathname.slice('/rest/v1/'.length)).split('/')[0] ?? '';
    if (table !== 'import_records') {
      if (table === 'events') counters.eventWriteRequests += 1;
      else if (
        ['import_job_queue', 'import_schedule_locks', 'worker_runs', 'scheduler_runs'].includes(
          table,
        )
      ) {
        counters.queueWriteRequests += 1;
      } else {
        counters.otherBlockedWriteRequests += 1;
      }
      throw new Error(`production_mutation_guard_blocked:${table}:${request.method}`);
    }

    if (counters.phase === 'draft') counters.draftWriteRequests += 1;
    if (counters.phase === 'rollback') counters.rollbackWriteRequests += 1;
    const response = await originalFetch(request);
    if (response.ok) counters.successfulMutationRequests += 1;
    return response;
  };
  globalThis.fetch = guardedFetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function installBoundedFetch(deadline: number) {
  const previousFetch = globalThis.fetch.bind(globalThis);
  const boundedFetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('live_fetch_deadline_reached');
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    request.signal.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, Math.min(HTTP_TIMEOUT_MS, remaining)),
    );
    try {
      return await previousFetch(request, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener('abort', abortFromCaller);
    }
  };
  globalThis.fetch = boundedFetch;
  return () => {
    globalThis.fetch = previousFetch;
  };
}

function stateRow(row: JsonRow): LiveDraftQueueStateRow {
  return {
    id: String(row.id ?? 'unknown'),
    status: stringValue(row.status),
    processingLeaseExpiresAt: stringValue(row.processing_lease_expires_at),
    leaseExpiresAt:
      stringValue(row.lease_expires_at) ??
      stringValue(row.lease_expires) ??
      stringValue(row.expires_at),
    lockedUntil: stringValue(row.locked_until),
  };
}

async function readRows(resultPromise: PromiseLike<{ data: unknown; error: unknown }>, label: string) {
  const result = await resultPromise;
  if (result.error) {
    const message =
      result.error && typeof result.error === 'object' && 'message' in result.error
        ? String((result.error as { message: unknown }).message)
        : String(result.error);
    throw new Error(`${label}:${message}`);
  }
  return (Array.isArray(result.data) ? result.data : []) as JsonRow[];
}

async function readQueueObservation(client: OpsClient, now: Date): Promise<QueueObservation> {
  const ops = client as unknown as OpsTableClient;
  const [queueRows, importJobs, workerRuns, schedulerRuns, scheduleLocks] =
    await Promise.all([
      readRows(ops.from('import_job_queue').select('*'), 'queue_read_failed'),
      readRows(
        ops
          .from('import_jobs')
          .select('*')
          .in('status', ['pending', 'running', 'processing']),
        'active_import_jobs_read_failed',
      ),
      readRows(ops.from('worker_runs').select('*').limit(1000), 'worker_runs_read_failed'),
      readRows(
        ops.from('scheduler_runs').select('*').limit(1000),
        'scheduler_runs_read_failed',
      ),
      readRows(
        ops.from('import_schedule_locks').select('*').limit(1000),
        'schedule_locks_read_failed',
      ),
    ]);
  const assessment = assessLiveDraftQueuePreflight({
    queueRows: queueRows.map(stateRow),
    importJobs: importJobs.map(stateRow),
    workerRuns: workerRuns.map(stateRow),
    schedulerRuns: schedulerRuns.map(stateRow),
    scheduleLocks: scheduleLocks.map(stateRow),
    now,
  });
  return {
    queueRows,
    importJobs,
    workerRuns,
    schedulerRuns,
    scheduleLocks,
    assessment,
    fingerprint: fingerprint(
      [...queueRows].sort((left, right) =>
        String(left.id ?? '').localeCompare(String(right.id ?? '')),
      ),
    ),
  };
}

async function readPublishedEvents(client: OpsClient): Promise<EventBaseline> {
  const rows = await readRows(
    (client as unknown as OpsTableClient)
      .from('events')
      .select('*')
      .eq('status', 'published')
      .order('id'),
    'published_events_read_failed',
  );
  const sorted = [...rows].sort((left, right) =>
    String(left.id ?? '').localeCompare(String(right.id ?? '')),
  );
  return {
    count: sorted.length,
    ids: sorted.map((row) => String(row.id)),
    updatedAtById: Object.fromEntries(
      sorted.map((row) => [String(row.id), stringValue(row.updated_at) ?? null]),
    ),
    fingerprint: fingerprint(sorted),
    rows: sorted,
  };
}

async function readUnifiedDraftRows(client: OpsClient): Promise<JsonRow[]> {
  return readRows(
    (client as unknown as OpsTableClient)
      .from('import_records')
      .select('*')
      .contains('raw_payload', { recordType: 'unified_import_draft' })
      .limit(10000),
    'unified_drafts_read_failed',
  );
}

async function assertPlausibleDatabaseTime(baseUrl: string, serviceKey: string): Promise<string> {
  const response = await fetch(new URL('/rest/v1/events?select=id&limit=1', baseUrl), {
    headers: { apikey: serviceKey },
  });
  if (!response.ok) throw new Error(`database_clock_request_failed:${response.status}`);
  const value = response.headers.get('date');
  const serverTime = Date.parse(value ?? '');
  if (!Number.isFinite(serverTime) || Math.abs(Date.now() - serverTime) > 5 * 60_000) {
    throw new Error(`database_clock_implausible:${value ?? 'missing'}`);
  }
  return new Date(serverTime).toISOString();
}

function withoutFixturesAndRetries(source: SourceRecord): SourceRecord {
  const sourceConfig = structuredClone(source.sourceConfig ?? {});
  const reference = sourceConfig.reference;
  if (reference) {
    sourceConfig.reference = { connectorKey: reference.connectorKey };
  }
  sourceConfig.connectorFramework = {
    ...sourceConfig.connectorFramework,
    retry: {
      ...sourceConfig.connectorFramework?.retry,
      maxRetries: 0,
    },
  };
  sourceConfig.website = {
    ...sourceConfig.website,
    limits: {
      ...sourceConfig.website?.limits,
      timeoutMs: HTTP_TIMEOUT_MS,
    },
  };
  return { ...source, sourceConfig };
}

async function readAutomaticSources(client: OpsClient): Promise<SourceRecord[]> {
  const rows = await readRows(
    (client as unknown as OpsTableClient)
      .from('sources')
      .select('*')
      .eq('enabled', true)
      .eq('active', true)
      .eq('archived', false),
    'active_sources_read_failed',
  );
  return (rows as unknown as SourceRow[])
    .map(mapSourceRowToRecord)
    .filter(
      (source) =>
        source.enabled &&
        !source.archived &&
        (source.sourceType === 'website' || source.sourceType === 'ticket_platform'),
    )
    .map(withoutFixturesAndRetries)
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function readEligibleJobIds(
  client: OpsClient,
  sourceIds: string[],
  waitingQueueRows: JsonRow[],
): Promise<Map<string, string>> {
  const excluded = new Set(
    waitingQueueRows
      .filter((row) => ['queued', 'processing'].includes(String(row.status ?? '').toLowerCase()))
      .map((row) => stringValue(row.import_job_id))
      .filter((value): value is string => Boolean(value)),
  );
  const jobs = await readRows(
    (client as unknown as OpsTableClient)
      .from('import_jobs')
      .select('id,source_id,status,created_at')
      .in('source_id', sourceIds)
      .order('created_at', { ascending: false })
      .limit(10000),
    'import_jobs_context_read_failed',
  );
  const result = new Map<string, string>();
  for (const row of jobs) {
    const sourceId = stringValue(row.source_id);
    const id = stringValue(row.id);
    const status = stringValue(row.status)?.toLowerCase();
    if (
      !sourceId ||
      !id ||
      excluded.has(id) ||
      ['pending', 'queued', 'running', 'processing'].includes(status ?? '') ||
      result.has(sourceId)
    ) {
      continue;
    }
    result.set(sourceId, id);
  }
  return result;
}

function rawKey(sourceId: string, externalId: string): string {
  return `${sourceId}\u0000${externalId}`;
}

function buildCapturingCollection(
  sources: SourceRecord[],
  captured: Map<string, RawImportedEvent>,
): CleanImportSourceCollection {
  const production = new ProductionCleanImportSourceCollection(async () => sources);
  return {
    listActiveSources: () => production.listActiveSources(),
    async executeSource(source) {
      const rows = await production.executeSource(source);
      for (const row of rows) captured.set(rawKey(source.id, row.externalId), row);
      return rows;
    },
  };
}

function concreteDraftUrls(draft: ImportDraft): string[] {
  const event = draft.proposedCanonicalEvent;
  return [
    ...new Set(
      [
        event?.websiteUrl,
        event?.ticketUrl,
        ...draft.sources.map((source) => source.sourceUrl),
      ]
        .filter((value): value is string => Boolean(value && isEventIdentityUrl(value)))
        .map(normalizePublicUrl)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function assertUniqueConcreteDraftUrls(drafts: ImportDraft[]): void {
  const urls = new Map<string, string>();
  for (const draft of drafts) {
    for (const url of concreteDraftUrls(draft)) {
      const previous = urls.get(url);
      if (previous && previous !== draft.id) {
        throw new Error(`duplicate_concrete_event_url:${url}`);
      }
      urls.set(url, draft.id);
    }
  }
}

function targetRecordComparable(
  draft: ImportDraft,
  context: ImportDraftRecordContext,
  existing: ImportRecord,
): unknown {
  const previous = readImportDraftEnvelope(existing) ?? undefined;
  const input = mapImportDraftToRecordInput(draft, context, previous);
  return {
    importJobId: input.importJobId,
    sourceId: input.sourceId,
    externalId: input.externalId,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType,
    originalUrl: input.originalUrl,
    retrievedAt: input.retrievedAt,
    rawPayload: input.rawPayload,
    normalizedPayload: input.normalizedPayload,
    duplicateEventId: input.duplicateEventId,
    duplicateScore: input.duplicateScore,
    status: input.status ?? 'fetched',
  };
}

function existingRecordComparable(existing: ImportRecord): unknown {
  return {
    importJobId: existing.importJobId,
    sourceId: existing.sourceId,
    externalId: existing.externalId,
    sourceUrl: existing.sourceUrl,
    sourceType: existing.sourceType,
    originalUrl: existing.originalUrl,
    retrievedAt: existing.retrievedAt,
    rawPayload: existing.rawPayload,
    normalizedPayload: existing.normalizedPayload,
    duplicateEventId: existing.duplicateEventId,
    duplicateScore: existing.duplicateScore,
    status: existing.status,
  };
}

function draftIntegrityIssues(draft: ImportDraft): string[] {
  const invalid: string[] = [];
  const lineupGarbage =
    /<[^>]+>|\b(?:navigation|anfahrt|parking|parkplatz|shuttle|bus stop|tram|train station)\b/i;
  const addOnPrice = /\b(?:parking|locker|shuttle|camping|deposit|pfand|upgrade|add[- ]?on)\b/i;
  const event = draft.proposedCanonicalEvent;
  const duplicateUrlAudit = draft.audit.duplicateUrlReconciliation;
  const validConflictDraft =
    draft.reviewTrack === 'conflict_review' &&
    duplicateUrlAudit?.mode === 'identity_conflict' &&
    duplicateUrlAudit.conflictReasons.length > 0 &&
    duplicateUrlAudit.identitySnapshots.length >= 2 &&
    duplicateUrlAudit.identitySnapshots.every(
      (snapshot) =>
        snapshot.contributionCount > 0 && snapshot.evidenceSnapshots.length > 0,
    ) &&
    draft.recommendedDuplicateAction === 'review_duplicate_url_identity';
  if (
    ((!event?.title?.trim() ||
      !event.startDate?.trim() ||
      !(event.venueName?.trim() || event.locationText?.trim())) &&
      !validConflictDraft) ||
    !draft.evidence.length ||
    !draft.verifiedAt?.trim()
  ) {
    invalid.push('missing_core_or_evidence');
  }
  if (duplicateUrlAudit?.mode === 'identity_conflict' && event) {
    invalid.push('conflicting_identity_was_silently_selected');
  }
  if (event?.websiteUrl) {
    const classification = classifyTicketDestination(event.websiteUrl).destinationClass;
    if (
      ['ticket_platform_event', 'ticket_platform_listing', 'embedded_checkout_evidence'].includes(
        classification,
      )
    ) {
      invalid.push('website_url_is_ticket_url');
    }
  }
  if (
    event?.ticketUrl &&
    classifyTicketDestination(event.ticketUrl).destinationClass === 'official_event_page'
  ) {
    invalid.push('ticket_url_is_official_url');
  }
  if (event?.admissionPrice?.text && addOnPrice.test(event.admissionPrice.text)) {
    invalid.push('add_on_used_as_admission_price');
  }
  if (event?.lineup?.some((entry) => lineupGarbage.test(entry.displayName))) {
    invalid.push('invalid_lineup_text');
  }
  if (
    draft.genres.normalizedLabels.length &&
    (!draft.genres.rawValues.length ||
      draft.genres.items.some(
        (item) => !item.sourceId || !item.confidence || !item.normalizedLabel,
      ))
  ) {
    invalid.push('genre_contract_incomplete');
  }
  return invalid;
}

function assertDraftIntegrity(drafts: ImportDraft[]): void {
  const invalid = drafts.flatMap((draft) =>
    draftIntegrityIssues(draft).map((issue) => `${draft.id}:${issue}`),
  );
  if (invalid.length) throw new Error(`draft_readback_integrity_failed:${invalid.join(',')}`);
}

function assertEventsUnchanged(before: EventBaseline, after: EventBaseline): void {
  if (
    before.count !== after.count ||
    before.fingerprint !== after.fingerprint ||
    stableJson(before.ids) !== stableJson(after.ids) ||
    stableJson(before.updatedAtById) !== stableJson(after.updatedAtById)
  ) {
    throw new Error(
      `published_events_changed:${before.count}:${after.count}:${before.fingerprint}:${after.fingerprint}`,
    );
  }
}

async function rollbackDraftWrites(
  client: OpsClient,
  insertedIds: string[],
  updatedSnapshots: JsonRow[],
  counters: MutationCounters,
): Promise<{ deleted: number; requests: number }> {
  const ops = client as unknown as OpsTableClient;
  const beforeRequests = counters.rollbackWriteRequests;
  counters.phase = 'rollback';
  let deleted = 0;
  if (insertedIds.length) {
    const result = await ops
      .from('import_records')
      .delete()
      .in('id', insertedIds)
      .select('id');
    if (result.error) throw new Error(`rollback_delete_failed:${result.error.message}`);
    deleted = Array.isArray(result.data) ? result.data.length : 0;
  }
  for (const snapshot of updatedSnapshots) {
    const id = String(snapshot.id);
    const restore = Object.fromEntries(
      RESTORABLE_IMPORT_RECORD_FIELDS.filter((field) => field in snapshot).map((field) => [
        field,
        snapshot[field],
      ]),
    );
    const result = await ops
      .from('import_records')
      .update(restore)
      .eq('id', id)
      .select('id')
      .single();
    if (result.error) throw new Error(`rollback_update_failed:${id}:${result.error.message}`);
  }
  return {
    deleted,
    requests: counters.rollbackWriteRequests - beforeRequests,
  };
}

async function run(): Promise<void> {
  const startedAt = Date.now();
  const itemErrors: SerializedError[] = [];
  const quarantinedDrafts: QuarantinedDraft[] = [];
  let runResult: JsonRow = {
    phase: '4.8.6.9.2c',
    stage: 'initializing',
    lastCompletedStage: 'none',
    fatalError: null,
    itemErrors,
    sources: 0,
    contributions: 0,
    clusters: 0,
    draftInputs: 0,
    validDrafts: 0,
    conflictDrafts: 0,
    quarantinedDrafts,
    counters: {},
    rolloutActivated: false,
  };
  const persistRunResult = (
    stage: string,
    lastCompletedStage: string,
    extra: JsonRow = {},
  ): void => {
    runResult = {
      ...runResult,
      ...extra,
      stage,
      lastCompletedStage,
      itemErrors,
      quarantinedDrafts,
    };
    atomicWriteJson(RESULT_PATH, runResult);
  };
  persistRunResult('preflight', 'initialized');
  assertGitAndConfirmation();
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error('preflight_ops_credentials_missing');

  const mutationCounters: MutationCounters = {
    phase: 'preflight',
    attemptedMutationRequests: 0,
    successfulMutationRequests: 0,
    eventWriteRequests: 0,
    queueWriteRequests: 0,
    otherBlockedWriteRequests: 0,
    draftWriteRequests: 0,
    rollbackWriteRequests: 0,
  };
  const restoreMutationGuard = installMutationGuard(baseUrl, mutationCounters);
  const client = getSupabaseClient();
  const recordRepository = new ImportRecordRepositoryImpl();
  const draftPersistence = new ImportRecordDraftPersistence(
    recordRepository,
    'import_records_only',
  );
  const counters: RunCounters = {
    attemptedDraftWrites: 0,
    successfulDraftWrites: 0,
    insertedDrafts: 0,
    updatedDrafts: 0,
    noChangeDrafts: 0,
    failedDraftWrites: 0,
    quarantinedDrafts: 0,
    rollbackWriteRequests: 0,
    deletedRollbackDrafts: 0,
    eventWriteRequests: 0,
    queueWriteRequests: 0,
    totalProductionWriteOperations: 0,
    productionMutationsInThisRun: 0,
  };
  const insertedIds: string[] = [];
  const updatedSnapshots: JsonRow[] = [];
  let failureCheckpoint: JsonRow | undefined;
  let failureEventBaseline: Pick<EventBaseline, 'count' | 'fingerprint'> | undefined;

  try {
    const serverTime = await assertPlausibleDatabaseTime(baseUrl, serviceKey);
    const preflightNow = new Date(serverTime);
    const [queueBefore, eventsBefore, draftRowsBefore, sources] = await Promise.all([
      readQueueObservation(client, preflightNow),
      readPublishedEvents(client),
      readUnifiedDraftRows(client),
      readAutomaticSources(client),
    ]);
    if (!queueBefore.assessment.allowed) {
      throw new Error(
        `active_queue_processing:${stableJson(queueBefore.assessment.blockers)}`,
      );
    }
    if (eventsBefore.count !== 93) {
      throw new Error(`published_event_count_preflight_mismatch:${eventsBefore.count}`);
    }
    failureEventBaseline = {
      count: eventsBefore.count,
      fingerprint: eventsBefore.fingerprint,
    };
    if (!sources.length) throw new Error('no_active_automatic_sources');
    const duplicateExistingKeys = draftRowsBefore
      .map((row) => `${String(row.source_id)}\u0000${String(row.external_id)}`)
      .filter((key, index, all) => all.indexOf(key) !== index);
    if (duplicateExistingKeys.length) {
      throw new Error(`existing_duplicate_draft_keys:${duplicateExistingKeys.join(',')}`);
    }
    const jobIds = await readEligibleJobIds(client, sources.map((source) => source.id), queueBefore.queueRows);

    persistRunResult('checkpoint', 'preflight', {
      preflight: {
        serverTime,
        queuedJobs: queueBefore.assessment.queuedIds,
        publishedEvents: eventsBefore.count,
        eventFingerprint: eventsBefore.fingerprint,
        existingUnifiedDrafts: draftRowsBefore.length,
      },
    });
    importConfig.timeoutMs = HTTP_TIMEOUT_MS;
    importConfig.retryCount = 0;
    const capturedRaw = new Map<string, RawImportedEvent>();
    const reusableCheckpoint = readCompleteCheckpoint();
    let cleanResult: CleanImportRunResult;
    let reconciliation: DuplicateUrlReconciliationResult;
    let fetchStartedAt = Date.now();
    let fetchFinishedAt = fetchStartedAt;
    let checkpointCreatedAt: string;
    let checkpointMode: 'offline_reuse' | 'single_live_fetch';
    if (reusableCheckpoint) {
      cleanResult = reusableCheckpoint.cleanResult;
      reconciliation = reusableCheckpoint.reconciliation;
      checkpointCreatedAt = reusableCheckpoint.createdAt;
      checkpointMode = 'offline_reuse';
      for (const [key, imageUrl] of Object.entries(reusableCheckpoint.imageUrlsByRawKey)) {
        capturedRaw.set(key, { externalId: key, imageUrl } as RawImportedEvent);
      }
    } else {
      const collection = buildCapturingCollection(sources, capturedRaw);
      const cleanService = new CleanMultiSourceImportService(collection);
      fetchStartedAt = Date.now();
      const deadline = fetchStartedAt + LIVE_FETCH_LIMIT_MS;
      const restoreBoundedFetch = installBoundedFetch(deadline);
      try {
        cleanResult = await cleanService.run({ now: new Date(fetchStartedAt) });
      } finally {
        restoreBoundedFetch();
      }
      fetchFinishedAt = Date.now();
      if (fetchFinishedAt > deadline) {
        throw new Error(`live_fetch_limit_exceeded:${fetchFinishedAt - fetchStartedAt}`);
      }
      reconciliation = reconcileDuplicateUrlClusters(cleanResult.clusters);
      checkpointCreatedAt = new Date().toISOString();
      const checkpoint: LiveCheckpoint = {
        schemaVersion: 1,
        createdAt: checkpointCreatedAt,
        cleanResult,
        reconciliation,
        imageUrlsByRawKey: Object.fromEntries(
          [...capturedRaw.entries()]
            .filter(([, raw]) => Boolean(raw.imageUrl))
            .map(([key, raw]) => [key, raw.imageUrl!]),
        ),
      };
      atomicWriteJson(CHECKPOINT_PATH, checkpoint);
      checkpointMode = 'single_live_fetch';
    }
    const checkpointHash = createHash('sha256')
      .update(readFileSync(CHECKPOINT_PATH))
      .digest('hex');
    persistRunResult('draft_preparation', 'checkpoint', {
      checkpoint: {
        path: CHECKPOINT_PATH,
        mode: checkpointMode,
        createdAt: checkpointCreatedAt,
        sha256: checkpointHash,
      },
      sources: cleanResult.diagnostics.sourceCount,
      contributions: cleanResult.diagnostics.contributionCount,
      clusters: cleanResult.diagnostics.clusterCount,
      draftInputs: reconciliation.draftInputs.length,
    });

    const existingRowsByKey = new Map(
      draftRowsBefore.map((row) => [
        `${String(row.source_id)}\u0000${String(row.external_id)}`,
        row,
      ]),
    );
    const unifiedService = new UnifiedImportDraftService();
    const decisionByCluster = new Map(
      cleanResult.decisions.map((decision) => [decision.clusterId, decision]),
    );
    failureCheckpoint = {
      sources: cleanResult.diagnostics.sourceCount,
      successfulSources: cleanResult.diagnostics.successfulSourceCount,
      failedSources: cleanResult.diagnostics.failedSourceCount,
      contributions: cleanResult.diagnostics.contributionCount,
      originalClusters: cleanResult.diagnostics.clusterCount,
      duplicateUrlGroups: reconciliation.duplicateUrlGroups.length,
      compatibleMergedGroups: reconciliation.compatibleMergedGroups,
      conflictGroups: reconciliation.conflictGroups,
      resultingDraftInputs: reconciliation.draftInputs.length,
      duplicateUrlDiagnostics: reconciliation.duplicateUrlGroups,
    };
    console.log(
      JSON.stringify(
        {
          phase: '4.8.6.9.2c',
          preWriteCheckpoint: failureCheckpoint,
        },
        null,
        2,
      ),
    );
    const historicalClusters: string[] = [];
    const unprocessableClusters: Array<{ clusterId: string; reasons: string[] }> = [];
    const prepared: PreparedDraft[] = [];
    const draftCandidates: Array<{
      clusterId: string;
      sourceId: string;
      draft: ImportDraft;
    }> = [];
    const quarantine = (
      cluster: DuplicateUrlReconciliationResult['draftInputs'][number],
      reasons: string[],
      draft?: ImportDraft,
      draftKey?: string,
    ): void => {
      const urls = draft
        ? concreteDraftUrls(draft)
        : cluster.contributions.flatMap((entry) => [
            entry.evidence.sourceUrl,
            entry.evidence.finalSourceUrl,
            entry.evidence.identity.officialWebsiteUrl?.value,
            entry.evidence.tickets.publicTicketUrl?.value,
          ]);
      quarantinedDrafts.push({
        clusterId: cluster.clusterId,
        draftKey,
        reason: reasons[0] ?? 'technically_invalid_draft',
        reasons,
        sourceIds: [
          ...new Set(cluster.contributions.map((entry) => entry.evidence.sourceId)),
        ].sort(),
        urls: [...new Set(urls.filter((value): value is string => Boolean(value)))].sort(),
      });
      unprocessableClusters.push({ clusterId: cluster.clusterId, reasons });
    };

    for (const cluster of reconciliation.draftInputs) {
      const tentativeDraftKey = `phase48692:${cluster.clusterId}`;
      try {
        const originalDecisions = cluster.originalClusterIds
          .map((clusterId) => decisionByCluster.get(clusterId))
          .filter((decision): decision is NonNullable<typeof decision> => Boolean(decision));
        if (
          originalDecisions.length > 0 &&
          originalDecisions.every((decision) => decision.decision === 'historical_preserve')
        ) {
          historicalClusters.push(...cluster.originalClusterIds);
          continue;
        }
        const contributions = [...cluster.contributions].sort((left, right) =>
          [left.evidence.sourceId, left.externalId]
            .join('|')
            .localeCompare([right.evidence.sourceId, right.externalId].join('|')),
        );
        const primary = contributions[0];
        if (!primary) {
          quarantine(cluster, ['cluster_without_contributions'], undefined, tentativeDraftKey);
          continue;
        }
        const connectorOutputs = reconciledClusterToConnectorOutputs(cluster);
        const raw = capturedRaw.get(rawKey(primary.evidence.sourceId, primary.externalId));
        const submission: ImportSubmission = {
          id: tentativeDraftKey,
          kind: 'automatic_source',
          submitter: {
            role: 'system',
            displayName: 'Productive Clean Core',
            trustHint: 'official_source',
          },
          submittedAt:
            connectorOutputs.map((output) => output.verifiedAt).find(Boolean) ??
            new Date(fetchFinishedAt).toISOString(),
          sourceId: primary.evidence.sourceId,
          externalId: primary.externalId,
          connectorOutputs,
          payload: raw?.imageUrl ? { imageUrl: raw.imageUrl } : undefined,
        };
        const draft = applyDuplicateUrlReconciliationToDraft(
          unifiedService.process(submission).draft,
          cluster,
        );
        draftCandidates.push({
          clusterId: cluster.clusterId,
          sourceId: primary.evidence.sourceId,
          draft,
        });
      } catch (error) {
        itemErrors.push(serializeError(error, tentativeDraftKey));
        quarantine(
          cluster,
          [`draft_preparation_failed:${serializeError(error).message}`],
          undefined,
          tentativeDraftKey,
        );
      }
    }

    const isolated = partitionFaultIsolatedDrafts(
      draftCandidates,
      draftIntegrityIssues,
    );
    for (const entry of isolated.quarantined) {
      const cluster = reconciliation.draftInputs.find(
        (candidate) => candidate.clusterId === entry.candidate.clusterId,
      )!;
      quarantine(
        cluster,
        entry.reasons,
        entry.candidate.draft,
        entry.candidate.draft.id,
      );
    }
    for (const candidate of isolated.valid) {
      const cluster = reconciliation.draftInputs.find(
        (entry) => entry.clusterId === candidate.clusterId,
      )!;
      try {
        const importJobId = jobIds.get(candidate.sourceId);
        if (!importJobId) {
          quarantine(
            cluster,
            ['no_non_queue_import_job_context'],
            candidate.draft,
            candidate.idempotencyKey,
          );
          continue;
        }
        const context = { sourceId: candidate.sourceId, importJobId };
        const initialInput = mapImportDraftToRecordInput(candidate.draft, context);
        const existingRow = existingRowsByKey.get(
          `${context.sourceId}\u0000${initialInput.externalId}`,
        );
        const existing = existingRow
          ? mapImportRecordRowToDomain(existingRow as never)
          : undefined;
        prepared.push({
          clusterId: candidate.clusterId,
          draft: candidate.draft,
          context,
          existing,
          existingRow,
          noChange: existing
            ? stableJson(targetRecordComparable(candidate.draft, context, existing)) ===
              stableJson(existingRecordComparable(existing))
            : false,
        });
      } catch (error) {
        itemErrors.push(serializeError(error, candidate.idempotencyKey));
        quarantine(
          cluster,
          [`draft_mapping_failed:${serializeError(error).message}`],
          candidate.draft,
          candidate.idempotencyKey,
        );
      }
    }
    counters.quarantinedDrafts = quarantinedDrafts.length;
    persistRunResult('write_preflight', 'draft_preparation', {
      validDrafts: prepared.length,
      conflictDrafts: prepared.filter(
        (entry) => entry.draft.reviewTrack === 'conflict_review',
      ).length,
      counters,
    });

    const queueBeforeWrite = await readQueueObservation(client, new Date());
    if (!queueBeforeWrite.assessment.allowed) {
      throw new Error(
        `active_queue_processing_before_write:${stableJson(
          queueBeforeWrite.assessment.blockers,
        )}`,
      );
    }
    if (queueBeforeWrite.fingerprint !== queueBefore.fingerprint) {
      throw new Error('queue_changed_during_live_fetch');
    }
    assertEventsUnchanged(eventsBefore, await readPublishedEvents(client));

    mutationCounters.phase = 'draft';
    const successfulPrepared: PreparedDraft[] = [];
    for (const item of prepared) {
      if (item.noChange) {
        counters.noChangeDrafts += 1;
        successfulPrepared.push(item);
        continue;
      }
      counters.attemptedDraftWrites += 1;
      const draftKey = mapImportDraftToRecordInput(item.draft, item.context).externalId;
      try {
        const persisted = await draftPersistence.persist(item.draft, item.context);
        if (!persisted.record || persisted.databaseWriteOperations !== 1) {
          throw new Error(`draft_write_not_confirmed:${item.clusterId}`);
        }
        counters.successfulDraftWrites += 1;
        successfulPrepared.push(item);
        if (item.existing) {
          counters.updatedDrafts += 1;
          if (item.existingRow) updatedSnapshots.push(structuredClone(item.existingRow));
        } else {
          counters.insertedDrafts += 1;
          insertedIds.push(persisted.record.id);
        }
      } catch (error) {
        counters.failedDraftWrites += 1;
        itemErrors.push(serializeError(error, draftKey));
        const cluster = reconciliation.draftInputs.find(
          (entry) => entry.clusterId === item.clusterId,
        )!;
        quarantine(
          cluster,
          [`draft_write_failed:${serializeError(error).message}`],
          item.draft,
          draftKey,
        );
        counters.quarantinedDrafts = quarantinedDrafts.length;
        persistRunResult('draft_writes', 'write_preflight', { counters });
      }
    }
    if (
      counters.attemptedDraftWrites > 0 &&
      counters.successfulDraftWrites === 0 &&
      counters.noChangeDrafts === 0
    ) {
      throw new Error('systematic_writer_failure_for_all_drafts');
    }
    if (!successfulPrepared.length) throw new Error('no_persisted_or_idempotent_drafts');
    persistRunResult('readback', 'draft_writes', {
      validDrafts: successfulPrepared.length,
      conflictDrafts: successfulPrepared.filter(
        (entry) => entry.draft.reviewTrack === 'conflict_review',
      ).length,
      counters,
    });

    mutationCounters.phase = 'readback';
    const writtenIds = new Set([
      ...insertedIds,
      ...successfulPrepared
        .filter((item) => item.existing && !item.noChange)
        .map((item) => item.existing!.id),
      ...successfulPrepared
        .filter((item) => item.existing && item.noChange)
        .map((item) => item.existing!.id),
    ]);
    const draftRowsAfter = await readUnifiedDraftRows(client);
    const recordsAfter = draftRowsAfter.map((row) =>
      mapImportRecordRowToDomain(row as never),
    );
    const stagedRecords = recordsAfter.filter((record) => writtenIds.has(record.id));
    const stagedDrafts = stagedRecords
      .map(mapImportRecordToDraft)
      .filter((draft): draft is ImportDraft => draft !== null);
    if (stagedDrafts.length !== writtenIds.size) {
      throw new Error(
        `draft_readback_count_mismatch:${writtenIds.size}:${stagedDrafts.length}`,
      );
    }
    assertDraftIntegrity(stagedDrafts);
    assertUniqueConcreteDraftUrls(stagedDrafts);
    const readbackKeys = stagedRecords.map(
      (record) => `${record.sourceId}\u0000${record.externalId}`,
    );
    if (new Set(readbackKeys).size !== readbackKeys.length) {
      throw new Error('draft_readback_duplicate_idempotency_keys');
    }

    const eventsAfter = await readPublishedEvents(client);
    assertEventsUnchanged(eventsBefore, eventsAfter);
    const queueAfter = await readQueueObservation(client, new Date());
    if (queueAfter.fingerprint !== queueBefore.fingerprint) {
      throw new Error('queue_rows_changed_during_staging');
    }

    const adminRepository = new ImportAdminRepositoryImpl();
    const adminPage = await adminRepository.listRecords({
      page: 1,
      pageSize: 200,
      sortBy: 'newest',
      includeRawPayload: true,
    });
    const adminDrafts = (adminPage.items as ImportRecord[])
      .map(mapImportRecordToDraft)
      .filter((draft): draft is ImportDraft => draft !== null);
    const adminIds = new Set(
      adminDrafts.map((draft) => draft.persistenceRecordId).filter(Boolean),
    );
    if ([...writtenIds].some((id) => !adminIds.has(id))) {
      throw new Error('admin_queue_did_not_return_all_staged_drafts');
    }
    const viewModel = buildAdminDraftReviewQueueViewModel(adminDrafts);
    const safeIds = new AdminDraftReviewController().selectAllSafe(adminDrafts);
    if (
      safeIds.some(
        (id) => adminDrafts.find((draft) => draft.id === id)?.reviewTrack !== 'auto_ready',
      )
    ) {
      throw new Error('admin_select_all_safe_contains_non_safe_draft');
    }
    const detailRecord = stagedRecords[0]
      ? await recordRepository.getById(stagedRecords[0].id)
      : null;
    const detailDraft = detailRecord ? mapImportRecordToDraft(detailRecord) : null;
    const detailCard = detailDraft ? buildCompactDraftReviewCard(detailDraft) : null;
    if (
      stagedDrafts.length &&
      (!detailDraft ||
        !detailCard ||
        stableJson(detailCard.genreChips) !==
          stableJson(detailDraft.genres.chipSuggestions))
    ) {
      throw new Error('admin_detail_or_genre_chip_readback_failed');
    }
    if (
      stagedDrafts
        .filter((draft) => draft.reviewTrack === 'conflict_review')
        .some(
          (draft) =>
            !draft.audit.duplicateUrlReconciliation?.conflictReasons.length,
        )
    ) {
      throw new Error('admin_conflict_diagnosis_readback_failed');
    }

    counters.eventWriteRequests = mutationCounters.eventWriteRequests;
    counters.queueWriteRequests = mutationCounters.queueWriteRequests;
    counters.rollbackWriteRequests = mutationCounters.rollbackWriteRequests;
    counters.totalProductionWriteOperations =
      mutationCounters.successfulMutationRequests;
    counters.productionMutationsInThisRun =
      mutationCounters.successfulMutationRequests;
    counters.quarantinedDrafts = quarantinedDrafts.length;
    const reviewTracks = {
      auto_ready: stagedDrafts.filter((draft) => draft.reviewTrack === 'auto_ready').length,
      quick_review: stagedDrafts.filter((draft) => draft.reviewTrack === 'quick_review').length,
      conflict_review: stagedDrafts.filter(
        (draft) => draft.reviewTrack === 'conflict_review',
      ).length,
    };
    const coverage = {
      genres: stagedDrafts.filter((draft) => draft.genres.normalizedLabels.length).length,
      lineup: stagedDrafts.filter(
        (draft) => draft.proposedCanonicalEvent?.lineup?.length,
      ).length,
      tickets: stagedDrafts.filter(
        (draft) =>
          draft.proposedCanonicalEvent?.ticketUrl ||
          draft.proposedCanonicalEvent?.admissionPrice,
      ).length,
      officialWebsite: stagedDrafts.filter(
        (draft) => draft.proposedCanonicalEvent?.websiteUrl,
      ).length,
      conflictsOrDuplicates: stagedDrafts.filter(
        (draft) => draft.reviewTrack === 'conflict_review' || draft.duplicates.length,
      ).length,
    };
    const duplicateConcreteEventUrls: string[] = [];
    const concreteUrlCounts = new Map<string, number>();
    for (const draft of stagedDrafts) {
      for (const url of concreteDraftUrls(draft)) {
        concreteUrlCounts.set(url, (concreteUrlCounts.get(url) ?? 0) + 1);
      }
    }
    duplicateConcreteEventUrls.push(
      ...[...concreteUrlCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([url]) => url),
    );
    persistRunResult('completed', 'admin_readback', {
      fatalError: null,
      validDrafts: stagedDrafts.length,
      conflictDrafts: reviewTracks.conflict_review,
      drafts: {
        total: stagedDrafts.length,
        reviewTracks,
        coverage,
        duplicateConcreteEventUrls,
        damagedDrafts: 0,
      },
      adminReadback: {
        queueRouteFoundAll: true,
        detailRouteReadable: stagedDrafts.length === 0 || Boolean(detailDraft),
        trackFiltersReadable: true,
        safeSelectionCount: safeIds.length,
        genreChipsReadable: stagedDrafts.length === 0 || Boolean(detailCard),
        conflictDiagnosisReadable: true,
      },
      eventProtection: {
        beforeCount: eventsBefore.count,
        afterCount: eventsAfter.count,
        beforeFingerprint: eventsBefore.fingerprint,
        afterFingerprint: eventsAfter.fingerprint,
        unchanged: true,
      },
      counters,
      rolloutActivated: false,
    });
    console.log(
      JSON.stringify(
        {
          phase: '4.8.6.9.2c',
          preflight: {
            branch: EXPECTED_BRANCH,
            head: EXPECTED_HEAD,
            serverTime,
            queuedJobs: queueBefore.assessment.queuedIds,
            activeBlockers: queueBefore.assessment.blockers,
            automaticSources: sources.length,
            existingUnifiedDrafts: draftRowsBefore.length,
          },
          runtime: {
            totalMs: Date.now() - startedAt,
            liveFetchMs: fetchFinishedAt - fetchStartedAt,
            liveFetchLimitMs: LIVE_FETCH_LIMIT_MS,
          },
          sources: {
            successful: cleanResult.sourceResults.filter((row) => row.status === 'success')
              .length,
            failed: cleanResult.sourceResults.filter((row) => row.status === 'error').length,
            results: cleanResult.sourceResults,
          },
          cleanCore: {
            contributions: cleanResult.diagnostics.contributionCount,
            originalClusters: cleanResult.diagnostics.clusterCount,
            duplicateUrlGroups: reconciliation.duplicateUrlGroups,
            compatibleMergedGroups: reconciliation.compatibleMergedGroups,
            conflictGroups: reconciliation.conflictGroups,
            resultingDraftInputs: reconciliation.draftInputs.length,
            historicalClusters: historicalClusters.length,
            unprocessableClusters,
          },
          drafts: {
            total: stagedDrafts.length,
            reviewTracks,
            coverage,
          },
          adminReadback: {
            queueRouteFoundAll: true,
            detailRouteReadable: stagedDrafts.length === 0 || Boolean(detailDraft),
            safeSelectionCount: safeIds.length,
            genreChipsReadable: stagedDrafts.length === 0 || Boolean(detailCard),
            queueViewModel: {
              autoReady: viewModel.autoReadyCount,
              quickReview: viewModel.quickReviewCount,
              conflictReview: viewModel.conflictReviewCount,
            },
          },
          eventProtection: {
            beforeCount: eventsBefore.count,
            afterCount: eventsAfter.count,
            beforeFingerprint: eventsBefore.fingerprint,
            afterFingerprint: eventsAfter.fingerprint,
            unchanged: true,
          },
          queueProtection: {
            beforeFingerprint: queueBefore.fingerprint,
            afterFingerprint: queueAfter.fingerprint,
            unchanged: true,
          },
          counters,
          quarantinedDrafts,
          rolloutActivated: false,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (insertedIds.length || updatedSnapshots.length) {
      const rollback = await rollbackDraftWrites(
        client,
        insertedIds,
        updatedSnapshots,
        mutationCounters,
      );
      counters.rollbackWriteRequests = rollback.requests;
      counters.deletedRollbackDrafts = rollback.deleted;
      const eventsAfterRollback = await readPublishedEvents(client);
      if (eventsAfterRollback.count !== 93) {
        throw new Error(
          `rollback_completed_but_event_count_invalid:${eventsAfterRollback.count}`,
          { cause: error },
        );
      }
    }
    counters.eventWriteRequests = mutationCounters.eventWriteRequests;
    counters.queueWriteRequests = mutationCounters.queueWriteRequests;
    counters.totalProductionWriteOperations =
      mutationCounters.successfulMutationRequests;
    counters.productionMutationsInThisRun =
      mutationCounters.successfulMutationRequests;
    const compactCheckpoint = failureCheckpoint
      ? Object.fromEntries(
          Object.entries(failureCheckpoint).filter(
            ([key]) => key !== 'duplicateUrlDiagnostics',
          ),
        )
      : undefined;
    const fatalError = serializeError(error);
    persistRunResult('failed', String(runResult.lastCompletedStage ?? 'unknown'), {
      fatalError,
      preWriteCheckpoint: compactCheckpoint,
      eventBaseline: failureEventBaseline,
      counters,
      rolloutActivated: false,
    });
    console.error(
      JSON.stringify(
        {
          phase: '4.8.6.9.2c',
          fatalError,
          preWriteCheckpoint: compactCheckpoint,
          eventBaseline: failureEventBaseline,
          counters,
          rolloutActivated: false,
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    restoreMutationGuard();
  }
}

run().catch((error) => {
  let existing: JsonRow = {};
  try {
    existing = existsSync(RESULT_PATH)
      ? (JSON.parse(readFileSync(RESULT_PATH, 'utf8')) as JsonRow)
      : {};
  } catch {
    existing = {};
  }
  if (existing.stage !== 'failed') {
    atomicWriteJson(RESULT_PATH, {
      ...existing,
      phase: '4.8.6.9.2c',
      stage: 'failed',
      lastCompletedStage: existing.lastCompletedStage ?? 'none',
      fatalError: serializeError(error),
      rolloutActivated: false,
    });
  }
  process.exitCode = 1;
});
