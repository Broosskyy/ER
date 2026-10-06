import type { DiscoveryCursor } from '../../domain/discovery-pagination-types';
import type { DiscoveryQuery } from '../../domain/discovery-query-types';
import type { DiscoveryApiErrorDetail } from './discovery-api-errors';
import type { DiscoveryApiVersion } from './discovery-api-version';

export interface DiscoveryApiPagination {
  limit: number;
  hasMore: boolean;
  nextCursor?: DiscoveryCursor;
  totalMatched: number;
}

export interface DiscoveryApiAppliedFilters {
  date?: DiscoveryQuery['date'];
  entities?: DiscoveryQuery['entities'];
  location?: DiscoveryQuery['location'];
  price?: DiscoveryQuery['price'];
  venueEnvironment?: DiscoveryQuery['venueEnvironment'];
  search?: DiscoveryQuery['search'];
  sortBy?: DiscoveryQuery['sortBy'];
  sortDirection?: DiscoveryQuery['sortDirection'];
}

export interface DiscoveryApiPerformanceMeta {
  durationMs: number;
  source: 'memory' | 'database' | 'hybrid';
  cacheStatus: 'miss' | 'hit' | 'bypass';
  eventsScanned?: number;
  eventsReturned: number;
}

export interface DiscoveryApiResponseMeta {
  version: DiscoveryApiVersion;
  requestId: string;
  timestamp: string;
  surface?: DiscoveryQuery['surface'];
  filters?: DiscoveryApiAppliedFilters;
  performance: DiscoveryApiPerformanceMeta;
  cacheKey?: string;
}

export interface DiscoveryApiResponse<TData> {
  ok: true;
  data: TData;
  pagination?: DiscoveryApiPagination;
  meta: DiscoveryApiResponseMeta;
}

export interface DiscoveryApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details: DiscoveryApiErrorDetail[];
    retryable: boolean;
  };
  meta: {
    version: DiscoveryApiVersion;
    requestId: string;
    timestamp: string;
  };
}

export type DiscoveryApiResult<TData> = DiscoveryApiResponse<TData> | DiscoveryApiErrorResponse;

export function createDiscoveryApiResponse<TData>(input: {
  data: TData;
  version: DiscoveryApiVersion;
  requestId: string;
  performance: DiscoveryApiPerformanceMeta;
  pagination?: DiscoveryApiPagination;
  surface?: DiscoveryQuery['surface'];
  filters?: DiscoveryApiAppliedFilters;
  cacheKey?: string;
}): DiscoveryApiResponse<TData> {
  return {
    ok: true,
    data: input.data,
    pagination: input.pagination,
    meta: {
      version: input.version,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      surface: input.surface,
      filters: input.filters,
      performance: input.performance,
      cacheKey: input.cacheKey,
    },
  };
}

export function createDiscoveryApiErrorResponse(
  error: { code: string; message: string; details: DiscoveryApiErrorDetail[]; retryable: boolean },
  meta: { version: DiscoveryApiVersion; requestId: string },
): DiscoveryApiErrorResponse {
  return {
    ok: false,
    error,
    meta: {
      version: meta.version,
      requestId: meta.requestId,
      timestamp: new Date().toISOString(),
    },
  };
}
