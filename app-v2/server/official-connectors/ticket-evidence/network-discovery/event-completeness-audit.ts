import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { loadStagingEventSnapshots } from '../../../ingestion/sync/canonical-consolidation';
import { auditDescriptionCoverage } from './description-coverage-audit';
import { auditGenreCoverage } from './genre-coverage-audit';
import { auditLineupCoverage } from './lineup-coverage-audit';
import { auditTicketCoverage } from './ticket-coverage-audit';
import { isLineupPlaceholderLine } from '../../shared/lineup-normalization';

export type FieldCompletenessState =
  | 'VERIFIED_COMPLETE'
  | 'VERIFIED_PARTIAL'
  | 'RECOVERABLE'
  | 'UNRESOLVED_NO_EVIDENCE'
  | 'CONFLICT_REVIEW'
  | 'INVALID'
  | 'STALE';

export type EventReadinessState = 'DISCOVERY_READY' | 'PARTIAL' | 'REVIEW_REQUIRED' | 'BLOCKED';

export interface EventFieldCompleteness {
  state: FieldCompletenessState;
  value?: string | null;
  reason?: string;
}

export interface EventCompletenessEntry {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  venue: string | null;
  city: string | null;
  organizer: string | null;
  fields: {
    title: EventFieldCompleteness;
    startsAt: EventFieldCompleteness;
    endsAt: EventFieldCompleteness;
    venue: EventFieldCompleteness;
    city: EventFieldCompleteness;
    organizer: EventFieldCompleteness;
    description: EventFieldCompleteness;
    lineup: EventFieldCompleteness;
    genres: EventFieldCompleteness;
    media: EventFieldCompleteness;
    ticketUrl: EventFieldCompleteness;
    ticketPrice: EventFieldCompleteness;
    ticketStatus: EventFieldCompleteness;
    sourceBindings: EventFieldCompleteness;
  };
  readiness: EventReadinessState;
  sourceBindings: Array<{ role: string; url: string; connectorId: string | null }>;
}

function readinessFromFields(fields: EventCompletenessEntry['fields']): EventReadinessState {
  const blocked =
    fields.title.state === 'INVALID' ||
    fields.startsAt.state === 'INVALID' ||
    fields.venue.state === 'INVALID';
  if (blocked) {
    return 'BLOCKED';
  }
  const review =
    fields.genres.state === 'CONFLICT_REVIEW' ||
    fields.lineup.state === 'CONFLICT_REVIEW' ||
    fields.description.state === 'CONFLICT_REVIEW' ||
    fields.ticketUrl.state === 'CONFLICT_REVIEW';
  if (review) {
    return 'REVIEW_REQUIRED';
  }
  const discoveryReady =
    fields.title.state === 'VERIFIED_COMPLETE' &&
    fields.startsAt.state === 'VERIFIED_COMPLETE' &&
    fields.venue.state === 'VERIFIED_COMPLETE' &&
    fields.genres.state !== 'UNRESOLVED_NO_EVIDENCE' &&
    fields.ticketUrl.state !== 'INVALID';
  if (discoveryReady) {
    return 'DISCOVERY_READY';
  }
  return 'PARTIAL';
}

export function auditEventCompleteness(
  runQuery: LinkedQueryExecutor,
  precomputed?: {
    genre?: ReturnType<typeof auditGenreCoverage>;
    lineup?: ReturnType<typeof auditLineupCoverage>;
    description?: ReturnType<typeof auditDescriptionCoverage>;
    ticket?: ReturnType<typeof auditTicketCoverage>;
    events?: ReturnType<typeof loadStagingEventSnapshots>;
  },
): EventCompletenessEntry[] {
  const events = (precomputed?.events ?? loadStagingEventSnapshots(runQuery)).filter(
    (event) => event.status === 'published',
  );
  const genre = new Map(
    (precomputed?.genre ?? auditGenreCoverage(runQuery)).map((entry) => [entry.eventId, entry]),
  );
  const lineup = new Map(
    (precomputed?.lineup ?? auditLineupCoverage(runQuery)).map((entry) => [entry.eventId, entry]),
  );
  const description = new Map(
    (precomputed?.description ?? auditDescriptionCoverage(runQuery)).map((entry) => [entry.eventId, entry]),
  );
  const ticket = new Map(
    (precomputed?.ticket ?? auditTicketCoverage(runQuery)).map((entry) => [entry.eventId, entry]),
  );

  return events.map((event) => {
    const genreEntry = genre.get(event.eventId);
    const lineupEntry = lineup.get(event.eventId);
    const descriptionEntry = description.get(event.eventId);
    const ticketEntry = ticket.get(event.eventId);

    const genreState: FieldCompletenessState =
      genreEntry?.classification === 'GENRE_VERIFIED'
        ? 'VERIFIED_COMPLETE'
        : genreEntry?.classification === 'GENRE_RECOVERABLE'
          ? 'RECOVERABLE'
          : genreEntry?.classification === 'GENRE_CONFLICT_REVIEW'
            ? 'CONFLICT_REVIEW'
            : 'UNRESOLVED_NO_EVIDENCE';

    const lineupState: FieldCompletenessState =
      lineupEntry?.classification === 'LINEUP_COMPLETE'
        ? 'VERIFIED_COMPLETE'
        : lineupEntry?.classification === 'LINEUP_PARTIAL'
          ? 'VERIFIED_PARTIAL'
          : lineupEntry?.classification === 'LINEUP_RECOVERABLE'
            ? 'RECOVERABLE'
            : lineupEntry?.classification === 'LINEUP_CONFLICT_REVIEW'
              ? 'CONFLICT_REVIEW'
              : lineupEntry?.invalidPlaceholderLineup
                ? 'INVALID'
                : 'UNRESOLVED_NO_EVIDENCE';

    const descriptionState: FieldCompletenessState =
      descriptionEntry?.classification === 'DESCRIPTION_VERIFIED'
        ? 'VERIFIED_COMPLETE'
        : descriptionEntry?.classification === 'DESCRIPTION_RECOVERABLE'
          ? 'RECOVERABLE'
          : descriptionEntry?.invalidPrimaryDescription
            ? 'INVALID'
            : 'UNRESOLVED_NO_EVIDENCE';

    const ticketState: FieldCompletenessState =
      ticketEntry?.classification === 'TICKET_TARGET_VERIFIED'
        ? 'VERIFIED_COMPLETE'
        : ticketEntry?.classification === 'TICKET_TARGET_GENERIC' ||
            ticketEntry?.classification === 'TICKET_TARGET_INVALID'
          ? 'INVALID'
          : ticketEntry?.classification === 'TICKET_TARGET_MISSING'
            ? 'UNRESOLVED_NO_EVIDENCE'
            : ticketEntry?.classification === 'NO_TICKET_EXPECTED'
              ? 'VERIFIED_COMPLETE'
              : 'VERIFIED_PARTIAL';

    const fields: EventCompletenessEntry['fields'] = {
      title: { state: event.title?.trim() ? 'VERIFIED_COMPLETE' : 'INVALID', value: event.title },
      startsAt: { state: event.startsAt ? 'VERIFIED_COMPLETE' : 'INVALID', value: event.startsAt },
      endsAt: {
        state: event.endsAt ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE',
        value: event.endsAt,
      },
      venue: {
        state: event.venueName?.trim() ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE',
        value: event.venueName,
      },
      city: {
        state: event.venueCity?.trim() ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE',
        value: event.venueCity,
      },
      organizer: {
        state: event.organizerName?.trim() ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE',
        value: event.organizerName,
      },
      description: {
        state: descriptionState,
        value: event.description,
        reason: descriptionEntry?.reason,
      },
      lineup: {
        state: lineupState,
        value: event.lineup.join(', '),
        reason: lineupEntry?.reason,
      },
      genres: {
        state: genreState,
        value: event.genres.join(', '),
        reason: genreEntry?.reason,
      },
      media: {
        state: event.imageUrl?.trim() ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE',
        value: event.imageUrl,
      },
      ticketUrl: {
        state: ticketState,
        value: ticketEntry?.ticketUrl ?? null,
        reason: ticketEntry?.reason,
      },
      ticketPrice: {
        state:
          ticketEntry?.priceMinor != null
            ? 'VERIFIED_COMPLETE'
            : ticketEntry?.classification === 'NO_TICKET_EXPECTED'
              ? 'VERIFIED_COMPLETE'
              : 'UNRESOLVED_NO_EVIDENCE',
        value: ticketEntry?.priceMinor != null ? String(ticketEntry.priceMinor) : null,
      },
      ticketStatus: {
        state: ticketEntry?.salesStatus ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE',
        value: ticketEntry?.salesStatus,
      },
      sourceBindings: {
        state: event.sources.length > 0 ? 'VERIFIED_COMPLETE' : 'UNRESOLVED_NO_EVIDENCE',
        value: String(event.sources.length),
      },
    };

    return {
      eventId: event.eventId,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venueName,
      city: event.venueCity,
      organizer: event.organizerName,
      fields,
      readiness: readinessFromFields(fields),
      sourceBindings: event.sources.map((source) => ({
        role: source.sourceRole,
        url: source.sourceUrl,
        connectorId: source.connectorId,
      })),
    };
  });
}

export function countInvalidPlaceholderLineups(entries: EventCompletenessEntry[]): number {
  return entries.filter((entry) => {
    const lineup = entry.fields.lineup.value ?? '';
    return lineup
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .some((name) => isLineupPlaceholderLine(name));
  }).length;
}

export function countInvalidDescriptions(entries: EventCompletenessEntry[]): number {
  return entries.filter((entry) => entry.fields.description.state === 'INVALID').length;
}
