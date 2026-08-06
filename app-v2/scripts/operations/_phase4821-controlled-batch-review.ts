/**
 * Phase 4.8.2.1 — Controlled Batch Review Preparation (read-only).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertShadowNoWrite,
  deliberateWriteAttemptShouldFail,
  resetShadowWriteAttempts,
} from '@/features/import/shadow/shadow-no-write-guard';
import {
  classifyAllProposals,
  elevateMissedProductionFixes,
  summarizeClassifications,
  toRealProductionFix,
  type ClassifiedProposal,
  type ControlledBatchProposal,
  type RealProductionFix,
} from '@/features/import/shadow/controlled-batch-review';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const PREVIEW_PATH = join(OUT, '_phase482_controlled_batch_preview.json');
const FIELD_COMPARISON_PATH = join(OUT, '_phase482_field_comparison.json');

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function verifyNoWrite(): void {
  resetShadowWriteAttempts();
  if (!deliberateWriteAttemptShouldFail()) {
    throw new Error('Deliberate write attempt was not blocked');
  }
  const guard = assertShadowNoWrite({ productionMutationsInThisRun });
  if (!guard.ok) {
    throw new Error(`No-write guard failed: ${guard.violations.join(', ')}`);
  }
}

function loadPreview(): ControlledBatchProposal[] {
  const raw = JSON.parse(readFileSync(PREVIEW_PATH, 'utf8')) as {
    proposals: ControlledBatchProposal[];
  };
  return raw.proposals;
}

function buildReviewPackage(input: {
  classified: ClassifiedProposal[];
  elevated: ReturnType<typeof elevateMissedProductionFixes>;
  realFixes: RealProductionFix[];
  rejected: ClassifiedProposal[];
  summary: ReturnType<typeof summarizeClassifications>;
}) {
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.1',
    productionMutationsInThisRun,
    sourcePreview: '_phase482_controlled_batch_preview.json',
    totalProposalsReviewed: input.classified.length,
    classificationSummary: input.summary,
    elevatedFromFieldComparison: input.elevated,
    realProductionFixCount: input.realFixes.length,
    rejectedCount: input.rejected.length,
    finalBatchSize: input.realFixes.length,
    items: input.classified.map((item) => ({
      eventId: item.proposal.eventId,
      title: item.proposal.title,
      field: item.proposal.field,
      classification: item.classification,
      classificationReason: item.classificationReason,
      risk: item.risk,
      currentCanonical: item.proposal.currentCanonical,
      proposedValue: item.proposal.proposedValue,
      publicEvidence: item.proposal.publicEvidence,
    })),
  };
}

function buildBatchPreview(realFixes: RealProductionFix[]) {
  const eventIds = [...new Set(realFixes.map((f) => f.eventId))];
  const fields = [...new Set(realFixes.map((f) => f.field))];
  const highRisk = realFixes.filter((f) => f.risk === 'HIGH');

  return {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    execute: false,
    totalProposedChanges: realFixes.length,
    affectedEvents: eventIds.length,
    affectedEventIds: eventIds,
    affectedFields: fields,
    expectedConsumerVisibleImprovements: realFixes.map((f) => ({
      eventId: f.eventId,
      title: f.eventTitle,
      field: f.field,
      risk: f.risk,
      consumerImpact: f.consumerImpact,
      before: f.currentProductionValue,
      after: f.proposedValue,
    })),
    frozenDomains: [
      'price',
      'ticket_phases',
      'availability',
      'sold_out',
      'checkout_url',
      'lineup',
      'ticket_platform_canonical_selection',
    ],
    rollbackStrategy: [
      'Snapshot affected event rows before any future apply',
      'Per-field restore from snapshot on rollback',
      'No cache invalidation in this review phase',
      'HIGH risk items require explicit manual approval before apply',
    ],
    highRiskCount: highRisk.length,
    highRiskItems: highRisk,
    proposals: realFixes,
  };
}

function buildMarkdown(input: {
  summary: ReturnType<typeof summarizeClassifications>;
  realFixes: RealProductionFix[];
  rejected: ClassifiedProposal[];
  elevated: ReturnType<typeof elevateMissedProductionFixes>;
  batchPreview: ReturnType<typeof buildBatchPreview>;
}) {
  const highRisk = input.realFixes.filter((f) => f.risk === 'HIGH');
  const sommerfestDesc = input.realFixes.find(
    (f) => f.eventId === 'evt-1785339391167-tfaixrr' && f.field === 'description',
  );

  return `# Phase 4.8.2.1 — Controlled Batch Review

**Read-only review package — no production batch executed**

Generated: ${new Date().toISOString()}

## Classification summary

| Classification | Count |
|----------------|------:|
| REAL_PRODUCTION_FIX | ${input.summary.REAL_PRODUCTION_FIX} |
| FORMATTING_ONLY | ${input.summary.FORMATTING_ONLY} |
| PUBLIC_SOURCE_HAS_NO_FIELD | ${input.summary.PUBLIC_SOURCE_HAS_NO_FIELD} |
| DIFFERENT_EVENT_CONTEXT | ${input.summary.DIFFERENT_EVENT_CONTEXT} |
| IMPORTER_UNSUPPORTED | ${input.summary.IMPORTER_UNSUPPORTED} |
| REVIEW_REQUIRED | ${input.summary.REVIEW_REQUIRED} |

**Preview proposals reviewed:** ${Object.values(input.summary).reduce((a, b) => a + b, 0)}

## Final controlled batch

- **Approved for batch preview:** ${input.batchPreview.totalProposedChanges} changes
- **Affected events:** ${input.batchPreview.affectedEvents}
- **HIGH risk (manual approval required):** ${input.batchPreview.highRiskCount}

## Elevated findings (missed by Phase 4.8.2 preview)

${input.elevated.length === 0 ? '_None_' : input.elevated.map((e) => `- **${e.title}** (\`${e.eventId}\`) — ${e.field}: ${e.note}`).join('\n')}

## Key human-review examples

### Bootshaus Sommerfest description
${sommerfestDesc ? `**REAL_PRODUCTION_FIX (HIGH)** — replaces Underland contamination with official Bootshaus Sommerfest page text.\n\n- Before: \`${String(sommerfestDesc.currentProductionValue).slice(0, 80)}…\`\n- After: \`${sommerfestDesc.proposedValue}\`` : '_Elevated from field comparison — see `_phase4821_real_production_fixes.json`_'}

### Bootshaus og:title suffix proposals
All \`| Bootshaus Club\` title suffix proposals classified **FORMATTING_ONLY** — consumer title already correct; do not apply.

### Description whitespace proposals
Legacy HTML spacing / \`&nbsp;\` normalization only — **FORMATTING_ONLY** — excluded from batch.

## HIGH risk changes

${highRisk.length === 0 ? '_None in final batch_' : highRisk.map((f) => `- **${f.eventTitle}** / ${f.field} — ${f.consumerImpact}`).join('\n')}

## Rollback strategy

${input.batchPreview.rollbackStrategy.map((s) => `- ${s}`).join('\n')}

## Proof of zero production mutations

\`productionMutationsInThisRun: 0\` in all Phase 4.8.2.1 artifacts.

---

*No production batch executed. No canonical writes. No cache invalidation.*
`;
}

function runFull() {
  verifyNoWrite();

  const proposals = loadPreview();
  const classified = classifyAllProposals(proposals);
  const summary = summarizeClassifications(classified);

  const fieldComparison = JSON.parse(readFileSync(FIELD_COMPARISON_PATH, 'utf8')) as {
    items: Array<{
      eventId: string;
      title: string;
      field: string;
      status: string;
      publicTruth?: unknown;
      unified?: unknown;
      canonical?: unknown;
    }>;
  };
  const elevated = elevateMissedProductionFixes(fieldComparison.items);

  const previewRealFixes = classified
    .map((item) => toRealProductionFix(item))
    .filter((item): item is RealProductionFix => item !== null);

  const elevatedRealFixes: RealProductionFix[] = elevated.map((e) => ({
    eventId: e.eventId,
    eventTitle: e.title,
    field: e.field,
    currentProductionValue: e.currentCanonical,
    proposedValue: e.proposedValue,
    publicSourceEvidence: e.publicEvidence,
    sourceRole: 'official_website_source',
    whyProductionWrong: e.note,
    whyUnifiedCorrect: 'Unified importer matches live public official page body.',
    consumerImpact: 'Replaces wrong or stale description visible on event detail.',
    confidence: 0.9,
    risk: 'HIGH' as const,
    rollbackImpact: 'Restore description from pre-batch snapshot.',
  }));

  const realFixes = [...previewRealFixes, ...elevatedRealFixes];
  const rejected = classified.filter((c) => c.classification !== 'REAL_PRODUCTION_FIX');
  const batchPreview = buildBatchPreview(realFixes);
  const reviewPackage = buildReviewPackage({
    classified,
    elevated,
    realFixes,
    rejected,
    summary,
  });

  writeJson('_phase4821_review_package.json', reviewPackage);
  writeJson('_phase4821_real_production_fixes.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    count: realFixes.length,
    items: realFixes,
  });
  writeJson('_phase4821_rejected_proposals.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    count: rejected.length,
    summary: summarizeClassifications(rejected),
    items: rejected.map((item) => ({
      eventId: item.proposal.eventId,
      title: item.proposal.title,
      field: item.proposal.field,
      classification: item.classification,
      classificationReason: item.classificationReason,
      currentCanonical: item.proposal.currentCanonical,
      proposedValue: item.proposal.proposedValue,
    })),
  });
  writeJson('_phase4821_batch_preview.json', batchPreview);

  const md = buildMarkdown({ summary, realFixes, rejected, elevated, batchPreview });
  writeFileSync(join(ROOT, 'docs/PHASE_4821_CONTROLLED_BATCH_REVIEW.md'), md, 'utf8');

  console.log(
    JSON.stringify(
      {
        productionMutationsInThisRun,
        totalProposals: proposals.length,
        classificationSummary: summary,
        realProductionFixCount: realFixes.length,
        finalBatchSize: batchPreview.totalProposedChanges,
        highRiskCount: batchPreview.highRiskCount,
      },
      null,
      2,
    ),
  );
}

const command = process.argv[2] ?? 'full';
const commands: Record<string, () => void> = {
  'verify-no-write': verifyNoWrite,
  full: runFull,
};

const run = commands[command];
if (!run) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
run();
