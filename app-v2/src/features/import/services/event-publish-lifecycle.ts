import type { AdminEventRecord } from '@/data/types/records';

export interface EventPublishLifecycleInput {
  existing?: AdminEventRecord | null;
  normalizedPayload?: Record<string, unknown>;
  publishedAt?: string;
}

function readTimestamp(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function applyEventPublishLifecycle(
  event: AdminEventRecord,
  input: EventPublishLifecycleInput = {},
): AdminEventRecord {
  const now = input.publishedAt ?? new Date().toISOString();
  const normalized = input.normalizedPayload ?? {};

  let cancelledAt = input.existing?.cancelledAt;
  let postponedAt = input.existing?.postponedAt;

  const normalizedCancelledAt = readTimestamp(normalized.cancelledAt);
  const normalizedPostponedAt = readTimestamp(normalized.postponedAt);

  if (normalizedCancelledAt) {
    cancelledAt = normalizedCancelledAt;
  } else if (normalized.isCancelled === true && !cancelledAt) {
    cancelledAt = now;
  }

  if (normalizedPostponedAt) {
    postponedAt = normalizedPostponedAt;
  } else if (normalized.isPostponed === true && !postponedAt) {
    postponedAt = now;
  }

  const canonicalEventId = input.existing?.canonicalEventId ?? event.canonicalEventId ?? event.id;
  const isFirstPublish = !input.existing?.firstPublishedAt;

  return {
    ...event,
    canonicalEventId,
    firstPublishedAt: input.existing?.firstPublishedAt ?? now,
    publishedAt: isFirstPublish ? now : input.existing?.publishedAt ?? now,
    lastSeenAt: now,
    lastImportedAt: now,
    cancelledAt,
    postponedAt,
    timezone:
      typeof normalized.timezone === 'string'
        ? normalized.timezone
        : event.timezone ?? input.existing?.timezone,
  };
}
