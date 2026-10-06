#!/usr/bin/env tsx
/**
 * M9.4E — Rausgegangen scale validation PREVIEW.
 *
 * Safety contract:
 * - staging only: gnkjzinwvmrxcadwebhv
 * - read-only database access
 * - no apply mode
 * - no scheduler changes
 * - no production target
 * - deterministic 100-candidate cohort from the M9.4C quality-ready pool
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { officialEvidenceToEventCandidate } from '../server/ingestion/adapters/official-evidence-adapter';
import { planOfficialEventWrites } from '../server/ingestion/planning/event-write-planner';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  stagingGuardConstants,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { loadPlannerContextFromLinkedDb } from '../server/ingestion/sync/load-planner-context';
import { STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import type { EventWritePlan } from '../server/ingestion/types/event-candidate';
import { evaluateImportCandidateQualityContract } from '../server/official-connectors/ticket-evidence/network-discovery/import-quality-contract-gate';
import {
  determineImportEligibility,
  IMPORT_ELIGIBILITY_CONTRACT,
  isImportEligibleOutcome,
  type ImportEligibilityOutcome,
} from '../server/official-connectors/rausgegangen-discovery/import-eligibility';
import {
  selectM94EScaleCohort,
  type M94ECohortEntry,
  type M94EQualityPoolEntry,
} from '../server/official-connectors/rausgegangen-discovery/m9-4e-cohort-selection';
import {
  finalizeRausgegangenControlledImportEvidence,
  reviewRausgegangenWritePlan,
  summarizeRausgegangenWritePlanMutations,
  type RausgegangenLiveVerification,
} from '../server/official-connectors/rausgegangen-discovery/rausgegangen-controlled-import-bridge';
import {
  verifyRausgegangenCandidateLive,
  type OriginalBatchEntry,
} from '../server/official-connectors/rausgegangen-discovery/rausgegangen-live-verify';

const REPO_ROOT = join(process.cwd(), '..');
const M94C_OUT = join(REPO_ROOT, 'artifacts', 'm9-4c-rausgegangen-acquisition-coverage');
const M94D_OUT = join(REPO_ROOT, 'artifacts', 'm9-4d-rausgegangen-controlled-expansion');
const OUT = join(REPO_ROOT, 'artifacts', 'm9-4e-rausgegangen-scale-validation');
const QUALITY_POOL_PATH = join(M94C_OUT, 'quality-ready-acquisition-pool.json');
const LOCATION_ONLY_PATH = join(M94C_OUT, 'location-only-events.json');
const PREVIOUS_COHORT_PATH = join(M94D_OUT, 'original-m9-4d-batch.json');
const TARGET_SIZE = 100;

interface QualityPoolFile {
  totalQualityReady: number;
  buckets?: Record<string, number>;
  entries: M94EQualityPoolEntry[];
}

interface LocationOnlyArtifactEntry {
  eventSlug?: string;
  identityKey?: string;
  ticketIoEventId?: string;
}

interface PreviousCohortFile {
  candidates?: Array<{ identityKey?: string }>;
}

interface PreparedPreview {
  cohort: M94ECohortEntry;
  verification?: RausgegangenLiveVerification;
  qualityContract?: ReturnType<typeof evaluateImportCandidateQualityContract>;
  importEligibility?: ReturnType<typeof determineImportEligibility>;
  evidence?: Awaited<ReturnType<typeof finalizeRausgegangenControlledImportEvidence>>;
  plan?: EventWritePlan;
  error?: string;
}

interface DatabaseFingerprint {
  events: number;
  venues: number;
  sources: number;
  lineup: number;
  genres: number;
  tickets: number;
  ingestionRuns: number;
  maxEventUpdatedAt: string | null;
  maxSourceFetchedAt: string | null;
}

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
}

function berlinDateKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function fingerprint(
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
): DatabaseFingerprint {
  const rows = loadJsonAgg<DatabaseFingerprint>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t)) AS rows
    FROM (
      SELECT
        (SELECT count(*)::int FROM public.events) AS events,
        (SELECT count(*)::int FROM public.venues) AS venues,
        (SELECT count(*)::int FROM public.event_sources) AS sources,
        (SELECT count(*)::int FROM public.event_lineup) AS lineup,
        (SELECT count(*)::int FROM public.event_genres) AS genres,
        (SELECT count(*)::int FROM public.event_tickets) AS tickets,
        (SELECT count(*)::int FROM public.ingestion_runs) AS "ingestionRuns",
        (SELECT max(updated_at)::text FROM public.events) AS "maxEventUpdatedAt",
        (SELECT max(fetched_at)::text FROM public.event_sources) AS "maxSourceFetchedAt"
    ) t;
  `,
  );
  const value = rows[0];
  if (!value) {
    throw new Error('m94e_database_fingerprint_missing');
  }
  return value;
}

function loadQualityPool(): QualityPoolFile {
  return JSON.parse(readFileSync(QUALITY_POOL_PATH, 'utf8')) as QualityPoolFile;
}

function loadLocationOnlySlugs(): Set<string> {
  const rows = JSON.parse(readFileSync(LOCATION_ONLY_PATH, 'utf8')) as LocationOnlyArtifactEntry[];
  return new Set(
    rows
      .map((row) => row.eventSlug ?? row.ticketIoEventId ?? row.identityKey?.replace(/^rausgegangen:/, ''))
      .filter((value): value is string => Boolean(value)),
  );
}

function loadPreviousCohortIdentities(): Set<string> {
  const payload = JSON.parse(readFileSync(PREVIOUS_COHORT_PATH, 'utf8')) as PreviousCohortFile;
  return new Set(
    (payload.candidates ?? [])
      .map((entry) => entry.identityKey)
      .filter((value): value is string => Boolean(value)),
  );
}

function toOriginalBatchEntry(entry: M94ECohortEntry): OriginalBatchEntry {
  return {
    identityKey: entry.identityKey,
    title: entry.title,
    startsAt: entry.startsAt,
    city: entry.city,
    regionSlug: entry.regionSlug,
    sourceUrl: entry.sourceUrl,
    relevance: entry.relevance,
    genres: entry.genres,
    lineupCount: entry.lineupCount,
    ticketUrl: entry.ticketUrl,
    mediaUrl: entry.mediaUrl,
    matchClassification: entry.matchClassification,
  };
}

function summarizeOutcomes(prepared: PreparedPreview[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of prepared) {
    const outcome = entry.importEligibility?.outcome ?? 'PREVIEW_ERROR';
    result[outcome] = (result[outcome] ?? 0) + 1;
  }
  return result;
}

function distribution(values: Array<string | undefined>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    const key = value?.trim() || 'unknown';
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(result).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  );
}

function planProjection(plan: EventWritePlan) {
  const identityKey =
    plan.candidate.origin.kind === 'official_connector'
      ? plan.candidate.origin.sourceEventKey
      : 'unknown';
  return {
    identityKey,
    title: plan.candidate.title,
    eventAction: plan.eventAction,
    identity: plan.identity
      ? {
          decision: plan.identity.decision,
          matchedEventId: plan.identity.matchedEventId,
          reasons: plan.identity.reasons,
        }
      : null,
    reconciliation: plan.reconciliation
      ? {
          reviewRequired: plan.reconciliation.reviewRequired,
          reasons: plan.reconciliation.reasons,
        }
      : null,
    sourceAction: plan.sourceAction,
    lineupAction: plan.lineupAction,
    genresAction: plan.genresAction,
    descriptionAction: plan.descriptionAction,
    mediaAction: plan.mediaAction,
    expectedRowCounts: plan.expectedRowCounts,
    validation: plan.validation,
    issues: reviewRausgegangenWritePlan(plan),
  };
}

async function main(): Promise<void> {
  if (process.argv.includes('--apply')) {
    throw new Error('m94e_apply_forbidden_preview_only');
  }

  const sourceOnly = process.argv.includes('--source-only');
  mkdirSync(OUT, { recursive: true });
  const referenceInstant = new Date();
  const referenceDateLocal = berlinDateKey(referenceInstant);

  const guards = stagingGuardConstants();
  if (guards.production) {
    throw new Error(`m94e_production_must_be_unset:${guards.production}`);
  }

  let runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor> | undefined;
  let before: DatabaseFingerprint | undefined;
  let plannerContext: ReturnType<typeof loadPlannerContextFromLinkedDb> | undefined;
  let staging: { ref: string; name: string } | undefined;

  if (!sourceOnly) {
    assertProductionNotLinked(process.cwd());
    staging = verifyLinkedStagingTarget(process.cwd());
    if (staging.ref !== STAGING_PROJECT_REF) {
      throw new Error(`m94e_staging_ref_mismatch:${staging.ref}`);
    }
    runQuery = createSupabaseCliLinkedQueryExecutor(process.cwd());
    before = fingerprint(runQuery);
    plannerContext = loadPlannerContextFromLinkedDb(runQuery);
  }

  const qualityPool = loadQualityPool();
  const locationOnlySlugs = loadLocationOnlySlugs();
  const excludedIdentityKeys = loadPreviousCohortIdentities();

  const selection = selectM94EScaleCohort({
    poolEntries: qualityPool.entries,
    locationOnlySlugs,
    excludedIdentityKeys,
    targetSize: TARGET_SIZE,
    locationOnlyShare: 0.25,
  });

  const uniqueIdentities = new Set(selection.entries.map((entry) => entry.identityKey));
  if (uniqueIdentities.size !== TARGET_SIZE) {
    throw new Error(`m94e_duplicate_frozen_cohort:${uniqueIdentities.size}`);
  }
  if (selection.entries.some((entry) => excludedIdentityKeys.has(entry.identityKey))) {
    throw new Error('m94e_previous_cohort_leak');
  }
  if (
    selection.entries.some(
      (entry) => entry.relevance !== 'HIGH_RELEVANCE' && entry.relevance !== 'LIKELY_RELEVANT',
    )
  ) {
    throw new Error('m94e_snapshot_relevance_gate_failed');
  }
  if (
    selection.entries.some(
      (entry) => entry.domainState !== 'ELECTRONIC_HIGH' && entry.domainState !== 'ELECTRONIC_MEDIUM',
    )
  ) {
    throw new Error('m94e_snapshot_domain_gate_failed');
  }

  writeJson('import-eligibility-contract.json', IMPORT_ELIGIBILITY_CONTRACT);
  writeJson('staging-safety.json', {
    target: staging ?? { ref: STAGING_PROJECT_REF, name: 'Eternal-Rave' },
    previewOnly: true,
    sourceOnly,
    databaseLinked: !sourceOnly,
    databaseWrites: 0,
    schedulerChanges: 0,
  });
  writeJson('production-safety.json', {
    configuredProductionProjectRef: guards.production,
    productionWrites: 0,
    productionAccessed: false,
  });
  if (before) {
    writeJson('database-fingerprint-before.json', before);
  }
  writeJson('snapshot-pool-summary.json', {
    sourceTotalQualityReady: qualityPool.totalQualityReady,
    sourceBuckets: qualityPool.buckets ?? {},
    eligibleSnapshotPool: selection.eligibleSnapshotPool,
    eligibleAfterExclusions: selection.eligibleAfterExclusions,
    excludedPreviousCohort: selection.excludedPreviousCohort,
    previousCohortIdentityCount: excludedIdentityKeys.size,
    locationOnlyAvailable: selection.locationOnlyAvailable,
    locationOnlyTarget: selection.locationOnlyTarget,
  });
  writeJson('frozen-cohort.json', {
    generatedAt: referenceInstant.toISOString(),
    targetSize: selection.targetSize,
    selectionPolicy: {
      snapshotImportEligibilityRequired: true,
      excludeM94DIdentities: true,
      locationOnlyShare: 0.25,
      diversityDimensions: ['city', 'bundesland', 'primaryGenre'],
      stableTieBreakers: ['importReadinessScore', 'startsAt', 'identityKey'],
    },
    distributions: {
      city: distribution(selection.entries.map((entry) => entry.city)),
      bundesland: distribution(selection.entries.map((entry) => entry.bundesland)),
      relevance: distribution(selection.entries.map((entry) => entry.relevance)),
      domain: distribution(selection.entries.map((entry) => entry.domainState)),
      primaryGenre: distribution(selection.entries.map((entry) => entry.primaryGenre)),
      matchClassification: distribution(selection.entries.map((entry) => entry.matchClassification)),
      surface: {
        locationOnly: selection.entries.filter((entry) => entry.locationOnly).length,
        other: selection.entries.filter((entry) => !entry.locationOnly).length,
      },
    },
    entries: selection.entries,
  });

  const prepared: PreparedPreview[] = [];

  for (let index = 0; index < selection.entries.length; index += 1) {
    const cohort = selection.entries[index]!;
    process.stderr.write(
      `[M9.4E] live revalidation ${index + 1}/${selection.entries.length}: ${cohort.identityKey}\n`,
    );

    try {
      const live = await verifyRausgegangenCandidateLive(
        toOriginalBatchEntry(cohort),
        plannerContext?.eventCatalog ?? [],
        referenceInstant,
        referenceDateLocal,
      );

      // In source-only CI the current staging identity catalog is intentionally unavailable.
      // Preserve the frozen M9.4C identity state and mark it as pending direct DB reconciliation.
      const identityState = sourceOnly
        ? (cohort.matchClassification as typeof live.enriched.matchClassification)
        : live.enriched.matchClassification;
      const enriched = sourceOnly
        ? {
            ...live.enriched,
            matchClassification: identityState,
            matchReasons: ['m94c_snapshot_identity_pending_direct_db_reconciliation'],
          }
        : live.enriched;
      const verification = sourceOnly
        ? {
            ...live.verification,
            matchClassification: identityState,
            matchReasons: ['m94c_snapshot_identity_pending_direct_db_reconciliation'],
          }
        : live.verification;

      const qualityContract = evaluateImportCandidateQualityContract(enriched);
      const importEligibility = determineImportEligibility(
        verification,
        enriched,
        qualityContract,
        referenceInstant,
      );

      let evidence: PreparedPreview['evidence'];
      if (!sourceOnly && isImportEligibleOutcome(importEligibility.outcome)) {
        evidence = await finalizeRausgegangenControlledImportEvidence(
          enriched,
          live.fetchResult,
          referenceInstant.toISOString(),
        );
      }

      prepared.push({
        cohort,
        verification,
        qualityContract,
        importEligibility,
        evidence,
      });
    } catch (error) {
      prepared.push({
        cohort,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const plannable = prepared.filter(
    (entry): entry is PreparedPreview & { evidence: NonNullable<PreparedPreview['evidence']> } =>
      Boolean(entry.evidence && entry.importEligibility && isImportEligibleOutcome(entry.importEligibility.outcome)),
  );
  const candidates = plannable.map((entry) =>
    officialEvidenceToEventCandidate(entry.evidence.evidence),
  );
  const plans =
    sourceOnly || !plannerContext
      ? []
      : planOfficialEventWrites(candidates, plannerContext);
  for (let index = 0; index < Math.min(plannable.length, plans.length); index += 1) {
    plannable[index]!.plan = plans[index];
  }

  const projectedPlans = plans.map(planProjection);
  const planIssues = projectedPlans.flatMap((plan) => plan.issues);
  const blockingPlanIssues = planIssues.filter((issue) => issue.severity === 'block');
  const warningPlanIssues = planIssues.filter((issue) => issue.severity === 'warn');
  const plannedMutations = summarizeRausgegangenWritePlanMutations(plans);

  writeJson(
    'live-revalidation.json',
    prepared.map((entry) => ({
      identityKey: entry.cohort.identityKey,
      snapshot: entry.cohort,
      liveAccessible: entry.verification?.liveAccessible ?? false,
      verification: entry.verification,
      qualityContract: entry.qualityContract,
      importEligibility: entry.importEligibility,
      previewError: entry.error,
    })),
  );
  writeJson('prewrite-plans.json', projectedPlans);
  writeJson('prewrite-plan-issues.json', {
    blocking: blockingPlanIssues,
    warnings: warningPlanIssues,
  });
  writeJson('planned-mutations.json', {
    previewOnly: true,
    ...plannedMutations,
    ticketWrites: 0,
    actualWrites: 0,
  });

  const after = runQuery ? fingerprint(runQuery) : undefined;
  const databaseUnchanged =
    before && after ? JSON.stringify(before) === JSON.stringify(after) : undefined;
  if (after) {
    writeJson('database-fingerprint-after.json', after);
  }

  const outcomes = summarizeOutcomes(prepared);
  const liveAccessible = prepared.filter((entry) => entry.verification?.liveAccessible).length;
  const previewErrors = prepared.filter((entry) => entry.error).length;
  const eligibleLive =
    (outcomes.ELIGIBLE_NEW ?? 0) + (outcomes.ELIGIBLE_EXISTING_MATCH ?? 0);

  const safetyPass =
    (sourceOnly || databaseUnchanged === true) &&
    blockingPlanIssues.length === 0 &&
    uniqueIdentities.size === TARGET_SIZE &&
    previewErrors === 0;

  const summary = {
    status: safetyPass
      ? sourceOnly
        ? 'M9_4E_SOURCE_PREVIEW_COMPLETE_DB_RECONCILIATION_PENDING'
        : 'M9_4E_SCALE_PREVIEW_COMPLETE'
      : 'M9_4E_SCALE_PREVIEW_HOLD',
    generatedAt: new Date().toISOString(),
    referenceInstant: referenceInstant.toISOString(),
    targetSize: TARGET_SIZE,
    sourceQualityReadyPool: qualityPool.totalQualityReady,
    snapshotImportEligiblePool: selection.eligibleSnapshotPool,
    snapshotAvailableAfterM94DExclusion: selection.eligibleAfterExclusions,
    frozenCohort: {
      total: selection.entries.length,
      locationOnly: selection.entries.filter((entry) => entry.locationOnly).length,
      uniqueIdentities: uniqueIdentities.size,
    },
    live: {
      accessible: liveAccessible,
      inaccessible: TARGET_SIZE - liveAccessible,
      previewErrors,
      outcomes,
      eligibleLive,
      eligibleRate: TARGET_SIZE > 0 ? eligibleLive / TARGET_SIZE : 0,
    },
    planner: {
      mode: sourceOnly ? 'PENDING_DIRECT_DB_RECONCILIATION' : 'CURRENT_STAGING_CONTEXT',
      plans: plans.length,
      blockingIssues: blockingPlanIssues.length,
      warnings: warningPlanIssues.length,
      projectedMutations: plannedMutations,
    },
    safety: {
      stagingProjectRef: STAGING_PROJECT_REF,
      databaseFingerprintChecked: !sourceOnly,
      databaseUnchanged: databaseUnchanged ?? null,
      productionConfigured: Boolean(guards.production),
      productionAccessed: false,
      schedulerChanged: false,
      actualDatabaseWrites: 0,
    },
    nextStep:
      safetyPass
        ? sourceOnly
          ? 'Reconcile the frozen live cohort directly against current staging DB, then review before any controlled apply.'
          : 'Review preview artifacts. Controlled staging apply requires a separate explicit authorization and implementation step.'
        : 'Do not apply. Resolve preview errors or blocking plan issues, then rerun M9.4E preview.',
  };

  writeJson('summary.json', summary);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (!sourceOnly && !databaseUnchanged) {
    throw new Error('m94e_read_only_invariant_failed_database_changed');
  }
  if (blockingPlanIssues.length > 0) {
    throw new Error(`m94e_blocking_plan_issues:${blockingPlanIssues.length}`);
  }
  if (previewErrors > 0) {
    throw new Error(`m94e_preview_errors:${previewErrors}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
