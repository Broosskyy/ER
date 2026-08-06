/**
 * Phase 4.8.2.2 — Official Website Controlled Production Batch.
 *
 * Applies exactly the 3 evidence-backed corrections from Phase 4.8.2.1.
 * Does NOT activate importer scheduling or replace the legacy importer.
 *
 * Usage:
 *   node --import tsx scripts/operations/_phase4822-official-website-controlled-batch.ts preflight
 *   node --import tsx scripts/operations/_phase4822-official-website-controlled-batch.ts backup
 *   node --import tsx scripts/operations/_phase4822-official-website-controlled-batch.ts repair --apply
 *   node --import tsx scripts/operations/_phase4822-official-website-controlled-batch.ts verify-consumer
 *   node --import tsx scripts/operations/_phase4822-official-website-controlled-batch.ts verify-idempotency --apply
 *   node --import tsx scripts/operations/_phase4822-official-website-controlled-batch.ts report
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { adminSourceRepository } from '@/data/repositories/registry';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import { multiSourceRepositories } from '@/data/repositories/registry';
import { extractOfficialWebsitePublicTruth } from '@/features/import/shadow/official-website-public-truth';
import {
  applyRepairMutations,
  buildEventBackup,
  buildForbiddenFingerprint,
  buildPreflightReport,
  CONFUSABLE_SOMMERFEST_IDS,
  ELEKTROKUECHE_EVENT_ID,
  hashFingerprint,
  loadApprovedBatchPreview,
  OFFICIAL_EVENT_URLS,
  planRepairMutations,
  projectConsumerEvent,
  R3HAB_EVENT_ID,
  SOMMERFEST_EVENT_ID,
  verifyApprovedCandidateSet,
  verifyConsumerProjection,
  type PreflightProposalReport,
  type RepairMutation,
} from '@/features/import/shadow/phase4822-controlled-batch';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient, updateEventRow } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const REPORT = join(ROOT, 'docs/PHASE_4822_OFFICIAL_WEBSITE_CONTROLLED_BATCH.md');

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

const APPLY = process.argv.includes('--apply');
const command = process.argv[2] ?? 'help';

type RepairRunRecord = {
  pass: number;
  command: string;
  generatedAt: string;
  apply: boolean;
  mutations: RepairMutation[];
  skipped: RepairMutation[];
  aborted: boolean;
  abortReason?: string;
};

const repairRuns: RepairRunRecord[] = [];
let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(OUT, name), 'utf8')) as T;
}

async function invalidateCaches(): Promise<void> {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  await invalidateConsumerEventCaches(registry.eventRepository);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function loadEvent(eventId: string): Promise<AdminEventRecord | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapEventRowToAdminRecord(data as EventRow) : null;
}

async function loadProvenanceMap(eventId: string): Promise<Record<string, unknown>> {
  const rows = await multiSourceRepositories.fieldProvenance.findByCanonicalEventId(eventId);
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.fieldPath] = row;
  }
  return map;
}

async function loadConfusableEvents(): Promise<AdminEventRecord[]> {
  const ids = [ELEKTROKUECHE_EVENT_ID, ...CONFUSABLE_SOMMERFEST_IDS];
  const events: AdminEventRecord[] = [];
  for (const id of ids) {
    const event = await loadEvent(id);
    if (event) {
      events.push(event);
    }
  }
  return events;
}

async function runPreflight(): Promise<{
  ok: boolean;
  proposals: PreflightProposalReport[];
  candidateVerification: ReturnType<typeof verifyApprovedCandidateSet>;
}> {
  const preview = loadApprovedBatchPreview(ROOT);
  const candidateVerification = verifyApprovedCandidateSet(preview);
  if (!candidateVerification.ok) {
    return { ok: false, proposals: [], candidateVerification };
  }

  const confusableEvents = await loadConfusableEvents();
  const reports: PreflightProposalReport[] = [];

  for (const proposal of preview.proposals) {
    const event = await loadEvent(proposal.eventId);
    if (!event) {
      reports.push({
        eventId: proposal.eventId,
        eventTitle: proposal.eventTitle,
        officialPublicEventUrl: OFFICIAL_EVENT_URLS[proposal.eventId] ?? '',
        currentPublicEvidence: '',
        evidenceCaptureTimestamp: new Date().toISOString(),
        currentCanonicalProductionValue: '',
        proposedValue: proposal.proposedValue,
        currentApiProjectionValue: '',
        expectedConsumerVisibleResult: proposal.proposedValue,
        confidence: proposal.confidence,
        risk: proposal.risk,
        field: proposal.field,
        identityChecks: {
          exactEventId: false,
          officialUrlMatches: false,
          notConfusableEvent: false,
          evidenceSupportsProposal: false,
          productionUnchangedSinceReview: false,
        },
        aborted: true,
        abortReason: 'Event not found in production',
      });
      continue;
    }

    const officialUrl = OFFICIAL_EVENT_URLS[proposal.eventId] ?? '';
    const html = await fetchHtml(officialUrl);
    const capturedAt = new Date().toISOString();
    const publicTruth = extractOfficialWebsitePublicTruth(html, officialUrl);
    reports.push(
      buildPreflightReport({
        proposal,
        event,
        publicTruth,
        officialUrl,
        evidenceCapturedAt: capturedAt,
        confusableEvents,
      }),
    );
  }

  const identityNote = {
    sommerfestNotElektrokueche: reports
      .filter((r) => r.eventId === SOMMERFEST_EVENT_ID)
      .every((r) => r.identityChecks.notConfusableEvent),
    sommerfestEventId: SOMMERFEST_EVENT_ID,
    elektrokuecheEventId: ELEKTROKUECHE_EVENT_ID,
    r3habEventSpecificImage: reports
      .filter((r) => r.eventId === R3HAB_EVENT_ID && r.field === 'flyer')
      .every((r) => r.identityChecks.evidenceSupportsProposal),
  };

  const ok = candidateVerification.ok && reports.every((r) => !r.aborted);
  writeJson('_phase4822_final_preflight.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.2',
    productionMutationsInThisRun,
    candidateVerification,
    identityNote,
    proposals: reports,
    aborted: !ok,
  });
  return { ok, proposals: reports, candidateVerification };
}

async function runBackup(): Promise<void> {
  const preview = loadApprovedBatchPreview(ROOT);
  const eventIds = [...new Set(preview.proposals.map((p) => p.eventId))];
  const events: Record<string, ReturnType<typeof buildEventBackup>> = {};
  const forbidden: Record<string, { fingerprint: ReturnType<typeof buildForbiddenFingerprint>; hash: string }> = {};

  for (const eventId of eventIds) {
    const event = await loadEvent(eventId);
    if (!event) {
      throw new Error(`Missing event for backup: ${eventId}`);
    }
    const provenance = await loadProvenanceMap(eventId);
    events[eventId] = buildEventBackup(event, provenance);
    const fp = buildForbiddenFingerprint(event);
    forbidden[eventId] = { fingerprint: fp, hash: hashFingerprint(fp) };
  }

  writeJson('_phase4822_backup.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.2',
    productionMutationsInThisRun,
    events,
  });
  writeJson('_phase4822_forbidden_fingerprints.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.2',
    productionMutationsInThisRun,
    before: forbidden,
  });
}

async function runRepair(pass: number): Promise<RepairRunRecord> {
  if (!APPLY) {
    throw new Error('repair requires --apply');
  }
  if (!existsSync(join(OUT, '_phase4822_final_preflight.json'))) {
    throw new Error('Missing preflight artifact — run preflight first');
  }
  const preflight = readJson<{ aborted?: boolean }>('_phase4822_final_preflight.json');
  if (preflight.aborted) {
    throw new Error('Preflight aborted — repair blocked');
  }

  const preview = loadApprovedBatchPreview(ROOT);
  const events = new Map<string, AdminEventRecord>();
  for (const eventId of preview.affectedEventIds) {
    const event = await loadEvent(eventId);
    if (!event) {
      throw new Error(`Missing event: ${eventId}`);
    }
    events.set(eventId, event);
  }

  const { mutations, skipped } = planRepairMutations(preview.proposals, events);
  const source = await adminSourceRepository.getById('source-bootshaus-koeln');
  if (!source) {
    throw new Error('Bootshaus source missing');
  }
  const provenanceWriter = new EventFieldProvenanceWriter(multiSourceRepositories.fieldProvenance);

  const applied = await applyRepairMutations({
    mutations,
    events,
    source,
    provenanceWriter,
    updateEvent: async (eventId, patch) => {
      await updateEventRow(eventId, patch);
      productionMutationsInThisRun += Object.keys(patch).length;
    },
  });

  if (applied.length > 0) {
    await invalidateCaches();
  }

  const run: RepairRunRecord = {
    pass,
    command: 'repair',
    generatedAt: new Date().toISOString(),
    apply: true,
    mutations: applied,
    skipped,
    aborted: false,
  };
  repairRuns.push(run);
  appendRepairRuns();
  return run;
}

function appendRepairRuns(): void {
  const existing = existsSync(join(OUT, '_phase4822_repair_runs.json'))
    ? readJson<{ runs: RepairRunRecord[] }>('_phase4822_repair_runs.json').runs
    : [];
  writeJson('_phase4822_repair_runs.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.2',
    productionMutationsInThisRun,
    runs: [...existing, ...repairRuns],
  });
}

async function runVerifyConsumer(): Promise<void> {
  const preview = loadApprovedBatchPreview(ROOT);
  const backup = existsSync(join(OUT, '_phase4822_backup.json'))
    ? readJson<{ events: Record<string, ReturnType<typeof buildEventBackup>> }>('_phase4822_backup.json')
    : null;
  const forbiddenBefore = existsSync(join(OUT, '_phase4822_forbidden_fingerprints.json'))
    ? readJson<{ before: Record<string, { hash: string }> }>('_phase4822_forbidden_fingerprints.json').before
    : {};

  const results = [];
  const forbiddenAfter: Record<string, { hash: string; unchanged: boolean }> = {};
  const beforeAfter: Record<string, unknown> = {};

  for (const eventId of preview.affectedEventIds) {
    const event = await loadEvent(eventId);
    if (!event) {
      throw new Error(`Missing event: ${eventId}`);
    }
    const verification = verifyConsumerProjection(event, preview.proposals);
    const projection = projectConsumerEvent(event);
    results.push({
      ...verification,
      db: {
        description: event.description,
        image_url: event.imageUrl,
        flyer_url: event.flyerUrl,
        title: event.title,
        startDate: event.startDate,
        venueName: event.venueName,
        ticketUrl: event.ticketUrl,
      },
      apiProjection: projection,
    });

    const fp = buildForbiddenFingerprint(event);
    const hash = hashFingerprint(fp);
    forbiddenAfter[eventId] = {
      hash,
      unchanged: forbiddenBefore[eventId]?.hash === hash,
    };

    if (backup?.events[eventId]) {
      beforeAfter[eventId] = {
        description: {
          before: backup.events[eventId].description,
          after: event.description,
        },
        image_url: {
          before: backup.events[eventId].image_url,
          after: event.imageUrl,
        },
        flyer_url: {
          before: backup.events[eventId].flyer_url,
          after: event.flyerUrl,
        },
      };
    }
  }

  writeJson('_phase4822_consumer_verification.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.2',
    productionMutationsInThisRun,
    events: results,
    forbiddenFingerprintsAfter: forbiddenAfter,
    allForbiddenUnchanged: Object.values(forbiddenAfter).every((entry) => entry.unchanged),
  });
  writeJson('_phase4822_before_after.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.2.2',
    productionMutationsInThisRun,
    events: beforeAfter,
  });
}

async function runVerifyIdempotency(): Promise<void> {
  const run = await runRepair(2);
  if (run.mutations.length !== 0) {
    throw new Error(`Idempotency failed: pass 2 applied ${run.mutations.length} mutations`);
  }
}

async function runReport(): Promise<void> {
  const preview = loadApprovedBatchPreview(ROOT);
  const preflight = existsSync(join(OUT, '_phase4822_final_preflight.json'))
    ? readJson<Record<string, unknown>>('_phase4822_final_preflight.json')
    : null;
  const repair = existsSync(join(OUT, '_phase4822_repair_runs.json'))
    ? readJson<{ runs: RepairRunRecord[] }>('_phase4822_repair_runs.json')
    : { runs: [] };
  const consumer = existsSync(join(OUT, '_phase4822_consumer_verification.json'))
    ? readJson<Record<string, unknown>>('_phase4822_consumer_verification.json')
    : null;
  const beforeAfter = existsSync(join(OUT, '_phase4822_before_after.json'))
    ? readJson<{ events: Record<string, { description?: { before: string; after: string }; image_url?: { before: string; after: string } }> }>('_phase4822_before_after.json')
    : null;

  const pass1 = repair.runs.find((r) => r.pass === 1);
  const pass2 = repair.runs.find((r) => r.pass === 2);

  const md = `# Phase 4.8.2.2 — Official Website Controlled Production Batch

Generated: ${new Date().toISOString()}

## Scope

- Approved candidate source: \`docs/real-data/_phase4821_batch_preview.json\`
- Exactly **3** corrections across **2** events
- Importer schedule: **NOT activated**
- Legacy importer: **NOT replaced**

## Approved candidate set

| Event | Field | Risk |
|-------|-------|------|
| Bootshaus Sommerfest (\`${SOMMERFEST_EVENT_ID}\`) | description | HIGH |
| Bootshaus Sommerfest (\`${SOMMERFEST_EVENT_ID}\`) | flyer (\`image_url\`) | MEDIUM |
| R3HAB (\`${R3HAB_EVENT_ID}\`) | flyer (\`image_url\`) | MEDIUM |

## Identity confirmation

- Bootshaus Sommerfest is **not** Sommerfest Elektroküche (\`${ELEKTROKUECHE_EVENT_ID}\`)
- Public URLs: bootshaus.tv event pages only

## Execution

| Step | Status |
|------|--------|
| Preflight | ${preflight ? (preflight.aborted ? 'ABORTED' : 'PASS') : 'NOT RUN'} |
| Pass 1 mutations | ${pass1?.mutations.length ?? 'N/A'} |
| Pass 2 mutations | ${pass2?.mutations.length ?? 'N/A'} |
| Forbidden fingerprints unchanged | ${consumer && (consumer as { allForbiddenUnchanged?: boolean }).allForbiddenUnchanged ? 'YES' : 'PENDING'} |

## Before / after

### Bootshaus Sommerfest description

- Before: ${beforeAfter?.events[SOMMERFEST_EVENT_ID]?.description?.before?.slice(0, 120) ?? 'N/A'}...
- After: ${beforeAfter?.events[SOMMERFEST_EVENT_ID]?.description?.after ?? 'N/A'}

### Bootshaus Sommerfest flyer

- Before: ${beforeAfter?.events[SOMMERFEST_EVENT_ID]?.image_url?.before ?? 'N/A'}
- After: ${beforeAfter?.events[SOMMERFEST_EVENT_ID]?.image_url?.after ?? 'N/A'}

### R3HAB flyer

- Before: ${beforeAfter?.events[R3HAB_EVENT_ID]?.image_url?.before ?? 'N/A'}
- After: ${beforeAfter?.events[R3HAB_EVENT_ID]?.image_url?.after ?? 'N/A'}

## Artifacts

- \`docs/real-data/_phase4822_final_preflight.json\`
- \`docs/real-data/_phase4822_backup.json\`
- \`docs/real-data/_phase4822_repair_runs.json\`
- \`docs/real-data/_phase4822_before_after.json\`
- \`docs/real-data/_phase4822_consumer_verification.json\`
- \`docs/real-data/_phase4822_forbidden_fingerprints.json\`

## Proposals applied

${preview.proposals.map((p) => `- \`${p.eventId}\` / ${p.field}`).join('\n')}
`;

  writeFileSync(REPORT, md);
  console.log(JSON.stringify({ report: REPORT, productionMutationsInThisRun }, null, 2));
}

async function main(): Promise<void> {
  switch (command) {
    case 'preflight': {
      const result = await runPreflight();
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) {
        process.exit(1);
      }
      break;
    }
    case 'backup':
      await runBackup();
      console.log(JSON.stringify({ ok: true, artifact: '_phase4822_backup.json' }, null, 2));
      break;
    case 'repair': {
      const run = await runRepair(1);
      console.log(JSON.stringify(run, null, 2));
      break;
    }
    case 'verify-consumer':
      await runVerifyConsumer();
      console.log(JSON.stringify({ ok: true, artifact: '_phase4822_consumer_verification.json' }, null, 2));
      break;
    case 'verify-idempotency':
      await runVerifyIdempotency();
      console.log(JSON.stringify({ ok: true, pass2Mutations: 0 }, null, 2));
      break;
    case 'report':
      await runReport();
      break;
    default:
      console.log(
        'Commands: preflight | backup | repair --apply | verify-consumer | verify-idempotency --apply | report',
      );
      process.exit(command === 'help' ? 0 : 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
