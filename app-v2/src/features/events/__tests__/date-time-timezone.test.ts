import { describe, expect, it } from 'vitest';

import {
  formatDateLabel,
  formatTimeInTimezone,
  formatWeekdayLabel,
  normalizeIanaTimezone,
} from '@/features/events/formatting/date-time';
import { toEventCardViewModel } from '@/features/events/formatting/event-card-view-model';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

const affenkaefigDisplayModel: EventDisplayModel = {
  id: 'affenkaefig-1',
  slug: 'affenkaefig-1',
  title: 'Affenkäfig Night',
  description: 'Techno session',
  image: { uri: 'https://example.com/poster.png' },
  date: '',
  startTime: '',
  venue: 'Affenkäfig',
  city: 'Köln',
  genres: ['Techno'],
  artists: ['DJ Test'],
  source: 'affenkaefig',
  sourceLabel: 'Affenkäfig',
  startsAt: '2026-08-15T20:00:00.000Z',
  startDateTime: '2026-08-15T20:00:00.000Z',
  timezone: 'UTC+02:00',
  status: 'published',
};

describe('normalizeIanaTimezone', () => {
  it('keeps valid IANA zones unchanged', () => {
    expect(normalizeIanaTimezone('Europe/Berlin')).toBe('Europe/Berlin');
    expect(normalizeIanaTimezone('America/New_York')).toBe('America/New_York');
  });

  it('maps offset-style Affenkäfig timezones to Europe/Berlin', () => {
    expect(normalizeIanaTimezone('UTC+02:00')).toBe('Europe/Berlin');
    expect(normalizeIanaTimezone('UTC+01:00')).toBe('Europe/Berlin');
    expect(normalizeIanaTimezone('+02:00')).toBe('Europe/Berlin');
  });

  it('falls back for empty or invalid values', () => {
    expect(normalizeIanaTimezone('')).toBe('Europe/Berlin');
    expect(normalizeIanaTimezone('Not/AZone')).toBe('Europe/Berlin');
  });
});

describe('date-time formatting with offset timezones', () => {
  const isoDateTime = '2026-08-15T20:00:00.000Z';

  it('formats time without throwing for UTC+02:00', () => {
    expect(() => formatTimeInTimezone(isoDateTime, 'UTC+02:00')).not.toThrow();
    expect(formatTimeInTimezone(isoDateTime, 'UTC+02:00')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('formats date label without throwing for UTC+02:00', () => {
    expect(() => formatDateLabel(isoDateTime, 'UTC+02:00')).not.toThrow();
    expect(formatDateLabel(isoDateTime, 'UTC+02:00')).toBeTruthy();
  });

  it('formats weekday label without throwing for UTC+02:00', () => {
    expect(() => formatWeekdayLabel(isoDateTime, 'UTC+02:00')).not.toThrow();
    expect(formatWeekdayLabel(isoDateTime, 'UTC+02:00')).toHaveLength(2);
  });
});

describe('search and home display mapping regression', () => {
  it('maps Affenkäfig events into card view models without runtime errors', () => {
    const card = toEventCardViewModel({
      ...affenkaefigDisplayModel,
      date: formatDateLabel(affenkaefigDisplayModel.startDateTime, affenkaefigDisplayModel.timezone),
      startTime: formatTimeInTimezone(
        affenkaefigDisplayModel.startDateTime,
        affenkaefigDisplayModel.timezone,
      ),
    });

    expect(card.weekdayLabel).toHaveLength(2);
    expect(card.dateLabel).toBeTruthy();
    expect(card.timeLabel).toMatch(/^\d{2}:\d{2}$/);
  });
});
