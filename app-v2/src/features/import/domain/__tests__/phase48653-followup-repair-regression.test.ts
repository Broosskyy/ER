import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { toEventTicketSectionViewModel } from '@/features/event-detail/utils/event-detail-view-model';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import { evaluateTicketEvidenceFreshness } from '@/features/import/domain/ticket-evidence-freshness-merge';
import { buildSourceReferenceTicketEvidenceMetadata } from '@/features/import/domain/ticket-evidence-provenance';
import { resolveDescriptionGenrePublish } from '@/features/import/domain/description-genre-publish-resolver';
import { buildImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';
import { evaluateLineupPublishGate } from '@/features/import/domain/lineup-publish-gate';
import { buildPublishPreview } from '@/features/import/publish/unified-website-controlled-publish/downgrade-prevention';
import type { UnifiedImportResult } from '@/features/import/contracts';

function ticketCandidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'ext-1',
    sourceId: 'source-ticket-io',
    sourceName: 'Ticket.io',
    title: 'PLAY! Open Air – Mallorca',
    startDate: '2026-08-01T14:00:00+02:00',
    venueName: 'Beach Club Mallorca',
    cityName: 'Palma',
    ticketUrl: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
    priceText: 'ab 15,00 €',
    rawSourceType: 'html',
    sourceMetadata: {
      pageTitle: 'PLAY! Open Air – Mallorca',
      listRowTitle: 'PLAY! Open Air – Mallorca',
      eventDate: '2026-08-01T14:00:00+02:00',
      venueName: 'Beach Club Mallorca',
      verifiedAt: '2026-01-01T00:00:00.000Z',
      soldOut: false,
      ...((overrides.sourceMetadata as object | undefined) ?? {}),
    },
    ...overrides,
  };
}

function existingEvent(): AdminEventRecord {
  return {
    id: 'evt-1',
    title: 'PLAY! Open Air – Mallorca',
    description: 'Existing',
    startDate: '2026-08-01T14:00:00+02:00',
    venueName: 'Beach Club Mallorca',
    venueCity: 'Palma',
    ticketUrl: 'https://bootshaus-club.ticket.io/old/',
    ticketStatus: 'external_link',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('phase 48653 follow-up repair regressions', () => {
  it('blocks critical ticket fields when pageTitle/listRowTitle evidence is missing', () => {
    const candidate = ticketCandidate({
      sourceMetadata: {
        soldOut: false,
      },
    });
    const write = writeCanonicalTicketFields({
      existing: existingEvent(),
      candidate,
      fillOnly: false,
    });
    expect(write.audit.blockedCriticalFields.length).toBeGreaterThan(0);
    expect(write.patch.ticketUrl).toBeUndefined();
  });

  it('allows ticket write when connector evidence is complete', () => {
    const write = writeCanonicalTicketFields({
      existing: existingEvent(),
      candidate: ticketCandidate(),
      fillOnly: false,
    });
    expect(write.audit.blockedCriticalFields).toEqual([]);
    expect(write.patch.ticketUrl).toContain('gPHSUV3l');
  });

  it('does not treat missing verifiedAt as freshly verified', () => {
    const freshness = evaluateTicketEvidenceFreshness({
      existingVerifiedAt: undefined,
      incomingVerifiedAt: undefined,
      incomingObservedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(freshness.apply).toBe(false);
  });

  it('does not apply ticketStatus fallback when identity gate blocks the writer', () => {
    const patch = buildImportPublishFieldPatch(
      ticketCandidate({
        sourceMetadata: { soldOut: true },
      }),
      { existing: existingEvent(), fillOnly: false },
    );
    expect(patch.ticketStatus).toBe('external_link');
  });

  it('does not promote ticket-platform description over official description', () => {
    const result = resolveDescriptionGenrePublish({
      event: {
        eventId: 'evt-mdma',
        title: 'MDMA – Musik Die Mich Antreibt 10.10.26',
        startDate: '2026-10-10T20:00:00.000Z',
      },
      officialDescription: 'Official organizer copy',
      ticketPlatformDescription: 'CHROME COLOGNE night',
      ticketEvidence: {
        pageTitle: 'CHROME COLOGNE',
        eventDate: '2026-10-10T20:00:00.000Z',
      },
    });
    expect(result.description).toBe('Official organizer copy');
  });

  it('blocks lineup proposal when publish gate rejects extraction', () => {
    const gate = evaluateLineupPublishGate({
      event: {
        eventId: 'evt-1',
        title: 'Different Event',
        startDate: '2026-08-01T14:00:00+02:00',
        venueName: 'Elsewhere',
      },
      contentBlocks: ['Lineup', 'Artist A'],
      pageEvidence: {
        pageTitle: 'Wrong Page',
        eventDate: '2027-01-01T00:00:00.000Z',
      },
    });
    expect(gate.allowed).toBe(false);

    const unified = {
      fieldEvidenceCandidates: [
        {
          eventIdentityMatch: 'evt-1',
          fieldName: 'title',
          normalizedValue: 'Wrong Page',
          reviewState: 'pending',
        },
      ],
      relationshipCandidates: [],
      sourceIdentity: { sourceRoles: ['official_website_source'] },
      lineupEvidenceEntries: [{ displayName: 'Artist A', confidence: 0.9 }],
      extractionDiagnostics: [],
    } as unknown as UnifiedImportResult;

    const proposals = buildPublishPreview({
      event: existingEvent(),
      unified,
      sourceId: 'source-bootshaus',
      provenanceByField: {},
    });
    const lineupProposal = proposals.find((p) => p.field === 'lineup');
    expect(lineupProposal?.decision).toBe('rejected_review_required');
  });

  it('keeps provenance evidence metadata instead of discarding it', () => {
    const metadata = buildSourceReferenceTicketEvidenceMetadata(
      {
        blockedCriticalFields: [],
        appliedFields: ['ticketUrl'],
        rejectedFields: [],
        checkoutEvidenceUrl: 'https://nacht-manager.de/ticketing/native_event.php?id=24',
        publicCtaCandidateUrl: 'https://ticketkings.de/event/sample/',
        identityVerdict: 'exact',
        identityReason: 'title_date_venue_compatible',
        freshnessFallbackRule: 'incoming_newer_verified',
        diagnostics: [],
      },
      '2026-01-01T00:00:00.000Z',
    );
    expect(metadata.publicCtaCandidateUrl).toBe('https://ticketkings.de/event/sample/');
    expect(metadata.checkoutEvidenceUrl).toBe(
      'https://nacht-manager.de/ticketing/native_event.php?id=24',
    );
  });

  it('maps admission snapshot into consumer ticket section view model', () => {
    const event = {
      id: 'evt-1',
      title: 'PLAY! Open Air – Mallorca',
      ticketUrl: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
      priceText: 'ab 15,00 €',
      ticketPhases: [
        {
          id: 'early',
          name: 'Early Bird',
          sortOrder: 0,
          kind: 'early_bird',
          priceAmount: 15,
          priceLabel: '15,00 €',
        },
      ],
      ticketAvailability: 'external_link',
      genres: [],
      venue: 'Beach Club Mallorca',
      city: 'Palma',
      startDateTime: '2026-08-01T14:00:00+02:00',
    } as EventDisplayModel;

    const vm = toEventTicketSectionViewModel(event);
    expect(vm.ticketTypes.length).toBeGreaterThan(0);
    expect(vm.ticketTypes[0]?.priceLabel ?? vm.summary?.priceLabel).toMatch(/15/);
    expect(vm.ctaLabel).toBeTruthy();
  });
});
