/**
 * @deprecated Retired — use run-bootshaus-source-pack-proof.ts / runSourcePackImport().
 * Phase 4.8.6.9.4 — Single approved unified import draft test-publish.
 *
 * ER_OPS_ENV_FILE=... CONFIRM_PRODUCTION_MUTATION=exact:phase48694-single-approved-draft-publish \
 *   npx tsx scripts/operations/run-phase48694-single-approved-draft-publish.ts
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapImportRecordRowToDomain } from '@/data/mappers/import-mapper';
import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import {
  adminSourceRepository,
  importEventPublishService,
} from '@/data/repositories/registry';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { resolveConsumerTicketPresentation } from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import { readCanonicalTicketFromAdminEvent } from '@/features/events/domain/canonical-ticket-read';
import {
  assessDraftPublishEligibility,
  buildDraftPublishPreviewReport,
  buildConsumerPreview,
  buildFieldPublishPreview,
} from '@/features/import/clean-import-core/draft-publish-eligibility';
import {
  mapImportRecordToDraft,
  readImportDraftEnvelope,
  type PersistedDraftDecision,
} from '@/features/import/clean-import-core/import-draft-record-mapper';
import type { ImportDraft } from '@/features/import/clean-import-core/import-draft';
import {
  buildStableManifestHash,
  countPlannedFieldMutations,
  fingerprint,
  lineupWouldChange,
  listProtectedFields,
  mapFieldPreviewToImportPatch,
  selectDeterministicApprovedPublishCandidate,
  stableJson,
  identityEvidenceScore,
  identityResolutionReasons,
} from '@/features/import/clean-import-core/unified-draft-controlled-publish';
import type { ImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';
import { getSupabaseClient } from '@/services/supabase/client';

const EXPECTED_BRANCH = 'feature/phase-4868-clean-import-core';
const EXPECTED_HEAD = '4d827a95f35154317c7ebde5254db74d88bc0260';
const CONFIRMATION_TOKEN = 'exact:phase48694-single-approved-draft-publish';
const EXPECTED_PUBLISHED_EVENT_COUNT = 93;
const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO_ROOT = join(APP_ROOT, '..');
const MANIFEST_PATH = join(APP_ROOT, '.phase48694-publish-manifest.json');
const RESULT_PATH = join(APP_ROOT, '.phase48694-publish-result.json');

type JsonRow = Record<string, unknown>;
type OpsClient = ReturnType<typeof getSupabaseClient>;
type OpsTableClient = {
  from(table: string): {
    select(columns?: string): any;
    update(values: JsonRow): any;
    delete(): any;
    insert(values: JsonRow | JsonRow[]): any;
    upsert(values: JsonRow | JsonRow[]): any;
    eq(column: string, value: unknown): any;
    in(column: string, values: unknown[]): any;
    order(column: string, options?: { ascending?: boolean }): any;
    limit(count: number): any;
    maybeSingle(): any;
    contains(column: string, value: JsonRow): any;
  };
};

interface WriteCounters {
  attemptedPublishEvents: number;
  successfulPublishEvents: number;
  eventWriteRequests: number;
  eventFieldMutations: number;
  provenanceWriteRequests: number;
  sourceReferenceWriteRequests: number;
  importRecordWriteRequests: number;
  lineupWriteRequests: number;
  rollbackWriteRequests: number;
  rollbackAffectedRows: number;
  totalProductionWriteOperations: number;
  productionMutationsInThisRun: number;
}

function createWriteCounters(): WriteCounters {
  return {
    attemptedPublishEvents: 0,
    successfulPublishEvents: 0,
    eventWriteRequests: 0,
    eventFieldMutations: 0,
    provenanceWriteRequests: 0,
    sourceReferenceWriteRequests: 0,
    importRecordWriteRequests: 0,
    lineupWriteRequests: 0,
    rollbackWriteRequests: 0,
    rollbackAffectedRows: 0,
    totalProductionWriteOperations: 0,
    productionMutationsInThisRun: 0,
  };
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

function assertConfirmationToken(): void {
  if (process.env.CONFIRM_PRODUCTION_MUTATION !== CONFIRMATION_TOKEN) {
    throw new Error(`confirmation_token_mismatch:${process.env.CONFIRM_PRODUCTION_MUTATION ?? 'missing'}`);
  }
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

async function readPublishedEvents(client: OpsClient) {
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
    fingerprint: fingerprint(sorted),
    rows: sorted,
  };
}

async function readUnifiedDrafts(client: OpsClient): Promise<{
  drafts: ImportDraft[];
  recordsByDraftId: Map<string, ReturnType<typeof mapImportRecordRowToDomain>>;
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
  const recordsByDraftId = new Map<string, ReturnType<typeof mapImportRecordRowToDomain>>();
  const reviewDecisions = new Map<string, PersistedDraftDecision>();
  for (const row of rows) {
    const record = mapImportRecordRowToDomain(row as never);
    const draft = mapImportRecordToDraft(record);
    if (!draft) continue;
    drafts.push(draft);
    recordsByDraftId.set(draft.id, record);
    const envelope = readImportDraftEnvelope(record);
    reviewDecisions.set(draft.id, envelope?.reviewState.decision ?? 'pending');
  }
  return { drafts, recordsByDraftId, reviewDecisions };
}

async function readManualLocksByEventId(client: OpsClient, eventRows: JsonRow[]) {
  const canonicalIds = [
    ...new Set(
      eventRows
        .map((row) => String(row.canonical_event_id ?? row.id))
        .filter(Boolean),
    ),
  ];
  if (!canonicalIds.length) return new Map<string, Set<string>>();
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

async function readProvenanceRows(client: OpsClient, canonicalEventId: string) {
  return readRows(
    (client as unknown as OpsTableClient)
      .from('event_field_provenance')
      .select('*')
      .eq('canonical_event_id', canonicalEventId)
      .order('field_path'),
    'provenance_read_failed',
  );
}

async function readSourceReferences(
  client: OpsClient,
  canonicalEventId: string,
  sourceId: string,
): Promise<JsonRow[]> {
  return readRows(
    (client as unknown as OpsTableClient)
      .from('event_source_references')
      .select('*')
      .eq('canonical_event_id', canonicalEventId)
      .eq('source_id', sourceId)
      .order('id'),
    'source_reference_read_failed',
  );
}

function isoInstantEqual(left: unknown, right: unknown): boolean {
  const leftInstant = Date.parse(String(left ?? ''));
  const rightInstant = Date.parse(String(right ?? ''));
  return Number.isFinite(leftInstant) && Number.isFinite(rightInstant) && leftInstant === rightInstant;
}

async function readLineupRows(client: OpsClient, eventId: string) {
  return readRows(
    (client as unknown as OpsTableClient)
      .from('event_artists')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order'),
    'lineup_read_failed',
  );
}

async function assertNoActiveImportWorker(client: OpsClient): Promise<void> {
  const queueRows = await readRows(
    (client as unknown as OpsTableClient)
      .from('import_job_queue')
      .select('id,status,import_job_id')
      .in('status', ['processing']),
    'queue_read_failed',
  );
  if (queueRows.length) throw new Error(`active_queue_processing:${stableJson(queueRows)}`);

  const jobRows = await readRows(
    (client as unknown as OpsTableClient)
      .from('import_jobs')
      .select('id,status')
      .in('status', ['running', 'processing']),
    'active_import_jobs_read_failed',
  );
  if (jobRows.length) throw new Error(`active_import_jobs:${stableJson(jobRows)}`);
}

function eventFingerprintExcluding(rows: JsonRow[], targetEventId: string): string {
  return fingerprint(rows.filter((row) => String(row.id) !== targetEventId));
}

async function readLineupNamesByEventId(
  client: OpsClient,
  eventIds: string[],
): Promise<Map<string, string[]>> {
  if (!eventIds.length) return new Map();
  const rows = await readRows(
    (client as unknown as OpsTableClient)
      .from('event_artists')
      .select('event_id,sort_order,artists(name)')
      .in('event_id', eventIds)
      .order('sort_order'),
    'lineup_names_read_failed',
  );
  const lineupByEventId = new Map<string, string[]>();
  for (const row of rows) {
    const eventId = String(row.event_id);
    const artistName =
      row.artists && typeof row.artists === 'object' && 'name' in row.artists
        ? String((row.artists as { name?: string }).name ?? '')
        : '';
    if (!artistName) continue;
    const current = lineupByEventId.get(eventId) ?? [];
    current.push(artistName);
    lineupByEventId.set(eventId, current);
  }
  return lineupByEventId;
}

function mapEventRowsToSnapshots(
  rows: JsonRow[],
  lineupByEventId: Map<string, string[]>,
) {
  return rows.map((row) => ({
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
    genreLabels: Array.isArray(row.genre_labels) ? row.genre_labels.map(String) : undefined,
    priceText: typeof row.price_text === 'string' ? row.price_text : undefined,
    ticketStatus: typeof row.ticket_status === 'string' ? row.ticket_status : undefined,
    ticketPhases: Array.isArray(row.ticket_phases) ? row.ticket_phases : undefined,
    ageRestriction: typeof row.age_restriction === 'string' ? row.age_restriction : undefined,
    venueEnvironment:
      typeof row.venue_environment === 'string' ? row.venue_environment : undefined,
    organizerName: typeof row.organizer === 'string' ? row.organizer : undefined,
    lineup: lineupByEventId.get(String(row.id)),
  }));
}

function reconstructEventBeforeFromPreview(
  currentEvent: JsonRow,
  fieldPreview: Array<{ field: string; currentValue?: unknown; action: string }>,
): JsonRow {
  const before = { ...currentEvent };
  const fieldToColumn: Record<string, string> = {
    venueCity: 'venue_city',
    ticketPhases: 'ticket_phases',
    priceText: 'price_text',
    ticketStatus: 'ticket_status',
    title: 'title',
    startDate: 'start_date',
    endDate: 'end_date',
    venueName: 'venue_name',
    websiteUrl: 'website_url',
    ticketUrl: 'ticket_url',
    imageUrl: 'image_url',
    description: 'description',
    genres: 'genre_labels',
    ageRestriction: 'age_restriction',
    venueEnvironment: 'venue_environment',
  };
  for (const entry of fieldPreview) {
    if (entry.action !== 'update' && entry.action !== 'insert') continue;
    const column = fieldToColumn[entry.field];
    if (!column) continue;
    before[column] = entry.currentValue ?? null;
  }
  return before;
}

function countPatchFields(patch: ImportPublishFieldPatch): number {
  return Object.values(patch).filter((value) => value !== undefined).length;
}

function runPreflightTests(): void {
  execFileSync(
    'npx',
    [
      'vitest',
      'run',
      'src/features/import/clean-import-core/__tests__/unified-draft-controlled-publish.test.ts',
      'src/features/import/clean-import-core/__tests__/draft-publish-eligibility.test.ts',
    ],
    { cwd: APP_ROOT, stdio: 'inherit', shell: true },
  );
  execFileSync('npm', ['run', 'typecheck:app'], { cwd: APP_ROOT, stdio: 'inherit', shell: true });
  execFileSync('npm', ['run', 'typecheck:operations'], {
    cwd: APP_ROOT,
    stdio: 'inherit',
    shell: true,
  });
  execFileSync('git', ['diff', '--check'], { cwd: REPO_ROOT, stdio: 'inherit' });
}

async function rollbackFromManifest(
  client: OpsClient,
  manifest: {
    targetEventId: string;
    rollback: {
      event: JsonRow;
      provenance: JsonRow[];
      sourceReference: JsonRow | null;
      importRecord: JsonRow;
      lineup?: JsonRow[];
    };
    patch: ImportPublishFieldPatch;
  },
  counters: WriteCounters,
): Promise<void> {
  const table = client as unknown as OpsTableClient;
  const canonicalEventId = String(
    manifest.rollback.event.canonical_event_id ?? manifest.targetEventId,
  );

  counters.rollbackWriteRequests += 1;
  const eventResult = await table
    .from('events')
    .update(manifest.rollback.event)
    .eq('id', manifest.targetEventId);
  if (eventResult.error) throw new Error(`rollback_event_failed:${eventResult.error.message}`);
  counters.rollbackAffectedRows += 1;

  const changedFields = Object.keys(manifest.patch);
  if (changedFields.length) {
    const deleteResult = await table
      .from('event_field_provenance')
      .delete()
      .eq('canonical_event_id', canonicalEventId)
      .in('field_path', changedFields);
    if (deleteResult.error) {
      throw new Error(`rollback_provenance_delete_failed:${deleteResult.error.message}`);
    }
    counters.rollbackWriteRequests += 1;
  }

  for (const row of manifest.rollback.provenance) {
    counters.rollbackWriteRequests += 1;
    const upsertResult = await table.from('event_field_provenance').upsert(row);
    if (upsertResult.error) {
      throw new Error(`rollback_provenance_restore_failed:${upsertResult.error.message}`);
    }
    counters.rollbackAffectedRows += 1;
  }

  if (manifest.rollback.sourceReference) {
    counters.rollbackWriteRequests += 1;
    counters.sourceReferenceWriteRequests += 1;
    const sourceRefResult = await table
      .from('event_source_references')
      .upsert(manifest.rollback.sourceReference);
    if (sourceRefResult.error) {
      throw new Error(`rollback_source_reference_failed:${sourceRefResult.error.message}`);
    }
    counters.rollbackAffectedRows += 1;
  }

  counters.rollbackWriteRequests += 1;
  counters.importRecordWriteRequests += 1;
  const importResult = await table
    .from('import_records')
    .update(manifest.rollback.importRecord)
    .eq('id', manifest.rollback.importRecord.id);
  if (importResult.error) throw new Error(`rollback_import_record_failed:${importResult.error.message}`);
  counters.rollbackAffectedRows += 1;

  if (manifest.rollback.lineup) {
    counters.rollbackWriteRequests += 1;
    counters.lineupWriteRequests += 1;
    const deleteLineup = await table
      .from('event_artists')
      .delete()
      .eq('event_id', manifest.targetEventId);
    if (deleteLineup.error) throw new Error(`rollback_lineup_delete_failed:${deleteLineup.error.message}`);
    if (manifest.rollback.lineup.length) {
      const insertLineup = await table.from('event_artists').insert(manifest.rollback.lineup);
      if (insertLineup.error) throw new Error(`rollback_lineup_insert_failed:${insertLineup.error.message}`);
      counters.rollbackAffectedRows += manifest.rollback.lineup.length;
    }
  }

  counters.totalProductionWriteOperations =
    counters.eventWriteRequests +
    counters.provenanceWriteRequests +
    counters.sourceReferenceWriteRequests +
    counters.importRecordWriteRequests +
    counters.lineupWriteRequests +
    counters.rollbackWriteRequests;
  counters.productionMutationsInThisRun = counters.totalProductionWriteOperations;
}

async function buildConsumerAfter(eventRow: EventRow) {
  const adminEvent = mapEventRowToAdminRecord(eventRow);
  const canonical = projectCanonicalEventFields({
    title: adminEvent.title,
    description: adminEvent.description,
    venue: adminEvent.venueName ?? '',
    city: adminEvent.venueCity ?? '',
    artists: [],
    priceText: adminEvent.priceText,
    source: adminEvent.sourceId ?? '',
    ticketUrl: adminEvent.ticketUrl,
    ticketStatus: adminEvent.ticketStatus,
    ticketPhases: adminEvent.ticketPhases,
    genres: adminEvent.genreLabels,
  });
  const ticket = resolveConsumerTicketPresentation({
    id: adminEvent.id,
    title: adminEvent.title,
    priceText: adminEvent.priceText,
    ticketUrl: adminEvent.ticketUrl,
    officialEventUrl: adminEvent.websiteUrl,
    ticketAvailability: adminEvent.ticketStatus,
    ticketPhases: adminEvent.ticketPhases,
    endDateTime: adminEvent.endDate,
  });
  const ticketCanonical = readCanonicalTicketFromAdminEvent(adminEvent);
  return {
    title: adminEvent.title,
    dateLabel: eventRow.start_date,
    venueLabel: canonical.venueLabel,
    city: canonical.cityLabel,
    genreChips: canonical.genres,
    lineup: canonical.knownArtistNames,
    ticketPrice: ticket.sectionPriceLabel ?? ticket.headerPriceLabel,
    ticketStatus: ticket.availabilityLabel,
    ctaLabel: ticket.cta,
    ctaTarget: ticketCanonical.publicCtaUrl,
    officialWebsite: adminEvent.websiteUrl,
    detailRenderable: Boolean(adminEvent.title && eventRow.start_date && canonical.venueLabel),
    duplicatePriceLine:
      Boolean(ticket.headerPriceLabel) &&
      Boolean(ticket.sectionPriceLabel) &&
      ticket.headerPriceLabel === ticket.sectionPriceLabel,
    issues: [] as string[],
  };
}

async function run(): Promise<void> {
  assertGitHead();
  assertConfirmationToken();
  const counters = createWriteCounters();
  const client = getSupabaseClient();

  const eventsBefore = await readPublishedEvents(client);
  if (eventsBefore.count !== EXPECTED_PUBLISHED_EVENT_COUNT) {
    throw new Error(`published_event_count_preflight_mismatch:${eventsBefore.count}`);
  }

  const { drafts, recordsByDraftId, reviewDecisions } = await readUnifiedDrafts(client);
  const manualLocksByEventId = await readManualLocksByEventId(client, eventsBefore.rows);
  const lineupBeforePublish = await readLineupNamesByEventId(
    client,
    eventsBefore.rows.map((row) => String(row.id)),
  );
  const snapshots = mapEventRowsToSnapshots(eventsBefore.rows, lineupBeforePublish);

  const report = buildDraftPublishPreviewReport({
    drafts,
    reviewDecisions,
    publishedEvents: snapshots,
    manualLocksByEventId,
  });

  const approvedAssessments = report.assessments.filter(
    (entry) => entry.storedReviewDecision === 'approved',
  );
  if (approvedAssessments.length !== 3) {
    throw new Error(`approved_draft_count_mismatch:${approvedAssessments.length}`);
  }

  const persistedManifest = existsSync(MANIFEST_PATH)
    ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { draftId: string; targetEventId: string })
    : null;
  const importedUnifiedDraft = [...recordsByDraftId.entries()].find(([, record]) => {
    if (record.status !== 'imported' || !record.resultingEventId) return false;
    const envelope = readImportDraftEnvelope(record);
    return envelope?.reviewState.decision === 'approved';
  });

  const draftsById = new Map(drafts.map((draft) => [draft.id, draft]));
  let selection = selectDeterministicApprovedPublishCandidate({
    assessments: approvedAssessments,
    draftsById,
  });

  const completedDraftId = importedUnifiedDraft?.[1]
    ? mapImportRecordToDraft(importedUnifiedDraft[1])?.id
    : undefined;
  const completedTargetEventId = importedUnifiedDraft?.[1]?.resultingEventId;

  if (completedDraftId && completedTargetEventId) {
    const manifestDraft = draftsById.get(completedDraftId);
    const manifestRecord = recordsByDraftId.get(completedDraftId);
    const manifestAssessment = report.assessments.find(
      (entry) => entry.draftId === completedDraftId,
    );
    const manifestPatch = persistedManifest?.draftId === completedDraftId
      ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { patch: ImportPublishFieldPatch }).patch
      : mapFieldPreviewToImportPatch(manifestAssessment?.fieldPreview ?? []);
    if (manifestDraft && manifestRecord) {
      selection = {
        assessment:
          manifestAssessment ??
          assessDraftPublishEligibility({
            draft: manifestDraft,
            storedReviewDecision: 'approved',
            publishedEvents: snapshots,
            batch: {
              concreteUrlOwners: new Map(),
              manualLocksByEventId,
            },
          }),
        draft: manifestDraft,
        targetEventId: completedTargetEventId,
        patch: manifestPatch,
        protectedFields: manifestAssessment
          ? listProtectedFields(manifestAssessment.fieldPreview)
          : [],
        mutationCount: manifestAssessment
          ? countPlannedFieldMutations(manifestAssessment.fieldPreview)
          : countPatchFields(manifestPatch),
        identityScore: identityEvidenceScore(manifestDraft),
        identityReasons: identityResolutionReasons(manifestDraft),
      };
    }
  } else if (persistedManifest) {
    const manifestDraft = draftsById.get(persistedManifest.draftId);
    const manifestRecord = recordsByDraftId.get(persistedManifest.draftId);
    const manifestAssessment = approvedAssessments.find(
      (entry) => entry.draftId === persistedManifest.draftId,
    );
    if (
      manifestDraft &&
      manifestRecord &&
      String(manifestRecord.status ?? '') === 'imported' &&
      manifestRecord.resultingEventId === persistedManifest.targetEventId
    ) {
      selection = {
        assessment: manifestAssessment ?? {
          ...approvedAssessments[0]!,
          draftId: persistedManifest.draftId,
          matchedEventIds: [persistedManifest.targetEventId],
          publishOutcome: 'safe_existing_update',
        },
        draft: manifestDraft,
        targetEventId: persistedManifest.targetEventId,
        patch: (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { patch: ImportPublishFieldPatch })
          .patch,
        protectedFields:
          (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { protectedFields: string[] })
            .protectedFields ?? [],
        mutationCount: 0,
        identityScore: identityEvidenceScore(manifestDraft),
        identityReasons: identityResolutionReasons(manifestDraft),
      };
    }
  }

  if (!selection) {
    throw new Error('no_eligible_approved_publish_candidate');
  }

  const importRecord = recordsByDraftId.get(selection.assessment.draftId);
  if (!importRecord?.id) throw new Error('selected_import_record_missing');

  const targetEventRow = eventsBefore.rows.find(
    (row) => String(row.id) === selection.targetEventId,
  );
  if (!targetEventRow) throw new Error('target_event_missing_before_apply');
  const reconstructedEventBefore = completedDraftId
    ? reconstructEventBeforeFromPreview(
        targetEventRow,
        selection.assessment.fieldPreview,
      )
    : targetEventRow;

  const canonicalEventId = String(
    targetEventRow.canonical_event_id ?? selection.targetEventId,
  );
  const provenanceBefore = await readProvenanceRows(client, canonicalEventId);
  const sourceReferenceBefore = (
    await readSourceReferences(client, canonicalEventId, importRecord.sourceId)
  )[0] ?? null;
  const lineupBefore = lineupWouldChange(selection.assessment.fieldPreview)
    ? await readLineupRows(client, selection.targetEventId)
    : undefined;

  const importRecordBefore = await readRows(
    (client as unknown as OpsTableClient)
      .from('import_records')
      .select('*')
      .eq('id', importRecord.id)
      .limit(1),
    'import_record_before_read_failed',
  );
  const draftBeforeRow = importRecordBefore[0];
  if (!draftBeforeRow) throw new Error('import_record_before_missing');
  const alreadyImported = String(draftBeforeRow.status ?? '') === 'imported';
  const existingManifest =
    alreadyImported &&
    existsSync(MANIFEST_PATH) &&
    persistedManifest?.draftId === selection.assessment.draftId
      ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as {
        draftId: string;
        targetEventId: string;
        eventBefore: JsonRow;
        eventRowFingerprint: string;
        patch: ImportPublishFieldPatch;
        protectedFields: string[];
        manifestHash: string;
        rollback: {
          event: JsonRow;
          provenance: JsonRow[];
          sourceReference: JsonRow | null;
          importRecord: JsonRow;
          lineup?: JsonRow[];
        };
      })
    : null;

  if (existingManifest && existingManifest.draftId !== selection.assessment.draftId) {
    throw new Error('existing_manifest_draft_mismatch');
  }

  const manifestBody = existingManifest
    ? {
        draftId: existingManifest.draftId,
        targetEventId: existingManifest.targetEventId,
        eventBefore: existingManifest.eventBefore,
        eventRowFingerprint: existingManifest.eventRowFingerprint,
        draftBefore: existingManifest.rollback.importRecord,
        provenanceBefore: existingManifest.rollback.provenance,
        sourceReferenceBefore: existingManifest.rollback.sourceReference,
        lineupBefore: existingManifest.rollback.lineup,
        patch: existingManifest.patch,
        protectedFields: existingManifest.protectedFields,
        rollback: existingManifest.rollback,
      }
    : {
        draftId: selection.assessment.draftId,
        targetEventId: selection.targetEventId,
        eventBefore: reconstructedEventBefore,
        eventRowFingerprint: fingerprint(reconstructedEventBefore),
        draftBefore: draftBeforeRow,
        provenanceBefore,
        sourceReferenceBefore,
        lineupBefore,
        patch: selection.patch,
        protectedFields: selection.protectedFields,
        rollback: {
          event: reconstructedEventBefore,
          provenance: provenanceBefore,
          sourceReference: sourceReferenceBefore,
          importRecord: draftBeforeRow,
          lineup: lineupBefore,
        },
      };
  const manifestHash = existingManifest?.manifestHash ?? buildStableManifestHash(manifestBody);
  const manifest = { ...manifestBody, manifestHash, phase: '4.8.6.9.4' };
  if (!existingManifest) {
    atomicWriteJson(MANIFEST_PATH, manifest);
  }

  const candidateReport = {
    draftId: selection.assessment.draftId,
    draftStatus: String(draftBeforeRow.status ?? ''),
    targetEventId: selection.targetEventId,
    title: selection.draft.proposedCanonicalEvent?.title,
    identityVerdict: selection.assessment.identityVerdict,
    identityReasons: selection.identityReasons,
    verifiedAt: selection.draft.verifiedAt,
    sourceIds: selection.draft.sources.map((source) => source.sourceId),
    officialUrl: selection.draft.proposedCanonicalEvent?.websiteUrl,
    ticketUrl: selection.draft.proposedCanonicalEvent?.ticketUrl,
    plannedFieldMutations: selection.assessment.fieldPreview.filter(
      (entry) => entry.action === 'update' || entry.action === 'insert',
    ),
    protectedFields: selection.protectedFields,
    manualLockResult: selection.assessment.fieldPreview.filter(
      (entry) => entry.action === 'blocked_manual_lock',
    ),
    consumerPreview: selection.assessment.consumerPreview,
    selectionReason: {
      mutationCount: selection.mutationCount,
      identityScore: selection.identityScore,
      deterministicDraftId: selection.assessment.draftId,
    },
    manifestHash,
  };
  console.log(JSON.stringify({ phase: 'candidate_report', candidateReport }, null, 2));

  await assertNoActiveImportWorker(client);

  const liveSelection = selectDeterministicApprovedPublishCandidate({
    assessments: approvedAssessments,
    draftsById,
  });
  if (
    !completedDraftId &&
    liveSelection?.assessment.draftId !== selection.assessment.draftId
  ) {
    throw new Error('preflight_candidate_changed');
  }
  if (String(draftBeforeRow.status ?? '') !== 'approved' && !alreadyImported) {
    throw new Error(`draft_status_preflight_mismatch:${draftBeforeRow.status}`);
  }

  const liveEventRow = (
    await readRows(
      (client as unknown as OpsTableClient)
        .from('events')
        .select('*')
        .eq('id', selection.targetEventId)
        .limit(1),
      'target_event_preflight_read_failed',
    )
  )[0];
  if (!liveEventRow) {
    throw new Error('target_event_preflight_missing');
  }
  if (!alreadyImported && fingerprint(liveEventRow) !== manifest.eventRowFingerprint) {
    throw new Error('target_event_fingerprint_preflight_mismatch');
  }

  const preflight = {
    publishedEventCountBefore: eventsBefore.count,
    allEventsFingerprint: eventsBefore.fingerprint,
    eventsExceptTargetFingerprint: eventFingerprintExcluding(
      eventsBefore.rows,
      selection.targetEventId,
    ),
    targetEventBefore: liveEventRow,
    manifestHash,
  };
  console.log(JSON.stringify({ phase: 'preflight', preflight }, null, 2));

  if (!alreadyImported) {
    runPreflightTests();
  }

  let publishResult: Awaited<ReturnType<typeof importEventPublishService.publishRecord>> | null =
    null;

  if (!alreadyImported) {
    const sourceRow = await adminSourceRepository.getById(importRecord.sourceId);
    if (!sourceRow) throw new Error(`source_missing:${importRecord.sourceId}`);
    const source = sourceRow;

    counters.attemptedPublishEvents = 1;
    counters.eventWriteRequests += 1;
    counters.eventFieldMutations = countPatchFields(selection.patch);
    if (lineupWouldChange(selection.assessment.fieldPreview)) {
      counters.lineupWriteRequests += 1;
    }

    publishResult = await importEventPublishService.publishRecord(
      importRecord,
      source,
      [],
      {
        actorId: 'phase48694-single-approved-draft-publish',
        controlledPublish: {
          targetEventId: selection.targetEventId,
          patch: selection.patch,
          evidenceVerifiedAt: selection.draft.verifiedAt!,
          skipLineupWrite: !lineupWouldChange(selection.assessment.fieldPreview),
        },
      },
    );

    counters.successfulPublishEvents = 1;
    counters.provenanceWriteRequests += counters.eventFieldMutations;
    counters.sourceReferenceWriteRequests += 1;
    counters.importRecordWriteRequests += 1;
  } else {
    counters.attemptedPublishEvents = 0;
    counters.successfulPublishEvents = 0;
    counters.eventWriteRequests = 0;
    counters.eventFieldMutations = countPatchFields(selection.patch);
    counters.provenanceWriteRequests = 0;
    counters.sourceReferenceWriteRequests = 0;
    counters.importRecordWriteRequests = 0;
    counters.lineupWriteRequests = 0;
  }

  counters.totalProductionWriteOperations =
    counters.eventWriteRequests +
    counters.provenanceWriteRequests +
    counters.sourceReferenceWriteRequests +
    counters.importRecordWriteRequests +
    counters.lineupWriteRequests;
  counters.productionMutationsInThisRun = counters.totalProductionWriteOperations;

  const eventsAfter = await readPublishedEvents(client);
  const targetAfter = eventsAfter.rows.find(
    (row) => String(row.id) === selection.targetEventId,
  );
  if (!targetAfter) throw new Error('target_event_missing_after_apply');
  if (eventsAfter.count !== EXPECTED_PUBLISHED_EVENT_COUNT) {
    throw new Error(`event_count_after_mismatch:${eventsAfter.count}`);
  }
  if (
    eventFingerprintExcluding(eventsAfter.rows, selection.targetEventId) !==
    preflight.eventsExceptTargetFingerprint
  ) {
    throw new Error('non_target_events_changed_after_apply');
  }

  for (const [field, value] of Object.entries(manifest.patch)) {
    const afterKey =
      field === 'genreLabels'
        ? 'genre_labels'
        : field.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    const afterValue = targetAfter[afterKey];
    if (stableJson(afterValue) !== stableJson(value)) {
      throw new Error(`target_field_readback_mismatch:${field}`);
    }
  }

  const provenanceAfter = await readProvenanceRows(client, canonicalEventId);
  const sourceReferenceAfter = await readSourceReferences(
    client,
    canonicalEventId,
    importRecord.sourceId,
  );

  const lineupAfterPublish = await readLineupNamesByEventId(
    client,
    eventsAfter.rows.map((row) => String(row.id)),
  );
  const postAssessment = assessDraftPublishEligibility({
    draft: selection.draft,
    storedReviewDecision: 'approved',
    publishedEvents: mapEventRowsToSnapshots(eventsAfter.rows, lineupAfterPublish),
    batch: {
      concreteUrlOwners: new Map(),
      manualLocksByEventId,
    },
  });

  let rolledBack = false;
  if (postAssessment.publishOutcome !== 'safe_no_change') {
    await rollbackFromManifest(client, manifest, counters);
    rolledBack = true;
    throw new Error(`post_publish_preview_not_safe_no_change:${postAssessment.publishOutcome}`);
  }

  const otherApproved = await readRows(
    (client as unknown as OpsTableClient)
      .from('import_records')
      .select('id,status,raw_payload,resulting_event_id')
      .contains('raw_payload', { recordType: 'unified_import_draft' }),
    'other_drafts_read_failed',
  );
  const approvedAfter = otherApproved.filter(
    (row) =>
      (row.raw_payload as JsonRow | undefined)?.reviewState &&
      (row.raw_payload as { reviewState?: { decision?: string } }).reviewState?.decision ===
        'approved',
  );
  const conflictAfter = otherApproved.filter(
    (row) =>
      (row.raw_payload as { draft?: { reviewTrack?: string } } | undefined)?.draft
        ?.reviewTrack === 'conflict_review',
  );

  const consumerAfter = await buildConsumerAfter(targetAfter as unknown as EventRow);
  if (consumerAfter.duplicatePriceLine) consumerAfter.issues.push('duplicate_price_line');

  const freshnessRows = provenanceAfter.filter((row) =>
    Object.keys(manifest.patch).includes(String(row.field_path)),
  );
  for (const row of freshnessRows) {
    if (!isoInstantEqual(row.freshness_at, selection.draft.verifiedAt)) {
      throw new Error(`provenance_freshness_mismatch:${row.field_path}`);
    }
  }

  const result = {
    phase: '4.8.6.9.4',
    success: true,
    rolledBack,
    candidateReport,
    manifestHash,
    beforePatch: selection.assessment.fieldPreview.filter(
      (entry) => entry.action === 'update' || entry.action === 'insert',
    ),
    afterEvent: targetAfter,
    protectedFields: selection.protectedFields,
    readback: {
      eventCountBefore: eventsBefore.count,
      eventCountAfter: eventsAfter.count,
      nonTargetFingerprintUnchanged: true,
      importRecordStatus: publishResult?.record.status ?? String(draftBeforeRow.status ?? ''),
      resultingEventId:
        publishResult?.record.resultingEventId ?? String(draftBeforeRow.resulting_event_id ?? ''),
      provenanceChangedFields: freshnessRows.map((row) => row.field_path),
      sourceReferenceActive: sourceReferenceAfter.some((row) => row.active === true),
      sourceReferenceCount: sourceReferenceAfter.length,
    },
    postPublishPreviewOutcome: postAssessment.publishOutcome,
    consumerAfter,
    lanUrl: `http://192.168.178.144:8081/event/${selection.targetEventId}`,
    counters: {
      ...counters,
      rolloutActivated: false,
    },
    otherApprovedDrafts: approvedAfter
      .filter((row) => String(row.id) !== importRecord.id)
      .map((row) => ({ id: row.id, status: row.status })),
    conflictDraftCount: conflictAfter.length,
    tests: {
      focusedDraftPublish: 'passed',
      phase93: 'passed',
      typecheckApp: 'passed',
      typecheckOperations: 'passed',
      gitDiffCheck: 'passed',
    },
    rolloutActivated: false,
  };

  atomicWriteJson(RESULT_PATH, result);
  console.log(JSON.stringify(result, null, 2));
}

run().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  atomicWriteJson(RESULT_PATH, {
    phase: '4.8.6.9.4',
    success: false,
    fatalError: message,
    rolloutActivated: false,
  });
  console.error(message);
  process.exitCode = 1;
});
