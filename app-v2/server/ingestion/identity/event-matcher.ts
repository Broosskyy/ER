import { canonicalizeOfficialSourceUrl } from './source-identity';
import {
  buildVenueMatchKey,
  calendarDayKey,
  extractTitleYears,
  isoWeekKey,
  lineupOverlapRatio,
  normalizeCity,
  normalizeEventTitle,
  normalizeMatchText,
  startTimeDeltaMs,
  titleSimilarity,
} from './match-normalizers';
import type {
  EventMatchCandidateInput,
  EventMatchCatalogEntry,
  EventMatchResult,
  EventMatchSignal,
  EventSourceBindingRecord,
} from './event-match-types';

const STRONG_TITLE_THRESHOLD = 0.72;
const POSSIBLE_TITLE_THRESHOLD = 0.55;
const STRONG_START_DRIFT_MS = 2 * 60 * 60 * 1000;
const SAME_DAY_DIFFERENT_EVENT_DRIFT_MS = 4 * 60 * 60 * 1000;

interface ScoredCandidate {
  entry: EventMatchCatalogEntry;
  signals: EventMatchSignal[];
  reasons: string[];
  hardMatch: boolean;
  strongScore: number;
  titleScore: number;
  blocked: boolean;
}

function signal(
  name: EventMatchSignal['signal'],
  outcome: EventMatchSignal['outcome'],
  reason: string,
): EventMatchSignal {
  return { signal: name, outcome, reason };
}

function findBindingByUrl(
  bindings: EventSourceBindingRecord[],
  sourceUrl?: string,
): EventSourceBindingRecord | undefined {
  if (!sourceUrl) {
    return undefined;
  }
  const canonical = canonicalizeOfficialSourceUrl(sourceUrl);
  return bindings.find(
    (binding) => binding.sourceUrl && canonicalizeOfficialSourceUrl(binding.sourceUrl) === canonical,
  );
}

function findBindingByExternalId(
  bindings: EventSourceBindingRecord[],
  connectorId?: string,
  sourceEventKey?: string,
): EventSourceBindingRecord | undefined {
  if (!connectorId || !sourceEventKey) {
    return undefined;
  }
  return bindings.find(
    (binding) => binding.connectorId === connectorId && binding.sourceEventKey === sourceEventKey,
  );
}

function evaluateFalseMergeGuards(
  candidate: EventMatchCandidateInput,
  entry: EventMatchCatalogEntry,
): { blocked: boolean; signals: EventMatchSignal[]; reasons: string[] } {
  const signals: EventMatchSignal[] = [];
  const reasons: string[] = [];

  const candidateYears = extractTitleYears(candidate.title);
  const entryYears = extractTitleYears(entry.title);
  if (candidateYears.length > 0 && entryYears.length > 0) {
    const sameYear = candidateYears.some((year) => entryYears.includes(year));
    if (!sameYear) {
      signals.push(signal('title', 'blocked', 'festival_edition_year_mismatch'));
      reasons.push('festival_edition_year_mismatch');
      return { blocked: true, signals, reasons };
    }
  }

  const candidateVenueKey = buildVenueMatchKey(candidate);
  const entryVenueKey = buildVenueMatchKey(entry);
  const sameCity =
    normalizeCity(candidate.venueCity) &&
    normalizeCity(candidate.venueCity) === normalizeCity(entry.venueCity);
  const titleScore = titleSimilarity(candidate.title, entry.title);

  if (titleScore >= 0.9 && candidateVenueKey && entryVenueKey && candidateVenueKey !== entryVenueKey && sameCity) {
    signals.push(signal('venue', 'blocked', 'similar_title_different_venue_same_city'));
    reasons.push('similar_title_different_venue_same_city');
    return { blocked: true, signals, reasons };
  }

  const candidateWeek = isoWeekKey(candidate.startsAt, candidate.timezone);
  const entryWeek = isoWeekKey(entry.startsAt, entry.timezone);
  if (
    titleScore >= 0.9 &&
    candidateVenueKey &&
    entryVenueKey &&
    candidateVenueKey === entryVenueKey &&
    candidateWeek &&
    entryWeek &&
    candidateWeek !== entryWeek
  ) {
    signals.push(signal('datetime', 'blocked', 'recurring_series_different_week'));
    reasons.push('recurring_series_different_week');
    return { blocked: true, signals, reasons };
  }

  const candidateDay = calendarDayKey(candidate.startsAt, candidate.timezone);
  const entryDay = calendarDayKey(entry.startsAt, entry.timezone);
  const drift = startTimeDeltaMs(candidate.startsAt, entry.startsAt);
  if (
    candidateDay &&
    entryDay &&
    candidateDay === entryDay &&
    candidateVenueKey &&
    entryVenueKey &&
    candidateVenueKey === entryVenueKey &&
    drift != null &&
    drift >= SAME_DAY_DIFFERENT_EVENT_DRIFT_MS &&
    titleScore < STRONG_TITLE_THRESHOLD
  ) {
    signals.push(signal('datetime', 'blocked', 'same_day_same_venue_different_event_window'));
    reasons.push('same_day_same_venue_different_event_window');
    return { blocked: true, signals, reasons };
  }

  return { blocked: false, signals, reasons };
}

function scoreCatalogEntry(
  candidate: EventMatchCandidateInput,
  entry: EventMatchCatalogEntry,
): ScoredCandidate {
  const signals: EventMatchSignal[] = [];
  const reasons: string[] = [];

  const urlBinding = findBindingByUrl(entry.sourceBindings, candidate.sourceUrl);
  if (urlBinding) {
    signals.push(signal('source_binding', 'match', 'canonical_source_url_already_bound'));
    return {
      entry,
      signals,
      reasons: ['canonical_source_url_already_bound'],
      hardMatch: true,
      strongScore: 1,
      titleScore: 1,
      blocked: false,
    };
  }

  const externalBinding = findBindingByExternalId(
    entry.sourceBindings,
    candidate.connectorId,
    candidate.sourceEventKey,
  );
  if (externalBinding) {
    signals.push(signal('external_id', 'match', 'source_scoped_external_id_match'));
    return {
      entry,
      signals,
      reasons: ['source_scoped_external_id_match'],
      hardMatch: true,
      strongScore: 1,
      titleScore: 1,
      blocked: false,
    };
  }

  const guard = evaluateFalseMergeGuards(candidate, entry);
  if (guard.blocked) {
    return {
      entry,
      signals: [...guard.signals],
      reasons: guard.reasons,
      hardMatch: false,
      strongScore: 0,
      titleScore: titleSimilarity(candidate.title, entry.title),
      blocked: true,
    };
  }

  const titleScore = titleSimilarity(candidate.title, entry.title);
  if (titleScore >= STRONG_TITLE_THRESHOLD) {
    signals.push(signal('title', 'match', `title_similarity_${titleScore.toFixed(2)}`));
  } else if (titleScore >= POSSIBLE_TITLE_THRESHOLD) {
    signals.push(signal('title', 'partial', `title_similarity_${titleScore.toFixed(2)}`));
  } else {
    signals.push(signal('title', 'mismatch', `title_similarity_${titleScore.toFixed(2)}`));
  }

  const candidateDay = calendarDayKey(candidate.startsAt, candidate.timezone);
  const entryDay = calendarDayKey(entry.startsAt, entry.timezone);
  const drift = startTimeDeltaMs(candidate.startsAt, entry.startsAt);
  if (candidateDay && entryDay && candidateDay === entryDay) {
    if (drift != null && drift <= STRONG_START_DRIFT_MS) {
      signals.push(signal('datetime', 'match', 'same_calendar_day_within_drift'));
    } else {
      signals.push(signal('datetime', 'partial', 'same_calendar_day_outside_drift'));
    }
  } else if (drift != null && drift <= STRONG_START_DRIFT_MS) {
    signals.push(signal('datetime', 'partial', 'cross_day_within_small_drift'));
  } else {
    signals.push(signal('datetime', 'mismatch', 'datetime_not_aligned'));
  }

  const candidateVenueKey = buildVenueMatchKey(candidate);
  const entryVenueKey = buildVenueMatchKey(entry);
  if (candidateVenueKey && entryVenueKey) {
    signals.push(
      signal(
        'venue',
        candidateVenueKey === entryVenueKey ? 'match' : 'mismatch',
        candidateVenueKey === entryVenueKey ? 'venue_key_match' : 'venue_key_mismatch',
      ),
    );
  } else {
    signals.push(signal('venue', 'missing', 'venue_missing'));
  }

  if (normalizeCity(candidate.venueCity) && normalizeCity(entry.venueCity)) {
    signals.push(
      signal(
        'city',
        normalizeCity(candidate.venueCity) === normalizeCity(entry.venueCity) ? 'match' : 'mismatch',
        'city_comparison',
      ),
    );
  } else {
    signals.push(signal('city', 'missing', 'city_missing'));
  }

  if (candidate.organizerName && entry.organizerName) {
    signals.push(
      signal(
        'organizer',
        normalizeMatchText(candidate.organizerName) === normalizeMatchText(entry.organizerName)
          ? 'match'
          : 'partial',
        'organizer_comparison',
      ),
    );
  } else {
    signals.push(signal('organizer', 'missing', 'organizer_missing'));
  }

  const lineupScore = lineupOverlapRatio(candidate.lineupBillingNames, entry.lineupBillingNames);
  if (lineupScore >= 0.5) {
    signals.push(signal('lineup', 'match', `lineup_overlap_${lineupScore.toFixed(2)}`));
  } else if (lineupScore > 0) {
    signals.push(signal('lineup', 'partial', `lineup_overlap_${lineupScore.toFixed(2)}`));
  } else if (candidate.lineupBillingNames.length === 0 && entry.lineupBillingNames.length === 0) {
    signals.push(signal('lineup', 'missing', 'lineup_missing_both'));
  } else {
    signals.push(signal('lineup', 'mismatch', 'lineup_no_overlap'));
  }

  const titleMatch = signals.find((entrySignal) => entrySignal.signal === 'title')?.outcome === 'match';
  const datetimeMatch = signals.find((entrySignal) => entrySignal.signal === 'datetime')?.outcome === 'match';
  const venueMatch = signals.find((entrySignal) => entrySignal.signal === 'venue')?.outcome === 'match';
  const cityMatch = signals.find((entrySignal) => entrySignal.signal === 'city')?.outcome === 'match';
  const lineupMatch = signals.find((entrySignal) => entrySignal.signal === 'lineup')?.outcome === 'match';

  let strongScore = 0;
  if (titleMatch) strongScore += 0.35;
  if (datetimeMatch) strongScore += 0.3;
  if (venueMatch) strongScore += 0.2;
  if (cityMatch) strongScore += 0.05;
  if (lineupMatch) strongScore += 0.1;

  if (titleMatch && datetimeMatch && venueMatch && cityMatch) {
    reasons.push('composite_strong_identity');
  } else if (titleMatch && datetimeMatch && venueMatch) {
    reasons.push('composite_strong_without_lineup');
  } else if (titleScore >= POSSIBLE_TITLE_THRESHOLD) {
    reasons.push('composite_possible_identity');
  } else {
    reasons.push('composite_weak_identity');
  }

  return {
    entry,
    signals,
    reasons,
    hardMatch: false,
    strongScore,
    titleScore,
    blocked: false,
  };
}

export function matchEventToCatalog(
  candidate: EventMatchCandidateInput,
  catalog: EventMatchCatalogEntry[],
): EventMatchResult {
  if (catalog.length === 0) {
    return {
      decision: 'no_match',
      signals: [],
      reasons: ['catalog_empty'],
      autoBindAllowed: false,
    };
  }

  const scored = catalog
    .map((entry) => scoreCatalogEntry(candidate, entry))
    .sort((left, right) => right.strongScore - left.strongScore);

  const hard = scored.find((entry) => entry.hardMatch);
  if (hard) {
    return {
      decision: 'exact_match',
      candidateEventId: hard.entry.eventId,
      signals: hard.signals,
      reasons: hard.reasons,
      autoBindAllowed: true,
    };
  }

  const blockedOnly = scored.every((entry) => entry.blocked);
  if (blockedOnly && scored.length > 0) {
    return {
      decision: 'no_match',
      signals: scored[0]?.signals ?? [],
      reasons: [...(scored[0]?.reasons ?? []), 'false_merge_guard_blocked'],
      autoBindAllowed: false,
    };
  }

  const best = scored.find((entry) => !entry.blocked);
  if (!best) {
    return {
      decision: 'no_match',
      signals: [],
      reasons: ['no_viable_catalog_entry'],
      autoBindAllowed: false,
    };
  }

  const titleOutcome = best.signals.find((entry) => entry.signal === 'title')?.outcome;
  const datetimeOutcome = best.signals.find((entry) => entry.signal === 'datetime')?.outcome;
  const venueOutcome = best.signals.find((entry) => entry.signal === 'venue')?.outcome;
  const cityOutcome = best.signals.find((entry) => entry.signal === 'city')?.outcome;

  const lineupOutcome = best.signals.find((entry) => entry.signal === 'lineup')?.outcome;

  const lineupSupportedStrong =
    datetimeOutcome === 'match' &&
    venueOutcome === 'match' &&
    lineupOutcome === 'match' &&
    best.titleScore >= 0.5;

  const strongEligible =
    lineupSupportedStrong ||
    (best.strongScore >= 0.85 &&
      titleOutcome === 'match' &&
      (datetimeOutcome === 'match' || datetimeOutcome === 'partial') &&
      venueOutcome === 'match');

  if (strongEligible) {
    const competingStrong = scored.filter(
      (entry) =>
        !entry.blocked &&
        entry.entry.eventId !== best.entry.eventId &&
        entry.strongScore >= 0.75 &&
        titleSimilarity(entry.entry.title, best.entry.title) >= POSSIBLE_TITLE_THRESHOLD,
    );
    if (competingStrong.length > 0) {
      return {
        decision: 'review_required',
        signals: best.signals,
        reasons: [...best.reasons, 'ambiguous_competing_candidates'],
        autoBindAllowed: false,
      };
    }

    return {
      decision: 'strong_match',
      candidateEventId: best.entry.eventId,
      signals: best.signals,
      reasons: best.reasons,
      autoBindAllowed: true,
    };
  }

  const ambiguousEligible =
    titleOutcome === 'partial' &&
    cityOutcome === 'match' &&
    datetimeOutcome === 'mismatch';

  const possibleEligible =
    ambiguousEligible ||
    (best.strongScore >= 0.55 &&
      (titleOutcome === 'match' || titleOutcome === 'partial') &&
      venueOutcome !== 'mismatch') ||
    (titleOutcome === 'partial' &&
      cityOutcome === 'match' &&
      (datetimeOutcome === 'partial' || datetimeOutcome === 'match'));

  if (possibleEligible) {
    return {
      decision: 'review_required',
      candidateEventId: best.entry.eventId,
      signals: best.signals,
      reasons: [...best.reasons, 'possible_match_requires_review'],
      autoBindAllowed: false,
    };
  }

  return {
    decision: 'no_match',
    signals: best.signals,
    reasons: [...best.reasons, 'insufficient_identity_evidence'],
    autoBindAllowed: false,
  };
}

export function candidateInputFromEventCandidate(candidate: import('../types/event-candidate').EventCandidate): EventMatchCandidateInput {
  const origin = candidate.origin;
  return {
    title: candidate.title,
    startsAt: candidate.startsAt,
    endsAt: candidate.endsAt,
    timezone: candidate.timezone,
    venueName: candidate.venue?.name,
    venueCity: candidate.venue?.city,
    venuePostalCode: candidate.venue?.postalCode,
    organizerName: candidate.organizerName,
    lineupBillingNames: candidate.lineup.map((act) => act.billingName),
    sourceUrl: origin.kind === 'official_connector' ? origin.officialUrl : undefined,
    sourceEventKey: origin.kind === 'official_connector' ? origin.sourceEventKey : undefined,
    connectorId: origin.kind === 'official_connector' ? origin.connectorId : undefined,
  };
}

export function catalogEntryFromCandidate(
  candidate: import('../types/event-candidate').EventCandidate,
  eventId: string,
  sourceBindings: EventSourceBindingRecord[] = [],
): EventMatchCatalogEntry {
  return {
    eventId,
    title: candidate.title,
    startsAt: candidate.startsAt,
    endsAt: candidate.endsAt ?? null,
    timezone: candidate.timezone,
    venueName: candidate.venue?.name,
    venueCity: candidate.venue?.city,
    venuePostalCode: candidate.venue?.postalCode,
    organizerName: candidate.organizerName,
    lineupBillingNames: candidate.lineup.map((act) => act.billingName),
    sourceBindings,
  };
}
