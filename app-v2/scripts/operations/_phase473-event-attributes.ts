/**
 * Phase 4.7.3 — Canonical event attribute audit (read-only).
 *
 * Usage:
 *   npx tsx scripts/operations/_phase473-event-attributes.ts <audit|inventory|preflight|preview|report|full>
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { buildEventAttributeCandidatesFromImport } from '@/features/events/domain/event-attribute-candidates';
import {
  buildCanonicalAttributeBundleFromImport,
  parseCanonicalEventAttributes,
} from '@/features/events/domain/event-attribute-merge';
import { projectEventAttributeBadges } from '@/features/events/domain/event-attribute-badge-projection';
import {
  auditEventAttributeQuality,
  countEventsWithAttributeType,
} from '@/features/events/domain/event-attribute-quality-rules';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const REPORT = join(ROOT, 'docs/PHASE_473_CANONICAL_EVENT_ATTRIBUTES.md');

const STORAGE_MODEL = {
  recommendation: 'events.event_attributes jsonb + scalar filter columns',
  columns: [
    'event_attributes jsonb',
    'floor_count integer',
    'stage_count integer',
    'venue_environment text',
    'last_entry_at timestamptz',
    'dress_code text',
    'accessibility_notes text',
  ],
  migration: 'supabase/migrations/20260803140000_phase473_canonical_event_attributes.sql',
  rationale:
    'Matches ticket_phases/genre_labels jsonb precedent; scalars enable filters/search without dozens of nullable columns.',
};

interface Phase473State {
  inventory: unknown;
  candidates: unknown[];
  mergeValidation: unknown;
  badgeProjection: unknown[];
  qualityRules: unknown[];
  summary: Record<string, unknown>;
}

const state: Phase473State = {
  inventory: {},
  candidates: [],
  mergeValidation: {},
  badgeProjection: [],
  qualityRules: [],
  summary: {},
};

function ensureOut(): void {
  mkdirSync(OUT, { recursive: true });
}

function writeArtifact(name: string, data: unknown): void {
  ensureOut();
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2), 'utf8');
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data } = await opsClient().from('events').select('*').eq('status', 'published');
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

async function loadLatestImportCandidate(eventId: string): Promise<CanonicalImportEvent | undefined> {
  const { data } = await opsClient()
    .from('import_records')
    .select('normalized_payload')
    .eq('resulting_event_id', eventId)
    .order('updated_at', { ascending: false })
    .limit(1);
  const payload = data?.[0]?.normalized_payload;
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  return payload as CanonicalImportEvent;
}

function hasSchemaSupport(row: EventRow): boolean {
  return 'event_attributes' in row;
}

async function inventory(): Promise<void> {
  const events = await loadPublishedEvents();
  const rawRows = await opsClient().from('events').select('*').eq('status', 'published').limit(1);
  const sampleRow = (rawRows.data?.[0] ?? {}) as EventRow;

  const withAttributes = events.filter(
    (event) => (event.eventAttributes?.length ?? 0) > 0 || event.floorCount !== undefined,
  );
  const withBadges = events.filter((event) => {
    const badges = projectEventAttributeBadges(event.eventAttributes, {
      floorCount: event.floorCount,
      stageCount: event.stageCount,
    });
    return badges.length > 0;
  });

  state.inventory = {
    storageModel: STORAGE_MODEL,
    schemaDeployed: hasSchemaSupport(sampleRow),
    publishedEvents: events.length,
    eventsWithCanonicalAttributes: withAttributes.length,
    eventsWithVisibleBadges: withBadges.length,
    eventsWithFloorCount: events.filter((event) => (event.floorCount ?? 0) > 0).length,
    eventsWithOpenAir: countEventsWithAttributeType(events, 'open_air'),
    eventsWithFestival: countEventsWithAttributeType(events, 'festival'),
    eventsWithBoat: countEventsWithAttributeType(events, 'boat'),
    eventsWithMinimumAge: events.filter((event) => Boolean(event.ageRestriction)).length,
    eventsWithDoorsTime: events.filter((event) => Boolean(event.doorsOpenAt)).length,
  };

  writeArtifact('_phase473_attribute_inventory.json', state.inventory);
}

async function audit(): Promise<void> {
  const events = await loadPublishedEvents();
  const candidateSamples: unknown[] = [];
  const quality: unknown[] = [];
  let blockedExtraction = 0;
  let blockedMerge = 0;
  let blockedProjection = 0;
  let blockedSchema = 0;
  let reviewRequired = 0;

  for (const event of events) {
    const candidate = await loadLatestImportCandidate(event.id);
    const incoming = candidate ? buildEventAttributeCandidatesFromImport(candidate) : [];
    if (candidate) {
      candidateSamples.push({
        eventId: event.id,
        title: event.title,
        candidates: incoming,
      });
    }

    const violations = auditEventAttributeQuality({ event, candidate });
    quality.push(...violations.map((entry) => ({ ...entry, eventId: event.id, title: event.title })));

    if (incoming.length > 0 && (event.eventAttributes?.length ?? 0) === 0) {
      blockedSchema++;
    }
    if (incoming.length === 0 && !event.eventAttributes?.length) {
      blockedExtraction++;
    }
    for (const violation of violations) {
      if (violation.stage === 'rejected_by_merge') blockedMerge++;
      if (violation.stage === 'view_model_omitted') blockedProjection++;
      if (violation.stage === 'review_required') reviewRequired++;
    }
  }

  state.candidates = candidateSamples.slice(0, 50);
  state.qualityRules = quality;
  state.summary = {
    ...state.summary,
    eventsWithCanonicalAttributes: events.filter((event) => (event.eventAttributes?.length ?? 0) > 0).length,
    eventsWithVisibleBadges: events.filter((event) =>
      projectEventAttributeBadges(event.eventAttributes, { floorCount: event.floorCount }).length > 0,
    ).length,
    eventsMissingSchemaSupport: blockedSchema,
    eventsBlockedByExtraction: blockedExtraction,
    eventsBlockedByMerge: blockedMerge,
    eventsBlockedByProjection: blockedProjection,
    eventsRequiringReview: reviewRequired,
    proposedStorageModel: STORAGE_MODEL,
  };

  writeArtifact('_phase473_attribute_candidates.json', state.candidates);
  writeArtifact('_phase473_quality_rules.json', state.qualityRules);
}

async function preflight(): Promise<void> {
  const events = await loadPublishedEvents();
  const validations: unknown[] = [];

  for (const event of events.slice(0, 100)) {
    const candidate = await loadLatestImportCandidate(event.id);
    if (!candidate) {
      continue;
    }
    const bundle = buildCanonicalAttributeBundleFromImport({ candidate, existing: event });
    validations.push({
      eventId: event.id,
      title: event.title,
      before: {
        attributes: parseCanonicalEventAttributes(event.eventAttributes).map((entry) => entry.type),
        floorCount: event.floorCount,
        venueEnvironment: event.venueEnvironment,
      },
      after: {
        attributes: bundle.attributes.map((entry) => entry.type),
        floorCount: bundle.floorCount,
        venueEnvironment: bundle.venueEnvironment,
        reviewRequired: bundle.reviewRequired,
      },
    });
  }

  state.mergeValidation = {
    readOnly: true,
    validationCount: validations.length,
    samples: validations.slice(0, 30),
  };
  writeArtifact('_phase473_merge_validation.json', state.mergeValidation);
}

async function preview(): Promise<void> {
  const events = await loadPublishedEvents();
  const projections: unknown[] = [];

  for (const event of events) {
    const candidate = await loadLatestImportCandidate(event.id);
    const bundle = candidate
      ? buildCanonicalAttributeBundleFromImport({ candidate, existing: event })
      : {
          attributes: parseCanonicalEventAttributes(event.eventAttributes),
          floorCount: event.floorCount,
          stageCount: event.stageCount,
        };
    const badges = projectEventAttributeBadges(bundle.attributes, {
      floorCount: bundle.floorCount,
      stageCount: bundle.stageCount,
    });
    if (badges.length === 0) {
      continue;
    }

    projections.push({
      eventId: event.id,
      title: event.title,
      canonicalAttributes: bundle.attributes.map((entry) => entry.type),
      badges,
      heroBadges: badges,
    });
  }

  state.badgeProjection = projections;
  writeArtifact('_phase473_badge_projection.json', projections);
}

function report(): void {
  const summary = state.summary;
  const inventory = state.inventory as Record<string, unknown>;
  const lines = [
    '# Phase 4.7.3 — Canonical Event Attributes',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|---|---:|`,
    `| Events with canonical attributes | ${summary.eventsWithCanonicalAttributes ?? inventory.eventsWithCanonicalAttributes ?? 'n/a'} |`,
    `| Events with visible badges | ${summary.eventsWithVisibleBadges ?? inventory.eventsWithVisibleBadges ?? 'n/a'} |`,
    `| Missing schema support | ${summary.eventsMissingSchemaSupport ?? 'n/a'} |`,
    `| Blocked by extraction | ${summary.eventsBlockedByExtraction ?? 'n/a'} |`,
    `| Blocked by merge | ${summary.eventsBlockedByMerge ?? 'n/a'} |`,
    `| Blocked by projection | ${summary.eventsBlockedByProjection ?? 'n/a'} |`,
    `| Requiring review | ${summary.eventsRequiringReview ?? 'n/a'} |`,
    '',
    '## Proposed storage model',
    '',
    '```json',
    JSON.stringify(STORAGE_MODEL, null, 2),
    '```',
    '',
    '## Artifacts',
    '',
    '- `docs/ARCHITECTURE_EVENT_ATTRIBUTES.md`',
    '- `docs/real-data/_phase473_attribute_inventory.json`',
    '- `docs/real-data/_phase473_attribute_candidates.json`',
    '- `docs/real-data/_phase473_merge_validation.json`',
    '- `docs/real-data/_phase473_badge_projection.json`',
    '- `docs/real-data/_phase473_quality_rules.json`',
    '',
    'No production mutations executed.',
  ];
  writeFileSync(REPORT, lines.join('\n'), 'utf8');
}

function printSummary(): void {
  const s = state.summary;
  console.log('\n=== Phase 4.7.3 Attribute Summary ===');
  console.log('1. Events with canonical attributes:', s.eventsWithCanonicalAttributes);
  console.log('2. Events with visible badges:', s.eventsWithVisibleBadges);
  console.log('3. Events missing schema support:', s.eventsMissingSchemaSupport);
  console.log('4. Events blocked by extraction:', s.eventsBlockedByExtraction);
  console.log('5. Events blocked by merge:', s.eventsBlockedByMerge);
  console.log('6. Events blocked by projection:', s.eventsBlockedByProjection);
  console.log('7. Events requiring review:', s.eventsRequiringReview);
  console.log('8. Proposed storage model:', STORAGE_MODEL.recommendation);
}

async function run(command: string): Promise<void> {
  switch (command) {
    case 'inventory':
      await inventory();
      break;
    case 'audit':
      await audit();
      break;
    case 'preflight':
      await preflight();
      break;
    case 'preview':
      await preview();
      break;
    case 'report':
      report();
      break;
    case 'full':
      await inventory();
      await audit();
      await preflight();
      await preview();
      report();
      printSummary();
      break;
    default:
      console.error(
        'Usage: npx tsx scripts/operations/_phase473-event-attributes.ts <audit|inventory|preflight|preview|report|full>',
      );
      process.exit(1);
  }
}

void run(process.argv[2] ?? 'full').catch((error) => {
  console.error(error);
  process.exit(1);
});
