export const RECENTLY_ADDED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface RecentlyAddedInput {
  publishedAt?: string;
  firstPublishedAt?: string;
  approvedAt?: string;
}

export function resolvePublishedAt(input: RecentlyAddedInput): string | undefined {
  return input.publishedAt ?? input.firstPublishedAt ?? input.approvedAt;
}

export function isRecentlyAdded(input: RecentlyAddedInput, now = new Date()): boolean {
  const publishedAt = resolvePublishedAt(input);
  if (!publishedAt) return false;
  const timestamp = new Date(publishedAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now.getTime() &&
    now.getTime() - timestamp <= RECENTLY_ADDED_WINDOW_MS;
}
