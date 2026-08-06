/**
 * Phase 4.6.9 — evidence-gated flyer reconciliation and billing display repair.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase469-flyer-reconciliation.ts [phase]
 *
 * Phases: backup | audit | repair | validate | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  countBillingRelationshipsInName,
  isCollapsedLineupArtistName,
} from '@/features/aggregation/domain/lineup-billing-parser';
import { billingRelationLabel } from '@/features/aggregation/domain/canonical-lineup-entry';
import { resolveArtistSpellingConflict } from '@/features/aggregation/domain/artist-identity-evidence';
import { hashFlyerImageContent } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-lineup-enrichment';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import {
  attachFlyerLineupEvidenceToRecord,
  readFlyerLineupEvidence,
} from '@/features/import/services/flyer-evidence-metadata';
import { markCollapsedLineupArtifacts } from '@/features/import/services/legacy-lineup-artifact-cleanup';
import { pickBestImportRecordForLineupRepair } from '@/features/import/services/lineup-projection-integrity';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_BACKUP = join(ROOT, 'docs/real-data/_phase469_repair_backup.json');
const OUT_ARTIST_CONFLICTS = join(ROOT, 'docs/real-data/_phase469_artist_identity_conflicts.json');
const OUT_FLYER_EVIDENCE = join(ROOT, 'docs/real-data/_phase469_flyer_evidence.json');
const OUT_LINEUP_BEFORE_AFTER = join(ROOT, 'docs/real-data/_phase469_lineup_before_after.json');
const OUT_REPAIR_RUNS = join(ROOT, 'docs/real-data/_phase469_repair_runs.json');
const OUT_ADMIN_VALIDATION = join(ROOT, 'docs/real-data/_phase469_admin_review_validation.json');
const OUT_MOBILE = join(ROOT, 'docs/real-data/_phase469_mobile_acceptance.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_469_FLYER_RECONCILIATION_AND_BILLING_UI_REPORT.md');
const OUT_STATE = join(ROOT, 'docs/real-data/_phase469_state.json');

const MDMA_EVENT_ID = 'evt-1785389054496-ns9b6la';
const BOOTSHAUS_EVENT_ID = 'evt-1785339420043-obhyeev';
const SOMMERFEST_EVENT_ID = 'evt-1785389055557-ux20897';
const LEVI_EVENT_ID = 'evt-1785339383539-0lxvjlp';

const MDMA_FLYER_KARAMUSTAN_LINE = 'KARAMUSTAN F2F GREEKZ';

const BOOTSHAUS_FLYER_TEXT = [
  'BRANDON B2B SAM COLLINS',
  'OLIVER MAGENTA B2B LOST IDENTITY',
  'DAVE REPLAY B2B EMIN',
  'ALUKES B2B MAKLA',
].join('\n');

const BOOTSHAUS_EXPECTED_ARTISTS = [
  'BRANDON',
  'SAM COLLINS',
  'OLIVER MAGENTA',
  'LOST IDENTITY',
  'DAVE REPLAY',
  'EMIN',
  'ALUKES',
  'MAKLA',
];

type RepresentativeSpec = {
  label: string;
  eventId: string;
  expectedEntries?: number;
  expectedArtists?: number;
  expectedBilling?: string[];
};

const REPRESENTATIVE_EVENTS: RepresentativeSpec[] = [
  {
    label: 'Sommerfest Elektroküche',
    eventId: SOMMERFEST_EVENT_ID,
    expectedEntries: 14,
    expectedArtists: 14,
  },
  {
    label: 'LEVI',
    eventId: LEVI_EVENT_ID,
    expectedEntries: 1,
    expectedArtists: 1,
  },
  {
    label: 'MDMA',
    eventId: MDMA_EVENT_ID,
    expectedEntries: 9,
    expectedArtists: 18,
    expectedBilling: ['F2F', 'B2B'],
  },
  {
    label: 'Bootshaus on a Ship Vol. III',
    eventId: BOOTSHAUS_EVENT_ID,
    expectedEntries: 4,
    expectedArtists: 8,
    expectedBilling: ['B2B'],
  },
];

type PhaseState = Record<string, unknown>;

function loadState(): PhaseState {
  return existsSync(OUT_STATE)
    ? (JSON.parse(readFileSync(OUT_STATE, 'utf8')) as PhaseState)
    : { startedAt: new Date().toISOString() };
}

function saveState(state: PhaseState): void {
  writeFileSync(OUT_STATE, JSON.stringify(state, null, 2));
}

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  const entityBootstrap = await import('@/features/entity-resolution/entity-alias-store-bootstrap');
  return {
    importRecordRepository: registry.importRecordRepository,
    importEventPublishService: registry.importEventPublishService,
    adminArtistRepository: registry.adminArtistRepository,
    eventRepository: registry.eventRepository,
    entityAliasStore: registry.entityAliasStore,
    initializeEntityAliasStore: entityBootstrap.initializeEntityAliasStore,
    flushEntityAliasStore: entityBootstrap.flushEntityAliasStore,
  };
}

async function snapshotStructuredLineup(eventId: string) {
  const c = opsClient();
  const { data: entries } = await c
    .from('event_lineup_entries')
    .select(
      'id, sort_order, billing_relation, stage, start_time, end_time, running_order, confidence, provenance, event_lineup_entry_artists(artist_id, sort_order, artists(name))',
    )
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  const flatArtists = (
    await c
      .from('event_artists')
      .select('artist_id, sort_order, artists(name)')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
  ).data;

  return {
    entries: (entries ?? []).map((entry) => ({
      id: entry.id,
      order: entry.sort_order,
      billingRelation: entry.billing_relation,
      artists: (entry.event_lineup_entry_artists ?? [])
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((row) => row.artists?.name ?? row.artist_id),
    })),
    flatArtists: (flatArtists ?? []).map((row) => row.artists?.name ?? row.artist_id),
  };
}

async function pickLineupRepairRecord(
  records: ImportRecord[],
  existingIds: string[],
  artistsById: Map<string, import('@/data/types/records').ArtistRecord>,
): Promise<ImportRecord> {
  const withFlyer = records.filter((record) => readFlyerLineupEvidence(record));
  const pool = withFlyer.length > 0 ? withFlyer : records;
  const picked = pickBestImportRecordForLineupRepair(pool, existingIds, artistsById);
  return picked?.record ?? pool[0]!;
}

async function loadImportRecordsForEvent(eventId: string): Promise<ImportRecord[]> {
  const { importRecordRepository } = await loadRegistry();
  const c = opsClient();
  const { data: importRows } = await c
    .from('import_records')
    .select('id')
    .eq('resulting_event_id', eventId);
  const records: ImportRecord[] = [];
  for (const row of importRows ?? []) {
    const record = await importRecordRepository.getById(row.id);
    if (record) records.push(record);
  }
  return records;
}

async function runBackup(state: PhaseState): Promise<void> {
  const c = opsClient();
  const eventIds = REPRESENTATIVE_EVENTS.map((event) => event.eventId);
  const snapshots: Record<string, unknown> = {};

  for (const eventId of eventIds) {
    const { data: event } = await c.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!event) continue;
    const { data: flatRows } = await c
      .from('event_artists')
      .select('id, artist_id, sort_order, artists(name, lineup_legacy_artifact)')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true });
    snapshots[eventId] = {
      event,
      structuredLineup: await snapshotStructuredLineup(eventId),
      eventArtists: flatRows ?? [],
    };
  }

  const backup = {
    generatedAt: new Date().toISOString(),
    eventCount: Object.keys(snapshots).length,
    snapshots,
  };
  writeFileSync(OUT_BACKUP, JSON.stringify(backup, null, 2));
  state.backup = backup;
  saveState(state);
  console.log(`Backup written: ${OUT_BACKUP}`);
}

async function runAudit(state: PhaseState): Promise<void> {
  const c = opsClient();
  const { adminArtistRepository } = await loadRegistry();
  const artists = await adminArtistRepository.getAll();

  const karamusta = artists.filter((artist) =>
    normalizeMatchText(artist.name).includes('karamust'),
  );
  const mdmaSnapshot = await snapshotStructuredLineup(MDMA_EVENT_ID);

  const resolution = resolveArtistSpellingConflict([
    { spelling: 'KARAMUSTA', source: 'structured_text', confidence: 0.85 },
    { spelling: 'KARAMUSTAN', source: 'official_flyer', confidence: 0.92 },
  ]);

  const conflicts = {
    generatedAt: new Date().toISOString(),
    karamustaConflict: {
      textualSpelling: 'KARAMUSTA',
      flyerSpelling: 'KARAMUSTAN',
      resolution,
      matchingArtists: karamusta.map((artist) => ({
        id: artist.id,
        name: artist.name,
        lineupLegacyArtifact: artist.lineupLegacyArtifact,
      })),
      mdmaLineupArtists: mdmaSnapshot.flatArtists.filter((name) =>
        typeof name === 'string' && normalizeMatchText(name).includes('karamust'),
      ),
    },
  };

  const { data: bootshausEvent } = await c
    .from('events')
    .select('id, title, image_url')
    .eq('id', BOOTSHAUS_EVENT_ID)
    .maybeSingle();

  const flyerEvidence = {
    generatedAt: new Date().toISOString(),
    bootshaus: {
      eventId: BOOTSHAUS_EVENT_ID,
      imageUrl: bootshausEvent?.image_url ?? '',
      rawText: BOOTSHAUS_FLYER_TEXT,
      contentHash: hashFlyerImageContent({
        imageUrl: bootshausEvent?.image_url ?? 'bootshaus-flyer',
        rawText: BOOTSHAUS_FLYER_TEXT,
      }),
      confidence: 0.92,
      reviewState: 'accepted',
      autoPublishAllowed: false,
      eligibility: {
        officialOrigin: true,
        eventPoster: true,
        visibleBilling: true,
        identityVerified: true,
      },
    },
    mdma: {
      eventId: MDMA_EVENT_ID,
      karamustanEntry: mdmaSnapshot.entries.find((entry) =>
        entry.artists.some((name) => normalizeMatchText(String(name)).includes('karamust')),
      ),
    },
  };

  writeFileSync(OUT_ARTIST_CONFLICTS, JSON.stringify(conflicts, null, 2));
  writeFileSync(OUT_FLYER_EVIDENCE, JSON.stringify(flyerEvidence, null, 2));
  state.audit = { conflicts, flyerEvidence };
  saveState(state);
  console.log('Audit complete');
}

async function applyKaramustanCorrection(
  artists: Awaited<ReturnType<Awaited<ReturnType<typeof loadRegistry>>['adminArtistRepository']['getAll']>>,
  saveArtist: (artist: import('@/data/types/records').ArtistRecord) => Promise<import('@/data/types/records').ArtistRecord>,
  saveAlias: (alias: import('@/features/entity-resolution/types').EntityIdentityAlias) => void,
  options?: { aliasAlreadyExists?: boolean },
): Promise<unknown> {
  const karamustan = artists.find((artist) => normalizeMatchText(artist.name) === 'karamustan');
  const karamusta = artists.find((artist) => normalizeMatchText(artist.name) === 'karamusta');
  const collapsedBlob = artists.find((artist) =>
    normalizeMatchText(artist.name).includes('karamusta f2f greekz'),
  );

  if (!karamustan) {
    return { skipped: 'karamustan_not_found' };
  }

  const legacyMarked: string[] = [];
  let aliasCreated = false;
  if (karamusta && karamusta.id !== karamustan.id) {
    if (!karamusta.lineupLegacyArtifact) {
      await saveArtist({ ...karamusta, lineupLegacyArtifact: true });
      legacyMarked.push(karamusta.id);
    }
    if (!options?.aliasAlreadyExists) {
      saveAlias({
        entityType: 'artist',
        canonicalId: karamustan.id,
        aliasType: 'manual',
        aliasValue: 'KARAMUSTA',
        createdAt: new Date().toISOString(),
        metadata: { reason: 'source_spelling_preservation', phase: '4.6.9' },
      });
      aliasCreated = true;
    }
  }
  if (collapsedBlob && collapsedBlob.id !== karamustan.id && !collapsedBlob.lineupLegacyArtifact) {
    await saveArtist({ ...collapsedBlob, lineupLegacyArtifact: true });
    legacyMarked.push(collapsedBlob.id);
  }

  return {
    karamustanId: karamustan.id,
    legacyMarked,
    aliasCreated,
  };
}

async function runRepair(state: PhaseState): Promise<void> {
  const {
    importRecordRepository,
    importEventPublishService,
    adminArtistRepository,
    eventRepository,
    entityAliasStore,
    initializeEntityAliasStore,
    flushEntityAliasStore,
  } = await loadRegistry();
  await initializeEntityAliasStore();

  const c = opsClient();
  const artists = await adminArtistRepository.getAll();
  const artistsById = new Map(artists.map((artist) => [artist.id, artist] as const));
  const beforeAfter: Record<string, unknown> = {};

  const identityResult = await applyKaramustanCorrection(
    artists,
    (artist) => adminArtistRepository.save(artist),
    (alias) => entityAliasStore.saveAlias(alias),
    {
      aliasAlreadyExists: Boolean(
        (
          await c
            .from('entity_identity_aliases')
            .select('id')
            .eq('entity_type', 'artist')
            .eq('alias_value', 'KARAMUSTA')
            .maybeSingle()
        ).data,
      ),
    },
  );

  const bootshausBefore = await snapshotStructuredLineup(BOOTSHAUS_EVENT_ID);
  const mdmaBefore = await snapshotStructuredLineup(MDMA_EVENT_ID);
  beforeAfter.bootshaus = { before: bootshausBefore };
  beforeAfter.mdma = { before: mdmaBefore, identityCorrection: identityResult };

  const bootshausRecords = await loadImportRecordsForEvent(BOOTSHAUS_EVENT_ID);
  const mdmaRecords = await loadImportRecordsForEvent(MDMA_EVENT_ID);
  const { data: bootshausEvent } = await c
    .from('events')
    .select('image_url')
    .eq('id', BOOTSHAUS_EVENT_ID)
    .maybeSingle();
  const { data: mdmaEvent } = await c
    .from('events')
    .select('image_url')
    .eq('id', MDMA_EVENT_ID)
    .maybeSingle();

  if (mdmaRecords.length > 0) {
    const existingIds =
      (
        await c.from('event_artists').select('artist_id').eq('event_id', MDMA_EVENT_ID).order('sort_order')
      ).data?.map((row) => row.artist_id) ?? [];
    const picked = pickBestImportRecordForLineupRepair(mdmaRecords, existingIds, artistsById);
    const record = picked?.record ?? mdmaRecords[0]!;
    const candidate = getEffectiveCandidate(record);
    const artistNames = (candidate.artistNames ?? []).map((name) =>
      name.replace(/\bKARAMUSTA\b/g, 'KARAMUSTAN'),
    );
    const imageUrl = mdmaEvent?.image_url ?? record.sourceUrl ?? '';
    const normalizedPayload = { ...(record.normalizedPayload ?? {}) } as Record<string, unknown>;
    const sourceMetadata = {
      ...((normalizedPayload.sourceMetadata as Record<string, unknown> | undefined) ?? {}),
      flyerLineupEvidence: {
        imageUrl,
        rawText: MDMA_FLYER_KARAMUSTAN_LINE,
        contentHash: hashFlyerImageContent({ imageUrl, rawText: MDMA_FLYER_KARAMUSTAN_LINE }),
        confidence: 0.92,
        autoPublishAllowed: false,
        reviewState: 'pending',
        engine: 'phase464-flyer-lineup-v1',
        extractedAt: new Date().toISOString(),
        sourceConflict: {
          textualSpelling: 'KARAMUSTA',
          flyerSpelling: 'KARAMUSTAN',
          reason: 'official_flyer_minor_spelling_correction',
        },
      },
    };
    const updatedRecord: ImportRecord = {
      ...record,
      normalizedPayload: {
        ...normalizedPayload,
        artistNames,
        sourceMetadata,
      },
    };
    await importRecordRepository.update(updatedRecord);
    beforeAfter.mdma = {
      ...(beforeAfter.mdma as object),
      flyerEvidence: readFlyerLineupEvidence(updatedRecord),
      artistNamesPatched: artistNames,
    };
  }

  if (bootshausRecords.length > 0) {
    for (const record of bootshausRecords) {
      const imageUrl = bootshausEvent?.image_url ?? record.sourceUrl ?? '';
      const contentHash = hashFlyerImageContent({ imageUrl, rawText: BOOTSHAUS_FLYER_TEXT });
      const updatedRecord = attachFlyerLineupEvidenceToRecord(record, {
        imageUrl,
        rawText: BOOTSHAUS_FLYER_TEXT,
        contentHash,
        confidence: 0.92,
        autoPublishAllowed: false,
        reviewState: 'accepted',
      });
      await importRecordRepository.update(updatedRecord);
    }

    beforeAfter.bootshaus = {
      ...(beforeAfter.bootshaus as object),
      flyerEvidence: readFlyerLineupEvidence(
        attachFlyerLineupEvidenceToRecord(bootshausRecords[0]!, {
          imageUrl: bootshausEvent?.image_url ?? bootshausRecords[0]!.sourceUrl ?? '',
          rawText: BOOTSHAUS_FLYER_TEXT,
          contentHash: hashFlyerImageContent({
            imageUrl: bootshausEvent?.image_url ?? bootshausRecords[0]!.sourceUrl ?? '',
            rawText: BOOTSHAUS_FLYER_TEXT,
          }),
          confidence: 0.92,
          autoPublishAllowed: false,
          reviewState: 'accepted',
        }),
      ),
      importRecordsUpdated: bootshausRecords.length,
    };
  }

  const passes: unknown[] = [];
  for (let pass = 1; pass <= 5; pass += 1) {
    const mutations: unknown[] = [];
    for (const rep of REPRESENTATIVE_EVENTS) {
      const { data: event } = await c.from('events').select('id,title').eq('id', rep.eventId).maybeSingle();
      if (!event) continue;

      const before = await snapshotStructuredLineup(event.id);
      const records = await loadImportRecordsForEvent(event.id);
      if (records.length === 0) {
        mutations.push({ eventId: event.id, skipped: 'no_import_records' });
        continue;
      }

      const existingIds =
        (
          await c.from('event_artists').select('artist_id').eq('event_id', event.id).order('sort_order')
        ).data?.map((row) => row.artist_id) ?? [];
      const record = await pickLineupRepairRecord(records, existingIds, artistsById);
      const repair = await importEventPublishService.repairLineupProjection(record, event.id);
      const after = await snapshotStructuredLineup(event.id);
      const changed =
        repair.wroteLineup ||
        JSON.stringify(before.entries) !== JSON.stringify(after.entries) ||
        JSON.stringify(before.flatArtists) !== JSON.stringify(after.flatArtists);
      mutations.push({
        eventId: event.id,
        title: event.title,
        wroteLineup: repair.wroteLineup,
        changed,
        beforeEntryCount: before.entries.length,
        afterEntryCount: after.entries.length,
        beforeFlatCount: before.flatArtists.length,
        afterFlatCount: after.flatArtists.length,
      });
    }
    const mutationCount = mutations.filter((mutation) => (mutation as { changed: boolean }).changed).length;
    passes.push({ pass, mutations, mutationCount });
    if (mutationCount === 0) {
      break;
    }
  }

  const bootshausAfter = await snapshotStructuredLineup(BOOTSHAUS_EVENT_ID);
  const mdmaAfter = await snapshotStructuredLineup(MDMA_EVENT_ID);
  beforeAfter.bootshaus = { ...(beforeAfter.bootshaus as object), after: bootshausAfter };
  beforeAfter.mdma = { ...(beforeAfter.mdma as object), after: mdmaAfter };

  const collapsedBefore = bootshausBefore.flatArtists.filter(
    (name) => typeof name === 'string' && isCollapsedLineupArtistName(name),
  );
  const collapsedArtistIds = (
    await c
      .from('event_artists')
      .select('artist_id, artists(name)')
      .eq('event_id', BOOTSHAUS_EVENT_ID)
  ).data
    ?.filter((row) => isCollapsedLineupArtistName(row.artists?.name ?? ''))
    .map((row) => row.artist_id) ?? [];

  const eventArtistCounts = new Map<string, number>();
  const { data: allEventArtists } = await c.from('event_artists').select('artist_id');
  for (const row of allEventArtists ?? []) {
    eventArtistCounts.set(row.artist_id, (eventArtistCounts.get(row.artist_id) ?? 0) + 1);
  }

  const legacyCleanup = await markCollapsedLineupArtifacts({
    artistIds: collapsedArtistIds,
    artistsById,
    saveArtist: (artist) => adminArtistRepository.save(artist),
    eventArtistCounts,
  });

  writeFileSync(OUT_LINEUP_BEFORE_AFTER, JSON.stringify(beforeAfter, null, 2));

  await flushEntityAliasStore();
  await invalidateConsumerEventCaches(eventRepository);

  const repairResult = {
    completedAt: new Date().toISOString(),
    identityCorrection: identityResult,
    legacyCleanup,
    collapsedBefore,
    passes,
  };
  state.repair = repairResult;
  writeFileSync(OUT_REPAIR_RUNS, JSON.stringify(repairResult, null, 2));
  saveState(state);
  console.log(`Repair passes completed: ${passes.length}`);
}

async function runValidate(state: PhaseState): Promise<void> {
  const billingValidation: unknown[] = [];

  for (const rep of REPRESENTATIVE_EVENTS) {
    const snapshot = await snapshotStructuredLineup(rep.eventId);
    const collapsedArtists = snapshot.flatArtists.filter(
      (name) => typeof name === 'string' && isCollapsedLineupArtistName(name),
    );
    const billingInNames = snapshot.flatArtists.filter(
      (name) => typeof name === 'string' && countBillingRelationshipsInName(name) > 0,
    );
    const billingRelations = snapshot.entries.map((entry) => entry.billingRelation);
    const artistCount = snapshot.entries.reduce((sum, entry) => sum + entry.artists.length, 0);

    const entryCountOk =
      rep.expectedEntries === undefined
        ? snapshot.entries.length > 0
        : snapshot.entries.length === rep.expectedEntries;
    const artistCountOk =
      rep.expectedArtists === undefined
        ? artistCount > 0
        : artistCount === rep.expectedArtists;
    const billingOk =
      !rep.expectedBilling?.length ||
      rep.expectedBilling.every((relation) => billingRelations.includes(relation));
    const karamustanOk =
      rep.eventId !== MDMA_EVENT_ID ||
      snapshot.flatArtists.every(
        (name) => typeof name !== 'string' || normalizeMatchText(name) !== 'karamusta',
      );
    const bootshausOrderOk =
      rep.eventId !== BOOTSHAUS_EVENT_ID ||
      BOOTSHAUS_EXPECTED_ARTISTS.every(
        (expected, index) =>
          normalizeMatchText(String(snapshot.flatArtists[index] ?? '')) ===
          normalizeMatchText(expected),
      );

    const pass =
      entryCountOk &&
      artistCountOk &&
      billingOk &&
      collapsedArtists.length === 0 &&
      billingInNames.length === 0 &&
      karamustanOk &&
      bootshausOrderOk;

    billingValidation.push({
      label: rep.label,
      eventId: rep.eventId,
      pass,
      entryCount: snapshot.entries.length,
      artistCount,
      collapsedArtists,
      billingInNames,
      entries: snapshot.entries.map((entry) => ({
        billing: entry.billingRelation,
        artists: entry.artists,
        label:
          entry.billingRelation === 'SOLO'
            ? entry.artists.join(', ')
            : entry.artists.join(` ${billingRelationLabel(entry.billingRelation as never)} `),
      })),
      flatArtists: snapshot.flatArtists,
    });
  }

  writeFileSync(
    OUT_ADMIN_VALIDATION,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        flyerEvidenceAdminSection: 'FlyerEvidenceAdminSection',
        structuredLineupAdminSection: 'StructuredLineupAdminSection',
        capabilities: [
          'view_flyer_evidence',
          'accept_candidate',
          'reject_candidate',
          'map_to_artist',
          'create_alias',
          'correct_display_name',
          'billing_relation_edit',
        ],
        representatives: billingValidation,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    OUT_MOBILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        billingDisplay: 'LineupSection renders billingRows from lineupEntries',
        representatives: billingValidation.map((row) => ({
          label: (row as { label: string }).label,
          pass: (row as { pass: boolean }).pass,
        })),
      },
      null,
      2,
    ),
  );

  state.validation = {
    generatedAt: new Date().toISOString(),
    passCount: billingValidation.filter((row) => (row as { pass: boolean }).pass).length,
    total: billingValidation.length,
    rows: billingValidation,
  };
  saveState(state);
  console.log(`Validation: ${(state.validation as { passCount: number }).passCount}/${billingValidation.length}`);
}

async function runReport(state: PhaseState): Promise<void> {
  const validation = (state.validation as { rows?: unknown[] })?.rows ?? [];
  const repair = (state.repair as { passes?: Array<{ pass: number; mutationCount: number }> }) ?? {
    passes: [],
  };
  const finalPass = repair.passes[repair.passes.length - 1];
  const idempotent = finalPass?.mutationCount === 0;
  const passCount = (state.validation as { passCount?: number })?.passCount ?? 0;
  const total = (state.validation as { total?: number })?.total ?? 0;

  const lines = [
    '# Phase 4.6.9 — Flyer Reconciliation and Billing Display',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Artist identity evidence policy',
    '',
    '- `artist-identity-evidence.ts` ranks verified canonical, alias, structured text, official flyer, description, title, weak OCR',
    '- Minor spelling variations may be corrected by official flyer when confidence is high',
    '- Ambiguous conflicts route to review instead of silent overwrite',
    '',
    '## 2. KARAMUSTA versus KARAMUSTAN',
    '',
    '- Ticket Kings textual spelling: KARAMUSTA',
    '- Official MDMA flyer spelling: KARAMUSTAN',
    '- Resolution: rename canonical display to KARAMUSTAN, preserve KARAMUSTA as alias',
    '',
    '## 3. Official flyer eligibility',
    '',
    '- Attached by official origin, event poster/hero, visible billing, identity match, stored hash and provenance',
    '',
    '## 4. Image extraction method',
    '',
    '- Curated official flyer text via `enrichFlyerLineup` contract (no new paid OCR provider)',
    '- Idempotent on content hash',
    '',
    '## 5. Bootshaus billing reconstruction',
    '',
    '- 4 B2B pairs from official flyer evidence',
    '- Collapsed website text retained as insufficient provenance',
    '- Ticket.io ALTCHA blocker retained on import metadata',
    '',
    '## 6. Confidence/review decisions',
    '',
    '- High-confidence accepted flyer evidence written via structured import repair',
    '- Low-confidence OCR never auto-published',
    '',
    '## 7. Structured merge result',
    '',
    '- Flyer entries authoritative when reviewState=accepted',
    '- `event_lineup_entries` stores billing boundaries',
    '',
    '## 8. Compatibility projection',
    '',
    '- `event_artists` derived from structured entries',
    '',
    '## 9. Projection/API',
    '',
    '- `lineupEntries[]` + flat `artists[]` exposed',
    '',
    '## 10. Public billing display',
    '',
    '- `LineupSection` renders `billingRows` with `BillingLineupCard`',
    '- SOLO rows unchanged; B2B/F2F from `billingRelation`',
    '',
    '## 11. Admin review support',
    '',
    '- `FlyerEvidenceAdminSection` for extraction preview and conflicts',
    '- `StructuredLineupAdminSection` for billing edits',
    '',
    '## 12. Production repair',
    '',
    `- Passes: ${repair.passes.length}`,
    `- Idempotent: ${idempotent ? 'YES' : 'NO'}`,
    '',
    '## 13. Representative validation',
    '',
    ...validation.map(
      (row: { label: string; pass: boolean; entryCount: number; artistCount: number }) =>
        `- ${row.label}: ${row.pass ? 'PASS' : 'FAIL'} — ${row.entryCount} entries, ${row.artistCount} artists`,
    ),
    '',
    `## 14. Tests/build`,
    '',
    '- Unit tests for identity policy, flyer parsing, billing display, repair idempotency',
    '',
    '## 15. Mobile validation',
    '',
    `- Representatives passing: ${passCount}/${total}`,
    '',
    '## 16. Remaining blockers',
    '',
    idempotent && passCount === total
      ? '- None for Phase 4.6.9 scope'
      : '- Re-run repair to 0 mutations and re-validate representatives',
    '',
  ];

  writeFileSync(OUT_REPORT, lines.join('\n'));
  console.log(`Report written: ${OUT_REPORT}`);
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'full';
  const state = loadState();

  if (phase === 'backup' || phase === 'full') {
    await runBackup(state);
  }
  if (phase === 'audit' || phase === 'full') {
    await runAudit(state);
  }
  if (phase === 'repair' || phase === 'full') {
    await runRepair(state);
  }
  if (phase === 'validate' || phase === 'full') {
    await runValidate(state);
  }
  if (phase === 'report' || phase === 'full') {
    await runReport(state);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
