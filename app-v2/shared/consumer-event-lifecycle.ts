export const CONSUMER_EVENT_TIMEZONE = 'Europe/Berlin';

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
  referenceInstant?: Date;
}

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
  if (normalizedStatus === 'draft' || normalizedStatus === 'archived' || normalizedStatus === 'review') {
    return 'DRAFT';
  }
  if (normalizedStatus === 'review_required') {
    return 'REVIEW_REQUIRED';
  }

  const referenceInstant = input.referenceInstant ?? new Date();
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

export function isDiscoverableConsumerLifecycle(lifecycle: ConsumerEventLifecycleStatus): boolean {
  return lifecycle === 'UPCOMING' || lifecycle === 'ONGOING';
}
