import { describe, expect, it } from 'vitest';

import { findSlugCollisions } from '@/features/import/ticket-io-enrichment-linkage';
import {
  PHASE48621_COLLISION_HOST,
  PHASE48621_COLLISION_SLUG,
  PHASE48621_R3HAB_EVENT_ID,
  PHASE48621_UNDERLAND_EVENT_ID,
  assertEnrichmentNotBlockedByCollision,
  buildTicketPlatformCompositeIdentity,
  evaluatePublicIdentityMatch,
  findCompositeIdentityCollisions,
  findSlugOnlyCollisionsAcrossHosts,
  sameTitleDifferentDate,
  websiteCtaDoesNotProveExistingAssociation,
} from '@/features/import/ticket-platform-identity';

const R3HAB_URL = `https://${PHASE48621_COLLISION_HOST}/${PHASE48621_COLLISION_SLUG}/`;
const UNDERLAND_TICKET_KINGS = 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/';

describe('phase48621 composite ticket-platform identity', () => {
  it('builds host + slug composite identity for ticket.io', () => {
    const identity = buildTicketPlatformCompositeIdentity(R3HAB_URL);
    expect(identity).toEqual({
      platform: 'ticket_io',
      host: PHASE48621_COLLISION_HOST,
      externalId: PHASE48621_COLLISION_SLUG,
      normalizedUrl: R3HAB_URL,
      compositeKey: `ticket_io:${PHASE48621_COLLISION_HOST}:${PHASE48621_COLLISION_SLUG}`,
    });
  });

  it('does not treat slug alone as sufficient across hosts', () => {
    const sameSlugOtherHost = `https://other-shop.ticket.io/${PHASE48621_COLLISION_SLUG}/`;
    const left = buildTicketPlatformCompositeIdentity(R3HAB_URL);
    const right = buildTicketPlatformCompositeIdentity(sameSlugOtherHost);
    expect(left?.compositeKey).not.toBe(right?.compositeKey);
    const compositeCollisions = findCompositeIdentityCollisions([
      {
        eventId: 'evt-a',
        title: 'Event A',
        ticketUrl: R3HAB_URL,
      },
      {
        eventId: 'evt-b',
        title: 'Event B',
        ticketUrl: sameSlugOtherHost,
      },
    ]);
    expect(compositeCollisions).toHaveLength(0);
    const crossHost = findSlugOnlyCollisionsAcrossHosts([
      {
        eventId: 'evt-a',
        title: 'Event A',
        ticketUrl: R3HAB_URL,
      },
      {
        eventId: 'evt-b',
        title: 'Event B',
        ticketUrl: sameSlugOtherHost,
      },
    ]);
    expect(crossHost).toHaveLength(1);
    expect(crossHost[0]?.slug).toBe(PHASE48621_COLLISION_SLUG);
  });

  it('detects same composite identity on unrelated events', () => {
    const collisions = findCompositeIdentityCollisions([
      {
        eventId: PHASE48621_R3HAB_EVENT_ID,
        title: 'R3HAB pres. by BOOTSHAUS',
        startDate: '2026-09-04T22:00:00+02:00',
        ticketUrl: R3HAB_URL,
      },
      {
        eventId: PHASE48621_UNDERLAND_EVENT_ID,
        title: 'Underland Essigfabrik 05.09.2026',
        startDate: '2026-09-05T00:00:00+02:00',
        ticketUrl: R3HAB_URL,
      },
    ]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.eventIds).toEqual([
      PHASE48621_R3HAB_EVENT_ID,
      PHASE48621_UNDERLAND_EVENT_ID,
    ]);
  });

  it('blocks enrichment while composite collision remains unresolved', () => {
    const catalog = [
      {
        eventId: PHASE48621_R3HAB_EVENT_ID,
        title: 'R3HAB pres. by BOOTSHAUS',
        startDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
        ticketUrl: R3HAB_URL,
      },
      {
        eventId: PHASE48621_UNDERLAND_EVENT_ID,
        title: 'Underland Essigfabrik 05.09.2026',
        startDate: '2026-09-05T00:00:00+02:00',
        venueName: 'Essigfabrik',
        ticketUrl: R3HAB_URL,
      },
    ];
    const blocked = assertEnrichmentNotBlockedByCollision({
      targetEvent: catalog[0]!,
      catalog,
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.reason).toBe('composite_identity_collision');
  });

  it('allows enrichment when public identity matches only the target event', () => {
    const catalog = [
      {
        eventId: PHASE48621_R3HAB_EVENT_ID,
        title: 'R3HAB pres. by BOOTSHAUS',
        startDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
        ticketUrl: R3HAB_URL,
      },
      {
        eventId: PHASE48621_UNDERLAND_EVENT_ID,
        title: 'Underland Essigfabrik 05.09.2026',
        startDate: '2026-09-05T00:00:00+02:00',
        venueName: 'Essigfabrik',
        ticketUrl: R3HAB_URL,
      },
    ];
    const allowed = assertEnrichmentNotBlockedByCollision({
      targetEvent: catalog[0]!,
      catalog,
      publicEvidence: {
        listRowTitle: 'R3HAB pres. by BOOTSHAUS',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
    });
    expect(allowed.blocked).toBe(false);
    expect(allowed.reason).toBe('sole_public_identity_match');
  });

  it('validates official website CTA does not prove stale association', () => {
    expect(
      websiteCtaDoesNotProveExistingAssociation({
        event: {
          eventId: PHASE48621_UNDERLAND_EVENT_ID,
          title: 'Underland Essigfabrik 05.09.2026',
        },
        officialCtaUrl: UNDERLAND_TICKET_KINGS,
        existingTicketUrl: R3HAB_URL,
      }),
    ).toBe(true);
  });

  it('separates same-title events on different dates', () => {
    expect(
      sameTitleDifferentDate(
        { eventId: 'a', title: 'AREA51 TECHNO', startDate: '2026-08-01T22:00:00+02:00' },
        { eventId: 'b', title: 'AREA51 TECHNO', startDate: '2026-09-01T22:00:00+02:00' },
      ),
    ).toBe(true);
  });

  it('matches R3HAB public list identity', () => {
    const result = evaluatePublicIdentityMatch(
      {
        eventId: PHASE48621_R3HAB_EVENT_ID,
        title: 'R3HAB pres. by BOOTSHAUS',
        startDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
      {
        listRowTitle: 'R3HAB pres. by BOOTSHAUS',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
    );
    expect(result.match).toBe('exact');
  });

  it('rejects Underland against R3HAB list identity', () => {
    const result = evaluatePublicIdentityMatch(
      {
        eventId: PHASE48621_UNDERLAND_EVENT_ID,
        title: 'Underland Essigfabrik 05.09.2026',
        startDate: '2026-09-05T00:00:00+02:00',
        venueName: 'Essigfabrik',
      },
      {
        listRowTitle: 'R3HAB pres. by BOOTSHAUS',
        eventDate: '2026-09-04T22:00:00+02:00',
        venueName: 'Bootshaus',
      },
    );
    expect(result.match).toBe('mismatch');
  });

  it('keeps slug collision map keyed by slug for ticket.io enrichment linkage', () => {
    const collisions = findSlugCollisions([
      { id: PHASE48621_R3HAB_EVENT_ID, ticketUrl: R3HAB_URL },
      { id: PHASE48621_UNDERLAND_EVENT_ID, ticketUrl: R3HAB_URL },
    ]);
    expect(collisions.get(PHASE48621_COLLISION_SLUG)).toEqual([
      PHASE48621_R3HAB_EVENT_ID,
      PHASE48621_UNDERLAND_EVENT_ID,
    ]);
  });
});
