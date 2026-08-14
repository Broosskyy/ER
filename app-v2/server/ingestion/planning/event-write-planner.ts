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
import { validateEventCandidate } from '../validation/validate-event-candidate';

export interface PlannerContext {
  existingSources: ExistingOfficialSourceRecord[];
  existingVenues: ExistingVenueRecord[];
  pendingVenueKeys?: Set<string>;
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

export function planOfficialEventWrite(
  candidate: EventCandidate,
  context: PlannerContext,
): EventWritePlan {
  const validation = validateEventCandidate(candidate);
  const sourceIdentity = resolveSourceIdentity(candidate);
  const sourcePayload = buildOfficialSourcePayload(candidate);
  const existingSource = context.existingSources.find(
    (source) => canonicalizeOfficialSourceUrl(source.sourceUrl) === sourceIdentity.sourceUrl,
  );
  const venueResolution = resolveVenueAction(candidate, context);

  let eventAction: WriteAction = 'insert';
  let sourceAction: WriteAction = 'insert';
  let lineupAction: WriteAction = candidate.lineup.length > 0 ? 'replace' : 'noop';
  const genresAction: WriteAction = candidate.genres.length > 0 ? 'replace' : 'noop';
  const ticketsAction: WriteAction = 'noop';
  const reasons: string[] = [];

  if (existingSource) {
    const sameFingerprint = existingSource.contentHash === sourceIdentity.contentHash;
    eventAction = sameFingerprint ? 'noop' : 'update';
    sourceAction = sameFingerprint ? 'noop' : 'update';
    lineupAction = sameFingerprint ? 'noop' : candidate.lineup.length > 0 ? 'replace' : 'noop';
    reasons.push(sameFingerprint ? 'existing_official_source_unchanged' : 'existing_official_source_changed');
  } else {
    reasons.push('new_official_source');
  }

  if (venueResolution.action === 'reuse') {
    reasons.push(existingSource ? 'venue_already_bound' : 'venue_reuse_or_pending');
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
    candidate,
    sourcePayload,
    existingSource,
    existingVenueId: venueResolution.existingVenueId,
    reasons,
    expectedRowCounts: buildExpectedRowCounts(
      eventAction,
      venueResolution.action,
      lineupAction,
      genresAction,
      ticketsAction,
      sourceAction,
      candidate,
    ),
  };
}

export function planOfficialEventWrites(
  candidates: EventCandidate[],
  context: PlannerContext,
): EventWritePlan[] {
  const pendingVenueKeys = new Set(context.pendingVenueKeys ?? []);
  const plans: EventWritePlan[] = [];

  for (const candidate of candidates) {
    const plan = planOfficialEventWrite(candidate, {
      ...context,
      pendingVenueKeys,
    });
    plans.push(plan);

    if (plan.venueAction === 'insert' && candidate.venue) {
      pendingVenueKeys.add(buildVenueIdentityKey(candidate.venue));
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
