/**
 * Phase 4.8.6.9.3 — read-only automatic eligibility and publish preview
 * for persisted unified import drafts. No production writes.
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapImportRecordRowToDomain } from '@/data/mappers/import-mapper';
import {
  buildDraftPublishPreviewReport,
  type PublishedEventSnapshot,
} from '@/features/import/clean-import-core/draft-publish-eligibility';
import {
  mapImportRecordToDraft,
  readImportDraftEnvelope,
  type PersistedDraftDecision,
} from '@/features/import/clean-import-core/import-draft-record-mapper';
import type { ImportDraft } from '@/features/import/clean-import-core/import-draft';
import { getSupabaseClient } from '@/services/supabase/client';

const EXPECTED_BRANCH = 'feature/phase-4868-clean-import-core';
const EXPECTED_HEAD = 'e7db488dd3934ea90cfa68473c500b62e21f0efe';
const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO_ROOT = join(APP_ROOT, '..');
const RESULT_PATH = join(APP_ROOT, '.phase48693-preview-result.json');
const QUARANTINE_RESULT_PATH = join(APP_ROOT, '.phase48692c-result.json');

type JsonRow = Record<string, unknown>;
type OpsClient = ReturnType<typeof getSupabaseClient>;
type OpsTableClient = {
  from(table: string): {
    select(columns?: string): any;
    update(values: JsonRow): any;
    delete(): any;
    insert(values: JsonRow): any;
  };
};

interface EventBaseline {
  count: number;
  fingerprint: string;
}

interface MutationCounters {
  attemptedMutationRequests: number;
  successfulMutationRequests: number;
  eventWriteRequests: number;
  draftWriteRequests: number;
  queueWriteRequests: number;
}

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

function assertGitHead(): void {
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim();
  if (branch !== EXPECTED_BRANCH) throw new Error(`preflight_branch_mismatch:${branch}`);
  if (head !== EXPECTED_HEAD) throw new Error(`preflight_head_mismatch:${head}`);
}

function installReadOnlyMutationGuard(baseUrl: string, counters: MutationCounters) {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const base = new URL(baseUrl);
  const guardedFetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const isDatabaseRequest =
      url.origin === base.origin && url.pathname.startsWith('/rest/v1/');
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
    if (isDatabaseRequest && isMutation) {
      counters.attemptedMutationRequests += 1;
      const table = decodeURIComponent(url.pathname.slice('/rest/v1/'.length)).split('/')[0] ?? '';
      if (table === 'events') counters.eventWriteRequests += 1;
      else if (table === 'import_records') counters.draftWriteRequests += 1;
      else if (['import_job_queue', 'import_schedule_locks'].includes(table)) {
        counters.queueWriteRequests += 1;
      }
      throw new Error(`read_only_preview_blocked:${table}:${request.method}`);
    }
    return originalFetch(request);
  };
  globalThis.fetch = guardedFetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function readRows(
  resultPromise: PromiseLike<{ data: unknown; error: unknown }>,
  label: string,
): Promise<JsonRow[]> {
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

async function readPublishedEvents(client: OpsClient): Promise<{
  baseline: EventBaseline;
  rows: JsonRow[];
  snapshots: PublishedEventSnapshot[];
}> {
  const rows = await readRows(
    (client as unknown as OpsTableClient)
      .from('events')
      .select(
        'id,canonical_event_id,title,start_date,end_date,venue_name,venue_city,website_url,ticket_url,description,image_url,genre_labels,price_text,ticket_status,age_restriction,venue_environment,organizer',
      )
      .eq('status', 'published')
      .order('id'),
    'published_events_read_failed',
  );
  const sorted = [...rows].sort((left, right) =>
    String(left.id ?? '').localeCompare(String(right.id ?? '')),
  );
  return {
    baseline: {
      count: sorted.length,
      fingerprint: fingerprint(sorted),
    },
    rows: sorted,
    snapshots: sorted.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      startDate: String(row.start_date ?? ''),
      endDate: typeof row.end_date === 'string' ? row.end_date : undefined,
      venueName: typeof row.venue_name === 'string' ? row.venue_name : undefined,
      venueCity: typeof row.venue_city === 'string' ? row.venue_city : undefined,
      websiteUrl: typeof row.website_url === 'string' ? row.website_url : undefined,
      ticketUrl: typeof row.ticket_url === 'string' ? row.ticket_url : undefined,
      description: typeof row.description === 'string' ? row.description : undefined,
      imageUrl: typeof row.image_url === 'string' ? row.image_url : undefined,
      genreLabels: Array.isArray(row.genre_labels)
        ? row.genre_labels.map(String)
        : undefined,
      priceText: typeof row.price_text === 'string' ? row.price_text : undefined,
      ticketStatus: typeof row.ticket_status === 'string' ? row.ticket_status : undefined,
      ageRestriction:
        typeof row.age_restriction === 'string' ? row.age_restriction : undefined,
      venueEnvironment:
        typeof row.venue_environment === 'string' ? row.venue_environment : undefined,
      organizerName: typeof row.organizer === 'string' ? row.organizer : undefined,
    })),
  };
}

async function readUnifiedDrafts(client: OpsClient): Promise<{
  drafts: ImportDraft[];
  reviewDecisions: Map<string, PersistedDraftDecision>;
}> {
  const rows = await readRows(
    (client as unknown as OpsTableClient)
      .from('import_records')
      .select('*')
      .contains('raw_payload', { recordType: 'unified_import_draft' })
      .limit(10000),
    'unified_drafts_read_failed',
  );
  const drafts: ImportDraft[] = [];
  const reviewDecisions = new Map<string, PersistedDraftDecision>();
  for (const row of rows) {
    const record = mapImportRecordRowToDomain(row as never);
    const draft = mapImportRecordToDraft(record);
    if (!draft) continue;
    drafts.push(draft);
    const envelope = readImportDraftEnvelope(record);
    reviewDecisions.set(draft.id, envelope?.reviewState.decision ?? 'pending');
  }
  return { drafts, reviewDecisions };
}

async function readManualLocksByEventId(
  client: OpsClient,
  eventRows: JsonRow[],
): Promise<Map<string, Set<string>>> {
  const canonicalIds = [
    ...new Set(
      eventRows
        .map((row) => String(row.canonical_event_id ?? row.id))
        .filter(Boolean),
    ),
  ];
  if (!canonicalIds.length) return new Map();
  const rows = await readRows(
    (client as unknown as OpsTableClient)
      .from('event_field_provenance')
      .select('canonical_event_id,field_path,selected_source_id,manually_overridden')
      .in('canonical_event_id', canonicalIds),
    'event_field_provenance_read_failed',
  );
  const locks = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.selected_source_id !== 'manual_override' && !row.manually_overridden) continue;
    const eventId =
      eventRows.find(
        (eventRow) =>
          String(eventRow.canonical_event_id ?? '') === String(row.canonical_event_id) ||
          String(eventRow.id) === String(row.canonical_event_id),
      )?.id ?? row.canonical_event_id;
    const field = String(row.field_path);
    const current = locks.get(String(eventId)) ?? new Set<string>();
    current.add(field);
    locks.set(String(eventId), current);
  }
  return locks;
}

function readQuarantinedOutsideDrafts(): number {
  if (!existsSync(QUARANTINE_RESULT_PATH)) return 0;
  try {
    const payload = JSON.parse(readFileSync(QUARANTINE_RESULT_PATH, 'utf8')) as {
      quarantinedDrafts?: unknown[];
    };
    return Array.isArray(payload.quarantinedDrafts) ? payload.quarantinedDrafts.length : 0;
  } catch {
    return 0;
  }
}

async function run(): Promise<void> {
  assertGitHead();
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!baseUrl) throw new Error('preflight_ops_credentials_missing');
  const counters: MutationCounters = {
    attemptedMutationRequests: 0,
    successfulMutationRequests: 0,
    eventWriteRequests: 0,
    draftWriteRequests: 0,
    queueWriteRequests: 0,
  };
  const restoreMutationGuard = installReadOnlyMutationGuard(baseUrl, counters);
  const client = getSupabaseClient();

  try {
    const eventsBefore = await readPublishedEvents(client);
    if (eventsBefore.baseline.count !== 93) {
      throw new Error(`published_event_count_preflight_mismatch:${eventsBefore.baseline.count}`);
    }
    const { drafts, reviewDecisions } = await readUnifiedDrafts(client);
    if (!drafts.length) throw new Error('no_unified_import_drafts_found');

    const manualLocksByEventId = await readManualLocksByEventId(client, eventsBefore.rows);
    const report = buildDraftPublishPreviewReport({
      drafts,
      reviewDecisions,
      publishedEvents: eventsBefore.snapshots,
      manualLocksByEventId,
    });
    const eventsAfter = await readPublishedEvents(client);
    if (
      eventsAfter.baseline.count !== eventsBefore.baseline.count ||
      eventsAfter.baseline.fingerprint !== eventsBefore.baseline.fingerprint
    ) {
      throw new Error('published_events_changed_during_preview');
    }

    const approvedDrafts = report.assessments.filter(
      (entry) => entry.storedReviewDecision === 'approved',
    );
    const approvedDraft = approvedDrafts[0];
    const result = {
      phase: '4.8.6.9.3',
      loadedDrafts: drafts.length,
      quarantinedOutsideDrafts: readQuarantinedOutsideDrafts(),
      storedReviewTracks: report.summary.storedReviewTracks,
      storedDecisions: report.summary.storedDecisions,
      suggestedReviewTracks: report.summary.suggestedReviewTracks,
      publishOutcomes: report.summary.publishOutcomes,
      enrichmentGapCounts: report.summary.enrichmentGapCounts,
      genreDispositionCounts: report.summary.genreDispositionCounts,
      adminSummary: report.adminSummary,
      approvedDraftCount: approvedDrafts.length,
      approvedDraftPreview: approvedDraft
        ? {
            draftId: approvedDraft.draftId,
            persistenceRecordId: approvedDraft.persistenceRecordId,
            storedReviewDecision: approvedDraft.storedReviewDecision,
            publishOutcome: approvedDraft.publishOutcome,
            publishEligible: approvedDraft.publishEligible,
            matchedEventIds: approvedDraft.matchedEventIds,
            identityVerdict: approvedDraft.identityVerdict,
            fieldPreview: approvedDraft.fieldPreview,
            consumerPreview: approvedDraft.consumerPreview,
            blockingReasons: approvedDraft.blockingReasons,
            enrichmentGaps: approvedDraft.enrichmentGaps,
          }
        : null,
      eventProtection: {
        beforeCount: eventsBefore.baseline.count,
        afterCount: eventsAfter.baseline.count,
        beforeFingerprint: eventsBefore.baseline.fingerprint,
        afterFingerprint: eventsAfter.baseline.fingerprint,
        unchanged: true,
      },
      counters: {
        databaseWriteOperations: 0,
        eventWriteRequests: counters.eventWriteRequests,
        draftWriteRequests: counters.draftWriteRequests,
        queueWriteRequests: counters.queueWriteRequests,
        productionMutationsInThisRun: counters.successfulMutationRequests,
        rolloutActivated: false,
      },
      assessments: report.assessments.map((entry) => ({
        draftId: entry.draftId,
        persistenceRecordId: entry.persistenceRecordId,
        storedReviewTrack: entry.storedReviewTrack,
        storedReviewDecision: entry.storedReviewDecision,
        suggestedReviewTrack: entry.suggestedReviewTrack,
        automaticPublishEligible: entry.automaticPublishEligible,
        publishOutcome: entry.publishOutcome,
        publishEligible: entry.publishEligible,
        matchedEventIds: entry.matchedEventIds,
        blockingReasons: entry.blockingReasons,
        enrichmentGaps: entry.enrichmentGaps,
        genreDisposition: entry.genreDisposition,
        consumerIssues: entry.consumerPreview.issues,
      })),
    };
    atomicWriteJson(RESULT_PATH, result);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    restoreMutationGuard();
  }
}

run().catch((error) => {
  atomicWriteJson(RESULT_PATH, {
    phase: '4.8.6.9.3',
    fatalError: error instanceof Error ? error.message : String(error),
    counters: {
      databaseWriteOperations: 0,
      eventWriteRequests: 0,
      draftWriteRequests: 0,
      productionMutationsInThisRun: 0,
      rolloutActivated: false,
    },
  });
  process.exitCode = 1;
});
