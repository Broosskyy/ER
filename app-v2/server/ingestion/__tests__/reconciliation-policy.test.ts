import { describe, expect, it } from 'vitest';

import { officialEvidenceToEventCandidate } from '../adapters/official-evidence-adapter';
import { isPlanIdempotent, planOfficialEventWrite } from '../planning/event-write-planner';
import type { EventCandidate, EventCandidateGenre, EventCandidateLineupAct } from '../types/event-candidate';
import type { ExistingEventConsumerState } from '../reconciliation/reconciliation-policy';
import { reconcileOfficialEvent } from '../reconciliation/reconciliation-policy';
import type { OfficialEventEvidence } from '../../official-connectors/types';

function buildOrigin(overrides: Partial<OfficialEventEvidence> = {}): OfficialEventEvidence {
  return {
    connectorId: 'bootshaus-official',
    sourceEventKey: 'sample-event',
    listUrl: 'https://bootshaus.tv/events/',
    officialUrl: 'https://bootshaus.tv/events/sample-event/',
    fetchedAt: '2026-08-14T12:00:00.000Z',
    pageFingerprint: 'fingerprint-new',
    title: 'Sample Event',
    startsAt: '2027-08-21T22:00:00+02:00',
    endsAt: '2027-08-22T05:00:00+02:00',
    sourceTimezone: 'Europe/Berlin',
    venue: {
      name: 'Bootshaus',
      address: 'Auenweg 173',
      postalCode: '51063',
      city: 'Köln',
      countryCode: 'DE',
    },
    lineupCandidates: [],
    explicitGenreLabels: [],
    enrichmentGaps: [],
    rejectedCandidates: [],
    ...overrides,
  };
}

function buildExistingEvent(overrides: Partial<ExistingEventConsumerState> = {}): ExistingEventConsumerState {
  return {
    eventId: 'event-1',
    title: 'Sample Event',
    description: 'A'.repeat(4000),
    startsAt: '2027-08-21T22:00:00+02:00',
    endsAt: '2027-08-22T05:00:00+02:00',
    timezone: 'Europe/Berlin',
    organizerName: 'BOOTSHAUS',
    imageUrl: 'https://bootshaus.tv/image.png',
    venueId: 'venue-1',
    status: 'published',
    lineup: Array.from({ length: 12 }, (_, index) => ({
      billingName: `ACT ${index + 1}`,
      billingRole: index === 0 ? 'headliner' : 'artist',
      sortOrder: index,
    })) as EventCandidateLineupAct[],
    genres: Array.from({ length: 6 }, (_, index) => ({
      genreKey: `genre-${index}`,
      displayName: `Genre ${index}`,
      sortOrder: index,
    })) as EventCandidateGenre[],
    ...overrides,
  };
}

function planWithExisting(candidate: EventCandidate, existing: ExistingEventConsumerState, fingerprint = 'fingerprint-old') {
  return planOfficialEventWrite(candidate, {
    existingSources: [
      {
        sourceId: 'source-1',
        eventId: existing.eventId,
        sourceUrl: 'https://bootshaus.tv/events/sample-event/',
        contentHash: fingerprint,
      },
    ],
    existingVenues: [{ id: 'venue-1', name: 'Bootshaus', city: 'Köln', postalCode: '51063' }],
    existingEvents: [existing],
  });
}

describe('official event reconciliation policy', () => {
  it('A: empty degraded fetch preserves verified consumer fields', () => {
    const existing = buildExistingEvent();
    const evidence = buildOrigin({
      pageFingerprint: 'fingerprint-empty',
      descriptionClean: undefined,
      lineupCandidates: [],
      explicitGenreLabels: [],
      enrichmentGaps: ['lineup_not_announced', 'genres_missing'],
      officialImageUrl: undefined,
    });
    const candidate = officialEvidenceToEventCandidate(evidence);
    const plan = planWithExisting(candidate, existing);

    expect(plan.reconciliation?.classification).toBe('parse_degraded');
    expect(plan.sourceAction).toBe('noop');
    expect(plan.lineupAction).toBe('noop');
    expect(plan.genresAction).toBe('noop');
    expect(plan.candidate.description).toBe(existing.description);
    expect(plan.candidate.lineup).toHaveLength(12);
    expect(plan.candidate.genres).toHaveLength(6);
    expect(plan.candidate.imageUrl).toBe(existing.imageUrl);
  });

  it('B: partial lineup parse does not replace a larger verified lineup without strong evidence', () => {
    const existing = buildExistingEvent();
    const evidence = buildOrigin({
      pageFingerprint: 'fingerprint-partial-lineup',
      enrichmentGaps: ['lineup_not_announced'],
      lineupCandidates: [
        { displayName: 'ACT 1', rawText: 'ACT 1', billingOrder: 0, evidenceRole: 'headliner', evidenceOrigin: 'official_text' },
        { displayName: 'ACT 2', rawText: 'ACT 2', billingOrder: 1, evidenceRole: 'artist', evidenceOrigin: 'official_text' },
        { displayName: 'ACT 3', rawText: 'ACT 3', billingOrder: 2, evidenceRole: 'artist', evidenceOrigin: 'official_text' },
      ],
    });
    const plan = planWithExisting(officialEvidenceToEventCandidate(evidence), existing);

    expect(plan.lineupAction).toBe('noop');
    expect(plan.candidate.lineup).toHaveLength(12);
    expect(plan.reconciliation?.destructiveUpdatesBlocked).toBeGreaterThan(0);
  });

  it('C: missing genres preserve existing verified genres', () => {
    const existing = buildExistingEvent();
    const evidence = buildOrigin({
      pageFingerprint: 'fingerprint-no-genres',
      explicitGenreLabels: [],
      enrichmentGaps: ['genres_missing'],
    });
    const plan = planWithExisting(officialEvidenceToEventCandidate(evidence), existing);

    expect(plan.genresAction).toBe('noop');
    expect(plan.candidate.genres).toHaveLength(6);
  });

  it('D: short boilerplate description does not overwrite a long verified description', () => {
    const existing = buildExistingEvent();
    const evidence = buildOrigin({
      pageFingerprint: 'fingerprint-boilerplate',
      descriptionClean: 'Bootshaus Mobile App newsletter cookie follow us snash.com',
      enrichmentGaps: [],
    });
    const plan = planWithExisting(officialEvidenceToEventCandidate(evidence), existing);

    expect(plan.candidate.description).toBe(existing.description);
    expect(plan.reconciliation?.fieldDecisions.find((entry) => entry.field === 'description')?.decision).not.toBe(
      'accept',
    );
  });

  it('E: source unavailable produces zero consumer writes', () => {
    const existing = buildExistingEvent();
    const candidate = officialEvidenceToEventCandidate(
      buildOrigin({ pageFingerprint: 'fingerprint-unavailable', title: 'Changed Title' }),
    );
    const plan = planOfficialEventWrite(candidate, {
      existingSources: [
        {
          sourceId: 'source-1',
          eventId: existing.eventId,
          sourceUrl: 'https://bootshaus.tv/events/sample-event/',
          contentHash: 'fingerprint-old',
        },
      ],
      existingVenues: [{ id: 'venue-1', name: 'Bootshaus', city: 'Köln', postalCode: '51063' }],
      existingEvents: [existing],
      sourceUnavailable: true,
    });

    expect(plan.reconciliation?.classification).toBe('source_unavailable');
    expect(plan.eventAction).toBe('noop');
    expect(plan.lineupAction).toBe('noop');
    expect(plan.genresAction).toBe('noop');
    expect(plan.sourceAction).toBe('noop');
    expect(plan.candidate.title).toBe(existing.title);
  });

  it('F: strong evidence allows legitimate full lineup replacement', () => {
    const existing = buildExistingEvent();
    const replacement = Array.from({ length: 8 }, (_, index) => ({
      displayName: `NEW ACT ${index + 1}`,
      rawText: `NEW ACT ${index + 1}`,
      billingOrder: index,
      evidenceRole: index === 0 ? ('headliner' as const) : ('artist' as const),
      evidenceOrigin: 'official_text' as const,
    }));
    const evidence = buildOrigin({
      pageFingerprint: 'fingerprint-full-replace',
      enrichmentGaps: [],
      lineupCandidates: replacement,
    });
    const plan = planWithExisting(officialEvidenceToEventCandidate(evidence), existing);

    expect(plan.lineupAction).toBe('replace');
    expect(plan.candidate.lineup).toHaveLength(8);
    expect(plan.candidate.lineup[0]?.billingName).toBe('NEW ACT 1');
  });

  it('allows lineup expansion with safe update classification', () => {
    const existing = buildExistingEvent({
      lineup: [{ billingName: 'ACT 1', billingRole: 'headliner', sortOrder: 0 }],
    });
    const evidence = buildOrigin({
      pageFingerprint: 'fingerprint-expand',
      lineupCandidates: [
        { displayName: 'ACT 1', rawText: 'ACT 1', billingOrder: 0, evidenceRole: 'headliner', evidenceOrigin: 'official_text' },
        { displayName: 'ACT 2', rawText: 'ACT 2', billingOrder: 1, evidenceRole: 'artist', evidenceOrigin: 'official_text' },
      ],
    });
    const plan = planWithExisting(officialEvidenceToEventCandidate(evidence), existing);
    expect(plan.lineupAction).toBe('replace');
    expect(plan.candidate.lineup).toHaveLength(2);
  });

  it('treats equivalent instants with different timezone representations as unchanged', () => {
    const existing = buildExistingEvent({
      startsAt: '2026-10-10T20:00:00.000Z',
      endsAt: '2026-10-11T04:00:00.000Z',
    });
    const evidence = buildOrigin({
      pageFingerprint: 'fingerprint-changed-only',
      startsAt: '2026-10-10T22:00:00+02:00',
      endsAt: '2026-10-11T06:00:00+02:00',
      descriptionClean: existing.description ?? undefined,
      lineupCandidates: existing.lineup.map((act, index) => ({
        displayName: act.billingName,
        rawText: act.billingName,
        billingOrder: index,
        evidenceRole: act.billingRole,
        evidenceOrigin: 'official_text' as const,
      })),
      explicitGenreLabels: existing.genres.map((genre) => genre.displayName),
    });
    const plan = planWithExisting(officialEvidenceToEventCandidate(evidence), existing, 'fingerprint-db');
    expect(isPlanIdempotent(plan)).toBe(true);
    expect(plan.reconciliation?.classification).toBe('parse_degraded');
    expect(
      plan.reconciliation?.fieldDecisions.filter(
        (decision) => decision.field === 'startsAt' || decision.field === 'endsAt',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ decision: 'noop', reason: 'same_instant_different_representation' }),
      ]),
    );
  });

  it('remains idempotent on a second identical reconciliation run', () => {
    const existing = buildExistingEvent({ description: 'Stable description' });
    const evidence = buildOrigin({
      pageFingerprint: 'fingerprint-stable',
      descriptionClean: 'Stable description',
      lineupCandidates: existing.lineup.map((act, index) => ({
        displayName: act.billingName,
        rawText: act.billingName,
        billingOrder: index,
        evidenceRole: act.billingRole,
        evidenceOrigin: 'official_text' as const,
      })),
      explicitGenreLabels: existing.genres.map((genre) => genre.displayName),
    });
    const first = planWithExisting(officialEvidenceToEventCandidate(evidence), existing, 'fingerprint-stable');
    expect(isPlanIdempotent(first)).toBe(true);

    const second = planWithExisting(officialEvidenceToEventCandidate(evidence), existing, 'fingerprint-stable');
    expect(isPlanIdempotent(second)).toBe(true);
    expect(second.reconciliation?.classification).toBe('unchanged');
  });

  it('records field provenance for reconciliation decisions', () => {
    const existing = buildExistingEvent();
    const summary = reconcileOfficialEvent({
      candidate: officialEvidenceToEventCandidate(buildOrigin({ pageFingerprint: 'fp-2', descriptionClean: undefined })),
      existingEvent: existing,
      hasExistingSource: true,
      fingerprintChanged: true,
      validationDecision: 'persist_ready',
    });

    expect(summary.fieldProvenance.length).toBeGreaterThan(0);
    expect(summary.fieldProvenance.some((entry) => entry.field === 'description')).toBe(true);
  });
});
