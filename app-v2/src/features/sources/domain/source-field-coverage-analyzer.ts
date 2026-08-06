import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';
import type { SourceCapabilityField } from '@/features/sources/domain/source-capability-fields';
import { SOURCE_CAPABILITY_FIELDS } from '@/features/sources/domain/source-capability-fields';

export interface FieldCoverageStat {
  field: SourceCapabilityField;
  presentCount: number;
  totalCount: number;
  coveragePercent: number;
}

export interface SourceFieldCoverageReport {
  sourceId: string;
  totalEvents: number;
  fields: FieldCoverageStat[];
  calculatedAt: string;
}

export type CoverageEventInput = Pick<
  CanonicalImportEvent,
  | 'title'
  | 'description'
  | 'artistNames'
  | 'lineupEntries'
  | 'ticketUrl'
  | 'eventUrl'
  | 'genreNames'
  | 'priceText'
  | 'venueName'
  | 'venueAddress'
  | 'latitude'
  | 'longitude'
  | 'doorsOpenAt'
  | 'minimumAge'
  | 'organizerName'
  | 'imageUrl'
  | 'imageUrls'
  | 'sourceMetadata'
>;

function fieldPresent(field: SourceCapabilityField, event: CoverageEventInput): boolean {
  switch (field) {
    case 'title':
      return hasMeaningfulEventValue(event.title);
    case 'description':
      return hasMeaningfulEventValue(event.description);
    case 'lineup':
      return (event.lineupEntries?.length ?? 0) > 0 || (event.artistNames?.length ?? 0) > 0;
    case 'ticketUrl':
      return hasMeaningfulEventValue(event.ticketUrl);
    case 'eventUrl':
      return hasMeaningfulEventValue(event.eventUrl);
    case 'genres':
      return (event.genreNames?.length ?? 0) > 0;
    case 'priceText':
      return hasMeaningfulEventValue(event.priceText);
    case 'ticketStatus': {
      const metadata = event.sourceMetadata as Record<string, unknown> | undefined;
      return hasMeaningfulEventValue(metadata?.ticketStatus ?? metadata?.availability);
    }
    case 'ticketPhases': {
      const metadata = event.sourceMetadata as Record<string, unknown> | undefined;
      const phases = metadata?.ticketPhases;
      return Array.isArray(phases) && phases.length > 0;
    }
    case 'venueName':
      return hasMeaningfulEventValue(event.venueName);
    case 'venueAddress':
      return hasMeaningfulEventValue(event.venueAddress);
    case 'coordinates':
      return typeof event.latitude === 'number' && typeof event.longitude === 'number';
    case 'doorsOpenAt':
      return hasMeaningfulEventValue(event.doorsOpenAt);
    case 'minimumAge':
      return typeof event.minimumAge === 'number' && event.minimumAge > 0;
    case 'attributes': {
      const metadata = event.sourceMetadata as Record<string, unknown> | undefined;
      const attributes = metadata?.attributes;
      return Array.isArray(attributes) ? attributes.length > 0 : hasMeaningfulEventValue(attributes);
    }
    case 'images':
      return hasMeaningfulEventValue(event.imageUrl) || (event.imageUrls?.length ?? 0) > 0;
    case 'timetable': {
      const metadata = event.sourceMetadata as Record<string, unknown> | undefined;
      const timetable = metadata?.timetable;
      return Array.isArray(timetable) ? timetable.length > 0 : hasMeaningfulEventValue(timetable);
    }
    case 'faq': {
      const metadata = event.sourceMetadata as Record<string, unknown> | undefined;
      return hasMeaningfulEventValue(metadata?.faq);
    }
    case 'organizerName':
      return hasMeaningfulEventValue(event.organizerName);
    default:
      return false;
  }
}

export function analyzeFieldCoverage(
  sourceId: string,
  events: CoverageEventInput[],
  calculatedAt = new Date().toISOString(),
): SourceFieldCoverageReport {
  const totalEvents = events.length;
  const fields = SOURCE_CAPABILITY_FIELDS.map((field) => {
    const presentCount = events.filter((event) => fieldPresent(field, event)).length;
    const coveragePercent = totalEvents === 0 ? 0 : Math.round((presentCount / totalEvents) * 100);
    return { field, presentCount, totalCount: totalEvents, coveragePercent };
  });

  return { sourceId, totalEvents, fields, calculatedAt };
}

export function parseCoverageEventFromRecord(
  normalizedPayload?: Record<string, unknown>,
): CoverageEventInput | null {
  if (!normalizedPayload || typeof normalizedPayload !== 'object') {
    return null;
  }
  return normalizedPayload as CoverageEventInput;
}
