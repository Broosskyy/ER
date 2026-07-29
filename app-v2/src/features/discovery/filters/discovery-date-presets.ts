import {
  addDays,
  endOfDay,
  endOfMonth,
  startOfDay,
} from '@/features/events/formatting/date-time';

import type { DiscoveryDateFilter, DiscoveryDatePreset } from '../domain/discovery-query-types';

export interface ResolvedDateWindow {
  startAt: Date;
  endAt: Date;
}

function getWeekendWindow(referenceDate: Date): ResolvedDateWindow {
  const day = referenceDate.getDay();
  const daysUntilFriday = day <= 5 ? 5 - day : 0;
  const friday = startOfDay(addDays(referenceDate, daysUntilFriday));
  const sunday = endOfDay(addDays(friday, 2));
  return { startAt: friday, endAt: sunday };
}

function getWeekWindow(referenceDate: Date): ResolvedDateWindow {
  const start = startOfDay(referenceDate);
  const end = endOfDay(addDays(start, 6));
  return { startAt: start, endAt: end };
}

function getNextMonthWindow(referenceDate: Date): ResolvedDateWindow {
  const nextMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  return {
    startAt: startOfDay(nextMonth),
    endAt: endOfMonth(nextMonth),
  };
}

export function resolveDiscoveryDateWindow(
  filter: DiscoveryDateFilter | undefined,
  now: Date,
): ResolvedDateWindow | null {
  if (!filter || filter.preset === 'all' || (!filter.preset && !filter.startAt && !filter.endAt)) {
    return null;
  }

  if (filter.preset === 'custom' || filter.startAt || filter.endAt) {
    const startAt = filter.startAt ? new Date(filter.startAt) : startOfDay(now);
    const endAt = filter.endAt ? new Date(filter.endAt) : endOfDay(addDays(now, 365));
    return { startAt, endAt };
  }

  const preset = filter.preset as DiscoveryDatePreset;
  const reference = startOfDay(now);

  switch (preset) {
    case 'today':
      return { startAt: reference, endAt: endOfDay(reference) };
    case 'tomorrow': {
      const tomorrow = addDays(reference, 1);
      return { startAt: startOfDay(tomorrow), endAt: endOfDay(tomorrow) };
    }
    case 'this-weekend':
      return getWeekendWindow(reference);
    case 'this-week':
      return getWeekWindow(reference);
    case 'next-week': {
      const start = startOfDay(addDays(reference, 7));
      return { startAt: start, endAt: endOfDay(addDays(start, 6)) };
    }
    case 'next-month':
      return getNextMonthWindow(reference);
    case 'upcoming':
      return { startAt: reference, endAt: endOfDay(addDays(reference, 365)) };
    default:
      return null;
  }
}

export function eventStartWithinWindow(
  startDateTime: string,
  window: ResolvedDateWindow,
): boolean {
  const start = new Date(startDateTime).getTime();
  return start >= window.startAt.getTime() && start <= window.endAt.getTime();
}
