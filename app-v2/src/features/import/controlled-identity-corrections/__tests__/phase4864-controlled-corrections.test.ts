import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import {
  planGateA,
  planGateB,
  planGateC,
} from '@/features/import/controlled-identity-corrections/gates';
import {
  PHASE4864_R3HAB_TICKET_URL,
  PHASE4864_UNDERLAND_TICKET_URL,
} from '@/features/import/controlled-identity-corrections/constants';
import { diagnoseVenueConsistency } from '@/features/import/controlled-identity-corrections/venue-consistency';

function stubEvent(overrides: Partial<AdminEventRecord>): AdminEventRecord {
  return {
    id: 'evt-test',
    title: 'Test',
    startDate: '2026-09-05',
    status: 'published',
    slug: 'test',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  } as AdminEventRecord;
}

describe('phase4864 controlled corrections', () => {
  it('flags Essigfabrik name with Bootshaus address', () => {
    const diag = diagnoseVenueConsistency({
      venueName: 'Essigfabrik',
      venueAddress: 'Auenweg 173, 51063 Köln',
    });
    expect(diag.consistent).toBe(false);
    expect(diag.issue).toBe('venue_name_address_mismatch');
  });

  it('plans Gate A Underland ticket cleanup', () => {
    const event = stubEvent({
      id: 'evt-underland',
      ticketUrl: PHASE4864_R3HAB_TICKET_URL,
      priceText: 'ab 23,90 €',
    });
    const { mutations, deactivateRefs } = planGateA(event, [
      {
        sourceId: 'source-bootshaus-ticket-io',
        externalEventId: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        active: true,
      },
    ]);
    expect(mutations.some((m) => m.field === 'ticketUrl' && m.newValue === PHASE4864_UNDERLAND_TICKET_URL)).toBe(
      true,
    );
    expect(mutations.some((m) => m.field === 'priceText' && m.newValue === '')).toBe(true);
    expect(deactivateRefs.length).toBe(1);
  });

  it('is idempotent for Gate A pass 2', () => {
    const event = stubEvent({
      ticketUrl: PHASE4864_UNDERLAND_TICKET_URL,
      priceText: '',
    });
    const { mutations } = planGateA(event, [
      {
        sourceId: 'source-bootshaus-ticket-io',
        externalEventId: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        active: false,
      },
    ]);
    expect(mutations.length).toBe(0);
  });

  it('plans Gate B Sommerfest venue correction', () => {
    const event = stubEvent({ venueName: 'Essigfabrik', venueAddress: 'Auenweg 173' });
    const { mutations } = planGateB(event, [
      {
        sourceId: 'source-ticket-kings',
        externalEventId: 'underland-essigfabrik-05-09-2026',
        active: true,
      },
    ]);
    expect(mutations.some((m) => m.field === 'venueName' && m.newValue === 'Bootshaus')).toBe(true);
  });

  it('plans Gate C R3HAB enrichment when price missing', () => {
    const event = stubEvent({
      ticketUrl: PHASE4864_R3HAB_TICKET_URL,
      priceText: '',
    });
    const mutations = planGateC(event, []);
    expect(mutations.some((m) => m.field === 'priceText')).toBe(true);
    expect(mutations.some((m) => m.field === 'sourceReference')).toBe(true);
  });

  it('Gate C pass 2 has zero mutations when enriched', () => {
    const event = stubEvent({
      ticketUrl: PHASE4864_R3HAB_TICKET_URL,
      priceText: 'ab 23,90 €',
    });
    const mutations = planGateC(event, [
      {
        sourceId: 'source-bootshaus-ticket-io',
        externalEventId: PHASE4864_R3HAB_TICKET_URL,
        active: true,
      },
    ]);
    expect(mutations.length).toBe(0);
  });
});
