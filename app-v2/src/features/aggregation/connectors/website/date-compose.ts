const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function composeListDateParts(
  dayValue: string | undefined,
  monthValue: string | undefined,
  timeValue: string | undefined,
  referenceDate: Date = new Date(),
): string | undefined {
  if (!dayValue || !monthValue) {
    return undefined;
  }

  const day = Number.parseInt(dayValue.trim(), 10);
  const month = MONTH_INDEX[monthValue.trim().toLowerCase().slice(0, 3)];
  if (!Number.isFinite(day) || month === undefined) {
    return undefined;
  }

  const timeMatch = timeValue?.trim().match(/^(\d{1,2}):(\d{2})$/);
  const hours = timeMatch ? Number.parseInt(timeMatch[1] ?? '0', 10) : 0;
  const minutes = timeMatch ? Number.parseInt(timeMatch[2] ?? '0', 10) : 0;

  let year = referenceDate.getFullYear();
  let candidate = new Date(year, month, day, hours, minutes, 0, 0);
  if (candidate.getTime() < referenceDate.getTime() - 24 * 60 * 60 * 1000) {
    year += 1;
    candidate = new Date(year, month, day, hours, minutes, 0, 0);
  }

  const monthPart = String(month + 1).padStart(2, '0');
  const dayPart = String(day).padStart(2, '0');
  const hourPart = String(hours).padStart(2, '0');
  const minutePart = String(minutes).padStart(2, '0');
  return `${year}-${monthPart}-${dayPart}T${hourPart}:${minutePart}:00`;
}

export function filterLinksByPattern(links: string[], pattern?: string): string[] {
  if (!pattern) {
    return links;
  }
  const regex = new RegExp(pattern);
  return links.filter((link) => regex.test(link));
}
