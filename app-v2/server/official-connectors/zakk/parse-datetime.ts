import { ZAKK_SOURCE_TIMEZONE } from './constants';

const GERMAN_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const WEEKDAY_DATE_PATTERN = /^[A-Za-zäöüÄÖÜß]{2,}\.\s*(\d{2})\.(\d{2})\.(\d{4})$/;
const ZAKK_JSON_LD_DATE_PATTERN =
  /^(\d{4}-\d{2}-\d{2})(?:CEST|CET)(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})$/;

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

export function parseZakkGermanDate(value: string): string | null {
  const trimmed = value.trim();
  const directMatch = trimmed.match(GERMAN_DATE_PATTERN);
  if (directMatch) {
    const [, day, month, year] = directMatch;
    const offset = berlinOffsetForDate(Number(year), Number(month), Number(day));
    return `${year}-${month}-${day}T00:00:00${offset}`;
  }

  const weekdayMatch = trimmed.match(WEEKDAY_DATE_PATTERN);
  if (weekdayMatch) {
    const [, day, month, year] = weekdayMatch;
    const offset = berlinOffsetForDate(Number(year), Number(month), Number(day));
    return `${year}-${month}-${day}T00:00:00${offset}`;
  }

  return null;
}

export function parseZakkJsonLdStartDate(value: string): string | null {
  const trimmed = value.trim();
  if (Number.isFinite(Date.parse(trimmed))) {
    return trimmed;
  }

  const match = trimmed.match(ZAKK_JSON_LD_DATE_PATTERN);
  if (!match) {
    return null;
  }

  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}${match[5]}`;
}

export function extractZakkStartTime(text: string): { hour: number; minute: number } | null {
  const beforeEinlass = text.split(/Einlass/i)[0] ?? text;
  const match = beforeEinlass.match(/(\d{1,2})(?:[.:](\d{2}))?\s*Uhr/i);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

export function applyTimeToIsoDate(
  isoDate: string,
  hour: number,
  minute: number,
): string | null {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const offset = berlinOffsetForDate(year, parsed.getMonth() + 1, parsed.getDate());
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${year}-${month}-${day}T${hh}:${mm}:00${offset}`;
}

export function isValidIsoDateTime(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function getZakkSourceTimezone(): string {
  return ZAKK_SOURCE_TIMEZONE;
}
