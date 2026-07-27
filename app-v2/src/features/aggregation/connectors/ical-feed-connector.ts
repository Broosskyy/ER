import ICAL from 'ical.js';

import { ICAL_EVENT_FIXTURE } from '@/features/aggregation/fixtures/real-source-fixtures';
import { importFetchService } from '@/features/import/services/import-fetch-service';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent, SourceConnector } from '@/features/aggregation/connectors/types';

function formatIcalDate(value: ICAL.Time): string {
  if (value.isDate) {
    return value.toString().slice(0, 10);
  }
  return value.toJSDate().toISOString();
}

export class IcalFeedConnector implements SourceConnector {
  readonly connectorKey = 'ical_feed' as const;

  async fetchRawEvents(
    _source: AggregationSource,
    importSource: ImportSource,
    _context: PipelineRunContext,
  ): Promise<RawImportedEvent[]> {
    const url = importSource.sourceUrl ?? importSource.website;
    const calendarBody =
      importSource.sourceConfig?.reference?.ical ??
      (url
        ? (
            await importFetchService.fetch({
              url,
              allowedContentTypes: ['text/calendar', 'application/calendar', 'text/plain'],
            })
          ).body
        : ICAL_EVENT_FIXTURE);
    const jcal = ICAL.parse(calendarBody);
    const component = new ICAL.Component(jcal);
    const vevents = component.getAllSubcomponents('vevent');
    const events: RawImportedEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      const externalId = event.uid || `ical-${events.length}`;
      const status = vevent.getFirstPropertyValue('status');
      const eventUrl = event.component.getFirstPropertyValue('url');
      const location = event.location ?? '';

      events.push({
        externalId,
        importId: externalId,
        sourceUrl: typeof eventUrl === 'string' ? eventUrl : url,
        originalLink: typeof eventUrl === 'string' ? eventUrl : url,
        title: event.summary,
        description: event.description,
        startDate: formatIcalDate(event.startDate),
        endDate: event.endDate ? formatIcalDate(event.endDate) : undefined,
        isAllDay: event.startDate.isDate,
        timezone: event.startDate.zone?.tzid,
        venueName: location,
        venueAddress: location,
        organizerName: event.organizer?.replace(/^mailto:/i, ''),
        rawSourceType: 'ical',
        cancelled: status === 'CANCELLED',
        sourceMetadata: { uid: event.uid, status },
      });
    }

    return events;
  }
}
