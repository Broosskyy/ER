import { describe, expect, it } from 'vitest';

import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import { evaluateOfficialPageTicketCorroboration } from '@/features/import/domain/official-page-ticket-corroboration';
import {
  analyzeEventTitleCore,
  compareEventTitleCores,
  scoreTitleCoreAgreement,
} from '@/features/import/matching/event-title-core';
import { evaluatePublicIdentityMatch } from '@/features/import/ticket-platform-identity/identity-match';

const BC173_TICKET = 'https://bootshaus-club.ticket.io/BcDqml12/';
const LEVI_TICKET = 'https://bootshaus-tickets.ticket.io/YvJnLSXd/';
const NACHT_MANAGER_CHECKOUT =
  'https://nacht-manager.de/ticketing/native_event.php?id=24&embed=1&embed_layout=checkout';

describe('event title core extraction', () => {
  it('preserves raw titles while extracting LEVI variants to the same core', () => {
    const variants = [
      'LEVI',
      'NIGHTSWITHUS presents LEVI',
      'LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne',
    ];
    const analyses = variants.map((title) => analyzeEventTitleCore(title));
    expect(analyses.every((entry) => entry.rawTitle.length > 0)).toBe(true);
    expect(new Set(analyses.flatMap((entry) => entry.coreTokens))).toEqual(new Set(['levi']));
    expect(analyses[2]?.removedQualifiers.some((entry) => entry.includes('@'))).toBe(true);
  });

  it('extracts BC173 as the shared anchor while keeping Airport Session as residual tokens', () => {
    const canonical = analyzeEventTitleCore('BC173');
    const official = analyzeEventTitleCore("Bootshaus pres. BC173 (let's get loco)");
    const ticket = analyzeEventTitleCore('BC173 Airport Session pres. by Bootshaus III');

    expect(canonical.coreTokens).toEqual(['bc173']);
    expect(canonical.residualTokens).toEqual([]);
    expect(ticket.coreTokens).toEqual(['bc173']);
    expect(ticket.residualTokens).toEqual(['airport', 'session']);
    expect(official.rawTitle).toBe("Bootshaus pres. BC173 (let's get loco)");
    expect(compareEventTitleCores(canonical, ticket).coresAgree).toBe(true);
    expect(compareEventTitleCores(canonical, ticket).residualTokensDiffer).toBe(true);
    expect(compareEventTitleCores(canonical, ticket).maxMatchStrength).toBe('partial');
  });

  it('matches generic NOVA presenter variants without known venue or promoter names', () => {
    const left = analyzeEventTitleCore('Warehouse Collective presents NOVA');
    const right = analyzeEventTitleCore('NOVA presented by Warehouse Collective @ Hall X');
    expect(left.coreTokens).toEqual(['nova']);
    expect(right.coreTokens).toEqual(['nova']);
    expect(compareEventTitleCores(left, right).coresAgree).toBe(true);
    expect(compareEventTitleCores(left, right).residualTokensDiffer).toBe(false);
  });

  it('keeps Airport Session distinct from Session', () => {
    expect(
      compareEventTitleCores(
        analyzeEventTitleCore('Airport Session'),
        analyzeEventTitleCore('Session'),
      ).coresAgree,
    ).toBe(false);
  });

  it('keeps House Party distinct from Party', () => {
    expect(
      compareEventTitleCores(analyzeEventTitleCore('House Party'), analyzeEventTitleCore('Party')).coresAgree,
    ).toBe(false);
  });

  it('rejects LEVI vs LEVIATHAN', () => {
    expect(compareEventTitleCores(analyzeEventTitleCore('LEVI'), analyzeEventTitleCore('LEVIATHAN')).coresAgree).toBe(
      false,
    );
  });

  it('rejects MDMA vs CHROME', () => {
    expect(
      compareEventTitleCores(
        analyzeEventTitleCore('MDMA – Musik Die Mich Antreibt 10.10.26'),
        analyzeEventTitleCore('CHROME COLOGNE'),
      ).coresAgree,
    ).toBe(false);
  });

  it('rejects Bootshaus Sommerfest vs Sommerfest Elektroküche', () => {
    expect(
      compareEventTitleCores(
        analyzeEventTitleCore('Bootshaus Sommerfest'),
        analyzeEventTitleCore('Sommerfest Elektroküche'),
      ).coresAgree,
    ).toBe(false);
  });

  it('limits BC173 with differing residual tokens to partial identity strength', () => {
    const score = scoreTitleCoreAgreement('BC173', 'BC173 Airport Session pres. by Bootshaus III', {
      verifiedAt: '2026-08-07T10:00:00.000Z',
      dateAgrees: true,
      venueCompatible: true,
      officialOutboundConfirmed: true,
    });
    expect(score.coresAgree).toBe(true);
    expect(score.residualTokensDiffer).toBe(true);
    expect(score.maxMatchStrength).toBe('partial');
    expect(score.score).toBe(0.8);
  });

  it('rejects the same BC173 core with a different calendar day', () => {
    const left = evaluatePublicIdentityMatch(
      {
        eventId: 'evt-bc173-a',
        title: 'BC173',
        startDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Moxy Köln/Bonn Flughafen',
      },
      {
        listRowTitle: 'BC173 Airport Session pres. by Bootshaus III',
        eventDate: '2026-08-22T16:00:00+02:00',
        venueName: 'Moxy Köln/Bonn Flughafen',
      },
      { verifiedAt: '2026-08-07T10:00:00.000Z', officialOutboundConfirmed: true },
    );
    expect(left.match).toBe('mismatch');
    expect(left.reason).toBe('date_mismatch');
  });

  it('blocks a single-word core without strong secondary evidence', () => {
    const score = scoreTitleCoreAgreement('LEVI', 'NIGHTSWITHUS presents LEVI');
    expect(score.coresAgree).toBe(true);
    expect(score.score).toBeLessThan(0.55);
    expect(score.requiresSecondaryEvidence).toBe(true);
    expect(score.maxMatchStrength).toBe('partial');
  });
});

describe('event title core integration', () => {
  it('corroborates LEVI variants with official outbound link and verifiedAt', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-levi',
        title: 'LEVI',
        startDate: '2026-08-07T22:00:00+02:00',
        venueName: 'Bootshaus',
        ticketUrl: LEVI_TICKET,
      },
      evidence: {
        listRowTitle: 'LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne',
        eventDate: '2026-08-07T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
      officialPage: {
        pageTitle: 'NIGHTSWITHUS presents LEVI',
        eventDate: '2026-08-07T22:00:00+02:00',
        venueName: 'Bootshaus',
        outboundTicketUrls: [LEVI_TICKET],
      },
      evidenceUrl: LEVI_TICKET,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(gate.verdict).toMatch(/exact|corroborated/);
    expect(gate.criticalFieldsPublishAllowed).toBe(true);

    const write = writeCanonicalTicketFields({
      existing: {
        id: 'evt-levi',
        title: 'LEVI',
        description: 'Desc',
        startDate: '2026-08-07T22:00:00+02:00',
        status: 'published',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        venueName: 'Bootshaus',
        ticketUrl: LEVI_TICKET,
      },
      candidate: {
        externalId: LEVI_TICKET,
        sourceId: 'audit',
        sourceName: 'audit',
        title: 'LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne',
        startDate: '2026-08-07T22:00:00+02:00',
        venueName: 'Bootshaus',
        ticketUrl: LEVI_TICKET,
        priceText: 'ab 30,00 €',
        rawSourceType: 'html',
        sourceMetadata: {
          listRowTitle: 'LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne',
          eventDate: '2026-08-07T22:00:00+02:00',
          venueName: 'Bootshaus',
          verifiedAt: '2026-08-07T10:00:00.000Z',
          officialPageTitle: 'NIGHTSWITHUS presents LEVI',
          officialPageEventDate: '2026-08-07T22:00:00+02:00',
          officialPageVenueName: 'Bootshaus',
          officialOutboundTicketUrls: [LEVI_TICKET],
          ticketOffers: [{ name: 'List admission', priceAmount: 30, priceCurrency: 'EUR' }],
        },
      },
    });
    expect(write.patch.priceText).toMatch(/30/);
  });

  it('requires canonical identity review for BC173 when official and ticket agree on Moxy', () => {
    const corroboration = evaluateOfficialPageTicketCorroboration({
      canonical: {
        eventId: 'evt-bc173',
        title: 'BC173',
        startDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Bootshaus',
        ticketUrl: BC173_TICKET,
      },
      ticketEvidence: {
        listRowTitle: 'BC173 Airport Session pres. by Bootshaus III',
        eventDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Moxy Köln/Bonn Flughafen',
      },
      officialPage: {
        pageTitle: "Bootshaus pres. BC173 (let's get loco)",
        eventDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Moxy Köln/Bonn Flughafen',
        outboundTicketUrls: [BC173_TICKET],
      },
      publicTicketPageUrl: BC173_TICKET,
      verifiedAt: '2026-08-07T10:00:00.000Z',
    });

    expect(corroboration.canonicalIdentityReviewRequired).toBe(true);
    expect(corroboration.threeWayOutcome).toBe('canonical_identity_review_required');
    expect(corroboration.suggestedIdentityCorrections.some((entry) => entry.field === 'venueName')).toBe(
      true,
    );

    const write = writeCanonicalTicketFields({
      existing: {
        id: 'evt-bc173',
        title: 'BC173',
        description: 'Desc',
        startDate: '2026-08-15T16:00:00+02:00',
        status: 'published',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        venueName: 'Bootshaus',
        priceText: 'ab 23,00 €',
        ticketUrl: BC173_TICKET,
      },
      candidate: {
        externalId: BC173_TICKET,
        sourceId: 'audit',
        sourceName: 'audit',
        title: "Bootshaus pres. BC173 (let's get loco)",
        startDate: '2026-08-15T16:00:00+02:00',
        venueName: 'Moxy Köln/Bonn Flughafen',
        ticketUrl: BC173_TICKET,
        priceText: 'ab 26,00 €',
        rawSourceType: 'html',
        sourceMetadata: {
          listRowTitle: 'BC173 Airport Session pres. by Bootshaus III',
          eventDate: '2026-08-15T16:00:00+02:00',
          venueName: 'Moxy Köln/Bonn Flughafen',
          verifiedAt: '2026-08-07T10:00:00.000Z',
          officialPageTitle: "Bootshaus pres. BC173 (let's get loco)",
          officialPageEventDate: '2026-08-15T16:00:00+02:00',
          officialPageVenueName: 'Moxy Köln/Bonn Flughafen',
          officialOutboundTicketUrls: [BC173_TICKET],
          ticketOffers: [{ name: 'List admission', priceAmount: 26, priceCurrency: 'EUR' }],
        },
      },
    });
    expect(write.patch.priceText).toBeUndefined();
    expect(write.audit.canonicalIdentityReviewRequired).toBe(true);
  });

  it('keeps Sommerfest Elektroküche blocked when ticket identity is wrong in the three-way gate', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-elektro',
        title: 'Sommerfest Elektroküche 08.08.2026',
        startDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Essigfabrik',
      },
      evidence: {
        pageTitle: 'Bootshaus Sommerfest',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Bootshaus',
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

    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.ticketEvidenceBlocked).toBe(true);
    expect(gate.verdict).not.toMatch(/exact|corroborated/);
  });
});

describe('NOVA single-core secondary evidence gate', () => {
  const NOVA_TICKET = 'https://example-shop.ticket.io/N0vAs1ug/';
  const VERIFIED_AT = '2026-08-07T10:00:00.000Z';
  const EVENT_DATE = '2026-09-01T22:00:00+02:00';

  function buildNovaGate(
    overrides: Partial<Parameters<typeof evaluateEventEvidenceIdentityGate>[0]> = {},
  ) {
    return evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-nova',
        title: 'NOVA',
        startDate: EVENT_DATE,
        venueName: 'Hall X',
        ticketUrl: NOVA_TICKET,
      },
      evidence: {
        listRowTitle: 'NOVA presented by Warehouse Collective @ Hall X',
        eventDate: EVENT_DATE,
        venueName: 'Hall X',
      },
      officialPage: {
        pageTitle: 'Warehouse Collective presents NOVA',
        outboundTicketUrls: [NOVA_TICKET],
      },
      evidenceUrl: NOVA_TICKET,
      verifiedAt: VERIFIED_AT,
      ...overrides,
    });
  }

  it('corroborates only with verifiedAt, same day, venue, outbound, and slug-bound ticket', () => {
    const gate = buildNovaGate();
    expect(gate.verdict).toMatch(/exact|corroborated/);
    expect(gate.criticalFieldsPublishAllowed).toBe(true);
  });

  it('blocks when verifiedAt is missing', () => {
    const gate = buildNovaGate({ verifiedAt: undefined });
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).not.toMatch(/exact|corroborated/);
  });

  it('blocks when calendar day diverges', () => {
    const gate = buildNovaGate({
      evidence: {
        listRowTitle: 'NOVA presented by Warehouse Collective @ Hall X',
        eventDate: '2026-09-02T22:00:00+02:00',
        venueName: 'Hall X',
      },
    });
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).toMatch(/mismatch|partial_review_only/);
  });

  it('blocks when venue diverges', () => {
    const gate = buildNovaGate({
      evidence: {
        listRowTitle: 'NOVA presented by Warehouse Collective @ Hall X',
        eventDate: EVENT_DATE,
        venueName: 'Other Hall',
      },
    });
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).not.toMatch(/exact|corroborated/);
  });

  it('blocks when official outbound relationship is missing', () => {
    const gate = buildNovaGate({
      officialPage: {
        pageTitle: 'Warehouse Collective presents NOVA',
        outboundTicketUrls: ['https://example-shop.ticket.io/other-slug/'],
      },
    });
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).not.toMatch(/exact|corroborated/);
  });

  it('blocks when public ticket slug is not bound to the outbound link', () => {
    const gate = buildNovaGate({
      evidenceUrl: 'https://example-shop.ticket.io/different-slug/',
    });
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(gate.verdict).not.toMatch(/exact|corroborated/);
  });

  it('agrees official title-only page with ticket when date and venue exist on ticket', () => {
    const corroboration = evaluateOfficialPageTicketCorroboration({
      canonical: {
        eventId: 'evt-nova',
        title: 'NOVA',
        startDate: EVENT_DATE,
        venueName: 'Hall X',
        ticketUrl: NOVA_TICKET,
      },
      ticketEvidence: {
        listRowTitle: 'NOVA presented by Warehouse Collective @ Hall X',
        eventDate: EVENT_DATE,
        venueName: 'Hall X',
      },
      officialPage: {
        pageTitle: 'Warehouse Collective presents NOVA',
        outboundTicketUrls: [NOVA_TICKET],
      },
      publicTicketPageUrl: NOVA_TICKET,
      verifiedAt: VERIFIED_AT,
    });

    expect(corroboration.officialOutboundRelationship.confirmed).toBe(true);
    expect(corroboration.corroborated).toBe(true);
  });
});
