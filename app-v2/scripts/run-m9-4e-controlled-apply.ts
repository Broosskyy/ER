#!/usr/bin/env tsx
/**
 * M9.4E — controlled staging apply for the frozen 38-event cohort.
 *
 * Safety:
 * - exact staging project only
 * - production must be unset / not linked
 * - no scheduler changes
 * - frozen identity manifest + hash
 * - live revalidation of all 38 before writes
 * - any blocked/review candidate aborts the whole preflight
 * - any unexpected existing match aborts unless it is an already-applied source binding
 * - apply requires an explicit confirmation token and env guard
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { officialEvidenceToEventCandidate } from '../server/ingestion/adapters/official-evidence-adapter';
import { isPlanIdempotent, planOfficialEventWrites } from '../server/ingestion/planning/event-write-planner';
import { createOfficialEventApplyExecutor } from '../server/ingestion/sync/execute-official-event-apply';
import { executeTicketPersistenceFromResults } from '../server/ingestion/sync/execute-ticket-persistence';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { loadPlannerContextFromLinkedDb } from '../server/ingestion/sync/load-planner-context';
import {
  STAGING_PROJECT_REF,
  getConfiguredProductionProjectRef,
} from '../server/ingestion/sync/staging-guard';
import type { EventWritePlan } from '../server/ingestion/types/event-candidate';
import type { EnrichedTicketIoEvent } from '../server/official-connectors/ticket-evidence/network-discovery/detail-types';
import { evaluateImportCandidateQualityContract } from '../server/official-connectors/ticket-evidence/network-discovery/import-quality-contract-gate';
import { isVerifiedTicketComplete } from '../server/official-connectors/ticket-evidence/ticket-audit-metrics';
import {
  determineImportEligibility,
  isImportEligibleOutcome,
  type ImportEligibilityResult,
} from '../server/official-connectors/rausgegangen-discovery/import-eligibility';
import type { M94EQualityPoolEntry } from '../server/official-connectors/rausgegangen-discovery/m9-4e-cohort-selection';
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
const QUALITY_POOL_PATH = join(
  REPO_ROOT,
  'artifacts',
  'm9-4c-rausgegangen-acquisition-coverage',
  'quality-ready-acquisition-pool.json',
);
const MANIFEST_PATH = join(
  process.cwd(),
  'scripts',
  'manifests',
  'm9-4e-controlled-apply-38.json',
);
const OUT = join(REPO_ROOT, 'artifacts', 'm9-4e-controlled-apply');
const CONFIRM_TOKEN = 'M9.4E-CONTROLLED-APPLY-38';

interface ControlledApplyManifest {
  schemaVersion: number;
  previewHead: string;
  previewRunId: number;
  previewGeneratedAt: string;
  targetProjectRef: string;
  expectedCount: number;
  identitySha256: string;
  identities: string[];
}

interface QualityPoolFile {
  entries: M94EQualityPoolEntry[];
}

interface PreparedCandidate {
  original: OriginalBatchEntry;
  verification: RausgegangenLiveVerification;
  enriched: EnrichedTicketIoEvent;
  qualityContract: ReturnType<typeof evaluateImportCandidateQualityContract>;
  importEligibility: ImportEligibilityResult;
  evidence: Awaited<ReturnType<typeof finalizeRausgegangenControlledImportEvidence>>;
  plan?: EventWritePlan;
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
  maxSourceObservedAt: string | null;
}

interface SourceReadback {
  sourceEventKey: string;
  eventId: string;
  title: string;
  startsAt: string;
  status: string;
  sourceUrl: string;
}

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(payload, null, 2) + '\n');
}

function sha256IdentityList(identities: string[]): string {
  return createHash('sha256').update([...identities].sort().join('\n')).digest('hex');
}

function sqlLiteral(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

function berlinDateKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function loadManifest(): ControlledApplyManifest {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ControlledApplyManifest;
  if (manifest.schemaVersion !== 1) {
    throw new Error('m94e_apply_manifest_schema_invalid:' + manifest.schemaVersion);
  }
  if (manifest.targetProjectRef !== STAGING_PROJECT_REF) {
    throw new Error('m94e_apply_manifest_target_mismatch:' + manifest.targetProjectRef);
  }
  if (manifest.expectedCount !== 38 || manifest.identities.length !== 38) {
    throw new Error(
      'm94e_apply_manifest_count_invalid:' +
        manifest.expectedCount +
        ':' +
        manifest.identities.length,
    );
  }
  const unique = new Set(manifest.identities);
  if (unique.size !== manifest.identities.length) {
    throw new Error('m94e_apply_manifest_duplicate_identity');
  }
  const digest = sha256IdentityList(manifest.identities);
  if (digest !== manifest.identitySha256) {
    throw new Error('m94e_apply_manifest_hash_mismatch:' + digest);
  }
  return manifest;
}

function loadFrozenPoolEntries(manifest: ControlledApplyManifest): M94EQualityPoolEntry[] {
  const pool = JSON.parse(readFileSync(QUALITY_POOL_PATH, 'utf8')) as QualityPoolFile;
  const byIdentity = new Map(pool.entries.map((entry) => [entry.event.identityKey, entry]));
  const selected = manifest.identities.map((identityKey) => {
    const entry = byIdentity.get(identityKey);
    if (!entry) {
      throw new Error('m94e_apply_identity_missing_from_pool:' + identityKey);
    }
    return entry;
  });
  if (selected.length !== manifest.expectedCount) {
    throw new Error('m94e_apply_selected_count_invalid:' + selected.length);
  }
  return selected;
}

function toOriginalBatchEntry(entry: M94EQualityPoolEntry): OriginalBatchEntry {
  const event = entry.event;
  return {
    identityKey: event.identityKey,
    title: event.title,
    startsAt: event.startsAt,
    city: event.city,
    regionSlug: event.shopSlug,
    sourceUrl: event.canonicalUrl,
    relevance: event.relevance,
    genres: event.genreCandidates.map((genre) => genre.label),
    lineupCount: event.lineupHints.length,
    ticketUrl: event.eventUrl,
    mediaUrl: event.bestMediaUrl,
    matchClassification: event.matchClassification,
  };
}

function databaseFingerprint(
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
): DatabaseFingerprint {
  const rows = loadJsonAgg<DatabaseFingerprint>(
    runQuery,
    [
      "SELECT jsonb_agg(row_to_json(t)) AS rows FROM (",
      "SELECT",
      "(SELECT count(*)::int FROM public.events) AS events,",
      "(SELECT count(*)::int FROM public.venues) AS venues,",
      "(SELECT count(*)::int FROM public.event_sources) AS sources,",
      "(SELECT count(*)::int FROM public.event_lineup) AS lineup,",
      "(SELECT count(*)::int FROM public.event_genres) AS genres,",
      "(SELECT count(*)::int FROM public.event_tickets) AS tickets,",
      "(SELECT count(*)::int FROM public.ingestion_runs) AS \"ingestionRuns\",",
      "(SELECT max(updated_at)::text FROM public.events) AS \"maxEventUpdatedAt\",",
      "(SELECT max(observed_at)::text FROM public.event_sources) AS \"maxSourceObservedAt\"",
      ") t;",
    ].join('\n'),
  );
  const value = rows[0];
  if (!value) {
    throw new Error('m94e_apply_database_fingerprint_missing');
  }
  return value;
}

function loadSourceReadback(
  runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>,
  identities: string[],
): SourceReadback[] {
  const values = identities.map(sqlLiteral).join(',');
  return loadJsonAgg<SourceReadback>(
    runQuery,
    [
      "SELECT jsonb_agg(row_to_json(t) ORDER BY t.\"sourceEventKey\") AS rows FROM (",
      "SELECT",
      "s.raw_payload->>'sourceEventKey' AS \"sourceEventKey\",",
      "s.event_id::text AS \"eventId\",",
      "e.title,",
      "e.starts_at::text AS \"startsAt\",",
      "e.status,",
      "s.source_url AS \"sourceUrl\"",
      "FROM public.event_sources s",
      "JOIN public.events e ON e.id = s.event_id",
      "WHERE s.raw_payload->>'sourceEventKey' IN (" + values + ")",
      ") t;",
    ].join('\n'),
  );
}

async function prepareCandidates(
  originals: OriginalBatchEntry[],
  eventCatalog: NonNullable<ReturnType<typeof loadPlannerContextFromLinkedDb>['eventCatalog']>,
  referenceInstant: Date,
): Promise<PreparedCandidate[]> {
  const referenceDateLocal = berlinDateKey(referenceInstant);
  const prepared: PreparedCandidate[] = [];

  for (let index = 0; index < originals.length; index += 1) {
    const original = originals[index]!;
    process.stderr.write(
      '[M9.4E APPLY] live revalidation ' +
        (index + 1) +
        '/' +
        originals.length +
        ': ' +
        original.identityKey +
        '\n',
    );

    const live = await verifyRausgegangenCandidateLive(
      original,
      eventCatalog,
      referenceInstant,
      referenceDateLocal,
    );
    const qualityContract = evaluateImportCandidateQualityContract(live.enriched);
    const importEligibility = determineImportEligibility(
      live.verification,
      live.enriched,
      qualityContract,
      referenceInstant,
    );

    if (!isImportEligibleOutcome(importEligibility.outcome)) {
      throw new Error(
        'm94e_apply_live_eligibility_drift:' +
          original.identityKey +
          ':' +
          importEligibility.outcome +
          ':' +
          importEligibility.reasons.join('|'),
      );
    }

    const evidence = await finalizeRausgegangenControlledImportEvidence(
      live.enriched,
      live.fetchResult,
      referenceInstant.toISOString(),
    );

    prepared.push({
      original,
      verification: live.verification,
      enriched: live.enriched,
      qualityContract,
      importEligibility,
      evidence,
    });
  }

  return prepared;
}

function attachPlans(
  prepared: PreparedCandidate[],
  context: ReturnType<typeof loadPlannerContextFromLinkedDb>,
): EventWritePlan[] {
  const candidates = prepared.map((entry) =>
    officialEvidenceToEventCandidate(entry.evidence.evidence),
  );
  const plans = planOfficialEventWrites(candidates, context);
  for (let index = 0; index < prepared.length; index += 1) {
    prepared[index]!.plan = plans[index];
  }
  return plans;
}

function plannedRowDeltas(plans: EventWritePlan[]) {
  return plans.reduce(
    (acc, plan) => {
      acc.venues += plan.expectedRowCounts.venuesInserted;
      acc.events += plan.expectedRowCounts.eventsInserted;
      acc.sources += plan.expectedRowCounts.sourcesInserted;
      acc.lineup += plan.lineupAction === 'replace' ? plan.expectedRowCounts.lineupInserted : 0;
      acc.genres += plan.genresAction === 'replace' ? plan.expectedRowCounts.genresInserted : 0;
      return acc;
    },
    { venues: 0, events: 0, sources: 0, lineup: 0, genres: 0 },
  );
}

function assertPrewriteContract(input: {
  manifest: ControlledApplyManifest;
  prepared: PreparedCandidate[];
  plans: EventWritePlan[];
  existingBindings: SourceReadback[];
}): void {
  const existingKeys = new Set(input.existingBindings.map((row) => row.sourceEventKey));
  const issues = input.plans.flatMap((plan) => reviewRausgegangenWritePlan(plan));
  if (issues.length > 0) {
    throw new Error(
      'm94e_apply_write_plan_issue:' +
        issues.map((issue) => issue.identityKey + ':' + issue.code).join(','),
    );
  }

  for (let index = 0; index < input.prepared.length; index += 1) {
    const entry = input.prepared[index]!;
    const plan = input.plans[index]!;
    const identityKey = entry.original.identityKey;
    const alreadyApplied = existingKeys.has(identityKey);

    if (alreadyApplied) {
      if (!isPlanIdempotent(plan)) {
        throw new Error('m94e_apply_resume_plan_not_idempotent:' + identityKey);
      }
      continue;
    }

    if (entry.importEligibility.outcome !== 'ELIGIBLE_NEW') {
      throw new Error(
        'm94e_apply_unexpected_existing_match:' +
          identityKey +
          ':' +
          entry.importEligibility.outcome,
      );
    }
    if (
      plan.eventAction !== 'insert' ||
      plan.sourceAction !== 'insert' ||
      plan.resolvedEventId
    ) {
      throw new Error(
        'm94e_apply_non_insert_plan:' +
          identityKey +
          ':' +
          plan.eventAction +
          ':' +
          plan.sourceAction,
      );
    }
  }

  const mutations = summarizeRausgegangenWritePlanMutations(input.plans);
  const expectedMissing = input.manifest.expectedCount - existingKeys.size;
  if (
    mutations.eventInserts !== expectedMissing ||
    mutations.sourceBindingWrites !== expectedMissing
  ) {
    throw new Error(
      'm94e_apply_prewrite_count_mismatch:' +
        mutations.eventInserts +
        ':' +
        mutations.sourceBindingWrites +
        ':expected=' +
        expectedMissing,
    );
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const contractOnly = process.argv.includes('--contract-only');
  const confirm = process.argv.find((arg) => arg.startsWith('--confirm='))?.slice('--confirm='.length);

  mkdirSync(OUT, { recursive: true });

  const manifest = loadManifest();
  const selectedEntries = loadFrozenPoolEntries(manifest);
  const originals = selectedEntries.map(toOriginalBatchEntry);

  writeJson('cohort-contract.json', {
    previewHead: manifest.previewHead,
    previewRunId: manifest.previewRunId,
    targetProjectRef: manifest.targetProjectRef,
    expectedCount: manifest.expectedCount,
    identitySha256: manifest.identitySha256,
    identities: manifest.identities,
    poolEntriesResolved: selectedEntries.length,
  });

  if (contractOnly) {
    process.stdout.write(
      JSON.stringify(
        {
          status: 'M9_4E_CONTROLLED_APPLY_CONTRACT_VERIFIED',
          expectedCount: manifest.expectedCount,
          identitySha256: manifest.identitySha256,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  if (getConfiguredProductionProjectRef()) {
    throw new Error('m94e_apply_production_must_be_unset');
  }

  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  const staging = verifyLinkedStagingTarget(cwd);
  if (staging.ref !== manifest.targetProjectRef || staging.ref !== STAGING_PROJECT_REF) {
    throw new Error('m94e_apply_staging_target_mismatch:' + staging.ref);
  }

  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const before = databaseFingerprint(runQuery);
  const existingBindings = loadSourceReadback(runQuery, manifest.identities);
  const plannerContext = loadPlannerContextFromLinkedDb(runQuery);
  const referenceInstant = new Date();

  const prepared = await prepareCandidates(
    originals,
    plannerContext.eventCatalog ?? [],
    referenceInstant,
  );
  const plans = attachPlans(prepared, plannerContext);

  assertPrewriteContract({
    manifest,
    prepared,
    plans,
    existingBindings,
  });

  const issues = plans.flatMap((plan) => reviewRausgegangenWritePlan(plan));
  const mutations = summarizeRausgegangenWritePlanMutations(plans);
  const rowDeltas = plannedRowDeltas(plans);

  writeJson('prewrite.json', {
    generatedAt: new Date().toISOString(),
    staging,
    before,
    alreadyApplied: existingBindings.length,
    liveOutcomes: prepared.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.importEligibility.outcome] = (acc[entry.importEligibility.outcome] ?? 0) + 1;
      return acc;
    }, {}),
    plans: plans.map((plan) => ({
      identityKey:
        plan.candidate.origin.kind === 'official_connector'
          ? plan.candidate.origin.sourceEventKey
          : 'unknown',
      eventAction: plan.eventAction,
      sourceAction: plan.sourceAction,
      venueAction: plan.venueAction,
      lineupAction: plan.lineupAction,
      genresAction: plan.genresAction,
      resolvedEventId: plan.resolvedEventId ?? null,
      identityDecision: plan.identity?.decision ?? null,
      validationDecision: plan.validation.decision,
      reasons: plan.reasons,
      issues: reviewRausgegangenWritePlan(plan),
    })),
    issues,
    mutations,
    rowDeltas,
  });

  if (!apply) {
    process.stdout.write(
      JSON.stringify(
        {
          status: 'M9_4E_CONTROLLED_STAGING_APPLY_PREFLIGHT_VERIFIED',
          cohort: manifest.expectedCount,
          alreadyApplied: existingBindings.length,
          plannedEventInserts: mutations.eventInserts,
          plannedSourceBindings: mutations.sourceBindingWrites,
          issues: issues.length,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  if (confirm !== CONFIRM_TOKEN) {
    throw new Error('m94e_apply_confirmation_token_missing_or_invalid');
  }
  if (process.env.M94E_ALLOW_STAGING_APPLY !== 'yes') {
    throw new Error('m94e_apply_env_guard_not_enabled');
  }

  const applyPlan = createOfficialEventApplyExecutor(runQuery);
  const planResults: Array<Record<string, unknown>> = [];

  for (const plan of plans) {
    const identityKey =
      plan.candidate.origin.kind === 'official_connector'
        ? plan.candidate.origin.sourceEventKey
        : 'unknown';

    if (isPlanIdempotent(plan)) {
      planResults.push({ identityKey, applied: false, idempotent: true });
      continue;
    }

    const result = await applyPlan(plan);
    planResults.push({ identityKey, idempotent: false, ...result });
  }

  const ticketResults = prepared
    .map((entry) => entry.evidence.ticketResult)
    .filter((result): result is NonNullable<typeof result> => Boolean(result))
    .filter((result) => isVerifiedTicketComplete(result));
  const ticketApply = executeTicketPersistenceFromResults(runQuery, ticketResults);

  const after = databaseFingerprint(runQuery);
  const readback = loadSourceReadback(runQuery, manifest.identities);
  const uniqueSourceKeys = new Set(readback.map((row) => row.sourceEventKey));
  const uniqueEventIds = new Set(readback.map((row) => row.eventId));

  if (
    readback.length !== manifest.expectedCount ||
    uniqueSourceKeys.size !== manifest.expectedCount ||
    uniqueEventIds.size !== manifest.expectedCount
  ) {
    throw new Error(
      'm94e_apply_readback_count_invalid:' +
        readback.length +
        ':' +
        uniqueSourceKeys.size +
        ':' +
        uniqueEventIds.size,
    );
  }

  const expectedAfter = {
    events: before.events + rowDeltas.events,
    venues: before.venues + rowDeltas.venues,
    sources: before.sources + rowDeltas.sources,
    lineup: before.lineup + rowDeltas.lineup,
    genres: before.genres + rowDeltas.genres,
    tickets: before.tickets + ticketApply.inserts,
  };

  if (
    after.events !== expectedAfter.events ||
    after.venues !== expectedAfter.venues ||
    after.sources !== expectedAfter.sources ||
    after.lineup !== expectedAfter.lineup ||
    after.genres !== expectedAfter.genres ||
    after.tickets !== expectedAfter.tickets
  ) {
    throw new Error(
      'm94e_apply_database_delta_mismatch:' +
        JSON.stringify({ before, after, expectedAfter, rowDeltas, ticketApply }),
    );
  }

  const secondContext = loadPlannerContextFromLinkedDb(runQuery);
  const secondCandidates = prepared.map((entry) =>
    officialEvidenceToEventCandidate(entry.evidence.evidence),
  );
  const secondPlans = planOfficialEventWrites(secondCandidates, secondContext);
  const nonIdempotentSecondPlans = secondPlans.filter((plan) => !isPlanIdempotent(plan));
  const secondTicketApply = executeTicketPersistenceFromResults(runQuery, ticketResults);

  if (nonIdempotentSecondPlans.length > 0) {
    throw new Error(
      'm94e_apply_second_plan_not_idempotent:' +
        nonIdempotentSecondPlans
          .map((plan) =>
            plan.candidate.origin.kind === 'official_connector'
              ? plan.candidate.origin.sourceEventKey
              : 'unknown',
          )
          .join(','),
    );
  }
  if (secondTicketApply.inserts !== 0 || secondTicketApply.updates !== 0) {
    throw new Error(
      'm94e_apply_second_ticket_write_not_idempotent:' +
        secondTicketApply.inserts +
        ':' +
        secondTicketApply.updates,
    );
  }

  const finalFingerprint = databaseFingerprint(runQuery);
  const summary = {
    status: 'M9_4E_CONTROLLED_STAGING_APPLY_VERIFIED',
    generatedAt: new Date().toISOString(),
    targetProjectRef: staging.ref,
    cohort: manifest.expectedCount,
    previewHead: manifest.previewHead,
    previewRunId: manifest.previewRunId,
    before,
    after,
    finalFingerprint,
    rowDeltas,
    ticketApply,
    secondRun: {
      nonIdempotentPlans: nonIdempotentSecondPlans.length,
      ticketInserts: secondTicketApply.inserts,
      ticketUpdates: secondTicketApply.updates,
    },
    readbackCount: readback.length,
    uniqueEventIds: uniqueEventIds.size,
    productionConfigured: false,
    schedulerChanged: false,
    planResults,
  };

  writeJson('readback.json', readback);
  writeJson('apply-result.json', summary);
  writeJson('manual-android-qa-pack.json', {
    required: true,
    count: readback.length,
    cases: readback.map((row) => ({
      eventId: row.eventId,
      title: row.title,
      startsAt: row.startsAt,
      checks: [
        'event card renders',
        'event detail opens',
        'venue/date are correct',
        'genre chips are plausible',
        'lineup has no structured-description leakage',
        'ticket target is safe when present',
        'event image is event-specific',
      ],
    })),
  });

  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
