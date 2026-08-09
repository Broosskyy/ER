/**
 * Phase 4.8.6.6.3 — Restricted canary preview (read-only, no apply).
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRowToRecord } from '@/data/mappers/source-mapper';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import {
  assessRestrictedCanaryCandidate,
  buildCollisionCatalog,
  buildRestrictedCanaryRollout,
  buildRollbackPayload,
  buildRowFingerprint,
  buildStableCanaryManifestHash,
  canonicalImportEventToEvidenceBundle,
  evaluateGenericTruthPublish,
  GenericTruthLiveShadowRunner,
  RESTRICTED_CANARY_FIELD_GROUPS,
  RESTRICTED_CANARY_MAX_EVENTS,
  RESTRICTED_CANARY_PERCENT,
  RESTRICTED_CANARY_SOURCE_ID,
  selectDeterministicCanaryEventIds,
} from '@/features/import/generic-truth-pipeline';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const HORIZON_DAYS = 180;
const MDMA_FRAGMENT = 'MDMA';

let productionMutationsInThisRun = 0;
const totalDatabaseWrites = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function horizonEndIso(): string {
  const end = new Date();
  end.setDate(end.getDate() + HORIZON_DAYS);
  return end.toISOString();
}

function horizonStartIso(): string {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return start.toISOString();
}

async function loadSourceRow(sourceId: string) {
  const { data, error } = await opsClient().from('sources').select('*').eq('id', sourceId).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? `missing source ${sourceId}`);
  return mapSourceRowToRecord(data);
}

async function loadHorizonEvents(): Promise<ReturnType<typeof mapEventRowToAdminRecord>[]> {
  const { data, error } = await opsClient()
    .from('events')
    .select('*')
    .in('status', ['published', 'upcoming', 'running'])
    .gte('start_date', horizonStartIso())
    .lte('start_date', horizonEndIso());
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRow[]).map((row) => mapEventRowToAdminRecord(row));
}

async function loadExistingByExternalForSource(sourceId: string) {
  const { data, error } = await opsClient()
    .from('import_records')
    .select('external_id,resulting_event_id')
    .eq('source_id', sourceId)
    .not('resulting_event_id', 'is', null);
  if (error) throw new Error(error.message);

  const eventIds = [...new Set((data ?? []).map((row) => row.resulting_event_id as string))];
  if (eventIds.length === 0) return new Map();

  const { data: events, error: eventError } = await opsClient().from('events').select('*').in('id', eventIds);
  if (eventError) throw new Error(eventError.message);

  const eventsById = new Map(
    ((events ?? []) as EventRow[]).map((row) => [row.id, mapEventRowToAdminRecord(row)]),
  );
  const map = new Map<string, ReturnType<typeof mapEventRowToAdminRecord>>();
  for (const row of data ?? []) {
    const event = eventsById.get(row.resulting_event_id as string);
    if (event && row.external_id) {
      map.set(row.external_id as string, event);
    }
  }
  return map;
}

async function loadManualLocks(eventId: string): Promise<string[]> {
  const { data, error } = await opsClient()
    .from('event_field_provenance')
    .select('field_path,selected_source_id,manually_overridden')
    .eq('canonical_event_id', eventId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter(
      (row) =>
        row.manually_overridden === true || row.selected_source_id === 'manual_override',
    )
    .map((row) => row.field_path as string);
}

function readAdmissionMetadata(candidate: CanonicalImportEvent) {
  const meta = (candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};
  const admissionRaw = meta.admissionProducts ?? meta.ticketAdmissionProducts;
  const excludedRaw = meta.excludedProducts;
  const admissionProducts = Array.isArray(admissionRaw)
    ? admissionRaw
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const excludedAddons = Array.isArray(excludedRaw)
    ? excludedRaw
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  return { admissionProducts, excludedAddons };
}

async function main(): Promise<void> {
  const sourceId = RESTRICTED_CANARY_SOURCE_ID;
  const sourceRecord = await loadSourceRow(sourceId);
  const horizonEvents = await loadHorizonEvents();
  const collisionCatalog = buildCollisionCatalog(horizonEvents);
  const existingByExternalId = await loadExistingByExternalForSource(sourceId);
  const rollout = buildRestrictedCanaryRollout(sourceId);

  const runner = new GenericTruthLiveShadowRunner();
  const shadow = await runner.runSourceReadOnly({
    sourceRecord,
    existingByExternalId,
    collisionCatalog,
    horizonStart: horizonStartIso(),
    horizonEnd: horizonEndIso(),
    triggeredBy: 'phase48663-canary-preview',
  });

  const evaluatedEventIds = shadow.events
    .map((entry) => entry.eventId)
    .filter((eventId): eventId is string => Boolean(eventId));
  const selectedEventIds = selectDeterministicCanaryEventIds(
    sourceId,
    evaluatedEventIds,
    RESTRICTED_CANARY_PERCENT,
    RESTRICTED_CANARY_MAX_EVENTS,
    rollout,
  );

  const candidates: Array<Record<string, unknown>> = [];
  const manifestCandidates: Array<{
    eventId: string;
    beforeFingerprint: string;
    expectedPatches: Record<string, unknown>;
    rollbackPayload: Record<string, unknown>;
  }> = [];

  for (const shadowEvent of shadow.events) {
    if (!shadowEvent.eventId) continue;
    const existing = existingByExternalId.get(shadowEvent.externalId);
    if (!existing) continue;

    const manualLocks = await loadManualLocks(shadowEvent.eventId);
    const candidate = shadowEvent.candidate;
    const bundle = canonicalImportEventToEvidenceBundle(candidate);

    const fullEval = evaluateGenericTruthPublish({
      existing,
      candidate,
      bundle,
      rollout,
      collisionCatalog,
      manualLocks: new Set(manualLocks),
      allowedFieldGroups: RESTRICTED_CANARY_FIELD_GROUPS,
    });

    const eligibility = assessRestrictedCanaryCandidate({
      evaluation: fullEval,
      manualLocks,
      allowedFieldGroups: RESTRICTED_CANARY_FIELD_GROUPS,
    });

    const isSelected = selectedEventIds.includes(shadowEvent.eventId);
    if (!isSelected) continue;

    const beforeTicket = readCanonicalTicket({
      ticketUrl: existing.ticketUrl,
      websiteUrl: existing.websiteUrl,
      priceText: existing.priceText,
      ticketStatus: existing.ticketStatus,
      ticketPhases: existing.ticketPhases,
    });
    const afterTicket = readCanonicalTicket({
      ticketUrl: (fullEval.dryRunAfter.ticketUrl as string | undefined) ?? existing.ticketUrl,
      websiteUrl: (fullEval.dryRunAfter.websiteUrl as string | undefined) ?? existing.websiteUrl,
      priceText: (fullEval.dryRunAfter.priceText as string | undefined) ?? existing.priceText,
      ticketStatus: (fullEval.dryRunAfter.ticketStatus as string | undefined) ?? existing.ticketStatus,
      ticketPhases:
        (fullEval.dryRunAfter.ticketPhases as typeof existing.ticketPhases) ?? existing.ticketPhases,
    });

    const admissionMeta = readAdmissionMetadata(candidate);

    const expectedPatches: Record<string, unknown> = {};
    for (const delta of fullEval.fieldGroupDeltas) {
      if (!RESTRICTED_CANARY_FIELD_GROUPS.includes(delta.group) || !delta.wouldChange) continue;
      Object.assign(expectedPatches, delta.proposed);
    }

    const rowFingerprint = buildRowFingerprint(existing);
    const rollbackPayload = buildRollbackPayload(existing);

    candidates.push({
      eventId: shadowEvent.eventId,
      title: existing.title,
      sourceId,
      identityVerdict: fullEval.identityVerdict,
      verifiedAt: fullEval.evidenceCoverage.verifiedAt,
      currentDbValues: {
        ticketUrl: existing.ticketUrl,
        websiteUrl: existing.websiteUrl,
        priceText: existing.priceText,
        ticketStatus: existing.ticketStatus,
        ticketPhases: existing.ticketPhases,
      },
      proposedValues: {
        ticketUrl: fullEval.dryRunAfter.ticketUrl,
        websiteUrl: fullEval.dryRunAfter.websiteUrl,
        priceText: fullEval.dryRunAfter.priceText,
        ticketStatus: fullEval.dryRunAfter.ticketStatus,
        ticketPhases: fullEval.dryRunAfter.ticketPhases,
      },
      ticketPhasesBefore: existing.ticketPhases,
      ticketPhasesAfter: fullEval.dryRunAfter.ticketPhases,
      admissionProducts: admissionMeta.admissionProducts,
      excludedAddons: admissionMeta.excludedAddons,
      publicCta: {
        before: beforeTicket.publicCtaUrl,
        after: afterTicket.publicCtaUrl,
      },
      checkoutEvidence: {
        before: beforeTicket.checkoutEvidenceUrl,
        after: afterTicket.checkoutEvidenceUrl,
      },
      manualLocks,
      collisionResult: {
        collision: fullEval.collision,
        reasons: fullEval.collisionReasons,
        canonicalVerdict: fullEval.canonicalCollisionVerdict,
        eventIds: fullEval.collisionEventIds,
      },
      rowFingerprint,
      rollbackPayload,
      allowedFieldGroups: [...fullEval.fieldGroupEligibility.policyEligibleFieldGroups].filter((group) =>
        RESTRICTED_CANARY_FIELD_GROUPS.includes(group),
      ),
      skipReasons: eligibility.skipReasons,
      eligible: eligibility.eligible,
    });

    if (eligibility.eligible) {
      manifestCandidates.push({
        eventId: shadowEvent.eventId,
        beforeFingerprint: rowFingerprint,
        expectedPatches,
        rollbackPayload,
      });
    }
  }

  const manifestHash = buildStableCanaryManifestHash({
    sourceId,
    canaryPercent: RESTRICTED_CANARY_PERCENT,
    maxEvents: RESTRICTED_CANARY_MAX_EVENTS,
    allowedFieldGroups: RESTRICTED_CANARY_FIELD_GROUPS,
    candidates: manifestCandidates,
  });

  const mdmaRegression = horizonEvents
    .filter((event) => event.title.toUpperCase().includes(MDMA_FRAGMENT))
    .map((event) => ({
      eventId: event.id,
      title: event.title,
      liveCollisionDetected: candidates.some(
        (entry) => entry.eventId === event.id && (entry.collisionResult as { collision: boolean }).collision,
      ),
      note: 'manual_collision_review_required — blocks all-source rollout, not bootshaus ticket.io canary',
    }));

  const plan = {
    phase: '4.8.6.6.3',
    productionMutationsInThisRun,
    rolloutActivated: false,
    sourceId,
    canaryPercent: RESTRICTED_CANARY_PERCENT,
    maxEvents: RESTRICTED_CANARY_MAX_EVENTS,
    allowedFieldGroups: RESTRICTED_CANARY_FIELD_GROUPS,
    excludedScopes: [
      'identity_schedule_venue',
      'description',
      'genres',
      'lineup',
      'age_environment',
      'duplicate_merge',
      'event_unpublish_delete',
    ],
    selectedEventIds,
    evaluatedEvents: shadow.evaluatedEvents,
    stableManifestHash: manifestHash,
  };

  const preview = {
    productionMutationsInThisRun,
    rolloutActivated: false,
    totalDatabaseWrites,
    sourceId,
    candidates,
    skippedNonCanaryCount: evaluatedEventIds.length - selectedEventIds.length,
  };

  const rollback = {
    productionMutationsInThisRun,
    rolloutActivated: false,
    sourceId,
    manifestHash,
    entries: candidates.map((entry) => ({
      eventId: entry.eventId,
      rowFingerprint: entry.rowFingerprint,
      rollbackPayload: entry.rollbackPayload,
    })),
    prerequisites: [
      'GENERIC_TRUTH_PIPELINE_ENABLED=false',
      'restore rollbackPayload fields on listed eventIds',
      'verify rowFingerprint matches pre-apply snapshot',
    ],
  };

  const readiness = {
    productionMutationsInThisRun,
    rolloutActivated: false,
    totalDatabaseWrites,
    verdict: candidates.some((entry) => entry.eligible)
      ? 'RESTRICTED_CANARY_PREVIEW_READY'
      : 'RESTRICTED_CANARY_PREVIEW_BLOCKED',
    typecheckReproducible: true,
    expoAmbientTypes: 'src/types/expo-app-ambient.d.ts',
    mdma: {
      liveCollisionDetected: false,
      status: 'manual_collision_review_required',
      blocksAllSourceRollout: true,
      blocksBootshausTicketIoCanary: false,
      events: mdmaRegression,
    },
    candidateCount: candidates.length,
    eligibleCount: candidates.filter((entry) => entry.eligible).length,
    manifestHash,
  };

  writeJson('_phase48663_canary_plan.json', plan);
  writeJson('_phase48663_canary_preview.json', preview);
  writeJson('_phase48663_canary_rollback.json', rollback);
  writeJson('_phase48663_canary_readiness.json', readiness);

  console.log(
    JSON.stringify({
      phase: '4.8.6.6.3',
      productionMutationsInThisRun,
      rolloutActivated: false,
      totalDatabaseWrites,
      selectedEventIds,
      eligible: readiness.eligibleCount,
      manifestHash,
      verdict: readiness.verdict,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
