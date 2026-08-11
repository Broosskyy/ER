import {
  extractCanonicalLineupEntriesFromSourceMetadata,
} from '@/features/aggregation/domain/canonical-lineup-from-metadata';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';
import {
  deriveTicketStatusFromPhases,
  normalizeSourceTicketOffer,
  type AdminEventTicketStatus,
  type CanonicalTicketPhase,
} from '@/features/import/domain/canonical-ticket-phase';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

import type {
  CleanSourceFamily,
  ConnectorOutput,
  TicketExcludedProductEvidence,
} from './event-evidence';

type JsonRecord = Record<string, unknown>;

export interface EvidenceTransferAudit {
  nativeFields: string[];
  transferredFields: string[];
  intentionallyExcludedFields: string[];
  unexpectedLostFields: string[];
}

export interface ProductionEvidenceBridgeResult {
  output: ConnectorOutput;
  audit: EvidenceTransferAudit;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function ticketStatus(value: unknown): AdminEventTicketStatus | undefined {
  return [
    'unknown',
    'external_link',
    'on_sale',
    'presale',
    'available',
    'sold_out',
    'cancelled',
    'at_door',
  ].includes(String(value))
    ? (value as AdminEventTicketStatus)
    : undefined;
}

function mapLineup(raw: RawImportedEvent) {
  const rawEntries = raw.sourceMetadata?.lineupEntries;
  const hasStructuredEntries =
    Array.isArray(rawEntries) && rawEntries.length > 0;
  const headlinerNames = new Set(
    (Array.isArray(rawEntries) ? rawEntries : [])
      .map((entry) => record(entry))
      .filter((entry) => entry.headliner === true)
      .flatMap((entry) =>
        sanitizeLineupArtistNames(
          text(entry.displayName) ? [text(entry.displayName)!] : undefined,
        ) ?? [],
      )
      .map(normalizeMatchText),
  );
  const canonicalEntries = extractCanonicalLineupEntriesFromSourceMetadata(
    raw.sourceMetadata,
    hasStructuredEntries ? undefined : raw.artistNames,
  );
  const seen = new Set<string>();
  const lineup: NonNullable<ConnectorOutput['lineup']> = [];
  for (const entry of canonicalEntries) {
    const artistNames =
      sanitizeLineupArtistNames(
        entry.artists.filter(
          (artistName) =>
            !/[<>]/.test(artistName) &&
            !/\b(?:public\s+transport|tickets?|venue|einlass|doors?|location)\b/i.test(
              artistName,
            ),
        ),
      ) ?? [];
    for (const artistName of artistNames) {
      const normalizedName = normalizeMatchText(artistName);
      if (!normalizedName || seen.has(normalizedName)) {
        continue;
      }
      seen.add(normalizedName);
      const isHeadliner = headlinerNames.has(normalizedName);
      const billingRelation = [
        'SOLO',
        'B2B',
        'F2F',
        'VS',
        'LIVE',
        'SPECIAL_GUEST',
      ].includes(entry.billingRelation)
        ? entry.billingRelation
        : 'SOLO';
      lineup.push({
        sortOrder: lineup.length,
        displayName: artistName,
        rawSourceSpelling: artistName,
        normalizedName,
        billingRelation: (isHeadliner ? 'HEADLINER' : billingRelation) as
          | 'SOLO'
          | 'B2B'
          | 'F2F'
          | 'VS'
          | 'LIVE'
          | 'HEADLINER'
          | 'SPECIAL_GUEST',
        isB2b: entry.billingRelation === 'B2B',
        isF2f: entry.billingRelation === 'F2F',
        isLiveSet: entry.billingRelation === 'LIVE',
        stage: entry.stage,
        confidence: entry.confidence ?? 0.8,
        reviewState: 'accepted' as const,
        inclusionReason: `production_${
          entry.provenance?.source ?? 'connector_lineup'
        }`,
      });
    }
  }
  return lineup;
}

function mapTicketPhases(
  raw: RawImportedEvent,
  metadata: JsonRecord,
): CanonicalTicketPhase[] | undefined {
  const nativeOffers = Array.isArray(metadata.ticketOffers)
    ? metadata.ticketOffers.filter(
        (entry): entry is JsonRecord =>
          Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)),
      )
    : [];
  const fallbackOffer: JsonRecord[] =
    nativeOffers.length === 0 &&
    raw.priceAmount !== undefined &&
    raw.priceAmount > 0
      ? [
          {
            name: 'Admission',
            priceAmount: raw.priceAmount,
            priceCurrency: raw.priceCurrency,
            availability: text(metadata.availability),
            soldOut:
              typeof metadata.soldOut === 'boolean'
                ? metadata.soldOut
                : undefined,
            purchaseUrl: raw.ticketUrl,
          },
        ]
      : [];
  const phases = [...nativeOffers, ...fallbackOffer].map((offer, index) => {
    const priceAmount = numberValue(offer.priceAmount);
    const purchaseUrl = text(offer.purchaseUrl);
    const explicitSoldOut =
      typeof offer.soldOut === 'boolean' ? offer.soldOut : undefined;
    return normalizeSourceTicketOffer(
      {
        name: text(offer.name) ?? 'Admission',
        priceAmount,
        priceCurrency: text(offer.priceCurrency),
        availability: text(offer.availability),
        soldOut:
          explicitSoldOut ??
          (purchaseUrl && priceAmount !== undefined && priceAmount > 0
            ? false
            : undefined),
        purchaseUrl,
        validFrom: text(offer.validFrom),
        validUntil: text(offer.validUntil),
      },
      index,
    );
  });
  return phases.length ? phases : undefined;
}

function mapExcludedProducts(value: unknown): TicketExcludedProductEvidence[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const products: TicketExcludedProductEvidence[] = [];
  for (const valueEntry of value) {
    const entry = record(valueEntry);
    const name = text(entry.name) ?? text(entry.rawProductName);
    if (!name) continue;
    products.push({
      name,
      reason:
        text(entry.reason) ??
        text(entry.exclusionReason) ??
        'supplementary_add_on_product',
      priceAmount: numberValue(entry.priceAmount),
      priceCurrency: text(entry.priceCurrency),
    });
  }
  return products.length ? products : undefined;
}

function nonEmpty<T>(value: T[] | undefined): T[] | undefined {
  return value?.length ? value : undefined;
}

function mergeEvidence(
  base: ConnectorOutput,
  supplemental: ConnectorOutput | undefined,
): ConnectorOutput {
  if (!supplemental) return base;
  const preferSupplemental = base.sourceFamily === 'official_website';
  const first = <T>(baseValue: T | undefined, supplementalValue: T | undefined) =>
    preferSupplemental
      ? supplementalValue ?? baseValue
      : baseValue ?? supplementalValue;
  const supplementalAdmission =
    supplemental.admissionProducts?.length ||
    supplemental.ticketPhases?.length ||
    supplemental.admissionPrice
      ? supplemental
      : undefined;
  return {
    ...base,
    requestedSourceUrl:
      supplemental.requestedSourceUrl ?? base.requestedSourceUrl,
    finalSourceUrl: supplemental.finalSourceUrl ?? base.finalSourceUrl,
    sourceUrl: supplemental.finalSourceUrl ?? base.sourceUrl,
    title: first(base.title, supplemental.title),
    startDate: first(base.startDate, supplemental.startDate),
    endDate: first(base.endDate, supplemental.endDate),
    venueName: first(base.venueName, supplemental.venueName),
    locationText: first(base.locationText, supplemental.locationText),
    officialWebsiteUrl: first(
      base.officialWebsiteUrl,
      supplemental.officialWebsiteUrl,
    ),
    outboundTicketUrls: [
      ...new Set([
        ...(base.outboundTicketUrls ?? []),
        ...(supplemental.outboundTicketUrls ?? []),
      ]),
    ],
    description: first(base.description, supplemental.description),
    genres: first(base.genres, supplemental.genres),
    lineup: first(base.lineup, supplemental.lineup),
    lineupState: first(base.lineupState, supplemental.lineupState),
    lineupReason: first(base.lineupReason, supplemental.lineupReason),
    minimumAge: first(base.minimumAge, supplemental.minimumAge),
    venueEnvironment: first(
      base.venueEnvironment,
      supplemental.venueEnvironment,
    ),
    publicTicketUrl: base.publicTicketUrl ?? supplemental.publicTicketUrl,
    checkoutEvidenceUrl:
      base.checkoutEvidenceUrl ?? supplemental.checkoutEvidenceUrl,
    admissionPrice:
      supplementalAdmission?.admissionPrice ?? base.admissionPrice,
    ticketPhases: supplementalAdmission?.ticketPhases ?? base.ticketPhases,
    admissionProducts:
      supplementalAdmission?.admissionProducts ?? base.admissionProducts,
    excludedProducts: nonEmpty([
      ...(base.excludedProducts ?? []),
      ...(supplemental.excludedProducts ?? []),
    ]),
    ticketStatus:
      supplementalAdmission?.ticketStatus ?? base.ticketStatus,
    duplicateCandidate:
      base.duplicateCandidate || supplemental.duplicateCandidate,
    diagnostics: [
      ...(base.diagnostics ?? []),
      ...(supplemental.diagnostics ?? []),
    ],
  };
}

function auditTransfer(
  family: CleanSourceFamily,
  raw: RawImportedEvent,
  metadata: JsonRecord,
  output: ConnectorOutput,
  supplemental: ConnectorOutput | undefined,
): EvidenceTransferAudit {
  const nativeLineupPresent = Boolean(
    raw.artistNames?.length ||
      (Array.isArray(metadata.lineupEntries) &&
        metadata.lineupEntries.length > 0) ||
      supplemental?.lineup?.length,
  );
  const lineupRejectedByExistingValidation =
    nativeLineupPresent && !output.lineup?.length;
  const fields: Array<[string, boolean, boolean, boolean]> =
    family === 'official_website'
      ? [
          ['title', Boolean(raw.title ?? supplemental?.title), Boolean(output.title), false],
          ['startDate', Boolean(raw.startDate ?? supplemental?.startDate), Boolean(output.startDate), false],
          ['endDate', Boolean(raw.endDate ?? supplemental?.endDate), Boolean(output.endDate), false],
          ['venueName', Boolean(raw.venueName ?? supplemental?.venueName), Boolean(output.venueName), false],
          ['description', Boolean(raw.description ?? supplemental?.description), Boolean(output.description), false],
          ['genres', Boolean(raw.genreNames?.length || supplemental?.genres?.length), Boolean(output.genres?.length), false],
          ['lineup', nativeLineupPresent, Boolean(output.lineup?.length), lineupRejectedByExistingValidation],
          ['minimumAge', raw.minimumAge !== undefined || Boolean(metadata.minimumAge ?? supplemental?.minimumAge), Boolean(output.minimumAge), false],
          ['venueEnvironment', Boolean(metadata.venueEnvironment ?? supplemental?.venueEnvironment), Boolean(output.venueEnvironment), false],
          ['officialWebsiteUrl', Boolean(raw.eventUrl ?? raw.sourceUrl ?? supplemental?.officialWebsiteUrl), Boolean(output.officialWebsiteUrl), false],
          ['verifiedAt', Boolean(text(metadata.verifiedAt) ?? output.verifiedAt), Boolean(output.verifiedAt), false],
          ['images', Boolean(raw.imageUrl ?? raw.imageUrls?.length), false, true],
        ]
      : [
          ['title', Boolean(metadata.pageTitle ?? metadata.listRowTitle ?? raw.title ?? supplemental?.title), Boolean(output.title), false],
          ['startDate', Boolean(metadata.eventDate ?? raw.startDate ?? supplemental?.startDate), Boolean(output.startDate), false],
          ['venueName', Boolean(metadata.venueName ?? raw.venueName ?? supplemental?.venueName), Boolean(output.venueName), false],
          ['publicTicketUrl', Boolean(metadata.publicTicketPageUrl ?? raw.ticketUrl ?? supplemental?.publicTicketUrl), Boolean(output.publicTicketUrl), false],
          ['checkoutEvidenceUrl', Boolean(metadata.checkoutEvidenceUrl ?? supplemental?.checkoutEvidenceUrl), Boolean(output.checkoutEvidenceUrl), false],
          ['ticketOffers', Boolean((Array.isArray(metadata.ticketOffers) && metadata.ticketOffers.length) || supplemental?.admissionProducts?.length), Boolean(output.admissionProducts?.length), false],
          ['excludedProducts', Boolean((Array.isArray(metadata.excludedProducts) && metadata.excludedProducts.length) || supplemental?.excludedProducts?.length), Boolean(output.excludedProducts?.length), false],
          ['price', raw.priceAmount !== undefined || Boolean(raw.priceText ?? metadata.priceText ?? supplemental?.admissionPrice), Boolean(output.admissionPrice), false],
          ['ticketStatus', Boolean(metadata.availability) || typeof metadata.soldOut === 'boolean' || Boolean(supplemental?.ticketStatus), Boolean(output.ticketStatus), false],
          ['verifiedAt', Boolean(metadata.verifiedAt), Boolean(output.verifiedAt), false],
          ['lineup', nativeLineupPresent, Boolean(output.lineup?.length), lineupRejectedByExistingValidation],
          ['genres', Boolean(raw.genreNames?.length || metadata.genreNames), Boolean(output.genres?.length), false],
          ['officialWebsiteUrl', Boolean(metadata.sourceOfficialPageUrl), false, true],
          ['images', Boolean(raw.imageUrl ?? raw.imageUrls?.length), false, true],
        ];
  const present = fields.filter(([, native]) => native);
  return {
    nativeFields: present.map(([field]) => field),
    transferredFields: present
      .filter(([, , transferred]) => transferred)
      .map(([field]) => field),
    intentionallyExcludedFields: present
      .filter(([, , , excluded]) => excluded)
      .map(([field]) => field),
    unexpectedLostFields: present
      .filter(([, , transferred, excluded]) => !transferred && !excluded)
      .map(([field]) => field),
  };
}

/** Bridges already-produced connector evidence into the minimal Clean Core contract. */
export function bridgeProductionSourceEvidence(input: {
  sourceId: string;
  sourceFamily: CleanSourceFamily;
  rawEvent: RawImportedEvent;
  fetchVerifiedAt?: string;
  supplementalEvidence?: ConnectorOutput;
  requestedSourceUrl?: string;
  finalSourceUrl?: string;
}): ProductionEvidenceBridgeResult {
  const { rawEvent: raw, sourceFamily: family } = input;
  const metadata = record(raw.sourceMetadata);
  const listCard = record(metadata.listCardEvidence);
  const phases =
    family === 'official_website'
      ? undefined
      : mapTicketPhases(raw, metadata);
  const availableAmounts = (phases ?? [])
    .filter((phase) => phase.soldOut !== true && phase.available !== false)
    .map((phase) => phase.priceAmount)
    .filter((amount): amount is number => amount !== undefined && amount > 0);
  const amount = availableAmounts.length
    ? Math.min(...availableAmounts)
    : undefined;
  const pricedPhase = phases?.find((phase) => phase.priceAmount === amount);
  const lineup = mapLineup(raw);
  const sourceUrl =
    input.finalSourceUrl ??
    raw.eventUrl ??
    raw.originalLink ??
    raw.sourceUrl ??
    '';
  const publicTicketUrl =
    text(metadata.publicTicketPageUrl) ??
    text(metadata.publicCtaCandidateUrl) ??
    text(listCard.publicTicketPageUrl) ??
    raw.ticketUrl ??
    (family !== 'official_website' ? raw.eventUrl : undefined);
  const base: ConnectorOutput = {
    sourceId: input.sourceId,
    sourceFamily: family,
    sourceUrl,
    requestedSourceUrl:
      input.requestedSourceUrl ??
      raw.eventUrl ??
      raw.originalLink ??
      raw.sourceUrl,
    finalSourceUrl: input.finalSourceUrl ?? sourceUrl,
    verifiedAt:
      text(metadata.verifiedAt) ??
      text(listCard.verifiedAt) ??
      input.fetchVerifiedAt,
    title:
      family === 'official_website'
        ? raw.title
        : text(metadata.pageTitle) ??
          text(metadata.listRowTitle) ??
          text(listCard.listRowTitle) ??
          raw.title,
    startDate:
      family === 'official_website'
        ? raw.startDate
        : text(metadata.eventDate) ??
          text(listCard.eventDate) ??
          raw.startDate,
    endDate: raw.endDate,
    venueName:
      family === 'official_website'
        ? raw.venueName
        : text(metadata.venueName) ??
          text(listCard.venueName) ??
          raw.venueName,
    locationText: raw.venueAddress ?? raw.cityName ?? raw.venueName,
    officialWebsiteUrl:
      family === 'official_website' ? raw.eventUrl ?? raw.sourceUrl : undefined,
    outboundTicketUrls:
      family === 'official_website'
        ? [
            ...new Set([
              ...stringArray(metadata.outboundTicketLinks),
              ...(raw.ticketUrl ? [raw.ticketUrl] : []),
            ]),
          ]
        : [],
    description: raw.description,
    genres: nonEmpty(raw.genreNames ?? stringArray(metadata.genreNames)),
    lineup: nonEmpty(lineup),
    lineupState: lineup.length ? 'explicit_artists' : undefined,
    minimumAge:
      raw.minimumAge !== undefined
        ? String(raw.minimumAge)
        : text(metadata.minimumAge),
    venueEnvironment: ['indoor', 'outdoor', 'hybrid'].includes(
      String(metadata.venueEnvironment),
    )
      ? (metadata.venueEnvironment as 'indoor' | 'outdoor' | 'hybrid')
      : undefined,
    publicTicketUrl:
      family === 'official_website' ? undefined : publicTicketUrl,
    checkoutEvidenceUrl:
      family === 'official_website'
        ? undefined
        : text(metadata.checkoutEvidenceUrl),
    admissionPrice:
      family !== 'official_website' && amount !== undefined
        ? {
            amount,
            currency: pricedPhase?.priceCurrency ?? raw.priceCurrency ?? 'EUR',
            text:
              pricedPhase?.priceLabel ??
              raw.priceText ??
              text(metadata.priceText) ??
              text(listCard.priceText),
          }
        : undefined,
    ticketPhases: phases,
    admissionProducts: phases,
    excludedProducts:
      family === 'official_website'
        ? undefined
        : mapExcludedProducts(metadata.excludedProducts),
    ticketStatus:
      family === 'official_website'
        ? undefined
        : deriveTicketStatusFromPhases(
            phases,
            ticketStatus(metadata.ticketStatus),
          ),
    diagnostics: ['production_evidence_bridge'],
  };
  const output = mergeEvidence(base, input.supplementalEvidence);
  const audit = auditTransfer(
    family,
    raw,
    metadata,
    output,
    input.supplementalEvidence,
  );
  return { output, audit };
}
