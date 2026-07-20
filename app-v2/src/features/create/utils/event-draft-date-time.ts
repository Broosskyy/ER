const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const EVENT_DRAFT_DESCRIPTION_MAX_LENGTH = 5_000;
export const EVENT_DRAFT_TITLE_MAX_LENGTH = 200;

export function isValidDateInput(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  );
}

export function isValidTimeInput(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function combineDateAndTime(date: string, time: string): Date | null {
  if (!isValidDateInput(date) || !isValidTimeInput(time)) {
    return null;
  }

  const dateParts = date.split('-').map(Number);
  const timeParts = time.split(':').map(Number);
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];
  const hours = timeParts[0];
  const minutes = timeParts[1];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hours === undefined ||
    minutes === undefined
  ) {
    return null;
  }

  const combined = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(combined.getTime()) ? null : combined;
}

export function resolveEndDateTime(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
): Date | null {
  if (!endDate.trim() && !endTime.trim()) {
    return null;
  }

  const resolvedEndDate = endDate.trim() || startDate;
  const resolvedEndTime = endTime.trim() || startTime;
  return combineDateAndTime(resolvedEndDate, resolvedEndTime);
}

export function formatIsoToDateInput(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatIsoToTimeInput(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
