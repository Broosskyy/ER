import type { EventCandidate, EventCandidateGenre, EventCandidateLineupAct } from '../types/event-candidate';
import type {
  ChangeClassification,
  EvidenceStrength,
  FieldProvenanceEntry,
  FieldReconciliationResult,
  ReconcilableField,
  ReconciliationEvidenceContext,
  ReconciliationFieldDecision,
  EventReconciliationSummary,
} from './types';

export interface ExistingEventConsumerState {
  eventId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  organizerName: string | null;
  imageUrl: string | null;
  venueId: string | null;
  status: string;
  lineup: EventCandidateLineupAct[];
  genres: EventCandidateGenre[];
}

export interface ReconcileOfficialEventInput {
  candidate: EventCandidate;
  existingEvent?: ExistingEventConsumerState;
  hasExistingSource: boolean;
  fingerprintChanged: boolean;
  sourceUnavailable?: boolean;
}

const BOILERPLATE_PATTERNS = [
  /bootshaus mobile app/i,
  /cookie/i,
  /newsletter/i,
  /follow us/i,
  /snash\.com/i,
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function lineupSignature(lineup: EventCandidateLineupAct[]): string {
  return lineup
    .map((act) => act.billingName.trim().toLowerCase())
    .sort()
    .join('|');
}

function genreSignature(genres: EventCandidateGenre[]): string {
  return genres
    .map((genre) => genre.genreKey.trim().toLowerCase())
    .sort()
    .join('|');
}

import type { EventCandidateVenue } from '../types/event-candidate';

function venueSignatureFromVenue(venue?: EventCandidateVenue): string {
  if (!venue) {
    return '';
  }
  return [venue.name, venue.city, venue.postalCode]
    .map((part) => (part ?? '').trim().toLowerCase())
    .join('|');
}

function isBoilerplateHeavy(description: string): boolean {
  if (description.length < 120) {
    return true;
  }
  return BOILERPLATE_PATTERNS.some((pattern) => pattern.test(description));
}

function titleSimilarity(left: string, right: string): number {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (a === b) {
    return 1;
  }
  if (!a || !b) {
    return 0;
  }
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length / longer.length;
}

function buildEvidenceContext(
  candidate: EventCandidate,
  input: ReconcileOfficialEventInput,
  validationDecision: 'persist_ready' | 'review_required' | 'rejected',
): ReconciliationEvidenceContext {
  if (candidate.origin.kind !== 'official_connector') {
    return {
      connectorId: 'unknown',
      sourceUrl: '',
      observedAt: '',
      enrichmentGaps: [],
      validationDecision,
      sourceAvailable: input.sourceUnavailable !== true,
      parseDegraded: input.sourceUnavailable === true,
      fingerprintChanged: input.fingerprintChanged,
      isNewEvent: !input.hasExistingSource,
    };
  }

  const official = candidate.origin;
  const parseDegraded =
    official.enrichmentGaps.length > 0 ||
    validationDecision !== 'persist_ready' ||
    input.sourceUnavailable === true;

  return {
    connectorId: official.connectorId,
    sourceUrl: official.officialUrl,
    observedAt: official.fetchedAt,
    enrichmentGaps: official.enrichmentGaps,
    validationDecision,
    sourceAvailable: input.sourceUnavailable !== true,
    parseDegraded,
    fingerprintChanged: input.fingerprintChanged,
    isNewEvent: !input.hasExistingSource,
  };
}

function fieldStrength(field: ReconcilableField, context: ReconciliationEvidenceContext): EvidenceStrength {
  if (!context.sourceAvailable) {
    return 'unavailable';
  }
  if (context.validationDecision === 'rejected') {
    return 'unavailable';
  }
  if (!context.fingerprintChanged && !context.isNewEvent) {
    return 'acceptable';
  }

  const gaps = context.enrichmentGaps;
  if (field === 'lineup' && gaps.includes('lineup_not_announced')) {
    return 'weak';
  }
  if (field === 'genres' && gaps.includes('genres_missing')) {
    return 'weak';
  }
  if (field === 'description' && gaps.includes('description_missing')) {
    return 'weak';
  }
  if (field === 'image' && gaps.includes('image_missing')) {
    return 'weak';
  }
  if (context.parseDegraded && context.validationDecision === 'review_required') {
    return 'weak';
  }
  if (context.fingerprintChanged) {
    return gaps.length === 0 ? 'strong' : 'acceptable';
  }
  return 'acceptable';
}

function provenanceEntry(
  field: ReconcilableField,
  result: FieldReconciliationResult,
  context: ReconciliationEvidenceContext,
): FieldProvenanceEntry {
  return {
    field,
    connectorId: context.connectorId,
    sourceUrl: context.sourceUrl,
    observedAt: context.observedAt,
    evidenceStrength: result.evidenceStrength,
    reconciliationResult: result.decision,
    reason: result.reason,
  };
}

function finalizeDecision(
  field: ReconcilableField,
  decision: ReconciliationFieldDecision,
  reason: string,
  context: ReconciliationEvidenceContext,
  options?: { destructiveRisk?: boolean; preservedExisting?: boolean },
): FieldReconciliationResult {
  const strength = fieldStrength(field, context);
  let resolved = decision;
  if (decision === 'accept' && strength === 'unavailable') {
    resolved = 'noop';
    reason = `${reason}:source_unavailable`;
  } else if (decision === 'accept' && strength === 'weak' && options?.destructiveRisk) {
    resolved = 'review_required';
    reason = `${reason}:weak_evidence_blocks_destructive_change`;
  }
  return {
    field,
    decision: resolved,
    evidenceStrength: strength,
    reason,
    destructiveRisk: options?.destructiveRisk,
    preservedExisting: options?.preservedExisting ?? resolved === 'noop',
  };
}

function reconcileScalarField(
  field: ReconcilableField,
  incoming: string | null | undefined,
  existing: string | null | undefined,
  context: ReconciliationEvidenceContext,
  options?: { destructiveShrinkRatio?: number; boilerplateCheck?: boolean },
): FieldReconciliationResult {
  const incomingValue = normalizeText(incoming);
  const existingValue = normalizeText(existing);

  if (!incomingValue && existingValue) {
    return finalizeDecision(field, 'noop', 'preserve_existing_on_missing_incoming', context, {
      preservedExisting: true,
    });
  }
  if (incomingValue === existingValue) {
    return finalizeDecision(field, 'noop', 'unchanged', context);
  }
  if (!existingValue && incomingValue) {
    return finalizeDecision(field, 'accept', 'populate_missing_existing', context);
  }

  let destructiveRisk = false;
  if (options?.destructiveShrinkRatio && existingValue.length > 0) {
    const ratio = incomingValue.length / existingValue.length;
    if (ratio < options.destructiveShrinkRatio) {
      destructiveRisk = true;
    }
  }
  if (options?.boilerplateCheck && destructiveRisk && isBoilerplateHeavy(incomingValue)) {
    return finalizeDecision(field, 'review_required', 'suspicious_shorter_incoming_text', context, {
      destructiveRisk: true,
      preservedExisting: true,
    });
  }

  if (field === 'title' && existingValue && titleSimilarity(incomingValue, existingValue) < 0.45) {
    destructiveRisk = true;
  }

  return finalizeDecision(field, 'accept', 'incoming_value_differs', context, { destructiveRisk });
}

function reconcileLineup(
  incoming: EventCandidateLineupAct[],
  existing: EventCandidateLineupAct[],
  context: ReconciliationEvidenceContext,
): FieldReconciliationResult {
  const field: ReconcilableField = 'lineup';
  if (existing.length > 0 && incoming.length === 0) {
    return finalizeDecision(field, 'noop', 'preserve_existing_lineup_on_empty_incoming', context, {
      preservedExisting: true,
    });
  }
  if (lineupSignature(incoming) === lineupSignature(existing)) {
    return finalizeDecision(field, 'noop', 'unchanged', context);
  }
  if (incoming.length === 0 && existing.length === 0) {
    return finalizeDecision(field, 'noop', 'both_empty', context);
  }
  if (incoming.length > existing.length) {
    return finalizeDecision(field, 'accept', 'lineup_expansion', context);
  }

  const shrinkRatio = existing.length > 0 ? incoming.length / existing.length : 1;
  const destructiveRisk = existing.length >= 4 && incoming.length > 0 && shrinkRatio < 0.5;
  if (destructiveRisk) {
    const strength = fieldStrength(field, context);
    if (strength === 'strong') {
      return finalizeDecision(field, 'accept', 'lineup_replacement_with_strong_evidence', context, {
        destructiveRisk: true,
      });
    }
    return finalizeDecision(field, 'review_required', 'lineup_shrank_without_full_evidence', context, {
      destructiveRisk: true,
      preservedExisting: true,
    });
  }

  if (incoming.length > 0 && existing.length > 0 && incoming.length === existing.length) {
    return finalizeDecision(field, 'accept', 'lineup_reorder_or_substitution', context);
  }

  return finalizeDecision(field, 'accept', 'incoming_lineup_differs', context, { destructiveRisk });
}

function reconcileGenres(
  incoming: EventCandidateGenre[],
  existing: EventCandidateGenre[],
  context: ReconciliationEvidenceContext,
): FieldReconciliationResult {
  const field: ReconcilableField = 'genres';
  if (existing.length > 0 && incoming.length === 0) {
    return finalizeDecision(field, 'noop', 'preserve_existing_genres_on_empty_incoming', context, {
      preservedExisting: true,
    });
  }
  if (genreSignature(incoming) === genreSignature(existing)) {
    return finalizeDecision(field, 'noop', 'unchanged', context);
  }
  if (incoming.length > existing.length) {
    return finalizeDecision(field, 'accept', 'genre_expansion', context);
  }
  if (existing.length > 0 && incoming.length > 0 && incoming.length < existing.length) {
    return finalizeDecision(field, 'review_required', 'genre_shrink_requires_review', context, {
      destructiveRisk: true,
      preservedExisting: true,
    });
  }
  return finalizeDecision(field, 'accept', 'incoming_genres_differ', context);
}

function reconcileVenue(
  candidate: EventCandidate,
  existing: ExistingEventConsumerState,
  context: ReconciliationEvidenceContext,
): FieldReconciliationResult {
  const field: ReconcilableField = 'venue';
  if (!candidate.venue && existing.venueId) {
    return finalizeDecision(field, 'noop', 'preserve_existing_venue_on_missing_incoming', context, {
      preservedExisting: true,
    });
  }
  if (!candidate.venue && !existing.venueId) {
    return finalizeDecision(field, 'noop', 'both_missing', context);
  }
  if (!existing.venueId && candidate.venue) {
    return finalizeDecision(field, 'accept', 'populate_missing_venue', context);
  }
  if (existing.venueId && candidate.venue) {
    return finalizeDecision(field, 'noop', 'existing_venue_binding_preserved', context);
  }
  return finalizeDecision(field, 'noop', 'unchanged', context);
}

function reconcileDateField(
  field: 'startsAt' | 'endsAt',
  incoming: string | undefined,
  existing: string | null | undefined,
  context: ReconciliationEvidenceContext,
): FieldReconciliationResult {
  const incomingValue = normalizeText(incoming);
  const existingValue = normalizeText(existing ?? undefined);
  if (!incomingValue || Number.isNaN(Date.parse(incomingValue))) {
    if (existingValue) {
      return finalizeDecision(field, 'noop', 'preserve_existing_date_on_invalid_incoming', context, {
        preservedExisting: true,
      });
    }
    return finalizeDecision(field, 'reject', 'missing_required_date', context);
  }
  if (incomingValue === existingValue) {
    return finalizeDecision(field, 'noop', 'unchanged', context);
  }
  if (!existingValue) {
    return finalizeDecision(field, 'accept', 'populate_missing_date', context);
  }

  const deltaMs = Math.abs(Date.parse(incomingValue) - Date.parse(existingValue));
  const destructiveRisk = deltaMs > 3 * 60 * 60 * 1000;
  if (destructiveRisk) {
    const strength = fieldStrength(field, context);
    if (strength === 'weak' || strength === 'unavailable') {
      return finalizeDecision(field, 'review_required', 'material_date_shift_requires_review', context, {
        destructiveRisk: true,
        preservedExisting: true,
      });
    }
  }
  return finalizeDecision(field, 'accept', 'incoming_date_differs', context, { destructiveRisk });
}

function classifyChange(
  context: ReconciliationEvidenceContext,
  fieldDecisions: FieldReconciliationResult[],
): ChangeClassification {
  if (!context.sourceAvailable) {
    return 'source_unavailable';
  }
  if (context.isNewEvent) {
    return 'new_event';
  }
  if (!context.fingerprintChanged) {
    return 'unchanged';
  }
  if (fieldDecisions.every((decision) => decision.decision === 'noop')) {
    return 'parse_degraded';
  }
  if (fieldDecisions.some((decision) => decision.decision === 'review_required')) {
    return 'review_required';
  }
  if (
    (context.parseDegraded || context.enrichmentGaps.length > 0) &&
    !fieldDecisions.some((decision) => decision.decision === 'accept')
  ) {
    return 'parse_degraded';
  }
  if (fieldDecisions.some((decision) => decision.destructiveRisk && decision.decision !== 'accept')) {
    return 'ambiguous_update';
  }
  if (fieldDecisions.some((decision) => decision.destructiveRisk && decision.decision === 'accept')) {
    return 'destructive_update';
  }
  if (fieldDecisions.some((decision) => decision.decision === 'accept')) {
    return 'safe_update';
  }
  return 'unchanged';
}

export function buildReconciledCandidate(
  candidate: EventCandidate,
  existing: ExistingEventConsumerState,
  fieldDecisions: FieldReconciliationResult[],
): EventCandidate {
  const decisionMap = new Map(fieldDecisions.map((entry) => [entry.field, entry]));
  const useIncoming = (field: ReconcilableField) => decisionMap.get(field)?.decision === 'accept';

  return {
    ...candidate,
    title: useIncoming('title') ? candidate.title : existing.title,
    description: useIncoming('description') ? candidate.description : (existing.description ?? undefined),
    startsAt: useIncoming('startsAt') ? candidate.startsAt : existing.startsAt,
    endsAt: useIncoming('endsAt') ? candidate.endsAt : (existing.endsAt ?? undefined),
    organizerName: useIncoming('organizer') ? candidate.organizerName : (existing.organizerName ?? undefined),
    imageUrl: useIncoming('image') ? candidate.imageUrl : (existing.imageUrl ?? undefined),
    venue: useIncoming('venue') ? candidate.venue : candidate.venue,
    lineup: useIncoming('lineup') ? candidate.lineup : existing.lineup,
    genres: useIncoming('genres') ? candidate.genres : existing.genres,
    timezone: candidate.timezone || existing.timezone,
  };
}

export function reconcileOfficialEvent(
  input: ReconcileOfficialEventInput & {
    validationDecision: 'persist_ready' | 'review_required' | 'rejected';
  },
): EventReconciliationSummary & {
  reconciledCandidate: EventCandidate;
} {
  const context = buildEvidenceContext(input.candidate, input, input.validationDecision);
  const existing = input.existingEvent;

  if (!context.sourceAvailable) {
    const fieldDecisions: FieldReconciliationResult[] = [];
    const summary: EventReconciliationSummary = {
      classification: 'source_unavailable',
      fieldDecisions,
      fieldProvenance: [],
      reviewRequired: false,
      destructiveUpdatesBlocked: 0,
      reasons: ['source_unavailable'],
    };
    return {
      ...summary,
      reconciledCandidate: existing
        ? buildReconciledCandidate(input.candidate, existing, fieldDecisions)
        : input.candidate,
    };
  }

  if (!existing) {
    if (input.hasExistingSource && input.fingerprintChanged) {
      const fieldDecisions = (
        ['title', 'description', 'startsAt', 'endsAt', 'venue', 'organizer', 'lineup', 'genres', 'image', 'eventStatus'] as const
      ).map((field) => finalizeDecision(field, 'accept', 'legacy_update_without_existing_consumer_snapshot', context));
      return {
        classification: 'safe_update',
        fieldDecisions,
        fieldProvenance: fieldDecisions.map((decision) => provenanceEntry(decision.field, decision, context)),
        reviewRequired: false,
        destructiveUpdatesBlocked: 0,
        reasons: ['existing_official_source_changed'],
        reconciledCandidate: input.candidate,
      };
    }
    if (input.hasExistingSource && !input.fingerprintChanged) {
      const fieldDecisions = (
        ['title', 'description', 'startsAt', 'endsAt', 'venue', 'organizer', 'lineup', 'genres', 'image', 'eventStatus'] as const
      ).map((field) => finalizeDecision(field, 'noop', 'fingerprint_unchanged_without_consumer_snapshot', context));
      return {
        classification: 'unchanged',
        fieldDecisions,
        fieldProvenance: fieldDecisions.map((decision) => provenanceEntry(decision.field, decision, context)),
        reviewRequired: false,
        destructiveUpdatesBlocked: 0,
        reasons: ['existing_official_source_unchanged'],
        reconciledCandidate: input.candidate,
      };
    }

    const fieldDecisions = (
      ['title', 'description', 'startsAt', 'endsAt', 'venue', 'organizer', 'lineup', 'genres', 'image', 'eventStatus'] as const
    ).map((field) =>
      finalizeDecision(field, 'accept', 'new_event_initial_population', {
        ...context,
        isNewEvent: true,
      }),
    );
    return {
      classification: 'new_event',
      fieldDecisions,
      fieldProvenance: fieldDecisions.map((decision) => provenanceEntry(decision.field, decision, context)),
      reviewRequired: false,
      destructiveUpdatesBlocked: 0,
      reasons: ['new_official_source'],
      reconciledCandidate: input.candidate,
    };
  }

  if (!context.fingerprintChanged) {
    const fieldDecisions = (['title', 'description', 'startsAt', 'endsAt', 'venue', 'organizer', 'lineup', 'genres', 'image', 'eventStatus'] as const).map(
      (field) => finalizeDecision(field, 'noop', 'fingerprint_unchanged', context),
    );
    return {
      classification: 'unchanged',
      fieldDecisions,
      fieldProvenance: fieldDecisions.map((decision) => provenanceEntry(decision.field, decision, context)),
      reviewRequired: false,
      destructiveUpdatesBlocked: 0,
      reasons: ['existing_official_source_unchanged'],
      reconciledCandidate: buildReconciledCandidate(input.candidate, existing, fieldDecisions),
    };
  }

  const fieldDecisions: FieldReconciliationResult[] = [
    reconcileScalarField('title', input.candidate.title, existing.title, context, { destructiveShrinkRatio: 0.45 }),
    reconcileScalarField('description', input.candidate.description, existing.description, context, {
      destructiveShrinkRatio: 0.25,
      boilerplateCheck: true,
    }),
    reconcileDateField('startsAt', input.candidate.startsAt, existing.startsAt, context),
    reconcileDateField('endsAt', input.candidate.endsAt, existing.endsAt, context),
    reconcileVenue(input.candidate, existing, context),
    reconcileScalarField('organizer', input.candidate.organizerName, existing.organizerName, context),
    reconcileLineup(input.candidate.lineup, existing.lineup, context),
    reconcileGenres(input.candidate.genres, existing.genres, context),
    reconcileScalarField('image', input.candidate.imageUrl, existing.imageUrl, context),
    finalizeDecision('eventStatus', 'noop', 'event_status_not_auto_mutated_in_m8_2', context),
  ];

  const classification = classifyChange(context, fieldDecisions);
  const reviewRequired = fieldDecisions.some((decision) => decision.decision === 'review_required');
  const destructiveUpdatesBlocked = fieldDecisions.filter(
    (decision) => decision.destructiveRisk && decision.decision !== 'accept',
  ).length;

  return {
    classification,
    fieldDecisions,
    fieldProvenance: fieldDecisions.map((decision) => provenanceEntry(decision.field, decision, context)),
    reviewRequired,
    destructiveUpdatesBlocked,
    reasons: [classification],
    reconciledCandidate: buildReconciledCandidate(input.candidate, existing, fieldDecisions),
  };
}

export function lineupWriteActionFromReconciliation(
  decision: FieldReconciliationResult | undefined,
  incomingLength: number,
): 'replace' | 'noop' {
  if (!decision || decision.decision !== 'accept' || incomingLength === 0) {
    return 'noop';
  }
  return 'replace';
}

export function genresWriteActionFromReconciliation(
  decision: FieldReconciliationResult | undefined,
  incomingLength: number,
): 'replace' | 'noop' {
  if (!decision || decision.decision !== 'accept' || incomingLength === 0) {
    return 'noop';
  }
  return 'replace';
}

export function eventWriteActionFromReconciliation(
  fieldDecisions: FieldReconciliationResult[],
  fingerprintChanged: boolean,
): 'update' | 'noop' {
  if (!fingerprintChanged) {
    return 'noop';
  }
  const eventScalarFields: ReconcilableField[] = [
    'title',
    'description',
    'startsAt',
    'endsAt',
    'organizer',
    'image',
    'venue',
  ];
  const acceptsChange = fieldDecisions.some(
    (decision) => eventScalarFields.includes(decision.field) && decision.decision === 'accept',
  );
  return acceptsChange ? 'update' : 'noop';
}

export function sourceWriteActionFromReconciliation(
  fingerprintChanged: boolean,
  classification: ChangeClassification,
  fieldDecisions: FieldReconciliationResult[],
): 'update' | 'noop' {
  if (!fingerprintChanged) {
    return 'noop';
  }
  if (classification === 'source_unavailable' || classification === 'parse_degraded') {
    const consumerFieldAccepted = fieldDecisions.some(
      (decision) => decision.decision === 'accept' && decision.field !== 'eventStatus',
    );
    return consumerFieldAccepted ? 'update' : 'noop';
  }
  return 'update';
}
