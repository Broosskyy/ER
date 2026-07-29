import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import type { FieldDifference } from '../domain/matching-types';

const TRACKED_FIELDS: Array<{
  field: string;
  readIncoming: (event: CanonicalImportEvent) => unknown;
  readCanonical: (event: AdminEventRecord) => unknown;
  severity: FieldDifference['severity'];
}> = [
  {
    field: 'title',
    readIncoming: (event) => event.title,
    readCanonical: (event) => event.title,
    severity: 'warning',
  },
  {
    field: 'startDate',
    readIncoming: (event) => event.startDate,
    readCanonical: (event) => event.startDate,
    severity: 'critical',
  },
  {
    field: 'endDate',
    readIncoming: (event) => event.endDate,
    readCanonical: (event) => event.endDate,
    severity: 'warning',
  },
  {
    field: 'description',
    readIncoming: (event) => event.description,
    readCanonical: (event) => event.description,
    severity: 'info',
  },
  {
    field: 'venueName',
    readIncoming: (event) => event.venueName,
    readCanonical: (event) => event.venueName,
    severity: 'warning',
  },
  {
    field: 'ticketUrl',
    readIncoming: (event) => event.ticketUrl,
    readCanonical: (event) => event.ticketUrl,
    severity: 'info',
  },
  {
    field: 'imageUrl',
    readIncoming: (event) => event.imageUrl,
    readCanonical: (event) => event.imageUrl,
    severity: 'info',
  },
  {
    field: 'organizerName',
    readIncoming: (event) => event.organizerName,
    readCanonical: (event) => event.organizerName,
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
  return String(value).trim().toLowerCase();
}

export class MatchConflictDetector {
  detect(incoming: CanonicalImportEvent, canonical: AdminEventRecord): FieldDifference[] {
    const differences: FieldDifference[] = [];

    for (const tracked of TRACKED_FIELDS) {
      const incomingValue = tracked.readIncoming(incoming);
      const canonicalValue = tracked.readCanonical(canonical);
      if (!incomingValue && !canonicalValue) {
        continue;
      }
      if (normalizeComparable(incomingValue) === normalizeComparable(canonicalValue)) {
        continue;
      }
      differences.push({
        field: tracked.field,
        incomingValue,
        canonicalValue,
        severity: tracked.severity,
      });
    }

    return differences;
  }
}

export const matchConflictDetector = new MatchConflictDetector();
