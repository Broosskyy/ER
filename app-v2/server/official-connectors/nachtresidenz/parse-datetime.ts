import { NACHTRESIDENZ_SOURCE_TIMEZONE } from './constants';

const DATETIME_ATTR_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;

function berlinOffsetForDate(year: number, month: number, day: number): string {
  const lastSunday = (targetMonth: number): Date => {
    const date = new Date(Date.UTC(year, targetMonth, 0));
    const weekday = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - weekday);
    return date;
  };
  const dstStart = lastSunday(3);
  const dstEnd = lastSunday(10);
  const current = Date.UTC(year, month - 1, day);
  return current >= dstStart.getTime() && current < dstEnd.getTime() ? '+02:00' : '+01:00';
}

export function parseNachtresidenzDatetimeAttr(value: string): string | null {
  const match = value.trim().match(DATETIME_ATTR_PATTERN);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second] = match;
  const offset = berlinOffsetForDate(Number(year), Number(month), Number(day));
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

export function isValidIsoDateTime(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function getNachtresidenzSourceTimezone(): string {
  return NACHTRESIDENZ_SOURCE_TIMEZONE;
}
