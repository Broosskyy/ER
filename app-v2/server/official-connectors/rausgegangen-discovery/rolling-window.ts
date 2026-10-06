export function daysBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

export function isWithinRollingWindow(
  startsAt: string | undefined,
  referenceInstant: Date,
  windowDays: number,
): boolean {
  if (!startsAt) {
    return false;
  }
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) {
    return false;
  }
  const delta = daysBetween(referenceInstant, start);
  return delta >= 0 && delta <= windowDays;
}

export interface RollingWindowComparisonEntry {
  windowDays: number;
  discoveredCount: number;
  upcomingCount: number;
  estimatedDetailRequests: number;
}

export function compareRollingWindows(input: {
  events: Array<{ startsAt?: string; lifecycle: string }>;
  referenceInstant: Date;
  windows: number[];
}): RollingWindowComparisonEntry[] {
  return input.windows.map((windowDays) => {
    const inWindow = input.events.filter(
      (event) =>
        event.lifecycle !== 'ENDED' &&
        isWithinRollingWindow(event.startsAt, input.referenceInstant, windowDays),
    );
    return {
      windowDays,
      discoveredCount: inWindow.length,
      upcomingCount: inWindow.length,
      estimatedDetailRequests: inWindow.length,
    };
  });
}

export type EventWindowClassification = 'ACTIVE_WINDOW' | 'DISCOVERED_BACKLOG';

export function classifyEventWindow(
  startsAt: string | undefined,
  lifecycle: string,
  referenceInstant: Date,
  activeWindowDays: number,
): EventWindowClassification {
  if (lifecycle === 'ENDED') {
    return 'DISCOVERED_BACKLOG';
  }
  return isWithinRollingWindow(startsAt, referenceInstant, activeWindowDays)
    ? 'ACTIVE_WINDOW'
    : 'DISCOVERED_BACKLOG';
}
