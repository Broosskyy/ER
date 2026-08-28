import type {
  EventCandidate,
  EventWritePlan,
  EventWritePlanRowCounts,
  ExistingOfficialSourceRecord,
  ExistingVenueRecord,
  OfficialSourceIdentity,
  WriteAction,
} from '../types/event-candidate';
import { buildVenueIdentityKey, canonicalizeOfficialSourceUrl } from '../identity/source-identity';
import {
  eventWriteActionFromReconciliation,
  genresWriteActionFromReconciliation,
  lineupWriteActionFromReconciliation,
  reconcileOfficialEvent,
  sourceWriteActionFromReconciliation,
  type ExistingEventConsumerState,
} from '../reconciliation/reconciliation-policy';
import { isOcrFlyerNoiseLine } from '../../official-connectors/shared/lineup-normalization';
import { validateEventCandidate } from '../validation/validate-event-candidate';
import type { EventMatchCatalogEntry } from '../identity/event-match-types';
import { catalogEntryFromCandidate } from '../identity/event-matcher';
import { resolveEventIdentity } from '../identity/resolve-event-identity';

export type { ExistingEventConsumerState };
export type { EventMatchCatalogEntry };

export interface PlannerContext {
  existingSources: ExistingOfficialSourceRecord[];
  existingVenues: ExistingVenueRecord[];
  existingEvents?: ExistingEventConsumerState[];
  eventCatalog?: EventMatchCatalogEntry[];
  pendingVenueKeys?: Set<string>;
  sourceUnavailable?: boolean;
}

function emptyRowCounts(): EventWritePlanRowCounts {
  return {
    venuesInserted: 0,
    venuesReused: 0,
    eventsInserted: 0,
    eventsUpdated: 0,
    lineupInserted: 0,
    genresInserted: 0,
    ticketsInserted: 0,
    sourcesInserted: 0,
    sourcesUpdated: 0,
  };
}

export function buildOfficialSourcePayload(candidate: EventCandidate): Record<string, unknown> {
  if (candidate.origin.kind !== 'official_connector') {
    throw new Error('official_source_payload_requires_official_origin');
  }

  return {
    connectorId: candidate.origin.connectorId,
    sourceEventKey: candidate.origin.sourceEventKey,
    officialUrl: candidate.origin.officialUrl,
    fingerprint: candidate.origin.pageFingerprint,
    fetchedAt: candidate.origin.fetchedAt,
    title: candidate.title,
    startsAt: candidate.startsAt,
    endsAt: candidate.endsAt ?? null,
    organizerLabel: candidate.organizerName ?? null,
    descriptionClean: candidate.description ?? null,
    officialImageUrl: candidate.imageUrl ?? null,
    enrichmentGaps: candidate.origin.enrichmentGaps,
    lineupCount: candidate.lineup.length,
    genreCount: candidate.genres.length,
  };
}

function resolveSourceIdentity(candidate: EventCandidate): OfficialSourceIdentity {
  if (candidate.origin.kind !== 'official_connector') {
    throw new Error('official_write_plan_requires_official_origin');
  }

  return {
    sourceRole: 'official',
    sourceUrl: canonicalizeOfficialSourceUrl(candidate.origin.officialUrl),
    sourceEventKey: candidate.origin.sourceEventKey,
    contentHash: candidate.origin.pageFingerprint,
    fetchedAt: candidate.origin.fetchedAt,
  };
}

function findExistingVenue(
  candidate: EventCandidate,
  context: PlannerContext,
): ExistingVenueRecord | undefined {
  if (!candidate.venue) {
    return undefined;
  }

  const venueKey = buildVenueIdentityKey(candidate.venue);
  return context.existingVenues.find(
    (venue) =>
      buildVenueIdentityKey({
        name: venue.name,
        city: venue.city ?? undefined,
        postalCode: venue.postalCode ?? undefined,
      }) === venueKey,
  );
}

function resolveVenueAction(
  candidate: EventCandidate,
  context: PlannerContext,
): { action: WriteAction; existingVenueId?: string } {
  const existingVenue = findExistingVenue(candidate, context);
  if (existingVenue) {
    return { action: 'reuse', existingVenueId: existingVenue.id };
  }

  if (!candidate.venue) {
    return { action: 'noop' };
  }

  const venueKey = buildVenueIdentityKey(candidate.venue);
  if (context.pendingVenueKeys?.has(venueKey)) {
    return { action: 'reuse' };
  }

  return { action: 'insert' };
}

function buildExpectedRowCounts(
  eventAction: WriteAction,
  venueAction: WriteAction,
  lineupAction: WriteAction,
  genresAction: WriteAction,
  ticketsAction: WriteAction,
  sourceAction: WriteAction,
  candidate: EventCandidate,
): EventWritePlanRowCounts {
  const counts = emptyRowCounts();

  if (venueAction === 'insert') {
    counts.venuesInserted = 1;
  }
  if (venueAction === 'reuse') {
    counts.venuesReused = 1;
  }
  if (eventAction === 'insert') {
    counts.eventsInserted = 1;
  }
  if (eventAction === 'update') {
    counts.eventsUpdated = 1;
  }
  if (lineupAction === 'replace') {
    counts.lineupInserted = candidate.lineup.length;
  }
  if (genresAction === 'replace') {
    counts.genresInserted = candidate.genres.length;
  }
  if (ticketsAction === 'replace') {
    counts.ticketsInserted = candidate.tickets.length;
  }
  if (sourceAction === 'insert') {
    counts.sourcesInserted = 1;
  }
  if (sourceAction === 'update') {
    counts.sourcesUpdated = 1;
  }

  return counts;
}

function findExistingEvent(
  eventId: string | undefined,
  context: PlannerContext,
): ExistingEventConsumerState | undefined {
  if (!eventId) {
    return undefined;
  }
  return context.existingEvents?.find((event) => event.eventId === eventId);
}

export function planOfficialEventWrite(
  candidate: EventCandidate,
  context: PlannerContext,
): EventWritePlan {
  const validation = validateEventCandidate(candidate);
  const sourceIdentity = resolveSourceIdentity(candidate);
  const sourcePayload = buildOfficialSourcePayload(candidate);
  const incomingCandidate = candidate;

  const identity = resolveEventIdentity({
    candidate,
    catalog: context.eventCatalog ?? [],
    existingSources: context.existingSources,
  });

  const existingSource = context.existingSources.find(
    (source) => canonicalizeOfficialSourceUrl(source.sourceUrl) === sourceIdentity.sourceUrl,
  );

  const resolvedEventId =
    existingSource?.eventId ??
    (identity.autoBindAllowed ? identity.candidateEventId : undefined);

  const venueResolution = resolveVenueAction(candidate, context);

  const sameFingerprint = existingSource
    ? existingSource.contentHash === sourceIdentity.contentHash
    : false;
  const existingEvent = findExistingEvent(resolvedEventId, context);
  const hasUrlBinding = Boolean(existingSource);
  const hasCanonicalEvent = Boolean(resolvedEventId);

  const reconciliation = reconcileOfficialEvent({
    candidate,
    existingEvent,
    hasExistingSource: hasCanonicalEvent,
    fingerprintChanged: hasUrlBinding ? !sameFingerprint : hasCanonicalEvent,
    sourceUnavailable: context.sourceUnavailable,
    validationDecision: validation.decision,
  });

  const reconciledCandidate = reconciliation.reconciledCandidate;
  const lineupDecision = reconciliation.fieldDecisions.find((entry) => entry.field === 'lineup');
  const genresDecision = reconciliation.fieldDecisions.find((entry) => entry.field === 'genres');

  let eventAction: WriteAction = !hasCanonicalEvent ? 'insert' : 'update';
  let sourceAction: WriteAction = hasUrlBinding
    ? sourceWriteActionFromReconciliation(
        !sameFingerprint,
        reconciliation.classification,
        reconciliation.fieldDecisions,
      )
    : hasCanonicalEvent
      ? 'insert'
      : 'insert';

  if (!hasCanonicalEvent) {
    eventAction = 'insert';
    sourceAction = 'insert';
  } else if (hasCanonicalEvent && !hasUrlBinding && identity.autoBindAllowed) {
    eventAction = eventWriteActionFromReconciliation(
      reconciliation.fieldDecisions,
      reconciliation.classification !== 'unchanged',
    );
    sourceAction = 'insert';
  } else if (hasUrlBinding) {
    eventAction = eventWriteActionFromReconciliation(reconciliation.fieldDecisions, !sameFingerprint);
  }

  let lineupAction: WriteAction = hasCanonicalEvent
    ? lineupWriteActionFromReconciliation(lineupDecision, reconciledCandidate.lineup.length)
    : reconciledCandidate.lineup.length > 0
      ? 'replace'
      : 'noop';
  let genresAction: WriteAction = hasCanonicalEvent
    ? genresWriteActionFromReconciliation(genresDecision, reconciledCandidate.genres.length)
    : reconciledCandidate.genres.length > 0
      ? 'replace'
      : 'noop';
  const ticketsAction: WriteAction = 'noop';
  const reasons: string[] = [...reconciliation.reasons, `identity:${identity.decision}`];

  if (identity.decision === 'review_required' || identity.decision === 'possible_match') {
    if (!hasUrlBinding) {
      eventAction = 'insert';
      sourceAction = 'insert';
      reasons.push('identity_review_required_separate_event');
    }
  }

  if (context.sourceUnavailable) {
    eventAction = 'noop';
    sourceAction = 'noop';
    lineupAction = 'noop';
    genresAction = 'noop';
    reasons.push('source_unavailable_no_consumer_writes');
  }

  if (reconciliation.reviewRequired) {
    reasons.push('reconciliation_review_required');
  }

  if (hasUrlBinding && sameFingerprint && !reconciliation.reviewRequired) {
    const existingImage = existingEvent?.imageUrl?.trim();
    const candidateImage = reconciledCandidate.imageUrl?.trim();
    const imageFieldChanged = Boolean(existingImage && candidateImage && existingImage !== candidateImage);
    const hasAcceptedSupplementalChange =
      imageFieldChanged ||
      reconciliation.fieldDecisions.some(
        (decision) =>
          decision.decision === 'accept' &&
          ['description', 'lineup', 'title', 'startsAt', 'endsAt', 'organizer', 'image'].includes(decision.field),
      );
    if (!hasAcceptedSupplementalChange) {
      eventAction = 'noop';
      sourceAction = 'noop';
      lineupAction = 'noop';
      genresAction = 'noop';
      reasons.push('official_source_fingerprint_unchanged_noop');
    } else {
      eventAction = eventWriteActionFromReconciliation(reconciliation.fieldDecisions, false, true);
      sourceAction = 'noop';
      lineupAction = lineupWriteActionFromReconciliation(lineupDecision, reconciledCandidate.lineup.length);
      genresAction = genresWriteActionFromReconciliation(genresDecision, reconciledCandidate.genres.length);
      reasons.push('supplemental_reconciliation_with_unchanged_fingerprint');
    }
  } else if (hasUrlBinding && sameFingerprint && eventAction === 'update') {
    eventAction = eventWriteActionFromReconciliation(reconciliation.fieldDecisions, false);
  }

  if (venueResolution.action === 'reuse') {
    reasons.push(hasCanonicalEvent ? 'venue_already_bound' : 'venue_reuse_or_pending');
  } else if (venueResolution.action === 'insert') {
    reasons.push('venue_insert');
  }

  return {
    sourceIdentity,
    validation,
    eventAction,
    venueAction: venueResolution.action,
    lineupAction,
    genresAction,
    ticketsAction,
    sourceAction,
    candidate: reconciledCandidate,
    incomingCandidate,
    sourcePayload,
    existingSource,
    existingVenueId: venueResolution.existingVenueId ?? existingEvent?.venueId ?? undefined,
    resolvedEventId,
    identity,
    reasons,
    reconciliation,
    expectedRowCounts: buildExpectedRowCounts(
      eventAction,
      venueResolution.action,
      lineupAction,
      genresAction,
      ticketsAction,
      sourceAction,
      reconciledCandidate,
    ),
  };
}

export function planOfficialEventWrites(
  candidates: EventCandidate[],
  context: PlannerContext,
): EventWritePlan[] {
  const pendingVenueKeys = new Set(context.pendingVenueKeys ?? []);
  const catalog = [...(context.eventCatalog ?? [])];
  const plans: EventWritePlan[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const plan = planOfficialEventWrite(candidate, {
      ...context,
      pendingVenueKeys,
      eventCatalog: catalog,
    });
    plans.push(plan);

    if (plan.venueAction === 'insert' && candidate.venue) {
      pendingVenueKeys.add(buildVenueIdentityKey(candidate.venue));
    }

    if (plan.eventAction === 'insert') {
      catalog.push(catalogEntryFromCandidate(candidate, `pending-event-${index + 1}`));
    } else if (plan.resolvedEventId) {
      const existingIndex = catalog.findIndex((entry) => entry.eventId === plan.resolvedEventId);
      if (existingIndex === -1) {
        catalog.push(catalogEntryFromCandidate(candidate, plan.resolvedEventId));
      }
    }
  }

  return plans;
}

export function isPlanIdempotent(plan: EventWritePlan): boolean {
  return (
    plan.eventAction === 'noop' &&
    plan.sourceAction === 'noop' &&
    plan.lineupAction === 'noop' &&
    plan.genresAction === 'noop' &&
    plan.ticketsAction === 'noop'
  );
}
