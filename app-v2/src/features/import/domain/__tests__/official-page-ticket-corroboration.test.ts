import { describe, expect, it } from 'vitest';

import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import {
  evaluateOfficialPageTicketCorroboration,
  resolveOfficialOutboundRelationship,
} from '@/features/import/domain/official-page-ticket-corroboration';
import {
  eventDatesNeedTimeOfDayReview,
  parseEventCalendarDay,
  sameCalendarDay,
} from '@/features/import/matching/matching-utils';

const TICKET_IO_EVENT = 'https://bootshaus-club.ticket.io/C7JPnatZ/';
const TICKET_KINGS_EVENT = 'https://ticketkings.de/event/sommerfest-elektrokueche-08-08-2026/';
const NACHT_MANAGER_CHECKOUT =
  'https://nacht-manager.de/ticketing/native_event.php?id=24&embed=1&embed_layout=checkout';

describe('official page ticket corroboration contract', () => {
  it('A corroborates partial ticket identity with matching official page and direct outbound link', () => {
    const result = evaluateOfficialPageTicketCorroboration({
      canonical: {
        eventId: 'evt-elektro',
        title: 'Sommerfest Elektroküche 08.08.2026',
        startDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Essigfabrik',
      },
      ticketEvidence: {
        pageTitle: 'Sommerfest Elektroküche',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Essigfabrik',
      },
      officialPage: {
        pageTitle: 'Sommerfest Elektroküche 08.08.2026',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Essigfabrik',
        outboundTicketUrls: [NACHT_MANAGER_CHECKOUT],
      },
      publicTicketPageUrl: NACHT_MANAGER_CHECKOUT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(result.corroborated).toBe(true);
    expect(result.canonicalIdentityReviewRequired).toBe(false);
    expect(result.officialOutboundRelationship.confirmed).toBe(true);

    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-elektro',
        title: 'Sommerfest Elektroküche 08.08.2026',
        startDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Essigfabrik',
      },
      evidence: {
        pageTitle: 'Sommerfest Elektroküche',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Essigfabrik',
      },
      officialPage: {
        pageTitle: 'Sommerfest Elektroküche 08.08.2026',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Essigfabrik',
        outboundTicketUrls: [NACHT_MANAGER_CHECKOUT],
      },
      evidenceUrl: NACHT_MANAGER_CHECKOUT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });
    expect(gate.verdict).toBe('corroborated');
    expect(gate.criticalFieldsPublishAllowed).toBe(true);
  });

  it('B keeps partial ticket identity in review without official outbound link', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-levi',
        title: 'LEVI – Live at Bootshaus',
        startDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      evidence: {
        pageTitle: 'LEVI Live',
        eventDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      evidenceUrl: TICKET_KINGS_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });
    expect(gate.verdict).toBe('partial_review_only');
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.officialPageLinked).toBe(false);
  });

  it('C blocks when official page links ticket page but date diverges', () => {
    const result = evaluateOfficialPageTicketCorroboration({
      canonical: {
        eventId: 'evt-1',
        title: 'Event Alpha',
        startDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      ticketEvidence: {
        pageTitle: 'Event Alpha',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      officialPage: {
        pageTitle: 'Event Alpha',
        eventDate: '2026-08-09T20:00:00.000Z',
        venueName: 'Bootshaus',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      publicTicketPageUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(result.corroborated).toBe(false);
    expect(result.reason).toBe('official_page_date_mismatch_with_ticket');

    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-1',
        title: 'Event Alpha',
        startDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      evidence: {
        pageTitle: 'Event Alpha',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      officialPage: {
        pageTitle: 'Event Alpha',
        eventDate: '2026-08-09T20:00:00.000Z',
        venueName: 'Bootshaus',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).not.toBe('corroborated');
  });

  it('D requires canonical identity review when official and ticket agree but canonical venue diverges', () => {
    const result = evaluateOfficialPageTicketCorroboration({
      canonical: {
        eventId: 'evt-underland',
        title: 'Underland Essigfabrik 05.09.2026',
        startDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      ticketEvidence: {
        pageTitle: 'Underland Essigfabrik',
        eventDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Essigfabrik',
      },
      officialPage: {
        pageTitle: 'Underland Essigfabrik 05.09.2026',
        eventDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Essigfabrik',
        outboundTicketUrls: [TICKET_KINGS_EVENT],
      },
      publicTicketPageUrl: TICKET_KINGS_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(result.canonicalIdentityReviewRequired).toBe(true);
    expect(result.corroborated).toBe(false);
    expect(result.suggestedIdentityCorrections.some((entry) => entry.field === 'venueName')).toBe(
      true,
    );

    const write = writeCanonicalTicketFields({
      existing: {
        id: 'evt-underland',
        title: 'Underland Essigfabrik 05.09.2026',
        description: 'Desc',
        startDate: '2026-09-05T20:00:00.000Z',
        status: 'published',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        venueName: 'Bootshaus',
        priceText: 'ab 15,00 €',
        ticketUrl: TICKET_KINGS_EVENT,
      },
      candidate: {
        externalId: 'ext-underland',
        sourceId: 'audit',
        sourceName: 'audit',
        title: 'Underland Essigfabrik',
        startDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Essigfabrik',
        ticketUrl: TICKET_KINGS_EVENT,
        priceText: 'ab 15,00 €',
        rawSourceType: 'html',
        sourceMetadata: {
          pageTitle: 'Underland Essigfabrik',
          eventDate: '2026-09-05T20:00:00.000Z',
          venueName: 'Essigfabrik',
          verifiedAt: '2026-08-07T10:00:00.000Z',
          officialPageTitle: 'Underland Essigfabrik 05.09.2026',
          officialPageEventDate: '2026-09-05T20:00:00.000Z',
          officialPageVenueName: 'Essigfabrik',
          officialOutboundTicketUrls: [TICKET_KINGS_EVENT],
          ticketOffers: [{ name: 'Early Bird', priceAmount: 15, priceCurrency: 'EUR' }],
        },
      },
    });

    expect(write.audit.canonicalIdentityReviewRequired).toBe(true);
    expect(write.patch.priceText).toBeUndefined();
    expect(write.patch.ticketPhases).toBeUndefined();
    expect(write.audit.blockedCriticalFields.length).toBeGreaterThan(0);
  });

  it('E allows corroboration for ticket.io list-card identity under detail PoW with official outbound link', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-r3hab',
        title: 'R3HAB pres. by BOOTSHAUS',
        startDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
      evidence: {
        listRowTitle: 'R3HAB pres. by BOOTSHAUS',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
      officialPage: {
        pageTitle: 'R3HAB pres. by BOOTSHAUS',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.verdict).toBe('exact');
    expect(gate.criticalFieldsPublishAllowed).toBe(true);

    const partialGate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-r3hab',
        title: 'R3HAB at Bootshaus Cologne',
        startDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
      evidence: {
        listRowTitle: 'R3HAB pres. by BOOTSHAUS',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
      officialPage: {
        pageTitle: 'R3HAB pres. by BOOTSHAUS',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });
    expect(partialGate.verdict).toBe('corroborated');
    expect(partialGate.criticalFieldsPublishAllowed).toBe(true);
  });

  it('F blocks wrong ticket page title even when official outbound URL looks plausible', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-mdma',
        title: 'MDMA – Musik Die Mich Antreibt 10.10.26',
        startDate: '2026-10-10T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      evidence: {
        pageTitle: 'CHROME COLOGNE',
        listRowTitle: 'CHROME COLOGNE',
        eventDate: '2026-10-10T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      officialPage: {
        pageTitle: 'MDMA – Musik Die Mich Antreibt 10.10.26',
        eventDate: '2026-10-10T20:00:00.000Z',
        venueName: 'Bootshaus',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.verdict).toBe('mismatch');
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).not.toBe('corroborated');
  });

  it('G allows ticket relationship when official outbound is exact despite venue divergence', () => {
    const result = evaluateOfficialPageTicketCorroboration({
      canonical: {
        eventId: 'evt-offsite',
        title: "Bootshaus pres. BC173 (let's get loco)",
        startDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Bootshaus',
      },
      ticketEvidence: {
        listRowTitle: 'BC173 Airport Session pres. by Bootshaus III',
        eventDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Moxy Köln/Bonn Flughafen',
      },
      officialPage: {
        pageTitle: "Bootshaus pres. BC173 (let's get loco)",
        eventDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Bootshaus',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      publicTicketPageUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(result.corroborated).toBe(true);
    expect(result.ticketEvidenceBlocked).toBe(false);
    expect(result.reason).toBe('official_outbound_exact_overrides_venue_divergence');
  });
});

describe('event calendar day identity semantics', () => {
  it('A treats same local calendar day at 00:00 and 22:00 as compatible', () => {
    expect(
      sameCalendarDay('2026-09-04T00:00:00+02:00', '2026-09-04T22:00:00+02:00'),
    ).toBe(true);
    expect(
      eventDatesNeedTimeOfDayReview('2026-09-04T00:00:00+02:00', '2026-09-04T22:00:00+02:00'),
    ).toBe(true);
  });

  it('B compares each ISO value by its own stated local calendar day', () => {
    expect(
      sameCalendarDay('2026-09-05T22:00:00+02:00', '2026-09-05T20:00:00+00:00'),
    ).toBe(true);
    expect(
      sameCalendarDay('2026-09-04T22:00:00+00:00', '2026-09-05T00:00:00+02:00'),
    ).toBe(false);
  });

  it('C blocks the following calendar day', () => {
    expect(
      sameCalendarDay('2026-09-04T22:00:00+02:00', '2026-09-05T00:00:00+02:00'),
    ).toBe(false);

    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-1',
        title: 'Event Alpha',
        startDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      evidence: {
        pageTitle: 'Event Alpha',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      officialPage: {
        pageTitle: 'Event Alpha',
        eventDate: '2026-08-09T20:00:00.000Z',
        venueName: 'Bootshaus',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).not.toBe('corroborated');
  });

  it('D treats date-only and same-day date-time as compatible', () => {
    expect(sameCalendarDay('2026-09-04', '2026-09-04T22:00:00+02:00')).toBe(true);
    expect(parseEventCalendarDay('2026-09-04')).toEqual({
      year: 2026,
      month: 9,
      day: 4,
    });
  });

  it('E blocks date-only against the next calendar day', () => {
    expect(sameCalendarDay('2026-09-04', '2026-09-05T22:00:00+02:00')).toBe(false);
  });
});

describe('three-way identity consistency', () => {
  it('A allows writes when canonical, official, and ticket all agree', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-alpha',
        title: 'Event Alpha',
        startDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Venue Hall',
      },
      evidence: {
        pageTitle: 'Event Alpha',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Venue Hall',
      },
      officialPage: {
        pageTitle: 'Event Alpha',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Venue Hall',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.threeWayOutcome).toBe('all_agree');
    expect(gate.verdict).toBe('exact');
    expect(gate.criticalFieldsPublishAllowed).toBe(true);
  });

  it('B requires canonical review when official and ticket agree but canonical date diverges', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-beta',
        title: 'Event Beta',
        startDate: '2026-09-04T20:00:00.000Z',
        venueName: 'Venue Hall',
      },
      evidence: {
        pageTitle: 'Event Beta',
        eventDate: '2026-09-05T22:00:00+02:00',
        venueName: 'Venue Hall',
      },
      officialPage: {
        pageTitle: 'Event Beta',
        eventDate: '2026-09-05T00:00:00+02:00',
        venueName: 'Venue Hall',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.canonicalIdentityReviewRequired).toBe(true);
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.suggestedIdentityCorrections.some((entry) => entry.field === 'startDate')).toBe(true);
  });

  it('C requires canonical review when official and ticket agree but canonical venue diverges', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-gamma',
        title: 'Event Gamma',
        startDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Wrong Venue',
      },
      evidence: {
        pageTitle: 'Event Gamma',
        eventDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Venue Hall',
      },
      officialPage: {
        pageTitle: 'Event Gamma',
        eventDate: '2026-09-05T20:00:00.000Z',
        venueName: 'Venue Hall',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.canonicalIdentityReviewRequired).toBe(true);
    expect(gate.criticalFieldsPublishAllowed).toBe(true);
    expect(gate.suggestedIdentityCorrections.some((entry) => entry.field === 'venueName')).toBe(true);
  });

  it('D blocks ticket evidence when canonical and official agree but ticket diverges', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-delta',
        title: 'Event Delta',
        startDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Venue Hall',
      },
      evidence: {
        listRowTitle: 'Different Event Name',
        eventDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Other Venue',
      },
      officialPage: {
        pageTitle: 'Event Delta',
        eventDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Venue Hall',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.ticketEvidenceBlocked).toBe(true);
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).not.toBe('corroborated');
  });

  it('E keeps ticket blocked when outbound exists but ticket identity mismatches canonical', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-epsilon',
        title: 'Canonical Event',
        startDate: '2026-10-10T20:00:00.000Z',
        venueName: 'Venue Hall',
      },
      evidence: {
        pageTitle: 'Wrong Ticket Event',
        listRowTitle: 'Wrong Ticket Event',
        eventDate: '2026-10-10T20:00:00.000Z',
        venueName: 'Venue Hall',
      },
      officialPage: {
        pageTitle: 'Canonical Event',
        eventDate: '2026-10-10T20:00:00.000Z',
        venueName: 'Venue Hall',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).toBe('mismatch');
  });

  it('F keeps exact ticket path when official page lacks date fields', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-zeta',
        title: 'Event Zeta',
        startDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Venue Hall',
      },
      evidence: {
        listRowTitle: 'Event Zeta',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Venue Hall',
      },
      officialPage: {
        pageTitle: 'Event Zeta | Venue Hall',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.verdict).toBe('exact');
    expect(gate.criticalFieldsPublishAllowed).toBe(true);
    expect(gate.threeWayOutcome).toBe('ticket_exact_without_official_corroboration');
  });

  it('G keeps same calendar day compatible across different clock times', () => {
    expect(
      sameCalendarDay('2026-09-04T00:00:00+02:00', '2026-09-04T22:00:00+02:00'),
    ).toBe(true);

    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-eta',
        title: 'Event Eta',
        startDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Venue Hall',
      },
      evidence: {
        pageTitle: 'Event Eta',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Venue Hall',
      },
      officialPage: {
        pageTitle: 'Event Eta',
        eventDate: '2026-09-04T00:00:00+02:00',
        venueName: 'Venue Hall',
        outboundTicketUrls: [TICKET_IO_EVENT],
      },
      evidenceUrl: TICKET_IO_EVENT,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.criticalFieldsPublishAllowed).toBe(true);
    expect(gate.diagnostics).toContain(
      'time_of_day_review:compatible_calendar_day_different_clock_time',
    );
  });
});

describe('official outbound relationship resolution', () => {
  it('rejects shop-root-only outbound links', () => {
    const relationship = resolveOfficialOutboundRelationship({
      publicTicketPageUrl: TICKET_IO_EVENT,
      outboundTicketUrls: ['https://bootshaus-club.ticket.io/'],
    });
    expect(relationship.confirmed).toBe(false);
    expect(relationship.reason).toBe('official_outbound_only_shop_root_or_generic');
  });

  it('confirms slug-bound ticket.io outbound links', () => {
    const relationship = resolveOfficialOutboundRelationship({
      publicTicketPageUrl: TICKET_IO_EVENT,
      outboundTicketUrls: ['https://bootshaus-club.ticket.io/C7JPnatZ'],
    });
    expect(relationship.confirmed).toBe(true);
  });
});
