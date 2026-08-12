import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { ClassifiedOutboundTicketLink } from '@/features/aggregation/domain/cross-source-ticket-discovery';
import { classifyOutboundTicketLink } from '@/features/aggregation/domain/cross-source-ticket-discovery';
import type { TicketIoListCardEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-card-evidence';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { resolveConsumerTicketPresentation } from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import { eventVenueNamesMatch } from '@/features/event-detail/utils/event-venue-identity';
import type { ImportSource } from '@/features/import/models/types';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import { eventNormalizer } from '@/features/import/normalization/event-normalizer';
import {
  applySourceFieldDefaults,
  resolveSourceFieldDefaults,
} from '@/features/import/normalization/source-field-defaults';
import {
  parsePostalCodeFromAddress,
  type AdminEventTicketStatus,
} from '@/features/import/domain/canonical-ticket-phase';
import { analyzeEventTitleCore, compareEventTitleCores } from '@/features/import/matching/event-title-core';
import { sameCalendarDay } from '@/features/import/matching/matching-utils';
import { extractExternalLocationFromTitle } from '@/features/import/normalization/external-location-from-title';
import { resolveOfficialOutboundRelationship } from '@/features/import/domain/official-page-ticket-corroboration';
import {
  buildCanonicalEventFromVerifiedPublicEvidence,
  type BuildCanonicalEventFromVerifiedPublicEvidenceResult,
  type VerifiedOfficialEvidence,
  type VerifiedPublicEvidenceBundle,
  type VerifiedTicketEvidence,
} from '@/features/import/domain/build-canonical-event-from-verified-public-evidence';
import type { ImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';

export type BootshausImportDecision =
  | 'consumer_ready'
  | 'quick_review'
  | 'conflict_review'
  | 'quarantine';

export interface BootshausConsumerErrorCounters {
  fullAddressInVenueCity: number;
  addressUsedAsVenueName: number;
  duplicateAddressFragments: number;
  ticketUrlInWebsiteUrl: number;
  officialUrlInTicketUrl: number;
  differentDatesMerged: number;
  incompatibleVenuesMerged: number;
  duplicateCanonicalEvents: number;
  addOnUsedAsAdmission: number;
  invalidLineupEntries: number;
  unsupportedGenres: number;
  dbFallbackFieldsUsed: number;
}

export const EMPTY_BOOTSHAUS_CONSUMER_ERROR_COUNTERS: BootshausConsumerErrorCounters = {
  fullAddressInVenueCity: 0,
  addressUsedAsVenueName: 0,
  duplicateAddressFragments: 0,
  ticketUrlInWebsiteUrl: 0,
  officialUrlInTicketUrl: 0,
  differentDatesMerged: 0,
  incompatibleVenuesMerged: 0,
  duplicateCanonicalEvents: 0,
  addOnUsedAsAdmission: 0,
  invalidLineupEntries: 0,
  unsupportedGenres: 0,
  dbFallbackFieldsUsed: 0,
};

export interface BootshausGoldenEventMatrixRow {
  title: string;
  startDate?: string;
  endDate?: string;
  venueName?: string;
  venueAddress?: string;
  venuePostalCode?: string;
  venueCity?: string;
  countryCode?: string;
  officialUrl?: string;
  ticketUrl?: string;
  priceText?: string;
  ticketStatus?: AdminEventTicketStatus;
  genreLabels?: string[];
  lineup: string[];
  decision: BootshausImportDecision;
  reviewReason: string;
  enrichmentGaps: string[];
}

export interface BootshausGoldenImportRunResult {
  matrix: BootshausGoldenEventMatrixRow[];
  statusCounts: Record<BootshausImportDecision, number>;
  consumerErrorCounters: BootshausConsumerErrorCounters;
  officialEventCount: number;
  ticketEventCount: number;
  verifiedAt: string;
}

const STREET_IN_LABEL_PATTERN = /\b\d{1,4}\b/;
const POSTAL_CODE_PATTERN = /\b\d{5}\b/;
const GERMAN_FULL_ADDRESS_PATTERN = /^(.+?),\s*(\d{5})\s+(.+)$/;
const BOOTSHAUS_OFFICIAL_HOST = 'bootshaus.tv';
const TICKET_IO_HOST_PATTERN = /ticket\.io/i;
const TITLE_PIPE_VENUE_PATTERN = /\|\s*([^|]+?)\s*$/;
const OFFSITE_TITLE_KEYWORD_PATTERN =
  /\b(?:airport|flughafen|on a ship|auf dem schiff|auf einem schiff|ship|cruise)\b/i;

function isBootshausDefaultLabel(
  value: string | undefined,
  defaults: ReturnType<typeof resolveSourceFieldDefaults> | undefined,
): boolean {
  if (!value?.trim() || !defaults) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  const candidates = [
    defaults.venueName,
    defaults.cityName,
    defaults.address,
    defaults.postalCode,
  ]
    .filter((entry): entry is string => Boolean(entry?.trim()))
    .map((entry) => entry.trim().toLowerCase());
  return candidates.includes(normalized);
}

export function extractPipeVenueFromTitle(title: string | undefined): string | undefined {
  const trimmed = title?.trim();
  if (!trimmed?.includes('|')) {
    return undefined;
  }
  return trimmed.match(TITLE_PIPE_VENUE_PATTERN)?.[1]?.trim() || undefined;
}

function detectOffsiteVenueSignals(input: {
  title?: string;
  venueName?: string;
  venueCity?: string;
  countryCode?: string;
  metadata?: Record<string, unknown>;
  sourceDefaults?: ReturnType<typeof resolveSourceFieldDefaults>;
}): {
  offsite: boolean;
  pipeVenue?: string;
  externalFromTitle?: ReturnType<typeof extractExternalLocationFromTitle>;
} {
  const metadata = input.metadata ?? {};
  const defaults = input.sourceDefaults;
  const externalFromTitle = extractExternalLocationFromTitle(input.title);
  const pipeVenue = extractPipeVenueFromTitle(input.title);
  const defaultCity = defaults?.cityName?.trim().toLowerCase();
  const defaultVenue = defaults?.venueName?.trim().toLowerCase();
  const defaultCountry = defaults?.countryCode?.trim().toUpperCase() ?? 'DE';

  const scrapedVenue = input.venueName?.trim();
  const scrapedCity = input.venueCity?.trim();
  const venueIsNonDefault = Boolean(
    scrapedVenue && defaultVenue && !eventVenueNamesMatch(scrapedVenue, defaults?.venueName ?? ''),
  );
  const cityDiffersFromDefault = Boolean(
    scrapedCity && defaultCity && scrapedCity.toLowerCase() !== defaultCity,
  );
  const countryAbroad = Boolean(
    input.countryCode?.trim() && input.countryCode.trim().toUpperCase() !== defaultCountry,
  );
  const pipeVenueOffsite = Boolean(
    pipeVenue && defaultVenue && !eventVenueNamesMatch(pipeVenue, defaults?.venueName ?? ''),
  );

  const offsite = Boolean(
    metadata.externalLocationFromTitle === true ||
      externalFromTitle ||
      pipeVenueOffsite ||
      OFFSITE_TITLE_KEYWORD_PATTERN.test(input.title ?? '') ||
      venueIsNonDefault ||
      cityDiffersFromDefault ||
      countryAbroad,
  );

  return { offsite, pipeVenue, externalFromTitle };
}

export function stripBootshausDefaultVenueFields(
  geography: {
    venueName?: string;
    venueAddress?: string;
    venuePostalCode?: string;
    venueCity?: string;
    countryCode?: string;
  },
  defaults: ReturnType<typeof resolveSourceFieldDefaults> | undefined,
): typeof geography {
  if (!defaults) {
    return geography;
  }
  const next = { ...geography };
  if (isBootshausDefaultLabel(next.venueName, defaults)) {
    next.venueName = undefined;
  }
  if (isBootshausDefaultLabel(next.venueAddress, defaults)) {
    next.venueAddress = undefined;
  }
  if (isBootshausDefaultLabel(next.venuePostalCode, defaults)) {
    next.venuePostalCode = undefined;
  }
  if (isBootshausDefaultLabel(next.venueCity, defaults)) {
    next.venueCity = undefined;
  }
  return next;
}

function startOfTodayBerlin(now: Date): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    return now;
  }
  return new Date(`${year}-${month}-${day}T00:00:00+02:00`);
}

export function isUpcomingBootshausOfficialEvent(
  raw: RawImportedEvent,
  now = new Date(),
): boolean {
  if (raw.cancelled) {
    return false;
  }
  const startDate = raw.startDate?.trim();
  if (!startDate) {
    return false;
  }
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return false;
  }
  return start >= startOfTodayBerlin(now);
}

function readClassifiedOutboundLinks(raw: RawImportedEvent): ClassifiedOutboundTicketLink[] {
  const metadata = raw.sourceMetadata ?? {};
  const direct = metadata.outboundTicketLinks as ClassifiedOutboundTicketLink[] | undefined;
  const textual = metadata.textualEnrichment as
    | { outboundTicketLinks?: ClassifiedOutboundTicketLink[] }
    | undefined;
  const links = [...(direct ?? []), ...(textual?.outboundTicketLinks ?? [])];
  if (raw.ticketUrl?.trim()) {
    links.push(classifyOutboundTicketLink(raw.ticketUrl));
  }
  return links;
}

function collectOutboundTicketUrls(raw: RawImportedEvent): string[] {
  const urls = readClassifiedOutboundLinks(raw)
    .map((link) => link.url)
    .filter((url): url is string => Boolean(url?.trim()));
  return [...new Set(urls)];
}

function splitStreetPostalCity(value: string | undefined): {
  street?: string;
  postalCode?: string;
  city?: string;
} {
  const trimmed = value?.trim();
  if (!trimmed) {
    return {};
  }
  const match = trimmed.match(GERMAN_FULL_ADDRESS_PATTERN);
  if (!match) {
    return { street: trimmed };
  }
  return {
    street: match[1]?.trim(),
    postalCode: match[2]?.trim(),
    city: match[3]?.trim(),
  };
}

export function splitOfficialVenueGeography(input: {
  venueName?: string;
  venueAddress?: string;
  venuePostalCode?: string;
  venueCity?: string;
  countryCode?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  sourceDefaults?: ReturnType<typeof resolveSourceFieldDefaults>;
}): {
  venueName?: string;
  venueAddress?: string;
  venuePostalCode?: string;
  venueCity?: string;
  countryCode?: string;
} {
  const metadata = input.metadata ?? {};
  const defaults = input.sourceDefaults;
  const externalVenue = metadata.externalLocationVenue as string | undefined;
  const externalCity = metadata.externalLocationCity as string | undefined;
  const externalCountry = metadata.externalLocationCountry as string | undefined;

  let venueName = externalVenue?.trim() || input.venueName?.trim();
  let venueAddress = input.venueAddress?.trim();
  let venuePostalCode = input.venuePostalCode?.trim();
  let venueCity = externalCity?.trim() || input.venueCity?.trim();
  let countryCode =
    externalCountry?.trim() || input.countryCode?.trim() || defaults?.countryCode?.trim();

  const externalFromTitle = extractExternalLocationFromTitle(input.title);
  const pipeVenue = extractPipeVenueFromTitle(input.title);

  if (pipeVenue && !venueName) {
    venueName = pipeVenue;
  }
  if (externalFromTitle?.cityName?.trim() && !venueCity) {
    venueCity = externalFromTitle.cityName.trim();
  }
  if (externalFromTitle?.countryCode?.trim() && !countryCode) {
    countryCode = externalFromTitle.countryCode.trim();
  }
  if (externalFromTitle?.venueName?.trim() && !venueName) {
    venueName = externalFromTitle.venueName.trim();
  }

  if (venueCity && POSTAL_CODE_PATTERN.test(venueCity) && venueCity.includes(',')) {
    const split = splitStreetPostalCity(venueCity);
    if (split.city) {
      venueCity = split.city;
    }
    if (!venueAddress && split.street) {
      venueAddress = split.street;
    }
    if (!venuePostalCode && split.postalCode) {
      venuePostalCode = split.postalCode;
    }
  }

  if (venueAddress) {
    const split = splitStreetPostalCity(venueAddress);
    if (split.street && split.postalCode && split.city) {
      venueAddress = split.street;
      venuePostalCode = venuePostalCode ?? split.postalCode;
      venueCity = venueCity ?? split.city;
    } else if (!venuePostalCode) {
      venuePostalCode = parsePostalCodeFromAddress(venueAddress);
    }
  }

  if (
    venueName &&
    (POSTAL_CODE_PATTERN.test(venueName) || (STREET_IN_LABEL_PATTERN.test(venueName) && venueName.includes(',')))
  ) {
    const split = splitStreetPostalCity(venueName);
    if (split.street && !venueAddress) {
      venueAddress = split.street;
    }
    if (split.postalCode && !venuePostalCode) {
      venuePostalCode = split.postalCode;
    }
    if (split.city && !venueCity) {
      venueCity = split.city;
    }
    venueName = externalVenue?.trim() || defaults?.venueName?.trim() || undefined;
  }

  const offsiteSignals = detectOffsiteVenueSignals({
    title: input.title,
    venueName,
    venueCity,
    countryCode,
    metadata,
    sourceDefaults: defaults,
  });

  if (externalFromTitle?.cityName?.trim() && (!venueCity || isBootshausDefaultLabel(venueCity, defaults))) {
    venueCity = externalFromTitle.cityName.trim();
  }
  if (externalFromTitle?.countryCode?.trim()) {
    countryCode = externalFromTitle.countryCode.trim();
  }

  const allowSourceDefaults = !offsiteSignals.offsite && !metadata.externalLocationFromTitle;
  if (!venueAddress && defaults?.address?.trim() && allowSourceDefaults) {
    venueAddress = defaults.address.trim();
  }
  if (!venuePostalCode && defaults?.postalCode?.trim() && allowSourceDefaults) {
    venuePostalCode = defaults.postalCode.trim();
  }
  if (!venueCity && defaults?.cityName?.trim() && allowSourceDefaults) {
    venueCity = defaults.cityName.trim();
  }

  if (offsiteSignals.offsite) {
    const stripped = stripBootshausDefaultVenueFields(
      { venueName, venueAddress, venuePostalCode, venueCity, countryCode },
      defaults,
    );
    venueName = stripped.venueName;
    venueAddress = stripped.venueAddress;
    venuePostalCode = stripped.venuePostalCode;
    venueCity = stripped.venueCity;
    countryCode = stripped.countryCode;
  }

  if (externalFromTitle?.venueName?.trim() && !venueName) {
    venueName = externalFromTitle.venueName.trim();
  }
  if (externalFromTitle?.cityName?.trim() && !venueCity) {
    venueCity = externalFromTitle.cityName.trim();
  }
  if (externalFromTitle?.countryCode?.trim() && !countryCode) {
    countryCode = externalFromTitle.countryCode.trim();
  }

  return {
    venueName: venueName || undefined,
    venueAddress: venueAddress || undefined,
    venuePostalCode: venuePostalCode || undefined,
    venueCity: venueCity || undefined,
    countryCode: countryCode || undefined,
  };
}

function prepareOfficialCandidate(
  raw: RawImportedEvent,
  importSource: ImportSource,
): NormalizedEventCandidate | undefined {
  const normalized = eventNormalizer.normalize({
    externalId: raw.externalId,
    sourceUrl: raw.sourceUrl,
    title: raw.title,
    description: raw.description,
    startDate: raw.startDate,
    endDate: raw.endDate,
    timezone: raw.timezone ?? importSource.defaultTimezone ?? 'Europe/Berlin',
    venueName: raw.venueName,
    venueAddress: raw.venueAddress,
    cityName: raw.cityName,
    countryCode: raw.countryCode,
    eventUrl: raw.eventUrl ?? raw.sourceUrl,
    imageUrl: raw.imageUrl,
    ticketUrl: raw.ticketUrl,
    genreNames: raw.genreNames,
    artistNames: raw.artistNames,
    organizerName: raw.organizerName,
    minimumAge: raw.minimumAge,
    rawSourceType: raw.rawSourceType,
    sourceMetadata: raw.sourceMetadata,
  });
  if (!normalized.candidate) {
    return undefined;
  }
  const defaults = resolveSourceFieldDefaults(importSource.sourceConfig, null);
  return applySourceFieldDefaults(normalized.candidate, defaults);
}

function readMetadataTextBlock(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function buildLineupContentBlocks(raw: RawImportedEvent, candidate: NormalizedEventCandidate): string[] {
  const metadata = raw.sourceMetadata ?? {};
  const runningOrder = readMetadataTextBlock(metadata.runningOrder);
  const timetable = readMetadataTextBlock(metadata.timetable);
  if (runningOrder) {
    return [runningOrder];
  }
  if (timetable) {
    return [timetable];
  }
  if (candidate.description?.trim()) {
    return [candidate.description.trim()];
  }
  return [];
}

export function mapOfficialRawToVerifiedEvidence(
  raw: RawImportedEvent,
  importSource: ImportSource,
  verifiedAt: string,
): VerifiedOfficialEvidence | undefined {
  const candidate = prepareOfficialCandidate(raw, importSource);
  if (!candidate?.title?.trim() || !candidate.startDate?.trim()) {
    return undefined;
  }
  const defaults = resolveSourceFieldDefaults(importSource.sourceConfig, null);
  const geography = splitOfficialVenueGeography({
    venueName: candidate.venueName,
    venueAddress: candidate.venueAddress,
    venuePostalCode: parsePostalCodeFromAddress(candidate.venueAddress),
    venueCity: candidate.cityName,
    countryCode: candidate.countryCode,
    title: candidate.title,
    metadata: candidate.sourceMetadata as Record<string, unknown> | undefined,
    sourceDefaults: defaults,
  });

  const pageUrl = candidate.eventUrl ?? raw.eventUrl ?? raw.sourceUrl ?? raw.externalId;
  return {
    pageUrl,
    pageTitle: candidate.title,
    eventDate: candidate.startDate,
    endDate: candidate.endDate,
    venueName: geography.venueName,
    venueAddress: geography.venueAddress,
    venuePostalCode: geography.venuePostalCode,
    venueCity: geography.venueCity,
    countryCode: geography.countryCode,
    description: candidate.description,
    imageUrl: candidate.imageUrl,
    genreLabels: candidate.genreNames,
    lineupContentBlocks: buildLineupContentBlocks(raw, candidate),
    minimumAge: raw.minimumAge,
    organizerName: candidate.organizerName,
    outboundTicketUrls: collectOutboundTicketUrls(raw),
    verifiedAt,
  };
}

export function mapTicketRawToVerifiedEvidence(
  raw: RawImportedEvent,
  verifiedAt: string,
): VerifiedTicketEvidence {
  const metadata = raw.sourceMetadata as Record<string, unknown> | undefined;
  const listCard = metadata?.listCardEvidence as TicketIoListCardEvidence | undefined;
  const ticketOffers = (metadata?.ticketOffers as VerifiedTicketEvidence['ticketOffers']) ??
    (raw.sourceMetadata?.ticketOffers as VerifiedTicketEvidence['ticketOffers']);
  const publicTicketUrl =
    raw.ticketUrl?.trim() ||
    listCard?.publicTicketPageUrl?.trim() ||
    raw.eventUrl?.trim() ||
    raw.externalId?.trim();

  return {
    publicTicketUrl,
    pageTitle: (metadata?.pageTitle as string | undefined) ?? listCard?.listRowTitle,
    listRowTitle:
      listCard?.listRowTitle ??
      (metadata?.listRowTitle as string | undefined) ??
      raw.title,
    eventDate: raw.startDate ?? listCard?.eventDate,
    venueName: listCard?.venueName ?? raw.venueName,
    priceText: raw.priceText ?? listCard?.priceText,
    ticketStatus: listCard?.soldOut ? 'sold_out' : undefined,
    verifiedAt: (metadata?.verifiedAt as string | undefined) ?? listCard?.verifiedAt ?? verifiedAt,
    ticketOffers,
    ticketPlatformGenres: raw.genreNames,
  };
}

export interface BootshausTicketMatchResult {
  ticketEvidence?: VerifiedTicketEvidence;
  conflictingTicketEvidence?: VerifiedTicketEvidence;
  matchReason: string;
  matchedByOutbound: boolean;
}

export function matchTicketEvidenceForOfficial(
  official: VerifiedOfficialEvidence,
  ticketCandidates: VerifiedTicketEvidence[],
): BootshausTicketMatchResult {
  const outboundMatches = ticketCandidates.filter((ticket) => {
    const ticketUrl = ticket.publicTicketUrl?.trim();
    if (!ticketUrl) {
      return false;
    }
    if (
      official.eventDate &&
      ticket.eventDate &&
      !sameCalendarDay(official.eventDate, ticket.eventDate)
    ) {
      return false;
    }
    const relationship = resolveOfficialOutboundRelationship({
      publicTicketPageUrl: ticketUrl,
      outboundTicketUrls: official.outboundTicketUrls,
    });
    return relationship.confirmed;
  });

  if (outboundMatches.length === 1) {
    return {
      ticketEvidence: outboundMatches[0],
      matchReason: 'official_outbound_exact',
      matchedByOutbound: true,
    };
  }
  if (outboundMatches.length > 1) {
    return {
      conflictingTicketEvidence: outboundMatches[1],
      ticketEvidence: outboundMatches[0],
      matchReason: 'multiple_outbound_ticket_matches',
      matchedByOutbound: true,
    };
  }

  const fuzzyCandidates = ticketCandidates.filter((ticket) => {
    const officialTitle = official.pageTitle?.trim() ?? '';
    const ticketTitle = ticket.listRowTitle?.trim() ?? ticket.pageTitle?.trim() ?? '';
    if (!officialTitle || !ticketTitle || !official.eventDate?.trim() || !ticket.eventDate?.trim()) {
      return false;
    }
    if (!sameCalendarDay(official.eventDate, ticket.eventDate)) {
      return false;
    }
    const titleComparison = compareEventTitleCores(
      analyzeEventTitleCore(officialTitle),
      analyzeEventTitleCore(ticketTitle),
    );
    if (!titleComparison.coresAgree) {
      return false;
    }
    const officialVenue = official.venueName?.trim();
    const ticketVenue = ticket.venueName?.trim();
    if (officialVenue && ticketVenue && !eventVenueNamesMatch(officialVenue, ticketVenue)) {
      return false;
    }
    return true;
  });

  if (fuzzyCandidates.length === 1) {
    return {
      ticketEvidence: fuzzyCandidates[0],
      matchReason: 'fuzzy_title_day_venue',
      matchedByOutbound: false,
    };
  }
  if (fuzzyCandidates.length > 1) {
    return {
      conflictingTicketEvidence: fuzzyCandidates[1],
      ticketEvidence: fuzzyCandidates[0],
      matchReason: 'multiple_fuzzy_ticket_matches',
      matchedByOutbound: false,
    };
  }

  return { matchReason: 'no_ticket_match', matchedByOutbound: false };
}

function hasAddonAdmission(ticket?: VerifiedTicketEvidence): boolean {
  const offers = ticket?.ticketOffers ?? [];
  const admissionOffers = offers.filter((offer) => offer.kind !== 'addon' && offer.kind !== 'add_on');
  if (offers.length > 0 && admissionOffers.length === 0) {
    return true;
  }
  return offers.some((offer) => offer.kind === 'addon' || offer.kind === 'add_on');
}

function countRowConsumerErrors(
  patch: ImportPublishFieldPatch,
  lineup: string[],
  official: VerifiedOfficialEvidence,
  ticket?: VerifiedTicketEvidence,
  matchReason?: string,
): BootshausConsumerErrorCounters {
  const counters = { ...EMPTY_BOOTSHAUS_CONSUMER_ERROR_COUNTERS };
  const venueCity = patch.venueCity?.trim() ?? '';
  const venueName = patch.venueName?.trim() ?? '';
  const venueAddress = patch.venueAddress?.trim() ?? '';

  if (venueCity && (POSTAL_CODE_PATTERN.test(venueCity) || venueCity.includes(','))) {
    counters.fullAddressInVenueCity += 1;
  }
  if (
    venueName &&
    (POSTAL_CODE_PATTERN.test(venueName) ||
      (STREET_IN_LABEL_PATTERN.test(venueName) && venueName.includes(',')))
  ) {
    counters.addressUsedAsVenueName += 1;
  }
  if (venueName && venueAddress) {
    const addressParts = venueAddress
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((part) => part.length > 3);
    const duplicated = addressParts.some((part) => venueName.toLowerCase().includes(part));
    if (duplicated) {
      counters.duplicateAddressFragments += 1;
    }
  }
  if (patch.websiteUrl && TICKET_IO_HOST_PATTERN.test(patch.websiteUrl)) {
    counters.ticketUrlInWebsiteUrl += 1;
  }
  if (patch.ticketUrl && patch.ticketUrl.includes(BOOTSHAUS_OFFICIAL_HOST)) {
    counters.officialUrlInTicketUrl += 1;
  }
  if (
    patch.ticketUrl &&
    ticket?.eventDate &&
    official.eventDate &&
    !sameCalendarDay(official.eventDate, ticket.eventDate)
  ) {
    counters.differentDatesMerged += 1;
  }
  if (
    patch.ticketUrl &&
    ticket?.venueName &&
    official.venueName &&
    patch.venueName &&
    eventVenueNamesMatch(patch.venueName, ticket.venueName) &&
    !eventVenueNamesMatch(official.venueName, ticket.venueName) &&
    matchReason !== 'official_outbound_exact'
  ) {
    counters.incompatibleVenuesMerged += 1;
  }
  if (ticket && hasAddonAdmission(ticket)) {
    counters.addOnUsedAsAdmission += 1;
  }
  for (const entry of lineup) {
    if (entry.length < 2 || entry.includes('http') || entry.includes('@')) {
      counters.invalidLineupEntries += 1;
    }
  }
  for (const genre of patch.genreLabels ?? []) {
    if (/ticket|admission|venue/i.test(genre)) {
      counters.unsupportedGenres += 1;
    }
  }

  return counters;
}

function mergeConsumerErrorCounters(
  base: BootshausConsumerErrorCounters,
  row: BootshausConsumerErrorCounters,
): BootshausConsumerErrorCounters {
  const merged = { ...base };
  for (const key of Object.keys(merged) as Array<keyof BootshausConsumerErrorCounters>) {
    merged[key] += row[key];
  }
  return merged;
}

function isBlockingReviewReason(reason: string): boolean {
  if (reason === 'venue_missing' || reason === 'venue_conflict') {
    return true;
  }
  if (reason.startsWith('ticket_match_conflict:')) {
    return true;
  }
  if (reason.startsWith('conflicting_')) {
    return true;
  }
  if (reason.includes('contamination')) {
    return true;
  }
  if (
    reason === 'all_sources_disagree' ||
    reason === 'identity_mismatch' ||
    reason === 'canonical_identity_review_required'
  ) {
    return true;
  }
  if (reason.startsWith('ticket_evidence_blocked')) {
    return true;
  }
  return false;
}

function isOptionalEnrichmentReviewReason(reason: string): boolean {
  return !isBlockingReviewReason(reason);
}

function deriveEnrichmentGaps(input: {
  buildResult: BuildCanonicalEventFromVerifiedPublicEvidenceResult;
  canonicalPatch: ImportPublishFieldPatch;
  official: VerifiedOfficialEvidence;
  lineup: string[];
  ticketMatched: boolean;
}): string[] {
  const gaps = new Set<string>();

  for (const reason of input.buildResult.reviewReasons) {
    if (!isOptionalEnrichmentReviewReason(reason)) {
      continue;
    }
    if (reason.startsWith('lineup:')) {
      gaps.add(reason.slice('lineup:'.length));
      continue;
    }
    if (reason.startsWith('ticket_fields_blocked:')) {
      gaps.add('ticket_data');
      continue;
    }
    gaps.add(reason);
  }

  if (input.lineup.length === 0) {
    gaps.add('lineup');
  }
  if (!input.canonicalPatch.genreLabels?.length && !input.official.genreLabels?.length) {
    gaps.add('genres');
  }
  if (!input.canonicalPatch.description?.trim() && !input.official.description?.trim()) {
    gaps.add('description');
  }
  if (!input.canonicalPatch.imageUrl?.trim() && !input.official.imageUrl?.trim()) {
    gaps.add('image');
  }
  if (!input.canonicalPatch.endDate?.trim() && !input.official.endDate?.trim()) {
    gaps.add('end_time');
  }
  if (!input.canonicalPatch.ageRestriction?.trim() && input.official.minimumAge === undefined) {
    gaps.add('minimum_age');
  }
  if (!input.canonicalPatch.ticketUrl?.trim() && !input.ticketMatched) {
    gaps.add('ticket_data');
  }

  return [...gaps];
}

function assessVenueBlockingReason(patch: ImportPublishFieldPatch): string | undefined {
  const venueName = patch.venueName?.trim();
  const venueCity = patch.venueCity?.trim();
  if (!venueName || !venueCity) {
    return 'venue_missing';
  }
  if (
    venueName &&
    venueCity &&
    eventVenueNamesMatch(venueName, venueCity) &&
    !POSTAL_CODE_PATTERN.test(venueCity)
  ) {
    return 'venue_conflict';
  }
  return undefined;
}

function hasStableOfficialIdentity(official: VerifiedOfficialEvidence): boolean {
  return Boolean(
    official.pageUrl?.trim() && official.pageTitle?.trim() && official.eventDate?.trim(),
  );
}

function hasBaseConsumerFields(patch: ImportPublishFieldPatch): boolean {
  return Boolean(
    patch.title?.trim() &&
      patch.startDate?.trim() &&
      patch.websiteUrl?.trim() &&
      patch.venueName?.trim() &&
      patch.venueCity?.trim(),
  );
}

function classifyBootshausImportDecision(
  buildResult: BuildCanonicalEventFromVerifiedPublicEvidenceResult,
  ticketMatch: BootshausTicketMatchResult,
  official: VerifiedOfficialEvidence,
): { decision: BootshausImportDecision; reviewReason: string; enrichmentGaps: string[] } {
  const blockingReasons: string[] = [];
  const enrichmentGaps = deriveEnrichmentGaps({
    buildResult,
    canonicalPatch: buildResult.canonicalPatch,
    official,
    lineup: buildResult.lineupPatch.entries.map((entry) => entry.displayName),
    ticketMatched: Boolean(ticketMatch.ticketEvidence),
  });

  for (const reason of buildResult.reviewReasons) {
    if (isBlockingReviewReason(reason)) {
      blockingReasons.push(reason);
    }
  }

  if (ticketMatch.matchReason === 'multiple_outbound_ticket_matches') {
    blockingReasons.push('ticket_match_conflict:outbound');
  }
  if (ticketMatch.matchReason === 'multiple_fuzzy_ticket_matches') {
    blockingReasons.push('ticket_match_conflict:fuzzy');
  }
  if (ticketMatch.conflictingTicketEvidence) {
    blockingReasons.push('conflicting_ticket_evidence');
  }

  const venueBlockingReason = assessVenueBlockingReason(buildResult.canonicalPatch);
  if (venueBlockingReason) {
    blockingReasons.push(venueBlockingReason);
  }

  if (!hasStableOfficialIdentity(official)) {
    return {
      decision: 'quarantine',
      reviewReason: blockingReasons.join(';') || 'unstable_official_identity',
      enrichmentGaps,
    };
  }

  if (
    buildResult.disposition === 'collision_review' ||
    ticketMatch.matchReason === 'multiple_outbound_ticket_matches' ||
    ticketMatch.matchReason === 'multiple_fuzzy_ticket_matches' ||
    ticketMatch.conflictingTicketEvidence
  ) {
    return {
      decision: 'conflict_review',
      reviewReason: blockingReasons.join(';') || 'identity_or_ticket_conflict',
      enrichmentGaps,
    };
  }

  if (!hasBaseConsumerFields(buildResult.canonicalPatch)) {
    const venueOnlyGap =
      blockingReasons.length > 0 &&
      blockingReasons.every((reason) => reason === 'venue_missing' || reason === 'venue_conflict');
    if (venueOnlyGap) {
      return {
        decision: 'quick_review',
        reviewReason: blockingReasons.join(';'),
        enrichmentGaps,
      };
    }

    return {
      decision: 'quarantine',
      reviewReason: blockingReasons.join(';') || 'missing_required_consumer_fields',
      enrichmentGaps,
    };
  }

  if (
    buildResult.disposition === 'blocked' &&
    buildResult.identityGate.verdict === 'mismatch' &&
    buildResult.identityGate.threeWayOutcome === 'all_sources_disagree'
  ) {
    return {
      decision: 'conflict_review',
      reviewReason: blockingReasons.join(';') || buildResult.identityGate.reason,
      enrichmentGaps,
    };
  }

  const identityBlocksBaseEvent =
    buildResult.disposition === 'blocked' &&
    (buildResult.identityGate.verdict === 'mismatch' ||
      buildResult.identityGate.threeWayOutcome === 'all_sources_disagree');

  if (!identityBlocksBaseEvent && blockingReasons.length === 0) {
    return {
      decision: 'consumer_ready',
      reviewReason: enrichmentGaps.join(';') || 'all_required_fields_verified',
      enrichmentGaps,
    };
  }

  if (
    buildResult.disposition === 'blocked' &&
    buildResult.identityGate.verdict === 'mismatch'
  ) {
    return {
      decision: 'conflict_review',
      reviewReason: blockingReasons.join(';') || buildResult.identityGate.reason,
      enrichmentGaps,
    };
  }

  return {
    decision: 'quick_review',
    reviewReason: blockingReasons.join(';') || buildResult.identityGate.reason || ticketMatch.matchReason,
    enrichmentGaps,
  };
}

function reviseOfficialEvidenceAfterTicketMatch(
  official: VerifiedOfficialEvidence,
  ticketMatch: BootshausTicketMatchResult,
  importSource: ImportSource,
): VerifiedOfficialEvidence {
  if (!ticketMatch.matchedByOutbound || !ticketMatch.ticketEvidence?.venueName?.trim()) {
    return official;
  }

  const defaults = resolveSourceFieldDefaults(importSource.sourceConfig, null);
  const ticketVenue = ticketMatch.ticketEvidence.venueName.trim();
  if (eventVenueNamesMatch(ticketVenue, defaults.venueName ?? 'Bootshaus')) {
    return official;
  }

  const stripped = stripBootshausDefaultVenueFields(
    {
      venueName: official.venueName,
      venueAddress: official.venueAddress,
      venuePostalCode: official.venuePostalCode,
      venueCity: official.venueCity,
      countryCode: official.countryCode,
    },
    defaults,
  );

  return {
    ...official,
    venueName: stripped.venueName,
    venueAddress: stripped.venueAddress,
    venuePostalCode: stripped.venuePostalCode,
    venueCity: stripped.venueCity,
    countryCode: stripped.countryCode,
  };
}

function countDuplicateCanonicalEvents(matrix: BootshausGoldenEventMatrixRow[]): number {
  const keys = matrix.map(
    (row) =>
      `${row.title.toLowerCase()}|${row.startDate ?? ''}|${row.venueName?.toLowerCase() ?? ''}`,
  );
  const seen = new Set<string>();
  let duplicates = 0;
  for (const key of keys) {
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }
  return duplicates;
}

export function runBootshausGoldenImportPath(input: {
  officialRawEvents: RawImportedEvent[];
  ticketRawEvents: RawImportedEvent[];
  officialImportSource: ImportSource;
  verifiedAt: string;
}): BootshausGoldenImportRunResult {
  const verifiedAt = input.verifiedAt;
  const upcomingOfficial = input.officialRawEvents.filter((raw) =>
    isUpcomingBootshausOfficialEvent(raw),
  );
  const ticketEvidencePool = input.ticketRawEvents.map((raw) =>
    mapTicketRawToVerifiedEvidence(raw, verifiedAt),
  );

  const matrix: BootshausGoldenEventMatrixRow[] = [];
  let consumerErrorCounters = { ...EMPTY_BOOTSHAUS_CONSUMER_ERROR_COUNTERS };

  for (const raw of upcomingOfficial) {
    const official = mapOfficialRawToVerifiedEvidence(raw, input.officialImportSource, verifiedAt);
    if (!official) {
      matrix.push({
        title: raw.title ?? raw.externalId,
        decision: 'quarantine',
        reviewReason: 'official_normalization_failed',
        lineup: [],
        enrichmentGaps: [],
      });
      continue;
    }

    const ticketMatch = matchTicketEvidenceForOfficial(official, ticketEvidencePool);
    const officialForBuild = reviseOfficialEvidenceAfterTicketMatch(
      official,
      ticketMatch,
      input.officialImportSource,
    );
    const bundle: VerifiedPublicEvidenceBundle = {
      officialEvidence: officialForBuild,
      ticketEvidence: ticketMatch.ticketEvidence,
      conflictingTicketEvidence: ticketMatch.conflictingTicketEvidence,
    };
    const buildResult = buildCanonicalEventFromVerifiedPublicEvidence(bundle);
    const lineup = buildResult.lineupPatch.entries.map((entry) => entry.displayName);
    const classification = classifyBootshausImportDecision(buildResult, ticketMatch, officialForBuild);
    const rowErrors = countRowConsumerErrors(
      buildResult.canonicalPatch,
      lineup,
      officialForBuild,
      ticketMatch.ticketEvidence,
      ticketMatch.matchReason,
    );
    consumerErrorCounters = mergeConsumerErrorCounters(consumerErrorCounters, rowErrors);

    matrix.push({
      title: buildResult.canonicalPatch.title ?? official.pageTitle ?? '',
      startDate: buildResult.canonicalPatch.startDate,
      endDate: buildResult.canonicalPatch.endDate,
      venueName: buildResult.canonicalPatch.venueName,
      venueAddress: buildResult.canonicalPatch.venueAddress,
      venuePostalCode: buildResult.canonicalPatch.venuePostalCode,
      venueCity: buildResult.canonicalPatch.venueCity,
      countryCode: buildResult.canonicalPatch.venueCountryCode,
      officialUrl: buildResult.canonicalPatch.websiteUrl,
      ticketUrl: buildResult.canonicalPatch.ticketUrl,
      priceText: buildResult.canonicalPatch.priceText,
      ticketStatus: buildResult.canonicalPatch.ticketStatus,
      genreLabels: buildResult.canonicalPatch.genreLabels,
      lineup,
      decision: classification.decision,
      reviewReason: classification.reviewReason,
      enrichmentGaps: classification.enrichmentGaps,
    });
  }

  consumerErrorCounters.duplicateCanonicalEvents = countDuplicateCanonicalEvents(matrix);

  const statusCounts: Record<BootshausImportDecision, number> = {
    consumer_ready: 0,
    quick_review: 0,
    conflict_review: 0,
    quarantine: 0,
  };
  for (const row of matrix) {
    statusCounts[row.decision] += 1;
  }

  return {
    matrix,
    statusCounts,
    consumerErrorCounters,
    officialEventCount: upcomingOfficial.length,
    ticketEventCount: input.ticketRawEvents.length,
    verifiedAt,
  };
}

export function noopPersistBootshausGoldenImportResult(
  _result: BootshausGoldenImportRunResult,
): { persisted: false; productionMutationsInThisRun: 0 } {
  return { persisted: false, productionMutationsInThisRun: 0 };
}

export function projectBootshausConsumerView(row: BootshausGoldenEventMatrixRow): {
  projection: ReturnType<typeof projectCanonicalEventFields>;
  ticketPresentation: ReturnType<typeof resolveConsumerTicketPresentation>;
} {
  const projection = projectCanonicalEventFields({
    title: row.title,
    description: '',
    venue: row.venueName ?? '',
    city: row.venueCity ?? '',
    artists: row.lineup,
    priceText: row.priceText,
    source: 'bootshaus-golden-import',
    ticketUrl: row.ticketUrl,
    genres: row.genreLabels,
  });
  const ticketPresentation = resolveConsumerTicketPresentation({
    title: row.title,
    priceText: row.priceText,
    displayPriceText: projection.displayPriceText,
    ticketUrl: row.ticketUrl,
    ticketAvailability: row.ticketStatus,
  });
  return { projection, ticketPresentation };
}
