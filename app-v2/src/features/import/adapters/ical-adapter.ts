import ICAL from 'ical.js';

import { importConfig } from '@/features/import/config/import-config';
import type { ImportSource } from '@/features/import/models/types';
import type {
  ImportAdapterContext,
  ImportAdapterRecordResult,
  ImportSourceAdapter,
} from '@/features/import/adapters/types';
import {
  buildAdapterResult,
  createSkippedRecord,
  processRawCandidate,
} from '@/features/import/adapters/adapter-utils';
import { importFetchService } from '@/features/import/services/import-fetch-service';

function formatIcalDate(value: ICAL.Time): string {
  if (value.isDate) {
    return value.toString().slice(0, 10);
  }
  return value.toJSDate().toISOString();
}

function getEventUrl(event: ICAL.Event): string | undefined {
  const url = event.component.getFirstPropertyValue('url');
  return typeof url === 'string' ? url : undefined;
}

export class IcalImportAdapter implements ImportSourceAdapter {
  readonly adapterKey = 'ical';

  async execute(source: ImportSource, context: ImportAdapterContext) {
    const url = source.sourceUrl ?? source.website;
    if (!url) {
      throw new Error('iCal source requires sourceUrl.');
    }

    const response = await importFetchService.fetch({
      url,
      allowedContentTypes: ['text/calendar', 'application/calendar', 'text/plain'],
    });

    const maxInstances =
      source.sourceConfig?.ical?.maxRecurrenceInstances ?? importConfig.maxRecurrenceInstances;
    const warnings: string[] = [];
    const records: ImportAdapterRecordResult[] = [];
    let skippedCount = 0;

    let jcal: string | unknown[];
    try {
      jcal = ICAL.parse(response.body);
    } catch {
      throw new Error('Invalid iCalendar data.');
    }

    const component = new ICAL.Component(jcal);
    const vevents = component.getAllSubcomponents('vevent');

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent);
        const uid = event.uid || `ical-${skippedCount}`;

        if (event.isRecurring()) {
          const iterator = event.iterator();
          let count = 0;
          while (count < maxInstances) {
            const next = iterator.next();
            if (!next) break;
            records.push(
              this.mapRecurringOccurrence(event, uid, source, url, next, count),
            );
            count += 1;
          }
          if (count >= maxInstances) {
            warnings.push(`Recurrence expansion limited to ${maxInstances} instances for UID ${uid}.`);
          }
          continue;
        }

        records.push(this.mapEvent(event, uid, source, url, 0));
      } catch (error: unknown) {
        skippedCount += 1;
        const message = error instanceof Error ? error.message : 'Invalid VEVENT';
        warnings.push(message);
        records.push(createSkippedRecord(`ical-skip-${skippedCount}`, {}, message));
      }
    }

    await context.log('info', 'ICAL_PARSED', `Parsed ${records.length} iCal events.`);

    return buildAdapterResult(records, warnings, skippedCount, {
      url,
      eventCount: vevents.length,
    });
  }

  private mapRecurringOccurrence(
    event: ICAL.Event,
    uid: string,
    source: ImportSource,
    url: string,
    startTime: ICAL.Time,
    occurrenceIndex: number,
  ): ImportAdapterRecordResult {
    const duration = event.duration;
    const endTime = startTime.clone();
    endTime.addDuration(duration);

    const location = event.location ?? '';
    const geo = event.component.getFirstPropertyValue('geo');
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (typeof geo === 'string') {
      const [lat, lng] = geo.split(';').map(Number);
      latitude = Number.isFinite(lat) ? lat : undefined;
      longitude = Number.isFinite(lng) ? lng : undefined;
    }

    return processRawCandidate(
      {
        externalId: `${uid}#${occurrenceIndex}`,
        sourceUrl: getEventUrl(event) ?? url,
        title: event.summary,
        description: event.description,
        startDate: formatIcalDate(startTime),
        endDate: formatIcalDate(endTime),
        isAllDay: startTime.isDate,
        timezone: startTime.zone?.tzid,
        venueName: location,
        venueAddress: location,
        eventUrl: getEventUrl(event),
        latitude,
        longitude,
        organizerName: event.organizer?.replace(/^mailto:/i, ''),
        rawSourceType: 'ical',
        sourceMetadata: { uid, occurrenceIndex, recurring: true },
        baseUrl: url,
      },
      source,
    );
  }

  private mapEvent(
    event: ICAL.Event,
    externalId: string,
    source: ImportSource,
    url: string,
    occurrenceIndex: number,
  ): ImportAdapterRecordResult {
    const location = event.location ?? '';
    const geo = event.component.getFirstPropertyValue('geo');
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (typeof geo === 'string') {
      const [lat, lng] = geo.split(';').map(Number);
      latitude = Number.isFinite(lat) ? lat : undefined;
      longitude = Number.isFinite(lng) ? lng : undefined;
    }

    const eventUrl = getEventUrl(event);

    return processRawCandidate(
      {
        externalId,
        sourceUrl: eventUrl ?? url,
        title: event.summary,
        description: event.description,
        startDate: formatIcalDate(event.startDate),
        endDate: event.endDate ? formatIcalDate(event.endDate) : undefined,
        isAllDay: event.startDate.isDate,
        timezone: event.startDate.zone?.tzid,
        venueName: location,
        venueAddress: location,
        eventUrl,
        latitude,
        longitude,
        organizerName: event.organizer?.replace(/^mailto:/i, ''),
        rawSourceType: 'ical',
        sourceMetadata: { uid: event.uid, occurrenceIndex },
        baseUrl: url,
      },
      source,
    );
  }
}
