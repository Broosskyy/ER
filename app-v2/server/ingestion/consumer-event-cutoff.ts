export {
  CONSUMER_EVENT_TIMEZONE,
  berlinLocalMidnightUtcMs,
  berlinYmd,
  classifyConsumerEventLifecycle,
  isDiscoverableConsumerLifecycle,
  isPastConsumerEvent,
  type ConsumerEventLifecycleStatus,
  type ConsumerEventWindowInput,
} from '../../shared/consumer-event-lifecycle';

/** M9.2.2 cleanup reference — events active from this Berlin local date onward. */
export const M9_2_2_ACTIVE_FROM_BERLIN_YMD = '2026-08-29';

export function m9_2_2CleanupReferenceInstant(): Date {
  return new Date(`${M9_2_2_ACTIVE_FROM_BERLIN_YMD}T12:00:00+02:00`);
}

/** Berlin-local audit date for M9.2.2.5 recertification (override via AUDIT_DATE_LOCAL). */
export function auditDateLocalYmd(): string {
  return process.env.AUDIT_DATE_LOCAL ?? '2026-09-01';
}

export function auditReferenceInstant(): Date {
  const ymd = auditDateLocalYmd();
  return new Date(`${ymd}T12:00:00+02:00`);
}
