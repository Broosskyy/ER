import { describe, expect, it } from 'vitest';

import { rescoreArtifactInventory } from '../network-discovery/artifact-rescore';
import { classifyEventMediaAcceptability, isGenericTicketIoMarketingImage } from '../network-discovery/event-media-quality';
import { classifyDetailRelevance } from '../network-discovery/detail-relevance';
import { extractLineupFromTitle } from '../network-discovery/lineup-from-title';
import { classifyRelevanceEvidence } from '../network-discovery/relevance-evidence';
import {
  isEventSpecificSupplementalUrl,
  isGenericNonEventSupplementalUrl,
} from '../network-discovery/supplemental-authority';
import type { EnrichedTicketIoEvent } from '../network-discovery/detail-types';

function enriched(overrides: Partial<EnrichedTicketIoEvent>): EnrichedTicketIoEvent {
  return {
    identityKey: 'ticket_io:test:abc',
    ticketIoEventId: 'abc',
    shopId: 'test',
    shopSlug: 'test',
    listingUrl: 'https://test.ticket.io/',
    eventUrl: 'https://test.ticket.io/abc/',
    canonicalUrl: 'https://test.ticket.io/abc/',
    title: 'Techno Night',
    startsAt: '2026-12-01T20:00:00+01:00',
    lifecycle: 'UPCOMING',
    lineupHints: [],
    lineupQualification: 'NO_LINEUP',
    genreHints: [],
    genreCandidates: [],
    outboundLinks: [],
    verifiedOutbound: [],
    imageUrls: [],
    mediaRoles: [],
    products: [],
    ticketAvailability: 'AVAILABLE',
    ticketAction: 'PURCHASE',
    detailAccess: 'DETAIL_ACCESSIBLE',
    fetchMethod: 'fetch',
    evidenceTimestamp: '2026-09-10T12:00:00.000Z',
    relevance: 'HIGH_RELEVANCE',
    relevanceReasons: [],
    matchClassification: 'NET_NEW',
    matchReasons: [],
    qualification: 'IMPORT_CANDIDATE',
    descriptionQualification: 'PARTIAL_DESCRIPTION',
    fieldEvidence: [],
    ...overrides,
  };
}

describe('ticket.io first-batch correction', () => {
  it('does not treat festival alone as electronic high relevance', () => {
    const result = classifyRelevanceEvidence({
      title: 'Summer Festival',
      description: 'A community festival with food and culture.',
    });
    expect(result.relevance).not.toBe('HIGH_RELEVANCE');
  });

  it('does not treat open air alone as electronic high relevance', () => {
    const result = classifyRelevanceEvidence({
      title: 'Open Air in the Park',
      description: 'Family open air afternoon.',
    });
    expect(result.relevance).not.toBe('HIGH_RELEVANCE');
  });

  it('does not treat venue reputation alone as high relevance', () => {
    const result = classifyRelevanceEvidence({
      title: 'Special Guest Night',
      venueName: 'Bootshaus',
    });
    expect(result.relevance).not.toBe('HIGH_RELEVANCE');
  });

  it('downgrades HERZOG-style jazz/improvisation false positive', () => {
    const result = classifyDetailRelevance({
      title: 'HERZOG | MUCHE | NILLESEN – TON meets RYOSUKE KIYASU',
      description:
        'TON ist ein Trio für avancierte Improvisation an der Schnittstelle von Neuer Musik, experimentellen Spielweisen und freier Klangforschung. Mit Posaune, Kontrabass und Snare Drums.',
      venueName: 'JAKI',
      detailAccess: 'DETAIL_ACCESSIBLE',
    });
    expect(result.relevance).not.toBe('HIGH_RELEVANCE');
    expect(['AMBIGUOUS', 'IRRELEVANT']).toContain(result.relevance);
  });

  it('keeps real electronic festival relevant', () => {
    const result = classifyRelevanceEvidence({
      title: 'NIBIRII Festival',
      description: 'Hard techno and electronic festival with multiple stages.',
    });
    expect(result.relevance).toBe('HIGH_RELEVANCE');
  });

  it('does not falsely reject experimental electronic', () => {
    const result = classifyRelevanceEvidence({
      title: 'Live Electronic Improvisation',
      description: 'Experimental electronic improvisation night.',
    });
    expect(result.relevance).toBe('HIGH_RELEVANCE');
  });

  it('blocks flea market false positives even when title contains rave', () => {
    const result = classifyRelevanceEvidence({
      title: 'Vintage Flohmarkt',
      description: 'Community vintage market with sellers and brunch.',
      detailAccess: 'DETAIL_ACCESSIBLE',
    });
    expect(result.relevance).toBe('IRRELEVANT');
    expect(result.negativeHits).toContain('flea_market');
  });

  it('blocks flea market even when spurious house genre hint is present', () => {
    const result = classifyRelevanceEvidence({
      title: 'Vintage Flohmarkt',
      description: 'Flohmarkt mit DJs und House-Musik im Hintergrund.',
      genreHints: ['House'],
      detailAccess: 'DETAIL_ACCESSIBLE',
    });
    expect(result.relevance).toBe('IRRELEVANT');
  });

  it('blocks seller recruitment listings for markets', () => {
    const result = classifyRelevanceEvidence({
      title: 'Verkäufer werden beim Vintage Flohmarkt in Köln Ehrenfeld',
      description: 'Stell deinen Stand auf unserem Flohmarkt.',
      detailAccess: 'DETAIL_ACCESSIBLE',
    });
    expect(result.relevance).toBe('IRRELEVANT');
  });

  it('blocks songwriting workshop false positives', () => {
    const result = classifyRelevanceEvidence({
      title: 'SONG-WRITING SESSION',
      description: 'Bring your ideas and learn songwriting in a small group.',
      detailAccess: 'DETAIL_ACCESSIBLE',
    });
    expect(result.relevance).toBe('IRRELEVANT');
  });

  it('does not block legitimate techno market party when strong electronic evidence exists', () => {
    const result = classifyRelevanceEvidence({
      title: 'Techno Night Market',
      description: 'Hard techno all night with resident DJs on two floors.',
      detailAccess: 'DETAIL_ACCESSIBLE',
    });
    expect(result.relevance).toBe('HIGH_RELEVANCE');
  });

  it('extracts w/ lineup from title', () => {
    expect(extractLineupFromTitle('Simple Present w/ DCHM, Lara Fein, Ryan Elliott')).toEqual([
      'DCHM',
      'Lara Fein',
      'Ryan Elliott',
    ]);
    expect(extractLineupFromTitle('Aura at fi w/ SHDW all night long')).toEqual(['SHDW']);
    expect(extractLineupFromTitle('Phonovision w/ HiHat, PAU, Various Identities')).toEqual([
      'HiHat',
      'PAU',
      'Various Identities',
    ]);
  });

  it('rejects generic AGB supplemental pages', () => {
    expect(isGenericNonEventSupplementalUrl('https://bootshaus.tv/agb/')).toBe(true);
    expect(
      isEventSpecificSupplementalUrl('https://bootshaus.tv/events/chris-stussy/', {
        title: 'Chris Stussy',
        venueName: 'Bootshaus',
      }),
    ).toBe(true);
  });

  it('accepts Rausgegangen S3 event flyer URLs as event media', () => {
    const media = classifyEventMediaAcceptability(
      ['https://s3.eu-central-1.amazonaws.com/rausgegangen/ucjWJIqrQKmtTCJL3LBY_flyer-breit.jpg'],
      { title: 'Utopian Summer' },
    );
    expect(media.acceptability).toBe('ACCEPTABLE_EVENT_MEDIA');
  });

  it('rejects generic ticket.io marketing image as final event media', () => {
    expect(
      isGenericTicketIoMarketingImage('https://cdn.ticket.io/assets/checkout/giftPackages/MAGIC_MOMENT.jpg'),
    ).toBe(true);
    const media = classifyEventMediaAcceptability(
      ['https://cdn.ticket.io/assets/checkout/giftPackages/MAGIC_MOMENT.jpg'],
      { title: 'Techno Night' },
    );
    expect(media.acceptability).toBe('GENERIC_TICKET_IO_MARKETING');
  });

  it('rescoring inventory reports classification changes', () => {
    const events = [
      enriched({
        identityKey: 'ticket_io:stadtgarten:2qnfprx9',
        title: 'HERZOG | MUCHE | NILLESEN – TON meets RYOSUKE KIYASU',
        description:
          'TON ist ein Trio für avancierte Improvisation an der Schnittstelle von Neuer Musik, experimentellen Spielweisen und freier Klangforschung.',
        venueName: 'JAKI',
        relevance: 'HIGH_RELEVANCE',
      }),
      enriched({
        identityKey: 'ticket_io:gewoelbe:sasgsbzg',
        title: 'Simple Present w/ DCHM, Lara Fein, Ryan Elliott',
        description: 'House night at Gewölbe.',
        venueName: 'Gewölbe',
        relevance: 'HIGH_RELEVANCE',
      }),
    ];
    const { summary } = rescoreArtifactInventory(events);
    expect(summary.classificationChanges.length).toBeGreaterThan(0);
    expect(summary.classificationChanges[0]?.newRelevance).not.toBe('HIGH_RELEVANCE');
  });
});
