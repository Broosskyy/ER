import { parseTicketKingsDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-detail-parser';
import {
  enrichTicketKingsDetailFromPublicCheckout,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';
import {
  createFieldEvidenceCandidate,
  createPilotImportRunId,
  type FieldEvidenceCandidate,
  type UnifiedImportResult,
} from '@/features/import/contracts';
import { GOLD_STANDARD_REFERENCE_EVENTS, PILOT_IMPORTER_VERSION, pilotFetchHtml } from './gold-standard-reference';

const IMPORTER_KEY = 'ticket-kings';
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
): void {
  if (normalized === undefined || normalized === null || normalized === '') {
    return;
  }
  candidates.push(
    createFieldEvidenceCandidate({
      fieldName,
      rawValue: raw,
      normalizedValue: normalized,
      sourceId: 'pilot-ticket-kings',
      sourceRole: 'ticket_platform',
      originUrl: ref.ticketUrl,
      evidenceType: type,
      extractionStrategy: strategy,
      observedAt: new Date().toISOString(),
      importerVersion: IMPORTER_VERSION,
      confidence,
      reliability: confidence,
      eventIdentityMatch: ref.eventId,
      reviewState: 'not_reviewed',
      inclusionReason,
    }),
  );
}

export async function runTicketKingsPilotForTicketUrl(input: {
  eventId: string;
  ticketUrl: string;
  label: string;
}): Promise<UnifiedImportResult | { error: string }> {
  const ref = { eventId: input.eventId, ticketUrl: input.ticketUrl, label: input.label };

  const pageFetch = await pilotFetchHtml(ref.ticketUrl);
  const detail = pageFetch.html ? parseTicketKingsDetailHtml(pageFetch.html) : undefined;

  let jsonLdTitle: string | undefined;
  let jsonLdVenue: string | undefined;
  let jsonLdDate: string | undefined;
  if (pageFetch.html) {
    for (const block of extractJsonLdBlocks(pageFetch.html)) {
      for (const node of collectJsonLdNodes(block)) {
        const parsed = parseJsonLdEvent(node);
        const fields = parsed.fields;
        if (fields.title) jsonLdTitle = decodeHtmlEntities(String(fields.title));
        if (fields.venueName) jsonLdVenue = decodeHtmlEntities(String(fields.venueName));
        if (fields.startDate) jsonLdDate = String(fields.startDate);
        break;
      }
    }
  }

  const checkout = pageFetch.html
    ? await enrichTicketKingsDetailFromPublicCheckout(pageFetch.html, async (url) => {
        const r = await pilotFetchHtml(url);
        return r.html;
      })
    : undefined;

  const fieldEvidenceCandidates: FieldEvidenceCandidate[] = [];

  pushEvidence(
    fieldEvidenceCandidates,
    'ticket_destination',
    ref.ticketUrl,
    pageFetch.finalUrl || ref.ticketUrl,
    ref,
    'ticket_kings_event_page',
    'ticket_platform_event_page',
    0.95,
    'Primary public Ticket Kings event page URL — preferred consumer CTA',
  );

  if (jsonLdTitle) {
    pushEvidence(fieldEvidenceCandidates, 'title', jsonLdTitle, jsonLdTitle, ref, 'tk_json_ld_title', 'json_ld', 0.88, 'TK JSON-LD event title');
  }
  if (jsonLdVenue) {
    pushEvidence(fieldEvidenceCandidates, 'venue', jsonLdVenue, jsonLdVenue, ref, 'tk_json_ld_venue', 'json_ld', 0.85, 'TK JSON-LD venue name');
  }
  if (jsonLdDate) {
    pushEvidence(fieldEvidenceCandidates, 'date_time', jsonLdDate, jsonLdDate, ref, 'tk_json_ld_date', 'json_ld', 0.88, 'TK JSON-LD startDate');
  }

  if (detail?.description) {
    pushEvidence(fieldEvidenceCandidates, 'description', detail.description, detail.description, ref, 'tk_detail', 'html_text', 0.8, 'TK detail description');
  }
  if (detail?.genreNames?.length) {
    pushEvidence(fieldEvidenceCandidates, 'genre', detail.genreNames, detail.genreNames, ref, 'tk_labeled_genres', 'html_text', 0.75, 'TK labeled genres');
  }
  if (detail?.artistNames?.length) {
    pushEvidence(fieldEvidenceCandidates, 'artists', detail.artistNames, detail.artistNames, ref, 'tk_detail_artists', 'html_text', 0.8, 'TK detail artists — sidebar stripped');
  }
  if (checkout?.priceText) {
    pushEvidence(
      fieldEvidenceCandidates,
      'price',
      checkout.priceText,
      checkout.priceText,
      ref,
      'nacht_manager_supplement',
      'checkout',
      0.85,
      'Checkout supplement — not default CTA',
    );
  }
  if (checkout?.products?.length) {
    pushEvidence(
      fieldEvidenceCandidates,
      'ticket_phases',
      checkout.products,
      checkout.products.map((p) => p.rawProductName ?? p.rawPhaseName),
      ref,
      'nacht_manager_products',
      'checkout',
      0.85,
      'Admission products from checkout embed',
    );
  }

  const domainsPresent = fieldEvidenceCandidates.map((c) => c.fieldName);

  return {
    contractVersion: 'phase481-v1',
    stagingOnly: true,
    sourceIdentity: {
      sourceId: 'pilot-ticket-kings',
      sourceName: 'Ticket Kings Pilot',
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
        httpStatus: pageFetch.status,
        finalUrl: pageFetch.finalUrl,
        error: pageFetch.error,
      },
      ...(checkout?.checkoutUrl
        ? [{
            url: checkout.checkoutUrl,
            fetchedAt: new Date().toISOString(),
            httpStatus: 200,
          }]
        : []),
    ],
    eventIdentityCandidates: [
      {
        candidateKey: `${ref.eventId}-ticket-kings`,
        externalIds: [ref.ticketUrl],
        eventUrls: [pageFetch.finalUrl || ref.ticketUrl],
        checkoutId: checkout?.checkoutUrl?.match(/id=(\d+)/)?.[1],
        signals: ['ticket_kings_slug', 'event_specific_url'],
        confidence: 0.9,
      },
    ],
    fieldEvidenceCandidates,
    relationshipCandidates: [
      {
        relationshipType: 'ticket_platform',
        entityLabel: 'Ticket Kings',
        sourceId: 'pilot-ticket-kings',
        evidenceUrl: ref.ticketUrl,
        confidence: 0.9,
      },
      ...(checkout?.checkoutUrl
        ? [{
            relationshipType: 'checkout_provider' as const,
            entityLabel: 'Nacht-Manager',
            sourceId: 'pilot-nacht-manager',
            evidenceUrl: checkout.checkoutUrl,
            confidence: 0.85,
          }]
        : []),
    ],
    reviewFindings: [],
    extractionDiagnostics: [],
    completeness: {
      domainsPresent,
      domainsMissing: ['date_time', 'venue'].filter((d) => !domainsPresent.includes(d)),
      completenessScore: domainsPresent.length / 6,
      blockedSurfaces: [],
    },
    confidence: 0.85,
    importerVersion: IMPORTER_VERSION,
  };
}

export async function runTicketKingsPilotForEvent(eventKey: string): Promise<UnifiedImportResult | { error: string }> {
  const ref = GOLD_STANDARD_REFERENCE_EVENTS.find((e) => e.key === eventKey);
  if (!ref || ref.platform !== 'ticket_kings') {
    return { error: `Event ${eventKey} is not a Ticket Kings gold-standard reference` };
  }
  return runTicketKingsPilotForTicketUrl({ eventId: ref.eventId, ticketUrl: ref.ticketUrl, label: ref.label });
}

export async function runTicketKingsPilotAll(): Promise<UnifiedImportResult[]> {
  const results: UnifiedImportResult[] = [];
  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS.filter((e) => e.platform === 'ticket_kings')) {
    const result = await runTicketKingsPilotForEvent(ref.key);
    if (!('error' in result)) {
      results.push(result);
    }
  }
  return results;
}
