import { canonicalizeOfficialSourceUrl } from '../identity/source-identity';
import type { EventWritePlan } from '../types/event-candidate';

/** Fail closed: matching title/date is NOT a source-event binding. */
export function hasVerifiedExistingSourceBinding(plan: EventWritePlan): boolean {
  const existing = plan.existingSource;
  const origin = plan.candidate.origin;
  if (!existing || !plan.resolvedEventId ||
      existing.eventId !== plan.resolvedEventId ||
      origin.kind !== 'official_connector' ||
      !origin.sourceEventKey || !origin.officialUrl ||
      (existing.sourceEventKey && existing.sourceEventKey !== origin.sourceEventKey)) {
    return false;
  }
  try {
    return canonicalizeOfficialSourceUrl(existing.sourceUrl) ===
      canonicalizeOfficialSourceUrl(origin.officialUrl);
  } catch {
    return false;
  }
}
