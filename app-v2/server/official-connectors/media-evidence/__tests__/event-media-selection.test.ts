import { describe, expect, it } from 'vitest';

import type { OfficialEventEvidence } from '../../types';
import type { VerifiedTicketCompleteResult } from '../../ticket-evidence/ticket-audit-metrics';
import { selectBestVerifiedEventMedia } from '../select-best-verified-event-media';
import { classifyEventMediaType } from '../classify-event-media-type';

function buildEvidence(overrides: Partial<OfficialEventEvidence> = {}): OfficialEventEvidence {
  return {
    connectorId: 'affenkaefig-official',
    sourceEventKey: 'underland-essigfabrik-05-09-2026',
    listUrl: 'https://affenkaefig.info/events/',
    officialUrl: 'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026/',
    fetchedAt: '2026-08-28T10:00:00.000Z',
    pageFingerprint: 'fp-1',
    title: 'Underland Essigfabrik 05.09.2026',
    startsAt: '2026-09-05T22:00:00+02:00',
    sourceTimezone: 'Europe/Berlin',
    venue: { name: 'Essigfabrik / Elektroküche', city: 'Köln', countryCode: 'DE' },
    officialImageUrl: 'https://affenkaefig.info/wp-content/uploads/official-flyer.jpg',
    lineupCandidates: [
      {
        displayName: 'UNDERLAND',
        rawText: 'UNDERLAND',
        billingOrder: 0,
        evidenceRole: 'headliner',
        evidenceOrigin: 'official_text',
      },
    ],
    explicitGenreLabels: [],
    enrichmentGaps: [],
    rejectedCandidates: [],
    evidenceAudit: {
      lineupBlocks: [],
      normalizedGenres: [],
      unmappedGenreLabels: [],
      mediaEvidence: {
        sourceImageUrl: 'https://affenkaefig.info/wp-content/uploads/official-flyer.jpg',
        imageFingerprint: 'official-fp',
        sourceObservedAt: '2026-08-28T10:00:00.000Z',
        extractedAt: '2026-08-28T10:00:00.000Z',
        extractionProvider: 'tesseract',
        mediaClassification: 'event_artwork_without_billing',
        ocrBlocks: [],
        ocrLines: [],
        lineupCandidates: [{ displayName: 'UNDERLAND', rawText: 'UNDERLAND', confidence: 80, evidenceRole: 'headliner' }],
        genreCandidates: [],
        rejectedCandidates: [],
        confidence: 70,
      },
    },
    ...overrides,
  };
}

function buildTicketResult(overrides: Partial<VerifiedTicketCompleteResult> = {}): VerifiedTicketCompleteResult {
  return {
    sourceEventKey: 'underland-essigfabrik-05-09-2026',
    identityResult: 'ticket_identity_verified',
    classification: 'verified_ticket_available',
    canonicalTicketUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
    providerKey: 'ticket_kings',
    providerEvidence: {
      providerKey: 'ticket_kings',
      providerIdentity: {
        providerKey: 'ticket_kings',
        providerEventId: 'underland-essigfabrik-05-09-2026',
        providerScope: 'ticketkings.de',
        identityKey: 'ticket_kings:ticketkings.de:underland-essigfabrik-05-09-2026',
      },
      sourceUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
      canonicalTicketUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
      sourceObservedAt: '2026-08-28T10:00:00.000Z',
      extractedAt: '2026-08-28T10:00:00.000Z',
      contentFingerprint: 'ticket-fp',
      event: {
        imageUrl: 'https://ticketkings.de/media/underland-lineup-flyer.jpg',
      },
      tickets: {
        providerKey: 'ticket_kings',
        providerIdentity: {
          providerKey: 'ticket_kings',
          providerEventId: 'underland-essigfabrik-05-09-2026',
          providerScope: 'ticketkings.de',
          identityKey: 'ticket_kings:ticketkings.de:underland-essigfabrik-05-09-2026',
        },
        sourceUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
        canonicalTicketUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
        sourceObservedAt: '2026-08-28T10:00:00.000Z',
        extractedAt: '2026-08-28T10:00:00.000Z',
        contentFingerprint: 'ticket-fp',
        eventIdentityEvidence: {},
        offers: [],
        normalizedStatus: 'available',
        statusLabel: 'Tickets verfügbar',
        rejectedOffers: [],
        confidence: 0.9,
      },
      confidence: 0.9,
      supplementalContent: {
        lineupCandidates: [
          { displayName: 'ARTIST A', rawText: 'ARTIST A' },
          { displayName: 'ARTIST B', rawText: 'ARTIST B' },
          { displayName: 'ARTIST C', rawText: 'ARTIST C' },
        ],
      },
    },
    ...overrides,
  } as VerifiedTicketCompleteResult;
}

describe('global event media selection', () => {
  it('prefers richer verified ticket provider media when lineup evidence is stronger', () => {
    const evidence = buildEvidence({
      lineupCandidates: [
        { displayName: 'ARTIST A', rawText: 'ARTIST A', billingOrder: 0, evidenceRole: 'headliner', evidenceOrigin: 'official_text' },
        { displayName: 'ARTIST B', rawText: 'ARTIST B', billingOrder: 1, evidenceRole: 'artist', evidenceOrigin: 'official_text' },
        { displayName: 'ARTIST C', rawText: 'ARTIST C', billingOrder: 2, evidenceRole: 'artist', evidenceOrigin: 'official_text' },
      ],
    });
    const selection = selectBestVerifiedEventMedia(evidence, buildTicketResult());
    expect(selection.selected?.sourceType).toBe('verified_ticket_provider');
    expect(selection.selected?.imageUrl).toContain('ticketkings.de');
  });

  it('retains official image when ticket identity is not auto-selectable', () => {
    const selection = selectBestVerifiedEventMedia(
      buildEvidence(),
      buildTicketResult({ identityResult: 'ticket_identity_unverifiable' }),
    );
    expect(selection.selected?.sourceType).toBe('primary_official');
  });

  it('rejects conflicting lineup flyer candidates', () => {
    const evidence = buildEvidence({
      lineupCandidates: [
        { displayName: 'ALPHA', rawText: 'ALPHA', billingOrder: 0, evidenceRole: 'headliner', evidenceOrigin: 'official_text' },
        { displayName: 'BETA', rawText: 'BETA', billingOrder: 1, evidenceRole: 'artist', evidenceOrigin: 'official_text' },
        { displayName: 'GAMMA', rawText: 'GAMMA', billingOrder: 2, evidenceRole: 'artist', evidenceOrigin: 'official_text' },
      ],
      evidenceAudit: {
        lineupBlocks: [],
        normalizedGenres: [],
        unmappedGenreLabels: [],
        mediaEvidence: {
          sourceImageUrl: 'https://affenkaefig.info/wp-content/uploads/conflict-flyer.jpg',
          imageFingerprint: 'conflict-fp',
          sourceObservedAt: '2026-08-28T10:00:00.000Z',
          extractedAt: '2026-08-28T10:00:00.000Z',
          extractionProvider: 'tesseract',
          mediaClassification: 'event_flyer',
          ocrBlocks: [],
          ocrLines: [],
          lineupCandidates: [
            { displayName: 'OTHER 1', rawText: 'OTHER 1', confidence: 80, evidenceRole: 'headliner' },
            { displayName: 'OTHER 2', rawText: 'OTHER 2', confidence: 80, evidenceRole: 'artist' },
            { displayName: 'OTHER 3', rawText: 'OTHER 3', confidence: 80, evidenceRole: 'artist' },
          ],
          genreCandidates: [],
          rejectedCandidates: [],
          confidence: 80,
        },
      },
    });

    const selection = selectBestVerifiedEventMedia(evidence, undefined);
    expect(selection.selected).toBeUndefined();
    expect(selection.rejectedCandidates.some((entry) => entry.reason === 'lineup_conflict_with_verified_evidence')).toBe(
      true,
    );
  });

  it('classifies unreadable ocr flyer urls as event flyers instead of decorative images', () => {
    expect(
      classifyEventMediaType({
        imageUrl: 'https://affenkaefig.info/wp-content/uploads/2026/04/23.10.26_WEB_EB_QUADA_AK_Bootshaus.jpg',
        sourceUrl: 'https://affenkaefig.info/event/affenkaefigrulesbootshaus-koeln-23-10-26/',
        mediaEvidence: {
          sourceImageUrl: 'https://affenkaefig.info/wp-content/uploads/2026/04/23.10.26_WEB_EB_QUADA_AK_Bootshaus.jpg',
          imageFingerprint: 'fp',
          sourceObservedAt: '2026-08-28T10:00:00.000Z',
          extractedAt: '2026-08-28T10:00:00.000Z',
          extractionProvider: 'tesseract',
          mediaClassification: 'unreadable',
          ocrBlocks: [],
          ocrLines: [],
          lineupCandidates: [],
          genreCandidates: [],
          rejectedCandidates: [],
          confidence: 34,
        },
      }),
    ).toBe('announcement_flyer');
  });

  it('prefers verified ticket lineup flyer over official early-bird announcement media', () => {
    const evidence = buildEvidence({
      officialImageUrl: 'https://affenkaefig.info/wp-content/uploads/2026/07/05.09.26_QUADA_EB_ULand_WEB2.jpg',
      evidenceAudit: {
        lineupBlocks: [],
        normalizedGenres: [],
        unmappedGenreLabels: [],
        mediaEvidence: {
          sourceImageUrl: 'https://affenkaefig.info/wp-content/uploads/2026/07/05.09.26_QUADA_EB_ULand_WEB2.jpg',
          imageFingerprint: 'underland-eb-fp',
          sourceObservedAt: '2026-08-28T10:00:00.000Z',
          extractedAt: '2026-08-28T10:00:00.000Z',
          extractionProvider: 'tesseract',
          mediaClassification: 'event_flyer',
          rawText: 'UNDERLAND 05.09.2026 EARLY BIRD',
          ocrBlocks: [],
          ocrLines: [],
          lineupCandidates: [{ displayName: 'UNDERLAND', rawText: 'UNDERLAND', confidence: 80, evidenceRole: 'headliner' }],
          genreCandidates: [],
          rejectedCandidates: [],
          confidence: 70,
        },
      },
    });
    const ticketResult = buildTicketResult({
      providerEvidence: {
        ...buildTicketResult().providerEvidence!,
        event: {
          imageUrl: 'https://ticketkings.de/wp-content/uploads/2026/04/original-20260522-134011-7db369482b94.jpg',
        },
        supplementalContent: {
          lineupCandidates: [
            { displayName: 'ACINA', rawText: 'ACINA' },
            { displayName: 'BASSSTØRM', rawText: 'BASSSTØRM' },
            { displayName: 'JEYPIEH', rawText: 'JEYPIEH' },
            { displayName: 'KULISCHKIN', rawText: 'KULISCHKIN' },
            { displayName: 'MILØ', rawText: 'MILØ' },
            { displayName: 'MIXXR', rawText: 'MIXXR' },
            { displayName: 'NIKKEL', rawText: 'NIKKEL' },
            { displayName: 'OPOSITION', rawText: 'OPOSITION' },
            { displayName: 'REFLEXX', rawText: 'REFLEXX' },
            { displayName: 'VERNEX', rawText: 'VERNEX' },
          ],
        },
      },
    });
    const selection = selectBestVerifiedEventMedia(evidence, ticketResult);
    expect(selection.selected?.sourceType).toBe('verified_ticket_provider');
    expect(selection.selected?.imageUrl).toContain('ticketkings.de');
  });

  it('rejects ticket placeholder images and prefers verified ticket media', () => {
    const evidence = buildEvidence({
      officialImageUrl: 'https://affenkaefig.info/wp-content/uploads/2026/08/Ticket-infos-soon.jpg',
      evidenceAudit: {
        lineupBlocks: [],
        normalizedGenres: [],
        unmappedGenreLabels: [],
        mediaEvidence: {
          sourceImageUrl: 'https://affenkaefig.info/wp-content/uploads/2026/08/Ticket-infos-soon.jpg',
          imageFingerprint: 'placeholder-fp',
          sourceObservedAt: '2026-08-28T10:00:00.000Z',
          extractedAt: '2026-08-28T10:00:00.000Z',
          extractionProvider: 'tesseract',
          mediaClassification: 'event_flyer',
          ocrBlocks: [],
          ocrLines: [],
          lineupCandidates: [
            { displayName: 'ARTIST A', rawText: 'ARTIST A', confidence: 80, evidenceRole: 'headliner' },
          ],
          genreCandidates: [],
          rejectedCandidates: [],
          confidence: 80,
        },
      },
    });
    const selection = selectBestVerifiedEventMedia(evidence, buildTicketResult());
    expect(selection.selected?.sourceType).toBe('verified_ticket_provider');
  });
});
