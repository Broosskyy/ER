export const CONSUMER_EVENT_TIMEZONE = 'Europe/Berlin';

/** M9.2.2 cleanup reference — events active from this Berlin local date onward. */
export const M9_2_2_ACTIVE_FROM_BERLIN_YMD = '2026-08-29';

interface BerlinLocalParts {
  ymd: string;
  hms: string;
}

function berlinLocalParts(instant: Date): BerlinLocalParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CONSUMER_EVENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    hms: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function berlinYmd(instant: Date): string {
  return berlinLocalParts(instant).ymd;
}

/** UTC milliseconds for 00:00:00 on the given Berlin calendar day (YYYY-MM-DD). */
export function berlinLocalMidnightUtcMs(ymd: string): number {
  const parts = ymd.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) {
    throw new Error(`invalid_berlin_ymd:${ymd}`);
  }

  let lo = Date.UTC(year, month - 1, day - 1, 20, 0, 0);
  let hi = Date.UTC(year, month - 1, day + 1, 4, 0, 0);

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { ymd: midYmd, hms } = berlinLocalParts(new Date(mid));
    if (midYmd < ymd || (midYmd === ymd && hms < '00:00:00')) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return lo;
}

export interface ConsumerEventWindowInput {
  startsAt: string;
  endsAt?: string | null;
  /** Defaults to now — use a fixed instant for M9.2.2 cleanup dry runs. */
  referenceInstant?: Date;
}

/**
 * Consumer past-event semantics (Europe/Berlin):
 * - With endsAt: past when endsAt < start of reference Berlin day
 * - Without endsAt: past when startsAt <= end of previous Berlin day (23:59:59.999)
 */
export function isPastConsumerEvent(input: ConsumerEventWindowInput): boolean {
  const startsAtMs = Date.parse(input.startsAt);
  if (Number.isNaN(startsAtMs)) {
    return true;
  }

  const referenceInstant = input.referenceInstant ?? new Date();
  const activeFromYmd = berlinYmd(referenceInstant);
  const activeFromMs = berlinLocalMidnightUtcMs(activeFromYmd);
  const endOfPreviousDayMs = activeFromMs - 1;

  if (input.endsAt) {
    const endsAtMs = Date.parse(input.endsAt);
    if (Number.isNaN(endsAtMs)) {
      return startsAtMs <= endOfPreviousDayMs;
    }
    return endsAtMs < activeFromMs;
  }

  return startsAtMs <= endOfPreviousDayMs;
}

export function m9_2_2CleanupReferenceInstant(): Date {
  return new Date(`${M9_2_2_ACTIVE_FROM_BERLIN_YMD}T12:00:00+02:00`);
}

/** Berlin-local audit date for M9.2.2.5 recertification (override via AUDIT_DATE_LOCAL). */
export function auditDateLocalYmd(): string {
  return process.env.AUDIT_DATE_LOCAL ?? '2026-09-01';
}

export function auditReferenceInstant(): Date {
  const ymd = auditDateLocalYmd();
  return new Date(`${ymd}T12:00:00+02:00`);
}

export type ConsumerEventLifecycleStatus =
  | 'UPCOMING'
  | 'ONGOING'
  | 'ENDED'
  | 'CANCELLED'
  | 'POSTPONED'
  | 'DRAFT'
  | 'REVIEW_REQUIRED';

export function classifyConsumerEventLifecycle(input: {
  startsAt: string;
  endsAt?: string | null;
  status?: string | null;
  referenceInstant?: Date;
}): ConsumerEventLifecycleStatus {
  const normalizedStatus = (input.status ?? '').toLowerCase();
  if (normalizedStatus === 'cancelled') {
    return 'CANCELLED';
  }
  if (normalizedStatus === 'postponed') {
    return 'POSTPONED';
  }
  if (normalizedStatus === 'draft') {
    return 'DRAFT';
  }
  if (normalizedStatus === 'review_required') {
    return 'REVIEW_REQUIRED';
  }

  const referenceInstant = input.referenceInstant ?? auditReferenceInstant();
  if (
    isPastConsumerEvent({
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      referenceInstant,
    })
  ) {
    return 'ENDED';
  }

  const startsAtMs = Date.parse(input.startsAt);
  if (Number.isNaN(startsAtMs)) {
    return 'REVIEW_REQUIRED';
  }

  if (startsAtMs > referenceInstant.getTime()) {
    return 'UPCOMING';
  }

  return 'ONGOING';
}
