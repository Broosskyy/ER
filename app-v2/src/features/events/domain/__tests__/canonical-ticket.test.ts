import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import { normalizeCanonicalTicketAvailability } from '@/features/events/domain/canonical-ticket-availability';
import { normalizeCanonicalTicketPrice } from '@/features/events/domain/canonical-ticket-price-normalization';
import {
  classifyTicketAcceptanceState,
  readCanonicalTicket,
} from '@/features/events/domain/canonical-ticket-read';
import { selectCanonicalTicket } from '@/features/events/domain/canonical-ticket-selection';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { TICKET_CTA_LABELS_DE } from '@/features/events/domain/canonical-ticket-domain';

const EVENT_PAGE = 'https://bootshaus.tv/events/levi/';
const TICKET_IO_EVENT = 'https://bootshaus-club.ticket.io/abc123/';
const TICKET_IO_ROOT = 'https://bootshaus-club.ticket.io/';
const TICKET_KINGS_EVENT = 'https://ticketkings.de/event/sommerfest-2026/';

function adminEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-1',
    title: 'Test Event',
    description: 'Desc',
    startDate: '2026-08-10T20:00:00.000Z',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ticket destination classification', () => {
  it('classifies ticket.io event pages', () => {
    expect(classifyTicketDestination(TICKET_IO_EVENT).destinationClass).toBe('ticket_platform_event');
    expect(classifyTicketDestination(TICKET_IO_ROOT).destinationClass).toBe('ticket_platform_root');
  });

  it('classifies official event pages separately from purchase', () => {
    expect(classifyTicketDestination(EVENT_PAGE).destinationClass).toBe('official_event_page');
  });

  it('rejects bare nacht-manager native_event.php without event id', () => {
    const classified = classifyTicketDestination('https://nacht-manager.de/ticketing/native_event.php');
    expect(classified.destinationClass).toBe('invalid');
    expect(classified.reason).toBe('generic_endpoint');
  });

  it('preserves query parameters on embedded nacht-manager checkout URLs as evidence only', () => {
    const url =
      'https://nacht-manager.de/ticketing/native_event.php?id=41&embed=1&embed_layout=checkout&embed_flow=stepped&return_url=https%3A%2F%2Fticketkings.de%2Forder_success%2F';
    const classified = classifyTicketDestination(url);
    expect(classified.destinationClass).toBe('embedded_checkout_evidence');
    expect(classified.url).toBe(url);
    expect(classified.url).toContain('id=41');
  });
});

describe('destination selection policy', () => {
  it('prefers direct purchase over event page', () => {
    const snapshot = selectCanonicalTicket({
      purchaseCandidates: [
        { url: TICKET_IO_EVENT, field: 'ticketUrl' },
        { url: EVENT_PAGE, field: 'websiteUrl' },
      ],
      officialEventUrl: EVENT_PAGE,
    });
    expect(snapshot.destinationClass).toBe('ticket_platform_event');
    expect(snapshot.officialEventUrl).toContain('/events/levi');
  });

  it('prefers ticket event page over shop root', () => {
    const snapshot = selectCanonicalTicket({
      purchaseCandidates: [
        { url: TICKET_IO_EVENT, field: 'ticketUrl' },
        { url: TICKET_IO_ROOT, field: 'fallback' },
      ],
    });
    expect(snapshot.publicCtaUrl).toBe(TICKET_IO_EVENT);
  });

  it('uses shop root only as explicit fallback', () => {
    const snapshot = selectCanonicalTicket({
      fallbackCandidates: [{ url: TICKET_IO_ROOT, field: 'fallback' }],
    });
    expect(snapshot.destinationClass).toBe('ticket_platform_root');
    expect(snapshot.fallbackTicketUrl).toBe(TICKET_IO_ROOT);
  });

  it('never replaces valid purchase URL with homepage', () => {
    const result = writeCanonicalTicketFields({
      existing: adminEvent({ ticketUrl: TICKET_IO_EVENT }),
      extraCandidates: [{ url: 'https://bootshaus.tv/', field: 'homepage' }],
    });
    expect(result.patch.ticketUrl).toBeUndefined();
    expect(result.snapshot.publicCtaUrl).toBe(TICKET_IO_EVENT);
  });
});

describe('blocked detail preservation', () => {
  it('does not clear ticket URL when detail is blocked', () => {
    const result = writeCanonicalTicketFields({
      existing: adminEvent({
        ticketUrl: TICKET_IO_EVENT,
        priceText: 'ab 18,00 €',
        ticketPhases: [{ id: 'p1', name: 'Standard', sortOrder: 0, kind: 'regular', priceAmount: 18 }],
      }),
      detailBlocked: true,
      candidate: {
        externalId: 'x',
        sourceId: 's',
        sourceName: 's',
        title: 'T',
        startDate: '2026-08-10T20:00:00.000Z',
        rawSourceType: 'unknown',
      },
    });
    expect(result.patch.ticketUrl).toBeUndefined();
    expect(result.patch.priceText).toBeUndefined();
    expect(result.patch.ticketPhases).toBeUndefined();
  });
});

describe('price and availability normalization', () => {
  it('normalizes price ranges without inventing values', () => {
    const price = normalizeCanonicalTicketPrice({ priceText: 'ab 12,00 € – 24,00 €' });
    expect(price.minimumPrice).toBe(12);
    expect(price.maximumPrice).toBe(24);
  });

  it('does not infer sold_out without evidence', () => {
    const availability = normalizeCanonicalTicketAvailability({
      ticketStatus: 'external_link',
    });
    expect(availability).not.toBe('sold_out');
  });

  it('marks sold_out when status says so', () => {
    const availability = normalizeCanonicalTicketAvailability({ ticketStatus: 'sold_out' });
    expect(availability).toBe('sold_out');
  });
});

describe('canonical ticket read and CTA truthfulness', () => {
  it('labels shop root truthfully', () => {
    const read = readCanonicalTicket({ ticketUrl: TICKET_IO_ROOT });
    expect(read.ctaLabel).toBe(TICKET_CTA_LABELS_DE.ticket_platform_root);
    expect(read.ctaLabel).not.toBe('Tickets kaufen');
  });

  it('labels direct purchase truthfully', () => {
    const read = readCanonicalTicket({
      ticketUrl: 'https://checkout.example.com/cart/123',
    });
    expect(read.ctaLabel).toBe('Tickets kaufen');
  });

  it('accepts ticket kings event page', () => {
    const read = readCanonicalTicket({ ticketUrl: TICKET_KINGS_EVENT });
    expect(read.acceptanceState).toBe('ticket_event_page_correct');
  });
});

describe('writer idempotency', () => {
  it('produces no changes on second identical write', () => {
    const existing = adminEvent({
      ticketUrl: TICKET_IO_EVENT,
      websiteUrl: EVENT_PAGE,
      priceText: 'ab 18,00 €',
    });
    const first = writeCanonicalTicketFields({ existing });
    const merged = { ...existing, ...first.patch };
    const second = writeCanonicalTicketFields({ existing: merged });
    expect(second.changed).toBe(false);
    expect(second.fieldChanges).toHaveLength(0);
  });
});

describe('acceptance matrix', () => {
  it('classifies shop root fallback', () => {
    const snapshot = readCanonicalTicket({ ticketUrl: TICKET_IO_ROOT });
    expect(classifyTicketAcceptanceState(snapshot)).toBe('shop_root_fallback_only');
  });
});
