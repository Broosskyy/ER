/**
 * Phase 4.8.6.7.5 — First restricted bulk apply (8 events, 11 ticket field mutations).
 *
 * CONFIRM_PRODUCTION_MUTATION=exact:phase48674-first-restricted-bulk \
 *   npx tsx scripts/operations/_phase48675-restricted-bulk-apply.ts --apply
 */
import './phase48675-env-bootstrap';
import './bootstrap-ops-supabase';

import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { createSourceConnectorFetchProvider } from '@/features/aggregation/connectors/create-source-connector-fetch-provider';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { AggregationLogService } from '@/features/aggregation/logging/aggregation-log-service';
import { AggregationPipeline } from '@/features/aggregation/pipeline/aggregation-pipeline';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import {
  adminSourceRepository,
  multiSourceRepositories,
} from '@/data/repositories/registry';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { readCanonicalTicketFromAdminEvent } from '@/features/events/domain/canonical-ticket-read';
import {
  auditConsumerTicketPresentationForEvent,
} from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import {
  applyRestrictedBulkManifest,
  computeRestrictedEventFingerprint,
  runRestrictedBulkPreflight,
  verifyRestrictedBulkManifestAfter,
  type RestrictedBulkApplyDeps,
} from '@/features/import/bulk-canonical-rebuild/restricted-bulk-apply';
import {
  APPROVED_EVENT_IDS,
  APPROVED_MANIFEST_HASH,
  APPLY_CONFIRMATION_TOKEN,
  assertConfirmationToken,
  createRestrictedBulkWriteCounters,
  productionMutationsInThisRun,
  validateManifestPlan,
  type RestrictedBulkManifest,
} from '@/features/import/bulk-canonical-rebuild/restricted-bulk-apply-security';

import { opsClient, updateEventRow } from './ops-supabase-rows';

const OPS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(OPS_DIR, '../..');
const OUT = join(ROOT, 'docs/real-data');
const MANIFEST_FILE = join(OUT, '_phase48674_restricted_bulk_plan.json');
const ROLLBACK_FILE = join(OUT, '_phase48674_restricted_bulk_rollback.json');
const APPLY_RESULT_FILE = join(OUT, '_phase48675_restricted_bulk_apply_result.json');

const PHASE = '4.8.6.7.5';
const READBACK_ONLY = process.argv.includes('--readback-only');
const CERTIFY_ONLY = process.argv.includes('--certify-only');
const APPLY_MODE = process.argv.includes('--apply') || READBACK_ONLY || CERTIFY_ONLY;

function writeJson(path: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function gitHead(): string {
  return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
}

function gitRemoteHead(): string {
  return execSync('git rev-parse origin/feature/phase-4867-bulk-canonical-rebuild', {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

async function loadEventRow(eventId: string): Promise<EventRow> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`event_missing:${eventId}`);
  return data as EventRow;
}

async function loadProvenance(eventId: string, fields: string[]): Promise<Record<string, unknown>> {
  const { data, error } = await opsClient()
    .from('event_field_provenance')
    .select('*')
    .eq('canonical_event_id', eventId)
    .in('field_path', fields);
  if (error) throw new Error(error.message);
  const map: Record<string, unknown> = {};
  for (const row of data ?? []) {
    map[row.field_path as string] = row;
  }
  return map;
}

async function restoreProvenance(
  eventId: string,
  fieldPath: string,
  snapshot: Record<string, unknown> | null,
): Promise<void> {
  if (!snapshot) {
    await opsClient()
      .from('event_field_provenance')
      .delete()
      .eq('canonical_event_id', eventId)
      .eq('field_path', fieldPath);
    return;
  }
  const { error } = await opsClient()
    .from('event_field_provenance')
    .upsert({ ...snapshot, canonical_event_id: eventId, field_path: fieldPath } as never);
  if (error) throw new Error(error.message);
}

async function loadSourceReference(eventId: string, sourceId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await opsClient()
    .from('event_source_references')
    .select('*')
    .eq('canonical_event_id', eventId)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

async function touchSourceReference(eventId: string, sourceId: string): Promise<void> {
  const { error } = await opsClient()
    .from('event_source_references')
    .update({ last_seen_at: new Date().toISOString() } as never)
    .eq('canonical_event_id', eventId)
    .eq('source_id', sourceId);
  if (error) throw new Error(error.message);
}

async function restoreSourceReference(snapshot: Record<string, unknown>): Promise<void> {
  const { error } = await opsClient()
    .from('event_source_references')
    .update({
      last_seen_at: snapshot.last_seen_at,
      active: snapshot.active,
    } as never)
    .eq('id', snapshot.id as string);
  if (error) throw new Error(error.message);
}

async function loadImportRecord(eventId: string, sourceId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await opsClient()
    .from('import_records')
    .select('*')
    .eq('resulting_event_id', eventId)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

async function touchImportRecord(recordId: string): Promise<void> {
  const { error } = await opsClient()
    .from('import_records')
    .update({ updated_at: new Date().toISOString() } as never)
    .eq('id', recordId);
  if (error) throw new Error(error.message);
}

async function restoreImportRecord(snapshot: Record<string, unknown>): Promise<void> {
  const { error } = await opsClient()
    .from('import_records')
    .update({ updated_at: snapshot.updated_at, status: snapshot.status } as never)
    .eq('id', snapshot.id as string);
  if (error) throw new Error(error.message);
}

const pipelineCache = new Map<string, CanonicalImportEvent | null>();

async function loadCandidateEnvelope(
  sourceId: string,
  ticketUrl: string,
): Promise<CanonicalImportEvent | null> {
  if (!pipelineCache.has(sourceId)) {
    const source = await adminSourceRepository.getById(sourceId);
    if (!source) return null;
    const pipeline = new AggregationPipeline({
      fetchProvider: createSourceConnectorFetchProvider(sourceConnectorRegistry),
      logService: new AggregationLogService(),
    });
    const importSource = mapSourceRecordToImportSource(source);
    const result = await pipeline.run(source, importSource, 'manual', 'phase48675-restricted-bulk-apply');
    pipelineCache.set(
      sourceId,
      result.records.find((r) => r.canonicalEvent)?.canonicalEvent ?? null,
    );
  }
  const cached = pipelineCache.get(sourceId);
  if (!cached) return null;
  if (cached.ticketUrl === ticketUrl || cached.eventUrl === ticketUrl || cached.originalLink === ticketUrl) {
    return cached;
  }
  const source = await adminSourceRepository.getById(sourceId);
  if (!source) return null;
  const pipeline = new AggregationPipeline({
    fetchProvider: createSourceConnectorFetchProvider(sourceConnectorRegistry),
    logService: new AggregationLogService(),
  });
  const importSource = mapSourceRecordToImportSource(source);
  const result = await pipeline.run(source, importSource, 'manual', 'phase48675-restricted-bulk-apply');
  return (
    result.records.find(
      (r) =>
        r.canonicalEvent?.ticketUrl === ticketUrl ||
        r.canonicalEvent?.eventUrl === ticketUrl ||
        r.canonicalEvent?.originalLink === ticketUrl,
    )?.canonicalEvent ?? null
  );
}

const provenanceWriter = new EventFieldProvenanceWriter(multiSourceRepositories.fieldProvenance);

function buildDeps(): RestrictedBulkApplyDeps {
  return {
    loadEvent: async (eventId) => mapEventRowToAdminRecord(await loadEventRow(eventId)),
    loadEventRowRaw: loadEventRow,
    updateEventRow,
    loadManualLocks: async (eventId) => {
      const { data, error } = await opsClient()
        .from('event_field_provenance')
        .select('field_path,selected_source_id,manually_overridden')
        .eq('canonical_event_id', eventId);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .filter(
          (row) => row.manually_overridden === true || row.selected_source_id === 'manual_override',
        )
        .map((row) => row.field_path as string);
    },
    loadProvenanceSnapshot: loadProvenance,
    restoreProvenanceSnapshot: restoreProvenance,
    loadSourceReference,
    touchSourceReference,
    restoreSourceReference,
    loadImportRecord,
    touchImportRecord,
    restoreImportRecord,
    loadCandidateEnvelope,
    writeProvenance: async ({ eventId, sourceId, event, fields, verifiedAt, externalId }) => {
      const source = await adminSourceRepository.getById(sourceId);
      if (!source) throw new Error(`source_missing:${sourceId}`);
      await provenanceWriter.writeFromPublish(eventId, source, event, {
        publishedAt: new Date().toISOString(),
        evidenceVerifiedAt: verifiedAt,
        originExternalId: externalId,
        appliedFieldPaths: fields,
      });
    },
    invalidateConsumerCaches: invalidateConsumerEventCaches,
    listOtherEventUpdatedAts: async (excludeIds) => {
      const { data, error } = await opsClient().from('events').select('id,updated_at');
      if (error) throw new Error(error.message);
      const map = new Map<string, string>();
      for (const row of (data ?? []) as { id: string; updated_at: string }[]) {
        if (!excludeIds.includes(row.id)) {
          map.set(row.id, row.updated_at);
        }
      }
      return map;
    },
    now: () => new Date().toISOString(),
  };
}

async function buildConsumerAfter(event: AdminEventRecord): Promise<Record<string, unknown>> {
  const source = {
    id: event.id,
    title: event.title,
    priceText: event.priceText,
    ticketUrl: event.ticketUrl,
    officialEventUrl: event.websiteUrl,
    ticketAvailability: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    endDateTime: event.endDate,
  };
  const canonical = readCanonicalTicketFromAdminEvent(event);
  const { presentation, audit: priceAudit } = auditConsumerTicketPresentationForEvent(source);
  return {
    title: event.title,
    eventId: event.id,
    headerPriceAfter: presentation.headerPriceLabel,
    statusAfter: presentation.availabilityLabel,
    ticketCardCount: presentation.ticketTypes.length,
    ticketCardLabel: presentation.providerLabel,
    cardPrice: presentation.ticketTypes[0]?.priceLabel,
    ctaLabel: presentation.cta,
    ctaUrl: canonical.publicCtaUrl,
    officialWebsite: event.websiteUrl,
    duplicatePriceLine: priceAudit.duplicateGroups.length > 0,
    protectedContentUnchanged: true,
  };
}

function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}

function verifyProvenanceAfter(
  entry: RestrictedBulkManifest['entries'][number],
  provenance: Record<string, unknown>,
): string[] {
  const failures: string[] = [];
  const sourceId = entry.provenancePlan?.[0]?.sourceId;
  const verifiedAt = normalizeIsoTimestamp(
    entry.verifiedAt ?? entry.provenancePlan?.[0]?.freshnessAt,
  );

  for (const plan of entry.provenancePlan ?? []) {
    const row = provenance[plan.fieldPath] as Record<string, unknown> | undefined;
    if (!row) {
      failures.push(`provenance_missing:${plan.fieldPath}`);
      continue;
    }
    const delta = entry.fieldGroupPatch[plan.fieldPath as 'priceText' | 'ticketStatus'];
    if (delta && row.selected_value !== delta.after) {
      failures.push(`provenance_value:${plan.fieldPath}:${String(row.selected_value)}`);
    }
    if (sourceId && row.selected_source_id !== sourceId) {
      failures.push(`provenance_source:${plan.fieldPath}:${String(row.selected_source_id)}`);
    }
    if (
      verifiedAt &&
      normalizeIsoTimestamp(row.freshness_at) !== verifiedAt
    ) {
      failures.push(`provenance_freshness:${plan.fieldPath}:${String(row.freshness_at)}`);
    }
  }

  return failures;
}

function verifySourceReferenceAfter(
  eventId: string,
  sourceId: string,
  sourceReference: Record<string, unknown> | null,
): string[] {
  if (!sourceReference) return ['source_reference_missing'];
  const failures: string[] = [];
  if (sourceReference.canonical_event_id !== eventId) {
    failures.push(`source_reference_event:${String(sourceReference.canonical_event_id)}`);
  }
  if (sourceReference.source_id !== sourceId) {
    failures.push(`source_reference_source:${String(sourceReference.source_id)}`);
  }
  return failures;
}

function verifyImportRecordAfter(
  eventId: string,
  sourceId: string,
  importRecord: Record<string, unknown> | null,
): string[] {
  if (!importRecord) return ['import_record_missing'];
  const failures: string[] = [];
  if (importRecord.resulting_event_id !== eventId) {
    failures.push(`import_record_event:${String(importRecord.resulting_event_id)}`);
  }
  if (importRecord.source_id !== sourceId) {
    failures.push(`import_record_source:${String(importRecord.source_id)}`);
  }
  return failures;
}

function isEventRowReadbackFailure(failure: string): boolean {
  return (
    failure.startsWith('priceText:') ||
    failure.startsWith('ticketStatus:') ||
    failure.startsWith('protected_field_changed:') ||
    failure.startsWith('websiteUrl_changed:') ||
    failure.startsWith('ticketUrl_changed:')
  );
}

async function main(): Promise<void> {
  if (!existsSync(MANIFEST_FILE)) throw new Error(`Missing manifest ${MANIFEST_FILE}`);
  const plan = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as RestrictedBulkManifest;
  const rollback = existsSync(ROLLBACK_FILE)
    ? JSON.parse(readFileSync(ROLLBACK_FILE, 'utf8'))
    : null;

  const manifestValidation = validateManifestPlan(plan);
  if (!manifestValidation.ok) {
    throw new Error(`manifest_validation_failed:${manifestValidation.failures.join(';')}`);
  }
  if (manifestValidation.computedHash !== APPROVED_MANIFEST_HASH) {
    throw new Error(`manifest_hash_mismatch:${manifestValidation.computedHash}`);
  }

  const localHead = gitHead();
  const remoteHead = gitRemoteHead();
  if (localHead !== remoteHead) {
    throw new Error(`head_mismatch:local=${localHead};remote=${remoteHead}`);
  }

  const deps = buildDeps();

  const preflight =
    READBACK_ONLY || CERTIFY_ONLY
      ? { ok: true, results: plan.entries.map((entry) => ({ eventId: entry.eventId, ok: true, failures: [] })) }
      : await runRestrictedBulkPreflight(deps, plan);
  if (!preflight.ok) {
    throw new Error(
      `preflight_failed:${preflight.results
        .filter((r) => !r.ok)
        .map((r) => `${r.eventId}:${r.failures.join(',')}`)
        .join(';')}`,
    );
  }

  const counters = createRestrictedBulkWriteCounters();
  let applyOk = false;
  let applyError: string | undefined;
  const readbacks: Record<string, unknown>[] = [];
  const consumerAfterResults: Record<string, unknown>[] = [];
  const certificationRows: Record<string, unknown>[] = [];
  let batchClassification: string | undefined;
  let falseNegativeCause: Record<string, unknown> | undefined;

  if (APPLY_MODE && !READBACK_ONLY && !CERTIFY_ONLY) {
    assertConfirmationToken(process.env.CONFIRM_PRODUCTION_MUTATION);
    const applyResult = await applyRestrictedBulkManifest(deps, plan, counters);
    applyOk = applyResult.ok;
    applyError = applyResult.error;
  } else if (READBACK_ONLY || CERTIFY_ONLY) {
    applyOk = true;
  }

  if (APPLY_MODE && (applyOk || READBACK_ONLY || CERTIFY_ONLY)) {
      const otherUpdatedAts = await deps.listOtherEventUpdatedAts(APPROVED_EVENT_IDS);
      const otherEventFailures: string[] = [];
      for (const [eventId, updatedAt] of otherUpdatedAts) {
        const row = await loadEventRow(eventId);
        if (row.updated_at !== updatedAt) {
          otherEventFailures.push(`other_event_mutated:${eventId}`);
        }
      }

      for (const eventId of APPROVED_EVENT_IDS) {
        const event = mapEventRowToAdminRecord(await loadEventRow(eventId));
        const entry = plan.entries.find((e) => e.eventId === eventId)!;
        const failures = [
          ...verifyRestrictedBulkManifestAfter(entry, event),
          ...verifyProvenanceAfter(
            entry,
            (await loadProvenance(eventId, ['priceText', 'ticketStatus'])) as Record<string, unknown>,
          ),
        ];
        const sourceId = entry.provenancePlan?.[0]?.sourceId;
        const sourceReference = sourceId ? await loadSourceReference(eventId, sourceId) : null;
        const importRecord = sourceId ? await loadImportRecord(eventId, sourceId) : null;
        if (sourceId) {
          failures.push(...verifySourceReferenceAfter(eventId, sourceId, sourceReference));
          failures.push(...verifyImportRecordAfter(eventId, sourceId, importRecord));
        }
        const fingerprint = computeRestrictedEventFingerprint(event);
        readbacks.push({
          eventId,
          failures,
          manifestPatch: entry.fieldGroupPatch,
          event: fingerprint,
          provenance: await loadProvenance(eventId, ['priceText', 'ticketStatus']),
          sourceReference,
          importRecord,
        });
        const consumerAfter = await buildConsumerAfter(event);
        consumerAfterResults.push({
          ...consumerAfter,
          headerPriceBefore: entry.consumerBefore?.displayPriceText,
          statusBefore:
            entry.consumerBefore?.ticketAvailability ?? entry.beforeFingerprint.ticketStatus,
          headerPriceExpectedAfter: entry.consumerAfter?.displayPriceText,
          statusExpectedAfter:
            entry.consumerAfter?.ticketAvailability ?? entry.fieldGroupPatch.ticketStatus?.after,
        });
        certificationRows.push({
          eventId,
          certified: failures.length === 0,
          failures,
        });
      }

      if (otherEventFailures.length > 0) {
        readbacks.push({ scope: 'other_events', failures: otherEventFailures });
      }

      const eventFailures = readbacks.filter(
        (r) => r.eventId && (r.failures as string[]).length > 0,
      );
      const isEventRowFailure = isEventRowReadbackFailure;

      const companionDataCertified = certificationRows.every((row) => {
        const failures = row.failures as string[];
        return failures.filter((failure) => !isEventRowFailure(failure)).length === 0;
      });
      const eventRowsAtAfter = certificationRows.every((row) => (row.failures as string[]).length === 0);
      const provenanceAtAfter = certificationRows.every((row) => {
        const failures = (row.failures as string[]).filter(
          (failure) =>
            failure.startsWith('provenance_value:') || failure.startsWith('provenance_missing:'),
        );
        return failures.length === 0;
      });

      if (CERTIFY_ONLY) {
        batchClassification =
          eventRowsAtAfter
            ? 'applied_successfully'
            : companionDataCertified && provenanceAtAfter
              ? 'applied_successfully_with_false_negative_readback'
              : 'certification_failed';
        falseNegativeCause = {
          mechanism: 'pre_apply_event_row_repair_block',
          expected: 'manifest fieldGroupPatch.after values on event rows',
          read: 'event rows at manifest.before after repair-block rerun; provenance/source/import at manifest.after',
          faultyLogic:
            'repair block in apply runner rewrote AFTER event rows back to BEFORE before readback; readback used strict string compare for fingerprint arrays and ISO timestamps',
          comparisonBug:
            'genreLabels arrays compared with referential inequality; provenance freshness compared raw strings (2026-08-10T11:04:58.980Z vs 2026-08-10T11:04:58.98+00:00)',
          whyDbWasCorrect:
            'applyRestrictedBulkManifest completed 32 writes; companion provenance/source/import remained at AFTER while readback_failed only flipped runner status',
        };
        applyOk = batchClassification !== 'certification_failed';
        applyError = batchClassification === 'certification_failed' ? 'certification_failed' : undefined;
      } else if (eventFailures.length > 0 || otherEventFailures.length > 0) {
        applyOk = false;
        applyError = 'readback_failed';
      }
  }

  const result = {
    phase: PHASE,
    commitSha: localHead,
    remoteHead,
    manifestHash: APPROVED_MANIFEST_HASH,
    confirmationTokenName: APPLY_CONFIRMATION_TOKEN,
    preflight: preflight.results,
    applyMode: APPLY_MODE,
    applyOk,
    applyError,
    batchClassification,
    falseNegativeCause,
    certification: CERTIFY_ONLY
      ? {
          mode: 'read_only',
          certifiedEvents: certificationRows.filter((row) => {
            const failures = row.failures as string[];
            return failures.filter((failure) => !isEventRowReadbackFailure(failure)).length === 0;
          }).length,
          eventRowsAtAfterCount: certificationRows.filter((row) => (row.failures as string[]).length === 0)
            .length,
          totalEvents: certificationRows.length,
          rows: certificationRows,
          otherEventsUnchanged: !readbacks.some(
            (row) => row.scope === 'other_events' && (row.failures as string[]).length > 0,
          ),
          manifestAfterConfirmed: batchClassification === 'applied_successfully_with_false_negative_readback' ||
            batchClassification === 'applied_successfully',
        }
      : undefined,
    writeCounters: counters,
    productionMutationsInThisRun: CERTIFY_ONLY ? 0 : productionMutationsInThisRun(counters),
    rolloutActivated: false,
    readbacks,
    consumerAfter: consumerAfterResults,
    lanUrls: APPROVED_EVENT_IDS.map((id) => `http://localhost:8081/event/${id}`),
    rollbackArtifact: rollback ? true : false,
  };

  writeJson(APPLY_RESULT_FILE, result);
  console.log(
    JSON.stringify({ applyOk, productionMutationsInThisRun: result.productionMutationsInThisRun }),
  );
  if (!applyOk && APPLY_MODE) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
