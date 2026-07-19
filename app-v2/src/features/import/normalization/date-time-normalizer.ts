import type { ValidationIssue } from '@/features/import/validation/validation-codes';

export interface ParsedDateResult {
  isoDate?: string;
  timezone?: string;
  isAllDay?: boolean;
  valid: boolean;
  warnings: ValidationIssue[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function parseImportDate(
  value: unknown,
  options: { defaultTimezone?: string; field?: string } = {},
): ParsedDateResult {
  const warnings: ValidationIssue[] = [];
  if (value === null || value === undefined || value === '') {
    return { valid: false, warnings };
  }

  const raw = String(value).trim();
  if (!raw) {
    return { valid: false, warnings };
  }

  const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(isAllDay ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, warnings };
  }

  let timezone: string | undefined;
  const tzMatch = raw.match(/([+-]\d{2}:\d{2}|Z)$/);
  if (tzMatch) {
    timezone = tzMatch[1] === 'Z' ? 'UTC' : `UTC${tzMatch[1]}`;
  } else if (options.defaultTimezone) {
    timezone = options.defaultTimezone;
    warnings.push({
      code: 'TIMEZONE_MISSING',
      field: options.field ?? 'startDate',
      message: `No timezone in date value; using source default "${options.defaultTimezone}".`,
    });
  } else if (!isAllDay && !ISO_DATE_PATTERN.test(raw)) {
    warnings.push({
      code: 'TIMEZONE_MISSING',
      field: options.field ?? 'startDate',
      message: 'No timezone information available for date value.',
    });
  }

  return {
    isoDate: date.toISOString(),
    timezone,
    isAllDay,
    valid: true,
    warnings,
  };
}

export function isEndBeforeStart(startDate: string, endDate: string): boolean {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end < start;
}
