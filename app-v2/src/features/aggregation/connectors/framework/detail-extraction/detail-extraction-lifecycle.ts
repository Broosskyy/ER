import { meaningfulEventText } from '@/features/events/domain/event-field-value';

export const DETAIL_EXTRACTION_LEVELS = [1, 2, 3, 4] as const;
export type DetailExtractionLevel = (typeof DETAIL_EXTRACTION_LEVELS)[number];

export type DetailExtractionLevelLabel =
  | 'list_only'
  | 'list_plus_detail'
  | 'list_detail_structured'
  | 'official_api';

export const DETAIL_LEVEL_LABELS: Record<DetailExtractionLevel, DetailExtractionLevelLabel> = {
  1: 'list_only',
  2: 'list_plus_detail',
  3: 'list_detail_structured',
  4: 'official_api',
};

export interface DetailExtractionCapability {
  level: DetailExtractionLevel;
  label: DetailExtractionLevelLabel;
  supportsDetailFetch: boolean;
  supportsStructuredData: boolean;
  maxDetailPages: number;
  detailStrategy?: string;
  limitations: string[];
}

export interface DetailEnrichmentDiagnostics {
  attempted: number;
  enriched: number;
  skipped: number;
  failed: number;
  blocked: number;
}

export interface DetailEnrichmentResult<TList, TDetail> {
  items: TList[];
  diagnostics: DetailEnrichmentDiagnostics;
  mergeDecisions: Array<{
    entityId: string;
    field: string;
    action: 'filled' | 'upgraded' | 'preserved' | 'skipped';
    reason: string;
  }>;
}

function isPlaceholderText(value: string | undefined): boolean {
  return !meaningfulEventText(value);
}

function pickBetterText(existing: string | undefined, incoming: string | undefined): string | undefined {
  const existingMeaningful = meaningfulEventText(existing);
  const incomingMeaningful = meaningfulEventText(incoming);
  if (!incomingMeaningful) {
    return existingMeaningful ? existing : existing;
  }
  if (!existingMeaningful) {
    return incoming;
  }
  if ((incoming?.length ?? 0) > (existing?.length ?? 0)) {
    return incoming;
  }
  return existing;
}

function pickBetterArray(existing: string[] | undefined, incoming: string[] | undefined): string[] | undefined {
  const existingCount = existing?.filter(Boolean).length ?? 0;
  const incomingCount = incoming?.filter(Boolean).length ?? 0;
  if (incomingCount > existingCount) {
    return incoming;
  }
  return existingCount > 0 ? existing : incoming;
}

export interface MergeableListDetailFields {
  externalId: string;
  description?: string;
  artists?: string[];
  genres?: string[];
  images?: string[];
  ticketLinks?: string[];
  organizer?: string;
  venue?: string;
}

export function mergeListDetailFields(
  list: MergeableListDetailFields,
  detail: MergeableListDetailFields,
): {
  merged: MergeableListDetailFields;
  decisions: DetailEnrichmentResult<MergeableListDetailFields, MergeableListDetailFields>['mergeDecisions'];
} {
  const decisions: DetailEnrichmentResult<MergeableListDetailFields, MergeableListDetailFields>['mergeDecisions'] =
    [];

  const record = (field: string, action: 'filled' | 'upgraded' | 'preserved' | 'skipped', reason: string) => {
    decisions.push({ entityId: list.externalId, field, action, reason });
  };

  const mergedDescription = pickBetterText(list.description, detail.description);
  if (mergedDescription !== list.description) {
    record('description', list.description ? 'upgraded' : 'filled', 'detail_page_better_text');
  } else if (meaningfulEventText(list.description)) {
    record('description', 'preserved', 'list_text_retained');
  } else {
    record('description', 'skipped', 'no_better_detail_description');
  }

  const mergedArtists = pickBetterArray(list.artists, detail.artists);
  if ((mergedArtists?.length ?? 0) > (list.artists?.length ?? 0)) {
    record('artists', list.artists?.length ? 'upgraded' : 'filled', 'detail_lineup');
  }

  const mergedGenres = pickBetterArray(list.genres, detail.genres);
  if ((mergedGenres?.length ?? 0) > (list.genres?.length ?? 0)) {
    record('genres', list.genres?.length ? 'upgraded' : 'filled', 'detail_genres');
  }

  const mergedImages = pickBetterArray(list.images, detail.images);
  if ((mergedImages?.length ?? 0) > (list.images?.length ?? 0)) {
    record('images', list.images?.length ? 'upgraded' : 'filled', 'detail_images');
  }

  const mergedTickets = pickBetterArray(list.ticketLinks, detail.ticketLinks);
  if ((mergedTickets?.length ?? 0) > (list.ticketLinks?.length ?? 0)) {
    record('ticketLinks', list.ticketLinks?.length ? 'upgraded' : 'filled', 'detail_tickets');
  }

  const mergedOrganizer = pickBetterText(list.organizer, detail.organizer);
  const mergedVenue = pickBetterText(list.venue, detail.venue);

  return {
    merged: {
      externalId: list.externalId,
      description: mergedDescription,
      artists: mergedArtists,
      genres: mergedGenres,
      images: mergedImages,
      ticketLinks: mergedTickets,
      organizer: mergedOrganizer ?? list.organizer,
      venue: mergedVenue ?? list.venue,
    },
    decisions,
  };
}

export function resolveDetailExtractionCapability(input: {
  connectorKey: string;
  sourceType?: string;
  maxDetailPages: number;
  preferredStrategy?: string;
  detailStrategy?: string;
  hasOfficialApi?: boolean;
}): DetailExtractionCapability {
  if (input.hasOfficialApi) {
    return {
      level: 4,
      label: 'official_api',
      supportsDetailFetch: true,
      supportsStructuredData: true,
      maxDetailPages: input.maxDetailPages,
      detailStrategy: input.detailStrategy,
      limitations: [],
    };
  }

  if (input.maxDetailPages > 0) {
    const structured =
      input.detailStrategy === 'json_ld' ||
      input.preferredStrategy === 'json_ld' ||
      input.preferredStrategy === 'embedded_json';
    return {
      level: structured ? 3 : 2,
      label: structured ? 'list_detail_structured' : 'list_plus_detail',
      supportsDetailFetch: true,
      supportsStructuredData: structured,
      maxDetailPages: input.maxDetailPages,
      detailStrategy: input.detailStrategy ?? input.preferredStrategy,
      limitations: [],
    };
  }

  return {
    level: 1,
    label: 'list_only',
    supportsDetailFetch: false,
    supportsStructuredData: input.preferredStrategy === 'json_ld',
    maxDetailPages: 0,
    limitations: ['Detail pages disabled (maxDetailPages = 0).'],
  };
}
