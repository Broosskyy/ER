import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { parseTicketIoDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-parser';
import { auditTicketIoShopAvailabilityEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-shop-availability-evidence';
import { extractTicketIoShopSlug, isTicketIoShopRootUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import {
  createFieldEvidenceCandidate,
  createPilotImportRunId,
  type FieldEvidenceCandidate,
  type UnifiedImportResult,
} from '@/features/import/contracts';
import { buildTicketIoPriceSemantics } from '@/features/import/domain/ticket-io-price-semantics';
import { GOLD_STANDARD_REFERENCE_EVENTS, PILOT_IMPORTER_VERSION, pilotFetchHtml } from './gold-standard-reference';

const IMPORTER_KEY = 'ticket-io';
const IMPORTER_VERSION = `${PILOT_IMPORTER_VERSION}-${IMPORTER_KEY}`;

function pushEvidence(
  candidates: FieldEvidenceCandidate[],
  fieldName: string,
  raw: unknown,
  normalized: unknown,
  ref: { ticketUrl: string; eventId: string },
  strategy: string,
  type: FieldEvidenceCandidate['evidenceType'],
  confidence: number,
  inclusionReason: string,
  rejectionReason?: string,
): void {
  candidates.push(
    createFieldEvidenceCandidate({
      fieldName,
      rawValue: raw,
      normalizedValue: normalized,
      sourceId: 'pilot-ticket-io',
      sourceRole: 'ticket_platform',
      originUrl: ref.ticketUrl,
      evidenceType: type,
      extractionStrategy: strategy,
      observedAt: new Date().toISOString(),
      importerVersion: IMPORTER_VERSION,
      confidence,
      reliability: confidence,
      eventIdentityMatch: ref.eventId,
      reviewState: rejectionReason ? 'rejected' : 'not_reviewed',
      inclusionReason,
      rejectionReason,
    }),
  );
}

export async function runTicketIoPilotForTicketUrl(input: {
  eventId: string;
  ticketUrl: string;
  label: string;
}): Promise<UnifiedImportResult | { error: string }> {
  const ref = { eventId: input.eventId, ticketUrl: input.ticketUrl, label: input.label };

  if (isTicketIoShopRootUrl(ref.ticketUrl)) {
    return { error: 'Shop root URL rejected — event-specific URL required' };
  }

  const detailFetch = await pilotFetchHtml(ref.ticketUrl);
  const shopSlug = extractTicketIoShopSlug(ref.ticketUrl) ?? 'bootshaus-club';
  const listUrl = `https://${shopSlug}.ticket.io/`;
  const listFetch = await pilotFetchHtml(listUrl);

  const detail = detailFetch.html ? parseTicketIoDetailHtml(detailFetch.html, ref.label) : { blockedByPow: true };
  const priceDiscovery = discoverTicketIoPriceEvidence({
    shopSlug,
    listUrl,
    listHtml: listFetch.html,
    eventUrl: ref.ticketUrl,
    detailHtml: detailFetch.html,
  });
  const availabilityAudit = auditTicketIoShopAvailabilityEvidence({
    eventId: ref.eventId,
    title: ref.label,
    ticketUrl: ref.ticketUrl,
    listHtml: listFetch.html,
    discovery: priceDiscovery,
  });

  const fieldEvidenceCandidates: FieldEvidenceCandidate[] = [];
  const diagnostics: UnifiedImportResult['extractionDiagnostics'] = [];
  const blockedSurfaces: string[] = [];

  if (detail.blockedByPow || priceDiscovery.detailAltchaBlocked) {
    blockedSurfaces.push('ticket_io_detail');
    diagnostics.push({
      code: 'ALTCHA_BLOCKED',
      message: 'Detail page blocked by ALTCHA — no bypass attempted',
      surface: 'ticket_io_detail',
      blocked: true,
    });
  }

  pushEvidence(
    fieldEvidenceCandidates,
    'ticket_destination',
    ref.ticketUrl,
    detailFetch.finalUrl || ref.ticketUrl,
    ref,
    'event_specific_url',
    'ticket_platform_event_page',
    0.95,
    'Event-specific Ticket.io slug URL',
  );

  if (priceDiscovery.bestHit?.priceText || priceDiscovery.bestHit?.soldOut) {
    const semantics = buildTicketIoPriceSemantics({
      rawLabel: priceDiscovery.bestHit.priceText,
      soldOut: priceDiscovery.bestHit.soldOut,
      amount: priceDiscovery.bestHit.priceAmount,
    });

    if (semantics.soldOut) {
      pushEvidence(
        fieldEvidenceCandidates,
        'sold_out',
        true,
        true,
        ref,
        'list_or_detail_sold_out',
        'ticket_shop_list_row',
        0.9,
        'Event-specific sold-out from list evidence — status not a zero price',
      );
    }

    if (semantics.displayPriceLabel && semantics.kind !== 'placeholder_zero') {
      pushEvidence(
        fieldEvidenceCandidates,
        'price',
        priceDiscovery.bestHit.rawSnippet ?? semantics.rawLabel,
        semantics.displayPriceLabel,
        ref,
        priceDiscovery.bestHit.surface,
        'ticket_shop_list_row',
        semantics.soldOut ? 0.88 : 0.85,
        semantics.soldOut
          ? 'Sold-out status label — Ausverkauft is not a purchaseable price'
          : 'Current purchaseable list-row price',
      );
    }

    if (semantics.historicalPhasePrice && semantics.soldOut) {
      pushEvidence(
        fieldEvidenceCandidates,
        'historical_phase_price',
        semantics.rawLabel,
        semantics.historicalPhasePrice,
        ref,
        'historical_list_price',
        'legacy_compatibility_evidence',
        0.5,
        'Historical phase price retained in provenance only — not currently purchaseable',
        'Not presented as active admission price when sold out',
      );
    }
  }

  if (availabilityAudit.inferredAvailability) {
    pushEvidence(
      fieldEvidenceCandidates,
      'availability',
      availabilityAudit.inferredAvailability,
      availabilityAudit.inferredAvailability,
      ref,
      'list_availability_audit',
      'ticket_shop_list_row',
      0.8,
      'Event-specific list availability inference',
    );
  }

  if (detail.artistNames?.length) {
    pushEvidence(
      fieldEvidenceCandidates,
      'artists',
      detail.artistNames,
      detail.artistNames,
      ref,
      'ticket_io_detail_artists',
      detail.blockedByPow ? 'legacy_compatibility_evidence' : 'html_text',
      detail.blockedByPow ? 0.4 : 0.75,
      'Detail page artist extraction',
      detail.blockedByPow ? 'Detail blocked — low reliability' : undefined,
    );
  }

  const domainsPresent = fieldEvidenceCandidates.map((c) => c.fieldName);

  return {
    contractVersion: 'phase481-v1',
    stagingOnly: true,
    sourceIdentity: {
      sourceId: 'pilot-ticket-io',
      sourceName: 'Ticket.io Pilot',
      connectorKey: 'ticket_platform',
      importerKey: IMPORTER_KEY,
      sourceRoles: ['ticket_platform'],
    },
    importRunIdentity: {
      runId: createPilotImportRunId(`${IMPORTER_KEY}-${ref.eventId}`),
      channel: 'automatic_source_import',
      startedAt: new Date().toISOString(),
      pilotOnly: true,
    },
    rawEvidenceReferences: [
      {
        url: ref.ticketUrl,
        fetchedAt: new Date().toISOString(),
        httpStatus: detailFetch.status,
        finalUrl: detailFetch.finalUrl,
        error: detailFetch.error,
      },
      {
        url: listUrl,
        fetchedAt: new Date().toISOString(),
        httpStatus: listFetch.status,
        finalUrl: listFetch.finalUrl,
        error: listFetch.error,
      },
    ],
    eventIdentityCandidates: [
      {
        candidateKey: `${ref.eventId}-ticket-io`,
        externalIds: [ref.ticketUrl],
        eventUrls: [detailFetch.finalUrl || ref.ticketUrl],
        signals: ['ticket_io_slug', 'event_specific_url'],
        confidence: 0.9,
      },
    ],
    fieldEvidenceCandidates,
    relationshipCandidates: [
      {
        relationshipType: 'ticket_platform',
        entityLabel: shopSlug,
        sourceId: 'pilot-ticket-io',
        evidenceUrl: ref.ticketUrl,
        confidence: 0.9,
      },
    ],
    reviewFindings: availabilityAudit.reviewRequired
      ? [{ code: 'AVAILABILITY_REVIEW', message: 'Shop-level signal requires review', severity: 'warning' }]
      : [],
    extractionDiagnostics: diagnostics,
    completeness: {
      domainsPresent,
      domainsMissing: ['title', 'venue', 'description'].filter((d) => !domainsPresent.includes(d)),
      completenessScore: Math.min(1, domainsPresent.length / 5),
      blockedSurfaces,
    },
    confidence: detail.blockedByPow ? 0.55 : 0.85,
    importerVersion: IMPORTER_VERSION,
  };
}

export async function runTicketIoPilotForEvent(eventKey: string): Promise<UnifiedImportResult | { error: string }> {
  const ref = GOLD_STANDARD_REFERENCE_EVENTS.find((e) => e.key === eventKey);
  if (!ref || ref.platform !== 'ticket_io') {
    return { error: `Event ${eventKey} is not a Ticket.io gold-standard reference` };
  }
  return runTicketIoPilotForTicketUrl({ eventId: ref.eventId, ticketUrl: ref.ticketUrl, label: ref.label });
}

export async function runTicketIoPilotAll(): Promise<UnifiedImportResult[]> {
  const results: UnifiedImportResult[] = [];
  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS.filter((e) => e.platform === 'ticket_io')) {
    const result = await runTicketIoPilotForEvent(ref.key);
    if (!('error' in result)) {
      results.push(result);
    }
  }
  return results;
}
