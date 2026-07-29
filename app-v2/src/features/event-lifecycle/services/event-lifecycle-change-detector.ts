import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import type { EventLifecycleFieldChange, LifecycleEventType } from '../domain/lifecycle-engine-types';

const TRACKED_FIELDS: Array<{
  fieldPath: string;
  readFromRecord: (record: AdminEventRecord) => unknown;
  readFromCandidate?: (candidate: CanonicalImportEvent) => unknown;
  lifecycleEventType: LifecycleEventType;
  severity: EventLifecycleFieldChange['severity'];
}> = [
  {
    fieldPath: 'startDate',
    readFromRecord: (record) => record.startDate,
    readFromCandidate: (candidate) => candidate.startDate,
    lifecycleEventType: 'event_moved',
    severity: 'critical',
  },
  {
    fieldPath: 'endDate',
    readFromRecord: (record) => record.endDate,
    readFromCandidate: (candidate) => candidate.endDate,
    lifecycleEventType: 'time_changed',
    severity: 'warning',
  },
  {
    fieldPath: 'venueName',
    readFromRecord: (record) => record.venueName,
    readFromCandidate: (candidate) => candidate.venueName,
    lifecycleEventType: 'venue_changed',
    severity: 'warning',
  },
  {
    fieldPath: 'organizerName',
    readFromRecord: (record) => record.organizerName,
    readFromCandidate: (candidate) => candidate.organizerName,
    lifecycleEventType: 'organizer_changed',
    severity: 'info',
  },
  {
    fieldPath: 'festivalEditionId',
    readFromRecord: (record) => record.festivalEditionId,
    lifecycleEventType: 'festival_edition_changed',
    severity: 'warning',
  },
  {
    fieldPath: 'ticketUrl',
    readFromRecord: (record) => record.ticketUrl,
    readFromCandidate: (candidate) => candidate.ticketUrl,
    lifecycleEventType: 'ticket_link_changed',
    severity: 'info',
  },
  {
    fieldPath: 'description',
    readFromRecord: (record) => record.description,
    readFromCandidate: (candidate) => candidate.description,
    lifecycleEventType: 'description_changed',
    severity: 'info',
  },
  {
    fieldPath: 'imageUrl',
    readFromRecord: (record) => record.imageUrl,
    readFromCandidate: (candidate) => candidate.imageUrl,
    lifecycleEventType: 'image_changed',
    severity: 'info',
  },
];

function normalizeComparable(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).sort().join('|');
  }
  return String(value).trim();
}

export class EventLifecycleChangeDetector {
  detect(
    before: AdminEventRecord | null | undefined,
    after: AdminEventRecord,
    candidate?: CanonicalImportEvent,
    options: { cancelled?: boolean; postponed?: boolean } = {},
  ): EventLifecycleFieldChange[] {
    if (!before) {
      return [
        {
          fieldPath: 'id',
          oldValue: null,
          newValue: after.id,
          severity: 'info',
          lifecycleEventType: 'event_created',
        },
      ];
    }

    const changes: EventLifecycleFieldChange[] = [];

    if (options.cancelled && !before.cancelledAt) {
      changes.push({
        fieldPath: 'cancelledAt',
        oldValue: before.cancelledAt ?? null,
        newValue: after.cancelledAt ?? new Date().toISOString(),
        severity: 'critical',
        lifecycleEventType: 'event_cancelled',
      });
    } else if (!options.cancelled && before.cancelledAt && !after.cancelledAt) {
      changes.push({
        fieldPath: 'cancelledAt',
        oldValue: before.cancelledAt,
        newValue: null,
        severity: 'critical',
        lifecycleEventType: 'event_reactivated',
      });
    }

    if (options.postponed && !before.postponedAt) {
      changes.push({
        fieldPath: 'postponedAt',
        oldValue: before.postponedAt ?? null,
        newValue: after.postponedAt ?? new Date().toISOString(),
        severity: 'critical',
        lifecycleEventType: 'event_postponed',
      });
    }

    if (before.status !== 'archived' && after.status === 'archived') {
      changes.push({
        fieldPath: 'status',
        oldValue: before.status,
        newValue: after.status,
        severity: 'critical',
        lifecycleEventType: 'event_archived',
      });
    }

    for (const tracked of TRACKED_FIELDS) {
      const oldValue = tracked.readFromRecord(before);
      const newValue =
        tracked.readFromCandidate && candidate
          ? tracked.readFromCandidate(candidate)
          : tracked.readFromRecord(after);
      if (normalizeComparable(oldValue) === normalizeComparable(newValue)) {
        continue;
      }
      changes.push({
        fieldPath: tracked.fieldPath,
        oldValue,
        newValue,
        severity: tracked.severity,
        lifecycleEventType: tracked.lifecycleEventType,
      });
    }

    if (candidate?.artistNames && candidate.artistNames.length > 0) {
      const previousArtists = (before as AdminEventRecord & { artistNames?: string[] }).artistNames ?? [];
      if (normalizeComparable(previousArtists) !== normalizeComparable(candidate.artistNames)) {
        changes.push({
          fieldPath: 'artistNames',
          oldValue: previousArtists,
          newValue: candidate.artistNames,
          severity: 'info',
          lifecycleEventType: 'lineup_changed',
        });
      }
    }

    return changes;
  }
}

export const eventLifecycleChangeDetector = new EventLifecycleChangeDetector();
