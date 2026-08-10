export const BULK_REBUILD_PAST_DAYS = 30;
export const BULK_REBUILD_FUTURE_DAYS = 365;

export function buildBulkRebuildHorizon(): { horizonStart: string; horizonEnd: string } {
  const end = new Date();
  end.setDate(end.getDate() + BULK_REBUILD_FUTURE_DAYS);
  const start = new Date();
  start.setDate(start.getDate() - BULK_REBUILD_PAST_DAYS);
  return { horizonStart: start.toISOString(), horizonEnd: end.toISOString() };
}

export function isWithinBulkHorizon(startDate: string | undefined, horizonStart: string, horizonEnd: string): boolean {
  if (!startDate) return false;
  return startDate >= horizonStart && startDate <= horizonEnd;
}
