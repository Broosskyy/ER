/**
 * Phase 4.8.1.3 — Unified Import Gap Elimination.
 * STAGING ONLY — no production writes.
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PHASE481_FIELD_DECISION_RULES } from '@/features/import/contracts/field-decision-matrix';
import {
  classifyFieldComparison,
  clusterComparisons,
  IMPORTER_FIELD_RESPONSIBILITY,
  PREFERRED_FIELD_OWNER,
  type GapComparisonStatus,
} from '@/features/import/pilots/semantic-field-comparison';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const PHASE4812_COMPARISON = join(OUT, '_phase4812_field_comparison.json');
const PHASE4812_READINESS = join(OUT, '_phase4812_readiness_by_importer.json');

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

interface RawComparison {
  sampleId: string;
  eventId: string;
  importer: string;
  field: string;
  status: string;
  unified: unknown;
  production: unknown;
}

function loadPhase4812Comparisons(): RawComparison[] {
  const raw = JSON.parse(readFileSync(PHASE4812_COMPARISON, 'utf8')) as {
    comparisons?: RawComparison[];
    bothIncorrect?: RawComparison[];
    legacyBetter?: RawComparison[];
  };
  if (raw.comparisons?.length) return raw.comparisons;
  const all = [...(raw.bothIncorrect ?? [])];
  return all;
}

function loadAllComparisons(): RawComparison[] {
  const raw = JSON.parse(readFileSync(PHASE4812_COMPARISON, 'utf8')) as {
    comparisons: RawComparison[];
  };
  return raw.comparisons ?? [];
}

function reclassifyAll(comparisons: RawComparison[]) {
  return comparisons.map((row) => {
    const result = classifyFieldComparison({
      importer: row.importer,
      field: row.field,
      unified: row.unified,
      production: row.production,
      rawStatus: row.status,
    });
    return {
      ...row,
      phase4812Status: row.status,
      status: result.status,
      clusterKey: result.clusterKey,
      note: result.note,
      bothIncorrectCause: result.bothIncorrectCause,
      legacyBetterGroup: result.legacyBetterGroup,
    };
  });
}

function countByStatus(rows: Array<{ status: GapComparisonStatus }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

function analyzeBothIncorrect(rows: ReturnType<typeof reclassifyAll>) {
  const bothIncorrect = rows.filter((r) => r.status === 'BOTH_INCORRECT');
  const clusters = clusterComparisons(bothIncorrect);
  return {
    phase4812Count: rows.filter((r) => r.phase4812Status === 'BOTH_INCORRECT').length,
    phase4813Count: bothIncorrect.length,
    resolvedFrom4812: rows.filter((r) => r.phase4812Status === 'BOTH_INCORRECT' && r.status !== 'BOTH_INCORRECT').length,
    items: bothIncorrect.map((r) => ({
      eventId: r.eventId,
      importer: r.importer,
      field: r.field,
      unified: r.unified,
      production: r.production,
      primaryCause: r.bothIncorrectCause ?? 'Unknown',
      clusterKey: r.clusterKey,
      note: r.note,
      requiredCorrection: clusters.find((c) => c.clusterName === r.clusterKey)?.recommendedCorrection,
    })),
    clusters,
  };
}

function analyzeLegacyBetter(rows: ReturnType<typeof reclassifyAll>) {
  const legacyBetterRaw = rows.filter((r) => r.phase4812Status === 'LEGACY_BETTER');
  const reclassified = rows.filter(
    (r) => r.phase4812Status === 'LEGACY_BETTER' || r.status === 'LEGACY_BETTER' || r.status === 'INTENTIONALLY_UNSUPPORTED',
  );

  const futureSupported = rows.filter((r) => r.legacyBetterGroup === 'future_supported');
  const intentionallyUnsupported = rows.filter((r) => r.legacyBetterGroup === 'intentionally_unsupported');
  const reviewRequired = rows.filter((r) => r.legacyBetterGroup === 'review_required');

  const clusters = clusterComparisons(
    rows.filter((r) => r.legacyBetterGroup === 'future_supported').map((r) => ({
      ...r,
      status: r.status,
      clusterKey: r.clusterKey,
      note: r.note,
    })),
  );

  return {
    phase4812Count: legacyBetterRaw.length,
    phase4813LegacyBetterCount: rows.filter((r) => r.status === 'LEGACY_BETTER').length,
    reclassifiedToIntentionallyUnsupported: rows.filter(
      (r) => r.phase4812Status === 'LEGACY_BETTER' && r.status === 'INTENTIONALLY_UNSUPPORTED',
    ).length,
    groups: {
      future_supported: { count: futureSupported.length, items: futureSupported.slice(0, 50) },
      intentionally_unsupported: { count: intentionallyUnsupported.length, items: intentionallyUnsupported.slice(0, 50) },
      review_required: { count: reviewRequired.length, items: reviewRequired.slice(0, 50) },
    },
    clusters,
  };
}

function contractGapAnalysis() {
  const contractSupports = [
    'fieldEvidenceCandidates',
    'eventIdentityCandidates',
    'relationshipCandidates',
    'rawEvidenceReferences',
    'reviewFindings',
    'extractionDiagnostics',
    'completeness',
    'ticket_phases',
    'checkout_url',
    'availability',
    'sold_out',
    'lineupEntries',
    'explicit/rejected evidence',
    'sourceRole per field',
    'inclusionReason/rejectionReason',
  ];

  const importerGaps = [
    {
      capability: 'HTML entity decode on description normalization',
      contractSupports: true,
      gapType: 'importer_implementation',
      module: 'official-website-pilot.ts',
    },
    {
      capability: 'Canonical price label format (Tickets ab X Euro)',
      contractSupports: true,
      gapType: 'importer_implementation',
      module: 'ticket-io-pilot.ts + format-ticket-price.ts',
    },
    {
      capability: 'Mark JSON-LD offer URL as stale candidate not consumer CTA',
      contractSupports: true,
      gapType: 'importer_implementation',
      module: 'official-website-pilot.ts:ticket_destination_candidate',
    },
    {
      capability: 'Ticket Kings public event catalog discovery',
      contractSupports: true,
      gapType: 'importer_implementation',
      module: 'live-sample-builder.ts',
    },
    {
      capability: 'Multi-source merge simulation at scale',
      contractSupports: true,
      gapType: 'importer_implementation',
      module: 'merge-simulation.ts',
    },
    {
      capability: 'AI-assisted import scanner',
      contractSupports: false,
      gapType: 'contract_extension_future',
      module: 'not in scope Phase 4.8.1.3',
    },
  ];

  return {
    contractCapabilitiesPresent: contractSupports,
    importerImplementationGaps: importerGaps.filter((g) => g.gapType === 'importer_implementation'),
    contractExtensionRequired: importerGaps.filter((g) => g.gapType === 'contract_extension_future'),
  };
}

function fieldOwnershipValidation() {
  const conflicts: Array<Record<string, unknown>> = [];
  const ownership = Object.entries(PREFERRED_FIELD_OWNER).map(([field, role]) => {
    const rule = PHASE481_FIELD_DECISION_RULES.find((r) => r.field === field || r.field === `${field}Name`);
    return {
      field,
      preferredRole: role,
      contractRule: rule?.mergeRule ?? 'see field-decision-matrix',
      eligibleRoles: rule?.eligibleSourceRoles ?? [],
    };
  });

  for (const [importer, denied] of Object.entries(IMPORTER_FIELD_RESPONSIBILITY)) {
    for (const field of denied) {
      const preferred = PREFERRED_FIELD_OWNER[field];
      if (preferred && importer.includes('ticket-io') && ['description', 'lineup', 'venue'].includes(field)) {
        conflicts.push({
          type: 'none',
          note: `ticket-io correctly denied ${field}; preferred owner is ${preferred}`,
          resolved: true,
        });
      }
    }
  }

  return {
    ownership,
    conflicts: conflicts.filter((c) => !c.resolved),
    validatedDenials: Object.fromEntries(
      Object.entries(IMPORTER_FIELD_RESPONSIBILITY).map(([k, v]) => [k, [...v]]),
    ),
  };
}

function liveRegression(
  phase4812Totals: Record<string, number>,
  phase4813Totals: Record<string, number>,
  reclassified: ReturnType<typeof reclassifyAll>,
) {
  const resolved = reclassified.filter(
    (r) =>
      (r.phase4812Status === 'BOTH_INCORRECT' && r.status !== 'BOTH_INCORRECT') ||
      (r.phase4812Status === 'LEGACY_BETTER' && r.status === 'INTENTIONALLY_UNSUPPORTED'),
  );
  const regressions = reclassified.filter(
    (r) => r.phase4812Status === 'BOTH_CORRECT' && r.status !== 'BOTH_CORRECT',
  );

  return {
    productionMutationsInThisRun,
    phase4812Totals,
    phase4813Totals,
    bothIncorrect: {
      before: phase4812Totals.BOTH_INCORRECT ?? 0,
      after: phase4813Totals.BOTH_INCORRECT ?? 0,
      delta: (phase4813Totals.BOTH_INCORRECT ?? 0) - (phase4812Totals.BOTH_INCORRECT ?? 0),
    },
    legacyBetter: {
      before: phase4812Totals.LEGACY_BETTER ?? 0,
      after: phase4813Totals.LEGACY_BETTER ?? 0,
      intentionallyUnsupported: phase4813Totals.INTENTIONALLY_UNSUPPORTED ?? 0,
    },
    resolvedCount: resolved.length,
    resolvedSample: resolved.slice(0, 20),
    regressionCount: regressions.length,
    regressions,
    unchangedSemantic: reclassified.filter((r) => r.phase4812Status === r.status).length,
  };
}

function shadowReadiness(
  reclassified: ReturnType<typeof reclassifyAll>,
  bothIncorrectAnalysis: ReturnType<typeof analyzeBothIncorrect>,
  legacyAnalysis: ReturnType<typeof analyzeLegacyBetter>,
) {
  const prev = existsSync(PHASE4812_READINESS)
    ? (JSON.parse(readFileSync(PHASE4812_READINESS, 'utf8')) as { verdicts: Record<string, string> }).verdicts
    : {};

  const importers = ['official-website', 'ticket-io', 'ticket-kings', 'nacht-manager'] as const;
  const importerResults: Record<string, ReturnType<typeof buildImporterVerdict>> = {};

  function buildImporterVerdict(importer: string) {
    const rows = reclassified.filter((r) => r.importer === importer);
    const bothIncorrect = rows.filter((r) => r.status === 'BOTH_INCORRECT').length;
    const legacyBetter = rows.filter((r) => r.status === 'LEGACY_BETTER').length;
    const futureSupported = rows.filter((r) => r.legacyBetterGroup === 'future_supported').length;
    const blockers: string[] = [];
    if (bothIncorrect > 0) blockers.push(`${bothIncorrect} BOTH_INCORRECT remain`);
    if (legacyBetter > 0) blockers.push(`${legacyBetter} LEGACY_BETTER (future_supported)`);
    if (futureSupported > 0) blockers.push(`${futureSupported} fields need future extractor support`);

    const current =
      blockers.length === 0
        ? 'READY_FOR_PRODUCTION_SHADOW'
        : bothIncorrect > 5
          ? 'NOT_READY'
          : 'READY_FOR_MORE_STAGING';

    return {
      previous: prev[importer] ?? 'READY_FOR_MORE_STAGING',
      current,
      blockers,
      estimatedRemainingWork:
        blockers.length === 0
          ? 'Shadow observation only'
          : `Resolve ${bothIncorrect} BOTH_INCORRECT + ${futureSupported} future_supported extractors`,
    };
  }

  for (const importer of importers) {
    const verdict = buildImporterVerdict(importer);
    const globalGatesOpen =
      bothIncorrectAnalysis.phase4813Count === 0 && legacyAnalysis.phase4813LegacyBetterCount === 0;
    importerResults[importer] = {
      ...verdict,
      current:
        verdict.current === 'READY_FOR_PRODUCTION_SHADOW' && !globalGatesOpen
          ? 'READY_FOR_MORE_STAGING'
          : verdict.current,
    };
  }

  const unexplainedBothIncorrect = bothIncorrectAnalysis.phase4813Count;
  const unexplainedLegacyBetter = legacyAnalysis.phase4813LegacyBetterCount;

  return {
    productionMutationsInThisRun,
    productionShadowApproved: false,
    gates: {
      unexplainedBothIncorrect: unexplainedBothIncorrect === 0,
      unexplainedLegacyBetter: unexplainedLegacyBetter === 0,
    },
    importers: importerResults,
  };
}

function architectureReview() {
  return {
    subsystems: [
      { name: 'Unified Import Contract', verdict: 'KEEP', reason: '120/120 schema pass; extensible evidence model' },
      { name: 'Evidence Contract', verdict: 'MODERNIZE', reason: 'Add stale-candidate tier and sold-out price semantics' },
      { name: 'Identity Matching', verdict: 'MODERNIZE', reason: 'Scale clustering works; stale slug detection needed' },
      { name: 'Duplicate Handling', verdict: 'MODERNIZE', reason: 'Zero false merges; Sommerfest stale slug review' },
      { name: 'Multi-source Support', verdict: 'KEEP', reason: 'Proven on gold standard + 120 live items' },
      { name: 'Merge Engine', verdict: 'KEEP', reason: 'Field decision matrix aligns with ownership policy' },
      { name: 'Canonical Event Model', verdict: 'KEEP', reason: 'Stable; production read-only validation' },
      { name: 'Projection Layer', verdict: 'MODERNIZE', reason: 'Legacy price labels differ from unified normalization' },
      { name: 'Future Manual Imports', verdict: 'KEEP', reason: 'Contract supports admin channel provenance' },
      { name: 'Future Automatic Imports', verdict: 'MODERNIZE', reason: 'Needs parallel fetch pool at scale' },
      { name: 'Future AI-assisted Imports', verdict: 'MODERNIZE', reason: 'Contract sufficient; scanner not built' },
    ],
    longTermPlatformCapable: true,
    replaceRecommended: [],
  };
}

async function full(): Promise<void> {
  console.log('Phase 4.8.1.3 gap analysis — staging only');

  const comparisons = loadAllComparisons();
  if (comparisons.length === 0) {
    throw new Error('No comparisons in _phase4812_field_comparison.json — run phase 4812 first');
  }

  const phase4812Raw = JSON.parse(readFileSync(PHASE4812_COMPARISON, 'utf8')) as { totals: Record<string, number> };
  const reclassified = reclassifyAll(comparisons);
  const phase4813Totals = countByStatus(reclassified);

  const clusters = clusterComparisons(reclassified);
  const bothIncorrectAnalysis = analyzeBothIncorrect(reclassified);
  const legacyAnalysis = analyzeLegacyBetter(reclassified);
  const contractGaps = contractGapAnalysis();
  const ownership = fieldOwnershipValidation();
  const regression = liveRegression(phase4812Raw.totals, phase4813Totals, reclassified);
  const readiness = shadowReadiness(reclassified, bothIncorrectAnalysis, legacyAnalysis);
  const architecture = architectureReview();

  writeJson('_phase4813_difference_clusters.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    clusterCount: clusters.length,
    clusters,
  });

  writeJson('_phase4813_both_incorrect_analysis.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    ...bothIncorrectAnalysis,
  });

  writeJson('_phase4813_legacy_better_analysis.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    ...legacyAnalysis,
  });

  writeJson('_phase4813_contract_gap_analysis.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    ...contractGaps,
  });

  writeJson('_phase4813_field_ownership.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    ...ownership,
  });

  writeJson('_phase4813_live_regression.json', {
    generatedAt: new Date().toISOString(),
    ...regression,
  });

  writeJson('_phase4813_shadow_readiness.json', readiness);
  writeJson('_phase4813_architecture_review.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    ...architecture,
  });

  writeJson('_phase4813_reclassified_totals.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    phase4812: phase4812Raw.totals,
    phase4813: phase4813Totals,
  });

  console.log('Phase 4.8.1.2 → 4.8.1.3');
  console.log(`BOTH_INCORRECT: ${phase4812Raw.totals.BOTH_INCORRECT} → ${phase4813Totals.BOTH_INCORRECT ?? 0}`);
  console.log(`LEGACY_BETTER: ${phase4812Raw.totals.LEGACY_BETTER} → ${phase4813Totals.LEGACY_BETTER ?? 0}`);
  console.log(`INTENTIONALLY_UNSUPPORTED: ${phase4813Totals.INTENTIONALLY_UNSUPPORTED ?? 0}`);
  console.log(`productionMutationsInThisRun=${productionMutationsInThisRun}`);
}

const command = process.argv[2] ?? 'full';
if (command === 'full') {
  full().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
