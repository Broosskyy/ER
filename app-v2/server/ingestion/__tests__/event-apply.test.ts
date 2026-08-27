import { describe, expect, it } from 'vitest';

import {
  assertOfficialEventApplyPlan,
  assertOfficialEventApplyPrecondition,
  buildOfficialEventApplySql,
  buildOfficialEventApplySummary,
  isOfficialEventApplyNoop,
  OfficialEventApplyError,
} from '../planning/event-apply';
import type { EventCandidate, EventWritePlan } from '../types/event-candidate';

function buildCandidate(overrides: Partial<EventCandidate> = {}): EventCandidate {
  return {
    origin: {
      kind: 'official_connector',
      connectorId: 'bootshaus-official',
      sourceEventKey: 'sample-event',
      officialUrl: 'https://bootshaus.tv/events/sample-event/',
      pageFingerprint: 'fingerprint-1',
      fetchedAt: '2026-08-14T12:00:00.000Z',
      enrichmentGaps: [],
    },
    title: 'Sample Event',
    startsAt: '2026-08-21T22:00:00+02:00',
    endsAt: '2026-08-22T05:00:00+02:00',
    timezone: 'Europe/Berlin',
    organizerName: 'BOOTSHAUS',
    description: 'Sample description',
    imageUrl: 'https://bootshaus.tv/image.png',
    venue: {
      name: 'Bootshaus',
      addressLine: 'Auenweg 173',
      postalCode: '51063',
      city: 'Köln',
      countryCode: 'DE',
    },
    lineup: [
      { billingName: 'HEADLINER', billingRole: 'headliner', sortOrder: 0 },
      { billingName: 'SUPPORT ACT', billingRole: 'artist', sortOrder: 1 },
    ],
    genres: [{ genreKey: 'techno', displayName: 'Techno', sortOrder: 0 }],
    tickets: [],
    ...overrides,
  };
}

function buildPlan(overrides: Partial<EventWritePlan> = {}): EventWritePlan {
  const candidate = overrides.candidate ?? buildCandidate();
  return {
    sourceIdentity: {
      sourceRole: 'official',
      sourceUrl: 'https://bootshaus.tv/events/sample-event/',
      sourceEventKey: 'sample-event',
      contentHash: 'fingerprint-1',
      fetchedAt: '2026-08-14T12:00:00.000Z',
    },
    validation: { decision: 'persist_ready', reasons: [] },
    eventAction: 'insert',
    venueAction: 'insert',
    lineupAction: 'replace',
    genresAction: 'replace',
    ticketsAction: 'noop',
    sourceAction: 'insert',
    candidate,
    sourcePayload: { connectorId: 'bootshaus-official' },
    reasons: ['new_official_source'],
    expectedRowCounts: {
      venuesInserted: 1,
      venuesReused: 0,
      eventsInserted: 1,
      eventsUpdated: 0,
      lineupInserted: 2,
      genresInserted: 1,
      ticketsInserted: 0,
      sourcesInserted: 1,
      sourcesUpdated: 0,
    },
    ...overrides,
  };
}

const ids = {
  eventId: '11111111-1111-4111-8111-111111111111',
  sourceId: '22222222-2222-4222-8222-222222222222',
  venueId: '33333333-3333-4333-8333-333333333333',
};

describe('official event apply executor', () => {
  it('plans insert writes for a persist-ready official plan', () => {
    const summary = buildOfficialEventApplySummary(buildPlan(), ids);

    expect(summary.touchesTickets).toBe(false);
    expect(summary.statements.map((statement) => statement.kind)).toEqual([
      'venue_insert',
      'event_insert',
      'lineup_delete',
      'lineup_insert',
      'lineup_insert',
      'genre_delete',
      'genre_insert',
      'source_insert',
    ]);
    expect(summary.databaseRowsInserted).toBeGreaterThan(0);
  });

  it('plans update writes only for changed official fields', () => {
    const summary = buildOfficialEventApplySummary(
      buildPlan({
        eventAction: 'update',
        venueAction: 'reuse',
        lineupAction: 'noop',
        genresAction: 'noop',
        sourceAction: 'update',
        existingSource: {
          sourceId: ids.sourceId,
          eventId: ids.eventId,
          sourceUrl: 'https://bootshaus.tv/events/sample-event/',
          contentHash: 'fingerprint-old',
        },
        existingVenueId: ids.venueId,
      }),
      ids,
    );

    expect(summary.statements.map((statement) => statement.kind)).toEqual(['event_update', 'source_update']);
    expect(summary.databaseRowsUpdated).toBe(2);
    expect(summary.databaseRowsDeleted).toBe(0);
  });

  it('treats idempotent plans as noop without database writes', () => {
    const plan = buildPlan({
      eventAction: 'noop',
      venueAction: 'reuse',
      lineupAction: 'noop',
      genresAction: 'noop',
      sourceAction: 'noop',
      existingSource: {
        sourceId: ids.sourceId,
        eventId: ids.eventId,
        sourceUrl: 'https://bootshaus.tv/events/sample-event/',
        contentHash: 'fingerprint-1',
      },
      existingVenueId: ids.venueId,
    });

    expect(isOfficialEventApplyNoop(plan)).toBe(true);
    expect(buildOfficialEventApplySummary(plan, ids).statements).toEqual([]);
    expect(buildOfficialEventApplySql(plan, ids, {})).toBe('BEGIN; COMMIT;');
  });

  it('does not delete lineup rows when lineupAction is noop', () => {
    const sql = buildOfficialEventApplySql(
      buildPlan({
        lineupAction: 'noop',
        genresAction: 'noop',
        eventAction: 'update',
        venueAction: 'reuse',
        sourceAction: 'update',
        existingSource: {
          sourceId: ids.sourceId,
          eventId: ids.eventId,
          sourceUrl: 'https://bootshaus.tv/events/sample-event/',
          contentHash: 'fingerprint-old',
        },
        existingVenueId: ids.venueId,
      }),
      ids,
      { description: 'Sample description', sourceContentHash: 'fingerprint-old' },
    );

    expect(sql).not.toContain('event_lineup');
    expect(sql).not.toContain('event_genres');
  });

  it('rejects lineup replace with an empty target lineup', () => {
    expect(() =>
      buildOfficialEventApplySummary(
        buildPlan({
          candidate: buildCandidate({ lineup: [] }),
          lineupAction: 'replace',
        }),
        ids,
      ),
    ).toThrow(OfficialEventApplyError);
  });

  it('rejects genre replace with an empty target genre list', () => {
    expect(() =>
      buildOfficialEventApplySummary(
        buildPlan({
          candidate: buildCandidate({ genres: [] }),
          genresAction: 'replace',
        }),
        ids,
      ),
    ).toThrow(OfficialEventApplyError);
  });

  it('never touches ticket tables or ticket actions', () => {
    expect(() =>
      assertOfficialEventApplyPlan(
        buildPlan({
          ticketsAction: 'replace',
        }),
      ),
    ).toThrow(OfficialEventApplyError);

    const sql = buildOfficialEventApplySql(buildPlan(), ids, {});
    expect(sql).not.toContain('event_tickets');
    expect(sql.toLowerCase()).not.toContain('ticket');
  });

  it('fails closed when preconditions do not match', () => {
    const plan = buildPlan({
      eventAction: 'update',
      venueAction: 'reuse',
      lineupAction: 'noop',
      genresAction: 'noop',
      sourceAction: 'update',
      existingSource: {
        sourceId: ids.sourceId,
        eventId: ids.eventId,
        sourceUrl: 'https://bootshaus.tv/events/sample-event/',
        contentHash: 'fingerprint-old',
      },
      existingVenueId: ids.venueId,
    });

    expect(() =>
      assertOfficialEventApplyPrecondition(plan, {
        description: 'stale description',
        sourceContentHash: 'fingerprint-new',
      }),
    ).toThrow(OfficialEventApplyError);

    const sql = buildOfficialEventApplySql(plan, ids, {
      description: 'Sample description',
      sourceContentHash: 'fingerprint-old',
    });
    expect(sql).toContain('official_event_apply_description_guard_failed');
    expect(sql).toContain('official_event_apply_source_guard_failed');
  });
});
