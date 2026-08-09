/**
 * Phase 4.8.6.6.4 — Restricted Bootshaus Ticket.io canary apply (single candidate).
 *
 * ER_OPS_ENV_FILE=... CONFIRM_PRODUCTION_MUTATION=exact:phase48663-bootshaus-ticketio-canary \
 *   npx tsx scripts/operations/_phase48664-canary-apply.ts
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { createSourceConnectorFetchProvider } from '@/features/aggregation/connectors/create-source-connector-fetch-provider';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { AggregationLogService } from '@/features/aggregation/logging/aggregation-log-service';
import { AggregationPipeline } from '@/features/aggregation/pipeline/aggregation-pipeline';
import type { PipelineRecordEnvelope } from '@/features/aggregation/pipeline/types';
import {
  adminSourceRepository,
  importEventPublishService,
  importRecordRepository,
} from '@/data/repositories/registry';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { resolveConsumerTicketPresentation } from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import {
  computeChangedPublishTrackedFields,
} from '@/features/import/services/event-field-provenance-writer';
import { readCanonicalTicketFromAdminEvent } from '@/features/events/domain/canonical-ticket-read';
import {
  assessRestrictedCanaryCandidate,
  buildCollisionCatalog,
  buildRowFingerprint,
  buildStableCanaryManifestHash,
  canonicalImportEventToEvidenceBundle,
  evaluateGenericTruthPublish,
  RESTRICTED_CANARY_FIELD_GROUPS,
  RESTRICTED_CANARY_MAX_EVENTS,
  RESTRICTED_CANARY_PERCENT,
  RESTRICTED_CANARY_SOURCE_ID,
  selectDeterministicCanaryEventIds,
} from '@/features/import/generic-truth-pipeline';
import { resolveServerGenericTruthRollout } from '@/features/import/generic-truth-pipeline/server-rollout-config';
import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import {
  createApplyWriteCounters,
  recordAttemptedWrite,
  recordRollbackWrite,
  recordSuccessfulWrite,
} from './phase48655-restricted-apply-security';
import { opsClient, updateEventRow } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const ROLLBACK_FILE = join(OUT, '_phase48663_canary_rollback.json');
const APPLY_RESULT_FILE = join(OUT, '_phase48664_canary_apply_result.json');

const PHASE = '4.8.6.6.4';
const APPLY_TOKEN = 'exact:phase48663-bootshaus-ticketio-canary';
const APPROVED_MANIFEST_HASH =
  '163a5b061d2d9ed79ce7812ef176ae76e4bc694d6c9da5bdbe75b0beb07ff35c';
const APPROVED_ROW_FINGERPRINT =
  'cf2908217b37c7ed9da7fde3ca0a82b3b8c97f37500055d10983b5e217c6b3f8';
const CANDIDATE_EVENT_ID = 'evt-1785339418526-dn9f7g0';
const CANDIDATE_TITLE = 'Bootshaus on a Ship Vol. IV';
const EXTERNAL_ID = 'https://bootshaus-club.ticket.io/4zjKRnsa/';
const OFFICIAL_WEBSITE = 'https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iv';
const TICKET_URL = 'https://bootshaus-club.ticket.io/4zjKRnsa/';

const ROLLBACK_PAYLOAD = {
  priceText: 'Tickets ab 32,00 Euro',
  ticketStatus: 'external_link' as const,
  ticketPhases: null,
};

const GENERIC_TRUTH_ENV_KEYS = [
  'GENERIC_TRUTH_PIPELINE_ENABLED',
  'GENERIC_TRUTH_PIPELINE_MODE',
  'GENERIC_TRUTH_AUTO_PUBLISH_ENABLED',
  'GENERIC_TRUTH_PIPELINE_SOURCE_IDS',
  'GENERIC_TRUTH_PIPELINE_CANARY_PERCENT',
  'GENERIC_TRUTH_PIPELINE_MAX_EVENTS',
  'GENERIC_TRUTH_PIPELINE_FIELD_GROUPS',
] as const;

let writeCounters = createApplyWriteCounters();
let provenanceWrites = 0;
let sourceReferenceWrites = 0;
let eventFieldMutations = 0;

function writeJson(path: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function assertApplyAuthorized(): void {
  const token = process.env.CONFIRM_PRODUCTION_MUTATION;
  if (token !== APPLY_TOKEN) {
    throw new Error(`CONFIRM_PRODUCTION_MUTATION must be ${APPLY_TOKEN}`);
  }
}

function snapshotGenericTruthEnv(): Record<string, string | undefined> {
  return Object.fromEntries(GENERIC_TRUTH_ENV_KEYS.map((key) => [key, process.env[key]]));
}

function activateGenericTruthEnv(): void {
  process.env.GENERIC_TRUTH_PIPELINE_ENABLED = 'true';
  process.env.GENERIC_TRUTH_PIPELINE_MODE = 'controlled';
  process.env.GENERIC_TRUTH_AUTO_PUBLISH_ENABLED = 'true';
  process.env.GENERIC_TRUTH_PIPELINE_SOURCE_IDS = RESTRICTED_CANARY_SOURCE_ID;
  process.env.GENERIC_TRUTH_PIPELINE_CANARY_PERCENT = String(RESTRICTED_CANARY_PERCENT);
  process.env.GENERIC_TRUTH_PIPELINE_MAX_EVENTS = String(RESTRICTED_CANARY_MAX_EVENTS);
  process.env.GENERIC_TRUTH_PIPELINE_FIELD_GROUPS = 'tickets,cta_checkout';
}

function restoreGenericTruthEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of GENERIC_TRUTH_ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function loadEventRow(eventId: string): Promise<EventRow> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? `missing event ${eventId}`);
  return data as EventRow;
}

async function loadRawTicketPhases(eventId: string): Promise<unknown> {
  const { data, error } = await opsClient()
    .from('events')
    .select('ticket_phases')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.ticket_phases ?? null;
}

async function loadProvenance(eventId: string, fields: string[]) {
  const { data, error } = await opsClient()
    .from('event_field_provenance')
    .select('*')
    .eq('canonical_event_id', eventId)
    .in('field_path', fields);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadSourceReference(eventId: string, sourceId: string) {
  const { data, error } = await opsClient()
    .from('event_source_references')
    .select('*')
    .eq('canonical_event_id', eventId)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function phasesEquivalent(actual: unknown, expectedCount: number, priceAmount: number): boolean {
  if (!Array.isArray(actual) || actual.length !== expectedCount) return false;
  const phase = actual[0] as Record<string, unknown>;
  return phase.priceAmount === priceAmount;
}

async function buildConsumerAfter(event: AdminEventRecord) {
  const canonical = readCanonicalTicketFromAdminEvent(event);
  const presentation = resolveConsumerTicketPresentation({
    id: event.id,
    title: event.title,
    priceText: event.priceText,
    ticketUrl: event.ticketUrl,
    officialEventUrl: event.websiteUrl,
    ticketAvailability: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    endDateTime: event.endDate,
  });
  return {
    headerPrice: presentation.headerPriceLabel,
    ticketAvailability: presentation.availabilityLabel,
    ticketCardCount: presentation.ticketTypes.length,
    consumerLabel: presentation.cta,
    cardPrice: presentation.ticketTypes[0]?.priceLabel,
    sectionPriceLabel: presentation.sectionPriceLabel,
    showSummary: presentation.showSummary,
    publicCtaUrl: canonical.publicCtaUrl,
    officialWebsiteUrl: event.websiteUrl,
  };
}

async function restoreProvenanceSnapshot(
  eventId: string,
  fieldPath: string,
  snapshot: Record<string, unknown>,
): Promise<void> {
  recordAttemptedWrite(writeCounters);
  const { error } = await opsClient()
    .from('event_field_provenance')
    .upsert({
      id: snapshot.id,
      canonical_event_id: eventId,
      field_path: fieldPath,
      selected_value: snapshot.selectedValue ?? snapshot.selected_value,
      selected_source_id: snapshot.selectedSourceId ?? snapshot.selected_source_id,
      manually_overridden: snapshot.manuallyOverridden ?? snapshot.manually_overridden ?? false,
      alternatives: snapshot.alternatives,
      updated_at: snapshot.updatedAt ?? snapshot.updated_at,
      selection_reason: snapshot.selectionReason ?? snapshot.selection_reason,
      confidence: snapshot.confidence,
      freshness_at: snapshot.freshnessAt ?? snapshot.freshness_at,
      origin_external_id: snapshot.originExternalId ?? snapshot.origin_external_id,
      merge_decision: snapshot.mergeDecision ?? snapshot.merge_decision,
      selected_tier: snapshot.selectedTier ?? snapshot.selected_tier,
    } as never);
  if (error) throw new Error(error.message);
  provenanceWrites += 1;
  recordRollbackWrite(writeCounters, 1);
}

async function restoreSourceReference(snapshot: Record<string, unknown>): Promise<void> {
  recordAttemptedWrite(writeCounters);
  const { error } = await opsClient()
    .from('event_source_references')
    .update({
      last_seen_at: snapshot.last_seen_at,
      active: snapshot.active,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', snapshot.id as string);
  if (error) throw new Error(error.message);
  sourceReferenceWrites += 1;
  recordRollbackWrite(writeCounters, 1);
}

async function rollbackCandidate(
  eventId: string,
  rollbackDoc: Record<string, unknown>,
): Promise<void> {
  recordAttemptedWrite(writeCounters);
  await updateEventRow(eventId, {
    price_text: ROLLBACK_PAYLOAD.priceText,
    ticket_status: ROLLBACK_PAYLOAD.ticketStatus,
    ticket_phases: ROLLBACK_PAYLOAD.ticketPhases,
  });
  eventFieldMutations += 3;
  recordRollbackWrite(writeCounters, 1);

  const provenanceRollback = rollbackDoc.provenanceRollback as Record<string, unknown> | undefined;
  const fieldRollback = (provenanceRollback?.fieldRollback ?? []) as Array<Record<string, unknown>>;
  for (const entry of fieldRollback) {
    const snapshot = entry.beforeSnapshot as Record<string, unknown> | null;
    if (!snapshot) continue;
    await restoreProvenanceSnapshot(eventId, entry.fieldPath as string, snapshot);
  }
  const sourceRefRollback = provenanceRollback?.sourceReferenceRollback as
    | Record<string, unknown>
    | undefined;
  const sourceSnapshot = sourceRefRollback?.beforeSnapshot as Record<string, unknown> | undefined;
  if (sourceSnapshot?.id) {
    await restoreSourceReference(sourceSnapshot);
  }
}

async function runPreflight(input: {
  existing: AdminEventRecord;
  candidateEnvelope: PipelineRecordEnvelope;
  collisionCatalog: ReturnType<typeof buildCollisionCatalog>;
  rollbackDoc: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const checks: Record<string, unknown> = { ok: true, failures: [] as string[] };
  const fail = (reason: string) => {
    (checks.failures as string[]).push(reason);
    checks.ok = false;
  };

  const rollbackHash = input.rollbackDoc.manifestHash as string;
  if (rollbackHash !== APPROVED_MANIFEST_HASH) {
    fail(`manifest_hash_mismatch:${rollbackHash}`);
  }

  const fingerprint = buildRowFingerprint(input.existing);
  if (fingerprint !== APPROVED_ROW_FINGERPRINT) {
    fail(`row_fingerprint_mismatch:${fingerprint}`);
  }

  const rollout = resolveServerGenericTruthRollout();
  const evaluatedIds = [CANDIDATE_EVENT_ID];
  const selected = selectDeterministicCanaryEventIds(
    RESTRICTED_CANARY_SOURCE_ID,
    evaluatedIds,
    RESTRICTED_CANARY_PERCENT,
    RESTRICTED_CANARY_MAX_EVENTS,
    rollout,
  );
  if (selected.length !== 1 || selected[0] !== CANDIDATE_EVENT_ID) {
    fail(`canary_selection_mismatch:${JSON.stringify(selected)}`);
  }

  if (input.existing.title !== CANDIDATE_TITLE) {
    fail(`title_mismatch:${input.existing.title}`);
  }

  const candidate = input.candidateEnvelope.canonicalEvent!;
  const bundle = canonicalImportEventToEvidenceBundle(candidate);
  const evaluation = evaluateGenericTruthPublish({
    existing: input.existing,
    candidate,
    bundle,
    rollout,
    collisionCatalog: input.collisionCatalog,
    allowedFieldGroups: RESTRICTED_CANARY_FIELD_GROUPS,
  });

  if (!['exact', 'corroborated'].includes(evaluation.identityVerdict)) {
    fail(`identity_verdict:${evaluation.identityVerdict}`);
  }
  if (!evaluation.evidenceCoverage.verifiedAt) {
    fail('verified_at_missing');
  }
  if (evaluation.collision) {
    fail('collision_detected');
  }
  const manualLocks = await loadProvenanceLocks(CANDIDATE_EVENT_ID);
  if (manualLocks.length > 0) {
    fail(`manual_locks:${manualLocks.join(',')}`);
  }

  const eligibility = assessRestrictedCanaryCandidate({
    evaluation,
    manualLocks,
    allowedFieldGroups: RESTRICTED_CANARY_FIELD_GROUPS,
  });
  if (!eligibility.eligible) {
    fail(`not_eligible:${eligibility.skipReasons.join(',')}`);
  }

  const meta = (candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};
  const listPrice = meta.priceText ?? meta.connectorPriceText;
  if (evaluation.dryRunAfter.ticketStatus !== 'on_sale') {
    fail(`live_availability_not_on_sale:${evaluation.dryRunAfter.ticketStatus}`);
  }
  if (!String(listPrice ?? evaluation.dryRunAfter.priceText ?? '').includes('32')) {
    fail(`live_price_not_32:${listPrice}`);
  }

  const beforeTicket = readCanonicalTicketFromAdminEvent(input.existing);
  if (beforeTicket.publicCtaUrl !== TICKET_URL) {
    fail(`public_cta_mismatch:${beforeTicket.publicCtaUrl}`);
  }
  if (input.existing.websiteUrl !== OFFICIAL_WEBSITE) {
    fail(`official_website_mismatch:${input.existing.websiteUrl}`);
  }

  if (evaluation.dryRunAfter.websiteUrl !== OFFICIAL_WEBSITE) {
    fail(`patch_would_change_websiteUrl:${evaluation.dryRunAfter.websiteUrl}`);
  }
  if (evaluation.dryRunAfter.ticketUrl !== TICKET_URL) {
    fail(`patch_would_change_ticketUrl:${evaluation.dryRunAfter.ticketUrl}`);
  }

  const manifestCandidates = [
    {
      eventId: CANDIDATE_EVENT_ID,
      beforeFingerprint: fingerprint,
      expectedPatches: Object.fromEntries(
        evaluation.fieldGroupDeltas
          .filter((d) => RESTRICTED_CANARY_FIELD_GROUPS.includes(d.group) && d.wouldChange)
          .flatMap((d) => Object.entries(d.proposed as object)),
      ),
      rollbackPayload: ROLLBACK_PAYLOAD,
    },
  ];
  const computedManifest = buildStableCanaryManifestHash({
    sourceId: RESTRICTED_CANARY_SOURCE_ID,
    canaryPercent: RESTRICTED_CANARY_PERCENT,
    maxEvents: RESTRICTED_CANARY_MAX_EVENTS,
    allowedFieldGroups: RESTRICTED_CANARY_FIELD_GROUPS,
    candidates: manifestCandidates,
  });
  if (computedManifest !== APPROVED_MANIFEST_HASH) {
    fail(`recomputed_manifest_mismatch:${computedManifest}`);
  }

  checks.evaluation = {
    identityVerdict: evaluation.identityVerdict,
    activationEligible: evaluation.activationEligible,
    wouldApplyIfEnabled: evaluation.wouldApplyIfEnabled,
  };
  return checks;
}

async function loadProvenanceLocks(eventId: string): Promise<string[]> {
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
}

async function main(): Promise<void> {
  assertApplyAuthorized();
  if (!existsSync(ROLLBACK_FILE)) {
    throw new Error(`Missing rollback file ${ROLLBACK_FILE}`);
  }
  const rollbackDoc = JSON.parse(readFileSync(ROLLBACK_FILE, 'utf8')) as Record<string, unknown>;

  const envSnapshot = snapshotGenericTruthEnv();
  let rolledBack = false;
  let applyError: string | undefined;
  const preflightResult: Record<string, unknown> = {};
  const beforeSnapshot: Record<string, unknown> = {};
  const afterSnapshot: Record<string, unknown> = {};
  let consumerAfter: Record<string, unknown> | undefined;
  let otherEventsMutated: string[] = [];

  try {
    await initializeEntityAliasStore();

    const source = await adminSourceRepository.getById(RESTRICTED_CANARY_SOURCE_ID);
    if (!source) throw new Error('source missing');

    const beforeRow = await loadEventRow(CANDIDATE_EVENT_ID);
    const existing = mapEventRowToAdminRecord(beforeRow);
    beforeSnapshot.event = {
      priceText: existing.priceText,
      ticketStatus: existing.ticketStatus,
      ticketPhases: await loadRawTicketPhases(CANDIDATE_EVENT_ID),
      websiteUrl: existing.websiteUrl,
      ticketUrl: existing.ticketUrl,
      title: existing.title,
      description: existing.description,
      startDate: existing.startDate,
      venueName: existing.venueName,
    };
    beforeSnapshot.provenance = await loadProvenance(CANDIDATE_EVENT_ID, ['priceText', 'ticketStatus']);
    beforeSnapshot.sourceReference = await loadSourceReference(
      CANDIDATE_EVENT_ID,
      RESTRICTED_CANARY_SOURCE_ID,
    );

    const horizonEvents = (
      await opsClient()
        .from('events')
        .select('id,updated_at')
        .eq('source_id', RESTRICTED_CANARY_SOURCE_ID)
    ).data ?? [];
    const otherFingerprintsBefore = new Map(
      (horizonEvents as { id: string; updated_at: string }[])
        .filter((row) => row.id !== CANDIDATE_EVENT_ID)
        .map((row) => [row.id, row.updated_at]),
    );

    const pipeline = new AggregationPipeline({
      fetchProvider: createSourceConnectorFetchProvider(sourceConnectorRegistry),
      logService: new AggregationLogService(),
    });
    const importSource = mapSourceRecordToImportSource(source);
    const pipelineResult = await pipeline.run(
      source,
      importSource,
      'manual',
      'phase48664-canary-apply',
    );

    const envelope = pipelineResult.records.find((entry) => entry.externalId === EXTERNAL_ID);
    if (!envelope?.canonicalEvent) {
      throw new Error(`connector envelope missing for ${EXTERNAL_ID}`);
    }

    activateGenericTruthEnv();
    const rolloutActive = resolveServerGenericTruthRollout();
    if (!rolloutActive.enabled || rolloutActive.writesSuppressed) {
      throw new Error('generic_truth_rollout_not_active');
    }

    const collisionCatalog = buildCollisionCatalog(
      (
        await opsClient()
          .from('events')
          .select('*')
          .in('status', ['published', 'upcoming', 'running'])
      ).data?.map((row) => mapEventRowToAdminRecord(row as EventRow)) ?? [],
    );

    const preflight = await runPreflight({
      existing,
      candidateEnvelope: envelope,
      collisionCatalog,
      rollbackDoc,
    });
    Object.assign(preflightResult, preflight);
    if (!preflight.ok) {
      throw new Error(`preflight_failed:${(preflight.failures as string[]).join(';')}`);
    }

    const records = await importRecordRepository.listLatestBySourceId(RESTRICTED_CANARY_SOURCE_ID);
    const record = records.find(
      (entry) => entry.resultingEventId === CANDIDATE_EVENT_ID || entry.externalId === EXTERNAL_ID,
    );
    if (!record) throw new Error('import record missing for candidate');

    const publishRecord = {
      ...record,
      normalizedPayload: envelope.canonicalEvent as unknown as Record<string, unknown>,
      sourceUrl: envelope.canonicalEvent.sourceUrl ?? record.sourceUrl,
      originalUrl: envelope.canonicalEvent.originalLink ?? envelope.canonicalEvent.eventUrl,
    };

    recordAttemptedWrite(writeCounters);
    const publishResult = await importEventPublishService.publishRecord(
      publishRecord,
      source,
      records,
      { actorId: 'phase48664-canary-apply', skipProvenance: false },
    );
    recordSuccessfulWrite(writeCounters);

    await invalidateConsumerEventCaches();

    const afterRow = await loadEventRow(CANDIDATE_EVENT_ID);
    const afterEvent = mapEventRowToAdminRecord(afterRow);
    const provenanceWriteRequests = computeChangedPublishTrackedFields(existing, afterEvent).length;
    provenanceWrites = provenanceWriteRequests;
    sourceReferenceWrites = 1;
    eventFieldMutations = 3;
    writeCounters.totalProductionWriteOperations =
      1 + 1 + 1 + provenanceWriteRequests;
    afterSnapshot.event = {
      priceText: afterEvent.priceText,
      ticketStatus: afterEvent.ticketStatus,
      ticketPhases: await loadRawTicketPhases(CANDIDATE_EVENT_ID),
      websiteUrl: afterEvent.websiteUrl,
      ticketUrl: afterEvent.ticketUrl,
      title: afterEvent.title,
      description: afterEvent.description,
      startDate: afterEvent.startDate,
      venueName: afterEvent.venueName,
    };
    afterSnapshot.provenance = await loadProvenance(CANDIDATE_EVENT_ID, ['priceText', 'ticketStatus']);
    afterSnapshot.sourceReference = await loadSourceReference(
      CANDIDATE_EVENT_ID,
      RESTRICTED_CANARY_SOURCE_ID,
    );

    const readbackFailures: string[] = [];
    if (afterEvent.priceText !== 'ab 32,00 €') readbackFailures.push(`priceText:${afterEvent.priceText}`);
    if (afterEvent.ticketStatus !== 'on_sale') readbackFailures.push(`ticketStatus:${afterEvent.ticketStatus}`);
    if (!phasesEquivalent(await loadRawTicketPhases(CANDIDATE_EVENT_ID), 1, 32)) {
      readbackFailures.push('ticketPhases');
    }
    if (afterEvent.websiteUrl !== OFFICIAL_WEBSITE) readbackFailures.push(`websiteUrl:${afterEvent.websiteUrl}`);
    if (afterEvent.ticketUrl !== TICKET_URL) readbackFailures.push(`ticketUrl:${afterEvent.ticketUrl}`);

    for (const [eventId, updatedAt] of otherFingerprintsBefore) {
      const { data } = await opsClient().from('events').select('updated_at').eq('id', eventId).maybeSingle();
      if (data?.updated_at !== updatedAt) {
        otherEventsMutated.push(eventId);
      }
    }

    if (readbackFailures.length > 0 || otherEventsMutated.length > 0) {
      throw new Error(
        `readback_failed:${readbackFailures.join(',')};other_mutated:${otherEventsMutated.join(',')}`,
      );
    }

    consumerAfter = await buildConsumerAfter(afterEvent);
    afterSnapshot.consumer = consumerAfter;
    afterSnapshot.publishEventId = publishResult.event.id;
  } catch (error: unknown) {
    applyError = error instanceof Error ? error.message : String(error);
    if (!rolledBack && preflightResult.ok) {
      try {
        await rollbackCandidate(CANDIDATE_EVENT_ID, rollbackDoc);
        rolledBack = true;
      } catch (rollbackError: unknown) {
        applyError += `;rollback_failed:${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`;
      }
    }
  } finally {
    restoreGenericTruthEnv(envSnapshot);
  }

  const rolloutAfter = resolveServerGenericTruthRollout();
  const result = {
    phase: PHASE,
    productionMutationsInThisRun: writeCounters.totalProductionWriteOperations,
    rolloutActivated: rolloutAfter.enabled,
    preflight: preflightResult,
    selectedCandidate: {
      eventId: CANDIDATE_EVENT_ID,
      title: CANDIDATE_TITLE,
      sourceId: RESTRICTED_CANARY_SOURCE_ID,
      externalId: EXTERNAL_ID,
    },
    before: beforeSnapshot,
    after: afterSnapshot,
    consumerAfter,
    writeCounters: {
      attemptedApplicationEvents: writeCounters.attemptedWrites,
      successfulApplicationEvents: writeCounters.successfulWrites,
      attemptedWrites: writeCounters.attemptedWrites,
      successfulWrites: writeCounters.successfulWrites,
      rollbackWrites: writeCounters.rollbackWrites,
      retryWrites: writeCounters.retryWrites,
      databaseWriteRequests: writeCounters.totalProductionWriteOperations,
      affectedRows: writeCounters.totalProductionWriteOperations,
      eventFieldMutations,
      provenanceWriteRequests: provenanceWrites,
      sourceReferenceWriteRequests: sourceReferenceWrites,
      rollbackWriteRequests: writeCounters.rollbackWrites,
      totalProductionWriteOperations: writeCounters.totalProductionWriteOperations,
    },
    rolledBack,
    error: applyError,
    otherEventsMutated,
    approvedManifestHash: APPROVED_MANIFEST_HASH,
  };

  writeJson(APPLY_RESULT_FILE, result);
  console.log(JSON.stringify(result, null, 2));
  if (applyError) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
