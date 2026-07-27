import type { Event } from '@/features/events/types/event';
import type { EventConflict } from '@/features/aggregation/merge/event-conflict';

export type PublishReadiness = 'ready' | 'needs_review' | 'blocked';

export interface PublishReadinessResult {
  status: PublishReadiness;
  reasonCodes: string[];
}

export class PublishReadinessResolver {
  resolve(
    event: Event,
    input: {
      conflicts?: EventConflict[];
      unresolvedDuplicate?: boolean;
      activeSourceCount?: number;
      sourceBlocked?: boolean;
      manualReviewRequired?: boolean;
    } = {},
  ): PublishReadinessResult {
    const reasonCodes: string[] = [];
    if (!event.title.trim()) reasonCodes.push('missing_title');
    if (!Number.isFinite(new Date(event.startDateTime).getTime())) reasonCodes.push('invalid_date');
    if (!event.city.trim()) reasonCodes.push('missing_city');
    if (!event.venue.trim()) reasonCodes.push('missing_venue');
    if (event.ticketUrl && !/^https?:\/\//.test(event.ticketUrl)) reasonCodes.push('invalid_ticket_data');
    if (input.unresolvedDuplicate) reasonCodes.push('unresolved_duplicate');
    if (input.sourceBlocked) reasonCodes.push('blocked_source');
    if (input.activeSourceCount === 0) reasonCodes.push('no_active_source');
    if ((input.conflicts ?? []).some((conflict) => !conflict.resolved && conflict.severity === 'critical')) {
      reasonCodes.push('critical_schedule_conflict');
    }

    const blocked = reasonCodes.some((code) =>
      ['missing_title', 'invalid_date', 'missing_city', 'missing_venue', 'blocked_source', 'no_active_source',
       'critical_schedule_conflict'].includes(code),
    );
    if (blocked) return { status: 'blocked', reasonCodes };
    if (input.manualReviewRequired || input.unresolvedDuplicate ||
      (input.conflicts ?? []).some((conflict) => !conflict.resolved && conflict.severity === 'warning')) {
      return { status: 'needs_review', reasonCodes: [...reasonCodes, 'manual_review_required'] };
    }
    return { status: 'ready', reasonCodes };
  }
}

export const publishReadinessResolver = new PublishReadinessResolver();
