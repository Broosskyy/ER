import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import type { PublishTrackedField } from '@/features/import/services/event-field-provenance-writer';

import { createBulkDetailFetchFn } from './detail-fetch-http';
import {
  type AllowedPatchField,
  APPROVED_CANDIDATE_FIELDS,
  filterManifestPatch,
  rejectStatusDowngrade,
  rejectWholeRowReplacement,
  type RestrictedBulkManifest,
  type RestrictedBulkManifestEntry,
  type RestrictedBulkWriteCounters,
  recordDbWrite,
} from './restricted-bulk-apply-security';

export interface RestrictedBulkApplyDeps {
  loadEvent: (eventId: string) => Promise<AdminEventRecord>;
  loadEventRowRaw: (eventId: string) => Promise<EventRow>;
  updateEventRow: (eventId: string, patch: Partial<EventRow>) => Promise<void>;
  loadManualLocks: (eventId: string) => Promise<string[]>;
  loadProvenanceSnapshot: (eventId: string, fields: string[]) => Promise<Record<string, unknown>>;
  restoreProvenanceSnapshot: (
    eventId: string,
    fieldPath: string,
    snapshot: Record<string, unknown> | null,
  ) => Promise<void>;
  loadSourceReference: (eventId: string, sourceId: string) => Promise<Record<string, unknown> | null>;
  touchSourceReference: (eventId: string, sourceId: string) => Promise<void>;
  restoreSourceReference: (snapshot: Record<string, unknown>) => Promise<void>;
  loadImportRecord: (eventId: string, sourceId: string) => Promise<Record<string, unknown> | null>;
  touchImportRecord: (recordId: string) => Promise<void>;
  restoreImportRecord: (snapshot: Record<string, unknown>) => Promise<void>;
  loadCandidateEnvelope: (
    sourceId: string,
    ticketUrl: string,
  ) => Promise<CanonicalImportEvent | null>;
  writeProvenance: (input: {
    eventId: string;
    sourceId: string;
    event: AdminEventRecord;
    fields: PublishTrackedField[];
    verifiedAt?: string;
    externalId?: string;
  }) => Promise<void>;
  invalidateConsumerCaches: () => Promise<void>;
  listOtherEventUpdatedAts: (excludeIds: string[]) => Promise<Map<string, string>>;
  now: () => string;
}

export interface PreflightEventResult {
  eventId: string;
  ok: boolean;
  failures: string[];
  liveEvidence?: Record<string, unknown>;
}

export interface AppliedEventSnapshot {
  eventId: string;
  eventRowBefore: Partial<EventRow>;
  provenanceBefore: Record<string, unknown>;
  sourceReferenceBefore: Record<string, unknown> | null;
  importRecordBefore: Record<string, unknown> | null;
  allowedFields: readonly AllowedPatchField[];
  touchedProvenanceFields: PublishTrackedField[];
  touchedSourceReference: boolean;
  touchedImportRecord: boolean;
}

export interface RestrictedBulkReadbackRow {
  eventId: string;
  failures: string[];
  event: Record<string, unknown>;
}

export function computeRestrictedEventFingerprint(event: AdminEventRecord): Record<string, unknown> {
  return {
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    venueName: event.venueName,
    organizerName: event.organizerName,
    websiteUrl: event.websiteUrl,
    ticketUrl: event.ticketUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    genreLabels: event.genreLabels,
    descriptionLength: event.description?.length ?? 0,
  };
}

function stableEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function verifyRestrictedBulkManifestAfter(
  entry: RestrictedBulkManifestEntry,
  event: AdminEventRecord,
): string[] {
  const failures: string[] = [];
  const fingerprint = computeRestrictedEventFingerprint(event);
  const approvedFields = APPROVED_CANDIDATE_FIELDS[entry.eventId] ?? [];

  for (const field of approvedFields) {
    const delta = entry.fieldGroupPatch[field];
    if (!delta) {
      failures.push(`missing_patch:${field}`);
      continue;
    }
    const current = fingerprint[field as keyof typeof fingerprint];
    if (!stableEqual(current, delta.after)) {
      failures.push(`${field}:${String(current)}`);
    }
  }

  for (const [key, value] of Object.entries(entry.beforeFingerprint)) {
    if (key === 'priceText' || key === 'ticketStatus') continue;
    if (!stableEqual(fingerprint[key as keyof typeof fingerprint], value)) {
      failures.push(`protected_field_changed:${key}`);
    }
  }

  if (event.websiteUrl !== entry.beforeFingerprint.websiteUrl) {
    failures.push(`websiteUrl_changed:${event.websiteUrl}`);
  }
  if (event.ticketUrl !== entry.beforeFingerprint.ticketUrl) {
    failures.push(`ticketUrl_changed:${event.ticketUrl}`);
  }

  return failures;
}

export function assertAppliedEventSnapshotComplete(
  snapshot: AppliedEventSnapshot,
  entry: RestrictedBulkManifestEntry,
  sourceId: string,
  options: {
    willWriteProvenance: boolean;
    willTouchSourceReference: boolean;
    willTouchImportRecord: boolean;
  },
): void {
  const failures: string[] = [];
  const manifestPatch = filterManifestPatch(entry);

  for (const field of Object.keys(manifestPatch)) {
    if (field === 'priceText' && snapshot.eventRowBefore.price_text === undefined) {
      failures.push('event_snapshot_missing:price_text');
    }
    if (field === 'ticketStatus' && snapshot.eventRowBefore.ticket_status === undefined) {
      failures.push('event_snapshot_missing:ticket_status');
    }
  }

  if (options.willWriteProvenance) {
    for (const field of snapshot.allowedFields) {
      if (field !== 'priceText' && field !== 'ticketStatus') continue;
      if (!Object.prototype.hasOwnProperty.call(snapshot.provenanceBefore, field)) {
        failures.push(`provenance_snapshot_missing:${field}`);
      }
    }
  }

  if (options.willTouchSourceReference && !snapshot.sourceReferenceBefore) {
    failures.push('source_reference_snapshot_missing');
  }

  if (options.willTouchImportRecord && !snapshot.importRecordBefore) {
    failures.push('import_record_snapshot_missing');
  }

  if (!sourceId && (options.willWriteProvenance || options.willTouchSourceReference)) {
    failures.push('source_id_missing');
  }

  if (failures.length > 0) {
    throw new Error(`snapshot_incomplete:${entry.eventId}:${failures.join(',')}`);
  }
}

function toEventRowPatch(
  manifestPatch: Record<AllowedPatchField, unknown>,
): Partial<EventRow> {
  const patch: Partial<EventRow> = {};
  if (manifestPatch.priceText !== undefined) {
    patch.price_text = manifestPatch.priceText as string;
  }
  if (manifestPatch.ticketStatus !== undefined) {
    patch.ticket_status = manifestPatch.ticketStatus as EventRow['ticket_status'];
  }
  return patch;
}

export async function preflightRestrictedBulkEvent(
  deps: RestrictedBulkApplyDeps,
  entry: RestrictedBulkManifestEntry,
): Promise<PreflightEventResult> {
  const failures: string[] = [];
  const event = await deps.loadEvent(entry.eventId);
  const fingerprint = computeRestrictedEventFingerprint(event);

  if (!stableEqual(fingerprint, entry.beforeFingerprint)) {
    failures.push('fingerprint_drift');
  }

  const approvedFields = APPROVED_CANDIDATE_FIELDS[entry.eventId] ?? [];
  for (const field of approvedFields) {
    const delta = entry.fieldGroupPatch[field];
    if (!delta) {
      failures.push(`missing_patch:${field}`);
      continue;
    }
    const current = fingerprint[field as keyof typeof fingerprint];
    if (!stableEqual(current, delta.before)) {
      failures.push(`before_mismatch:${field}`);
    }
    if (rejectStatusDowngrade(String(delta.before), String(delta.after), field)) {
      failures.push(`status_downgrade:${field}`);
    }
  }

  const locks = await deps.loadManualLocks(entry.eventId);
  for (const field of approvedFields) {
    if (locks.some((lock) => lock === field || lock.includes(field))) {
      failures.push(`manual_lock:${field}`);
    }
  }

  const sourceId = entry.provenancePlan?.[0]?.sourceId;
  if (!sourceId) {
    failures.push('missing_source_id');
  }

  let candidate: CanonicalImportEvent | null = null;
  if (sourceId && event.ticketUrl) {
    candidate = await deps.loadCandidateEnvelope(sourceId, event.ticketUrl);
    if (!candidate) {
      failures.push('candidate_envelope_missing');
    }
  }

  const detailFetchFn = createBulkDetailFetchFn();
  if (event.ticketUrl) {
    const fetchResult = await detailFetchFn(event.ticketUrl);
    if (!fetchResult.html && !fetchResult.error?.includes('not_found')) {
      failures.push(`live_fetch_unavailable:${event.ticketUrl}`);
    }
  }

  if (candidate) {
    const writer = writeCanonicalTicketFields({
      existing: event,
      candidate,
      detailBlocked: false,
    });
    if (entry.identityVerdict && writer.audit.identityVerdict !== entry.identityVerdict) {
      failures.push(`identity_verdict:${writer.audit.identityVerdict}`);
    }
    if (!['exact', 'corroborated'].includes(writer.audit.identityVerdict)) {
      failures.push(`identity_not_secure:${writer.audit.identityVerdict}`);
    }
    const forbidden = rejectWholeRowReplacement(writer.fieldChanges, approvedFields);
    if (forbidden.length > 0) {
      failures.push(`writer_forbidden_fields:${forbidden.join(',')}`);
    }
  }

  return {
    eventId: entry.eventId,
    ok: failures.length === 0,
    failures,
    liveEvidence: {
      identityVerdict: entry.identityVerdict,
      verifiedAt: entry.verifiedAt,
      sourceId,
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
    },
  };
}

export async function runRestrictedBulkPreflight(
  deps: RestrictedBulkApplyDeps,
  plan: RestrictedBulkManifest,
): Promise<{ ok: boolean; results: PreflightEventResult[] }> {
  const results = await Promise.all(plan.entries.map((entry) => preflightRestrictedBulkEvent(deps, entry)));
  return { ok: results.every((result) => result.ok), results };
}

export async function rollbackRestrictedBulkSnapshots(
  deps: RestrictedBulkApplyDeps,
  snapshots: AppliedEventSnapshot[],
  counters: RestrictedBulkWriteCounters,
): Promise<void> {
  for (const snapshot of [...snapshots].reverse()) {
    recordDbWrite(counters, 'event', 1, Object.keys(snapshot.eventRowBefore).length);
    await deps.updateEventRow(snapshot.eventId, snapshot.eventRowBefore);

    for (const fieldPath of snapshot.touchedProvenanceFields) {
      const provenance = snapshot.provenanceBefore[fieldPath] as Record<string, unknown> | null | undefined;
      recordDbWrite(counters, 'rollback', 1);
      await deps.restoreProvenanceSnapshot(snapshot.eventId, fieldPath, provenance ?? null);
    }

    if (snapshot.touchedSourceReference && snapshot.sourceReferenceBefore) {
      recordDbWrite(counters, 'rollback', 1);
      await deps.restoreSourceReference(snapshot.sourceReferenceBefore);
    }
    if (snapshot.touchedImportRecord && snapshot.importRecordBefore) {
      recordDbWrite(counters, 'rollback', 1);
      await deps.restoreImportRecord(snapshot.importRecordBefore);
    }
  }
}

export async function applyRestrictedBulkManifest(
  deps: RestrictedBulkApplyDeps,
  plan: RestrictedBulkManifest,
  counters: RestrictedBulkWriteCounters,
): Promise<{
  ok: boolean;
  applied: AppliedEventSnapshot[];
  error?: string;
  eventResults: Array<Record<string, unknown>>;
}> {
  const applied: AppliedEventSnapshot[] = [];
  const eventResults: Array<Record<string, unknown>> = [];
  const otherUpdatedAts = await deps.listOtherEventUpdatedAts(APPROVED_CANDIDATE_FIELDS ? Object.keys(APPROVED_CANDIDATE_FIELDS) : []);

  try {
    for (const entry of plan.entries.sort((a, b) => a.eventId.localeCompare(b.eventId))) {
      counters.attemptedApplicationEvents += 1;
      const allowedFields = APPROVED_CANDIDATE_FIELDS[entry.eventId] ?? [];
      const manifestPatch = filterManifestPatch(entry);
      const event = await deps.loadEvent(entry.eventId);
      const rawRow = await deps.loadEventRowRaw(entry.eventId);
      const sourceId = entry.provenancePlan?.[0]?.sourceId ?? '';

      const eventRowBefore: Partial<EventRow> = {
        price_text: rawRow.price_text,
        ticket_status: rawRow.ticket_status,
        ticket_phases: rawRow.ticket_phases,
      };
      const provenanceFieldPaths = allowedFields.filter(
        (field): field is PublishTrackedField => field === 'priceText' || field === 'ticketStatus',
      );
      const provenanceBeforeRaw = await deps.loadProvenanceSnapshot(entry.eventId, provenanceFieldPaths);
      const provenanceBefore: Record<string, unknown> = {};
      for (const field of provenanceFieldPaths) {
        provenanceBefore[field] = Object.prototype.hasOwnProperty.call(provenanceBeforeRaw, field)
          ? provenanceBeforeRaw[field]
          : null;
      }
      const sourceReferenceBefore = sourceId
        ? await deps.loadSourceReference(entry.eventId, sourceId)
        : null;
      const importRecordBefore = sourceId
        ? await deps.loadImportRecord(entry.eventId, sourceId)
        : null;
      const existingSourceReference = sourceReferenceBefore;
      const willTouchSourceReference = Boolean(sourceId && existingSourceReference);
      const willTouchImportRecord = Boolean(importRecordBefore?.id);
      const willWriteProvenance = provenanceFieldPaths.length > 0 && Boolean(sourceId);

      const snapshot: AppliedEventSnapshot = {
        eventId: entry.eventId,
        eventRowBefore,
        provenanceBefore,
        sourceReferenceBefore,
        importRecordBefore,
        allowedFields,
        touchedProvenanceFields: [],
        touchedSourceReference: false,
        touchedImportRecord: false,
      };

      assertAppliedEventSnapshotComplete(snapshot, entry, sourceId, {
        willWriteProvenance,
        willTouchSourceReference,
        willTouchImportRecord,
      });
      applied.push(snapshot);

      const rowPatch = toEventRowPatch(manifestPatch);
      recordDbWrite(counters, 'event', 1, Object.keys(rowPatch).length);
      await deps.updateEventRow(entry.eventId, rowPatch);

      const afterEvent: AdminEventRecord = {
        ...event,
        priceText: (manifestPatch.priceText as string | undefined) ?? event.priceText,
        ticketStatus:
          (manifestPatch.ticketStatus as AdminEventRecord['ticketStatus'] | undefined) ??
          event.ticketStatus,
      };

      if (willWriteProvenance) {
        recordDbWrite(counters, 'provenance', provenanceFieldPaths.length);
        await deps.writeProvenance({
          eventId: entry.eventId,
          sourceId,
          event: afterEvent,
          fields: provenanceFieldPaths,
          verifiedAt: entry.verifiedAt ?? undefined,
          externalId: event.ticketUrl,
        });
        snapshot.touchedProvenanceFields = [...provenanceFieldPaths];
      }

      if (willTouchSourceReference) {
        recordDbWrite(counters, 'sourceReference', 1);
        await deps.touchSourceReference(entry.eventId, sourceId);
        snapshot.touchedSourceReference = true;
      }
      if (willTouchImportRecord && importRecordBefore?.id) {
        recordDbWrite(counters, 'importRecord', 1);
        await deps.touchImportRecord(String(importRecordBefore.id));
        snapshot.touchedImportRecord = true;
      }

      counters.successfulApplicationEvents += 1;
      eventResults.push({
        eventId: entry.eventId,
        appliedFields: allowedFields,
        manifestPatch,
      });
    }

    await deps.invalidateConsumerCaches();

    for (const [eventId, updatedAt] of otherUpdatedAts) {
      const row = await deps.loadEventRowRaw(eventId);
      if (row.updated_at !== updatedAt) {
        throw new Error(`other_event_mutated:${eventId}`);
      }
    }

    return { ok: true, applied, eventResults };
  } catch (error) {
    counters.failedApplicationEvents += 1;
    await rollbackRestrictedBulkSnapshots(deps, applied, counters);
    return {
      ok: false,
      applied: [],
      error: error instanceof Error ? error.message : String(error),
      eventResults,
    };
  }
}
