import type { Event } from '@/features/events/types/event';

const INTERNAL_SOURCE_MARKERS = [
  'demo',
  'staging',
  'staging-seed',
  'regression',
  'manual-test',
  'test',
] as const;

/** Entity ids/slugs used for staging, demo, and regression fixtures. */
export function isInternalEntityId(idOrSlug: string | undefined | null): boolean {
  const normalized = idOrSlug?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('staging') ||
    normalized.includes('demo-') ||
    normalized.includes('regression') ||
    normalized.startsWith('test-') ||
    normalized.includes('search-test') ||
    normalized === 'charlotte-de-witte'
  );
}

export function isInternalPublicEvent(event: Pick<Event, 'id' | 'source' | 'sourceEventId'>): boolean {
  const source = event.source?.toLowerCase() ?? '';
  const sourceEventId = event.sourceEventId?.toLowerCase() ?? '';
  const id = event.id.toLowerCase();

  if (INTERNAL_SOURCE_MARKERS.some((marker) => source === marker || source.includes(marker))) {
    return true;
  }

  return (
    isInternalEntityId(id) ||
    sourceEventId.includes('staging') ||
    sourceEventId.includes('regression') ||
    sourceEventId.includes('demo')
  );
}
