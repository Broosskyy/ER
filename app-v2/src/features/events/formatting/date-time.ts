/** Fixed demo reference date for sort windows (May 24, 2026). */
export const EVENT_REFERENCE_DATE = new Date('2026-05-24T12:00:00');

const DEFAULT_TIMEZONE = 'Europe/Berlin';

export interface EventDateFields {
  startDateTime: string;
  endDateTime?: string;
  timezone: string;
}

export function getDefaultTimezone(): string {
  return DEFAULT_TIMEZONE;
}

export function parseIsoDateTime(value: string): Date | null {
  if (!value || value.trim() === '') {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function isValidIsoDateTime(value: string): boolean {
  return parseIsoDateTime(value) !== null;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function formatTimeInTimezone(isoDateTime: string, timezone: string): string {
  const date = parseIsoDateTime(isoDateTime);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

export function formatDateLabel(isoDateTime: string, timezone: string): string {
  const date = parseIsoDateTime(isoDateTime);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    timeZone: timezone,
  })
    .format(date)
    .replace('.', '')
    .toUpperCase();
}

export function formatEventTimeRange(event: EventDateFields): string {
  const start = formatTimeInTimezone(event.startDateTime, event.timezone);

  if (!event.endDateTime) {
    return start;
  }

  const end = formatTimeInTimezone(event.endDateTime, event.timezone);
  return `${start} – ${end}`;
}

export function formatEventDateTime(event: EventDateFields): string {
  const dateLabel = formatDateLabel(event.startDateTime, event.timezone);
  return `${dateLabel} · ${formatEventTimeRange(event)}`;
}

export function isUpcomingEvent(
  event: EventDateFields,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  const eventDate = parseIsoDateTime(event.startDateTime);

  if (!eventDate) {
    return false;
  }

  return eventDate >= startOfDay(referenceDate);
}

export function isThisWeekEvent(
  event: EventDateFields,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  const eventDate = parseIsoDateTime(event.startDateTime);

  if (!eventDate) {
    return false;
  }

  const referenceStart = startOfDay(referenceDate);
  const weekEnd = endOfDay(addDays(referenceStart, 6));

  return eventDate >= referenceStart && eventDate <= weekEnd;
}

export function isThisMonthEvent(
  event: EventDateFields,
  referenceDate: Date = EVENT_REFERENCE_DATE,
): boolean {
  const eventDate = parseIsoDateTime(event.startDateTime);

  if (!eventDate) {
    return false;
  }

  const referenceStart = startOfDay(referenceDate);
  const monthEnd = endOfMonth(referenceStart);

  return eventDate >= referenceStart && eventDate <= monthEnd;
}
