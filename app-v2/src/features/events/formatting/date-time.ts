/** Fixed demo reference date for sort windows (May 24, 2026). */
export const EVENT_REFERENCE_DATE = new Date('2026-05-24T12:00:00');

const DEFAULT_TIMEZONE = 'Europe/Berlin';

const OFFSET_TIMEZONE_MAP: Record<string, string> = {
  'UTC+00:00': 'UTC',
  'UTC+01:00': 'Europe/Berlin',
  'UTC+02:00': 'Europe/Berlin',
  '+00:00': 'UTC',
  '+01:00': 'Europe/Berlin',
  '+02:00': 'Europe/Berlin',
};

export interface EventDateFields {
  startDateTime: string;
  endDateTime?: string;
  timezone: string;
}

export function getDefaultTimezone(): string {
  return DEFAULT_TIMEZONE;
}

function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Maps offset-style values (e.g. UTC+02:00) to IANA zones for Intl formatters. */
export function normalizeIanaTimezone(
  timezone: string | null | undefined,
  fallback: string = DEFAULT_TIMEZONE,
): string {
  const trimmed = timezone?.trim();
  if (!trimmed) {
    return fallback;
  }

  const normalizedKey = trimmed.toUpperCase().replace(/\s+/g, '');
  const offsetMatch = normalizedKey.match(/^(?:UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (offsetMatch) {
    const sign = offsetMatch[1];
    const hours = offsetMatch[2].padStart(2, '0');
    const minutes = (offsetMatch[3] ?? '00').padStart(2, '0');
    const canonicalOffset = `UTC${sign}${hours}:${minutes}`;
    const mapped =
      OFFSET_TIMEZONE_MAP[canonicalOffset] ??
      OFFSET_TIMEZONE_MAP[`${sign}${hours}:${minutes}`];
    if (mapped) {
      return mapped;
    }

    if (sign === '+' && (hours === '01' || hours === '02')) {
      return DEFAULT_TIMEZONE;
    }
  }

  if (isValidIanaTimezone(trimmed)) {
    return trimmed;
  }

  return fallback;
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
    timeZone: normalizeIanaTimezone(timezone),
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
    timeZone: normalizeIanaTimezone(timezone),
  })
    .format(date)
    .replace('.', '')
    .toUpperCase();
}

export function formatWeekdayLabel(isoDateTime: string, timezone: string): string {
  const date = parseIsoDateTime(isoDateTime);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    timeZone: normalizeIanaTimezone(timezone),
  })
    .format(date)
    .replace('.', '')
    .toUpperCase()
    .slice(0, 2);
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
