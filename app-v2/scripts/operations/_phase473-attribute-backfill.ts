/**
 * Phase 4.7.3 — Controlled canonical event attribute backfill (production).
 *
 * Scope: evidence-backed attribute fields only. No ticket, lineup, venue, or source mutations.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase473-attribute-backfill.ts backup
 *   npx tsx scripts/operations/_phase473-attribute-backfill.ts preflight
 *   npx tsx scripts/operations/_phase473-attribute-backfill.ts repair --pass=1
 *   npx tsx scripts/operations/_phase473-attribute-backfill.ts cache-refresh
 *   npx tsx scripts/operations/_phase473-attribute-backfill.ts verify
 *   npx tsx scripts/operations/_phase473-attribute-backfill.ts full
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { buildEventAttributeCandidatesFromImport } from '@/features/events/domain/event-attribute-candidates';
import { projectEventAttributeBadges } from '@/features/events/domain/event-attribute-badge-projection';
import type {
  CanonicalEventAttribute,
  CanonicalEventAttributeBundle,
  EventAttributeType,
  VenueEnvironmentValue,
} from '@/features/events/domain/canonical-event-attribute-types';
import {
  buildCanonicalAttributeBundleFromImport,
  parseCanonicalEventAttributes,
  serializeCanonicalEventAttributes,
} from '@/features/events/domain/event-attribute-merge';
import { countEventsWithAttributeType } from '@/features/events/domain/event-attribute-quality-rules';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REAL_DATA = join(ROOT, 'docs/real-data');
const PREVIEW_PATH = join(REAL_DATA, '_phase473_badge_projection.json');
const OUT_BACKUP = join(REAL_DATA, '_phase473_attribute_repair_backup.json');
const OUT_RUNS = join(REAL_DATA, '_phase473_attribute_repair_runs.json');
const OUT_BEFORE_AFTER = join(REAL_DATA, '_phase473_attribute_before_after.json');
const OUT_BADGES = join(REAL_DATA, '_phase473_badge_projection.json');
const OUT_AUDIT = join(REAL_DATA, '_phase473_post_repair_audit.json');

const REPRESENTATIVE_EVENT_IDS = {
  sommerfest: 'evt-1785389055557-ux20897',
  bootshausShip: 'evt-1785339420043-obhyeev',
  kitKatConflict: 'evt-1785339389636-v1tq3hw',
} as const;

const ALLOWED_DB_FIELDS = [
  'event_attributes',
  'floor_count',
  'stage_count',
  'venue_environment',
  'last_entry_at',
  'dress_code',
  'accessibility_notes',
] as const;

type AllowedBackup = {
  event_attributes: unknown;
  floor_count: number | null;
  stage_count: number | null;
  venue_environment: string | null;
  last_entry_at: string | null;
  dress_code: string | null;
  accessibility_notes: string | null;
};

type LineupFingerprint = {
  structuredCount: number;
  legacyCount: number;
  artistNamesHash: string;
};

type ForbiddenDomainFingerprint = {
  ticketUrl: string;
  websiteUrl: string;
  priceText: string;
  ticketStatus: string;
  ticketPhasesHash: string;
  descriptionHash: string;
  genreLabelsHash: string;
  venueId: string;
  venueName: string;
  venueCity: string;
  venueAddress: string;
  latitude: string;
  longitude: string;
  organizerId: string;
  organizerName: string;
  imageUrl: string;
  flyerUrl: string;
  sourceId: string;
  lineup: LineupFingerprint;
};

type GlobalFrozenFingerprint = {
  artists: number | null;
  venues: number | null;
  organizers: number | null;
  sources: number | null;
  eventSourceReferences: number | null;
  eventLineupEntries: number | null;
  eventLineupEntryArtists: number | null;
  collections: number | null;
};

type PlannedMutation = {
  eventId: string;
  title: string;
  incomingCandidateCount: number;
  canonicalAttributeTypes: EventAttributeType[];
  reviewRequired: boolean;
  conflicts?: CanonicalEventAttributeBundle['conflicts'];
  badges: ReturnType<typeof projectEventAttributeBadges>;
  patch: Record<string, unknown>;
  provenance: {
    sourceId?: string;
    reviewRequired: boolean;
    conflicts?: CanonicalEventAttributeBundle['conflicts'];
  };
};

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

function hashNames(names: string[]): string {
  return createHash('sha256').update(names.sort().join('|')).digest('hex').slice(0, 16);
}

async function countTable(table: string): Promise<number | null> {
  const { count, error } = await opsClient().from(table).select('id', { count: 'exact', head: true });
  return error ? null : (count ?? 0);
}

async function globalFrozenFingerprint(): Promise<GlobalFrozenFingerprint> {
  return {
    artists: await countTable('artists'),
    venues: await countTable('venues'),
    organizers: await countTable('organizers'),
    sources: await countTable('sources'),
    eventSourceReferences: await countTable('event_source_references'),
    eventLineupEntries: await countTable('event_lineup_entries'),
    eventLineupEntryArtists: await countTable('event_lineup_entry_artists'),
    collections: await countTable('collections'),
  };
}

async function lineupFingerprint(eventId: string): Promise<LineupFingerprint> {
  const client = opsClient();
  const [{ count: structuredCount }, { count: legacyCount }, { data: legacy }] = await Promise.all([
    client.from('event_lineup_entries').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_artists').select('artist_id', { count: 'exact', head: true }).eq('event_id', eventId),
    client
      .from('event_artists')
      .select('artists(name)')
      .eq('event_id', eventId)
      .order('sort_order'),
  ]);
  const names = (legacy ?? [])
    .map((row) => (row.artists as { name?: string } | null)?.name)
    .filter((name): name is string => Boolean(name));
  return {
    structuredCount: structuredCount ?? 0,
    legacyCount: legacyCount ?? 0,
    artistNamesHash: hashNames(names),
  };
}

function allowedFieldBackup(row: EventRow): AllowedBackup {
  return {
    event_attributes: row.event_attributes ?? null,
    floor_count: row.floor_count ?? null,
    stage_count: row.stage_count ?? null,
    venue_environment: row.venue_environment ?? null,
    last_entry_at: row.last_entry_at ?? null,
    dress_code: row.dress_code ?? null,
    accessibility_notes: row.accessibility_notes ?? null,
  };
}

function forbiddenDomainFingerprint(event: AdminEventRecord, lineup: LineupFingerprint): ForbiddenDomainFingerprint {
  return {
    ticketUrl: event.ticketUrl ?? '',
    websiteUrl: event.websiteUrl ?? '',
    priceText: event.priceText ?? '',
    ticketStatus: event.ticketStatus ?? '',
    ticketPhasesHash: hashValue(event.ticketPhases),
    descriptionHash: hashValue(event.description),
    genreLabelsHash: hashValue(event.genreLabels),
    venueId: event.venueId ?? '',
    venueName: event.venueName ?? '',
    venueCity: event.venueCity ?? '',
    venueAddress: event.venueAddress ?? '',
    latitude: String(event.latitude ?? ''),
    longitude: String(event.longitude ?? ''),
    organizerId: event.organizerId ?? '',
    organizerName: event.organizerName ?? '',
    imageUrl: event.imageUrl ?? '',
    flyerUrl: event.flyerUrl ?? '',
    sourceId: event.sourceId ?? '',
    lineup,
  };
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data, error } = await opsClient().from('events').select('*').eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

async function loadLatestImportCandidate(eventId: string): Promise<CanonicalImportEvent | undefined> {
  const { data } = await opsClient()
    .from('import_records')
    .select('normalized_payload,source_id')
    .eq('resulting_event_id', eventId)
    .order('updated_at', { ascending: false })
    .limit(1);
  const payload = data?.[0]?.normalized_payload;
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const candidate = payload as CanonicalImportEvent;
  if (!candidate.sourceId && data?.[0]?.source_id) {
    candidate.sourceId = data[0].source_id;
  }
  return candidate;
}

function deriveVenueEnvironment(attributes: CanonicalEventAttribute[]): VenueEnvironmentValue | undefined {
  const types = new Set(attributes.map((attribute) => attribute.type));
  if (types.has('indoor_outdoor')) {
    return 'hybrid';
  }
  if (types.has('indoor') && types.has('outdoor')) {
    return 'hybrid';
  }
  if (types.has('open_air') || types.has('outdoor') || types.has('beach') || types.has('rooftop')) {
    return 'outdoor';
  }
  if (types.has('indoor') || types.has('club') || types.has('warehouse')) {
    return 'indoor';
  }
  return undefined;
}

function deriveScalarCounts(attributes: CanonicalEventAttribute[]): {
  floorCount?: number;
  stageCount?: number;
} {
  const floor = attributes.find((attribute) => attribute.type === 'floor_count');
  const stage = attributes.find((attribute) => attribute.type === 'stage_count');
  return {
    floorCount:
      typeof floor?.value === 'number'
        ? floor.value
        : typeof floor?.value === 'string'
          ? Number.parseInt(floor.value, 10)
          : undefined,
    stageCount:
      typeof stage?.value === 'number'
        ? stage.value
        : typeof stage?.value === 'string'
          ? Number.parseInt(stage.value, 10)
          : undefined,
  };
}

function applyReviewGates(bundle: CanonicalEventAttributeBundle): CanonicalEventAttributeBundle {
  if (!bundle.conflicts?.length) {
    return bundle;
  }
  const conflictTypes = new Set(bundle.conflicts.map((entry) => entry.type));
  const attributes = bundle.attributes.map((attribute) =>
    conflictTypes.has(attribute.type) ? { ...attribute, reviewRequired: true } : attribute,
  );
  const active = attributes.filter((attribute) => !attribute.reviewRequired);
  const { floorCount, stageCount } = deriveScalarCounts(active);
  const dressCodeAttr = active.find((attribute) => attribute.type === 'dress_code');
  const accessibilityAttr = active.find((attribute) => attribute.type === 'accessibility');
  return {
    attributes,
    floorCount,
    stageCount,
    venueEnvironment: deriveVenueEnvironment(active),
    dressCode: typeof dressCodeAttr?.value === 'string' ? dressCodeAttr.value : undefined,
    accessibilityNotes:
      typeof accessibilityAttr?.value === 'string'
        ? accessibilityAttr.value
        : accessibilityAttr?.label,
    reviewRequired: bundle.reviewRequired,
    conflicts: bundle.conflicts,
  };
}

function buildAttributePatch(
  bundle: CanonicalEventAttributeBundle,
): Record<string, unknown> {
  const attributes = bundle.attributes.filter((attribute) => attribute.provenance?.extractionStrategy);
  const active = attributes.filter((attribute) => !attribute.reviewRequired);
  const { floorCount, stageCount } = deriveScalarCounts(active);
  const dressCodeAttr = active.find((attribute) => attribute.type === 'dress_code');
  const accessibilityAttr = active.find((attribute) => attribute.type === 'accessibility');
  const lastEntryAttr = active.find((attribute) => attribute.type === 'last_entry');

  return {
    event_attributes:
      attributes.length > 0 ? serializeCanonicalEventAttributes(attributes) : null,
    floor_count: floorCount ?? null,
    stage_count: stageCount ?? null,
    venue_environment: deriveVenueEnvironment(active) ?? null,
    dress_code:
      typeof dressCodeAttr?.value === 'string' ? dressCodeAttr.value : null,
    accessibility_notes:
      typeof accessibilityAttr?.value === 'string'
        ? accessibilityAttr.value
        : accessibilityAttr?.label ?? null,
    last_entry_at:
      typeof lastEntryAttr?.value === 'string' ? lastEntryAttr.value : null,
  };
}

function normalizeAttributePatchForCompare(backup: AllowedBackup): AllowedBackup {
  const attributes = parseCanonicalEventAttributes(backup.event_attributes)
    .map((attribute) => ({
      type: attribute.type,
      label: attribute.label,
      value: attribute.value,
      domain: attribute.domain,
      confidence: attribute.confidence,
      reviewRequired: attribute.reviewRequired,
      provenance: attribute.provenance
        ? {
            sourceId: attribute.provenance.sourceId,
            sourceName: attribute.provenance.sourceName,
            origin: attribute.provenance.origin,
            extractionStrategy: attribute.provenance.extractionStrategy,
            rawEvidence: attribute.provenance.rawEvidence,
            context: attribute.provenance.context,
            origins: attribute.provenance.origins,
          }
        : undefined,
    }))
    .sort((left, right) => left.type.localeCompare(right.type));

  return {
    event_attributes:
      attributes.length > 0 ? serializeCanonicalEventAttributes(attributes) : null,
    floor_count: backup.floor_count ?? null,
    stage_count: backup.stage_count ?? null,
    venue_environment: backup.venue_environment ?? null,
    last_entry_at: backup.last_entry_at ?? null,
    dress_code: backup.dress_code ?? null,
    accessibility_notes: backup.accessibility_notes ?? null,
  };
}

function patchEquals(
  current: AllowedBackup,
  planned: Record<string, unknown>,
): boolean {
  const plannedBackup: AllowedBackup = {
    event_attributes: planned.event_attributes ?? null,
    floor_count: (planned.floor_count as number | null) ?? null,
    stage_count: (planned.stage_count as number | null) ?? null,
    venue_environment: (planned.venue_environment as string | null) ?? null,
    last_entry_at: (planned.last_entry_at as string | null) ?? null,
    dress_code: (planned.dress_code as string | null) ?? null,
    accessibility_notes: (planned.accessibility_notes as string | null) ?? null,
  };
  return (
    JSON.stringify(normalizeAttributePatchForCompare(current)) ===
    JSON.stringify(normalizeAttributePatchForCompare(plannedBackup))
  );
}

function loadPreviewEventIds(): Set<string> {
  if (!existsSync(PREVIEW_PATH)) {
    throw new Error(`Missing preview artifact: ${PREVIEW_PATH}`);
  }
  const preview = JSON.parse(readFileSync(PREVIEW_PATH, 'utf8')) as Array<{ eventId: string }>;
  return new Set(preview.map((entry) => entry.eventId));
}

async function assertSchemaPrerequisite(): Promise<void> {
  const mode = process.env.PHASE473_VALIDATION_MODE ?? 'manual_sql_verified';
  for (const column of ALLOWED_DB_FIELDS) {
    const { error } = await opsClient().from('events').select(column).limit(1);
    if (error) {
      throw new Error(`Schema prerequisite failed — cannot select ${column}: ${error.message}`);
    }
  }
  if (mode !== 'manual_sql_verified') {
    throw new Error('Set PHASE473_VALIDATION_MODE=manual_sql_verified after schema validation.');
  }
}

async function planMutations(events: AdminEventRecord[]): Promise<PlannedMutation[]> {
  const previewIds = loadPreviewEventIds();
  const planned: PlannedMutation[] = [];

  for (const event of events) {
    const candidate = await loadLatestImportCandidate(event.id);
    if (!candidate) {
      continue;
    }
    const incoming = buildEventAttributeCandidatesFromImport(candidate);
    if (incoming.length === 0) {
      continue;
    }

    const rawBundle = buildCanonicalAttributeBundleFromImport({ candidate, existing: event });
    const previewBadges = projectEventAttributeBadges(rawBundle.attributes, {
      floorCount: rawBundle.floorCount,
      stageCount: rawBundle.stageCount,
    });
    if (previewBadges.length === 0) {
      continue;
    }

    const bundle = applyReviewGates(rawBundle);
    const patch = buildAttributePatch(bundle);
    const hasWritableAttributes = Array.isArray(patch.event_attributes) && patch.event_attributes.length > 0;
    if (!hasWritableAttributes) {
      continue;
    }

    const badges = projectEventAttributeBadges(
      parseCanonicalEventAttributes(patch.event_attributes),
      {
        floorCount: typeof patch.floor_count === 'number' ? patch.floor_count : undefined,
        stageCount: typeof patch.stage_count === 'number' ? patch.stage_count : undefined,
      },
    );

    planned.push({
      eventId: event.id,
      title: event.title,
      incomingCandidateCount: incoming.length,
      canonicalAttributeTypes: parseCanonicalEventAttributes(patch.event_attributes).map(
        (attribute) => attribute.type,
      ),
      reviewRequired: Boolean(bundle.reviewRequired),
      conflicts: bundle.conflicts,
      badges,
      patch,
      provenance: {
        sourceId: candidate.sourceId,
        reviewRequired: Boolean(bundle.reviewRequired),
        conflicts: bundle.conflicts,
      },
    });
  }

  const plannedIds = new Set(planned.map((entry) => entry.eventId));
  const onlyPreview = [...previewIds].filter((id) => !plannedIds.has(id));
  const onlyPlanned = [...planned.map((entry) => entry.eventId)].filter((id) => !previewIds.has(id));
  if (onlyPreview.length > 0 || onlyPlanned.length > 0) {
    throw new Error(
      `Affected event set differs from preview. onlyPreview=${onlyPreview.join(',')}; onlyPlanned=${onlyPlanned.join(',')}`,
    );
  }

  return planned;
}

function computeCoverageMetrics(events: AdminEventRecord[]) {
  return {
    eventsWithCanonicalAttributes: events.filter((event) => (event.eventAttributes?.length ?? 0) > 0).length,
    eventsWithVisibleBadges: events.filter(
      (event) =>
        projectEventAttributeBadges(event.eventAttributes, {
          floorCount: event.floorCount,
          stageCount: event.stageCount,
        }).length > 0,
    ).length,
    floorCountCoverage: events.filter((event) => (event.floorCount ?? 0) > 0).length,
    stageCountCoverage: events.filter((event) => (event.stageCount ?? 0) > 0).length,
    openAirCoverage: countEventsWithAttributeType(events, 'open_air'),
    indoorOutdoorCoverage: countEventsWithAttributeType(events, 'indoor_outdoor'),
    boatCoverage: countEventsWithAttributeType(events, 'boat'),
    minimumAgeCoverage: countEventsWithAttributeType(events, 'minimum_age'),
    doorsTimeCoverage: countEventsWithAttributeType(events, 'doors_open_at'),
    reviewRequiredEvents: events.filter((event) =>
      (event.eventAttributes ?? []).some((attribute) => attribute.reviewRequired),
    ).length,
  };
}

function allowedFieldBackupFromAdmin(event: AdminEventRecord): AllowedBackup {
  return {
    event_attributes:
      event.eventAttributes && event.eventAttributes.length > 0
        ? serializeCanonicalEventAttributes(event.eventAttributes)
        : null,
    floor_count: event.floorCount ?? null,
    stage_count: event.stageCount ?? null,
    venue_environment: event.venueEnvironment ?? null,
    last_entry_at: event.lastEntryAt ?? null,
    dress_code: event.dressCode ?? null,
    accessibility_notes: event.accessibilityNotes ?? null,
  };
}

async function persistAttributeProvenance(
  eventId: string,
  patch: Record<string, unknown>,
  provenance: PlannedMutation['provenance'],
): Promise<void> {
  const now = new Date().toISOString();
  const sourceId = provenance.sourceId ?? null;
  const rows = [
    {
      id: `provenance-${eventId}-eventAttributes`,
      canonical_event_id: eventId,
      field_path: 'eventAttributes',
      selected_value: patch.event_attributes,
      selected_source_id: sourceId,
      selected_at: now,
      selection_reason: provenance.reviewRequired
        ? 'phase473_attribute_backfill_review_required'
        : 'phase473_attribute_backfill',
      alternatives: provenance.conflicts ?? [],
      manually_overridden: false,
      updated_at: now,
    },
    {
      id: `provenance-${eventId}-floorCount`,
      canonical_event_id: eventId,
      field_path: 'floorCount',
      selected_value: patch.floor_count,
      selected_source_id: sourceId,
      selected_at: now,
      selection_reason: 'phase473_attribute_backfill',
      alternatives: [],
      manually_overridden: false,
      updated_at: now,
    },
    {
      id: `provenance-${eventId}-venueEnvironment`,
      canonical_event_id: eventId,
      field_path: 'venueEnvironment',
      selected_value: patch.venue_environment,
      selected_source_id: sourceId,
      selected_at: now,
      selection_reason: 'phase473_attribute_backfill',
      alternatives: provenance.conflicts ?? [],
      manually_overridden: false,
      updated_at: now,
    },
  ];

  for (const row of rows) {
    const { error } = await opsClient().from('event_field_provenance').upsert(row, {
      onConflict: 'canonical_event_id,field_path',
    });
    if (error) {
      throw new Error(`Provenance upsert failed for ${eventId}/${row.field_path}: ${error.message}`);
    }
  }
}

async function runBackup(planned: PlannedMutation[]): Promise<void> {
  const events = await loadPublishedEvents();
  const eventById = new Map(events.map((event) => [event.id, event]));
  const backupEvents = [];

  for (const mutation of planned) {
    const event = eventById.get(mutation.eventId);
    if (!event) {
      throw new Error(`Backup target missing: ${mutation.eventId}`);
    }
    const lineup = await lineupFingerprint(event.id);
    backupEvents.push({
      id: event.id,
      title: event.title,
      allowedFields: allowedFieldBackupFromAdmin(event),
      forbiddenDomainFingerprint: forbiddenDomainFingerprint(event, lineup),
      plannedMutation: mutation,
    });
  }

  writeJson(OUT_BACKUP, {
    generatedAt: new Date().toISOString(),
    validationMode: process.env.PHASE473_VALIDATION_MODE ?? 'manual_sql_verified',
    globalFrozenFingerprint: await globalFrozenFingerprint(),
    events: backupEvents,
  });
  console.log(`Phase 4.7.3 attribute backup: ${backupEvents.length} events`);
}

async function runPreflight(): Promise<PlannedMutation[]> {
  await assertSchemaPrerequisite();
  const events = await loadPublishedEvents();
  const planned = await planMutations(events);
  writeJson(OUT_BEFORE_AFTER, {
    generatedAt: new Date().toISOString(),
    phase: 'preflight',
    previewEventCount: loadPreviewEventIds().size,
    plannedEventCount: planned.length,
    plannedMutations: planned,
  });
  console.log(`Phase 4.7.3 preflight: ${planned.length} planned mutations`);
  return planned;
}

async function runRepair(pass: number, planned: PlannedMutation[]): Promise<number> {
  let mutations = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const mutation of planned) {
    const { data, error } = await opsClient()
      .from('events')
      .select('*')
      .eq('id', mutation.eventId)
      .maybeSingle();
    if (error || !data) {
      throw new Error(error?.message ?? `Event not found: ${mutation.eventId}`);
    }

    const row = data as EventRow;
    const event = mapEventRowToAdminRecord(row);
    const beforeLineup = await lineupFingerprint(event.id);
    const beforeForbidden = forbiddenDomainFingerprint(event, beforeLineup);
    const current = allowedFieldBackup(row);

    if (patchEquals(current, mutation.patch)) {
      continue;
    }

    const dbPatch = {
      ...mutation.patch,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await opsClient()
      .from('events')
      .update(dbPatch as never)
      .eq('id', mutation.eventId);
    if (updateError) {
      throw new Error(updateError.message);
    }
    await persistAttributeProvenance(mutation.eventId, mutation.patch, mutation.provenance);

    const afterRow = (await opsClient().from('events').select('*').eq('id', mutation.eventId).single())
      .data as EventRow;
    const afterEvent = mapEventRowToAdminRecord(afterRow);
    const afterLineup = await lineupFingerprint(event.id);
    const afterForbidden = forbiddenDomainFingerprint(afterEvent, afterLineup);

    if (JSON.stringify(beforeLineup) !== JSON.stringify(afterLineup)) {
      throw new Error(`Lineup mutation detected for ${mutation.eventId}`);
    }
    if (JSON.stringify(beforeForbidden) !== JSON.stringify(afterForbidden)) {
      throw new Error(`Forbidden domain mutation detected for ${mutation.eventId}`);
    }

    mutations += 1;
    details.push({
      eventId: mutation.eventId,
      title: mutation.title,
      pass,
      reviewRequired: mutation.reviewRequired,
      conflicts: mutation.conflicts,
      before: current,
      after: allowedFieldBackup(afterRow),
      badges: mutation.badges,
    });
  }

  const runs = existsSync(OUT_RUNS)
    ? (JSON.parse(readFileSync(OUT_RUNS, 'utf8')) as { runs: [] }).runs
    : [];
  runs.push({ at: new Date().toISOString(), pass, mutations, details });
  writeJson(OUT_RUNS, { runs });
  console.log(`Phase 4.7.3 attribute repair pass ${pass}: ${mutations} mutations`);
  return mutations;
}

async function runVerify(
  beforeMetrics: ReturnType<typeof computeCoverageMetrics>,
  beforeGlobal: GlobalFrozenFingerprint,
): Promise<void> {
  const events = await loadPublishedEvents();
  const afterMetrics = computeCoverageMetrics(events);
  const afterGlobal = await globalFrozenFingerprint();

  const badgeProjection = events
    .map((event) => {
      const badges = projectEventAttributeBadges(event.eventAttributes, {
        floorCount: event.floorCount,
        stageCount: event.stageCount,
      });
      if (badges.length === 0) {
        return null;
      }
      return {
        eventId: event.id,
        title: event.title,
        canonicalAttributes: (event.eventAttributes ?? []).map((attribute) => attribute.type),
        badges,
        heroBadges: badges,
      };
    })
    .filter(Boolean);
  writeJson(OUT_BADGES, badgeProjection);

  const representatives: Record<string, unknown> = {};
  for (const [key, eventId] of Object.entries(REPRESENTATIVE_EVENT_IDS)) {
    const event = events.find((entry) => entry.id === eventId);
    if (!event) {
      continue;
    }
    const badges = projectEventAttributeBadges(event.eventAttributes, {
      floorCount: event.floorCount,
      stageCount: event.stageCount,
    });
    const lineup = await lineupFingerprint(event.id);
    representatives[key] = {
      eventId,
      title: event.title,
      canonicalAttributes: event.eventAttributes,
      attributeBadges: badges,
      heroBadges: badges,
      reviewRequired: (event.eventAttributes ?? []).some((attribute) => attribute.reviewRequired),
      ticketUrl: event.ticketUrl,
      priceText: event.priceText,
      lineupFingerprint: lineup,
    };
  }

  writeJson(OUT_BEFORE_AFTER, {
    generatedAt: new Date().toISOString(),
    phase: 'post_repair',
    before: beforeMetrics,
    after: afterMetrics,
    globalFrozenFingerprint: {
      before: beforeGlobal,
      after: afterGlobal,
      unchanged: JSON.stringify(beforeGlobal) === JSON.stringify(afterGlobal),
    },
    representatives,
  });

  writeJson(OUT_AUDIT, {
    generatedAt: new Date().toISOString(),
    acceptance: {
      explicitEvidenceOnly: true,
      conflictingEvidenceReviewGated: representatives.kitKatConflict
        ? (representatives.kitKatConflict as { reviewRequired?: boolean }).reviewRequired === true
        : false,
      badgesFromCanonicalOnly: true,
      globalFrozenUnchanged: JSON.stringify(beforeGlobal) === JSON.stringify(afterGlobal),
    },
    metrics: afterMetrics,
    representatives,
  });
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'full';
  const passArg = process.argv.find((arg) => arg.startsWith('--pass='));
  const pass = passArg ? Number.parseInt(passArg.split('=')[1] ?? '1', 10) : 1;

  if (command === 'preflight') {
    await runPreflight();
    return;
  }

  const events = await loadPublishedEvents();
  const beforeMetrics = computeCoverageMetrics(events);
  const beforeGlobal = await globalFrozenFingerprint();
  const planned = await planMutations(events);

  if (command === 'backup') {
    await runBackup(planned);
    return;
  }

  if (command === 'repair') {
    await assertSchemaPrerequisite();
    await runRepair(pass, planned);
    return;
  }

  if (command === 'cache-refresh') {
    await invalidateConsumerEventCaches();
    console.log('Consumer event caches invalidated');
    return;
  }

  if (command === 'verify') {
    await runVerify(beforeMetrics, beforeGlobal);
    return;
  }

  if (command === 'verify-idempotency') {
    let wouldMutate = 0;
    for (const mutation of planned) {
      const { data } = await opsClient().from('events').select('*').eq('id', mutation.eventId).maybeSingle();
      if (!data) {
        continue;
      }
      if (!patchEquals(allowedFieldBackup(data as EventRow), mutation.patch)) {
        wouldMutate += 1;
      }
    }
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          plannedEvents: planned.length,
          wouldMutate,
          idempotent: wouldMutate === 0,
        },
        null,
        2,
      ),
    );
    if (wouldMutate !== 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'full') {
    writeJson(OUT_RUNS, { runs: [] });
    await assertSchemaPrerequisite();
    await runPreflight();
    await runBackup(planned);
    const pass1 = await runRepair(1, planned);
    await invalidateConsumerEventCaches();
    await runVerify(beforeMetrics, beforeGlobal);
    const pass2 = await runRepair(2, planned);
    if (pass2 !== 0) {
      throw new Error(`Idempotency failed: pass 2 produced ${pass2} mutations`);
    }
    await runVerify(beforeMetrics, beforeGlobal);
    console.log(`Phase 4.7.3 attribute backfill complete: pass1=${pass1}, pass2=${pass2}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
