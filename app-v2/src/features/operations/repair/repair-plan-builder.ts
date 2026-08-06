import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { ImportUpdateService, type ImportChangeField } from '@/features/aggregation/services/import-update-service';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { getSourceDisplayLabel } from '@/features/events/formatting/source-display-labels';
import { formatDisplayPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import {
  candidateCanHistoricalRepair,
  eventHasSourceDefaultVenueMisapplied,
  eventNeedsHistoricalRepair,
} from '@/features/import/services/historical-data-repair';
import { isExternalLocationTitle } from '@/features/import/normalization/external-location-from-title';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';
import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveRepairEnvironment } from './repair-environment';
import {
  classifyRepairFieldSafety,
  getRepairFieldSafetyRule,
} from './repair-safety-matrix';
import {
  fingerprintRepairRecord,
  finalizeRepairPlan,
  REPAIR_PLAN_VERSION,
} from './repair-plan';
import type {
  AdminEventSnapshot,
  RepairAuditDataset,
  RepairAuditStaleEvent,
  RepairImportRecordSnapshot,
  RepairPlan,
  RepairPlanBuildResult,
  RepairPlanChange,
  RepairPlanRecordSnapshot,
  RepairPreflightResult,
  RepairProvenanceSnapshot,
} from './repair-plan.types';

const importUpdateService = new ImportUpdateService();

const IMPORT_FIELD_TO_REPAIR_FIELD: Record<ImportChangeField, string> = {
  title: 'title',
  description: 'description',
  startDate: 'startDate',
  endDate: 'endDate',
  venueName: 'venueName',
  ticketUrl: 'ticketUrl',
  priceText: 'priceText',
  artistNames: 'lineup',
  organizerName: 'organizerName',
  imageUrl: 'imageUrl',
  status: 'status',
};

function isNaDescription(value: string | null | undefined): boolean {
  return !value?.trim() || /^n\/a$/i.test(value.trim());
}

function mapRowToAdminSnapshot(row: Record<string, unknown>): AdminEventSnapshot {
  const admin = mapEventRowToAdminRecord(row as never);
  return {
    id: admin.id,
    title: admin.title,
    description: admin.description,
    sourceId: admin.sourceId,
    venueId: admin.venueId,
    venueName: admin.venueName,
    venueCity: admin.venueCity,
    ticketUrl: admin.ticketUrl,
    priceText: admin.priceText,
    imageUrl: admin.imageUrl,
    organizerName: admin.organizerName,
    startDate: admin.startDate,
    endDate: admin.endDate,
    updatedAt: admin.updatedAt,
    canonicalEventId: admin.canonicalEventId,
    artistId: admin.artistId,
  };
}

function payloadToCandidate(
  payload: Record<string, unknown>,
  sourceId: string,
): CanonicalImportEvent | undefined {
  if (!payload.title || !payload.startDate) {
    return undefined;
  }
  return {
    externalId: String(payload.externalId ?? payload.importId ?? ''),
    sourceId: String(payload.sourceId ?? sourceId),
    sourceName: String(payload.sourceName ?? sourceId),
    title: String(payload.title),
    subtitle: payload.subtitle ? String(payload.subtitle) : undefined,
    description: payload.description ? String(payload.description) : undefined,
    startDate: String(payload.startDate),
    endDate: payload.endDate ? String(payload.endDate) : undefined,
    timezone: payload.timezone ? String(payload.timezone) : undefined,
    venueName: payload.venueName ? String(payload.venueName) : undefined,
    venueAddress: payload.venueAddress ? String(payload.venueAddress) : undefined,
    cityName: payload.cityName ? String(payload.cityName) : undefined,
    countryCode: payload.countryCode ? String(payload.countryCode) : undefined,
    artistNames: Array.isArray(payload.artistNames)
      ? payload.artistNames.map((value) => String(value))
      : undefined,
    organizerName: payload.organizerName ? String(payload.organizerName) : undefined,
    ticketUrl: payload.ticketUrl ? String(payload.ticketUrl) : undefined,
    eventUrl: payload.eventUrl ? String(payload.eventUrl) : undefined,
    imageUrl: payload.imageUrl ? String(payload.imageUrl) : undefined,
    priceText: payload.priceText ? String(payload.priceText) : undefined,
    originalLink: payload.originalLink ? String(payload.originalLink) : undefined,
    rawSourceType: (payload.rawSourceType as CanonicalImportEvent['rawSourceType']) ?? 'unknown',
    sourceMetadata:
      payload.sourceMetadata && typeof payload.sourceMetadata === 'object'
        ? (payload.sourceMetadata as Record<string, unknown>)
        : undefined,
  };
}

function createChange(input: {
  entityType: RepairPlanChange['entityType'];
  entityId: string;
  fieldOrRelationship: string;
  currentValue?: unknown;
  proposedValue?: unknown;
  reason: string;
  sourceId?: string;
  originId?: string;
  importRecordId?: string;
  provenance?: RepairProvenanceSnapshot;
  requiresReview?: boolean;
  supported?: boolean;
  recordFingerprint: string;
}): RepairPlanChange {
  const safety = classifyRepairFieldSafety({
    field: input.fieldOrRelationship,
    provenance: input.provenance,
    requiresReview: input.requiresReview,
    supported: input.supported,
  });

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    fieldOrRelationship: input.fieldOrRelationship,
    currentValue: input.currentValue,
    proposedValue: input.proposedValue,
    reason: input.reason,
    sourceId: input.sourceId,
    originId: input.originId,
    importRecordId: input.importRecordId,
    safety,
    fingerprint: fingerprintRepairRecord({
      entityType: input.entityType,
      entityId: input.entityId,
      fieldOrRelationship: input.fieldOrRelationship,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      reason: input.reason,
      safety,
    }),
    recordFingerprint: input.recordFingerprint,
  };
}

function buildImportFieldChanges(input: {
  admin: AdminEventRecord;
  candidate: CanonicalImportEvent;
  importRecord: RepairImportRecordSnapshot;
  provenanceByField: Map<string, RepairProvenanceSnapshot>;
  recordFingerprint: string;
}): RepairPlanChange[] {
  const changeSet = importUpdateService.detectChanges(input.candidate, input.admin, {
    fillOnly: true,
  });
  if (changeSet.changeType !== 'updated') {
    return [];
  }

  const changes: RepairPlanChange[] = [];
  for (const changedField of changeSet.changedFields) {
    const repairField = IMPORT_FIELD_TO_REPAIR_FIELD[changedField];
    const rule = getRepairFieldSafetyRule(repairField);
    const provenance = input.provenanceByField.get(rule?.ownershipField ?? repairField);
    const adminFieldMap: Partial<Record<ImportChangeField, keyof AdminEventRecord>> = {
      title: 'title',
      description: 'description',
      startDate: 'startDate',
      endDate: 'endDate',
      venueName: 'venueName',
      ticketUrl: 'ticketUrl',
      priceText: 'priceText',
      organizerName: 'organizerName',
      imageUrl: 'imageUrl',
      status: 'status',
    };
    const candidateKey = changedField === 'artistNames' ? 'artistNames' : changedField;
    const currentValue = adminFieldMap[changedField]
      ? input.admin[adminFieldMap[changedField]!]
      : undefined;
    const proposedValue = input.candidate[candidateKey as keyof CanonicalImportEvent];

    changes.push(
      createChange({
        entityType: changedField === 'artistNames' ? 'relationship' : 'event',
        entityId: input.admin.id,
        fieldOrRelationship: repairField,
        currentValue,
        proposedValue,
        reason: `detectChanges:${changedField}`,
        sourceId: input.importRecord.sourceId,
        importRecordId: input.importRecord.id,
        provenance,
        requiresReview: !candidateCanHistoricalRepair(input.candidate, input.admin),
        recordFingerprint: input.recordFingerprint,
      }),
    );
  }

  return changes;
}

function buildReasonChanges(input: {
  stale: RepairAuditStaleEvent;
  admin: AdminEventRecord;
  importRecord?: RepairImportRecordSnapshot;
  candidate?: CanonicalImportEvent;
  provenanceByField: Map<string, RepairProvenanceSnapshot>;
  recordFingerprint: string;
}): RepairPlanChange[] {
  const changes: RepairPlanChange[] = [];

  for (const reason of input.stale.reasons) {
    if (reason === 'wrong_bootshaus_external_venue') {
      changes.push(
        createChange({
          entityType: 'event',
          entityId: input.admin.id,
          fieldOrRelationship: 'venueName',
          currentValue: input.admin.venueName,
          proposedValue: input.candidate?.venueName,
          reason,
          sourceId: input.admin.sourceId,
          importRecordId: input.importRecord?.id,
          provenance: input.provenanceByField.get('venueName'),
          requiresReview: !input.candidate,
          supported: Boolean(input.candidate),
          recordFingerprint: input.recordFingerprint,
        }),
        createChange({
          entityType: 'event',
          entityId: input.admin.id,
          fieldOrRelationship: 'venueId',
          currentValue: input.admin.venueId,
          proposedValue: undefined,
          reason,
          sourceId: input.admin.sourceId,
          importRecordId: input.importRecord?.id,
          provenance: input.provenanceByField.get('venueId'),
          requiresReview: false,
          recordFingerprint: input.recordFingerprint,
        }),
      );
    }

    if (reason === 'missing_title_lineup') {
      const proposedArtists = extractArtistsFromEventTitle(input.admin.title ?? '') ?? [];
      changes.push(
        createChange({
          entityType: 'relationship',
          entityId: input.admin.id,
          fieldOrRelationship: 'lineup',
          currentValue: input.stale.lineupCount,
          proposedValue: proposedArtists,
          reason,
          sourceId: input.admin.sourceId,
          provenance: input.provenanceByField.get('lineup'),
          requiresReview: proposedArtists.length === 0,
          recordFingerprint: input.recordFingerprint,
        }),
      );
    }

    if (reason === 'recoverable_description_in_import_record' && input.candidate?.description) {
      changes.push(
        createChange({
          entityType: 'event',
          entityId: input.admin.id,
          fieldOrRelationship: 'description',
          currentValue: input.admin.description,
          proposedValue: input.candidate.description,
          reason,
          sourceId: input.importRecord?.sourceId ?? input.admin.sourceId,
          importRecordId: input.importRecord?.id,
          provenance: input.provenanceByField.get('description'),
          recordFingerprint: input.recordFingerprint,
        }),
      );
    }

    if (reason === 'unknown_provider_label') {
      const projection = projectCanonicalEventFields({
        title: input.admin.title,
        description: input.admin.description,
        venue: input.admin.venueName ?? '',
        city: input.admin.venueCity ?? '',
        artists: [],
        lineup: [],
        priceText: input.admin.priceText,
        source: input.admin.sourceId ?? '',
        ticketUrl: input.admin.ticketUrl,
      });
      changes.push(
        createChange({
          entityType: 'cache',
          entityId: input.admin.id,
          fieldOrRelationship: 'cache',
          currentValue: projection.ticketProviderLabel,
          proposedValue: getSourceDisplayLabel(input.admin.sourceId ?? '', input.admin.ticketUrl),
          reason,
          sourceId: input.admin.sourceId,
          provenance: input.provenanceByField.get('ticketUrl'),
          requiresReview: true,
          recordFingerprint: input.recordFingerprint,
        }),
      );
    }

    if (reason === 'needs_historical_repair' && input.candidate) {
      const importChanges = buildImportFieldChanges({
        admin: input.admin,
        candidate: input.candidate,
        importRecord: input.importRecord!,
        provenanceByField: input.provenanceByField,
        recordFingerprint: input.recordFingerprint,
      });
      changes.push(...importChanges);
    }
  }

  return changes;
}

export async function collectRepairAuditDataset(client: SupabaseClient): Promise<RepairAuditDataset> {
  const { data: events, error } = await client.from('events').select('*').eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }

  const rows = events ?? [];
  const eventIds = rows.map((row) => row.id);

  const { data: lineupRows } = await client
    .from('event_artists')
    .select('event_id')
    .in('event_id', eventIds.length > 0 ? eventIds : ['__none__']);

  const lineupByEvent = new Map<string, number>();
  for (const row of lineupRows ?? []) {
    lineupByEvent.set(row.event_id, (lineupByEvent.get(row.event_id) ?? 0) + 1);
  }

  const { data: importRecords } = await client
    .from('import_records')
    .select('id,resulting_event_id,normalized_payload,source_id,updated_at')
    .in('resulting_event_id', eventIds.length > 0 ? eventIds : ['__none__']);

  const importByEvent = new Map<string, RepairImportRecordSnapshot>();
  for (const record of importRecords ?? []) {
    if (!record.resulting_event_id) {
      continue;
    }
    importByEvent.set(record.resulting_event_id, {
      id: record.id,
      eventId: record.resulting_event_id,
      sourceId: record.source_id,
      updatedAt: record.updated_at ?? undefined,
      normalizedPayload: (record.normalized_payload as Record<string, unknown> | null) ?? undefined,
    });
  }

  const canonicalIds = rows
    .map((row) => row.canonical_event_id ?? row.id)
    .filter((value, index, values) => values.indexOf(value) === index);

  const provenanceByEventId = new Map<string, Map<string, RepairProvenanceSnapshot>>();
  if (canonicalIds.length > 0) {
    const { data: provenanceRows } = await client
      .from('event_field_provenance')
      .select('canonical_event_id,field_path,selected_source_id,selection_reason,manually_overridden,selected_tier,last_changed_at')
      .in('canonical_event_id', canonicalIds);

    for (const row of provenanceRows ?? []) {
      const eventId =
        rows.find(
          (eventRow) =>
            eventRow.canonical_event_id === row.canonical_event_id || eventRow.id === row.canonical_event_id,
        )?.id ?? row.canonical_event_id;
      const byField = provenanceByEventId.get(eventId) ?? new Map<string, RepairProvenanceSnapshot>();
      byField.set(String(row.field_path), {
        fieldPath: String(row.field_path),
        selectedSourceId: String(row.selected_source_id),
        selectionReason: String(row.selection_reason),
        manuallyOverridden: Boolean(row.manually_overridden),
        selectedTier: row.selected_tier ? String(row.selected_tier) : undefined,
        lastChangedAt: row.last_changed_at ? String(row.last_changed_at) : undefined,
      });
      provenanceByEventId.set(eventId, byField);
    }
  }

  const sourceIds = [...new Set(rows.map((row) => row.source_id).filter(Boolean) as string[])].sort();
  const { data: activeJobs } = await client
    .from('import_jobs')
    .select('id,source_id,status')
    .in('source_id', sourceIds.length > 0 ? sourceIds : ['__none__'])
    .in('status', ['pending', 'running']);

  const publishedEvents = rows.map((row) => mapRowToAdminSnapshot(row as Record<string, unknown>));
  const staleEvents: RepairAuditStaleEvent[] = [];

  for (const row of rows) {
    const admin = mapEventRowToAdminRecord(row as never);
    const reasons: string[] = [];
    if (eventNeedsHistoricalRepair(admin)) {
      reasons.push('needs_historical_repair');
    }
    if (eventHasSourceDefaultVenueMisapplied(admin)) {
      reasons.push('source_default_venue_misapplied');
    }
    const titleArtists = extractArtistsFromEventTitle(row.title ?? '') ?? [];
    const lineupCount = lineupByEvent.get(row.id) ?? 0;
    if (titleArtists.length > 0 && lineupCount === 0) {
      reasons.push('missing_title_lineup');
    }
    if (isNaDescription(row.description)) {
      const importRecord = importByEvent.get(row.id);
      const importDesc = importRecord?.normalizedPayload?.description;
      if (typeof importDesc === 'string' && importDesc.trim() && !isNaDescription(importDesc)) {
        reasons.push('recoverable_description_in_import_record');
      } else {
        reasons.push('empty_description');
      }
    }
    const provider = getSourceDisplayLabel(row.source_id ?? '', row.ticket_url ?? undefined);
    if (provider === 'Externe Quelle' && row.ticket_url) {
      reasons.push('unknown_provider_label');
    }
    if (reasons.length > 0) {
      const importRecord = importByEvent.get(row.id);
      staleEvents.push({
        id: row.id,
        title: row.title,
        sourceId: row.source_id ?? undefined,
        reasons,
        venueId: row.venue_id ?? undefined,
        venueName: row.venue_name ?? undefined,
        venueCity: row.venue_city ?? undefined,
        lineupCount,
        titleArtists,
        externalLocationTitle: isExternalLocationTitle(row.title),
        importRecordId: importRecord?.id,
        importRecordUpdatedAt: importRecord?.updatedAt,
      });
    }
  }

  const parityIssues = [];
  for (const event of publishedEvents) {
    const projection = projectCanonicalEventFields({
      title: event.title,
      description: event.description ?? '',
      venue: event.venueName ?? '',
      city: event.venueCity ?? '',
      artists: [],
      lineup: [],
      priceText: event.priceText,
      source: event.sourceId ?? '',
      ticketUrl: event.ticketUrl,
    });
    const cardTicketLabel = projection.displayPriceText ?? event.priceText;
    const formattedPrice = formatDisplayPriceText(event.priceText) ?? event.priceText;
    if ((cardTicketLabel ?? '') !== (formattedPrice ?? '')) {
      parityIssues.push({
        id: event.id,
        field: 'price',
        card: cardTicketLabel,
        formatted: formattedPrice,
      });
    }
    if (projection.ticketProviderLabel === 'Externe Quelle' && event.ticketUrl) {
      parityIssues.push({ id: event.id, field: 'provider', value: projection.ticketProviderLabel });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    publishedEvents,
    staleEvents,
    parityIssues,
    importRecordsByEventId: importByEvent,
    provenanceByEventId,
    activeImportJobs: (activeJobs ?? []).map((job) => ({
      id: job.id,
      sourceId: job.source_id,
      status: job.status,
    })),
    sourceIds,
  };
}

export function buildRepairPreflightResult(
  dataset: RepairAuditDataset,
  mode: RepairPreflightResult['mode'],
  supabaseUrl?: string,
): RepairPreflightResult {
  const env = resolveRepairEnvironment(supabaseUrl);
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  if (dataset.activeImportJobs.length > 0) {
    blockedReasons.push(
      `Active import jobs detected (${dataset.activeImportJobs.length}). Repair planning is blocked until jobs complete.`,
    );
  }

  if (dataset.staleEvents.length === 0) {
    warnings.push('No stale events detected. Plan generation will be skipped.');
  }

  return {
    ok: blockedReasons.length === 0,
    mode,
    environment: env.environment,
    projectId: env.projectId,
    schemaWatermark: env.schemaWatermark,
    repairVersion: env.repairVersion,
    generatedAt: new Date().toISOString(),
    totals: {
      publishedEvents: dataset.publishedEvents.length,
      staleEvents: dataset.staleEvents.length,
      eventsWithImportRecords: dataset.importRecordsByEventId.size,
      activeImportJobs: dataset.activeImportJobs.length,
      parityIssues: dataset.parityIssues.length,
    },
    blockedReasons,
    warnings,
  };
}

export function buildRepairPlanFromDataset(
  dataset: RepairAuditDataset,
  supabaseUrl?: string,
  commit?: string,
): RepairPlan | null {
  if (dataset.staleEvents.length === 0) {
    return null;
  }

  const env = resolveRepairEnvironment(supabaseUrl);
  const changes: RepairPlanChange[] = [];
  const recordSnapshots: RepairPlanRecordSnapshot[] = [];
  const eventIds = dataset.staleEvents.map((event) => event.id).sort();

  for (const stale of dataset.staleEvents) {
    const adminSnapshot = dataset.publishedEvents.find((event) => event.id === stale.id);
    if (!adminSnapshot) {
      continue;
    }
    const admin = mapEventRowToAdminRecord({
      id: adminSnapshot.id,
      title: adminSnapshot.title,
      description: adminSnapshot.description ?? '',
      source_id: adminSnapshot.sourceId ?? null,
      venue_id: adminSnapshot.venueId ?? null,
      venue_name: adminSnapshot.venueName ?? null,
      venue_city: adminSnapshot.venueCity ?? null,
      ticket_url: adminSnapshot.ticketUrl ?? null,
      price_text: adminSnapshot.priceText ?? null,
      image_url: adminSnapshot.imageUrl ?? null,
      organizer_name: adminSnapshot.organizerName ?? null,
      start_date: adminSnapshot.startDate,
      end_date: adminSnapshot.endDate ?? null,
      updated_at: adminSnapshot.updatedAt ?? null,
      canonical_event_id: adminSnapshot.canonicalEventId ?? null,
      artist_id: adminSnapshot.artistId ?? null,
      status: 'published',
    } as never);

    const importRecord = dataset.importRecordsByEventId.get(stale.id);
    const candidate = importRecord?.normalizedPayload
      ? payloadToCandidate(importRecord.normalizedPayload, importRecord.sourceId)
      : undefined;
    const provenanceByField = dataset.provenanceByEventId.get(stale.id) ?? new Map();
    const recordFingerprint = fingerprintRepairRecord({
      event: adminSnapshot,
      importRecordUpdatedAt: importRecord?.updatedAt,
    });

    recordSnapshots.push({
      entityType: 'event',
      entityId: stale.id,
      fingerprint: recordFingerprint,
      updatedAt: adminSnapshot.updatedAt,
      importRecordUpdatedAt: importRecord?.updatedAt,
    });

    changes.push(
      ...buildReasonChanges({
        stale,
        admin,
        importRecord,
        candidate,
        provenanceByField,
        recordFingerprint,
      }),
    );
  }

  const uniqueChanges = new Map<string, RepairPlanChange>();
  for (const change of changes) {
    uniqueChanges.set(`${change.entityType}:${change.entityId}:${change.fieldOrRelationship}:${change.reason}`, change);
  }

  const draft = {
    planVersion: REPAIR_PLAN_VERSION,
    planId: `repair-${fingerprintRepairRecord({ eventIds, changes: [...uniqueChanges.values()] }).slice(0, 12)}`,
    repairVersion: env.repairVersion,
    generatedAt: new Date().toISOString(),
    environment: env.environment,
    projectId: env.projectId,
    commit,
    schemaWatermark: env.schemaWatermark,
    connectorVersions: env.connectorVersions,
    parserVersions: env.parserVersions,
    sourceIds: dataset.sourceIds,
    eventIds,
    datasetFingerprint: fingerprintRepairRecord({
      publishedEvents: dataset.publishedEvents.length,
      staleEvents: dataset.staleEvents.map((event) => ({ id: event.id, reasons: event.reasons })),
      parityIssues: dataset.parityIssues.length,
    }),
    recordSnapshots,
    changes: [...uniqueChanges.values()],
    safetyAssertions: [
      'read_only_plan_only',
      'apply_compile_time_absent',
      'manual_lock_blocks_field_changes',
      'missing_provenance_blocks_field_changes',
      'no_silent_overwrite',
    ],
  };

  return finalizeRepairPlan(draft);
}

export async function buildRepairPlan(
  client: SupabaseClient,
  options: { supabaseUrl?: string; commit?: string } = {},
): Promise<RepairPlanBuildResult> {
  const dataset = await collectRepairAuditDataset(client);
  const preflight = buildRepairPreflightResult(dataset, 'plan', options.supabaseUrl);

  if (!preflight.ok) {
    return { plan: null, preflight };
  }

  const plan = buildRepairPlanFromDataset(dataset, options.supabaseUrl, options.commit);
  return { plan, preflight };
}

export async function runRepairPreflight(
  client: SupabaseClient,
  supabaseUrl?: string,
): Promise<RepairPreflightResult> {
  const dataset = await collectRepairAuditDataset(client);
  return buildRepairPreflightResult(dataset, 'preflight', supabaseUrl);
}
