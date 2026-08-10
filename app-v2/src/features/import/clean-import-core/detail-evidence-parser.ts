import { extractAttributesFromDescriptionText } from '@/features/aggregation/domain/textual-attribute-parser';
import type { StructuredLineupEntry } from '@/features/aggregation/domain/structured-lineup';
import { parseGermanPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import {
  classifyTicketIoDetailHtml,
  type TicketIoPageIdentity,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-classification';
import {
  parseTicketIoDetailHtml,
  type TicketIoLineupEntry,
  type TicketIoTicketOffer,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-parser';
import { parseTicketKingsDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-detail-parser';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import {
  deriveTicketStatusFromPhases,
  normalizeSourceTicketOffer,
} from '@/features/import/domain/canonical-ticket-phase';
import { extractDetailPage } from '@/features/import/unified-website/detail-extraction';

import type {
  CleanSourceFamily,
  ConnectorOutput,
  LineupEvidenceState,
} from './event-evidence';

export interface DetailEvidenceRequest {
  sourceId: string;
  sourceFamily: CleanSourceFamily;
  sourceUrl: string;
  verifiedAt?: string;
  html: string;
  checkoutHtml?: string;
  identity?: {
    title?: string;
    startDate?: string;
    endDate?: string;
    venueName?: string;
    locationText?: string;
  };
  listCard?: {
    title: string;
    eventDate?: string;
    venueName?: string;
    priceText?: string;
    publicTicketUrl?: string;
    soldOut?: boolean;
  };
}

function billingRelation(entry: {
  isB2b?: boolean;
  isF2f?: boolean;
  isLiveSet?: boolean;
}): LineupEvidenceEntry['billingRelation'] {
  if (entry.isB2b) return 'B2B';
  if (entry.isF2f) return 'F2F';
  if (entry.isLiveSet) return 'LIVE';
  return 'SOLO';
}

function toLineupEvidence(
  entries: Array<TicketIoLineupEntry | StructuredLineupEntry> | undefined,
): LineupEvidenceEntry[] | undefined {
  const lineup = entries?.map((entry, index) => {
    const roles =
      'isB2b' in entry
        ? {
            isB2b: entry.isB2b ?? false,
            isF2f: entry.isF2f ?? false,
            isLiveSet: entry.isLiveSet ?? false,
          }
        : { isB2b: false, isF2f: false, isLiveSet: false };
    return {
      sortOrder: 'sortOrder' in entry ? entry.sortOrder : index,
      displayName: entry.displayName,
      rawSourceSpelling: entry.displayName,
      normalizedName: entry.normalizedName,
      billingRelation: billingRelation(roles),
      ...roles,
      confidence: entry.confidence,
      reviewState: 'accepted' as const,
      inclusionReason: `connector_${entry.source}`,
    };
  });
  return lineup?.length ? lineup : undefined;
}

function ticketFieldsFromOffers(offers: TicketIoTicketOffer[] | undefined): Pick<
  ConnectorOutput,
  'admissionPrice' | 'ticketPhases' | 'admissionProducts' | 'ticketStatus'
> {
  if (!offers?.length) {
    return {};
  }
  const ticketPhases = offers.map((offer, index) =>
    normalizeSourceTicketOffer(
      {
        ...offer,
        soldOut:
          offer.soldOut ??
          (offer.purchaseUrl &&
          offer.priceAmount !== undefined &&
          offer.priceAmount > 0
            ? false
            : undefined),
      },
      index,
    ),
  );
  const availableAmounts = ticketPhases
    .filter((phase) => phase.soldOut !== true && phase.available !== false)
    .map((phase) => phase.priceAmount)
    .filter((amount): amount is number => amount !== undefined);
  const allAmounts = ticketPhases
    .map((phase) => phase.priceAmount)
    .filter((amount): amount is number => amount !== undefined);
  const amount = Math.min(...(availableAmounts.length ? availableAmounts : allAmounts));
  const pricedPhase = ticketPhases.find((phase) => phase.priceAmount === amount);

  return {
    ticketPhases,
    admissionProducts: ticketPhases,
    ticketStatus: deriveTicketStatusFromPhases(ticketPhases),
    admissionPrice: Number.isFinite(amount)
      ? {
          amount,
          currency: pricedPhase?.priceCurrency ?? 'EUR',
          text: pricedPhase?.priceLabel,
        }
      : undefined,
  };
}

function parseOfficialWebsite(request: DetailEvidenceRequest): ConnectorOutput {
  const detail = extractDetailPage(request.html, request.sourceUrl);
  const description = detail.description?.description;
  const attributes = extractAttributesFromDescriptionText(description, 'official_website');

  return {
    sourceId: request.sourceId,
    sourceFamily: request.sourceFamily,
    sourceUrl: request.sourceUrl,
    verifiedAt: request.verifiedAt,
    title: detail.title?.normalizedTitle,
    startDate: detail.startDate,
    endDate: detail.endDate,
    venueName: detail.venue?.venueName,
    locationText: detail.venue?.venueName ?? detail.cityName,
    officialWebsiteUrl: detail.officialEventUrl ?? request.sourceUrl,
    outboundTicketUrls: detail.ticket?.url ? [detail.ticket.url] : [],
    description,
    genres: detail.genres,
    lineup: detail.lineup?.entries,
    lineupState: detail.lineup?.state,
    lineupReason: detail.lineup?.inclusionReason,
    minimumAge: attributes.minimumAge,
    venueEnvironment: attributes.venueEnvironment,
    diagnostics: detail.diagnostics.map((entry) => entry.code),
  };
}

function ticketIoIdentity(
  request: DetailEvidenceRequest,
  parsed: TicketIoPageIdentity,
): DetailEvidenceRequest['identity'] {
  if (parsed.pageTitle && parsed.eventDate && parsed.venueName) {
    return {
      title: parsed.pageTitle,
      startDate: parsed.eventDate,
      venueName: parsed.venueName,
    };
  }
  if (request.listCard) {
    return {
      title: request.listCard.title,
      startDate: request.listCard.eventDate,
      venueName: request.listCard.venueName,
    };
  }
  return request.identity;
}

function parseTicketIo(request: DetailEvidenceRequest): ConnectorOutput {
  const classification = classifyTicketIoDetailHtml(request.html);
  const isPowWithoutContent =
    classification.detailFetchStatus === 'pow_challenge' && !request.listCard;
  if (isPowWithoutContent) {
    return {
      sourceId: request.sourceId,
      sourceFamily: request.sourceFamily,
      sourceUrl: request.sourceUrl,
      verifiedAt: request.verifiedAt,
      diagnostics: [...classification.diagnostics, 'identity_blocked:pow_without_list_card'],
    };
  }

  const identity = ticketIoIdentity(request, classification.identity);
  const detail =
    classification.detailFetchStatus === 'ok'
      ? parseTicketIoDetailHtml(request.html)
      : undefined;
  const listPrice = request.listCard?.priceText
    ? parseGermanPriceText(request.listCard.priceText)
    : undefined;
  const explicitFree = /(?:kostenlos|freier\s+eintritt|\bfree\b)/i.test(
    request.listCard?.priceText ?? '',
  );
  const listOffers: TicketIoTicketOffer[] | undefined =
    (listPrice?.amount !== undefined && (listPrice.amount > 0 || explicitFree)) ||
    request.listCard?.soldOut
      ? [
          {
            name: explicitFree ? 'Free admission' : 'List admission',
            priceAmount: listPrice?.amount,
            priceCurrency: listPrice?.currency ?? 'EUR',
            soldOut: request.listCard?.soldOut,
            purchaseUrl: request.listCard?.publicTicketUrl ?? request.sourceUrl,
          },
        ]
      : undefined;
  const offers = detail?.ticketOffers?.length
    ? detail.ticketOffers
    : classification.admissionProducts.length
      ? classification.admissionProducts
      : listOffers;
  const lineup = toLineupEvidence(detail?.lineupEntries);

  return {
    sourceId: request.sourceId,
    sourceFamily: request.sourceFamily,
    sourceUrl: request.sourceUrl,
    verifiedAt: request.verifiedAt,
    title: identity?.title,
    startDate: identity?.startDate,
    endDate: identity?.endDate,
    venueName: identity?.venueName,
    locationText: identity?.locationText,
    description: detail?.description,
    lineup,
    lineupState: lineup?.length ? 'explicit_artists' : undefined,
    minimumAge: detail?.minimumAge,
    venueEnvironment: detail?.venueEnvironment,
    publicTicketUrl:
      request.listCard?.publicTicketUrl ??
      classification.identity.publicTicketPageUrl ??
      request.sourceUrl,
    ...ticketFieldsFromOffers(offers),
    excludedProducts: classification.excludedProducts,
    diagnostics: [
      ...classification.diagnostics,
      ...classification.excludedProducts.map(
        (product) => `excluded_add_on:${product.name}`,
      ),
    ],
  };
}

function parseTicketKings(request: DetailEvidenceRequest): ConnectorOutput {
  const detail = parseTicketKingsDetailHtml(request.html);
  const checkout = request.checkoutHtml
    ? parseTicketKingsCheckoutHtml(request.checkoutHtml)
    : undefined;
  const offers: TicketIoTicketOffer[] | undefined = checkout?.releases.map((release) => ({
    name: release.name,
    priceAmount: release.priceAmount,
    priceCurrency: release.priceCurrency,
    soldOut:
      release.soldOut ??
      (release.available === false
        ? true
        : release.available === true
          ? false
          : undefined),
    purchaseUrl: release.purchaseUrl,
  }));
  const lineup = toLineupEvidence(detail.lineupEntries);
  const checkoutEvidenceUrl = extractNativeEventCheckoutUrl(request.html);

  return {
    sourceId: request.sourceId,
    sourceFamily: request.sourceFamily,
    sourceUrl: request.sourceUrl,
    verifiedAt: request.verifiedAt,
    title: request.identity?.title,
    startDate: request.identity?.startDate,
    endDate: request.identity?.endDate,
    venueName: request.identity?.venueName,
    locationText: request.identity?.locationText,
    description: detail.description,
    genres: detail.genreNames,
    lineup,
    lineupState: lineup?.length ? 'explicit_artists' : undefined,
    minimumAge: detail.minimumAge,
    venueEnvironment: detail.venueEnvironment,
    publicTicketUrl: request.sourceUrl,
    checkoutEvidenceUrl,
    ...ticketFieldsFromOffers(offers),
    excludedProducts: checkout?.excludedProducts.map((product) => ({
      name: product.rawProductName,
      reason: product.exclusionReason ?? 'supplementary_add_on_product',
      priceAmount: product.priceAmount,
      priceCurrency: product.priceCurrency,
    })),
    diagnostics: [
      ...detail.fieldCoverage.map((field) => `detail:${field}`),
      ...(checkout?.excludedProducts.map(
        (product) => `excluded_add_on:${product.rawProductName}`,
      ) ?? []),
    ],
  };
}

export function parseDetailEvidenceFromHtml(
  request: DetailEvidenceRequest,
): ConnectorOutput {
  if (request.sourceFamily === 'official_website') {
    return parseOfficialWebsite(request);
  }
  if (request.sourceFamily === 'ticket_io') {
    return parseTicketIo(request);
  }
  return parseTicketKings(request);
}
