import type { EventCandidate, EventCandidateValidation } from '../types/event-candidate';

function isHttpsUrl(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('https://');
}

export function validateEventCandidate(candidate: EventCandidate): EventCandidateValidation {
  const reasons: string[] = [];

  if (!candidate.title.trim()) {
    reasons.push('missing_title');
  }

  if (!candidate.startsAt || Number.isNaN(Date.parse(candidate.startsAt))) {
    reasons.push('invalid_starts_at');
  }

  if (candidate.endsAt && Date.parse(candidate.endsAt) < Date.parse(candidate.startsAt)) {
    reasons.push('end_before_start');
  }

  if (!candidate.venue?.name?.trim()) {
    reasons.push('missing_venue');
  }

  if (candidate.imageUrl && !isHttpsUrl(candidate.imageUrl)) {
    reasons.push('invalid_image_url');
  }

  if (candidate.origin.kind === 'official_connector') {
    if (!isHttpsUrl(candidate.origin.officialUrl)) {
      reasons.push('missing_official_url');
    }
    if (!candidate.origin.sourceEventKey.trim()) {
      reasons.push('missing_source_event_key');
    }
    if (!candidate.origin.pageFingerprint.trim()) {
      reasons.push('missing_fingerprint');
    }
  }

  const lineupNames = new Set<string>();
  for (const act of candidate.lineup) {
    const key = act.billingName.trim().toLowerCase();
    if (lineupNames.has(key)) {
      reasons.push('duplicate_lineup_entry');
    }
    lineupNames.add(key);
  }

  const sortOrders = candidate.lineup.map((act) => act.sortOrder);
  if (new Set(sortOrders).size !== sortOrders.length) {
    reasons.push('duplicate_lineup_sort_order');
  }

  if (reasons.length > 0) {
    return {
      decision: reasons.some((reason) =>
        ['missing_title', 'invalid_starts_at', 'end_before_start', 'missing_official_url'].includes(reason),
      )
        ? 'rejected'
        : 'review_required',
      reasons,
    };
  }

  return { decision: 'persist_ready', reasons: [] };
}
