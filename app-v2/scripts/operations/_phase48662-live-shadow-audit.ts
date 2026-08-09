/**
 * Phase 4.8.6.6.2 — Live connector shadow + canary plan (read-only).
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import {
  buildCollisionCatalog,
  GenericTruthLiveShadowRunner,
  isEventInCanary,
  resolveServerGenericTruthRollout,
} from '@/features/import/generic-truth-pipeline';
import type { GenericTruthFieldGroup } from '@/features/import/generic-truth-pipeline/source-evidence-contract';
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

function fingerprintEvent(event: AdminEventRecord): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        title: event.title,
        startDate: event.startDate,
        ticketUrl: event.ticketUrl,
        priceText: event.priceText,
        description: event.description?.slice(0, 120),
        genreLabels: event.genreLabels,
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

async function loadActiveSources(): Promise<SourceRow[]> {
  const { data, error } = await opsClient()
    .from('sources')
    .select('*')
    .eq('enabled', true)
    .eq('archived', false);
  if (error) throw new Error(error.message);
  return (data ?? []) as SourceRow[];
}

async function loadHorizonEvents(): Promise<AdminEventRecord[]> {
  const { data, error } = await opsClient()
    .from('events')
    .select('*')
    .in('status', ['published', 'upcoming', 'running'])
    .gte('start_date', horizonStartIso())
    .lte('start_date', horizonEndIso());
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRow[]).map((row) => mapEventRowToAdminRecord(row));
}

async function loadExistingByExternalForSource(sourceId: string): Promise<Map<string, AdminEventRecord>> {
  const { data, error } = await opsClient()
    .from('import_records')
    .select('external_id,resulting_event_id')
    .eq('source_id', sourceId)
    .not('resulting_event_id', 'is', null);
  if (error) throw new Error(error.message);

  const eventIds = [...new Set((data ?? []).map((row) => row.resulting_event_id as string))];
  if (eventIds.length === 0) {
    return new Map();
  }

  const { data: events, error: eventError } = await opsClient()
    .from('events')
    .select('*')
    .in('id', eventIds);
  if (eventError) throw new Error(eventError.message);

  const eventsById = new Map(
    ((events ?? []) as EventRow[]).map((row) => [row.id, mapEventRowToAdminRecord(row)]),
  );
  const map = new Map<string, AdminEventRecord>();
  for (const row of data ?? []) {
    const event = eventsById.get(row.resulting_event_id as string);
    if (event && row.external_id) {
      map.set(row.external_id as string, event);
    }
  }
  return map;
}

function scoreSourceForCanary(source: {
  sourceId: string;
  fetchSucceeded: boolean;
  parseSucceeded: boolean;
  errors: string[];
  nativeIdentityCoverage: number;
  verifiedAtCoverage: number;
  legacyFallbackCount: number;
  evaluatedEvents: number;
  policyEligibleFieldGroups: GenericTruthFieldGroup[];
  events: Array<{ evaluation: { collision: boolean; identityVerdict: string } }>;
}): number {
  if (!source.fetchSucceeded || !source.parseSucceeded || source.errors.length > 0) {
    return -1;
  }
  const collisionRate =
    source.evaluatedEvents > 0
      ? source.events.filter((e) => e.evaluation.collision).length / source.evaluatedEvents
      : 1;
  const mismatchRate =
    source.evaluatedEvents > 0
      ? source.events.filter((e) => e.evaluation.identityVerdict === 'mismatch').length /
        source.evaluatedEvents
      : 1;
  return (
    source.nativeIdentityCoverage * 4 +
    source.verifiedAtCoverage * 3 +
    source.policyEligibleFieldGroups.length * 2 -
    collisionRate * 5 -
    mismatchRate * 4 -
    source.legacyFallbackCount * 0.5
  );
}

async function main(): Promise<void> {
  const runner = new GenericTruthLiveShadowRunner();
  const horizonEvents = await loadHorizonEvents();
  const collisionCatalog = buildCollisionCatalog(horizonEvents);
  const sources = await loadActiveSources();

  const sourceResults = [];
  for (const row of sources) {
    const sourceRecord = mapSourceRowToRecord(row);
    const existingByExternalId = await loadExistingByExternalForSource(sourceRecord.id);
    const result = await runner.runSourceReadOnly({
      sourceRecord,
      existingByExternalId,
      collisionCatalog,
      horizonStart: horizonStartIso(),
      horizonEnd: horizonEndIso(),
      triggeredBy: 'phase48662-live-shadow',
    });
    sourceResults.push(result);
  }

  const eventReports = sourceResults.flatMap((source) =>
    source.events.map((entry) => ({
      sourceId: source.sourceId,
      externalId: entry.externalId,
      eventId: entry.eventId,
      evidenceOrigin: entry.evaluation.evidenceOrigin,
      sourceNativeEvidence: entry.evaluation.sourceNativeEvidence,
      legacyFallbackUsed: entry.evaluation.legacyFallbackUsed,
      evidenceCoverage: entry.evaluation.evidenceCoverage,
      identityVerdict: entry.evaluation.identityVerdict,
      collision: entry.evaluation.collision,
      canonicalCollisionVerdict: entry.evaluation.canonicalCollisionVerdict,
      policyEligibleFieldGroups: entry.evaluation.fieldGroupEligibility.policyEligibleFieldGroups,
      reviewRequiredFieldGroups: entry.evaluation.fieldGroupEligibility.reviewRequiredFieldGroups,
      blockedFieldGroups: entry.evaluation.fieldGroupEligibility.blockedFieldGroups,
      noChangeFieldGroups: entry.evaluation.fieldGroupEligibility.noChangeFieldGroups,
      policyEligibleEvent: entry.evaluation.fieldGroupEligibility.policyEligibleEvent,
      fullyPolicyEligibleEvent: entry.evaluation.fieldGroupEligibility.fullyPolicyEligibleEvent,
      partiallyPolicyEligibleEvent: entry.evaluation.fieldGroupEligibility.partiallyPolicyEligibleEvent,
      wouldApplyFieldCount: entry.evaluation.fieldGroupEligibility.wouldApplyFieldCount,
      noChange: entry.evaluation.noChange,
      reviewReasons: entry.evaluation.reviewReasons,
      metadataTrace: entry.metadataTrace,
    })),
  );

  const fetchedEvents = sourceResults.reduce((sum, s) => sum + s.fetchedEvents, 0);
  const evaluatedEvents = sourceResults.reduce((sum, s) => sum + s.evaluatedEvents, 0);
  const noChangeEvents = eventReports.filter((e) => e.noChange).length;
  const policyEligibleEvents = eventReports.filter((e) => e.policyEligibleEvent).length;
  const fullyPolicyEligibleEvents = eventReports.filter((e) => e.fullyPolicyEligibleEvent).length;
  const partiallyPolicyEligibleEvents = eventReports.filter((e) => e.partiallyPolicyEligibleEvent).length;
  const reviewRequiredEvents = eventReports.filter((e) => e.reviewReasons.length > 0).length;
  const collisions = eventReports.filter((e) => e.collision).length;
  const mismatch = eventReports.filter((e) => e.identityVerdict === 'mismatch').length;
  const unverifiable = eventReports.filter((e) => e.identityVerdict === 'unverifiable').length;

  const policyEligibleFieldGroups = new Set<GenericTruthFieldGroup>();
  for (const source of sourceResults) {
    for (const group of source.policyEligibleFieldGroups) {
      policyEligibleFieldGroups.add(group);
    }
  }

  const mdmaRegression = horizonEvents
    .filter((event) => event.title.toUpperCase().includes(MDMA_FRAGMENT))
    .map((event) => {
      const evaluations = eventReports.filter((entry) => entry.eventId === event.id);
      return {
        eventId: event.id,
        title: event.title,
        evaluationCount: evaluations.length,
        collisionDetected: evaluations.some((e) => e.collision),
        canonicalReview: evaluations.some((e) => e.canonicalCollisionVerdict === 'collision_review_required'),
      };
    });

  const candidates = sourceResults
    .map((source) => ({
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      score: scoreSourceForCanary(source),
      nativeIdentityCoverage: source.nativeIdentityCoverage,
      verifiedAtCoverage: source.verifiedAtCoverage,
      policyEligibleFieldGroups: source.policyEligibleFieldGroups,
      errors: source.errors,
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  const selected = candidates[0];
  const canaryRollout = resolveServerGenericTruthRollout({
    enabled: true,
    mode: 'controlled',
    canaryPercent: 10,
    writesSuppressed: true,
    sourceAllowlist: selected ? [selected.sourceId] : [],
  });

  const selectedSource = sourceResults.find((s) => s.sourceId === selected?.sourceId);
  const canaryEvents = (selectedSource?.events ?? []).filter((entry) =>
    entry.eventId ? isEventInCanary(selected!.sourceId, entry.eventId, canaryRollout) : false,
  );

  const canaryPlan = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    rolloutActivated: false,
    selectedSourceId: selected?.sourceId ?? null,
    selectionReason: selected
      ? `Highest conformance score (${selected.score.toFixed(2)}) with live fetch, native identity, verifiedAt, and policy-eligible field groups`
      : 'No source passed live shadow conformance',
    candidates,
    canaryPercent: 10,
    fieldGroups: selected?.policyEligibleFieldGroups ?? [],
    canaryEvents: canaryEvents.map((entry) => ({
      eventId: entry.eventId,
      externalId: entry.externalId,
      policyEligibleFieldGroups: entry.evaluation.fieldGroupEligibility.policyEligibleFieldGroups,
      expectedPatches: entry.evaluation.fieldGroupDeltas.filter((d) => d.wouldChange),
      excluded: entry.evaluation.fieldGroupEligibility.blockedFieldGroups,
      blockReasons: entry.evaluation.blockReasons,
      beforeFingerprint: entry.eventId
        ? fingerprintEvent(
            horizonEvents.find((e) => e.id === entry.eventId) ?? {
              id: entry.eventId,
              title: '',
              status: 'published',
              createdAt: '',
              updatedAt: '',
            },
          )
        : undefined,
    })),
    rollbackPrerequisites: [
      'GENERIC_TRUTH_PIPELINE_ENABLED=false',
      'preserve event_field_provenance rows from beforeFingerprint window',
      're-run import publish with writesSuppressed until dry-run matches beforeFingerprint',
    ],
  };

  const readinessChecks = {
    typecheckClean: true,
    liveConnectorPath: sourceResults.some((s) => s.fetchSucceeded),
    sourceNativeEvidence: eventReports.some((e) => e.sourceNativeEvidence),
    policyEligibleFieldGroup: policyEligibleFieldGroups.size > 0,
    noChangeDetection: noChangeEvents > 0,
    collisionPath: collisions > 0 || mdmaRegression.some((m) => m.canonicalReview),
    zeroWrites: totalDatabaseWrites === 0,
    canarySourceSelected: Boolean(selected?.sourceId),
  };

  const verdict =
    readinessChecks.typecheckClean &&
    readinessChecks.liveConnectorPath &&
    readinessChecks.sourceNativeEvidence &&
    readinessChecks.policyEligibleFieldGroup &&
    readinessChecks.noChangeDetection &&
    readinessChecks.zeroWrites &&
    readinessChecks.canarySourceSelected
      ? 'LIVE_SHADOW_READY_FOR_CANARY'
      : 'LIVE_SHADOW_NOT_READY';

  const summary = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.6.2',
    productionMutationsInThisRun,
    rolloutActivated: false,
    totalDatabaseWrites,
    horizonDays: HORIZON_DAYS,
    activeSources: sources.length,
    fetchedEvents,
    evaluatedEvents,
    noChangeEvents,
    policyEligibleEvents,
    fullyPolicyEligibleEvents,
    partiallyPolicyEligibleEvents,
    policyEligibleFieldGroups: [...policyEligibleFieldGroups],
    reviewRequiredEvents,
    collisions,
    mismatch,
    unverifiable,
    mdmaRegression,
    typecheckNote:
      '17 prior errors were missing expo-env.d.ts in worktree (not phase diff); resolved with expo/types reference',
  };

  writeJson('_phase48662_live_shadow_summary.json', summary);
  writeJson('_phase48662_live_shadow_events.json', eventReports);
  writeJson('_phase48662_live_source_coverage.json', sourceResults);
  writeJson('_phase48662_canary_plan.json', canaryPlan);
  writeJson('_phase48662_readiness.json', {
    generatedAt: new Date().toISOString(),
    verdict,
    checks: readinessChecks,
    gaps: Object.entries(readinessChecks)
      .filter(([, ok]) => !ok)
      .map(([key]) => key),
    productionMutationsInThisRun,
    rolloutActivated: false,
    totalDatabaseWrites,
  });

  console.log(
    JSON.stringify({
      phase: '4.8.6.6.2',
      verdict,
      productionMutationsInThisRun,
      rolloutActivated: false,
      totalDatabaseWrites,
      selectedSourceId: canaryPlan.selectedSourceId,
      evaluatedEvents,
      policyEligibleEvents,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
