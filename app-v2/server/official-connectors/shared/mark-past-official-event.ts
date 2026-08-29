import { isPastConsumerEvent } from '../../ingestion/consumer-event-cutoff';
import type { OfficialEventEvidence } from '../types';

export function markPastOfficialEventIfNeeded(
  evidence: OfficialEventEvidence,
  referenceInstant?: Date,
): OfficialEventEvidence {
  if (!evidence.startsAt) {
    return evidence;
  }

  if (
    isPastConsumerEvent({
      startsAt: evidence.startsAt,
      endsAt: evidence.endsAt,
      referenceInstant,
    })
  ) {
    return {
      ...evidence,
      enrichmentGaps: [...new Set([...evidence.enrichmentGaps, 'past_event_skipped'])],
    };
  }

  return evidence;
}
