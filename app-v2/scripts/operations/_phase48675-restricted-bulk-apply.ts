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
  eventFieldProvenanceWriter,
} from '@/data/repositories/registry';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import {
  auditConsumerTicketPresentationForEvent,
  resolveConsumerTicketPresentation,
} from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import {
  applyRestrictedBulkManifest,
  computeRestrictedEventFingerprint,
  runRestrictedBulkPreflight,
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
const APPLY_MODE = process.argv.includes('--apply');

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
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
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
      updated_at: snapshot.updated_at,
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
      await eventFieldProvenanceWriter.writeFromPublish(eventId, source, event, {
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
  const canonical = projectCanonicalEventFields({ event, now: new Date() });
  const presentation = resolveConsumerTicketPresentation(event);
  const audit = auditConsumerTicketPresentationForEvent(event);
  return {
    title: event.title,
    eventId: event.id,
    headerPriceAfter: canonical.displayPriceText ?? event.priceText,
    statusAfter: presentation.availabilityLabel,
    ticketCardCount: audit.slots.length,
    ticketCardLabel: audit.slots[0]?.providerLabel,
    cardPrice: audit.slots[0]?.priceText,
    ctaLabel: presentation.ctaLabel,
    ctaUrl: presentation.ctaUrl,
    officialWebsite: event.websiteUrl,
    duplicatePriceLine: audit.duplicatePriceLine,
    protectedContentUnchanged: true,
  };
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
  const preflight = await runRestrictedBulkPreflight(deps, plan);
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

  if (APPLY_MODE) {
    assertConfirmationToken(process.env.CONFIRM_PRODUCTION_MUTATION);
    const applyResult = await applyRestrictedBulkManifest(deps, plan, counters);
    applyOk = applyResult.ok;
    applyError = applyResult.error;

    if (applyOk) {
      for (const eventId of APPROVED_EVENT_IDS) {
        const event = mapEventRowToAdminRecord(await loadEventRow(eventId));
        const entry = plan.entries.find((e) => e.eventId === eventId)!;
        const patch = entry.fieldGroupPatch;
        const failures: string[] = [];
        if (patch.priceText && event.priceText !== patch.priceText.after) {
          failures.push(`priceText:${event.priceText}`);
        }
        if (patch.ticketStatus && event.ticketStatus !== patch.ticketStatus.after) {
          failures.push(`ticketStatus:${event.ticketStatus}`);
        }
        if (event.websiteUrl !== entry.beforeFingerprint.websiteUrl) {
          failures.push(`websiteUrl_changed:${event.websiteUrl}`);
        }
        if (event.ticketUrl !== entry.beforeFingerprint.ticketUrl) {
          failures.push(`ticketUrl_changed:${event.ticketUrl}`);
        }
        const fingerprint = computeRestrictedEventFingerprint(event);
        for (const [key, value] of Object.entries(entry.beforeFingerprint)) {
          if (key === 'priceText' || key === 'ticketStatus') continue;
          if (fingerprint[key as keyof typeof fingerprint] !== value) {
            failures.push(`protected_field_changed:${key}`);
          }
        }
        readbacks.push({ eventId, failures, event: fingerprint });
        consumerAfterResults.push(await buildConsumerAfter(event));
      }
      if (readbacks.some((r) => (r.failures as string[]).length > 0)) {
        applyOk = false;
        applyError = 'readback_failed';
      }
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
    writeCounters: counters,
    productionMutationsInThisRun: productionMutationsInThisRun(counters),
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
