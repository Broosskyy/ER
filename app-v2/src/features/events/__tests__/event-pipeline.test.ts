import { describe, expect, it } from 'vitest';

import { ALL_RAW_DEMO_EVENTS } from '../data/raw-demo-events';
import { classifyDuplicate } from '../pipeline/deduplicate';
import { normalizeRawEvent } from '../pipeline/normalize';
import { runDefaultEventPipeline } from '../pipeline/run-pipeline';
import { validateEvent } from '../pipeline/validate';
import { EventRepository } from '../repository/event-repository';
import type { Event } from '../types/event';

describe('normalizeRawEvent', () => {
  it('normalizes a complete raw event', () => {
    const raw = ALL_RAW_DEMO_EVENTS[0]!;
    const { event, errors } = normalizeRawEvent(raw);

    expect(errors).toHaveLength(0);
    expect(event.title).toBe('VOID: Techno Saturday');
    expect(event.city).toBe('Köln');
    expect(event.genres).toEqual(['Techno', 'Hard Techno']);
    expect(event.startDateTime).toContain('2026-05-24');
  });

  it('reports invalid dates without throwing', () => {
    const invalid = ALL_RAW_DEMO_EVENTS.find((item) => item.rawId === 'invalid-date-event')!;
    const { event, errors } = normalizeRawEvent(invalid);

    expect(errors.length).toBeGreaterThan(0);
    expect(event.startDateTime).toBe('');
  });
});

describe('validateEvent', () => {
  it('requires title and valid start date', () => {
    const result = validateEvent({
      id: '',
      slug: 'x',
      title: '',
      description: '',
      startDateTime: 'invalid',
      timezone: 'Europe/Berlin',
      venue: '',
      city: '',
      country: 'Germany',
      genres: [],
      artists: [],
      source: 'demo',
      sourceEventId: 'x',
      status: 'imported',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing title');
    expect(result.errors).toContain('Invalid startDateTime');
  });

  it('validates optional URLs and coordinates', () => {
    const base: Event = {
      id: 'test',
      slug: 'test',
      title: 'Test',
      description: 'Desc',
      startDateTime: '2026-05-24T23:00:00.000Z',
      timezone: 'Europe/Berlin',
      venue: 'Club',
      city: 'Berlin',
      country: 'Germany',
      genres: ['Techno'],
      artists: ['DJ'],
      source: 'demo',
      sourceEventId: 'test',
      ticketUrl: 'not-a-url',
      latitude: 120,
      longitude: 13,
      status: 'imported',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const result = validateEvent(base);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid ticketUrl');
    expect(result.errors).toContain('Invalid latitude');
  });
});

describe('deduplicateEvents', () => {
  it('detects confirmed and possible duplicates', () => {
    const report = runDefaultEventPipeline('2026-05-01T10:00:00.000Z');

    const confirmed = report.records.find((record) => record.event.id === 'confirmed-dup-void');
    const possible = report.records.find((record) => record.event.id === 'possible-dup-void');

    expect(confirmed?.deduplicationVerdict).toBe('confirmed_duplicate');
    expect(confirmed?.status).toBe('rejected');
    expect(possible?.deduplicationVerdict).toBe('possible_duplicate');
    expect(possible?.status).toBe('needs_review');
  });

  it('classifies same source keys as confirmed duplicates', () => {
    const first = normalizeRawEvent(ALL_RAW_DEMO_EVENTS[0]!).event;
    const duplicate = normalizeRawEvent(
      ALL_RAW_DEMO_EVENTS.find((item) => item.rawId === 'confirmed-dup-void')!,
    ).event;

    expect(classifyDuplicate(duplicate, [first]).verdict).toBe('confirmed_duplicate');
  });
});

describe('published pipeline output', () => {
  it('publishes only the five demo app events', () => {
    const report = runDefaultEventPipeline('2026-05-01T10:00:00.000Z');

    expect(report.publishedEventCount).toBe(5);
    expect(report.publishedEvents.map((event) => event.id)).toEqual([
      'void-techno-saturday',
      'klangkuenstler-berghain',
      'fckng-serious',
      'watergate-nights',
      'sisyphos-open-air',
    ]);
  });
});

describe('EventRepository', () => {
  const repository = EventRepository.createDefault();

  it('returns published events only', () => {
    expect(repository.getPublishedEvents()).toHaveLength(5);
    expect(repository.getEventById('invalid-date-event')).toBeUndefined();
    expect(repository.getEventById('void-techno-saturday')?.title).toContain('VOID');
  });

  it('searches by title, artist, venue, city, and genre', () => {
    expect(repository.searchEvents({ query: 'bootshaus' })).toHaveLength(1);
    expect(repository.searchEvents({ query: 'klangkuenstler' })).toHaveLength(1);
    expect(repository.searchEvents({ genre: 'house' }).length).toBeGreaterThan(0);
  });

  it('filters upcoming, week, and month ranges', () => {
    expect(repository.getUpcomingEvents().length).toBeGreaterThan(0);
    expect(repository.getEventsThisWeek().length).toBeGreaterThan(0);
    expect(repository.getEventsThisMonth().length).toBeGreaterThan(0);
  });

  it('returns map events with valid coordinates only', () => {
    const mapEvents = repository.getEventsForMap();
    expect(mapEvents).toHaveLength(5);
    mapEvents.forEach((event) => {
      expect(event.latitude).toBeGreaterThanOrEqual(-90);
      expect(event.longitude).toBeLessThanOrEqual(180);
    });
  });
});
