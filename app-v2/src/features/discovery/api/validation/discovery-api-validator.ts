import { DISCOVERY_SORT_FIELDS } from '../../domain/discovery-query-types';
import { parseDiscoveryCursor } from '../../pagination/discovery-cursor';
import { DiscoveryApiError, type DiscoveryApiErrorDetail } from '../domain/discovery-api-errors';
import type { DiscoveryQuery } from '../../domain/discovery-query-types';
import { MAX_DISCOVERY_PAGE_SIZE } from '../../domain/discovery-pagination-types';

export function validateDiscoveryQuery(query: DiscoveryQuery): void {
  const details: DiscoveryApiErrorDetail[] = [];

  if (!query.surface?.trim()) {
    details.push({ field: 'surface', code: 'INVALID_QUERY', message: 'surface is required.' });
  }

  if (query.limit !== undefined) {
    if (!Number.isFinite(query.limit) || query.limit < 1 || query.limit > MAX_DISCOVERY_PAGE_SIZE) {
      details.push({
        field: 'limit',
        code: 'INVALID_QUERY',
        message: `limit must be between 1 and ${MAX_DISCOVERY_PAGE_SIZE}.`,
      });
    }
  }

  if (query.sortBy && !DISCOVERY_SORT_FIELDS.includes(query.sortBy)) {
    details.push({
      field: 'sortBy',
      code: 'INVALID_SORT',
      message: `sortBy must be one of: ${DISCOVERY_SORT_FIELDS.join(', ')}.`,
    });
  }

  if (query.sortDirection && query.sortDirection !== 'asc' && query.sortDirection !== 'desc') {
    details.push({
      field: 'sortDirection',
      code: 'INVALID_SORT',
      message: 'sortDirection must be asc or desc.',
    });
  }

  if (query.location?.radiusKm !== undefined && query.location.radiusKm <= 0) {
    details.push({
      field: 'location.radiusKm',
      code: 'INVALID_FILTER',
      message: 'radiusKm must be greater than 0.',
    });
  }

  if (query.cursor) {
    const parsed = parseDiscoveryCursor(query.cursor);
    if (!parsed) {
      details.push({
        field: 'cursor',
        code: 'INVALID_CURSOR',
        message: 'cursor is invalid or malformed.',
      });
    }
  }

  if (query.date?.startAt && Number.isNaN(new Date(query.date.startAt).getTime())) {
    details.push({
      field: 'date.startAt',
      code: 'INVALID_FILTER',
      message: 'date.startAt must be a valid ISO date.',
    });
  }

  if (query.date?.endAt && Number.isNaN(new Date(query.date.endAt).getTime())) {
    details.push({
      field: 'date.endAt',
      code: 'INVALID_FILTER',
      message: 'date.endAt must be a valid ISO date.',
    });
  }

  if (details.length > 0) {
    const primaryCode = details.some((detail) => detail.code === 'INVALID_CURSOR')
      ? 'INVALID_CURSOR'
      : details.some((detail) => detail.code === 'INVALID_SORT')
        ? 'INVALID_SORT'
        : 'INVALID_FILTER';
    throw new DiscoveryApiError('Invalid discovery query.', {
      code: primaryCode,
      details,
    });
  }
}

export function assertDiscoveryEntityId(id: string | undefined, field: string): string {
  const normalized = id?.trim();
  if (!normalized) {
    throw new DiscoveryApiError(`${field} is required.`, {
      code: 'INVALID_QUERY',
      details: [{ field, code: 'INVALID_QUERY', message: `${field} is required.` }],
    });
  }
  return normalized;
}
