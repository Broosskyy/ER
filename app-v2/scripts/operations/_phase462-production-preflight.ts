/**
 * Phase 4.6.2 — Read-only production preflight (no writes).
 * Run: npx tsx scripts/operations/_phase462-production-preflight.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import { buildImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';
import { normalizeTicketOffersFromCandidate } from '@/features/import/domain/canonical-ticket-phase';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { eventNeedsHistoricalRepair } from '@/features/import/services/historical-data-repair';
import { opsClient } from './ops-supabase-rows';

const OUT_JSON = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_phase462_production_preflight.json',
);
const OUT_MD = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/PHASE_462_PRODUCTION_PREFLIGHT.md',
);

const TARGET_SOURCE_PATTERNS = [
  'bootshaus',
  'affenk',
  'musik-die-mich-antreibt',
  'musik_die_mich_antreibt',
  'ticket.io',
  'ticket_io',
  'ticket-king',
  'ticket_king',
];

const REIMPORT_BATCH_ORDER = [
  'source-bootshaus-koeln',
  'source-affenkaefig',
  'source-musik-die-mich-antreibt',
  'ticket_platform active shops (Ticket.io)',
  'ticket_platform enrichment (Ticket.io)',
  'ticket_king affected shops',
];

interface SourceRow {
  id: string;
  display_name?: string;
  source_type?: string;
  active?: boolean;
  adapter_key?: string;
}

interface ImportSnippet {
  id: string;
  source_id: string;
  resulting_event_id?: string | null;
  normalized_payload?: Record<string, unknown> | null;
  external_id?: string;
}

interface ProvenanceRow {
  canonical_event_id: string;
  field_path: string;
  selected_source_id?: string | null;
}

function isTargetSource(source: SourceRow): boolean {
  const haystack = `${source.id} ${source.display_name ?? ''} ${source.adapter_key ?? ''}`.toLowerCase();
  return TARGET_SOURCE_PATTERNS.some((needle) => haystack.includes(needle));
}

function isTicketIoSource(source: SourceRow): boolean {
  const haystack = `${source.id} ${source.adapter_key ?? ''}`.toLowerCase();
  return source.source_type === 'ticket_platform' && /ticket/.test(haystack);
}

function candidateFromPayload(
  payload: Record<string, unknown>,
  source: SourceRow,
  externalId: string,
): CanonicalImportEvent {
  return {
    externalId: externalId,
    sourceId: source.id,
    sourceName: source.display_name ?? source.id,
    title: String(payload.title ?? ''),
    description: typeof payload.description === 'string' ? payload.description : undefined,
    startDate: String(payload.startDate ?? ''),
    endDate: typeof payload.endDate === 'string' ? payload.endDate : undefined,
    timezone: typeof payload.timezone === 'string' ? payload.timezone : undefined,
    venueName: typeof payload.venueName === 'string' ? payload.venueName : undefined,
    venueAddress: typeof payload.venueAddress === 'string' ? payload.venueAddress : undefined,
    cityName: typeof payload.cityName === 'string' ? payload.cityName : undefined,
    countryCode: typeof payload.countryCode === 'string' ? payload.countryCode : undefined,
    latitude: typeof payload.latitude === 'number' ? payload.latitude : undefined,
    longitude: typeof payload.longitude === 'number' ? payload.longitude : undefined,
    genreNames: Array.isArray(payload.genreNames)
      ? payload.genreNames.map(String)
      : undefined,
    organizerName: typeof payload.organizerName === 'string' ? payload.organizerName : undefined,
    ticketUrl: typeof payload.ticketUrl === 'string' ? payload.ticketUrl : undefined,
    eventUrl: typeof payload.eventUrl === 'string' ? payload.eventUrl : undefined,
    imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : undefined,
    priceText: typeof payload.priceText === 'string' ? payload.priceText : undefined,
    minimumAge: typeof payload.minimumAge === 'number' ? payload.minimumAge : undefined,
    rawSourceType: 'json_ld',
    sourceMetadata:
      payload.sourceMetadata && typeof payload.sourceMetadata === 'object'
        ? (payload.sourceMetadata as Record<string, unknown>)
        : undefined,
  };
}

function listMissingFields(event: ReturnType<typeof mapEventRowToAdminRecord>): string[] {
  const missing: string[] = [];
  if (!event.latitude || !event.longitude) missing.push('coordinates');
  if (!event.ageRestriction) missing.push('ageRestriction');
  if (!event.venueAddress) missing.push('venueAddress');
  if (!event.venuePostalCode) missing.push('venuePostalCode');
  if (!event.venueCountryCode) missing.push('venueCountryCode');
  if (!event.doorsOpenAt) missing.push('doorsOpenAt');
  if (!event.timezone) missing.push('timezone');
  if (!event.organizerName && !event.organizerId) missing.push('organizer');
  if (!event.description?.trim()) missing.push('description');
  if (!event.genreLabels?.length && !event.genreId) missing.push('genres');
  if (!event.priceText) missing.push('priceText');
  if (!event.ticketPhases?.length) missing.push('ticketPhases');
  return missing;
}

async function main(): Promise<void> {
  const client = opsClient();

  const { data: sources, error: sourceError } = await client
    .from('sources')
    .select('id,display_name,source_type,active,adapter_key');
  if (sourceError) {
    throw new Error(sourceError.message);
  }

  const targetSources = ((sources ?? []) as SourceRow[]).filter(
    (source) => source.active && (isTargetSource(source) || isTicketIoSource(source)),
  );
  const targetSourceIds = targetSources.map((source) => source.id);

  const { data: events, error: eventError } = await client
    .from('events')
    .select('*')
    .eq('status', 'published')
    .in('source_id', targetSourceIds.length > 0 ? targetSourceIds : ['__none__']);
  if (eventError) {
    throw new Error(eventError.message);
  }

  const eventRows = (events ?? []) as EventRow[];
  const eventIds = eventRows.map((row) => row.id);

  const { data: importRecords } = await client
    .from('import_records')
    .select('id,source_id,resulting_event_id,normalized_payload,external_id')
    .in('resulting_event_id', eventIds.length > 0 ? eventIds : ['__none__']);

  const importByEvent = new Map<string, ImportSnippet>();
  for (const record of (importRecords ?? []) as ImportSnippet[]) {
    if (record.resulting_event_id) {
      importByEvent.set(record.resulting_event_id, record);
    }
  }

  const { data: provenanceRows } = await client
    .from('event_field_provenance')
    .select('canonical_event_id,field_path,selected_source_id')
    .in('canonical_event_id', eventIds.length > 0 ? eventIds : ['__none__']);

  const provenanceByEvent = new Map<string, ProvenanceRow[]>();
  for (const row of (provenanceRows ?? []) as ProvenanceRow[]) {
    const list = provenanceByEvent.get(row.canonical_event_id) ?? [];
    list.push(row);
    provenanceByEvent.set(row.canonical_event_id, list);
  }

  const { data: originRows } = await client
    .from('event_source_references')
    .select('canonical_event_id')
    .in('canonical_event_id', eventIds.length > 0 ? eventIds : ['__none__'])
    .eq('active', true);

  const originCountByEvent = new Map<string, number>();
  for (const row of (originRows ?? []) as { canonical_event_id: string }[]) {
    originCountByEvent.set(row.canonical_event_id, (originCountByEvent.get(row.canonical_event_id) ?? 0) + 1);
  }

  let expectedUpdates = 0;
  let expectedUnchanged = 0;
  let expectedBlocked = 0;
  let recoverableOffers = 0;
  let recoverableLineups = 0;
  let recoverableDescriptions = 0;

  const affectedEvents = eventRows.map((row) => {
    const admin = mapEventRowToAdminRecord(row);
    const missing = listMissingFields(admin);
    const importRecord = importByEvent.get(row.id);
    const source = targetSources.find((entry) => entry.id === row.source_id);
    const payload = (importRecord?.normalized_payload ?? {}) as Record<string, unknown>;
    const candidate =
      source && importRecord
        ? candidateFromPayload(payload, source, importRecord.external_id ?? importRecord.id)
        : undefined;

    const recoverable: string[] = [];
    if (candidate) {
      const patch = buildImportPublishFieldPatch(candidate, { existing: admin });
      if (missing.includes('coordinates') && patch.latitude && patch.longitude) recoverable.push('coordinates');
      if (missing.includes('ageRestriction') && patch.ageRestriction) recoverable.push('ageRestriction');
      if (missing.includes('venueAddress') && patch.venueAddress) recoverable.push('venueAddress');
      if (missing.includes('doorsOpenAt') && patch.doorsOpenAt) recoverable.push('doorsOpenAt');
      if (missing.includes('description') && patch.description) recoverable.push('description');
      if (missing.includes('genres') && patch.genreLabels?.length) recoverable.push('genres');
      if (missing.includes('priceText') && patch.priceText) recoverable.push('priceText');
      if (missing.includes('ticketPhases') && patch.ticketPhases?.length) recoverable.push('ticketPhases');

      const offers = normalizeTicketOffersFromCandidate(candidate);
      if (offers?.length) recoverableOffers += 1;
      if (Array.isArray(payload.artistNames) && payload.artistNames.length > 0) recoverableLineups += 1;
      if (typeof payload.description === 'string' && payload.description.trim()) recoverableDescriptions += 1;

      const wouldChange = recoverable.length > 0;
      if (wouldChange) expectedUpdates += 1;
      else expectedUnchanged += 1;
    } else {
      expectedBlocked += 1;
    }

    const provenance = provenanceByEvent.get(row.id) ?? [];
    const manualLocks = provenance.filter((entry) => entry.selected_source_id === 'manual_override');

    return {
      eventId: row.id,
      title: row.title,
      sourceId: row.source_id,
      missingFields: missing,
      recoverableAfterMapper: recoverable,
      duplicateRisk: Boolean(row.duplicate_group_id),
      canonicalMatchStatus: row.canonical_event_id ? 'linked' : 'self-canonical',
      originCount: originCountByEvent.get(row.id) ?? 0,
      manualLockConflicts: manualLocks.map((entry) => entry.field_path),
      needsHistoricalRepair: eventNeedsHistoricalRepair(admin),
    };
  });

  const migrationPrerequisites = [
    'Deploy 20260802100000_phase462_publish_fields_and_ticket_phases.sql',
    'Deploy 20260801120000_phase46_entity_follows.sql only when follow UX approved',
    'Verify validate:build-output passes after web bundle split',
    'Enable genericSourceFieldTrustMerge in target environment',
  ];

  const goMigration = migrationPrerequisites.every((item) => !item.includes('only when'));
  const goReimport = goMigration && expectedUpdates > 0;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read_only',
    affectedSources: targetSources.map((source) => ({
      id: source.id,
      displayName: source.display_name,
      sourceType: source.source_type,
      connectorKey: source.adapter_key,
    })),
    totals: {
      affectedSources: targetSources.length,
      affectedEvents: eventRows.length,
      expectedUpdates,
      expectedUnchanged,
      expectedBlocked,
      recoverableTicketOffers: recoverableOffers,
      recoverableLineups,
      recoverableDescriptions,
    },
    recommendedReimportBatch: REIMPORT_BATCH_ORDER,
    migrationPrerequisites,
    goNoGo: {
      migration: goMigration ? 'go' : 'no_go',
      reimport: goReimport ? 'go' : 'no_go',
    },
    events: affectedEvents,
  };

  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  const md = [
    '# Phase 4.6.2 Production Preflight',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    `- Affected sources: ${report.totals.affectedSources}`,
    `- Affected events: ${report.totals.affectedEvents}`,
    `- Expected updates: ${report.totals.expectedUpdates}`,
    `- Expected unchanged: ${report.totals.expectedUnchanged}`,
    `- Expected blocked (no import record): ${report.totals.expectedBlocked}`,
    `- Ticket offers recoverable: ${report.totals.recoverableTicketOffers}`,
    `- Lineups recoverable: ${report.totals.recoverableLineups}`,
    `- Descriptions recoverable: ${report.totals.recoverableDescriptions}`,
    '',
    '## Go / No-Go',
    `- Migration: **${report.goNoGo.migration}**`,
    `- Re-import: **${report.goNoGo.reimport}**`,
    '',
    '## Recommended re-import order',
    ...REIMPORT_BATCH_ORDER.map((entry, index) => `${index + 1}. ${entry}`),
    '',
    '## Migration prerequisites',
    ...migrationPrerequisites.map((entry) => `- ${entry}`),
    '',
    `Full JSON: docs/real-data/_phase462_production_preflight.json`,
  ].join('\n');

  writeFileSync(OUT_MD, md);
  console.log(JSON.stringify({ ok: true, outJson: OUT_JSON, outMd: OUT_MD, totals: report.totals, goNoGo: report.goNoGo }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
