import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { EventCanonicalIdentityService } from '@/features/events/services/event-canonical-identity-service';
import {
  PHASE4862_R3HAB_EVENT_ID,
  buildTicketIoEnrichmentCandidate,
  buildTicketIoEnrichmentPreviewMutation,
  classifyTicketIoLinkageGap,
  findSlugCollisions,
  isEventSpecificTicketIoUrl,
  resolveEnrichmentTargetByTicketIoUrl,
  simulateEnrichmentTicketWrite,
} from '@/features/import/ticket-io-enrichment-linkage';

const R3HAB_URL = 'https://bootshaus-club.ticket.io/C7JPnatZ/';
const R3HAB_LIST_SNIPPET = `
<div class="row" data-search="r3hab">
  <a href="/C7JPnatZ/" class="a-eventlink">R3HAB pres. by BOOTSHAUS</a>
  <ul class="tio-overview">
    <li class="tio-overview-tickets-from"><span>Tickets ab 23,90 Euro</span></li>
  </ul>
</div>
<script type="application/ld+json">
{"@type":"Event","name":"R3HAB pres. by BOOTSHAUS","startDate":"2026-09-04T22:00:00+02:00","offers":{"@type":"Offer","price":23.9,"priceCurrency":"EUR","availability":"InStock","url":"https://bootshaus-club.ticket.io/C7JPnatZ/"}}
</script>
${'<div class="tio-padding" aria-hidden="true">'.repeat(40)}
`;

function r3habEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: PHASE4862_R3HAB_EVENT_ID,
    title: 'R3HAB pres. by BOOTSHAUS',
    status: 'published',
    sourceId: 'source-bootshaus-koeln',
    ticketUrl: R3HAB_URL,
    websiteUrl: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
    description: 'September lineup content',
    priceText: '',
    ...overrides,
  } as AdminEventRecord;
}

describe('phase4862 ticket.io URL eligibility', () => {
  it('accepts event-specific ticket.io URLs', () => {
    expect(isEventSpecificTicketIoUrl(R3HAB_URL)).toBe(true);
    expect(isEventSpecificTicketIoUrl('https://bootshaus-club.ticket.io/')).toBe(false);
  });

  it('resolves enrichment target by normalized ticket.io URL', () => {
    const target = resolveEnrichmentTargetByTicketIoUrl(R3HAB_URL, [
      {
        id: PHASE4862_R3HAB_EVENT_ID,
        title: 'R3HAB',
        startDate: '2026-09-04T20:00:00+00:00',
        ticketUrl: R3HAB_URL,
      },
    ]);
    expect(target?.id).toBe(PHASE4862_R3HAB_EVENT_ID);
  });

  it('rejects slug collisions across unrelated events', () => {
    const collisions = findSlugCollisions([
      { id: 'evt-a', ticketUrl: R3HAB_URL },
      { id: 'evt-b', ticketUrl: R3HAB_URL },
    ]);
    expect(collisions.get('C7JPnatZ')).toEqual(['evt-a', 'evt-b']);
  });
});

describe('phase4862 linkage classification', () => {
  it('classifies R3HAB as missing ticket.io source reference with valid public evidence', () => {
    const discovery = discoverTicketIoPriceEvidence({
      shopSlug: 'bootshaus-club',
      listUrl: 'https://bootshaus-club.ticket.io/',
      listHtml: R3HAB_LIST_SNIPPET,
      eventUrl: R3HAB_URL,
    });
    const result = classifyTicketIoLinkageGap({
      hasTicketIoSourceReference: false,
      ticketIoImportCount: 0,
      linkedImportCount: 0,
      canonicalPriceText: '',
      connectorPriceText: 'ab 23,90 €',
      discovery,
      slugCollision: false,
      listRowMatch: true,
    });
    expect(['NO_TICKETIO_SOURCE_REFERENCE', 'VALID_EVIDENCE_NOT_PERSISTED']).toContain(
      result.rootCause,
    );
    expect(result.controlledEnrichmentSufficient).toBe(true);
  });
});

describe('phase4862 enrichment preview', () => {
  it('proposes R3HAB price without touching website-owned fields', () => {
    const event = r3habEvent();
    const discovery = discoverTicketIoPriceEvidence({
      shopSlug: 'bootshaus-club',
      listUrl: 'https://bootshaus-club.ticket.io/',
      listHtml: R3HAB_LIST_SNIPPET,
      eventUrl: R3HAB_URL,
    });
    const candidate = buildTicketIoEnrichmentCandidate({
      event,
      listHtml: R3HAB_LIST_SNIPPET,
      discovery,
    });
    expect(candidate?.priceText).toBeTruthy();

    const simulation = simulateEnrichmentTicketWrite({
      event,
      candidate: candidate!,
    });
    expect(simulation.patch.priceText).toBeTruthy();
    expect(simulation.projection.displayPriceText).toBeTruthy();
    expect(simulation.changedFields).toContain('priceText');

    const preview = buildTicketIoEnrichmentPreviewMutation({
      event,
      discovery,
      candidate: candidate!,
      sourceReferenceState: 'no_ticketio_reference',
      importRecordState: 'no_import_record',
      slugCollision: false,
    });
    expect(preview?.batch).toBe('A');
    expect(preview?.proposedValue).toBeTruthy();
    expect(preview?.frozenDomainFingerprint.title).toBe(event.title);
    expect(preview?.frozenDomainFingerprint.sourceId).toBe('source-bootshaus-koeln');
  });

  it('does not clear populated price with empty evidence', () => {
    const event = r3habEvent({ priceText: 'ab 23,90 €' });
    const discovery = discoverTicketIoPriceEvidence({
      shopSlug: 'bootshaus-club',
      listUrl: 'https://bootshaus-club.ticket.io/',
      listHtml: '<html></html>',
      eventUrl: R3HAB_URL,
    });
    const candidate = buildTicketIoEnrichmentCandidate({
      event,
      listHtml: '<html></html>',
      discovery,
    });
    expect(candidate).toBeUndefined();
  });
});

describe('phase4862 identity service ticket.io URL resolve', () => {
  it('resolves canonical id from published events catalog', () => {
    const service = new EventCanonicalIdentityService(
      {
        findByFingerprint: async () => undefined,
        registerFingerprint: async () => {},
      },
      {
        findByExternalEventId: async () => undefined,
      } as never,
    );
    const id = service.resolveByTicketIoEventUrl(R3HAB_URL, [
      {
        id: PHASE4862_R3HAB_EVENT_ID,
        title: 'R3HAB',
        startDate: '2026-09-04T20:00:00+00:00',
        ticketUrl: R3HAB_URL,
      },
    ]);
    expect(id).toBe(PHASE4862_R3HAB_EVENT_ID);
  });
});
