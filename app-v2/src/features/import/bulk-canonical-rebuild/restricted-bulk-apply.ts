import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import type { PublishTrackedField } from '@/features/import/services/event-field-provenance-writer';

import { createBulkDetailFetchFn } from './detail-fetch-http';
import {
  ALLOWED_PATCH_FIELDS,
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

    for (const [fieldPath, row] of Object.entries(snapshot.provenanceBefore)) {
      const provenance = row as Record<string, unknown> | null;
      recordDbWrite(counters, 'rollback', 1);
      await deps.restoreProvenanceSnapshot(snapshot.eventId, fieldPath, provenance);
    }

    if (snapshot.sourceReferenceBefore) {
      recordDbWrite(counters, 'rollback', 1);
      await deps.restoreSourceReference(snapshot.sourceReferenceBefore);
    }
    if (snapshot.importRecordBefore) {
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
      const provenanceBefore = await deps.loadProvenanceSnapshot(entry.eventId, [...ALLOWED_PATCH_FIELDS]);
      const sourceReferenceBefore = sourceId
        ? await deps.loadSourceReference(entry.eventId, sourceId)
        : null;
      const importRecordBefore = sourceId
        ? await deps.loadImportRecord(entry.eventId, sourceId)
        : null;

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

      const provenanceFields: PublishTrackedField[] = [];
      for (const field of allowedFields) {
        if (field === 'priceText' || field === 'ticketStatus') {
          provenanceFields.push(field);
        }
      }
      if (provenanceFields.length > 0 && sourceId) {
        recordDbWrite(counters, 'provenance', provenanceFields.length);
        await deps.writeProvenance({
          eventId: entry.eventId,
          sourceId,
          event: afterEvent,
          fields: provenanceFields,
          verifiedAt: entry.verifiedAt ?? undefined,
          externalId: event.ticketUrl,
        });
      }

      if (sourceId) {
        const ref = await deps.loadSourceReference(entry.eventId, sourceId);
        if (ref) {
          recordDbWrite(counters, 'sourceReference', 1);
          await deps.touchSourceReference(entry.eventId, sourceId);
        }
      }
      if (importRecordBefore?.id) {
        recordDbWrite(counters, 'importRecord', 1);
        await deps.touchImportRecord(String(importRecordBefore.id));
      }

      applied.push({
        eventId: entry.eventId,
        eventRowBefore,
        provenanceBefore,
        sourceReferenceBefore,
        importRecordBefore,
        allowedFields,
      });
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
