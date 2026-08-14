import { BOOTSHAUS_SOURCE_TIMEZONE } from './constants';

const DISPLAY_DATETIME_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/;

function isBerlinDaylightSavingTime(year: number, month: number, day: number): boolean {
  const lastSunday = (targetMonth: number): Date => {
    const date = new Date(Date.UTC(year, targetMonth, 0));
    const weekday = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - weekday);
    return date;
  };

  const dstStart = lastSunday(3);
  const dstEnd = lastSunday(10);
  const current = Date.UTC(year, month - 1, day);
  return current >= dstStart.getTime() && current < dstEnd.getTime();
}

export function parseBootshausDisplayDateTime(value: string): string | null {
  const match = value.trim().match(DISPLAY_DATETIME_PATTERN);
  if (!match) {
    return null;
  }

  const [, day, month, year, hour, minute] = match;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const numericHour = Number(hour);
  const numericMinute = Number(minute);

  if (
    Number.isNaN(numericYear) ||
    Number.isNaN(numericMonth) ||
    Number.isNaN(numericDay) ||
    Number.isNaN(numericHour) ||
    Number.isNaN(numericMinute)
  ) {
    return null;
  }

  const offset = isBerlinDaylightSavingTime(numericYear, numericMonth, numericDay)
    ? '+02:00'
    : '+01:00';

  return `${year}-${month}-${day}T${hour}:${minute}:00${offset}`;
}

export function isValidIsoDateTime(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function isEndAfterStart(startsAt: string, endsAt: string): boolean {
  return Date.parse(endsAt) >= Date.parse(startsAt);
}

export function getSourceTimezone(): string {
  return BOOTSHAUS_SOURCE_TIMEZONE;
}
