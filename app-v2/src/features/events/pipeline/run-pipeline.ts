import { DemoSourceAdapter } from '../adapters/demo-source-adapter';
import { LocalJsonAdapter } from '../adapters/local-json-adapter';
import { ManualImportAdapter } from '../adapters/manual-import-adapter';
import type { EventSourceAdapter } from '../adapters/types';
import type { Event } from '../types/event';
import type { EventStatus } from '../types/event-status';
import type { RawEvent } from '../types/raw-event';

import { deduplicateEvents } from './deduplicate';
import { normalizeRawEvent } from './normalize';
import { decideEventStatus } from './status';
import { validateEvent } from './validate';

export interface PipelineEventRecord {
  raw: RawEvent;
  event: Event;
  normalizationErrors: string[];
  normalizationWarnings: string[];
  validationErrors: string[];
  validationWarnings: string[];
  deduplicationVerdict: 'unique' | 'possible_duplicate' | 'confirmed_duplicate';
  deduplicationReason: string;
  matchedEventId?: string;
  status: EventStatus;
  statusReason: string;
}

export interface PipelineReport {
  rawEventCount: number;
  normalizedEventCount: number;
  validEventCount: number;
  warningCount: number;
  rejectedEventCount: number;
  possibleDuplicateCount: number;
  publishedEventCount: number;
  records: PipelineEventRecord[];
  publishedEvents: Event[];
  allEvents: Event[];
}

function isForcedStatus(value: unknown): value is EventStatus {
  return (
    value === 'imported' ||
    value === 'needs_review' ||
    value === 'published' ||
    value === 'rejected' ||
    value === 'cancelled'
  );
}

export function loadRawEventsFromAdapters(adapters: EventSourceAdapter[]): RawEvent[] {
  const rawEvents: RawEvent[] = [];

  for (const adapter of adapters) {
    const config = adapter.validateSourceConfiguration();

    if (!config.valid) {
      console.warn(
        `[event-pipeline] Skipping adapter ${adapter.getSourceName()}: ${config.errors.join(', ')}`,
      );
      continue;
    }

    const loaded = adapter.loadEvents();
    rawEvents.push(...loaded);
  }

  return rawEvents;
}

export function runEventPipeline(
  rawEvents: RawEvent[],
  nowIso: string = new Date().toISOString(),
): PipelineReport {
  const normalizedRecords = rawEvents.map((raw) => {
    const { event, errors, warnings } = normalizeRawEvent(raw, nowIso);
    return { raw, event, normalizationErrors: errors, normalizationWarnings: warnings };
  });

  const dedupeInput = normalizedRecords.map((record) => record.event);
  const dedupeDecisions = deduplicateEvents(dedupeInput);

  const records: PipelineEventRecord[] = normalizedRecords.map((record, index) => {
    const dedupe = dedupeDecisions[index];
    const validation = validateEvent(record.event);
    const forceStatus = isForcedStatus(record.raw.metadata?.forceStatus)
      ? record.raw.metadata.forceStatus
      : undefined;
    const publishInApp =
      record.raw.metadata?.publishInApp === false
        ? false
        : record.raw.source === 'demo'
          ? true
          : record.raw.metadata?.publishInApp === true;

    const statusDecision = decideEventStatus({
      event: record.event,
      normalizationErrors: record.normalizationErrors,
      validation,
      deduplicationVerdict: dedupe?.verdict ?? 'unique',
      forceStatus,
      publishInApp,
    });

    const finalEvent: Event = {
      ...record.event,
      status: statusDecision.status,
      updatedAt: nowIso,
    };

    return {
      raw: record.raw,
      event: finalEvent,
      normalizationErrors: record.normalizationErrors,
      normalizationWarnings: record.normalizationWarnings,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      deduplicationVerdict: dedupe?.verdict ?? 'unique',
      deduplicationReason: dedupe?.reason ?? 'No duplicate match',
      matchedEventId: dedupe?.matchedEventId,
      status: statusDecision.status,
      statusReason: statusDecision.reason,
    };
  });

  const allEvents = records.map((record) => record.event);
  const publishedEvents = records
    .filter((record) => record.status === 'published')
    .map((record) => record.event);

  const validEventCount = records.filter(
    (record) => record.validationErrors.length === 0 && record.normalizationErrors.length === 0,
  ).length;

  const warningCount = records.reduce(
    (count, record) => count + record.validationWarnings.length + record.normalizationWarnings.length,
    0,
  );

  return {
    rawEventCount: rawEvents.length,
    normalizedEventCount: records.length,
    validEventCount,
    warningCount,
    rejectedEventCount: records.filter((record) => record.status === 'rejected').length,
    possibleDuplicateCount: records.filter((record) => record.deduplicationVerdict === 'possible_duplicate').length,
    publishedEventCount: publishedEvents.length,
    records,
    publishedEvents,
    allEvents,
  };
}

export function runDefaultEventPipeline(nowIso?: string): PipelineReport {
  const adapters = [new DemoSourceAdapter(), new ManualImportAdapter(), new LocalJsonAdapter()];
  const rawEvents = loadRawEventsFromAdapters(adapters);
  return runEventPipeline(rawEvents, nowIso);
}

export function logRejectedOrUnpublishedEvents(report: PipelineReport): void {
  for (const record of report.records) {
    if (record.status !== 'published') {
      console.info(
        `[event-pipeline] ${record.event.id} -> ${record.status}: ${record.statusReason}`,
      );
    }
  }
}
