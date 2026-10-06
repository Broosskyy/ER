import {
  assessConsumerDuplicatePair,
  buildConsumerDuplicateGroups,
} from '../../../../src/features/events/discovery/consumer-discovery-feed';
import type { EventSummary } from '../../../../src/features/events/types/event-core';
import {
  classifyConsumerEventLifecycle,
  isDiscoverableConsumerLifecycle,
} from '../../../../shared/consumer-event-lifecycle';
import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { loadPublishedEventSummaries } from './controlled-import-audit';
import { titleSimilarity } from '../../../../shared/match-normalizers';
import { calendarDayKey, normalizeVenueName, normalizeCity, startTimeDeltaMs } from '../../../../shared/match-normalizers';

export type DuplicateAuditClassification =
  | 'CONFIRMED_DUPLICATE'
  | 'HIGH_CONFIDENCE_DUPLICATE'
  | 'AMBIGUOUS_REVIEW'
  | 'DISTINCT';

export interface StagingDuplicateGroup {
  classification: DuplicateAuditClassification;
  eventIds: string[];
  titles: string[];
  reasons: string[];
  winnerId?: string;
}

function discoverablePublishedEvents(
  summaries: EventSummary[],
  referenceInstant: Date,
): EventSummary[] {
  return summaries.filter((event) => {
    const lifecycle = classifyConsumerEventLifecycle({
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: 'published',
      referenceInstant,
    });
    return isDiscoverableConsumerLifecycle(lifecycle);
  });
}

export function auditStagingDuplicateGroups(
  runQuery: LinkedQueryExecutor,
  referenceInstant: Date,
): StagingDuplicateGroup[] {
  const summaries = loadPublishedEventSummaries(runQuery);
  const currentEvents = discoverablePublishedEvents(summaries, referenceInstant);
  const consumerGroups = buildConsumerDuplicateGroups(currentEvents);
  const groups: StagingDuplicateGroup[] = [];

  for (const group of consumerGroups) {
    groups.push({
      classification: group.confidence === 'high' ? 'HIGH_CONFIDENCE_DUPLICATE' : 'AMBIGUOUS_REVIEW',
      eventIds: group.eventIds,
      titles: group.titles,
      reasons: ['consumer_duplicate_group'],
      winnerId: group.winnerId,
    });
  }

  const consumed = new Set(groups.flatMap((group) => group.eventIds));
  for (let i = 0; i < currentEvents.length; i += 1) {
    for (let j = i + 1; j < currentEvents.length; j += 1) {
      const left = currentEvents[i]!;
      const right = currentEvents[j]!;
      if (consumed.has(left.id) || consumed.has(right.id)) {
        continue;
      }
      const assessment = assessConsumerDuplicatePair(left, right);
      if (assessment.confidence === 'none') {
        continue;
      }
      const titleScore = titleSimilarity(left.title, right.title);
      const timezone = left.timezone ?? right.timezone ?? 'Europe/Berlin';
      const sameDay = calendarDayKey(left.startsAt, timezone) === calendarDayKey(right.startsAt, timezone);
      const sameVenue =
        normalizeVenueName(left.venue?.name) &&
        normalizeVenueName(left.venue?.name) === normalizeVenueName(right.venue?.name) &&
        normalizeCity(left.venue?.city ?? '') === normalizeCity(right.venue?.city ?? '');
      const drift = startTimeDeltaMs(left.startsAt, right.startsAt);
      const classification: DuplicateAuditClassification =
        assessment.confidence === 'high' && titleScore >= 0.9 && sameDay && sameVenue
          ? 'CONFIRMED_DUPLICATE'
          : assessment.confidence === 'high'
            ? 'HIGH_CONFIDENCE_DUPLICATE'
            : 'AMBIGUOUS_REVIEW';
      groups.push({
        classification,
        eventIds: [left.id, right.id],
        titles: [left.title, right.title],
        reasons: assessment.reasons,
      });
      consumed.add(left.id);
      consumed.add(right.id);
    }
  }

  return groups;
}

export function countDuplicateGroups(groups: StagingDuplicateGroup[]): {
  confirmedDuplicateGroups: number;
  highConfidenceDuplicateGroups: number;
  ambiguousDuplicateGroups: number;
} {
  return {
    confirmedDuplicateGroups: groups.filter((group) => group.classification === 'CONFIRMED_DUPLICATE').length,
    highConfidenceDuplicateGroups: groups.filter(
      (group) =>
        group.classification === 'HIGH_CONFIDENCE_DUPLICATE' || group.classification === 'CONFIRMED_DUPLICATE',
    ).length,
    ambiguousDuplicateGroups: groups.filter((group) => group.classification === 'AMBIGUOUS_REVIEW').length,
  };
}
