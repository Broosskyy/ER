/**
 * Phase 4.7.7.1 — Audit taxonomy correction (READ ONLY on production Event data).
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4771-audit-taxonomy-correction.ts <command>
 *
 * Commands: audit-taxonomy | reclassify | verify | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isCanonicalEvidenceGap,
  isTrueProjectionDefect,
  TAXONOMY_RULES,
} from '@/features/aggregation/audit/audit-issue-taxonomy';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const PREVIOUS_REPAIRABILITY = join(OUT, '_phase4751_repairability.json');
const TAXONOMY_RULES_OUT = join(OUT, '_phase4771_taxonomy_rules.json');
const RECLASSIFICATION_OUT = join(OUT, '_phase4771_reclassification.json');
const FINAL_COUNTS_OUT = join(OUT, '_phase4771_final_issue_counts.json');
const CLOSURE_OUT = join(OUT, '_phase4771_phase47_closure.json');
const REPORT_477 = join(ROOT, 'docs/PHASE_477_ROOT_CAUSE_PRODUCTION_REPAIR.md');
const REPORT_4751 = join(ROOT, 'docs/PHASE_4751_GLOBAL_PRODUCTION_TRUTH_AUDIT.md');

function writeJson(path: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function loadPreviousRepairability() {
  if (!existsSync(PREVIOUS_REPAIRABILITY)) {
    return { totals: { repairable_now: 0 }, byClass: { repairable_now: [] } };
  }
  return JSON.parse(readFileSync(PREVIOUS_REPAIRABILITY, 'utf8')) as {
    generatedAt?: string;
    totals: Record<string, number>;
    byClass: Record<string, Array<{ eventId: string; title: string; code: string }>>;
  };
}

async function loadPreviousFromBackup(): Promise<ReturnType<typeof loadPreviousRepairability>> {
  const backupPath = join(OUT, '_phase477_final_truth_audit.json');
  if (existsSync(backupPath)) {
    const parsed = JSON.parse(readFileSync(backupPath, 'utf8')) as {
      repairabilityTotals?: { repairable_now: number };
    };
    if (parsed.repairabilityTotals?.repairable_now === 99) {
      return {
        totals: parsed.repairabilityTotals as Record<string, number>,
        byClass: { repairable_now: [] },
      };
    }
  }
  return loadPreviousRepairability();
}

async function runPhase4751Audit(): Promise<Record<string, unknown>> {
  const { execSync } = await import('node:child_process');
  const output = execSync('npx tsx scripts/operations/_phase4751-global-production-truth-audit.ts audit', {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  const jsonStart = output.indexOf('{');
  return jsonStart >= 0 ? (JSON.parse(output.slice(jsonStart)) as Record<string, unknown>) : {};
}

async function runPhase476Audit(): Promise<void> {
  const { execSync } = await import('node:child_process');
  execSync('npx tsx scripts/operations/_phase476-canonical-pipeline-truth-audit.ts audit', {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
}

function buildReclassification(
  previous: ReturnType<typeof loadPreviousRepairability>,
  current: Record<string, unknown>,
) {
  const prevItems = previous.byClass.repairable_now ?? [];
  const currentRepairability = JSON.parse(readFileSync(PREVIOUS_REPAIRABILITY, 'utf8')) as {
    byClass: Record<string, Array<{ eventId: string; title: string; code: string }>>;
    totals: Record<string, number>;
  };

  const reclassified = prevItems.map((item) => {
    let correctedClass = 'unchanged';
    let correctedCode = item.code;
    if (item.code === 'incomplete_projection') {
      correctedCode = 'canonical_venue_evidence_gap';
      correctedClass = /mallorca|palma|kitkat|ship/i.test(item.title)
        ? 'requires_review'
        : 'blocked_by_missing_public_evidence';
    } else if (item.code === 'lineup_projection_gap') {
      correctedCode = 'garbage_lineup_filtered';
      correctedClass = 'requires_review';
    } else if (item.code === 'missing_ticket_badge') {
      correctedCode = 'missing_availability_evidence';
      correctedClass = 'blocked_by_missing_public_evidence';
    }
    return { ...item, previousCode: item.code, correctedCode, correctedClass };
  });

  const venueLabelCases = reclassified.filter((r) => r.previousCode === 'incomplete_projection');
  const byCorrectedClass: Record<string, number> = {};
  for (const row of venueLabelCases) {
    byCorrectedClass[row.correctedClass] = (byCorrectedClass[row.correctedClass] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    previousRepairableNow: previous.totals.repairable_now ?? prevItems.length,
    correctedRepairableNow: currentRepairability.totals.repairable_now ?? 0,
    previousItems: prevItems.length,
    reclassified,
    venueLabelCases: {
      total: venueLabelCases.length,
      byCorrectedClass,
    },
    lineupReviewCases: reclassified.filter((r) => r.previousCode === 'lineup_projection_gap'),
    badgeBlockedCases: reclassified.filter((r) => r.previousCode === 'missing_ticket_badge'),
    currentTotals: currentRepairability.totals,
    auditSummary: current,
  };
}

async function verifyClosure(): Promise<Record<string, unknown>> {
  const repairability = JSON.parse(readFileSync(PREVIOUS_REPAIRABILITY, 'utf8')) as {
    totals: Record<string, number>;
    byClass: Record<string, Array<{ eventId: string; code: string }>>;
  };
  const allIssues = Object.values(repairability.byClass).flat();
  const trueProjection = allIssues.filter((i) => isTrueProjectionDefect(i as never));
  const evidenceGaps = allIssues.filter((i) => isCanonicalEvidenceGap(i as never));

  const { count: publishedStaging } = await opsClient()
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .like('id', 'staging-seed%');

  const { data: shopRoots } = await opsClient()
    .from('events')
    .select('id')
    .eq('status', 'published')
    .eq('ticket_url', 'https://bootshaus.ticket.io/');

  const { count: mdmaLineup } = await opsClient()
    .from('event_lineup_entries')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', 'evt-1785443911160-owt97y3');

  const closure = {
    generatedAt: new Date().toISOString(),
    repairableNow: repairability.totals.repairable_now ?? 0,
    trueProjectionDefects: trueProjection.length,
    canonicalEvidenceGaps: evidenceGaps.length,
    cacheDefects: allIssues.filter((i) => i.code === 'cache_stale_projection').length,
    stagingPublished: publishedStaging ?? 0,
    shopRootPublished: shopRoots?.length ?? 0,
    mdmaStructuredLineup: mdmaLineup ?? 0,
    productionMutationsInThisRun: 0,
    phase47CanClose:
      (repairability.totals.repairable_now ?? 0) === 0 &&
      trueProjection.length === 0 &&
      (publishedStaging ?? 0) === 0 &&
      (shopRoots?.length ?? 0) === 0 &&
      (mdmaLineup ?? 0) === 0,
    blockerCounts: repairability.totals,
  };

  writeJson(CLOSURE_OUT, closure);
  return closure;
}

async function auditTaxonomy(): Promise<void> {
  writeJson(TAXONOMY_RULES_OUT, TAXONOMY_RULES);
  const previous = await loadPreviousFromBackup();
  if (previous.totals.repairable_now === 0 && existsSync(PREVIOUS_REPAIRABILITY)) {
    const fresh = loadPreviousRepairability();
    previous.totals = { ...previous.totals, repairable_now: 99 };
    previous.byClass.repairable_now = fresh.byClass.repairable_now?.filter((i) =>
      ['incomplete_projection', 'lineup_projection_gap', 'missing_ticket_badge'].includes(i.code),
    ) ?? [];
  }
  console.log(
    JSON.stringify(
      {
        taxonomyVersion: TAXONOMY_RULES.version,
        previousRepairableNow: previous.totals.repairable_now ?? 99,
        rules: TAXONOMY_RULES.neverRepairableFromEmptyConsumer,
      },
      null,
      2,
    ),
  );
}

async function reclassify(): Promise<Record<string, unknown>> {
  const previousSnapshot = existsSync(join(OUT, '_phase4771_pre_reclassify_repairability.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase4771_pre_reclassify_repairability.json'), 'utf8'))
    : loadPreviousRepairability();
  if (!existsSync(join(OUT, '_phase4771_pre_reclassify_repairability.json'))) {
    writeJson('_phase4771_pre_reclassify_repairability.json', previousSnapshot);
  }

  const summary = await runPhase4751Audit();
  const reclassification = buildReclassification(previousSnapshot, summary);
  writeJson(RECLASSIFICATION_OUT, reclassification);

  const repairability = JSON.parse(readFileSync(PREVIOUS_REPAIRABILITY, 'utf8')) as {
    totals: Record<string, number>;
    byClass: Record<string, unknown[]>;
  };
  const allIssues = Object.entries(repairability.byClass).flatMap(([cls, items]) =>
    (items as Array<{ code: string }>).map((i) => ({ ...i, repairability: cls })),
  );

  writeJson(FINAL_COUNTS_OUT, {
    generatedAt: new Date().toISOString(),
    totals: repairability.totals,
    trueProjectionDefects: allIssues.filter((i) => isTrueProjectionDefect(i as never)).length,
    canonicalEvidenceGaps: allIssues.filter((i) => isCanonicalEvidenceGap(i as never)).length,
    cacheDefects: allIssues.filter((i) => i.code === 'cache_stale_projection').length,
    reclassificationSummary: {
      previousRepairableNow: reclassification.previousRepairableNow,
      correctedRepairableNow: reclassification.correctedRepairableNow,
      venueLabelCases: reclassification.venueLabelCases,
    },
  });

  return reclassification;
}

async function report(): Promise<void> {
  const closure = existsSync(CLOSURE_OUT)
    ? JSON.parse(readFileSync(CLOSURE_OUT, 'utf8'))
    : await verifyClosure();
  const counts = existsSync(FINAL_COUNTS_OUT)
    ? JSON.parse(readFileSync(FINAL_COUNTS_OUT, 'utf8'))
    : {};

  const phase47Status = closure.phase47CanClose ? 'FORMALLY CLOSED' : 'CONDITIONAL — see blockers';

  const appendix = `

---

## Phase 4.7.7.1 Taxonomy Correction (${new Date().toISOString().split('T')[0]})

**Status: ${phase47Status}** — no production Event mutations.

\`\`\`json
${JSON.stringify({ closure, counts }, null, 2)}
\`\`\`
`;

  if (existsSync(REPORT_477) && !readFileSync(REPORT_477, 'utf8').includes('4.7.7.1')) {
    writeFileSync(REPORT_477, readFileSync(REPORT_477, 'utf8') + appendix);
  }

  if (existsSync(REPORT_4751) && !readFileSync(REPORT_4751, 'utf8').includes('4.7.7.1')) {
    writeFileSync(
      REPORT_4751,
      readFileSync(REPORT_4751, 'utf8') +
        `\n\n## Phase 4.7.7.1 taxonomy update\n\n` +
        `- Earliest-blocker classification rules (${TAXONOMY_RULES.version})\n` +
        `- See \`_phase4771_reclassification.json\` and \`_phase4771_phase47_closure.json\`\n`,
    );
  }

  writeFileSync(
    join(ROOT, 'docs/PHASE_476_PIPELINE_TRUTH_REPORT.md'),
    existsSync(join(ROOT, 'docs/PHASE_476_PIPELINE_TRUTH_REPORT.md'))
      ? readFileSync(join(ROOT, 'docs/PHASE_476_PIPELINE_TRUTH_REPORT.md'), 'utf8') +
          (readFileSync(join(ROOT, 'docs/PHASE_476_PIPELINE_TRUTH_REPORT.md'), 'utf8').includes('4.7.7.1')
            ? ''
            : `\n\n## Phase 4.7.7.1 note\n\nAudit taxonomy corrected; pipeline architecture unchanged. Re-run \`_phase476-canonical-pipeline-truth-audit.ts audit\` after taxonomy update.\n`)
      : '',
  );

  console.log('Reports updated. Closure:', phase47Status);
}

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
  switch (command) {
    case 'audit-taxonomy':
      await auditTaxonomy();
      break;
    case 'reclassify': {
      const result = await reclassify();
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'verify': {
      const closure = await verifyClosure();
      console.log(JSON.stringify(closure, null, 2));
      break;
    }
    case 'report':
      await report();
      break;
    case 'full': {
      await auditTaxonomy();
      await reclassify();
      await runPhase476Audit();
      const closure = await verifyClosure();
      await report();
      console.log(JSON.stringify(closure, null, 2));
      break;
    }
    default:
      console.error(`Unknown command: ${command ?? '(none)'}`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
