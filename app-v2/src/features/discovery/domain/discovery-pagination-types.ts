export interface DiscoveryCursorPayload {
  sortField: string;
  sortValue: string | number;
  eventId: string;
  canonicalEventId: string;
}

export interface DiscoveryCursor {
  encoded: string;
}

export const DEFAULT_DISCOVERY_PAGE_SIZE = 24;
export const MAX_DISCOVERY_PAGE_SIZE = 100;
