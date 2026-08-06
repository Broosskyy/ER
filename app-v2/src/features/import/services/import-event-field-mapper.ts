import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { isTicketIoPlaceholderDescription } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import {
  resolveFillOnlyText,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-repair';
import type { AdminEventRecord } from '@/data/types/records';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { normalizeCanonicalEventDescription } from '@/features/import/domain/canonical-description-normalizer';
import { applyExplicitEventGeographyFields } from '@/features/import/services/historical-data-repair';
import type { ImportRecord } from '@/features/import/models/types';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import {
  type AdminEventTicketStatus,
  type CanonicalTicketPhase,
  formatMinimumAgeLabel,
  isEmptyPublishValue,
  parsePostalCodeFromAddress,
  readCandidateDoorsOpenAt,
} from '@/features/import/domain/canonical-ticket-phase';
import { buildCanonicalAttributeBundleFromImport, serializeCanonicalEventAttributes } from '@/features/events/domain/event-attribute-merge';
import { resolveDescriptionGenrePublish } from '@/features/import/domain/description-genre-publish-resolver';
import { buildSourceReferenceTicketEvidenceMetadata } from '@/features/import/domain/ticket-evidence-provenance';

export interface ImportPublishFieldPatch {
  title?: string;
  subtitle?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  doorsOpenAt?: string;
  venueName?: string;
  venueCity?: string;
  venueAddress?: string;
  venuePostalCode?: string;
  venueCountryCode?: string;
  latitude?: number;
  longitude?: number;
  organizerName?: string;
  ticketUrl?: string;
  priceText?: string;
  imageUrl?: string;
  websiteUrl?: string;
  ageRestriction?: string;
  ticketStatus?: AdminEventTicketStatus;
  ticketPhases?: CanonicalTicketPhase[];
  genreLabels?: string[];
  eventAttributes?: AdminEventRecord['eventAttributes'];
  floorCount?: number;
  stageCount?: number;
  venueEnvironment?: AdminEventRecord['venueEnvironment'];
  lastEntryAt?: string;
  dressCode?: string;
  accessibilityNotes?: string;
  attributeReviewRequired?: boolean;
}

export interface BuildAdminEventFromImportInput {
  record: ImportRecord;
  candidate?: CanonicalImportEvent;
  existingEventId?: string;
  existing?: AdminEventRecord | null;
  now?: string;
}

export interface MergeImportPublishFieldsInput {
  existing: AdminEventRecord;
  candidate: CanonicalImportEvent;
  fillOnly?: boolean;
}

function resolvePrimaryDescription(
  existing: string | undefined,
  incoming: string | undefined,
  fillOnly: boolean,
): string {
  const normalizedIncoming = normalizeCanonicalEventDescription(incoming);
  const normalizedExisting = normalizeCanonicalEventDescription(existing);
  if (fillOnly) {
    return resolveFillOnlyText(normalizedExisting, normalizedIncoming) ?? normalizedExisting ?? '';
  }
  if (normalizedIncoming && !isTicketIoPlaceholderDescription(normalizedIncoming)) {
    return normalizedIncoming;
  }
  return normalizedExisting ?? '';
}

function resolveTextField(
  existing: string | undefined,
  incoming: string | undefined,
  fillOnly: boolean,
): string | undefined {
  if (isEmptyPublishValue(incoming)) {
    return existing;
  }
  if (fillOnly) {
    return resolveFillOnlyText(existing, incoming) ?? existing;
  }
  return incoming ?? existing;
}

function resolveOptionalField<T>(
  existing: T | undefined,
  incoming: T | undefined,
  fillOnly: boolean,
): T | undefined {
  if (isEmptyPublishValue(incoming)) {
    return existing;
  }
  if (fillOnly && !isEmptyPublishValue(existing)) {
    return existing;
  }
  return incoming ?? existing;
}

function readGenreLabels(candidate: CanonicalImportEvent): string[] | undefined {
  const names = candidate.genreNames?.map((name) => name.trim()).filter(Boolean);
  return names && names.length > 0 ? [...new Set(names)] : undefined;
}

function readCountryCode(candidate: CanonicalImportEvent): string | undefined {
  return candidate.countryCode?.trim() || undefined;
}

function readPostalCode(candidate: CanonicalImportEvent): string | undefined {
  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
  const fromMeta = metadata?.postalCode ?? metadata?.venuePostalCode;
  if (typeof fromMeta === 'string' && fromMeta.trim()) {
    return fromMeta.trim();
  }
  return parsePostalCodeFromAddress(candidate.venueAddress);
}

function readMinimumAge(candidate: CanonicalImportEvent): number | undefined {
  if (candidate.minimumAge !== undefined) {
    return candidate.minimumAge;
  }
  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
  const raw = metadata?.minimumAge ?? metadata?.minimum_age;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  return undefined;
}

export function buildImportPublishFieldPatch(
  candidate: CanonicalImportEvent,
  options: { existing?: AdminEventRecord | null; fillOnly?: boolean } = {},
): ImportPublishFieldPatch {
  const existing = options.existing;
  const fillOnly = options.fillOnly ?? false;
  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
  const soldOut = metadata?.soldOut === true;
  const ticketStatusFallback = soldOut
    ? 'sold_out'
    : candidate.ticketUrl
      ? 'external_link'
      : existing?.ticketStatus;

  const minimumAge = candidate.minimumAge ?? readMinimumAge(candidate);
  const ageRestriction = formatMinimumAgeLabel(minimumAge);
  const attributeBundle = buildCanonicalAttributeBundleFromImport({
    candidate,
    existing,
  });

  // Official event pages (eventUrl/originalLink) belong on websiteUrl, not ticketUrl candidates.
  const alternateTicketUrls = [
    typeof metadata?.ticketUrl === 'string' ? metadata.ticketUrl : undefined,
  ].filter((url): url is string => typeof url === 'string' && url.trim().length > 0);

  const patch: ImportPublishFieldPatch = {
    title: fillOnly ? resolveTextField(existing?.title, candidate.title, true) : candidate.title,
    subtitle: resolveOptionalField(existing?.subtitle, candidate.subtitle, fillOnly),
    description: resolvePrimaryDescription(existing?.description, candidate.description, fillOnly),
    startDate: fillOnly
      ? resolveOptionalField(existing?.startDate, candidate.startDate, false) ?? existing?.startDate
      : candidate.startDate,
    endDate: resolveOptionalField(existing?.endDate, candidate.endDate, fillOnly),
    timezone: resolveOptionalField(existing?.timezone, candidate.timezone, fillOnly),
    doorsOpenAt: resolveOptionalField(
      existing?.doorsOpenAt,
      candidate.doorsOpenAt ?? readCandidateDoorsOpenAt(candidate),
      fillOnly,
    ),
    venueName: resolveTextField(existing?.venueName, candidate.venueName, fillOnly),
    venueCity: resolveTextField(existing?.venueCity, candidate.cityName, fillOnly),
    venueAddress: resolveTextField(existing?.venueAddress, candidate.venueAddress, fillOnly),
    venuePostalCode: resolveOptionalField(existing?.venuePostalCode, readPostalCode(candidate), fillOnly),
    venueCountryCode: resolveOptionalField(existing?.venueCountryCode, readCountryCode(candidate), fillOnly),
    latitude: resolveOptionalField(existing?.latitude, candidate.latitude, fillOnly),
    longitude: resolveOptionalField(existing?.longitude, candidate.longitude, fillOnly),
    organizerName: resolveTextField(existing?.organizerName, candidate.organizerName, fillOnly),
    ticketUrl: undefined,
    priceText: undefined,
    imageUrl: fillOnly
      ? existing?.imageUrl ?? candidate.imageUrl
      : candidate.imageUrl ?? existing?.imageUrl,
    websiteUrl: undefined,
    ageRestriction: resolveOptionalField(existing?.ageRestriction, ageRestriction, fillOnly),
    ticketStatus: undefined,
    ticketPhases: undefined,
    genreLabels: resolveOptionalField(existing?.genreLabels, readGenreLabels(candidate), fillOnly),
    eventAttributes: resolveOptionalField(
      existing?.eventAttributes,
      serializeCanonicalEventAttributes(attributeBundle.attributes),
      fillOnly,
    ),
    floorCount: resolveOptionalField(existing?.floorCount, attributeBundle.floorCount, fillOnly),
    stageCount: resolveOptionalField(existing?.stageCount, attributeBundle.stageCount, fillOnly),
    venueEnvironment: resolveOptionalField(
      existing?.venueEnvironment,
      attributeBundle.venueEnvironment,
      fillOnly,
    ),
    dressCode: resolveOptionalField(existing?.dressCode, attributeBundle.dressCode, fillOnly),
    accessibilityNotes: resolveOptionalField(
      existing?.accessibilityNotes,
      attributeBundle.accessibilityNotes,
      fillOnly,
    ),
    attributeReviewRequired: attributeBundle.reviewRequired,
  };

  const detailBlocked =
    metadata?.detailEnrichment === 'blocked' || metadata?.lineupBlockerClass != null;

  const ticketWrite = writeCanonicalTicketFields({
    existing: existing ?? null,
    candidate,
    fillOnly,
    detailBlocked,
    extraCandidates: alternateTicketUrls.map((url) => ({
      url,
      field: 'metadata.ticketUrl',
      confidence: 0.9,
    })),
  });

  const descriptionGenre = resolveDescriptionGenrePublish({
    existingDescription: existing?.description,
    existingGenres: existing?.genreLabels,
    officialDescription: candidate.description,
    officialHtml: typeof metadata?.officialHtml === 'string' ? metadata.officialHtml : undefined,
    ticketPlatformDescription:
      typeof metadata?.ticketPlatformDescription === 'string'
        ? metadata.ticketPlatformDescription
        : undefined,
    ticketPlatformGenres: readGenreLabels(candidate),
    event: {
      eventId: existing?.id ?? candidate.externalId ?? 'unknown',
      title: existing?.title ?? candidate.title ?? '',
      startDate: existing?.startDate ?? candidate.startDate,
      venueName: existing?.venueName ?? candidate.venueName,
      venueCity: existing?.venueCity ?? candidate.cityName,
    },
    ticketEvidence: {
      pageTitle: typeof metadata?.pageTitle === 'string' ? metadata.pageTitle : undefined,
      listRowTitle: typeof metadata?.listRowTitle === 'string' ? metadata.listRowTitle : undefined,
      eventDate: typeof metadata?.eventDate === 'string' ? metadata.eventDate : undefined,
      venueName: typeof metadata?.venueName === 'string' ? metadata.venueName : undefined,
    },
    sourceId: candidate.sourceId,
    observedAt:
      typeof metadata?.observedAt === 'string'
        ? metadata.observedAt
        : typeof metadata?.verifiedAt === 'string'
          ? metadata.verifiedAt
          : undefined,
  });

  if (descriptionGenre.description) {
    patch.description = resolvePrimaryDescription(
      existing?.description,
      descriptionGenre.description,
      fillOnly,
    );
  }
  if (descriptionGenre.genreLabels?.length) {
    patch.genreLabels = resolveOptionalField(
      existing?.genreLabels,
      descriptionGenre.genreLabels,
      fillOnly,
    );
  }

  void buildSourceReferenceTicketEvidenceMetadata(
    ticketWrite.audit,
    typeof metadata?.verifiedAt === 'string' ? metadata.verifiedAt : undefined,
  );

  patch.ticketUrl = ticketWrite.patch.ticketUrl;
  patch.websiteUrl =
    ticketWrite.patch.websiteUrl ??
    resolveOptionalField(existing?.websiteUrl, candidate.eventUrl ?? candidate.originalLink, fillOnly);
  patch.priceText = ticketWrite.patch.priceText;
  patch.ticketStatus = ticketWrite.patch.ticketStatus ?? resolveOptionalField(
    existing?.ticketStatus,
    ticketStatusFallback,
    fillOnly,
  );
  patch.ticketPhases = ticketWrite.patch.ticketPhases;

  return patch;
}

export function applyImportPublishFieldPatch(
  base: AdminEventRecord,
  patch: ImportPublishFieldPatch,
): AdminEventRecord {
  return {
    ...base,
    ...patch,
    description: patch.description ?? base.description,
    startDate: patch.startDate ?? base.startDate,
  };
}

export function mergeImportPublishFields(input: MergeImportPublishFieldsInput): AdminEventRecord {
  const patch = buildImportPublishFieldPatch(input.candidate, {
    existing: input.existing,
    fillOnly: input.fillOnly,
  });
  const merged = applyImportPublishFieldPatch(
    {
      ...input.existing,
      updatedAt: new Date().toISOString(),
    },
    patch,
  );
  const geographyPatch = applyExplicitEventGeographyFields(input.existing, input.candidate);
  return { ...merged, ...geographyPatch };
}

export function buildAdminEventFromImportFields(input: BuildAdminEventFromImportInput): AdminEventRecord {
  const candidate =
    input.candidate ??
    ({
      ...getEffectiveCandidate(input.record),
      sourceId: input.record.sourceId,
      sourceName: input.record.sourceName ?? '',
      externalId: input.record.externalId,
      rawSourceType: getEffectiveCandidate(input.record).rawSourceType,
    } satisfies CanonicalImportEvent);

  const now = input.now ?? new Date().toISOString();
  const organizerId = input.record.reviewerEdits?.matchedOrganizerId ?? input.record.matchedOrganizerId;
  const patch = buildImportPublishFieldPatch(candidate, { existing: input.existing });

  const base: AdminEventRecord = {
    id: input.existingEventId ?? input.existing?.id ?? createEventId(),
    title: patch.title ?? candidate.title,
    subtitle: patch.subtitle,
    description: patch.description ?? '',
    cityId: input.record.reviewerEdits?.matchedCityId ?? input.record.matchedCityId,
    venueId: input.record.reviewerEdits?.matchedVenueId ?? input.record.matchedVenueId,
    organizerId,
    organizerName: patch.organizerName,
    artistId: undefined,
    genreId: (input.record.reviewerEdits?.matchedGenreIds ?? input.record.matchedGenreIds)?.[0],
    sourceId: input.record.sourceId,
    startDate: patch.startDate ?? candidate.startDate,
    endDate: patch.endDate,
    ticketUrl: patch.ticketUrl,
    priceText: patch.priceText,
    imageUrl: patch.imageUrl,
    websiteUrl: patch.websiteUrl ?? input.record.originalUrl,
    venueName: patch.venueName,
    venueCity: patch.venueCity,
    venueAddress: patch.venueAddress,
    venuePostalCode: patch.venuePostalCode,
    venueCountryCode: patch.venueCountryCode,
    latitude: patch.latitude,
    longitude: patch.longitude,
    timezone: patch.timezone,
    doorsOpenAt: patch.doorsOpenAt,
    ageRestriction: patch.ageRestriction,
    ticketStatus: patch.ticketStatus,
    ticketPhases: patch.ticketPhases,
    genreLabels: patch.genreLabels,
    eventAttributes: patch.eventAttributes,
    floorCount: patch.floorCount,
    stageCount: patch.stageCount,
    venueEnvironment: patch.venueEnvironment,
    lastEntryAt: patch.lastEntryAt,
    dressCode: patch.dressCode,
    accessibilityNotes: patch.accessibilityNotes,
    attributeReviewRequired: patch.attributeReviewRequired,
    status: 'published',
    createdAt: input.existing?.createdAt ?? now,
    updatedAt: now,
  };

  const geographyPatch = applyExplicitEventGeographyFields(input.existing ?? base, candidate);
  return { ...base, ...geographyPatch };
}

function createEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const PUBLISH_FIELD_MAPPINGS: Array<{
  patchKey: keyof ImportPublishFieldPatch;
  ownershipField: string;
}> = [
  { patchKey: 'title', ownershipField: 'title' },
  { patchKey: 'subtitle', ownershipField: 'title' },
  { patchKey: 'description', ownershipField: 'description' },
  { patchKey: 'startDate', ownershipField: 'startDate' },
  { patchKey: 'endDate', ownershipField: 'endDate' },
  { patchKey: 'timezone', ownershipField: 'startDate' },
  { patchKey: 'doorsOpenAt', ownershipField: 'startDate' },
  { patchKey: 'venueName', ownershipField: 'venueName' },
  { patchKey: 'venueCity', ownershipField: 'cityName' },
  { patchKey: 'venueAddress', ownershipField: 'venueAddress' },
  { patchKey: 'venuePostalCode', ownershipField: 'venueAddress' },
  { patchKey: 'venueCountryCode', ownershipField: 'countryCode' },
  { patchKey: 'latitude', ownershipField: 'coordinates' },
  { patchKey: 'longitude', ownershipField: 'coordinates' },
  { patchKey: 'organizerName', ownershipField: 'organizerName' },
  { patchKey: 'ticketUrl', ownershipField: 'ticketUrl' },
  { patchKey: 'priceText', ownershipField: 'priceText' },
  { patchKey: 'imageUrl', ownershipField: 'imageUrl' },
  { patchKey: 'websiteUrl', ownershipField: 'websiteUrl' },
  { patchKey: 'ageRestriction', ownershipField: 'description' },
  { patchKey: 'ticketStatus', ownershipField: 'ticketStatus' },
  { patchKey: 'ticketPhases', ownershipField: 'ticketStatus' },
  { patchKey: 'genreLabels', ownershipField: 'genres' },
  { patchKey: 'eventAttributes', ownershipField: 'description' },
  { patchKey: 'floorCount', ownershipField: 'description' },
  { patchKey: 'stageCount', ownershipField: 'description' },
  { patchKey: 'venueEnvironment', ownershipField: 'description' },
  { patchKey: 'dressCode', ownershipField: 'description' },
  { patchKey: 'accessibilityNotes', ownershipField: 'description' },
];
