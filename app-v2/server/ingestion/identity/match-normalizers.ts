const CITY_ALIASES: Record<string, string> = {
  koeln: 'cologne',
  cologne: 'cologne',
  münchen: 'munich',
  munich: 'munich',
};

const VENUE_NOISE = /\b(köln|cologne|club|festival|open\s*air)\b/gi;
const TITLE_NOISE = /\b(pres\.?|presented by|presents|by)\b/gi;

export function normalizeMatchText(value: string | undefined | null): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeCity(value: string | undefined | null): string {
  const normalized = normalizeMatchText(value);
  return CITY_ALIASES[normalized] ?? normalized;
}

export function normalizeVenueName(value: string | undefined | null): string {
  return normalizeMatchText(value).replace(VENUE_NOISE, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeEventTitle(value: string | undefined | null): string {
  return normalizeMatchText(value).replace(TITLE_NOISE, ' ').replace(/\s+/g, ' ').trim();
}

export function extractTitleYears(title: string): number[] {
  const matches = title.match(/\b(20\d{2})\b/g) ?? [];
  return [...new Set(matches.map((year) => Number.parseInt(year, 10)))];
}

const TITLE_EXPANSION_SUFFIX =
  /\s+(?:and more|uvm|ua|und mehr|\+ more|and friends|and special guests)(?:\s+.*)?$/i;

function isTitleEvolutionExpansion(left: string, right: string): boolean {
  const a = normalizeEventTitle(left);
  const b = normalizeEventTitle(right);
  if (!a || !b || a === b) {
    return false;
  }
  const stripExpansion = (value: string) => value.replace(TITLE_EXPANSION_SUFFIX, '').trim();
  const aCore = stripExpansion(a);
  const bCore = stripExpansion(b);
  return aCore === bCore || aCore === b || bCore === a;
}

export function titleSimilarity(left: string, right: string): number {
  const a = normalizeEventTitle(left);
  const b = normalizeEventTitle(right);
  if (!a || !b) {
    return 0;
  }
  if (a === b || isTitleEvolutionExpansion(left, right)) {
    return 1;
  }
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return shorter / longer;
  }

  const stripYears = (value: string) => value.replace(/\b20\d{2}\b/g, ' ').replace(/\s+/g, ' ').trim();
  const aCore = stripYears(a);
  const bCore = stripYears(b);
  if (aCore && bCore) {
    if (aCore === bCore) {
      return 0.95;
    }
    if (aCore.includes(bCore) || bCore.includes(aCore)) {
      const shorter = Math.min(aCore.length, bCore.length);
      const longer = Math.max(aCore.length, bCore.length);
      return Math.max(shorter / longer, 0.82);
    }
  }

  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));
  const intersection = [...aTokens].filter((token) => bTokens.has(token));
  const union = new Set([...aTokens, ...bTokens]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

export function buildVenueMatchKey(input: {
  venueName?: string;
  venueCity?: string;
  venuePostalCode?: string;
}): string {
  return [normalizeVenueName(input.venueName), normalizeCity(input.venueCity), (input.venuePostalCode ?? '').trim()]
    .filter(Boolean)
    .join('|');
}

export function calendarDayKey(isoTimestamp: string, timezone: string): string | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date(isoTimestamp));
  } catch {
    return null;
  }
}

export function startTimeDeltaMs(left: string, right: string): number | null {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
    return null;
  }
  return Math.abs(leftMs - rightMs);
}

export function isoWeekKey(isoTimestamp: string, timezone: string): string | null {
  const day = calendarDayKey(isoTimestamp, timezone);
  if (!day) {
    return null;
  }
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}:${timezone}`;
}

export function lineupOverlapRatio(left: string[], right: string[]): number {
  const a = new Set(left.map((name) => normalizeMatchText(name)).filter(Boolean));
  const b = new Set(right.map((name) => normalizeMatchText(name)).filter(Boolean));
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  const intersection = [...a].filter((name) => b.has(name));
  return intersection.length / Math.max(a.size, b.size);
}
