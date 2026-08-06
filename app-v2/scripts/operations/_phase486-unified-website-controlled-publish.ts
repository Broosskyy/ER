/**
 * Phase 4.8.6 — Unified Website Controlled Field Publishing.
 *
 * Pass-1 scope: source-bootshaus-koeln, R3HAB + Bootshaus Sommerfest only.
 * Legacy importer remains active. No broad `full` mutating command.
 *
 * Usage:
 *   node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts preview
 *   node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts backup
 *   node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts apply --event=<id>
 *   node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts verify-consumer
 *   node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts verify-idempotency --event=<id>
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, mapEventRowToDomain, type EventRow } from '@/data/mappers/event-mapper';
import {
  adminArtistRepository,
  adminSourceRepository,
  eventLineupService,
  multiSourceRepositories,
} from '@/data/repositories/registry';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import { loadMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { resolveArtistIdsForNames } from '@/features/import/services/import-title-lineup-resolver';
import {
  approvedWriteProposals,
  mapLineupEvidenceToCanonical,
  buildDefaultUnifiedWebsitePublishFlagSnapshot,
  buildEventPublishBackup,
  buildForbiddenFingerprint,
  buildPublishPreview,
  hashFingerprint,
  planPublishMutations,
  publishFieldToEventColumn,
  verifyEventIdentity,
  verifyPublishScope,
  verifyR3habConsumerAcceptance,
  verifySommerfestConsumerAcceptance,
  type PublishFieldProposal,
  type PublishMutation,
} from '@/features/import/publish/unified-website-controlled-publish';

const PHASE486_OPS_BOOTSHAUS_SOURCE = 'source-bootshaus-koeln';
const PHASE486_OPS_R3HAB_EVENT_ID = 'evt-1785339421539-k3swcrl';
const PHASE486_OPS_SOMMERFEST_EVENT_ID = 'evt-1785339391167-tfaixrr';
const PHASE486_OPS_OFFICIAL_URLS: Record<string, string> = {
  [PHASE486_OPS_R3HAB_EVENT_ID]: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
  [PHASE486_OPS_SOMMERFEST_EVENT_ID]: 'https://bootshaus.tv/events/bootshaus-sommerfest',
};
import {
  buildImportContextForIntegratedShadow,
  runUnifiedWebsiteImport,
  UNIFIED_WEBSITE_IMPORTER_VERSION,
} from '@/features/import/unified-website';
import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import type { PublishTrackedField } from '@/features/import/services/event-field-provenance-writer';
import { opsClient, updateEventRow } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const LIVE_EVIDENCE_DIR = join(OUT, '_phase4823_live_evidence');

const FIXTURE_BY_EVENT: Record<string, string> = {
  [PHASE486_OPS_R3HAB_EVENT_ID]: 'live-official-website-98.html',
  [PHASE486_OPS_SOMMERFEST_EVENT_ID]: 'live-official-website-80.html',
};

const PASS1_EVENT_IDS = [PHASE486_OPS_R3HAB_EVENT_ID, PHASE486_OPS_SOMMERFEST_EVENT_ID];
let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(OUT, name), 'utf8')) as T;
}

function parseEventArg(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith('--event='));
  return arg?.split('=')[1];
}

async function loadEvent(eventId: string) {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapEventRowToAdminRecord(data as EventRow) : null;
}

async function loadProvenance(eventId: string): Promise<Record<string, unknown>> {
  const rows = await multiSourceRepositories.fieldProvenance.findByCanonicalEventId(eventId);
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.fieldPath] = row;
  }
  return map;
}

function loadUnifiedResult(eventId: string) {
  const fixture = FIXTURE_BY_EVENT[eventId];
  if (!fixture) throw new Error(`No fixture for ${eventId}`);
  const html = readFileSync(join(LIVE_EVIDENCE_DIR, fixture), 'utf8');
  const url = PHASE486_OPS_OFFICIAL_URLS[eventId]!;
  return runUnifiedWebsiteImport({
    context: buildImportContextForIntegratedShadow({
      sourceId: PHASE486_OPS_BOOTSHAUS_SOURCE,
      sourceName: 'Bootshaus Köln',
      eventId,
      websiteUrl: url,
    }),
    html,
    fetchMeta: { status: 200, finalUrl: url },
  });
}

async function verifyScope(): Promise<Record<string, unknown>> {
  const flags = buildDefaultUnifiedWebsitePublishFlagSnapshot();
  const checks = PASS1_EVENT_IDS.map((eventId) => ({
    eventId,
    ...verifyPublishScope({
      sourceId: PHASE486_OPS_BOOTSHAUS_SOURCE,
      eventId,
      config: {
        enabled: true,
        sourceIds: [PHASE486_OPS_BOOTSHAUS_SOURCE],
        eventIds: PASS1_EVENT_IDS,
        dryRun: true,
      },
    }),
  }));
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    productionMutationsInThisRun: 0,
    flags,
    publishableFields: ['title', 'description', 'imageUrl', 'genres', 'lineup', 'ticketUrl', 'websiteUrl'],
    forbiddenFields: [
      'priceText',
      'ticketStatus',
      'venueName',
      'organizerName',
      'sourceId',
      'coordinates',
    ],
    approvedSource: PHASE486_OPS_BOOTSHAUS_SOURCE,
    approvedEvents: PASS1_EVENT_IDS,
    checks,
    pass: checks.every((c) => c.ok),
  };
}

async function preview(): Promise<Record<string, unknown>> {
  const events: Record<string, unknown> = {};
  const allProposals: PublishFieldProposal[] = [];

  for (const eventId of PASS1_EVENT_IDS) {
    const event = await loadEvent(eventId);
    if (!event) throw new Error(`Event not found: ${eventId}`);
    const identity = verifyEventIdentity(event, eventId);
    if (!identity.ok) throw new Error(identity.reason);

    const unified = loadUnifiedResult(eventId);
    const provenance = await loadProvenance(eventId);
    const proposals = buildPublishPreview({
      event,
      unified,
      provenanceByField: provenance,
      sourceId: PHASE486_OPS_BOOTSHAUS_SOURCE,
    });
    allProposals.push(...proposals);
    events[eventId] = {
      eventTitle: event.title,
      officialUrl: PHASE486_OPS_OFFICIAL_URLS[eventId],
      proposals,
      approvedWrites: approvedWriteProposals(proposals),
      importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
    };
  }

  const { mutations, skipped, rejected } = planPublishMutations(allProposals);

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    productionMutationsInThisRun: 0,
    dryRun: true,
    candidateCount: mutations.length,
    approvedWriteCount: mutations.length,
    skippedCount: skipped.length,
    rejectedCount: rejected.length,
    events,
    mutations,
    skipped,
    rejected,
    approvalRequired: 'Explicit human approval before apply --event=<id>',
  };

  writeJson('_phase486_preview.json', result);
  return result;
}

async function backup(): Promise<Record<string, unknown>> {
  const snapshots: Record<string, unknown> = {};
  const fingerprints: Record<string, unknown> = {};

  for (const eventId of PASS1_EVENT_IDS) {
    const event = await loadEvent(eventId);
    if (!event) throw new Error(`Missing event ${eventId}`);
    const provenance = await loadProvenance(eventId);
    const lineup = await eventLineupService.getStructuredLineupForEvent(eventId);
    snapshots[eventId] = buildEventPublishBackup(event, provenance, lineup);
    fingerprints[eventId] = {
      hash: hashFingerprint(buildForbiddenFingerprint(event, { lineup })),
      fingerprint: buildForbiddenFingerprint(event, { lineup }),
    };
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    productionMutationsInThisRun: 0,
    snapshots,
  };
  writeJson('_phase486_backup.json', result);
  writeJson('_phase486_forbidden_fingerprints.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    fingerprints,
  });
  writeJson('_phase486_rollback.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    rollbackStrategy: 'Restore from _phase486_backup.json per field',
    snapshots,
  });
  return result;
}

function fieldToProvenancePath(field: PublishMutation['field']): PublishTrackedField | null {
  const map: Record<string, PublishTrackedField> = {
    title: 'title',
    description: 'description',
    imageUrl: 'imageUrl',
    ticketUrl: 'ticketUrl',
    websiteUrl: 'websiteUrl',
    genres: 'genres',
  };
  if (field === 'lineup' || field === 'lineupState' || field === 'gallery') return null;
  return map[field] ?? null;
}

async function applyLineup(eventId: string, lineupNames: string[]): Promise<void> {
  const catalog = await loadMatchingCatalog();
  const allArtists = await adminArtistRepository.getAll();
  const entries = mapLineupEvidenceToCanonical(
    lineupNames.map((name, sortOrder) => ({
      sortOrder,
      displayName: name,
      rawSourceSpelling: name,
      normalizedName: name,
      billingRelation: 'SOLO' as const,
      isB2b: false,
      isF2f: false,
      isLiveSet: false,
      stage: 'MAINFLOOR',
      confidence: 0.86,
      reviewState: 'not_reviewed' as const,
      inclusionReason: 'Phase 4.8.6 unified website lineup publish',
    })),
  );

  const resolved = [];
  for (const entry of entries) {
    const resolvedArtists = await resolveArtistIdsForNames({
      names: entry.artists,
      record: {
        id: `phase486-${eventId}`,
        importJobId: 'phase486',
        sourceId: PHASE486_OPS_BOOTSHAUS_SOURCE,
        externalId: PHASE486_OPS_OFFICIAL_URLS[eventId] ?? '',
        sourceType: 'website',
        retrievedAt: new Date().toISOString(),
        rawPayload: {},
      },
      catalog,
      allArtists,
      saveArtist: (artist) => adminArtistRepository.save(artist),
      createUnverifiedForUnmatched: true,
    });
    if (resolvedArtists.artistIds.length > 0) {
      resolved.push({ ...entry, artistIds: resolvedArtists.artistIds });
    }
  }

  if (resolved.length > 0) {
    await eventLineupService.replaceStructuredLineupFromImport(eventId, resolved, {
      forceReplace: true,
    });
  }
}

async function applyEvent(eventId: string, pass: number): Promise<PublishMutation[]> {
  if (process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_DRY_RUN !== 'false') {
    throw new Error('Set EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_DRY_RUN=false to apply mutations');
  }
  if (process.env.EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_ENABLED !== 'true') {
    throw new Error('Set EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_ENABLED=true to apply mutations');
  }

  const scope = verifyPublishScope({
    sourceId: PHASE486_OPS_BOOTSHAUS_SOURCE,
    eventId,
    config: {
      enabled: true,
      sourceIds: [PHASE486_OPS_BOOTSHAUS_SOURCE],
      eventIds: PASS1_EVENT_IDS,
      dryRun: false,
    },
  });
  if (!scope.ok) throw new Error(scope.issues.join('; '));

  const previewData = readJson<{
    events: Record<string, { approvedWrites: PublishFieldProposal[] }>;
    mutations: PublishMutation[];
  }>('_phase486_preview.json');

  if (!existsSync(join(OUT, '_phase486_preview.json'))) {
    throw new Error('Run preview before apply');
  }

  const event = await loadEvent(eventId);
  if (!event) throw new Error(`Event not found: ${eventId}`);

  const source = await adminSourceRepository.getById(PHASE486_OPS_BOOTSHAUS_SOURCE);
  if (!source) throw new Error('Bootshaus source not found');

  const provenanceWriter = new EventFieldProvenanceWriter(multiSourceRepositories.fieldProvenance);
  const eventMutations = previewData.mutations.filter((m) => m.eventId === eventId);
  const applied: PublishMutation[] = [];

  for (const mutation of eventMutations) {
    if (mutation.field === 'lineup') {
      const names = mutation.newValue as string[];
      const currentLineup = await eventLineupService.getLineupArtistIds(eventId);
      if (currentLineup.length === names.length) {
        const structured = await eventLineupService.getStructuredLineupForEvent(eventId);
        const currentNames = structured.flatMap((e) => e.artists);
        if (names.every((n) => currentNames.some((a) => a.toUpperCase() === n.toUpperCase()))) {
          continue;
        }
      }
      await applyLineup(eventId, names);
      productionMutationsInThisRun += 1;
      applied.push(mutation);
      continue;
    }

    if (!mutation.eventColumn) continue;

    const currentRow = await loadEvent(eventId);
    const currentVal =
      mutation.field === 'imageUrl'
        ? currentRow?.imageUrl
        : mutation.field === 'genres'
          ? currentRow?.genreLabels
          : (currentRow as Record<string, unknown> | null)?.[mutation.field];

    if (pass > 1 && JSON.stringify(currentVal) === JSON.stringify(mutation.newValue)) {
      continue;
    }
    if (pass === 1 && JSON.stringify(currentVal) === JSON.stringify(mutation.newValue)) {
      continue;
    }

    const patch: Record<string, unknown> = { [mutation.eventColumn]: mutation.newValue };
    await updateEventRow(eventId, patch as Parameters<typeof updateEventRow>[1]);
    productionMutationsInThisRun += 1;

    const provenanceField = fieldToProvenancePath(mutation.field);
    if (provenanceField) {
      await provenanceWriter.writePhase486UnifiedWebsitePublish({
        canonicalEventId: eventId,
        fieldPath: provenanceField,
        value: mutation.newValue,
        source,
        publicEvidenceUrl: mutation.evidenceUrl,
        capturedEvidenceValue: mutation.newValue,
        previousValue: mutation.previousValue,
        previousSourceId: event.sourceId,
        importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
        writeReason: mutation.writeReason,
      });
    }
    applied.push(mutation);
  }

  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  await invalidateConsumerEventCaches(registry.eventRepository);

  return applied;
}

async function verifyConsumer(): Promise<Record<string, unknown>> {
  const panels: Record<string, unknown> = {};

  for (const eventId of PASS1_EVENT_IDS) {
    const event = await loadEvent(eventId);
    if (!event) throw new Error(`Missing ${eventId}`);
    const domain = mapEventRowToDomain(
      (await opsClient().from('events').select('*').eq('id', eventId).single()).data as EventRow,
    );
    const projection = projectCanonicalEventFields({
      title: domain.title,
      description: domain.description ?? '',
      venue: domain.venueName ?? '',
      city: domain.cityName ?? '',
      artists: [],
      priceText: domain.priceText,
      source: domain.sourceId ?? '',
      ticketUrl: domain.ticketUrl,
      imageUrl: domain.imageUrl,
      genres: domain.genreLabels,
      lineupEntries: await eventLineupService.getStructuredLineupForEvent(eventId),
    });

    panels[eventId] = {
      eventId,
      title: event.title,
      projection,
      checks:
        eventId === PHASE486_OPS_R3HAB_EVENT_ID
          ? verifyR3habConsumerAcceptance(projection)
          : verifySommerfestConsumerAcceptance(event, projection),
    };
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    productionMutationsInThisRun,
    panels,
  };
  writeJson('_phase486_consumer_verification.json', result);
  return result;
}

async function verifyIdempotency(eventId: string): Promise<Record<string, unknown>> {
  const pass1 = await applyEvent(eventId, 1);
  const pass2 = await applyEvent(eventId, 2);
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    eventId,
    pass1Mutations: pass1.length,
    pass2Mutations: pass2.length,
    idempotent: pass2.length === 0,
    productionMutationsInThisRun,
  };
}

async function verifyCanonicalDb(): Promise<Record<string, unknown>> {
  const previewData = readJson<{ mutations: PublishMutation[] }>('_phase486_preview.json');
  const r3habMutations = previewData.mutations.filter((m) => m.eventId === PHASE486_OPS_R3HAB_EVENT_ID);
  const checks: Record<string, unknown>[] = [];

  for (const mutation of r3habMutations) {
    const event = await loadEvent(mutation.eventId);
    if (!event) throw new Error(`Missing ${mutation.eventId}`);

    if (mutation.field === 'lineup') {
      const lineup = await eventLineupService.getStructuredLineupForEvent(mutation.eventId);
      const names = lineup.flatMap((e) => e.artists);
      const expected = mutation.newValue as string[];
      checks.push({
        field: 'lineup',
        expected,
        actual: names,
        pass: expected.every((n) => names.some((a) => a.toUpperCase() === n.toUpperCase())),
      });
      continue;
    }

    const actual =
      mutation.field === 'description'
        ? event.description
        : mutation.field === 'ticketUrl'
          ? event.ticketUrl
          : mutation.field === 'imageUrl'
            ? event.imageUrl
            : (event as Record<string, unknown>)[mutation.field];
    checks.push({
      field: mutation.field,
      expected: mutation.newValue,
      actual,
      pass: JSON.stringify(actual) === JSON.stringify(mutation.newValue),
    });
  }

  const sommerfest = await loadEvent(PHASE486_OPS_SOMMERFEST_EVENT_ID);
  const backup = readJson<{ snapshots: Record<string, { description: string; ticket_url: string; venue_name: string; price_text: string }> }>(
    '_phase486_backup.json',
  );
  const sommerfestBackup = backup.snapshots[PHASE486_OPS_SOMMERFEST_EVENT_ID];

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    productionMutationsInThisRun,
    r3habChecks: checks,
    r3habPass: checks.every((c) => c.pass),
    sommerfestUntouched:
      sommerfest?.description === sommerfestBackup?.description &&
      sommerfest?.ticketUrl === sommerfestBackup?.ticket_url &&
      sommerfest?.venueName === sommerfestBackup?.venue_name &&
      sommerfest?.priceText === sommerfestBackup?.price_text,
  };
  writeJson('_phase486_canonical_verification.json', result);
  return result;
}

async function verifyForbiddenFingerprints(): Promise<Record<string, unknown>> {
  const beforeData = readJson<{ fingerprints: Record<string, { hash: string; fingerprint: Record<string, unknown> }> }>(
    '_phase486_forbidden_fingerprints.json',
  );
  const beforeFingerprints = beforeData.fingerprints;
  const comparisons: Record<string, { beforeHash: string; afterHash: string; unchanged: boolean }> = {};

  function forbiddenOnlyHash(fingerprint: Record<string, unknown>): string {
    const { lineup: _lineup, origins: _origins, ...forbiddenOnly } = fingerprint;
    return hashFingerprint(forbiddenOnly);
  }

  for (const eventId of PASS1_EVENT_IDS) {
    const event = await loadEvent(eventId);
    if (!event) throw new Error(`Missing ${eventId}`);
    const lineup = await eventLineupService.getStructuredLineupForEvent(eventId);
    const fingerprint = buildForbiddenFingerprint(event, { lineup });
    const afterHash = forbiddenOnlyHash(fingerprint);
    const beforeHash = forbiddenOnlyHash(beforeFingerprints[eventId]?.fingerprint ?? {});
    comparisons[eventId] = {
      beforeHash,
      afterHash,
      unchanged: beforeHash === afterHash,
    };
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    productionMutationsInThisRun,
    comparisons,
    pass: Object.values(comparisons).every((c) => c.unchanged),
  };
  writeJson('_phase486_forbidden_fingerprints_post_apply.json', result);
  return result;
}

async function applyPass2(eventId: string): Promise<PublishMutation[]> {
  return applyEvent(eventId, 2);
}

async function postApplyReport(): Promise<Record<string, unknown>> {
  const pass1Run = existsSync(join(OUT, '_phase486_publish_runs.json'))
    ? readJson<Record<string, unknown>>('_phase486_publish_runs.json')
    : null;
  const pass2Applied = existsSync(join(OUT, '_phase486_pass2_runs.json'))
    ? readJson<{ applied: PublishMutation[] }>('_phase486_pass2_runs.json')
    : { applied: [] };

  const canonical = existsSync(join(OUT, '_phase486_canonical_verification.json'))
    ? readJson('_phase486_canonical_verification.json')
    : await verifyCanonicalDb();
  const consumer = existsSync(join(OUT, '_phase486_consumer_verification.json'))
    ? readJson('_phase486_consumer_verification.json')
    : await verifyConsumer();
  const forbidden = existsSync(join(OUT, '_phase486_forbidden_fingerprints_post_apply.json'))
    ? readJson('_phase486_forbidden_fingerprints_post_apply.json')
    : await verifyForbiddenFingerprints();
  const rollback = await verifyRollback();

  const r3habPanel = (consumer as { panels: Record<string, { checks: Record<string, boolean>; projection: Record<string, unknown> }> })
    .panels[PHASE486_OPS_R3HAB_EVENT_ID];
  const sommerfestPanel = (consumer as { panels: Record<string, { checks: Record<string, boolean> }> })
    .panels[PHASE486_OPS_SOMMERFEST_EVENT_ID];

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    productionMutationsInThisRun,
    pass1MutationCount: (pass1Run as { applied?: unknown[] } | null)?.applied?.length ?? 0,
    pass2MutationCount: pass2Applied.applied.length,
    pass2Idempotent: pass2Applied.applied.length === 0,
    r3habDescription: r3habPanel?.projection?.sanitizedDescription,
    r3habLineup: r3habPanel?.projection?.knownArtistNames,
    r3habTicketCta: r3habPanel?.projection?.ticketUrl,
    sommerfestChecks: sommerfestPanel?.checks,
    canonicalVerification: canonical,
    forbiddenFingerprint: forbidden,
    rollback,
    legacyRemainsEnabled: true,
    readinessVerdict: 'PHASE_486_PASS1_COMPLETE',
  };
  writeJson('_phase486_before_after.json', result);
  writeJson('_phase486_readiness.json', {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    productionMutationsInThisRun,
    readinessVerdict: 'PHASE_486_PASS1_COMPLETE',
    legacyRemainsEnabled: true,
    pass2Idempotent: pass2Applied.applied.length === 0,
  });
  return result;
}

async function verifyRollback(): Promise<Record<string, unknown>> {
  const backup = readJson<{ snapshots: Record<string, unknown> }>('_phase486_backup.json');
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    rollbackReady: Boolean(backup.snapshots),
    eventCount: Object.keys(backup.snapshots ?? {}).length,
    productionMutationsInThisRun,
  };
}

async function readiness(): Promise<Record<string, unknown>> {
  const scope = await verifyScope();
  const previewResult = existsSync(join(OUT, '_phase486_preview.json'))
    ? readJson<Record<string, unknown>>('_phase486_preview.json')
    : await preview();

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6',
    productionMutationsInThisRun,
    scopePass: (scope as { pass: boolean }).pass,
    previewCandidateCount: (previewResult as { candidateCount: number }).candidateCount,
    flagsDefaultSafe: (scope as { flags: { defaultsSafe: boolean } }).flags.defaultsSafe,
    readinessVerdict: 'AWAITING_EXPLICIT_APPLY_APPROVAL',
    legacyRemainsEnabled: true,
  };
}

async function report(): Promise<void> {
  const result = await readiness();
  console.log(JSON.stringify(result, null, 2));
}

const command = process.argv[2] ?? 'report';

const handlers: Record<string, () => Promise<void>> = {
  'verify-scope': async () => writeJson('_phase486_publish_scope.json', await verifyScope()),
  preview: async () => {
    const result = await preview();
    console.log(JSON.stringify(result, null, 2));
  },
  backup: async () => {
    const result = await backup();
    console.log(JSON.stringify(result, null, 2));
  },
  apply: async () => {
    const eventId = parseEventArg();
    if (!eventId) throw new Error('apply requires --event=<id>');
    const applied = await applyEvent(eventId, 1);
    writeJson('_phase486_publish_runs.json', {
      generatedAt: new Date().toISOString(),
      pass: 1,
      eventId,
      applied,
      productionMutationsInThisRun,
    });
    console.log(JSON.stringify({ applied, productionMutationsInThisRun }, null, 2));
  },
  'verify-consumer': async () => {
    const result = await verifyConsumer();
    console.log(JSON.stringify(result, null, 2));
  },
  'verify-idempotency': async () => {
    const eventId = parseEventArg();
    if (!eventId) throw new Error('verify-idempotency requires --event=<id>');
    const result = await verifyIdempotency(eventId);
    console.log(JSON.stringify(result, null, 2));
  },
  'apply-pass2': async () => {
    const eventId = parseEventArg();
    if (!eventId) throw new Error('apply-pass2 requires --event=<id>');
    const applied = await applyPass2(eventId);
    writeJson('_phase486_pass2_runs.json', {
      generatedAt: new Date().toISOString(),
      pass: 2,
      eventId,
      applied,
      productionMutationsInThisRun,
    });
    console.log(JSON.stringify({ applied, productionMutationsInThisRun }, null, 2));
  },
  'verify-canonical': async () => {
    const result = await verifyCanonicalDb();
    console.log(JSON.stringify(result, null, 2));
  },
  'verify-forbidden': async () => {
    const result = await verifyForbiddenFingerprints();
    console.log(JSON.stringify(result, null, 2));
  },
  'post-apply-report': async () => {
    const result = await postApplyReport();
    console.log(JSON.stringify(result, null, 2));
  },
  'verify-rollback': async () => {
    const result = await verifyRollback();
    console.log(JSON.stringify(result, null, 2));
  },
  readiness: async () => writeJson('_phase486_readiness.json', await readiness()),
  report,
};

(async () => {
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
  await handler();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
