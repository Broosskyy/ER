import { parseTicketKingsDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-detail-parser';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { classifyTicketIoDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-classification';

import type { DetailEvidenceRequest, DetailEvidenceResult } from './detail-evidence-types';

function isTicketKingsUrl(url: string): boolean {
  return /ticketkings\.de/i.test(url) || /nacht-manager/i.test(url);
}

function isTicketIoUrl(url: string): boolean {
  return /ticket\.io/i.test(url);
}

function isNachtmanagerCheckout(url: string): boolean {
  return /nacht-manager/i.test(url) || /embed=1/i.test(url);
}

export function parseDetailEvidenceFromHtml(
  request: DetailEvidenceRequest,
  html: string,
  observedAt: string = new Date().toISOString(),
): DetailEvidenceResult {
  const diagnostics: string[] = ['embedded_html_reused'];
  const url = request.eventUrl;

  if (isTicketIoUrl(url)) {
    const classification = classifyTicketIoDetailHtml(html);
    const fetchStatus =
      classification.detailFetchStatus === 'ok'
        ? 'ok'
        : classification.detailFetchStatus === 'pow_challenge'
          ? 'pow_challenge'
          : 'content_unusable';

    if (classification.challengeMarkers.securityCheckTitle) {
      diagnostics.push('ticket_io_pow_marker');
    }

    const identity =
      classification.hasUsableIdentity && classification.identity.pageTitle
        ? {
            pageTitle: classification.identity.pageTitle,
            eventDate: classification.identity.eventDate,
            venueName: classification.identity.venueName,
          }
        : undefined;

    return {
      sourceId: request.sourceId,
      eventUrl: url,
      observedAt,
      verifiedAt: fetchStatus === 'ok' ? observedAt : undefined,
      fetchStatus,
      identity,
      content: undefined,
      ticketEvidence: {
        admissionProducts: classification.admissionProducts,
        excludedProducts: classification.excludedProducts,
        listCardFallbackAllowed: fetchStatus === 'pow_challenge',
      },
      diagnostics: [...diagnostics, ...classification.diagnostics],
    };
  }

  if (isTicketKingsUrl(url)) {
    if (isNachtmanagerCheckout(url)) {
      const checkout = parseTicketKingsCheckoutHtml(html);
      diagnostics.push('nachtmanager_checkout_only');
      return {
        sourceId: request.sourceId,
        eventUrl: url,
        observedAt,
        verifiedAt: checkout.priceText ? observedAt : undefined,
        fetchStatus: checkout.priceText ? 'ok' : 'content_unusable',
        ticketEvidence: {
          checkoutOnly: true,
          priceText: checkout.priceText,
          excludedProducts: checkout.excludedProducts,
        },
        diagnostics,
      };
    }

    const detail = parseTicketKingsDetailHtml(html);
    const checkoutUrl = extractNativeEventCheckoutUrl(html);
    let checkoutEvidence: Record<string, unknown> | undefined;
    if (checkoutUrl) {
      diagnostics.push('ticket_kings_public_page');
    }

    const lineup =
      detail.lineupEntries?.map((entry) => entry.displayName).filter(Boolean) ?? undefined;

    return {
      sourceId: request.sourceId,
      eventUrl: url,
      observedAt,
      verifiedAt: observedAt,
      fetchStatus: detail.description || detail.genreNames?.length || lineup?.length ? 'ok' : 'content_unusable',
      identity: {
        pageTitle: request.expectedIdentity?.title,
        eventDate: request.expectedIdentity?.eventDate,
        venueName: request.expectedIdentity?.venueName,
      },
      content: {
        description: detail.description,
        genreLabels: detail.genreNames,
        lineup,
        minimumAge: detail.minimumAge
          ? Number.parseInt(String(detail.minimumAge), 10)
          : undefined,
        imageUrl: undefined,
      },
      ticketEvidence: {
        publicCtaUrl: url,
        checkoutUrl,
        ...checkoutEvidence,
      },
      diagnostics,
    };
  }

  diagnostics.push('official_website_html');
  const descriptionMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const ogDescription =
    html.match(/property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    descriptionMatch?.[1];

  return {
    sourceId: request.sourceId,
    eventUrl: url,
    observedAt,
    verifiedAt: ogDescription ? observedAt : undefined,
    fetchStatus: ogDescription || html.length > 200 ? 'ok' : 'content_unusable',
    content: ogDescription ? { description: ogDescription } : undefined,
    diagnostics,
  };
}
