import { STADTGARTEN_SOURCE_TIMEZONE } from './constants';

const WEEKDAY_DATE_PATTERN = /^[A-Za-zäöüÄÖÜß]{2,},\s*(\d{2})\.(\d{2})\.(\d{4})$/;
const BEGINN_TIME_PATTERN = /Beginn\s+(\d{1,2}):(\d{2})/i;
const ISO_LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T00:00:00[+-]\d{2}:\d{2}$/;

function lastSundayOfMonth(year: number, month: number): number {
  const finalDay = new Date(Date.UTC(year, month, 0));
  return finalDay.getUTCDate() - finalDay.getUTCDay();
}
function isCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Derive the offset from Berlin LOCAL date and clock time, not server TZ.
 * Reject nonexistent or ambiguous hours during DST clock transitions. */
function berlinOffsetForLocalTime(year: number, month: number, day: number, hour: number): '+01:00' | '+02:00' | null {
  const marchSwitch = lastSundayOfMonth(year, 3);
  const octoberSwitch = lastSundayOfMonth(year, 10);
  if (month === 3 && day === marchSwitch) {
    if (hour === 2) return null;
    return hour < 2 ? '+01:00' : '+02:00';
  }
  if (month === 10 && day === octoberSwitch) {
    if (hour === 2) return null;
    return hour < 2 ? '+02:00' : '+01:00';
  }
  const summer = (month > 3 && month < 10) ||
    (month === 3 && day > marchSwitch) ||
    (month === 10 && day < octoberSwitch);
  return summer ? '+02:00' : '+01:00';
}

export function parseStadtgartenDisplayDate(value: string): string | null {
  const match = value.trim().match(WEEKDAY_DATE_PATTERN);
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  if (!isCalendarDate(year, month, day)) return null;
  const offset = berlinOffsetForLocalTime(year, month, day, 0);
  return match[3] + '-' + match[2] + '-' + match[1] + 'T00:00:00' + offset;
}

export function extractStadtgartenBeginnTime(text: string): { hour: number; minute: number } | null {
  const match = text.match(BEGINN_TIME_PATTERN);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Never call new Date(localMidnight).getDate(): in UTC hosting that
 * returns the PREVIOUS calendar day for Berlin-local midnight. */
export function applyTimeToIsoDate(isoDate: string, hour: number, minute: number): string | null {
  const match = ISO_LOCAL_DATE_PATTERN.exec(isoDate);
  if (!match || !Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (!isCalendarDate(year, month, day)) return null;
  const offset = berlinOffsetForLocalTime(year, month, day, hour);
  if (!offset) return null;
  const hh = String(hour).padStart(2, '0'), mm = String(minute).padStart(2, '0');
  return match[1] + '-' + match[2] + '-' + match[3] + 'T' + hh + ':' + mm + ':00' + offset;
}

export function isValidIsoDateTime(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
export function getStadtgartenSourceTimezone(): string {
  return STADTGARTEN_SOURCE_TIMEZONE;
}
