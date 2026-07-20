import type { AdminEventRecord, VenueRecord } from '@/data/types/records';

export interface EventVenueDisplay {
  label: string;
  isSuggestion: boolean;
}

/** Resolves venue label for lists and preview. Supports legacy `subtitle` reads only. */
export function resolveEventVenueDisplay(
  record: Pick<AdminEventRecord, 'venueId' | 'venueName' | 'venueCity' | 'subtitle'>,
  venues: VenueRecord[],
): EventVenueDisplay {
  if (record.venueId) {
    const venue = venues.find((entry) => entry.id === record.venueId);
    const label = venue?.name ?? record.venueName ?? '—';
    return { label, isSuggestion: false };
  }

  if (record.venueName?.trim()) {
    const citySuffix = record.venueCity?.trim() ? `, ${record.venueCity.trim()}` : '';
    return { label: `${record.venueName.trim()}${citySuffix}`, isSuggestion: true };
  }

  if (record.subtitle?.trim()) {
    return { label: record.subtitle.trim(), isSuggestion: true };
  }

  return { label: '—', isSuggestion: false };
}

/** Resolves consumer-facing venue label from DB row + optional joined venue name. */
export function resolveDomainVenueLabel(params: {
  joinedVenueName?: string;
  venueName?: string | null;
  venueCity?: string | null;
}): string {
  if (params.joinedVenueName?.trim()) {
    return params.joinedVenueName.trim();
  }

  if (params.venueName?.trim()) {
    const citySuffix = params.venueCity?.trim() ? `, ${params.venueCity.trim()}` : '';
    return `${params.venueName.trim()}${citySuffix}`;
  }

  return 'TBA';
}
