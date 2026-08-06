import { describe, expect, it } from 'vitest';

import {
  toEventHeroViewModel,
  toEventTicketSectionViewModel,
} from '@/features/event-detail/utils/event-detail-view-model';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import {
  auditConsumerTicketPresentationForEvent,
  dedupeConsumerTicketPhases,
  presentationToConsumerSlots,
  resolveConsumerTicketPresentation,
} from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import { isConsumerDiagnosticText } from '@/features/events/formatting/consumer-ticket-text-sanitizer';
import { toTicketSummaryViewModel } from '@/features/events/formatting/ticket-phase-consumer-bridge';

function baseEvent(overrides: Partial<EventDisplayModel> = {}): EventDisplayModel {
  return {
    id: 'evt-test',
    slug: 'evt-test',
    title: 'Test Event',
    description: 'Test',
    image: { uri: '' },
    date: 'Today',
    startTime: '22:00',
    venue: 'Club',
    city: 'Köln',
    country: 'Germany',
    genres: ['Techno'],
    artists: [],
    source: 'supabase',
    sourceLabel: 'Supabase',
    startsAt: '2026-08-08T20:00:00.000Z',
    startDateTime: '2026-08-08T20:00:00.000Z',
    timezone: 'Europe/Berlin',
    status: 'published',
    venueLabel: 'Club',
    cityLabel: 'Köln',
    displayPriceText: undefined,
    ticketAvailability: 'available',
    ...overrides,
  } as EventDisplayModel;
}

function admissionPhase(
  overrides: Partial<CanonicalTicketPhase> & Pick<CanonicalTicketPhase, 'id' | 'name'>,
): CanonicalTicketPhase {
  return {
    sortOrder: 0,
    kind: 'early_bird',
    priceAmount: 15,
    priceCurrency: 'EUR',
    priceLabel: 'ab 15,00 €',
    available: true,
    soldOut: false,
    ...overrides,
  };
}

describe('resolveConsumerTicketPresentation', () => {
  it('shows one phase card without standalone section price or summary', () => {
    const event = baseEvent({
      id: 'evt-underland',
      title: 'Underland Essigfabrik 05.09.2026',
      displayPriceText: 'ab 15,00 €',
      priceText: 'ab 15,00 €',
      ticketUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
      ticketProviderLabel: 'Ticket Kings',
      ticketPhases: [
        admissionPhase({
          id: 'phase-early',
          name: 'E-Ticket — Early Bird',
          priceLabel: 'ab 15,00 €',
        }),
      ],
    });

    const presentation = resolveConsumerTicketPresentation(event);
    const slots = presentationToConsumerSlots(presentation);

    expect(presentation.headerPriceLabel).toBe('ab 15,00 €');
    expect(presentation.sectionPriceLabel).toBeUndefined();
    expect(presentation.ticketTypes).toHaveLength(1);
    expect(presentation.ticketTypes[0]?.name).toBe('E-Ticket — Early Bird');
    expect(presentation.showSummary).toBe(false);
    expect(presentation.summary).toBeUndefined();
    expect(slots.sectionStandalonePrice).toBeUndefined();
    expect(slots.subtotal).toBeUndefined();
    expect(slots.total).toBeUndefined();
  });

  it('deduplicates semantically identical phases', () => {
    const phases = [
      admissionPhase({ id: 'a', name: 'Admission', sortOrder: 0 }),
      admissionPhase({ id: 'b', name: 'Admission', sortOrder: 1 }),
    ];
    expect(dedupeConsumerTicketPhases(phases)).toHaveLength(1);
  });

  it('shows verified price only in header when no phases exist', () => {
    const event = baseEvent({
      displayPriceText: 'ab 23,90 €',
      priceText: 'ab 23,90 €',
      ticketUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
      ticketProviderLabel: 'Ticket.io',
    });

    const presentation = resolveConsumerTicketPresentation(event);
    expect(presentation.headerPriceLabel).toBe('ab 23,90 €');
    expect(presentation.sectionPriceLabel).toBeUndefined();
    expect(presentation.ticketTypes).toHaveLength(0);
    expect(presentation.showSummary).toBe(false);
  });

  it('keeps honest no-price state with CTA only', () => {
    const event = baseEvent({
      id: 'evt-levi',
      title: 'NIGHTSWITHUS presents LEVI',
      ticketUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
      ticketProviderLabel: 'Ticket.io',
      displayPriceText: undefined,
      priceText: undefined,
      ticketPhases: undefined,
    });

    const presentation = resolveConsumerTicketPresentation(event);
    expect(presentation.headerPriceLabel).toBeUndefined();
    expect(presentation.sectionPriceLabel).toBeUndefined();
    expect(presentation.ticketTypes).toHaveLength(0);
    expect(presentation.cta).toBeTruthy();
  });

  it('does not expose subtotal/total without cart selection', () => {
    const phases = [admissionPhase({ id: 'p1', name: 'Standard Ticket — Phase 3' })];
    expect(toTicketSummaryViewModel(phases)).toBeUndefined();
    expect(toTicketSummaryViewModel(phases, { forCartCheckout: true })).toBeDefined();
  });

  it('filters diagnostic strings from consumer output', () => {
    expect(isConsumerDiagnosticText('surface: ticket_io_detail')).toBe(true);
    expect(isConsumerDiagnosticText('Early bird ends Friday')).toBe(false);
  });
});

describe('acceptance event snapshots', () => {
  const cases = [
    {
      label: 'Underland',
      event: baseEvent({
        id: 'evt-1785389049895-4mb7dub',
        displayPriceText: 'ab 15,00 €',
        priceText: 'ab 15,00 €',
        ticketUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
        ticketProviderLabel: 'Ticket Kings',
        ticketPhases: [
          admissionPhase({
            id: 'underland-early',
            name: 'E-Ticket — Early Bird',
            priceLabel: 'ab 15,00 €',
          }),
        ],
      }),
      header: 'ab 15,00 €',
      phaseName: 'E-Ticket — Early Bird',
    },
    {
      label: 'Sommerfest Elektroküche',
      event: baseEvent({
        id: 'evt-1785389055557-ux20897',
        displayPriceText: 'ab 15,00 €',
        priceText: 'ab 15,00 €',
        ticketPhases: [
          admissionPhase({
            id: 'elektro-phase3',
            name: 'Standard Ticket — Phase 3',
            priceLabel: 'ab 15,00 €',
          }),
        ],
      }),
      header: 'ab 15,00 €',
      phaseName: 'Standard Ticket — Phase 3',
    },
    {
      label: 'BC173',
      event: baseEvent({
        id: 'evt-1785339410908-9691748',
        displayPriceText: 'ab 23,00 €',
        priceText: 'ab 23,00 €',
        ticketPhases: [
          admissionPhase({
            id: 'bc173-admission',
            name: 'Admission',
            priceAmount: 23,
            priceLabel: 'ab 23,00 €',
          }),
        ],
      }),
      header: 'ab 23,00 €',
      phaseName: 'Ticket',
    },
    {
      label: 'R3HAB',
      event: baseEvent({
        id: 'evt-1785339421539-k3swcrl',
        displayPriceText: 'ab 23,90 €',
        priceText: 'ab 23,90 €',
        ticketUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
        ticketProviderLabel: 'Ticket.io',
      }),
      header: 'ab 23,90 €',
      phaseName: undefined,
    },
    {
      label: 'Bootshaus Sommerfest',
      event: baseEvent({
        id: 'evt-1785339391167-tfaixrr',
        displayPriceText: 'ab 11,90 €',
        priceText: 'Tickets ab 11,90 Euro',
        ticketUrl: 'https://bootshaus-club.ticket.io/vB0cAmWg/',
        ticketProviderLabel: 'Ticket.io',
      }),
      header: 'ab 11,90 €',
      phaseName: undefined,
    },
    {
      label: 'MDMA',
      event: baseEvent({
        id: 'evt-1785389052337-0gv1iz1',
        displayPriceText: 'ab 34,90 €',
        priceText: 'Tickets ab 34,90 Euro',
      }),
      header: 'ab 34,90 €',
      phaseName: undefined,
    },
    {
      label: 'LEVI',
      event: baseEvent({
        id: 'evt-1785339383539-0lxvjlp',
        ticketUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
        ticketProviderLabel: 'Ticket.io',
      }),
      header: undefined,
      phaseName: undefined,
    },
  ] as const;

  it.each(cases)('$label presentation contract', ({ event, header, phaseName }) => {
    const hero = toEventHeroViewModel(event);
    const section = toEventTicketSectionViewModel(event);
    const { audit } = auditConsumerTicketPresentationForEvent(event, { mode: section.mode, ctaLabel: section.ctaLabel });

    expect(hero.ticketLabel).toBe(header);
    expect(section.priceLabel).toBeUndefined();
    expect(section.showSummary).toBe(false);
    expect(section.summary).toBeUndefined();

    if (phaseName) {
      expect(section.ticketTypes).toHaveLength(1);
      expect(section.ticketTypes[0]?.name).toBe(phaseName);
    } else {
      expect(section.ticketTypes).toHaveLength(0);
    }

    expect(audit.duplicateGroups.some((group) => group.surfaces.includes('subtotal'))).toBe(false);
    expect(audit.duplicateGroups.some((group) => group.surfaces.includes('total'))).toBe(false);
    expect(audit.duplicateGroups.some((group) => group.surfaces.includes('section_standalone'))).toBe(false);
    expect(JSON.stringify(audit.slots)).not.toMatch(/surface:/i);
  });
});
