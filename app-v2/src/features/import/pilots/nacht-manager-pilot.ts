import { parseTicketKingsCheckoutHtml, extractNativeEventCheckoutUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import {
  createFieldEvidenceCandidate,
  createPilotImportRunId,
  type FieldEvidenceCandidate,
  type UnifiedImportResult,
} from '@/features/import/contracts';
import { GOLD_STANDARD_REFERENCE_EVENTS, PILOT_IMPORTER_VERSION, pilotFetchHtml } from './gold-standard-reference';

const IMPORTER_KEY = 'nacht-manager';
const IMPORTER_VERSION = `${PILOT_IMPORTER_VERSION}-${IMPORTER_KEY}`;

/**
 * Supplementary checkout evidence only — never the default consumer CTA when TK event page exists.
 */
export async function runNachtManagerPilotForTicketUrl(input: {
  eventId: string;
  ticketUrl: string;
  label: string;
}): Promise<UnifiedImportResult | { error: string }> {
  const ref = { eventId: input.eventId, ticketUrl: input.ticketUrl, label: input.label };

  const tkPage = await pilotFetchHtml(ref.ticketUrl);
  const checkoutUrl = tkPage.html ? extractNativeEventCheckoutUrl(tkPage.html) : undefined;
  if (!checkoutUrl) {
    return {
      contractVersion: 'phase481-v1',
      stagingOnly: true,
      sourceIdentity: {
        sourceId: 'pilot-nacht-manager',
        sourceName: 'Nacht-Manager Supplementary Pilot',
        connectorKey: 'checkout_provider',
        importerKey: IMPORTER_KEY,
        sourceRoles: ['checkout_provider'],
      },
      importRunIdentity: {
        runId: createPilotImportRunId(IMPORTER_KEY),
        channel: 'automatic_source_import',
        startedAt: new Date().toISOString(),
        pilotOnly: true,
      },
      rawEvidenceReferences: [],
      eventIdentityCandidates: [],
      fieldEvidenceCandidates: [],
      relationshipCandidates: [],
      reviewFindings: [{ code: 'NO_CHECKOUT_EMBED', message: 'No Nacht-Manager embed on TK page', severity: 'info' }],
      extractionDiagnostics: [],
      completeness: { domainsPresent: [], domainsMissing: ['price', 'ticket_phases'], completenessScore: 0, blockedSurfaces: [] },
      confidence: 0,
      importerVersion: IMPORTER_VERSION,
    };
  }

  const checkoutFetch = await pilotFetchHtml(checkoutUrl);
  const checkout = checkoutFetch.html ? parseTicketKingsCheckoutHtml(checkoutFetch.html) : undefined;
  const fieldEvidenceCandidates: FieldEvidenceCandidate[] = [];

  if (checkout?.priceText) {
    fieldEvidenceCandidates.push(
      createFieldEvidenceCandidate({
        fieldName: 'price',
        rawValue: checkout.priceText,
        normalizedValue: checkout.priceText,
        sourceId: 'pilot-nacht-manager',
        sourceRole: 'checkout_provider',
        originUrl: checkoutUrl,
        evidenceType: 'checkout',
        extractionStrategy: 'native_event_iframe',
        observedAt: new Date().toISOString(),
        importerVersion: IMPORTER_VERSION,
        confidence: 0.9,
        reliability: 0.9,
        eventIdentityMatch: ref.eventId,
        reviewState: 'not_reviewed',
        inclusionReason: 'Admission price from Nacht-Manager — supplements TK page, not default CTA',
      }),
    );
  }

  if (checkout?.products?.length) {
    const admissionOnly = checkout.products.filter((p) => !/flex|addon|add-on|parking/i.test(p.rawProductName ?? ''));
    const anyAvailable = admissionOnly.some((p) => p.available || !p.soldOut);
    const allSoldOut = admissionOnly.length > 0 && admissionOnly.every((p) => p.soldOut);
    const availability = allSoldOut ? 'sold_out' : anyAvailable ? 'available' : 'unknown';

    fieldEvidenceCandidates.push(
      createFieldEvidenceCandidate({
        fieldName: 'availability',
        rawValue: availability,
        normalizedValue: availability,
        sourceId: 'pilot-nacht-manager',
        sourceRole: 'checkout_provider',
        originUrl: checkoutUrl,
        evidenceType: 'checkout',
        extractionStrategy: 'admission_availability',
        observedAt: new Date().toISOString(),
        importerVersion: IMPORTER_VERSION,
        confidence: 0.85,
        reliability: 0.85,
        eventIdentityMatch: ref.eventId,
        reviewState: 'not_reviewed',
        inclusionReason: 'Availability inferred from admission products in checkout',
      }),
    );

    fieldEvidenceCandidates.push(
      createFieldEvidenceCandidate({
        fieldName: 'ticket_phases',
        rawValue: admissionOnly,
        normalizedValue: admissionOnly.map((p) => ({ name: p.rawProductName, price: p.rawPriceText, soldOut: p.soldOut })),
        sourceId: 'pilot-nacht-manager',
        sourceRole: 'checkout_provider',
        originUrl: checkoutUrl,
        evidenceType: 'checkout',
        extractionStrategy: 'admission_products_only',
        observedAt: new Date().toISOString(),
        importerVersion: IMPORTER_VERSION,
        confidence: 0.88,
        reliability: 0.88,
        eventIdentityMatch: ref.eventId,
        reviewState: 'not_reviewed',
        inclusionReason: 'Admission phases only — Flex/add-ons excluded',
      }),
    );
  }

  fieldEvidenceCandidates.push(
    createFieldEvidenceCandidate({
      fieldName: 'checkout_url',
      rawValue: checkoutUrl,
      normalizedValue: checkoutUrl,
      sourceId: 'pilot-nacht-manager',
      sourceRole: 'checkout_provider',
      originUrl: checkoutUrl,
      evidenceType: 'checkout',
      extractionStrategy: 'native_event_iframe',
      observedAt: new Date().toISOString(),
      importerVersion: IMPORTER_VERSION,
      confidence: 0.9,
      reliability: 0.9,
      eventIdentityMatch: ref.eventId,
      reviewState: 'not_reviewed',
      inclusionReason: 'Nacht-Manager checkout URL — supplementary, not consumer CTA',
    }),
  );

  return {
    contractVersion: 'phase481-v1',
    stagingOnly: true,
    sourceIdentity: {
      sourceId: 'pilot-nacht-manager',
      sourceName: 'Nacht-Manager Supplementary Pilot',
      connectorKey: 'checkout_provider',
      importerKey: IMPORTER_KEY,
      sourceRoles: ['checkout_provider'],
    },
    importRunIdentity: {
      runId: createPilotImportRunId(`${IMPORTER_KEY}-${ref.eventId}`),
      channel: 'automatic_source_import',
      startedAt: new Date().toISOString(),
      pilotOnly: true,
    },
    rawEvidenceReferences: [
      { url: checkoutUrl, fetchedAt: new Date().toISOString(), httpStatus: checkoutFetch.status, finalUrl: checkoutFetch.finalUrl },
    ],
    eventIdentityCandidates: [
      {
        candidateKey: `${ref.eventId}-nacht-manager`,
        externalIds: [checkoutUrl],
        eventUrls: [checkoutUrl],
        checkoutId: checkoutUrl.match(/id=(\d+)/)?.[1],
        signals: ['checkout_id'],
        confidence: 0.85,
      },
    ],
    fieldEvidenceCandidates,
    relationshipCandidates: [
      {
        relationshipType: 'checkout_provider',
        entityLabel: 'Nacht-Manager',
        sourceId: 'pilot-nacht-manager',
        evidenceUrl: checkoutUrl,
        confidence: 0.9,
      },
    ],
    reviewFindings: [
      {
        code: 'SUPPLEMENTARY_ONLY',
        message: 'Checkout evidence supplements Ticket Kings public page — never default CTA',
        severity: 'info',
      },
    ],
    extractionDiagnostics: [],
    completeness: {
      domainsPresent: fieldEvidenceCandidates.map((c) => c.fieldName),
      domainsMissing: [],
      completenessScore: fieldEvidenceCandidates.length > 0 ? 0.8 : 0,
      blockedSurfaces: [],
    },
    confidence: fieldEvidenceCandidates.length > 0 ? 0.88 : 0,
    importerVersion: IMPORTER_VERSION,
  };
}

export async function runNachtManagerPilotForEvent(eventKey: string): Promise<UnifiedImportResult | { error: string }> {
  const ref = GOLD_STANDARD_REFERENCE_EVENTS.find((e) => e.key === eventKey);
  if (!ref || ref.platform !== 'ticket_kings') {
    return { error: `Nacht-Manager pilot requires Ticket Kings reference event` };
  }
  return runNachtManagerPilotForTicketUrl({ eventId: ref.eventId, ticketUrl: ref.ticketUrl, label: ref.label });
}

export async function runNachtManagerPilotAll(): Promise<UnifiedImportResult[]> {
  const results: UnifiedImportResult[] = [];
  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS.filter((e) => e.platform === 'ticket_kings')) {
    const result = await runNachtManagerPilotForEvent(ref.key);
    if (!('error' in result)) {
      results.push(result);
    }
  }
  return results;
}
