import type { DiscoveryCursorPayload } from '../domain/discovery-pagination-types';
import type { DiscoveryCursor } from '../domain/discovery-pagination-types';

function encodePayload(payload: DiscoveryCursorPayload): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf8').toString('base64url');
  }
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodePayload(encoded: string): DiscoveryCursorPayload | null {
  try {
    let json: string;
    if (typeof Buffer !== 'undefined') {
      json = Buffer.from(encoded, 'base64url').toString('utf8');
    } else {
      const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
      json = atob(normalized);
    }
    return JSON.parse(json) as DiscoveryCursorPayload;
  } catch {
    return null;
  }
}

export function createDiscoveryCursor(payload: DiscoveryCursorPayload): DiscoveryCursor {
  return { encoded: encodePayload(payload) };
}

export function parseDiscoveryCursor(cursor?: DiscoveryCursor): DiscoveryCursorPayload | null {
  if (!cursor?.encoded) {
    return null;
  }
  return decodePayload(cursor.encoded);
}

export interface DiscoverySortableItem {
  eventId: string;
  canonicalEventId: string;
  sortValue: string | number;
}

export function sliceAfterCursor<TItem extends DiscoverySortableItem>(
  items: TItem[],
  cursor: DiscoveryCursorPayload | null,
  limit: number,
): { page: TItem[]; hasMore: boolean; nextCursor?: DiscoveryCursor } {
  let startIndex = 0;
  if (cursor) {
    startIndex = items.findIndex((item) => {
      if (item.sortValue !== cursor.sortValue) {
        return false;
      }
      return item.canonicalEventId === cursor.canonicalEventId && item.eventId === cursor.eventId;
    });
    if (startIndex >= 0) {
      startIndex += 1;
    } else {
      startIndex = 0;
    }
  }

  const page = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;
  const last = page[page.length - 1];

  return {
    page,
    hasMore,
    nextCursor:
      hasMore && last
        ? createDiscoveryCursor({
            sortField: cursor?.sortField ?? 'default',
            sortValue: last.sortValue,
            eventId: last.eventId,
            canonicalEventId: last.canonicalEventId,
          })
        : undefined,
  };
}
