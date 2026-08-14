import { describe, expect, it } from 'vitest';

import type { OfficialEventEvidence } from '../../official-connectors/types';
import { officialEvidenceToEventCandidate } from '../adapters/official-evidence-adapter';
import {
  isPlanIdempotent,
  planOfficialEventWrite,
  planOfficialEventWrites,
} from '../planning/event-write-planner';
import type { AdminManualOrigin, SubmissionOrigin } from '../types/event-candidate';
import { validateEventCandidate } from '../validation/validate-event-candidate';

function buildLoonylandEvidence(): OfficialEventEvidence {
  return {
    connectorId: 'bootshaus-official',
    sourceEventKey: 'loonyland-pres-luca-dante-spadafora-2-engel-charlie',
    listUrl: 'https://bootshaus.tv/events/',
    officialUrl: 'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie/',
    fetchedAt: '2026-08-14T12:00:00.000Z',
    pageFingerprint: 'loonyland-fingerprint',
    title: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
    startsAt: '2026-08-21T22:00:00+02:00',
    endsAt: '2026-08-22T05:00:00+02:00',
    sourceTimezone: 'Europe/Berlin',
    venue: {
      name: 'Bootshaus',
      address: 'Auenweg 173',
      postalCode: '51063',
      city: 'Köln',
      countryCode: 'DE',
    },
    organizerLabel: 'BOOTSHAUS',
    descriptionClean: 'Loonyland night.',
    officialImageUrl:
      'https://s3.eu-central-1.amazonaws.com/cdn.pixend.de/CQYDNRZ9Q8QSS8D/events/6291070957076770600802974_2481970712023930093702944.png',
    linkedTicketUrl: 'https://bootshaus-club.ticket.io/loonyland/',
    lineupCandidates: [
      {
        displayName: 'LUCA DANTE SPADAFORA',
        rawText: 'LUCA DANTE SPADAFORA',
        billingOrder: 0,
        evidenceRole: 'headliner',
        evidenceOrigin: 'official_text',
      },
      {
        displayName: '2 ENGEL & CHARLIE',
        rawText: '2 ENGEL & CHARLIE',
        billingOrder: 1,
        evidenceRole: 'compound_act',
        evidenceOrigin: 'official_text',
      },
      {
        displayName: 'OLIVER MAGENTA',
        rawText: 'OLIVER MAGENTA',
        billingOrder: 2,
        evidenceRole: 'artist',
        evidenceOrigin: 'official_text',
      },
      {
        displayName: 'DJ OLDE',
        rawText: 'DJ OLDE',
        billingOrder: 3,
        evidenceRole: 'artist',
        evidenceOrigin: 'official_text',
      },
      {
        displayName: 'JEY AUX PLATINES',
        rawText: 'JEY AUX PLATINES',
        billingOrder: 4,
        evidenceRole: 'artist',
        evidenceOrigin: 'official_text',
      },
    ],
    explicitGenreLabels: [],
    enrichmentGaps: ['genres_missing'],
    rejectedCandidates: [],
  };
}

function buildChrisEvidence(): OfficialEventEvidence {
  return {
    connectorId: 'bootshaus-official',
    sourceEventKey: '16-10-26-chris-stussy-pres-by-bootshaus',
    listUrl: 'https://bootshaus.tv/events/',
    officialUrl: 'https://bootshaus.tv/events/16-10-26-chris-stussy-pres-by-bootshaus/',
    fetchedAt: '2026-08-14T12:00:00.000Z',
    pageFingerprint: 'chris-fingerprint',
    title: 'CHRIS STUSSY pres. by BOOTSHAUS',
    startsAt: '2026-10-16T22:00:00+02:00',
    endsAt: '2026-10-17T05:00:00+02:00',
    sourceTimezone: 'Europe/Berlin',
    venue: {
      name: 'Bootshaus',
      address: 'Auenweg 173',
      postalCode: '51063',
      city: 'Köln',
      countryCode: 'DE',
    },
    lineupCandidates: [
      {
        displayName: 'CHRIS STUSSY',
        rawText: 'CHRIS STUSSY',
        billingOrder: 0,
        evidenceRole: 'headliner',
        evidenceOrigin: 'official_text',
      },
    ],
    explicitGenreLabels: [],
    enrichmentGaps: ['genres_missing'],
    rejectedCandidates: [],
  };
}

function buildAffenkaefigEvidence(): OfficialEventEvidence {
  return {
    connectorId: 'bootshaus-official',
    sourceEventKey: 'affenkaefig-rules-bootshaus-koeln',
    listUrl: 'https://bootshaus.tv/events/',
    officialUrl: 'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln/',
    fetchedAt: '2026-08-14T12:00:00.000Z',
    pageFingerprint: 'affenkaefig-fingerprint',
    title: 'AFFENKÄFIG RULES // BOOTSHAUS KÖLN',
    startsAt: '2026-10-23T23:00:00+02:00',
    endsAt: '2026-10-24T07:00:00+02:00',
    sourceTimezone: 'Europe/Berlin',
    venue: {
      name: 'Bootshaus',
      address: 'Auenweg 173',
      postalCode: '51063',
      city: 'Köln',
      countryCode: 'DE',
    },
    descriptionClean: 'Affenkäfig rules night.',
    officialImageUrl:
      'https://s3.eu-central-1.amazonaws.com/cdn.pixend.de/CQYDNRZ9Q8QSS8D/events/8581948328378297824282182_6383504060263551298271971.jpeg',
    lineupCandidates: [],
    explicitGenreLabels: [],
    enrichmentGaps: ['lineup_not_announced', 'genres_missing'],
    rejectedCandidates: [],
  };
}

describe('official evidence adapter', () => {
  it('maps official evidence to a shared EventCandidate', () => {
    const candidate = officialEvidenceToEventCandidate(buildLoonylandEvidence());

    expect(candidate.origin.kind).toBe('official_connector');
    expect(candidate.lineup).toHaveLength(5);
    expect(candidate.lineup[1]?.billingName).toBe('2 ENGEL & CHARLIE');
    expect(candidate.genres).toEqual([]);
    expect(candidate.tickets).toEqual([]);
    expect(candidate.imageUrl).toMatch(/^https:\/\//);
  });

  it('does not create ticket rows from linked ticket URLs', () => {
    const candidate = officialEvidenceToEventCandidate(buildLoonylandEvidence());
    expect(candidate.tickets).toEqual([]);
  });

  it('keeps affenkaefig lineup empty without invented artists', () => {
    const candidate = officialEvidenceToEventCandidate(buildAffenkaefigEvidence());
    expect(candidate.lineup).toEqual([]);
    if (candidate.origin.kind === 'official_connector') {
      expect(candidate.origin.enrichmentGaps).toContain('lineup_not_announced');
    }
  });
});

describe('future origin contracts', () => {
  it('allows admin manual origin on the same candidate shape', () => {
    const origin: AdminManualOrigin = { kind: 'admin_manual', createdByUserId: 'user-1' };
    const candidate = officialEvidenceToEventCandidate(buildChrisEvidence());
    candidate.origin = origin;

    expect(candidate.origin.kind).toBe('admin_manual');
    expect(validateEventCandidate(candidate).decision).toBe('persist_ready');
  });

  it('types submission roles for future intake', () => {
    const origin: SubmissionOrigin = { kind: 'submission', role: 'organizer', submissionId: 'sub-1' };
    const candidate = officialEvidenceToEventCandidate(buildChrisEvidence());
    candidate.origin = origin;

    expect(origin.role).toBe('organizer');
  });
});

describe('event candidate validation', () => {
  it('marks valid official candidates as persist_ready', () => {
    const candidate = officialEvidenceToEventCandidate(buildLoonylandEvidence());
    expect(validateEventCandidate(candidate)).toEqual({ decision: 'persist_ready', reasons: [] });
  });
});

describe('event write planner', () => {
  it('plans inserts for three reference candidates with one venue insert', () => {
    const candidates = [
      officialEvidenceToEventCandidate(buildLoonylandEvidence()),
      officialEvidenceToEventCandidate(buildChrisEvidence()),
      officialEvidenceToEventCandidate(buildAffenkaefigEvidence()),
    ];
    const plans = planOfficialEventWrites(candidates, { existingSources: [], existingVenues: [] });

    expect(plans).toHaveLength(3);
    expect(plans.filter((plan) => plan.venueAction === 'insert')).toHaveLength(1);
    expect(plans.filter((plan) => plan.venueAction === 'reuse')).toHaveLength(2);
    expect(plans.reduce((sum, plan) => sum + plan.expectedRowCounts.lineupInserted, 0)).toBe(6);
    expect(plans.reduce((sum, plan) => sum + plan.expectedRowCounts.genresInserted, 0)).toBe(0);
    expect(plans.reduce((sum, plan) => sum + plan.expectedRowCounts.ticketsInserted, 0)).toBe(0);
    expect(plans.reduce((sum, plan) => sum + plan.expectedRowCounts.sourcesInserted, 0)).toBe(3);
  });

  it('reuses an existing venue by identity key', () => {
    const candidate = officialEvidenceToEventCandidate(buildChrisEvidence());
    const plan = planOfficialEventWrite(candidate, {
      existingSources: [],
      existingVenues: [
        { id: 'venue-bootshaus', name: 'Bootshaus', city: 'Köln', postalCode: '51063' },
      ],
    });

    expect(plan.venueAction).toBe('reuse');
    expect(plan.existingVenueId).toBe('venue-bootshaus');
  });

  it('returns noop plans for unchanged official sources', () => {
    const candidate = officialEvidenceToEventCandidate(buildChrisEvidence());
    const plan = planOfficialEventWrite(candidate, {
      existingSources: [
        {
          sourceId: 'source-1',
          eventId: 'event-1',
          sourceUrl: 'https://bootshaus.tv/events/16-10-26-chris-stussy-pres-by-bootshaus/',
          contentHash: 'chris-fingerprint',
        },
      ],
      existingVenues: [],
    });

    expect(plan.eventAction).toBe('noop');
    expect(plan.sourceAction).toBe('noop');
    expect(isPlanIdempotent(plan)).toBe(true);
  });
});
