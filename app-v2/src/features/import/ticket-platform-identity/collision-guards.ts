import {
  buildTicketPlatformCompositeIdentity,
  findCompositeIdentityCollisions,
} from './composite-identity';
import { evaluatePublicIdentityMatch } from './identity-match';
import type { EventIdentitySnapshot, PublicIdentityEvidence } from './types';

export interface EnrichmentCollisionGuardResult {
  blocked: boolean;
  reason: string;
  compositeKey?: string;
  collisionEventIds?: string[];
}

export function assertEnrichmentNotBlockedByCollision(input: {
  targetEvent: EventIdentitySnapshot;
  catalog: EventIdentitySnapshot[];
  publicEvidence?: Pick<
    PublicIdentityEvidence,
    'pageTitle' | 'listRowTitle' | 'eventDate' | 'venueName'
  >;
}): EnrichmentCollisionGuardResult {
  const identity = buildTicketPlatformCompositeIdentity(input.targetEvent.ticketUrl);
  if (!identity) {
    return { blocked: true, reason: 'no_composite_identity' };
  }

  const collisions = findCompositeIdentityCollisions(input.catalog);
  const collision = collisions.find((entry) => entry.compositeKey === identity.compositeKey);
  if (!collision) {
    return { blocked: false, reason: 'no_collision', compositeKey: identity.compositeKey };
  }

  if (collision.eventIds.length === 1) {
    return { blocked: false, reason: 'sole_owner', compositeKey: identity.compositeKey };
  }

  if (input.publicEvidence) {
    const identityMatch = evaluatePublicIdentityMatch(input.targetEvent, input.publicEvidence);
    const competing = input.catalog.filter(
      (event) =>
        collision.eventIds.includes(event.eventId) &&
        event.eventId !== input.targetEvent.eventId,
    );
    const allCompetitorsMismatch = competing.every((event) => {
      const result = evaluatePublicIdentityMatch(event, input.publicEvidence!);
      return result.match === 'mismatch';
    });
    if (identityMatch.match === 'exact' && allCompetitorsMismatch) {
      return {
        blocked: false,
        reason: 'sole_public_identity_match',
        compositeKey: identity.compositeKey,
        collisionEventIds: collision.eventIds,
      };
    }
  }

  return {
    blocked: true,
    reason: 'composite_identity_collision',
    compositeKey: identity.compositeKey,
    collisionEventIds: collision.eventIds,
  };
}

export function websiteCtaDoesNotProveExistingAssociation(input: {
  event: EventIdentitySnapshot;
  officialCtaUrl?: string;
  existingTicketUrl?: string;
}): boolean {
  if (!input.officialCtaUrl || !input.existingTicketUrl) {
    return true;
  }
  const ctaIdentity = buildTicketPlatformCompositeIdentity(input.officialCtaUrl);
  const existingIdentity = buildTicketPlatformCompositeIdentity(input.existingTicketUrl);
  if (!ctaIdentity || !existingIdentity) {
    return true;
  }
  return ctaIdentity.compositeKey !== existingIdentity.compositeKey;
}
