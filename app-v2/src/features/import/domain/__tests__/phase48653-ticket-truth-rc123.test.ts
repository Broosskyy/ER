import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { selectCanonicalTicket } from '@/features/events/domain/canonical-ticket-selection';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import {
  buildAtomicAdmissionSnapshot,
  evaluateTicketEvidenceFreshness,
  replaceAdmissionSnapshotForSource,
} from '@/features/import/domain/ticket-evidence-freshness-merge';
import { normalizeSourceTicketOffer } from '@/features/import/domain/canonical-ticket-phase';

const TICKET_KINGS_EVENT = 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt/';
const NACHT_MANAGER_CHECKOUT =
  'https://nacht-manager.de/ticketing/native_event.php?id=24&embed=1&embed_layout=checkout';
const CHROME_TICKET_IO = 'https://bootshaus-club.ticket.io/Atz0dHLX/';

function adminEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-mdma',
    title: 'MDMA – Musik Die Mich Antreibt 10.10.26',
    description: 'Desc',
    startDate: '2026-10-10T20:00:00.000Z',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    priceText: 'ab 34,90 €',
    ticketUrl: CHROME_TICKET_IO,
    ...overrides,
  };
}

function baseCandidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'ext-mdma',
    sourceId: 'source-ticket-kings',
    sourceName: 'Ticket Kings',
    title: 'MDMA – Musik Die Mich Antreibt 10.10.26',
    startDate: '2026-10-10T20:00:00.000Z',
    rawSourceType: 'html',
    ...overrides,
  };
}

describe('event evidence identity gate', () => {
  it('blocks CHROME Ticket.io evidence for MDMA event', () => {
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
      evidenceUrl: CHROME_TICKET_IO,
    });
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
    expect(['mismatch', 'partial_review_only', 'unverifiable']).toContain(gate.verdict);
  });

  it('allows corroborated partial match with official outbound ticket link', () => {
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-elektro',
        title: 'Sommerfest Elektroküche 08.08.2026',
        startDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      evidence: {
        pageTitle: 'Sommerfest Elektroküche',
        eventDate: '2026-08-08T20:00:00.000Z',
        venueName: 'Bootshaus',
      },
      evidenceUrl: NACHT_MANAGER_CHECKOUT,
      officialOutboundTicketUrls: [NACHT_MANAGER_CHECKOUT],
    });
    expect(gate.verdict).toBe('corroborated');
    expect(gate.criticalFieldsPublishAllowed).toBe(true);
  });

  it('keeps partial match as review-only without official corroboration', () => {
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
    });
    expect(gate.verdict).toBe('partial_review_only');
    expect(gate.criticalFieldsPublishAllowed).toBe(false);
  });
});

describe('ticket evidence freshness merge', () => {
  it('replaces untimestamped existing with newer verified incoming', () => {
    const decision = evaluateTicketEvidenceFreshness({
      identityVerdict: 'exact',
      manualLocked: false,
      hasIncomingSnapshot: true,
      incomingVerifiedAt: '2026-08-06T10:00:00.000Z',
    });
    expect(decision.apply).toBe(true);
    expect(decision.fallbackRule).toBe('incoming_newer_verified');
  });

  it('does not replace when incoming is older', () => {
    const decision = evaluateTicketEvidenceFreshness({
      identityVerdict: 'exact',
      manualLocked: false,
      hasIncomingSnapshot: true,
      existingVerifiedAt: '2026-08-06T12:00:00.000Z',
      incomingVerifiedAt: '2026-08-06T10:00:00.000Z',
    });
    expect(decision.apply).toBe(false);
    expect(decision.fallbackRule).toBe('incoming_blocked_stale');
  });

  it('atomically replaces admission snapshot for the same source', () => {
    const existing = [normalizeSourceTicketOffer({ name: 'Early Bird', priceAmount: 34.9 }, 0)];
    const incoming = buildAtomicAdmissionSnapshot({
      phases: [normalizeSourceTicketOffer({ name: 'Early Bird', priceAmount: 15 }, 0)],
      sourceKey: 'source-ticket-kings',
      verifiedAt: '2026-08-06T10:00:00.000Z',
    });
    const merged = replaceAdmissionSnapshotForSource({
      existingPhases: existing,
      existingSourceKey: 'source-ticket-kings',
      incoming,
      decision: {
        apply: true,
        reason: 'test',
        fallbackRule: 'incoming_newer_verified',
      },
    });
    expect(merged).toHaveLength(1);
    expect(merged?.[0]?.priceAmount).toBe(15);
  });
});

function normalizeUrl(url: string | undefined): string | undefined {
  return url?.replace(/\/$/, '');
}

describe('CTA vs checkout evidence selection', () => {
  it('prefers Ticket Kings public page over Nachtmanager embed for public CTA', () => {
    const snapshot = selectCanonicalTicket({
      purchaseCandidates: [
        { url: TICKET_KINGS_EVENT, field: 'metadata.publicCtaCandidateUrl' },
        { url: NACHT_MANAGER_CHECKOUT, field: 'metadata.checkoutEvidenceUrl' },
      ],
    });
    expect(normalizeUrl(snapshot.publicCtaUrl)).toBe(normalizeUrl(TICKET_KINGS_EVENT));
    expect(snapshot.checkoutEvidenceUrl).toBe(NACHT_MANAGER_CHECKOUT);
  });
});

describe('canonical ticket writer integration', () => {
  it('blocks MDMA when wrong Ticket.io URL has valid slug but CHROME page identity', () => {
    const existing = adminEvent();
    const candidate = baseCandidate({
      ticketUrl: CHROME_TICKET_IO,
      priceText: 'ab 34,90 €',
      ticketStatus: 'external_link',
      sourceMetadata: {
        pageTitle: 'CHROME COLOGNE',
        listRowTitle: 'CHROME COLOGNE',
        eventDate: '2026-10-10T20:00:00.000Z',
        venueName: 'Bootshaus',
        verifiedAt: '2026-08-06T10:00:00.000Z',
        ticketOffers: [{ name: 'Standard', priceAmount: 34.9, priceCurrency: 'EUR' }],
      },
    });

    const result = writeCanonicalTicketFields({ existing, candidate });
    expect(result.audit.identityVerdict).not.toBe('exact');
    expect(result.audit.identityVerdict).not.toBe('corroborated');
    expect(result.patch.ticketUrl).toBeUndefined();
    expect(result.patch.priceText).toBeUndefined();
    expect(result.patch.ticketPhases).toBeUndefined();
    expect(result.patch.ticketStatus).toBeUndefined();
    expect(result.audit.blockedCriticalFields.length).toBeGreaterThan(0);
  });

  it('blocks critical writes when only URL candidate exists without extracted page identity', () => {
    const existing = adminEvent();
    const candidate = baseCandidate({
      ticketUrl: CHROME_TICKET_IO,
      priceText: 'ab 34,90 €',
      sourceMetadata: {
        verifiedAt: '2026-08-06T10:00:00.000Z',
        ticketOffers: [{ name: 'Standard', priceAmount: 34.9, priceCurrency: 'EUR' }],
      },
    });

    const result = writeCanonicalTicketFields({ existing, candidate });
    expect(result.audit.identityVerdict).toBe('unverifiable');
    expect(result.patch.ticketUrl).toBeUndefined();
    expect(result.patch.priceText).toBeUndefined();
    expect(result.patch.ticketPhases).toBeUndefined();
    expect(result.patch.ticketStatus).toBeUndefined();
  });

  it('applies newer verified Ticket Kings admission snapshot atomically', () => {
    const existing = adminEvent({
      priceText: 'ab 34,90 €',
      ticketPhases: [
        normalizeSourceTicketOffer({ name: 'Standard', priceAmount: 34.9 }, 0),
      ],
    });
    const candidate = baseCandidate({
      ticketUrl: TICKET_KINGS_EVENT,
      sourceMetadata: {
        pageTitle: 'MDMA – Musik Die Mich Antreibt 10.10.26',
        eventDate: '2026-10-10T20:00:00.000Z',
        verifiedAt: '2026-08-06T12:00:00.000Z',
        publicCtaCandidateUrl: TICKET_KINGS_EVENT,
        checkoutEvidenceUrl: NACHT_MANAGER_CHECKOUT,
        ticketOffers: [{ name: 'Early Bird', priceAmount: 15, priceCurrency: 'EUR' }],
      },
    });

    const result = writeCanonicalTicketFields({ existing, candidate });
    expect(result.patch.priceText).toMatch(/15/);
    expect(result.patch.ticketPhases).toHaveLength(1);
    expect(normalizeUrl(result.patch.ticketUrl)).toBe(normalizeUrl(TICKET_KINGS_EVENT));
    expect(result.audit.checkoutEvidenceUrl).toBe(NACHT_MANAGER_CHECKOUT);
  });
});
