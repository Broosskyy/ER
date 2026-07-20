import type { Notification } from '../types/notification';

export type NotificationTimeGroup = 'today' | 'this_week' | 'earlier';

export interface NotificationSection {
  key: NotificationTimeGroup;
  titleKey: string;
  data: Notification[];
}

const GROUP_TITLE_KEYS: Record<NotificationTimeGroup, string> = {
  today: 'activity.groups.today',
  this_week: 'activity.groups.thisWeek',
  earlier: 'activity.groups.earlier',
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, diff));
}

export function getNotificationTimeGroup(
  createdAt: string,
  referenceDate: Date = new Date(),
): NotificationTimeGroup {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return 'earlier';
  }

  const todayStart = startOfDay(referenceDate);
  const todayEnd = endOfDay(referenceDate);

  if (createdDate >= todayStart && createdDate <= todayEnd) {
    return 'today';
  }

  const weekStart = startOfWeek(referenceDate);
  const weekEnd = endOfDay(addDays(weekStart, 6));

  if (createdDate >= weekStart && createdDate <= weekEnd) {
    return 'this_week';
  }

  return 'earlier';
}

export function groupNotificationsByTime(
  notifications: readonly Notification[],
  referenceDate: Date = new Date(),
): NotificationSection[] {
  const grouped: Record<NotificationTimeGroup, Notification[]> = {
    today: [],
    this_week: [],
    earlier: [],
  };

  const sorted = [...notifications]
    .filter((notification) => notification.deletedAt === null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  for (const notification of sorted) {
    grouped[getNotificationTimeGroup(notification.createdAt, referenceDate)].push(notification);
  }

  return (['today', 'this_week', 'earlier'] as const)
    .filter((key) => grouped[key].length > 0)
    .map((key) => ({
      key,
      titleKey: GROUP_TITLE_KEYS[key],
      data: grouped[key],
    }));
}
