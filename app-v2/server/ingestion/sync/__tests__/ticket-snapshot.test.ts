import { describe, expect, it } from 'vitest';

import {
  canonicalTicketUrlForSnapshotCompare,
  compareTicketSnapshotsDetailed,
  filterTicketRowsByEventIds,
  type TicketSnapshotRow,
} from '../ticket-snapshot';

function row(overrides: Partial<TicketSnapshotRow> & Pick<TicketSnapshotRow, 'id' | 'event_id'>): TicketSnapshotRow {
  return {
    provider: 'ticket_io',
    ticket_url: null,
    price_from_minor: null,
    currency: null,
    sales_status: 'available',
    sort_order: 0,
    ...overrides,
  };
}

describe('ticket-snapshot', () => {
  it('detects semantic URL equality for n8manager embed vs direct', () => {
    const before = row({
      id: '1',
      event_id: 'event-1',
      ticket_url: 'https://rheinaudio.n8manager.de/ticketing/native_event.php?id=21&embed=1',
    });
    const after = row({
      id: '1',
      event_id: 'event-1',
      ticket_url: 'https://rheinaudio.n8manager.de/ticketing/native_event.php?id=21',
    });
    const detailed = compareTicketSnapshotsDetailed([before], [after]);
    expect(detailed.ticketUrlsChanged).toBe(0);
    expect(detailed.semanticUrlDeltas).toBe(0);
    expect(detailed.updated).toBe(0);
  });

  it('scopes connector ticket rows by event id', () => {
    const rows = [
      row({ id: '1', event_id: 'a' }),
      row({ id: '2', event_id: 'b' }),
    ];
    expect(filterTicketRowsByEventIds(rows, new Set(['a']))).toHaveLength(1);
  });

  it('counts only inserted rows when ticket table length changes', () => {
    const before = [
      row({ id: '1', event_id: 'event-1', ticket_url: 'https://shop.ticket.io/a', price_from_minor: 2000, currency: 'EUR' }),
      row({ id: '2', event_id: 'event-2', ticket_url: 'https://shop.ticket.io/b', price_from_minor: 2500, currency: 'EUR' }),
    ];
    const after = [
      ...before,
      row({
        id: '3',
        event_id: 'event-zaagstep',
        ticket_url: 'https://73b85ec6.sibforms.com/serve/test',
        sales_status: 'sold_out',
        currency: null,
      }),
    ];
    const detailed = compareTicketSnapshotsDetailed(before, after);
    expect(detailed.inserted).toBe(1);
    expect(detailed.updated).toBe(0);
    expect(detailed.deleted).toBe(0);
    expect(detailed.ticketPricesChanged).toBe(0);
    expect(detailed.ticketUrlsChanged).toBe(1);
    expect(detailed.ticketStatusesChanged).toBe(1);
    expect(detailed.fieldDeltas).toHaveLength(1);
    expect(detailed.fieldDeltas[0]?.eventId).toBe('event-zaagstep');
    expect(detailed.fieldDeltas[0]?.kind).toBe('inserted');
  });

  it('treats null and missing price as equivalent', () => {
    const before = row({ id: '1', event_id: 'event-1', price_from_minor: null, currency: null });
    const after = row({ id: '1', event_id: 'event-1', price_from_minor: null, currency: 'EUR' });
    const detailed = compareTicketSnapshotsDetailed([before], [after]);
    expect(detailed.ticketPricesChanged).toBe(0);
  });

  it('detects real null to priced admission change', () => {
    const before = row({ id: '1', event_id: 'event-1', price_from_minor: null, currency: null });
    const after = row({ id: '1', event_id: 'event-1', price_from_minor: 2500, currency: 'EUR' });
    const detailed = compareTicketSnapshotsDetailed([before], [after]);
    expect(detailed.ticketPricesChanged).toBe(1);
    expect(detailed.updated).toBe(1);
  });

  it('matches by event slot when ticket row id changes', () => {
    const before = row({
      id: 'old-id',
      event_id: 'event-1',
      ticket_url: 'https://shop.ticket.io/a',
      price_from_minor: 2000,
      currency: 'EUR',
    });
    const after = row({
      id: 'new-id',
      event_id: 'event-1',
      ticket_url: 'https://shop.ticket.io/a',
      price_from_minor: 2000,
      currency: 'EUR',
    });
    const detailed = compareTicketSnapshotsDetailed([before], [after]);
    expect(detailed.inserted).toBe(0);
    expect(detailed.deleted).toBe(0);
    expect(detailed.updated).toBe(0);
  });

  it('canonicalizes ticket.io URLs for comparison', () => {
    const canonical = canonicalTicketUrlForSnapshotCompare(
      'https://shop.ticket.io/abc/?utm_source=test',
    );
    expect(canonical).toBeTruthy();
  });
});
