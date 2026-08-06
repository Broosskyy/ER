/**
 * Phase 4.8.1 — Unified Import Contract & Parallel Connector Modernization.
 * STAGING ONLY — no production writes, no cache invalidation, no connector replacement.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase481-unified-import-contract.ts <command>
 *
 * Commands: contract | inventory-pilots | run-bootshaus | run-ticketio | run-ticketkings
 *   | run-nachtmanager | match | compare-legacy | compare-ground-truth | migration-preview
 *   | report | full
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import {
  IMPORT_CHANNEL_POLICIES,
  PHASE481_FIELD_DECISION_RULES,
  SHARED_IMPORT_PLATFORM_COMPONENTS,
  UNIFIED_IMPORT_CONTRACT_VERSION,
  type FieldEvidenceCandidate,
  type UnifiedImportResult,
} from '@/features/import/contracts';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { runBootshausWebsitePilotForEvent, runBootshausWebsitePilotAll } from '@/features/import/pilots/bootshaus-website-pilot';
import {
  detectCrossEventContamination,
  matchIdentityCandidatesToGoldStandard,
} from '@/features/import/pilots/identity-matching-pilot';
import { runNachtManagerPilotForEvent, runNachtManagerPilotAll } from '@/features/import/pilots/nacht-manager-pilot';
import { GOLD_STANDARD_REFERENCE_EVENTS } from '@/features/import/pilots/gold-standard-reference';
import { runTicketIoPilotForEvent, runTicketIoPilotAll } from '@/features/import/pilots/ticket-io-pilot';
import { runTicketKingsPilotForEvent, runTicketKingsPilotAll } from '@/features/import/pilots/ticket-kings-pilot';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const PHASE480_GROUND_TRUTH = join(OUT, '_phase480_ground_truth.json');

let productionMutationsInThisRun = 0;
let pilotResultsCache: UnifiedImportResult[] = [];

const COMPARISON_FIELDS = [
  'title',
  'description',
  'venue',
  'ticketUrl',
  'price',
  'availability',
  'soldOut',
  'genres',
  'lineup',
  'flyer',
] as const;

type ComparisonOutcome =
  | 'identical'
  | 'new_path_better'
  | 'legacy_path_better'
  | 'both_wrong'
  | 'public_evidence_missing'
  | 'third_party_blocked'
  | 'review_required';

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function normalizeCompare(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(normalizeCompare).join('|').toLowerCase();
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function valuesAlign(a: unknown, b: unknown): boolean {
  const na = normalizeCompare(a);
  const nb = normalizeCompare(b);
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

function extractPilotField(results: UnifiedImportResult[], eventId: string, field: string): unknown {
  const fieldAliases: Record<string, string[]> = {
    price: ['price', 'prices'],
    ticketUrl: ['ticket_destination', 'ticketUrl'],
    soldOut: ['sold_out', 'soldOut'],
    genres: ['genre', 'genres'],
    lineup: ['lineup', 'artists'],
    flyer: ['flyer', 'gallery'],
    venue: ['venue', 'location'],
  };
  const aliases = fieldAliases[field] ?? [field];
  for (const result of results) {
    const match = result.fieldEvidenceCandidates.find(
      (c) => c.eventIdentityMatch === eventId && aliases.includes(String(c.fieldName)),
    );
    if (match) return match.normalizedValue;
  }
  return undefined;
}

function extractGroundTruth(gtEvent: Record<string, unknown>, field: string): unknown {
  const groundTruth = gtEvent.groundTruth as Record<string, unknown> | undefined;
  if (!groundTruth) return undefined;
  const map: Record<string, string> = {
    price: 'prices',
    soldOut: 'soldOut',
    lineup: 'lineup',
    genres: 'genres',
    flyer: 'flyer',
    ticketUrl: 'ticketUrl',
    availability: 'availability',
    venue: 'venue',
    description: 'description',
    title: 'title',
  };
  return groundTruth[map[field] ?? field];
}

async function loadLegacyCandidate(eventId: string, title: string): Promise<Record<string, unknown>> {
  const byCanonical = await opsClient()
    .from('import_records')
    .select('*')
    .eq('canonical_event_id', eventId);
  const records = (byCanonical.data ?? []) as ImportRecord[];
  if (records.length === 0) {
    return {};
  }
  const primary = records[0];
  const candidate = getEffectiveCandidate({
    ...primary,
    sourceId: primary.sourceId ?? String((primary as { source_id?: string }).source_id ?? ''),
    importJobId: primary.importJobId ?? String((primary as { import_job_id?: string }).import_job_id ?? ''),
    externalId: primary.externalId ?? String((primary as { external_id?: string }).external_id ?? ''),
  } as ImportRecord);
  return {
    title: candidate.title,
    description: candidate.description,
    venue: candidate.venueName,
    ticketUrl: candidate.ticketUrl,
    price: candidate.priceText,
    genres: candidate.genres,
    lineup: candidate.artistNames,
  };
}

async function loadDbEvent(eventId: string) {
  const { data } = await opsClient().from('events').select('*').eq('id', eventId).single();
  if (!data) return null;
  const admin = mapEventRowToAdminRecord(data as EventRow);
  return {
    title: admin.title,
    description: admin.description,
    venue: admin.venueName,
    ticketUrl: admin.ticketUrl,
    price: admin.priceText,
    genres: admin.genreLabels,
  };
}

function compareField(
  field: string,
  groundTruth: unknown,
  legacy: unknown,
  pilot: unknown,
  blocked: boolean,
): { outcome: ComparisonOutcome; note: string } {
  if (blocked && ['price', 'availability', 'soldOut'].includes(field)) {
    return { outcome: 'third_party_blocked', note: 'Third-party platform blocks public observation' };
  }
  if (!normalizeCompare(groundTruth)) {
    if (normalizeCompare(legacy) || normalizeCompare(pilot)) {
      return { outcome: 'public_evidence_missing', note: 'No public ground truth for automated comparison' };
    }
    return { outcome: 'identical', note: 'No ground truth and no system values' };
  }
  const legacyOk = valuesAlign(groundTruth, legacy);
  const pilotOk = valuesAlign(groundTruth, pilot);
  if (legacyOk && pilotOk) return { outcome: 'identical', note: 'Legacy and pilot align with ground truth' };
  if (pilotOk && !legacyOk) return { outcome: 'new_path_better', note: 'Pilot matches ground truth; legacy diverges' };
  if (legacyOk && !pilotOk) return { outcome: 'legacy_path_better', note: 'Legacy matches ground truth; pilot diverges' };
  if (!legacyOk && !pilotOk) return { outcome: 'both_wrong', note: 'Neither path matches ground truth' };
  return { outcome: 'review_required', note: 'Partial alignment requires review' };
}

function writeContractArtifacts(): void {
  writeJson('_phase481_import_contract.json', {
    generatedAt: new Date().toISOString(),
    contractVersion: UNIFIED_IMPORT_CONTRACT_VERSION,
    stagingOnly: true,
    productionMutationsInThisRun,
    topLevelShape: [
      'sourceIdentity',
      'importRunIdentity',
      'rawEvidenceReferences',
      'eventIdentityCandidates',
      'fieldEvidenceCandidates',
      'lineupEvidenceEntries',
      'relationshipCandidates',
      'reviewFindings',
      'extractionDiagnostics',
      'completeness',
      'confidence',
      'importerVersion',
    ],
    supportedDomains: [
      'identity', 'title', 'subtitle', 'date_time', 'venue', 'location', 'organizer', 'promoter',
      'genre', 'description', 'flyer', 'gallery', 'lineup', 'artists', 'ticket_destination',
      'checkout', 'price', 'ticket_phases', 'availability', 'sold_out', 'event_attributes',
    ],
    rules: ['Importers never write canonical data directly', 'All candidates require provenance'],
  });

  writeJson('_phase481_evidence_contract.json', {
    generatedAt: new Date().toISOString(),
    requiredCandidateFields: [
      'fieldName', 'rawValue', 'normalizedValue', 'sourceId', 'sourceRole', 'originUrl',
      'evidenceType', 'extractionStrategy', 'observedAt', 'importerVersion', 'confidence',
      'reliability', 'reviewState', 'inclusionReason',
    ],
    evidenceTypes: [
      'official_event_page', 'ticket_platform_event_page', 'ticket_shop_list_row', 'checkout',
      'json_ld', 'embedded_json', 'html_text', 'flyer', 'manual_admin_evidence',
      'inferred_candidate', 'legacy_compatibility_evidence',
    ],
    explicitBeatsInferred: true,
  });

  writeJson('_phase481_field_decision_matrix.json', {
    generatedAt: new Date().toISOString(),
    rules: PHASE481_FIELD_DECISION_RULES,
    mergeEngineOwnsTruth: true,
  });

  writeJson('_phase481_identity_matching.json', {
    generatedAt: new Date().toISOString(),
    signals: [
      'exact_external_id', 'event_specific_url', 'official_website_url', 'ticket_kings_slug',
      'ticket_io_slug', 'ticket_url_match', 'title_date_venue', 'organizer_relationship', 'checkout_id',
    ],
    rules: [
      'No artist-only matching',
      'No source-level default URL/venue/organizer contamination across events',
    ],
  });
}

function inventoryLegacyViolations(): Array<{ code: string; description: string; location: string }> {
  return [
    {
      code: 'CONNECTOR_NORMALIZED_FLAT',
      description: 'ConnectorNormalizedOutput mixes fields without per-field evidence candidates',
      location: 'src/features/aggregation/domain/connector-normalized-contract.ts',
    },
    {
      code: 'MERGE_IN_IMPORT_STEP',
      description: 'PriorityBasedMergeStrategy runs pre-publish without unified evidence contract',
      location: 'src/features/aggregation/pipeline/steps/merge-step.ts',
    },
    {
      code: 'NO_EVIDENCE_TIER',
      description: 'Legacy ticket-io adapter does not distinguish list vs detail vs checkout tiers uniformly',
      location: 'src/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter.ts',
    },
    {
      code: 'TK_CHECKOUT_AS_CTA',
      description: 'Historical paths could prefer Nacht-Manager URL over Ticket Kings event page',
      location: 'src/features/events/domain/canonical-ticket-read.ts',
    },
    {
      code: 'AUDIT_SCORE_FIRST',
      description: 'Phase 4.7 audits scored projection without mandatory public ground truth fetch',
      location: 'scripts/operations/_phase4751-global-production-truth-audit.ts',
    },
    {
      code: 'AFFENKAEFIG_TK_ASSUMPTION',
      description: 'Affenkäfig source must not imply Ticket Kings — destination host determines platform',
      location: 'source registry / merge assumptions',
    },
  ];
}

async function runAllPilots(): Promise<UnifiedImportResult[]> {
  const bootshaus = await runBootshausWebsitePilotAll();
  const ticketIo = await runTicketIoPilotAll();
  const ticketKings = await runTicketKingsPilotAll();
  const nachtManager = await runNachtManagerPilotAll();
  pilotResultsCache = [...bootshaus, ...ticketIo, ...ticketKings, ...nachtManager];
  writeJson('_phase481_pilot_import_results.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    stagingOnly: true,
    resultCount: pilotResultsCache.length,
    byImporter: {
      bootshaus: bootshaus.length,
      ticketIo: ticketIo.length,
      ticketKings: ticketKings.length,
      nachtManager: nachtManager.length,
    },
    results: pilotResultsCache,
  });
  return pilotResultsCache;
}

async function runIdentityMatch(pilots: UnifiedImportResult[]) {
  const allCandidates = pilots.flatMap((p) => p.eventIdentityCandidates);
  const matches = matchIdentityCandidatesToGoldStandard(allCandidates, pilots);
  const contamination = detectCrossEventContamination(pilots);
  writeJson('_phase481_identity_matching.json', {
    generatedAt: new Date().toISOString(),
    matches,
    contamination,
    duplicateHandling: 'Each gold-standard event maps to one canonical identity',
  });
  return { matches, contamination };
}

async function compareLegacy(pilots: UnifiedImportResult[]) {
  const comparisons = [];
  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS) {
    const legacy = await loadLegacyCandidate(ref.eventId, ref.label);
    const db = await loadDbEvent(ref.eventId);
    const fields = COMPARISON_FIELDS.map((field) => {
      const pilotVal = extractPilotField(pilots, ref.eventId, field);
      const legacyVal = legacy[field];
      return {
        field,
        legacy: legacyVal,
        database: db?.[field as keyof typeof db],
        pilot: pilotVal,
      };
    });
    comparisons.push({ eventKey: ref.key, eventId: ref.eventId, label: ref.label, fields });
  }
  writeJson('_phase481_legacy_new_comparison.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    comparisons,
  });
  return comparisons;
}

async function compareGroundTruth(pilots: UnifiedImportResult[]) {
  if (!existsSync(PHASE480_GROUND_TRUTH)) {
    throw new Error('Missing Phase 4.8.0 ground truth — run phase480 full first');
  }
  const gt = JSON.parse(readFileSync(PHASE480_GROUND_TRUTH, 'utf8')) as {
    events: Array<Record<string, unknown>>;
  };

  const comparisons = [];
  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS) {
    const gtEvent = gt.events.find((e) => e.eventKey === ref.key);
    const blocked = Boolean(
      (gtEvent?.sources as { ticketPlatform?: { blockedByPow?: boolean } })?.ticketPlatform?.blockedByPow,
    );
    const legacy = await loadLegacyCandidate(ref.eventId, ref.label);
    const fieldRows = COMPARISON_FIELDS.map((field) => {
      const groundTruth = gtEvent ? extractGroundTruth(gtEvent, field) : undefined;
      const legacyVal = legacy[field];
      const pilotVal = extractPilotField(pilots, ref.eventId, field);
      const { outcome, note } = compareField(field, groundTruth, legacyVal, pilotVal, blocked);
      const pilotEvidence = pilots
        .flatMap((p) => p.fieldEvidenceCandidates)
        .find((c) => c.eventIdentityMatch === ref.eventId && c.fieldName.includes(field.replace('price', 'price')));
      return {
        field,
        groundTruth,
        legacy: legacyVal,
        pilot: pilotVal,
        outcome,
        note,
        evidence: pilotEvidence
          ? {
              originUrl: pilotEvidence.originUrl,
              evidenceType: pilotEvidence.evidenceType,
              strategy: pilotEvidence.extractionStrategy,
              inclusionReason: pilotEvidence.inclusionReason,
            }
          : null,
      };
    });
    comparisons.push({
      eventKey: ref.key,
      eventId: ref.eventId,
      label: ref.label,
      fields: fieldRows,
      summary: {
        identical: fieldRows.filter((f) => f.outcome === 'identical').length,
        newPathBetter: fieldRows.filter((f) => f.outcome === 'new_path_better').length,
        legacyBetter: fieldRows.filter((f) => f.outcome === 'legacy_path_better').length,
        bothWrong: fieldRows.filter((f) => f.outcome === 'both_wrong').length,
        thirdPartyBlocked: fieldRows.filter((f) => f.outcome === 'third_party_blocked').length,
      },
    });
  }

  writeJson('_phase481_ground_truth_comparison.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    comparisons,
  });
  return comparisons;
}

function migrationPreview(): void {
  writeJson('_phase481_migration_readiness.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    stagingOnly: true,
    strategy: [
      '1. Run legacy and new importer in parallel',
      '2. Compare against Ground Truth',
      '3. Approve one Source/version',
      '4. Shadow production',
      '5. Publish controlled candidate batch',
      '6. Verify idempotency',
      '7. Activate scheduling',
      '8. Retain rollback to legacy version',
    ],
    legacyPathStatus: 'active',
    newPathStatus: 'staging_pilot_only',
    connectorRecommendations: {
      'club_website': 'migrate_after_shadow_validation',
      'ticket_platform_ticket_io': 'migrate_after_shadow_validation',
      'ticket_platform_ticket_kings': 'migrate_after_shadow_validation',
      'nacht_manager_supplementary': 'migrate_as_evidence_tier_not_connector',
      'legacy_import_orchestrator': 'keep_temporarily',
      'audit_score_only': 'replace_after_ground_truth_harness',
    },
    approvalRequired: 'Per-source shadow validation sign-off before production scheduling switch',
  });
}

function writeMarkdownReports(
  legacyViolations: ReturnType<typeof inventoryLegacyViolations>,
  identity: Awaited<ReturnType<typeof runIdentityMatch>>,
  gtComparison: Awaited<ReturnType<typeof compareGroundTruth>>,
): void {
  writeFileSync(
    join(ROOT, 'docs/PHASE_481_UNIFIED_IMPORT_CONTRACT.md'),
    `# Phase 4.8.1 — Unified Import Contract & Parallel Connector Modernization

**Status:** Complete (staging-only)  
**Generated:** ${new Date().toISOString()}  
**Production mutations:** ${productionMutationsInThisRun}

## Goal

One unified Import and Evidence contract for all Sources. Legacy path remains active.
New pilot importers run in parallel against Gold Standard events — no production writes.

## Deliverables

See \`docs/ARCHITECTURE_*.md\` and \`docs/real-data/_phase481_*.json\`.

## Pilot ecosystems

1. Bootshaus official Website
2. Ticket.io
3. Ticket Kings public event pages
4. Nacht-Manager supplementary checkout only

## Gold Standard comparison summary

${gtComparison
  .map(
    (c) =>
      `- **${c.label}:** identical=${c.summary.identical} newBetter=${c.summary.newPathBetter} legacyBetter=${c.summary.legacyBetter} blocked=${c.summary.thirdPartyBlocked}`,
  )
  .join('\n')}

## Identity matching

- ${identity.matches.length} gold-standard identity matches
- Cross-event contamination issues: ${identity.contamination.length}

## Legacy contract violations

${legacyViolations.map((v) => `- **${v.code}:** ${v.description}`).join('\n')}

## Connector recommendations

| Legacy connector | Recommendation |
|------------------|----------------|
| club_website (Bootshaus) | migrate after shadow validation |
| ticket-io adapter | migrate after shadow validation |
| ticket-kings adapter | migrate after shadow validation |
| Nacht-Manager enrichment | migrate as evidence tier, not primary connector |
| ImportOrchestrator (legacy adapters) | keep temporarily |
| Score-first audit scripts | replace after ground-truth harness adoption |

## Next approval required

Per-source **shadow validation sign-off** before switching production scheduling to unified-contract importers.

Do **not** onboard new external Sources until Phase 4.8.1 review is approved.
`,
  );

  writeFileSync(
    join(ROOT, 'docs/ARCHITECTURE_IMPORT_CONTRACT.md'),
    `# Architecture — Unified Import Contract

Version: \`${UNIFIED_IMPORT_CONTRACT_VERSION}\`

Every importer returns \`UnifiedImportResult\` with source identity, import run identity,
raw evidence references, identity candidates, field evidence candidates, relationships,
review findings, diagnostics, completeness, confidence, and importer version.

**Importers never write canonical data directly.**

Channels: \`manual_admin_import\`, \`automatic_source_import\`, \`ai_assisted_import\` (future).

See \`src/features/import/contracts/unified-import-result.ts\`.
`,
  );

  writeFileSync(
    join(ROOT, 'docs/ARCHITECTURE_EVIDENCE_CONTRACT.md'),
    `# Architecture — Evidence Contract

Every \`FieldEvidenceCandidate\` includes field name, raw/normalized values, source,
origin URL, evidence type, extraction strategy, timestamps, confidence, reliability,
identity match, review state, inclusion/rejection reasons.

Evidence types distinguish official pages, ticket platforms, list rows, checkout,
JSON-LD, HTML, flyer, manual admin, inferred, and legacy compatibility.

**Inferred candidates never silently outrank explicit public evidence.**

See \`src/features/import/contracts/field-evidence-candidate.ts\`.
`,
  );

  writeFileSync(
    join(ROOT, 'docs/ARCHITECTURE_SOURCE_ROLE_SEPARATION.md'),
    `# Architecture — Source Role Separation

Independent roles: organizer, promoter, official website source, ticket platform,
checkout provider, venue, discovery source.

- Bootshaus → organizer / promoter / official website
- Ticket.io → ticket platform
- Ticket Kings → public event / ticket platform
- Nacht-Manager → checkout and price-phase evidence only
- Affenkäfig does **not** imply Ticket Kings — destination host determines platform
`,
  );

  writeFileSync(
    join(ROOT, 'docs/ARCHITECTURE_IMPORT_CHANNEL_ISOLATION.md'),
    `# Architecture — Import Channel Isolation

Shared: ${SHARED_IMPORT_PLATFORM_COMPONENTS.join(', ')}

Isolated per channel: raw job identity, scheduling, retry policy, channel provenance.

Policies:
${IMPORT_CHANNEL_POLICIES.map((p) => `- **${p.channel}:** pause-affected=${p.affectedBySourcePause}, overwrite-manual=${p.mayOverwriteApprovedManualCorrections}`).join('\n')}
`,
  );

  writeFileSync(
    join(ROOT, 'docs/ARCHITECTURE_PARALLEL_CONNECTOR_MIGRATION.md'),
    `# Architecture — Parallel Connector Migration

1. Legacy path remains active in production
2. New unified-contract pilots run staging-only
3. Compare legacy vs pilot vs Phase 4.8.0 ground truth
4. Per-source shadow validation before scheduling switch
5. Rollback to legacy connector version retained

No production Event writes, no cache invalidation, no global merge changes in Phase 4.8.1.
`,
  );
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'full';
  console.log(`Phase 4.8.1 unified import contract — ${command} (staging-only)`);

  if (command === 'contract') {
    writeContractArtifacts();
    return;
  }

  if (command === 'inventory-pilots') {
    writeJson('_phase481_pilot_inventory.json', {
      generatedAt: new Date().toISOString(),
      pilots: [
        { key: 'bootshaus-website', module: 'src/features/import/pilots/bootshaus-website-pilot.ts' },
        { key: 'ticket-io', module: 'src/features/import/pilots/ticket-io-pilot.ts' },
        { key: 'ticket-kings', module: 'src/features/import/pilots/ticket-kings-pilot.ts' },
        { key: 'nacht-manager', module: 'src/features/import/pilots/nacht-manager-pilot.ts' },
      ],
      goldStandardEvents: GOLD_STANDARD_REFERENCE_EVENTS,
      legacyViolations: inventoryLegacyViolations(),
    });
    return;
  }

  if (command === 'run-bootshaus') {
    const key = process.argv[3];
    if (key) {
      console.log(JSON.stringify(await runBootshausWebsitePilotForEvent(key), null, 2));
    } else {
      console.log(`Bootshaus pilots: ${(await runBootshausWebsitePilotAll()).length}`);
    }
    return;
  }

  if (command === 'run-ticketio') {
    const key = process.argv[3];
    if (key) {
      console.log(JSON.stringify(await runTicketIoPilotForEvent(key), null, 2));
    } else {
      console.log(`Ticket.io pilots: ${(await runTicketIoPilotAll()).length}`);
    }
    return;
  }

  if (command === 'run-ticketkings') {
    const key = process.argv[3];
    if (key) {
      console.log(JSON.stringify(await runTicketKingsPilotForEvent(key), null, 2));
    } else {
      console.log(`Ticket Kings pilots: ${(await runTicketKingsPilotAll()).length}`);
    }
    return;
  }

  if (command === 'run-nachtmanager') {
    const key = process.argv[3];
    if (key) {
      console.log(JSON.stringify(await runNachtManagerPilotForEvent(key), null, 2));
    } else {
      console.log(`Nacht-Manager pilots: ${(await runNachtManagerPilotAll()).length}`);
    }
    return;
  }

  if (command === 'match') {
    const pilots = pilotResultsCache.length ? pilotResultsCache : await runAllPilots();
    await runIdentityMatch(pilots);
    return;
  }

  if (command === 'compare-legacy') {
    const pilots = pilotResultsCache.length ? pilotResultsCache : await runAllPilots();
    await compareLegacy(pilots);
    return;
  }

  if (command === 'compare-ground-truth') {
    const pilots = pilotResultsCache.length ? pilotResultsCache : await runAllPilots();
    await compareGroundTruth(pilots);
    return;
  }

  if (command === 'migration-preview') {
    migrationPreview();
    return;
  }

  if (command === 'report') {
    const pilots = pilotResultsCache.length ? pilotResultsCache : await runAllPilots();
    const identity = await runIdentityMatch(pilots);
    const gt = await compareGroundTruth(pilots);
    writeMarkdownReports(inventoryLegacyViolations(), identity, gt);
    console.log('Markdown reports written');
    return;
  }

  if (command === 'full') {
    writeContractArtifacts();
    const violations = inventoryLegacyViolations();
    const pilots = await runAllPilots();
    const identity = await runIdentityMatch(pilots);
    await compareLegacy(pilots);
    const gt = await compareGroundTruth(pilots);
    migrationPreview();
    writeMarkdownReports(violations, identity, gt);
    console.log(`Done. productionMutationsInThisRun=${productionMutationsInThisRun}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
