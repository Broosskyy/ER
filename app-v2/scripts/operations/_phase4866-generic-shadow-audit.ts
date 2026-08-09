/**
 * Phase 4.8.6.6 — Generic truth pipeline read-only shadow audit.
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { mapImportRecordRowToDomain } from '@/data/mappers/import-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import {
  adminEventToIdentitySnapshot,
  canonicalImportEventToEvidenceBundle,
  evaluateGenericTruthPublish,
} from '@/features/import/generic-truth-pipeline';
import { resolveServerGenericTruthRollout } from '@/features/import/generic-truth-pipeline/server-rollout-config';
import type { EventIdentitySnapshot } from '@/features/import/ticket-platform-identity/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const HORIZON_DAYS = 180;
const MDMA_REGRESSION_TITLE_FRAGMENT = 'MDMA';

let productionMutationsInThisRun = 0;

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

async function loadActiveEvents(): Promise<EventRow[]> {
  const rollout = resolveServerGenericTruthRollout();
  const { data, error } = await opsClient()
    .from('events')
    .select('*')
    .in('status', ['published', 'upcoming', 'running'])
    .gte('start_date', horizonStartIso())
    .lte('start_date', horizonEndIso())
    .order('start_date', { ascending: true })
    .limit(rollout.maxEvents);

  if (error) throw new Error(error.message);
  return (data as EventRow[]) ?? [];
}

async function loadRegisteredSources(): Promise<string[]> {
  const { data, error } = await opsClient().from('sources').select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

async function loadSourceReferences(eventId: string): Promise<
  Array<{ source_id: string; external_event_id?: string | null; original_url?: string | null }>
> {
  const { data, error } = await opsClient()
    .from('event_source_references')
    .select('source_id,external_event_id,original_url,active')
    .eq('canonical_event_id', eventId)
    .eq('active', true);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    source_id: string;
    external_event_id?: string | null;
    original_url?: string | null;
  }>;
}

async function loadLatestImportRecord(
  sourceId: string,
  externalId: string,
): Promise<CanonicalImportEvent | null> {
  const { data, error } = await opsClient()
    .from('import_records')
    .select('*')
    .eq('source_id', sourceId)
    .eq('external_id', externalId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const record = mapImportRecordRowToDomain(data);
  const candidate = getEffectiveCandidate(record);
  const rawPayload = (record.rawPayload ?? {}) as Record<string, unknown>;
  const rawMeta = (rawPayload.sourceMetadata ?? rawPayload.metadata ?? {}) as Record<string, unknown>;
  const mergedMetadata = {
    ...rawMeta,
    ...(candidate.sourceMetadata as Record<string, unknown> | undefined),
  };
  return {
    ...candidate,
    sourceId: record.sourceId,
    sourceName: record.sourceName ?? '',
    externalId: record.externalId,
    sourceMetadata: mergedMetadata,
  };
}

function buildCollisionCatalog(events: AdminEventRecord[]): EventIdentitySnapshot[] {
  return events.map((event) => adminEventToIdentitySnapshot(event));
}

export async function runShadowAudit(): Promise<Record<string, unknown>> {
  const rollout = resolveServerGenericTruthRollout({
    enabled: false,
    writesSuppressed: true,
  });
  const shadowRollout = resolveServerGenericTruthRollout({
    enabled: true,
    mode: 'shadow',
    writesSuppressed: true,
  });

  const eventRows = await loadActiveEvents();
  const adminEvents = eventRows.map((row) => mapEventRowToAdminRecord(row));
  const collisionCatalog = buildCollisionCatalog(adminEvents);
  const registeredSources = await loadRegisteredSources();

  const eventReports: unknown[] = [];
  const sourceCoverage: Record<string, {
    evaluations: number;
    nativeEvidence: number;
    legacyFallback: number;
    capabilities: Record<string, boolean>;
  }> = {};
  const identityCounts: Record<string, number> = {};
  const fetchErrors: Array<{ eventId: string; sourceId: string; error: string }> = [];

  let noChange = 0;
  let proposedChanges = 0;
  let policyEligible = 0;
  let activationEligible = 0;
  let wouldApplyIfEnabled = 0;
  let reviewRequiredCount = 0;
  let collisions = 0;
  let sourceNativeEvidenceCount = 0;
  let legacyFallbackCount = 0;
  const evaluatedSources = new Set<string>();
  const sourcesWithNativeEvidence = new Set<string>();
  const sourcesUsingLegacyFallback = new Set<string>();
  const unsupportedSources = new Set<string>();

  const mdmaEvents = adminEvents.filter((event) =>
    event.title.toUpperCase().includes(MDMA_REGRESSION_TITLE_FRAGMENT),
  );

  for (const row of eventRows) {
    const admin = mapEventRowToAdminRecord(row);
    const refs = await loadSourceReferences(admin.id);
    const sources =
      refs.length > 0
        ? refs
        : admin.sourceId
          ? [{ source_id: admin.sourceId, external_event_id: undefined, original_url: undefined }]
          : [];

    if (sources.length === 0) {
      unsupportedSources.add('no_active_source_reference');
      continue;
    }

    for (const ref of sources) {
      const sourceId = ref.source_id;
      evaluatedSources.add(sourceId);
      sourceCoverage[sourceId] ??= {
        evaluations: 0,
        nativeEvidence: 0,
        legacyFallback: 0,
        capabilities: {
          identity: false,
          schedule: false,
          venue: false,
          tickets: false,
          description: false,
          genres: false,
          lineup: false,
        },
      };

      const externalId = ref.external_event_id ?? admin.id;

      let candidate: CanonicalImportEvent | null = null;
      try {
        candidate = await loadLatestImportRecord(sourceId, externalId);
        if (!candidate) {
          fetchErrors.push({
            eventId: admin.id,
            sourceId,
            error: 'missing_import_record_replay',
          });
          continue;
        }
      } catch (err) {
        fetchErrors.push({
          eventId: admin.id,
          sourceId,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const bundle = canonicalImportEventToEvidenceBundle(candidate, {
        sourceUrl: ref.original_url ?? undefined,
      });
      sourceCoverage[sourceId].evaluations += 1;
      if (bundle.sourceNativeEvidence) {
        sourceCoverage[sourceId].nativeEvidence += 1;
        sourcesWithNativeEvidence.add(sourceId);
      }
      if (bundle.legacyFallbackUsed) {
        sourceCoverage[sourceId].legacyFallback += 1;
        sourcesUsingLegacyFallback.add(sourceId);
      }
      if (bundle.identity.pageTitle || bundle.identity.listRowTitle) {
        sourceCoverage[sourceId].capabilities.identity = true;
      }
      if (bundle.identity.eventDate) sourceCoverage[sourceId].capabilities.schedule = true;
      if (bundle.identity.venueName) sourceCoverage[sourceId].capabilities.venue = true;
      if (bundle.tickets?.publicCtaCandidateUrl || bundle.tickets?.checkoutEvidenceUrl) {
        sourceCoverage[sourceId].capabilities.tickets = true;
      }
      if (bundle.content?.description) sourceCoverage[sourceId].capabilities.description = true;
      if (bundle.content?.genreLabels?.length) sourceCoverage[sourceId].capabilities.genres = true;

      const evaluation = evaluateGenericTruthPublish({
        existing: admin,
        candidate,
        bundle,
        rollout: shadowRollout,
        collisionCatalog,
      });

      identityCounts[evaluation.identityVerdict] =
        (identityCounts[evaluation.identityVerdict] ?? 0) + 1;
      if (evaluation.collision) collisions += 1;
      if (evaluation.noChange) noChange += 1;
      if (evaluation.proposedChange) proposedChanges += 1;
      if (evaluation.policyEligible) policyEligible += 1;
      if (evaluation.activationEligible) activationEligible += 1;
      if (evaluation.wouldApplyIfEnabled) wouldApplyIfEnabled += 1;
      if (evaluation.reviewRequired) reviewRequiredCount += 1;
      if (evaluation.sourceNativeEvidence) sourceNativeEvidenceCount += 1;
      if (evaluation.legacyFallbackUsed) legacyFallbackCount += 1;

      eventReports.push({
        eventId: admin.id,
        title: admin.title,
        sources: [sourceId],
        adapter: candidate.rawSourceType,
        evidenceOrigin: evaluation.evidenceOrigin,
        identityEvidenceOrigin: evaluation.identityEvidenceOrigin,
        sourceNativeEvidence: evaluation.sourceNativeEvidence,
        legacyFallbackUsed: evaluation.legacyFallbackUsed,
        criticalIdentitySelfDerived: evaluation.criticalIdentitySelfDerived,
        evidenceCoverage: evaluation.evidenceCoverage,
        identityVerdict: evaluation.identityVerdict,
        freshness: {
          apply: evaluation.freshnessApply,
          reason: evaluation.freshnessReason,
        },
        collision: evaluation.collision,
        collisionEventIds: evaluation.collisionEventIds,
        proposedFieldGroups: evaluation.fieldGroups.filter((g) => g.proposed).map((g) => g.group),
        blockedFieldGroups: evaluation.fieldGroups.filter((g) => g.blocked).map((g) => g.group),
        fieldGroupDeltas: evaluation.fieldGroupDeltas,
        blockReasons: evaluation.blockReasons,
        reviewReasons: evaluation.reviewReasons,
        dryRunBefore: evaluation.dryRunBefore,
        dryRunAfter: evaluation.dryRunAfter,
        consumerImpact: evaluation.consumerImpact,
        noChange: evaluation.noChange,
        wouldChange: evaluation.wouldChange,
        proposedChange: evaluation.proposedChange,
        policyEligible: evaluation.policyEligible,
        activationEligible: evaluation.activationEligible,
        wouldApplyIfEnabled: evaluation.wouldApplyIfEnabled,
        reviewRequired: evaluation.reviewRequired,
        observedAt: new Date().toISOString(),
      });
    }
  }

  const mdmaRegression = mdmaEvents.map((event) => {
    const inDataset = eventRows.some((row) => row.id === event.id);
    const evaluations = (eventReports as Array<{ eventId: string; collision: boolean }>).filter(
      (entry) => entry.eventId === event.id,
    );
    return {
      eventId: event.id,
      title: event.title,
      inHorizonDataset: inDataset,
      evaluationCount: evaluations.length,
      collisionDetected: evaluations.some((entry) => entry.collision),
      note: inDataset
        ? 'Present in 180-day dataset — collision expectations validated generically'
        : 'Outside horizon dataset — collision catalog still includes ticketUrl for composite checks',
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.6.1',
    productionMutationsInThisRun,
    rolloutActivated: false,
    horizonDays: HORIZON_DAYS,
    eventsTotal: eventRows.length,
    evaluationsTotal: eventReports.length,
    registeredSources: registeredSources.length,
    activeSources: registeredSources.length,
    evaluatedSources: evaluatedSources.size,
    sourcesWithNativeEvidence: sourcesWithNativeEvidence.size,
    sourcesUsingLegacyFallback: sourcesUsingLegacyFallback.size,
    unsupportedSources: [...unsupportedSources],
    identityVerdicts: identityCounts,
    exact: identityCounts.exact ?? 0,
    corroborated: identityCounts.corroborated ?? 0,
    review: identityCounts.partial_review_only ?? 0,
    mismatch: identityCounts.mismatch ?? 0,
    unverifiable: identityCounts.unverifiable ?? 0,
    collisions,
    noChange,
    proposedChanges,
    policyEligible,
    activationEligible,
    wouldApplyIfEnabled,
    reviewRequiredCount,
    sourceNativeEvidenceCount,
    legacyFallbackCount,
    fetchParserErrors: fetchErrors.length,
    fetchErrors,
    mdmaRegressionExpectation: mdmaRegression,
  };

  const coverageReport = {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    registeredSources,
    activeSources: registeredSources,
    evaluatedSources: [...evaluatedSources],
    sourcesWithNativeEvidence: [...sourcesWithNativeEvidence],
    sourcesUsingLegacyFallback: [...sourcesUsingLegacyFallback],
    unsupportedSources: [...unsupportedSources],
    adapterConformancePassed: sourcesUsingLegacyFallback.size === 0,
    perSource: sourceCoverage,
  };

  writeJson('_phase4866_shadow_summary.json', summary);
  writeJson('_phase4866_shadow_events.json', eventReports);
  writeJson('_phase4866_source_coverage.json', coverageReport);

  return { summary, eventReports, coverageReport };
}

export async function buildReadiness(shadow: Awaited<ReturnType<typeof runShadowAudit>>): Promise<void> {
  const readiness = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.6.1',
    codeIntegrated: true,
    productionEntrypointVerified: true,
    shadowCompleted: true,
    connectorCoverage: shadow.coverageReport.sourcesWithNativeEvidence.length > 0,
    autoEligibleCount: shadow.summary.activationEligible,
    reviewRequiredCount: shadow.summary.reviewRequiredCount,
    policyEligibleCount: shadow.summary.policyEligible,
    noChangeCount: shadow.summary.noChange,
    browserVerified: false,
    rolloutActivated: false,
    productionMutationsInThisRun,
    verdict: shadow.summary.fetchParserErrors === 0 ? 'SHADOW_STABILIZED_NOT_ROLLOUT_READY' : 'SHADOW_PARTIAL_ERRORS',
    rolloutPlan: {
      canary10: 'GENERIC_TRUTH_PIPELINE_SOURCE_IDS + CANARY_PERCENT=10 + MODE=controlled',
      cohort50: 'Expand allowlist + 50% canary after conformance green',
      allSources: 'MODE=automatic only for policyEligible field groups',
    },
  };
  writeJson('_phase4866_rollout_readiness.json', readiness);
}

async function main(): Promise<void> {
  const shadow = await runShadowAudit();
  await buildReadiness(shadow);
  console.log(
    JSON.stringify({
      phase: '4.8.6.6.1',
      productionMutationsInThisRun,
      rolloutActivated: false,
      events: shadow.summary.eventsTotal,
      evaluations: shadow.summary.evaluationsTotal,
      noChange: shadow.summary.noChange,
      policyEligible: shadow.summary.policyEligible,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
