import { STADTGARTEN_SOURCE_TIMEZONE } from './constants';

const WEEKDAY_DATE_PATTERN = /^[A-Za-zäöüÄÖÜß]{2,},\s*(\d{2})\.(\d{2})\.(\d{4})$/;
const BEGINN_TIME_PATTERN = /Beginn\s+(\d{1,2}):(\d{2})/i;

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

export function parseStadtgartenDisplayDate(value: string): string | null {
  const match = value.trim().match(WEEKDAY_DATE_PATTERN);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
  const offset = berlinOffsetForDate(Number(year), Number(month), Number(day));
  return `${year}-${month}-${day}T00:00:00${offset}`;
}

export function extractStadtgartenBeginnTime(text: string): { hour: number; minute: number } | null {
  const match = text.match(BEGINN_TIME_PATTERN);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
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

export function getStadtgartenSourceTimezone(): string {
  return STADTGARTEN_SOURCE_TIMEZONE;
}
